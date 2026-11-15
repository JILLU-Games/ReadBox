# 02 — Phase Roadmap & Strict Scope Locks

Every bug from `notes/01-production-readiness-audit-and-bugs.md` is divided into **6 sequential, scope-locked phases**.  
**Rule:** During any active phase, ONLY files listed under that phase's **Allowed Scope** may be modified or created. All other modules/features remain strictly untouched.

---

## Phase-01: Global CSS Tokens, Theme Sync & Shared `ui/*` Primitives (`BUG-04`, `BUG-05`)

- **Goal:** Establish a single authoritative source of truth in `globals.css` and `src/components/ui/*` before touching feature pages.
- **Scope Lock (Allowed Files ONLY):**
  - `src/app/globals.css`
  - `src/app/layout.tsx`
  - `src/app/manifest.ts`
  - `src/components/ui/*` (`index.ts`, `label.tsx`, `button.tsx`, `input.tsx`, `select.tsx`, `textarea.tsx`, `panel.tsx`, `dialog.tsx`, `table.tsx`, `badge.tsx`, `notifications.tsx`, plus new primitives: `alert-banner.tsx`, `copy-button.tsx`, `checkbox.tsx`)
  - `src/components/layout/app-shell.tsx`
  - Directly corresponding UI tests (`tests/ui/theme-contrast.test.tsx`, `tests/ui/app-shell.test.tsx`, `tests/ui/installability-manifest.test.tsx`)
- **Explicitly Out of Scope:** Any `/users/*`, `/vcon/*`, Auth, Public, or backend `src/core/*` files.
- **Concrete Deliverables:**
  1. Align `layout.tsx` & `manifest.ts` hex colors with `globals.css` tokens.
  2. Tighten `globals.css` token bloat (`1 border + 2 accent` discipline while preserving semantic contrast in light + dark).
  3. Set `ui/label.tsx` to `text-xs font-medium`.
  4. Add global `AlertBanner`, `CopyButton`, and `Checkbox` primitives exported via `src/components/ui/index.ts`.
  5. Replace raw `<button>` / `<img>` in `app-shell.tsx` with `<Button>` / standard theme surface.
- **Verification Gate:** `npm run typecheck && npm run lint && npm run test:ui`

---

## Phase-02: `/users/*` Functional, Security & UI Bugs (`BUG-01`, `BUG-02`, `BUG-03`, `BUG-08`, `BUG-09` partial)

- **Goal:** Make the primary user mailbox workspace (`/users/*`) 100% bug-free, dark-mode compliant, console-error-free, and strictly using `ui/*` primitives.
- **Scope Lock (Allowed Files ONLY):**
  - `src/core/messages/service.ts` (CSP fix only)
  - `src/core/messages/demo-workspace.ts` (dark-mode safe HTML + `canDeleteMailboxes: isAdministrator`)
  - `src/app/api/messages/live/route.ts` (proper non-silent error handling)
  - `src/components/users/*` (`users-workspace-shell.tsx`, `live-mail-notifier.tsx`, `create-user-mailbox-modal.tsx`, `user-mailboxes-view.tsx`, `mailbox-inbox-view.tsx`, `message-reader-view.tsx`)
  - `src/users/overview-panel.tsx`
  - Corresponding tests (`tests/messages/phase5-users-workspace.test.ts`, `tests/ui/users-phase5.test.tsx`)
- **Explicitly Out of Scope:** `/vcon/*`, Auth, Public pages, `prisma/schema.prisma`, `src/core/domains/*`, `src/core/accounts/*`.
- **Concrete Deliverables:**
  1. Fix `SAFE_HTML_CSP_POLICY` (`remove "navigate-to 'none'"`) so browser console stays clean.
  2. Fix HTML iframe dark-mode surface (`bg-card` + dark-compatible fallback/demo HTML body styling).
  3. Fix `demo-workspace.ts` `canDeleteMailboxes: isAdministrator` capability leak.
  4. Convert `create-user-mailbox-modal.tsx` raw `<label>/<input>/<select>/<button>` to `ui/*` and fix `domainUuid` prop-change sync.
  5. Deduplicate `<CreateUserMailboxModal>` mounting & inline copy buttons (use `<CopyButton>` + `<Checkbox>` + `<Button asChild>` across `/users/*`).
  6. Fix `"1 messages"` singular/plural grammar in `overview-panel.tsx:321`.
  7. Improve `GET /api/messages/live` DB catch reporting without breaking offline/demo UX.
- **Verification Gate:** `npm run test:messages && npm run test:ui && npm run typecheck && npm run lint`

---

## Phase-03: `/vcon/*` Core System Consoles Unification (`BUG-06`, `BUG-07` part 1)

- **Goal:** Migrate the two `0% ui/*` admin consoles (`settings-console.tsx` & `system-update-console.tsx`) and `(workspace)` error/not-found routes to 100% global `ui/*` + `0rem` + zero-shadow design.
- **Scope Lock (Allowed Files ONLY):**
  - `src/components/vcon/settings-console.tsx`
  - `src/components/vcon/system-update-console.tsx`
  - `src/app/(workspace)/error.tsx`
  - `src/app/(workspace)/vcon/not-found.tsx`
  - `src/app/global-error.tsx` (new)
  - `src/app/not-found.tsx` (new)
  - `src/vcon/overview-panel.tsx`
  - Corresponding tests (`tests/ui/vcon-phase2.test.tsx`, `tests/ui/vcon-phase6.test.tsx`)
- **Explicitly Out of Scope:** Backend update/settings business logic in `src/core/updates/*`, `src/core/settings/*`; `/users/*`; Auth; Public.
- **Concrete Deliverables:**
  1. Refactor `settings-console.tsx` completely onto `Panel`, `Button`, `Input`, `Textarea`, `Label`, `AlertBanner`, `notify` (removing 30 `rounded*`, `emerald-*`, `sonner`, and extra intro noise).
  2. Refactor `system-update-console.tsx` completely onto `Panel`, `Button`, `Input`, `Table`, `Dialog`, `Badge`, `notify` (removing 30 `rounded*`, 3 `shadow-lg`, `bg-black/60` custom modals, `emerald-*`/`amber-*`, and extra noise).
  3. Clean `overview-panel.tsx`, `(workspace)/error.tsx`, `vcon/not-found.tsx`, and create compact `global-error.tsx` & `not-found.tsx`.
- **Verification Gate:** `npm run test:admin && npm run test:ui && npm run typecheck && npm run lint`

---

## Phase-04: `/vcon/*` Directories, Forms & Notifications Unification (`BUG-07` part 2)

- **Goal:** Eliminate all remaining `rounded-*`, double `<Table>` wrappers, raw `<select>`/`<input>`/`<button>` controls, and direct `sonner` imports across `/vcon/*`.
- **Scope Lock (Allowed Files ONLY):**
  - `src/components/vcon/domains-directory.tsx`
  - `src/components/vcon/domain-form.tsx`
  - `src/components/vcon/dns-records-panel.tsx`
  - `src/components/vcon/mailboxes-directory.tsx`
  - `src/components/vcon/mailbox-form.tsx`
  - `src/components/vcon/mailbox-purge-confirm.tsx`
  - `src/components/vcon/copy-mailbox-button.tsx` (or replace usages with global `CopyButton`)
  - `src/components/vcon/users-directory.tsx`
  - `src/components/vcon/user-form.tsx`
  - `src/components/vcon/operations-console.tsx`
  - `src/components/vcon/audit-console.tsx`
  - `src/app/(workspace)/vcon/domains/[uuid]/edit/page.tsx`
  - `src/app/(workspace)/vcon/mailboxes/[uuid]/delete/page.tsx`
  - `src/app/(workspace)/vcon/users/[id]/edit/page.tsx`
  - Corresponding tests (`tests/ui/vcon-phase3.test.tsx`, `tests/ui/vcon-phase4.test.tsx`)
- **Explicitly Out of Scope:** Backend services in `src/core/*`, `/users/*`, Auth, Public.
- **Concrete Deliverables:**
  1. Remove redundant `<div className="overflow-x-auto rounded-lg border ...">` wrappers around `<Table>`.
  2. Replace all raw `<select>` and raw checkboxes with `<Select>` and `<Checkbox>` from `@/components/ui`.
  3. Replace all `toast` from `"sonner"` with `notify` from `@/components/ui`.
  4. Replace all inline `rounded-md`/`rounded-lg` cards/alerts with `Panel` / `AlertBanner` and trim subtitle noise.
- **Verification Gate:** `npm run test:admin && npm run test:ui && npm run typecheck && npm run lint`

---

## Phase-05: Auth Pages (`/sign-in` & `/reset-password`) Unification (`BUG-10`)

- **Goal:** Bring authentication entry points onto the unified `ui/*` + `0rem` + dual-theme compact system with zero hardcoded `"ReadBox"` branding mismatch.
- **Scope Lock (Allowed Files ONLY):**
  - `src/app/sign-in/page.tsx`
  - `src/components/auth/sign-in-form.tsx`
  - `src/app/reset-password/page.tsx`
  - `src/components/auth/password-reset-form.tsx`
  - Corresponding tests (`tests/ui/password-reset-form.test.tsx`, `tests/auth/*`)
- **Explicitly Out of Scope:** `src/core/auth/*` cryptography/session logic, `/users/*`, `/vcon/*`, Public.
- **Concrete Deliverables:**
  1. Use `Panel`, `Input`, `Button`, `Label`, `AlertBanner`, and `ThemeToggle` cleanly.
  2. Remove all `rounded-md`, `min-h-11`, `text-sm` control overrides and subtitle noise.
  3. Read dynamic `siteName` (consistent with `layout.tsx` & `app-shell.tsx`).
- **Verification Gate:** `npm run test:auth && npm run test:ui && npm run typecheck && npm run lint`

---

## Phase-06: Public Site (`/`, `/contact`, `/privacy`) Unification & Final Full Verification (`BUG-11`)

- **Goal:** Achieve 100% app-wide single-source-of-truth compliance across public pages and run full production build + browser verification.
- **Scope Lock (Allowed Files ONLY):**
  - `src/app/page.tsx`
  - `src/app/contact/page.tsx`
  - `src/app/privacy/page.tsx`
  - `src/components/public/*` (`public-site-header.tsx`, `public-site-footer.tsx`, `contact-inquiry-form.tsx`, `public-faq-accordion.tsx`)
  - Corresponding tests (`tests/ui/public-website.test.tsx`, `tests/ui/phase7-responsive-pwa.test.tsx`)
- **Explicitly Out of Scope:** Core backend/database/installer scripts.
- **Concrete Deliverables:**
  1. Eliminate all `66` `rounded*`, `6` `shadow-*`, `31` `font-bold`, `bg-gradient-to-b`, and `backdrop-blur`.
  2. Migrate `contact-inquiry-form.tsx` and header/footer controls to `Button`, `Input`, `Select`, `Textarea`, `Label`, `Panel`, `AlertBanner`, `ThemeToggle`, `Icon`, and `<Image>` (`referrerPolicy="no-referrer"`).
  3. Verify `0` remaining `rounded-*` (except explicit `rounded-none`), `0` `shadow-*`, `0` `font-bold`, and `0` direct `sonner` imports across the entire UI.
- **Final Release Gate:** `npm run typecheck && npm run lint && npm run test:unit && npm run test:ui && npm run build` + live Playwright desktop/mobile light/dark verification.
