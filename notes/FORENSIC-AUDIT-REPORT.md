# ReadBox — ফরেনসিক সোর্স-কোড অডিট রিপোর্ট (Production Readiness Audit)

**অডিট ভার্ডিক্ট:** `NOT READY FOR PRODUCTION`  
**অডিট মেথডোলজি:** সম্পূর্ণ স্ট্যাটিক সোর্স-কোড ফরেনসিক অডিট (শুধুমাত্র যাচাইকৃত সোর্স ফাইল, লাইন নম্বর, সিম্বল ও হুবহু কোড ব্লক প্রমাণের ভিত্তিতে রচিত; কোনো অনুমান বা পুরনো ডকুমেন্ট ব্যবহার করা হয়নি)।

---

## ১. সিভিয়ারিটি সামারি ও স্কোপ

| সিভিয়ারিটি | সংখ্যা | ফাইন্ডিং আইডি |
| --- | ---: | --- |
| **CRITICAL** | **১** | `FA-001` |
| **HIGH** | **৫** | `FA-002`, `FA-003`, `FA-004`, `FA-005`, `FA-006` |
| **MEDIUM** | **৫** | `FA-007`, `FA-008`, `FA-009`, `FA-010`, `FA-011` |

---

## ২. সিস্টেম-ভিত্তিক প্রোডাকশন-রেডিনেস ম্যাট্রিক্স

| সাবসিস্টেম / প্যানেল | বর্তমান অবস্থা | যাচাইকৃত প্রধান কারণ |
| --- | --- | --- |
| **Authentication (`/sign-in`, `/vcon/login`, `/sign-up`, `src/auth.ts`)** | ঝুঁকিপূর্ণ (`CRITICAL`) | ক্রেডেনশিয়াল লগইন, লকআউট এবং সেশন রেজিস্ট্রি ডাটাবেসে কাজ করলেও `/reset-password` সরাসরি ব্রাউজারে রিসেট টোকেন প্রিন্ট করে (`FA-001`); `admin_accounts` রিসেট টোকেন ইন-মেমরিতে থাকে (`FA-002`)। |
| **User Workspace (`/users`, `/users/mailboxes`, `/users/inbox/*`, `/users/settings`)** | আংশিক কার্যকর / নিরাপত্তা ও পলিসি বাগ (`HIGH`) | ইনবক্স, পোলিং (`/api/messages/live`), এবং অ্যাটাচমেন্ট ডাউনলোড ডাটাবেসে কাজ করে; তবে HTML রিডার `<iframe sandbox>` ও `SAFE_HTML_CSP_POLICY` এড়িয়ে মূল DOM-এ `dangerouslySetInnerHTML` ব্যবহার করে (`FA-003`), `authSource` ফরওয়ার্ড না হওয়ায় অডিট অ্যাট্রিবিউশন মিসম্যাচ হয় (`FA-009`), ও রিটেনশন ডিফল্ট ইনহেরিটেন্স ভেঙে যায় (`FA-006`)। |
| **Admin Panel (`/vcon/*`: Users Control, Operations, Domains, Settings, System Update)** | আংশিক কার্যকর / অকার্যকর মডিউল (`HIGH`) | `Users/Mailboxes/Domains/Audit` CRUD কাজ করে; কিন্তু `/vcon/system-update` Docker-এ স্থায়ীভাবে ব্লকড (`FA-005`), অটো-ডিলেট পার্জ (`runRetentionPurge`) অপারেশনস বা কোনো ক্রনে যুক্ত নয় (`FA-006`), কন্টাক্ট ইনকোয়ারি দেখার UI নেই (`FA-008`), এবং DB ব্যর্থ হলে `UsersControl` ও `SiteSettings` নীরবে ডেমো/ডিফল্ট ডেটা দেখায় (`FA-007`)। |
| **Public Site (`/`, `/contact`, `/privacy`, `/manifest.webmanifest`)** | আংশিক কার্যকর (`MEDIUM`) | পাবলিক পেজ, FAQ, JSON-LD ও `/contact` সাবমিশন কাজ করে; কিন্তু কন্টাক্ট CSRF/রেট-লিমিট মেমরি-নির্ভর (`FA-002`), ফুটারে `sourceCodeUrl` রেন্ডার হয় না (`FA-011`), ও `/manifest.webmanifest` কোল্ড-স্টার্টে কাস্টম ব্র্যান্ডিং পায় না (`FA-011`)। |
| **Backend Engines, Workers, Docker & Coolify (`Dockerfile`, `docker-compose.yml`, `scripts/*`)** | প্রোডাকশনে অসম্পূর্ণ (`HIGH`) | `docker-compose.yml`-এ `web` ও `postgres` ছাড়া ইনজেশন ওয়ার্কার (`mail:ingest`), Postfix/Dovecot, বা রিটেনশন ক্রন নেই (`FA-004`); প্রোডাকশন ইমেজে `scripts/mail/ingest.ts` বা `tsx` কপি হয় না (`FA-004`); `restore.sh` ও `env-schema.ts`-এ পুরনো `vibmail` নাম ও হার্ডকোডেড `systemd` কমান্ড রয়েছে (`FA-005`)। |

---

## ৩. (ক) যে ফিচারগুলো কেবল ডেমো/মেমরি মোডে চলে বা প্রোডাকশনে ডেমো ফলব্যাক ঝুঁকি তৈরি করে

1. **`getPrismaClient()` প্রোডাকশনেও মক ক্লায়েন্ট রিটার্ন করে (`FA-007`):** `NODE_ENV === "production"` হলেও `DATABASE_URL` না থাকলে বা `new PrismaPg(...)` ফেল করলে এরর থ্রো না করে `createMockPrismaClient()` রিটার্ন করে, যা `findMany: []`, `count: 0`, `upsert: fakeObj` দেয়।
2. **`/sign-up` সার্ভার অ্যাকশন (`src/app/sign-up/actions.ts:17-20`):** `!env.databaseUrl` হলেই প্রোডাকশন পরিবেশেও `devDemoActive = true` সেট হয়ে মেমরিতে ডেমো রেজিস্ট্রেশন চালায়।
3. **`Users Control` কনসোল (`src/core/accounts/user-control-policy.ts:500-532, 910-954`):** PostgreSQL query ফেল করলেই কোনো এরর ব্যানার ছাড়াই হার্ডকোডেড `DEMO_VERIFIED_DOMAINS` (`readbox.local`, `teambox.dev`) ও `DEV_DEMO_ACCOUNTS` (`demo.user`) রিটার্ন করে।
4. **`AdminAccount` পাসওয়ার্ড রিসেট টোকেন ও `/contact` অ্যান্টি-অ্যাবিউজ (`FA-002`):** `admin_accounts` টেবিলের রিসেট টোকেন শুধুমাত্র প্রসেস মেমরি `Map`-এ (`__readboxAdminResetTokens`) থাকে; আর `/contact` পেজের `csrfTokensStore`, `submissionsStore` ও `ephemeralProductionSecret` ইন-মেমরি।
5. **`trusted-operations.ts` (`src/core/setup/trusted-operations.ts:147-292`):** `createDefaultSetupOperations()`-এর তিনটি অপারেশনের `execute` সম্পূর্ণ খালি ফাংশন (`async () => {}`), এবং `runSetupVerificationInspection()` কেবল `SELECT 1` সফল হলেই `"schema-verified"` ধাপকে `passed: true` বলে ঘোষণা করে।

---

## ৪. (খ) যে ফিচারগুলো UI-তে আছে কিন্তু বাস্তবে অকার্যকর / Unwired / অসম্পূর্ণ

1. **পাবলিক পাসওয়ার্ড রিসেট (`/reset-password`) (`FA-001`):** ইমেইল/ওটিপি ডেলিভারি ছাড়াই UI-তে সরাসরি রিসেট টোকেন ও **"Use token"** বাটন দেখায় — ফলে যেকোনো ইউজার বা অ্যাডমিনের অ্যাকাউন্ট টেকওভার সম্ভব।
2. **স্যান্ডবক্সড HTML ইমেল রিডার (`FA-003`):** `/api/messages/html/[messageUuid]` রুট `SAFE_HTML_CSP_POLICY` হেডার দিলেও `MessageReaderView` কোনো `<iframe sandbox>` ব্যবহার না করে `dangerouslySetInnerHTML`-এর মাধ্যমে সরাসরি মূল React DOM-এ HTML/CSS ইনজেক্ট করে।
3. **ইমেল অটো-ডিলেট রিটেনশন পার্জ (`FA-006`):** `/vcon/users/control` UI-তে ঘোষণা করা আছে যে পুরনো মেসেজ *"automatically hidden and purged from governed user inboxes"*, কিন্তু `runRetentionPurge` (`src/core/operations/service.ts:962`) অ্যাপের কোথাও (না `/vcon/operations`-এ, না `workers/ingestion.ts`-এ, না Docker ক্রনে) কল করা হয়নি।
4. **কন্টাক্ট ইনকোয়ারি ম্যানেজমেন্ট (`FA-008`):** `/contact` ফর্ম ডেটা `audit_logs`-এ সেভ করলেও এবং `listContactSubmissions` (`src/core/contact/service.ts:526`) ইমপ্লিমেন্ট করা থাকলেও `/vcon` অ্যাডমিন প্যানেলে ইনকোয়ারি দেখার কোনো পেজ বা কলার নেই।
5. **সিস্টেম আপডেট কনসোল (`/vcon/system-update`) Docker/Coolify-তে (`FA-005`):** UI বাটন থাকলেও কন্টেইনারে `systemctl`, `nginx`, `postfix`, `doveconf`, `rsync`, `pg_dump`, `/etc/systemd/system/*` এবং `vmail` ইউজার না থাকায় `runUpdatePreflight` স্থায়ীভাবে `blocked` রিটার্ন করে।
6. **Public Footer `Source Code URL` ও অপ্রয়োগিত ব্র্যান্ডিং ফিড (`FA-011`):** `/vcon/settings`-এ `sourceCodeUrl` এডিট ও সেভ করা গেলেও `PublicSiteFooter` (`src/components/public/public-site-footer.tsx:15-22`) সেটি গ্রহণ বা রেন্ডার করে না। আর `/manifest.webmanifest` (`src/app/manifest.ts:4-39`) ডিবি থেকে async লোড না করায় কোল্ড কন্টেইনারে ডিফল্ট `"ReadBox"` নাম ও স্ট্যাটিক আইকন দেয়।

---

## ৫. (গ) ব্যাকএন্ড ইঞ্জিন, ওয়ার্কার, স্ক্রিপ্ট ও Docker/Coolify ইনফ্রাস্ট্রাকচার অমিল

1. **কন্টেইনারাইজড Maildir ইনজেশন ওয়ার্কার ও Postfix/Dovecot অনুপস্থিত (`FA-004`):** `docker-compose.yml`-এ কেবল `postgres` ও `web` কন্টেইনার রয়েছে। `Dockerfile` প্রোডাকশন `runner` স্টেজে `scripts/mail/ingest.ts` বা `tsx` রাখে না, ফলে কন্টেইনারের ভেতর থেকে `npm run mail:ingest` চালানোও অসম্ভব।
2. **Legacy `vibmail` ও `mailstack.local` কনফিগারেশন অমিল (`FA-005`):** `env-schema.ts`-এর ডিফল্টে এখনো `mailstack.local`, `/run/vibmail`, `vibmail-updater.service`, `/opt/vibmail/app/scripts/updater/upgrade.sh`; `scripts/ops/restore.sh` এখনো `vibmail-ingestion vibmail-web` ও `/etc/vibmail/vibmail.env` হার্ডকোড করে রেখেছে; `update_worker.py` কেবল `vmail` ইউজারের ফাইল গ্রহণ করে (অথচ `Dockerfile`-এ ইউজার `nextjs`)।
3. **`/health/ready` ইনজেশন বা Mailserver কন্ট্র্যাক্ট যাচাই করে না (`FA-011`):** ইনজেশন ওয়ার্কার বন্ধ থাকলেও বা `mailserver` স্কিমা ভাঙা থাকলেও `/health/ready` (`200 OK`) দেয়।
4. **স্টার্টার মেইলবক্স ফলব্যাক ও `maildirRelativePath` কন্ট্র্যাক্ট লঙ্ঘন (`FA-010`):** সাইন-আপের ফলব্যাক কোডে `mailserver.mailboxes` বাদ দিয়ে এবং শেষে `/` ছাড়া মেইলবক্স রো তৈরি হয়।
5. **`UserAccessPolicy` ও `UserControlSettings` ডিফল্ট ওভাররাইড বাগ (`FA-006`):** অ্যাডমিন নতুন ইউজার তৈরি করলে `prisma/schema.prisma`-এর কংক্রিট ডিফল্ট (`autoDeleteEnabled: false, maxMailboxes: 3`) সেভ হওয়ায় গ্লোবাল রিটেনশন ও কোটা নীতি ওভাররাইট হয়ে যায়।

---

## ৬. (ঘ) ফরেনসিক বাগ ও সিকিউরিটি ফাইন্ডিংস ক্যাটালগ (কোড প্রমাণসহ)

### `FA-001` [CRITICAL] — `/reset-password`-এ অথেনটিকেশন ছাড়াই সরাসরি ব্রাউজারে রিসেট টোকেন প্রিন্ট (Account Takeover)

- **সাবসিস্টেম:** Authentication / Password Reset
- **লোকেশন ও সিম্বল:**
  - `src/core/auth/password-reset.ts:150-264` (`requestPasswordReset`)
  - `src/app/reset-password/actions.ts:27-69` (`requestPasswordResetAction`)
  - `src/components/auth/password-reset-form.tsx:96-118` (`PasswordResetForm`)
- **প্রভাব:** ইন্টারনেট থেকে যেকোনো অননুমোদিত ব্যক্তি শুধু ইউজারনেম বা ইমেইল দিয়ে `User` অথবা `AdminAccount` উভয়ের বৈধ পাসওয়ার্ড রিসেট টোকেন পেয়ে সরাসরি পাসওয়ার্ড বদলে পুরো সিস্টেম দখল করতে পারে।
- **কোড প্রমাণ:**

```ts
// src/core/auth/password-reset.ts:206-210 & 258-262
    return {
      ok: true,
      token,
      username: user.username,
    };
// ...
      return {
        ok: true,
        token,
        username: admin.username,
      };
```

```ts
// src/app/reset-password/actions.ts:65-69
    return {
      status: "issued",
      token: result.token,
      username: result.username,
    };
```

```tsx
// src/components/auth/password-reset-form.tsx:103-115
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <code className="break-all font-mono text-xs text-foreground">
                      {requestState.token}
                    </code>
                    <Button
                      size="sm"
                      type="button"
                      variant="outline"
                      onClick={() => setTokenValue(requestState.token ?? "")}
                    >
                      Use token
                    </Button>
                  </div>
```

---

### `FA-002` [HIGH] — `AdminAccount` রিসেট টোকেন এবং `/contact` CSRF ও রেট-লিমিট কেবল ইন-মেমরিতে সংরক্ষিত

- **সাবসিস্টেম:** Admin Reset Persistence & Public Contact Security
- **লোকেশন ও সিম্বল:**
  - `prisma/schema.prisma:162-173` (`PasswordResetToken` — কেবল `userId` রিলেশন)
  - `src/core/auth/password-reset.ts:228-242, 341-348` (`getAdminResetTokenStore`)
  - `src/core/contact/service.ts:98-122` (`csrfTokensStore`, `submissionsStore`, `getSecretKey`)
- **প্রভাব:** সার্ভার রিস্টার্ট বা মাল্টি-ওয়ার্ক/মাল্টি-রেপ্লিকা ডিপ্লয়মেন্টে অ্যাডমিন রিসেট টোকেন, `/contact` CSRF টোকেন ও রেট-লিমিট কাউন্টার মুছে যায়। প্রোডাকশনে `AUTH_SECRET` ও `CONTACT_SECRET_KEY` না থাকলে (`CONTACT_SECRET_KEY` `env-schema.ts`-এ ডিক্লেয়ার্ডই নয়) র‍্যান্ডম `ephemeralProductionSecret` তৈরি হয়ে CSRF/IP হ্যাশ ইনভ্যালিড হয়।
- **কোড প্রমাণ:**

```prisma
// prisma/schema.prisma:162-170
model PasswordResetToken {
  id        BigInt   @id @default(autoincrement())
  userId    BigInt   @unique @map("user_id")
  tokenHash String   @unique @map("token_hash") @db.Char(64)
  expiresAt DateTime @map("expires_at") @db.Timestamptz(6)
  createdAt DateTime @default(now()) @map("created_at") @db.Timestamptz(6)

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)
```

```ts
// src/core/contact/service.ts:98-119
const csrfTokensStore = new Map<string, CsrfTokenEntry>();
const submissionsStore: SubmissionRateEntry[] = [];
let ephemeralProductionSecret: string | null = null;
let warnedEphemeralSecret = false;

function getSecretKey(): string {
  const configured =
    env.authSecret?.trim() || process.env.CONTACT_SECRET_KEY?.trim();
  if (configured) {
    return configured;
  }
  if (env.nodeEnv === "production") {
    if (!ephemeralProductionSecret) {
      ephemeralProductionSecret = randomBytes(32).toString("hex");
    }
```

---

### `FA-003` [HIGH] — HTML ইমেল রিডার `<iframe sandbox>` ও `SAFE_HTML_CSP_POLICY` বাইপাস করে মূল DOM-এ ইনজেক্ট করে

- **সাবসিস্টেম:** User Workspace / Sandboxed Reader
- **লোকেশন ও সিম্বল:**
  - `src/app/api/messages/html/[messageUuid]/route.ts:74-83`
  - `src/core/messages/service.ts:1404` (`getMessageDetailForUser`)
  - `src/components/users/message-reader-view.tsx:298-388, 798-805`
- **প্রভাব:** যদিও API রুট `SAFE_HTML_CSP_POLICY` সহ ডকুমেন্ট রিটার্ন করে, `MessageReaderView` কোনোরকম `<iframe sandbox>` রেন্ডার করে না; বরং RSC পেলোডের `message.htmlBody` (`service.ts:1404`) অথবা fetch-করা HTML থেকে regex-এ CSS স্কোপ করে `dangerouslySetInnerHTML={{ __html: scopedHtml }}` দিয়ে অথেনটিকেটেড প্যারেন্ট DOM-এর ভেতরেই HTML বসিয়ে দেয়। ফলে ইমেইলের CSS/DOM ওভারলে সরাসরি ReadBox অ্যাপের সেশন পেজে প্রভাব ফেলতে পারে।
- **কোড প্রমাণ:**

```tsx
// src/components/users/message-reader-view.tsx:798-805
          {scopedHtml ? (
            <div
              className={cn(
                "readbox-mail-body readbox-scrollable max-w-full overflow-x-auto",
                scopeClass,
              )}
              dangerouslySetInnerHTML={{ __html: scopedHtml }}
            />
```

```ts
// src/core/messages/service.ts:1404
    textBody: message.textBody,
    htmlBody: resolvedHtmlBody,
    hasHtmlBody: resolvedHtmlBody.trim().length > 0,
```

---

### `FA-004` [HIGH] — Docker/Coolify স্ট্যাকে ইনজেশন ওয়ার্কার, `ingest.ts` ও Postfix/Dovecot ইনফ্রা অনুপস্থিত

- **সাবসিস্টেম:** Docker / Coolify Deployment & Mail Ingestion
- **লোকেশন ও সিম্বল:**
  - `Dockerfile:53-75`
  - `docker-compose.yml:1-106`
- **প্রভাব:** `docker-compose.yml`-এ শুধুমাত্র `postgres` এবং `web` (`node server.js`) সার্ভিস রয়েছে। কোনো ব্যাকগ্রাউন্ড Maildir ইনজেশন কন্টেইনার, রিটেনশন ক্রন বা Postfix/Dovecot কন্টেইনার নেই। এমনকি `Dockerfile` প্রোডাকশন `runner` ইমেজে `scripts/mail/ingest.ts` বা `tsx` প্যাকেজ কপিই করে না — তাই কন্টেইনারের ভেতর থেকে `npm run mail:ingest` ম্যানুয়ালি চালানোও সম্ভব নয়।
- **কোড প্রমাণ:**

```dockerfile
# Dockerfile:54-61
COPY --from=migrator --chown=nextjs:nodejs /migrator/node_modules ./node_modules
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/prisma ./prisma
COPY --from=builder --chown=nextjs:nodejs /app/prisma.config.ts ./prisma.config.ts
COPY --chown=nextjs:nodejs entrypoint.sh ./entrypoint.sh
```

```yaml
# docker-compose.yml:1-24 (শুধুমাত্র postgres ও web সার্ভিস সংজ্ঞায়িত)
services:
  postgres:
    image: postgres:16.14-alpine
# ...
  web:
    build:
      context: .
      dockerfile: Dockerfile
```

---

### `FA-005` [HIGH] — সিস্টেম আপডেট ইঞ্জিন, `env-schema` ও অপস স্ক্রিপ্ট `systemd` + পুরনো `vibmail` পাথে হার্ডকোড করা

- **সাবসিস্টেম:** System Update Engine (`/vcon/system-update`), Ops Scripts & Env Config
- **লোকেশন ও সিম্বল:**
  - `src/core/updates/service.ts:430-518` (`runUpdatePreflight`)
  - `src/config/env-schema.ts:111, 121, 131, 201, 205, 213`
  - `scripts/ops/restore.sh:45, 69, 94-95`
  - `scripts/updater/update_worker.py:44-54`
- **প্রভাব:** Docker/Coolify কন্টেইনারে `systemctl`, `nginx`, `postfix`, `doveconf`, `rsync`, `pg_dump`, `/etc/systemd/system/*.service` ও `vmail` ইউজার না থাকায় `runUpdatePreflight` সবসময় `blocked` থাকে। পাশাপাশি `restore.sh` এখনো `vibmail-ingestion`, `vibmail-web` ও `/etc/vibmail/vibmail.env` হার্ডকোড করে রেখেছে এবং `update_worker.py` `vmail` ইউজারের UID খোঁজে (কন্টেইনারে ইউজার হলো `nextjs`)।
- **কোড প্রমাণ:**

```ts
// src/core/updates/service.ts:430-473
  const requiredCommands = [
    "node", "flock", "rsync", "tar", "sha256sum", "systemctl",
    "curl", "nginx", "postfix", "realpath", "readlink", "doveconf", "pg_dump",
  ] as const;
// ...
  const requiredServices = [
    normalizedUnitName, "postgresql.service", "postfix.service",
    "dovecot.service", "nginx.service", webServiceName, ingestionServiceName,
  ] as const;
```

```bash
# scripts/ops/restore.sh:45, 69, 94-95
SERVICES=(postfix dovecot vibmail-ingestion vibmail-web)
# ...
ENV_FILE=${VIBMAIL_ENV_FILE:-/etc/vibmail/vibmail.env}
# ...
chown root:vmail /etc/vibmail/vibmail.env
chmod 0640 /etc/vibmail/vibmail.env
```

```python
# scripts/updater/update_worker.py:44-52
def valid_request_file(request_path: Path = REQUEST_PATH) -> bool:
    try:
        request_stat = request_path.lstat()
        vmail_uid = pwd.getpwnam("vmail").pw_uid
        return (
            stat.S_ISREG(request_stat.st_mode)
            and request_stat.st_uid == vmail_uid
```

---

### `FA-006` [HIGH] — রিটেনশন পলিসি ইনহেরিটেন্স বাগ এবং অসংযুক্ত `runRetentionPurge` ইঞ্জিন

- **সাবসিস্টেম:** Users Control Governance & Operations Retention Engine
- **লোকেশন ও সিম্বল:**
  - `prisma/schema.prisma:103-112` (`UserAccessPolicy`)
  - `src/core/accounts/users.ts:464-470, 719-730` (`createManagedUser`, `updateManagedUser`)
  - `src/core/accounts/user-control-policy.ts:364-397` (`resolveEffectiveUserPolicy`)
  - `src/core/operations/service.ts:962` (`runRetentionPurge` — শূন্য কলার)
  - `src/core/messages/service.ts:2015-2159` (`purgeExpiredMessagesForRetention`)
- **প্রভাব:**
  1. `/vcon/users` থেকে ইউজার তৈরি/এডিট করার সময় `tx.userAccessPolicy.create/upsert`-এ শুধু `canDeleteMessages` ও `canDeleteMailboxes` পাঠানো হয়; ফলে স্কিমার কংক্রিট ডিফল্ট (`autoDeleteEnabled: false, maxMailboxes: 3, canCreateMailboxes: true`) ডাটাবেসে সেভ হয়ে যায়। এরপর `resolveEffectiveUserPolicy` `userPolicy?.autoDeleteEnabled !== undefined` চেক করে সেই `false` মানকেই গ্রহণ করে — অর্থাৎ গ্লোবাল `UserControlSettings`-এর অটো-ডিলেট পলিসি নীরবে উপেক্ষিত হয়।
  2. `runRetentionPurge` ফাংশনটি `src/app/(workspace)/vcon/operations/actions.ts`, `workers/ingestion.ts` বা কোনো ক্রনের সাথে সংযুক্তই নয়; ফলে পুরনো মেসেজ ডিস্ক/ডাটাবেস থেকে পার্জ হয় না এবং পার্জ লজিক প্রতি মেইলবক্সের সব মেসেজ মেমরিতে লোড করে লুপ চালিয়ে `prisma.message.update` করে (অ্যাটাচমেন্ট বা Maildir ফাইল মুছে না)।
- **কোড প্রমাণ:**

```ts
// src/core/accounts/user-control-policy.ts:377-380
  const autoDeleteEnabled =
    userPolicy?.autoDeleteEnabled !== undefined
      ? normalized.autoDeleteEnabled
      : globalSettings.autoDeleteEnabled;
```

```ts
// src/core/accounts/users.ts:464-470
      await tx.userAccessPolicy.create({
        data: {
          userId: user.id,
          canDeleteMessages: data.canDeleteMessages,
          canDeleteMailboxes: data.canDeleteMailboxes,
        },
      });
```

---

### `FA-007` [MEDIUM] — প্রোডাকশনে DB এরর লুকিয়ে মক/ডেমো ডেটা রিটার্ন করার ফলব্যাক

- **সাবসিস্টেম:** Database Layer & Control Fallbacks
- **লোকেশন ও সিম্বল:**
  - `src/core/database/client.ts:42-59` (`getPrismaClient`)
  - `src/app/sign-up/actions.ts:17-20` (`registerUserSignupAction`)
  - `src/core/accounts/user-control-policy.ts:500-532, 910-954`
  - `src/core/settings/service.ts:386-396`
- **প্রভাব:** প্রোডাকশনে PostgreSQL সংযোগ বিচ্ছিন্ন বা ভুল থাকলে সত্যিকারের ব্যর্থতা না দেখিয়ে নীরবে মক ক্লায়েন্ট অথবা হার্ডকোডেড ডেমো ডোমেইন/অ্যাকাউন্ট (`readbox.local`, `teambox.dev`, `demo.user`) পরিবেশিত হয়।
- **কোড প্রমাণ:**

```ts
// src/core/database/client.ts:42-56
export function getPrismaClient(): PrismaClient {
  if (!env.databaseUrl) {
    console.warn("[AI Studio] Database not connected — using mock");
    return createMockPrismaClient();
  }

  if (!globalForPrisma.mailstackPrisma) {
    try {
      const adapter = new PrismaPg({ connectionString: env.databaseUrl });
      globalForPrisma.mailstackPrisma = new PrismaClient({ adapter });
    } catch {
      console.warn("[AI Studio] Database not connected — using mock");
      return createMockPrismaClient();
    }
  }
```

```ts
// src/app/sign-up/actions.ts:17-20
  const devDemoActive =
    !env.databaseUrl ||
    (env.nodeEnv === "development" && env.devAuthMode === "demo");
```

---

### `FA-008` [MEDIUM] — `/contact` ইনকোয়ারি `audit_logs`-এ সেভ হলেও কোনো অ্যাডমিন UI নেই

- **সাবসিস্টেম:** Public Contact & Admin Console
- **লোকেশন ও সিম্বল:** `src/core/contact/service.ts:465-491, 526-605` (`submitContactInquiry`, `listContactSubmissions`)
- **প্রভাব:** ভিজিটররা `/contact` ফর্ম সাবমিট করলে তা `audit_logs`-এ (`action: "public_contact_submitted"`, `targetType: "contact_inquiry"`) সেভ হয়, কিন্তু `listContactSubmissions()` পুরো কোডবেজে কোথাও ইমপোর্ট বা কল করা হয়নি (`grep` দ্বারা যাচাইকৃত)। অ্যাডমিনের ইনকোয়ারি দেখার বা রিপ্লাই দেওয়ার কোনো আলাদা ইনবক্স/UI নেই।
- **কোড প্রমাণ:**

```ts
// src/core/contact/service.ts:526-547 (পুরো src/ ও scripts/-এ কোনো কলার নেই)
export async function listContactSubmissions(options?: {
  readonly prisma?: ContactInquiryReadClient | null;
  readonly limit?: number;
}): Promise<readonly PersistedContactSubmissionItem[]> {
```

---

### `FA-009` [MEDIUM] — `admin_accounts` অডিট `targetType` অমিল ও `authSource` ফরওয়ার্ডিং গ্যাপ

- **সাবসিস্টেম:** Admin Security Audit, API Routes & Workspace Attribution
- **লোকেশন ও সিম্বল:**
  - `src/core/auth/credentials.ts:182` (`targetType: "admin_account"`)
  - `src/core/auth/password-reset.ts:250, 376` (`targetType: "user"`)
  - `src/core/accounts/user-profile.ts:405-419` (`targetType: "admin"`)
  - `src/app/api/messages/attachment/[attachmentUuid]/route.ts:69-77` ও `src/app/api/messages/html/[messageUuid]/route.ts:46-54`
- **প্রভাব:**
  1. অ্যাডমিন লগইন ইভেন্ট লগ হয় `targetType: "admin_account"` হিসেবে, অ্যাডমিন পাসওয়ার্ড রিসেট লগ হয় `targetType: "user"` হিসেবে, অথচ সিকিউরিটি সেটিংস (`getUserSecuritySnapshot`) কোয়েরি করে শুধু `targetType: "admin"` — ফলে অ্যাডমিনের নিজস্ব সিকিউরিটি অ্যাক্টিভিটি লগে লগইন ও রিসেট ইভেন্ট মিসিং থাকে।
  2. মেসেজ HTML ও অ্যাটাচমেন্ট ডাউনলোড API রুটগুলোতে `authSource: user.authSource` পাস করা হয়নি; ফলে `admin_table` অ্যাডমিন (যার `admin_accounts.id` ও `users.id` কাকতালীয়ভাবে একই হতে পারে, যেমন `1`) অডিট লগে ভুল `User` হিসেবে অ্যাট্রিবিউট হতে পারে।
- **কোড প্রমাণ:**

```ts
// src/core/accounts/user-profile.ts:405-410
        prisma.auditLog.findMany({
          where: {
            action: { in: [...USER_SECURITY_AUDIT_ACTIONS] },
            targetType: "admin",
            ...(actor.username ? { targetIdentifier: actor.username } : {}),
          },
```

```ts
// src/app/api/messages/attachment/[attachmentUuid]/route.ts:71-77 (authSource অনুপস্থিত)
      {
        userId,
        username: user.username,
        isAdministrator: user.isAdministrator,
        headers: request.headers,
        trustProxyHeaders: env.trustProxyHeaders,
      },
```

---

### `FA-010` [MEDIUM] — স্টার্টার মেইলবক্স ফলব্যাক Postfix/Mailserver কন্ট্র্যাক্ট ভঙ্গ করে

- **সাবসিস্টেম:** Self-Service Sign-Up (`tryProvisionStarterMailbox`)
- **লোকেশন ও সিম্বল:** `src/core/auth/sign-up.ts:233-288`
- **প্রভাব:** সাইন-আপের সময় `provisionMailbox()` কনফ্লিক্ট ছাড়া অন্য কারণে (যেমন ডিস্ক পারমিশন বা mailserver স্কিমা ত্রুটি) ব্যর্থ হলে ফলব্যাক সরাসরি `prisma.mailbox.create` করে দেয় — কিন্তু `maildirRelativePath`-এর শেষে `/` যোগ করে না (Postfix ভার্চুয়াল কন্ট্র্যাক্ট রেগেক্স ভঙ্গ করে), `mailserver.mailboxes`-এ কোনো রো তৈরি করে না এবং ডিস্কে Maildir ফোল্ডারও তৈরি করে না। ফলে এই মেইলবক্স কোনোদিন ইনকামিং ইমেইল রিসিভ করতে পারবে না।
- **কোড প্রমাণ:**

```ts
// src/core/auth/sign-up.ts:246-253
      const createdMailbox = await prisma.mailbox.create({
        data: {
          domainId: targetDomain.id,
          localPart: candidateLocal,
          emailAddress,
          status: "active",
          maildirRelativePath: `${targetDomain.name.toLowerCase()}/${candidateLocal}/Maildir`,
        },
```

---

### `FA-011` [MEDIUM] — অসংযুক্ত / অসম্পূর্ণ কনফিগ ও হেলথ চেক গ্যাপসমূহ

- **লোকেশন ও প্রমাণ:**
  1. **Setup Verification স্টাবস (`src/core/setup/trusted-operations.ts:147-292`):** `createDefaultSetupOperations()` তিনটি খালি `execute: async () => {}` স্টাব দেয় এবং `runSetupVerificationInspection()` কেবল `SELECT 1` দিয়েই `"schema-verified"` `passed: true` মার্ক করে (সারা প্রজেক্টে কোনো কলার নেই)।
  2. **Public Footer `sourceCodeUrl` উপেক্ষিত (`src/components/public/public-site-footer.tsx:5-22`):** `PublicSiteFooterProps`-এ `sourceCodeUrl` থাকলেও কম্পোনেন্টটি সেটি ডিস্ট্রাকচার বা রেন্ডার করে না।
  3. **PWA Manifest ডাইনামিক ব্র্যান্ডিং মিস করে (`src/app/manifest.ts:4-18`):** `await getSiteSettings()`-এর বদলে সিঙ্ক্রোনাস `getCachedSiteSettingsSnapshot()` পড়ায় কাস্টম `siteName`/`siteTagline` কোল্ড কন্টেইনারে আসে না এবং অ্যাডমিনের আপলোড করা কাস্টম আইকন/ফেভিকন ব্যবহার হয় না।
  4. **`/health/ready` ইনজেশন ওয়ার্কার চেক করে না (`src/core/health/snapshot.ts:139-145`):** `ready` ফ্ল্যাগে কেবল কনফিগ, DB, মাইগ্রেশন ও স্টোরেজ চেক হয় — `mailServices.connected` (`maildir_ingestion` হার্টবিট) ইনক্লুড করা হয়নি, তাই ওয়ার্কার বন্ধ থাকলেও `200 OK` রিটার্ন করে।
  5. **DNS IP ম্যাচ স্কিপ (`src/core/dns/resolver.ts:180-185`):** `SERVER_IP` ডিফল্ট `127.0.0.1` হলে `verifyRoutingDns` A/AAAA রেকর্ড আসল সার্ভারের IP-র সাথে ম্যাচ না করেই `targetAddresses.length > 0` হলে `targetOk: true` দিয়ে দেয়।
  6. **অসংজ্ঞায়িত Env Var (`src/app/api/messages/attachment/[attachmentUuid]/route.ts:95-103`):** `USE_X_ACCEL_REDIRECT` সরাসরি `process.env` থেকে পড়া হয়েছে (`env-schema.ts` বা `.env.example`-এ সংজ্ঞায়িত নয়)।

```ts
// src/core/health/snapshot.ts:140-145 (mailServices.connected চেক করা হয়নি)
  const ready =
    configuration.ok &&
    databaseOk &&
    migrationsOk &&
    mailStorage.ok &&
    attachmentStorage.ok;
```

```ts
// src/core/dns/resolver.ts:181-184
    const targetOk =
      targetIp && targetIp !== "127.0.0.1"
        ? targetAddresses.includes(targetIp)
        : targetAddresses.length > 0;
```

---

## ৭. প্রোডাকশন রিলিজ ব্লকার সামারি

বর্তমান অবস্থায় ReadBox প্রোডাকশন রিলিজের জন্য প্রস্তুত নয় কারণ:
1. **`/reset-password` (FA-001)** আনঅথেনটিকেটেড ফুল-অ্যাকাউন্ট (অ্যাডমিনসহ) টেকওভার তৈরি করে।
2. **Docker/Coolify ডিপ্লয়মেন্টে (FA-004, FA-005)** কন্টিনিউয়াস Maildir ইনজেশন ওয়ার্কার, `ingest.ts` রানটাইম, Postfix/Dovecot ইনফ্রা, রিটেনশন ক্রন এবং কন্টেইনার-কম্প্যাটিবল আপডেটার নেই।
3. **রিটেনশন ও স্যান্ডবক্সিং (FA-003, FA-006)** মূল ইনবক্স সিকিউরিটি (parent DOM HTML injection) এবং ইউজার পলিসি-এনফোর্সমেন্ট (`resolveEffectiveUserPolicy` + `runRetentionPurge`) অসম্পূর্ণ অবস্থায় রেখেছে।
4. **সাইলেন্ট ডেমো ফলব্যাক ও অডিট অমিল (FA-002, FA-007, FA-009, FA-010)** প্রোডাকশন এরর, অডিট ট্রেইল ও Postfix কন্ট্র্যাক্টকে অসামঞ্জস্যপূর্ণ করে তুলেছে।
