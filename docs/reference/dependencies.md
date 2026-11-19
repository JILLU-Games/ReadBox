# ReadBox Dependency and Runtime Inventory

This inventory is drawn from **active** `package.json`, `Dockerfile`, `docker-compose.yml`, `deployment/backup-agent/requirements.lock` and source imports. A declared `^...` range is **not** a claim that a specific resolved build was installed on every host; consult `package-lock.json` and image digests for exact builds.

## Frameworks and runtime

| Dependency / runtime | Declared value | Actual role |
|---|---|---|
| Node.js | `>=22.12.0`; Docker uses Node 22 Alpine | Next.js server and worker runtime |
| Next.js | `16.4.5` | App Router, pages, route handlers, server actions |
| React / react-dom | `19.3.0` | Interactive UI |
| TypeScript | `^5.0.0` (dev) | Type and code checking |
| Prisma and `@prisma/client` | `^7.10.1` | PostgreSQL migrations/ORM |
| `@prisma/adapter-pg`, `pg` | `^7.10.1`, `^8.23.1` | Database driver/Prisma adapter |
| `next-auth` | `^5.0.0-beta.32` | Credentials sessions and auth |
| `@node-rs/argon2` | `^2.2.2` | Password hashing |
| `zod` | `^4.6.7` | Input and environment validation |
| `postal-mime` | `^4.2.1` | Message MIME parsing |
| `sanitize-html`, `css-tree` | `^2.18.2`, `^3.2.1` | Sanitization of inbound HTML/CSS |
| `proper-lockfile` | `^4.1.2` | Maildir/worker filesystem locks |
| Radix UI / `lucide-react` / `next-themes` / Tailwind | See `package.json` | Accessible UI, icons, theme/style |
| `vitest`, `@testing-library/react` | Dev dependencies | UI and integration testing |
| ESLint | Dev dependency | Lint/static quality |

## System services

| Service | Current implementation |
|---|---|
| PostgreSQL 16 | One database; Compose example uses `postgres:16.14-alpine` |
| Postfix | Receive-only SMTP and same-DB PostgreSQL lookup views |
| Dovecot | LMTP recipient delivery into persistent Maildir |
| Docker Engine + Compose v2 | App, mailserver and DKIM host runtime |
| Python 3 | Root-only backup agent and host recovery/updater helpers |
| Age | Encrypted local/offsite snapshots and custodied recovery identity |
| Cloudflare R2 | Optional encrypted backup object storage with remote digest verification |
| Cloudflare DNS API | Optional, scoped automatic domain record publication |
| GitHub Actions | Disposable source/CI gates and restricted candidate release flow |

The optional historical `reference/MailStack/` contains Django/Python/MariaDB artifacts but is **not an active ReadBox runtime dependency**. Do not confuse a compatibility/mock test or checked-in migration plan with production deployment.

## Data placement

PostgreSQL contains application and mailserver management records; Maildir holds original received messages; named persistent volumes hold attachments, media, keys and service state. The private key escrow and R2 credentials are isolated from web outputs. See [Architecture](../dev/architecture.md), [Security](../dev/security.md), and [Database](../dev/database-schema.md).

**Evidence limits:** No new `npm ci`, dependency audit, image rebuild or real R2 network check was executed by this documentation authoring phase. Historic CI and operator evidence are summarized separately in [coverage report](coverage-and-verification.md).
