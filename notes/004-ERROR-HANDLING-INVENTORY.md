# 004 — Error Handling Inventory & Hardening Plan

**Baseline Verified:** `2026-11-16`  
**উদ্দেশ্য:** অ্যাপ্লিকেশনে বর্তমানে কোথায় কী Error Handling আছে এবং প্রোডাকশন রিলিজের জন্য কোন কোন Error Handling অনুপস্থিত বা ত্রুটিপূর্ণ (নীরব ফলব্যাকসহ) — তার পূর্ণাঙ্গ তালিকা।

---

## 1. Currently Implemented Error Handling (Baseline Verified)

### 1.1 React / Next.js Route Boundaries
- `src/app/global-error.tsx`: রুট-লেভেল অপ্রত্যাশিত ক্র্যাশের জন্য `"Application error"` UI, **Try again** (`reset()`) ও **Reload home** বাটন।
- `src/app/not-found.tsx`: গ্লোবাল 404 পেজ (`/` ও `/users` লিঙ্কসহ)।
- `src/app/(workspace)/error.tsx`: `/users` ও `/vcon` ওয়ার্কস্পেসের জন্য `"This workspace view is temporarily unavailable"` বাউন্ডারি।
- `src/app/(workspace)/vcon/not-found.tsx`: `/vcon` অ্যাডমিন রাউটের জন্য 404 পেজ।

### 1.2 API Route HTTP Status & Validation Guards
- `/api/contact/route.ts`: সুস্পষ্ট `400` (field validation), `403` (CSRF failure), `429` (`Retry-After` rate-limit), `500` (DB persistence failure)।
- `/api/messages/live/route.ts`: `400` (`X-ReadBox-Live-Request: 1` অনুপস্থিত), `401` (unauthenticated), `503` (DB poll failure)।
- `/api/messages/html/[messageUuid]/route.ts` ও `/api/messages/attachment/[attachmentUuid]/route.ts`: ইউনিফর্ম `404` (invalid UUID / unauthorized / confinement reject / missing file) এবং `X-Content-Type-Options: nosniff` + `Cache-Control: private, no-store`।
- `/api/vcon/domains/[uuid]/dns-status/route.ts`: `404` (non-admin বা missing domain), `503` (DB unavailable), `500` (lookup error)।
- `/api/vcon/update/{check,preflight,start,status}/route.ts`: `404` (non-admin), `400`/`409`/`503`/`500` (`src/core/updates/service.ts` থেকে ম্যাপিং)।
- `/health/ready/route.ts`: সব ডিপেন্ডেন্সি ঠিক থাকলে `200`, নতুবা `503` (`not_ready`)।

### 1.3 Domain & Infrastructure Typed Errors + Logging
- `PathConfinementError` (`src/core/mailboxes/paths.ts`), `AttachmentTooLargeError` (`src/core/ingestion/attachments.ts`), `MailServerContractError` (`src/core/mailserver/pg-adapter.ts`), `DnsVerificationError` (`src/core/dns/resolver.ts`), `MailValidationError` (`src/core/mailboxes/validators.ts`)।
- সেন্ট্রাল স্ট্রাকচার্ড লগার `logger.info/warn/error` (`src/core/server/logger.ts`) — পাসওয়ার্ড/টোকেন বাদ দিয়ে অপারেশনাল কোড লগ করে।
- `auth.ts` ও `credentials.ts`: PostgreSQL-ভিত্তিক ব্রুট-ফোর্স `LoginAttempt` লকআউট এবং অকার্যকর লগইন/সেশন ফেলার ক্ষেত্রে নিরাপদ `null` রিটার্ন।

---

## 2. Critical Error Handling Gaps & Planned Additions

| ID | বর্তমান সমস্যা (Verified Code Gap) | কী Error Handling যুক্ত করা হবে (Phase Mapped) |
| :--- | :--- | :--- |
| **`EH-01`** | **Silent Mock DB in Production (`src/core/database/client.ts`) — RESOLVED (Phase 4):** `resolvePrismaClient` এখন `NODE_ENV === "production"`-এ মক প্রিজমা নিষিদ্ধ করে স্পষ্ট `DatabaseConfigurationError` / `DatabaseUnavailableError` থ্রো করে। | **Phase 4 (DONE):** প্রোডাকশনে মক প্রিজমা সম্পূর্ণ বন্ধ ও স্ট্রাকচার্ড লগিং যুক্ত। |
| **`EH-02`** | **Silent Demo Fallback in Governance & User Pages (`user-control-policy.ts`, `users/*.tsx`) — RESOLVED (Phase 4):** DB ব্যর্থ হলে আর ডেমো ডোমেইন (`readbox.local`) বা নীরব ডামি ডেটা রেন্ডার করে না; `databaseConnected: false` ও `databaseError` রিটার্ন করে। | **Phase 4 (DONE):** `UsersControlConsole`, `UserOverview`, `UserMailboxesView`, `UserSettingsView`, ও `/sign-up`-এ স্পষ্ট `AlertBanner variant="error"` যুক্ত। |
| **`EH-03`** | **SiteSettings 30s Cooldown Hides Real DB Faults (`src/core/settings/service.ts`) — RESOLVED (Phase 4):** DB ত্রুটি এখন `logger.error/warn` লগ করে এবং প্রোডাকশনে DB ছাড়া ইন-মেমরি সেভ ব্লক করে। | **Phase 4 (DONE):** `SettingsConsole` (`/vcon/settings`)-এ `"Database connection unavailable"` এরর ব্যানার যুক্ত। |
| **`EH-04`** | **Dedicated Route Error Boundaries (`error.tsx`) — RESOLVED (Phase 4):** `/sign-in`, `/sign-up`, `/reset-password`, `/vcon/login`, `/users`, এবং `/users/inbox`-এর জন্য ডেডিকেটেড `error.tsx` বাউন্ডারি যুক্ত হয়েছে। | **Phase 4 (DONE):** `RouteErrorPanel` ও সাব-রুট `error.tsx` রিকভারি বাউন্ডারি যুক্ত। |
| **`EH-05`** | **Iframe HTML Reader Load & Sandbox Fallback (`FA-003`) — RESOLVED (Phase 2):** `MessageReaderView` এখন `<iframe sandbox>` ব্যবহার করে; HTTP 404/error বা ১২সেকেন্ড টাইমআউট অথবা `readbox-html-body` মেটা মার্কার অনুপস্থিত থাকলে warning banner, **Retry** বাটন ও প্লেইন-টেক্সট ফলব্যাক দেখায়। | **Phase 2 (DONE):** `<iframe sandbox>` + `onLoad` marker verification + native `error` listener + timeout + Retry + text fallback। |
| **`EH-06`** | **Ingestion Worker & Retention Purge Error Surfaces (`FA-004`, `FA-006`, `FA-011`) — RESOLVED (Phase 3 & Phase 6):** রিটেনশন পার্জ এখন মেইলবক্স-বাই-মেইলবক্স `try/catch` আইসোলেশন ও `errors` কাউন্ট রিপোর্ট করে (Phase 3), এবং `runIngestionWorkerLoop` (`src/workers/ingestion.ts`) যেকোনো ইনজেশন বা রিটেনশন ফেইলিউরে `recordWorkerDegradedHeartbeat` দিয়ে `ServiceHeartbeat` স্ট্যাটাস `"degraded"` ও মেটাডেটায় এরর মেসেজ রেকর্ড করে; `/health/ready` (`getReadinessSnapshot`) ওয়ার্কার `"degraded"`, `"stale"`, বা `"unavailable"` হলে (অথবা `REQUIRE_INGESTION_READY=true` অবস্থায় আনকনফিগার্ড হলে) `503 not_ready` রিটার্ন করে (Phase 6)। | **Phase 3 & Phase 6 (DONE):** রিটেনশন পার্জ এরর আইসোলেশন, ওয়ার্কার `degraded` হার্টবিট রেকর্ডিং ও স্ট্রিক্ট `/health/ready` গেট সম্পূর্ণ। |
| **`EH-07`** | **Env Validation (`CONTACT_SECRET_KEY`, `USE_X_ACCEL_REDIRECT`, `REQUIRE_INGESTION_READY`) — RESOLVED (Phase 1, Phase 4 & Phase 6):** তিনটি ভ্যারিয়েবলই এখন `src/config/env-schema.ts`-এ Zod দ্বারা ভ্যালিডেটেড এবং `readbox.local` / `/run/readbox` ডিফল্টের সাথে সামঞ্জস্যপূর্ণ। | **Phase 1, Phase 4 & Phase 6 (DONE):** বুট-টাইমে স্কিমা ভ্যালিডেশন সম্পূর্ণ। |
