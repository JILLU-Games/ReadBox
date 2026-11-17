# 005 — Actual Implementation & Production Feature Tracker

**Baseline Date:** `2026-11-16` (`readbox@0.1.0`)  
এই ডকুমেন্টে তিনটি পৃথক স্তরে অ্যাপের প্রকৃত অবস্থা রেকর্ড থাকে:  
**(ক) বর্তমানে বাস্তবে যা কাজ করছে**, **(খ) প্রতিটি আপডেট Phase-এ যা যুক্ত/ফিক্স হলো**, এবং **(গ) যা এখনো অসম্পূর্ণ/অকার্যকর আছে**।

---

## (ক) Currently Actual Working Features (Verified on Baseline)

| সাবসিস্টেম | বর্তমানে বাস্তবে কার্যকর ফিচারসমূহ | ভেরিফায়েড প্রমাণ (Code Reference) |
| :--- | :--- | :--- |
| **Sign-In / Auth Sessions** | PostgreSQL-backed `User` ও `AdminAccount` লগইন, Argon2id হ্যাশিং, IP/Username ব্রুট-ফোর্স লকআউট (`LoginAttempt`), DB-backed `AppSession` / `AdminSession` ভ্যালিডেশন ও রিভোকেশন। | `src/auth.ts`, `src/core/auth/credentials.ts`, `src/core/auth/session-registry.ts` |
| **User Self-Signup & Approval** | ডাইনামিক ফর্ম ফিল্ড (Required/Optional/Hidden), Invite-code ও Admin-approval মোড, পাসওয়ার্ড পলিসি এনফোর্সমেন্ট (`UserControlSettings`)। | `src/core/auth/sign-up.ts`, `src/app/sign-up/actions.ts` |
| **User Workspace (`/users`)** | মেইলবক্স লিস্ট, ইনবক্স পেজিনেশন/সার্চ/আনরিড ফিল্টার, লাইভ পোলিং (`/api/messages/live`), ব্রাউজার নোটিফিকেশন, অ্যাটাচমেন্ট ডাউনলোড (`/api/messages/attachment/*`), মার্ক আনরিড/সফট-ডিলেট, প্রোফাইল ও সেশন ম্যানেজমেন্ট। | `src/core/messages/service.ts`, `src/components/users/live-mail-notifier.tsx`, `src/core/accounts/user-profile.ts` |
| **Admin Domains & Mailboxes (`/vcon`)** | ডোমেইন CRUD, লাইভ DNS চেক (`MX`, `A/AAAA`, SPF/DKIM/DMARC জোন ফাইল জেনারেটর), `mailserver` স্কিমা ও Postfix ভার্চুয়াল ভিউ সিঙ্ক (`pg-adapter.ts`), Maildir ফোল্ডার (`new/cur/tmp`) প্রোভিশনিং ও পার্জ। | `src/core/domains/service.ts`, `src/core/mailboxes/service.ts`, `src/core/mailserver/pg-adapter.ts` |
| **Admin Operations (`/vcon/operations`)** | ১–৬ নম্বর অপারেশন টুল: Postfix কন্ট্র্যাক্ট চেক, `mailserver` সিঙ্ক, Maildir প্রোভিশনিং, অন-ডিমান্ড ম্যানুয়াল Maildir ইনডেক্সিং, কাউন্টার রিক্যালকুলেশন, SHA-256 ভেরিফাইড বডি রিপেয়ার। | `src/core/operations/service.ts`, `src/app/(workspace)/vcon/operations/actions.ts` |
| **Audit & Site Settings (`/vcon/audit`, `/vcon/settings`)** | রিডাক্টেড অডিট লগ সার্চ/ফিল্টার, লকআউট মনিটরিং, সাইট ব্র্যান্ডিং ও ফাইল আপলোড (Logo/Favicon ডিস্ক কনফাইনমেন্টসহ)। | `src/core/audit/queries.ts`, `src/core/settings/service.ts` |
| **Public Site (`/`, `/contact`, `/privacy`)** | SEO মেটাডেটা, Schema.org JSON-LD, FAQ অ্যাকর্ডিয়ন, `/contact` ফর্ম সাবমিশন ও হেলথ প্রোব। | `src/app/page.tsx`, `src/app/contact/page.tsx`, `src/app/privacy/page.tsx` |

---

## (খ) Features Added / Fixed After Update Phases

- **Phase 1 (`2026-11-16` — COMPLETED):**
  - **`FA-001` Resolved:** প্রোডাকশন `/reset-password` UI ও `requestPasswordResetAction` থেকে আনঅথেনটিকেটেড প্লেইনটেক্সট রিসেট টোকেন জেনারেট ও স্ক্রিনে দেখানো সম্পূর্ণ বন্ধ করা হয়েছে (কেবল `development` + `DEV_AUTH_MODE=demo`-তেই প্রিভিউ জেনারেটর চালু থাকে; `scripts/auth/operator.ts`-এ user ও admin উভয়ের জন্য CLI রিসেট টোকেন সাপোর্ট যুক্ত হয়েছে)।
  - **`FA-002` Resolved:** `AdminResetToken` (`admin_reset_tokens`) PostgreSQL টেবিল ও মাইগ্রেশন তৈরি করে মেমরি-নির্ভর অ্যাডমিন রিসেট টোকেন দূর করা হয়েছে; `CONTACT_SECRET_KEY` env স্কিমায় যুক্ত হয়েছে; `/contact` CSRF রিপ্লে-প্রতিরোধ (`consumeContactCsrfTokenDurable`) ও রেট-লিমিটিং PostgreSQL `audit_logs`-ব্যাকড করা হয়েছে।
  - **`FA-009` (Auth/Audit/`authSource`) Resolved:** অ্যাডমিন রিসেট অডিটে `targetType: "admin_account"`, `getUserSecuritySnapshot`-এ `["admin", "admin_account"]` ম্যাচিং এবং সব `/users/*`, `(workspace)/layout.tsx` ও `/api/messages/{html,attachment}` কলারে `authSource: user.authSource` ফরওয়ার্ডিং নিশ্চিত করা হয়েছে।
- **Phase 2 (`2026-11-16` — COMPLETED):**
  - **`FA-003` & `EH-05` Resolved:** `MessageReaderView` থেকে প্যারেন্ট DOM-এ `dangerouslySetInnerHTML` ও ক্লায়েন্ট CSS-স্কোপিং সরিয়ে সত্যিকারের `<iframe sandbox="allow-same-origin allow-popups allow-popups-to-escape-sandbox" src="/api/messages/html/[messageUuid]?theme=...">` স্যান্ডবক্সড রিডার চালু করা হয়েছে। `getMessageDetailForUser` এখন মূল RSC পেলোডে `htmlBody` ইনলাইন পাঠায় না; `SAFE_HTML_CSP_POLICY`-তে `img-src data: 'self'` (ইনলাইন `cid:` অ্যাটাচমেন্টের জন্য) ও `X-Frame-Options: SAMEORIGIN` যুক্ত হয়েছে; `buildSanitizedHtmlDocument` সার্ভার-সাইডেই `target="_blank" rel="noopener noreferrer"`, `<button type="button">` ও `readbox-html-body` মেটা মার্কার যোগ করে এবং লোড ব্যর্থ/টাইমআউটে Retry সহ টেক্সট ফলব্যাক দেখায়।
  - **`FA-006` (Policy Inheritance) Resolved:** Prisma `UserAccessPolicy`-তে `canCreateMailboxes`, `maxMailboxes`, `autoDeleteEnabled`, ও `autoDeleteDays` নালেবল (`NULL = inherit global`) করা হয়েছে এবং নতুন মাইগ্রেশন (`20261116010000_phase2_user_access_policy_inheritance`) যোগ করা হয়েছে। `resolveEffectiveUserPolicy` ও `normalizeExtendedUserAccessPolicy` এখন নাল ওভাররাইডে গ্লোবাল `UserControlSettings` ইনহেরিট করে এবং এক্সপ্লিসিট ওভাররাইডকে প্রাধান্য দেয়।
- **Phase 3 (`2026-11-16` — COMPLETED):**
  - **`FA-006` (Retention Purge Engine, UI & Worker) & `EH-06` (Partial) Resolved:** `purgeExpiredMessagesForRetention` এখন ব্যাচড `500`-রো চাঙ্কে `prisma.message.updateMany` করে, পার-ইউজার `UserAccessPolicy` (`resolveEffectiveUserPolicy`) ইনহেরিট/ওভাররাইড মেনে চলে, এবং মেইলবক্স-ভিত্তিক `try/catch` ও `errors` কাউন্ট রিপোর্ট করে। `/vcon/operations`-এ **Panel 7 (`Run email retention purge`)** + `runRetentionPurgeAction` যুক্ত হয়েছে এবং `src/workers/ingestion.ts` (`--watch`) ঘণ্টাওয়ারি অটো-রিটেনশন পাস চালায়।
  - **`FA-010` Resolved:** `tryProvisionStarterMailbox` থেকে অচল নন-কন্ট্র্যাক্ট `prisma.mailbox.create` ফলব্যাক সরানো হয়েছে এবং ডেমো ব্রাঞ্চ শুধু `params.devDemoActive === true`-তে সীমিত করা হয়েছে — এখন কেবল সম্পূর্ণ `provisionMailbox()` কন্ট্র্যাক্টেই স্টার্টার মেইলবক্স তৈরি হয়।
  - **`FA-011` (Branding, Manifest, DNS & Setup Verification) Resolved:** পাবলিক ফুটারে স্যানিটাইজড `Source code` (`normalizeSafeHref`) লিঙ্ক যুক্ত হয়েছে ও `/`, `/privacy`, `/contact` পেজ থেকে `sourceCodeUrl` পাস করা হয়েছে; `src/app/manifest.ts` ডাইনামিক `async getSiteSettings()` ও কাস্টম `faviconUrl` ব্যবহার করে; `verifyRoutingDns` লুপব্যাক `SERVER_IP` (`127.0.0.1`/`::1`/`0.0.0.0`) প্রত্যাখ্যান করে strict `A/AAAA` ম্যাচ নিশ্চিত করে; `runSetupVerificationInspection` আসল `public` + `mailserver` টেবিল, `_prisma_migrations` এবং fail-closed অ্যাডমিন চেক সম্পন্ন করে।
- **Phase 4 (`2026-11-16` — COMPLETED):**
  - **`FA-007`, `EH-01`, `EH-02`, `EH-03` Resolved:** `resolvePrismaClient` (`src/core/database/client.ts`) এখন প্রোডাকশনে মক প্রিজমা নিষিদ্ধ করে `DatabaseConfigurationError` / `DatabaseUnavailableError` থ্রো করে; `/sign-up`, `user-control-policy.ts`, `settings/service.ts` এবং `/users/*` পেজগুলোতে DB ব্যর্থ হলে `DEMO_VERIFIED_DOMAINS`/`DEV_DEMO_ACCOUNTS` বা নীরব ডামি ডেটা না দেখিয়ে স্পষ্ট `AlertBanner variant="error"` এবং `databaseError` দেখায়।
  - **`FA-011` (`USE_X_ACCEL_REDIRECT`) & `EH-07` Resolved:** `src/config/env-schema.ts`-এ `USE_X_ACCEL_REDIRECT` (`useXAccelRedirect` boolean, default `false`) ভ্যালিডেশন যুক্ত হয়েছে এবং `/api/messages/attachment/[attachmentUuid]` রাউটে ওয়্যার করা হয়েছে।
  - **`EH-04` Resolved:** `/sign-in`, `/sign-up`, `/reset-password`, `/vcon/login`, `/users`, ও `/users/inbox`-এ ডেডিকেটেড রিকভারি `error.tsx` বাউন্ডারি যুক্ত করা হয়েছে।
- **Phase 5 (`2026-11-16` — COMPLETED):**
  - **`FA-008` Resolved:** `/vcon/inquiries` পেজ ও `InquiriesConsole` কম্পোনেন্ট তৈরি করা হয়েছে এবং অ্যাডমিন সাইডবারের `Users & Security` গ্রুপে `"Contact inquiries"` লিঙ্ক যুক্ত করা হয়েছে। অ্যাডমিনরা এখন পাবলিক `/contact` ফর্ম থেকে জমা হওয়া সব ইনকোয়ারি টপিক/সার্চ ফিল্টার করতে পারেন এবং `"View details"` ডায়ালগে পূর্ণ মেসেজ, ইমেইল ও Request ID কপি/পরিদর্শন করতে পারেন।
  - **`FA-009` (UI & Service Parity) Resolved:** `admin_table` (`AdminAccount`) অ্যাকাউন্টের জন্য `/users/settings` পেজে `Phone` ফিল্ড রিড-অনলি/ডিসেবল (`"Not applicable for operator accounts"`) করা হয়েছে এবং `updateUserProfile`-এ `admin_table`-এর জন্য নন-এম্পটি ফোন ভ্যালিডেশন গার্ড যুক্ত হয়েছে যাতে কোনো ফোন নম্বর নীরবে হারিয়ে না যায়।
- **Phase 6 (`2026-11-16` — COMPLETED):**
  - **`FA-004` & `EH-06` Resolved:** `Dockerfile` প্রোডাকশন `runner` স্টেজে `tsx`, `postal-mime`, `proper-lockfile`, `sanitize-html`, `css-tree`, `zod`, `server-only`, `src/`, `scripts/`, `tsconfig.json`, `/run/readbox` এবং `DOCKER_RUNTIME=true` যুক্ত করা হয়েছে; `docker-compose.yml`-এ ডেডিকেটেড `worker` সার্ভিস (`node --conditions=react-server --import tsx scripts/mail/ingest.ts --watch --interval ...`) ও শেয়ার্ড ভলিউম যুক্ত হয়েছে; `entrypoint.sh`-এ `SKIP_MIGRATIONS=true` ও `/run/readbox` ডিফল্ট যুক্ত হয়েছে; এবং `src/workers/ingestion.ts`-এ `recordWorkerDegradedHeartbeat` যুক্ত করা হয়েছে যাতে ইনজেশন বা রিটেনশন পাস ব্যর্থ হলে `ServiceHeartbeat` `"degraded"` হিসেবে রেকর্ড হয়।
  - **`FA-005` Resolved:** `src/core/updates/service.ts`, `src/config/env-schema.ts`, `.env.example`, `scripts/ops/restore.sh`, এবং `scripts/updater/update_worker.py`-তে ডিফল্ট পাথ/ইউনিট ও হোস্টনেম `readbox` (`readbox.local`, `/run/readbox`, `readbox-updater.service`, `/opt/readbox/app/scripts/updater/upgrade.sh`, `nextjs`+`vmail` ইউজার সাপোর্ট) করা হয়েছে (পুরনো `/run/vibmail` ডিস্কে থাকলে ব্যাকওয়ার্ড ফলব্যাকসহ)। পাশাপাশি `isContainerRuntime` ডিটেকশন যুক্ত করা হয়েছে যাতে Docker/Coolify কন্টেইনার রানটাইমে `/vcon/system-update` পেজে অকার্যকর `systemd` ওয়ার্কার চেকের বদলে কন্টেইনার অর্কেস্ট্রেটর স্ট্যাটাস ও প্রিফ্লাইট দেখায়।
  - **`FA-011` (`/health/ready` Gate) Resolved:** `src/core/health/snapshot.ts` (`getReadinessSnapshot`) ও `REQUIRE_INGESTION_READY` env ভ্যারিয়েবল আপডেট করা হয়েছে যাতে ওয়ার্কার হার্টবিট `"degraded"`, `"stale"`, বা `"unavailable"` হলে (অথবা `REQUIRE_INGESTION_READY=true` থাকা অবস্থায় হার্টবিট না থাকলে) `/health/ready` এন্ডপয়েন্ট `503 not_ready` রিটার্ন করে।

---

## (গ) Features Currently Broken, Partial, Demo-Only or Missing in Production (Remaining Queue)

| ফিচার / মডিউল | বর্তমান বাস্তব অবস্থা | সম্পর্কিত অডিট আইডি | টার্গেট Phase |
| :--- | :--- | :--- | :--- |
| _None — All `FA-001` through `FA-011` and `EH-01` through `EH-07` production readiness items have been implemented and verified across Phases 1–6._ | `ALL RESOLVED` | `FA-001`..`FA-011`, `EH-01`..`EH-07` | Completed (`6 / 6`) |
