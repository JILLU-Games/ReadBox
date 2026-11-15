# 02 — Step-by-Step Phase Roadmap & Scope Locks

> **Document ID:** `DOC-002`  
> **Rule:** Implement **strictly one Phase at a time**. Every phase has a hard **Scope Lock** defining exactly which files/modules may be touched and which existing features/UIs/files MUST remain untouched. A phase cannot be marked complete until its **Mandatory Verification Gate** passes.

---

## Phase Overview Map

| Phase | Title | Resolves (Bugs / Gaps / Disc) | Depends On |
|---|---|---|---|
| **Phase 0** | Baseline BugFixes & Auth Lockout Hardening | `BUG-001`, `BUG-002`, `BUG-003` | Frozen Baseline |
| **Phase 1** | Single-PostgreSQL `mailserver` Schema, Audit Core & Role-Aware Shell | `BUG-004`, `BUG-007`, `GAP-001..004` | Phase 0 |
| **Phase 2** | `/vcon` Overview, User Management (`/vcon/users`) & Audit UI (`/vcon/audit`) | `DISC-004`, `GAP-005`, `GAP-006`, `GAP-007` | Phase 1 |
| **Phase 3** | `/vcon/domains` DNS Engine & `/vcon/mailboxes` Provisioning + Purge | `DISC-001`, `DISC-002`, `GAP-008`, `GAP-009` | Phase 1 |
| **Phase 4** | Maildir Ingestion, HTML/CSS Sanitizer & `/vcon/operations` | `DISC-003`, `DISC-004`, `GAP-010`, `GAP-011` | Phase 3 |
| **Phase 5** | User Workspace (`/users` Inbox, Sandboxed Reader, Attachments, Live Polling) | `GAP-012` | Phase 4 |
| **Phase 6** | `/vcon/settings`, `/vcon/system-update`, Health Readiness & VPS Templates | `BUG-005`, `GAP-013`, `GAP-014`, `GAP-015` | Phase 2, 4 |
| **Phase 7** | Full Browser QA (320/768/1280px, Themes, PWA), Postgres Integration & Release Gate | `BUG-006`, `GAP-016` | Phases 0–6 |

---

## Detailed Scope Locks per Phase

### Phase 0 — Baseline BugFixes & Auth Lockout Hardening
- **Objective:** Fix broken Linux verification baseline and bring existing auth/login lockout up to production security parity without altering UI layouts.
- **Resolves:** `BUG-001`, `BUG-002`, `BUG-003`.
- **IN SCOPE (Allowed Edits):**
  - `tests/auth/postgres-target.test.ts` (replace hardcoded `\\compose.yaml` with `path.join` / cross-platform `resolve`).
  - `package.json` (`test:auth:core` — add `tests/auth/dual-mode-env.test.ts`).
  - `src/config/env-schema.ts` (add optional `TRUST_PROXY_HEADERS`, `LOGIN_FAILURE_LIMIT`, `LOGIN_FAILURE_WINDOW_SECONDS`, `LOGIN_LOCKOUT_SECONDS` with safe defaults).
  - `src/core/auth/{credentials.ts,proxy-request.ts}` & `src/auth.ts` (extract trusted client IP, enforce per-IP + normalized-username lockout, prune expired `LoginAttempt` rows, update `User.lastLogin` on real DB sign-in).
  - `tests/auth/auth-flow.test.ts` (unit tests for IP lockout + pruning + `lastLogin`).
- **OUT OF SCOPE / DO NOT TOUCH:**
  - Do NOT touch `/users`, `/vcon`, `AppShell`, `SignInForm` visual styling, `dev-demo-auth.ts` behavior (`bypass`/`demo`), or `prisma/schema.prisma`.
- **Verification Gate:** `npm run verify:safe` exits **0** (all unit suites + `tsc` + `eslint` + `prisma validate`), plus `npm run test:ui` passes 100%.

---

### Phase 1 — Single-PostgreSQL `mailserver` Schema, Audit Core & Role-Aware Shell
- **Objective:** Establish the multi-schema single-PostgreSQL boundary (`public` + `mailserver`), centralized redacted audit writer, `UserAccessPolicy` helper, and clean role-gated `AppShell` navigation.
- **Resolves:** `BUG-004`, `BUG-007`, `GAP-001`, `GAP-002`, `GAP-003`, `GAP-004`.
- **IN SCOPE (Allowed Edits):**
  - `prisma/migrations/<new>_mailserver_schema_and_roles/migration.sql` + `tests/schema/postgres-schema.test.mjs` + `scripts/testing/postgres-target.ts` (create `mailserver` schema, `mail_domains`, `mailboxes`, `mail_aliases`, 3 `postfix_virtual_*` views, least-privilege role setup script/notes; update expected migration ledger check).
  - `src/core/audit/{record.ts,types.ts}` (`recordAudit`, recursive secret redaction, trusted IP extraction).
  - `src/core/accounts/policy.ts` (`ensureUserAccessPolicy`, `isAccountAdministrator` strictly backed by `AdministratorProfile`, never `User.isStaff`).
  - `src/components/auth/sign-in-form.tsx` & `src/app/sign-in/actions.ts` (role-aware default post-login target or `/users`, wire `recordAudit` for login/logout in real DB mode).
  - `src/components/layout/app-shell.tsx` & `src/app/(workspace)/layout.tsx` (pass server-resolved `isAdministrator` + `username` into `AppShell`; hide `/vcon/*` from non-admins; render `Management` nav links for admins; include sign-out POST form).
  - Unit tests in `tests/audit/*` and updated `tests/ui/app-shell.test.tsx`.
- **OUT OF SCOPE / DO NOT TOUCH:**
  - Do NOT implement domain/DNS, mailbox CRUD, ingestion, settings, or update UI yet. Keep existing `vcon/overview-panel.tsx` and `users/overview-panel.tsx` cards functional until Phases 2 & 5 replace them.
- **Verification Gate:** `npm run verify:safe`, `npm run test:ui`, `npm run build` pass cleanly.

---

### Phase 2 — `/vcon` Overview, User Management (`/vcon/users`) & Audit UI (`/vcon/audit`)
- **Objective:** Replace `/vcon` Foundation placeholder with real telemetry and implement complete admin User & Access Policy CRUD + Audit/Lockout monitoring.
- **Resolves:** `DISC-004`, `GAP-005`, `GAP-006`, `GAP-007`.
- **IN SCOPE (Allowed Edits):**
  - `src/core/accounts/users.ts` (list/search/paginate 25/page, create non-admin user + `UserAccessPolicy` + `MailboxMembership`, update metadata/status/permissions/memberships diff + audits, delete user preserving mailboxes/messages + admin/self/last-admin guards).
  - `src/core/admin/overview.ts` (KPI queries + `ServiceHeartbeat("maildir_ingestion")` freshness + storage RWX checks + `SELECT 1` + recent 8 mailboxes & messages).
  - `src/core/audit/queries.ts` (paginated `AuditLog` filter query + active `LoginAttempt` lockout query).
  - `src/app/(workspace)/vcon/page.tsx`, `/vcon/users/page.tsx`, `/vcon/users/new/page.tsx`, `/vcon/users/[id]/edit/page.tsx`, `/vcon/audit/page.tsx` + actions & components under `src/components/vcon/*` / `src/vcon/*`.
  - Unit + Vitest UI tests for user guards, audit redaction, generator buttons, `"Create & copy"`, and 404 protection for non-admins.
- **OUT OF SCOPE / DO NOT TOUCH:**
  - Do NOT modify domain/DNS logic, mailbox Maildir provisioning, ingestion workers, `/users` workspace, or `/vcon/settings`.
- **Verification Gate:** `npm run verify:safe`, `npm run test:ui`, `npm run build`, and Playwright admin/non-admin RBAC smoke test on `/vcon`, `/vcon/users`, `/vcon/audit`.

---

### Phase 3 — `/vcon/domains` DNS Engine & `/vcon/mailboxes` Provisioning + Purge
- **Objective:** Deliver full Domain lifecycle + 5-record DNS verification + Cloudflare zone export, real PostgreSQL `mailserver` adapter, and locked/confined Mailbox provisioning & permanent purge.
- **Resolves:** `DISC-001`, `DISC-002`, `GAP-008`, `GAP-009`.
- **IN SCOPE (Allowed Edits):**
  - `src/config/env-schema.ts` & `.env.example` (add `MAIL_DOMAIN`, `MAIL_HOSTNAME`, `APP_HOSTNAME`, `SERVER_IP`, `MAIL_STORAGE_ROOT`, `ATTACHMENT_STORAGE_ROOT`, `MAILBOX_PROVISION_LOCK_ROOT`, `MAILBOX_DEFAULT_QUOTA_BYTES`, `OPENDKIM_KEYS_ROOT`, `DNS_LOOKUP_TIMEOUT_SECONDS`).
  - `src/core/mailserver/pg-adapter.ts` & `src/core/postfix/*` (real `PgReadOnlyMailServerAdapter` + privileged `mailserver.*` domain/mailbox/alias sync + identifier validation).
  - `src/core/dns/{records.ts,resolver.ts,opendkim.ts}` (5 DNS records, OpenDKIM `mail.txt` reader, Cloudflare zone generator, separate `verifyRoutingDns` vs `verifyAllDnsRecords`).
  - `src/core/domains/service.ts` (domain create/edit/immutable name/check auto-disable/toggle/default/delete guards).
  - `src/core/mailboxes/{validators.ts,paths.ts,provisioning.ts,service.ts}` (`RESERVED_LOCAL_PARTS`, `confinedPath` rejecting traversal/symlinks, cross-process `proper-lockfile` lock, `{domain}/{local_part}/Maildir/{new,cur,tmp}` `0700`, compensating rollback, toggle active, single typed-email `purgeMailbox`, `bulkPurgeMailboxes`, `createSystemMailbox`).
  - App routes `/vcon/domains/*`, `/vcon/mailboxes/*`, `/api/vcon/domains/*` + unit/failure-injection tests.
- **OUT OF SCOPE / DO NOT TOUCH:**
  - Do NOT touch MIME ingestion parser, HTML/CSS sanitizer, `/users` message reader UI, `/vcon/settings`, or `/vcon/system-update`.
- **Verification Gate:** `npm run verify:safe`, `npm run test:ui`, failure-injection rollback tests, and browser check of `/vcon/domains` + `/vcon/mailboxes`.

---

### Phase 4 — Maildir Ingestion Worker, HTML/CSS Sanitizer & `/vcon/operations`
- **Objective:** Implement safe Maildir parsing, strict XSS-proof HTML/CSS sanitization, attachment storage extraction, `ServiceHeartbeat` worker, and `/vcon/operations` admin diagnostics console.
- **Resolves:** `DISC-003`, `DISC-004`, `GAP-010`, `GAP-011`.
- **IN SCOPE (Allowed Edits):**
  - `package.json` (single batched install: MIME parser + HTML sanitizer + `css-tree` + `@types/*` if needed).
  - `src/core/ingestion/{parser.ts,sanitizer.ts,attachments.ts,service.ts,repair.ts,counters.ts}` (strict tag/attr/protocol allowlist, CSS property/budget limit, remote image & SVG block, SHA-256 idempotent key `(mailboxId, sourceFileKey)`, read-only Maildir source, `ATTACHMENT_STORAGE_ROOT` `0600` confinement, guarded `repairMessageBodies`).
  - `src/workers/ingestion.ts` & `scripts/mail/*` (one-shot / watch ingestion worker + `ServiceHeartbeat("maildir_ingestion")`).
  - `/vcon/operations/page.tsx` + actions (Postfix contract verifier, strict mailserver sync, Maildir directory reprovision, unindexed rebuild, counter recalculation, dry-run & SHA-256 confirmed body repair).
  - Security sanitizer corpus & reliability tests.
- **OUT OF SCOPE / DO NOT TOUCH:**
  - Do NOT alter `/vcon/users` or `/vcon/domains` unless strictly displaying new counters; do NOT expose message bodies inside `/vcon/operations` UI.
- **Verification Gate:** `npm run verify:safe`, differential HTML/CSS XSS corpus tests, restart/idempotency tests, `/vcon/operations` browser verification.

---

### Phase 5 — User Workspace (`/users` Inbox, Sandboxed Reader, Attachments, Live Polling)
- **Objective:** Replace `/users` Foundation placeholder with full MailStack user workspace consuming Phase 3 mailboxes and Phase 4 ingested messages.
- **Resolves:** `GAP-012`.
- **IN SCOPE (Allowed Edits):**
  - `src/core/messages/service.ts` (membership-scoped queries, search `senderName`/`senderAddress`/`subject`, unread/attachment filters, 30/page pagination, `receivedAt DESC NULLS LAST`, auto-read + counter sync + `message_auto_read`/`message_view` audits, mark-unread, `canDeleteMessages` soft-delete leaving Maildir untouched, bounded live cursor query).
  - Routes `/users/page.tsx`, `/users/mailboxes/page.tsx`, `/users/inbox/[mailboxUuid]/page.tsx`, `/users/inbox/[mailboxUuid]/[messageUuid]/page.tsx`, `/api/messages/html/[messageUuid]/route.ts` (strict CSP iframe payload), `/api/messages/attachment/[attachmentUuid]/route.ts` (confined download / `X-Accel-Redirect`, `attachment`, `nosniff`, `private, no-store`), `/api/messages/live/route.ts` (`X-MailStack-Live-Request: 1`, `no-store`).
  - User self-create mailbox + gated `canDeleteMailboxes` delete hooks in `/users/mailboxes`.
  - Client polling + `BroadcastChannel`/`localStorage`/`navigator.locks` + Web Notifications module.
- **OUT OF SCOPE / DO NOT TOUCH:**
  - Do NOT modify `/vcon/*` admin panels or `/sign-in` auth core.
- **Verification Gate:** Cross-user isolation & 404 security tests, iframe CSP/sandbox check in real browser, attachment traversal tests, `npm run verify:safe`, `npm run test:ui`.

---

### Phase 6 — `/vcon/settings`, `/vcon/system-update`, Health Readiness & VPS Templates
- **Objective:** Complete branding settings + public CORS API, privilege-separated GitHub self-updater console, production health probe readiness, and PostgreSQL deployment/backup scripts.
- **Resolves:** `BUG-005`, `GAP-013`, `GAP-014`, `GAP-015`.
- **IN SCOPE (Allowed Edits):**
  - `src/core/settings/service.ts` + `/vcon/settings/page.tsx` + `/api/site-settings/route.ts` + `/api/media/[...path]/route.ts` (`MEDIA_ROOT/site-settings/` confined serving, 5MB logo / 512KB favicon limits, `PUBLIC_SITE_ORIGIN` CORS).
  - `src/core/updates/service.ts` + `/vcon/system-update/page.tsx` + `/api/vcon/update/{check,preflight,start,status}/route.ts` + `scripts/updater/*` (official GitHub URL allowlist, 9-item preflight, atomic `0640` hard-link `/run/vibmail/update_request.json`, root updater boundary).
  - `src/core/health/snapshot.ts` & `src/app/health/ready/route.ts` (migration status + writable storage roots + config checks, preserving coarse public response).
  - `deployment/templates/postfix/*`, `deployment/templates/systemd/*`, `scripts/ops/{backup.sh,restore.sh}` (PostgreSQL `pgsql:` maps & `pg_dump`/`pg_restore`).
- **OUT OF SCOPE / DO NOT TOUCH:**
  - Do NOT allow the Next.js web process to run `sudo`, shell commands, or root binaries; preserve `update_request.json` privilege boundary.
- **Verification Gate:** `npm run verify:safe`, updater URL/mode/owner unit tests, CORS & upload validation tests, `npm run build`.

---

### Phase 7 — Final Verification, Responsive Browser QA & VPS Cutover Gate
- **Objective:** Verify end-to-end application visually and functionally across viewports, themes, PWA, and isolated PostgreSQL, fixing UI polish & responsive defects only.
- **Resolves:** `BUG-006`, `GAP-016`.
- **IN SCOPE (Allowed Edits):**
  - Responsive CSS/Tailwind fixes for 320px/768px/1280px viewports across `/sign-in`, `/reset-password`, `/users/*`, `/vcon/*`.
  - Automated Playwright visual & interaction suite, `scripts/testing/postgres-integration.ts` expansion for all 14+ tables + `mailserver` views, service-worker private-cache exclusion audit.
- **Verification Gate (All Must Pass Before Production VPS Sign-Off):**
  1. `npm run verify:safe` (0 failures)
  2. `npm run test:ui` (0 failures)
  3. `npm run test:postgres` against clean ephemeral Compose PostgreSQL (double migration + concurrency + rollback pass)
  4. `npm run build` cleanly succeeds
  5. Real-browser verification at `320px`, `768px`, `1280px` in both **Light** and **Dark** themes + `prefers-reduced-motion: reduce` + SW cache inspection.
