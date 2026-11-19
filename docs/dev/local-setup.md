# Local development environment

**Do not connect test tasks to production PostgreSQL, customer Maildir or R2.** Use a disposable local database and separate mock/test fixtures.

## Stack and prerequisites

`package.json`: Node `>=22.12.0`, Next.js `16.4.5`, React `19.3.0`, TypeScript, Prisma 7 and PostgreSQL. Docker Compose is used for the dev database. Use the source-tracked lockfile.

```bash
npm ci
npm run db:up
npm run db:generate
npm run db:validate
npm run dev
```

These are **declared repository scripts**, not commands executed in this documentation audit. The `db:up` script starts the `postgres` service in `compose.dev.yaml`. Configure a **local PostgreSQL `DATABASE_URL`** appropriate to that service in your private development environment; do not copy production credentials. Run `npm run db:migrate` only after verifying the intended target database.

## Useful declared commands

| Command | Actual package script behavior |
|---|---|
| `npm run dev` | `next dev -p 3000 -H 0.0.0.0` |
| `npm run build` | `next build` |
| `npm run typecheck` | `next typegen && tsc --noEmit` |
| `npm run lint` | `eslint .` |
| `npm run db:up` / `db:down` | Start/stop the dev PostgreSQL Compose service |
| `npm run db:validate` / `db:status` | Prisma schema/migration checks |
| `npm run test:unit` | Combined source unit/contract suites |
| `npm run test:ui` | Vitest UI suite |
| `npm run test:postgres` | PostgreSQL integration script: only with an explicitly isolated target |
| `npm run verify:safe` | Repository safe verification script |

**Important:** `AUTH_ENABLED=false` is a fail-closed default; protected workspaces do **not** become anonymous in development. The development-only `DEV_AUTH_MODE` settings have explicit runtime guards; do not enable development bypass in production.

## Before proposing changes

Read `AGENTS.md`. Use one tight Scope Lock, one focused verification pass and one exact patch/security audit. Review the existing 17-gate production release policy before proposing tags or deployments. This documentation audit did **not** run npm, migration, Docker or live SMTP tests.

**Evidence:** `package.json`, `compose.dev.yaml`, `.env.example`, `src/config/env-schema.ts`, `src/auth.ts`, `AGENTS.md`.
