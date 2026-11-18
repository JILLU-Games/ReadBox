"""Root-only persistent job state. Never store secrets or raw command output."""
from __future__ import annotations

import json
import hashlib
import hmac
import secrets
import os
from pathlib import Path
import re
import threading
from datetime import datetime, timezone
import time
from uuid import uuid4

IDENTIFIER = re.compile(r"^[0-9a-f]{32}$")
ACTIVE = frozenset({"queued", "running"})


def now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def valid_id(value: object) -> bool:
    return isinstance(value, str) and IDENTIFIER.fullmatch(value) is not None


def private_dir(path: Path) -> Path:
    if path.is_symlink():
        raise ValueError("Symbolic storage directory refused")
    path.mkdir(mode=0o700, parents=True, exist_ok=True)
    if not path.is_dir() or path.is_symlink():
        raise ValueError("Private storage directory required")
    path.chmod(0o700)
    return path


def atomic_json(path: Path, payload: dict) -> None:
    if path.exists() and path.is_symlink():
        raise ValueError("Symbolic storage file refused")
    raw = json.dumps(payload, sort_keys=True, separators=(",", ":")).encode()
    temp = path.parent / ("." + path.name + "." + uuid4().hex)
    fd = os.open(temp, os.O_WRONLY | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW, 0o600)
    try:
        with os.fdopen(fd, "wb") as out:
            out.write(raw)
            out.flush()
            os.fsync(out.fileno())
        os.replace(temp, path)
        directory_fd = os.open(path.parent, os.O_RDONLY | os.O_DIRECTORY)
        try:
            os.fsync(directory_fd)
        finally:
            os.close(directory_fd)
    finally:
        temp.unlink(missing_ok=True)


class PrivateStore:
    def __init__(self, root: Path):
        self.root = private_dir(root)
        self.jobs = private_dir(root / "jobs")
        self.backups = private_dir(root / "backups")
        self.restore_permits = private_dir(root / "restore-permits")
        self.mutex = threading.RLock()
        self.reconcile_interrupted()

    def _read(self, directory: Path, identifier: str) -> dict | None:
        if not valid_id(identifier):
            return None
        path = directory / (identifier + ".json")
        if path.is_symlink() or not path.is_file():
            return None
        try:
            data = json.loads(path.read_text(encoding="utf-8"))
            return data if data.get("id") == identifier else None
        except (OSError, ValueError, AttributeError):
            return None

    def _items(self, directory: Path) -> list[dict]:
        records = []
        for item in directory.glob("*.json"):
            value = self._read(directory, item.stem)
            if value is not None:
                records.append(value)
        return sorted(records, key=lambda item: item["createdAt"], reverse=True)

    def reconcile_interrupted(self) -> None:
        with self.mutex:
            for job in self._items(self.jobs):
                if job["state"] in ACTIVE:
                    message = ("Restore interrupted; operator must inspect rollback and service health."
                               if job.get("kind") == "restore"
                               else "Interrupted by agent restart; check service health before retrying.")
                    self.update(job["id"], "interrupted", message, level="warning")

    def get_job(self, identifier: str) -> dict | None:
        with self.mutex:
            return self._read(self.jobs, identifier)

    def list_jobs(self) -> list[dict]:
        with self.mutex:
            return self._items(self.jobs)[:30]

    def list_backups(self) -> list[dict]:
        with self.mutex:
            return self._items(self.backups)[:30]

    def get_backup(self, identifier: str) -> dict | None:
        with self.mutex:
            return self._read(self.backups, identifier)

    def create(self, kind: str, backup_id: str | None = None, *,
               auto_upload: bool = False, auto_source_job: str | None = None,
               expected_digest: str | None = None) -> dict:
        if kind not in {"backup", "verify", "r2_upload", "restore"}:
            raise ValueError("Unknown job action")
        if type(auto_upload) is not bool or (auto_upload and kind != "backup"):
            raise ValueError("Invalid automatic upload intent")
        if auto_source_job is not None and (kind != "r2_upload" or
                                            not valid_id(auto_source_job) or
                                            auto_source_job != backup_id):
            raise ValueError("Invalid automatic source job")
        if kind == "restore" and (not valid_id(backup_id) or
                                  not isinstance(expected_digest, str) or
                                  re.fullmatch(r"[0-9a-f]{64}", expected_digest) is None):
            raise ValueError("Restore source digest required")
        if kind != "restore" and expected_digest is not None:
            raise ValueError("Unexpected restore digest")
        with self.mutex:
            if self.restore_requires_review():
                raise RuntimeError("RESTORE_OPERATOR_REVIEW_REQUIRED")
            if any(job["state"] in ACTIVE for job in self._items(self.jobs)):
                raise RuntimeError("JOB_CONFLICT")
            identifier = uuid4().hex
            job = {
                "id": identifier, "kind": kind, "state": "queued",
                "backupId": backup_id, "createdAt": now(), "updatedAt": now(),
                "events": [{"at": now(), "level": "info", "message": "Job queued"}],
            }
            if kind == "restore":
                job["expectedDigest"] = expected_digest
            if kind == "backup":
                # Persist BEFORE execution so a crash after the archive is written
                # cannot lose the subsequent offsite-upload intent.
                job["autoUpload"] = auto_upload
            if auto_source_job is not None:
                job["autoSourceJob"] = auto_source_job
            atomic_json(self.jobs / (identifier + ".json"), job)
            return job

    def restore_requires_review(self) -> bool:
        with self.mutex:
            return any(
                job.get("kind") == "restore" and
                (job.get("state") == "interrupted" or
                 (job.get("state") == "failed" and
                  job.get("result", {}).get("errorCode") in {
                     "RESTORE_ROLLBACK_CRITICAL", "RESTORE_FAILED_REVIEW_ROLLBACK",
                     "RESTORE_TIMEOUT_OPERATOR_REVIEW", "RESTORE_RESULT_UNVERIFIED",
                  }))
                for job in self._items(self.jobs)
            )

    def issue_restore_permit(self, backup_id: str, digest: str, actor: str) -> dict:
        if not valid_id(backup_id) or not re.fullmatch(r"[0-9a-f]{64}", digest) or            not re.fullmatch(r"[1-9][0-9]{0,18}", actor):
            raise ValueError("Invalid restore permit request")
        with self.mutex:
            if self.restore_requires_review() or any(
                job["state"] in ACTIVE for job in self._items(self.jobs)
            ):
                raise RuntimeError("JOB_CONFLICT")
            # One short-lived, single-use capability. Only its hash is saved.
            current = int(time.time())
            for entry in self.restore_permits.glob("*.json"):
                if entry.is_symlink() or not valid_id(entry.stem):
                    raise ValueError("Unsafe restore permit entry")
                old = self._read(self.restore_permits, entry.stem)
                if old is None:
                    raise ValueError("Corrupt restore permit entry")
                if int(old.get("expiresAt", 0)) < current:
                    entry.unlink()
            if len(list(self.restore_permits.glob("*.json"))) >= 25:
                raise RuntimeError("RESTORE_PERMIT_LIMIT")
            identifier = uuid4().hex
            token = secrets.token_hex(32)
            atomic_json(self.restore_permits / (identifier + ".json"), {
                "id": identifier, "backupId": backup_id, "digest": digest,
                "actor": actor, "tokenHash": hashlib.sha256(token.encode()).hexdigest(),
                "expiresAt": current + 90, "consumed": False,
            })
            return {"permitId": identifier, "token": token,
                    "expiresAt": current + 90}

    def consume_restore_permit(self, permit_id: str, token: str,
                               backup_id: str, digest: str, actor: str) -> bool:
        if not valid_id(permit_id) or not isinstance(token, str) or            not re.fullmatch(r"[0-9a-f]{64}", token):
            return False
        with self.mutex:
            record = self._read(self.restore_permits, permit_id)
            if not record or record.get("consumed") is not False:
                return False
            # Consume BEFORE checking the token to prevent replay/brute force.
            record["consumed"] = True
            atomic_json(self.restore_permits / (permit_id + ".json"), record)
            return (int(record.get("expiresAt", 0)) >= int(time.time()) and
                    record.get("backupId") == backup_id and record.get("digest") == digest and
                    record.get("actor") == actor and
                    hmac.compare_digest(str(record.get("tokenHash", "")),
                                        hashlib.sha256(token.encode()).hexdigest()))

    def claim_due_auto_upload(self, when: float | None = None) -> dict | None:
        """Atomically claim one persisted auto-upload. Max three jobs per source.

        Safe after a killed agent: completed/interrupted backup jobs use the
        journal's fixed id as the archive id; never trust a caller path.
        """
        moment = time.time() if when is None else when
        with self.mutex:
            all_jobs = self._items(self.jobs)
            if self.restore_requires_review() or any(job["state"] in ACTIVE for job in all_jobs):
                return None
            for source in sorted(all_jobs, key=lambda item: (item["createdAt"], item["id"])):
                if source.get("kind") != "backup" or source.get("autoUpload") is not True:
                    continue
                if source.get("state") not in {"completed", "interrupted", "failed"}:
                    continue
                identifier = source["id"]
                record = self._read(self.backups, identifier)
                if (record is None or record.get("state") != "verified" or
                    record.get("level") != "V2" or record.get("localState") == "deleted" or
                    record.get("remoteVerifiedAt")):
                    continue
                uploads = [job for job in all_jobs
                           if job.get("kind") == "r2_upload" and
                           job.get("autoSourceJob") == identifier and
                           job.get("backupId") == identifier]
                if len(uploads) >= 3:
                    # A finite budget across crashes/restarts; manual retry
                    # remains an explicit separate admin action.
                    continue
                if uploads:
                    last = max(uploads, key=lambda job: (job["updatedAt"], job["id"]))
                    try:
                        last_at = datetime.fromisoformat(last["updatedAt"]).timestamp()
                    except (ValueError, TypeError):
                        continue
                    # 30s then 120s; no polling storm or instant crash-loop retries.
                    delay = 30 * (4 ** (len(uploads) - 1))
                    if moment < last_at + delay:
                        continue
                return self.create("r2_upload", identifier, auto_source_job=identifier)
            return None

    def update(self, identifier: str, state: str, message: str,
               level: str = "info", result: dict | None = None) -> dict:
        if state not in {"running", "completed", "failed", "interrupted"}:
            raise ValueError("Invalid job state")
        if message not in {
            "Job running", "Encrypted backup saved and verified",
            "Encrypted backup verification passed",
            "Backup operation failed; no completed backup was published",
            "Backup verification failed; existing archive was preserved",
            "Interrupted by agent restart; check service health before retrying.",
            "Encrypted backup uploaded to R2 and remotely checksum verified",
            "Cloudflare R2 upload failed; local backup was preserved",
            "Restore interrupted; operator must inspect rollback and service health.",
            "Restore job queued after one-time admin confirmation",
            "Encrypted restore completed and rollback archive retained",
            "Restore failed; rollback outcome requires operator review",
        }:
            raise ValueError("Refusing unapproved log content")
        with self.mutex:
            job = self._read(self.jobs, identifier)
            if job is None:
                raise ValueError("Job missing")
            if job["state"] not in ACTIVE and state != "interrupted":
                raise ValueError("Terminal job mutation refused")
            job["state"] = state
            job["updatedAt"] = now()
            job["events"] = (job["events"] + [{"at": now(), "level": level, "message": message}])[-50:]
            if result is not None:
                job["result"] = result
            atomic_json(self.jobs / (identifier + ".json"), job)
            return job

    def set_backup_verification(self, identifier: str, verified: bool) -> None:
        """Never leave a failed recheck incorrectly marked V2."""
        with self.mutex:
            record = self._read(self.backups, identifier)
            if record is None:
                return
            record["state"] = "verified" if verified else "needs_review"
            record["level"] = "V2" if verified else "V1"
            record["lastCheckedAt"] = now()
            atomic_json(self.backups / (identifier + ".json"), record)

    def set_remote_verified(self, identifier: str, key: str) -> None:
        if not valid_id(identifier) or key != "readbox/managed/" + identifier + ".age":
            raise ValueError("Invalid owned remote key")
        with self.mutex:
            record = self._read(self.backups, identifier)
            if record is None or record.get("state") != "verified":
                raise ValueError("Only verified backups can be remote verified")
            record["remoteVerifiedAt"] = now()
            record["remoteState"] = "remote_verified"
            record["remoteKey"] = key
            atomic_json(self.backups / (identifier + ".json"), record)

    def mark_local_deleted(self, identifier: str) -> None:
        with self.mutex:
            record = self._read(self.backups, identifier)
            if record is None or not record.get("remoteVerifiedAt"):
                raise ValueError("Unverified remote copy cannot release local file")
            record["localState"] = "deleted"
            atomic_json(self.backups / (identifier + ".json"), record)

    def save_backup(self, value: dict) -> None:
        identifier = value.get("id")
        if not valid_id(identifier):
            raise ValueError("Invalid backup identifier")
        with self.mutex:
            destination = self.backups / (identifier + ".json")
            if destination.exists():
                raise ValueError("Backup record already exists")
            atomic_json(destination, value)
