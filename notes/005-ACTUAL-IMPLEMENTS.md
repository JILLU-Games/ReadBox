# 005 — Actual Implements & Feature Status Register

> **Frozen Baseline:** [`000-BASELINE-FREEZE.md`](./000-BASELINE-FREEZE.md) (`2026-11-16`)  
> **Purpose:** প্রজেক্টের কোন কোন feature এখন **১০০% বাস্তবে কাজ করছে (Actual Working)**, কোনগুলো **Partial / Buggy**, এবং কোনগুলো **Upcoming Phases-এ add/fix হবে** তার exact রেকর্ড।

---

## 1. Currently Working Features (Verified in Baseline `v0.1.0`)

### 1.1 Authentication, Authorization & Role Isolation
- **Separate Login Routes:**
  - Regular Users sign in at `/sign-in` (`loginScope="user"`, `User` table).
  - Administrators sign in at `/vcon/login` (`loginScope="admin"`, `AdminAccount` table + `AdminSession`).
- **Dynamic User Self Sign-Up (`/sign-up`):**
  - Controlled globally by `UserControlSettings` (`signupEnabled`, required/optional/hidden fields for `firstName`, `lastName`, `email`, `phone`, password rules, `instant` / `admin_approval` / `invite_code` verification).
- **Route Guards (`src/core/auth/route-guards.ts`):**
  - Strict separation preventing non-admin access to `/vcon/*` and ensuring unauthenticated redirects go to the matching login page (`/sign-in` vs `/vcon/login`).
- **Password Reset (`/reset-password`):** Operator-issued token verification & Argon2 password update (`PasswordResetToken`).
- **Security Audit & Lockout:** Login throttling via `LoginAttempt` and redacted `AuditLog` tracking.

### 1.2 Admin Control Console (`/vcon/*`)
- **System Overview (`/vcon`):** Live KPIs (total/active/disabled mailboxes, total/unread messages, last received) + DB/runtime health status cards.
- **Users Control (`/vcon/users/control`):**
  - Global registration settings (toggle sign-up, field rules, verification mode, invite code).
  - Global defaults + per-user overrides for `canCreateMailboxes`, `canDeleteMessages`, `canDeleteMailboxes`, `maxMailboxes`, `allowedDomainUuids`, `autoDeleteEnabled`, `autoDeleteDays`.
  - Pending account approval queue (`verificationStatus` approve/reject).
- **Domains (`/vcon/domains`, `/vcon/domains/new`):** Domain creation, active/disabled status, DNS record preview, live DNS verification check.
- **Mailboxes (`/vcon/mailboxes`, `/vcon/mailboxes/new`):** Admin mailbox listing, search/filter, provisioning, assignment, status toggle, purge.
- **Operations (`/vcon/operations`):** Maildir ingestion runs, body repair batches, retention enforcement triggers.
- **Site Settings (`/vcon/settings`):** Dynamic `siteName`, `siteTagline`, `logo` & `favicon` upload/clear, footer text, support email/phone — broadcast dynamically to `AppShell` (`readbox:site-settings-updated`).
- **System Update (`/vcon/system-update`):** GitHub release check, host preflight checks, signed update handoff queue & live polling modal.

### 1.3 User Webmail Workspace (`/users/*`)
- **User Overview (`/users`):** Mailbox/message summary stats, recent messages list, recent mailboxes list.
- **Self-Service Mailboxes (`/users/mailboxes`):** Search/filter mailboxes, create mailbox (enforcing `canCreateMailboxes`, `allowedDomainUuids`, and `maxMailboxes`), enable/disable, bulk actions, purge confirmation (enforcing `canDeleteMailboxes`).
- **Inbox Split-View & Message Reader (`/users/inbox/[mailboxUuid]` & `[messageUuid]`):**
  - Search by sender/subject, filter by read/unread and attachment presence, pagination.
  - Live polling (`/api/messages/live`) updating unread counts & desktop/toast alerts.
  - Unified email canvas (removed HTML/Plain-text toggle confusion), sanitized link opening (`target="_blank"`), attachment download (`/api/messages/attachment/[attachmentUuid]`), mark unread, delete message (enforcing `canDeleteMessages`), print, next/prev navigation.
- **Auto-Delete Retention Enforcement:** Runtime filtering/cleanup respecting `autoDeleteEnabled` & `autoDeleteDays`.

### 1.4 Public Pages, PWA & Database-Off Demo Preview
- **Public Pages:** `/` (landing), `/contact` (CSRF + rate-limited inquiry form), `/privacy`.
- **PWA Support:** `src/app/manifest.ts` + `public/sw.js` + `public/offline.html` + `ServiceWorkerRegistration`.
- **Dev Demo Mode:** Complete in-memory preview (`demo-workspace.ts`) when `DATABASE_URL` is absent in local dev.

---

## 2. Partial / Buggy Items (Scheduled for Repair Across Phases 01–06)

| Feature Area | Current Limitation / Bug | Target Phase |
|---|---|---|
| **Global UI Design System (`src/components/ui`)** | Shared primitives created (`Phase-01`) and rolled out across reader/workspace/public/auth/admin (`Phase-02`–`Phase-05`); `global-error.tsx` theme parity remaining for `Phase-06`. | `Completed (Phase-01 → Phase-05)` |
| **Email Reader Theme & CSS** | Resolved in `Phase-02` (removed JSX `<style>`, added depth-aware `@media` CSS scoping + `?theme=` API sync + `ERR-03` Retry banner). | `Completed (Phase-02)` |
| **HTML Email External Images** | Security contract verified: `sanitizer.ts` blocks remote `https://` tracker pixels & `SAFE_HTML_CSP_POLICY` enforces `img-src data:`, while MIME `cid:` inline raster images render as `data:image/*` base64 URIs. | `Verified (Phase-02)` |
| **Inbox Heading Semantics** | Resolved in `Phase-02` (fixed nested `<CopyButton>` in `<h1>`, fixed split-view duplicate `<h1>`, adopted shared `Pagination`/`SectionTitle`). | `Completed (Phase-02)` |
| **User Workspace Create & Quota UI** | Resolved in `Phase-03` (single `Create mailbox` button in page headers wired to shell modal, `totalCount` quota sync, `PageHeader`/`StatGrid`/`StatCard`/`Pagination`/`FormField`/`CaptionText` migration). | `Completed (Phase-03)` |
| **Auth Pages Branding** | Resolved in `Phase-04` (`/sign-in`, `/sign-up`, `/reset-password`, `/vcon/login` now render shared `<BrandLogo>` with dynamic `settings.logoUrl` & `siteName`; auth forms standardized on `<FormField>`). | `Completed (Phase-04)` |
| **Public Pages Copy & Components** | Resolved in `Phase-04` (removed `"M"` fallback & hardcoded `PageTitle`/`SectionTitle`/`h2`/`h3`/`text-[10px|11px]` overrides, adopted `<BrandLogo>`, `<NavLink>`, `<Accordion>`, `<FormField>`, `<SubHeading>`, `<CaptionText>`, and trimmed extra subtitle noise). | `Completed (Phase-04)` |
| **Admin Pages Consistency** | Resolved in `Phase-05` (unified `<PageHeader>`, `<BrandLogo>` + `<FileInput>` in Settings, `<NavLink>` + `<BrandLogo>` + `<Button>` in `AppShell`, `<ProgressBar>` in System Update, `<StatGrid>`/`<StatCard>`/`<Pagination>`/`<CaptionText>`, `aria-invalid`/`aria-describedby` form linkage, `/vcon/not-found.tsx` -> `/vcon`). | `Completed (Phase-05)` |
| **Legacy Identifiers & Global Error Theme** | Resolved in `Phase-06` (`readbox-*.png`/`.svg` PWA icons, `readbox-public-static-v2` SW cache, `readbox.local` demo domain, `X-ReadBox-CSRF` header + 403 auto-retry & 429 `Retry-After`, `readbox-*` notifier keys + 401 single-shot stop, `readbox-update-log-*` modal IDs, `global-error.tsx` theme sync, and `BigInt` guard in `update/start`). | `Completed (Phase-06)` |

---

## 3. Post-Phase Update Register (Populated As Phases Complete)

> *প্রতি Phase শেষ হওয়ার সাথে সাথে এখানকার টেবিলে newly verified working features যোগ হবে:*

- **`[Phase-01]` Completed (`2026-11-16`):** Unified Global UI Component Foundation ready (`PageHeader`, `StatGrid`/`StatCard`, `BrandLogo`, `Pagination`, `Accordion`, `FileInput`, `NavLink`, `ProgressBar`, `SubHeading`, `CaptionText`, `CopyButton` variants + clipboard fallback, `font-medium` typography consistency, and global `.readbox-mail-body` / `.readbox-scrollable` CSS classes).
- **`[Phase-02]` Completed (`2026-11-16`):** Email Reader & Inbox Split-View fixed (depth-aware CSS scoping with `@media`/`@supports` safety, Light/Dark `?theme=` sync on HTML fetch, wrapper `<style>` double-padding removal, `<AlertBanner>` + Retry fallback for failed HTML fetch, `<button type="button">` email CTA normalization, invalid nested/duplicate `<h1>` resolved, shared `<Pagination>` & `<SectionTitle>` adopted, inline `data:image/*` CID rendering + tracker-blocking security verified).
- **`[Phase-03]` Completed (`2026-11-16`):** User Workspace Shell & `/users/*` standardized (`totalMailboxCount` quota sync in `UsersWorkspaceLayout` -> `UsersWorkspaceShell`, duplicate top `Create mailbox` button removed, `<PageHeader>`, `<StatGrid>`/`<StatCard>`, `<Pagination variant="boxed">`, `<FormField>`, and `<CaptionText>` adopted across Overview, My Mailboxes, and Create Modal).
- **`[Phase-04]` Completed (`2026-11-16`):** Public (`/`, `/contact`, `/privacy`) & Auth (`/sign-in`, `/sign-up`, `/reset-password`, `/vcon/login`) pages standardized (`<BrandLogo>` with dynamic `settings.logoUrl`, `<NavLink>`, `<Accordion>`, `<FormField>` with `aria-invalid`/`aria-describedby`, `<PageTitle>`/`<SectionTitle>`/`<SubHeading>`/`<CaptionText>`, and clean compact public copy without subtitle bloat).
- **`[Phase-05]` Completed (`2026-11-16`):** Admin Console (`/vcon/*`) & `AppShell` standardized (`<PageHeader>`, `<BrandLogo>` + `<FileInput>` in Settings, `<NavLink>` + `<BrandLogo>` + `<Button>` in `AppShell`, `<ProgressBar>` in System Update, `<StatGrid>`/`<StatCard>` in Overview/Audit/Operations, `<Pagination variant="boxed">`, valid `CopyButton` variants, `<CaptionText>`, `aria-invalid`/`aria-describedby` linkage, and `/vcon/not-found.tsx` recovery link fixed to `/vcon`).
- **`[Phase-06]` Completed (`2026-11-16`):** Legacy Branding Purge, PWA/Metadata Sync & Error-Handling Hardening finished (`readbox-192.png`, `readbox-512.png`, `readbox.svg` + `manifest.ts` + `layout.tsx` OpenGraph/icon fallback, `readbox-public-static-v2` SW cache with legacy cleanup, `readbox.local` demo workspace + landing default, `X-ReadBox-CSRF` + `403` auto-retry + `429` wait guidance, `readbox-*` notifier identifiers + `401` single-shot session stop, `readbox-update-log-modal` IDs, clean `/vcon/login` header without `vcon` badge, `global-error.tsx` theme persistence, and `update/start` `actorId` guard). All `6/6` Phases completed and production build verified.
