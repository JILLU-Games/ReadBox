# 01 — Production-Readiness Forensic Audit & Exact Bug Inventory

**Source Verification:** 100% verified directly against `src/` files (zero assumptions, exact paths & line numbers).  
**Total UI Files Scanned:** All files under `src/app`, `src/components`, `src/users`, `src/vcon`, plus supporting backend files in `src/core/messages/*` and `src/app/api/messages/*`.

---

## 1. Quantitative Violation Summary (Frozen Baseline)

| Metric | Total Count | Breakdown by Layer |
| :--- | :---: | :--- |
| Non-`rounded-none` (`rounded`, `rounded-md`, `rounded-lg`, `rounded-full`) | **~226** | `/vcon` & `error.tsx`: **145**, Public: **66**, Auth: **15**, `/users`: **0** |
| Non-zero `shadow-*` (`shadow-xs`, `shadow-sm`, `shadow-lg`) | **9** | `src/app/page.tsx`: **4**, `system-update-console.tsx`: **3**, `public-site-header.tsx`: **1**, `contact-inquiry-form.tsx`: **1** |
| Heavy `font-bold` / `font-extrabold` | **31** | `src/app/page.tsx`: **14**, `src/app/privacy/page.tsx`: **9**, `src/app/contact/page.tsx`: **6**, `public-site-header.tsx`: **1**, `public-site-footer.tsx`: **1** |
| Direct `toast` from `"sonner"` (bypassing `notify`) | **11 files** | All 11 interactive `/src/components/vcon/*.tsx` consoles/directories/forms |
| Modules with `0%` `@/components/ui` adoption | **13 files** | `settings-console.tsx`, `system-update-console.tsx`, `sign-in/page.tsx`, `sign-in-form.tsx`, `reset-password/page.tsx`, `password-reset-form.tsx`, `page.tsx`, `contact/page.tsx`, `privacy/page.tsx`, `public-site-header.tsx`, `public-site-footer.tsx`, `contact-inquiry-form.tsx`, `public-faq-accordion.tsx` |

---

## 2. Exact Verified Bug Catalog (Grouped by Severity & Area)

### BUG-01 (High — Functional / UX Dark Mode): HTML Email Iframe Hardcoded `bg-white`
- **Files:** `src/components/users/message-reader-view.tsx:356-366`, `src/core/messages/demo-workspace.ts:155,215,262`
- **Cause:** Container `<div>` and `<iframe sandbox="" ...>` hardcode `bg-white`, and demo HTML bodies hardcode `color:#1b2733;background:#ffffff`. In Dark theme, emails render as a harsh white block.
- **Required Fix:** Use theme-aware surface (`bg-card`) + proper dark/light readable styling strategy for HTML email preview container and demo HTML payload.

### BUG-02 (High — Runtime Browser Error): Unrecognized CSP Directive `'navigate-to'`
- **Files:** `src/core/messages/service.ts:38`, consumed by `src/app/api/messages/html/[messageUuid]/route.ts:69`
- **Cause:** `SAFE_HTML_CSP_POLICY` appends `"navigate-to 'none'"`, triggering browser console `[ERROR] Unrecognized Content-Security-Policy directive 'navigate-to'` on every HTML email iframe load (note: `sandbox=""` already blocks frame navigation, and valid directives `base-uri 'none'` + `form-action 'none'` are already set).
- **Required Fix:** Remove invalid `"navigate-to 'none'"` directive while preserving `sandbox=""` and valid strict CSP directives; update corresponding unit test assertions if present.

### BUG-03 (High — Demo Auth / RBAC Integrity): `canDeleteMailboxes` Always `true` in Demo Mode
- **Files:** `src/core/messages/demo-workspace.ts:355,413`
- **Cause:** `canDeleteMailboxes: isAdministrator || true` short-circuits to `true` even when signed in as non-admin `demo-user`, masking permission-denied states and showing destructive buttons unconditionally.
- **Required Fix:** Replace `isAdministrator || true` with `isAdministrator` (or explicit demo role policy).

### BUG-04 (High — Architectural Drift): Global CSS Token Bloat & Hex Mismatch
- **Files:** `src/app/globals.css:4-79`, `src/app/layout.tsx:31-36`, `src/app/manifest.ts:16-17`
- **Cause:**
  - `layout.tsx:33-34` sets `#f3f6f8` / `#111a21` and `manifest.ts:16-17` sets `#f3f6f8` / `#2457c5`, mismatching `globals.css:6,12,45` (`#f6f8fa`, `#2558bf`, `#10171d`).
  - `globals.css` defines 15+ color tokens and redundant `--input` identical to `--border` (`lines 31-32,70-71`) instead of clean `1 border + 2 accent` token discipline.
- **Required Fix:** Align hex tokens identically across `globals.css`, `layout.tsx`, and `manifest.ts`; consolidate redundant tokens cleanly while maintaining accessible light/dark contrast tests (`tests/ui/theme-contrast.test.tsx`).

### BUG-05 (Medium-High — UI Primitive Gap): Missing Global Primitives & `Label` Size Mismatch
- **Files:** `src/components/ui/label.tsx:6`, `src/components/ui/index.ts`, `src/components/layout/app-shell.tsx:135,154,281-287`
- **Cause:**
  - `Label` uses `text-sm font-medium` (14px), conflicting with `13px` body and `12px` (`text-xs`) `Input`/`Select`/`Button`.
  - No global `AlertBanner` (error/success/warning boxes copy-pasted across 15+ files), no global `CopyButton` (duplicated across 5 files), no global `Checkbox` / `FormSelect` unification, and `app-shell.tsx` uses raw `<button>` for Sign out (`lines 281-287`), raw mobile overlay `<button>` (`line 135`), and raw `<img>` (`line 154`).
- **Required Fix:** Standardize `Label` to `text-xs`, add reusable `AlertBanner`, `CopyButton`, `Checkbox`, and `SectionHeader`/`PageHeader` primitives to `src/components/ui/`, and refactor `app-shell.tsx` to use `<Button>` / global tokens.

### BUG-06 (High — Admin `/vcon` Bypass): `settings-console.tsx` & `system-update-console.tsx` Completely Bypass `ui/*`
- **Files:** `src/components/vcon/settings-console.tsx` (`0` `ui/*` imports), `src/components/vcon/system-update-console.tsx` (`0` `ui/*` imports)
- **Cause:**
  - Both files hardcode raw `<button>`, `<input>`, `<textarea>`, `<table>`, `rounded-md`, `emerald-*`/`amber-*` colors, `sonner` `toast`, and extra subtitle/kicker noise (`settings-console.tsx:115,124-127`, `system-update-console.tsx:315-317,324-327`).
  - `system-update-console.tsx:624-821` implements 3 custom modals with `bg-black/60` and `shadow-lg` instead of `@/components/ui/dialog`.
- **Required Fix:** Rewrite both UI trees onto global `Button`, `Input`, `Textarea`, `Table`, `Dialog`, `Panel`, `AlertBanner`, `notify`, and CSS tokens with zero `rounded-*`/`shadow-*`/hardcoded Tailwind colors.

### BUG-07 (Medium-High — Admin `/vcon` Mixed Controls & Double Table Border): Directories & Forms
- **Files:**
  - Double `<Table>` border + `rounded-lg`: `src/components/vcon/domains-directory.tsx:226`, `src/components/vcon/mailboxes-directory.tsx:359`, `src/components/vcon/dns-records-panel.tsx:108` (wrapping `ui/table.tsx:6` which already draws border + card surface).
  - Raw `<select>` (`h-10`/`h-9 rounded-md text-sm`): `domain-form.tsx:484`, `mailbox-form.tsx:189`, `mailboxes-directory.tsx:283,298,602,623`, `operations-console.tsx:283`, `audit-console.tsx:219`.
  - Direct `sonner` `toast`: All 11 interactive `/src/components/vcon/*.tsx` files (`audit-console.tsx`, `copy-mailbox-button.tsx`, `domain-form.tsx`, `domains-directory.tsx`, `mailbox-form.tsx`, `mailbox-purge-confirm.tsx`, `mailboxes-directory.tsx`, `operations-console.tsx`, `settings-console.tsx`, `system-update-console.tsx`, `user-form.tsx`, `users-directory.tsx`).
  - Inline `rounded-lg`/`rounded-md` panels/cards & `sonner` / noise text: `(workspace)/error.tsx:16,20`, `(workspace)/vcon/not-found.tsx:6-7`, `vcon/domains/[uuid]/edit/page.tsx:58`, `vcon/mailboxes/[uuid]/delete/page.tsx:26,48`, `vcon/users/[id]/edit/page.tsx:26,53`, `src/vcon/overview-panel.tsx`, `user-form.tsx:234-238`, `operations-console.tsx:154-158`.
- **Required Fix:** Remove duplicate `<Table>` wrappers, migrate all raw `<select>`/`<input>`/`<textarea>`/`<button>` to `@/components/ui`, switch all 11 files from `sonner` to `notify`, remove `rounded-*` & extra subtitle/kicker noise.

### BUG-08 (Medium — `/users/*` Raw Controls, Duplicate Modal & Grammar):
- **Files:**
  - `src/components/users/create-user-mailbox-modal.tsx:149,161,174,188,203,221` (raw `<label>`, 3 raw `<button>`, raw `<input>`, raw `<select>` + `domainUuid` initial `useState` won't sync if `domains` prop changes)
  - `src/users/overview-panel.tsx:343` & `src/components/users/user-mailboxes-view.tsx:472` (mount a duplicate `<CreateUserMailboxModal>` alongside `UsersWorkspaceShell`)
  - Hardcoded `<Link>` button styles instead of `<Button asChild>`: `src/users/overview-panel.tsx:119,328`, `src/components/users/user-mailboxes-view.tsx:274,405,445,457`, `src/components/users/mailbox-inbox-view.tsx:242,351,362`, `src/components/users/message-reader-view.tsx:416` (`<a>`)
  - Raw checkboxes & copy buttons: `user-mailboxes-view.tsx:288,362,374`, `mailbox-inbox-view.tsx:160`, `message-reader-view.tsx:221`, `overview-panel.tsx:303`
  - Pluralization bug: `src/users/overview-panel.tsx:321` renders `"1 messages"`.
- **Required Fix:** Replace raw controls with `ui/*` primitives (`Button`, `Input`, `Select`, `Label`, `Checkbox`, `CopyButton`), deduplicate modal/copy state cleanly, fix `"1 message"` vs `"N messages"`, sync `selectedDomain` state cleanly.

### BUG-09 (Medium — Silent Live Polling Swallows Errors + Missing Root Error Pages):
- **Files:** `src/app/api/messages/live/route.ts:107-113`, `src/app/api/messages/html/[messageUuid]/route.ts:75`, missing `src/app/global-error.tsx` & `src/app/not-found.tsx`
- **Cause:** Live polling DB error silently returns HTTP `200 EMPTY_LIVE_PAYLOAD` instead of signaling degraded live status cleanly; root app lacks `global-error.tsx` and `not-found.tsx`.
- **Required Fix:** Handle live polling failure explicitly with safe degraded/error state without breaking offline/demo flows; add compact `src/app/not-found.tsx` & `src/app/global-error.tsx` using global UI styles.

### BUG-10 (Medium — Auth Pages Ununified): `/sign-in` & `/reset-password`
- **Files:** `src/app/sign-in/page.tsx:25-84`, `src/components/auth/sign-in-form.tsx:98-197`, `src/app/reset-password/page.tsx:12-21`, `src/components/auth/password-reset-form.tsx:41-107`
- **Cause:** `0%` `@/components/ui` usage; `rounded-md`, `min-h-11`, `text-sm`, raw inputs/buttons, hardcoded `"ReadBox"` text (mismatching dynamic `settings.siteName`), no `ThemeToggle`.
- **Required Fix:** Refactor Auth pages onto `Panel`, `Input`, `Button`, `Label`, `AlertBanner`, `ThemeToggle`, dynamic site name, and `0rem` compact tokens.

### BUG-11 (Medium — Public Site Ununified): `/`, `/contact`, `/privacy`
- **Files:** `src/app/page.tsx`, `src/app/contact/page.tsx`, `src/app/privacy/page.tsx`, `src/components/public/public-site-header.tsx`, `src/components/public/public-site-footer.tsx`, `src/components/public/contact-inquiry-form.tsx`, `src/components/public/public-faq-accordion.tsx`
- **Cause:** `0%` `@/components/ui`; `66` `rounded*`, `6` `shadow-*`, `31` `font-bold`, `bg-gradient-to-b`, `backdrop-blur`, raw `<input>`/`<select>`/`<textarea>`/`<button>`, raw `<img>`.
- **Required Fix:** Unify public header, footer, hero, cards, FAQ, and contact form onto the exact global `0rem` / zero-shadow / soft-font / `ui/*` design system without adding UI noise.
