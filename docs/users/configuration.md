# Configuring a ReadBox installation

Configuration is host-managed, **not** stored in the repository. The complete public template is [`.env.example`](../../.env.example); actual runtime validation is defined in `src/config/env-schema.ts`. Never publish a populated `.env`, authentication secrets, Cloudflare tokens or R2 secret access keys.

## Essential settings

| Area | Settings / source | Operational rule |
|---|---|---|
| Database | `SERVICE_PASSWORD_DB`, `POSTGRES_USER`, `POSTGRES_DB`, `DATABASE_URL` | One PostgreSQL database; Compose derives its own app DB URL from private secrets |
| Login | `AUTH_ENABLED`, `AUTH_SECRET`, `AUTH_TRUST_HOST`, `TRUST_PROXY_HEADERS` | Auth secret is required if enabled; trust proxy headers only behind a controlled reverse proxy |
| Canonical site | `AUTH_URL`, `PUBLIC_SITE_ORIGIN` | Use the real HTTPS origin for first-admin and secure browser requests |
| Mail | `MAIL_DOMAIN`, `MAIL_HOSTNAME`, `SERVER_IP` | DNS is based on these values; do not substitute the web app URL for SMTP hostname |
| Storage | `MAIL_STORAGE_ROOT`, `ATTACHMENT_STORAGE_ROOT`, `MEDIA_ROOT`, `OPENDKIM_KEYS_ROOT` | Preserve mounted data volumes and file ownership |
| Retention / ingest | `INGESTION_INTERVAL_SECONDS`, `INGESTION_STALE_AFTER_SECONDS`, `REQUIRE_INGESTION_READY` | Readiness can optionally require a fresh ingestion worker heartbeat |
| Message limits | `MAX_MESSAGE_SIZE_MB`, `MAX_ATTACHMENT_SIZE_MB`, `MAX_ATTACHMENTS_PER_MESSAGE` | Apply configured size/count bounds during parsing and storage |
| Domain automation | `READBOX_CF_DNS_TOKEN`, `READBOX_CF_DNS_ZONE_ID`, `READBOX_CF_DNS_ZONE_NAME` | Optional scoped Cloudflare automation; Manual Mode can use another account |
| Safe host update | `READBOX_BACKUP_RECIPIENT` | Valid Age X25519 public recipient, not a private key |
| Update UI | `UPDATE_GITHUB_REPO`, `UPDATE_RUNTIME_DIR`, `UPDATE_SERVICE_NAME`, `UPDATE_SCRIPT_PATH` | Host bridge and release checking need an authorized deployment setup |

The authenticated **Admin → Settings** screen manages *site branding/contact/footer preferences*, not arbitrary Docker or server environment variables. **Admin → Users control** manages public sign-up, access policies and retention settings in the database.

## Production boundary

Developer auth bypass and demo sessions are for development only; `src/auth.ts` and environment policy refuse unsafe production combinations. `SMTP_BIND_ADDRESS` in `docker-compose.yml` defaults to loopback; public port 25 exposure requires explicit networking and mail policy verification.

Source: `src/config/env-schema.ts`, `src/config/env.ts`, `.env.example`, `docker-compose.yml`, `src/core/settings/service.ts`, `src/core/accounts/user-control-policy.ts`. For all settings see [configuration reference](../reference/configuration-reference.md).
