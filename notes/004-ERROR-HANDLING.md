# 004 — Error Handling Audit & Hardening Plan

> **Baseline:** [`000-BASELINE-FREEZE.md`](./000-BASELINE-FREEZE.md) (`2026-11-16`)  
> **Scope:** Next.js App Router Error Boundaries, API Routes, Server Actions, Auth & Brute-Force Guards, Mail Ingestion, and Client Toast/Banner Feedback.

---

## 1. Existing Error Handling Already Implemented in Codebase

### 1.1 Route & Render Error Boundaries
| Scope | File | Current Behavior |
|---|---|---|
| Global Fatal Boundary | `src/app/global-error.tsx` | Catches root unhandled exceptions; shows `Application error` alert panel with `Try again` (`reset()`) and `Reload home` (`window.location.assign("/")`). |
| Workspace Boundary | `src/app/(workspace)/error.tsx` | Catches errors inside `/users/*` and `/vcon/*` without crashing shell; offers `Try again` and `Back to workspace`. |
| Global 404 | `src/app/not-found.tsx` | Clean `Page not found` card linking to `/` and `/users`. |
| Admin 404 | `src/app/(workspace)/vcon/not-found.tsx` | Clean `Resource not found` card linking to `/vcon` (`"Return to admin overview"`, fixed in `Phase-05`). |

### 1.2 API Route Error Handling (Verified Status Codes & Guards)
| Route | Implemented Guards & HTTP Responses |
|---|---|
| `POST /api/contact` (`src/app/api/contact/route.ts`) | `403` CSRF cookie/header mismatch; `400` non-JSON / invalid body / oversized payload (`MAX_BODY_BYTES`) / non-object JSON; `422` field validation + honeypot `_spam` rejection; `429` rate limit with `Retry-After` header; `Cache-Control: no-store`. |
| `GET /api/messages/live` (`src/app/api/messages/live/route.ts`) | `400` missing `X-ReadBox-Live-Request: 1`; `401` unauthenticated; DB-off demo fallback (`200`); `503` caught DB error logged via `logger.error("live_messages_poll_failed")`. |
| `GET /api/messages/html/[messageUuid]` (`src/app/api/messages/html/[messageUuid]/route.ts`) | Uniform `404` when unauthenticated, invalid UUID, inaccessible message, or caught error (`logger.error("message_html_fetch_failed")`); sets `Content-Security-Policy: SAFE_HTML_CSP_POLICY`, `X-Content-Type-Options: nosniff`. |
| `GET /api/messages/attachment/[attachmentUuid]` (`src/app/api/messages/attachment/[attachmentUuid]/route.ts`) | Uniform `404` (`uniformNotFound()`) across unauth, missing DB record, path traversal guard, or missing disk file (`logger.error("attachment_download_failed")`). |
| `GET /api/vcon/domains/[uuid]/dns-status` & `POST dns-preview` | `404` non-admin (route stealth); `503` unconfigured DB; `400` invalid input; `500` caught DNS error. |
| `GET /api/vcon/update/*` (`check`, `preflight`, `start`, `status`) | `404` non-admin; `400` invalid JSON in `start`; structured `{ ok: false, code, error, preflight }` status mapping (`result.status`). |

### 1.3 Auth, Policy, Ingestion & Client UI Feedback
- **Auth & Lockout (`src/core/auth/`):** `LoginAttempt` throttling & lockout tracking; `AUTH_SECRET` hard throw when `AUTH_ENABLED=true` (`auth-secret.ts:13`); separate `admin` vs `user` `loginScope` validation; explicit iframe `MissingCSRF` / blocked-cookie detection in `sign-in-form.tsx` (`lines 69-97`) with `"Open sign-in in a new tab"` recovery link.
- **Ingestion & Sanitization (`src/core/ingestion/`):** `safeAttachmentFilename` path/control-char neutralization (`sanitizer.ts:678-697`); CSS/HTML budget caps; `parseStatus` & `parseWarning` surfaced inside `MessageReaderView` (`line 611` `AlertBanner variant="warning"`).
- **Client Notifications (`src/components/ui/notifications.tsx` & `alert-banner.tsx`):** `sonner` toast (`notify.success`, `notify.error`) for copy actions, mailbox creation/toggle/delete, message unread/delete, admin settings/control saves; inline `<AlertBanner>` for form/DB warnings.

---

## 2. Verified Error-Handling Gaps (To Add / Harden Safely)

| Gap ID | Location | Current Issue | Planned Fix & Target Phase |
|---|---|---|---|
| `ERR-01` | `src/app/global-error.tsx` | Renders `<html lang="en">` without reading persisted user theme (`dark` class), causing jarring theme flash/contrast error on crash. | **Completed (`Phase-06`)** — Restores persisted `"theme"` / `prefers-color-scheme` `.dark` class on mount in `global-error.tsx`. |
| `ERR-02` | `src/app/(workspace)/vcon/not-found.tsx` | Points admin 404 users to `/users` instead of `/vcon`. | **Completed (`Phase-05`)** — Updated link target to `/vcon` (`"Return to admin overview"`). |
| `ERR-03` | `src/components/users/message-reader-view.tsx` | When `/api/messages/html/[messageUuid]` failed (`!res.ok` or network error), `.catch(() => {})` silently swallowed the failure without notifying the user. | **Completed (`Phase-02`)** — Added keyed `htmlFetchErrorKey` state, `<AlertBanner variant="warning">` fallback notice, and interactive `Retry` button. |
| `ERR-04` | `src/components/users/live-mail-notifier.tsx` | Poll errors should degrade cleanly without spamming duplicate toasts on temporary network/session timeout (`401` session expiry redirect/warning). | **Completed (`Phase-06`)** — Stops polling cleanly on `HTTP 401`, sets `syncDegraded`, and emits a single session-expired toast without retry spam. |
| `ERR-05` | `src/components/vcon/settings-console.tsx` & `users-control-console.tsx` | Auth, public, and admin forms lacked uniform `FormField` `error` + `aria-invalid` / `aria-describedby` linkage. | **Completed (`Phase-04` + `Phase-05`)** — Enforced `FormField` `error` + `aria-invalid`/`aria-describedby`/`role="alert"` across public/auth (`Phase-04`) and `/vcon/*` forms (`Phase-05`). |
| `ERR-06` | `src/app/api/contact/route.ts` + `contact-inquiry-form.tsx` | Uses legacy `"X-VibMail-CSRF"` header name (`csrf/route` & `service.ts`); missing typed client fetch error differentiation for `403` expired token auto-retry vs `429` rate limit countdown. | **Completed (`Phase-06`)** — Renamed header to `x-readbox-csrf` / `X-ReadBox-CSRF`, added single-shot `403` CSRF refresh auto-retry, and formatted `429` `Retry-After` guidance. |
| `ERR-07` | `src/app/api/vcon/update/start/route.ts` (`line 33`) | `BigInt(admin.id)` has no `try/catch` guard if a dev-demo or non-numeric admin session ID ever hits the route (unlike `messages/live` which guards `BigInt(user.id)`). | **Completed (`Phase-06`)** — Added numeric regex + `try/catch` guard around `actorId` `BigInt` conversion. |
| `ERR-08` | `src/components/ui/copy-button.tsx` | Works when `navigator.clipboard` exists, lacked fallback in restricted non-HTTPS frames. | **Completed (`Phase-01`)** — Added `document.execCommand("copy")` fallback before error toast. |

---

## 3. Error Handling Rules During Updates

1. **Always Original & Exact Errors:** Never hide real server/validation messages behind generic placeholders when returning `400`/`422`/`429`/`500` responses (except stealth `404` on unauthorized resource/admin routes for security).
2. **Every Async Mutation Must Catch & Report:** All Server Actions and `fetch()` calls must show exact toast (`notify.error`) or `<AlertBanner variant="error">`, and reset loading state inside `finally`.
3. **Zero Silent Failures:** Avoid empty `catch {}` blocks for user-triggered actions.
