# ReadBox R-06 final production release governance — NO-GO by default

**As of 2026-11-17, no live VPS, DNS, SMTP transport, backup restore or release has been authorized or operated during R-06.** The ReadBox project has 25/32 original findings CI-verified and 7 OPEN at the R-05 baseline. R-06 adds final automated regression/acceptance gates and manual governance; it does **not** confer release approval.

## CI workflow: non-publishing and isolated

[`.github/workflows/r06-production-readiness.yml`](../.github/workflows/r06-production-readiness.yml) is the final source GitHub Actions workflow. It runs on source branch/main push, main PRs or manual dispatch with **contents:read** only; no deploy credential, tag/push, package/image publication or release job. It performs:

1. npm clean install, Prisma validate, lint, typecheck, backend/unit/auth tests, 70 UI regression tests, Next.js build, current production dependency audit and new fail-closed R-06 release-gate negative tests.
2. Existing target-guarded `npm run test:postgres` against a unique, ephemeral PostgreSQL 16.14 Docker Compose test container, not production/corporate databases. Target must satisfy verified Docker labels, exact local port 55432, tmpfs PGDATA, unique 32-hex suffix DB and least-privilege test role.
3. Disposable Docker Compose production image building and loopback-only Postfix STARTTLS→Dovecot LMTP→Maildir integration with rejection cases from the R-03 smoke script. This runs with disposable self-signed certificate; **not Internet TLS trust**.
4. Separate disposable PostgreSQL and named-volume encrypted backup/restore including Maildir/attachment/queue/UID/GID/ACL and injected *post-DB-apply rollback* R-05 proof; never live data.
5. Strict paths/permission audit and final `R06_PRODUCTION_NO_GO` gate recorder; archives a **sanitized** status artifact with exact SHA and seven remaining original OPEN findings.

CI may prove image boot, PostgreSQL migrations, test-only SMTP/LMTP and encrypted restore **at its tested branch SHA**. This is narrower than actual release acceptance. A later release SHA must itself receive its own evidence, immutable production digest, source/target SHA equality and qualified legal/dependency review.

## Formal stage/evidence contract

The [17-gate runbook](PRODUCTION-ACCEPTANCE-RUNBOOK.md) maps RG-01–RG-17 to independently observed staging requirements. `scripts/testing/r06-release-gate.mjs` is an **offline, read-only** evidence checker.

- It requires the original 32 finding IDs, all 17 gate IDs, root MIT + historical reference AGPL/NOTICE separation and SHA-matched staging records.
- No live data submitted: `NO_GO` is expected, even when all CI jobs pass.
- Wrong SHA, missing/duplicate gates, unsafe URLs, fabricated future timestamps or missing observers fail closed.
- Even if all assertions say PASS, an OPEN original finding prevents a green gate. Hypothetical all-closed state becomes `MANUAL_RELEASE_REVIEW_REQUIRED`, never automatic production GO.
- An evidence JSON file is an untrusted claim. A named independent operator must corroborate it and receive **new explicit user approval** for release or deployment.

## Seven original release blockers remaining at R-05 baseline

`RB-P0-06` external accepted→inbox+attachments; `RB-P1-09` real trusted TLS/DNS/DKIM applicability; `RB-P1-10` public port-25/MX/PTR/provider checks; `RB-P1-16` production container and operational reboot/restore evidence; `RB-P2-01` old Nginx/template names; `RB-P2-07` offsite encrypted backup rotation/key custody and live recovery; `RB-P2-08` MIT vs AGPL reference distribution review.

**Scope exception:** Fixing `deployment/templates/nginx/**` is outside documented R-06 allowlist. No change to those templates is authorized here. If needed, request a separate narrowly approved exception; do not add a seventh speculative phase or mark the finding resolved.

## Real release procedure — NOT performed

Separate user authorization is required first for live VPS/staging and DNS/SMTP operations. Independently observe the staging tests and offsite restore, resolve original findings, approve immutable image digest, map exact source/mirror SHA/tree, obtain license/security review and a formal human production GO decision. A **second, separate explicit command** is required to create a tag, GitHub Release, public image or actual deploy. Until then: **NO-GO**.

ReadBox is inbound-only (no public SMTP submission, IMAP or POP3); R-06 cannot add those features, alter UI/UX, authentication, existing mailserver transport or migrations.


## NEXT-02 — authoritative Primary read-only R06 and host Nginx contract (2026-11-19)

- Current source of truth is `vibtoolshq/ReadBox` (not historical JILLU-Games).
- Historical R06 workflow had a JILLU-only job guard, so Primary runs were **SKIPPED**, not PASS. NEXT-02 binds the read-only R06 job to the Primary repository only. The first consolidated Primary run must be observed on the exact source/test SHA and must report `NO_GO` at the formal production gate.
- The workflow's combined shell comment had four literal backslash-n sequences that swallowed lint, lint-baseline and typecheck commands. NEXT-02 separates these as executable shell lines and adds one static/parsed Nginx contract test.
- Host-only template `deployment/templates/nginx/app.conf.tpl` replaces legacy upstream/cache/log identifiers consistently with ReadBox names. No proxy route, TLS version, access control or attachment path change is authorized. Before separately approved host deployment, an operator must ensure `/var/log/readbox` exists with suitable Nginx permissions. This source patch does **not** create that directory or reload Nginx on a VPS.
- Original application, one PostgreSQL, Prisma migrations, Postfix/Dovecot, DKIM/R2, live secrets, release workflow and release tags remain unchanged. Seven original release findings remain OPEN; `RB-P2-01` host correction is **source/CI-level only** until actual host evidence.
- This is source/CI implementation only. Even successful disposable Primary R06 **does not** authorize production deployment, automatic release, real DNS/R2 writes or make `RG-01..17` PASS.
