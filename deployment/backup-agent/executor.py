"""Allowlisted, durable host jobs. No restore / R2 / arbitrary command interface."""
from __future__ import annotations

import fcntl
import os
from pathlib import Path
import re
import signal
import shutil
import subprocess
import sys
from datetime import datetime, timezone

from storage import PrivateStore, now, valid_id
from verification import verify_age_snapshot


class BackupExecutor:
    def __init__(self, root: Path, project: str, db_user: str, db_name: str,
                 state: PrivateStore, archives: Path, lock_path: Path):
        if not re.fullmatch(r"[a-z0-9][a-z0-9_-]{2,55}", project):
            raise ValueError("Invalid project")
        if not re.fullmatch(r"[A-Za-z0-9_]+", db_user + db_name):
            raise ValueError("Invalid database configuration")
        if root.is_symlink() or not (root / "docker-compose.yml").is_file():
            raise ValueError("Real Compose root required")
        self.root = root.resolve(strict=True)
        self.project = project
        self.db_user = db_user
        self.db_name = db_name
        self.state = state
        self.archives = archives
        self.lock_path = lock_path
        self.identity = state.root / "identity.txt"
        self.recipient_file = state.root / "recipient.txt"

    def _lock(self):
        if self.lock_path.is_symlink():
            raise ValueError("Unsafe maintenance lock")
        self.lock_path.parent.mkdir(parents=True, exist_ok=True)
        fd = os.open(self.lock_path, os.O_CREAT | os.O_RDWR | os.O_NOFOLLOW, 0o600)
        fcntl.flock(fd, fcntl.LOCK_EX | fcntl.LOCK_NB)
        return fd

    def _recipient(self) -> str:
        if self.recipient_file.is_symlink() or not self.recipient_file.is_file():
            raise ValueError("Recipient file missing")
        recipient = self.recipient_file.read_text(encoding="utf-8").strip()
        if not re.fullmatch(r"age1[023456789acdefghjklmnpqrstuvwxyz]{55,}", recipient):
            raise ValueError("Invalid age recipient")
        return recipient

    def run(self, kind: str, job_id: str, backup_id: str | None = None) -> dict:
        if not valid_id(job_id) or (backup_id is not None and not valid_id(backup_id)):
            raise ValueError("Invalid opaque identifier")
        fd = self._lock()
        try:
            if kind == "backup":
                return self._backup(job_id)
            if kind == "verify" and backup_id is not None:
                return self._verify(backup_id)
            raise ValueError("Unsupported operation")
        finally:
            fcntl.flock(fd, fcntl.LOCK_UN)
            os.close(fd)

    def _backup(self, identifier: str) -> dict:
        # Fail closed before any service stops if storage or identity is missing.
        if shutil.disk_usage(self.archives).free < 512 * 1024**2:
            raise OSError("Insufficient free backup space")
        recipient = self._recipient()
        if not self.identity.is_file() or self.identity.is_symlink():
            raise ValueError("Missing age identity")
        archive = self.archives / (identifier + ".age")
        if archive.exists() or archive.is_symlink():
            raise ValueError("Backup archive already exists")
        args = [
            sys.executable, str(self.root / "deployment/operations/compose_recovery.py"),
            "backup", "--compose-file", str(self.root / "docker-compose.yml"),
            "--project", self.project, "--db-user", self.db_user, "--db-name", self.db_name,
            "--recipient", recipient, "--output", str(archive), "--confirm-maintenance",
        ]
        try:
            # Do not capture/output arbitrary Docker stderr or sensitive mail content.
            process = subprocess.Popen(
                args, cwd=self.root, stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL, start_new_session=True,
            )
            try:
                exit_code = process.wait(timeout=1800)
            except subprocess.TimeoutExpired:
                # Ask R05 frozen() to run its writer restart finally block.
                try:
                    os.killpg(process.pid, signal.SIGINT)
                except ProcessLookupError:
                    pass
                try:
                    process.wait(timeout=90)
                except subprocess.TimeoutExpired:
                    process.kill()
                    process.wait()
                raise RuntimeError("R05 timed out; maintenance restart requested")
            if exit_code:
                raise RuntimeError("R05 backup engine failed")
            verified = verify_age_snapshot(
                root=self.root, archive=archive, identity=self.identity,
                project=self.project, db_name=self.db_name
            )
            record = {
                "id": identifier, "createdAt": now(), "state": "verified",
                "bytes": verified["bytes"], "sha256": verified["sha256"],
                "format": verified["format"], "level": verified["level"],
                "includesQueue": verified["includesQueue"],
                "includesHostSecrets": False,
            }
            self.state.save_backup(record)
            return record
        except Exception:
            # Remove only this unverified, newly generated artifact; never preexisting files.
            if self.state.get_backup(identifier) is None and archive.is_file() and not archive.is_symlink():
                archive.unlink(missing_ok=True)
            raise

    def _verify(self, backup_id: str) -> dict:
        record = self.state.get_backup(backup_id)
        if record is None:
            raise ValueError("Unknown backup")
        archive = self.archives / (backup_id + ".age")
        outcome = verify_age_snapshot(
            root=self.root, archive=archive, identity=self.identity,
            project=self.project, db_name=self.db_name, expected_digest=record["sha256"],
        )
        return {"backupId": backup_id, "verified": True, "level": outcome["level"]}
