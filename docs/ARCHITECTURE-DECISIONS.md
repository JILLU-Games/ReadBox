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

**Decision: Partially implemented for Phase 5.** Preserve current auth guards and operator CLI behavior. Opaque principals are resolved from the server-side current-user helper; application staff/superuser remains application-admin only. Public status is reduced to a lifecycle summary. The server-only runner binds an injected grant to the exact operation ID, required scope, and allowed lifecycle; missing/malformed/mismatched authorization denies, unsupported operations cannot succeed, and failures are reduced to safe codes. No trusted-installer issuer, route, persistent state, production authorizer, or executor is wired.

**Bootstrap decision: unresolved; default-deny.** The local CLI is verified only as a development, loopback-PostgreSQL, interactive app-admin bootstrap. It is not an installer-principal issuer. A short-lived local secret lacks an approved protected store/atomic consume path; app-admin step-up is not a host-authority contract. Four options and their risks are evaluated in [Installer Architecture](INSTALLER-ARCHITECTURE.md), including the proposed OS-authenticated agent. The agent remains **PROPOSED — NOT APPROVED**; no issuer is selected or authorized. No permanent token, hardcoded secret, or browser-visible privileged credential is allowed.

**Preliminary preferences — each PROPOSED — NOT APPROVED:** operator-provisioned PostgreSQL; Ubuntu Server 24.04 LTS as a proposed but unverified first OS target; and browser-agent pairing/browser-triggered host operations disabled initially. These preferences are not security sign-off, implementation authorization, or deployment authorization. See [Installer Architecture](INSTALLER-ARCHITECTURE.md) for the open lifecycle-milestone and compatibility questions.

**Grant limitation:** no production authorizer or runner call site exists. The injected runner callback is an internal code trust boundary; its structural decision object has no issuer proof, expiry, nonce, or revocation check. A server callback that fabricates/reuses an allow object could authorize matching synthetic operations. Remote callers cannot inject the callback through any current route, and no production operations are registered. Do not wire a request-controlled or otherwise unverified callback; default runner configuration without an authorizer denies.

**Lifecycle decision: pure contract only.** `src/core/setup/lifecycle.ts` plans revisioned transitions among not-started, in-progress, completed, failed, and interrupted. Completion requires verified milestones; completed is terminal; failed/interrupted require a recovery-scoped transition. The in-memory planner binds its latest transition ID to a canonical non-secret request fingerprint, rejects changed-payload reuse, and reports stale revisions. It cannot validate historical replays, persist results, or serialize concurrent plans. The proposed PostgreSQL snapshot/milestone/operation-ledger shape and transaction/CAS protocol are design-only in [Installer Architecture](INSTALLER-ARCHITECTURE.md). Do not add models/migrations, expose a setup route, or create database bootstrap until persistence, issuer, CSRF/auth/replay controls, and operation verification are approved.

## D-008: Guided Install Gate

**Decision: Blocked; do not ship a wizard or success simulation.** The current Compose file is development-only PostgreSQL and names the forbidden `mailstack_dev`; it has no ReadBox app/Postfix/Dovecot services. Auth.js currently rejects production authentication, while initial-admin bootstrap is a development CLI action that proves neither OS identity nor host authority. No supported email configuration/readiness service exists. These verified constraints prevent a secure end-to-end wizard.

Revisit only after a safe first-admin trust path, production-capable authentication, a non-forbidden PostgreSQL deployment/test target, supported mail configuration/verification contracts, and an explicitly disposable integration-test database are approved. Until then, keep routes and privileged operations absent. The existing `npm.cmd run dev` path is a UI development command, not an installation claim.

**Open:** exact first-run authorization mechanism, durable setup-state storage, worker IPC/authentication, PostgreSQL bootstrap credential delivery/rotation, and interrupted-operation recovery.

## D-009: Application Administrator Identity

**Decision: Linked administrator profile.** Keep `User` as the canonical Auth.js login/session identity and add a one-to-one `AdministratorProfile` row as the authoritative application-admin membership. Do not create a second credential identity. The profile has its own stable `BIGINT` primary key, unique `user_id` FK with cascade deletion, creation/update timestamps, and an app-level `isSuperuser` tier. `User` remains the owner of username, email, password hash, account active/reset state, and sessions. The profile owns administrator membership/tier. `User.isStaff` and `User.isSuperuser` remain legacy columns for additive compatibility but must not grant access.

Current-user/session refresh derives `isAdministrator` from profile existence and `isSuperuser` from the profile row. Route guards authorize app-admin routes only from that server-resolved value; client-supplied role fields are not accepted. Profile absence is non-admin, even when legacy flags are true. No existing account is automatically promoted by the migration. Existing operators must be explicitly reviewed and assigned profiles through a separately approved process; no such process is implemented here.

The local bootstrap helper validates input, then creates the initial `User`, `AdministratorProfile`, and reset token in the same advisory-locked transaction. The CLI remains development-only, loopback-only, and interactive, and now rejects `mailstack_dev`; it grants application-admin/superuser status only, never host/installer authority. Its TTY check is not proof of OS identity. The new additive migration was not executed in the Phase 6.1/6.2 verification; actual applied state was not queried. Database-backed validation is blocked until a separately configured, verified disposable synthetic PostgreSQL target exists.

**Test boundary (Phase 6.4):** default tests do not connect to PostgreSQL. The explicit integration runner accepts only `AUTH_TEST_*` settings, verifies the sole repository Compose config, dedicated labeled service, tmpfs data, loopback binding, server/database identity, and clean or fully migrated empty state. It applies migrations twice and runs the PostgreSQL suite without a `DATABASE_URL` fallback or service lifecycle management. Phase 6.4 applied migrations twice and passed all three integration tests against the disposable target; that container was removed. No other database was queried, so existing database state remains unknown.

**Production auth remains blocked.** `src/auth.ts` rejects `AUTH_ENABLED=true` in production; this phase does not relax that boundary. A secure deployment/session-secret and first-admin trust design is still required before production authentication or a web setup flow can be enabled.

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
