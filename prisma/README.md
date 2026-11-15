# Prisma Foundation

> **Authoritative database policy:** This application uses one PostgreSQL database only. Prisma is the application ORM. Mail-server management data, if integrated later, must use this same database under separate schemas and least-privilege roles where supported. MariaDB, MySQL, SQLite, and second databases are prohibited. Maildir/message/attachment bytes remain on the filesystem.

The Prisma 7 client and PostgreSQL datasource are configured. The initial application schema and its reviewed PostgreSQL constraints are in `schema.prisma` and `migrations/20261017000000_initial_application_schema/migration.sql`. `migrations/20261018120000_administrator_profiles/migration.sql` adds the dedicated administrator-profile table, unique user relationship, and cascading foreign key without backfilling or rewriting existing users. Both migration artifacts were applied twice successfully to the fresh Phase 6.4 disposable PostgreSQL target. That tmpfs container was removed after verification; no other database was queried, so the applied state of existing databases remains unknown.

- `npm run db:validate` validates the schema/configuration without contacting PostgreSQL.
- `npm run db:generate` generates the local client and does not run migrations.
- `npm run db:up` starts PostgreSQL 16.14 on loopback with a persistent named volume; its configured development database is forbidden for this verification task.
- `npm run db:migrate` applies checked-in migrations to the database resolved by Prisma configuration; `npm run db:status` queries that target. Use neither without explicitly verifying an approved disposable target.
- `npm run db:down` stops the local service without deleting its volume.
- `npm run test:compat` runs read-only original-source contracts and PostgreSQL schema assertions; it does not start Django or connect to any database.
- The Phase 6.4 record reports ignored synthetic test settings retained after the run, but their present existence/configuration is not established here. The disposable container was removed; no fresh disposable target is currently verified. The guarded runtime suite passed 3/3 historically; reruns require a separately authorized, freshly verified profile target. The local fallback is not authorization to connect to or migrate `mailstack_dev`. `db:validate`, `test:compat`, and `db:generate` do not connect to PostgreSQL.

## Test Workflow

- `npm.cmd test` runs the default database-independent suites: compatibility/static schema checks, mock Postfix adapter tests, setup authorization/lifecycle tests, auth/session/route-guard tests, and PostgreSQL-target guard unit tests. It never runs the database integration file.
- `npm.cmd run verify:safe` runs the default suites, `tsc --noEmit`, ESLint, and Prisma validation without invoking Next type generation or a build.
- `npm.cmd run test:auth` includes synthetic auth/session and mocked route-guard coverage. PostgreSQL bootstrap, migration application, real constraints, transaction rollback, and advisory-lock concurrency are separate integration-only checks.
- `npm.cmd run test:postgres` is explicit and fail-closed. It requires an operator-started `postgres-test` service from the `integration` Compose profile and all three `AUTH_TEST_*` variables in ignored `.env.test.local`. It verifies the exact repository Compose project/service/config (one file, no overrides), image, tmpfs storage, loopback port, and configured DB/user/password; it then checks server identity and emptiness before applying migrations twice and running `tests/auth/database-flow.test.ts`. It does not start or stop Docker services. Phase 6.4 runtime result: migrations succeeded twice and the integration file passed 3/3, 0 skipped.

For isolated setup and cleanup commands, see [the root README test workflow](../README.md#isolated-postgresql-integration-tests). The service uses a dedicated Compose project, loopback-only port `55432`, and tmpfs data. Dispose only of the exact newly created test container; do not use project-wide teardown or remove volumes. Do not reuse the normal app `DATABASE_URL`.

## Current Test Inventory and Gaps

- **Database-independent:** `tests/compatibility`, `tests/postfix`, `tests/schema` static checks, `tests/setup`, auth/password/session units, route-policy and mocked guard tests, plus target-guard tests. Static SQL assertions verify source text only, not PostgreSQL execution.
- **Isolated PostgreSQL required:** clean migration application; actual unique/FK behavior; identity/profile and session behavior; concurrent bootstrap; transaction rollback. These are implemented in `tests/auth/database-flow.test.ts` and passed 3/3 against the Phase 6.4 disposable PostgreSQL target. Future changes still require rerunning against a fresh isolated target.
- **Approved external service required:** real Postfix/Dovecot compatibility, delivery, and service-readiness tests. No supported service contract or test service exists.
- **Not currently testable:** Guided Setup API/UI validation, CSRF, rate limits, wizard navigation/retry, and persistent lifecycle behavior; these application surfaces do not exist. Keep these as future acceptance criteria rather than tests of fake endpoints.

The current `npm.cmd run verify:safe` result is documented in [Implementation Roadmap](../docs/IMPLEMENTATION-ROADMAP.md). Phase 6.4 migration/runtime success applies only to its removed disposable tmpfs target; it does not establish present test-target availability, current service availability, or the applied state of any other database. Reruns require separate authorization and a fresh, explicitly verified disposable PostgreSQL target.
