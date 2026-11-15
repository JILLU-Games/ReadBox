# 04 — Error Handling Registry & Hardening Plan

Verified inventory of **existing error handling** in ReadBox and **exact missing / broken error handlers** to add across upcoming phases.

---

## 1. Currently Implemented Error Handling (Verified in Source)

### A. Domain & Core Exceptions (`src/core/*`)
| Error Class / Handler | File & Lines | Current Behavior |
| :--- | :--- | :--- |
| `AuthenticationRequiredError`, `AuthorizationDeniedError` | `src/core/auth/current-user.ts:12-25,73-85` | Guard helpers `requireWorkspaceUser()` / admin guards throw typed auth errors or redirect on page routes |
| `AttachmentTooLargeError`, `PathConfinementError` | `src/core/ingestion/attachments.ts:9,73,86,95` | Prevents path traversal and oversized attachment ingestion |
| `BodyRepairError` | `src/core/ingestion/repair.ts:17,117-221` | Typed codes (`unsafe_key`, etc.) for Maildir body recovery |
| `PathConfinementError` (Ingestion & Provisioning) | `src/core/ingestion/service.ts:141-278,484`, `src/core/mailboxes/provisioning.ts:45` | Validates Maildir/lock paths remain strictly inside confined storage roots |
| `DnsVerificationError` | `src/core/dns/resolver.ts:11,93,98` | Structured error for DNS lookup failures on domain verification |
| `ProvisioningError` | `src/core/mailboxes/provisioning.ts:16` | Structured error for Maildir directory creation/cleanup failures |
| Action Result Union (`{ ok: false, code, error }`) | `src/app/(workspace)/users/mailboxes/actions.ts:55-59`, `src/core/mailboxes/service.ts`, `src/core/messages/service.ts` | Server actions return structured `unavailable` / validation / conflict codes cleanly without throwing unhandled 500s |

### B. API Route HTTP Error Mapping (`src/app/api/*` & `src/app/health/*`)
| Endpoint | File & Lines | Implemented Status Codes & Handling |
| :--- | :--- | :--- |
| `POST /api/contact` | `src/app/api/contact/route.ts:32-189` | `403` (invalid/expired CSRF), `400` (wrong Content-Type, empty/oversized > `MAX_BODY_BYTES`, invalid JSON/non-object), `422` (field validation + `_spam` filter), `429` (`Retry-After` rate limit) |
| `GET /api/messages/live` | `src/app/api/messages/live/route.ts:32-115` | `400` (missing `X-MailStack-Live-Request: 1`), `401` (unauthenticated) |
| `GET /api/messages/html/[messageUuid]` | `src/app/api/messages/html/[messageUuid]/route.ts:20-85` | Uniform `404 Not found` with `nosniff` + `no-store` for unauthorized/missing/DB-disabled requests |
| `GET /api/messages/attachment/[attachmentUuid]` | `src/app/api/messages/attachment/[attachmentUuid]/route.ts:15-111` | Uniform `404 Attachment not found` (`nosniff`, `no-store`) for unauthorized/missing/file-read failures |
| `GET /api/vcon/update/*` & `POST /start` | `src/core/updates/service.ts:64,184-638` | `400` (invalid target), `404` (missing release/job), `409` (conflict/already running), `503` (updater unavailable), `500` (unexpected) |
| `GET /health/ready` | `src/app/health/ready/route.ts:8-15` | `200` when ready, `503` when DB/runtime readiness fails |

### C. UI Error Boundaries & Feedback
| Component / Page | File | Current Mechanism |
| :--- | :--- | :--- |
| Workspace Error Boundary | `src/app/(workspace)/error.tsx:8-44` | Catches workspace rendering errors with `Try again` (`reset()`) and `Back to workspace` |
| Admin Not Found | `src/app/(workspace)/vcon/not-found.tsx:4-21` | Fallback UI for missing `/vcon` domain/mailbox/user UUIDs |
| Toast Notifications | `src/components/ui/notifications.tsx` + `sonner` | `notify.success` / `notify.error` in `/users/*`; direct `toast.error` in `/vcon/*` |
| DB Unconfigured/Disconnected Banners | Inline in `/users/*` & `/vcon/*` pages/components | Conditional inline alert blocks when `databaseConfigured === false` or `databaseConnected === false` |

---

## 2. Error Handling Gaps & Bugs Found in Audit (To Be Added / Fixed)

| ID | Location | Current Issue | Planned Action & Target Phase |
| :--- | :--- | :--- | :--- |
| **ERR-01** | `src/app/api/messages/live/route.ts` & `live-mail-notifier.tsx` | **RESOLVED (`Phase-02`):** Previously returned `200 EMPTY_LIVE_PAYLOAD` on catch. | Logs via `logger.error("live_messages_poll_failed")` and returns `503` `{ error }`; poller surfaces `Live sync paused` indicator in `live-mail-notifier.tsx` & `users-workspace-shell.tsx` after consecutive failures. |
| **ERR-02** | `src/app/global-error.tsx`, `src/app/not-found.tsx`, `(workspace)/error.tsx`, `vcon/not-found.tsx` | **RESOLVED (`Phase-03`):** Previously missing root error/not-found routes and workspace error/not-found routes used non-token `rounded-*` styles. | Added `global-error.tsx` and `not-found.tsx` and migrated `(workspace)/error.tsx` + `vcon/not-found.tsx` onto compact `0rem` `<Panel>`, `<PageTitle>`, and `<Button>` primitives. |
| **ERR-03** | `src/app/api/messages/html/[messageUuid]/route.ts` & `attachment/[attachmentUuid]/route.ts` | **RESOLVED (`Phase-02`):** Previously swallowed unexpected I/O exceptions silently in empty catch blocks. | Added structured `logger.error` logging on exceptions while continuing to return uniform `404` responses without leaking internal paths/secrets. |
| **ERR-04** | `src/components/ui/alert-banner.tsx` + `src/components/users/*` + `src/components/vcon/*` | All `/users/*` & `/vcon/*` alerts migrated onto shared `<AlertBanner>`; only Auth & Public remain. | Auth (`Phase-05`) and Public (`Phase-06`) alert blocks remaining. |
| **ERR-05** | `src/components/vcon/*` | **RESOLVED (`Phase-04`):** Removed all remaining direct `"sonner"` imports across `/vcon/*`. | All `/vcon/*` notifications now route exclusively through `notify` from `@/components/ui`. |
| **ERR-06** | `src/components/users/create-user-mailbox-modal.tsx` | **RESOLVED (`Phase-02`):** Zero-domain warning & validation errors previously used inline divs & raw selects. | Uses `<AlertBanner variant="warning">` when zero verified domains exist and `<AlertBanner variant="error">` + `notify.error` for validation/server action failures. |
| **ERR-07** | Client-side Server Action / Fetch Network Failures | **RESOLVED (`Phase-04`):** Standardized error handling & notifications across all `/vcon/*` consoles and forms. | Action, fetch, and clipboard catch paths report uniform `<AlertBanner>` + `notify.error` feedback (`Phase-03`–`Phase-04`). |
