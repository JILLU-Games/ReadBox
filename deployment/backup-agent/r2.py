"""Cloudflare R2 only: fixed S3 endpoint, encrypted host credentials, V2-only objects.

No user-selected URL, local path, remote deletion or restore. Untrusted network
exceptions are reduced to constant code strings outside this module.
"""
from __future__ import annotations

import hashlib
import os
from pathlib import Path
import re
import secrets
import time

from storage import atomic_json, now, valid_id
from verification import _digest, verify_age_snapshot

ACCOUNT = re.compile(r"^[a-f0-9]{32}$")
BUCKET = re.compile(r"^(?=.{3,63}$)[a-z0-9](?:[a-z0-9-]*[a-z0-9])$")
ACCESS = re.compile(r"^[A-Za-z0-9]{12,80}$")
SECRET = re.compile(r"^[A-Za-z0-9/+_=.-]{32,128}$")
PREFIX = "readbox/managed/"
SAFE_KEY = re.compile(r"^readbox/managed/([0-9a-f]{32})\.age$")
MAX_REMOTE_LIST_PAGES = 25
MAX_R2_UPLOAD_ATTEMPTS = 3
RETRY_BACKOFF_SECONDS = (0.15, 0.45)


class R2Error(RuntimeError):
    def __init__(self, code: str):
        self.code = code
        super().__init__("R2 operation refused")


def _transient_remote_error(error: Exception) -> bool:
    """Only timeouts/transport errors or 408/429/5xx may be retried."""
    status = getattr(error, "response", {}).get("ResponseMetadata", {}).get("HTTPStatusCode")
    if status in {408, 429, 500, 502, 503, 504}:
        return True
    if isinstance(error, (TimeoutError, ConnectionError, OSError)):
        return True
    # botocore transport failures are not always OSError subclasses.
    from botocore.exceptions import (
        ConnectionClosedError, ConnectTimeoutError, EndpointConnectionError,
        ReadTimeoutError,
    )
    return isinstance(error, (
        ConnectionClosedError, ConnectTimeoutError, EndpointConnectionError,
        ReadTimeoutError,
    ))


def _private_secret(path: Path, data: bytes, mode: int = 0o600) -> None:
    if path.exists() or path.is_symlink():
        raise R2Error("R2_SECRET_ALREADY_EXISTS")
    fd = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW, mode)
    try:
        with os.fdopen(fd, "wb") as out:
            out.write(data)
            out.flush()
            os.fsync(out.fileno())
    except BaseException:
        path.unlink(missing_ok=True)
        raise


def _check_secret(path: Path) -> None:
    if path.is_symlink() or not path.is_file() or (path.stat().st_mode & 0o777) != 0o600:
        raise R2Error("R2_LOCAL_KEY_UNSAFE")


def _client(config: dict):
    import boto3
    from botocore.config import Config

    account = config["accountId"]
    if not ACCOUNT.fullmatch(account):
        raise R2Error("R2_CONFIG_INVALID")
    return boto3.client(
        "s3", endpoint_url=f"https://{account}.r2.cloudflarestorage.com",
        region_name="auto", aws_access_key_id=config["accessKeyId"],
        aws_secret_access_key=config["secretAccessKey"],
        config=Config(signature_version="s3v4",
                      connect_timeout=2, read_timeout=3,
                      retries={"max_attempts": 1, "mode": "standard"},
                      s3={"addressing_style": "path"}),
    )


class R2Adapter:
    def __init__(self, store, executor):
        self.store = store
        self.executor = executor
        self.key_file = store.root / "r2-master.key"
        self.config_file = store.root / "r2-credentials.enc"

    def _key(self, create: bool = False) -> bytes:
        if not self.key_file.exists() and create:
            try:
                _private_secret(self.key_file, secrets.token_bytes(32))
            except FileExistsError:
                pass
        _check_secret(self.key_file)
        key = self.key_file.read_bytes()
        if len(key) != 32:
            raise R2Error("R2_LOCAL_KEY_UNSAFE")
        return key

    def _current(self) -> dict | None:
        if not self.config_file.exists():
            return None
        _check_secret(self.config_file)
        from cryptography.hazmat.primitives.ciphers.aead import AESGCM
        import json

        raw = self.config_file.read_bytes()
        if len(raw) > 4096 or len(raw) < 30:
            raise R2Error("R2_CONFIG_INVALID")
        try:
            data = AESGCM(self._key()).decrypt(raw[:12], raw[12:], b"readbox-r2-v1")
            config = json.loads(data)
        except Exception:
            raise R2Error("R2_CONFIG_INVALID") from None
        self.validate(config)
        return config

    @staticmethod
    def validate(config: dict) -> None:
        if not isinstance(config, dict) or set(config) != {
            "accountId", "bucket", "accessKeyId", "secretAccessKey"
        }:
            raise R2Error("R2_CONFIG_INVALID")
        if (not isinstance(config["accountId"], str) or
            not ACCOUNT.fullmatch(config["accountId"]) or
            not isinstance(config["bucket"], str) or
            not BUCKET.fullmatch(config["bucket"]) or
            not isinstance(config["accessKeyId"], str) or
            not ACCESS.fullmatch(config["accessKeyId"]) or
            not isinstance(config["secretAccessKey"], str) or
            not SECRET.fullmatch(config["secretAccessKey"])):
            raise R2Error("R2_CONFIG_INVALID")

    def public(self) -> dict:
        config = self._current()
        if config is None:
            return {"configured": False, "bucket": None, "accountIdLast4": None,
                    "accessKeyLast4": None, "prefix": PREFIX}
        return {"configured": True, "bucket": config["bucket"],
                "accountIdLast4": config["accountId"][-4:],
                "accessKeyLast4": config["accessKeyId"][-4:], "prefix": PREFIX}

    def _probe(self, config: dict) -> None:
        client = _client(config)
        bucket = config["bucket"]
        key = PREFIX + "health/" + secrets.token_hex(16) + ".probe"
        payload = secrets.token_bytes(128)
        may_exist = False
        try:
            client.list_objects_v2(Bucket=bucket, Prefix=PREFIX, MaxKeys=1)
            # A lost PUT acknowledgement may still leave an object. Mark
            # ownership BEFORE sending and always attempt exact-key cleanup.
            may_exist = True
            client.put_object(Bucket=bucket, Key=key, Body=payload,
                              Metadata={"kind": "probe"})
            head = client.head_object(Bucket=bucket, Key=key)
            body = client.get_object(Bucket=bucket, Key=key)["Body"]
            try:
                actual = body.read(1024)
            finally:
                body.close()
            if head.get("ContentLength") != len(payload) or actual != payload:
                raise R2Error("R2_PROBE_UNVERIFIED")
        except R2Error:
            raise
        except Exception:
            raise R2Error("R2_CONNECTION_FAILED") from None
        finally:
            if may_exist:
                try:
                    # Only this unpredictable owned health key, never backups
                    # or a broad prefix. Failure blocks credential rotation.
                    client.delete_object(Bucket=bucket, Key=key)
                except Exception:
                    raise R2Error("R2_PROBE_CLEANUP_FAILED") from None

    def configure(self, config: dict) -> dict:
        self.validate(config)
        # Test before replacing the last known working ciphertext.
        self._probe(config)
        from cryptography.hazmat.primitives.ciphers.aead import AESGCM

        key = self._key(create=True)
        nonce = secrets.token_bytes(12)
        import json
        cipher = nonce + AESGCM(key).encrypt(
            nonce, json.dumps(config, sort_keys=True, separators=(",", ":")).encode(),
            b"readbox-r2-v1")
        if len(cipher) > 4096:
            raise R2Error("R2_CONFIG_INVALID")
        temporary = self.store.root / (".r2-rotate-" + secrets.token_hex(12))
        try:
            _private_secret(temporary, cipher)
            os.replace(temporary, self.config_file)
        finally:
            temporary.unlink(missing_ok=True)
        return self.public()

    def test(self) -> dict:
        config = self._current()
        if config is None:
            raise R2Error("R2_NOT_CONFIGURED")
        self._probe(config)
        return {"verified": True, "at": now()}

    def list_remote(self) -> list[dict]:
        config = self._current()
        if config is None:
            return []
        client = _client(config)
        records = []
        token = None
        seen_tokens: set[str] = set()
        try:
            for page in range(MAX_REMOTE_LIST_PAGES):
                args = {"Bucket": config["bucket"], "Prefix": PREFIX, "MaxKeys": 100}
                if token is not None:
                    args["ContinuationToken"] = token
                response = client.list_objects_v2(**args)
                if not isinstance(response, dict):
                    raise R2Error("R2_PAGE_INVALID")
                for obj in response.get("Contents", []):
                    if not isinstance(obj, dict):
                        continue
                    key = obj.get("Key")
                    match = SAFE_KEY.fullmatch(key) if isinstance(key, str) else None
                    size = obj.get("Size")
                    if match and type(size) is int and size >= 0:
                        records.append({"backupId": match.group(1), "bytes": size,
                                        "key": key, "state": "remote_object_present"})
                if response.get("IsTruncated") is not True:
                    # Bounded UI summary, deterministic lexical order. This
                    # only proves listing, never remote checksum verification.
                    return sorted(records, key=lambda item: item["key"], reverse=True)[:30]
                next_token = response.get("NextContinuationToken")
                if (not isinstance(next_token, str) or not next_token or
                    next_token in seen_tokens or next_token == token or
                    len(next_token) > 1024):
                    raise R2Error("R2_PAGE_INVALID")
                seen_tokens.add(next_token)
                token = next_token
            # Never return a partial list disguised as complete history.
            raise R2Error("R2_PAGE_LIMIT_REACHED")
        except R2Error:
            raise
        except Exception:
            raise R2Error("R2_CONNECTION_FAILED") from None

    def _upload_once(self, client, config: dict, archive: Path,
                     record: dict, key: str) -> None:
        try:
            existing = client.head_object(Bucket=config["bucket"], Key=key)
        except Exception as error:
            status = (getattr(error, "response", {}).get("ResponseMetadata", {})
                      .get("HTTPStatusCode"))
            if status != 404:
                raise
            existing = None
        if existing is None:
            client.upload_file(
                str(archive), config["bucket"], key,
                ExtraArgs={"Metadata": {"sha256": record["sha256"], "format": "age-r05-v1"},
                           "ContentType": "application/octet-stream"},
            )
        elif (existing.get("ContentLength") != record["bytes"] or
              existing.get("Metadata", {}).get("sha256") != record["sha256"]):
            raise R2Error("R2_REMOTE_OBJECT_CONFLICT")
        head = client.head_object(Bucket=config["bucket"], Key=key)
        if (head.get("ContentLength") != record["bytes"] or
            head.get("Metadata", {}).get("sha256") != record["sha256"]):
            raise R2Error("R2_REMOTE_OBJECT_UNVERIFIED")
        body = client.get_object(Bucket=config["bucket"], Key=key)["Body"]
        hasher = hashlib.sha256()
        total = 0
        try:
            for block in iter(lambda: body.read(1024 * 1024), b""):
                hasher.update(block)
                total += len(block)
                if total > record["bytes"]:
                    raise R2Error("R2_REMOTE_OBJECT_UNVERIFIED")
        finally:
            body.close()
        if total != record["bytes"] or hasher.hexdigest() != record["sha256"]:
            raise R2Error("R2_REMOTE_OBJECT_UNVERIFIED")

    def upload(self, backup_id: str) -> dict:
        if not valid_id(backup_id):
            raise R2Error("BACKUP_NOT_FOUND")
        record = self.store.get_backup(backup_id)
        if not record or record.get("state") != "verified" or record.get("level") != "V2":
            raise R2Error("R2_BACKUP_NOT_V2_VERIFIED")
        archive = self.executor.archives / (backup_id + ".age")
        if record.get("localState") == "deleted":
            raise R2Error("R2_LOCAL_ARCHIVE_UNAVAILABLE")
        # Re-decrypt and verify the same immutable source BEFORE network retries.
        checked = verify_age_snapshot(
            root=self.executor.root, archive=archive, identity=self.executor.identity,
            project=self.executor.project, db_name=self.executor.db_name,
            expected_digest=record["sha256"])
        if checked["sha256"] != record["sha256"]:
            raise R2Error("R2_LOCAL_DIGEST_MISMATCH")
        config = self._current()
        if config is None:
            raise R2Error("R2_NOT_CONFIGURED")
        key = PREFIX + backup_id + ".age"
        client = _client(config)
        for attempt in range(MAX_R2_UPLOAD_ATTEMPTS):
            try:
                # Re-probe remote state on every retry. If a prior upload
                # succeeded but its ACK was lost, this verifies in-place
                # without overwriting or deleting the encrypted object.
                self._upload_once(client, config, archive, record, key)
                break
            except R2Error:
                # Conflicts, missing keys and bad digests are never retried.
                raise
            except Exception as error:
                if not _transient_remote_error(error):
                    raise R2Error("R2_UPLOAD_FAILED") from None
                if attempt + 1 >= MAX_R2_UPLOAD_ATTEMPTS:
                    raise R2Error("R2_RETRY_EXHAUSTED") from None
                time.sleep(RETRY_BACKOFF_SECONDS[attempt])
        self.store.set_remote_verified(backup_id, key)
        return {"backupId": backup_id, "remoteVerified": True, "bytes": record["bytes"]}
