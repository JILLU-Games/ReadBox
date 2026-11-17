# 002 — A-Z Production Update & BugFix Roadmap (Step-by-Step Phases)

**উদ্দেশ্য:** `FORENSIC-AUDIT-REPORT.md`-এর ১১টি ফাইন্ডিং (`FA-001`..`FA-011`) কে ঝুঁকি-ভিত্তিক ও ডিপেন্ডেন্সি-সুরক্ষিত **৬টি Scope-Locked Phase**-এ ভাগ করে প্রোডাকশন-রেডি করা।  
**গুরুত্বপূর্ণ নিয়ম:** প্রতি Phase শেষে `npm run typecheck && npm run lint && npm run test:unit && npm run build` পাস না করা পর্যন্ত পরবর্তী Phase শুরু করা হবে না এবং `notes/003-PHASE-PROGRESS-AND-CHANGE-LOG.md` ও `notes/005-ACTUAL-IMPLEMENTATION-TRACKER.md` আপডেট করতে হবে।

---

## Phase Overview

1. **Phase 1:** Critical Auth, Password Reset Security & Audit Consistency (`FA-001`, `FA-002`, `FA-009` core)
2. **Phase 2:** Sandboxed Email Reader Isolation & Policy Inheritance Fix (`FA-003`, `FA-006` inheritance)
3. **Phase 3:** Retention Purge Wiring, Starter Mailbox Contract, DNS & Public Branding (`FA-006` purge, `FA-010`, `FA-011` app items)
4. **Phase 4:** Production Fail-Closed Database & Comprehensive Error Handling (`FA-007`, `FA-011` env, Error Boundaries)
5. **Phase 5:** Admin Contact Inquiries UI (`/vcon/inquiries`) & Admin Profile Parity (`FA-008`, `FA-009` UI parity)
6. **Phase 6:** Docker/Coolify Worker, Postfix/Update Runtime Modernization & Release Verification (`FA-004`, `FA-005`, `FA-011` health)

---

## Detailed Phase Breakdown

### Phase 1 — Critical Auth, Password Reset Security & Audit Consistency
- **Targets:** `FA-001` (Critical), `FA-002` (High), `FA-009` (Medium — audit & `authSource` forwarding)
- **Step-by-Step Actions:**
  1. **Password Reset Hardening (`FA-001`):**
     - `requestPasswordReset` / `requestPasswordResetAction` ও `PasswordResetForm` থেকে যেকোনো অবস্থায় ব্রাউজারে plaintext `token` রিটার্ন/রেন্ডার সম্পূর্ণ মুছে ফেলা (ডিবি-মোড বা প্রোডাকশনে টোকেন কেবল নিরাপদ অ্যাডমিন/CLI/মেইল চ্যানেলের জন্য রাখা; UI-তে কেবল জেনেরিক `"If the account exists, reset instructions have been processed"` দেখানো, অথবা কেবল `DEV_AUTH_MODE=demo && NODE_ENV=development` ছাড়া অন্য কোথাও UI-তে টোকেন না দেখানো)।
     - CLI/Admin দ্বারা ইউজার বা অ্যাডমিন পাসওয়ার্ড রিসেট টোকেন জেনারেট ও ভেরিফিকেশনের নিরাপদ পথ (`scripts/auth/operator.ts` বা `/vcon/users` অ্যাডমিন-ইস্যুড রিসেট) নিশ্চিত করা।
  2. **Persistent Admin Reset & Stateless Contact CSRF (`FA-002`):**
     - `prisma/schema.prisma`-এ `AdminResetToken` মডেল (অথবা `AdminAccount` সম্পর্কিত টোকেন টেবিল) + নতুন Prisma migration তৈরি করে `globalThis.__readboxAdminResetTokens` সরানো।
     - `src/core/contact/service.ts`-এ মেমরি `csrfTokensStore`-এর পরিবর্তে HMAC-SHA256 সাইনড টাইম-বাউন্ড Stateless CSRF টোকেন ও `AuditLog`/`LoginAttempt` স্টাইল DB-backed rate limit যোগ করা।
     - `src/config/env-schema.ts` ও `.env.example`-এ `CONTACT_SECRET_KEY` ডিক্লেয়ার করা।
  3. **Audit & `authSource` Consistency (`FA-009`):**
     - `src/core/auth/credentials.ts` ও `password-reset.ts`-এ `AdminAccount` ইভেন্টে `targetType: "admin_account"` / `"admin"` সামঞ্জস্য করা এবং `user-profile.ts:408`-এ সব প্রাসঙ্গিক অ্যাডমিন সিকিউরিটি ইভেন্ট (`targetType: { in: ["admin", "admin_account"] }`) কোয়েরি করা।
     - `/users/{layout,page,mailboxes/page}.tsx` ও `/api/messages/{html,attachment}/**/route.ts`-এ `authSource: user.authSource` ফরওয়ার্ড করা।
- **Acceptance Criteria:** ব্রাউজার `/reset-password` রেসপন্সে কোনো রিসেট টোকেন থাকবে না; প্রোডাকশন রিস্টার্টের পরও অ্যাডমিন রিসেট টোকেন ও `/contact` CSRF কাজ করবে; `npm run test:auth` ও `npm run test:audit` গ্রিন থাকবে।

---

### Phase 2 — Sandboxed HTML Reader Isolation & Policy Inheritance Fix
- **Targets:** `FA-003` (High), `FA-006` (High — `UserAccessPolicy` inheritance part)
- **Step-by-Step Actions:**
  1. **True `<iframe sandbox>` Email Reader (`FA-003`):**
     - `getMessageDetailForUser` (`src/core/messages/service.ts`) থেকে মূল RSC পেলোডে `htmlBody` ইনলাইন না পাঠিয়ে (অথবা কেবল `hasHtmlBody` রেখে) `<iframe sandbox="allow-same-origin" />` অথবা `srcdoc`/URL ভিত্তিক `/api/messages/html/[messageUuid]?theme=...` স্যান্ডবক্সড ডকুমেন্ট লোড করানো যাতে `SAFE_HTML_CSP_POLICY` প্রকৃতপক্ষে ব্রাউজারে কার্যকর হয়।
     - `MessageReaderView` থেকে মূল React DOM-এ `dangerouslySetInnerHTML={{ __html: scopedHtml }}` ইনজেকশন সরানো, ইনলাইন `cid:` রিসোল্যুশন সার্ভার-সাইড `buildSanitizedHtmlDocument` / `/api/messages/html/[messageUuid]`-এ রাখা এবং আইফ্রেম অটো-হাইট/থিম সিঙ্ক নিরাপদভাবে যুক্ত করা।
  2. **Global vs User Policy Inheritance (`FA-006`):**
     - `prisma/schema.prisma`-এ `UserAccessPolicy`-তে ওভাররাইড সেমান্টিক ঠিক করা (যাতে নতুন ইউজার ক্রিয়েটে শুধু `canDeleteMessages` / `canDeleteMailboxes` সেট করলে `maxMailboxes`, `canCreateMailboxes`, `autoDeleteEnabled`, `autoDeleteDays` গ্লোবাল `UserControlSettings` থেকে inherit হয়, explicit override না দেওয়া পর্যন্ত)।
     - `createManagedUser`, `updateManagedUser` ও `ensureUserAccessPolicy` আপডেট করা যাতে গ্লোবাল সেটিংস সঠিকভাবে সব রেগুলার ও অ্যাডমিন-ক্রিয়েটেড ইউজারের ওপর প্রযোজ্য হয়।
- **Acceptance Criteria:** HTML মেসেজ `<iframe sandbox>`-এর ভেতর রেন্ডার হবে (`SAFE_HTML_CSP_POLICY` সক্রিয়); গ্লোবাল `autoDeleteEnabled=true` দিলে বিদ্যমান ও অ্যাডমিন-ক্রিয়েটেড সব ইউজার তা অটোমেটিক্যালি inherit করবে।

---

### Phase 3 — Retention Purge Engine, Starter Mailbox Contract, DNS & Public Branding
- **Targets:** `FA-006` (High — purge engine & batching), `FA-010` (Medium), `FA-011` (Medium — app/code gaps)
- **Step-by-Step Actions:**
  1. **Wire & Optimize Retention Purge (`FA-006`):**
     - `purgeExpiredMessagesForRetention` (`src/core/messages/service.ts`) কে মেমরি-লোড + sequential loop থেকে `prisma.message.updateMany` ব্যাচ কুয়েরিতে রূপান্তর করা (এবং প্রতি ইউজার পলিসি অনুযায়ী পার্জ সাপোর্ট করা)।
     - `/vcon/operations/actions.ts` এবং `OperationsConsole`-এ **"7. Run email retention purge"** (Dry-run + Execute) বাটন ও অ্যাকশন যুক্ত করা।
     - `src/workers/ingestion.ts`-এর watch লুপে পিরিওডিক রিটেনশন পার্জ (প্রতি N সাইকেল বা ঘণ্টায় একবার) যুক্ত করা।
  2. **Fix Starter Mailbox Auto-Provision Contract (`FA-010`):**
     - `tryProvisionStarterMailbox` (`src/core/auth/sign-up.ts`) থেকে ভাঙা bare `prisma.mailbox.create` ফলব্যাক সরানো যা trailing `/` ছাড়া পাথ ও `mailserver.mailboxes` ছাড়া অচল মেইলবক্স তৈরি করত; কেবল `provisionMailbox()` দ্বারা পূর্ণ কন্ট্র্যাক্ট (Maildir + `mailserver.mailboxes` + অ্যাপ `Mailbox`) অনুসরণ করা।
  3. **Public Footer, PWA Manifest, DNS & Setup Inspection (`FA-011`):**
     - `PublicSiteFooter`-এ `sourceCodeUrl` সঠিকভাবে রেন্ডার করা।
     - `src/app/manifest.ts`-কে `async function manifest()` করে `await getSiteSettings()` ও আপলোডেড আইকন/ফেভিকন সাপোর্ট যোগ করা।
     - `verifyRoutingDns` (`src/core/dns/resolver.ts:180-185`) ও `trusted-operations.ts` (`runSetupVerificationInspection`)-এ প্রকৃত `_prisma_migrations`/`information_schema` এবং `SERVER_IP` ভেরিফিকেশন ঠিক করা।
- **Acceptance Criteria:** Operations কনসোল ও ওয়ার্কার থেকে রিটেনশন পার্জ এক্সিকিউট ও অডিট হয়; `sourceCodeUrl` ফুটারে দৃশ্যমান; `/manifest.webmanifest` ডাইনামিক সাইট নাম দেয়।

---

### Phase 4 — Production Fail-Closed Database & Error Handling Hardening
- **Targets:** `FA-007` (Medium), `FA-011` (`USE_X_ACCEL_REDIRECT`), Error Handling Standardization
- **Step-by-Step Actions:**
  1. **Fail-Closed in Production (`FA-007`):**
     - `src/core/database/client.ts`: `NODE_ENV === "production"` হলে কখনোই `createMockPrismaClient()` রিটার্ন না করে সুস্পষ্ট কনফিগারেশন/কানেকশন এরর থ্রো করা (শুধুমাত্র non-production test/dev-এ যদি অনুমোদিত হয় তবেই মক অনুমোদন)।
     - `src/app/sign-up/actions.ts`: `devDemoActive`-কে কেবল `env.nodeEnv === "development" && env.devAuthMode === "demo"`-তে সীমাবদ্ধ করা (`!env.databaseUrl` হলে প্রোডাকশনে স্পষ্ট `503 Service Unavailable` এরর দেওয়া)।
     - `src/core/accounts/user-control-policy.ts`: প্রোডাকশনে DB এরর হলে `DEMO_VERIFIED_DOMAINS`/`DEV_DEMO_ACCOUNTS` ফলব্যাক না দিয়ে `databaseConnected: false` ও explicit error state রিটার্ন করা, এবং UI-তে স্পষ্ট Error Banner দেখানো।
     - `src/app/(workspace)/users/*`: DB এরর হলে নীরব `createUnconfigured...` ডামি অবজেক্টের বদলে এরর স্টেট দেখানো।
  2. **Error Boundaries & Env Hygiene:**
     - `src/config/env-schema.ts` ও `.env.example`-এ `USE_X_ACCEL_REDIRECT` (boolean default `false`) যুক্ত করা।
     - `/sign-in`, `/sign-up`, `/reset-password`, `/vcon/login` এবং `/users` সাব-ট্রি-তে ডেডিকেটেড `error.tsx` ও `/api/health` ডায়াগনস্টিক উন্নয়ন করা।
- **Acceptance Criteria:** প্রোডাকশনে `DATABASE_URL` ছাড়া বা DB ডাউন থাকলে কোনো নীরব ডেমো/মক ডেটা রেন্ডার হবে না; প্রতিটি রুট সেগমেন্টে গ্রেসফুল Error Boundary থাকবে।

---

### Phase 5 — Admin Contact Inquiries UI (`/vcon/inquiries`) & Admin Profile Parity
- **Targets:** `FA-008` (Medium), `FA-009` (Medium — profile phone parity)
- **Step-by-Step Actions:**
  1. **Wire `listContactSubmissions` into Admin Panel (`FA-008`):**
     - `/vcon/inquiries/page.tsx` ও `src/components/vcon/inquiries-console.tsx` তৈরি করা, `listContactSubmissions()` ব্যবহার করে ফিল্টার/ইনকোয়ারি ডিটেইলস দেখানো।
     - `src/components/layout/app-shell.tsx`-এর `managementGroups`-এ `"Contact inquiries"` (`/vcon/inquiries`) নেভিগেশন আইটেম যুক্ত করা।
  2. **Admin Account Profile Phone Parity (`FA-009`):**
     - `UserSettingsView`-এ `profile.authSource === "admin_table"` হলে সেভ-না-হওয়া অকার্যকর Phone ইনপুটটি লুকানো বা স্পষ্ট `"Not applicable for operator accounts"` নোটিশ দেওয়া (অন্যান্য ইউজার UI অপরিবর্তিত রেখে)।
- **Acceptance Criteria:** `/vcon/inquiries`-এ `/contact` থেকে আসা রিয়েল PostgreSQL ইনকোয়ারি দেখা যাবে; অ্যাডমিন প্রোফাইল সেটিংসে অকার্যকর ফিল্ড বিভ্রান্তি থাকবে না।

---

### Phase 6 — Docker, Coolify, Worker Runtime, Updater Modernization & Release Verification
- **Targets:** `FA-004` (High), `FA-005` (High), `FA-011` (`health/ready` strictness)
- **Step-by-Step Actions:**
  1. **Containerized Ingestion & Retention Worker (`FA-004`):**
     - `Dockerfile`-এ ওয়ার্কার রানটাইম (`scripts/mail/ingest.ts`, `src/workers/ingestion.ts`, `src/core/*`, `tsx`/compiled bundle) অন্তর্ভুক্ত করা যাতে কন্টেইনারের ভেতর থেকেই ওয়ার্কার চালানো যায়।
     - `docker-compose.yml`-এ `worker` সার্ভিস (একই `readbox_vmail`, `readbox_attachments`, `readbox_locks` ভলিউম ও `readbox_internal` নেটওয়ার্ক শেয়ার করে `npm run mail:ingest -- --watch --interval 15` চালাবে) যুক্ত করা এবং `maildir` ইনজেশন + রিটেনশন পার্জ চালু রাখা।
     - PostgreSQL Postfix lookup role/view এবং Coolify ডিপ্লয়মেন্ট ইনস্ট্রাকশন `.env.example` / `docker-compose.yml`-এ সম্পূর্ণ ডকুমেন্ট করা।
  2. **Modernize Env Defaults, Ops Scripts & Container-Aware Updater (`FA-005`):**
     - `src/config/env-schema.ts`: পুরনো `mailstack.local` → `readbox.local`, `/run/vibmail` → `/run/readbox`, `vibmail-updater.service` → `readbox-updater.service`, `/opt/vibmail/...` → `/opt/readbox/...` হালনাগাদ।
     - `scripts/ops/restore.sh`: `readbox-ingestion`/`readbox-web` এবং `/etc/readbox/readbox.env` (ব্যাকওয়ার্ড কমপ্যাট সহ) সাপোর্ট।
     - `scripts/updater/update_worker.py`: কেবল `vmail` নয়, কনফিগারযোগ্য `READBOX_UPDATER_REQUEST_USER` (e.g., `vmail` বা `nextjs`) সাপোর্ট।
     - `src/core/updates/service.ts`: কন্টেইনার (`DOCKER_RUNTIME` / missing `systemd`) মোড ডিটেক্ট করে `/vcon/system-update`-এ মিথ্যা `blocked by systemd` দেখানোর বদলে সুস্পষ্ট `"Managed by container orchestrator (Coolify / Docker Compose)"` + রিড-অনলি GitHub Release চেক ও স্বাস্থ্য রিপোর্ট দেখানো।
  3. **Health Readiness Accuracy & Final Verification (`FA-011`):**
     - `src/core/health/snapshot.ts`: `/health/ready`-তে ঐচ্ছিক/কনফিগারযোগ্য `REQUIRE_INGESTION_READY` ও `mailserver` স্কিমা চেক যুক্ত করা।
     - ফুল ভেরিফিকেশন: `npm run typecheck`, `npm run lint`, `npm run test:unit`, `npm run test:ui`, `npm run build`, `docker compose config`।
- **Acceptance Criteria:** `docker compose config` জিরো এরর; `worker` কন্টেইনারসহ ফুল স্ট্যাক Coolify/Docker-এ Maildir ইনজেস্ট ও রিটেনশন চালাতে সক্ষম; `/vcon/system-update` কন্টেইনার মোডে নির্ভুল স্ট্যাটাস দেখায়; সব টেস্ট ও প্রোডাকশন বিল্ড পাস করে।
