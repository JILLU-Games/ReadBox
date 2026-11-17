#!/usr/bin/env python3
"""R-05 encrypted, consistent Compose-volume PostgreSQL+Maildir recovery.

Run from an authorized host with Docker privileges. No application code runs.
Real restore requires explicit operator confirmation and encrypted rollback.
The CI disposable failpoint is unavailable for real project names.
"""
from __future__ import annotations

import argparse
import contextlib
import hashlib
import json
import os
from pathlib import Path, PurePosixPath
import re
import shutil
import stat
import subprocess
import sys
import tarfile
import tempfile

IMAGE = "ubuntu:24.04"
VERSION = 1
DATA_FILES = ("postgres.dump", "web.tar.gz")
WEB_PREFIXES = ("var/vmail", "var/lib/readbox/attachments", "var/lib/readbox/media")
QUEUE_PREFIXES = ("var/spool/postfix",)


def command(args: list[str], *, output: Path | None = None, input_file: Path | None = None) -> str:
    with contextlib.ExitStack() as stack:
        out = stack.enter_context(output.open("wb")) if output else subprocess.PIPE
        inp = stack.enter_context(input_file.open("rb")) if input_file else None
        proc = subprocess.run(args, stdin=inp, stdout=out, stderr=subprocess.PIPE, check=False)
    if proc.returncode:
        # Do not display the subprocess's arbitrary stderr (might contain DB credentials).
        raise RuntimeError(f"Required recovery operation exited nonzero: {args[0]}")
    return proc.stdout.decode("utf-8").strip() if output is None else ""


def require_file(p: Path) -> Path:
    if p.is_symlink() or not p.is_file():
        raise ValueError("A required regular file is absent or symbolic.")
    return p.resolve(strict=True)


def require_new_output(p: Path) -> Path:
    if not p.is_absolute() or p.exists() or p.is_symlink():
        raise ValueError("Output must be a new absolute path.")
    parent = p.parent
    if not parent.is_dir() or parent.is_symlink():
        raise ValueError("Output parent must be an existing real directory.")
    return p


def is_allowed_member(name: str, prefixes: tuple[str, ...]) -> bool:
    path = PurePosixPath(name)
    if path.is_absolute() or ".." in path.parts or "\x00" in name or not name:
        return False
    clean = str(path)
    return any(clean == prefix or clean.startswith(prefix + "/") for prefix in prefixes)


def check_archive(file: Path, prefixes: tuple[str, ...]) -> None:
    with tarfile.open(file, "r:gz") as archive:
        members = archive.getmembers()
        if not members:
            raise ValueError("Empty volume archive.")
        for member in members:
            if not is_allowed_member(member.name, prefixes):
                raise ValueError("Unexpected path inside volume archive.")
            if not (member.isdir() or member.isfile()):
                raise ValueError("Refusing symlink, hardlink or special file inside volume archive.")


def digest(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as handle:
        for b in iter(lambda: handle.read(1024 * 1024), b""):
            h.update(b)
    return h.hexdigest()


def compose(args: argparse.Namespace, *words: str) -> list[str]:
    return [
        "docker", "compose", "-f", str(args.compose_file),
        "--project-name", args.project, "--profile", "mailserver", *words,
    ]


def container_id(args: argparse.Namespace, name: str, *, required: bool) -> str:
    ids = command(compose(args, "ps", "-a", "-q", name)).splitlines()
    if len(ids) != 1 and required:
        raise ValueError(f"Required Compose service container missing: {name}")
    return ids[0] if len(ids) == 1 else ""


def volume_tar(container: str, paths: tuple[str, ...], destination: Path) -> None:
    # GNU tar preserves numeric ownership, ACLs and xattrs. Sources are explicit,
    # fixed mount paths; the service container never executes backup code.
    command([
        "docker", "run", "--rm", "--network", "none", "--pull", "never",
        "--volumes-from", f"{container}:ro", IMAGE, "tar",
        "--acls", "--xattrs", "--numeric-owner",
        "-C", "/", "-czf", "-", *paths,
    ], output=destination)
    check_archive(destination, paths)


def volume_restore(container: str, paths: tuple[str, ...], archive: Path, stage: Path) -> None:
    # Stop writers before calling this. Clear stale entries, restore exactly
    # from the verified archive and preserve numeric uid/gid/mode/ACL/xattrs.
    script = (
        "set -eu; "
        "for p in " + " ".join("/" + p for p in paths) + "; do "
        "test -d \"$p\"; "
        "find \"$p\" -mindepth 1 -maxdepth 1 -exec rm -rf -- {} +; "
        "done; "
        "tar --acls --xattrs --same-owner --numeric-owner "
        "-C / -xzf /snapshot/" + archive.name
    )
    command([
        "docker", "run", "--rm", "--network", "none", "--pull", "never",
        "--volumes-from", container, "--mount",
        f"type=bind,source={stage},target=/snapshot,readonly", IMAGE,
        "sh", "-ec", script,
    ])


def dump_db(args: argparse.Namespace, path: Path) -> None:
    command(compose(args, "exec", "-T", "postgres", "pg_dump",
                    "-U", args.db_user, "-d", args.db_name,
                    "-Fc", "--no-owner"), output=path)


def restore_db(args: argparse.Namespace, path: Path) -> None:
    command(compose(args, "exec", "-T", "postgres", "pg_restore",
                    "-U", args.db_user, "-d", args.db_name,
                    "--clean", "--if-exists", "--exit-on-error",
                    "--single-transaction", "--no-owner"), input_file=path)


def running_services(args: argparse.Namespace) -> list[str]:
    running = set(command(compose(args, "ps", "--services", "--status", "running")).splitlines())
    if "postgres" not in running:
        raise ValueError("PostgreSQL must already be running; refusing any mutation.")
    return [name for name in ("postfix", "dovecot", "worker", "web") if name in running]


@contextlib.contextmanager
def frozen(args: argparse.Namespace):
    services = running_services(args)
    if services:
        print("R05_MAINTENANCE: stopping previously-running service(s): " +
              ",".join(services), flush=True)
        command(compose(args, "stop", *services))
    try:
        yield
    finally:
        if services:
            command(compose(args, "start", *list(reversed(services))))
            print("R05_MAINTENANCE: only previously-running services restarted", flush=True)


def create_snapshot(args: argparse.Namespace, stage: Path) -> None:
    web = container_id(args, "web", required=True)
    postfix = container_id(args, "postfix", required=False)
    dump_db(args, stage / "postgres.dump")
    volume_tar(web, WEB_PREFIXES, stage / "web.tar.gz")
    if postfix:
        volume_tar(postfix, QUEUE_PREFIXES, stage / "queue.tar.gz")
    metadata = {
        "format_version": VERSION,
        "compose_project": args.project,
        "db_name": args.db_name,
        "web_uid": 1001,
        "web_gid": 1001,
        "postfix_queue_included": bool(postfix),
        "config_and_secret_files_included": False,
        "snapshot_consistency": "writable services stopped before DB+volume dump",
    }
    (stage / "metadata.json").write_text(json.dumps(metadata, sort_keys=True) + "\n")
    wanted = (*DATA_FILES, "metadata.json")
    if postfix:
        wanted += ("queue.tar.gz",)
    (stage / "SHA256SUMS").write_text(
        "".join(f"{digest(stage / name)}  {name}\n" for name in wanted)
    )


def encrypt(stage: Path, output: Path, recipient: str) -> None:
    require_new_output(output)
    if not re.fullmatch(r"age1[023456789acdefghjklmnpqrstuvwxyz]{55,}", recipient):
        raise ValueError("A valid age X25519 recipient is required.")
    t = subprocess.Popen(["tar", "-C", str(stage), "-cf", "-", "."],
                         stdout=subprocess.PIPE, stderr=subprocess.DEVNULL)
    assert t.stdout is not None
    try:
        with output.open("xb") as handle:
            os.chmod(output, 0o600)
            encrypted = subprocess.run(["age", "-r", recipient],
                                       stdin=t.stdout, stdout=handle,
                                       stderr=subprocess.DEVNULL, check=False)
        t.stdout.close()
        if encrypted.returncode or t.wait() != 0:
            raise RuntimeError("Encryption failed.")
    except Exception:
        output.unlink(missing_ok=True)
        raise


def validate_snapshot(stage: Path, args: argparse.Namespace) -> dict:
    expected = set(DATA_FILES) | {"metadata.json", "SHA256SUMS"}
    with (stage / "metadata.json").open(encoding="utf-8") as handle:
        metadata = json.load(handle)
    if not isinstance(metadata, dict) or metadata.get("format_version") != VERSION:
        raise ValueError("Unexpected encrypted backup format.")
    if metadata.get("compose_project") != args.project or metadata.get("db_name") != args.db_name:
        raise ValueError("Restore project/database mismatch.")
    if metadata.get("web_uid") != 1001 or metadata.get("web_gid") != 1001:
        raise ValueError("Maildir identity mismatch.")
    if metadata.get("config_and_secret_files_included") is not False:
        raise ValueError("Confidential configuration export is forbidden.")
    queue = metadata.get("postfix_queue_included") is True
    if queue:
        expected.add("queue.tar.gz")
    if set(p.name for p in stage.iterdir()) != expected:
        raise ValueError("Unexpected encrypted bundle entries.")
    checks = (stage / "SHA256SUMS").read_text().splitlines()
    if len(checks) != len(expected) - 1:
        raise ValueError("Missing checksum entries.")
    seen = set()
    for line in checks:
        match = re.fullmatch(r"([0-9a-f]{64})  ([A-Za-z0-9_.-]+)", line)
        if not match or match.group(2) in seen:
            raise ValueError("Invalid checksum manifest.")
        name = match.group(2)
        seen.add(name)
        if name not in expected or name == "SHA256SUMS" or digest(stage / name) != match.group(1):
            raise ValueError("Snapshot checksum mismatch.")
    if seen != expected - {"SHA256SUMS"}:
        raise ValueError("Checksum manifest is incomplete.")
    check_archive(stage / "web.tar.gz", WEB_PREFIXES)
    if queue:
        check_archive(stage / "queue.tar.gz", QUEUE_PREFIXES)
    # DB format PGDMP, not a SQL script, guards gross corruption before restore.
    with (stage / "postgres.dump").open("rb") as handle:
        if handle.read(5) != b"PGDMP":
            raise ValueError("PostgreSQL custom dump header invalid.")
    return metadata


def decrypt_snapshot(args: argparse.Namespace, encrypted: Path, identity: Path, stage: Path) -> dict:
    require_file(encrypted)
    require_file(identity)
    tar_path = stage.parent / "decrypted.tar"
    command(["age", "-d", "-i", str(identity), "-o", str(tar_path), str(encrypted)])
    try:
        # Do not use tar extraction filters with unchecked paths; reject all
        # non-regular entries except directories, duplicates and traversal.
        with tarfile.open(tar_path, "r:") as archive:
            seen: set[str] = set()
            for member in archive.getmembers():
                name = str(PurePosixPath(member.name))
                if name in seen or name.startswith("/") or ".." in PurePosixPath(name).parts:
                    raise ValueError("Malformed encrypted archive member.")
                seen.add(name)
                if not (member.isfile() or member.isdir()):
                    raise ValueError("Unsupported encrypted archive member.")
                if name != "." and name.lstrip("./") not in {
                    "postgres.dump", "web.tar.gz", "queue.tar.gz",
                    "metadata.json", "SHA256SUMS",
                }:
                    raise ValueError("Unknown encrypted archive member.")
        command(["tar", "-C", str(stage), "-xf", str(tar_path)])
    finally:
        tar_path.unlink(missing_ok=True)
    return validate_snapshot(stage, args)


def apply_snapshot(args: argparse.Namespace, stage: Path, meta: dict, *, allow_test_failure: bool = True) -> None:
    web = container_id(args, "web", required=True)
    postfix = container_id(args, "postfix", required=False)
    if meta["postfix_queue_included"] and not postfix:
        raise ValueError("Postfix queue container required for exact restore.")
    restore_db(args, stage / "postgres.dump")
    if allow_test_failure and os.environ.get("READBOX_R05_DISPOSABLE") == "1" and args.project.endswith("-ci") and os.environ.get("READBOX_R05_INJECT_FAILURE") == "1":
        print("R05_CI_FAILPOINT_AFTER_DATABASE_APPLY", flush=True)
        raise RuntimeError("Intentional CI-only rollback rehearsal failure.")
    volume_restore(web, WEB_PREFIXES, stage / "web.tar.gz", stage)
    if meta["postfix_queue_included"]:
        volume_restore(postfix, QUEUE_PREFIXES, stage / "queue.tar.gz", stage)


def backup(args: argparse.Namespace) -> None:
    require_new_output(args.output)
    with tempfile.TemporaryDirectory(prefix="r05-private-") as tmp:
        os.chmod(tmp, 0o700)
        stage = Path(tmp)
        with frozen(args):
            create_snapshot(args, stage)
        encrypt(stage, args.output, args.recipient)
    print("R05_ENCRYPTED_BACKUP_PASS; plain configuration and credentials excluded.")


def restore(args: argparse.Namespace) -> None:
    require_new_output(args.rollback_output)
    if args.output == args.rollback_output:
        raise ValueError("Rollback artifact must be separate.")
    with tempfile.TemporaryDirectory(prefix="r05-private-") as tmp:
        os.chmod(tmp, 0o700)
        root = Path(tmp)
        target = root / "incoming"
        before = root / "rollback"
        target.mkdir(mode=0o700)
        before.mkdir(mode=0o700)
        metadata = decrypt_snapshot(args, args.input, args.identity, target)
        # Validate both encrypted input and the availability of a rollback
        # artifact BEFORE changing any service or database.
        with frozen(args):
            create_snapshot(args, before)
            encrypt(before, args.rollback_output, args.recipient)
            print("R05_ROLLBACK_ARTIFACT_ENCRYPTED_PASS", flush=True)
            try:
                apply_snapshot(args, target, metadata)
            except Exception:
                print("R05_RESTORE_FAILED: attempting automatic local rollback", file=sys.stderr)
                try:
                    apply_snapshot(args, before, validate_snapshot(before, args), allow_test_failure=False)
                    print("R05_AUTOMATIC_ROLLBACK_PASS", flush=True)
                except Exception:
                    print("R05_CRITICAL: rollback failed; operator intervention required",
                          file=sys.stderr)
                raise
    print("R05_VERIFIED_RESTORE_PASS; only previously-running services restarted.")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("action", choices=["backup", "restore"])
    parser.add_argument("--compose-file", type=Path, required=True)
    parser.add_argument("--project", required=True)
    parser.add_argument("--db-user", default="readbox")
    parser.add_argument("--db-name", default="readbox")
    parser.add_argument("--recipient", required=True)
    parser.add_argument("--output", type=Path)
    parser.add_argument("--input", type=Path)
    parser.add_argument("--identity", type=Path)
    parser.add_argument("--rollback-output", type=Path)
    parser.add_argument("--confirm-maintenance", action="store_true")
    parser.add_argument("--confirm-restore", action="store_true")
    args = parser.parse_args()
    if not re.fullmatch(r"[a-z0-9][a-z0-9_-]{2,55}", args.project):
        parser.error("Explicit safe Compose project name is required.")
    if not re.fullmatch(r"[A-Za-z0-9_]+", args.db_user) or not re.fullmatch(r"[A-Za-z0-9_]+", args.db_name):
        parser.error("Unsafe database identifiers.")
    args.compose_file = require_file(args.compose_file)
    if not args.confirm_maintenance:
        parser.error("Explicit --confirm-maintenance required for any service stop.")
    if args.action == "backup" and not args.output:
        parser.error("Backup requires --output.")
    if args.action == "restore" and (not args.confirm_restore or not args.input or not args.identity or not args.rollback_output):
        parser.error("Restore requires --confirm-restore, encrypted input, identity, and distinct encrypted rollback output.")
    try:
        command(compose(args, "config", "--quiet"))
        command(["age", "--version"])
        # Refuse to use a mutable or implicitly pulled image during recovery.
        command(["docker", "image", "inspect", IMAGE])
        if args.action == "backup":
            backup(args)
        else:
            restore(args)
    except Exception as error:
        print(f"R05_RECOVERY_BLOCKED: {type(error).__name__}; no secret details logged.", file=sys.stderr)
        raise SystemExit(1) from None


if __name__ == "__main__":
    main()
