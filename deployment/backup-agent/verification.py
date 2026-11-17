"""V2 read-only validation of existing R-05 age snapshots (never restore)."""
from __future__ import annotations

import argparse
import hashlib
import importlib.util
from pathlib import Path
import stat
import tempfile


def _digest(path: Path) -> str:
    hasher = hashlib.sha256()
    with path.open("rb") as source:
        for block in iter(lambda: source.read(1024 * 1024), b""):
            hasher.update(block)
    return hasher.hexdigest()


def verify_age_snapshot(*, root: Path, archive: Path, identity: Path,
                        project: str, db_name: str, expected_digest: str | None = None) -> dict:
    if archive.is_symlink() or not archive.is_file():
        raise ValueError("Invalid encrypted backup")
    if identity.is_symlink() or not identity.is_file():
        raise ValueError("Missing age identity")
    if archive.stat().st_size <= 0 or archive.stat().st_size > 256 * 1024**3:
        raise ValueError("Invalid backup size")
    if stat.S_IMODE(identity.stat().st_mode) != 0o600:
        raise ValueError("Unsafe age identity permissions")
    digest = _digest(archive)
    if expected_digest and digest != expected_digest:
        raise ValueError("Encrypted archive checksum mismatch")
    recovery_path = root / "deployment/operations/compose_recovery.py"
    if not recovery_path.is_file() or recovery_path.is_symlink():
        raise ValueError("R05 recovery engine missing")
    spec = importlib.util.spec_from_file_location("readbox_r05_verify", recovery_path)
    if spec is None or spec.loader is None:
        raise ValueError("R05 recovery verifier unavailable")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    with tempfile.TemporaryDirectory(prefix="br02-verify-") as temp:
        stage = Path(temp) / "stage"
        stage.mkdir(mode=0o700)
        metadata = module.decrypt_snapshot(
            argparse.Namespace(project=project, db_name=db_name), archive, identity, stage
        )
    return {
        "format": "age-r05-v1",
        "level": "V2",
        "sha256": digest,
        "bytes": archive.stat().st_size,
        "includesQueue": metadata["postfix_queue_included"],
        "includesHostSecrets": False,
    }
