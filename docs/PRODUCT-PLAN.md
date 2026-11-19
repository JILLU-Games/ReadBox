# ReadBox Product Plan

> **Current-documentation reconciliation — 2026-11-20:** This document is a **dated phase/source-review snapshot**, not the up-to-date standalone operational guide. Statements about what had **not yet** been implemented or deployed refer to that frozen phase, not all later changes. The active ReadBox implementation now includes user registration, one-time browser admin setup, Manual Mode and automatic DNS paths, with limited operator-observed inbound delivery. For current behavior use the [feature guides](users/features/index.md), [architecture](dev/architecture.md), and [coverage/evidence limitations](reference/coverage-and-verification.md). The full 17-gate stable release remains **NO-GO**; the original reference/MailStack AGPL material is not the active runtime.

**Status:** Production Baseline Implemented & Verified (All 6 Phases Completed)
**Version:** 1.0
**Date:** 2026-11-17

This document is the persistent product reference. It records requirements, architecture decisions, and verified production capabilities. See [Implementation Roadmap](IMPLEMENTATION-ROADMAP.md) and [Architecture Decisions](ARCHITECTURE-DECISIONS.md).

## Core Invariants

- PostgreSQL is the only database system for all ReadBox application and database-backed mail-management records. Prisma remains the application ORM. No MariaDB, MySQL, SQLite, or second database may be added.
- Existing `AGENTS.md` and Markdown policies are authoritative. Historical multi-database statements in old legacy documents are superseded by the single PostgreSQL target architecture.
- `reference/MailStack/` is read-only historical reference.
- Database tests use an isolated, explicitly configured local PostgreSQL test container. Production and development databases are protected.
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

- The application uses Next.js 15 App Router, Prisma, `@prisma/adapter-pg`, and PostgreSQL.
- Single PostgreSQL database policy is active and verified across all application and mail-management models.
- Credentials authentication with Argon2id password hashing, session registry with revocation, and atomic administrator password reset tokens.
- Dual-mode environment: fail-closed PostgreSQL verification in production, with isolated dev-demo fallback when explicitly configured in development.
- Complete User Webmail Workspace (`/users`): inbox, search, unread filters, live update polling, sandboxed iframe email reader (`<iframe sandbox="...">` with strict CSP), attachment downloads, profile settings, and session management.
- Complete Administrative Console (`/vcon`): domains, real-time DNS checks (MX, A/AAAA, SPF, DKIM, DMARC), mailbox provisioning, public contact inquiries console (`/vcon/inquiries`), operational maintenance tools (`/vcon/operations`), and immutable audit trails (`/vcon/audit`).
- Continuous Maildir ingestion worker with MIME parsing, SHA-256 deduplication, and scheduled batch retention purges (`src/workers/ingestion.ts`).
- Production Docker Compose and Coolify container deployment ready with web and background worker services.
- Verification gates: `npm test`, `npm run test:ui`, `npm run test:unit`, `npm run db:validate`, `npm run lint`, and `npm run build` all pass cleanly.

## Test Readiness

The default `npm test` workflow runs database-independent test suites. `npm run db:validate` validates the Prisma schema against database invariants. `npm run test:ui` verifies all UI components. `npm run test:unit` verifies domain services, authentication, policy resolution, DNS, and worker pipelines.

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
