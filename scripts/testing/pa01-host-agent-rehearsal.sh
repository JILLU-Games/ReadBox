#!/usr/bin/env bash
# ReadBox PA01: irreversible actions ONLY against an empty GitHub-hosted runner.
set -Eeuo pipefail
umask 077
[[ "$READBOX_PA01_DISPOSABLE" == 1 && "$GITHUB_ACTIONS" == true &&
   "$GITHUB_REPOSITORY" == JILLU-Games/ReadBox &&
   "$GITHUB_WORKSPACE" == /* && "$(id -u)" == 0 ]] || {
  echo PA01_DISPOSABLE_HOST_GUARD_REFUSED >&2; exit 70;
}
ROOT=/opt/readbox
RUNTIME=/opt/readbox-backup-agent
SERVICE=readbox-backup-agent.service
[[ ! -e "$ROOT" && ! -e "$RUNTIME" && ! -e /var/lib/readbox-backup &&
   ! -e /etc/readbox-backup-agent.env && ! -e /etc/systemd/system/$SERVICE &&
   ! -e /etc/readbox-backup-restore.allow ]] || {
  echo PA01_HOST_ALREADY_CONFIGURED_REFUSED >&2; exit 70;
}
[[ "$(/usr/bin/python3 -c 'import sys; print(sys.version_info[:2] == (3, 12))')" == True ]] || exit 70
docker info >/dev/null
install -d -m 0700 "$ROOT"
cp -a "$GITHUB_WORKSPACE/deployment" "$GITHUB_WORKSPACE/scripts" "$GITHUB_WORKSPACE/docker-compose.yml" "$ROOT/"
printf 'POSTGRES_USER=readbox\nPOSTGRES_DB=readbox\nSERVICE_PASSWORD_DB=%s\nSERVICE_BASE64_64_SECRET=%s\nPOSTFIX_LOOKUP_PASSWORD=%s\n' \
  "$(openssl rand -hex 32)" "$(openssl rand -hex 48)" "$(openssl rand -hex 32)" > "$ROOT/.env"
chmod 0600 "$ROOT/.env"
if docker volume inspect readbox_readbox_backup_ipc >/dev/null 2>&1; then
  echo PA01_EXISTING_IPC_VOLUME_REFUSED >&2; exit 70
fi
docker volume create --label readbox.pa01.disposable=true readbox_readbox_backup_ipc >/dev/null
docker compose -f "$ROOT/docker-compose.yml" --project-name readbox config --quiet
bash "$ROOT/scripts/install/readbox-backup-agent-install.sh" >/dev/null
test "$(stat -c '%a' /var/lib/readbox-backup/identity.txt)" = 600
test "$(stat -c '%u:%g:%a' "$RUNTIME")" = 0:0:700
systemctl is-active --quiet "$SERVICE"
systemctl is-enabled --quiet "$SERVICE"
! systemctl is-active --quiet readbox-backup-agent.timer
POINTER_BEFORE="$(readlink "$RUNTIME/current")"
test "$POINTER_BEFORE" = "releases/$(sha256sum "$ROOT/deployment/backup-agent/requirements.lock" | cut -d' ' -f1)"
IDENTITY_BEFORE="$(sha256sum /var/lib/readbox-backup/identity.txt | cut -d' ' -f1)"

status_check() {
  PA01_IPC="$(docker volume inspect readbox_readbox_backup_ipc -f '{{.Mountpoint}}')" \
    /usr/bin/python3 - <<'PY'
import hashlib,hmac,http.client,json,os,secrets,socket,time
folder=os.environ["PA01_IPC"]
with open(folder+"/access.token",encoding="ascii") as f: secret=f.read().strip()
body=b'{"action":"status"}'
stamp=str(int(time.time()))
nonce=secrets.token_hex(16)
digest=hashlib.sha256(body).hexdigest()
sig=hmac.new(secret.encode(),(stamp+"."+nonce+"."+digest).encode(),hashlib.sha256).hexdigest()
class UnixHTTP(http.client.HTTPConnection):
    def __init__(self): super().__init__("localhost",timeout=3)
    def connect(self):
        self.sock=socket.socket(socket.AF_UNIX,socket.SOCK_STREAM)
        self.sock.settimeout(3)
        self.sock.connect(folder+"/agent.sock")
conn=UnixHTTP()
conn.request("POST","/rpc",body,{"Content-Type":"application/json",
    "X-ReadBox-Timestamp":stamp,"X-ReadBox-Nonce":nonce,
    "X-ReadBox-Signature":sig})
response=conn.getresponse()
result=json.loads(response.read())
assert response.status==200 and result["connected"] is True
assert result["restore"]["enabled"] is False
assert result["schedule"]["enabled"] is False
conn.close()
print("PA01_AUTHENTICATED_IPC_DEFAULT_DENY_PASS")
PY
}
status_check
bash "$ROOT/scripts/install/readbox-backup-agent-install.sh" >/dev/null
test "$(readlink "$RUNTIME/current")" = "$POINTER_BEFORE"
test "$(sha256sum /var/lib/readbox-backup/identity.txt | cut -d' ' -f1)" = "$IDENTITY_BEFORE"
systemctl restart "$SERVICE"
status_check
echo PA01_FRESH_IDEMPOTENT_SYSTEMD_RESTART_PASS

CONFLICT_LOG="$(mktemp)"
if flock /run/lock/readbox-backup-global.lock bash "$ROOT/scripts/install/readbox-backup-agent-install.sh" >"$CONFLICT_LOG" 2>&1; then
  echo PA01_LOCK_CONFLICT_WAS_ACCEPTED >&2; exit 1
fi
grep -Fq BR03_LIVE_MAINTENANCE_REFUSED "$CONFLICT_LOG"
rm -f "$CONFLICT_LOG"
test "$(readlink "$RUNTIME/current")" = "$POINTER_BEFORE"

# A different hash-based release is staged in this disposable root only.
# Fail one systemctl restart to exercise the actual installer EXIT rollback.
echo '# PA01 CI-only failure injection' >> "$ROOT/deployment/backup-agent/requirements.lock"
SHIM="$(mktemp -d)"
printf '%s\n' '#!/usr/bin/env bash' \
  'if [[ "$1" == restart && "$2" == readbox-backup-agent.service && -e /tmp/pa01-fail-next-restart ]]; then' \
  '  rm -f /tmp/pa01-fail-next-restart; exit 1' \
  'fi' \
  'exec /usr/bin/systemctl "$@"' > "$SHIM/systemctl"
chmod 0700 "$SHIM/systemctl"
touch /tmp/pa01-fail-next-restart
FAIL_LOG="$(mktemp)"
if PATH="$SHIM:$PATH" bash "$ROOT/scripts/install/readbox-backup-agent-install.sh" >"$FAIL_LOG" 2>&1; then
  echo PA01_EXPECTED_INSTALL_ROLLBACK_NOT_OBSERVED >&2; exit 1
fi
grep -Fq BR03_INSTALL_ROLLBACK_ATTEMPTED_PREVIOUS_RUNTIME_PRESERVED "$FAIL_LOG"
test "$(readlink "$RUNTIME/current")" = "$POINTER_BEFORE"
test "$(sha256sum /var/lib/readbox-backup/identity.txt | cut -d' ' -f1)" = "$IDENTITY_BEFORE"
systemctl is-active --quiet "$SERVICE"
cp "$GITHUB_WORKSPACE/deployment/backup-agent/requirements.lock" "$ROOT/deployment/backup-agent/requirements.lock"
rm -rf "$SHIM" "$FAIL_LOG" /tmp/pa01-fail-next-restart
status_check
echo PA01_SYSTEMD_INSTALL_ROLLBACK_AND_LOCK_PASS
