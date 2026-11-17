# 006 — Verification, Regression, Production Release & Rollback Gates

**Frozen baseline:** `e28886e5e0f7a155cd64e23bc8ee8f6668d6699c`. **Release status: NO-GO.** All future mail/VPS/restore gates are **NOT RUN** at freeze.

## Historic test evidence — do not confuse with production proof

| Gate | Historic result | GitHub Actions evidence | Does not prove |
|---|---|---|---|
| `npm ci` | PASS after FA-M01 lockfile correction | https://github.com/JILLU-Games/ReadBox/actions/runs/44080430558 | Docker runtime |
| `npm run db:validate` | PASS | Same run | live database migration |
| `npm run lint`, `npm run typecheck` | PASS | Same run | server security |
| `npm run test:unit` | 167 PASS | Same run | SMTP/LMTP delivery |
| `npm run test:ui` | 70 PASS | Same run | real inbound mail |
| `npm run build` | PASS | Same run | Docker image start |
| `npm run test:postgres` | NOT EXECUTED in that CI | Separate `package.json` script | live PostgreSQL |
| Production Docker image boot | NOT VERIFIED | no completed evidence in inspected runner | production readiness |

## Exactly one focused CI verification per approved phase

- **R-01:** production Compose selection, missing secret and password-URL negative cases, lockfile CI build, npm security audit and image provenance.
- **R-02:** disposable PostgreSQL migration replay, role/virtual map positive + negative SQL tests, Maildir delivery/app UID/ACL checks.
- **R-03:** disposable Postfix/Dovecot syntax, SMTP receipt and LMTP Maildir delivery, unknown recipient rejection, DNS/TLS contract.
- **R-04:** clean DB bootstrap, correct administrator identity check, unavailable/stale worker and failing DB/storage readiness, auth negatives, normal recovery.
- **R-05:** isolated backup/restore/rollback, data and ACL integrity, secrets handling, upgrades and downtime/availability evidence.
- **R-06:** consolidated source/mirror CI plus separately authorized live staging VPS acceptance, real DNS/port/TLS/SMTP/LMTP/mailbox, rollback and license/security review.

### Example checks, NOT executed in this documentation phase

```bash
npm ci
npm run db:validate
npm run lint
npm run typecheck
npm run test:unit
npm run test:ui
npm run build

# Explicit production file; do NOT use implicit compose.yaml development config.
docker compose -f docker-compose.yml config
docker compose -f docker-compose.yml build web worker

# Only with an isolated, disposable PostgreSQL test target:
npm run test:postgres
```

The target SHA, sanitized log, positive/negative result and command exit code must be recorded. A successful Compose parse is not proof of a running mailserver. Tests against production user data are forbidden.

## R-06 formal release GO gates

| Gate | Exact required evidence | Current |
|---|---|---|
| RG-01 | 32 audit IDs reconciled; zero open P0; all residual P1/P2 assessed | OPEN |
| RG-02 | Source and target same release SHA/tree; version and immutable image digest | NOT RUN |
| RG-03 | CI build, all tests, dependency audit at **actual release SHA** | NOT RUN |
| RG-04 | No dev Compose/default password; correct secure environment on chosen VPS/Coolify | NOT RUN |
| RG-05 | Running web/worker containers, fresh PostgreSQL migrations, persisted volumes and healthy restart | NOT RUN |
| RG-06 | Single PostgreSQL and actual Postfix SQL login + views, no unauthorized DB access | NOT RUN |
| RG-07 | Postfix TCP/25/SMTP and Dovecot LMTP routing work with canonical Maildir and UID/GID | NOT RUN |
| RG-08 | Actual public MX/A/AAAA/PTR + provider port 25 + host firewall checked externally | NOT RUN |
| RG-09 | Trusted web/mail TLS, certificate renewal and applicable DKIM operation | NOT RUN |
| RG-10 | External inbound mail accepted → Maildir original → worker indexed → inbox displayed → attachment accessible | NOT RUN |
| RG-11 | Unknown/disabled recipient rejection, MIME limits and no accepted-but-lost messages | NOT RUN |
| RG-12 | First-admin safe bootstrap, unauthorized route rejection and reset-token expiry | NOT RUN |
| RG-13 | Worker/DB/storage outages fail closed; recover without duplication or mail loss | NOT RUN |
| RG-14 | Backup confidentiality, restored DB/Maildir/attachments, hashes, ownership/ACL, rollback and downtime evidence | NOT RUN |
| RG-15 | Observability, logs/redaction, capacity, storage limits, alert/runbook and security checks | NOT RUN |
| RG-16 | MIT root vs AGPL reference license provenance and current advisories reviewed | NOT RUN |
| RG-17 | Final CI/job, live staging logs, release approver and explicit GO/NO-GO | NOT RUN |

**NO-GO triggers:** any open P0, broken secrets/migrations, SMTP/LMTP not working, no real DNS/port evidence, unsafe Maildir permissions, missed incoming mail, untested restore, false worker readiness or source-target mismatch. `NOT RUN` and `SKIPPED` never count as PASS. No production release unless all mandatory gates have objective evidence.

## Standard evidence and rollback records

```text
Gate ID / Phase / tested exact SHA:
Git tree and Docker image digest:
CI or staging environment (no raw credentials):
Test input incl. negative case:
Expected vs actual result:
Exit code/HTTP/SMTP reply and sanitized logs/artifact URL:
Maildir file ID and message/attachment integrity if applicable:
Reboot/restore/rollback and uptime result:
PASS / FAIL / SKIPPED / NOT RUN:
Author and timestamp:
```

Rollback contracts: no modifications to applied migrations; backup before changing data; retained original Maildir; only reversible image/config changes; retain database compatibility; no destructive release tests against production. A failed phase stays blocked—never silently release or auto-publish.

## R-01 completed focused release-foundation gate — 2026-11-17

- Full app regression (167 unit + 70 UI tests, typecheck/lint, Prisma validate, Next build): https://github.com/JILLU-Games/ReadBox/actions/runs/44092311120. Its final Docker smoke found the raw-percent credential encoding bug, so that whole workflow run is not labeled PASS.
- Final corrected Docker/Compose/runtime smoke, immutable base digest and moderate-level production npm audit: https://github.com/JILLU-Games/ReadBox/actions/runs/44093204590 — **SUCCESS**. Targeted Dockerfile and test correction only after app regression.
- Source code SHA: `113663cdabacf1460af5b06a334d99ab3db833c2`. R-01 finding outcomes: CI VERIFIED CLOSED; remaining R-02 to R-06 and external VPS SMTP/LMTP tests NOT RUN. Full mailserver **NO-GO**.

## R-02 focused database and Maildir CI — passed; formal release/phase gate remains blocked

- Code SHA `e1efdbd0b0380a94152947f7be47eb17c5c8d70c`; CI https://github.com/JILLU-Games/ReadBox/actions/runs/44099280332 **SUCCESS**. npm clean install, Prisma schema validation, TS, existing backend tests, new R-02 tests, production Compose topology validation and one disposable PostgreSQL 16 database.
- Positive: seven additive migrations applied once and second run no-op; dedicated Postfix login role SCRAM auth; virtual domain/mailbox/alias lookup; UID/GID delivery identity and strict Maildir permissions.
- Negative: unknown and disabled mailbox, deny password hash table field and public app users and writes, wrong UID/GID, missing/unfinished migration manifest fixture.
- Scope audit: **12 maintenance-branch changed paths** including temporary CI workflow; published code excludes the workflow. All executable code changes inside R-02 allowlist, no changed UI/auth/old migrations.
- **Not tested:** SMTP to LMTP, actual Dovecot mount, host mail routing and public port 25. `RB-P2-04` remains OPEN because `/health/ready` is unchanged; no production GO or formal R-02 CLOSED claim.

## R-02 final authorized readiness closure gate — 2026-11-17

- **Scope exception:** `RB-P2-04` only; `src/core/health/snapshot.ts` and two health-focused test files permitted, no unrelated runtime or UI changes.
- **Verified CI:** https://github.com/JILLU-Games/ReadBox/actions/runs/44102834169 — npm clean install, Prisma schema validation, TypeScript, 10/10 health tests, 3/3 existing R-02 tests, Next.js production build and exact allowed-path audit all PASS.
- **Previously verified:** https://github.com/JILLU-Games/ReadBox/actions/runs/44099280332 — disposable PostgreSQL migration repeat, positive/negative SQL lookups, least privilege and Maildir UID/GID checks.
- **Source code SHA:** `b6ab76119a31f9bf4e81b3990a5fcc6d802a6892`. **Result:** R-02 CI VERIFIED CLOSED; total complete phases **2/6**, remaining **4/6**. **Release status:** still NO-GO because production SMTP/LMTP, external DNS/TLS, VPS deployment and disaster recovery not verified.

## R-03 CI SMTP/LMTP acceptance — 2026-11-17

- **CI SUCCESS:** https://github.com/JILLU-Games/ReadBox/actions/runs/44107205810. Verified branch source patch SHA `d0f3272ea298de012da83c6f01b588fa0513d1da` (published main excludes temporary CI workflow). App Prisma validate, TypeScript, existing backend tests, new mailserver + DNS contracts passed. Disposable Docker PostgreSQL+web+worker+Postfix+Dovecot built and booted, SQL credential setup executed, Postfix/Dovecot configs linted; SMTP STARTTLS + accepted valid recipient → LMTP → persisted Maildir original. Unknown recipient and outside-domain relay rejected; startup without TLS certificate rejected; code diff audited against R-03 exact allowlist.
- **R-03 implementation:** CI VERIFIED CLOSED. Four owned findings resolved at CI contract level. Public/trusted TLS/DKIM applicability (`RB-P1-09`) and public port/DNS/VPS routing (`RB-P1-10`) **remain OPEN** for final R-06 live staging and legal provider authorization. CI's ephemeral self-signed cert and loopback SMTP are NOT public mailserver proof.
- **Still NOT RUN:** external MX/A/AAAA/PTR, real public TCP/25, provider firewall/IPv6, real trusted TLS cert renewal, SMTP queue recovery across outages, production backup/restore. All R-06 release gates still NO-GO until separately evidenced. Phase count **3/6**, findings CI verified **15/32**, **17 OPEN**.
