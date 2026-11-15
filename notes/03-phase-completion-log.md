# 03 — Update Phase Completion Log (Strict Change Ledger)

> **Document ID:** `DOC-003`  
> **Purpose:** Single source of truth tracking completed vs remaining phases, exact features/bugfixes delivered per phase, exact **Scope Lock** boundaries preserved (other features/UI left untouched), and verification evidence.  
> **Workflow Rule:** Update this file **immediately** at the end of every phase before moving to the next phase.

---

## 1. Live Progress Summary

- **Baseline Tag:** `BASELINE-2026-11-15` (Frozen)
- **Phases Completed:** `6 / 8` (`Phase 0`, `Phase 1`, `Phase 2`, `Phase 3`, `Phase 4`, `Phase 5` completed; `Phase 6` and `Phase 7` pending)
- **Current Status:** **Phase 5** completed and verified (`verify:safe`, `test:ui` 39/39, `compile_applet`, `lint_applet`, and headless Chromium browser checks on `/users`, `/users/mailboxes`, `/api/messages/live`, `/api/messages/html/*`, and `/api/messages/attachment/*` at desktop `1440x900` & mobile `390x844` all pass); awaiting user approval to begin **Phase 6**.
- **Next Authorized Phase:** **Phase 6 — `/vcon/settings`, `/vcon/system-update`, Health Readiness & VPS Templates** (pending approval)

---

## 2. Master Phase Status Board

| Phase | Name | Status | Features Added / BugFixes Completed | Remaining Next Scope | Verification Status |
|---|---|---|---|---|---|
| **Baseline** | `BASELINE-2026-11-15` | **FROZEN** | Dual-mode dev auth (`bypass`/`demo`), HTTPS iframe cookies, Prisma 14-table schema, setup pure planners, UI shell tokens | All `Phase 0..7` items | Superseded by Phase 0 |
| **Phase 0** | Baseline BugFixes & Auth Lockout Hardening | **COMPLETED** | Fixed `BUG-001` (`postgres-target.test.ts` Linux paths), `BUG-002` (`dual-mode-env.test.ts` in `test:auth:core`), `BUG-003` (trusted-proxy `extractClientIp`, per-IP + username burst lockout, `max(window, lockout)*8` pruning, failure clear, `User.lastLogin`) | None (P0 complete) | `verify:safe` PASS (0 exit), `test:ui` 21/21 PASS, `compile_applet` PASS, `lint_applet` PASS |
| **Phase 1** | Single-PostgreSQL `mailserver` Schema, Audit Core & Role-Aware Shell | **COMPLETED** | `mailserver` schema migration + `postfix_lookup` grants (`GAP-001`), `recordAudit()` w/ secret redaction + auth wiring (`GAP-002`, `BUG-003`), `UserAccessPolicy` & strict `AdministratorProfile` helper (`GAP-003`, `BUG-007`), role-aware `AppShell` + Sign Out + `/vcon` redirect (`BUG-004`, `GAP-004`) | None (P1 complete) | `verify:safe` PASS (0 exit), `test:ui` 23/23 PASS, `compile_applet` PASS, `lint_applet` PASS |
| **Phase 2** | `/vcon` Overview, User Management & Audit/Security UI | **COMPLETED** | `/vcon` KPIs + health strip (`GAP-005`), `/vcon/users/*` CRUD + generators + `"Create & copy"` + guards (`GAP-006`), `/vcon/audit` viewer (`GAP-007`, `DISC-004`), `(workspace)/error.tsx` & `/vcon/not-found.tsx` | None (P2 complete) | `verify:safe` PASS (0 exit), `test:ui` 27/27 PASS, `compile_applet` PASS, `lint_applet` PASS, Playwright PASS |
| **Phase 3** | `/vcon/domains` DNS Engine & `/vcon/mailboxes` Provisioning + Purge | **COMPLETED** | Real PostgreSQL `PgReadOnlyMailServerAdapter` + SQL identifier allowlist & `mailserver` sync, 5-record DNS engine + OpenDKIM + Cloudflare BIND export + split routing/deliverability verification (`DISC-002`), locked & `confinedPath` `0700` Maildir provisioning + rollback, `/vcon/domains/*`, `/vcon/mailboxes/*` toggle/typed purge/bulk purge/system mailboxes (`DISC-001`, `GAP-008`, `GAP-009`) | None (P3 complete) | `verify:safe` PASS (0 exit), `test:ui` 32/32 PASS, `compile_applet` PASS, `lint_applet` PASS, Playwright PASS |
| **Phase 4** | Maildir Ingestion, HTML/CSS Sanitizer & `/vcon/operations` | **COMPLETED** | `postal-mime` parser + `sanitize-html`/`css-tree` AST allowlist sanitizer (`128KB`/`256KB`/`512-rule`/`8-depth`, raster `data:image/*` only), confined `0600` sharded attachments + rollback cleanup, `ingestUnindexedMaildirFiles` + `proper-lockfile` + `ServiceHeartbeat("maildir_ingestion")` + `mail:ingest` CLI (`DISC-003`, `GAP-010`), SHA-256 verified `repairMessageBodies` + `/vcon/operations` console (`DISC-004`, `GAP-011`) | None (P4 complete) | `verify:safe` PASS (0 exit), `test:ui` 34/34 PASS, `compile_applet` PASS, `lint_applet` PASS, Playwright PASS |
| **Phase 5** | User Workspace (`/users` Inbox, Sandboxed Reader, Attachments, Live) | **COMPLETED** | Membership-scoped `/users` overview + `/users/mailboxes` self-create (`Generate` + `"Create & copy"`) & `canDeleteMailboxes` purge + `/users/inbox/[mailboxUuid]` 30/page filters (`senderName`/`senderAddress`/`subject`, unread, attachments) + `/users/inbox/[mailboxUuid]/[messageUuid]` auto-read/unread/`canDeleteMessages` soft-delete preserving Maildir + `/api/messages/html/[messageUuid]` strict CSP `<iframe sandbox="">` + `/api/messages/attachment/[attachmentUuid]` confined download (`X-Accel-Redirect`, `nosniff`, `private, no-store`) + `/api/messages/live` (`X-MailStack-Live-Request: 1`) + cross-tab `BroadcastChannel`/`localStorage`/`navigator.locks` Web Notifications (`GAP-012`) | None (P5 complete) | `verify:safe` PASS (0 exit), `test:ui` 39/39 PASS, `compile_applet` PASS, `lint_applet` PASS, Playwright PASS |
| **Phase 6** | `/vcon/settings`, `/vcon/system-update`, Readiness & VPS Templates | **PENDING (NEXT)** | — | `SiteSettings` + safe logo/favicon upload + public CORS API, System Update check/preflight/queue, `/health/ready`, Postfix `pgsql:` + `pg_dump` backups | Not started |
| **Phase 7** | Browser QA (320/768/1280px, Themes, PWA) & VPS Cutover Gate | **LOCKED (After P6)** | — | Fix `BUG-006` (320px responsive), full browser matrix (Light/Dark, Reduced Motion, SW cache), `test:postgres`, production cutover sign-off | Not run |

---

## 3. Non-Regression Scope-Lock Protocol (Mandatory Per Phase)

Before writing a single line of code in any Phase `N`:
1. Confirm Phase `N - 1` is marked **COMPLETED** in Section 2 & Section 4 below.
2. Inspect ONLY files listed under `IN SCOPE` in `notes/02-phase-roadmap-and-scope-locks.md` for Phase `N`.
3. Explicitly verify **zero unintended diffs** in out-of-scope modules:
   - Never break existing `.env.development` (`DEV_AUTH_MODE=bypass|demo`) behavior during production upgrades.
   - Never alter PostgreSQL-only `AGENTS.md` architecture.
   - Never touch unrelated `/users` UI during `/vcon` phases (Phases 2–4), and never touch `/vcon` admin UI during `/users` Phase 5.
4. After passing Phase `N`'s Verification Gate, append an entry under Section 4 and update `notes/05-actual-implementation-status.md`.

---

## 4. Detailed Phase Execution Log Entries

### Entry 00 — Baseline Freeze (`BASELINE-2026-11-15`)
- **Date:** 2026-11-15
- **Scope Executed:** Documentation & audit only (`notes/*` created; zero application source/schema modifications).
- **Features Added / Updated:** None (code frozen at baseline).
- **Pre-Existing Baseline Findings Recorded:**
  - `BUG-001` identified in `tests/auth/postgres-target.test.ts:27` (Windows `\\compose.yaml` path fails Linux `verify:safe`).
  - `BUG-002` identified in `package.json` (`dual-mode-env.test.ts` not wired into `test:auth:core`).
  - `BUG-003..007` and `GAP-001..016` documented in `notes/01-production-readiness-audit-and-bugs.md`.
- **Untouched Verification:** All existing `/src/`, `/prisma/`, `/package.json`, `/public/`, `/scripts/`, `/tests/` files left 100% untouched.
- **Next Step:** Execute **Phase 0** upon user authorization.

---

### Entry 01 — Phase 0: Baseline BugFixes & Auth Lockout Hardening
- **Date Completed:** 2026-11-15
- **Scope Lock Compliance:** Verified — modified strictly `Phase 0 IN SCOPE` files (plus `.env.example` & `src/core/auth/password-policy.ts` to declare new env vars/constants cleanly); zero UI components, `/users`, `/vcon`, `AppShell`, `SignInForm`, `dev-demo-auth.ts`, or `prisma/schema.prisma` modified.
- **Bugs Fixed / Features Added:**
  - `BUG-001`: Replaced hardcoded Windows `\\compose.yaml` & `\\compose.override.yaml` paths in `tests/auth/postgres-target.test.ts` with cross-platform `node:path` `join()`.
  - `BUG-002`: Added `tests/auth/dual-mode-env.test.ts` to `package.json` `test:auth:core` so dual-mode/proxy/cookie/IP-extraction checks run automatically in `npm run test:auth` and `npm run verify:safe`.
  - `BUG-003`: Added `TRUST_PROXY_HEADERS`, `LOGIN_FAILURE_LIMIT`, `LOGIN_FAILURE_WINDOW_SECONDS`, `LOGIN_LOCKOUT_SECONDS` env settings (`.env.example`, `src/config/env-schema.ts`); added `extractClientIp()` in `src/core/auth/proxy-request.ts` (`node:net` `isIP()` validated); upgraded `authorizeCredentials()` in `src/core/auth/credentials.ts` and `src/auth.ts` for per-(username, clientIp) advisory locking, burst-window failure counting + `LOGIN_LOCKOUT_SECONDS` lock expiry, `max(window, lockout) * 8` pruning, clearing prior failures on success, and `User.lastLogin` updates. *(Note: centralized `AuditLog` event writing remains scheduled for Phase 1 `GAP-002`.)*
- **Files Modified:**
  - `tests/auth/postgres-target.test.ts` — cross-platform path join fix (`BUG-001`).
  - `package.json` — wired `tests/auth/dual-mode-env.test.ts` into `test:auth:core` (`BUG-002`).
  - `.env.example` & `src/config/env-schema.ts` — added & validated `TRUST_PROXY_HEADERS`, `LOGIN_FAILURE_LIMIT`, `LOGIN_FAILURE_WINDOW_SECONDS`, `LOGIN_LOCKOUT_SECONDS`.
  - `src/core/auth/password-policy.ts` — exported `LOGIN_LOCKOUT_MS`.
  - `src/core/auth/proxy-request.ts` — added `extractClientIp()` with IPv4/IPv6 port stripping and `isIP()` validation.
  - `src/core/auth/credentials.ts` & `src/auth.ts` — wired IP-isolated lockout, stale attempt pruning, failure clearing, and `lastLogin` updates.
  - `tests/auth/auth-flow.test.ts` & `tests/auth/dual-mode-env.test.ts` — added unit coverage for IP lockout, `lockoutMs > failureWindowMs` expiry, pruning, failure reset, `lastLogin`, `extractClientIp`, and lockout env parsing.
- **Files Explicitly Preserved Untouched:**
  - `src/core/auth/dev-demo-auth.ts`, `.env.development`, `src/components/auth/sign-in-form.tsx`, `src/components/layout/app-shell.tsx`, `src/users/*`, `src/vcon/*`, `prisma/schema.prisma`, `prisma/migrations/*`.
- **Verification Gate Output:**
  - `npm run verify:safe`: **PASS** (`test:compat`, `test:postfix`, `test:setup`, `test:auth:core` 26/26, `test:auth:guards` 5/5, `test:auth:target-guard` 6/6, `tsc --noEmit`, `eslint .`, `prisma validate`).
  - `npm run test:ui`: **PASS** (7 files, 21/21 tests).
  - `compile_applet` (`next build`): **PASS**.
  - `lint_applet` (`eslint .`): **PASS**.
- **Remaining Phases:** `7` remaining -> Next: **Phase 1**

---

### Entry 02 — Phase 1: Single-PostgreSQL `mailserver` Schema, Audit Core & Role-Aware Shell
- **Date Completed:** 2026-11-15
- **Scope Lock Compliance:** Verified — modified strictly `Phase 1 IN SCOPE` files (`mailserver` migration + ledger tests, `audit/*`, `accounts/policy.ts`, auth audit hooks, `AppShell`, `(workspace)/layout.tsx`, `SignInForm`, and unit/UI tests). Note: only `/vcon` is added inside `AppShell` `Management` navigation in Phase 1 so there are zero broken 404 sub-links before Phases 2–6 create those sub-pages; `test:audit` was added to `package.json` `test:unit` so `verify:safe` runs it automatically.
- **Bugs Fixed / Features Added:**
  - `GAP-001`: Added single-PostgreSQL migration `prisma/migrations/20261115000000_mailserver_schema_and_roles/migration.sql` defining `"mailserver"` schema (`mail_domains`, `mailboxes`, `mail_aliases`), 3 `security_invoker = true` views (`postfix_virtual_domains`, `postfix_virtual_mailboxes`, `postfix_virtual_aliases`), and column-scoped least-privilege grants for `"postfix_lookup"` (never exposing `password_hash`). Updated `tests/schema/postgres-schema.test.mjs` and `scripts/testing/postgres-target.ts`.
  - `GAP-002` & `BUG-003` completion: Added `src/core/audit/{types.ts,record.ts}` (`recordAudit`, `recordAppAudit`, `sanitizeAuditDetails`) with recursive secret redaction, BigInt/Date normalization, field truncation, and `TRUST_PROXY_HEADERS` IP validation; wired `login_success`, `login_failure` (including `lockout`), and `logout` audits into `src/core/auth/credentials.ts`, `src/auth.ts`, and `src/app/sign-in/actions.ts`.
  - `GAP-003` & `BUG-007`: Added `src/core/accounts/policy.ts` (`isAccountAdministrator`, `getAccountRoleFlags`, `ensureUserAccessPolicy`, `getUserAccessCapabilities`) strictly backed by `AdministratorProfile` (ignoring legacy `User.isStaff` / `User.isSuperuser`), and wired `getAccountRoleFlags` into `credentials.ts` and `current-user.ts`.
  - `BUG-004` & `GAP-004`: Updated `src/components/auth/sign-in-form.tsx` to redirect administrators to `/vcon` and regular users to `/users`; updated `src/app/(workspace)/layout.tsx` & `src/components/layout/app-shell.tsx` to gate `Management` (`/vcon`) navigation strictly on server-verified `isAdministrator`, show signed-in username/role, and render a working `Sign out` POST form when not in dev bypass mode.
- **Files Created / Modified:**
  - `prisma/migrations/20261115000000_mailserver_schema_and_roles/migration.sql`
  - `tests/schema/postgres-schema.test.mjs` & `scripts/testing/postgres-target.ts`
  - `src/core/audit/types.ts` & `src/core/audit/record.ts`
  - `src/core/accounts/policy.ts`
  - `src/core/auth/credentials.ts`, `src/auth.ts`, `src/core/auth/current-user.ts`, `src/app/sign-in/actions.ts`
  - `src/components/auth/sign-in-form.tsx`, `src/components/layout/app-shell.tsx`, `src/app/(workspace)/layout.tsx`
  - `tests/audit/record-and-policy.test.ts`, `tests/ui/app-shell.test.tsx`, `package.json` (`test:audit`)
- **Files Explicitly Preserved Untouched:**
  - `.env.development`, `src/core/auth/dev-demo-auth.ts`, `src/users/*`, `src/vcon/*`, `prisma/schema.prisma`, domain/mailbox/ingestion/settings/update modules.
- **Verification Gate Output:**
  - `npm run verify:safe`: **PASS** (`test:compat`, `test:postfix`, `test:setup`, `test:auth:core` 26/26, `test:auth:guards` 5/5, `test:audit` 4/4, `test:auth:target-guard` 6/6, `tsc --noEmit`, `eslint .`, `prisma validate`).
  - `npm run test:ui`: **PASS** (7 files, 23/23 tests).
  - `compile_applet` (`next build`): **PASS**.
  - `lint_applet` (`eslint .`): **PASS**.
- **Remaining Phases:** `6` remaining -> Next: **Phase 2**

---

### Entry 03 — Phase 2: `/vcon` Overview Telemetry, User Management (`/vcon/users`) & Audit UI (`/vcon/audit`)
- **Date Completed:** 2026-11-15
- **Scope Lock Compliance:** Verified — modified only Phase 2 `IN SCOPE` modules (`env-schema.ts`/`.env.example` for optional `MAIL_STORAGE_ROOT` & `INGESTION_STALE_AFTER_SECONDS`, `admin/overview.ts`, `accounts/credentials-generator.ts`, `accounts/users.ts`, `audit/queries.ts`, `/vcon` overview UI, `/vcon/users/*`, `/vcon/audit`, `AppShell` Phase 2 links, `(workspace)/error.tsx`, `vcon/not-found.tsx`, `package.json` `test:admin`, and Phase 2 unit/UI tests). Password generator produces 16-char complex passwords to honor existing `MIN_PASSWORD_LENGTH = 15` without weakening security policy.
- **Bugs Fixed / Features Added:**
  - `GAP-005`: Implemented `src/core/admin/overview.ts` (`getAdminOverviewData`, `evaluateIngestionHeartbeat`, `defaultCheckStorageAccess`) and replaced `/vcon` static `"Foundation"` card with live KPIs (total/active/disabled mailboxes, received emails, unread, last received), 3-card System Health strip (DB `SELECT 1`, `ServiceHeartbeat("maildir_ingestion")`, `MAIL_STORAGE_ROOT` RWX probe), recent 8 deliveries, and recent 8 mailboxes with click-to-copy client button (`CopyMailboxButton`).
  - `GAP-006`: Implemented `src/core/accounts/users.ts`, `src/core/accounts/credentials-generator.ts`, `src/app/(workspace)/vcon/users/actions.ts`, `UserForm`, `UsersDirectory`, and `/vcon/users`, `/vcon/users/new`, `/vcon/users/[id]/edit` routes featuring: case-insensitive search + 25/page pagination; non-admin user creation (`isStaff=false, isSuperuser=false, passwordResetRequired=false`) with Argon2id, `UserAccessPolicy`, and `MailboxMembership`; username & >=16-char CSPRNG password generators + eye toggle + searchable mailbox picker + `"Create & copy"` one-time modal; edit diff audits (`user_updated`, `user_activated`/`user_deactivated`, `user_delete_permissions_changed`, `mailbox_assignment_added`/`removed`); strict `AdministratorProfile` edit/delete block, self-delete block, last-active-admin guard, and mailbox/message/audit preservation on user delete.
  - `GAP-007` & `DISC-004` (`/vcon/audit` portion): Implemented `src/core/audit/queries.ts` (`listAuditLogs`, `listLoginSecurityMonitor`, `getAuditMonitorBundle`) and `/vcon/audit` displaying active IP + normalized-username lockouts, recent `LoginAttempt` outcomes, and filtered/paginated `AuditLog` entries with read-time redaction.
  - Added `(workspace)/error.tsx` & `vcon/not-found.tsx`, plus `/vcon/users` and `/vcon/audit` links in `AppShell` (`Management` nav gated on `isAdministrator`, exact active match on `/vcon`).
- **Files Created / Modified:**
  - `.env.example`, `src/config/env-schema.ts`
  - `src/core/admin/overview.ts`
  - `src/core/accounts/credentials-generator.ts`, `src/core/accounts/users.ts`
  - `src/core/audit/queries.ts`
  - `src/components/layout/app-shell.tsx`
  - `src/components/vcon/{copy-mailbox-button.tsx,user-form.tsx,users-directory.tsx,audit-console.tsx}`
  - `src/vcon/overview-panel.tsx`, `src/app/(workspace)/vcon/page.tsx`
  - `src/app/(workspace)/vcon/users/{page.tsx,actions.ts,new/page.tsx,[id]/edit/page.tsx}`
  - `src/app/(workspace)/vcon/audit/page.tsx`
  - `src/app/(workspace)/error.tsx`, `src/app/(workspace)/vcon/not-found.tsx`
  - `tests/admin/phase2-vcon.test.ts`, `tests/ui/vcon-phase2.test.tsx`, `tests/ui/app-shell.test.tsx`, `package.json` (`test:admin`)
- **Files Explicitly Preserved Untouched:**
  - `.env.development`, `src/core/auth/*` (except read-only imports), `src/users/*`, `prisma/schema.prisma`, domain/DNS, mailbox provisioning, ingestion worker, settings, and system-update modules.
- **Verification Gate Output:**
  - `npm run verify:safe`: **PASS** (incl. 7/7 new `test:admin` tests, `tsc --noEmit`, `eslint .`, `prisma validate`).
  - `npm run test:ui`: **PASS** (8 files, 27/27 tests).
  - `compile_applet` (`next build`) & `lint_applet` (`eslint .`): **PASS**.
  - Playwright headless Chromium: verified `demo.admin` `/vcon`, `/vcon/users`, `/vcon/users/new` (username/password generators), `/vcon/audit` (`320px` overflow = `false`), and `demo.user` `/vcon` non-enumerating `404` RBAC check.
- **Remaining Phases:** `5` remaining -> Next: **Phase 3**

---

### Entry 04 — Phase 3: `/vcon/domains` DNS Engine, PostgreSQL Mailserver Adapter & `/vcon/mailboxes` Provisioning + Purge
- **Date Completed:** 2026-11-15
- **Scope Lock Compliance:** Verified — modified strictly Phase 3 `IN SCOPE` config, mailserver adapter, DNS, domain/mailbox service & route files, plus minimal `AppShell` `managementNavigation` links (`Domains`, `Mailboxes`) and exported `getAuthorizedAdminUser()` helper in `src/core/auth/route-guards.ts` for `/api/vcon/domains/*` fail-closed 404 auth. Zero Phase 4–7 modules (MIME ingestion parser, HTML/CSS sanitizer, `/users` workspace reader, `/vcon/settings`, `/vcon/system-update`) or `prisma/schema.prisma` touched.
- **Bugs Fixed / Features Added:**
  - `GAP-008` & `DISC-002`: Implemented `/vcon/domains`, `/vcon/domains/new`, `/vcon/domains/[uuid]/edit`, `/api/vcon/domains/dns-preview`, and `/api/vcon/domains/[uuid]/dns-status`, backed by pure 5-record DNS builder + Cloudflare BIND zone exporter (`src/core/dns/records.ts`), OpenDKIM `mail.txt` reader (`src/core/dns/opendkim.ts`), Node `dns/promises` timeout-guarded resolver separating required routing (`MX` + `A/AAAA`) from deliverability (`SPF`, `DKIM`, `DMARC`) (`src/core/dns/resolver.ts`), and domain service enforcing `dnsConfirmed`, immutable names, fail-closed auto-disable on routing failure without auto-enabling on pass, atomic `isDefault` switching, and `isDefault`/`MAIL_DOMAIN`/mailbox delete guards (`src/core/domains/service.ts`).
  - `GAP-009` & `DISC-001`: Implemented real single-PostgreSQL adapter `src/core/mailserver/pg-adapter.ts` (`PgReadOnlyMailServerAdapter` + `mailserver.*` domain/mailbox sync + strict `^[a-z0-9_]+$` SQL identifier quoting + `!READBOX-READ-ONLY!...` password hashes), mailbox validators & symlink/traversal-safe `confinedPath` (`src/core/mailboxes/{validators,paths}.ts`), cross-process `proper-lockfile` locking + `0700` Maildir tree creation + rollback strictly removing newly created dirs while preserving pre-existing trees (`src/core/mailboxes/provisioning.ts`), and admin mailbox service/UI (`/vcon/mailboxes`, `/new`, `/[uuid]/delete`) supporting Generate local-part, live user filter, `"Create & copy"`, enable/disable toggle, typed-email single purge, bulk purge confirmation, and `postmaster`/`abuse` system mailbox creation (`src/core/mailboxes/service.ts`).
- **Packages Added:**
  - `proper-lockfile`, `@types/proper-lockfile` (`package.json` via `install_applet_package`).
- **Files Created / Modified:**
  - `.env.example`, `src/config/env-schema.ts`
  - `src/core/auth/route-guards.ts` (`getAuthorizedAdminUser`)
  - `src/core/mailserver/pg-adapter.ts`
  - `src/core/dns/{opendkim.ts,records.ts,resolver.ts}`
  - `src/core/domains/service.ts`
  - `src/core/mailboxes/{validators.ts,paths.ts,provisioning.ts,service.ts}`
  - `src/components/layout/app-shell.tsx` (`Domains` + `Mailboxes` links under `Management`)
  - `src/components/vcon/{dns-records-panel.tsx,domains-directory.tsx,domain-form.tsx,mailboxes-directory.tsx,mailbox-form.tsx,mailbox-purge-confirm.tsx}`
  - `src/app/api/vcon/domains/dns-preview/route.ts`, `src/app/api/vcon/domains/[uuid]/dns-status/route.ts`
  - `src/app/(workspace)/vcon/domains/{actions.ts,page.tsx,new/page.tsx,[uuid]/edit/page.tsx}`
  - `src/app/(workspace)/vcon/mailboxes/{actions.ts,page.tsx,new/page.tsx,[uuid]/delete/page.tsx}`
  - `tests/admin/phase3-domains-mailboxes.test.ts`, `tests/ui/app-shell.test.tsx`, `tests/ui/vcon-phase3.test.tsx`, `package.json` (`test:admin`)
- **Files Explicitly Preserved Untouched:**
  - `.env.development`, `src/core/auth/dev-demo-auth.ts`, `src/core/auth/credentials.ts`, `src/users/*`, `prisma/schema.prisma`, `/vcon/users/*`, `/vcon/audit`, ingestion/sanitizer/settings/system-update modules.
- **Verification Gate Output:**
  - `npm run verify:safe`: **PASS** (`test:compat`, `test:postfix`, `test:setup`, `test:auth`, `test:audit`, `test:admin` 13/13 incl. 6 new Phase 3 suites, `tsc --noEmit`, `eslint .`, `prisma validate`).
  - `npm run test:ui`: **PASS** (9 files, 32/32 tests).
  - `compile_applet` (`next build`) & `lint_applet` (`eslint .`): **PASS**.
  - Headless Chromium (`playwright-cli`): Verified `demo.admin` `/vcon/domains`, `/vcon/domains/new` (`Preview DNS` generating 5 records + Cloudflare export with clean `[overflow-wrap:anywhere]` table wrapping), `/vcon/mailboxes`, `/vcon/mailboxes/new` (`Generate` producing `quinn.miller11`), mobile `390x844` zero horizontal overflow (`scrollWidth === 390`), and `demo.user` non-enumerating HTTP `404` on `/vcon/domains` and `/api/vcon/domains/dns-preview`.
- **Remaining Phases:** `4` remaining -> Next: **Phase 4**

---

### Entry 05 — Phase 4: Maildir Ingestion Worker, HTML/CSS Sanitizer & `/vcon/operations`
- **Date Completed:** 2026-11-15
- **Scope Lock Compliance:** Verified — modified strictly Phase 4 `IN SCOPE` packages, env schema, ingestion/repair/operations core modules, worker & CLI script, `/vcon/operations` page/actions/component, `AppShell` (`Operations` nav link under `Management`), and unit/UI test suites. Zero Phase 5–7 modules (`/users/*` inbox/reader UI, `/vcon/settings`, `/vcon/system-update`), `/vcon/domains/*`, `/vcon/mailboxes/*`, `/vcon/users/*`, auth core, or `prisma/schema.prisma` modified.
- **Bugs Fixed / Features Added:**
  - `GAP-010` & `DISC-003`: Implemented deterministic Maildir ingestion pipeline (`src/core/ingestion/{sanitizer,parser,attachments,counters,service}.ts`, `src/workers/ingestion.ts`, `scripts/mail/ingest.ts`) featuring:
    - AST-based HTML/CSS allowlist sanitizer (`sanitize-html` + `css-tree`) enforcing `SAFE_HTML_TAGS`, `DROP_CONTENT_TAGS`, raster-only `data:image/{png,jpeg,gif,webp};base64,` (blocking remote `http(s)` trackers, `cid:`, and `data:image/svg+xml`), `rel="nofollow noopener noreferrer" target="_blank"`, `CSS_ALLOWED_PROPERTIES`, `CSS_ALLOWED_FUNCTIONS`, `@media (all|screen)` dimension/orientation allowlist, and strict `CssBudget` (`128KB` block input, `256KB` total retained, `512` rules, `8` nesting depth) blocking `url()`, `var()`, `--*`, `expression()`, `@import`, and `</style`.
    - `postal-mime` email parser extracting headers, bodies, and bounded attachments (`MAX_ATTACHMENTS_PER_MESSAGE`) while isolating empty/malformed MIME inputs without throwing.
    - Confined `0600` sharded attachment storage (`{xx}/{32hex}.bin`) inside `ATTACHMENT_STORAGE_ROOT` with extension-aware safe MIME detection and compensating file removal on DB rollback.
    - Read-only `Maildir/new` & `cur` scanning (`resolveMaildirSourceKey`, `iterMaildirFiles`), idempotent `(mailboxId, sourceFileKey)` deduplication, streaming SHA-256 oversized message handling (`parseStatus = "oversized"`), per-file error isolation with `ingestion_error` audit logging, cross-process `proper-lockfile` locking (`INGESTION_LOCK_FILE`), and `ServiceHeartbeat("maildir_ingestion")` updates (`running` -> `healthy`/`degraded`).
  - `GAP-011` & `DISC-004` (`/vcon/operations` portion): Implemented `src/core/ingestion/repair.ts`, `src/core/operations/service.ts`, `src/components/vcon/operations-console.tsx`, and `src/app/(workspace)/vcon/operations/{page,actions}.ts` providing admin diagnostics and interactive maintenance tools:
    1) Verify Postfix PostgreSQL contract (`verifyMailserverContract`)
    2) Synchronize `mailserver.mailboxes` into app schema (`dryRun` + `strict` rollback parity)
    3) Provision / verify confined `0700` Maildir trees (`createMaildirTree`)
    4) Rebuild unindexed Maildir messages (`dryRun` scan + execute)
    5) Recalculate mailbox message/unread counters (`recalculateAllMailboxCounters`)
    6) Non-destructive SHA-256 verified message body repair (`repairMessageBodies` with `confirmRepair` checkbox & `1..5000` batch limit) — with **zero** message bodies exposed in UI or DTOs.
- **Packages Added:**
  - `postal-mime`, `sanitize-html`, `@types/sanitize-html`, `css-tree`, `@types/css-tree` (`package.json` via single batched `install_applet_package`).
- **Files Created / Modified:**
  - `.env.example`, `src/config/env-schema.ts`
  - `src/core/ingestion/{sanitizer.ts,parser.ts,attachments.ts,counters.ts,service.ts,repair.ts}`
  - `src/core/operations/service.ts`
  - `src/workers/ingestion.ts`, `scripts/mail/ingest.ts`
  - `src/components/layout/app-shell.tsx` (`Operations` link under `Management`)
  - `src/components/vcon/operations-console.tsx`
  - `src/app/(workspace)/vcon/operations/{actions.ts,page.tsx}`
  - `tests/admin/phase4-ingestion-operations.test.ts`, `tests/ui/app-shell.test.tsx`, `tests/ui/vcon-phase4.test.tsx`, `package.json` (`test:admin`, `mail:ingest`)
- **Files Explicitly Preserved Untouched:**
  - `.env.development`, `src/core/auth/*`, `src/users/*`, `prisma/schema.prisma`, `/vcon/domains/*`, `/vcon/mailboxes/*`, `/vcon/users/*`, `/vcon/audit/*`, settings/system-update modules.
- **Verification Gate Output:**
  - `npm run verify:safe`: **PASS** (`test:compat`, `test:postfix`, `test:setup`, `test:auth`, `test:audit`, `test:admin` 23/23 incl. 10 new Phase 4 suites, `tsc --noEmit`, `eslint .`, `prisma validate`).
  - `npm run test:ui`: **PASS** (10 files, 34/34 tests).
  - `compile_applet` (`next build`) & `lint_applet` (`eslint .`): **PASS**.
  - Headless Chromium (`playwright-cli`): Verified `demo.admin` `/vcon/operations` at desktop `1440x900` (`scrollWidth === 1440`) and mobile `390x844` (`scrollWidth === 390`, `overflowX === false`), plus `demo.user` non-enumerating HTTP `404` on `/vcon/operations` and hidden `Operations` sidebar link.
- **Remaining Phases:** `3` remaining -> Next: **Phase 5**

---

### Entry 06 — Phase 5: User Workspace (`/users` Inbox, Sandboxed Reader, Attachments, Live Polling)
- **Date Completed:** 2026-11-15
- **Scope Lock Compliance:** Verified — modified strictly Phase 5 `IN SCOPE` modules (`src/core/messages/service.ts`, `src/core/auth/route-guards.ts` `getAuthorizedWorkspaceUser`, `/users` overview & sub-routes, `/api/messages/{html/[messageUuid],attachment/[attachmentUuid],live}`, `/src/components/users/*`, `package.json` `test:messages`, and Phase 5 unit/UI tests). Zero `/vcon/*` admin panels, `AppShell` sidebar links, `/sign-in` auth core, or `prisma/schema.prisma` modified.
- **Bugs Fixed / Features Added:**
  - `GAP-012`: Replaced `/users` static placeholder with full MailStack User Workspace:
    - `src/core/messages/service.ts`: Membership-scoped queries (`MailboxMembership` for regular users, all non-deleted mailboxes for administrators), `getUserWorkspaceOverview`, `listUserMailboxes`, `createUserSelfMailbox` (auto-assigning `MailboxMembership` to creating non-admin user), `canDeleteMailboxes`-gated `deleteUserMailbox` & `bulkDeleteUserMailboxes`, `listMailboxMessagesForUser` (`30/page` pagination, `receivedAt DESC NULLS LAST`, case-insensitive search across `senderName`/`senderAddress`/`subject`, `unread` and `attachments` filters, `inbox_access` audit), `getMessageDetailForUser` (atomic auto-read + `recalculateMailboxCounters` + `message_auto_read` & `message_view` audits), `markMessageUnreadForUser` (`message_mark_unread` audit), `softDeleteMessageForUser` (`canDeleteMessages` policy check, `deletedAt`/`deletedById` DB update, counter sync, `message_deleted` audit with `source_preserved: true`, leaving Maildir source files untouched), `getSanitizedMessageHtmlForUser` (`SAFE_HTML_CSP_POLICY`), `getAttachmentForUserDownload` (`confinedPath` regular-file verification, uniform 404 on traversal/symlink/non-member, `attachment_download` audit), and bounded `pollLiveMessagesForUser` (`X-MailStack-Live-Request: 1`, never leaking message bodies).
    - API routes: `/api/messages/html/[messageUuid]` (`default-src 'none'; img-src data:; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'; frame-ancestors 'self'; navigate-to 'none'`, `nosniff`, `no-referrer`, `private, no-store`), `/api/messages/attachment/[attachmentUuid]` (`Content-Disposition: attachment`, `nosniff`, `private, no-store`, optional `X-Accel-Redirect`), and `/api/messages/live` (`X-MailStack-Live-Request: 1`, `private, no-store`).
    - Client UI: `LiveWorkspaceNavigationBar` (`BroadcastChannel`, `localStorage`, `navigator.locks` cross-tab notification deduplication + Web `Notification` API toggle), `UserOverview`, `CreateUserMailboxModal` (`Generate` + `"Create & copy"`), `UserMailboxesView`, `MailboxInboxView`, and `MessageReaderView` (`<iframe sandbox="" referrerPolicy="no-referrer" />`, HTML/Plain-text toggle, attachment download cards, `Mark unread`, and `canDeleteMessages`-gated delete modal).
- **Files Created / Modified:**
  - `src/core/auth/route-guards.ts` (`getAuthorizedWorkspaceUser`)
  - `src/core/messages/service.ts`
  - `src/app/api/messages/html/[messageUuid]/route.ts`
  - `src/app/api/messages/attachment/[attachmentUuid]/route.ts`
  - `src/app/api/messages/live/route.ts`
  - `src/components/users/{live-mail-notifier.tsx,create-user-mailbox-modal.tsx,user-mailboxes-view.tsx,mailbox-inbox-view.tsx,message-reader-view.tsx}`
  - `src/users/overview-panel.tsx`, `src/app/(workspace)/users/page.tsx`
  - `src/app/(workspace)/users/mailboxes/{actions.ts,page.tsx}`
  - `src/app/(workspace)/users/inbox/[mailboxUuid]/page.tsx`
  - `src/app/(workspace)/users/inbox/[mailboxUuid]/[messageUuid]/{actions.ts,page.tsx}`
  - `tests/messages/phase5-users-workspace.test.ts`, `tests/ui/users-phase5.test.tsx`, `package.json` (`test:messages`)
- **Files Explicitly Preserved Untouched:**
  - `.env.development`, `src/core/auth/{credentials,dev-demo-auth}.ts`, `src/components/layout/app-shell.tsx`, `src/vcon/*`, `src/components/vcon/*`, `src/app/(workspace)/vcon/*`, `prisma/schema.prisma`.
- **Verification Gate Output:**
  - `npm run verify:safe`: **PASS** (`test:compat`, `test:postfix`, `test:setup`, `test:auth`, `test:audit`, `test:admin` 23/23, `test:messages` 8/8, `tsc --noEmit`, `eslint .`, `prisma validate`).
  - `npm run test:ui`: **PASS** (11 files, 39/39 tests).
  - `compile_applet` (`next build`) & `lint_applet` (`eslint .`): **PASS**.
  - Headless Chromium (`playwright-cli`): Verified `demo.user` `/users` and `/users/mailboxes` at desktop `1440x900` and mobile `390x844` (`scrollWidth === 390`, `overflowMobile === false`), `/api/messages/live` returning `400` without `X-MailStack-Live-Request: 1` and `200` (`Cache-Control: private, no-store`) with header, and `/api/messages/{html,attachment}/*` returning uniform `404` (`X-Content-Type-Options: nosniff`).
- **Remaining Phases:** `2` remaining -> Next: **Phase 6**

---

<!-- COPY THIS TEMPLATE ON EACH PHASE COMPLETION:

### Entry 0X — Phase N: <Phase Title>
- **Date Completed:** YYYY-MM-DD
- **Scope Lock Compliance:** Verified — touched only `IN SCOPE` files; unrelated UI/features untouched.
- **Bugs Fixed / Features Added:**
  - `BUG-xxx` / `GAP-xxx`: <exact summary>
- **Files Modified / Created:**
  - `<path>` — <reason>
- **Files Explicitly Preserved Untouched:**
  - <list key preserved modules, e.g., `dev-demo-auth.ts`, `/users/*`, `prisma/schema.prisma`>
- **Verification Gate Output:**
  - `npm run verify:safe`: PASS (...)
  - `npm run test:ui`: PASS (...)
  - `npm run build` / Playwright: ...
- **Remaining Phases:** `X` remaining -> Next: **Phase N+1**

-->
