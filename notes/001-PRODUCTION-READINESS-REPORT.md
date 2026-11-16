# 001 — Production Readiness & Forensic Scope-Lock Specification

**Baseline Status:** FROZEN (`2026-11-16` Current Workspace Baseline)  
**Source of Truth:** [`/notes/FORENSIC-AUDIT-REPORT.md`](./FORENSIC-AUDIT-REPORT.md)  
**Total Verified Defects:** **21 Bugs** (`5 Critical`, `9 High`, `7 Medium`, `0 Low`)  
**Execution Policy:** Zero changes outside the active Phase's locked file list. Every phase must preserve the existing ReadBox component-only UI architecture (`--radius: 0rem`, flat borders, Segoe UI stack, dark/light parity) and single PostgreSQL + Prisma database contract.

---

## 1. Frozen Baseline Architecture & Invariants

1. **Database Policy (Authoritative):**
   - Single PostgreSQL database via Prisma (`prisma/schema.prisma`) plus `mailserver` schema for Postfix/Dovecot virtual domain/mailbox/alias lookups.
   - No secondary database (no SQLite, MySQL, MariaDB).
   - Maildir messages and attachments reside on disk (`MAIL_STORAGE_ROOT`, `ATTACHMENT_STORAGE_ROOT`, `MEDIA_ROOT`).
2. **UI/UX & Component-Only Policy (Authoritative):**
   - All UI primitives come from `/src/components/ui/*` and layout shells from `/src/components/layout/*`.
   - Zero border-radius (`--radius: 0rem`), zero box-shadow/glow, compact typography (`"Segoe UI", "Segoe UI Web", system-ui, -apple-system, "Helvetica Neue", sans-serif`), and clean dark/light theme support.
3. **Baseline Match Verification:**
   - All 21 bugs (`BUG-01` through `BUG-21`) in `FORENSIC-AUDIT-REPORT.md` are 100% matched to exact files and line numbers in the current frozen baseline and mapped 1:1 into **6 Scope-Locked Phases** below.

---

## 2. Master Bug-to-Phase Mapping Matrix (All 21 Bugs)

| Bug ID | Severity | Subsystem | Assigned Phase | Target Resolution Summary |
| --- | --- | --- | --- | --- |
| `BUG-01` | CRITICAL | Prisma Schema vs SQL Migrations | **Phase 01** | Add migration creating `admin_accounts`, `admin_sessions`, `user_control_settings`, `users.phone`, `users.verification_status`, extended `user_access_policies` columns, and `ReadBox` defaults. |
| `BUG-02` | CRITICAL | Actor ID Collision & FK Integrity | **Phase 01** | Make actor resolution `authSource`-aware across `users`, `mailboxes`, `domains`, `operations`, `messages`, `settings`, `updates`, `sign-up`, `user-control-policy`, and `deleteManagedUser`. |
| `BUG-03` | HIGH | Ingestion `parse_status` CHECK | **Phase 01** | Align `messages.parse_status` between ingestion (`"error"` / `"failed"`), operations queries, and PostgreSQL `messages_parse_status_check`. |
| `BUG-04` | MEDIUM | Mailbox Local-Part Regex Drift | **Phase 01** | Unify `demo-workspace.ts` local-part validation with `LOCAL_PART_PATTERN` in `validators.ts` and `mailserver.postfix_virtual_mailboxes`. |
| `BUG-10` | CRITICAL | Session IP, User-Agent & `lastSeenAt` | **Phase 02** | Pass request IP & User-Agent into `registerAppSession` (`app_sessions` & `admin_sessions`) and update `lastSeenAt` during active session resolution. |
| `BUG-11` | HIGH | Password Reset Flow & Policy | **Phase 02** | Add self-service reset token request flow, enforce dynamic `UserControlSettings` password policy, prefill `?token=`, support `AdminAccount` & Demo Mode, and record audit logs. |
| `BUG-12` | HIGH | `autoProvisionStarterMailbox` | **Phase 02** | Provision starter mailbox + `MailboxMembership` automatically on verified self-signup and admin approval when `autoProvisionStarterMailbox` is enabled (DB + Demo). |
| `BUG-13` | HIGH | Cross-Table Username Uniqueness & Bootstrap | **Phase 02** | Check both `prisma.user` and `prisma.adminAccount` in `createManagedUser`, `updateManagedUser`, and `sign-up.ts`; align `bootstrapInitialAccount`. |
| `BUG-14` | MEDIUM | Demo Dynamic Users Overrides & Audit | **Phase 02** | Apply `applyAccountOverrides` in `listDevDemoDynamicUsers` and emit `appendDemoSecurityEvent` in `updateDevDemoDynamicUserStatus`. |
| `BUG-05` | CRITICAL | User Control Policy Silent DB Fallback | **Phase 03** | Fail-closed when PostgreSQL is configured (`env.databaseUrl`), pass `prisma` into `getUserControlSettings(prisma)` inside `updateUserExtendedPolicy`, stop injecting `DEMO_VERIFIED_DOMAINS` when `databaseConnected: true`, and compute real demo mailbox counts. |
| `BUG-06` | HIGH | `SiteSettings` Silent DB Error Fallback | **Phase 03** | Surface real DB write errors whenever a Prisma client is active instead of silently returning `{ ok: true }` from memory. |
| `BUG-07` | HIGH | Public Contact Inquiry Persistence | **Phase 03** | Persist contact inquiries in PostgreSQL (and audited details), remove weak static HMAC fallback in production, and expose inquiries in `/vcon`. |
| `BUG-20` | HIGH | Message Auto-Delete Retention Engine | **Phase 03** | Add retention purge routine for expired messages/attachments/counters, fix `receivedAt: null` cutoff handling, and keep mailbox counters accurate. |
| `BUG-15` | HIGH | Admin Sidebar in `/users/*` & Add Mailbox | **Phase 04** | Switch `AppShell` sidebar on `isAdministrator && isAdminRoute` (with quick switch link between `/users` and `/vcon`) so `/users/*` always renders the User Workspace sidebar and `+ Add mailbox` trigger. |
| `BUG-17` | MEDIUM | Stale Client State, 25-Mailbox Cap & Catch Logging | **Phase 04** | Resync `liveCounts` (`MailboxInboxView`) and `domainUuid` (`CreateUserMailboxModal`) on prop changes, load all accessible sidebar mailboxes in `/users/layout.tsx`, and log unexpected DB errors. |
| `BUG-18` | MEDIUM | Live Polling Retention & Cross-Tab State | **Phase 04** | Apply user retention cutoff in `pollLiveMessagesForUser` and return updated mailbox/message read-state snapshots so open tabs stay synchronized. |
| `BUG-19` | MEDIUM | Inline `cid:` Images & Message Print View | **Phase 04** | Resolve inline `cid:` attachments to safe attachment download/inline URLs or data URIs in the reader/sanitizer, and isolate the message reader during `window.print()`. |
| `BUG-08` | MEDIUM | Demo Workspace Capability, Quota & Polling Parity | **Phase 05** | Enforce `effective.canDeleteMessages`, user-scoped mailbox ownership/quotas, retention cutoffs, actor arguments on inbox/message pages, and dynamic live polling in `demo-workspace.ts`. |
| `BUG-16` | HIGH | Admin Self-Service Profile, Password & Sessions | **Phase 05** | Enable self-service profile editing, password change, and active session management (`admin_sessions` & `app_sessions`) for administrators. |
| `BUG-09` | MEDIUM | Trusted Setup / Installer Runner Contract | **Phase 06** | Wire or formally integrate `trusted-operations.ts` with admin system operations/preflight diagnostics so no dead setup contract remains. |
| `BUG-21` | CRITICAL | System Updater Script Path & `vibmail` Hardcodes | **Phase 06** | Fix `UPDATE_SCRIPT_PATH` default (`/scripts/updater/upgrade.sh`), align `updates/service.ts`, `upgrade.sh`, and `backup.sh` paths/service names with configurable ReadBox defaults + legacy fallback compatibility. |

---

## 3. Strict Scope Lock Per Phase

### Phase 01 — Scope Lock (Database Schema, Migrations & Actor Integrity)
- **Bugs Covered:** `BUG-01`, `BUG-02`, `BUG-03`, `BUG-04`
- **Allowed Files to Modify/Create:**
  - `/prisma/schema.prisma`
  - `/prisma/migrations/*` (new migration SQL synchronizing schema drift & `parse_status` check)
  - `/src/core/audit/record.ts`
  - `/src/core/accounts/users.ts`
  - `/src/core/accounts/user-control-policy.ts` (actor audit resolution only)
  - `/src/core/mailboxes/service.ts`
  - `/src/core/domains/service.ts`
  - `/src/core/operations/service.ts`
  - `/src/core/messages/service.ts` (actor resolution only)
  - `/src/core/messages/demo-workspace.ts` (local-part validator alignment only)
  - `/src/core/ingestion/service.ts`
  - `/src/core/settings/service.ts` (actor audit resolution only)
  - `/src/core/updates/service.ts` (actor audit resolution only)
  - `/src/core/auth/sign-up.ts` (actor audit resolution only)
- **Out of Scope (Forbidden in Phase 01):** Any UI component changes, layout changes, session telemetry, password reset UI, or updater bash scripts.

### Phase 02 — Scope Lock (Authentication, Session Telemetry, Password Reset & Starter Mailbox)
- **Bugs Covered:** `BUG-10`, `BUG-11`, `BUG-12`, `BUG-13`, `BUG-14`
- **Allowed Files to Modify/Create:**
  - `/src/auth.ts`
  - `/src/core/auth/session-registry.ts`
  - `/src/core/auth/password-reset.ts`
  - `/src/core/auth/sign-up.ts`
  - `/src/core/auth/operator-bootstrap.ts`
  - `/src/core/auth/dev-demo-auth.ts`
  - `/src/core/accounts/users.ts` (cross-table username uniqueness check)
  - `/src/app/reset-password/page.tsx`
  - `/src/app/reset-password/actions.ts`
  - `/src/components/auth/password-reset-form.tsx`
- **Out of Scope (Forbidden in Phase 02):** Inbox reader UI, contact service, retention purge, or updater scripts.

### Phase 03 — Scope Lock (Fail-Closed Policy Persistence, Contact Persistence & Retention Engine)
- **Bugs Covered:** `BUG-05`, `BUG-06`, `BUG-07`, `BUG-20`
- **Allowed Files to Modify/Create:**
  - `/prisma/schema.prisma` & `/prisma/migrations/*` (if adding `ContactSubmission` persistence model)
  - `/src/core/accounts/user-control-policy.ts`
  - `/src/core/settings/service.ts`
  - `/src/core/contact/service.ts`
  - `/src/core/messages/service.ts` (retention purge & cutoff handling)
  - `/src/core/operations/service.ts` (triggering/reporting retention maintenance if applicable)
- **Out of Scope (Forbidden in Phase 03):** AppShell sidebar, inline `cid:` sanitizer, admin self-profile, or bash scripts.

### Phase 04 — Scope Lock (User Workspace Shell, Live Polling, Inline `cid:` Reader & Print Isolation)
- **Bugs Covered:** `BUG-15`, `BUG-17`, `BUG-18`, `BUG-19`
- **Allowed Files to Modify/Create:**
  - `/src/components/layout/app-shell.tsx`
  - `/src/components/users/mailbox-inbox-view.tsx`
  - `/src/components/users/create-user-mailbox-modal.tsx`
  - `/src/components/users/message-reader-view.tsx`
  - `/src/components/users/live-mail-notifier.tsx`
  - `/src/app/(workspace)/users/layout.tsx`
  - `/src/app/(workspace)/users/page.tsx`
  - `/src/app/(workspace)/users/mailboxes/page.tsx`
  - `/src/app/(workspace)/users/settings/page.tsx`
  - `/src/core/messages/service.ts` (`pollLiveMessagesForUser` retention & state sync)
  - `/src/core/ingestion/sanitizer.ts`
  - `/src/app/globals.css` (strictly `@media print` isolation rules only, preserving all design tokens)
- **Out of Scope (Forbidden in Phase 04):** Admin user-control policies, password reset, or system updater scripts.

### Phase 05 — Scope Lock (Admin Self-Service Profile/Security & Demo Workspace Full Parity)
- **Bugs Covered:** `BUG-08`, `BUG-16`
- **Allowed Files to Modify/Create:**
  - `/src/core/accounts/user-profile.ts`
  - `/src/app/(workspace)/users/settings/page.tsx`
  - `/src/app/(workspace)/users/settings/actions.ts`
  - `/src/components/users/user-settings-view.tsx`
  - `/src/core/messages/demo-workspace.ts`
  - `/src/app/(workspace)/users/inbox/[mailboxUuid]/page.tsx`
  - `/src/app/(workspace)/users/inbox/[mailboxUuid]/[messageUuid]/page.tsx`
  - `/src/app/api/messages/*` (demo route actor pass-through)
- **Out of Scope (Forbidden in Phase 05):** Database migrations, ingestion parser, or updater scripts.

### Phase 06 — Scope Lock (System Updater, Ops Scripts & Setup Runner Alignment)
- **Bugs Covered:** `BUG-09`, `BUG-21`
- **Allowed Files to Modify/Create:**
  - `/src/config/env-schema.ts`
  - `/.env.example`
  - `/src/core/updates/service.ts`
  - `/src/core/setup/trusted-operations.ts`
  - `/scripts/updater/update_worker.py`
  - `/scripts/updater/upgrade.sh`
  - `/scripts/ops/backup.sh`
- **Out of Scope (Forbidden in Phase 06):** User/Admin UI components, auth logic, or mailbox/message services.
