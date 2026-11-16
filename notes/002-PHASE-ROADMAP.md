# 002 — Production BugFix & Update Roadmap (Scope-Locked Phases)

> **Baseline:** [`000-BASELINE-FREEZE.md`](./000-BASELINE-FREEZE.md)  
> **Audit Source:** [`001-PRODUCTION-FORENSIC-AUDIT.md`](./001-PRODUCTION-FORENSIC-AUDIT.md)  
> **Execution Rule:** প্রতি Phase-এ কেবল `IN-SCOPE` ফাইল modify হবে। কাজ শেষে **১ বার** verify (`typecheck`, `lint`, targeted test / `build`) করে সরাসরি Phase close হবে এবং [`003-PHASE-EXECUTION-LOG.md`](./003-PHASE-EXECUTION-LOG.md) আপডেট হবে।

---

## Roadmap Overview (`6 Phases`)

| Phase | Title | Fixes Covered | Status |
|---|---|---|---|
| **Phase-01** | Global CSS Tokens & Shared UI Primitives Foundation | `BUG-UI-02`, `BUG-UI-03` (partial), `BUG-UI-04`, `BUG-ARCH-02`, `BUG-ARCH-03`, `BUG-ARCH-04` | **Completed** (`2026-11-16`) |
| **Phase-02** | Email Reader & Inbox Split-View Fix (Theme, Images, HTML Validity) | `BUG-UI-01`, `BUG-FUNC-01`, `BUG-ARCH-02` (reader/inbox), `ERR-03` | **Completed** (`2026-11-16`) |
| **Phase-03** | User Workspace Shell, Quota Sync & Component Standardization (`/users/*`) | `BUG-FUNC-02`, `BUG-ARCH-01`, `BUG-ARCH-04` | **Completed** (`2026-11-16`) |
| **Phase-04** | Public & Auth Pages Component-Only Alignment & Noise Cleanup | `BUG-ARCH-01`, `BUG-ARCH-02`, `BUG-ARCH-03`, `BUG-BRAND-01` (public copy) | **Completed** (`2026-11-16`) |
| **Phase-05** | Admin Console (`/vcon/*`) & AppShell Standardization | `BUG-ARCH-02`, `BUG-ARCH-04`, `BUG-UI-03` (`style={{}}`), `BUG-FUNC-03` | **Completed** (`2026-11-16`) |
| **Phase-06** | Legacy Branding Purge, PWA/Metadata Sync & Error-Handling Hardening | `BUG-BRAND-01`, `BUG-UI-03` (`global-error.tsx`), `004-ERROR-HANDLING.md` gaps | **Completed** (`2026-11-16`) |

---

## Phase-01: Global CSS Tokens & Shared UI Primitives Foundation

### Scope Lock
- **IN-SCOPE ONLY:**
  - `src/app/globals.css`
  - `src/components/ui/*` (`index.ts`, `text.tsx`, `dialog.tsx`, `copy-button.tsx`, `form-field.tsx`, plus new primitives below)
- **OUT-OF-SCOPE (LOCKED):** Do not modify page files (`src/app/**`), feature views (`src/components/users/*`, `src/components/vcon/*`, `src/components/public/*`, `src/components/auth/*`), or backend services (`src/core/**`).

### Planned Deliverables
1. Fix `font-semibold` → `font-medium` in `src/components/ui/text.tsx` (`SectionTitle`) and `src/components/ui/dialog.tsx` (`DialogTitle`).
2. Add global email-body CSS scope rules (`.readbox-mail-body`) and optional `.readbox-scrollbar` helper in `src/app/globals.css` so horizontal email tables/lists remain visibly scrollable when needed and zero `<style>` tags are needed inside JSX.
3. Clean up `src/components/ui/copy-button.tsx` with proper variant support (`default` / `outline` / `ghost`) matching `Button` height/border tokens.
4. Create missing global UI primitives in `src/components/ui/` and export via `src/components/ui/index.ts`:
   - `PageHeader` (single boxed header contract used across all workspace/admin/public headers)
   - `StatCard` / `StatGrid` (single KPI/summary card component)
   - `BrandLogo` (single dynamic `logoUrl` + clean ReadBox fallback renderer using `next/image`)
   - `Pagination` (single shared pagination bar)
   - `Accordion` (replaces raw `<button>` FAQ/group toggles)
   - `FileInput` (replaces raw `<input type="file">` in Settings)
   - `NavLink` (replaces per-component custom navigation link styling)
   - `ProgressBar` (replaces inline `style={{ width }}` using semantic class/CSS var or clean SVG/meter/progress)
5. Standardize micro text scale in `src/components/ui/text.tsx` (`CaptionText` / `MicroText`) to replace ad-hoc `text-[10px]` / `text-[11px]` across future phases.

### Verification Gate (1 Pass)
- `npm run typecheck && npm run lint && npm run test:ui`

---

## Phase-02: Email Reader & Inbox Split-View Fix (Theme, Images & HTML Validity)

### Scope Lock
- **IN-SCOPE ONLY:**
  - `src/components/users/message-reader-view.tsx`
  - `src/components/users/mailbox-inbox-view.tsx`
  - `src/core/messages/service.ts` (`buildSanitizedHtmlDocument` & HTML delivery helpers only)
  - `src/app/api/messages/html/[messageUuid]/route.ts`
  - `src/core/ingestion/sanitizer.ts` (strictly image `src` policy if external images are enabled safely; no unrelated sanitizer changes)
- **OUT-OF-SCOPE (LOCKED):** Do not change DB schema, auth guards, `/vcon/*`, public pages, or mailbox CRUD logic.

### Planned Deliverables
1. Remove hardcoded `<style>{...}</style>` from `MessageReaderView` and consume `.readbox-mail-body` from `src/app/globals.css`.
2. Fix Light/Dark theme sync: pass active resolved theme (`?theme=light|dark`) when fetching `/api/messages/html/[messageUuid]`, strip leaked `html`/`body` background overrides in client CSS scoping, and fix the `@media (...)` CSS scoping regex so nested media queries never leak globally.
3. Make SSR `message.htmlBody` and API-fetched `fetchedHtml` render identically inside the unified Gmail-clean canvas.
4. Fix HTML validity & heading hierarchy in `MailboxInboxView` + `MessageReaderView`:
   - Move `<CopyButton>` *next to* `<h1>` (never nested inside `<h1>`).
   - Use `<SectionTitle>` / `<h2>` for embedded split-view subject or attachments heading so the page never outputs duplicate `<h1>` tags.
   - Replace raw `<h2>` attachments header with `<SectionTitle>` and use shared `<Pagination>`.
5. Resolve external HTML email images safely (or provide explicit sanitized remote-image rendering / toggle while keeping `rel="noopener noreferrer"` and full XSS sanitization intact) so buttons, URLs, right-click copy, and embedded images work reliably.

### Verification Gate (1 Pass)
- `npm run typecheck && npm run lint && npm run test:messages && npm run test:ui`

---

## Phase-03: User Workspace Shell, Quota Sync & Component Standardization (`/users/*`)

### Scope Lock
- **IN-SCOPE ONLY:**
  - `src/app/(workspace)/users/layout.tsx`
  - `src/components/users/users-workspace-shell.tsx`
  - `src/users/overview-panel.tsx`
  - `src/components/users/user-mailboxes-view.tsx`
  - `src/components/users/create-user-mailbox-modal.tsx`
- **OUT-OF-SCOPE (LOCKED):** Do not modify `message-reader-view.tsx`, `mailbox-inbox-view.tsx`, `/vcon/*`, or public/auth pages.

### Planned Deliverables
1. Remove duplicate `Create mailbox` button ambiguity: keep single authoritative `Create mailbox` placement (inside page headers on Overview & My Mailboxes, or clean action bar without rendering two `Create mailbox` buttons vertically stacked).
2. Fix paginated quota mismatch: pass `totalMailboxCount={listResult.totalCount}` from `src/app/(workspace)/users/layout.tsx` to `UsersWorkspaceShell` and evaluate `totalMailboxCount < maxMailboxes` consistently everywhere.
3. Migrate `overview-panel.tsx`, `user-mailboxes-view.tsx`, and `create-user-mailbox-modal.tsx` to Phase-01 shared `PageHeader`, `StatCard`/`StatGrid`, `Pagination`, `FormField`, and `CopyButton` variants.

### Verification Gate (1 Pass)
- `npm run typecheck && npm run lint && npm run test:messages && npm run test:ui`

---

## Phase-04: Public & Auth Pages Component-Only Alignment & Cleanup

### Scope Lock
- **IN-SCOPE ONLY:**
  - `src/app/page.tsx`, `src/app/contact/page.tsx`, `src/app/privacy/page.tsx`
  - `src/components/public/*` (`public-site-header.tsx`, `public-site-footer.tsx`, `public-faq-accordion.tsx`, `contact-inquiry-form.tsx`)
  - `src/app/sign-in/page.tsx`, `src/app/sign-up/page.tsx`, `src/app/reset-password/page.tsx`, `src/app/vcon/login/page.tsx`
  - `src/components/auth/*` (`sign-in-form.tsx`, `sign-up-form.tsx`, `password-reset-form.tsx`)
- **OUT-OF-SCOPE (LOCKED):** Do not modify backend auth providers, contact API business logic, or workspace `/users` & `/vcon` dashboards.

### Planned Deliverables
1. Use `<BrandLogo>` consistently across `PublicSiteHeader`, `PublicSiteFooter`, and all 4 auth pages (`/sign-in`, `/sign-up`, `/reset-password`, `/vcon/login`) so `settings.logoUrl` and dynamic `siteName` render everywhere (removing `"M"` and hardcoded icon divergence).
2. Replace all raw `<div className="space-y-1">` / `<p className="text-[11px] text-destructive">` wrappers in `contact-inquiry-form.tsx`, `sign-up-form.tsx`, `sign-in-form.tsx`, and `password-reset-form.tsx` with shared `<FormField>`.
3. Replace raw `<h2>`/`<h3>` tags and `PageTitle`/`SectionTitle` size overrides with clean shared heading components + `Panel`/`Accordion`/`NavLink` primitives.
4. Remove unnecessary extra subtitle/intro noise text on public pages while keeping clean CTA buttons (`Sign up`, `Sign in`, `Contact`) and professional compact layout.

### Verification Gate (1 Pass)
- `npm run typecheck && npm run lint && npm run test:auth && npm run test:ui`

---

## Phase-05: Admin Console (`/vcon/*`) & `AppShell` Standardization

### Scope Lock
- **IN-SCOPE ONLY:**
  - `src/components/layout/app-shell.tsx`
  - `src/vcon/overview-panel.tsx`
  - `src/components/vcon/*` (`audit-console.tsx`, `dns-records-panel.tsx`, `domain-form.tsx`, `domains-directory.tsx`, `mailboxes-directory.tsx`, `mailbox-form.tsx`, `mailbox-purge-confirm.tsx`, `operations-console.tsx`, `settings-console.tsx`, `system-update-console.tsx`, `user-form.tsx`, `users-control-console.tsx`, `users-directory.tsx`)
  - `src/app/(workspace)/vcon/not-found.tsx`
- **OUT-OF-SCOPE (LOCKED):** Do not modify backend services (`src/core/*`), Prisma schema, or user/public pages.

### Planned Deliverables
1. Standardize all `/vcon/*` page headers onto `<PageHeader>` (eliminating the 3 conflicting header styles).
2. Replace raw `<img>` + `<input type="file">` in `settings-console.tsx` with `<BrandLogo>` / `<FileInput>`.
3. Replace raw `<button>` + raw `<img>` in `app-shell.tsx` with `<Button>` / `<BrandLogo>` / `<NavLink>`.
4. Replace inline `style={{ width }}` progress bar in `system-update-console.tsx` with shared `<ProgressBar>` from Phase-01.
5. Replace raw stat tiles, custom pagination bars, inconsistent `CopyButton` overrides, and mixed `FormField` wrappers across all `/vcon/*` components with Phase-01 primitives.
6. Fix `src/app/(workspace)/vcon/not-found.tsx` button link (`/users` → `/vcon`).

### Verification Gate (1 Pass)
- `npm run typecheck && npm run lint && npm run test:admin && npm run test:ui`

---

## Phase-06: Legacy Branding Purge, PWA/Metadata Sync & Error-Handling Hardening

### Scope Lock
- **IN-SCOPE ONLY:**
  - `src/app/manifest.ts`, `src/app/layout.tsx`, `src/app/global-error.tsx`, `public/icons/*`
  - `src/core/messages/demo-workspace.ts`, `src/core/contact/service.ts` (CSRF header constant sync), `src/components/public/contact-inquiry-form.tsx`, `src/components/users/live-mail-notifier.tsx`, `src/components/vcon/system-update-console.tsx`, `src/app/page.tsx` (`mailDomain` default), `src/app/vcon/login/page.tsx` (`vcon` badge cleanup)
  - Targeted error-handling gaps identified in `004-ERROR-HANDLING.md`
  - Compatibility/contract tests referencing legacy headers if affected (`tests/*`)
- **OUT-OF-SCOPE (LOCKED):** Do not re-open UI layout or component styling from Phases 01–05.

### Planned Deliverables
1. Rename & update PWA icons in `public/icons/` (`readbox-192.png`, `readbox-512.png`, `readbox.svg`) and update `src/app/manifest.ts`.
2. Replace remaining legacy strings:
   - `mailstack.local` → `readbox.local` (`src/app/page.tsx`, `src/core/messages/demo-workspace.ts`)
   - `X-VibMail-CSRF` → `X-ReadBox-CSRF` (synchronized across `src/core/contact/service.ts`, `contact-inquiry-form.tsx`, and tests)
   - `vibmail-*` storage/channel keys → `readbox-*` (`live-mail-notifier.tsx`)
   - `id="licora-update-log-modal"` → `id="readbox-update-log-modal"` and `/run/vibmail/` display/runtime note cleanup (`system-update-console.tsx` — verify compatibility with update worker contract before renaming runtime path!)
   - Remove unnecessary `vcon` badge on `/vcon/login`.
3. Fix `src/app/global-error.tsx` theme hydration so dark mode persists on fatal errors, and complete remaining error-handling hardening items from `004-ERROR-HANDLING.md`.

### Verification Gate (1 Pass — Final Production Sign-Off)
- `npm run typecheck && npm run lint && npm run test:unit && npm run test:ui && npm run build`
