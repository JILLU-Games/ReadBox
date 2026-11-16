# 001 — Production Forensic Audit Report (ReadBox UI/UX & Recent Updates)

> **Baseline Reference:** [`000-BASELINE-FREEZE.md`](./000-BASELINE-FREEZE.md) (`v0.1.0-baseline`, `2026-11-16`)  
> **Verification Method:** 100% Direct Source-Code Inspection (Zero guesses, zero doc-only assumptions)  
> **Status:** Complete — Ready for Phased Execution under Strict Scope Lock

---

## Executive Summary (Baseline vs. Audit Findings)

ReadBox-এর সম্পূর্ণ source code inspect করে মোট **১৯টি নির্দিষ্ট defect / mismatch** পাওয়া গেছে (৩টি High-severity functional/theme bug, ১০টি Medium architectural/UI bypass, এবং ৬টি Low residual branding/cleanup item):

1. **Hardcoded Inline CSS & JSX `<style>`:** `MessageReaderView` (`src/components/users/message-reader-view.tsx`) সরাসরি JSX-এ `<style>` ও hardcoded `"Segoe UI"` / `ui-monospace` font বসিয়েছে; `system-update-console.tsx`-এ inline `style={{ width }}` আছে; `layout.tsx`, `manifest.ts`, `service.ts`, এবং `demo-workspace.ts`-এ CSS variable ছাড়া raw hex রঙ hardcoded।
2. **Email Reader Theme Leak & Image Stripping:** API endpoint `/api/messages/html/[messageUuid]`-এ `theme` query না পাঠানোয় `buildSanitizedHtmlDocument` OS-level `@media (prefers-color-scheme: dark)` পাঠায় যা অ্যাপের `.dark`/`.light` toggle-কে override করে; এবং `sanitizer.ts` সব external `https://` ও unresolved image `exclusiveFilter` দিয়ে কেটে দেয়।
3. **Component-Only Architecture (`@/components/ui`) Bypass:** `FormField` থাকার পরও Contact/SignUp/SignIn-এ ১৫+ জায়গায় raw div + `text-[11px]` error লেখা হয়েছে; কোনো shared `PageHeader`, `StatCard`, `BrandLogo`, `Pagination`, `Accordion`, `FileInput`, বা `NavLink` নেই — ফলে প্রতি পেজে ৩ রকম header, ২ রকম pagination, ৪ রকম logo fallback এবং inconsistent padding (`p-0`/`p-3`/`p-4`/`p-5`) তৈরি হয়েছে।
4. **User Workspace Duplicate UI & Quota Mismatch:** `UsersWorkspaceShell` এবং ভেতরের `UserOverview` / `UserMailboxesView` উভয়েই `Create mailbox` বাটন রেন্ডার করে; এবং shell page-1 `items.length` দিয়ে আর view `totalCount` দিয়ে quota যাচাই করে।
5. **Legacy Branding Remnants:** ReadBox রিব্র্যান্ডিংয়ের পরও `mailstack`, `vibmail`, `licora`, এবং `"M"` আদ্যক্ষর কোডের একাধিক জায়গায় রয়ে গেছে।

---

## Detailed Forensic Findings (Exact Path, Line Numbers & Code Proofs)

### Category A — Global CSS, Theme Tokens, Font Weight & Inline CSS Violations

#### `BUG-UI-01` (HIGH): Inline JSX `<style>` & Theme Leak in Email Reader
- **Files:**
  - `src/components/users/message-reader-view.tsx` (lines `68-111`, `214-251`, `625-666`)
  - `src/core/messages/service.ts` (lines `1420-1457`)
- **Code Proof:**
```tsx
// src/components/users/message-reader-view.tsx (lines 225-230)
    window
      .fetch(`/api/messages/html/${message.uuid}`, {
        method: "GET",
        credentials: "same-origin",
        signal: controller.signal,
      })

// src/components/users/message-reader-view.tsx (lines 625-633)
          <style>{`
            .${scopeClass} {
              font-family: "Segoe UI", "Segoe UI Web", system-ui, -apple-system, "Helvetica Neue", sans-serif;
              font-size: 13px;
              line-height: 1.6;
              color: inherit;
```
```ts
// src/core/messages/service.ts (lines 1443-1448)
  const themeCss =
    options?.theme === "dark"
      ? `${lightCss}${darkRules}`
      : options?.theme === "light"
        ? lightCss
        : `${lightCss}@media (prefers-color-scheme: dark){${darkRules}}`;
```
- **Root Cause:**
  1. `MessageReaderView` API থেকে HTML fetch করার সময় `?theme=dark|light` পাঠায় না, ফলে `buildSanitizedHtmlDocument` OS `prefers-color-scheme` CSS পাঠায় যা ReadBox-এর `.dark` class-এর বিপরীত থিমে রঙ ভেঙে দেয়।
  2. SSR prop `message.htmlBody` সরাসরি render হলেও API fallback `buildSanitizedHtmlDocument` দিয়ে wrapped হয় — ফলে দুটির background ও padding মেলে না।
  3. Email CSS-কে `globals.css`-এ না রেখে JSX `<style>`-এ hardcoded font stack বসানো হয়েছে।
- **Scope Lock Target:** `Phase-01` (CSS rules in `globals.css`) + `Phase-02` (`message-reader-view.tsx`, `service.ts`).

---

#### `BUG-UI-02` (MEDIUM): `font-semibold` Violation in `@/components/ui`
- **Files:** `src/components/ui/text.tsx` (line `26`), `src/components/ui/dialog.tsx` (line `34`)
- **Code Proof:**
```tsx
// src/components/ui/text.tsx (line 26)
export function SectionTitle({ className, children, ...props }: HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h2 className={cn("text-xs font-semibold text-foreground", className)} {...props}>

// src/components/ui/dialog.tsx (line 34)
export function DialogTitle({ className, ...props }: ComponentProps<typeof DialogPrimitive.Title>) {
  return <DialogPrimitive.Title className={cn("pr-8 text-sm font-semibold text-foreground", className)} {...props} />;
}
```
- **Root Cause:** UI/UX rule অনুযায়ী *"beshi bold/mota font use kora jabe na"* ও বাকি অ্যাপ `font-medium` ব্যবহার করে, কিন্তু এই দুটি core UI primitive-এ `font-semibold` রয়ে গেছে।
- **Scope Lock Target:** `Phase-01`.

---

#### `BUG-UI-03` (MEDIUM): Hardcoded Hex Colors & Un-themed `global-error.tsx`
- **Files:**
  - `src/app/layout.tsx` (lines `33-38`)
  - `src/app/manifest.ts` (lines `16-17`)
  - `src/app/global-error.tsx` (lines `14-15`)
  - `src/components/vcon/system-update-console.tsx` (lines `562-568`)
- **Code Proof:**
```tsx
// src/app/global-error.tsx (lines 14-15)
  return (
    <html lang="en">
      <body className="min-h-dvh bg-background font-sans text-foreground antialiased">

// src/components/vcon/system-update-console.tsx (lines 562-568)
                <div
                  id="progress-bar"
                  className="h-full bg-primary transition-all"
                  style={{
                    width: `${Math.max(0, Math.min(100, status.progress))}%`,
                  }}
                />
```
- **Root Cause:** `global-error.tsx`-এ theme class/provider না থাকায় dark mode-এও light error screen আসে; progress bar inline `style={{ width }}` ব্যবহার করে; `globals.css` (`lines 121-147`)-এ `* { scrollbar-width: none }` থাকায় চওড়া table ও email container-এ desktop scrollbar দেখা যায় না।
- **Scope Lock Target:** `Phase-01`, `Phase-05`, `Phase-06`.

---

#### `BUG-UI-04` (MEDIUM): Unstandardized Arbitrary Font Sizes (`text-[10px]`, `text-[11px]`, `text-[13px]`) & Token Drift
- **Files:** `badge.tsx:6`, `button.tsx:20`, `table.tsx:27`, `app-shell.tsx:310,395,433,435,449,455,469,483`, `page.tsx`, `contact-inquiry-form.tsx`, `sign-up-form.tsx`, `message-reader-view.tsx`, `mailbox-inbox-view.tsx`, `overview-panel.tsx`, `settings-console.tsx`, `system-update-console.tsx`, `create-user-mailbox-modal.tsx`.
- **Root Cause:** Shared typography variants (`caption` / `micro` / `body`) `src/components/ui/text.tsx`-এ না থাকায় প্রতি পেজে arbitrary pixel values ও opacity color (`bg-muted/15`, `bg-muted/20`, `bg-muted/30`, `bg-accent/40`, `bg-primary/10`) hardcoded হয়েছে।
- **Scope Lock Target:** `Phase-01` (define tokens/text variants) → `Phase-02`..`Phase-05` (consume across pages).

---

### Category B — Component-Only Architecture Bypass (`@/components/ui`)

#### `BUG-ARCH-01` (MEDIUM): `FormField` Bypassed Across Auth, Public & Workspace Forms
- **Files:** `src/components/public/contact-inquiry-form.tsx` (lines `291-480`, 8 fields), `src/components/auth/sign-up-form.tsx` (lines `136-312`, 7 fields), `src/components/auth/sign-in-form.tsx` (lines `126-150`), `src/components/auth/password-reset-form.tsx`, `src/components/users/user-mailboxes-view.tsx` (lines `498-517`), `src/components/vcon/user-form.tsx` (mixed usage).
- **Code Proof:**
```tsx
// src/components/auth/sign-up-form.tsx (lines 136-150) vs FormField (text-xs, grid gap-1.5)
      <div className="space-y-1">
        <Label htmlFor="signup-username">Username</Label>
        <Input ... />
        {fieldErrors.username ? (
          <p className="text-[11px] text-destructive">{fieldErrors.username}</p>
        ) : null}
      </div>
```
- **Scope Lock Target:** `Phase-03` (user modals), `Phase-04` (public/auth forms), `Phase-05` (admin forms).

---

#### `BUG-ARCH-02` (MEDIUM): Raw HTML Elements (`<button>`, `<input type="file">`, `<img>`, `<h1>`, `<h2>`, `<h3>`) Outside `@/components/ui`
- **Verified Locations:**
  1. `src/components/vcon/settings-console.tsx` (`lines 231, 243, 283, 295`): raw `<img ...>` + raw `<input type="file" ... className="file:mr-2.5 ...">`
  2. `src/components/layout/app-shell.tsx` (`lines 265, 284, 324`): raw `<button>` backdrop/accordion + raw `<img>` logo
  3. `src/components/public/public-faq-accordion.tsx` (`line 23`): raw `<button>` FAQ accordion
  4. `src/components/ui/copy-button.tsx` (`line 55`): renders raw `<button>` instead of `<Button>`, overridden with custom borders in 7 places (`message-reader-view.tsx:392,527,759,769`, `dns-records-panel.tsx:146`, `mailbox-form.tsx:348`)
  5. `src/components/users/mailbox-inbox-view.tsx` (`lines 181-194`): raw `<h1>` containing interactive `<CopyButton>` (`<button>` inside `<h1>` — invalid nesting!)
  6. `src/components/users/message-reader-view.tsx` (`lines 485, 702`): raw `<h1>` (creates **2 `<h1>` elements** when embedded inside `MailboxInboxView`) and raw `<h2>`
  7. `src/app/page.tsx` (`lines 302, 510, 559, 619, 661`), `src/app/contact/page.tsx` (`line 91`), `src/app/privacy/page.tsx` (`lines 62, 94, 105, 136, 149, 160`), `src/components/public/public-site-footer.tsx` (`lines 81, 110, 136`): overridden `PageTitle`/`SectionTitle` and raw `<h2>`/`<h3>`.
- **Scope Lock Target:** `Phase-01` (`FileInput`, `BrandLogo`, `Accordion`, `CopyButton`, `PageHeader`, `StatCard`, `Pagination`, `NavLink` primitives) → `Phase-02`..`Phase-05`.

---

#### `BUG-ARCH-03` (MEDIUM): Inconsistent Brand Logo Rendering Across 4 Page Groups
- **Code Proof:**
  - `src/components/public/public-site-header.tsx:74-85` & `public-site-footer.tsx:45-56`: uses `<Image>`, falls back to `"M"`.
  - `src/components/layout/app-shell.tsx:283-294`: uses raw `<img>`, falls back to `<Icon glyph={Inbox} />`.
  - `src/app/sign-in/page.tsx:57-59`, `sign-up/page.tsx:54-56`, `reset-password/page.tsx:39-41`, `vcon/login/page.tsx:54-56`: completely ignores `settings.logoUrl` and hardcodes `<Mail>` / `<Shield>`.
- **Scope Lock Target:** `Phase-01` (`BrandLogo` component) → `Phase-04` (Auth + Public) & `Phase-05` (`AppShell`).

---

#### `BUG-ARCH-04` (MEDIUM): 3 Conflicting Page Header Patterns & 2 Conflicting Pagination Bars
- **Page Header Drift:**
  - Boxed `px-3 py-2` (`vcon/overview-panel.tsx:92`, `users/overview-panel.tsx:115`, `settings-console.tsx:158`, `system-update-console.tsx:335`, `users-control-console.tsx:302`)
  - Boxed `p-3` (`user-mailboxes-view.tsx:216`)
  - Unboxed `<header>` (`audit-console.tsx:54`, `domains-directory.tsx:168`, `mailboxes-directory.tsx:219`, `operations-console.tsx:157`, `users-directory.tsx:92`)
- **Pagination Drift:** Bordered (`user-mailboxes-view.tsx:438`) vs unbordered (`mailbox-inbox-view.tsx:368`) vs admin directories (`audit-console.tsx:312`, `mailboxes-directory.tsx:479`, `users-directory.tsx:239`).
- **Scope Lock Target:** `Phase-01` (`PageHeader`, `Pagination`) → `Phase-02`..`Phase-05`.

---

### Category C — Functional & Email Rendering Bugs

#### `BUG-FUNC-01` (HIGH): External Email Images Stripped by Sanitizer
- **Files:** `src/core/ingestion/sanitizer.ts` (`lines 612-615`, `648-651`) vs `src/core/ingestion/parser.ts` (`lines 179-210`)
- **Code Proof:**
```ts
// src/core/ingestion/sanitizer.ts (lines 612-615 & 648-651)
    allowedSchemesByTag: {
      a: ["http", "https", "mailto"],
      img: ["data"],
    },
...
    exclusiveFilter: (frame) => {
      if (frame.tag === "img") {
        return !isSafeRasterDataImageUri(frame.attribs.src);
      }
```
- **Root Cause:** `parser.ts` resolves inline `cid:` attachments to `data:image/*` URIs, so inline MIME images work when valid, **but** any external `https://` image (e.g. newsletter logos, hero banners, sender avatars in HTML emails) is deleted permanently by `exclusiveFilter` during sanitization.
- **Scope Lock Target:** `Phase-02` (decide/implement safe external image handling or user-controlled external image display without breaking XSS/SSRF safety).

---

#### `BUG-FUNC-02` (HIGH): Duplicate `Create mailbox` Button & Paginated Quota Mismatch in `/users`
- **Files:** `src/app/(workspace)/users/layout.tsx` (`lines 33-64`), `src/components/users/users-workspace-shell.tsx` (`lines 48-75`), `src/users/overview-panel.tsx` (`lines 118-131`), `src/components/users/user-mailboxes-view.tsx` (`lines 203-230`).
- **Code Proof:**
```tsx
// src/app/(workspace)/users/layout.tsx (line 40 & 57)
      listResult = await listUserMailboxes(getPrismaClient(), { ... }, { page: 1 });
...
    <UsersWorkspaceShell mailboxes={listResult.items} capabilities={listResult.capabilities} ...>

// src/components/users/users-workspace-shell.tsx (lines 49-51)
  const canCreate =
    capabilities?.canCreateMailboxes !== false &&
    (maxMailboxes <= 0 || mailboxes.length < maxMailboxes);
```
- **Root Cause:**
  1. `UsersWorkspaceShell` renders a top `Create mailbox` button on every `/users/*` page, AND `overview-panel.tsx` + `user-mailboxes-view.tsx` render a second `Create mailbox` button directly underneath it.
  2. `UsersWorkspaceShell` checks `mailboxes.length` (page-1 items only) instead of `totalCount`, disagreeing with `UserMailboxesView` (`listResult.totalCount < maxMailboxes`) when a user has multiple pages of mailboxes.
- **Scope Lock Target:** `Phase-03`.

---

#### `BUG-FUNC-03` (LOW): Admin `not-found.tsx` Points to `/users` Instead of `/vcon`
- **File:** `src/app/(workspace)/vcon/not-found.tsx` (`line 14`)
- **Code Proof:** `<Link href="/users">Return to workspace</Link>` inside `/vcon` admin error fallback.
- **Scope Lock Target:** `Phase-05`.

---

### Category D — Legacy Branding & Public/UI Cleanup Remnants

#### `BUG-BRAND-01` (LOW): Remaining `mailstack`, `vibmail`, `licora`, `"M"`, `vcon` Strings
- `src/app/manifest.ts:20,26,32` + `public/icons/`: `/icons/mailstack-192.png`, `/icons/mailstack-512.png`, `/icons/mailstack.svg`
- `src/app/page.tsx:235`: `env.mailDomain || "mailstack.local"`
- `src/core/messages/demo-workspace.ts:138-154,214,226`: `@mailstack.local` + light-only inline hexes
- `src/components/public/public-site-header.tsx:84` & `public-site-footer.tsx:55`: fallback `"M"`
- `src/components/public/contact-inquiry-form.tsx:177` (with `src/core/contact/service.ts`): `"X-VibMail-CSRF"`
- `src/components/users/live-mail-notifier.tsx:24-25`: `"vibmail-notified-message-uuids"`, `"vibmail-live-notifications"`
- `src/components/vcon/system-update-console.tsx:301,705-710`: `/run/vibmail/update_request.json` and `id="licora-update-log-modal"`
- `src/app/vcon/login/page.tsx:66`: `<Badge variant="outline">vcon</Badge>`
- Public subtitle/intro noise: `src/app/page.tsx:307-314`, `src/app/contact/page.tsx:94-98`, `src/app/privacy/page.tsx:65-68`.
- **Scope Lock Target:** `Phase-04` (public copy cleanup) + `Phase-06` (full legacy branding & PWA icon alignment).
