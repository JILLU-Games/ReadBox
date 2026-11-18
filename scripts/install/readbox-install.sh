#!/usr/bin/env bash
# QIS-01: standalone secure one-command Docker Compose installer.
# Does NOT configure or expose public SMTP/TLS/DNS; never deletes volumes.
set -Eeuo pipefail
umask 077
ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/../.." && pwd -P)"
cd "$ROOT"
ENV_FILE="$ROOT/.env"
PROJECT="${READBOX_COMPOSE_PROJECT:-readbox}"
PREPARE_ONLY=false
if [[ "${1:-}" == "--prepare-only" && "${READBOX_QIS_DISPOSABLE_CI:-}" == "1" ]]; then
  PREPARE_ONLY=true
elif [[ $# -gt 0 ]]; then
  echo "Usage: bash scripts/install/readbox-install.sh" >&2
  exit 2
fi

for executable in openssl sha256sum docker git; do
  command -v "$executable" >/dev/null 2>&1 || {
    echo "Required tool missing: $executable" >&2
    exit 2
  }
done
[[ -f docker-compose.yml && -f .env.example && -d .git ]] || {
  echo "QIS-01 requires the verified ReadBox Git checkout." >&2
  exit 2
}
[[ "$PROJECT" =~ ^[a-z][a-z0-9_-]{2,55}$ ]] || {
  echo "Invalid Docker Compose project name." >&2
  exit 2
}
if [[ -L "$ENV_FILE" || ( -e "$ENV_FILE" && ! -f "$ENV_FILE" ) ]]; then
  echo "Unsafe .env file type. No secret overwritten." >&2
  exit 2
fi
read_env() {
  local key="$1" value count
  count="$(grep -Ec "^${key}=" "$ENV_FILE" || true)"
  [[ "$count" == "1" ]] || return 1
  value="$(grep -E "^${key}=" "$ENV_FILE")"
  printf '%s' "${value#*=}"
}
validate_env() {
  local key value
  for key in SERVICE_PASSWORD_DB SERVICE_BASE64_64_SECRET POSTFIX_LOOKUP_PASSWORD; do
    value="$(read_env "$key")" || {
      echo "Existing .env lacks $key. Refusing to overwrite secrets." >&2
      exit 2
    }
    [[ ${#value} -ge 32 && "$value" =~ ^[A-Za-z0-9_-]+$ ]] || {
      echo "Invalid existing $key; refusing changes." >&2
      exit 2
    }
  done
  local mode
  mode="$(stat -c %a "$ENV_FILE")"
  [[ "$mode" == "600" ]] || {
    echo "Existing .env must have permissions 0600; refusing changes." >&2
    exit 2
  }
}
if [[ ! -e "$ENV_FILE" ]]; then
  code="$(openssl rand -base64 32 | tr '+/' '-_' | tr -d '= \n')"
  [[ ${#code} -eq 43 ]] || exit 2
  db="$(openssl rand -hex 32)"
  auth="$(openssl rand -hex 48)"
  postfix="$(openssl rand -hex 32)"
  hash="$(printf '%s' "$code" | sha256sum | cut -d' ' -f1)"
  expiry="$(( $(date -u +%s) + 3600 ))"
  tmp="$(mktemp "$ROOT/.env.tmp.XXXXXXXX")"
  trap 'rm -f -- "${tmp:-}"' EXIT
  cat > "$tmp" <<EOF
# ReadBox QIS-01 generated private secrets. Never print/commit/rotate.
POSTGRES_USER=readbox
POSTGRES_DB=readbox
SERVICE_PASSWORD_DB=$db
SERVICE_BASE64_64_SECRET=$auth
POSTFIX_LOOKUP_PASSWORD=$postfix
READBOX_SETUP_TOKEN_SHA256=$hash
READBOX_SETUP_TOKEN_EXPIRES_AT=$expiry
AUTH_ENABLED=true
AUTH_TRUST_HOST=true
TRUST_PROXY_HEADERS=true
DEV_AUTH_MODE=off
MAIL_DOMAIN=readbox.local
MAIL_HOSTNAME=mail.readbox.local
APP_HOSTNAME=app.readbox.local
SERVER_IP=127.0.0.1
SMTP_BIND_ADDRESS=127.0.0.1
EOF
  chmod 0600 "$tmp"
  if ! ln "$tmp" "$ENV_FILE" 2>/dev/null; then
    echo "Concurrent .env creation detected; refusing to overwrite." >&2
    exit 2
  fi
  rm -f "$tmp"
  trap - EXIT
  unset db auth postfix hash
  echo "QIS01_PRIVATE_ENV_CREATED"
  printf '\nREADBOX_ONE_TIME_SETUP_CODE (keep private, shown once):\n%s\n\n' "$code"
  echo "Do not copy the code into a URL, support ticket or GitHub log."
  unset code
else
  validate_env
  echo "QIS01_EXISTING_SECRETS_PRESERVED"
  echo "The one-time setup code is not retrievable. Existing operator recovery remains supported."
fi

if [[ "$PREPARE_ONLY" == "true" ]]; then
  echo "QIS01_DISPOSABLE_PREPARE_ONLY_PASS"
  exit 0
fi
docker compose version >/dev/null
docker compose --project-name "$PROJECT" -f docker-compose.yml config --quiet
docker compose --project-name "$PROJECT" -f docker-compose.yml up -d --build postgres web worker
# Configure the least-privilege Postfix lookup role without exposing SMTP.
docker compose --profile postfix-setup --project-name "$PROJECT" \
  -f docker-compose.yml run --rm postfix-db-credential
echo "QIS01_COMPOSE_POSTGRES_WEB_WORKER_READY"
echo "Public SMTP stays disabled. Configure an approved trusted HTTPS reverse proxy."
echo "After HTTPS is ready: https://YOUR-APP-DOMAIN/initial-setup"
