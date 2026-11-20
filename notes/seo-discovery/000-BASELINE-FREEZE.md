# 000 — Baseline Freeze & Evidence Contract

**Recorded** 2026-11-20 Asia/Dhaka. **Authoritative Primary** `vibtoolshq/ReadBox` `main`. Inspected HEAD: `8e5b01b65c6f451dbbfabef64ca429687592e455`; exact tree: `e7507c251708917d4124c4059a51f0374c975207`; last commit `docs(vib-docs): configure dual-portal frozen-schema publishing`. This is an **immutable pre-SEO code snapshot**; future notes-only commits do not change it.

The PC user reported local `main` equal to Primary at `8e5b01b65c6f451dbbfabef64ca429687592e455` with clean tree and tracking `main...primary/main` 0/0. This is operator evidence, **not an independent machine inspection**. The Primary remote, not the personal `origin`, is authoritative. At audit the two dedicated backups (`JILLU-Games/ReadBox` and `MdNurnobi-Dev/ReadBox`, `backup/dns-final-primary-20261119`) both pointed to `3932906e5397584da3c062cd671725074c1523fa`, the parent of `8e5b01b65c6f451dbbfabef64ca429687592e455`; they were **not** at this frozen HEAD. Do not report 3/3 parity.

## Evidence categories
- **CONFIRMED SOURCE:** GitHub exact frozen file and line references.
- **OBSERVED LIVE:** Browserless HTML of `https://anyinbox.cc/` (2026-11-20) contained a server-rendered title `Any Inbox — A smarter way to manage your domains, mailboxes, and incoming email.`, description `AnyInbox simplifies custom-domain email management...`, canonical `https://anyinbox.cc/`, OG/Twitter text, JSON-LD Organization/WebApplication/FAQPage and favicon `/api/media/site-settings/favicon-66743f34d16d18b2.png`. Rendered H1: `Self-service custom-domain mailboxes and private team workspaces.`
- **NOT VERIFIED LIVE:** subsequent Browserless requests for `/robots.txt`, `/sitemap.xml` and a second fetch got 429. This does **not** prove search crawlers or public users are blocked; no production site or CDN diagnosis was performed.
- **NOT VERIFIED EXTERNALLY:** Google Search Console, Bing, AI citation/index status, robots behavior from multiple clients, Lighthouse, share-preview images, production admin save, actual JSON-LD validation.

## Frozen scope
This **documentation planning commit** may add only `notes/seo-discovery/*.md`. No `src/**`, `tests/**`, `prisma/**`, `.github/workflows/**`, existing notes, `reference/MailStack/**`, environment files, Docker, VPS, DNS, SMTP, secrets, Maildir, auth or DB edits. No tags/releases/push to other repository refs.

Full ReadBox production acceptance remains governed separately by `notes/001-PRODUCTION-RELEASE-BLOCKERS.md`, `notes/006-VERIFICATION-AND-RELEASE-GATES.md` and `AGENTS.md`. SEO readiness cannot resolve delivery, backup custody, legal signoff or 17 production gates.

**Before Phase-01:** compare then-current Primary HEAD against `8e5b01b65c6f451dbbfabef64ca429687592e455`; resolve only approved allowlist conflicts. Never silently update this historical freeze or treat plans as CI success.
