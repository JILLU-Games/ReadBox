# 006 — Verification, Regression, Production Release & Rollback Gates

> **LATEST MANUAL MODE VERIFICATION SCOPE (2026-11-19):** One-source-only feature Phase-01 focused UI/export/typecheck and exact diff audit is planned, **NOT RUN**. Three prior domains' operator Gmail successes do not need repetition for this checkbox and do not close all 17 independent production gates. [manual-mode/006](manual-mode/006-VERIFICATION-AND-ACCEPTANCE-GATES.md). Preserve all existing RG-01..RG-17 table definitions, original seven OPEN and release NO-GO.


> **LATEST AUTHORITATIVE RECONCILIATION — 2026-11-19.** **Source freeze (2026-11-19 Asia/Dhaka):** authoritative `vibtoolshq/ReadBox/main` 6f3bc1e3aeb441956e1fd0f4d81558a6aba2945f; tree `f82b07b6e0770850edd3431f041d5162848d442a`. Last full disposable Primary R06 CI ran against executable code 4d0b124af57c8d407bf609540b8b8b7a69a479b5: [run #44509947742](https://github.com/vibtoolshq/ReadBox/actions/runs/44509947742), SUCCESS. Compare 4d0b124af57c8d407bf609540b8b8b7a69a479b5..6f3bc1e3aeb441956e1fd0f4d81558a6aba2945f: **one documentation-only commit changing notes/003–006**, no executable change. At freeze time both dedicated backup refs `backup/dns-final-primary-20261119` matched 6f3bc1e3aeb441956e1fd0f4d81558a6aba2945f (2/2); backup repositories' separate `main` branches did not. **This new notes-only commit will advance Primary HEAD beyond the freeze; do not claim backup parity at that new HEAD without a new remote readback.** Historical source snapshots below are preserved and must not be mistaken for current source. Production remains **NO-GO**: 32 original findings, 25 CI-contract verified and 7 OPEN; 17 independently accepted production gates not evidenced. Historical R-01–R-06: 6/6 CI implemented. NEXT-01 and NEXT-02: 2/4 completed; NEXT-03 and NEXT-04: 2/4 pending. Detailed, immutable code excerpts and line links: [017](017-CURRENT-FORENSIC-PATCH-REFERENCES-2026-11-19.md); executable step/closure contract: [018](018-PHASE-EXECUTION-AND-CLOSURE-TEMPLATE.md). Earlier dated statements are retained as history, not latest status.


> **CURRENT RELEASE GATE — 2026-11-19:** Primary `vibtoolshq/ReadBox/main` source SHA `3dfac11f46165c262c3dc5ddb7e82563a56f9a7f`. Source DNS-FINAL CI at Primary SHA **SUCCESS**, but Primary full R06 **SKIPPED** because repository-specific job condition is wrong. [notes/016](016-LIVE-INBOUND-DEPLOYMENT-ACCEPTANCE.md) has limited operator-observed live evidence; no independent complete 17-gate sign-off. **Seven original findings OPEN, formal release NO-GO**. Historical gate definitions below are preserved unmodified; see dated per-gate current evidence at end.


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

## R-04 first-admin, heartbeat and fail-closed app health gate (2026-11-17)

- **Focused CI SUCCESS:** https://github.com/JILLU-Games/ReadBox/actions/runs/44112634511. Source code SHA `88e57e2e81dc07a8f91b07f448df85e51d58e429`. One clean disposable PostgreSQL 16 with Prisma migrations; `admin_accounts` created exactly once with forced-reset token, duplicate rejected, no user/admin-profile created, setup inspector verified the same table.
- Prisma validate, TypeScript, existing full backend unit tests and **70/70 UI tests**, Next build, health/error negative tests, recovery, worker process/readiness contract and strict allowed-path audit PASS.
- **Negative cases:** CLI guard rejects noninteractive/incorrect Docker auth or PostgreSQL targets, duplicate bootstrap rejects without data loss, missing/stale/future/degraded/failed worker heartbeat, unavailable DB, missing/symlink/unreadable Maildir and recovery; returned health is `not_ready`, not green.
- **Separation:** web Docker healthcheck remains `/health/live` (needed before worker startup); worker healthcheck tests `/health/ready`; response says app only, SMTP/LMTP not checked. Do not promote green web liveness to mailserver GO.
- **Excluded:** production operator TTY invocation on a real VPS, SMTP/LMTP external connectivity, actual retention recovery, backups, public TLS/port 25/DNS, release/tag. R-04 six CI contract findings closed, total **4/6 phases**, **21/32 CI verified**, **11 OPEN**. Full production still **NO-GO**.

## R-05 disposable encrypted backup/restore/rollback + host safety gates — 2026-11-17

- **GitHub Actions SUCCESS:** https://github.com/JILLU-Games/ReadBox/actions/runs/44121121316. Tested maintenance-branch SHA `fe25bcd5cdf9dfa3b3ee288c53cc3624197fe82e` (includes one-time CI workflow); published source code SHA `a55ec82bb2f58804e910427c66ff6352cd5c14c6` excludes the temporary workflow. Prisma validation, TypeScript, backend unit tests, UI **70/70**, Next.js production build, Bash/Python syntax, update/host contract tests, and exact **14-path** maintenance Scope Lock audit passed.
- **Real disposable CI scope (NOT a VPS):** PostgreSQL 16 in Docker Compose with public + mailserver schemas and dummy web/worker/Postfix/Dovecot process containers mounting named volumes; encrypted age X25519 private-key recovery; no configuration/credential export, 0600 artifact mode, SHA-256 manifest, Maildir/attachment/media/queue parity, numeric UID/GID 1001, a real POSIX ACL. In a mandatory downtime window active writers stopped and only previously running services restarted.
- **Recovery failure proof:** `R05_PROVEN_POST_DATABASE_APPLY_AUTOMATIC_ROLLBACK_PASS` confirms the forced failure was injected after a successful PostgreSQL restore and the automatic rollback succeeded. Verified DB + Maildir restored to the **pre-failed-restore state**; deliberately modified ciphertext was rejected with zero DB mutation. This proves a scoped disposable rollback case, **not** arbitrary disk failure or host power-loss recovery.
- **Host/static only:** systemd templates and host backup/restore/upgrader syntax plus confidentiality/ownership contract, not a live host upgrade or SMTP maintenance. No actual offsite encryption rotation, retention, backup transport, private-key escrow or VPS disaster recovery; no DNS/TLS/public SMTP. Open finding `RB-P2-01` (legacy Nginx outside allowlist), `RB-P2-07` (offsite/key/host live acceptance) remain. Next R-06 requires external tests and any necessary explicit scope exceptions.
- **Updated project:** 5/6 implementation phases CI CLOSED, 25 original findings CI verified, 7 OPEN; production release **NO-GO**.

## R-06 consolidated source CI and formal production NO-GO (2026-11-17)

- **Focused CI SUCCESS:** https://github.com/JILLU-Games/ReadBox/actions/runs/44127481624; source implementation SHA `807ca9f38adb02db2a8b73dc0901fce23ee5e63a`. The branch test passed clean npm/Prisma validation, all existing backend/auth & **70/70 UI** tests, Next.js production build, **production npm dependency audit**, allowed-code lint, guarded ephemeral PostgreSQL 16.14 migration/auth integration, disposable production web/worker/Postfix/Dovecot Docker build and true test STARTTLS→private LMTP→Maildir plus unknown/nonlocal relay rejections, age encrypted named-volume backup/restore/queue and UID/GID/ACL parity, forced post-DB-apply rollback and encrypted tamper rejection, 17-gate/license provenance negatives and exact 11-file changed-path audit.
- **Intentionally NOT a passing complete RG-03/full-tree lint:** two pre-existing unused catch-binding ESLint errors remain at `src/core/setup/trusted-operations.ts:366,386`. The R-06 job excludes only that unchanged source file from overall lint and separately fails if its documented two violations change or new errors arise. Do not count all-source lint as clean or waive these without separate scope approval.
- **Machine decision:** `R06_17_GATE_RECONCILIATION_PASS`, `R06_LICENSE_PROVENANCE_CONTRACT_PASS`, `R06_FINDINGS_OPEN=7`, `R06_LIVE_GATE_PASS_CLAIMS=0/17`, **`R06_PRODUCTION_NO_GO`**. R-06 workflow is read-only with no release/deploy/tag/publish permissions. The sanitised report is a **CI evidence artifact** and is not external staging proof.
- **RG-01–RG-17 formal release gates** remain NOT RUN / OPEN as independent live production acceptance; CI-only subsystems are evidence for narrow components, never for external DNS/TLS/public 25, real inbox attachment integrity, staging reboot/outage, offsite retention/restore or human legal/security review. `RB-P0-06`, `RB-P1-16`, `RB-P2-08` R-06 originals stay OPEN; overall 7/32 original OPEN. No staging authorization existed, thus final R-06 *full* release exit gate has **NOT** been satisfied although code/governance implementation is verified.
- **Implementation status:** 6/6 phases code/CI implementation done; **production release NO-GO**. Separate user approval is required for any live staging network/mail/VPS action and a separate later approval for tag/release. Legacy Nginx path and old lint source changes cannot be silently performed under R-06 Scope Lock.

## QIS-01 optional self-hosted onboarding verification (2026-11-17)

- **Successful GitHub CI:** https://github.com/JILLU-Games/ReadBox/actions/runs/44139227363, code SHA `2833f1f1e1be76d501cdd3fa2210d0c1084d9b47`. Exact 16-file approved Scope Lock and final `QIS01_RELEASE_REMAINS_NO_GO_PASS` markers. QIS-01 is an additive installer/onboarding patch, NOT completion of any open R-06 live acceptance gate.
- **Automated tests performed in disposable CI:** npm clean install/Prisma validation, source lint excluding **exactly the 2 pre-existing R-04 errors** with strict baseline assertion, TS typecheck, full existing backend/auth/unit regression, new React UI onboarding tests, Next.js production build, shell script syntax and source contract, real PostgreSQL 16 ephemeral migration and **concurrent admin-once with existing password reset**. Installer generated private 0600 `.env`, persisted only the activation hash/expiry, rerun preserved the exact bytes, and booted real disposable Compose PostgreSQL/web/worker and private SQL role. No plaintext code was uploaded as artifact.
- **Negative checks:** invalid activation code, wrong host/origin, non-HTTPS, expired or too-future token, disabled auth/non-Compose context, concurrent admin attempts and reset replay. No new second admin; existing auth/migrations/worker/mailserver unchanged. Existing `scripts/install/readbox-update.sh` contains fail-closed backup and history validation, but its **full update/rollback runtime remains untested** on a live VPS.
- **Formal external gates:** `RG-01` through `RG-17` still not accepted as independent live staging evidence. The original `RB-P0-06, RB-P1-09, RB-P1-10, RB-P1-16, RB-P2-01, RB-P2-07, RB-P2-08` remain OPEN. HTTPS reverse proxy, cert, public DNS, inbound TCP/25, real email delivery, offsite recovery and release require new separate approval. **PRODUCTION NO-GO.**

## R-06/QIS-01 CI compatibility verification — 2026-11-18

- **Successful focused CI (source):** https://github.com/JILLU-Games/ReadBox/actions/runs/44147873597; tested executable SHA `c27b30f587f37bc590a483e0bea263f2ac08d0e7`; all job steps SUCCESS, with no tag/release/deploy permission.
- **Prior failure confirmed:** https://github.com/JILLU-Games/ReadBox/actions/runs/44140465798 at `4467636a1300fd45b85b35cf556fdb106faa0ec9`; exact-scope checker used `R05..HEAD` after authorized QIS-01 patch. Full app/integration/recovery steps had succeeded; failure was a historical CI range mismatch.
- **Separated immutable Git range proofs:** `c3f9dd4..807ca9f` exact 11 R-06 implementation files; `807ca9f..fa774bd` exact 8 R-06 closure files; `fa774bd..2833f1f` exact 16 QIS-01 files; `2833f1f..4467636` exact 3 QIS-01 closure files. CI enforces full SHAs, ancestry, exact sets and whitespace audit, not a cross-phase moving HEAD allowlist.
- **Observed CI markers:** `R06_HISTORICAL_IMPLEMENTATION_SCOPE_PASS 11`; `R06_HISTORICAL_NOTES_SCOPE_PASS 8`; `QIS01_APPROVED_IMPLEMENTATION_SCOPE_PASS 16`; `QIS01_APPROVED_NOTES_SCOPE_PASS 3`; `R06_QIS01_IMMUTABLE_SCOPE_AUDITS_PASS`; `R06_PRODUCTION_NO_GO`; `R06_FINDINGS_OPEN=7`; `R06_LIVE_GATE_PASS_CLAIMS=0/17`; `R06_ALL_CI_CONTRACTS_PASS_PRODUCTION_NO_GO`.
- **Audit and boundaries:** Code change only `.github/workflows/r06-production-readiness.yml`; closure notes limited to 003 and 006. Existing source/UI/auth/migrations/mailserver/install/update code and old R-04 exact two-lint-error baseline unchanged. No real staging/production VPS, trusted public TLS/DNS, Internet TCP/25, inbox attachment delivery, offsite restoration, license signoff, Git tag or release. Original **7 findings OPEN**, formal **0/17 live gates PASS**, **PRODUCTION NO-GO**. Source/mirror exact closeout SHA must be compared after fast-forward.

## DKIM-01 — Source, CI and live deployment gates (2026-11-18)

| Gate | Result / evidence |
|---|---|
| Frozen main source/mirror/local SHA | `ea14efa5b5571b0ed1e00e211e07a7862f2b6a0f` at entry |
| Candidate source/mirror tree equality | `3f6dc44bc96a0fa595fba0362012e5214a7b53fe` PASS |
| Exact approved implementation patch | **13/13 approved paths**, no Prisma/SMTP/auth/backup/updater source changes |
| DKIM unit/mocked Cloudflare/zone-export tests | **6/6 PASS** (no real provider calls) |
| One final corrected disposable R06 run | [#44273197408](https://github.com/JILLU-Games/ReadBox/actions/runs/44273197408) **SUCCESS** |
| Default app/UI/build, dependency audit, database and SMTP/LMTP | PASS in R06 |
| Encrypted recovery/rollback and historic immutable release NO-GO | PASS in R06 |
| Opt-in isolated DKIM image build/embedded Python tests | **NOT RUN by default R06**; mandatory isolated check before VPS activation |
| Production secret/volume ownership and encrypted private key escrow | **NOT RUN / NOT COVERED** |
| Real Cloudflare DNS create/verification | **NOT RUN**; requires distinct operator approval |
| Production outbound signing | NOT IMPLEMENTED; inbound-only preserved |
| Release tag/v1.0.0 production GO | **NO-GO** (historical 17 live acceptance gates remain separate) |

CI candidate was amended only after focused failures: default create-domain payload, TypeScript test extensions, and default Compose service count. Only the final corrected candidate is counted as PASS. Final notes-only closure does not itself exercise live agent behavior. Verify source, mirror and local final main SHA/tree non-force before phase close.

## DKIM-02/FIX-01 — Source acceptance and rollout boundary (2026-11-18)

| Gate | Evidence | Result |
|---|---|---|
| Frozen source/mirror/local main | `69b7f4c91100dd30c83ab56b24c29a4a0a9384b1` | PASS at entry |
| Code Scope Lock | only `deployment/dkim/agent.py`, `deployment/dkim/test_agent.py` | PASS |
| Candidate source/mirror exact tree | `c973d0db780939a5049d2366540b81e5f589738d` | PASS |
| Focused R06 read-only app/UI/security/SMTP/recovery CI | [Run #44280725129](https://github.com/JILLU-Games/ReadBox/actions/runs/44280725129) mirror `5820255216293a7ad54b2ffe6e43c7dda8d62e37` | **SUCCESS** |
| True disposable opt-in DKIM Docker image build | operator's exact candidate SHA/tree checkout, Alpine OpenSSL 3.5.9-r0 | **PASS** |
| Embedded Python regression | `Ran 6 tests`, `OK`, `DKIM02_FIX01_DISPOSABLE_BUILD_PASS` | **PASS** |
| Key protection / 1024-bit rejection / public conflicts | disposable tests | PASS |
| Notes closure exact approved scope | `notes/003–007` only | PREPARED |
| Final source/mirror/local main SHA/tree equality | verify after non-force publication | PENDING FINAL REF CHECK |
| Live source deployment + new host image build | separate Admin Panel approval/action | **NOT RUN** |
| Private-key escrow / key provision / real Cloudflare DNS | outside FIX-01 | **NOT RUN** |
| Stable production release `v1.0.0` | formal R06 governance | **NO-GO** |

The isolated image build was carried out in a temporary checkout on the VPS host; it did not update `/opt/readbox`, start the DKIM service or create a real domain key. Build-only verification must not be represented as live DNS/signing evidence.

## DKIM-02/FIX-02 — Focused verification and phase gates (2026-11-18)

| Gate | Evidence | Result |
|---|---|---|
| Frozen main baseline | `ebb2e2bddd0ef26671b283a4f71bc4d35bb32dbd` source/mirror/local | PASS |
| Exact code Scope Lock | only `deployment/dkim/Dockerfile` changed | PASS |
| Source/mirror code tree | `d34e6b539e7ba3aae3a2f03f8046a5f2821dcfcf` | PASS |
| Single disposable no-cache Docker build | temporary exact SHA checkout, `docker build --no-cache --progress=plain` | **PASS** |
| Embedded Python tests | `Ran 6 tests`, `OK` | **6/6 PASS** |
| Non-root UID1001 readable/compile smoke | final image `RUN python3 -B -c ... compile(p.read_bytes(), ...)` stage `[6/6]` | **PASS** |
| Explicit disposable completion marker | `DKIM02_FIX02_NONROOT_BUILD_PASS` | **PASS** |
| Documentation Scope Lock | only `notes/003–007` after code patch | PREPARED |
| Git main source/mirror/local sync | verify exact SHA/tree after non-force promotion | PENDING FINAL REF CHECK |
| Live VPS updated image and container healthy | separate approved Admin Panel rollout | **NOT RUN** |
| Production DKIM keys, encrypted escrow/recovery and DNS publication | excluded | **NOT RUN** |
| Tags, releases, stable production readiness | excluded; existing production release NO-GO | **NO ACTION** |

Build-only PASS does not establish a running healthy provisioner or recovered private keys. Stopped unhealthy provisioner was not restarted in this FIX-02 source phase.


## DKIM-03 — Focused CI and source-gate record (2026-11-18)

| Gate | Evidence | Result |
|---|---|---|
| Frozen source/mirror/local main | `d2faedcebd302f488c515daba57441f59ff3a687` | PASS |
| Candidate identical code tree | `4cccc52ea7d92bdaf4a06b27fc15a8039aae8036` | PASS |
| GitHub original focused CI | [#44293943849](https://github.com/JILLU-Games/ReadBox/actions/runs/44293943849) | FAIL: receipt Python SyntaxError |
| Minimal one-file repair | corrected receipt `try`/mode under umask 077 | APPLIED |
| One necessary focused CI recheck | [#44294483799](https://github.com/JILLU-Games/ReadBox/actions/runs/44294483799) exact tested mirror `bac871825fee87dda6a3bf74915832bee6ca4c5a` | **SUCCESS** |
| Disposable real age + mocked immutable R2 cases | wrong identity, tamper, lost ACK, interruption, conflict, idempotency, complete original-volume loss | **11/11 PASS** |
| Agent Docker RSA/receipt/public conflict tests | fresh Docker build + no-root read smoke | **8/8 PASS** |
| Exact production Scope Lock | seven approved code/doc paths plus `notes/003–007` | PASS at tested candidate; audit final notes diff at closure |
| Final Git main parity and clean local | verify non-force exact SHA/tree | PENDING final ref check |
| Real production R2, private identity escrow and host-loss verification | separate operator approval/host proof | **NOT RUN** |
| Live DKIM key generation, TXT DNS, VPS deployment | explicitly excluded | **NOT RUN** |
| Tag, stable release, production GO | excluded | **NO-GO** |

No second optional CI loop: after the syntax defect, only the necessary single focused recheck was performed. Notes-only closure does not create runtime proof. Fail closed on an unsupported R2 conditional PUT or missing independent identity custody.


## DOMAIN-AUTO-01 — focused source gates

| Gate | State |
|---|---|
| Frozen baseline `952516a2cac27649824bf14329f511eae6ae9294` | verified before changes |
| Scope/path security audit | PASS — source CI, exact 17 changed paths |
| TypeScript/Next compile | PASS — source CI |
| Mocked multi-zone Cloudflare DNS, conflict, idempotency negative tests | PASS — Node 14/14 including existing DKIM suite |
| Narrow host-agent escrow Python tests | PASS — Python 3/3 |
| Source/mirror/local exact SHA parity | BLOCKED — mirror missing commit object; Windows Git HTTPS unavailable |
| Real Cloudflare token, R2 escrow from new domain, DNS propagation | NOT RUN — production forbidden |
| VPS deploy, production secrets, tag/release | NOT RUN — explicitly excluded |

CI workflow: `.github/workflows/domain-auto01-ci.yml` (disposable, source-only; mirror is read-only pending exact Git object transfer).
Production DKIM signer/outbound SMTP remains inactive. No new domain shall be
declared ready until its own MX/mail-host routing verification succeeds.
- **Local evidence:** `prisma generate` completed for temporary checkout only; `npm run typecheck` PASS; mocked Node suite 14 PASS / 0 FAIL. The initial local typecheck failed because `@prisma/client` was not generated. Python host-broker tests and source CI were pending at local recheck; see the verified CI SUCCESS evidence below.

- **Focused disposable CI:** [source run #44345525274](https://github.com/vibtoolshq/ReadBox/actions/runs/44345525274) SUCCESS on `f7b5d7a97aa24274c70f74891e2adf39f2b17bad`. Exact Scope Lock 17/17 PASS; TypeScript typecheck PASS; mocked Node tests 14/14 PASS; host broker Python tests 3/3 PASS; no environment secrets, DNS writes, VPS deployment or release. **One CI run.**
- **Synchronization blocker:** mirror JILLU-Games/ReadBox refuses source commit SHA as missing object (GitHub API 422/UNPROCESSABLE); Windows git HTTPS unreachable. Mirror main remains `952516a2cac27649824bf14329f511eae6ae9294` — no divergent commit or force-push. Source/mirror/local exact SHA parity is **BLOCKED**, not PASS. Live deployment remains NO-GO.


## DNS-FINAL — primary candidate verification boundary

- Frozen primary baseline `46936f7fa9c2fac2d254501ce955fab7c6b476a5`. Source candidate `JILLU-Games/ReadBox` `1fc33bed704569843a689e22f123a8560af3b049`. DNS-only patch exact allowlist: 12 source/test/doc paths, one existing `.github/workflows/domain-auto01-ci.yml`, notes/003–006; **no merge of unrelated candidate changes**.
- A single disposable `ci/dns-final-primary` Linux CI must validate typecheck, Node DNS/DKIM/domain regression, zone UI, Python bridge, production npm audit, and exact changed path/security audit. No test PASS assertion before verified run URL/head SHA.
- Formal ReadBox full-production release and live DNS acceptance remain **NO-GO** until a separately approved real Cloudflare/DNS/R2/VPS test. Exact same Git SHA source/backup synchronization is required where fast-forward and object transfer are safe; otherwise record BLOCKED, never force-push.


- **DNS-FINAL primary source CI PASS:** exact tested branch commit `2eccd8f21cf71261fdc0e0b7ab6199a2a19de4ce`, [GitHub Actions run #44383278082](https://github.com/vibtoolshq/ReadBox/actions/runs/44383278082) success. Marker `DNS_FINAL_PRIMARY_EXACT_SCOPE_PASS 17`, `DNS_FINAL_PRIMARY_DISPOSABLE_PASS`; Node 25/25, zone/domain UI 2/2 test files, Python DKIM host bridge PASS, TS PASS, npm production audit 0 vulnerabilities. Source and broker values remain mocked/isolated.
- Final notes-only closure changes no verified application files. Exact primary `main` and backup ref parity requires authoritative post-update SHA readback; report blockers accurately, never rewrite divergent main history.
- Live Cloudflare DNS, external R2, registrar nameserver delegation, public MX/TLS/VPS mail routing, legal/stable production GO: **NOT TESTED / NOT AUTHORIZED**. Original R06 formal production NO-GO and seven external findings remain independently open.

---

## Current Primary release gate reconciliation (2026-11-19; no new live test executed)

**Separate evidence levels:** `DISPOSABLE-CI` tests isolated substitutes, `OPERATOR-PARTIAL` is the explicitly recorded Nov 18 VPS snapshot, `INDEPENDENT-ACCEPTED` needs human source/host/recipient checks and signed evidence at target SHA. **None of the 17 gates has been newly certified INDEPENDENT-ACCEPTED in this documentation phase.**

| Historical gate | Observed evidence from current audit | Formal acceptance now / required next |
|---|---|---|
| **RG-01** | 32 original records retained, 25 CI-verified and 7 OPEN | **NO-GO** until original open blockers reconciled |
| **RG-02** | Primary code SHA frozen, two backup main SHA differ, both exact-SHA backup branches absent | **BLOCKED**: exact release source/backup refs and eventual image digest |
| **RG-03** | Primary DNS-only CI [#44384108878](https://github.com/vibtoolshq/ReadBox/actions/runs/44384108878) PASS; primary consolidated R06 [#44384109011](https://github.com/vibtoolshq/ReadBox/actions/runs/44384109011) SKIPPED; historical JILLU CI [#44374235430](https://github.com/JILLU-Games/ReadBox/actions/runs/44374235430) PASS at different SHA | **NOT VERIFIED at Primary full-release SHA** |
| **RG-04** | QIS-01 source and disposable secret-negative tests; operator app presence in [016](016-LIVE-INBOUND-DEPLOYMENT-ACCEPTANCE.md) | **PARTIAL**; authorized VPS secure configuration/volumes evidence needed |
| **RG-05** | Disposable Docker boot/migration CI; operator five containers healthy snapshot | **PARTIAL**; current staging SHA, actual restart/volumes/migrations required |
| **RG-06** | Disposable PostgreSQL role/virtual lookup tests | **NOT independently accepted**: current host lookup/permission evidence |
| **RG-07** | CI SMTP->LMTP->Maildir; one operator STARTTLS/public-25 snapshot | **PARTIAL**; external mail path/UID/ACL independent check |
| **RG-08** | Operator VPS-side TCP/25, no independent registrar/provider/MX/PTR/IPv6 review | **PARTIAL**; separate external public DNS/port checks |
| **RG-09** | DNS-FINAL sources/mock CI and operator STARTTLS, no trusted certificate lifecycle evidence | **NOT accepted**: hostname/cert chain/renewal, applicable DKIM |
| **RG-10** | [016](016-LIVE-INBOUND-DEPLOYMENT-ACCEPTANCE.md) records one Gmail subject/body/date in authenticated inbox | **PARTIAL**; independent mail trace and attachment hash |
| **RG-11** | Operator nonlocal RCPT 554/unknown local 550, CI negatives | **PARTIAL**; disabled recipient, MIME/size limits, no mail loss |
| **RG-12** | R-04/QIS-01 admin/auth/reset disposable CI | **NOT independently accepted** for chosen VPS/current SHA |
| **RG-13** | Worker/DB/storage fail-closed CI contracts | **NOT RUN live outage+recovery** |
| **RG-14** | Operator checksum-confirmed local GPG archive, disposable age encrypted restore/rollback CI | **NOT accepted**: independent offsite age/R2/restore/ACL rollback drill |
| **RG-15** | Existing logging/health source code | **NOT verified**: capacity, private log/redaction, alert/runbook on staging |
| **RG-16** | Root MIT, historical MailStack AGPL/NOTICE; production npm audit 0 vulnerabilities at DNS-only tested SHA | **NO-GO**: qualified provenance/signing/artifact and current broader dependency review |
| **RG-17** | Prior R06 formal `NO_GO` contract test; user has not approved release | **NO-GO** pending all gates, independent operator and explicit approver |

**Counts:** historical gate definitions **17/17 present**, fully independent release accepted **0/17**, 7 original findings still OPEN. Some sub-steps were operator-observed but are **not automatically zero evidence** and **not full gate PASS**. This distinction corrects the broad old snapshot language without retroactively changing historical results.

### Technical current source / CI evidence chain

- Inspected Primary SHA `3dfac11f46165c262c3dc5ddb7e82563a56f9a7f`, tree `7a07c6d03588096f88d4aad1b1317f0aa3302bcf`; exactly 4 notes files differ from DNS executable source test `2eccd8f21cf71261fdc0e0b7ab6199a2a19de4ce`.
- Primary DNS isolated [#44384108878](https://github.com/vibtoolshq/ReadBox/actions/runs/44384108878) SUCCESS at inspected SHA: Node 25/25 DNS/domain contracts, 2 UI test files, Python host bridge, TS and production npm audit 0 vulnerabilities. No Cloudflare/R2 credentials or live DNS publisher used.
- Full R06 software rehearsal [JILLU #44374235430](https://github.com/JILLU-Games/ReadBox/actions/runs/44374235430) SUCCESS at JILLU candidate `ff614db384f77a218d7916a726b298f27a068ae5`, **not** Primary head; Primary R06 [#44384109011](https://github.com/vibtoolshq/ReadBox/actions/runs/44384109011) SKIPPED because `github.repository` is checked against JILLU.
- Operator [016](016-LIVE-INBOUND-DEPLOYMENT-ACCEPTANCE.md) evidence refers to historical deployed `0849bc8d4f4b703800ba73f157f16d5a742ee6e7` and does not show the current DNS-FINAL source deployed/operational at `3dfac11...`.
- Primary/backups remain divergent: JILLU main `952516a2...`, MdNurnobi-Dev `511a773...`; no exact-SHA backup branches; do not claim source-mirror parity.
- Historic JILLU `v0.1.0-rc.1` tag `0e8a19e583719e56c054406581bedcf5599f1ace` is **not** a new stable release, and must remain untouched without separate approval.

### NEXT-01–NEXT-04 focused acceptance matrix

| Next package | Single verification boundary | GO/NO-GO exit |
|---|---|---|
| **NEXT-01** exact-SHA backup/provenance inventory | Exact Git ref readback (both backup branches) and no main/release mutation; independent license review inventory | 2/2 same SHA or BLOCKED, legal sign-off separate |
| **NEXT-02** Primary R06/Nginx source-only correction | One bounded Primary read-only R06 CI, fixture/host Nginx parser check, permissions + formal NO-GO check | PASS only if job actually executes and scoped patch passes |
| **NEXT-03** one named test zone DNS/R2/TLS | Real Cloudflare active-zone conflict/readback, immutable DKIM encrypted R2 receipt, public resolver/port/TLS evidence, idempotent negative retry | PASS by domain or blocked; never blanket GO |
| **NEXT-04** full staging mail/recovery | One approved external sender->Postfix->LMTP->Maildir->inbox/attachment test, rejects, outage, independent offsite restore/key custody, 17 human gates | Only 17 accepted and resolved findings -> MANUAL_RELEASE_REVIEW_REQUIRED |

### Hard release safety, rollback and status rule

- **Do not perform** VPS SSH/config, public DNS/R2 write, SMTP send, production database restore, Git tag/release/image publish without a named operator and a **new explicit approval** for exact environment and scope.
- Preserve original DB migrations, Maildir, backups, DKIM private keys and R2 objects. On failed deploy/test, retain encrypted rollback and original config; no silent public mail exposure, secret logging or destructive DNS overwrite.
- A documentation-only commit does not reproduce CI at its new SHA. Record the immutable **inspected source** SHA and later documentation HEAD separately; read-only manual status check may be made but must not be called CI if not executed.
- If any phase is FAIL/BLOCKED, stop, log evidence and give the next narrow approval command. No repeated verification loops, extra speculative phases, force-push, or automatic release.

---

## NEXT-02 CI Gate — BLOCKED (2026-11-19)

| Exact run/evidence | Result |
|---|---|
| Frozen Primary main | `1393c48fdc821756213e9c0ca87dd166ee3f6b75`, unchanged |
| First candidate | `a3ce6ac1f2e7621e6a97b894917b535b5f24ac62`, [R06 #44505642726](https://github.com/vibtoolshq/ReadBox/actions/runs/44505642726) **FAIL**: 4 ESLint errors |
| Narrow in-scope R06 test regex repair | `3adff246beec44c685d8885875a9d94f41dece4a` |
| One necessary focused recheck | [R06 #44505932658](https://github.com/vibtoolshq/ReadBox/actions/runs/44505932658) **FAIL**: 2 out-of-scope lint errors |
| Passed before failure | Checkout, npm clean install, Prisma schema validation |
| Executed and failed | ESLint: `src/components/vcon/domain-form.tsx:185:5` React setState-in-effect; `tests/integration/admin-system-update.test.mjs:94:25` no-regex-spaces |
| NOT RUN in current candidate CI | Typecheck, new Nginx contract tests, unit/UI, Docker image, disposable PostgreSQL, SMTP/LMTP, encrypted restore, R06 final `NO_GO` assertion |
| Source/mirror ref promotion | **WITHHELD**: no main/backup update on FAIL; only isolated draft PR candidate |
| Release disposition | **NO-GO** unchanged; all original 7 OPEN, none of RG-01..17 newly independently accepted |

Do not bypass ESLint or edit unapproved files. Separate explicit approval needed for precisely the two offending files, minimal behavior-preserving fix and one focused recheck. Only after successful CI and exact patch/security audit may non-force Primary main and two dedicated backup branches be synchronized. No VPS, DNS/R2, live SMTP, tag/release or production restore.

---

## NEXT-02 / BLOCKER-LINT-01 recheck and new R06 CI guard blocker (2026-11-19)

| Gate | Actual verified |
|---|---|
| Isolated user-approved two-file lint fix | `7ed2997d110ed30a6ec5dd901eff67bce1904c5f` |
| Focused Primary PR R06 | [#44507511633](https://github.com/vibtoolshq/ReadBox/actions/runs/44507511633) **completed FAILURE** |
| Full consolidated software regression | **PASS**: lint, typecheck, unit, UI, R06 negative/security and Nginx static tests, production build |
| Dependency security audit | **PASS**, 0 production vulnerabilities |
| Ephemeral PostgreSQL step | **REFUSED BEFORE DB EXECUTION**: `scripts/testing/r06-ephemeral-postgres.sh:5-8` hardcodes JILLU-only `GITHUB_REPOSITORY`; exit 2 |
| SMTP rehearsal preflight | `scripts/testing/r06-smtp-rehearsal.sh:6-9` independently contains same JILLU-only guard; actual step SKIPPED |
| Disposable DB tests, SMTP/LMTP, encrypted restore/rollback, final R06 NO_GO artifact | **NOT VERIFIED**; all skipped downstream |
| Release status | **NO-GO**, 7 original findings OPEN, 17 independent live gates NOT accepted |
| Source/backup promotion | **WITHHELD**; Primary main and both dedicated backup refs remain `1393c48fdc821756213e9c0ca87dd166ee3f6b75` |

**Release/security boundary:** `GITHUB_ACTIONS=true` and actual authoritative `GITHUB_REPOSITORY=vibtoolshq/ReadBox` must be checked by the scripts themselves. Do not override environment repository identity, loosen target protections, run scripts on live VPS, or count unexecuted CI as PASS. Separate approval of only the two script guard predicates is required before further implementation/recheck. Candidate remains in draft PR; no force-push/tag/release/restore.

---

## NEXT-02 FINAL disposable Primary CI verification — 2026-11-19

- **Frozen original base:** `1393c48fdc821756213e9c0ca87dd166ee3f6b75`; **CI-tested code SHA:** `4d0b124af57c8d407bf609540b8b8b7a69a479b5`; **CI code tree:** `136c011b54687017aedaf35fd35397afaf1824b6`.
- **Single focused approved CI:** [Primary run #44509947742](https://github.com/vibtoolshq/ReadBox/actions/runs/44509947742) `completed/success`, `consolidated-acceptance` **PASS**, no SKIP. Steps and log markers prove app, lint, typecheck, unit/UI and static Nginx negatives; npm production dependency audit; ephemeral PostgreSQL auth/migration; loopback SMTP→LMTP/Maildir and negative relay checks; encrypted ACL backup/restore/rollback; historical immutable R06/QIS01 scope audits; `R06_ALL_CI_CONTRACTS_PASS_PRODUCTION_NO_GO`; sanitized artifact upload SUCCESS.
- **Fail-closed negatives:** wrong/non-CI R06 script identity rejected (exit 2); legacy JILLU repository refused; no live/staging run. Nginx template contract rejects legacy upstream/log/proxy and invalid internals. R06 governance rejects fabricated stage evidence and leaves production **NO_GO**.
- **Exact allowlist/security patch audit:** 13/13 paths (original NEXT-02 9 including notes + 2 approved lint paths + 2 approved guard scripts); no unexpected paths, no detected secret patterns, single-name substitution only in two guard scripts; `permissions: contents: read` and existing release workflow unchanged.
- **Original findings/gates:** 32 original findings, 7 OPEN; RG-01..RG-17 present with zero independent live acceptance during this phase. **NO_GO** until NEXT-03/NEXT-04 plus separate release approval.
- **Post-closure ref status must be recorded separately after actual publication:** do not declare the two backup branch SHAs equal the new Primary until remote readbacks confirm. No existing backup `main`, tag/release or VPS/live data changes authorized.

---

## Latest release-gate and source/CI evidence — 2026-11-19

**Source freeze (2026-11-19 Asia/Dhaka):** authoritative `vibtoolshq/ReadBox/main` 6f3bc1e3aeb441956e1fd0f4d81558a6aba2945f; tree `f82b07b6e0770850edd3431f041d5162848d442a`. Last full disposable Primary R06 CI ran against executable code 4d0b124af57c8d407bf609540b8b8b7a69a479b5: [run #44509947742](https://github.com/vibtoolshq/ReadBox/actions/runs/44509947742), SUCCESS. Compare 4d0b124af57c8d407bf609540b8b8b7a69a479b5..6f3bc1e3aeb441956e1fd0f4d81558a6aba2945f: **one documentation-only commit changing notes/003–006**, no executable change. At freeze time both dedicated backup refs `backup/dns-final-primary-20261119` matched 6f3bc1e3aeb441956e1fd0f4d81558a6aba2945f (2/2); backup repositories' separate `main` branches did not. **This new notes-only commit will advance Primary HEAD beyond the freeze; do not claim backup parity at that new HEAD without a new remote readback.** Historical source snapshots below are preserved and must not be mistaken for current source. Production remains **NO-GO**: 32 original findings, 25 CI-contract verified and 7 OPEN; 17 independently accepted production gates not evidenced. Historical R-01–R-06: 6/6 CI implemented. NEXT-01 and NEXT-02: 2/4 completed; NEXT-03 and NEXT-04: 2/4 pending.

- Current **source-only** R06 acceptance: [Primary run #44509947742](https://github.com/vibtoolshq/ReadBox/actions/runs/44509947742) SUCCESS against 4d0b124af57c8d407bf609540b8b8b7a69a479b5; the current main 6f3bc1e3aeb441956e1fd0f4d81558a6aba2945f includes one following **notes-only** commit (compare verified). Do not claim rerun at the documentation SHA.
- **Phase-01 / NEXT-03: NOT RUN live**: named test zone Cloudflare/R2 encrypted escrow/readback, MX/A/SPF/DKIM/DMARC, trusted TLS, registrar/PTR/firewall and public port status with negative retries. Operator approval missing for a specific domain/host. One bounded controlled acceptance when separately approved.
- **Phase-02 / NEXT-04: NOT RUN independent end-to-end acceptance**: outside-in SMTP through authenticated UI with attachment digest, rejects, host Nginx, controlled restart/outage, independent offsite restore/key custody/rollback and qualified AGPL/provenance review. One bounded staging acceptance when authorized.
- Existing **17 formal RG definitions are retained unchanged**; no fresh independent per-gate approval is claimed. Original 7 findings still OPEN; **NO-GO**. Do not edit R06 tests/ledger to force PASS. A later 17/17 independently accepted signed report permits **MANUAL_RELEASE_REVIEW_REQUIRED**, not automatically tag/release.

---

## Current verified implementation status

### MM-01 actual implementation and CI evidence — 2026-11-19

- **Source implementation:** [`55ea7dbc97ff78e8c537bfecf3975923639a854b`](https://github.com/vibtoolshq/ReadBox/commit/55ea7dbc97ff78e8c537bfecf3975923639a854b); exact Git tree `e0789807d0b6128e3a60593acc25e03a4b5e1de8`, from previous Primary head `4303b66bfb85f8062bc6cca025f3bbe5d6abfab5`. Exactly **five approved executable/test files** changed: `src/components/vcon/domain-form.tsx`, `src/core/dns/records.ts`, `tests/dns/r03-advisory-contract.test.ts`, `tests/ui/domain-zone-selection.test.tsx`, `tests/ui/vcon-phase3.test.tsx`. No other source, backend, secrets, schema, mailserver, R2 objects or DNS provider operations.
- **Existing read-only CI:** [R06 SUCCESS, run 44576640402](https://github.com/vibtoolshq/ReadBox/actions/runs/44576640402), verification PR [#3](https://github.com/vibtoolshq/ReadBox/pull/3), head `ff48998e8dc0d46c35c433d55ed50f689dcab278` with the **identical complete source tree** `e0789807d0b6128e3a60593acc25e03a4b5e1de8`. Verified npm CI source/lint, TypeScript typecheck, UI unit/Vitest regressions, build, dependency audit, disposable PostgreSQL/SMTP/LMTP/restore, immutable R06 gates; 0 CI failures. PR commit only adds an **empty-tree-delta** CI trigger, not application file modifications. No CI workflow file changed.
- **Focused functionality check:** 53 readback assertions PASS against minimally transpiled, *actual committed* `records.ts` export functions and UI source guards; foreign-zone mail-host A/AAAA owner absent, external MX retained for all three recorded domains on IPv4/IPv6, in-zone owner retained, SPF/DMARC/DKIM TXT and DKIM 255-octet segments preserved. This standalone check is **not** an independent live DNS test or the Node r03 test runner. The newly added `tests/dns/r03-advisory-contract.test.ts` cases were committed and typechecked but were **not separately executed** by the R06 workflow; do not mislabel them as a CLI Node test PASS.
- **Diff/security audit:** compare previous head..source commit gave exactly 5/5 allowlisted paths. Independent source blob readback shows `src/core/dns/domain-automation.ts`, `src/app/(workspace)/vcon/domains/actions.ts`, DKIM API route, DNS download panel and R2 agent-client **unchanged**. Private DKIM keys remain escrow-gated. No Prisma migration or new provider API.
- **Mirror closure BLOCKED:** dedicated `backup/dns-final-primary-20261119` refs in `JILLU-Games/ReadBox` and `MdNurnobi-Dev/ReadBox` were read at `6f3bc1e3aeb441956e1fd0f4d81558a6aba2945f`, **not** `55ea7dbc97ff78e8c537bfecf3975923639a854b`. Primary connector can write only Primary; alternate account can write JILLU-Games but **neither connected account has push permission to MdNurnobi-Dev**. These independent repositories also lack the newer Primary commit objects. Therefore **zero of two backup refs have verified exact latest SHA parity**. No attempt to force-push, rewrite backup history, claim parity, or create misleading unequal-SHA mirror commits. Finish exact **non-force fast-forward git object transfer** with authorized backup credentials and reread both refs; until then status is **SOURCE VERIFIED / EXACT MIRROR SYNC BLOCKED**, not fully closed.
- **Live environment:** no VPS, no real-domain DNS write, no live R2 operation, no deployment, no tag/release. The three preexisting domain successes are still **operator/chat-recorded**, not re-run or independently revalidated by this Phase-01. Original production 7 OPEN findings / 17 independent gates are unchanged; release remains **NO-GO**.

---

## 2026-11-20 — NEXT-03 preflight/acceptance ledger (BLOCKED; original RG-01..RG-17 immutable)

- **Approved NEXT-03 baseline:** Primary `b4265e8fb6d8d32ebf08a12e4857bb6f10e536c9`, tree `120c6b99fbcd2cbd7fe299aeff87893d678b80a6`; both dedicated backup branches exactly matched that SHA **before** this new docs-only successor.
- **One focused read-only gate:** Frozen GitHub refs and code guards inspected. Source-present error handling/zone conflict/DKIM escrow sequencing reviewed; **no CI triggered** (no executable patch and missing independently authorized test environment). This is NOT an accepted live DNS/R2/TLS test.
- **NEXT-03 requested live gate results:** Cloudflare zone/delegation/token scope **NOT RUN**; existing DNS conflict refusal **NOT RUN**; safe publish+provider readback **NOT RUN**; same-key idempotent retry **NOT RUN**; encrypted R2 escrow receipt and offsite custody **NOT RUN**; public MX/A/SPF/DKIM/DMARC propagation **NOT RUN**; trusted TLS/certificate renewal **NOT RUN**; externally reachable port 25/provider firewall/PTR **NOT RUN**. Overall phase **BLOCKED** because its disposable domain, Cloudflare zone, test VPS and escrow custodian were not specified.
- **Independent formal release gates:** `RG-08` and `RG-09` remain **NOT independently accepted**; offsite custody component of `RG-14` remains **NOT independently accepted**. Original `RG-01..RG-17` table is preserved; **no new PASS** claimed on this halted preflight. Seven original findings stay OPEN: `RB-P0-06`, `RB-P1-09`, `RB-P1-10`, `RB-P1-16`, `RB-P2-01`, `RB-P2-07`, `RB-P2-08`. **NO-GO**.
- **No publication:** No live domain, VPS, TLS secret, SMTP, DB, backup or R2 operation, tag or release. Changes to this document are evidence notes only. New Primary notes SHA and two-backup non-force exact-SHA parity require an actual post-publication readback; until then SYNC PENDING is truthful. User must separately identify/authorize NEXT-03 test fixtures to unblock live work.
---

## 2026-11-20 — Manual Mode operator-live acceptance evidence (not general R-06 GO)

| Scope/gate | Actual operator evidence | Decision |
|---|---|---|
| Source and host update | Exact `9c3d99d4...` deployed via guarded updater; encrypted pre-update snapshot logged; 6/6 containers healthy; worktree clean | **PASS — PuTTY** |
| Manual domain and basic DNS | `vibmail.my`, `pypal.pl` Active and green routing verified in Admin UI | **PASS — UI** |
| Manual DKIM creation | `vibmail.my` moved from key missing to ready and copyable public TXT after Publish disabled | **PASS for key-public-material stage only** |
| Mailbox + real Gmail receipt | Authenticated inbox displays one test Gmail message for each new domain | **PASS — operator UI, basic inbound** |
| R2 custody | Agent journal: 3 older `remoteVerifiedAt` receipts; Windows passphrase escrow decodes to same VPS age recipient | **PARTIAL — no fresh R2 object GET/isolated restore** |
| DKIM TXT authority, SPF/DMARC five-record verification, external TLS/PTR/IPv6 and automatic Cloudflare zone writing | No independent current end-to-end proof supplied | **UNVERIFIED** |
| Attachments/MIME/digest, controlled outage/rollback, offsite full restore, provenance and RG-01..RG-17 signoff | Not run in this manual feature test | **OPEN / product release NO-GO** |

**Scope-locked conclusion:** Manual Mode **inbound deployment and live function = operator-PASS / approved for this observed use case**. The prior R-01..R-06 six source phases remain completed; historical formal RG rows and original finding IDs remain intact, **not** blanket closed by these screenshots. No new CI result is asserted for documentation-only update.

## AU-PARITY-01 — reproducible verification and release gates (2026-11-20)

- Primary freeze `ddc3674ec1af0cccb2b4d93fc29edd3bffabbc4a` (3/3 dedicated backups matching at phase start).
- [CI #44723090499](https://github.com/vibtoolshq/ReadBox/actions/runs/44723090499) PASS at `d289016340a70686febe9e014f8bb0d554ba37f4`, followed by minimal new CI notes/005 allowlist path correction.
- [Necessary CI recheck #44723412617](https://github.com/vibtoolshq/ReadBox/actions/runs/44723412617) SUCCESS at `8d61704595a67cb97ae53d794be99198c45a64a3`. Exact baseline+7-path allowlist, `git diff --check`, mocked positive/negative 3-ref host/shell/web contracts, 10/10 Node tests, Python compile, Bash syntax, ESLint, TypeScript and CI no-deploy marker all PASS.
- Security inventory: zero modifications outside approved runtime ref-verification sections, related tests/workflow, Admin System Update docs and these notes. No Prisma/schema/auth/DNS/mailserver/backups/Compose/source tag release change; no new secrets. Source tests do NOT prove production live updater operation.
- Final documentation-only commit requires exact non-force Primary and both approved dedicated backup SHA parity readback before **VERIFIED CLOSED**. Until then **SOURCE VERIFIED, SYNC PENDING**.
- Full production R-06 formal GO remains NO-GO; no release, DNS, VPS, data migration or live backup/restore.

## AU-R2-UPDATE-01 — actual CI ledger & release gates (2026-11-20)

- Frozen baseline 3/3 matching `4694d8cc20eec4392ebb5883b4c197e1bf6ee7da`. Approved Scope Lock is 7 runtime/test/CI/docs paths plus specified root/backup notes; no changes to `src/**`, `deployment/**`, Prisma migrations, Docker Compose, auth, UI, mailserver or R2 SDK.
- [CI 44826716030](https://github.com/vibtoolshq/ReadBox/actions/runs/44826716030) FAIL: exact 7-path diff PASS, Bash syntax FAIL due duplicate trailing runner block.
- [Necessary CI recheck 44826908089](https://github.com/vibtoolshq/ReadBox/actions/runs/44826908089) FAIL: exact 7-path diff PASS, `py_compile` and `bash -n` PASS, Node 9/10 PASS, 1 isolated fixture `ROOT` unbound; TypeScript and final no-deploy steps NOT RUN.
- Final small source+test correction `3f377dd6836c9726492eaaade451895c9595b9b4` NOT VERIFIED by CI. Both allowed CI attempts consumed. No passing CI, no main publication, no backup-ref parity at a new SHA; **BLOCKED** pending separate final CI authorization.
- Required future acceptance: 10/10+ existing updater tests, app typecheck, scope/diff/security audit, no-deploy marker, 3/3 ref sync, and separately authorized host operation, R2 receipt and live manual health acceptance. R-06 formal 17 gates remain NO-GO.

## AU-R2-UPDATE-01 — Final permitted CI gate result (2026-11-20)

- Source baseline `4694d8cc20eec4392ebb5883b4c197e1bf6ee7da`; final corrected executable `3f377dd6836c9726492eaaade451895c9595b9b4`.
- [GitHub Actions #44827143074](https://github.com/vibtoolshq/ReadBox/actions/runs/44827143074): **SUCCESS**, exact approved corrected executable SHA. Job logs: `AU_R2_EXACT_SCOPE_PASS 7`, `AU_R2_PYTHON_BASH_SYNTAX_PASS`, **10 tests / 10 pass / 0 fail**, `AU_R2_MOCKED_REGRESSION_AND_TYPECHECK_PASS` (includes typecheck), `AU_R2_DISPOSABLE_ONLY_NO_VPS_NO_R2_NO_RELEASE_PASS`.
- Existing prior two CI failures were not ignored; ROOT fixture and accidental duplicate shell tail were corrected. This verified run supersedes their source-only BLOCKED status.
- Final change audit after notes-only commit must show 7 approved source/test/workflow/docs paths and exactly eight approved notes, no protected paths, clean non-force ancestry. Until final Primary + two dedicated backup refs match exactly, **SOURCE VERIFIED; GIT SYNC PENDING**, not CLOSED.
- VPS execution, R2 access, production encrypted backup, migration, live health, independent restore, RG-14 and R-06 release GO were NOT RUN/NOT APPROVED.

## AU-R2-BOOTSTRAP-01 — exact verification and release gates (2026-11-20)

- Frozen Primary + JILLU-Games/MdNurnobi-Dev dedicated backup SHA `72c139f4e96838ef0ed3476a8d4af91327b4fd42` (3/3 at phase start).
- GitHub #44831028239 (SHA `85c64c36bae86acbf28ebd197e0f307addb43073`) FAIL: Scope Lock 7 PASS, Bash syntax FAIL, downstream test/typecheck/no-deploy NOT RUN.
- GitHub #44831164135 (SHA `18e507c68c1a807201bc92fc4e698701a666e755`) FAIL: Scope Lock 7 PASS, Bash/Python syntax PASS; Node 14 tests/13 PASS/1 FAIL, stale prior test literal `backup_r2_gate.py" attest` on `tests/integration/au-r2-guarded-update.test.mjs:24`; typecheck and no-deployment job gate SKIPPED.
- Exact changed-path review: only 7 approved script/test/workflow/doc paths in tested candidate; documentation addendum in approved 7 note files only. No src/, Prisma, deployment/, new R2 credentials, auth, mailserver, data, tag or release modifications.
- One CI + one necessary recheck used. **BLOCKED.** No Primary publish and no mirror sync. Current Primary + 2 dedicated backups must remain at baseline SHA unless independently changed; re-read at handoff. Further exact one-fixture correction needs new approval.
- Source CI is NOT operational approval. Real VPS preflight/encrypted backup/R2/migration/health/manual acceptance and R-06 17 gates NOT RUN; formal release NO-GO.

## AU-R2-BOOTSTRAP-01 — final F-TEST-01 verified gates (2026-11-20)

- Baseline Primary + both dedicated backups at approval: `72c139f4e96838ef0ed3476a8d4af91327b4fd42`. First CI #44831028239 failed Bash syntax; minimal correction #44831164135 passed syntax but failed one stale literal-path test (13/14). User separately approved a strictly one-line assertion correction, with one final disposable CI.
- Final code/test SHA `f6fceeafc5933b1fdb8327e2589be825183bd5a9`; GitHub Actions [#44832329196](https://github.com/vibtoolshq/ReadBox/actions/runs/44832329196) **SUCCESS**. Job log: `AU_BOOTSTRAP_EXACT_SCOPE_PASS 14` (all previously approved files), `AU_BOOTSTRAP_SYNTAX_PASS`, **# tests 14 / # pass 14 / # fail 0**, `AU_BOOTSTRAP_FOCUSED_VERIFY_PASS` (Node regression and TypeScript), `AU_BOOTSTRAP_DISPOSABLE_NO_VPS_NO_R2_NO_RELEASE_PASS`.
- Exact F-TEST-01 source patch: `tests/integration/au-r2-guarded-update.test.mjs:24` only. Seven approved notes record this result; no new workflow/runtime changes in the final correction. Last notes-only commit must undergo exact changed-path and non-force source/dedicated-backup ref audit.
- **GATE: source CI verified.** Production staging/backup/R2/restore/DB migration/Compose/health/manual acceptance are NOT RUN. R-06 formal RG-01..17 remain NO-GO.

## OPS-CMD-FIX-01 — exact focused verification and release gates (2026-11-20)

- Frozen 3/3 baseline `83513be70e70fdcfbdf5889b069db3d729e6f4ff`. Patch paths: `docs/ADMIN-SYSTEM-UPDATE.md`, `tests/operations/au-r2-bootstrap.test.mjs`, `.github/workflows/au-r2-bootstrap-ci.yml`; closure notes: `notes/003–006`, `notes/backup-restore/003,005,007`. No runtime modification.
- One authorized focused disposable [run #44836416395](https://github.com/vibtoolshq/ReadBox/actions/runs/44836416395) SUCCESS at `0c38a51ff65d5461fb5020d943863586ed8ffc18`. Job evidence: `AU_BOOTSTRAP_EXACT_SCOPE_PASS 14`, `AU_BOOTSTRAP_SYNTAX_PASS`, **# tests 15 / # pass 15 / # fail 0**, `AU_BOOTSTRAP_FOCUSED_VERIFY_PASS` (includes typecheck), `AU_BOOTSTRAP_DISPOSABLE_NO_VPS_NO_R2_NO_RELEASE_PASS`.
- Existing CI scope test counts 14 changed paths relative to its historical AU-R2 bootstrap baseline; this OPS-CMD-FIX-01 change introduces only three approved non-notes files relative to its own baseline. Verify final notes-only commit and exact scope separately.
- After notes commit, non-force Primary/JILLU/MdNurnobi dedicated backup SHA synchronization and independent full-40 SHA/tree readback are required. **Source test verified, synchronization pending** until actually observed. No VPS operation/R2 upload/Prisma migration/restore/tag/release approved. Formal RG-01..17 and R-06 production GO remain NO-GO.

## AU-PRISMA-CLI-01 — focused CI and source/release evidence (2026-11-21 UTC)
- Frozen baseline `84ca61c657e35b8f207d0ea1a4248834bb1f59db`, 3/3 exact SHA/tree at entry. Approved changed source paths: `scripts/install/readbox-guarded-update.sh` (one migration-status command), `tests/integration/au-r2-guarded-update.test.mjs` (one new targeted test), `.github/workflows/au-r2-bootstrap-ci.yml` (branch trigger only). Seven notes paths approved for closure. No protected application code, Dockerfile, entrypoint, Prisma, secrets, live data or backup SDK modifications.
- One disposable [Actions #44844643775](https://github.com/vibtoolshq/ReadBox/actions/runs/44844643775) SUCCESS at code/test SHA `9e0b4a9e8463d3a86a83b156f079e9ffb3296447`; source job logs: `AU_BOOTSTRAP_EXACT_SCOPE_PASS 14` (historical baseline), `AU_BOOTSTRAP_SYNTAX_PASS`, **# tests 16 / # pass 16 / # fail 0**, `AU_BOOTSTRAP_FOCUSED_VERIFY_PASS` (includes TypeScript), `AU_BOOTSTRAP_DISPOSABLE_NO_VPS_NO_R2_NO_RELEASE_PASS`.
- Exact current-phase source diff 3/3 allowlist paths, one forward commit, no unrelated source or runtime. Notes-only successor needs separate diff/security audit and non-force publication/3/3 dedicated backup SHA/tree readback before source closure; until then mark **CI VERIFIED / SYNC PENDING**.
- Existing VPS Prisma P1001 from pre-update test is an operational blocker, not yet a verified live fix. No production update/restore/R2 PUT/DB migration or release/tag occurred. Formal 17 RG gates and R-06 GO remain NO-GO; renewed exact-target live update requires a new explicit human approval.

## LIVE-VPS-UPDATE-01 — production operational acceptance versus release gates (2026-11-21 UTC)
- Previous source CI [#44844643775](https://github.com/vibtoolshq/ReadBox/actions/runs/44844643775) SUCCESS (16/16). Live host operator console: clean preflight, verified fixed 3/3 refs, active backup agent/private age identity/managed archive/R2 readiness, authenticated fresh V2 + remote SHA-256 gate PASS, encrypted R05 rollback PASS, FF-only Git/Compose update PASS to `54e15ddfce5fd824fab89fdb1e2b3100d0b70dde`.
- Automated post-update Prisma command hung due stopped Docker client processes; original `AU_R2_UPDATE_HEALTH_PASS` marker **NOT OBSERVED**. Guarded process group cleared; separate non-interactive read-only Prisma status: **8 migrations up to date, exit 0**. Separate host exact HEAD/clean, six healthy services, active backup agent and app live+ready: **POST_UPDATE_HEALTH_CHECK_PASS**.
- Operator explicitly confirmed 5/5 manual acceptance checks PASS. Evidence is operator-provided; no independent live login/inbox tests by Git closure agent. LIVE-VPS-UPDATE-01 **operational acceptance PASS** for the approved live update only; manual close-out notes + non-force 3-ref Git sync pending readback.
- Not implied: a restore drill, cross-provider offsite disaster recovery, full negative SMTP/DKIM checks, release/legal sign-off or all 17 R-06 gates. **Formal ReadBox R-06 remains NO-GO.** A later notes-only commit is not a deployed VPS update.
