# MailStack Architecture Audit and Target Proposal

> **Current-documentation reconciliation — 2026-11-20:** This page preserves a **historical design, migration, or phase snapshot**. Its dated status, legacy Django/MariaDB references, proposed tasks, and older runtime descriptions are **not current ReadBox implementation claims**. The active product is Next.js 16 / React 19 with one PostgreSQL database, inbound-only Postfix/Dovecot, the implemented browser first-admin flow, and optional Manual Mode DNS onboarding. Consult the [current architecture](dev/architecture.md), [current feature guides](users/features/index.md), and [verification report](reference/coverage-and-verification.md) for code-backed behavior. The 17-gate stable production-release decision remains **NO-GO**.

> **Authoritative database policy:** ReadBox uses exactly one PostgreSQL database for all application and database-backed mail-server management data. Prisma remains the application ORM. Any future Postfix/Dovecot database integration must use this same PostgreSQL database, with separate schemas and least-privilege roles where supported, after installed versions, configuration, schema, and lookup contract are verified. Do not add or connect MariaDB, MySQL, SQLite, or a second database. Maildir and message/attachment files remain on the filesystem. Any legacy multi-database descriptions below are historical/source context only and are superseded as target architecture.

## Status and Architectural Boundary

This document records the architectural blueprint and operational boundaries for ReadBox. The production Next.js 15, PostgreSQL, and Node.js target is fully implemented and verified across all application and worker services. The original reference source at `reference/MailStack/` is read-only historical context.

The inspected source snapshot reports version `1.3.5.5` in both `reference/MailStack/VERSION` and `reference/MailStack/mailbox-app/pyproject.toml`. Some repository prose describes older release baselines and phases. Confirm the exact release tag/commit and its matching archive before treating any migration rehearsal as production-ready.

Read-only Git verification found branch `main`, HEAD `72bb6f796dc4934ee3ea3fa3cb3ed5c6f678c97d`, tree `39da28340e9625f7afa6237f05cbfcb055a1ec92`, up to date with `origin/main`. The working tree is not clean: `reference/MailStack/MEMORY.md` is modified. This audit did not change it. Treat the checked code HEAD as the source baseline and explicitly exclude or resolve that local documentation diff before freezing an archive/checksum.

Primary evidence includes the original [archived architecture guide](../reference/MailStack/mailbox-app/docs/ARCHITECTURE.md), `API_REFERENCE.md` (not present in the tracked historical reference snapshot), `FEATURE_MATRIX.md` (not present in the tracked historical reference snapshot), [archived configuration guide](../reference/MailStack/mailbox-app/docs/CONFIGURATION.md), application modules under `reference/MailStack/mailbox-app/apps/`, deployment templates under `reference/MailStack/deployment/templates/`, and the original test suites.

## Historical Source Architecture

```text
Inbound Internet SMTP
  -> Postfix (receive-only; MariaDB recipient/domain/alias maps)
  -> Dovecot LMTP
  -> /var/vmail/<domain>/<local-part>/Maildir
  -> systemd Maildir ingestion worker (Django management command)
  -> MariaDB application records + protected attachment files
  -> Nginx HTTPS -> Unix socket -> Gunicorn/Django

Public visitor
  -> Nginx -> static public website
  -> isolated Unix-socket WSGI contact service
  -> SQLite contact state + fixed local /usr/sbin/sendmail notification

Admin release update
  -> authenticated Django page/API queues a validated request
  -> separate root-owned systemd updater downloads release assets
  -> verified shell upgrade/rollback tooling
```

That database topology describes the historical source system only. It is not the ReadBox target: the Node application, contact state, and any verified database-backed mail-server management data must share one PostgreSQL database, separated by schemas and least-privilege roles where supported. Maildir files remain authoritative message storage; the database index and extracted attachments are derived data. Public contact and privileged update processes remain separate trust boundaries.

## Existing Repository Structure

```text
reference/MailStack/
  install.sh                         Ubuntu 24.04 installation and repair
  mailbox-app/
    apps/accounts/                   Login, user lifecycle, access policy
    apps/audit/                      Structured security audit records
    apps/core/                       Access checks, settings, health, middleware
    apps/dashboard/                  Dashboard, settings, update UI/API
    apps/ingestion/                  Maildir scan, MIME parse, storage, repair
    apps/mailboxes/                  Domains, DNS, provisioning, mail DB adapter
    apps/messages/                   Inbox, message state, attachment delivery
    config/                          Django settings and URL/WSGI/ASGI entry points
    deployment/                      Legacy app deployment templates
    scripts/                         App deploy, backup, restore, update, verification
    static/, templates/              Existing UI assets and Django-rendered pages
    tests/                            Unit, integration, functional, reliability, security
  deployment/templates/              Current Nginx, Postfix, Dovecot, MariaDB, systemd, env
  public-site/                       Static site and isolated contact WSGI app
  scripts/                           Installer, docs/design, forensic and release tooling
  docs/, documents/, design/         Operator docs, user docs, UI/design references
```

Generated environments, caches, bytecode, runtime state and release output are not application source. The outer workspace's `docs/` directory was empty before this Phase 1 deliverable.

## Existing Application Responsibilities

| Module                                 | Verified responsibility                                                                                                                                      |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `apps/accounts`                        | Django authentication, login failure throttling, admin-managed non-admin users, mailbox membership assignment, per-user delete permissions.                  |
| `apps/audit`                           | Audit event persistence, request IP handling, recursive redaction of sensitive detail keys. Persistence failure is logged and does not fail the request.     |
| `apps/core`                            | Admin/object-scope checks, CSP/security headers, live/readiness checks, public site-settings response.                                                       |
| `apps/dashboard`                       | User dashboard and counts, admin settings, and stable-release check/preflight/queue/status endpoints.                                                        |
| `apps/mailboxes`                       | Domain/DNS management, mailbox validation/provisioning, Maildir filesystem creation, MariaDB mail-server synchronization, enable/disable and deletion.       |
| `apps/messages`                        | Scoped inbox, search/filter/pagination, read/unread, soft deletion, sanitized HTML response, attachment authorization/download, bounded live-update payload. |
| `apps/ingestion`                       | Idempotent Maildir polling, MIME parsing, HTML/CSS sanitizer, attachment extraction, counter rebuild, guarded body repair.                                   |
| `public-site/site`                     | Static public pages/assets, including contact and privacy surfaces.                                                                                          |
| `public-site/contact_service`          | Separate WSGI contact API, SQLite persistence, one-use CSRF, validation/abuse checks, fixed local sendmail delivery.                                         |
| `mailbox-app/scripts/update_worker.py` | Root-owned updater request consumer; validates request ownership/URLs and invokes the upgrade script.                                                        |

## Data Model and Boundaries

The current application schema includes Django's default `User` model and framework tables, plus these MailStack models:

| Model               | Important data/relationships                                                                                                                                                |
| ------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `LoginAttempt`      | Normalized username, optional IP, success and timestamp; used for lockout decisions and pruned during login.                                                                |
| `UserAccessPolicy`  | One-to-one with user; `can_delete_messages` and `can_delete_mailboxes`.                                                                                                     |
| `Domain`            | Unique/case-insensitive name; active/disabled, DNS verification state/details, default flag and timestamps.                                                                 |
| `Mailbox`           | Domain FK (`PROTECT`), local part/address, Maildir-relative path, status, counters, last-received time, deletion actor/time.                                                |
| `MailboxMembership` | Unique user/mailbox pair; assignment actor and timestamp.                                                                                                                   |
| `Message`           | Mailbox FK, Maildir source key/hash, MIME headers/addresses, bodies, read/attachment flags, parse status/warning, deletion actor/time. Unique `(mailbox, source_file_key)`. |
| `Attachment`        | Message FK; sanitized display name, unique stored name/path, declared/detected MIME, size/hash, inline/content-id metadata.                                                 |
| `AuditLog`          | Optional actor, action/target, request IP/agent, redacted JSON details and timestamp.                                                                                       |
| `ServiceHeartbeat`  | Service status/details and last-seen time; used by ingestion health/dashboard.                                                                                              |
| `SiteSettings`      | Singleton branding/contact/footer fields and uploaded logo/favicon metadata.                                                                                                |

The Django database also owns built-in authentication, permissions, session, content-type, migration and admin-log tables. Inventory actual row counts and enabled auth/group behavior before deciding which framework-specific rows need a Node equivalent. The mail-server MariaDB schema separately contains `mail_domains`, `mailboxes`, `mail_aliases` and Postfix lookup views. The contact service owns SQLite `csrf_tokens` and `contact_submissions` tables.

Important relationships and invariants: user deletion removes memberships and sets deletion actor references null; mailbox deletion cascades messages/memberships; message deletion cascades attachment rows; normal message deletion is soft and leaves Maildir source intact; mailbox purge removes Maildir and extracted attachments. UUIDs are public route identifiers while numeric primary keys support internal relations and the live cursor.

## Verified Mail and API Behavior

Inbound delivery is not handled by Node or Django. Postfix accepts inbound SMTP on port 25, rejects unauthenticated relay, validates recipients through MariaDB maps, and routes accepted mail to Dovecot LMTP. Dovecot has `protocols = lmtp`, uses Maildir at `/var/vmail/%d/%n/Maildir`, and delivers as `vmail`. The deployment does not enable public SMTP submission, IMAP, or POP3.

The Django application has server-rendered routes and operational endpoints, not a public REST API. See [FEATURE-PARITY.md](FEATURE-PARITY.md) for the current route families and behavior. The contact service's `GET /csrf/`, `POST /`, and `GET /health/` are exposed by the public Nginx location under `/api/contact/`.

The ingestion worker scans `Maildir/new` and `Maildir/cur` without moving source files, rejects files beyond the configured message size, records parse outcomes, extracts bounded attachments, and uses the unique source key to make retries idempotent. It holds an exclusive file lock, updates a service heartbeat, continues after per-message errors, and is supervised by systemd. Body repair re-reads and hash-checks source Maildir data.

## Proposed Node.js Target

### Runtime boundaries

- **Next.js App Router + TypeScript:** Server-rendered application shell, user pages, admin pages, and only the route handlers required for existing browser transports/operations. Preserve current authorization and data scoping; do not introduce an undocumented public API.
- **PostgreSQL + Prisma:** Source of truth for application entities, sessions, audit records and migrations. Use explicit PostgreSQL migrations for functional indexes/check constraints that Prisma schema syntax does not fully express.
- **Dedicated Node workers:** Separate systemd processes for Maildir ingestion, isolated contact handling, and update orchestration. Persistent loops must not run inside Next request handlers or serverless-style execution.
- **Existing mail infrastructure:** Keep Postfix, Dovecot, Maildir, DNS/TLS, and their current recipient/delivery contract. The existing mail-server MariaDB schema/views remain MariaDB; the Node app must use a separate, least-privileged MariaDB adapter/connection for required provisioning/status operations. PostgreSQL and MariaDB do not share a transaction.
- **Public site/contact:** Keep public static pages and their paths. Replace the Python contact WSGI implementation with a separately supervised Node service over a Unix socket, retaining CSRF, rate limits, validation, fixed sendmail target and isolated storage. Parity-first default is to preserve its current separate data store; moving it into PostgreSQL requires explicit approval and its own migration/retention plan.
- **Privileged updates:** Keep root privilege out of Next and ordinary workers. Retain a distinct root-owned systemd updater that accepts only an atomic, permission-checked request and verified official release assets; implement its request consumer in Node or keep the small privileged launcher as an explicitly approved operations exception.

Mailbox provisioning spans PostgreSQL, MariaDB and the filesystem. Implement it as an idempotent orchestrator with the existing lock, deterministic steps, compensation, and a reconciliation/health command. A PostgreSQL transaction cannot make the MariaDB insert or filesystem operations atomic. Preserve the same caution for domain changes and destructive mailbox purge.

### Proposed Application Directory Structure

```text
src/
  app/                              Next.js App Router; layouts, pages, handlers
    (auth)/                         Login and session lifecycle
    (user)/                         Dashboard, mailboxes, inbox and message views
    vcon/                           Admin route group/panel (preserve approved URLs)
    api/                            Health and required browser/internal handlers only
  users/                            User-panel modules and view composition
  vcon/                             Admin-panel modules and view composition
  components/                       Shared UI, shadcn/ui primitives and app components
  core/
    auth/                           Credentials, sessions, login throttling
    accounts/                       User administration and access policies
    domains/                        DNS verification and domain lifecycle
    mailboxes/                      Provisioning, membership, lifecycle, reconciliation
    messages/                       Inbox query, state, soft-delete, live transport
    ingestion/                      MIME parser contract, indexing and repair services
    attachments/                    Confined storage and authorized download
    audit/                          Redaction and durable audit event writer
    health/                         Readiness and operational checks
    mailserver/                     Isolated MariaDB Postfix/Dovecot adapter
    updates/                         Release validation and update request protocol
  lib/                              Shared non-domain utilities
  config/                           Validated environment and runtime configuration
  workers/                          Persistent ingestion/contact/updater entry points
prisma/                             PostgreSQL schema and ordered migrations
public/                             Static/PWA assets served by Next.js
scripts/                            Install, migration, backup/restore and verification CLIs
docs/                               Architecture, parity, migration and security docs
tests/                              Unit, integration, security, reliability and acceptance tests
package.json                        Locked Node scripts/dependencies
```

`src/workers/` and `tests/` extend the initially requested skeleton because the verified product requires independent persistent workers and feature-parity gates. Centralize tokens in the shared design layer and use shared components for consistent user/admin presentation. The existing design documentation and assets should be inspected before changing visual behavior.

## Components to Keep vs Replace

**Replace:** Django views/templates/forms/middleware/auth sessions/ORM; management commands; Gunicorn application runtime; Django-backed app schema; the Python contact WSGI implementation; and the Python updater request consumer if the approved scope removes runtime Python.

**Keep operational behavior and contract:** Postfix SMTP/maps/views, Dovecot LMTP, authoritative Maildir paths/ownership, mail-server MariaDB records, DNS/TLS, Nginx security/protected-file routing (change only the app upstream as needed), systemd confinement, static public pages, installer/backup/restore/release guarantees. Existing scripts that are repository-development/release tooling rather than deployed application runtime are not automatically part of the Node rewrite.

## Verified Corrections and UI Scope

- Authenticated ordinary users can create a mailbox. The create form assigns it to the current user; only admins can assign it to other active non-admin users. Mailbox status changes and domain administration are admin-only.
- `GET` DNS status validates each generated MX/A-or-AAAA/SPF/DKIM/DMARC record. The separate domain `check` action used to change `verification_status` checks only that the expected MX points to the configured mail hostname and that the hostname has at least one A or AAAA answer. A verified result does not itself enable a disabled domain. Keep these behaviors distinct in tests.
- The original application UI uses Inter/system font stacks and has a light foundation; the static public site also uses Inter and has a web manifest. The reviewed app templates do not link a web manifest or register a service worker. The required Segoe UI, complete light/dark app themes and app PWA are therefore explicit target requirements, not claims of existing webmail behavior.
- The contact service is presently Python WSGI/Gunicorn plus Python standard-library SQLite, not Django. The deployed app dependency file is `mailbox-app/requirements/production.txt`, which includes `requirements/locked.txt`; `pyproject.toml` and `requirements/base.txt` are not identical manifests. `tinycss2` is in the deployed lock and project metadata, though omitted from `requirements/base.txt`.

## Module Boundaries

| Module   | Owner and responsibility                                                                                                                      | Must not own                                                                                               |
| -------- | --------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| Mailbox  | `src/core/mailboxes/`: user/domain membership checks, lifecycle, quotas, lock-protected provisioning and purge orchestration.                 | SMTP acceptance, raw mail parsing, or an assumption that PostgreSQL can transact with MariaDB/filesystems. |
| Delivery | `src/core/delivery/` plus `src/workers/delivery/`: Maildir polling, idempotency, MIME extraction, indexing, counters, heartbeat and repair.   | Postfix SMTP or Dovecot LMTP; Maildir is read-only to routine ingestion.                                   |
| Database | `src/core/database/`: Prisma PostgreSQL client/schema/migrations plus isolated MariaDB and contact-SQLite adapters as needed.                 | Cross-database transactions or privilege-bearing migration SQL in request handlers.                        |
| Domain   | `src/core/domains/`: domain lifecycle, status, default selection and mailserver reconciliation.                                               | DNS packet parsing or silently changing a domain name with existing mailboxes.                             |
| DNS      | `src/core/dns/`: record construction and verification; separate full record-status check from activation verification.                        | Mailbox row mutation outside the domain service.                                                           |
| Postfix  | `src/core/postfix/`: strict adapter/contract checks for existing MariaDB maps/views and recipient lifecycle.                                  | Replacing Postfix, owning its DB, or exposing its credentials to UI code.                                  |
| Server   | `src/core/server/` and service entry points: readiness, validated runtime configuration and process/service contracts.                        | Running root operations from Next request context.                                                         |
| Storage  | `src/core/storage/`: confined Maildir/attachment/media paths, safe filenames, hashes, permissions and cleanup.                                | Serving private files as public assets or deleting authoritative Maildir content during indexing.          |
| APIs     | `src/app/api/` and server actions: only current browser transports, health/site-settings and explicitly supported contact/updater boundaries. | A new undocumented public REST API.                                                                        |
| Security | `src/core/security/` and `src/core/auth/`: session, CSRF, login limits, object scope, headers, redaction and input/path policy.               | UI-only authorization or policy decisions that can be bypassed by direct requests.                         |

Cross-module calls flow through typed service functions. UI modules in `src/users/` and `src/vcon/` consume those services but do not access Prisma/MariaDB clients directly. `src/components/` owns shared shadcn/ui components and theme-aware tokens.

## Required UI Contract

- Next.js App Router, TypeScript, Tailwind CSS and shadcn/ui; compact, clean, professional mailbox and admin surfaces.
- Segoe UI is the only named interface typeface. Do not bundle or redistribute Segoe UI without confirming the applicable license; define a documented system fallback for hosts where it is unavailable.
- Centralized semantic design tokens supply both light and dark themes; user and admin panels share those tokens and reusable components.
- Desktop and mobile layouts must preserve the current core workflows and accessible keyboard/focus behavior.
- Add app-specific PWA manifest/installability and service-worker support. Cache only versioned public/static assets and a generic offline fallback; never cache authenticated HTML, message bodies, attachment responses or API data. The public-site manifest is not proof of webmail PWA support.
- Keep the compact inbox and unified reader behavior. Any design change beyond these explicit UI requirements needs separate review against the existing design references.

## Required Architecture Decisions Before Phase 2

1. Confirm source tag/commit and resolve older release claims in source documentation.
2. Approve current user-visible mailbox delete semantics: model/service has soft-delete, but the present delete routes call permanent purge.
3. Decide whether contact state remains in its isolated SQLite store or moves to a dedicated PostgreSQL schema/role.
4. Define session/password-hash compatibility and whether active browser sessions are intentionally invalidated at cutover.
5. Approve how root updater code will be migrated while preserving its privileged isolation.
