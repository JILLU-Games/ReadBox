"""BR-04: fixed-path, operator-gated restore reusing audited R-05 rollback.

No arbitrary paths, Docker commands, shell or credentials from IPC. The web
action cannot grant production restore authority: only a pre-existing,
root-owned 0600 operator gate can. The gate is NEVER created by this module.
"""
from __future__ import annotations

from pathlib import Path
import os
import re
import shutil
import signal
import stat
import subprocess
import sys

from storage import private_dir, valid_id
from verification import verify_age_snapshot


class RestoreError(ValueError):
    def __init__(self, code: str):
        self.code = code
        super().__init__("Restore operation refused")


GATE = Path("/etc/readbox-backup-restore.allow")
GATE_TEXT = "READBOX_BR04_PRODUCTION_RESTORE_APPROVED=readbox"
MIN_FREE_BYTES = 512 * 1024 * 1024


def production_gate(project: str) -> bool:
    # Disposable guard requires the original R05 CI fixture plus explicit flag.
    if project == "readboxbr02-ci" and os.environ.get("READBOX_BR02_DISPOSABLE") == "1" \
       and os.environ.get("READBOX_BR04_DISPOSABLE") == "1":
        return True
    if project != "readbox":
        return False
    try:
        info = GATE.lstat()
        if not stat.S_ISREG(info.st_mode) or info.st_uid != 0 or info.st_gid != 0 \
           or stat.S_IMODE(info.st_mode) != 0o600:
            return False
        return GATE.read_text(encoding="ascii") == GATE_TEXT + "\n"
    except (OSError, UnicodeError):
        return False


def archive_and_record(executor, backup_id: str) -> tuple[dict, Path]:
    if not valid_id(backup_id):
        raise RestoreError("RESTORE_BACKUP_NOT_FOUND")
    record = executor.state.get_backup(backup_id)
    if not isinstance(record, dict) or record.get("state") != "verified" \
       or record.get("level") != "V2" or record.get("format") != "age-r05-v1" \
       or record.get("localState") == "deleted" or record.get("includesHostSecrets") is not False \
       or not re.fullmatch(r"[0-9a-f]{64}", str(record.get("sha256", ""))):
        raise RestoreError("RESTORE_BACKUP_NOT_VERIFIED")
    archive = executor.archives / (backup_id + ".age")
    if archive.is_symlink() or not archive.is_file():
        raise RestoreError("RESTORE_ARCHIVE_UNAVAILABLE")
    if archive.stat().st_mode & 0o777 != 0o600:
        raise RestoreError("RESTORE_ARCHIVE_UNSAFE")
    return record, archive


def preflight(executor, backup_id: str) -> dict:
    record, archive = archive_and_record(executor, backup_id)
    if executor.project not in {"readbox", "readboxbr02-ci"}:
        raise RestoreError("RESTORE_PROJECT_REFUSED")
    if shutil.disk_usage(executor.archives).free < MIN_FREE_BYTES:
        raise RestoreError("RESTORE_INSUFFICIENT_SPACE")
    try:
        checked = verify_age_snapshot(
            root=executor.root, archive=archive, identity=executor.identity,
            project=executor.project, db_name=executor.db_name,
            expected_digest=record["sha256"],
        )
        if checked.get("format") != "age-r05-v1" or checked.get("level") != "V2":
            raise ValueError("V2 expected")
        if checked["sha256"] != record["sha256"] or checked["bytes"] != record["bytes"] \
           or checked["includesQueue"] != record["includesQueue"] \
           or checked["includesHostSecrets"] is not False:
            raise ValueError("Record metadata mismatch")
    except Exception:
        raise RestoreError("RESTORE_PREFLIGHT_FAILED") from None
    return {"backupId": backup_id, "verified": True,
            "includesQueue": bool(checked["includesQueue"]),
            "format": "age-r05-v1", "rollbackRequired": True,
            "rollbackAvailable": False,
            "productionAuthorized": production_gate(executor.project)}


def execute(executor, backup_id: str, job_id: str, expected_digest: str) -> dict:
    if not valid_id(job_id) or not re.fullmatch(r"[0-9a-f]{64}", expected_digest):
        raise RestoreError("RESTORE_INPUT_INVALID")
    if not production_gate(executor.project):
        raise RestoreError("RESTORE_OPERATOR_GATE_CLOSED")
    record, archive = archive_and_record(executor, backup_id)
    if record["sha256"] != expected_digest:
        raise RestoreError("RESTORE_SOURCE_CHANGED")
    preflight(executor, backup_id)  # Another deep decrypt/manifest check before mutation.
    recipient = executor._recipient()
    if executor.identity.is_symlink() or not executor.identity.is_file():
        raise RestoreError("RESTORE_IDENTITY_UNAVAILABLE")
    if not executor.identity.stat().st_mode & 0o777 == 0o600:
        raise RestoreError("RESTORE_IDENTITY_UNSAFE")
    rollback_dir = private_dir(executor.archives / "restore-rollback")
    rollback = rollback_dir / (job_id + ".age")
    if rollback.exists() or rollback.is_symlink():
        raise RestoreError("RESTORE_ROLLBACK_EXISTS")
    # Guard a distinct rollback archive name before calling R05.
    args = [sys.executable, str(executor.root / "deployment/operations/compose_recovery.py"),
            "restore", "--compose-file", str(executor.compose_file),
            "--project", executor.project, "--db-user", executor.db_user,
            "--db-name", executor.db_name, "--recipient", recipient,
            "--input", str(archive), "--identity", str(executor.identity),
            "--rollback-output", str(rollback), "--confirm-maintenance",
            "--confirm-restore"]
    try:
        child = subprocess.Popen(args, cwd=executor.root, stdout=subprocess.PIPE,
                                 stderr=subprocess.PIPE, start_new_session=True)
        try:
            output, diagnostic = child.communicate(timeout=2100)
        except subprocess.TimeoutExpired:
            try:
                os.killpg(child.pid, signal.SIGINT)
            except ProcessLookupError:
                pass
            try:
                child.communicate(timeout=90)
            except subprocess.TimeoutExpired:
                child.kill()
                child.communicate()
            raise RestoreError("RESTORE_TIMEOUT_OPERATOR_REVIEW") from None
        if child.returncode != 0:
            # R05 logs rollback result; never copy raw stdout/stderr into UI.
            if b"R05_CRITICAL: rollback failed" in diagnostic:
                raise RestoreError("RESTORE_ROLLBACK_CRITICAL")
            if b"R05_AUTOMATIC_ROLLBACK_PASS" in output:
                raise RestoreError("RESTORE_FAILED_ROLLED_BACK")
            raise RestoreError("RESTORE_FAILED_REVIEW_ROLLBACK")
        if b"R05_VERIFIED_RESTORE_PASS" not in output or not rollback.is_file() \
           or rollback.is_symlink() or stat.S_IMODE(rollback.stat().st_mode) != 0o600:
            raise RestoreError("RESTORE_RESULT_UNVERIFIED")
        return {"backupId": backup_id, "restored": True,
                "rollbackAvailable": True, "rollbackId": job_id}
    except RestoreError:
        # A rollback artifact is NEVER automatically deleted on failure.
        raise
    except Exception:
        raise RestoreError("RESTORE_ENGINE_UNAVAILABLE") from None
