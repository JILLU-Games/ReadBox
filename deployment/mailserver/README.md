# ReadBox inbound SMTP/LMTP — R-03 installation contract

**Scope:** Postfix (inbound SMTP :25) → Dovecot (private LMTP :24) → existing Maildir `/var/vmail/<domain>/<local>/Maildir/{new,cur,tmp}` → ReadBox worker. These services are **opt-in** through Docker Compose profile `mailserver`. **No SMTP submission, IMAP, POP3, outbound delivery, hosted DNS, DKIM signer or public cert issuer is provided.**

## Requirements

- R-01/R-02 complete: app + worker + single PostgreSQL migrations and restricted `readbox_postfix` LOGIN role.
- Correct real mail domain/hostname, persistent `readbox_vmail` and `readbox_postfix_queue` Docker volumes, web/worker/Dovecot delivery UID/GID **1001:1001**, and separate `POSTFIX_LOOKUP_PASSWORD` (at least 24 URL-safe characters). Never commit the credential or log rendered PostgreSQL map files.
- A *real trusted and unexpired* SMTP certificate for the exact `MAIL_HOSTNAME` in a **private host directory**: `fullchain.pem` and `privkey.pem`. Set `MAIL_TLS_DIR` to this host directory. No implicit self-signed production TLS or certificate auto-generation. SMTP advertises opportunistic STARTTLS (not mandatory TLS for all Internet senders). Dovecot LMTP is plaintext **only on the isolated Docker network**.
- VPS provider must permit inbound TCP/25; DNS MX/A/AAAA/PTR, firewall, anti-relay checks, certificate renewal and real Internet mail tests are **not** verifiable with CI and remain R-06 acceptance gates.

## Controlled setup — these are instructions, NOT actions performed in R-03

1. Set `SERVICE_PASSWORD_DB`, `SERVICE_BASE64_64_SECRET`, `MAIL_DOMAIN`, `MAIL_HOSTNAME`, `POSTFIX_LOOKUP_PASSWORD`, `MAIL_TLS_DIR` in your private local environment/Coolify. Generate the Postfix password with `openssl rand -hex 32`.
2. `docker compose -f docker-compose.yml up -d --build postgres web worker` (the default app stack remains unchanged).
3. `docker compose -f docker-compose.yml --profile postfix-setup run --rm postfix-db-credential` (one-shot restricted role password initialization; no second DB or public PostgreSQL port).
4. `docker compose -f docker-compose.yml --profile mailserver up -d --build dovecot postfix`. Check `postfix check`, `postconf -n`, `doveconf -n`, `docker compose ps`, logs and local SMTP STARTTLS. The Postfix container **fails startup** when credentials, readable matching TLS certificate or key are missing.
5. SMTP host binding defaults to **127.0.0.1:25** even with the opt-in profile. A separately approved real VPS deployment may set `SMTP_BIND_ADDRESS=0.0.0.0` after verifying port policy, firewall, legitimate TLS, DNS and no-open-relay behavior. `SMTP_PUBLISHED_PORT` can be overridden for isolated staging smoke tests only; public MX must resolve to standard TCP/25.
6. Set DNS **manually** with your provider: MX for mailbox domain → `MAIL_HOSTNAME`; A/AAAA for that hostname → public VPS IP; PTR at VPS provider; applicable inbound TLS and monitoring. ReadBox's DNS record generator previews suggestions—it does not publish them or prove port reachability. DKIM signing is **out of scope for inbound-only mail**, and the existing advisory DKIM key preview is not an installed signer. SPF/DMARC are suggestions, not evidence they are published.

## Trust and recipient boundaries

- Postfix virtual domain/mailbox/alias maps query the **same** PostgreSQL database via `readbox_postfix` and read-only security-invoker views. PostgreSQL has no host-published port.
- Unknown/disabled local recipients are rejected at SMTP RCPT; nonlocal relay is denied; no submission/IMAP client login service is enabled. The `default_transport = error:...` guard rejects outbound SMTP even if aliases point off-domain.
- Dovecot authenticates *no external users*: it exposes only private LMTP and writes as UID/GID 1001. Existing message files are never chowned or broadened by mailserver startup.
- Postfix mail queue persists in `readbox_postfix_queue`. Maintain storage backups and retention with R-05 before production release.
- The CI uses a loopback-bound SMTP port and an ephemeral self-signed test certificate; its success does **not** authorize public deployment or a production-ready claim.
