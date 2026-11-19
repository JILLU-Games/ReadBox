# ReadBox Configuration Reference

**Sources:** `src/config/env-schema.ts:47-243`, `src/config/env-schema.ts:307-363`, root `.env.example`, `docker-compose.yml`, `scripts/install/readbox-update.sh` and DNS runtime modules. The Next.js environment parser validates a subset of server variables, while Docker/host scripts and Cloudflare SDK paths consume others. **Do not mistake a blank example value for a real production credential.**

## Server environment: parsed and validated

| Variable | Source default / constraint | Purpose |
|---|---|---|
| `NODE_ENV` | `development`, `test`, `production`; default `development` | Runtime policy |
| `DATABASE_URL` | Optional URL, only `postgres:` or `postgresql:`; required in production when authentication is enabled | One PostgreSQL database |
| `AUTH_ENABLED` | `false` unless enabled | Credentials authentication |
| `AUTH_SECRET` | Optional except when `AUTH_ENABLED=true`; minimum 32 characters | Session/auth crypto |
| `CONTACT_SECRET_KEY` | Optional, minimum 16 chars | Contact CSRF HMAC override |
| `AUTH_TRUST_HOST`, `TRUST_PROXY_HEADERS` | Default `false` | Trusted reverse-proxy boundaries |
| `DEV_AUTH_MODE` | `off`, `bypass`, `demo`; default `off`; forced off in production | Development-only auth |
| `DEV_AUTH_ROLE` | `admin` or `user` | Development-only role |
| `LOGIN_FAILURE_LIMIT` | Integer 1–100; default 5 | Login lockout threshold |
| `LOGIN_FAILURE_WINDOW_SECONDS`, `LOGIN_LOCKOUT_SECONDS` | Integer 60–86,400; default 900 each | Login rate/lockout window |
| `LOG_LEVEL` | `debug`, `info`, `warn`, `error`; default `info` | Server log detail |
| `MAIL_DOMAIN` | Default `readbox.local` | Default mail domain |
| `MAIL_HOSTNAME` | Default `mail.readbox.local` | MX target mail host |
| `APP_HOSTNAME` | Default `app.readbox.local` | App host name |
| `SERVER_IP` | Valid IPv4/IPv6; default `127.0.0.1` | Expected mail host A/AAAA address |
| `MAIL_STORAGE_ROOT` | Default `/var/vmail` | Maildir storage root |
| `ATTACHMENT_STORAGE_ROOT` | Default `/var/lib/readbox/attachments` | Attachment bytes |
| `MEDIA_ROOT` | Default `/var/lib/readbox/media` | Branding/media assets |
| `MAILBOX_PROVISION_LOCK_ROOT` | Default `/var/lock/readbox-provision` | Filesystem provisioning locks |
| `MAILBOX_DEFAULT_QUOTA_BYTES` | Default `2147483648` | Mailbox quota fallback |
| `OPENDKIM_KEYS_ROOT` | Default `/etc/opendkim/keys` | DKIM public material lookup |
| `DNS_LOOKUP_TIMEOUT_SECONDS` | Default 3; range 0.5–30 | DNS probe timeout |
| `INGESTION_STALE_AFTER_SECONDS` | Default 120; range 15–86,400 | Worker readiness age |
| `INGESTION_INTERVAL_SECONDS` | Default 15; range 1–3,600 | Ingestion worker interval |
| `REQUIRE_INGESTION_READY` | Default `false` | Include fresh worker heartbeat in readiness |
| `INGESTION_LOCK_FILE` | Default `/var/lock/readbox-ingestion.lock` | Worker concurrency control |
| `MAX_MESSAGE_SIZE_MB` | Default 25; range 1–200 | MIME input cap |
| `MAX_ATTACHMENT_SIZE_MB` | Default 20; range 1–100 | Per-file attachment cap |
| `MAX_ATTACHMENTS_PER_MESSAGE` | Default 25; range 1–200 | Count cap |
| `USE_X_ACCEL_REDIRECT` | Default `false` | Optional trusted reverse-proxy attachment offload |
| `PUBLIC_SITE_ORIGIN` | Optional URL | Canonical public origin |
| `UPDATE_RUNTIME_DIR` | Default `/run/readbox` | Host update handoff state |
| `UPDATE_SERVICE_NAME` | Default `readbox-updater.service` | Updater service identity |
| `UPDATE_SCRIPT_PATH` | Default `/opt/readbox/app/scripts/updater/upgrade.sh` | Legacy host updater location |
| `UPDATE_GITHUB_REPO` | Default `vibtools/ReadBox` | Legacy release-lookup repo; check approved current target |

**Important observed mismatch:** `.env.example` sets `MAILBOX_PROVISION_LOCK_ROOT=/var/lock/readbox-provision` but the parser's `INGESTION_LOCK_FILE` fallback is `/var/lock/readbox-ingestion.lock`; the template explicitly sets the ingestion path within the provision lock root. Use the tracked template for a host and preserve its explicit override. Likewise `UPDATE_GITHUB_REPO`'s historical default `vibtools/ReadBox` is **not** the current authoritative `vibtoolshq/ReadBox`; configure intentionally, do not assume the default is current.

## Compose and host-only configuration

| Variable(s) | Consumer | Note |
|---|---|---|
| `SERVICE_PASSWORD_DB`, `SERVICE_BASE64_64_SECRET`, `POSTFIX_LOOKUP_PASSWORD` | Standalone installer/Compose | Generated strong secrets; never commit/rotate casually |
| `POSTGRES_USER`, `POSTGRES_DB` | Compose | Defaults `readbox`/ `readbox` in template |
| `READBOX_SETUP_TOKEN_SHA256`, `READBOX_SETUP_TOKEN_EXPIRES_AT` | One-time installer/browser activation | Store hash/expiry, never plaintext activation code |
| `SMTP_BIND_ADDRESS`, `SMTP_PUBLISHED_PORT` | Compose `postfix` | Default `127.0.0.1:25`; public override requires independent authorization |
| `MAIL_TLS_DIR` | Compose Postfix | Private host TLS mount path |
| `READBOX_CF_DNS_TOKEN`, `READBOX_CF_DNS_ZONE_ID`, `READBOX_CF_DNS_ZONE_NAME` | Domain/DKIM Cloudflare routines | Optional; use scoped token; Manual Mode disables publish for another account |
| `READBOX_BACKUP_RECIPIENT` | Guarded host updater | Age **X25519 public recipient**; may be supplied via private `.env` or process environment |
| `READBOX_UPDATE_TARGET_SHA` | Host updater | Optional 40-character exact target SHA pin |
| `READBOX_UPDATE_REQUIRE_PARITY` | Host updater | Legacy optional same-`main` source/mirror check; dedicated backup branches use separate parity workflow |
| `READBOX_COMPOSE_PROJECT` | Installer/updater | Defaults `readbox` |

## Change control

Never place live secrets in public documentation, CI logs or tickets. Back up and audit before changing database, mail domains, storage roots, DNS credentials or host update configuration. The browser Admin → Settings panel does not mutate arbitrary environment variables.

See [configuration guide](../users/configuration.md) and [host deployment](../dev/building-packaging.md).
