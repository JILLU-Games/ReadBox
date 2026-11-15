# 05 — Actual Implementation Status Matrix

**Snapshot Date:** `2026-11-15` (Baseline Freeze before `Phase-01`)  
This document tracks **what actually works end-to-end in code today**, **what works in Demo Mode vs Live PostgreSQL**, **what has UI/code defects**, and **what remains to be completed**.

---

## 1. Feature-by-Feature Actual Status (Verified in Source)

| Feature / Module | Actual Working State Today | Verified Code Gaps / Defects | Target Phase |
| :--- | :--- | :--- | :--- |
| **Authentication (`/sign-in`, `/reset-password`)** | Credentials sign-in (`next-auth`), Argon2 verification, opaque token password reset, `devDemoAuth` (`demo-admin`/`demo-user`), `bypass` mode, route guards all work. | Auth UI uses `0%` `@/components/ui` (`rounded-md`, `min-h-11`), hardcoded `"ReadBox"` text, no `ThemeToggle`. | `Phase-05` |
| **User Overview (`/users`)** | Compact overview metrics, recent unread messages, quick mailboxes, quick-create modal trigger, single-modal shell delegation, and `1 message` grammar work cleanly via global `ui/*` primitives (`Phase-02`). | None (verified clean in Light/Dark/Mobile). | **Completed (`Phase-02`)** |
| **User Mailboxes (`/users/mailboxes`)** | Search, status filter, pagination, role-gated single & bulk purge (`isAdministrator` fixed in demo mode), and unified `ui/*` controls (`Checkbox`, `CopyButton`, `Select`, `Input`, `Button`, `AlertBanner`) work cleanly (`Phase-02`). | None (verified clean in Light/Dark/Mobile). | **Completed (`Phase-02`)** |
| **User Inbox & Message Reader (`/users/inbox/[mailboxUuid]/[messageUuid]`)** | Live polling (`503` error reporting + `Live sync paused` status, infinite re-render fixed), theme-aware sandboxed HTML (`?theme=dark` + `#151e26`) & plain-text toggle, CSP without `navigate-to`, attachment download, and `ui/*` controls work cleanly (`Phase-02`). | None (verified `0` console errors in Light/Dark/Mobile). | **Completed (`Phase-02`)** |
| **Admin Overview (`/vcon`)** | Admin KPIs, health readiness square dots, recent deliveries, quick `<CopyButton>` copy, `1 message` grammar, and compact `ui/*` `<Panel>` layout work cleanly (`Phase-03`). | None (verified clean in Light/Dark/Mobile). | **Completed (`Phase-03`)** |
| **Admin Domains (`/vcon/domains`)** | Domain CRUD, MX/SPF/DKIM/DMARC DNS record generator & resolver verification, `ui/*` `<Table>`/`<Panel>`/`<AlertBanner>`/`<Select>`/`<Checkbox>`/`<CopyButton>`, and `notify` toasts work cleanly (`Phase-04`). | None (verified clean in Light/Dark/Mobile). | **Completed (`Phase-04`)** |
| **Admin Mailboxes (`/vcon/mailboxes`)** | Mailbox CRUD, system mailboxes, bulk/single purge, `ui/*` controls, unified `<CopyButton>`, and `notify` toasts work cleanly (`Phase-04`). | None (verified clean in Light/Dark/Mobile). | **Completed (`Phase-04`)** |
| **Admin Users (`/vcon/users`)** | User account management, generators, password toggle, access policies, `<Panel>`/`<AlertBanner>`/`<Checkbox>`/`<Table>`, and `notify` toasts work cleanly (`Phase-04`). | None (verified clean in Light/Dark/Mobile). | **Completed (`Phase-04`)** |
| **Admin Operations & Audit (`/vcon/operations`, `/vcon/audit`)** | Maildir ingestion queue triggers, worker telemetry, Postfix contract checks, audit log filters, and `ui/*` `<Panel>`/`<Select>`/`<Checkbox>`/`<AlertBanner>` work cleanly (`Phase-04`). | None (verified clean in Light/Dark/Mobile). | **Completed (`Phase-04`)** |
| **Admin Site Settings (`/vcon/settings`)** | Dynamic branding, logo/favicon upload (with unselected empty file omission), contact/footer persistence, `try/catch` save error banner, `notify` toasts, and `ui/*` controls work cleanly (`Phase-03`). | None (verified clean & saving cleanly in Light/Dark/Mobile). | **Completed (`Phase-03`)** |
| **Admin System Update (`/vcon/system-update`)** | Release check, preflight `<Table>`, Radix `<Dialog>` update confirmation & stream logs, `notify` toasts, `ui/*` panels/badges/checkboxes work cleanly (`Phase-03`). | None (verified clean in Light/Dark/Mobile). | **Completed (`Phase-03`)** |
| **Public Site (`/`, `/contact`, `/privacy`)** | Public landing showcase, interactive FAQ accordion, CSRF-protected + rate-limited `/api/contact` form, privacy policy work. | **`0%` `ui/*` imports** — `66` `rounded*`, `6` `shadow-*`, `31` `font-bold`, `bg-gradient-to-b`, `backdrop-blur`, raw `<img />` & raw form controls. | `Phase-06` |
| **PWA, Global Shell & Error Routes (`app-shell.tsx`, `sw.js`, `manifest.ts`, `ui/*`, `error.tsx`, `not-found.tsx`, `global-error.tsx`)** | Responsive sidebar + mobile drawer, theme toggle, synced tokens (`#f6f8fa`, `#2558bf`, `#10171d`), `ui/*` primitives, workspace error/404, and root `global-error.tsx` + `not-found.tsx` work cleanly (`Phase-01` & `Phase-03`). | None (verified `0` console errors & clean 404 render). | **Completed (`Phase-03`)** |

---

## 2. Environment-Dependent Capabilities (Code Ready — Requires VPS Runtime)

The following infrastructure features are implemented as templates/adapters in code and require an actual Linux VPS with PostgreSQL + Postfix + Dovecot + systemd to run live:
- Live Maildir ingestion worker (`src/workers/ingestion.ts`, `deployment/templates/systemd/vibmail-ingestion.service.tpl`)
- Postfix / Dovecot PostgreSQL lookup views & roles (`prisma/migrations/20261115000000_mailserver_schema_and_roles/migration.sql`, `deployment/templates/postfix/*`, `deployment/templates/dovecot/*`)
- Self-updater runner service (`deployment/templates/systemd/vibmail-updater.service.tpl`)

---

## 3. Running Progress Log (Updated After Each Phase)

- **Baseline (`2026-11-15`):** All existing functionality audited; `Phase-01`–`Phase-06` queued.
- **After Phase-01 (`2026-11-15`):** `globals.css` border/accent/sidebar token aliases locked; `layout.tsx` & `manifest.ts` hex colors synced; `Label` standardized to `text-xs`; `AlertBanner`, `Checkbox`, `CopyButton` created & exported; `AppShell` Sign out migrated to global `<Button>`. All `53/53` UI tests, `typecheck`, `lint`, `next build`, and live Chromium Light/Dark checks pass.
- **After Phase-02 (`2026-11-15`):** `/users/*` workspace unified onto global `ui/*` primitives; `BUG-01` (Dark HTML email iframe `#151e26` + `bg-card`), `BUG-02` (`navigate-to` removed from `SAFE_HTML_CSP_POLICY`), `BUG-03` (demo non-admin `canDeleteMailboxes: false`), `BUG-08` (single modal delegation + infinite `LiveWorkspaceNavigationBar` `useEffect` loop fixed), `BUG-09`/`ERR-01`/`ERR-03` (`503` + `logger.error` + `Live sync paused` status), and `"1 message"` pluralization fixed. Verified via `test:messages` (`9/9`), `test:ui` (`54/54`), `typecheck`, `lint`, `next build`, and live Playwright Chromium (`1440px` Light/Dark + `390px` Mobile, `0` console errors).
- **After Phase-03 (`2026-11-15`):** `SettingsConsole`, `SystemUpdateConsole`, `AdminOverview`, `(workspace)/error.tsx`, and `(workspace)/vcon/not-found.tsx` unified onto `@/components/ui` (`0rem`, zero shadow, zero `emerald-*`/`amber-*`, `notify` wrapper); root `src/app/global-error.tsx` and `src/app/not-found.tsx` added (`ERR-02`); `SettingsConsole` empty file omission bug fixed so saving settings without uploading brand images succeeds cleanly; `"1 message"` singularization added to `AdminOverview`. Verified via `typecheck`, `test:ui` (`56/56`), `test:admin` (`31/31`), `lint`, `next build`, and live Chromium (`1440px` Light/Dark + `390px` Mobile).
- **After Phase-04 (`2026-11-15`):** All remaining `/vcon/*` admin directories, forms, and error pages (`domains*`, `mailboxes*`, `users*`, `operations*`, `audit*`, edit/delete sub-routes) unified onto `@/components/ui` (`Panel`, `Table`, `Select`, `Checkbox`, `CopyButton`, `AlertBanner`, `Label`, `PageTitle`, `SectionTitle`, `notify`); `copy-mailbox-button.tsx` removed; `STATIC_AUDIT_CLEAN`, `typecheck`, `test:ui` (`56/56`), `test:admin` (`31/31`), `lint`, `next build`, and live Chromium (`1440px` Light/Dark + `390px` Mobile, `0` console/page/rounded/overflow issues) all pass.
- **After Phase-05:** *(Pending)*
- **After Phase-06:** *(Pending)*
