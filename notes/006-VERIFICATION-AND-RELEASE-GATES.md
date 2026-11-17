# 006 — Verification Gates, Regression Guardrails & Single-DB Contract

**Purpose:** প্রতিটি Phase ইমপ্লিমেন্টেশনের পর দ্রুত, নির্ভুল ও রিগ্রেশন-মুক্ত ভেরিফিকেশন নিশ্চিত করার স্ট্যান্ডার্ড চেকলিস্ট।

---

## 1. Per-Phase Mandatory Gate Commands (`package.json`)

প্রতিটি Phase শেষ করে `003-PHASE-PROGRESS-AND-CHANGE-LOG.md` আপডেট করার আগে নিচের কমান্ডগুলো পাস করতে হবে:

1. `npm run db:validate` — Prisma স্কিমা (`public` + `mailserver`) বৈধ কি না।
2. `npm run typecheck` — TypeScript (`tsc --noEmit` + `next typegen`) জিরো এরর।
3. `npm run lint` — ESLint & JSX Accessibility জিরো এরর।
4. `npm run test:unit` — সব ইউনিট ও কনট্র্যাক্ট টেস্ট (`compat`, `postfix`, `setup`, `auth`, `audit`, `admin`, `messages`, `target-guard`)।
5. `npm run test:ui` — Vitest কম্পোনেন্ট টেস্ট।
6. `npm run build` — প্রোডাকশন Next.js Standalone বিল্ড।
7. Phase 6-এ অতিরিক্ত: `docker compose config` এবং কন্টেইনার ইমেজ/এন্ট্রিপয়েন্ট যাচাই।

---

## 2. Database & Architecture Guardrails (Non-Negotiable)

- **Single PostgreSQL Policy:** কেবল একটি PostgreSQL ডাটাবেস (`prisma/schema.prisma`) ব্যবহার হবে। কোনো দ্বিতীয় ডাটাবেস (SQLite, MariaDB, MySQL বা Redis) যোগ করা যাবে না।
- **Maildir & Attachments:** আসল ইমেইল ও অ্যাটাচমেন্ট ফাইলসিস্টেম ডেটা হিসেবেই থাকবে; `maildirRelativePath` সর্বদা `domain/local/Maildir/` (শেষে `/` সহ) ও `mailserver.mailboxes`-এর সাথে সিঙ্ক থাকবে।
- **UI & Design Stability:** কোনো Phase-এ নির্ধারিত বাগ ফিক্স ছাড়া অপ্রাসঙ্গিক UI/Layout/CSS পরিবর্তন করা যাবে না।

---

## 3. Documentation Update Protocol After Every Phase

প্রতিটি Phase শেষ হওয়ার পর সাথে সাথে নিচের ৩টি ডকুমেন্ট আপডেট হবে:
1. `notes/003-PHASE-PROGRESS-AND-CHANGE-LOG.md` — সম্পন্ন Phase সংখ্যা (`1/6`..`6/6`), পরিবর্তিত ফাইলের তালিকা, স্কোপ লক কমপ্লায়েন্স ও টেস্ট রেজাল্ট।
2. `notes/005-ACTUAL-IMPLEMENTATION-TRACKER.md` — যুক্ত হওয়া নতুন কার্যকর ফিচার **(খ)** সেকশনে যোগ ও **(গ)** থেকে সরানো।
3. `notes/004-ERROR-HANDLING-INVENTORY.md` — সমাধানকৃত Error Handling আইটেম (`EH-01`..`EH-07`) মার্ক করা।
