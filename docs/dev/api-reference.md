# API and server-action reference

ReadBox uses **Next.js App Router** HTTP route handlers **and** colocated server actions. A route shown below is a real source file; this is an internal application API, **not** a separately versioned public SDK. Do not assume unspecified JSON properties or authorization outside the listed contracts.

## Public or authenticated HTTP handlers

| Method | Route | Source / important behavior |
|---|---|---|
| GET/POST | `/api/auth/[...nextauth]` | Auth.js handler; `src/app/api/auth/[...nextauth]/route.ts` |
| GET | `/api/contact/csrf` | Issues CSRF token and cookie; `src/app/api/contact/csrf/route.ts` |
| POST | `/api/contact` | JSON inquiry; CSRF header and cookie, body/rate/age validation; `src/app/api/contact/route.ts` |
| GET | `/api/contact/health` | `{"status":"ready"}` health response |
| GET | `/api/site-settings` | Public-safe settings subset with origin-aware CORS; `src/app/api/site-settings/route.ts` |
| GET | `/api/media/[...path]` | Confined static media read; 404 when missing/unsafe |
| GET | `/health/live` | `{"status":"live"}`; process liveness, not DB readiness |
| GET | `/health/ready` | Dependency snapshot, 200 when ready, 503 otherwise |
| GET | `/health/site-settings` | Delegates to site-settings handler |
| GET | `/api/messages/live` | Authenticated user; **requires** `X-ReadBox-Live-Request: 1`; cursor/bootstrap/mailbox filters |
| GET | `/api/messages/html/[messageUuid]` | Authorized sanitized HTML document; restrictive CSP and frame controls |
| GET | `/api/messages/attachment/[attachmentUuid]` | Membership-scoped download, no-store/nosniff, optional X-Accel-Redirect |
| GET | `/api/vcon/domains/dns-preview?domain=...` | Admin-only expected MX/A/SPF/DKIM/DMARC records; 400 invalid domain |
| GET | `/api/vcon/domains/cloudflare-zones` | Admin-only active zone list, no credentials in response; 503 provider unavailable |
| GET | `/api/vcon/domains/[uuid]/dns-status` | Admin-only live five-record inspection; 404 invalid domain, 503 DB missing |
| GET | `/api/vcon/domains/[uuid]/dkim` | Admin-only DKIM status; 503 unavailable |
| POST | `/api/vcon/domains/[uuid]/dkim` | Admin-only, trusted same-origin JSON `{publish:boolean, zoneId?:string}`; publish=false for manual zone |
| GET | `/api/vcon/backup/jobs/[id]` | Admin-only, validated opaque job ID, no-store status |
| GET | `/api/vcon/update/check` | Admin-only latest source/release check |
| GET | `/api/vcon/update/preflight` | Admin-only guarded host preflight result |
| POST | `/api/vcon/update/start` | Admin-only JSON keys `archive_url`, `checksum_url`, `target_sha`; queues guarded update request |
| GET | `/api/vcon/update/status` | Admin-only update status |

**Security contract:** Many admin endpoints deliberately return **404** rather than reveal an unauthorized resource. Mutating DKIM endpoint refuses cross-origin requests with **403**, non-JSON with **415**, malformed input with **400**, and certain binding conflicts with **409**. JSON HTTP responses are not a commitment to stable external versioning.

## Server actions, not public HTTP RPC endpoints

The following `actions.ts` modules are imported by protected pages/components and enforce session scope:

| Area | Significant exported actions |
|---|---|
| `src/app/(workspace)/vcon/domains/actions.ts` | `createDomainAction`, `updateDomainStatusAction`, `checkDomainDnsAction`, `toggleDomainStatusAction`, `setDefaultDomainAction`, `deleteDomainAction` |
| `.../vcon/mailboxes/actions.ts` | `provisionMailboxAction`, `setMailboxActiveAction`, `purgeMailboxAction`, `bulkPurgeMailboxesAction`, `createSystemMailboxAction` |
| `.../vcon/users/actions.ts` | `createUserAction`, `updateUserAction`, `deleteUserAction` |
| `.../vcon/users/control/actions.ts` | `saveUserControlSettingsAction`, `decidePendingUserAction`, `saveUserPolicyOverrideAction` |
| `.../vcon/backup/actions.ts` | Create/verify backups, configure/test/list R2, upload, configure schedule, test/prepare/commit guarded restore |
| `.../vcon/operations/actions.ts` | Postfix contract, sync, Maildir provision/index/counter repair, retention |
| `.../vcon/settings/actions.ts` | `saveSiteSettingsAction` |
| `.../users/mailboxes/actions.ts` | User create/delete/bulk delete mailbox |
| `.../users/inbox/[mailboxUuid]/[messageUuid]/actions.ts` | Mark unread, soft-delete message |
| `.../users/settings/actions.ts` | Profile, password and session operations |
| `src/app/sign-up/actions.ts`, `reset-password/actions.ts`, `initial-setup/actions.ts` | Registration, token-based password reset and one-time first administrator |

**Request sample, read-only:**

```http
GET /health/live HTTP/1.1
Host: localhost:3000
```

Expected successful body: `{"status":"live"}`. For authenticated APIs, use the product's existing browser/session flow; this documentation does not introduce a new bearer-token API.

Source: `src/app/api/**/route.ts`, protected server action modules, `src/core/auth/route-guards.ts`.
