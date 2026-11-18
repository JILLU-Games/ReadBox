#!/usr/bin/env bash
# Run ONLY on an isolated disposable GitHub Actions runner; never on a user VPS.
set -euo pipefail
export COMPOSE_PROJECT_NAME="readbox_r03_ci"
export SERVICE_PASSWORD_DB="R03_Db_Password_0123456789_Private"
export SERVICE_BASE64_64_SECRET="R03_Test_Only_Auth_Secret_0123456789_Private_Not_Production"
export POSTFIX_LOOKUP_PASSWORD="R03_Lookup_0123456789_safe_only"
export POSTGRES_DB="readbox"
export POSTGRES_USER="readbox"
export MAIL_DOMAIN="r03.example.test"
export MAIL_HOSTNAME="mail.r03.example.test"
export APP_HOSTNAME="app.r03.example.test"
export SERVER_IP="203.0.113.42"
export SMTP_BIND_ADDRESS="127.0.0.1"
export SMTP_PUBLISHED_PORT="2525"
export MAIL_TLS_DIR
MAIL_TLS_DIR="$(mktemp -d)"
export MAIL_TLS_DIR
cleanup() {
  docker compose -f docker-compose.yml --profile mailserver --profile postfix-setup down -v --remove-orphans >/dev/null 2>&1 || true
  rm -rf "$MAIL_TLS_DIR"
}
trap cleanup EXIT
openssl req -x509 -nodes -newkey rsa:2048 -days 1 -subj "/CN=$MAIL_HOSTNAME" \
  -addext "subjectAltName=DNS:$MAIL_HOSTNAME" \
  -keyout "$MAIL_TLS_DIR/privkey.pem" -out "$MAIL_TLS_DIR/fullchain.pem" >/dev/null 2>&1
chmod 0700 "$MAIL_TLS_DIR"
chmod 0600 "$MAIL_TLS_DIR/privkey.pem"
docker compose -f docker-compose.yml config --quiet
docker compose -f docker-compose.yml config --services | LC_ALL=C sort > /tmp/r03-actual
printf 'postgres\nweb\nworker\n' > /tmp/r03-expected
diff -u /tmp/r03-expected /tmp/r03-actual
docker compose -f docker-compose.yml --profile mailserver config --services | grep -Fx 'postfix' >/dev/null
docker compose -f docker-compose.yml --profile mailserver config --services | grep -Fx 'dovecot' >/dev/null

echo "R03_TEST_START: disposable PostgreSQL/web/worker"
docker compose -f docker-compose.yml up -d --build postgres web worker
echo "R03_TEST: provisioning scoped SQL role via existing R02 one-shot profile"
docker compose -f docker-compose.yml --profile postfix-setup run --rm postfix-db-credential
echo "R03_TEST: starting opt-in Postfix+Dovecot"
docker compose -f docker-compose.yml --profile mailserver up -d --build dovecot postfix
docker compose -f docker-compose.yml --profile mailserver ps
docker compose -f docker-compose.yml exec -T postfix postfix check
docker compose -f docker-compose.yml exec -T dovecot doveconf -n >/dev/null

# Match the same canonical Maildir used by ReadBox provisioning; do not chown.
docker compose -f docker-compose.yml exec -T web node - <<'JS'
const fs = require("node:fs");
const path = require("node:path");
const base = "/var/vmail/r03.example.test/support";
const maildir = path.join(base, "Maildir");
for (const p of [
  "/var/vmail/r03.example.test", base, maildir,
  path.join(maildir, "new"), path.join(maildir, "cur"), path.join(maildir, "tmp"),
]) {
  fs.mkdirSync(p, { recursive: true });
  fs.chmodSync(p, p.endsWith("/r03.example.test") ? 0o750 : 0o700);
  const st = fs.statSync(p);
  if (st.uid !== 1001 || st.gid !== 1001) throw new Error("R03 Maildir identity mismatch");
}
console.log("R03_MAILDIR_UID_1001_PASS");
JS
docker compose -f docker-compose.yml exec -T postgres psql -U readbox -d readbox -v ON_ERROR_STOP=1 <<'SQL'
INSERT INTO mailserver.mail_domains(name, active)
VALUES ('r03.example.test', true);
INSERT INTO mailserver.mailboxes(domain_id, local_part, email, password_hash, maildir, active)
SELECT id, 'support', 'support@r03.example.test', '!INBOUND-ONLY!',
       'r03.example.test/support/Maildir/', true
FROM mailserver.mail_domains WHERE name = 'r03.example.test';
INSERT INTO mailserver.mail_aliases(domain_id, source, destination, active)
SELECT id, 'alias@r03.example.test', 'support@r03.example.test', true
FROM mailserver.mail_domains WHERE name = 'r03.example.test';
SQL
echo "R03_TEST: SMTP STARTTLS, valid recipient, invalid local recipient, nonlocal relay"
python3 - <<'PY'
import smtplib
import ssl
from email.message import EmailMessage

host, port = "127.0.0.1", 2525
with smtplib.SMTP(host, port, timeout=20) as smtp:
    smtp.ehlo("ci.example.test")
    if not smtp.has_extn("starttls"):
        raise AssertionError("SMTP must advertise STARTTLS")
    smtp.starttls(context=ssl._create_unverified_context())
    smtp.ehlo("ci.example.test")
    if smtp.has_extn("auth"):
        raise AssertionError("Inbound SMTP must not advertise AUTH")
    assert smtp.mail("outside@sender.test")[0] == 250
    code, response = smtp.rcpt("unknown@r03.example.test")
    assert 500 <= code < 600, (code, response)
    smtp.rset()
    assert smtp.mail("outside@sender.test")[0] == 250
    code, response = smtp.rcpt("outside@example.net")
    assert 500 <= code < 600, (code, response)
    smtp.rset()
    msg = EmailMessage()
    msg["From"] = "outside@sender.test"
    msg["To"] = "support@r03.example.test"
    msg["Subject"] = "ReadBox R03 scoped integration"
    msg.set_content("R03_MAILDIR_DELIVERY_PROOF_20261117")
    result = smtp.send_message(msg)
    assert not result, result
print("R03_SMTP_TLS_NO_RELAY_UNKNOWN_RECIPIENT_PASS")
PY

# Delivery is asynchronous; one bounded acceptance poll, no repeated test loops.
delivered=0
for attempt in $(seq 1 25); do
  if docker compose -f docker-compose.yml exec -T dovecot \
    sh -c 'grep -R -l "R03_MAILDIR_DELIVERY_PROOF_20261117" /var/vmail/r03.example.test/support/Maildir/new /var/vmail/r03.example.test/support/Maildir/cur 2>/dev/null | head -n 1' | grep -q .; then
    delivered=1
    break
  fi
  sleep 1
done
if [ "$delivered" -ne 1 ]; then
  docker compose -f docker-compose.yml logs --tail=90 postfix dovecot | sed -E 's/(password[ =:]+)[^ ]+/\1[REDACTED]/Ig' >&2
  echo "SMTP accepted but LMTP Maildir delivery was not observed." >&2
  exit 1
fi
echo "R03_SMTP_LMTP_MAILDIR_DELIVERY_PASS"

# A separate, non-starting container must refuse to run without TLS.
POSTFIX_IMAGE="$(docker compose -f docker-compose.yml images -q postfix)"
if docker run --rm --network none \
  -e MAIL_HOSTNAME="$MAIL_HOSTNAME" -e POSTFIX_DB_HOST=postgres \
  -e POSTFIX_DB_PORT=5432 -e PG_DB_NAME=readbox \
  -e POSTFIX_LOOKUP_PASSWORD="$POSTFIX_LOOKUP_PASSWORD" \
  "$POSTFIX_IMAGE" >/dev/null 2>&1; then
  echo "TLS absence failed to stop the Postfix container" >&2
  exit 1
fi
echo "R03_MISSING_TLS_FAIL_CLOSED_PASS"
