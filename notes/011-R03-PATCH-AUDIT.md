# 011 — R-03 SMTP → LMTP → Maildir Post-Implementation Audit

**Date:** 2026-11-17 · **Frozen baseline:** `e28886e5e0f7a155cd64e23bc8ee8f6668d6699c`
**Verified executable-code commit:** `d0f3272ea298de012da83c6f01b588fa0513d1da`
**Focused GitHub CI SUCCESS:** https://github.com/JILLU-Games/ReadBox/actions/runs/44107205810
**Status:** R-03 opt-in inbound-mail implementation **CI VERIFIED CLOSED**; 3/6 phases complete. **Production NO-GO**.

## Exact Scope Lock — 12 published code/config/test paths

| Path | Implemented |
|---|---|
| `docker-compose.yml` | Opt-in `postfix`/`dovecot` mailserver profile, loopback default TCP/25 and persistent Postfix queue |
| `deployment/templates/dovecot/99-vibmail.conf.tpl` | LMTP-only private TCP/24, shared UID/GID 1001 |
| `deployment/mailserver/postfix/Dockerfile` | Package-installed Postfix and PostgreSQL map adapter |
| `deployment/mailserver/postfix/main.cf.tpl` | SMTP anti-relay, SQL recipient maps, outbound disabled, opportunistic STARTTLS |
| `deployment/mailserver/postfix/master.cf` | SMTP port only; no submission/SMTPS services |
| `deployment/mailserver/postfix/entrypoint.sh` | TLS key/certificate validation, safe credential rendering, Postfix syntax check |
| `deployment/mailserver/dovecot/Dockerfile` | Dovecot LMTP container |
| `deployment/mailserver/dovecot/entrypoint.sh` | Numeric delivery identity, template rendering and syntax check |
| `deployment/mailserver/README.md` | Operator prerequisites, private TLS handoff, manually managed DNS and security boundaries |
| `deployment/mailserver/tests/r03-smoke.sh` | One disposable PostgreSQL/SMTP/LMTP/Maildir integration scenario |
| `tests/mailserver/r03-compose-contract.test.mjs` | SMTP/LMTP, TLS, scope and Compose negative contract tests |
| `tests/dns/r03-advisory-contract.test.ts` | MX/A/AAAA/DNS advisory positive/negative tests |

Temporary CI workflow existed on the isolated branch only, and was **excluded** from main; CI path audit covered 13 files including that workflow. No `src/**`, Prisma schema/migration, auth, UI/UX, mailbox data, package files, public DNS or VPS changes.

## Proof excerpts

`deployment/mailserver/postfix/main.cf.tpl`:

```ini
virtual_mailbox_domains = proxy:pgsql:/etc/postfix/pgsql-virtual-domains.cf
virtual_mailbox_maps = proxy:pgsql:/etc/postfix/pgsql-virtual-mailboxes.cf
virtual_alias_maps = proxy:pgsql:/etc/postfix/pgsql-virtual-aliases.cf
virtual_transport = lmtp:inet:dovecot:24
smtpd_relay_restrictions = reject_unauth_destination
smtpd_recipient_restrictions = reject_unauth_destination, reject_unlisted_recipient
smtpd_sasl_auth_enable = no
default_transport = error:ReadBox inbound-only: outbound delivery disabled
smtpd_tls_security_level = may
```

`deployment/templates/dovecot/99-vibmail.conf.tpl`:

```ini
protocols = lmtp
mail_uid = {{VMAIL_UID}}
mail_gid = {{VMAIL_GID}}
mail_location = maildir:/var/vmail/%Ld/%Ln/Maildir
service lmtp {
  inet_listener lmtp {
    address = 0.0.0.0
    port = 24
  }
}
```

`docker-compose.yml`:

```yaml
postfix:
  profiles: ["mailserver"]
  volumes:
    - readbox_postfix_queue:/var/spool/postfix
  ports:
    - "${SMTP_BIND_ADDRESS:-127.0.0.1}:${SMTP_PUBLISHED_PORT:-25}:25"
```

Dovecot TCP/24 is exposed **inside the Docker network only**. SMTP defaults to loopback, so external TCP/25 requires a separately authorized deployment. No SMTP submission, IMAP or outbound relay exists. No second PostgreSQL.

## One focused CI integration — actual observed outcomes

**Successful CI URL:** https://github.com/JILLU-Games/ReadBox/actions/runs/44107205810

| Verification | Actual result |
|---|---|
| Prisma schema, TypeScript, DNS and mailserver tests, existing backend suite | PASS |
| Fresh disposable PostgreSQL/web/worker/Postfix/Dovecot containers | PASS |
| Existing R-02 one-shot Postfix SQL role password setup | PASS |
| Postfix `postfix check` and Dovecot `doveconf -n` | PASS |
| SMTP STARTTLS handshake with disposable **self-signed test-only** certificate | PASS |
| SMTP AUTH not advertised | PASS |
| Valid outside sender accepted, test email delivered to 1001-owned Maildir via LMTP | PASS |
| Unknown local mailbox / nonlocal SMTP relay | 5xx REJECT |
| No TLS material supplied | Startup REJECT |
| 13-path temporary-branch Scope Lock audit | PASS |

Log markers: `R03_STATIC_AND_APP_CONTRACTS_PASS`, `R03_MAILDIR_UID_1001_PASS`, `R03_SMTP_TLS_NO_RELAY_UNKNOWN_RECIPIENT_PASS`, `R03_SMTP_LMTP_MAILDIR_DELIVERY_PASS`, `R03_MISSING_TLS_FAIL_CLOSED_PASS`, `R03_SCOPE_AUDIT_PASS 13`. The first attempt failed only on two malformed regular-expression literals in the new static test; the targeted correction allowed the final focused run to pass.

## Finding reconciliation and acceptance boundary

- **CI-verified R-03:** `RB-P0-02`, `RB-P0-05`, `RB-P2-05`, `RB-P2-06` (four implemented contracts).
- **Still OPEN for live R-06 acceptance:** `RB-P1-09` (trusted public TLS/certificate renewal, externally published DNS; DKIM signing is not applicable to inbound-only mode) and `RB-P1-10` (real public TCP/25, MX/A/PTR, provider/firewall/IPv6 checks).
- Total original findings: **32**; CI verified through R-03 **15**; **17 OPEN**. Implementation phases completed **3/6**, remaining **R-04, R-05, R-06**.
- Unverified: VPS/Coolify install, trusted production TLS, real Internet inbound reachability, external DNS, message displayed in a live authenticated UI, backup/restore, outage replay and final release. **Production NO-GO**.

## Next phase under already documented Scope Lock

**R-04:** operator bootstrap and fail-closed runtime health (admin identity, worker heartbeat, DB/storage/ingestion readiness and recovery). No UI/auth-policy overhaul, no new mailserver features, and no live VPS without explicit future approval. Do not start R-04 on R-03 authorization alone.
