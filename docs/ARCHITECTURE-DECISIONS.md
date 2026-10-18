# ReadBox Architecture Decisions

**Status:** Planning decisions frozen; unresolved items explicitly remain open
**Version:** 1.0
**Date:** 2026-10-18

These decisions apply with frozen `AGENTS.md` policy. Product scope is in [Product Plan](PRODUCT-PLAN.md), installer boundaries in [Installer Architecture](INSTALLER-ARCHITECTURE.md), and sequencing in [Implementation Roadmap](IMPLEMENTATION-ROADMAP.md).

## D-001: PostgreSQL Only

**Decision: Frozen.** PostgreSQL is the one and only database system for application and mail-management records. Prisma remains the application ORM. Do not add MariaDB, MySQL, SQLite, or another database. Mail and attachment bytes remain filesystem/persistent-volume data.

**Evidence:** root `AGENTS.md`, `prisma/schema.prisma`, PostgreSQL client configuration, and Compose PostgreSQL service. The current Compose database is named `mailstack_dev`; it is explicitly excluded from all tests and operations in this project plan.

**Conflict handling:** some frozen workspace documents contain historical descriptions of additional databases. They are not target authorization and are left unchanged. This decision records the controlling policy without modifying those files.

## D-002: ReadBox-Owned Isolated Services by Default

**Decision: Frozen for product direction.** Default installation provisions supported, version-pinned ReadBox-owned services in isolated Compose resources. Do not assume a compatible host mail service exists. Detection is read-only. Reuse is allowed only after version, ownership, configuration, compatibility, security boundary, and impact are verified. If any condition is uncertain, do not reuse or modify the existing service.

**Acceptance:** dedicated project identity, labels, volumes, and networks; safe collision detection; explicit health and teardown boundaries; unrelated resources remain untouched. Actual image versions and platform support remain to be selected and validated.

## D-003: No Arbitrary Shell from UI

**Decision: Frozen.** UI requests express typed intent only. A trusted server-side coordinator maps intent to finite allowlisted operations. No arbitrary shell, SQL, command arguments, paths, or unrestricted root operation is accepted from a browser. Privileged operations require a separate narrowly scoped worker/API and verifiable ownership.

**Rationale:** arbitrary execution creates command-injection and privilege-escalation paths, makes operations unreviewable, and prevents reliable idempotency and recovery.

## D-004: Setup and Bootstrap Boundary

**Decision: Proposed for Phase 5.** Preserve current auth guards and operator CLI behavior. Design setup as an explicit state machine with one-time authorization, CSRF/origin checks, backend-only secrets, serialized/idempotent operations, sanitized progress, and verified postconditions. Do not expose a public setup mutation route until its pre-authentication trust boundary is reviewed and tested.

**Open:** exact first-run authorization mechanism, durable setup-state storage, worker IPC/authentication, PostgreSQL bootstrap credential delivery/rotation, and interrupted-operation recovery.

## D-005: Mail-Service Contract Gate

**Decision: Frozen gate.** Do not implement service fields, queries, aliases, password mappings, status filters, or Maildir rules until approved sanitized evidence from the intended host establishes them. Keep application credentials separate from mailbox authentication credentials. Postfix routing and Dovecot passdb/userdb/delivery are separate contracts.

**Verified:** existing Prisma `Domain`/`Mailbox` are candidates and a generic mock lookup port exists.
**Open:** installed service versions/drivers, exact lookup surfaces, status behavior, alias semantics, authentication needs, Maildir mapping/ownership, and operational health contracts.

## D-006: Least-Privilege PostgreSQL Roles

**Decision: Proposed.** Keep one PostgreSQL database with Prisma-owned application schema and, where supported and required, a separate narrowly scoped mail-lookup schema. Use distinct non-owner runtime roles for ReadBox, Postfix, and Dovecot only if Dovecot database access is verified; use a separately controlled migration owner. Expose only required views/fields and grants. Do not finalize schema names or grants before verifying service capabilities and queries.

## D-007: Protect Unrelated Resources

**Decision: Frozen.** Never stop, restart, reconfigure, remove, or reuse unrelated websites, databases, containers, networks, volumes, mail services, or system tools without explicit evidence and authorization. Do not auto-uninstall shared dependencies. Resource cleanup requires positive ownership proof.

## Unresolved Product Decisions

- Supported Docker/OS/runtime versions, image pins, ports, DNS/TLS requirements, outbound-mail scope, and provider limitations.
- Initial setup authorization and recovery procedure; bootstrap credential lifecycle and migration-role operation model.
- Postfix recipient/domain/alias contracts; Dovecot protocols and whether passdb/userdb are needed; Maildir path, identity, quota, and delivery behavior.
- Alias cardinality/resolution and domain/mailbox status transitions.
- Storage retention, quota policy, backup consistency point, restore authorization, and post-restore mail reconciliation.
- Service reuse criteria implementation details and the exact ReadBox resource naming/label scheme.

No open item may be silently treated as decided. Any change to a frozen decision requires explicit user approval and must not contradict root `AGENTS.md`.
