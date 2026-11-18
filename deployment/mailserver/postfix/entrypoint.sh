#!/bin/sh
set -eu
# Do not echo credentials or render secrets into logs.
: "${MAIL_HOSTNAME:?MAIL_HOSTNAME is required}"
: "${POSTFIX_DB_HOST:?POSTFIX_DB_HOST is required}"
: "${POSTFIX_DB_PORT:?POSTFIX_DB_PORT is required}"
: "${PG_DB_NAME:?PG_DB_NAME is required}"
: "${POSTFIX_LOOKUP_PASSWORD:?POSTFIX_LOOKUP_PASSWORD is required}"
: "${MAIL_TLS_DIR:=/run/readbox/tls}"
test -r "$MAIL_TLS_DIR/fullchain.pem" && test -r "$MAIL_TLS_DIR/privkey.pem" || {
  echo "[readbox-mail] TLS certificate and private key are mandatory." >&2
  exit 1
}
openssl x509 -in "$MAIL_TLS_DIR/fullchain.pem" -noout -checkend 300 >/dev/null || {
  echo "[readbox-mail] TLS certificate expired or near expiry." >&2
  exit 1
}
openssl x509 -in "$MAIL_TLS_DIR/fullchain.pem" -noout -checkhost "$MAIL_HOSTNAME" | grep -q 'does match' || {
  echo "[readbox-mail] Certificate does not match MAIL_HOSTNAME." >&2
  exit 1
}
openssl pkey -in "$MAIL_TLS_DIR/privkey.pem" -noout >/dev/null 2>&1 || {
  echo "[readbox-mail] TLS private key is invalid or inaccessible." >&2
  exit 1
}
install -o root -g postfix -m 0640 "$MAIL_TLS_DIR/privkey.pem" /etc/postfix/readbox.key
install -o root -g postfix -m 0644 "$MAIL_TLS_DIR/fullchain.pem" /etc/postfix/readbox.crt
python3 - <<'PY'
import os
import pathlib
import re
import sys

values = {
    "MAIL_HOSTNAME": os.environ["MAIL_HOSTNAME"],
    "POSTFIX_DB_HOST": os.environ["POSTFIX_DB_HOST"],
    "POSTFIX_DB_PORT": os.environ["POSTFIX_DB_PORT"],
    "PG_DB_NAME": os.environ["PG_DB_NAME"],
    "POSTFIX_DB_PASSWORD": os.environ["POSTFIX_LOOKUP_PASSWORD"],
}
if not re.fullmatch(r"[a-z0-9](?:[a-z0-9.-]{1,251}[a-z0-9])?", values["MAIL_HOSTNAME"]):
    sys.exit("[readbox-mail] Invalid mail hostname.")
if not re.fullmatch(r"[a-zA-Z0-9][a-zA-Z0-9_.-]{0,252}", values["POSTFIX_DB_HOST"]):
    sys.exit("[readbox-mail] Invalid private PostgreSQL host.")
if not values["POSTFIX_DB_PORT"].isdigit() or not 1 <= int(values["POSTFIX_DB_PORT"]) <= 65535:
    sys.exit("[readbox-mail] Invalid PostgreSQL port.")
if not re.fullmatch(r"[a-zA-Z0-9_]{1,63}", values["PG_DB_NAME"]):
    sys.exit("[readbox-mail] Invalid PostgreSQL database.")
if not re.fullmatch(r"[A-Za-z0-9_-]{24,256}", values["POSTFIX_DB_PASSWORD"]):
    sys.exit("[readbox-mail] Postfix DB secret must be 24+ URL-safe characters.")

templates = pathlib.Path("/usr/local/share/readbox")
targets = {
    "main.cf.tpl": pathlib.Path("/etc/postfix/main.cf"),
    "pgsql-virtual-domains.cf.tpl": pathlib.Path("/etc/postfix/pgsql-virtual-domains.cf"),
    "pgsql-virtual-mailboxes.cf.tpl": pathlib.Path("/etc/postfix/pgsql-virtual-mailboxes.cf"),
    "pgsql-virtual-aliases.cf.tpl": pathlib.Path("/etc/postfix/pgsql-virtual-aliases.cf"),
}
for name, target in targets.items():
    template = (templates / name).read_text()
    for key, value in values.items():
        template = template.replace("{{" + key + "}}", value)
    if "{{" in template or "}}" in template:
        sys.exit("[readbox-mail] Mailserver config template has unresolved placeholders.")
    target.write_text(template)
    target.chmod(0o640 if name.startswith("pgsql-") else 0o644)
    if name.startswith("pgsql-"):
        import grp
        os.chown(target, 0, grp.getgrnam("postfix").gr_gid)
PY
postfix check
# Postfix map credentials remain in chmod 0640 files; never emit them.
unset POSTFIX_LOOKUP_PASSWORD
exec postfix start-fg
