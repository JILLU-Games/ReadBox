# ReadBox Product Plan

**Status:** Product vision frozen for planning; implementation incomplete
**Version:** 1.0
**Date:** 2026-10-18

This document is the persistent product reference. It records requirements and decisions without claiming unimplemented behavior is available. See [Implementation Roadmap](IMPLEMENTATION-ROADMAP.md), [Installer Architecture](INSTALLER-ARCHITECTURE.md), and [Architecture Decisions](ARCHITECTURE-DECISIONS.md).

## Frozen Invariants

- PostgreSQL is the only database system for all ReadBox application and database-backed mail-management records. Prisma remains the application ORM. No MariaDB, MySQL, SQLite, or second database may be added.
- Existing `AGENTS.md` and frozen Markdown policies are authoritative and must not be edited. Historical multi-database statements in old workspace documents are not authorization to use another database; record any contradiction in these new documents.
- `reference/MailStack/` is read-only and out of bounds for future work under the current project instructions.
- Never access, reset, migrate, or modify `mailstack_dev` or any production database. Database tests require a separately named, explicitly configured, verified disposable synthetic loopback database.
- Local development only unless separately authorized. No deployment, commit, push, or unapproved service restart. Do not run a build that could interfere with the active `.next` directory.
- Never reveal secrets, credentials, tokens, password hashes, or customer data.
- Mail and attachment bytes remain on a configured filesystem or dedicated persistent volume; PostgreSQL stores application and mail-management records.

## Product Vision

ReadBox is a self-hosted, Docker-based email platform. A first-time operator should be able to install an isolated ReadBox deployment, configure PostgreSQL and create the initial administrator, inspect supported host prerequisites, provision ReadBox-owned mail services, configure domains and mailboxes, store and view mail, and perform verified backup and recovery.

The default installation owns and isolates its supported, version-pinned services. Existing host tools or services are discovered read-only and reused only after compatibility, ownership, configuration, and impact are verified. Detection does not authorize mutation. Unverified or shared resources must not be changed or removed.

## User Journeys and Requirements

### First-run setup

1. An operator opens the local installation setup experience. Until setup is complete, only explicitly allowed setup operations are available; normal workspace and admin routes remain protected.
2. The operator supplies required environment settings and intended PostgreSQL database name, role name, and credentials. Privileged bootstrap secrets stay server-side and are never sent to the browser.
3. The operator requests database creation. A trusted backend reports bounded progress and sanitized errors, verifies connectivity, database/schema readiness and least-privilege application access, and never declares success based only on command completion.
4. The operator supplies initial administrator email, username, password, and confirmation. Both client and server validate inputs. Creation is serialized, one-time, retry-safe, and verified before setup is marked complete. Success offers sign-in.
5. Interrupted setup can resume or recover without duplicate administrators, leaking secrets, or weakening access controls.

Setup cannot be exposed as an unprotected arbitrary-operation API. Define its pre-authentication boundary and recovery mechanism before adding routes.

### Administration and discovery

The secure admin panel will report setup/installation state and provide a read-only scan of platform prerequisites and relevant services such as Docker, Node.js, Nginx, PostgreSQL, Postfix, and Dovecot. Results distinguish detected, compatible, reusable, missing, unsupported, and unverified. The scan does not print secret-bearing configuration or change host state.

Later, allowlisted operations may install, configure, update, or remove only verified ReadBox-owned resources. There is no unrestricted root shell or arbitrary command execution. Operation progress, logs, sanitized failures, health, and recovery guidance are visible to authorized administrators.

### Mail and storage

A documented, supported Postfix/Dovecot design is preferred where appropriate. Before dependent implementation, define routing, SMTP/TLS/DNS/ports, authentication, LMTP delivery, health, storage mapping, ownership, quotas, and lifecycle semantics. ReadBox app credentials are not automatically mail-protocol credentials. Real mail delivery is a separately tested capability; a running container alone is not proof.

Domain, mailbox, alias, routing, and authentication behavior must be explicit contracts. Do not infer routing behavior from database status fields, invent alias resolution, or assume a Maildir path convention. Keep message and attachment bytes on filesystem storage with documented roots, permissions, path validation, ownership, quotas, retention, and backup consistency.

### Backup and recovery

Back up PostgreSQL and the corresponding persistent mail storage with a documented consistency boundary. Validate archives and restore targets before modifying data. Recovery must protect unrelated resources, reject unsafe paths, report sanitized errors, and never overwrite newer mail with an older snapshot without an explicit recovery procedure.

## Current Verified Baseline

- The application uses Next.js, Prisma, `@prisma/adapter-pg`, and a PostgreSQL `DATABASE_URL`.
- `compose.yaml` defines a PostgreSQL 16.14 Alpine development service with a persistent named volume and loopback port binding. Its configured database is `mailstack_dev`; it is forbidden to access, reset, migrate, or modify it.
- `AUTH_ENABLED` defaults to false. Protected workspace routes redirect to sign-in when auth is disabled. Auth-enabled mode is restricted to development/test in `src/auth.ts`.
- The application has credentials authentication, JWT sessions, a Prisma-backed revocable `AppSession`, and password hashing. `getCurrentUser()` reloads active/reset state from Prisma; admin guards require staff or superuser.
- `bootstrapInitialAccount()` can create one reset-required synthetic administrator under a PostgreSQL transaction lock. The operator CLI requires local development, loopback PostgreSQL, and an interactive terminal; it displays a one-time reset token. This is not a web setup wizard or PostgreSQL service initializer.
- The Prisma schema includes `Domain`, `Mailbox`, memberships, messages, and attachment metadata. `maildirRelativePath` has no verified root, owner, or delivery mapping.
- The Postfix adapter is generic and mock-only. No production Postfix/Dovecot adapter or mail provisioning implementation is established.
- Domain/mailbox/storage/delivery modules and persistent workers are incomplete or absent.
- A pure setup progression policy now models ordered milestones in memory. It is not persisted, does not perform setup work, and does not expose a route or authorize an operator.

## Roadmap and Dependencies

The default ordered roadmap is Phase 5 installer architecture/setup foundation; Phase 6 PostgreSQL initialization and initial administrator; Phase 7 read-only server scanner; Phase 8 isolated mail-service provisioning; Phase 9 domain/mailbox/routing/storage; Phase 10 backup, restore, recovery, and production readiness. Each phase has explicit gates in [Implementation Roadmap](IMPLEMENTATION-ROADMAP.md). Mail-host evidence and a safe setup trust boundary block dependent operations.

## Acceptance Criteria

- Setup verifies every completed operation, is authorized, retry-safe, and protects bootstrap credentials.
- PostgreSQL is the only database and each runtime role has least privilege.
- Scans are read-only, accurately report uncertainty, and do not affect unrelated projects.
- Provisioning only touches explicitly owned, version-pinned resources and has health, recovery, and teardown boundaries.
- Domain/mailbox/alias/authentication/status behavior follows approved contracts and synthetic tests.
- Maildir and attachments are confined to documented persistent storage and are included in tested backup/restore.
- No operation claims success without checking the resulting state; no secrets or customer data appear in browser output, logs, or reports.

## Non-Goals

No unrestricted shell, arbitrary SQL or command execution from the UI, implicit reuse of host services, destructive auto-cleanup, unverified live-mail claims, alternate database, or production operation without separate authorization.
