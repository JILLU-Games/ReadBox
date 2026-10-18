# ReadBox Implementation Roadmap

**Status:** Planning baseline; phases 5-10 are not authorized for deployment
**Version:** 1.0
**Date:** 2026-10-18

This roadmap is subordinate to [Product Plan](PRODUCT-PLAN.md), [Installer Architecture](INSTALLER-ARCHITECTURE.md), [Architecture Decisions](ARCHITECTURE-DECISIONS.md), and frozen `AGENTS.md` policy. PostgreSQL remains the only database.

## Status Vocabulary

- **Verified:** established by inspected workspace-owned code or safe test evidence.
- **Partial:** a foundation exists but does not complete the feature.
- **Planned:** requirement only; implementation is not established.
- **Blocked:** required evidence or an approved safety boundary is missing.

## Baseline

- **Verified:** Prisma/PostgreSQL schema, local Compose PostgreSQL service, Next.js foundation, and mock-only mail lookup contract exist.
- **Partial:** Auth.js credentials, JWT session revocation, route guards, password reset, and interactive local initial-account CLI exist. These do not provide the first-run web wizard or database-service initializer.
- **Blocked:** a setup UI/API trust boundary, setup progress/persistence, and approved recovery mechanism are not established. Intended mail-host versions/configuration and lookup/storage contracts are unavailable.
- **Not verified:** the active development server and any database status must not be inferred from the shared sign-in page. Never inspect or connect to `mailstack_dev`.

## Phase 5 — Installer Architecture and First-Run Foundation

**Status:** Partial; a pure, in-memory progression policy is implemented and synthetically tested.
**Implemented:** ordered setup milestones, idempotent replay of completed milestones, rejection of out-of-order or malformed progress, and final completion gating in `src/core/setup/progress.ts`. This does not persist state, verify PostgreSQL or schema readiness, create an administrator, authorize requests, or execute operations.
**Remaining deliverables:** durable status/progress contract; authorization/pre-auth boundary; trusted operation runner boundary; operation allowlist; idempotency and recovery for real operations; sanitized error model; ownership labels/project/volume/network plan. No host installation or mutation.

**Gate:** docs agree with frozen policies; setup operations cannot be invoked by ordinary users or arbitrary command input; no placeholder reports completion without verification.

**Tests:** synthetic transition tests, invalid-transition tests, retry/idempotency tests at the pure domain boundary, sanitized error tests. No database required.

## Phase 6 — PostgreSQL Initialization and First Administrator

**Status:** Planned; existing operator bootstrap is not the wizard.
**Deliverables:** verify/create the intended PostgreSQL database and least-privilege app role; schema readiness; setup locking; first-admin creation; reliable progress and recovery.

**Gate:** dedicated synthetic loopback database is explicitly configured and verified, never `mailstack_dev` or production; privileged credentials remain server-side; retries and partial failure are safe.

**Tests:** disposable synthetic PostgreSQL only, with isolation proven before use; permission-denial, concurrent bootstrap, partial failure, retry, schema-readiness, and redaction cases.

## Phase 7 — Read-Only Server Scanner

**Status:** Planned.
**Deliverables:** supported prerequisite inventory and read-only tool/service detection; result states distinguish detected, compatible, reusable, missing, unsupported, and unverified.

**Gate:** no service config secrets are printed; no install, restart, network, firewall, DNS, or service mutation; unknown ownership remains unverified.

**Tests:** missing tool, unexpected version, permission failure, malformed/non-secret output, and unrelated resource cases.

## Phase 8 — Isolated Mail-Service Provisioning

**Status:** Blocked on supported architecture, host evidence, and approved service contract.
**Deliverables:** version-pinned ReadBox-owned Postfix/Dovecot containers where appropriate, explicit Compose project/resource ownership, persistent storage, secrets handling, health checks, and teardown boundaries.

**Gate:** never touch unrelated services; verify configuration before attempting mail; running containers are not accepted as proof of delivery.

**Tests:** synthetic configuration/rendering and isolated owned-resource lifecycle; mail-flow integration only in an explicitly approved isolated environment.

## Phase 9 — Domains, Mailboxes, Routing, and Storage

**Status:** Blocked on verified Postfix/Dovecot contracts and Maildir mapping.
**Deliverables:** approved domain/mailbox/alias/authentication/status contracts; validated lifecycle services; path safety, ownership, quotas, and delivery verification.

**Gate:** do not infer service behavior from Prisma statuses; keep app credentials distinct from mailbox authentication; additive schema changes only after contract approval.

**Tests:** synthetic lookup semantics, status transitions, alias cardinality/resolution, permission boundaries, Maildir confinement, duplicate delivery, and failure recovery.

## Phase 10 — Backup, Restore, Recovery, and Readiness

**Status:** Planned.
**Deliverables:** consistent PostgreSQL plus mail-storage backup/restore, validation, safe recovery, operation logs, security review, and documented platform requirements.

**Gate:** no production operation in this development roadmap; restoration must not overwrite newer messages; backup artifacts and secrets are protected.

**Tests:** disposable synthetic PostgreSQL and temporary synthetic storage only; corrupt/unsafe archive rejection, restore validation, ownership/permission, and interrupted recovery cases.

## Completion and Handoff Rules

A phase is complete only when its acceptance gates and focused tests pass and its documentation status is updated. Do not execute multiple dependent phases in one uncontrolled change. Report skipped tests and why. Never build against an active `.next` tree, stop/restart a server, deploy, commit, or push without authorization. See [Product Plan](PRODUCT-PLAN.md) and [Installer Architecture](INSTALLER-ARCHITECTURE.md) for detailed requirements.
