"""Read-only marker; legacy GPG is never passed to the age restore engine."""
from __future__ import annotations
from pathlib import Path


def unsupported_legacy(path: str | Path) -> bool:
    """Intentionally identifies suffix only. Never decrypts, imports or converts."""
    if not isinstance(path, (str, Path)):
        return True
    return str(path).lower().endswith((".gpg", ".pgp", ".asc"))


def ensure_age_managed(path: Path) -> None:
    if unsupported_legacy(path) or path.suffix != ".age":
        raise ValueError("LEGACY_GPG_RESTORE_NOT_SUPPORTED")
