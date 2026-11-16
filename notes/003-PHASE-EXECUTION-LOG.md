# 003 — Phase Execution & Completion Log

**Project:** ReadBox  
**Baseline Freeze Date:** `2026-11-16`  
**Total Planned Phases:** `6`  
**Completed Phases:** `4 / 6` (`Phase 01`, `Phase 02`, `Phase 03`, `Phase 04` Complete)  
**Remaining Phases:** `2 / 6` (`Phase 05` → `Phase 06`)  
**Total Resolved Bugs:** `17 / 21` (`BUG-01`, `BUG-02`, `BUG-03`, `BUG-04`, `BUG-05`, `BUG-06`, `BUG-07`, `BUG-10`, `BUG-11`, `BUG-12`, `BUG-13`, `BUG-14`, `BUG-15`, `BUG-17`, `BUG-18`, `BUG-19`, `BUG-20`)

---

## 1. Overall Phase Progress Summary

| Phase | Title | Target Bugs | Scope Lock Status | Execution Status | Completed Date |
| --- | --- | --- | --- | --- | --- |
| **Phase 01** | Database Schema, SQL Migrations & Actor FK Integrity | `BUG-01`, `BUG-02`, `BUG-03`, `BUG-04` | LOCKED (VERIFIED) | **COMPLETED** | `2026-11-16` |
| **Phase 02** | Auth, Session Telemetry, Password Reset & Starter Mailbox | `BUG-10`, `BUG-11`, `BUG-12`, `BUG-13`, `BUG-14` | LOCKED (VERIFIED) | **COMPLETED** | `2026-11-16` |
| **Phase 03** | Fail-Closed Policy Persistence, Contact DB & Retention Engine | `BUG-05`, `BUG-06`, `BUG-07`, `BUG-20` | LOCKED (VERIFIED) | **COMPLETED** | `2026-11-16` |
| **Phase 04** | User Workspace Shell, Live Polling, Inline `cid:` & Print Fix | `BUG-15`, `BUG-17`, `BUG-18`, `BUG-19` | LOCKED (VERIFIED) | **COMPLETED** | `2026-11-16` |
| **Phase 05** | Admin Self-Service Settings & Demo Workspace Parity | `BUG-08`, `BUG-16` | LOCKED | **PENDING (NEXT)** | — |
| **Phase 06** | System Updater, Backup Scripts & Setup Runner Alignment | `BUG-09`, `BUG-21` | LOCKED | PENDING | — |

---

## 2. Completed Phases Log

### Phase 01 — Database Schema, SQL Migrations & Actor FK Integrity (`COMPLETED: 2026-11-16`)

- **Resolved Bugs:**
  1. **`BUG-01` (Prisma Schema vs. SQL Migrations Drift):**
     - Synchronized `/prisma/migrations/20261017000000_initial_application_schema/migration.sql` with `/prisma/schema.prisma`:
       - Added `phone VARCHAR(40) NOT NULL DEFAULT ''` and `verification_status VARCHAR(24) NOT NULL DEFAULT 'verified'` + `users_verification_status_idx` to `users`.
       - Added `admin_accounts` table (`id`, `username`, `password_hash`, `first_name`, `last_name`, `email`, `is_superuser`, `is_active`, `password_reset_required`, `last_login`, `date_joined`) + `admin_accounts_username_key`, `admin_accounts_username_idx`, and `admin_accounts_username_ci_key`.
       - Added `admin_sessions` table (`id`, `token_hash`, `admin_id`, `expires_at`, `created_at`, `last_seen_at`, `ip_address`, `user_agent`) + `admin_sessions_token_hash_key`, `admin_sessions_admin_id_expires_at_idx`, `admin_sessions_expires_at_idx`, and `admin_sessions_admin_id_fkey` (`ON DELETE CASCADE ON UPDATE CASCADE`).
       - Added extended columns to `user_access_policies`: `can_create_mailboxes`, `max_mailboxes`, `allowed_domain_uuids`, `auto_delete_enabled`, `auto_delete_days`.
       - Added `user_control_settings` singleton table with all 16 governance columns.
       - Updated `site_settings` default branding values from legacy `MailStack` to `ReadBox`.
  2. **`BUG-02` (Cross-Table Actor ID Collision & Foreign Key Integrity):**
     - Enhanced `RecordAuditInput` (`/src/core/audit/types.ts`) with optional `authSource?: "admin_table" | "user_table"` and `actorUsername?: string | null`.
     - Updated `recordAudit` (`/src/core/audit/record.ts`) so that when `authSource === "admin_table"`, `actorId` is written as `null` in `audit_logs` (preventing `audit_logs_actor_id_fkey` FK failures and preventing misattribution to a regular user with the same numeric ID in `users`) while preserving `actor_source: "admin_table"`, `admin_actor_id`, and `actor_username` inside `details`. Added a `P2003` foreign-key fallback retry so no audit log is ever lost if an unlinked `actorId` is passed.
     - Updated `listAuditLogs` (`/src/core/audit/queries.ts`) so `actorUsername` falls back to `details.actor_username` when `row.actor?.username` is `null`.
     - Updated `resolveActorIdForDatabase` / `resolveActorId` in `/src/core/accounts/users.ts`, `/src/core/mailboxes/service.ts`, `/src/core/domains/service.ts`, `/src/core/operations/service.ts`, and `/src/core/messages/service.ts` to return `null` immediately when `authSource === "admin_table"`, preventing `MailboxMembership.assignedById`, `Mailbox.deletedById`, and `Message.deletedById` from linking to a regular user in `users`.
     - Fixed `deleteManagedUser` (`/src/core/accounts/users.ts:817`) to check `auditContext.authSource !== "admin_table" && userId === auditContext.actorId` so an `AdminAccount` with `id = 1` can delete `User.id = 1` without triggering a false `self_delete` error.
     - Propagated `authSource` and `actorUsername` across `/src/core/accounts/user-control-policy.ts`, `/src/core/settings/service.ts`, `/src/core/updates/service.ts`, `/src/core/auth/sign-up.ts`, `/src/core/ingestion/repair.ts`, `/src/app/(workspace)/vcon/{users,users/control,mailboxes,domains,operations,settings}/actions.ts`, and `/src/app/api/vcon/update/start/route.ts`.
  3. **`BUG-03` (`messages.parse_status` CHECK Constraint Mismatch):**
     - Updated `/src/core/ingestion/service.ts:386` to set `parseStatus = "error"` (instead of `"failed"`) when `parsed.parseFailed` is `true`, matching PostgreSQL's `messages_parse_status_check` (`'ok'`, `'warning'`, `'error'`, `'oversized'`).
     - Updated `/src/core/operations/service.ts:336` to query `parseStatus: { in: ["error", "failed"] }` for `failedMessages`.
  4. **`BUG-04` (Mailbox Local-Part Regex Drift):**
     - Updated `createDemoMailbox` in `/src/core/messages/demo-workspace.ts` to validate local parts via `validateLocalPart` from `/src/core/mailboxes/validators.ts`, enforcing identical RFC/Postfix rules (`LOCAL_PART_PATTERN`, reserved names, no `+` or leading/trailing punctuation) in both Demo and Production modes.
- **Modified Files (23 files, 100% within Phase-01 Scope Lock):**
  - `/prisma/migrations/20261017000000_initial_application_schema/migration.sql`
  - `/src/core/audit/types.ts`, `/src/core/audit/record.ts`, `/src/core/audit/queries.ts`
  - `/src/core/accounts/users.ts`, `/src/core/accounts/user-control-policy.ts`
  - `/src/core/mailboxes/service.ts`, `/src/core/domains/service.ts`, `/src/core/operations/service.ts`
  - `/src/core/messages/service.ts`, `/src/core/messages/demo-workspace.ts`
  - `/src/core/ingestion/service.ts`, `/src/core/ingestion/repair.ts`
  - `/src/core/settings/service.ts`, `/src/core/updates/service.ts`, `/src/core/auth/sign-up.ts`
  - `/src/app/(workspace)/vcon/{users,users/control,mailboxes,domains,operations,settings}/actions.ts`
  - `/src/app/api/vcon/update/start/route.ts`
- **Verification Performed:** `npm test` (0 failures), `compile_applet` (succeeded), `lint_applet` (0 errors).

---

### Phase 02 — Auth, Session Telemetry, Password Reset & Starter Mailbox (`COMPLETED: 2026-11-16`)

- **Resolved Bugs:**
  1. **`BUG-10` (Production Session Device/IP/LastSeen Telemetry):**
     - Updated `SessionRegistryOptions`, `registerAppSession`, and `getActiveAppSession` in `/src/core/auth/session-registry.ts` to persist `ipAddress` (up to 64 chars), `userAgent` (up to 500 chars), and `lastSeenAt` when registering `AppSession` and `AdminSession` rows, and to refresh `lastSeenAt` (plus backfill empty `ipAddress`/`userAgent`) when validating active sessions.
     - Updated `/src/auth.ts` to extract `requestClientIp` (`extractClientIp(req?.headers, { trustProxyHeaders: env.trustProxyHeaders })`) and `requestUserAgent` (`req?.headers?.get("user-agent")`) and pass them to `registerAppSession`, `getActiveAppSession`, `registerDevDemoSession`, and `getActiveDevDemoSession`.
  2. **`BUG-11` (Self-Service Password Reset Request Flow + Dynamic Policy + AdminAccount & Demo Support + AuditLog):**
     - Added `requestPasswordReset` and `completePasswordResetDetailed` in `/src/core/auth/password-reset.ts` and `issueDevDemoPasswordResetToken` / `completeDevDemoPasswordReset` in `/src/core/auth/dev-demo-auth.ts`.
     - Enforced dynamic `UserControlSettings` password policy (`minPasswordLength`, `requireStrongPassword`) during password reset completion while maintaining 100% compatibility with operator bootstrap tests.
     - Added `AdminAccount` password reset token support (`__readboxAdminResetTokens`) and recorded `AuditLog` events (`password_reset_requested`, `password_reset_completed`) for both `user_table` and `admin_table` accounts.
     - Updated `/src/app/reset-password/actions.ts`, `/src/app/reset-password/page.tsx`, and `/src/components/auth/password-reset-form.tsx` so users can request a reset token by username/email, fill it with one click, and set a new password with exact field/policy error feedback.
  3. **`BUG-12` (`autoProvisionStarterMailbox` on User Sign-Up & Approval):**
     - Added `deriveStarterMailboxLocalPart` and `tryProvisionStarterMailbox` in `/src/core/auth/sign-up.ts`.
     - Wired starter mailbox auto-provisioning into `registerUserAccount` (when `settings.autoProvisionStarterMailbox && payload.verificationStatus === "verified"`) and `updatePendingUserVerification` (when `decision === "verified"` and `settings.autoProvisionStarterMailbox` is `true`) for both Production PostgreSQL/Maildir (`provisionMailbox`) and Demo Mode (`createDemoMailbox`).
  4. **`BUG-13` (Cross-Table Username Uniqueness Across `users` and `admin_accounts`):**
     - Updated `createManagedUser` and `updateManagedUser` in `/src/core/accounts/users.ts` to query `prisma.adminAccount.findFirst` (case-insensitive) and reject collisions with administrator usernames.
     - Updated `upsertAdminAccountRecord` in `/src/core/auth/sign-up.ts` to verify no non-admin `User` owns the target username before upserting into `admin_accounts`.
  5. **`BUG-14` (Demo Dynamic User Profile/Password Overrides & Sign-Up Security Events):**
     - Updated `listDevDemoDynamicUsers()` in `/src/core/auth/dev-demo-auth.ts` to map dynamic accounts through `applyAccountOverrides`.
     - Recorded `"user_self_signup"`, `"user_signup_approved"`, and `"user_signup_rejected"` security events in `dev-demo-auth.ts` and added labels in `/src/core/accounts/user-profile-schema.ts` and `/src/core/accounts/user-profile.ts`.
- **Modified Files (12 files, 100% within Phase-02 Scope Lock):**
  - `/src/auth.ts`
  - `/src/core/auth/session-registry.ts`
  - `/src/core/auth/dev-demo-auth.ts`
  - `/src/core/auth/password-reset.ts`
  - `/src/core/auth/sign-up.ts`
  - `/src/core/accounts/users.ts`
  - `/src/core/accounts/user-profile-schema.ts`
  - `/src/core/accounts/user-profile.ts`
  - `/src/app/reset-password/actions.ts`
  - `/src/app/reset-password/page.tsx`
  - `/src/components/auth/password-reset-form.tsx`
  - `/tests/auth/phase1-separate-auth-and-control.test.ts`
- **Verification Performed:**
  - `npm test` (all auth, database, admin, messages, profile, and compatibility test suites passed with 0 failures).
  - `compile_applet` and `lint_applet` passed with 0 errors.
- **Out-of-Scope Impact Check:** Zero unrelated pages, layouts, or components outside the Phase-02 Auth/Reset-Password scope were touched.

---

### Phase 03 — Fail-Closed Policy Persistence, Contact DB & Retention Engine (`COMPLETED: 2026-11-16`)

- **Resolved Bugs:**
  1. **`BUG-05` (Fail-Closed Policy Persistence & Domain Isolation in `/vcon/users/control`):**
     - Updated `updateUserControlSettings` in `/src/core/accounts/user-control-policy.ts` so when a Prisma client with `userControlSettings` is active and a database write error occurs, it logs `user_control_settings_update_failed` via `logger.error` and returns `{ ok: false, error: "Could not save user control policy to database. Please try again." }` instead of silently falling back to demo memory and returning `{ ok: true }`.
     - Updated `updateUserExtendedPolicy` in `/src/core/accounts/user-control-policy.ts` to load base defaults from `await getUserControlSettings(prisma)` instead of `getUserControlSettings(null)` and to fail-closed (`{ ok: false, error: "Could not save user access policy to database. Please try again." }`) with `logger.error("user_access_policy_update_failed", ...)` when `prisma?.userAccessPolicy` throws.
     - Updated `listUsersControlSnapshot` so when `databaseConnected` is `true`, it returns `domains: dbDomains` directly without injecting `DEMO_VERIFIED_DOMAINS` when 0 DB domains exist.
     - Aligned `DEMO_VERIFIED_DOMAINS[0].name` to `"readbox.local"` (matching `demo-workspace.ts`) and added `countDemoMailboxesForAccount` in the demo fallback branch of `listUsersControlSnapshot` so `demo.user` accurately reports `4` mailboxes instead of hardcoded `3`.
  2. **`BUG-06` (Fail-Closed Site Settings Persistence in `/vcon/settings`):**
     - Removed the `if (env.nodeEnv === "production")` guard around `client.siteSettings.upsert` in `updateSiteSettings` (`/src/core/settings/service.ts`) so that whenever a Prisma client (`client`) is provided, any database upsert error is logged and caught by the outer fail-closed error handler (`{ ok: false, error: "Unable to save site settings right now. Please try again." }`) instead of silently falling back to in-memory state.
  3. **`BUG-07` (PostgreSQL Persistence & Production HMAC Hardening for `/contact`):**
     - Hardened `getSecretKey()` in `/src/core/contact/service.ts` so `production` never uses a static hardcoded HMAC secret string; when `AUTH_SECRET` and `CONTACT_SECRET_KEY` are unset in `production`, it generates a 32-byte cryptographically random per-process secret (`ephemeralProductionSecret`) and logs a warning once.
     - Updated `recordContactSubmission` to persist the full sanitized inquiry payload (`request_id`, `full_name`, `work_email`, `work_email_domain`, `company`, `phone`, `has_company`, `has_phone`, `service_type`, `service_label`, `team_size`, `message`, `ip_hash`, `email_hash`, `submitted_at`) in PostgreSQL `AuditLog` (`action: "public_contact_submitted"`, `targetType: "contact_inquiry"`), failing closed (`{ ok: false, status: 500 }`) if `client` is active and database persistence fails.
     - Added `listContactSubmissions` in `/src/core/contact/service.ts` to query persisted contact inquiries from PostgreSQL `audit_logs` (or `submissionsStore` in Demo Mode).
  4. **`BUG-20` (Message Retention Engine, `receivedAt: null` Fallback & Counter Recalculation):**
     - Added `buildRetentionFilterClause` and `isMessageWithinRetention` in `/src/core/messages/service.ts` so messages with `receivedAt: null` fall back to `createdAt >= retentionCutoff` (`AND: [{ OR: [{ receivedAt: { gte: retentionCutoff } }, { receivedAt: null, createdAt: { gte: retentionCutoff } }] }]`) across `getUserWorkspaceOverview`, `listMailboxMessagesForUser`, and `getMessageDetailForUser`.
     - Updated `listMailboxMessagesForUser` to compute retention-filtered `totalMessages` and `unreadMessages` for the inbox header when `retentionCutoff` is active.
     - Added `purgeExpiredMessagesForRetention` in `/src/core/messages/service.ts` and `runRetentionPurge` in `/src/core/operations/service.ts` to soft-delete expired messages in PostgreSQL, recalculate accurate `Mailbox.totalMessages` and `Mailbox.unreadMessages` counters via `recalculateMailboxCounters`, and record `messages_retention_purged` in `AuditLog`.
- **Modified Files (8 files, 100% within Phase-03 Scope Lock):**
  - `/src/core/accounts/user-control-policy.ts`
  - `/src/core/settings/service.ts`
  - `/src/core/contact/service.ts`
  - `/src/core/messages/service.ts`
  - `/src/core/operations/service.ts`
  - `/tests/admin/phase6-settings-update-health.test.ts`
  - `/tests/admin/public-contact-service.test.ts`
  - `/tests/messages/phase5-users-workspace.test.ts`
- **Verification Performed:** `npm test` (0 failures across all unit and schema test suites), `compile_applet` (succeeded), `lint_applet` (0 errors).
- **Out-of-Scope Impact Check:** Zero UI pages, layouts, or unrelated routes were modified.

---

### Phase 04 — User Workspace Shell, Live Polling, Inline `cid:` Reader & Print Fix (`COMPLETED: 2026-11-16`)

- **Resolved Bugs:**
  1. **`BUG-15` (Route-Aware Admin User Workspace Sidebar & Switcher):**
     - Updated `AppShell` (`/src/components/layout/app-shell.tsx`) to compute `isUsersRoute = pathname.startsWith("/users")` and `showManagementSidebar = isAdministrator && (isAdminRoute || (!isUsersRoute || mailboxes === undefined))` so administrators visiting `/users/*` in the workspace receive the full User Workspace sidebar (`Overview`, `My mailboxes`, `Settings`, `+ Add mailbox`, and `Inboxes`) plus a compact header switcher link (`Admin panel` ↔ `User workspace`).
  2. **`BUG-17` (Stale Client State Sync, Full Sidebar Inbox List & Server Error Logging):**
     - Updated `/src/app/(workspace)/users/layout.tsx` to load up to `100` assigned mailboxes (`pageSize: 100`) instead of capping at `25`.
     - Added `logger.error` structured error logging across `/src/app/(workspace)/users/{layout,page,mailboxes/page,settings/page}.tsx` so unexpected Prisma exceptions are logged with user and route context instead of silently swallowed.
     - Added `useEffect` in `/src/components/users/mailbox-inbox-view.tsx` to resynchronize `liveCounts` (`totalMessages`, `unreadMessages`, `status`) whenever `mailbox` props change across route refreshes or inbox switches.
     - Added `useEffect` in `/src/components/users/create-user-mailbox-modal.tsx` to resynchronize `domainUuid` whenever `domains` or `defaultDomainUuid` props change.
     - Added `"readbox:live-mailboxes-updated"` custom event listener in `/src/components/layout/app-shell.tsx` so sidebar inbox badges update live when background polling detects changes.
  3. **`BUG-18` (Retention-Aware Live Polling & Cross-Tab State Refresh):**
     - Updated `pollLiveMessagesForUser` in `/src/core/messages/service.ts` to resolve actor capabilities and `retentionCutoff`, apply `buildRetentionFilterClause(retentionCutoff)` to `messageWhere`, filter `rows` with `isMessageWithinRetention`, and compute retention-filtered `total_messages` and `unread_messages` for both `summary` and per-mailbox items.
     - Updated `LiveMailNotifier` in `/src/components/users/live-mail-notifier.tsx` with `lastSnapshotSignatureRef` to detect cross-tab read/unread/delete/mailbox changes even when `payload.messages.length === 0`, triggering `router.refresh()` and dispatching `"readbox:live-mailboxes-updated"`.
  4. **`BUG-19` (Inline `cid:` Image Resolution & Isolated Email Print Styling):**
     - Updated `/src/core/ingestion/sanitizer.ts` (`isSafeInternalAttachmentImagePath`, `isSafeEmailImageSource`, and `sanitizeHtmlEmail(..., options?: { cidMap })`) to allow same-origin attachment image URLs (`/api/messages/attachment/<uuid>`) while keeping unmapped `cid:` and external `http(s):` tracking pixels blocked.
     - Added `resolveInlineCidAttachmentsInHtml` in `/src/core/messages/service.ts` and wired it into `getMessageDetailForUser` and `getSanitizedMessageHtmlForUser` (plus client-side fallback in `/src/components/users/message-reader-view.tsx`) so inline `cid:<contentId>` references render seamlessly from `/api/messages/attachment/<uuid>`.
     - Added `data-print-region="message-reader"` and `data-print-hide="true"` attributes across `/src/components/layout/app-shell.tsx`, `/src/components/users/mailbox-inbox-view.tsx`, and `/src/components/users/message-reader-view.tsx`, paired with `@media print` isolation rules in `/src/app/globals.css`.
- **Modified Files (13 files, 100% within Phase-04 Scope Lock):**
  - `/src/components/layout/app-shell.tsx`
  - `/src/components/users/live-mail-notifier.tsx`
  - `/src/components/users/mailbox-inbox-view.tsx`
  - `/src/components/users/message-reader-view.tsx`
  - `/src/components/users/create-user-mailbox-modal.tsx`
  - `/src/app/(workspace)/users/layout.tsx`
  - `/src/app/(workspace)/users/page.tsx`
  - `/src/app/(workspace)/users/mailboxes/page.tsx`
  - `/src/app/(workspace)/users/settings/page.tsx`
  - `/src/core/ingestion/sanitizer.ts`
  - `/src/core/messages/service.ts`
  - `/src/app/globals.css`
  - `/tests/ui/app-shell.test.tsx`, `/tests/messages/phase5-users-workspace.test.ts`
- **Verification Performed:** `npm test` (0 failures), `npm run test:ui` (0 failures), `compile_applet` (succeeded), `lint_applet` (0 errors).
- **Out-of-Scope Impact Check:** Zero `/vcon/*` admin pages, auth endpoints, or updater scripts outside Phase-04 scope were modified.

---

## 3. Remaining Phases Queue & Scope-Lock Guarantees

### Next Up: Phase 05 — Admin Self-Service Settings & Demo Workspace Parity
- **Bugs to Fix:** `BUG-08`, `BUG-16`
- **What Will Be Added/Updated:**
  - **`BUG-16`:** Enable self-service profile editing (`firstName`, `lastName`, `email`), password change (`AdminAccount.passwordHash` + `passwordResetRequired = false`), and active `AdminSession` revocation (`revokeAdminSessionById`, `revokeOtherAdminSessions`) for `admin_table` administrators in `/src/core/accounts/user-profile.ts`, `/src/core/auth/session-registry.ts`, and `/src/app/(workspace)/users/settings/actions.ts`.
  - **`BUG-08`:** Enforce full production parity in `/src/core/messages/demo-workspace.ts` and `/src/app/api/messages/live/route.ts`: dynamic `canDeleteMessages` / `canDeleteMailboxes` / `canCreateMailboxes` from `getDemoUserExtendedPolicy`, per-user mailbox quota (`maxMailboxes`), per-user mailbox ownership filtering, retention check in `getDemoMessageDetail`, and real cursor-based live polling in Demo Mode (`pollDemoLiveMessages`).
- **Untouched Guarantee:** Only `/src/core/accounts/user-profile.ts`, `/src/core/auth/session-registry.ts`, `/src/app/(workspace)/users/settings/{page,actions}.ts`, `/src/core/messages/demo-workspace.ts`, and `/src/app/api/messages/live/route.ts` (+ unit tests) will be touched.

### Queued After Phase 05:
- **Phase 06:** System updater `UPDATE_SCRIPT_PATH` fix & configurable service/path defaults (`BUG-21`) and setup runner integration (`BUG-09`).

