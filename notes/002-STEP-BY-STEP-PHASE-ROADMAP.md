# 002 — Step-by-Step Phase Implementation Roadmap (A–Z)

**Baseline Reference:** [`/notes/FORENSIC-AUDIT-REPORT.md`](./FORENSIC-AUDIT-REPORT.md) & [`/notes/001-PRODUCTION-READINESS-REPORT.md`](./001-PRODUCTION-READINESS-REPORT.md)  
**Total Phases:** **6 Sequential Scope-Locked Phases**  
**Total Bugs Resolved Across Roadmap:** **21 / 21**

---

## Execution Rules for Every Phase

1. **Pre-Implementation Scope Lock Check:** Only touch files listed in that phase's Scope Lock.
2. **Post-Patch Self-Audit:** Re-inspect all modified lines against the assigned Bug IDs (`BUG-XX`), verify zero regressions in untouched features, and run targeted verification (`compile_applet` + `lint_applet` + relevant unit tests).
3. **Documentation Sync:** After completing each phase, update:
   - `/notes/003-PHASE-EXECUTION-LOG.md`
   - `/notes/004-ERROR-HANDLING-REGISTRY.md`
   - `/notes/005-ACTUAL-WORKING-FEATURES-TRACKER.md`
4. **Approval Gate:** Stop after reporting the completed phase and wait for the user's explicit Phase Approval command before starting the next phase.

---

## Phase 01 — Database Schema, SQL Migrations & Actor FK Integrity
- **Target Bugs:** `BUG-01` (Critical), `BUG-02` (Critical), `BUG-03` (High), `BUG-04` (Medium)
- **Step-by-Step Implementation Tasks:**
  1. **Migration Synchronization (`BUG-01`):**
     - Create a forward-compatible PostgreSQL migration under `/prisma/migrations/` that idempotently adds `admin_accounts`, `admin_sessions`, `user_control_settings`, missing columns on `users` (`phone`, `verification_status`) and `user_access_policies` (`can_create_mailboxes`, `max_mailboxes`, `allowed_domain_uuids`, `auto_delete_enabled`, `auto_delete_days`), and updates `site_settings` defaults to `ReadBox`.
  2. **Actor Attribution & FK Safety (`BUG-02`):**
     - Update `resolveActorIdForDatabase` and `recordAudit` callers so `authSource === "admin_table"` never collides with `users.id`. Store `actor_source` / `admin_actor_id` in `AuditLog.details` (or nullable `actorId` when `authSource === "admin_table"`) so `audit_logs` never fail FK constraints (`audit_persistence_failed`) and never misattribute admin actions to `users.id = 1`.
     - Fix `deleteManagedUser` (`src/core/accounts/users.ts:829`) so `self_delete` only triggers when `auditContext.authSource !== "admin_table"` and `userId === auditContext.actorId`.
  3. **Message `parse_status` Alignment (`BUG-03`):**
     - Update `messages_parse_status_check` and/or normalize `ingestion/service.ts:385` and `operations/service.ts:338` so failed message parses use a consistent status (`"error"` / `"failed"`) that passes PostgreSQL CHECK constraints and displays accurately on `/vcon/operations`.
  4. **Local-Part Validator Unification (`BUG-04`):**
     - Update `createDemoMailbox` (`src/core/messages/demo-workspace.ts:803`) to validate local parts using `LOCAL_PART_PATTERN` and `RESERVED_LOCAL_PARTS` from `src/core/mailboxes/validators.ts`.
- **Verification Criteria:**
  - Migration SQL matches `prisma/schema.prisma` 100%.
  - Admin actions from `admin_accounts` persist audit logs without FK errors or `users.id` collision.
  - Failed message parse ingestion and operations count agree on `parse_status`.

---

## Phase 02 — Authentication, Session Telemetry, Password Reset & Starter Mailbox Provisioning
- **Target Bugs:** `BUG-10` (Critical), `BUG-11` (High), `BUG-12` (High), `BUG-13` (High), `BUG-14` (Medium)
- **Step-by-Step Implementation Tasks:**
  1. **Production Session Telemetry (`BUG-10`):**
     - Pass request `clientIp` and `userAgent` from `src/auth.ts` into `registerAppSession` (`src/core/auth/session-registry.ts`) for both `appSession` and `adminSession`, setting initial `lastSeenAt: new Date()`.
     - Update `getActiveAppSession` to refresh `lastSeenAt` (throttled safely) so `/users/settings` displays real device labels, IP addresses, and last-active timestamps in production.
  2. **Complete Self-Service Password Reset (`BUG-11`):**
     - Add self-service reset request action/mode on `/reset-password` (requesting a reset token by username/email with rate-limiting and audit logging) alongside token completion.
     - Enforce dynamic password policy (`UserControlSettings.minPasswordLength` and `requireStrongPassword`) instead of hardcoded `15` in `password-reset.ts` and `password-reset-form.tsx`.
     - Support `?token=` URL prefill, `AdminAccount` password resets, Demo Mode password resets, and `AuditLog` recording (`password_reset_completed`).
  3. **Starter Mailbox Auto-Provisioning (`BUG-12`):**
     - When `settings.autoProvisionStarterMailbox` is `true`, automatically provision a starter mailbox on the default/allowed active domain and assign `MailboxMembership` when a user is verified during `registerSelfSignupUser` or approved via `updatePendingUserVerification` (and in Demo Mode).
  4. **Cross-Table Username Uniqueness & Bootstrap (`BUG-13`):**
     - Check both `prisma.user` and `prisma.adminAccount` for case-insensitive username collisions in `createManagedUser`, `updateManagedUser`, and `registerSelfSignupUser`.
     - Align `bootstrapInitialAccount` (`src/core/auth/operator-bootstrap.ts`) with `admin_accounts` awareness.
  5. **Demo Dynamic User Overrides & Audit Events (`BUG-14`):**
     - Apply `applyAccountOverrides` in `listDevDemoDynamicUsers()` and emit `appendDemoSecurityEvent` in `updateDevDemoDynamicUserStatus()`.
- **Verification Criteria:**
  - Active sessions in production record real UA/IP/`lastSeenAt`.
  - Password reset honours dynamic password policy and works in both DB and Demo Mode.
  - `autoProvisionStarterMailbox` creates an assigned starter mailbox upon user verification.

---

## Phase 03 — Backend Policy Persistence, Public Contact Storage & Retention Purge Engine
- **Target Bugs:** `BUG-05` (Critical), `BUG-06` (High), `BUG-07` (High), `BUG-20` (High)
- **Step-by-Step Implementation Tasks:**
  1. **Fail-Closed User Control Persistence (`BUG-05`):**
     - In `src/core/accounts/user-control-policy.ts`, when a Prisma client is provided, do NOT swallow write errors in `updateUserControlSettings` or `updateUserExtendedPolicy` into `{ ok: true }` demo memory; return `{ ok: false, error: ... }` and log the error.
     - Fix line `705` so `updateUserExtendedPolicy` calls `await getUserControlSettings(prisma)` instead of `getUserControlSettings(null)`.
     - In `listUsersControlSnapshot`, when `databaseConnected: true`, return `dbDomains` directly (`[]` if none exist) instead of injecting `DEMO_VERIFIED_DOMAINS`.
     - In the demo fallback branch of `listUsersControlSnapshot`, compute actual mailbox count from the demo workspace store instead of hardcoding `3`.
  2. **Fail-Closed Site Settings Persistence (`BUG-06`):**
     - In `src/core/settings/service.ts:556-565`, when `client` is provided (`env.databaseUrl` configured), do not silently swallow DB upsert failures into `{ ok: true }`.
  3. **Public Contact Inquiry Persistence (`BUG-07`):**
     - Persist sanitized contact inquiries (`requestId`, `fullName`, `workEmail`, `company`, `phone`, `serviceType`, `teamSize`, `message`, `ipHash`) in PostgreSQL / structured audit storage so no inquiry is lost on process restart, and enforce secret key safety.
  4. **Message Auto-Delete Retention Purge & Counter Sync (`BUG-20`):**
     - Fix retention query filter so messages with `receivedAt: null` fall back to `createdAt` (`OR: [{ receivedAt: { gte: cutoff } }, { receivedAt: null, createdAt: { gte: cutoff } }]`).
     - Compute retention-accurate `totalMessages` / `unreadMessages` for mailboxes when retention is active, and provide an idempotent retention purge helper (`purgeExpiredMessagesForRetention`) that soft-deletes/purges expired messages and updates mailbox counters.
- **Verification Criteria:**
  - DB write failures in `/vcon/users/control` and `/vcon/settings` return real errors instead of fake `{ ok: true }`.
  - Contact form submissions persist durably.
  - Retention policy accurately reflects in mailbox message counts and purges expired records.

---

## Phase 04 — User Workspace Shell, Live Polling, Inline `cid:` Reader & Print Fix
- **Target Bugs:** `BUG-15` (High), `BUG-17` (Medium), `BUG-18` (Medium), `BUG-19` (Medium)
- **Step-by-Step Implementation Tasks:**
  1. **Route-Aware Sidebar for Administrators (`BUG-15`):**
     - In `src/components/layout/app-shell.tsx`, render the Management navigation when `isAdministrator && isAdminRoute` and render the User Workspace navigation (`Overview`, `My mailboxes`, `Settings`, `+ Add mailbox`, and `Inboxes`) when on `/users/*` routes, while adding a compact switcher link so admins can jump between `/vcon` and `/users`.
  2. **Client State Resync, Full Sidebar Mailbox List & Error Logging (`BUG-17`):**
     - Sync `liveCounts` in `MailboxInboxView` whenever `mailbox.uuid`, `mailbox.totalMessages`, `mailbox.unreadMessages`, or `mailbox.status` props change.
     - Sync `domainUuid` in `CreateUserMailboxModal` when `domains` prop updates.
     - Allow `/users/layout.tsx` to load up to the sidebar/live limit (`100` mailboxes) rather than capping at page 1 (`25`), and log unexpected Prisma errors in `/users/*` server pages.
  3. **Retention-Aware & State-Synchronized Live Polling (`BUG-18`):**
     - Update `pollLiveMessagesForUser` (`src/core/messages/service.ts`) to apply `resolveActorCapabilities` & `resolveActorRetentionCutoff` and include recent read/delete state changes so open tabs stay synchronized.
  4. **Inline `cid:` Image Support & Clean Print View (`BUG-19`):**
     - Rewrite `cid:...` image references in `getMessageHtmlForUser` / `getDemoMessageHtml` (or sanitizer allowlist for internal attachment inline endpoints) to resolve against the message's inline attachments (`isInline` / `contentId`).
     - Add `@media print` isolation so clicking Print in `MessageReaderView` prints only the email header, metadata, and message body without the AppShell sidebar, topbar, or inbox list.
- **Verification Criteria:**
  - Admins visiting `/users` see the User Workspace sidebar and can click `+ Add mailbox`.
  - Switching mailboxes immediately updates header total/unread counts.
  - Inline `cid:` attachments render inside HTML emails, and `window.print()` prints only the message content.

---

## Phase 05 — Admin Self-Service Account/Security Settings & Demo Workspace Parity
- **Target Bugs:** `BUG-08` (Medium), `BUG-16` (High)
- **Step-by-Step Implementation Tasks:**
  1. **Admin Self-Service Profile, Password & Session Management (`BUG-16`):**
     - Update `src/core/accounts/user-profile.ts` (`getUserProfile`, `updateUserProfile`, `getUserSecuritySnapshot`, `updateUserPassword`, `revokeUserSession`, `revokeOtherUserSessions`) to support `authSource === "admin_table"` (`prisma.adminAccount` and `prisma.adminSession`) as well as `user_table` administrators.
     - Fix `/src/app/(workspace)/users/settings/page.tsx` fallback `editable: true` and add a quick link to `/users/settings` from the admin workspace so administrators can manage their own profile, rotate their password, and revoke active `AdminSession`s.
  2. **Demo Workspace Full Production Parity (`BUG-08`):**
     - In `src/core/messages/demo-workspace.ts`:
       - Replace hardcoded `canDeleteMessages: true` (`:390`) and `canDeleteMessage: true` (`:737`) with `effective.canDeleteMessages`.
       - Enforce per-user mailbox ownership and capability checks in `listDemoMailboxMessages`, `getDemoMessageDetail`, `getDemoMessageHtml`, `getDemoAttachmentDownload`, `createDemoMailbox`, `deleteDemoMailbox`, `bulkDeleteDemoMailboxes`, `markDemoMessageUnread`, and `softDeleteDemoMessage`.
       - Make `pollDemoLivePayload` actor-aware and return dynamic cursor/message updates.
     - Pass `user.isAdministrator` and `user.id` into `listDemoMailboxMessages` and `getDemoMessageDetail` in `/users/inbox/[mailboxUuid]/page.tsx`, `[messageUuid]/page.tsx`, and `/api/messages/*`.
- **Verification Criteria:**
  - Both `admin_table` and `user_table` administrators can edit their profile, update their password, and manage active sessions.
  - Demo workspace enforces `canDeleteMessages`, `canDeleteMailboxes`, `maxMailboxes`, retention cutoffs, and live polling identically to production.

---

## Phase 06 — System Updater, Backup Scripts & Setup Runner Alignment
- **Target Bugs:** `BUG-09` (Medium), `BUG-21` (Critical)
- **Step-by-Step Implementation Tasks:**
  1. **System Updater Path & Service Name Alignment (`BUG-21`):**
     - Fix `UPDATE_SCRIPT_PATH` default in `src/config/env-schema.ts` and `.env.example` from `/opt/vibmail/app/scripts/upgrade.sh` to `/opt/vibmail/app/scripts/updater/upgrade.sh` (and support configurable `APP_ROOT`, `ENV_FILE`, `BACKUP_ROOT`, and web/ingestion service names in `src/core/updates/service.ts`, `scripts/updater/upgrade.sh`, and `scripts/ops/backup.sh` with safe backward-compatible fallbacks).
  2. **Setup / Trusted Installer Runner Integration (`BUG-09`):**
     - Connect `src/core/setup/trusted-operations.ts` to a verified preflight/setup status inspection helper used by operations/setup verification so no orphaned setup runner contract remains.
- **Verification Criteria:**
  - `runUpdatePreflight` and `update_worker.py` resolve the exact same `upgrade.sh` path by default.
  - All 6 phases pass `compile_applet`, `lint_applet`, and unit test suites with 0 errors.
