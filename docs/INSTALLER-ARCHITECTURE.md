# ReadBox Installer Architecture

**Status:** Design proposal; no setup web/API runner is implemented
**Version:** 1.0
**Date:** 2026-10-18

This design follows the frozen PostgreSQL-only policy and [Architecture Decisions](ARCHITECTURE-DECISIONS.md). Product requirements live in [Product Plan](PRODUCT-PLAN.md); phase gates are in [Implementation Roadmap](IMPLEMENTATION-ROADMAP.md).

## Existing Foundation and Boundary

The current environment parser accepts PostgreSQL URLs and `AUTH_ENABLED` defaults false. Protected user/admin routes redirect to sign-in when auth is disabled. `src/auth.ts` restricts enabled authentication to development/test. `bootstrapInitialAccount()` is a locked, reset-required initial user creation helper; `scripts/auth/operator.ts` requires local development, a loopback PostgreSQL URL, and an interactive terminal. This existing CLI is not a privileged service installer or a browser setup flow.

The setup surface must not weaken the normal route guards. Before authentication exists, expose only an explicitly designed, local setup boundary with strong one-time authorization and CSRF/origin protections. Do not make admin-only operations publicly callable merely because no admin exists. Design and test this boundary before creating setup routes.

## State Machine Proposal

Persisted state must not be added until its threat model and storage location are approved. The conceptual state sequence is:

`uninitialized -> environment_validated -> database_requested -> database_verified -> schema_verified -> administrator_created -> complete`

A failure records a bounded, sanitized failure state and a resumable step, never raw credentials, command output, SQL, password hashes, or connection strings. Retries are idempotent and re-check actual state. Terminal completion is set only after a fresh verification of database connectivity, schema readiness, least-privilege app access, and an active initial administrator. Recovery is an explicit operator action; it does not silently drop databases or accounts.

The current Phase 5 foundation is only a pure in-memory ordered milestone policy in `src/core/setup/progress.ts`. It rejects skipped/malformed milestones, treats completed-milestone replay as idempotent, and requires a final verification milestone. It does not establish that an operation actually succeeded; callers must verify postconditions before advancing it. No persistence, route, setup worker, or database operation is implemented.

Step 1 collects and validates installation settings and the intended PostgreSQL database/role. A “Create Database” request is executed only by the trusted backend/worker after authorization and ownership checks. Privileged bootstrap credentials never reach the browser. The backend verifies the outcome rather than trusting process exit alone.

Step 2 collects administrator email, username, password, and confirmation. Validate on server and client; serialize creation so concurrent or replayed requests cannot create another initial administrator. Existing `bootstrapInitialAccount()` creates a reset-required account with a generated secret and is not automatically suitable for this wizard; review its semantics before reuse. Preserve the working operator CLI until a tested replacement is approved.

## Trusted Operation Runner

The browser submits typed intent, never shell text, SQL, paths, service names, or arbitrary flags. A server-side coordinator validates the current setup state and maps intent to a finite allowlist of operations. Prefer a dedicated, narrowly privileged setup worker for long-running or privileged work; do not give the Next.js process root or Docker socket access by default. Worker IPC must authenticate the caller, validate an operation ID and schema, enforce timeouts, and return only bounded structured progress/results.

Each operation has an idempotency key, explicit ReadBox resource ownership, preconditions, postcondition checks, timeout, cancellation policy, bounded output, and recovery instructions. Unknown state fails closed. Never interpolate user input into a command. If a required operation cannot be represented safely by a fixed typed API, it is not available through the UI.

## PostgreSQL Bootstrap and Least Privilege

PostgreSQL is the sole database system. Use the existing Prisma/PostgreSQL foundation where compatible. Separate bootstrap authority from application runtime authority: the bootstrap credential is server-side and short-lived or otherwise strongly protected; the application role receives only required schema/table privileges and does not own schemas or perform routine DDL. Migrations run through a separately controlled owner role. Avoid logging URLs or credentials.

Before any database integration test, configure and verify a newly created, dedicated synthetic loopback database. Explicitly reject `mailstack_dev`, non-loopback endpoints, production endpoints, and unknown database names. Never infer test-database safety from environment defaults. This document does not authorize creating or connecting to any database.

## Resource Ownership and Discovery

The default deployment uses a dedicated Compose project, ReadBox-specific labels/names, dedicated persistent volumes, and dedicated networks for supported pinned services. Names and labels must be checked for collision before creation. Teardown only removes resources positively verified as created and owned by ReadBox; no wildcard pruning or shared-volume/network cleanup.

Host scanning is read-only. It distinguishes detected, compatible, reusable, missing, unsupported, and unverified. Reuse requires evidence for version, ownership, configuration compatibility, access boundaries, ports, storage, and impact. Secret-bearing configuration is never displayed or copied into logs. Detection alone never authorizes change.

## Progress, Errors, and Recovery

Progress uses an operation identifier and finite stages, not arbitrary process output. Error responses contain stable safe codes and actionable guidance without stack traces, SQL, credentials, paths that reveal host layout, or customer data. Logs include correlation IDs, operation state, safe result codes, and timestamps only. Retention and access are restricted.

On restart, recover operation state and re-check its postcondition before retry. A partially created resource is adopted only if ownership and expected configuration are verified; otherwise stop for operator review. Never report success until verification passes. Recovery must be documented and must not destroy existing mail or unrelated resources.

## Threat Model and Acceptance

Threats include unauthenticated setup abuse, CSRF, replay, race conditions, command injection, path traversal, privilege escalation, Docker socket compromise, secret leakage, confused-deputy resource cleanup, partial failure, and unsafe restore. Controls include one-time authorization, server-side validation, CSRF/origin protections, typed allowlists, least privilege, explicit ownership, idempotency, output redaction, bounded operations, and verified postconditions.

Acceptance requires tests for unauthorized/replayed requests, concurrent setup, state transition rejection, partial failure and retry, sanitized errors, resource-name collisions, read-only discovery, and worker authorization. Database integration tests require an explicitly verified disposable synthetic loopback database. No host mutation or deployment is part of Phase 5. See [Implementation Roadmap](IMPLEMENTATION-ROADMAP.md).
