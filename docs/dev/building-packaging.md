# Build, Docker deployment, safe updates and release boundaries

**Current implementation:** Next.js web runtime and ingestion worker share a multistage Docker build; the active Compose services are `postgres`, `web`, `worker`, opt-in `dovecot`/`postfix` mailserver, and opt-in DKIM components. A separate host backup agent and update bridge supply privileged operations. This documentation does **not** authorize or execute a live deployment.

## Application build

```bash
npm ci
npm run db:validate
npm run typecheck
npm run build
```

These are real `package.json` scripts and were **not run** during this documentation change. The Dockerfile pins Node 22 Alpine and runs Prisma client generation plus Next.js build. The runtime image is non-root and includes the entrypoint. `entrypoint.sh` runs bounded idempotent `prisma migrate deploy` when not explicitly skipped, then starts web or worker process. Treat migration changes as separately reviewed production operations.

## Compose services

| Service | Deployment intent |
|---|---|
| `postgres` | Single PostgreSQL 16 database with persistent volume |
| `web` | Next.js UI and API, private internal port 3000 |
| `worker` | Maildir scan, ingestion, heartbeat and retention tasks |
| `dovecot` | Opt-in mailserver profile, LMTP delivery to Maildir |
| `postfix` | Opt-in mailserver profile, receive-only SMTP with PostgreSQL virtual recipient checks |
| `dkim-provisioner` | Opt-in DKIM profile, isolated key provisioning |
| `postfix-db-credential` | Opt-in setup helper for DB lookup identity |

`docker-compose.yml` defaults published SMTP bind to **`127.0.0.1`**; production override to a public address requires independent mail/DNS/firewall/TLS approval. The HTTPS reverse proxy is an external host/infrastructure concern, not automatically issued by the QIS installer.

## Safe host update (approved hosts only)

`scripts/install/readbox-update.sh` checks clean Git, approved remote, Age public recipient, lock, recovery helper image and Compose config. It fetches an exact optional pinned target, refuses non-fast-forward history, takes a consistent encrypted snapshot, runs `git merge --ff-only`, rebuilds `postgres web worker`, and verifies health. On failure after migrations, it **retains backup and refuses automatic destructive Git rollback**. Read `docs/ADMIN-SYSTEM-UPDATE.md` for the separate admin update bridge. The legacy archive updater `scripts/updater/upgrade.sh` is not the Docker host update path.

## Releases and CI

`.github/workflows/r06-production-readiness.yml` is named **CI only, NO release** and independently enforces the formal NO-GO gate; `readbox-first-release.yml` allows only a guarded **prerelease candidate** manifest, explicitly no image/deploy, not v1.0.0 stable production. Other CI files have narrow branch/file/actor restrictions and are not general evidence of production acceptance. The root `package.json` version remains `0.1.0` in this source. **Do not publish a stable release or production-approved statement** until independent `RG-01..RG-17` signoff.

## Rollback rules

Encrypted snapshot existence is not a successful disaster recovery rehearsal. For a failed update, stop, capture sanitized errors, and use a separately authorized isolated recovery plan. Never run `docker compose down -v`, reinitialize PostgreSQL or delete private mail volume to “reset” an installation.

**Evidence:** `Dockerfile`, `docker-compose.yml`, `entrypoint.sh`, `scripts/install/{readbox-install,readbox-update}.sh`, `.github/workflows/{r06-production-readiness,readbox-first-release}.yml`.
