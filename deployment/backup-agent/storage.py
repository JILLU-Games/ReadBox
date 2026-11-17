"""Root-only persistent job state. Never store secrets or raw command output."""
from __future__ import annotations

import json
import os
from pathlib import Path
import re
import threading
from datetime import datetime, timezone
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
                    self.update(job["id"], "interrupted",
                                "Interrupted by agent restart; check service health before retrying.",
                                level="warning")

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

    def create(self, kind: str, backup_id: str | None = None) -> dict:
        if kind not in {"backup", "verify", "r2_upload"}:
            raise ValueError("Unknown job action")
        with self.mutex:
            if any(job["state"] in ACTIVE for job in self._items(self.jobs)):
                raise RuntimeError("JOB_CONFLICT")
            identifier = uuid4().hex
            job = {
                "id": identifier, "kind": kind, "state": "queued",
                "backupId": backup_id, "createdAt": now(), "updatedAt": now(),
                "events": [{"at": now(), "level": "info", "message": "Job queued"}],
            }
            atomic_json(self.jobs / (identifier + ".json"), job)
            return job

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
