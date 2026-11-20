#!/usr/bin/env python3
"""AU-R2-UPDATE-01: root-only fixed host backup/R2 receipt gate.

Uses the existing authenticated backup broker, never direct R2 credentials,
never accepts a filesystem path, bucket, endpoint, Git ref or restore action.
"""
from __future__ import annotations

import hashlib
import hmac
import http.client
import json
import os
from pathlib import Path
import re
import secrets
import shutil
import socket
import stat
import subprocess
import sys
import time

VOLUME = "readbox_readbox_backup_ipc"
ARCHIVES = Path("/var/backups/readbox-managed")
IDENTITY = Path("/var/lib/readbox-backup/identity.txt")
OPAQUE = re.compile(r"^[0-9a-f]{32}$")
DIGEST = re.compile(r"^[0-9a-f]{64}$")
ACTIVE = {"queued", "running"}
# A bounded wait for each existing agent job, not a repeated verification loop.
TIMEOUT_SECONDS = {"backup": 1500, "verify": 600, "r2_upload": 1500}


class GateError(RuntimeError):
    """Only fixed machine-safe codes may be printed."""


def require(condition: bool, code: str) -> None:
    if not condition:
        raise GateError(code)


def private_dir(path: Path) -> None:
    try:
        value = path.lstat()
    except OSError:
        raise GateError("AU_R2_PRIVATE_DIRECTORY_MISSING") from None
    require(stat.S_ISDIR(value.st_mode) and value.st_uid == 0 and
            stat.S_IMODE(value.st_mode) == 0o700 and not path.is_symlink(),
            "AU_R2_PRIVATE_DIRECTORY_UNSAFE")


def regular_file(path: Path, mode: int, owner: int = 0) -> None:
    try:
        value = path.lstat()
    except OSError:
        raise GateError("AU_R2_PRIVATE_FILE_MISSING") from None
    require(stat.S_ISREG(value.st_mode) and value.st_uid == owner and
            stat.S_IMODE(value.st_mode) == mode and not path.is_symlink(),
            "AU_R2_PRIVATE_FILE_UNSAFE")


def agent_connection() -> tuple[Path, bytes]:
    require(os.geteuid() == 0, "AU_R2_ROOT_REQUIRED")
    private_dir(ARCHIVES)
    private_dir(IDENTITY.parent)
    regular_file(IDENTITY, 0o600)
    try:
        found = subprocess.run(
            ["docker", "volume", "inspect", "--format", "{{.Mountpoint}}", VOLUME],
            check=True, capture_output=True, text=True, timeout=10,
        ).stdout.strip()
    except (OSError, subprocess.CalledProcessError, subprocess.TimeoutExpired):
        raise GateError("AU_R2_AGENT_VOLUME_UNAVAILABLE") from None
    require(found.startswith("/") and "\n" not in found, "AU_R2_AGENT_VOLUME_UNSAFE")
    directory = Path(found)
    try:
        dstat = directory.lstat()
    except OSError:
        raise GateError("AU_R2_AGENT_VOLUME_UNAVAILABLE") from None
    require(stat.S_ISDIR(dstat.st_mode) and dstat.st_uid == 0 and
            not directory.is_symlink(), "AU_R2_AGENT_VOLUME_UNSAFE")
    token = directory / "access.token"
    regular_file(token, 0o640)
    require(token.stat().st_gid == 1001, "AU_R2_TOKEN_GROUP_UNSAFE")
    value = token.read_text(encoding="ascii").strip()
    require(bool(DIGEST.fullmatch(value)), "AU_R2_TOKEN_INVALID")
    sock = directory / "agent.sock"
    try:
        state = sock.lstat()
    except OSError:
        raise GateError("AU_R2_AGENT_UNAVAILABLE") from None
    require(stat.S_ISSOCK(state.st_mode) and state.st_uid == 0 and
            not sock.is_symlink(), "AU_R2_AGENT_SOCKET_UNSAFE")
    return sock, value.encode("ascii")


class UnixHTTPConnection(http.client.HTTPConnection):
    def __init__(self, path: Path) -> None:
        super().__init__("localhost", timeout=12)
        self.path = path

    def connect(self) -> None:
        self.sock = socket.socket(socket.AF_UNIX, socket.SOCK_STREAM)
        self.sock.settimeout(self.timeout)
        self.sock.connect(str(self.path))


class Client:
    def __init__(self) -> None:
        self.path, self.secret = agent_connection()

    def call(self, action: str, **values: object) -> dict:
        payload = json.dumps({"action": action, **values},
                             separators=(",", ":"), sort_keys=True).encode("utf8")
        stamp = str(int(time.time()))
        nonce = secrets.token_hex(16)
        encoded = stamp + "." + nonce + "." + hashlib.sha256(payload).hexdigest()
        signature = hmac.new(self.secret, encoded.encode("ascii"), hashlib.sha256).hexdigest()
        connection = UnixHTTPConnection(self.path)
        try:
            connection.request("POST", "/rpc", payload, headers={
                "Content-Type": "application/json",
                "X-ReadBox-Timestamp": stamp,
                "X-ReadBox-Nonce": nonce,
                "X-ReadBox-Signature": signature,
            })
            response = connection.getresponse()
            raw = response.read(262145)
            require(len(raw) <= 262144, "AU_R2_RPC_RESPONSE_TOO_LARGE")
            require(response.status in (200, 202), "AU_R2_RPC_REFUSED")
            parsed = json.loads(raw)
            require(isinstance(parsed, dict), "AU_R2_RPC_MALFORMED")
            return parsed
        except (OSError, ValueError, json.JSONDecodeError):
            raise GateError("AU_R2_AGENT_UNAVAILABLE") from None
        finally:
            connection.close()


def status(client: Client, *, idle: bool) -> dict:
    data = client.call("status")
    require(data.get("connected") is True and isinstance(data.get("jobs"), list) and
            isinstance(data.get("backups"), list), "AU_R2_STATUS_INVALID")
    require(data.get("r2", {}).get("configured") is True, "AU_R2_NOT_CONFIGURED")
    require(data.get("restore", {}).get("operatorReviewRequired") is False,
            "AU_R2_RESTORE_REVIEW_BLOCKED")
    if idle:
        require(not any(job.get("state") in ACTIVE for job in data["jobs"]),
                "AU_R2_ACTIVE_BACKUP_JOB")
    return data


def preflight(client: Client) -> None:
    status(client, idle=True)
    require(shutil.disk_usage(ARCHIVES).free >= 512 * 1024 * 1024,
            "AU_R2_BACKUP_DISK_LOW")


def wait_job(client: Client, job_id: str, kind: str, backup_id: str | None = None) -> dict:
    require(bool(OPAQUE.fullmatch(job_id)), "AU_R2_JOB_ID_INVALID")
    deadline = time.monotonic() + TIMEOUT_SECONDS[kind]
    while time.monotonic() < deadline:
        item = client.call("job.get", jobId=job_id).get("job")
        require(isinstance(item, dict) and item.get("id") == job_id and
                item.get("kind") == kind, "AU_R2_JOB_CONTRACT_INVALID")
        if backup_id is not None:
            require(item.get("backupId") == backup_id, "AU_R2_JOB_BACKUP_ID_MISMATCH")
        state = item.get("state")
        if state == "completed":
            require(isinstance(item.get("result"), dict), "AU_R2_JOB_RESULT_MISSING")
            return item["result"]
        require(state in ACTIVE, "AU_R2_JOB_FAILED_OR_INTERRUPTED")
        time.sleep(min(3.0, max(0.0, deadline - time.monotonic())))
    raise GateError("AU_R2_JOB_TIMEOUT_OPERATOR_REVIEW")


def queued(client: Client, action: str, kind: str, **kwargs: str) -> str:
    item = client.call(action, **kwargs).get("job")
    require(isinstance(item, dict) and item.get("kind") == kind and
            item.get("state") == "queued", "AU_R2_JOB_NOT_QUEUED")
    identifier = item.get("id")
    require(isinstance(identifier, str) and bool(OPAQUE.fullmatch(identifier)),
            "AU_R2_JOB_ID_INVALID")
    return identifier


def local_archive(backup_id: str, record: dict, digest: str) -> None:
    require(record.get("state") == "verified" and record.get("level") == "V2" and
            record.get("sha256") == digest and record.get("id") == backup_id and
            record.get("includesHostSecrets") is False and
            record.get("localState") != "deleted", "AU_R2_BACKUP_RECORD_INVALID")
    archive = ARCHIVES / (backup_id + ".age")
    regular_file(archive, 0o600)
    observed = hashlib.sha256()
    with archive.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            observed.update(chunk)
    require(observed.hexdigest() == digest and
            archive.stat().st_size == record.get("bytes"), "AU_R2_LOCAL_CHECKSUM_MISMATCH")


def receipt(client: Client, backup_id: str, digest: str) -> dict:
    require(bool(OPAQUE.fullmatch(backup_id)) and bool(DIGEST.fullmatch(digest)),
            "AU_R2_RECEIPT_INVALID")
    entries = status(client, idle=True)["backups"]
    record = next((item for item in entries if item.get("id") == backup_id), None)
    require(isinstance(record, dict), "AU_R2_RECEIPT_NOT_FOUND")
    local_archive(backup_id, record, digest)
    remote_at = record.get("remoteVerifiedAt")
    # PrivateStore.now() writes UTC ISO 8601 strings, not integer timestamps.
    require(record.get("remoteState") == "remote_verified" and
            record.get("remoteKey") == "readbox/managed/" + backup_id + ".age" and
            isinstance(remote_at, str) and
            re.fullmatch(r"[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9:.+\-]+", remote_at) is not None,
            "AU_R2_REMOTE_RECEIPT_MISSING")
    return record


def perform(client: Client) -> tuple[str, str]:
    preflight(client)
    backup_id = queued(client, "backup.create", "backup")
    created = wait_job(client, backup_id, "backup")
    require(created.get("id") == backup_id and created.get("level") == "V2" and
            created.get("state") == "verified" and
            isinstance(created.get("sha256"), str) and
            DIGEST.fullmatch(created["sha256"]) is not None,
            "AU_R2_FRESH_BACKUP_INVALID")
    digest = created["sha256"]
    # Explicit second full V2 decrypt/verify, before upload.
    verify_job = queued(client, "backup.verify", "verify", backupId=backup_id)
    verified = wait_job(client, verify_job, "verify", backup_id)
    require(verified.get("verified") is True and verified.get("backupId") == backup_id and
            verified.get("level") == "V2", "AU_R2_LOCAL_VERIFY_FAILED")
    # Existing R2 adapter revalidates V2, streams a remote GET and checks SHA256.
    upload_job = queued(client, "r2.upload", "r2_upload", backupId=backup_id)
    uploaded = wait_job(client, upload_job, "r2_upload", backup_id)
    require(uploaded.get("backupId") == backup_id and uploaded.get("remoteVerified") is True and
            uploaded.get("bytes") == created.get("bytes"), "AU_R2_REMOTE_VERIFY_FAILED")
    receipt(client, backup_id, digest)
    return backup_id, digest


def main(args: list[str]) -> int:
    require(os.geteuid() == 0, "AU_R2_ROOT_REQUIRED")
    if args == ["preflight"]:
        preflight(Client())
        print("AU_R2_PREFLIGHT_PASS")
    elif args == ["run"]:
        backup_id, digest = perform(Client())
        # Only opaque ID and SHA256; never print keys, mail data or credentials.
        print(backup_id + " " + digest)
    elif len(args) == 3 and args[0] == "attest":
        receipt(Client(), args[1], args[2])
        print("AU_R2_VERIFIED_RECEIPT_PASS")
    else:
        raise GateError("AU_R2_INVALID_COMMAND")
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main(sys.argv[1:]))
    except GateError as error:
        print(str(error), file=sys.stderr)
        raise SystemExit(2) from None
