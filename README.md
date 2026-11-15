# MailStack

> **Authoritative database policy:** ReadBox uses exactly one PostgreSQL database for all application and database-backed mail-server management data. Prisma remains the application ORM. Any future Postfix/Dovecot database integration must use this same PostgreSQL database, with separate schemas and least-privilege roles where supported, after installed versions, configuration, schema, and lookup contract are verified. Do not add or connect MariaDB, MySQL, SQLite, or a second database. Maildir and message/attachment files remain on the filesystem. Any legacy multi-database descriptions below are historical/source context only and are superseded as target architecture.

Node.js foundation for the MailStack rebuild. The reference implementation under `reference/MailStack/` is read-only. A development/test authentication foundation exists, but production authentication, mailbox operations, mail processing, and production service connections are not ready. This project is not ready for real-VPS installation or production validation.

## Requirements

- Node.js 22.12 or newer
- npm 10 or newer
- PostgreSQL is not required to start the development UI or validate/generate the Prisma client

## Development

```powershell
npm.cmd install
npm.cmd run dev
```

Open `http://localhost:3000`. Authentication defaults to disabled; when enabled in development/test, workspace routes use server-side session checks and admin routes require `AdministratorProfile`. The operator CLI refuses the forbidden `mailstack_dev` database. The workspace screens remain incomplete and this is not a production-ready application.

## PostgreSQL and Prisma

Copy `.env.example` to `.env.local` for local settings. Prisma CLI loads `.env.local` and `.env`, uses the local-only fallback URL if neither defines `DATABASE_URL`, and rejects non-loopback database hosts. The fallback targets `mailstack_dev`, which must not be used for migration or test verification. The runtime database client requires `DATABASE_URL` to be configured.

```powershell
npm.cmd run db:up
npm.cmd run db:validate
npm.cmd run db:generate
npm.cmd run db:migrate
npm.cmd run db:status
```

`db:up` starts PostgreSQL 16.14 bound to `127.0.0.1` with persistent named storage. `db:down` stops the Compose service without deleting its volume. `db:migrate` and `db:status` use the resolved Prisma database URL; run them only after explicitly configuring and verifying a permitted target. Never run them against `mailstack_dev` or production. No fresh disposable integration-test target is currently verified; Phase 6.4 results apply only to the removed test container. See [Prisma foundation](prisma/README.md) and [core module map](src/core/README.md).

## Checks

```powershell
npm.cmd test
npm.cmd run test:ui
npm.cmd run verify:safe
npm.cmd run lint
npm.cmd exec -- tsc --noEmit
npm.cmd run db:validate
```

`npm.cmd test` and `npm.cmd run verify:safe` are database-independent and do not build or write to `.next`. `npm.cmd run test:ui` runs the UI component suite; passing it does not establish browser-level responsive, visual-theme, or PWA acceptance. `npm.cmd run test:auth` includes route-guard tests but not PostgreSQL tests. Setup UI/API and API integration tests are not available because the setup UI/API is not implemented.

### Isolated PostgreSQL Integration Tests

PostgreSQL integration is opt-in and requires Docker Desktop. Never use `mailstack_dev` or production. Create an ignored `.env.test.local` containing all three values below; choose a fresh 32-character lowercase hexadecimal suffix and a high-entropy URL-safe password. Use that same password in the URL, and do not print, commit, or share the file:

```dotenv
AUTH_TEST_DATABASE_NAME=readbox_auth_test_<32-lowercase-hex-characters>
AUTH_TEST_POSTGRES_PASSWORD=<high-entropy-url-safe-password>
AUTH_TEST_DATABASE_URL=postgresql://readbox_test:<same-password>@127.0.0.1:55432/readbox_auth_test_<same-suffix>?schema=public
```

Before creating anything, inspect Docker for an existing `readbox-auth-test` project/container. Do not stop or replace an existing container without confirming it is this disposable test service. For a fresh run, explicitly start only the profile service, run the integration command, then remove only that Compose project:

```powershell
docker compose --env-file .env.test.local -p readbox-auth-test --profile integration up -d --wait postgres-test
npm.cmd run test:postgres
docker rm --force readbox-auth-test-postgres-test-1
```

The profile binds only `127.0.0.1:55432` and stores PostgreSQL data in container tmpfs, not a persistent volume. The integration runner independently checks the exact project/service, repository working directory, sole `compose.yaml` config (no overrides), image, labels, tmpfs mount, loopback port, configured database/user/password, actual PostgreSQL identity, and empty schema before applying migrations. It never falls back to `DATABASE_URL`; an absent or mismatched target aborts before migration. It applies migrations twice to check repeat-run safety, then runs synthetic integration tests. Each run needs a fresh empty tmpfs container; do not reuse a populated test database. Dispose of only the explicitly created `readbox-auth-test-postgres-test-1` container with the exact `docker rm --force` command above; do not remove volumes or use project-wide cleanup. Phase 6.4 passed migration deployment twice and 3/3 PostgreSQL integration tests; its record says `.env.test.local` was retained as an ignored reproduction setting at that time. Its current presence and ignore status are unverified.

### Phase 6.4 Local Verification

The supported development server ran at `http://127.0.0.1:3101` with authentication disabled and no application `DATABASE_URL`. HTTP checks returned `/` 307 to `/users`, `/sign-in` 200 with the disabled-auth message, `/users` and `/vcon` 307 to `/sign-in`, `/api/auth/session` and `/api/auth/providers` 200, and nonexistent `/api/setup/status` 404. These were HTTP checks, not authenticated browser flows. Browser automation reload timed out; the captured page showed a transient Next rendering overlay, so visual browser verification remains inconclusive. The current status of that historical development server is not asserted here.

All shared styling is defined in `src/app/globals.css`. The PWA service worker caches only versioned static resources and a generic offline page; mailbox data and API responses are never cached.

### Latest UI QA — 2026-10-19

The following are results from the latest reported run; they were not rerun for this documentation update.

- Component-independent tests: 87/87 passed. UI suite: 21/21 passed. Focused reduced-motion, manifest, and service-worker tests: 7/7 passed.
- Lint passed; `npm.cmd exec -- tsc --noEmit` completed without diagnostics; `git diff --check` exited 0 with existing line-ending warnings.
- Automated coverage includes theme-toggle keyboard activation, light-theme muted-text contrast, drawer focus/breakpoint behavior, and the reduced-motion CSS contract.
- Chrome headless captured the sign-in page at 320px, 768px, and 1280px. At 320px, sign-in content visibly clipped horizontally. The 768px and 1280px sign-in captures appeared contained, but this is partial evidence only. The reset-password page and protected workspace UI were not verified.
- An isolated Chrome fixture using the repository reduced-motion CSS matched `prefers-reduced-motion: reduce` and showed the expected computed scrolling, animation, and transition overrides. This does not verify app-level rendering or live preference changes.
- `/manifest.webmanifest` returned HTTP 200. Production-mode service-worker registration and PWA installability were not verified.

**Pending:** inspect/fix the sign-in 320px clipping and inspect reset-password layout; complete responsive acceptance; verify light-theme appearance, app-level reduced motion, production service-worker registration, and PWA installability. Phase 8 and approval-gated authentication, persistence, installer, and security work remain blocked and out of scope.
