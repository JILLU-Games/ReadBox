# MailStack Implementation Blueprint

> **Current-documentation reconciliation — 2026-11-20:** This page preserves a **historical design, migration, or phase snapshot**. Its dated status, legacy Django/MariaDB references, proposed tasks, and older runtime descriptions are **not current ReadBox implementation claims**. The active product is Next.js 16 / React 19 with one PostgreSQL database, inbound-only Postfix/Dovecot, the implemented browser first-admin flow, and optional Manual Mode DNS onboarding. Consult the [current architecture](dev/architecture.md), [current feature guides](users/features/index.md), and [verification report](reference/coverage-and-verification.md) for code-backed behavior. The 17-gate stable production-release decision remains **NO-GO**.

> **Authoritative database policy:** ReadBox uses exactly one PostgreSQL database for all application and database-backed mail-server management data. Prisma remains the application ORM. Any future Postfix/Dovecot database integration must use this same PostgreSQL database, with separate schemas and least-privilege roles where supported, after installed versions, configuration, schema, and lookup contract are verified. Do not add or connect MariaDB, MySQL, SQLite, or a second database. Maildir and message/attachment files remain on the filesystem. Any legacy multi-database descriptions below are historical/source context only and are superseded as target architecture.

## Status

Phase 2 audit verification and planning only. No application code is authorized yet. `reference/MailStack/` is the read-only source of truth; coding begins only after explicit approval of the open decisions below.

The inspected source declares version `1.3.5.5`. Read-only Git verification found branch `main`, HEAD `72bb6f796dc4934ee3ea3fa3cb3ed5c6f678c97d`, tree `39da28340e9625f7afa6237f05cbfcb055a1ec92`, up to date with `origin/main`; the latest commit subject is “Fix ingestion service project root”. The working tree has a pre-existing modification to `reference/MailStack/MEMORY.md`, which this audit did not change. Confirm the intended treatment of that diff and record the matching release/tag status and source archive checksum before migration rehearsal or production use. Some original documents describe older release/phase states.

## Target Runtime

```text
Browser
  -> Nginx TLS / existing host routing
  -> Next.js App Router (Node.js, Unix socket, systemd)
      -> PostgreSQL via Prisma for application records
      -> MariaDB adapter for existing mail-server lifecycle records only
      -> protected filesystem paths for attachments/media

Inbound SMTP
  -> existing Postfix + MariaDB recipient views
  -> existing Dovecot LMTP socket
  -> authoritative existing Maildir
  -> dedicated Node delivery/index worker
  -> PostgreSQL metadata + protected attachment storage

Public static site -> existing Nginx paths/assets
Contact API -> separate Node service + SQLite state + fixed local sendmail
Admin update request -> narrow queue -> separate root-owned updater service
```

Next.js is not an SMTP/LMTP server. Keep Postfix, Dovecot, Maildir, DNS/TLS, Nginx, MariaDB mail schema/views and systemd operational boundaries. PostgreSQL is the application database, not a replacement for Postfix's MariaDB lookup contract. The existing contact service remains isolated and SQLite-backed by default; do not fold it into the main app without approval.

## Project Structure

```text
src/
  app/                              Next.js App Router layouts/pages/handlers
    (auth)/                         Login and session routes
    (user)/                         Dashboard, mailboxes, inbox and reader routes
    vcon/                           Admin route segment where URL compatibility permits
    api/                            Existing internal transports/health handlers only
  users/                            User-panel composition, forms and view modules
  vcon/                             Admin-panel composition, forms and view modules
  components/                       Shared shadcn/ui components and accessible primitives
  core/
    accounts/                       User lifecycle, access policy, memberships
    auth/                            Password verification, sessions, throttling, CSRF
    audit/                           Redacted durable audit events
    database/                        Prisma Postgres client + isolated MariaDB/SQLite clients
    delivery/                        Maildir scan, parser, index, counters, repair
    domains/                         Domain lifecycle and mailserver reconciliation
    dns/                             DNS record generation and verification
    health/                          Live/readiness and application contracts
    mailboxes/                       Mailbox lifecycle and provisioning orchestration
    messages/                        Scoped queries, read state, delete, live payload
    postfix/                         MariaDB map adapter and Postfix contract checks
    security/                        Authorization policy, headers, path/input policy
    server/                          Validated runtime/service configuration
    storage/                         Maildir/attachment/media path and file handling
    updates/                         Official release validation and request protocol
  config/                            Typed environment loading and validated settings
  workers/                           Persistent delivery, contact and update entry points
prisma/
  schema.prisma
  migrations/                       Reviewed PostgreSQL SQL migrations
public/                              Public static assets, manifest and safe PWA assets
scripts/                             Install, data import, backup/restore and verification CLIs
docs/                                Audit, feature parity, migration and security plans
tests/
  unit/                              Domain, parser, validation and storage tests
  integration/                       PostgreSQL/MariaDB and worker contract tests
  security/                           Authorization, sanitizer, path and process tests
  e2e/                                User/admin/contact/installation browser workflows
package.json
package-lock.json                    Or the explicitly approved package manager lockfile
```

Preserve existing externally used URLs where practical. If a Next route group changes a URL, keep a tested redirect or explicit Nginx compatibility mapping; do not silently break saved bookmarks or the current contact/live-update clients.

## Module Contracts

| Module   | Responsibilities                                                                                                                                                                                                       | Dependencies and boundary                                                                                                                              |
| -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Mailbox  | Domain-scoped mailbox create/enable/disable/purge; membership assignment; quotas; lock and reconciliation. Ordinary users may create a mailbox assigned to themselves; admins can assign other active non-admin users. | Prisma PostgreSQL + separate MariaDB adapter + filesystem. No distributed transaction; orchestrate idempotent steps and compensation.                  |
| Delivery | Poll Maildir `new`/`cur`, stable source keys and hashes, parse MIME, store metadata/attachments, update counters/heartbeat, repair from verified source.                                                               | Dedicated Node worker, PostgreSQL, read-only Maildir, protected attachment store and cross-process lock. No SMTP listener or Maildir mutation.         |
| Database | Own Prisma schema/client, SQL migrations, import checkpoints, role grants and health checks. Expose typed repository/service calls rather than a global ORM in UI.                                                     | PostgreSQL is app source of truth. Separate MariaDB client only for mail-server schema. Keep contact SQLite adapter isolated by default.               |
| Domain   | Domain states, default selection, immutable-name rule, mailbox eligibility and mailserver active-state reconciliation.                                                                                                 | PostgreSQL domain record + MariaDB mail-domain operations. No raw DNS/network parsing.                                                                 |
| DNS      | Build current record set and perform both full DNS-record status and narrower activation checks.                                                                                                                       | DNS resolver, validated hostname/IP config and DKIM public-key source. Keep the two check levels separate.                                             |
| Postfix  | Read/update only the existing domain/mailbox rows needed for provisioning/status; verify existing SQL views/maps.                                                                                                      | Dedicated least-privilege MariaDB connection. Postfix itself and its read-only query user/views stay unchanged. Never retrieve stored password hashes. |
| Server   | Next process configuration, liveness/readiness checks, service probes and deployment contracts.                                                                                                                        | systemd/Nginx/PostgreSQL/filesystems. No privileged host mutation in request handlers.                                                                 |
| Storage  | Canonical Maildir and attachment/media roots; symlink/traversal protection, hashes, safe names, modes and purge.                                                                                                       | Node filesystem APIs plus `vmail`/contact identities and Nginx internal attachment alias. Maildir is authoritative.                                    |
| APIs     | Existing server-rendered flows, live-update transport, health/site-settings and contact/updater boundaries.                                                                                                            | Next App Router handlers/actions; authentication and authorization called at service boundary. No general public REST API.                             |
| Security | Authentication, CSRF, object-level checks, CSP/headers, safe redirect, rate-limits, redaction, request validation and safe response behavior.                                                                          | Every action/route/service; never rely on hidden UI controls.                                                                                          |

## Authentication and Authorization

- Use PostgreSQL-backed opaque server sessions with random tokens stored only as hashes. Rotate on login and privilege change; invalidate on logout, deactivation and password change. Default cutover behavior is to expire Django sessions.
- Store secure, HttpOnly, SameSite=Lax cookies; set `Secure` in production. Use CSRF tokens for every state-changing browser operation and POST-only logout. Validate host/origin and safe local redirects.
- Preserve Django Argon2 hash verification with a maintained Node Argon2 implementation only after automated format verification. If incompatibility is found, pause for approval of a forced reset/first-login migration; never silently reset or rewrite hashes.
- Preserve current active/admin semantics: active `is_staff` or `is_superuser` maps to admin; inactive users cannot act. Keep public registration absent.
- Put mailbox/message/attachment authorization in shared server-only services. Admins can access all non-deleted objects; ordinary users only objects reached through active membership. Return non-enumerating 404s for unauthorized object IDs.
- Preserve separate delete grants and the current explicit route behavior. Message deletion is soft. Single-mailbox deletion is permanent purge after typed full-address confirmation; bulk deletion is also permanent purge after a browser `window.confirm()` and selected UUIDs. Changing mailbox purge to soft-delete requires approval.
- Preserve failed-login counts by normalized username + trusted client IP, current configured limit/window/lockout, pruning and audit. Trust forwarded headers only behind the configured Nginx proxy.

## Database and Mail-Server Access

1. Prisma connects only to PostgreSQL for application users, policies, domains, mailboxes, memberships, messages, attachment metadata, audit, heartbeat, settings and sessions.
2. Use explicit reviewed Prisma migrations and custom SQL for functional case-insensitive indexes/check constraints. Do not let Next runtime auto-create or alter schema.
3. Use distinct PostgreSQL migration-owner, web-runtime and worker credentials. Runtime roles receive only needed DML; migrations run in a separate deploy step.
4. Use a separate MariaDB client/credential for the current `mail_domains`, `mailboxes`, `mail_aliases` and Postfix views. Restrict reads/writes to exact columns needed by provisioning, activation and sync. Postfix's own user remains read-only and has no secret-column access.
5. Keep contact data in its current separate SQLite database and process by default, backed up/restored as now. If moving it to PostgreSQL is approved later, use a separate schema/role and documented retention/migration.
6. Never imply a transaction spans PostgreSQL, MariaDB and files. Provisioning/purge must be idempotent, locked and reconcileable after each external effect.

## Background Workers and Service Supervision

- **Delivery worker:** one persistent systemd service; gracefully handle SIGTERM, scan `new`/`cur`, do not follow symlinks or move source, persist a unique `(mailbox, source_file_key)` index, continue per-file failures, update heartbeat and recover from restart. Keep the configured poll interval and size limits validated from runtime settings (the inspected defaults are 15 seconds, 25 MiB messages and 20 MiB extracted attachments; deployment values can override them).
- **Contact service:** separate service/user/Unix socket and state directory. Preserve one-time CSRF, size/field/timing/honeypot/rate validation, SQLite pending/sent/failed state, fixed sendmail target/argv/timeout and current response semantics.
- **Root updater:** separate root-owned systemd process. Next can only queue the exact validated request. Worker validates owner/mode/keys/official URLs/checksum/archive and invokes the reviewed upgrade operation; no root shell or arbitrary command is reachable from web routes.
- **Locking:** preserve fail-fast/exclusive process locking for ingestion and timeout behavior for mailbox provisioning. Lock files/dirs must be absolute, non-symlinked, owner/mode checked and cleaned safely.
- **Shutdown/health:** bounded graceful shutdown, systemd restart policy, service heartbeat and contract checks. A readiness route must not claim SMTP delivery works unless it actually probes that contract.

## Logging, Errors, and Observability

- Emit structured JSON to stdout/stderr for systemd journal collection; optionally retain the existing rotating application log with explicit retention/permissions. Never log passwords, tokens, session cookies, raw message bodies, attachment content or contact form message text.
- Attach request/correlation IDs to logs and audit events; use stable event/action names and safe error types. Redact sensitive keys recursively as current audit service does.
- Persist security-relevant audit events in PostgreSQL. The current service treats audit DB persistence failure as best-effort and logs the failure; preserve this until an owner decides whether the Node target requires a durable fallback, and test both behaviors.
- Return stable validation/authorization/operational errors without stack traces, SQL text, filesystem paths or secrets. Log detailed exceptions server-side with redaction.
- Handle PostgreSQL transaction errors locally. For MariaDB/filesystem partial failures, expose a reconciliation status/command instead of claiming rollback succeeded.
- Readiness reports coarse dependency status only, is loopback-restricted by Nginx, and never prints secret values or absolute storage paths.

## Configuration and Secrets

- Load secrets from root-owned systemd EnvironmentFiles or protected secret files; validate all values once at process start and fail closed in production. Do not commit runtime secrets or copy production values into examples.
- Preserve the concepts and validation of current settings: domain/app/mail/public hostnames; server IP; public origin/allowed host/origin and proxy trust; Postgres and MariaDB credentials/table identifiers; quota; Maildir/attachment/media/lock/log roots; message/attachment size limits; ingestion interval; live-update limits; session age; login threshold/window/lockout; TLS/proxy settings; and contact configuration.
- Preserve current source defaults only as defaults, not claimed production values: 2 GiB mailbox quota, 25 MiB message limit, 20 MiB attachment limit, 15-second ingestion interval, live limits of 25 messages/250 mailboxes/50 requested visible mailboxes, 1-hour session age, and login limit/window/lockout defaults of 5/900/900 seconds. Validate actual deployment environment before cutover.
- Validate DNS hostnames, IPv4/IPv6, SQL identifiers (`^[A-Za-z0-9_]+$` equivalent), allowed origins, absolute non-root paths, lock/storage roots, numeric bounds and minimum secret entropy.
- Keep separate app/contact/updater secrets and identities. Document rotation and backup requirements; never expose config endpoints publicly.

## UI, Themes, and PWA

- Next.js App Router, TypeScript, Tailwind CSS and shadcn/ui. Keep the interface compact and professional, with distinct user and admin panels and shared reusable components.
- Segoe UI is the only named typeface. Because it is proprietary and absent from some Ubuntu/browser environments, do not bundle it without license approval; define and verify an OS fallback without another branded font stack.
- Centralize semantic tokens for light and dark themes. All shared components, user/admin views, focus states, status colors and dialogs consume those tokens; do not duplicate arbitrary local palettes.
- Responsive acceptance viewports: 320, 768 and 1280 CSS pixels. Verify no horizontal overflow, clipped form labels, overlapping controls or lost core actions; keyboard/focus and reduced-motion behavior remain accessible.
- Add a webmail-specific PWA manifest, icons, install metadata and service worker. Cache versioned public assets and a generic offline fallback only. Never cache user HTML, inbox/message bodies, attachments, site settings with private data, live JSON or authenticated API responses. No offline-mailbox feature is implied.
- Test installability, service-worker update/activation, cache inspection, logout/shared-device behavior and both themes in browser automation.

## PostgreSQL Migration and Rollback

Follow the detailed staged procedure in [MIGRATION-PLAN.md](MIGRATION-PLAN.md). Core invariants:

- Copy Django auth identities and flags, password hashes, domain/mailbox/membership/policy relations, every message/attachment metadata row including soft-deleted state, audit/heartbeat/site settings and required framework history. Preserve original UUIDs and numeric IDs when feasible; remap only through a deterministic mapping report.
- Preserve timestamps/time zones, JSON, nullable values, case-insensitive uniqueness, foreign keys, status checks and query indexes. Resolve collisions before import; do not silently merge users or mailboxes.
- Keep `Maildir` and attachment files at their existing canonical roots. Verify source-key/hash references and attachment size/hash; rebuild cached counters from non-deleted messages and compare to source.
- Keep the mail-server MariaDB schema and Postfix views unchanged. Keep contact SQLite isolated by default. Do not dual-write the same app data across PostgreSQL and MariaDB.
- Use checkpointed import, counts and checksums, protected backup, isolated rehearsal and final write freeze. Let Postfix/Dovecot continue accepting mail while web/worker services are paused; ingest the final Maildir delta before reopening.
- Rollback after Node writes requires stopping writes, preserving PostgreSQL state, reconciling any MariaDB mail-domain/mailbox writes, and retaining/replaying Maildir arrivals. Never blindly restore old MariaDB app data or Maildir over newer accepted mail. Retain the original app database and release until the approved rollback window ends.

## Python/Gunicorn Replacement Boundary

All deployed Python roles have a target: Django app -> Next.js; Django ORM/migrations -> Prisma and SQL migrations; Django auth/forms/middleware/templates/management commands -> typed server services, auth/session/CSRF, App Router and operator CLIs; `mysqlclient` -> Prisma/PostgreSQL plus a separate MariaDB driver; Argon2 -> compatible Node binding; Bleach/tinycss2 -> reviewed sanitizer/CSS parser; `filelock` -> reviewed cross-process lock; Gunicorn app/contact -> Next server and isolated Node contact service; `python-dotenv` -> systemd env injection/validated config; WhiteNoise -> Next/Nginx static delivery; Python updater/verifiers/renderers -> Node CLI/services where deployed.

Dev Python tools map to Vitest/V8 coverage, Playwright, ESLint/TypeScript checks, Node-aware SAST and npm/OSV dependency audit. Repository-only forensic/docs/design/release scripts are not deployed dependencies: either leave them untouched during app migration or approve a separate one-for-one Node tooling port. Do not claim the repository is Python-free until all 168 discovered `.py` paths have been classified and all in-scope paths have replacements; generated environments/caches must be excluded from that source inventory.

Candidate packages such as `argon2`, `mysql2`, a MIME parser, an HTML sanitizer/CSS AST parser, SQLite adapter and lock library require pinning, license/security review and parity proof before inclusion in `package.json`. This document does not install dependencies.

## Prioritized Implementation Sequence and Acceptance

### P0 — Approval and baseline

- Freeze full source SHA/tree/archive checksum and reconcile release metadata.
- Approve current permanent mailbox-purge behavior, contact SQLite retention, session invalidation, hash compatibility/reset fallback, updater language and whether repository Python tooling is in scope.
- Confirm Segoe licensing/fallback and PWA cache policy.

**Accept when:** signed decision record; no unresolved source baseline; all required test/deployment data is isolated and protected.

### P1 — Compatibility tests and data model

- Port original unit/integration/security/reliability/functional/contact test cases into the Node test matrix.
- Define Prisma schema and SQL for case-insensitive constraints/indexes and relations; implement a dry-run/checkpointed import utility only after approval.

**Accept when:** each row in `FEATURE-PARITY.md` has a named passing Node test or recorded host acceptance; schema tests cover all constraints and both DB adapters; synthetic parser fixture differential suite passes.

### P2 — Database adapters and Maildir worker

- Implement PostgreSQL repositories, least-privileged MariaDB adapter, Maildir storage abstractions and persistent delivery worker.

**Accept when:** restart/retry creates no duplicates; messages/attachments are hash-stable; worker never mutates Maildir; unknown/disabled/active recipients map exactly to Postfix behavior; fault injection proves recovery after each cross-system step.

### P3 — Auth, API/service boundaries, user/admin workflows

- Implement auth/CSRF/authorization first, then user lifecycle, domain/DNS, mailbox, inbox/message, attachments, live updates, health/settings and update queue.

**Accept when:** every route is tested as anonymous, inactive, admin, assigned member and unassigned member; forbidden IDs do not enumerate; current semantics and response/status contracts pass.

### P4 — UI, themes, and PWA

- Implement compact Next UI with Tailwind/shadcn, Segoe-only named font policy, centralized light/dark tokens, mobile views and safe PWA.

**Accept when:** 320/768/1280 browser tests show no overflow/overlap; both themes pass contrast/focus checks; installability succeeds; browser cache contains zero authenticated content after login/logout and app update.

### P5 — Installer, deployment, backup/restore and security gate

- Replace deployed Python services and install dependencies; retain Postfix/Dovecot/Maildir/Nginx/systemd contracts; add PostgreSQL backup/restore and update manifests.

**Accept when:** clean Ubuntu 24.04 install/repair and reboot pass; verified restore recovers PostgreSQL, MariaDB mail state, Maildir, attachments, contact SQLite and config; protected modes/owners verified; dependency audit/SAST/typecheck/lint/build pass.

### P6 — Shadow rehearsal, cutover and rollback rehearsal

- Import a protected snapshot into isolated services; compare, run synthetic SMTP/LMTP delivery, execute final Maildir delta, and rehearse rollback after synthetic Node mutations.

**Accept when:** zero unexplained row/FK/hash/counter deltas; no lost/duplicate accepted mail; every feature mapping is green; rollback preserves Node mutations/MariaDB contract/Maildir arrivals; operations owner signs off. Production acceptance is separate and must not be claimed from local tests.

## Open Decisions Before Coding

1. Full source baseline identity: current version is `1.3.5.5` and Git log shows abbreviated HEAD `72bb6f7`; full SHA, tree and matching archive checksum remain to be recorded.
1. Release artifact identity: source HEAD and tree are recorded above, but resolve/exclude the pre-existing `MEMORY.md` working-tree change and verify the matching tag/archive checksum before freezing the migration artifact.
1. Does “replace every Python dependency” include repository-only forensic, documentation, design, release and CI scripts, or only deployed application/runtime code?
1. Confirm permanent mailbox purge is intended current behavior despite the unused soft-delete helper.
1. Keep contact SQLite as-is or explicitly approve a move to PostgreSQL.
1. Approve Django-session invalidation and Argon2-compatible login migration/reset strategy.
1. Keep updater as isolated Python briefly or port it to Node while retaining root/systemd separation.
1. Confirm Segoe UI availability/licensing and approved fallback on Ubuntu.

No coding starts until these decisions and the blueprint are approved.
