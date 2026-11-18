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

from executor import BackupExecutor, BackupExecutionError
from storage import PrivateStore, private_dir, valid_id
from r2 import R2Adapter, R2Error
from scheduler import ScheduleManager, ScheduleError
from restore import preflight as restore_preflight, production_gate, RestoreError


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
        self.r2 = R2Adapter(state, executor)
        self.schedule = ScheduleManager(state)

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
            if job["kind"] == "r2_upload":
                fd = self.executor._lock()
                try:
                    result = self.r2.upload(job["backupId"])
                finally:
                    import fcntl
                    fcntl.flock(fd, fcntl.LOCK_UN)
                    os.close(fd)
            else:
                result = self.executor.run(
                    job["kind"], identifier, job.get("backupId"),
                    job.get("expectedDigest"))
            if job["kind"] == "verify" and job.get("backupId"):
                self.state.set_backup_verification(job["backupId"], True)
            message = ("Encrypted backup saved and verified"
                       if job["kind"] == "backup" else
                       "Encrypted backup verification passed"
                       if job["kind"] == "verify" else
                       "Encrypted restore completed and rollback archive retained"
                       if job["kind"] == "restore" else
                       "Encrypted backup uploaded to R2 and remotely checksum verified")
            self.state.update(identifier, "completed", message, "success", result)
            if job["kind"] == "backup" and job.get("autoUpload"):
                # Saved intent + verified archive survive a crash before this call.
                # The scheduler also reconciles on startup and every bounded tick.
                self.queue_auto_upload()
            elif job["kind"] == "r2_upload":
                try:
                    self.schedule.cleanup_local(self.r2, self.executor.archives,
                                                self.schedule.read())
                except Exception:
                    pass
        except Exception as error:
            error_code = (error.code if isinstance(error, (BackupExecutionError, R2Error, ScheduleError, RestoreError))
                          else "BACKUP_AGENT_EXECUTION_FAILED")
            if job["kind"] == "verify" and job.get("backupId"):
                try:
                    self.state.set_backup_verification(job["backupId"], False)
                except Exception:
                    pass
            message = ("Backup operation failed; no completed backup was published"
                       if job["kind"] == "backup" else
                       "Backup verification failed; existing archive was preserved"
                       if job["kind"] == "verify" else
                       "Restore failed; rollback outcome requires operator review"
                       if job["kind"] == "restore" else
                       "Cloudflare R2 upload failed; local backup was preserved")
            try:
                self.state.update(identifier, "failed", message, "error",
                                  {"errorCode": error_code})
            except Exception:
                pass

    def perform(self, payload: dict) -> tuple[int, dict]:
        action = payload.get("action")
        if not isinstance(action, str):
            return 400, {"error": "INVALID_ACTION"}
        if action == "status" and set(payload) == {"action"}:
            return 200, {
                "connected": True, "jobs": self.state.list_jobs(),
                "backups": self.state.list_backups(), "r2": self.r2.public(),
                "schedule": self.schedule.read(),
                "restore": {"enabled": production_gate(self.executor.project),
                            "operatorReviewRequired": self.state.restore_requires_review()},
            }
        if action == "r2.configure" and set(payload) == {"action", "config"}:
            return 200, {"r2": self.r2.configure(payload["config"])}
        if action == "r2.test" and set(payload) == {"action"}:
            return 200, {"test": self.r2.test()}
        if action == "r2.list" and set(payload) == {"action"}:
            return 200, {"remote": self.r2.list_remote()}
        if action == "schedule.configure" and set(payload) == {"action", "schedule"}:
            return 200, {"schedule": self.schedule.configure(
                payload["schedule"], self.r2.public()["configured"])}

        if action in {"restore.test", "restore.prepare"}:
            required = {"action", "backupId"} if action == "restore.test" else {
                "action", "backupId", "actor"}
            if set(payload) != required or not valid_id(payload.get("backupId")):
                return 400, {"error": "RESTORE_INPUT_INVALID"}
            if action == "restore.prepare":
                if not re.fullmatch(r"[1-9][0-9]{0,18}", str(payload.get("actor", ""))):
                    return 400, {"error": "RESTORE_INPUT_INVALID"}
                if not production_gate(self.executor.project):
                    return 409, {"error": "RESTORE_OPERATOR_GATE_CLOSED"}
            checked = restore_preflight(self.executor, payload["backupId"])
            if action == "restore.test":
                return 200, {"preflight": checked}
            record = self.state.get_backup(payload["backupId"])
            permit = self.state.issue_restore_permit(payload["backupId"],
                                                      record["sha256"], payload["actor"])
            return 200, {"preflight": checked, "permit": permit}
        if action == "restore.commit":
            required = {"action", "backupId", "actor", "permitId", "token", "confirmation"}
            if set(payload) != required or not valid_id(payload.get("backupId")) or not (
                isinstance(payload.get("actor"), str) and
                re.fullmatch(r"[1-9][0-9]{0,18}", payload["actor"])
            ):
                return 400, {"error": "RESTORE_INPUT_INVALID"}
            backup_id = payload["backupId"]
            if not production_gate(self.executor.project):
                return 409, {"error": "RESTORE_OPERATOR_GATE_CLOSED"}
            if payload.get("confirmation") != "RESTORE " + backup_id:
                return 409, {"error": "RESTORE_CONFIRMATION_REQUIRED"}
            checked = restore_preflight(self.executor, backup_id)
            record = self.state.get_backup(backup_id)
            if self.state.restore_requires_review():
                return 409, {"error": "RESTORE_OPERATOR_REVIEW_REQUIRED"}
            if not self.state.consume_restore_permit(payload.get("permitId"),
                                                     payload.get("token"), backup_id,
                                                     record["sha256"], payload["actor"]):
                return 409, {"error": "RESTORE_PERMIT_EXPIRED"}
            try:
                job = self.state.create("restore", backup_id,
                                        expected_digest=record["sha256"])
            except RuntimeError:
                return 409, {"error": "JOB_CONFLICT"}
            threading.Thread(target=self._worker, args=(job,), daemon=False).start()
            return 202, {"job": job}
        if action == "job.get":
            identifier = payload.get("jobId")
            if not valid_id(identifier):
                return 400, {"error": "INVALID_JOB_ID"}
            job = self.state.get_job(identifier)
            return (200, {"job": job}) if job else (404, {"error": "JOB_NOT_FOUND"})
        if action == "backup.create" and set(payload) == {"action"}:
            kind = "backup"
            backup_id = None
        elif action in {"backup.verify", "r2.upload"} and set(payload) == {"action", "backupId"}:
            kind = "verify" if action == "backup.verify" else "r2_upload"
            backup_id = payload["backupId"]
            record = self.state.get_backup(backup_id) if valid_id(backup_id) else None
            if record is None:
                return 404, {"error": "BACKUP_NOT_FOUND"}
            if kind == "r2_upload" and (record["state"] != "verified" or
                                         record["level"] != "V2"):
                return 409, {"error": "R2_BACKUP_NOT_V2_VERIFIED"}
        else:
            return 400, {"error": "ACTION_NOT_ALLOWED"}
        try:
            job = self.state.create(kind, backup_id)
        except RuntimeError:
            return 409, {"error": "JOB_CONFLICT"}
        worker = threading.Thread(target=self._worker, args=(job,), daemon=False)
        worker.start()
        return 202, {"job": job}

    def queue_auto_upload(self, when: float | None = None) -> bool:
        # One atomic journal claim prevents concurrent scheduler/worker enqueues.
        job = self.state.claim_due_auto_upload(when)
        if job is None:
            return False
        threading.Thread(target=self._worker, args=(job,), daemon=False).start()
        return True

    def scheduler_tick(self, when: float | None = None) -> bool:
        # First reconcile persisted pending uploads, including after agent restart.
        if self.queue_auto_upload(when):
            return True
        # Explicitly default OFF. No auto-restore or remote deletion.
        if any(job["state"] in {"queued", "running"} for job in self.state.list_jobs()):
            return False
        config = self.schedule.due(when)
        if config is None:
            return False
        try:
            job = self.state.create("backup", auto_upload=bool(config["autoUpload"]))
        except RuntimeError:
            return False
        threading.Thread(target=self._worker, args=(job,), daemon=False).start()
        return True


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
            if not length.isdecimal() or not 2 <= int(length) <= 4096:
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
            except (R2Error, ScheduleError, RestoreError) as error:
                status, result = 409, {"error": error.code}
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
    scheduler_stop = threading.Event()
    def scheduler_loop() -> None:
        while not scheduler_stop.wait(15):
            try:
                broker.scheduler_tick()
            except Exception:
                # Unknown failure never launches a backup or reveals secrets.
                pass
    scheduler_worker = threading.Thread(target=scheduler_loop, daemon=True)
    scheduler_worker.start()
    def request_shutdown(_signal: int, _frame: object) -> None:
        # server.shutdown must run in a separate thread from serve_forever.
        threading.Thread(target=server.shutdown, daemon=True).start()
    signal.signal(signal.SIGTERM, request_shutdown)
    signal.signal(signal.SIGINT, request_shutdown)
    try:
        server.serve_forever(poll_interval=0.5)
    finally:
        scheduler_stop.set()
        server.server_close()
        socket_file.unlink(missing_ok=True)


if __name__ == "__main__":
    main()
