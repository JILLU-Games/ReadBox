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

## Development, Testing, and Deployment Gates

Keep these stages separate; passing one does not authorize the next:

1. **Documentation/design:** clarify contracts and record decisions. This authorizes no feature, scanner, agent, host operation, database change, or deployment.
2. **Approved feature development:** begin only after explicit product/security approval of the applicable trust, API, schema, and service contracts. Initial setup/security work must not provision or mutate host/mail services.
3. **Isolated testing:** use only separately authorized synthetic resources and a freshly verified disposable PostgreSQL target. Historical Phase 6.4 results do not establish present target availability.
4. **Security and recovery sign-off:** verify authorization, secret handling, failure/recovery, backup/restore requirements, and relevant test evidence before considering any operational use.
5. **Real-VPS installation/production validation:** a separate deployment decision and explicit approval after the implementation, isolated tests, security review, and recovery validation are complete. ReadBox is **not ready for real-VPS installation or production validation**.

## Baseline

- **Verified:** Prisma/PostgreSQL schema, local Compose PostgreSQL service, Next.js foundation, and mock-only mail lookup contract exist.
- **Partial:** Auth.js credentials, JWT session revocation, route guards, password reset, and interactive local initial-account CLI exist. These do not provide the first-run web wizard or database-service initializer.
- **Partial:** a one-to-one `AdministratorProfile` is the application-admin source of truth and is created by the existing locked CLI bootstrap. Its additive migration was applied twice successfully to the fresh Phase 6.4 disposable PostgreSQL target; no other database was queried or changed, and no legacy roles were backfilled. Production auth remains disabled by current configuration.
- **Partial:** shared UI components have automated drawer keyboard/breakpoint, theme-toggle keyboard, muted-text contrast, and reduced-motion CSS contract coverage. Latest reported results were 87/87 component-independent tests, 21/21 UI tests, and 7/7 focused reduced-motion/manifest/service-worker tests; lint passed, TypeScript completed without diagnostics, and `git diff --check` exited 0 with line-ending warnings. These results are historical and were not rerun for this status update.
- **Partial UI browser QA (2026-10-19):** Chrome headless captured `/sign-in` at 320px, 768px, and 1280px. The 320px capture failed due to horizontal clipping; the 768px and 1280px captures appeared contained but cover only sign-in. The reset-password and protected workspace layouts remain unverified. An isolated Chrome fixture verified the reduced-motion CSS under the emulated reduce preference; `/manifest.webmanifest` returned HTTP 200. Light-theme visual acceptance, app-level reduced-motion rendering, production service-worker registration, and PWA installability remain pending. The next UI task is to inspect/fix sign-in clipping at 320px and inspect the related reset-password layout.
- **Blocked:** a setup UI/API trust boundary, setup progress/persistence, and approved recovery mechanism are not established. Intended mail-host versions/configuration and lookup/storage contracts are unavailable.
- **Not verified:** the active development server and any database status must not be inferred from the shared sign-in page. Never inspect or connect to `mailstack_dev`.

## Phase 5 — Installer Architecture and First-Run Foundation

**Status:** Partial; pure progression, opaque application principals, a fail-closed operation contract, and a pure revisioned lifecycle planner are implemented and synthetically tested. Trusted-principal issuance and persistence remain unimplemented.
**Implemented:** ordered setup milestones in `src/core/setup/progress.ts`; server-resolved opaque principals and operation-bound authorization in `src/core/setup/authorization.ts`; injected runner in `src/core/setup/trusted-operations.ts`; and legal transition planning, latest-key payload fingerprinting, replay/stale-revision checks in `src/core/setup/lifecycle.ts`. The lifecycle planner does not persist, authorize, or verify operation results.
**Specified only:** bootstrap option comparison; a PostgreSQL lifecycle snapshot, milestone and operation-ledger schema proposal; atomic CAS/idempotency transaction; operation leases/fencing; crash detection; sanitized audit; and operator recovery requirements. No schema, migration, storage adapter, or DB test is implemented.
**Not implemented:** no trusted-installer issuer, HTTP endpoint, persistent setup state, production authorizer/operation registry/executor, database access, or host operation exists. The injected runner decision is structural and has no issuer proof, expiry, nonce, use tracking, or revocation; it is safe only as an internal trusted-code seam and default-denies when absent. The current progress model cannot represent failure/interruption or survive process restart.
**Remaining deliverables:** approve and verify the recommended OS-authenticated local installer-agent trust source and browser handoff; define post-setup administrator step-up; implement expiry/single-use/revocation and durable operation idempotency; implement route-level authentication, CSRF, and replay controls; add PostgreSQL lifecycle persistence and recovery; approve a provider-neutral mail readiness/secret contract; add only reviewed operation definitions/executors. No host installation or mutation.

**Quick-install/guided-setup status:** Blocked. Current Compose is PostgreSQL-only development infrastructure targeting the forbidden `mailstack_dev`; it contains no ReadBox app or mail services. Auth is disabled by default and cannot be enabled in production under current `src/auth.ts`. First-admin bootstrap is an interactive local CLI operation, not a web authorization boundary. No persistent setup model, email configuration service, or mail readiness verifier exists. Do not add a wizard that reports mocked success. Resume only after a safe admin bootstrap path, non-forbidden PostgreSQL target, production auth design, supported mail contract, and isolated PostgreSQL test database are approved.

**Preliminary preferences — each PROPOSED — NOT APPROVED:** operator provisions PostgreSQL out-of-band; Ubuntu Server 24.04 LTS is a proposed first target but compatibility is unverified; browser-agent pairing and browser-triggered host operations remain disabled initially. These do not approve Phase 8 or any deployment.

**Gate:** docs agree with frozen policies; setup operations cannot be invoked by ordinary users or arbitrary command input; no placeholder reports completion without verification.

**Tests:** synthetic transition tests, invalid-transition tests, retry/idempotency tests at the pure domain boundary, sanitized error tests. No database required.

## Phase 6 — PostgreSQL Initialization and First Administrator

**Status:** Partial foundation; administrator profile schema/migration and profile-backed auth/guards are implemented. Migration runtime behavior passed on the fresh Phase 6.4 disposable PostgreSQL target; actual state of any other database remains unverified. Existing operator bootstrap remains CLI-only and is not the guided wizard.
**Verified in synthetic tests:** bootstrap creates the linked profile; legacy `User` role flags do not grant administrator access; profile membership drives auth/session claims; production auth remains disabled. These tests do not verify PostgreSQL migration or runtime behavior.
**Phase 6.1 checks (2026-10-18):** `npm.cmd run test:compat` passed 16/16; `npm.cmd run test:auth` passed 17 tests with 1 opt-in PostgreSQL test skipped; `npm.cmd run test:setup` passed 29/29; `npm.cmd exec -- tsc --noEmit`, `npm.cmd run lint`, `npm.cmd run db:validate`, and `git diff --check` passed. `AUTH_TEST_DATABASE_URL` and `DATABASE_URL` were not configured in the current shell. No database was connected to and no migration was executed. The database-backed test remains blocked until a dedicated disposable loopback target is explicitly configured and verified.
**Phase 6.2 verification (2026-10-18):** `npm.cmd test` passed 75/75 with no skips; no-emit TypeScript, ESLint, `npm.cmd run db:validate`, and `git diff --check` passed. The opt-in Compose profile parsed and included `postgres-test` without starting containers. `npm.cmd run test:postgres` was confirmed to abort with a sanitized missing-test-configuration error; no PostgreSQL connection or migration occurred. The current shell had no `AUTH_TEST_DATABASE_URL` or `DATABASE_URL`, and no labeled test container exists.
**Phase 6.2 test infrastructure:** `npm.cmd test`/`npm.cmd run verify:safe` are database-independent. `npm.cmd run test:postgres` requires explicit `.env.test.local` values and an operator-started `postgres-test` Compose profile. Before any migration, the runner verifies the labeled Compose project/service and repo config path, pinned PostgreSQL image, loopback port, tmpfs-only data, configured URL/container DB identity, and empty schema. It never falls back to `DATABASE_URL` and does not manage container lifecycle. Six pure target-guard tests cover missing config, wrong target, credential policy, and container evidence; synthetic auth tests also verify invalid bootstrap input and CLI rejection of `mailstack_dev`/unsafe execution contexts. PostgreSQL runtime tests are present but remain unexecuted because no verified target is configured.
**Phase 6.3 verification (2026-10-18):** `npm.cmd test` passed 75/75; the target-guard suite passed 6/6; no-emit TypeScript, ESLint, Prisma validation, and `git diff --check` passed individually. The Compose profile parsed using placeholders without starting a service. `.env.test.local`, `AUTH_TEST_DATABASE_URL`, `DATABASE_URL`, and a labeled test container were absent; `npm.cmd run test:postgres` refused with a sanitized configuration error before Docker inspection or database connection. No migration ran. The runtime suite now checks repeat `migrate deploy` on an approved target, but PostgreSQL behavior remains **BLOCKED** until the operator provides the ignored test config and starts a fresh verified tmpfs service.
**Phase 6.2 test infrastructure:** `npm.cmd test`/`npm.cmd run verify:safe` are database-independent. `npm.cmd run test:postgres` requires explicit `.env.test.local` values and an operator-started `postgres-test` Compose profile. Before any migration, the runner verifies the labeled Compose project/service, repository working directory, exactly one `compose.yaml` config file, pinned PostgreSQL image, loopback port, tmpfs-only data, configured URL/container DB identity, and empty schema. It never falls back to `DATABASE_URL` and does not manage container lifecycle. Six pure target-guard tests cover missing config, wrong target, credential policy, and container evidence; synthetic auth tests also verify invalid bootstrap input and CLI rejection of `mailstack_dev`/unsafe execution contexts. PostgreSQL runtime tests are present but remain unexecuted because no verified target is configured.
**Phase 6.4 results (2026-10-18):** Docker Engine 29.5.3 was responsive. A fresh, labeled PostgreSQL 16.14 container used the repository's sole `compose.yaml`, project `readbox-auth-test`, loopback `127.0.0.1:55432`, and tmpfs-only PGDATA. The guard verified database/user/password identity and emptiness before migration. First and repeat `prisma migrate deploy` succeeded; integration tests passed 3/3 with 0 skips (migration/constraints, rollback, concurrent bootstrap/auth/session). The exact test container was removed afterward; ignored `.env.test.local` remains. `npm.cmd test` passed 75/75; `verify:safe` printed `COMPLETE`; TypeScript no-emit, ESLint, Prisma validation, Compose validation, and `git diff --check` passed. The website ran at `http://127.0.0.1:3101`; HTTP checks returned `/` 307, `/sign-in` 200, `/users` and `/vcon` 307, Auth.js session/providers 200, and nonexistent `/api/setup/status` 404. Browser automation reload timed out; the captured page showed a transient Next rendering overlay, so browser visual verification is inconclusive.
**Deliverables:** verify/create the intended PostgreSQL database and least-privilege app role; schema readiness; setup locking; first-admin creation; reliable progress and recovery.

**Admin identity:** `AdministratorProfile` is the authoritative application-admin membership linked to canonical `User`; login/password/session data is not duplicated. Legacy role columns do not grant administrator access and no user is auto-promoted. Production auth remains blocked by `src/auth.ts` until a production-capable auth/secret boundary is explicitly designed.

**Gate:** dedicated synthetic loopback database is explicitly configured and verified, never `mailstack_dev` or production; privileged credentials remain server-side; retries and partial failure are safe.

**Tests:** disposable synthetic PostgreSQL only, with isolation proven before use; permission-denial, concurrent bootstrap, partial failure, retry, schema-readiness, and redaction cases.

## Phase 7 — Read-Only Server Scanner and Security Prerequisites

**Status:** Architecture/security design documented; scanner and all Guided Setup implementation remain unimplemented and blocked on approval.
**Deliverables:** supported prerequisite inventory and read-only tool/service detection; result states distinguish detected, compatible, reusable, missing, unsupported, and unverified. Before adding routes or mutations, approve the OS-authenticated installer issuer and local handoff, first-admin recovery, PostgreSQL-backed lifecycle/idempotency design, CSRF/API boundary, provider-neutral mail readiness contract, and typed host-operation registry described in [Installer Architecture](INSTALLER-ARCHITECTURE.md).

**Gate:** no service config secrets are printed; no install, restart, network, firewall, DNS, or service mutation; unknown ownership remains unverified. A public status projection must be generic; no anonymous mutation or privilege-grant route. Do not run a host scan as part of this design phase.

**Tests:** missing tool, unexpected version, permission failure, malformed/non-secret output, unrelated resource cases, and security tests for issuer denial, grant replay/expiry/scope, CSRF, status redaction, stale revisions, and worker failure. Tests involving PostgreSQL require a separately approved disposable target; never use the development or production database.

## Phase 8 — Guided Setup Security Foundation and Isolated Mail Services

**Status:** **BLOCKED — APPROVAL REQUIRED.** Do not begin host-service provisioning until Phase 7 trust, bootstrap, persistence, API/CSRF, operation-registry, and mail-contract gates are approved and testable. The preliminary Ubuntu target is not a compatibility claim.
**Recommended first implementation slice:** production-capable authentication and operator bootstrap/recovery; PostgreSQL lifecycle/operation/milestone persistence with CAS, unique idempotency, leases/fencing, and crash reconciliation; authenticated setup API with CSRF and safe public status; provider-neutral configuration/readiness interfaces and secret references; registry/worker authorization tests. Schema changes require separate approval and isolated PostgreSQL verification. This slice must not provision or modify host/mail services.
**Later deliverables:** only after the foundation passes its gates, add version-pinned ReadBox-owned services, explicit project/resource ownership, persistent storage, approved secret handling, health checks, postcondition verification, and teardown boundaries.

**Gate:** never touch unrelated services; verify ownership and configuration before any approved operation; running containers are not accepted as proof of delivery; unknown or partial outcomes stop for operator recovery. The UI remains the proposed four-step flow in [Installer Architecture](INSTALLER-ARCHITECTURE.md), with host mutations unavailable until the separate agent handoff is approved.

**Tests:** synthetic configuration/rendering, auth/CSRF/grant and lifecycle concurrency/recovery tests, then isolated owned-resource lifecycle; mail-flow integration only in an explicitly approved isolated environment. Never access the forbidden development database or production.

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
