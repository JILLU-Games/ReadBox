# 00 — Baseline Freeze & Forensic Audit Sync

**Freeze Timestamp:** `2026-11-15T14:01:02-08:00`  
**Project:** ReadBox / MailStack (`mailstack@0.1.0`, Next.js `16.4.2`, React `19.3.0`, Prisma `7.10.1`, Tailwind CSS v4)  
**Baseline Mode:** Pre-Fix Documentation Freeze (No source edits performed since forensic audit)

---

## 1. Baseline Identity & Technical Stack Snapshot

| Component | Verified Value in Workspace | Source Proof |
| :--- | :--- | :--- |
| Framework | Next.js `16.4.2` App Router, React `19.3.0`, TypeScript `5.x` | `package.json:53,59,88` |
| Styling | Tailwind CSS `4.0.0` (`@tailwindcss/turbopack`), CSS custom properties | `package.json:69,86`, `src/app/globals.css:1-85` |
| Database / ORM | Single PostgreSQL database via Prisma `7.10.1` + `@prisma/adapter-pg` | `package.json:41-42`, `prisma/schema.prisma`, `AGENTS.md` |
| Auth & Session | `next-auth@5.0.0-beta.32` (Credentials) + `@node-rs/argon2` + opaque tokens + Dev Demo/Bypass modes | `package.json:40,54`, `src/core/auth/*` |
| Email Parsing & Sanitization | `postal-mime@4.2.1` + `sanitize-html@2.18.2` + `css-tree@3.2.1` | `package.json:48,51,57,61` |
| Notifications | `sonner@2.0.8` (wrapped by `src/components/ui/notifications.tsx`, bypassed in `/vcon`) | `package.json:63`, `src/components/ui/notifications.tsx` |
| Test Tooling | `node --test` (unit/integration) + `vitest@5.0.5` + Testing Library (`tests/ui/*`) | `package.json:14-38,70-73,90` |

---

## 2. Frozen Design & Architecture Contract (Authoritative Rules)

All upcoming bug-fix and unification phases (`Phase-01` through `Phase-06`) MUST obey these baseline rules:

1. **Zero Radius / Zero Shadow / Zero Glow:**
   - `--radius: 0rem` globally (`src/app/globals.css:39,78`).
   - No `rounded`, `rounded-sm/md/lg/xl/full`, no `shadow-xs/sm/md/lg`, no `bg-gradient-to-*`, no `backdrop-blur`.
2. **Smooth Soft Typography (No Heavy Bold):**
   - Font stack strictly `--font-segoe`: `"Segoe UI", "Segoe UI Web", system-ui, -apple-system, "Helvetica Neue", sans-serif`.
   - Avoid `font-bold` / `font-extrabold`; keep compact hierarchy (`12px` controls, `13px` body, `font-medium` / `font-semibold` sparingly).
3. **Minimal Color Discipline & Dual Theme Parity:**
   - Both `.light` (`:root`) and `.dark` supported with identical layout/sizing (only colors swap).
   - Eliminate hardcoded Tailwind color palettes (`emerald-*`, `amber-*`, `bg-black/60`, `bg-white` in dark mode) in favor of semantic tokens in `src/app/globals.css`.
   - Enforce 1 subtle border token and clean 2-accent token system across light/dark themes.
4. **Component-Only Global UI Architecture (`AGENTS.md` Rule):**
   - Every page, modal, card/panel, button, link-button, input, select, textarea, checkbox, table, alert banner, copy button, icon, and toast notification MUST consume shared primitives from `src/components/ui/*` and `src/components/layout/*`.
   - Zero page-local hardcoded widget styles or duplicate UI helpers.
5. **No Extra Noise Text:**
   - Remove redundant uppercase kickers (`Admin panel`, `System Configuration`) and multi-sentence intro subtitles that bloat compact UI headers.
6. **Clean Route Persistence & Scope Safety:**
   - Every workspace/admin page preserves its own unique URL on reload/refresh (`/users`, `/users/mailboxes`, `/users/inbox/[mailboxUuid]`, `/vcon/*`).
   - Database policy locked to a single PostgreSQL database; do not alter `prisma/schema.prisma` during UI/bugfix phases unless explicitly required.

---

## 3. Baseline vs Forensic Audit Sync Matrix

The current frozen codebase contains **4 disconnected UI layers** verified by line-by-line inspection and quantitative scanning:

| Layer / Route Group | Current State at Freeze | `@/components/ui` Adoption | Key Verified Violations |
| :--- | :--- | :--- | :--- |
| **Global Foundation** (`globals.css`, `layout.tsx`, `manifest.ts`, `ui/*`, `app-shell.tsx`) | Partially standardized | Base layer | Hex color mismatch (`#f3f6f8`/`#2457c5` vs `#f6f8fa`/`#2558bf`), `ui/label.tsx` `text-sm` vs `text-xs`, missing global `AlertBanner` / `CopyButton` / `Checkbox`, raw `<button>`/`<img>` in `app-shell.tsx` |
| **User Workspace** (`/users/*`, `components/users/*`, `src/users/*`) | Cleanest layer (`0` radius/shadow violations) | ~90% | `bg-white` iframe breaking Dark mode, CSP `navigate-to 'none'` console error, raw controls in `create-user-mailbox-modal.tsx`, inline `<Link>` buttons, duplicate modals/copy buttons, `"1 messages"` grammar, `demo-workspace.ts` `isAdministrator \|\| true` |
| **Admin Console** (`/vcon/*`, `components/vcon/*`, `src/vcon/*`, `error.tsx`, `not-found.tsx`) | Legacy mixed layer | ~45% (`settings-console.tsx` & `system-update-console.tsx` at `0%`) | `145` non-zero `rounded*`, `3` `shadow-lg`, `emerald-*`/`amber-*` hardcoded colors, `bg-black/60` custom modals, double `<Table>` border wrapper, raw `<select>`, `11` files bypassing `notify` via `sonner` |
| **Auth Pages** (`/sign-in`, `/reset-password`) | Ununified legacy layer | `0%` | `15` `rounded-md`, `min-h-11`, `text-sm`, raw `<input>`/`<button>`, hardcoded `"ReadBox"` branding, no `ThemeToggle` |
| **Public Site** (`/`, `/contact`, `/privacy`, `components/public/*`) | Detached marketing layer | `0%` | `66` `rounded*`, `6` `shadow-*`, `31` `font-bold`, `bg-gradient-to-b`, `backdrop-blur`, raw form inputs/buttons/select/textarea, raw `<img>` |

---

## 4. Freeze Verification Rule

Before starting `Phase-01`:
- Baseline source files in `src/` remain untouched.
- Any modification made during `Phase-01` through `Phase-06` MUST be bounded by the active phase's **Scope Lock** in `notes/02-phase-roadmap-and-scope-locks.md` and recorded immediately upon completion in `notes/03-phase-completion-log.md`.
