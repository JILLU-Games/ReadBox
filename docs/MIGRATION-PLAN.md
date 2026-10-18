# MailStack Node.js Migration Plan

> **Authoritative database policy:** ReadBox uses exactly one PostgreSQL database for all application and database-backed mail-server management data. Prisma remains the application ORM. Any future Postfix/Dovecot database integration must use this same PostgreSQL database, with separate schemas and least-privilege roles where supported, after installed versions, configuration, schema, and lookup contract are verified. Do not add or connect MariaDB, MySQL, SQLite, or a second database. Maildir and message/attachment files remain on the filesystem. Any legacy multi-database descriptions below are historical/source context only and are superseded as target architecture.

## Goal and Guardrails

Replace the Django/Python application layer with Next.js App Router, TypeScript, PostgreSQL and Prisma while preserving verified product behavior and the existing mail-server infrastructure. This is the implementation blueprint following Phase 2 audit verification. No application code, schema, installer or source files under `reference/MailStack/` have been changed. Coding starts only after explicit approval.

The original Maildir remains authoritative. Postfix/Dovecot are not being replaced. The existing mail-server MariaDB schema and Postfix views remain in place; PostgreSQL is the target application database. `reference/MailStack/` stays read-only through all implementation phases.

**Status and authorization:** Phase 4 Prisma schema and initial SQL are complete; the isolated PostgreSQL 16.14 Phase 4.1 schema-only rehearsal passed; and Phase 4.2 risk/rehearsal planning is complete. No source-data migration or source-data rehearsal has been performed, and no importer implementation or data-import command has been established. Production access, production migration, cutover, and Phase 5 remain unapproved. During rehearsal, source sessions must never be inspected, counted, inventoried, copied, exported, invalidated, or imported; source password hashes must never be accessed or inspected. Password verification uses synthetic Django-generated hashes only. PostgreSQL `lower()` is not full Unicode casefold (`Straße` and `STRASSE` remain distinct under the tested behavior). Production collation, ID ranges, password compatibility, sessions, backup/restore, and rollback remain untested.

## Phase 0: Baseline and Decisions

## Implementation Stage 0: Baseline and Decisions

- [ ] Record the exact upstream release tag, commit/tree identity, archive checksum and version used as migration baseline.
- [ ] Reconcile source documentation that currently contains older release/phase references against `VERSION` and `pyproject.toml`.
- [ ] Record named, approved parity decisions for mailbox deletion, `rebuild_missing`, contact-service persistence, and update worker language. Future production password preservation/reset and cutover session policy are undecided and require separate named, recorded security/identity approval.
- [ ] No production inventory is authorized now. Any future source/production inventory, backup, restore, or data access requires separate named, recorded data-owner and security approval and all applicable fixture, isolation, no-egress, and artifact gates. Rehearsal excludes source sessions and password hashes.
- [ ] No live-deployment inspection is authorized now. Any future DNS, Postfix/Dovecot/Nginx/systemd contract inventory requires separate named, recorded operations/security approval and all applicable access controls; record only approved values outside this workspace.

**Acceptance:** signed-off baseline manifest and behavior-decision record; no source files changed; no undocumented production values copied into source.

## Phase 1: Compatibility Contract and Test Fixtures

## Implementation Stage 1: Compatibility Contract and Test Fixtures

- [ ] Convert the original route and feature inventory in [FEATURE-PARITY.md](FEATURE-PARITY.md) into executable user, authorization, mail-flow, parser, storage, contact and operations scenarios.
- [ ] Only after separate named, recorded data-owner and security approval and all fixture provenance/sanitization, isolation/no-egress, and artifact-retention/deletion gates are satisfied, create synthetic `.eml` fixtures covering multipart text/HTML, inline and regular attachments, malformed headers/MIME, encoded headers, absent dates, oversized messages and unsafe HTML/CSS. No fixtures are authorized now.
- [ ] Use generated synthetic IDs, UUIDs, normalized values, timestamps, and attachment hashes for tests. Do not retrieve or record backup-derived values. Any future source-derived fixture requires separate named, recorded data-owner/security approval and all fixture, isolation, no-egress, and artifact gates before creation.
- [ ] Capture existing Nginx/systemd/DB grants/Postfix/Dovecot expected contracts as contract tests.
- [ ] Define compatibility tests using synthetic Django-generated Argon2 hashes only. Never access or inspect source password hashes. Preservation versus forced reset is a separate future production policy requiring security/identity approval.

**Acceptance:** test plan covers every unchecked parity item; any future fixture is created only after the mandatory named approvals and safety gates; fixture data is synthetic or approved/sanitized; expected API statuses, access results, counters and mail-server rows are documented. No fixture creation is authorized now.

## Runtime and Toolchain Replacement Inventory

The installer deploys `mailbox-app/requirements/production.txt`, which includes `requirements/locked.txt`; the separate public-contact environment installs `public-site/requirements.txt`. Development CI uses `mailbox-app/requirements/development.txt` plus `constraints.txt`. `pyproject.toml` is another dependency/build manifest. Keep these scopes distinct during migration.

Any password-verifier compatibility assessment described below is synthetic-only: use synthetic Django-generated hashes and never access or inspect source password hashes. Future production password preservation versus reset remains undecided and unapproved.

| Existing Python package/runtime                 | Use in source                                                                                                           | Node replacement / disposition                                                                                                                                                   |
| ----------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| CPython 3.12, pip/venv                          | Django application, contact service, updater and deployment tooling                                                     | Pin supported Node.js LTS + package manager for deployed services; use lockfile and systemd. Repository tooling may remain temporarily or move as its own workstream.            |
| Django 5.2.17                                   | App routing, request lifecycle, forms, auth, sessions, ORM, migrations, middleware, static/template integration and CLI | Next.js App Router + TypeScript service layer; Prisma/PostgreSQL; explicit session/CSRF/auth services; Node CLIs.                                                                |
| argon2-cffi 25.1.0 (+ bindings)                 | Password hash verify/create                                                                                             | Maintained Node Argon2 binding only after proving Django encoded-hash compatibility; otherwise approved password reset.                                                          |
| bleach 6.4.0 + tinycss2 1.5.1                   | HTML and CSS sanitization of received email                                                                             | Maintained HTML sanitizer + CSS parser/AST with project-owned policy wrapper and original-fixture differential tests. Do not substitute a default preset.                        |
| filelock 3.20.3                                 | Cross-process mailbox provisioning and ingestion exclusion                                                              | Reviewed cross-process lock (`proper-lockfile` or controlled OS `flock` adapter) with symlink/permission/timeout tests.                                                          |
| gunicorn 25.1.0 (app)                           | WSGI Django service over Unix socket                                                                                    | Next.js Node server under systemd; Nginx remains reverse proxy.                                                                                                                  |
| gunicorn 25.1.0 (contact)                       | Separate WSGI contact service, 2 workers/2 threads, Unix socket                                                         | Separate Node contact service over Unix socket; maintain process identity, request bounds, graceful stop and restart limits.                                                     |
| mysqlclient 2.2.7                               | Django connection to app and mail MariaDB schemas                                                                       | Prisma PostgreSQL for app data; dedicated MariaDB client such as `mysql2` only for existing mail-server contract. Separate credentials/roles; no cross-store transaction claims. |
| python-dotenv 1.2.2                             | Reads root-protected app environment file                                                                               | systemd `EnvironmentFile` injection plus validated `src/config/`; no unsafe shell-env parsing.                                                                                   |
| whitenoise 6.11.0                               | Django static serving/compression                                                                                       | Next static build and existing Nginx static/cache policy; private media/attachments are not public static content.                                                               |
| setuptools >=75, wheel                          | Python package build metadata                                                                                           | npm/pnpm scripts, Node build output and lockfile; remove Python packaging from deployed app after runtime scripts are ported.                                                    |
| pytest 9.1.1, pytest-django 4.12.0              | Python app test harness                                                                                                 | Vitest for unit/integration with disposable PostgreSQL/MariaDB fixtures; preserve behavioral cases.                                                                              |
| pytest-cov 7.0.0, coverage 7.13.3               | Coverage enforcement                                                                                                    | V8 coverage (`@vitest/coverage-v8` or equivalent) with agreed thresholds and critical branch coverage.                                                                           |
| Ruff 0.15.17                                    | Python lint/import/style checks                                                                                         | ESLint + TypeScript typecheck; configured formatter without source-behavior changes.                                                                                             |
| Bandit 1.9.4                                    | Python security static checks                                                                                           | Node-aware SAST in CI plus security tests; dependency auditing alone is not a SAST replacement.                                                                                  |
| pip-audit 2.10.0                                | Python dependency advisory scan                                                                                         | `npm audit` and/or OSV scanner on locked production/development dependency graphs.                                                                                               |
| Python standard library in contact app          | SQLite, HTTP WSGI, JSON, HMAC, rate limiting, MIME construction, subprocess                                             | Node HTTP + SQLite adapter + crypto APIs + fixed-argument sendmail invocation; preserve contact isolation and semantics.                                                         |
| Python stdlib scripts in `mailbox-app/scripts/` | Root updater worker, archive/release manifest verification; shell-invoked deployment helpers                            | Root updater and deployed verifiers move to Node or remain explicitly scoped operations tools until ported.                                                                      |
| Python stdlib scripts in repository `scripts/`  | Forensic inventory, docs/design, static-site rendering, versioning, release and QA gates                                | Node CLIs if repository-wide Python removal is required. Not deployed app runtime; port separately to avoid expanding the mail application migration without approval.           |

Python transitive pins in `requirements/locked.txt` (`asgiref`, `cffi`, `packaging`, `pycparser`, `sqlparse`, `webencodings`, Argon2 bindings) disappear with their parent frameworks/libraries; they are not independent Node features. Contact code imports Python standard-library modules only, with Gunicorn as its third-party server.

**Manifest note:** `tinycss2` is declared in `pyproject.toml` and `requirements/locked.txt` (included by deployed `requirements/production.txt`), but omitted from `requirements/base.txt`. The installer route is covered; duplicate manifests can drift. The Node lockfile should be the package authority.

## PostgreSQL Data Migration and Rollback Contract

1. Freeze the exact source release/tag as a future planning requirement. Any source backup requires separate named, recorded data-owner and security approval and all applicable safety gates; backup creation/access is not authorized now and is not part of rehearsal. Any approved fixture excludes `django_session` and the source password column. Keep the existing mail-server MariaDB schema and Postfix views out of the PostgreSQL import.
2. Any future source schema/table/count/reference/ID inventory requires separate named, recorded data-owner and security approval and all applicable safety gates. Rehearsal must not inspect, count, copy, export, invalidate, or import source sessions, or access/inspect source password hashes. Classify any approved framework tables as migrate, transform, or intentionally exclude; no inventory is authorized now.
3. Specify future importer behavior for explicit IDs and sequence resets, including empty tables. This is a design requirement only: do not execute sequence reset or next-generated-ID tests against a sanitized-source fixture; run those tests only in an isolated synthetic database.
4. Exclude source password hashes and sessions from fixtures and rehearsals; never access or inspect source hashes or sessions. Test candidate password verification only with synthetic Django-generated hashes. Any future production password-preservation-versus-reset or cutover session policy is undecided and requires separate named, recorded security/identity approval.
5. Preserve case-insensitive behavior with normalized values and reviewed functional unique indexes/collation rules; preflight case-only and Unicode-normalization collisions.
6. Future comparison of attachment paths/hashes/sizes or Maildir contents requires separate named, recorded approval and all applicable safety gates; comparisons remain inside isolation. No such source/file access is authorized now. Any future approved importer must not mutate Maildir.
7. Specify a repeatable, checkpointed importer with failure-safe transactions; this is not permission to implement or run it. Keep detailed reconciliation inside the isolated environment; export only security-approved aggregates, with no row-level digests, identifiers, or sensitive comparison results. Do not dual-write the same app rows to MariaDB and PostgreSQL: the stores cannot commit atomically.
8. Preserve contact `contact.sqlite3` state and its separate service by default. Contact-to-PostgreSQL consolidation needs explicit product/security approval.

Before any isolated data rehearsal, satisfy the mandatory named data-owner/security approvals, fixture rejection rules, enforced production disconnection and no-egress verification, and artifact retention/deletion evidence in `DATA-MIGRATION-REHEARSAL-PLAN.md`. Follow its proposed batch transaction/restart contract, synthetic-only sequence tests, redacted reconciliation rules, and explicit PASS/FAIL criteria. This cross-reference does not authorize production access, fixture creation, importer implementation, source-session handling, production migration/cutover, or Phase 5.

Rollback is not a simple Nginx switch. The following is future rollback planning only, not authorization. Any source/production snapshot, backup, restore, data access, or cutover requires separate named, recorded data-owner and security approval and all applicable safety gates. Never restore an old Maildir/database over newly accepted email; any future rollback design must account for intervening writes and mail arrivals. No rollback or cutover operation is authorized now.

**Future production migration/cutover acceptance (not authorized):** exact row counts/FK mapping, zero unexplained JSON or approved non-credential file/content-hash deltas, counters consistent, fresh mail accepted while the app is paused, and a rehearsed post-write rollback retaining both app mutations and Maildir arrivals. Perform detailed comparisons only inside isolation; export only security-approved aggregates. These are future criteria, not authorization. Any future production access/cutover, password policy, or session policy requires separate named, recorded approval. Production migration and Phase 5 remain unapproved.

## Phase 2: PostgreSQL Schema and Data-Migration Design

## Implementation Stage 2: PostgreSQL Schema and Data-Migration Design

Field-by-field source mapping, target-only session semantics, custom PostgreSQL constraints and open framework-table inventory are recorded in [POSTGRESQL-DATA-MODEL.md](POSTGRESQL-DATA-MODEL.md). The generated initial SQL is not applied in this phase.

- [ ] Model confirmed application entities in Prisma: user/auth representation, access policy, login attempts, domain, mailbox, membership, message, attachment metadata, audit, heartbeat and site settings.
- [ ] Map `JSONField` data to JSONB; preserve UTC/time-zone semantics, booleans, unsigned numeric bounds and nullable fields.
- [ ] Specify preservation of UUIDs and approved numeric IDs, FK import order, and future sequence reset handling after explicit-ID inserts. Do not execute sequence resets or next-generated-ID tests against a source fixture; test only in an isolated synthetic database.
- [ ] Recreate case-insensitive uniqueness. MariaDB currently uses `utf8mb4_unicode_ci` and explicit `Lower(...)` constraints; PostgreSQL defaults are case-sensitive. Define normalized values/collations or functional unique indexes and test case/Unicode edge cases.
- [ ] Preserve check constraints/status values, indexes for mailbox/message queries, unique `(mailbox_id, source_file_key)`, and deletion actor relations.
- [ ] Decide treatment of Django `auth_group`, permissions, content types and admin/migration tables. Do not inspect, count, copy or import source sessions during rehearsal; keep target sessions empty. Any future cutover session policy requires separate approval.
- [ ] Do not migrate Postfix/Dovecot's `mail_domains`, `mailboxes`, `mail_aliases`, or lookup views into PostgreSQL. They remain in MariaDB and continue serving Postfix.
- [ ] Do not implicitly migrate contact SQLite data into the app schema. If approved, define a separate contact schema/role, migration and data-retention rules.

**Acceptance:** Prisma schema and SQL migration are reviewed against statically inspected source models/relationships; automated schema tests verify indexes, uniqueness, constraints and FK behavior; password verification tests use synthetic Django-generated hashes only. This acceptance does not authorize source-data access, source-hash handling, or import.

## Phase 3: Infrastructure Adapters and Workers

## Implementation Stage 3: Infrastructure Adapters and Workers

- [ ] Build an isolated MariaDB adapter with a dedicated configuration/credential and exact least-privilege grants for current operations: read domain/mailbox/alias contracts, create mailbox rows, and update active status; never read stored mailbox password hashes or grant Postfix writes.
- [ ] Keep Postfix querying the same MariaDB `postfix_virtual_*` views. Prove a Node-created/enabled/disabled recipient produces the same map lookup and LMTP route as the original.
- [ ] Build mailbox provisioning as a locked, idempotent cross-resource workflow with explicit compensation/reconciliation for PostgreSQL, MariaDB and Maildir operations.
- [ ] Implement a separately supervised Node Maildir worker: safe directory traversal, no symlink following, exclusive lock, stable relative source key/hash, idempotency, size limits, parse status, attachments, counter updates, heartbeats, graceful shutdown and restart recovery.
- [ ] Port MIME/sanitizer behavior with a reviewed, pinned parser/sanitizer dependency and differential fixture tests. Do not reduce allowlists or safety budgets to simplify migration.
- [ ] Implement dedicated contact service and updater worker without granting ordinary web requests filesystem/root privileges. Preserve current process/socket/systemd boundaries.

**Acceptance:** unit/integration tests prove cross-database provisioning recovery, duplicate-safe worker restart, late deliveries, attachment path confinement, sanitizer differential parity, contact CSRF/rate limits and updater request validation. Existing Postfix/Dovecot config diffs are limited to approved app-independent service wiring.

## Phase 4: Auth, User/Admin UI, and Feature Routes

## Implementation Stage 4: Auth, User/Admin UI, and Feature Routes

- [ ] Add Next App Router pages and TypeScript service layer; preserve existing user-facing paths or document and approve redirects before changing them.
- [ ] Implement session, login throttling, CSRF, active-user checks, admin role, object-scoped mailbox/message access and deletion grants before rendering or mutating data.
- [ ] Split user modules under `src/users/` and admin modules under `src/vcon/`; share UI primitives and design tokens. Keep the existing public static website unless a redesign/replatform is explicitly approved.
- [ ] Implement existing dashboard, site settings, domain/mailbox/user management, inbox, message reader, live update, health and updater operations.
- [ ] Match error/404 behavior without leaking whether inaccessible mailboxes/messages/attachments exist.

**Acceptance:** route-level tests cover unauthenticated, user, mailbox member, non-member and admin roles; every current route family has a test for success, validation, forbidden/404 and CSRF where applicable; browser workflows work on mobile and desktop without weakening design/security contracts.

## Phase 5: Installer and Operations Migration

This phase is future planning only and remains unapproved. No installer, operations, backup/restore, or production changes are authorized.

## Implementation Stage 5: Installer and Operations Migration

- [ ] Adapt installer plan/install/repair to provision PostgreSQL and Node runtime while retaining existing MariaDB mail-server schema, user grants, Postfix, Dovecot, Maildir, Nginx TLS, systemd and service identities.
- [ ] Replace Django/Gunicorn units and management-command invocations with Node app/worker entry points; preserve separate unit limits, users, mounts, umasks, restart policies and filesystem write allowlists.
- [ ] Update health/readiness, deploy, backup, restore, verification, upgrade and rollback scripts to include PostgreSQL dumps/restores and the existing MariaDB mail schema plus Maildir, attachments, contact state, configuration and checksums.
- [ ] Preserve safe archive validation, release checksum/manifest checks, pre-upgrade snapshot and the rule that schema migrations prohibit blind automatic rollback.
- [ ] Keep TLS private keys and any host disaster-recovery material outside the ordinary application backup per the current operator contract; document separately secured handling.

**Acceptance:** clean Ubuntu 24.04 install/repair on an isolated host; backup checksum validation; restore to a clean test host; no lost Maildir messages/attachments; health and contract scripts pass; restart/reboot recovers every managed service.

## Phase 6: Shadow Rehearsal and Parity Qualification

## Implementation Stage 6: Shadow Rehearsal and Parity Qualification

- [ ] Only after separate named, recorded data-owner and security approval and verified fixture provenance/sanitization, enforced production disconnection, tested outbound network denial, and approved artifact retention/deletion controls, use an approved sanitized fixture in isolation. Exclude source password hashes and `django_session`; never inspect, count, inventory, copy, export, invalidate, or import source sessions or access/inspect source hashes. Reject the fixture and stop immediately if prohibited content is found.
- [ ] Compare approved source/target row counts by table and key relationships; compare user roles, mailbox membership, visible/deleted message counts, counters, approved attachment hashes and audit ordering inside isolation. Test password verification only with synthetic hashes; never access or inspect source hashes. Export only security-approved aggregates.
- [ ] Run Node ingestion in dry-run/shadow mode first. Confirm it never mutates Maildir and emits no duplicate records when started/restarted.
- [ ] Deliver synthetic external SMTP mail through Postfix -> LMTP -> Maildir -> Node indexer -> inbox, including unknown/disabled recipient rejection.
- [ ] Run original-versus-Node parser differential tests and end-to-end authorization/security tests.
- [ ] Perform backup and restore twice, including a restore after a failed rehearsal; inspect owner/mode on secrets, sockets, Maildir and attachment roots.

**Acceptance:** zero unexplained data-count, approved file-hash, or authorization deltas when compared inside isolation; password verification uses synthetic hashes only; no source sessions or hashes are accessed; and only security-approved aggregate results are exported. Any production-like rehearsal requires separate approval and has no production Maildir/database access.

## Phase 7: Controlled Cutover and Rollback

This phase is future planning only and remains unapproved. Production access, migration, cutover, and rollback operations require separate named, recorded approval; no such action is authorized here.

## Implementation Stage 7: Controlled Cutover and Rollback

- [ ] Take a verified coordinated snapshot of PostgreSQL target (if seeded), MariaDB mail schema, current application DB, Maildir, attachments, contact state and service/config state.
- [ ] Enter maintenance for app writes and stop old ingestion/web/contact/updater consumers; leave Postfix and Dovecot delivery active so new mail accumulates in Maildir.
- [ ] Apply final application DB delta, ingest Maildir delta idempotently, reconcile counters/attachments, then validate recipient maps and app readiness.
- [ ] Switch Nginx app upstream and enable Node units; do not alter Postfix recipient view or Dovecot delivery path as part of the application cutover.
- [ ] Validate login, mailbox assignment, inbox/message read, attachments, health, external SMTP/LMTP delivery, unknown recipient rejection, contact submission, backup and reboot recovery.
- [ ] Keep the old app/database snapshot isolated and do not automatically restore an older database/Maildir after new mail is accepted. Define coordinated rollback and mail replay/reconciliation before opening traffic.

**Acceptance:** signed cutover checklist; all critical smoke tests pass; no duplicate/lost mail; exact rollback point and post-cutover mail reconciliation procedure recorded. Rollback is rehearsed before production cutover.

## Minimum Release Gate

Before coding begins, approve the decisions in [ARCHITECTURE.md](ARCHITECTURE.md) and [IMPLEMENTATION-BLUEPRINT.md](IMPLEMENTATION-BLUEPRINT.md), select the immutable source baseline, and accept the phased plan. Before release, require Node unit/integration/e2e/security tests, typecheck/lint/build, Prisma migration/rehearsal, install/restore acceptance, mail-flow acceptance and dependency audit; report any unexecuted external acceptance gate explicitly.

## Phase 4 Record: Compatibility and Data Model

Verified source mapping and schema decisions are in [POSTGRESQL-DATA-MODEL.md](POSTGRESQL-DATA-MODEL.md). The schema models the Django application entities in PostgreSQL, adds an empty target-only opaque-session table for the planned Node auth layer, and excludes Postfix/Dovecot MariaDB records/views and contact SQLite. The source Django session payload is not imported.

The new `tests/compatibility/original-source-contract.test.mjs` reads original source, existing source tests and deployment templates without importing Python, writing to the reference tree, resolving DNS, contacting mail services or opening a database. `tests/schema/postgres-schema.test.mjs` checks the Prisma model, generated initial SQL, custom case-insensitive indexes/check constraints and infrastructure-store exclusions. These are static source-contract tests; they document verified source branches and test names but do not claim to execute Django runtime behavior.

Local results for this Phase 4 work:

| Check                                                     | Result                                                              |
| --------------------------------------------------------- | ------------------------------------------------------------------- |
| `npm.cmd run test:compat`                                 | PASS: 15 tests, 0 failures, including FK actions/index coverage.    |
| `npm.cmd run db:validate`                                 | PASS: Prisma 7 schema valid; no database connection.                |
| `npm.cmd run db:generate`                                 | PASS: local client generated; no database connection.               |
| Persistent/production PostgreSQL migration                | NOT RUN; SQL was applied only to the disposable Phase 4.1 database. |
| Original Django test suite / production backup comparison | NOT RUN; no Python runtime or production data accessed.             |

Remaining future pre-import gates, only after separate named, recorded data-owner/security approval and all applicable safety gates: inventory approved production application/framework tables excluding all source session data; resolve non-ASCII collation/casefold differences; verify compatibility with the selected production PostgreSQL version/configuration; compare approved non-secret row/file data inside isolation. Never access or inspect source password hashes. Export only security-approved aggregates. The MariaDB mail schema and contact SQLite remain separate.

## Phase 4.1 Record: Isolated PostgreSQL Migration Rehearsal

The Phase 4.2 risk assessment, field mapping, validation classes, and approval-gated sanitized-data rehearsal sequence are in [DATA-MIGRATION-REHEARSAL-PLAN.md](DATA-MIGRATION-REHEARSAL-PLAN.md). This is planning only; no source rows or credentials were accessed.

The initial migration was executed against a fresh, disposable PostgreSQL 16.14 database only. Container `mailstack-phase41-e3cda607f6214efe95d1cd48934ae11c` used the already-present `postgres:16-alpine` image, Docker `none` networking, no published ports or external volumes, and a 512 MiB tmpfs data directory. A randomly generated temporary password was used and is not recorded. Existing `ygit-*` containers were not inspected beyond their listed name/image/status/ports and were not touched.

Migration tested: `prisma/migrations/20261017000000_initial_application_schema/migration.sql`, SHA-256 `7839ada483c61d6fabc7c80ee57dd4ae4d739a21e46eab38e7c116bcb047e3eb`.

| Rehearsal operation                                           | Result                                                                                                                                                                                                         |
| ------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Container creation and isolation verification                 | PASS, exit 0; PostgreSQL 16.14 ready, no network/port/volume exposure.                                                                                                                                         |
| Create fresh `mailstack_phase41_rehearsal` database           | PASS, exit 0.                                                                                                                                                                                                  |
| Apply exact initial migration using `psql -v ON_ERROR_STOP=1` | PASS, exit 0; no SQL errors, only expected existing-public-schema notice.                                                                                                                                      |
| PostgreSQL catalog inventory                                  | PASS, exit 0; 12 tables, 125 columns, matching the 12 Prisma models/125 scalar fields; no MariaDB/Postfix/contact tables.                                                                                      |
| PK/FK/check/index catalog checks                              | PASS; 12 PKs, 11 FKs (6 CASCADE, 4 SET NULL, 1 RESTRICT), 7 checks, and 16 expected non-PK unique indexes.                                                                                                     |
| Synthetic uniqueness and Unicode probes                       | PASS, exit 0 for ASCII and `Ä`/`ä` lower-case collisions and all four functional unique indexes. `Straße` and `STRASSE` remain distinct under PostgreSQL `lower()`, documenting a Unicode casefold limitation. |
| `AppSession` delete behavior                                  | PASS, exit 0; deleting a synthetic user removed its session by `ON DELETE CASCADE`.                                                                                                                            |
| Source row/ID/data migration                                  | NOT RUN; this was schema-only and used no invented MailStack source rows.                                                                                                                                      |
| Cleanup                                                       | PASS; only the rehearsal-labeled container and temporary probe SQL created in this session were removed. No named/anonymous external volume, published port, or custom network was created.                    |

The migration itself had no failure and required no SQL correction. Two read-only diagnostic queries were corrected: `SHOW lc_collate` exited 1 because that name is not a PostgreSQL setting (the `pg_database` catalog query then exited 0); the first constraint report exited 1 because `contype` needed an explicit text cast (the corrected report exited 0). These probe errors did not modify schema state.

The configured local checks were run individually after the rehearsal; each command exited `0`:

| Command                            | Result                      |
| ---------------------------------- | --------------------------- |
| `npm.cmd run test:compat`          | PASS: 15 tests, 0 failures. |
| `npm.cmd run db:validate`          | PASS.                       |
| `npm.cmd run db:generate`          | PASS.                       |
| `npm.cmd run lint`                 | PASS.                       |
| `npm.cmd run typecheck`            | PASS.                       |
| `npm.cmd run build`                | PASS.                       |
| `npm.cmd audit --audit-level=high` | PASS: 0 vulnerabilities.    |

Remaining production-only gates include actual production collation/Unicode collision inventory, unsigned positive-BIGINT range preflight, source row and ID/hash/counter/file preservation, password-hash compatibility, framework-table inventory, production-version/configuration compatibility, and restore/rollback rehearsal. The PostgreSQL application schema remains separate from Postfix/Dovecot MariaDB and contact SQLite. No authentication, runtime adapter, mail worker, or mail-engine implementation was started.
