#!/bin/sh
set -eu
: "${VMAIL_UID:=1001}"
: "${VMAIL_GID:=1001}"
: "${MAIL_DOMAIN:?MAIL_DOMAIN must be set}"
case "$VMAIL_UID" in *[!0-9]*|'') echo "[readbox-mail] Invalid delivery UID" >&2; exit 1;; esac
case "$VMAIL_GID" in *[!0-9]*|'') echo "[readbox-mail] Invalid delivery GID" >&2; exit 1;; esac
[ "$VMAIL_UID" = 1001 ] && [ "$VMAIL_GID" = 1001 ] || {
  echo "[readbox-mail] LMTP delivery identity must match ReadBox UID/GID 1001." >&2
  exit 1
}
case "$MAIL_DOMAIN" in *[!a-zA-Z0-9.-]*|'') echo "[readbox-mail] Invalid MAIL_DOMAIN." >&2; exit 1;; esac
sed -e "s/{{VMAIL_UID}}/$VMAIL_UID/g" \
    -e "s/{{VMAIL_GID}}/$VMAIL_GID/g" \
    -e "s/{{MAIL_DOMAIN}}/$MAIL_DOMAIN/g" \
    /usr/local/share/readbox/dovecot.conf.tpl > /etc/dovecot/dovecot.conf
doveconf -c /etc/dovecot/dovecot.conf -n >/dev/null
exec dovecot -c /etc/dovecot/dovecot.conf -F
