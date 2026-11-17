#!/usr/bin/env python3
"""Restricted Unix-socket ReadBox backup broker. Host-only; no TCP listener."""
from __future__ import annotations

import argparse
from http.server import BaseHTTPRequestHandler
import hashlib
import hmac
import json
import os
from pathlib import Path
import re
import secrets
import signal
import socket
import socketserver
import stat
import struct
import threading
import time

from executor import BackupExecutor
from storage import PrivateStore, private_dir, valid_id


class ThreadingUnixServer(socketserver.ThreadingMixIn, socketserver.UnixStreamServer):
    daemon_threads = True
    allow_reuse_address = False


class BackupBroker:
    def __init__(self, state: PrivateStore, executor: BackupExecutor, token: bytes):
        self.state = state
        self.executor = executor
        self.token = token
        self.nonces: dict[str, int] = {}
        self.lock = threading.RLock()

    def authenticate(self, timestamp: str, nonce: str, signature: str, body: bytes) -> bool:
        if not re.fullmatch(r"[0-9]{10,12}", timestamp) or not re.fullmatch(r"[a-f0-9]{32}", nonce):
            return False
        if not re.fullmatch(r"[a-f0-9]{64}", signature):
            return False
        if abs(int(time.time()) - int(timestamp)) > 60:
            return False
        signed = timestamp.encode() + b"." + nonce.encode() + b"." + hashlib.sha256(body).hexdigest().encode()
        expected = hmac.new(self.token, signed, hashlib.sha256).hexdigest()
        if not hmac.compare_digest(signature, expected):
            return False
        with self.lock:
            now = int(time.time())
            self.nonces = {key: at for key, at in self.nonces.items() if now - at <= 120}
            if nonce in self.nonces:
                return False
            if len(self.nonces) >= 2048:
                return False
            self.nonces[nonce] = now
        return True

    def _worker(self, job: dict) -> None:
        identifier = job["id"]
        try:
            self.state.update(identifier, "running", "Job running")
            result = self.executor.run(job["kind"], identifier, job.get("backupId"))
            if job["kind"] == "verify" and job.get("backupId"):
                self.state.set_backup_verification(job["backupId"], True)
            message = ("Encrypted backup saved and verified"
                       if job["kind"] == "backup"
                       else "Encrypted backup verification passed")
            self.state.update(identifier, "completed", message, "success", result)
        except Exception:
            if job["kind"] == "verify" and job.get("backupId"):
                try:
                    self.state.set_backup_verification(job["backupId"], False)
                except Exception:
                    pass
            message = ("Backup operation failed; no completed backup was published"
                       if job["kind"] == "backup"
                       else "Backup verification failed; existing archive was preserved")
            try:
                self.state.update(identifier, "failed", message, "error")
            except Exception:
                pass

    def perform(self, payload: dict) -> tuple[int, dict]:
        action = payload.get("action")
        if not isinstance(action, str):
            return 400, {"error": "INVALID_ACTION"}
        if action == "status":
            return 200, {
                "connected": True, "jobs": self.state.list_jobs(),
                "backups": self.state.list_backups(),
            }
        if action == "job.get":
            identifier = payload.get("jobId")
            if not valid_id(identifier):
                return 400, {"error": "INVALID_JOB_ID"}
            job = self.state.get_job(identifier)
            return (200, {"job": job}) if job else (404, {"error": "JOB_NOT_FOUND"})
        if action == "backup.create" and set(payload) == {"action"}:
            kind = "backup"
            backup_id = None
        elif action == "backup.verify" and set(payload) == {"action", "backupId"}:
            kind = "verify"
            backup_id = payload["backupId"]
            if not valid_id(backup_id) or self.state.get_backup(backup_id) is None:
                return 404, {"error": "BACKUP_NOT_FOUND"}
        else:
            return 400, {"error": "ACTION_NOT_ALLOWED"}
        try:
            job = self.state.create(kind, backup_id)
        except RuntimeError:
            return 409, {"error": "JOB_CONFLICT"}
        worker = threading.Thread(target=self._worker, args=(job,), daemon=False)
        worker.start()
        return 202, {"job": job}


def build_handler(broker: BackupBroker):
    class Handler(BaseHTTPRequestHandler):
        def log_message(self, *_args) -> None:
            return

        def _answer(self, status: int, data: dict) -> None:
            body = json.dumps(data, sort_keys=True, separators=(",", ":")).encode()
            self.send_response(status)
            self.send_header("Content-Type", "application/json")
            self.send_header("Cache-Control", "no-store")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)

        def do_POST(self):
            if self.path != "/rpc" or self.headers.get("Content-Type") != "application/json":
                return self._answer(404, {"error": "NOT_FOUND"})
            # Linux SO_PEERCRED: never accept other local service accounts.
            try:
                pid, uid, gid = struct.unpack("3i", self.connection.getsockopt(socket.SOL_SOCKET, 17, 12))
            except OSError:
                return self._answer(403, {"error": "FORBIDDEN"})
            if uid not in {0, 1001}:
                return self._answer(403, {"error": "FORBIDDEN"})
            length = self.headers.get("Content-Length", "")
            if not length.isdecimal() or not 2 <= int(length) <= 2048:
                return self._answer(413, {"error": "REQUEST_TOO_LARGE"})
            body = self.rfile.read(int(length))
            if not broker.authenticate(
                self.headers.get("X-ReadBox-Timestamp", ""),
                self.headers.get("X-ReadBox-Nonce", ""),
                self.headers.get("X-ReadBox-Signature", ""), body,
            ):
                return self._answer(403, {"error": "FORBIDDEN"})
            try:
                payload = json.loads(body)
                if not isinstance(payload, dict):
                    return self._answer(400, {"error": "INVALID_INPUT"})
            except (ValueError, UnicodeDecodeError):
                return self._answer(400, {"error": "INVALID_INPUT"})
            try:
                status, result = broker.perform(payload)
            except Exception:
                status, result = 503, {"error": "BACKUP_AGENT_OPERATION_FAILED"}
            return self._answer(status, result)
    return Handler


def secret_file(path: Path) -> bytes:
    if path.is_symlink() or not path.is_file() or stat.S_IMODE(path.stat().st_mode) != 0o640:
        raise ValueError("Agent IPC secret missing or unsafe")
    value = path.read_text(encoding="ascii").strip()
    if not re.fullmatch(r"[a-f0-9]{64}", value):
        raise ValueError("Invalid IPC secret")
    return value.encode()


def main() -> None:
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--root", type=Path, required=True)
    p.add_argument("--project", required=True)
    p.add_argument("--db-user", default="readbox")
    p.add_argument("--db-name", default="readbox")
    p.add_argument("--socket-dir", type=Path, required=True)
    p.add_argument("--state-dir", type=Path, required=True)
    p.add_argument("--archive-dir", type=Path, required=True)
    p.add_argument("--lock-path", type=Path, required=True)
    args = p.parse_args()
    if os.geteuid() != 0:
        raise SystemExit("Host agent requires root; never run in ReadBox Web")
    if not args.socket_dir.is_dir() or args.socket_dir.is_symlink():
        raise SystemExit("Existing real IPC directory required")
    args.socket_dir.chmod(0o750)
    os.chown(args.socket_dir, 0, 1001)
    store = PrivateStore(args.state_dir)
    archive_dir = private_dir(args.archive_dir)
    executor = BackupExecutor(args.root, args.project, args.db_user, args.db_name,
                              store, archive_dir, args.lock_path)
    token_file = args.socket_dir / "access.token"
    socket_file = args.socket_dir / "agent.sock"
    if token_file.is_symlink() or socket_file.is_symlink():
        raise SystemExit("Unsafe IPC entry")
    if socket_file.exists():
        # Refuse to remove any active socket from an unrelated process.
        test = socket.socket(socket.AF_UNIX)
        try:
            test.settimeout(0.3)
            test.connect(str(socket_file))
        except (ConnectionRefusedError, FileNotFoundError):
            socket_file.unlink()
        else:
            raise SystemExit("Backup agent socket already serving")
        finally:
            test.close()
    token = secrets.token_hex(32).encode()
    temp = args.socket_dir / (".token." + secrets.token_hex(8))
    fd = os.open(temp, os.O_WRONLY | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW, 0o640)
    with os.fdopen(fd, "wb") as handle:
        handle.write(token + b"\n")
    os.chown(temp, 0, 1001)
    os.chmod(temp, 0o640)  # systemd UMask=0077 must not remove Web group read
    os.replace(temp, token_file)
    token = secret_file(token_file)
    broker = BackupBroker(store, executor, token)
    server = ThreadingUnixServer(str(socket_file), build_handler(broker))
    os.chown(socket_file, 0, 1001)
    os.chmod(socket_file, 0o660)
    print("BR02_BACKUP_AGENT_READY", flush=True)
    def request_shutdown(_signal: int, _frame: object) -> None:
        # server.shutdown must run in a separate thread from serve_forever.
        threading.Thread(target=server.shutdown, daemon=True).start()
    signal.signal(signal.SIGTERM, request_shutdown)
    signal.signal(signal.SIGINT, request_shutdown)
    try:
        server.serve_forever(poll_interval=0.5)
    finally:
        server.server_close()
        socket_file.unlink(missing_ok=True)


if __name__ == "__main__":
    main()
