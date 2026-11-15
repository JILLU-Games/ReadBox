#!/usr/bin/env python3
"""Verify release archive SHA-256 and safe ZIP extraction for ReadBox upgrades."""
from __future__ import annotations

import argparse
import hashlib
import json
import pathlib
import re
import stat
import sys
import zipfile


def sha256_file(path: pathlib.Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(65536), b""):
            digest.update(chunk)
    return digest.hexdigest()


def parse_expected_sha256(checksum_path: pathlib.Path) -> str:
    raw = checksum_path.read_text(encoding="utf-8").strip()
    token = raw.split()[0] if raw else ""
    if not re.fullmatch(r"[0-9a-fA-F]{64}", token):
        raise SystemExit("Invalid SHA-256 checksum file format")
    return token.lower()


def validate_and_extract_zip(archive_path: pathlib.Path, extract_to: pathlib.Path) -> pathlib.Path:
    with zipfile.ZipFile(archive_path, "r") as zf:
        for info in zf.infolist():
            pure = pathlib.PurePosixPath(info.filename)
            if pure.is_absolute() or ".." in pure.parts:
                raise SystemExit(f"Unsafe ZIP member path refused: {info.filename}")
            mode = (info.external_attr >> 16) & 0xFFFF
            if stat.S_ISLNK(mode):
                raise SystemExit(f"Symlink ZIP member refused: {info.filename}")
        zf.extractall(extract_to)

    entries = [p for p in extract_to.iterdir() if p.is_dir()]
    return entries[0] if len(entries) == 1 else extract_to


def read_version(root: pathlib.Path) -> str:
    version_file = root / "VERSION"
    if version_file.is_file():
        return version_file.read_text(encoding="utf-8").strip()
    pkg_file = root / "package.json"
    if pkg_file.is_file():
        data = json.loads(pkg_file.read_text(encoding="utf-8"))
        return str(data.get("version", "0.1.0")).strip()
    return "0.1.0"


def count_migrations(root: pathlib.Path) -> set[str]:
    mig_root = root / "prisma" / "migrations"
    if not mig_root.is_dir():
        return set()
    return {p.name for p in mig_root.iterdir() if p.is_dir()}


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--archive", required=True)
    parser.add_argument("--checksum", required=True)
    parser.add_argument("--current-app", required=True)
    parser.add_argument("--extract-to", required=True)
    args = parser.parse_args()

    archive_path = pathlib.Path(args.archive).resolve(strict=True)
    checksum_path = pathlib.Path(args.checksum).resolve(strict=True)
    current_app = pathlib.Path(args.current_app).resolve(strict=True)
    extract_to = pathlib.Path(args.extract_to).resolve(strict=True)

    expected_sha = parse_expected_sha256(checksum_path)
    actual_sha = sha256_file(archive_path)
    if actual_sha != expected_sha:
        raise SystemExit(f"SHA-256 mismatch: expected {expected_sha}, got {actual_sha}")

    target_root = validate_and_extract_zip(archive_path, extract_to)
    current_version = read_version(current_app)
    target_version = read_version(target_root)
    new_migrations = len(count_migrations(target_root) - count_migrations(current_app))

    print(f"CURRENT_VERSION={current_version}")
    print(f"TARGET_VERSION={target_version}")
    print(f"TARGET_ROOT={target_root}")
    print(f"UPGRADE_ARCHIVE_SHA256={actual_sha}")
    print(f"NEW_MIGRATIONS={new_migrations}")


if __name__ == "__main__":
    main()
