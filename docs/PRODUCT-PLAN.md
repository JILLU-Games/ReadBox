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

**Proposed compact flow: four steps; DESIGNED — NOT IMPLEMENTED.**

The historical Phase 6.3 three-step proposal is superseded as the current UX proposal only; it remains historical evidence, not an approved flow. The preliminary preferences in [Installer Architecture](INSTALLER-ARCHITECTURE.md) are **PROPOSED — NOT APPROVED** and do not authorize implementation or deployment.

1. **System readiness:** read-only prerequisite inventory and verification of a reachable PostgreSQL database/schema and least-privilege application access. Whether the wizard creates the database remains unresolved; current design assumes operator provisioning until approved otherwise.
2. **Initial administrator:** operator-controlled bootstrap using the existing profile-backed identity model, followed by required password reset and verified sign-in. The current CLI is development-only; no public registration or anonymous privilege-grant endpoint is permitted.
3. **Domain and mail configuration:** validate provider-neutral settings and use only an approved secret-reference/store contract. Configuration validity does not imply service health or delivery readiness.
4. **Verification and completion:** independently verify required database/schema/admin postconditions and approved service/delivery checks. Never report completion from submitted settings, process exit, or a running container alone.

The local installer authority is separate from application-admin identity. Any host mutation requires the separately approved OS-authenticated installer-agent and browser handoff; until then the UI must remain read-only for host operations and report a safe blocked state. Interrupted work must resume through durable idempotency and verified recovery, never duplicate administrators or weaken authorization.

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
- The application has credentials authentication, JWT sessions, a Prisma-backed revocable `AppSession`, and password hashing. `getCurrentUser()` reloads active/reset state and `AdministratorProfile` from Prisma; admin guards require profile-backed administrator membership. Legacy `User.isStaff`/`isSuperuser` flags do not grant access.
- `bootstrapInitialAccount()` can create one reset-required application administrator, its `AdministratorProfile`, and a one-time password-reset token in one PostgreSQL transaction under an advisory lock. The operator CLI requires local development, loopback PostgreSQL, and an interactive terminal; this is not a web setup wizard or PostgreSQL service initializer and does not establish host/installer authority.
- The local operator CLI rejects `mailstack_dev`, production mode, non-PostgreSQL/remote hosts, and non-interactive execution. A TTY is only a local execution guard, not proof of OS identity or host-level installer authority.
- The administrator-profile migration is additive and was applied twice successfully to a fresh disposable PostgreSQL target in Phase 6.4; all three real integration tests passed. The tmpfs container was removed afterward, and no development/production database was queried, so existing database applied state remains unknown.
- The Prisma schema includes `Domain`, `Mailbox`, memberships, messages, and attachment metadata. `maildirRelativePath` has no verified root, owner, or delivery mapping.
- The Postfix adapter is generic and mock-only. No production Postfix/Dovecot adapter or mail provisioning implementation is established.
- Domain/mailbox/storage/delivery modules and persistent workers are incomplete or absent.
- A pure setup progression policy now models ordered milestones in memory. It is not persisted, does not perform setup work, and does not expose a route or authorize an operator.

## Roadmap and Dependencies

The ordered roadmap is Phase 5 installer architecture/setup foundation; Phase 6 PostgreSQL initialization and initial administrator; Phase 7 read-only scanner and security prerequisites; Phase 8 gated Guided Setup security foundation, followed only later by separately gated isolated mail-service provisioning; Phase 9 domain/mailbox/routing/storage; Phase 10 backup, restore, recovery, and production readiness. Phase 8 does not itself authorize mail provisioning. The stage gates for design, approved development, isolated testing, security/recovery sign-off, and separately approved VPS deployment are in [Implementation Roadmap](IMPLEMENTATION-ROADMAP.md). ReadBox is not ready for real-VPS installation or production validation.

## Test Readiness

The default `npm.cmd test` workflow is database-independent. `npm.cmd run verify:safe` adds no-emit TypeScript, lint, and Prisma validation without starting a build. PostgreSQL integration is a separate, explicit workflow using the opt-in `postgres-test` Compose profile, a dedicated ignored `.env.test.local`, loopback-only port, tmpfs storage, container identity checks, and an empty-database check before migration. Never use the `mailstack_dev` fallback or production databases. Current integration implementation and limitations are tracked in [Prisma test workflow](../prisma/README.md#test-workflow). Phase 6.4 migration and runtime results are historical evidence for the disposable target that was removed; they do not establish current service availability or any other database's state. Reruns require a newly verified disposable target.

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
