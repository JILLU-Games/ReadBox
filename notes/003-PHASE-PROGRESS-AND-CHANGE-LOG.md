# 003 — Phase Progress & Immutable Change Log

> **LATEST AUTHORITATIVE RECONCILIATION — 2026-11-19.** **Source freeze (2026-11-19 Asia/Dhaka):** authoritative `vibtoolshq/ReadBox/main` 6f3bc1e3aeb441956e1fd0f4d81558a6aba2945f; tree `f82b07b6e0770850edd3431f041d5162848d442a`. Last full disposable Primary R06 CI ran against executable code 4d0b124af57c8d407bf609540b8b8b7a69a479b5: [run #44509947742](https://github.com/vibtoolshq/ReadBox/actions/runs/44509947742), SUCCESS. Compare 4d0b124af57c8d407bf609540b8b8b7a69a479b5..6f3bc1e3aeb441956e1fd0f4d81558a6aba2945f: **one documentation-only commit changing notes/003–006**, no executable change. At freeze time both dedicated backup refs `backup/dns-final-primary-20261119` matched 6f3bc1e3aeb441956e1fd0f4d81558a6aba2945f (2/2); backup repositories' separate `main` branches did not. **This new notes-only commit will advance Primary HEAD beyond the freeze; do not claim backup parity at that new HEAD without a new remote readback.** Historical source snapshots below are preserved and must not be mistaken for current source. Production remains **NO-GO**: 32 original findings, 25 CI-contract verified and 7 OPEN; 17 independently accepted production gates not evidenced. Historical R-01–R-06: 6/6 CI implemented. NEXT-01 and NEXT-02: 2/4 completed; NEXT-03 and NEXT-04: 2/4 pending. Detailed, immutable code excerpts and line links: [017](017-CURRENT-FORENSIC-PATCH-REFERENCES-2026-11-19.md); executable step/closure contract: [018](018-PHASE-EXECUTION-AND-CLOSURE-TEMPLATE.md). Earlier dated statements are retained as history, not latest status.


> **CURRENT PRIORITY / 2026-11-19:** Primary `vibtoolshq/ReadBox` inspected SHA `3dfac11f46165c262c3dc5ddb7e82563a56f9a7f`. Historic R-01–R-06 **6/6 source implementation CI-verified**. Remaining **NEXT-01–NEXT-04 = 0/4 accepted**, 7 original release findings OPEN, formal production NO-GO. **NEXT-01 backup parity** is blocked by write authorization; not yet closed. Historical log/scoreboard below refers to its historical phase contract. See current progress ledger at the end.


**Frozen baseline:** `e28886e5e0f7a155cd64e23bc8ee8f6668d6699c` · **Log initialized:** 2026-11-17 · **R-01 through R-06 IMPLEMENTATION VERIFIED (CI); 6/6 implementation scopes done, final live acceptance BLOCKED.**

## Scoreboard

| Metric | Actual value |
|---|---|
| Total ordered phases | **6** |
| Completed / verified | **6/6 (CI implementation only)** |
| In progress | **0 implementation phases; live acceptance not authorized** |
| Remaining | **0/6 implementation phases; external acceptance gates OPEN** |
| Blocked | **R-06 live staging/release acceptance NOT RUN; production NO-GO** |
| Original forensic findings | **32** |
| Findings verified closed | **25 (CI contract; not live VPS)** |
| Findings OPEN | **7** |
| Next implementation phase | **None (exactly 6/6 implemented); separate staging approval and scope exceptions needed** |
| Final release | **NO-GO** |

## Ordered phase ledger — no results invented

| Phase | Findings | Next feature/bugfix scope | State | CI evidence URL | Source SHA | Mirror SHA |
|---|---:|---|---|---|---|---|
| R-01 | 7 | Production/dev Compose selection; standalone/Coolify secrets; URL-safe DB auth; reproducible image/deps and advisory audit; accurate quick-start documentation. | VERIFIED CLOSED (CI) | https://github.com/JILLU-Games/ReadBox/actions/runs/44093204590 | `113663cdabacf1460af5b06a334d99ab3db833c2` | mirror verification pending |
| R-02 | 4 | Single-DB virtual SQL routing with least privilege, migration parity, Maildir owner/UID/GID/ACL consistency. | VERIFIED CLOSED (CI; RB-P2-04 exception) | https://github.com/JILLU-Games/ReadBox/actions/runs/44102834169 | `b6ab76119a31f9bf4e81b3990a5fcc6d802a6892` | final ref equality to be verified on mirror |
| R-03 | 6 | Supported Postfix/Dovecot installation/integration, port and socket contract, documented DNS/TLS/DKIM boundaries; inbound-only vs other capabilities explicit. | CI IMPLEMENTATION VERIFIED CLOSED; public TLS/port gates OPEN | https://github.com/JILLU-Games/ReadBox/actions/runs/44107205810 | `d0f3272ea298de012da83c6f01b588fa0513d1da` | final mirror SHA to confirm |
| R-04 | 6 | First admin setup, consistent user/admin source, worker heartbeat and readiness gates, actionable errors for outages and recovery. | CI VERIFIED CLOSED | https://github.com/JILLU-Games/ReadBox/actions/runs/44112634511 | `88e57e2e81dc07a8f91b07f448df85e51d58e429` | final mirror SHA verification pending |
| R-05 | 6 | Container-aware and host-aware backup/restore, secret protection, downtime consistency, UID/ACL restore, updater repo correctness and rollback. | CI IMPLEMENTATION VERIFIED CLOSED; 2 owned findings OPEN | https://github.com/JILLU-Games/ReadBox/actions/runs/44121121316 | `a55ec82bb2f58804e910427c66ff6352cd5c14c6` | final mirror SHA pending |
| R-06 | 3 | Final GitHub CI and separately approved staging VPS evidence: real inbound mail, DNS/TLS, runtime integration, negative tests, backup/restore, licensing and formal GO/NO-GO. | CI IMPLEMENTATION VERIFIED; live acceptance BLOCKED, 3 owned findings OPEN | https://github.com/JILLU-Games/ReadBox/actions/runs/44127481624 | `807ca9f38adb02db2a8b73dc0901fce23ee5e63a` | final mirror SHA pending |

## Scope Lock enforcement on every phase

- Record original baseline/current HEAD and compare **all changed paths** with `002` allowlist; deny unrelated changes even if convenient.
- Keep **existing UI/UX, layout, pages, auth rules, business feature behavior, mail data, user accounts and previous migrations** unchanged outside approved findings.
- For shared files, list changed line/range and reason; avoid wide refactors.
- One focused CI run per phase on its actual candidate SHA; do not reuse a prior run or claim future validations passed.
- On an approved phase close: update this log, error handling inventory `004`, actual working features `005` and release gates `006`. Record exact tested/pushed SHA and matching mirror SHA.
- A blocked or failed phase stays OPEN, with blockers; do not automatically start the next.

## Append-only phase completion template

Copy this after a **separately authorized** R-XX implementation; never fill it before testing:

```markdown
### R-XX — [Title] — [YYYY-MM-DD HH:mm Asia/Dhaka]
- State: NOT STARTED / IN PROGRESS / BLOCKED / VERIFIED CLOSED
- Start baseline and current parent SHA:
- Finding IDs closed/remaining:
- Exact allowed paths and changed file list:
- Changed behavior (verified; not anticipated):
- Existing UI/UX/auth/features preserved (test/proof):
- Negative/error handling checks (004 IDs):
- Actual working feature delta (005 IDs):
- One focused CI run URL/job/tested SHA and pass/fail:
- Production/live evidence vs only CI:
- Data/migration compatibility and rollback evidence:
- Source commit/push SHA:
- Target fast-forward and identical tree SHA:
- Completed: N/6; remaining: 6-N; next phase:
- Release verdict and open blockers:
```

## Date-stamped record

**2026-11-17 — Planning/docs only:** the source/target baseline was reconciled, all 32 existing forensic issues assigned to exactly six phases, and this initial progress ledger created. **No bugfix, app behavior change, runtime test, live installation, commit for an implementation phase, or release GO has occurred.**

### R-01 — Deployment foundation — 2026-11-17

- **State:** VERIFIED CLOSED (CI); **completed:** 1/6; **remaining:** 5; **next:** R-02.
- **Code SHA:** `113663cdabacf1460af5b06a334d99ab3db833c2`. **Findings:** RB-P0-01, RB-P1-01, RB-P1-02, RB-P1-14, RB-P1-15, RB-P2-03, RB-P2-09.
- **Implemented:** production Compose made default by renaming dev file; safe DB password URL encoding including `%`, `@`, `#`; auth/database secret length guards; single lockfile Docker runtime and immutable Node base digest; Next.js 16.4.5, fast-uri 3.1.9; correct README and user-requested AGENTS.md workflow policy.
- **Proof:** https://github.com/JILLU-Games/ReadBox/actions/runs/44093204590 (focused corrected Docker/runtime, current production npm audit) and https://github.com/JILLU-Games/ReadBox/actions/runs/44092311120 (full original app regression pass). Last correction altered only Dockerfile encoding, its targeted contract test, temporary CI workflow.
- **Preserved:** all `src/`, application UI/UX/layout, user/business logic, existing migrations, Postfix/Dovecot files and data. **Live VPS and SMTP:** NOT RUN; production NO-GO.
- **Mirror:** final SHA equality verified separately after the documentation commit; no release/tag deployed.

### R-02 — Single PostgreSQL / Maildir identity — 2026-11-17

- **Status:** Implemented and focused CI PASS; formal phase closure BLOCKED by `RB-P2-04` because `src/core/health/snapshot.ts` is not R-02 allowlisted. Completed/closed phases remain **1/6**; **5 remain** including R-02.
- **Code commit:** `e1efdbd0b0380a94152947f7be47eb17c5c8d70c`. **Verified CI:** https://github.com/JILLU-Games/ReadBox/actions/runs/44099280332. Seven migrations applied twice (second no-op), virtual domain/mailbox/alias responses, invalid/disabled negatives, insufficient privilege negatives, unit/schema and Maildir POSIX checks.
- **Fixed/verified contract:** `RB-P0-03`, `RB-P0-04` and `RB-P1-08` at isolated CI level. Migration parity helper also verified, but the production readiness endpoint still does NOT enforce missing expected migrations (`RB-P2-04 OPEN`).
- **Unchanged:** existing `src/app/`, `src/components/`, auth, UI/UX, original Prisma migrations, mailbox data and unrelated app code. No VPS or external Postfix/Dovecot test.
- **Next decision:** authorize precise health-readiness scope exception or explicitly reassign `RB-P2-04` to R-04 before satisfying R-03 prerequisite. **Overall production NO-GO.**

### R-02 final closure — explicit readiness exception — 2026-11-17

- **Final status:** VERIFIED CLOSED (CI); **completed 2/6, remaining 4**; next phase **R-03** only after separate authorization.
- **Last code SHA:** `b6ab76119a31f9bf4e81b3990a5fcc6d802a6892`. **Focused CI:** https://github.com/JILLU-Games/ReadBox/actions/runs/44102834169. Existing R-02 SQL/database CI: https://github.com/JILLU-Games/ReadBox/actions/runs/44099280332.
- **New actual fix:** `src/core/health/snapshot.ts` now validates complete expected Prisma migration history using the existing R-02 helper; pinned seven existing migrations and auto-discovers later checked-in migrations. Missing, unfinished or query-error history returns `not_ready`.
- **Changes permitted by explicit user exception:** only health snapshot plus `tests/admin/phase6-settings-update-health.test.ts` and new `tests/admin/r02-readiness-parity.test.ts`; no UI, auth, app routes, other backend behavior or migration edits. Focused branch audit PASS.
- **Progress:** R-01 7 and R-02 4 findings CI verified = **11/32**; **21** other audit findings OPEN. Live VPS, SMTP/LMTP, DNS/TLS, backup/restore and release not tested. **Production NO-GO**.
- **Final exact mirror:** verify source and target `main` ref/tree SHAs after committing this note; CI run alone is not mirror proof.

### R-03 — Inbound Postfix SMTP → Dovecot LMTP → Maildir — 2026-11-17

- **State:** CI implementation VERIFIED CLOSED. **Completed phases:** 3/6; **remaining:** 3; **next:** R-04 only after separate approval. **Production release:** NO-GO.
- **Tested code commit:** `d0f3272ea298de012da83c6f01b588fa0513d1da`; **one completed focused CI:** https://github.com/JILLU-Games/ReadBox/actions/runs/44107205810. Previous run failed only new static test regex escaping and was corrected without app feature changes.
- **Proven in disposable CI:** fresh PostgreSQL+web/worker runtime, restricted SQL role provision, opt-in Postfix/Dovecot build/start, Postfix/Dovecot lint, SMTP STARTTLS, nonlocal relay reject, invalid local recipient reject, correct delivery to a Maildir file on UID/GID 1001, missing TLS material startup rejection, persisted Postfix queue and exact 13-branch-path audit.
- **R-03 findings:** `RB-P0-02`, `RB-P0-05`, `RB-P2-05`, `RB-P2-06` CI verified; `RB-P1-09`, `RB-P1-10` still OPEN for trusted public TLS, DNS/MX/PTR/port 25/provider/firewall/IPv6 real VPS validation in R-06. **Overall 15/32 CI verified; 17 OPEN.**
- **No out-of-scope changes:** no `src/**`, UI/UX/routes, auth/business logic, database schema/migration, mail data or public DNS mutations. No live VPS or production release. Temporary CI workflow excluded from published source main.
- **Mirror:** final exact source/target SHA and tree equality recorded by git ref verification after docs commit.

### R-04 — First admin/operator parity and fail-closed app/worker readiness — 2026-11-17

- **Status:** CI VERIFIED CLOSED. **Completed:** 4/6; **remaining:** 2 (R-05, R-06); **next:** R-05 only after user approval. **Production release:** NO-GO.
- **Tested code SHA:** `88e57e2e81dc07a8f91b07f448df85e51d58e429`. **Successful focused CI:** https://github.com/JILLU-Games/ReadBox/actions/runs/44112634511. Previous necessary retries addressed CI-only mock UI environment and a 1-ms future heartbeat fixture; the final CI reran successfully without any UI feature edits.
- **Implemented:** manual production-only one-time `admin_accounts` bootstrap with random unusable password and forced reset-token activation; duplicate/admin identity rejection; setup inspector counts the same active superuser source; initially failed ingestion records a degraded heartbeat before exit; app snapshot requires production heartbeat even when env toggles false; unavailable DB, missing/symlink storage, stale/degraded/unknown/future heartbeat fail closed; worker Docker healthcheck validates full application readiness; web liveness separated to avoid deadlock; mailTransport remains explicitly unverified.
- **Proof:** all schema/type/backend tests, UI **70/70**, Next build and real isolated PostgreSQL bootstrap-once/duplicate/inspection and 11-branch-path audit PASS. No production interactive operator CLI, actual SMTP/LMTP outage recovery, VPS or release executed.
- **Scope unchanged:** no login UI/layout/colors, auth credential policy, app routing, unrelated feature, Prisma migrations/schema, Postfix/Dovecot templates or user mail data modification. Temporary CI workflow excluded from published code.
- **Original findings:** R-04's six CI-closed => 21/32 CI verified; 11 other findings remain OPEN, including R-03 external TLS/DNS/VPS gates. Mirror target fast-forward exact final SHA/tree verification after notes commit.

### R-05 — encrypted Compose PostgreSQL/Maildir snapshot, restore, and automatic rollback — 2026-11-17

- **State:** CI IMPLEMENTATION VERIFIED CLOSED; **5/6 phases completed**, **1 remaining (R-06)**. **Production release:** NO-GO. **Code commit:** `a55ec82bb2f58804e910427c66ff6352cd5c14c6`; **focused CI:** https://github.com/JILLU-Games/ReadBox/actions/runs/44121121316.
- **Tested against disposable Compose containers:** PostgreSQL 16 (both `public` and `mailserver` schemas), web/worker and Postfix/Dovecot stand-ins sharing named Maildir/attachments/media/queue volumes. Age public-key encrypted artifact mode 0600, no plaintext config, snapshot manifest SHA-256, restoration of DB+Maildir+attachment+media+Postfix queued file and numeric UID/GID 1001 plus real POSIX ACL. Post-database-apply failure injection triggered **R05_PROVEN_POST_DATABASE_APPLY_AUTOMATIC_ROLLBACK_PASS** and confirmed DB+Maildir prestate; ciphertext tampering refused before mutation. Previously running services restarted; SMTP downtime during backup explicitly disclosed.
- **Existing regressions:** Prisma validation, TypeScript, backend/unit contracts, UI **70/70**, Next.js build, Bash/Python syntax, static operations tests PASS. Exact 14-path branch Scope Lock audit PASS; 13 published paths within R-05 allowlist, temporary CI workflow excluded.
- **CLI and user-facing UI:** no route, UI, auth, schema, Maildir data or Postfix/Dovecot runtime change; production update repo canonicalized while explicit dev test overrides preserved. Host/systemd rollback/upgrade logic was syntax/static verified only, not run on VPS.
- **Findings:** CI-verified `RB-P1-11`, `RB-P1-12`, `RB-P1-13`, `RB-P2-02`; **OPEN** `RB-P2-01` (legacy Nginx and template filenames outside scope), `RB-P2-07` (real offsite retention/rotation/key custody and live VPS/host restore). Project **25/32 verified, 7 OPEN**; public DNS/TLS/SMTP and real release still NO-GO.

### R-06 — Final consolidated read-only CI / production GO-NO-GO — 2026-11-17

- **State:** All **6/6 implementation scopes** are CI verified; R-06 mandatory **live staging acceptance remains BLOCKED/NOT RUN** pending independent user approval. **Original findings:** 25/32 CI verified, **7 OPEN** including R-06-owned `RB-P0-06`, `RB-P1-16`, `RB-P2-08`; **17/17 live staging release gate checks not accepted**, formal **NO-GO**.
- **Tested source SHA:** `807ca9f38adb02db2a8b73dc0901fce23ee5e63a`; **successful focused CI:** https://github.com/JILLU-Games/ReadBox/actions/runs/44127481624. Clean npm install, Prisma validate, full backend/70 UI regression, Next build, production npm audit, guarded ephemeral PostgreSQL 16 auth/migrations, disposable production web/worker/Postfix/Dovecot startup, loopback STARTTLS→LMTP→Maildir and reject tests, age encrypted backup/restored UID/ACL and post-DB-apply forced rollback, strict provenance/17-gate negatives and 11-path Scope Lock audit PASS. One bounded SMTP greet startup readiness wrapper was added in R-06 allowed scripts; R-03 mailserver source unmodified.
- **Lint debt:** exactly two pre-existing R-04 unused `catch (err)` violations at `src/core/setup/trusted-operations.ts:366,386`; source excluded **only** from final R-06 lint invocation and validated by strict baseline, no app source edit. **Full-tree lint is not clean.** A prior CI test attempt failed on newly added JS globals; new R-06 code fixed. Another attempt showed a disposable SMTP greeting startup race; bounded startup probe fixed without modifying R-03.
- **Documentation:** release governance, staged acceptance runbook, MIT-vs-AGPL provenance inventory, README/Security warnings, R-06 release gate/negative scripts. Workflow is **read-only with no deploy/tag/release**, and produced expected `R06_PRODUCTION_NO_GO`, `R06_FINDINGS_OPEN=7`, `R06_LIVE_GATE_PASS_CLAIMS=0/17` markers.
- **Preserved:** src UI/UX/auth, migrations, mailserver/SMTP engine, historic LICENSE/NOTICE, actual Maildir/DB data, public DNS/VPS untouched. **No production GO.** Next action is separate explicit authorization for staging acceptance, not an automatic seventh phase.

## QIS-01 — Auto Quick Installer & Browser-first Admin (2026-11-17)

- **Status:** CI IMPLEMENTATION VERIFIED, **not a seventh R-phase**, no live VPS install or production release. **Tested source SHA:** `2833f1f1e1be76d501cdd3fa2210d0c1084d9b47`; **focused disposable GitHub CI:** https://github.com/JILLU-Games/ReadBox/actions/runs/44139227363; **Scope Lock:** exact 16 allowed source/config/tests/docs paths. Repo original 6/6 implementation phases and their 32 findings remain unchanged.
- **Actually tested:** fresh private `.env` mode 0600 with independent strong PostgreSQL, auth and Postfix credentials; 256-bit owner code printed only to a private disposable operator output, verified 43 characters with only SHA-256 hash and one-hour expiry persisted. Repeat installer preserved secrets **byte-for-byte**. Real disposable Compose PostgreSQL 16, web and worker booted, Prisma migrations initialized and private Postfix SQL lookup role configured without starting the public SMTP/mailserver profile.
- **Actual disposable PostgreSQL:** two concurrent browser-helper admin bootstrap requests created **exactly one active privileged `AdminAccount`**, not a legacy `User` identity; wrong/expired code and unsafe origins denied. Existing 15-minute admin reset token hashed in DB, password activation completed once, replay rejected, no second privileged account. New browser form UI test passed, existing auth, UI and Next build remained green.
- **Update behavior:** `scripts/install/readbox-update.sh` adds approved-remote/fast-forward and encrypted-backup preflight plus no-destructive-migration-rollback policy. The update script was **syntax/source-contract tested only**; no live upgrades, external/offsite backups or real migration rollback were executed.
- **Existing source preserved:** `scripts/auth/operator.ts`, `src/core/auth/**`, Prisma schema/migrations, Postfix/Dovecot runtime, existing UI/UX/navigation, customer Maildir/DB data. The only existing Compose change is passing hashed setup token/expiry into the web container; no public SMTP, HTTPS, DNS or reverse-proxy provisioning.
- **Existing release position unchanged:** original **25/32 findings CI-verified, 7 OPEN**, R-04 historical two lint errors still recorded; `R06_PRODUCTION_NO_GO` verified in QIS CI. **No VPS access, Git tag/release or deployment performed.**

### R-06/QIS-01 CI compatibility reconciliation — 2026-11-18 (Asia/Dhaka)

- **State:** Focused source GitHub Actions CI VERIFIED; original **6/6 implementation phases** unchanged, QIS-01 remains a separately approved additive patch, **25/32 original findings CI verified, seven OPEN, 0/17 independent live staging gates PASS, production NO-GO**.
- **Starting main SHA:** `4467636a1300fd45b85b35cf556fdb106faa0ec9`. Earlier main CI https://github.com/JILLU-Games/ReadBox/actions/runs/44140465798 failed *only* the R-06 Scope Lock step: it compared the historical R-05 baseline with a moving HEAD and misclassified already-approved QIS-01 paths. Its prior app, PostgreSQL, Docker SMTP/LMTP and recovery stages passed.
- **Only executable patch:** `.github/workflows/r06-production-readiness.yml`; source test commit `c27b30f587f37bc590a483e0bea263f2ac08d0e7`. The workflow now verifies the fixed historical R-06 implementation (11 paths) and R-06 notes closure (8 paths) independently of the approved QIS-01 implementation (16 paths) and QIS-01 notes closure (3 paths). Exact path sets, immutable commit ancestry and `git diff --check` all remain enforced; the mutable cross-phase diff is removed, **not** the scope guards.
- **One focused successful source CI:** https://github.com/JILLU-Games/ReadBox/actions/runs/44147873597 on the test SHA above. Existing app/UI/auth/build, dependency audit, guarded PostgreSQL, loopback SMTP→LMTP→Maildir, encrypted backup/restore/rollback, four immutable path audits and release NO-GO gate all PASS. Exact markers: `R06_QIS01_IMMUTABLE_SCOPE_AUDITS_PASS`, `R06_ALL_CI_CONTRACTS_PASS_PRODUCTION_NO_GO`, `R06_FINDINGS_OPEN=7`, `R06_LIVE_GATE_PASS_CLAIMS=0/17`.
- **Scope preservation:** The tested code patch changed only the R-06 workflow. This dated closeout updates only notes/003 and notes/006. No UI/UX/auth/Prisma/database/mailserver/installer/updater, historical audit, user data, release/tag, DNS, VPS or public SMTP mutation. Two historical R-04 full-tree ESLint violations remain explicitly tracked and unchanged.
- **Sync requirement:** fast-forward source and mirror to the identical closeout commit SHA; verify both refs and the exact 3-file aggregate patch independently before claiming synchronization. CI evidence is on the executable patch parent; documentation-only closeout does not replace a live staging test.

## DKIM-01 — Secure Automatic DKIM DNS Provisioning (2026-11-18)

- **Separate approved feature Scope Lock** after the AU-02 frozen source/mirror/local baseline `ea14efa5b5571b0ed1e00e211e07a7862f2b6a0f`; this does not reopen the original R01–R06 historical scopes.
- Isolated RSA-2048 public DNS provisioner with private-only named volume, public read-only Web mount, authenticated Unix HMAC bridge, admin-only domain provisioning endpoint, optional Cloudflare zone-scoped DKIM TXT writer, manual fallback, and independent status display; signer remains inactive because mailserver is inbound-only.
- Exactly **13 approved implementation paths** changed. Source branch tip `016b28764351874261ed50aed34bff4faa111241` and mirror PR candidate `8c4fa678fdb6fa5bbb68ed91676dc3f22b4bf852` have identical tree `3f6dc44bc96a0fa595fba0362012e5214a7b53fe`.
- Corrected focused disposable [R06 run #44273197408](https://github.com/JILLU-Games/ReadBox/actions/runs/44273197408) **SUCCESS**: app/UI/build, dependency security, ephemeral PostgreSQL, existing default Docker/SMTP/LMTP, encrypted recovery/rollback and immutable NO-GO gates. Independent local DKIM Node negative tests **6/6 PASS**.
- Initial CI found and scoped corrections to legacy UI payload, extensionless test imports and opt-in Docker profile. Default Compose service topology is unchanged. DKIM agent Dockerfile includes disposable Python tests on profile-specific image build; the default R06 workflow does **not** exercise that optional image.
- **Live DKIM key generation, Cloudflare DNS, private-key escrow and VPS rollout all NOT RUN.** No user keys, mail database or volumes were mutated. Source-only success is not stable release approval; `v1.0.0` remains NO-GO.

## DKIM-02/FIX-01 — OpenSSL RSA header compatibility (2026-11-18)

- **Frozen main baseline:** `69b7f4c91100dd30c83ab56b24c29a4a0a9384b1`; existing production host was previously updated to this SHA by the approved guarded Admin Panel rollout; DKIM profile and live domain keys remained unactivated.
- Production-VPS **disposable image-build rehearsal** at baseline first revealed `INVALID_PRIVATE_KEY` in two of four embedded Python tests. OpenSSL 3.x emits `Private-Key: (2048 bit, 2 primes)` while the original parser accepted only `Private-Key: (2048 bit)`.
- **Exact approved fix:** `deployment/dkim/agent.py` modifies only the RSA key-size header regex; `deployment/dkim/test_agent.py` adds legacy/v3 header, weak-key (1024-bit), and malformed-header regressions. RSA minimum 2048 bits, no-replace keys, idempotency and conflicts remain unchanged.
- Source-only tested candidate `06c1460781b079794aa12c133a0171f601c33e99`, mirror candidate `5820255216293a7ad54b2ffe6e43c7dda8d62e37`, identical Git tree `c973d0db780939a5049d2366540b81e5f589738d`.
- [Read-only R06 run #44280725129](https://github.com/JILLU-Games/ReadBox/actions/runs/44280725129) **SUCCESS** at exact mirror candidate; app/UI, security advisories, PostgreSQL, default Docker SMTP/LMTP, recovery and release NO-GO gates passed.
- **Independent build-only proof:** operator cloned the exact candidate SHA/tree to a temporary `/tmp/readbox-dkim-fix01.*` checkout and ran `docker build --no-cache` for the opt-in provisioner image. Alpine OpenSSL `3.5.9-r0`, Python **6/6 tests PASS**, `DKIM02_FIX01_DISPOSABLE_BUILD_PASS`. The build's temporary Docker tag/source checkout were scheduled for trap cleanup. This was **not** an app deployment, production DKIM key generation or DNS operation.
- Closure documentation changes exactly `notes/003–007` after PASS. Final source/mirror/local `main` SHA/tree require exact non-force parity confirmation. No tag or release.

## DKIM-02/FIX-02 — Non-root agent script permission (2026-11-18)

- **Frozen source/mirror/local `main` baseline:** `ebb2e2bddd0ef26671b283a4f71bc4d35bb32dbd`. Under controlled DKIM-02 rollout, the operator stopped only the unhealthy DKIM provisioner container (`docker update --restart=no`; `docker stop`); no production domain key or Cloudflare DNS write occurred.
- **Observed runtime failure:** `readbox-dkim-provisioner-1` reported `restarting/unhealthy`, exit code `2`, and `python3: can't open file '/usr/local/bin/dkim-agent.py': [Errno 13] Permission denied`. Build-time root-run Python tests did not exercise non-root read access.
- **Exact approved Dockerfile-only code patch:** after `COPY`, set `/usr/local/bin/dkim-agent.py` to `0644` and run a build-time `USER 1001:1001` read/compile smoke check. Agent.py, Docker Compose, permissions of domain volumes, app, mailserver and backup logic are unchanged.
- **Source candidate:** `51276afba843a5e94377c2e794ec05ed677b4a9d`; **mirror candidate:** `3c25d0c308f5028c2eb4b8b93e0f563019618a8a`; **identical code tree:** `d34e6b539e7ba3aae3a2f03f8046a5f2821dcfcf`.
- **One focused disposable build-only test** on the VPS host using a temporary checkout verified exact source candidate SHA, `docker build --no-cache --progress=plain`, OpenSSL `3.5.9-r0`, **6/6 embedded Python tests PASS**, and the image-stage non-root read/compile command **PASS**. Output ended `DKIM02_FIX02_NONROOT_BUILD_PASS`; temporary checkout and test image cleanup were registered via shell EXIT trap.
- **Documentation closure:** notes `003–007` only, following successful focused test and one-file exact patch audit. Final non-force source/mirror/local main SHA/tree parity must be confirmed after publication. No Admin Panel update, DKIM activation, live key generation, Cloudflare DNS change, tag or release in FIX-02.


## DKIM-03 — Age/R2 private-key escrow and fail-closed provision gate (2026-11-18)

- **Frozen source/mirror/local main:** `d2faedcebd302f488c515daba57441f59ff3a687`; source implementation candidate `cca9543253f0f97292d824c56a90c35be10b6aae`, tested repair candidate `c6ee9fd183553cce6e0c6836b66ddbf209ca214d`. Mirror tested candidate `bac871825fee87dda6a3bf74915832bee6ca4c5a`; exact tested source/mirror Git tree `4cccc52ea7d92bdaf4a06b27fc15a8039aae8036`.
- Scope: only `deployment/dkim/{agent.py,escrow.py,test_agent.py,test_escrow.py}`, `scripts/testing/dkim03-escrow-rehearsal.sh`, `.github/workflows/dkim03-ci.yml`, `docs/DKIM-ESCROW.md`, and documentation-only `notes/003–007`. Existing R05/BR04/backup/R2 implementation, Docker Compose, app/UI/auth/Prisma and mailserver untouched.
- Offline provisioner now stages private keys but refuses public `mail.txt` while no valid root-issued per-domain `escrow.json` receipt exists. Existing private keys/public conflicts remain protected. Admin UI may report a sanitized unavailable status at the first staging request; a later authorized host escrow action must run before retry.
- Root-only host escrow helper uses existing age recipient/identity plus existing protected R2 adapter credentials; conditional-creates immutable domain-specific `readbox/dkim-escrow/v1/` objects. It decrypt-checks local ciphertext, checks complete remote readback and RSA fingerprints, safely resumes lost ACK/crash before receipt; no arbitrary key overwrite, object DELETE or production restore.
- Initial focused [CI #44293943849](https://github.com/JILLU-Games/ReadBox/actions/runs/44293943849) **FAILED** on receipt writer Python SyntaxError; a single scoped repair fixed nested `try` and added explicit readable receipt mode under restrictive host umask. **One necessary focused recheck** [CI #44294483799](https://github.com/JILLU-Games/ReadBox/actions/runs/44294483799) **SUCCESS**: 11 real-age/mock-R2 escrow cases, 8 Docker-embedded agent cases, non-root build smoke and exact Scope Lock PASS.
- **Not performed:** VPS update, live DKIM key generation, actual Cloudflare R2 object write, DNS publishing, host-loss production recovery, production restore, tag or release. Independent offsite custody/recovery of age identity and R2 credentials remains required before real key provisioning; formal stable release stays NO-GO.


## DOMAIN-AUTO-01 — Guarded automatic domain onboarding (2026-11-18)

- **Frozen source:** `952516a2cac27649824bf14329f511eae6ae9294`; clean local `main` at start.
- **Scoped source implementation:** dynamic Cloudflare per-domain zone lookup, strict existing DNS record preflight, additive MX/mail A or AAAA/SPF/DMARC/DKIM publishing, admin-only repair route and one-click default UI. Offline DKIM stage is followed by restricted root-only encrypted R2 escrow action, verified receipt and public-key release.
- **Fail closed:** no DNS overwrite/delete, key rotation or bypass; existing central mail host outside selected zone unchanged. Domain is saved disabled if external automation fails, with sanitized error and safe repair path. Activation only after routing verification; DNS propagation may remain pending.
- **Verification evidence:** see notes/006; focused disposable tests/CI required before code phase closure. No VPS deployment, live DNS writes, production key work, secret updates, migrations, tag or release.
- **Focused local recheck:** after the Windows checkout's missing generated Prisma Client was regenerated, `npm run typecheck` PASS and mocked Node DNS/DKIM tests **14/14 PASS**. Initial typecheck was blocked solely by absent local generated Prisma client; no Prisma schema/source edits. Host Python and GitHub CI acceptance remain unverified until CI.

- **GitHub source focused CI SUCCESS:** [DOMAIN-AUTO-01 #44345525274](https://github.com/vibtoolshq/ReadBox/actions/runs/44345525274), tested source commit `f7b5d7a97aa24274c70f74891e2adf39f2b17bad`. Scope check 17 paths PASS, Next/TypeScript PASS, Node DNS/DKIM 14/14 PASS, Python host-broker 3/3 PASS. No live calls. Source main published; **mirror exact SHA sync BLOCKED** because repositories have separate Git objects and the connected Windows host's GitHub HTTPS access failed. No force update or divergent mirror commit made.


## DNS-FINAL — Primary integration candidate (2026-11-19)

- **Primary authority:** `vibtoolshq/ReadBox`, frozen `main` `46936f7fa9c2fac2d254501ce955fab7c6b476a5`. Candidate source: `JILLU-Games/ReadBox` `ci/domain-auto01-merge` at `1fc33bed704569843a689e22f123a8560af3b049`. The 12 strictly allowlisted DNS-source/test/doc files are copied by exact file content, not by merging 20 candidate commits or 118 unrelated changed paths.
- Integration: explicit admin zone listing/selection, exact active Cloudflare zone validation, immutable domain binding in existing JSON, safe create/repair and idempotent DNS publishing, CAS-protected concurrent DNS verification; existing DKIM escrow/host agent, manual opt-out, application/UI/security contracts preserved.
- One isolated `ci/dns-final-primary` GitHub Linux CI verifies DNS/admin/UI/host-broker and audit. This initial candidate note **does not claim a CI result**. One scoped CI then exact patch/security audit required before any primary `main` update; backup same-SHA synchronization requires explicit remote object/fast-forward verification.
- No Prisma migration, live Cloudflare/R2, VPS, production keys, tag/release, MailStack reference or unrelated source.


- **DNS-FINAL Primary focused CI VERIFIED:** [GitHub Actions #44383278082](https://github.com/vibtoolshq/ReadBox/actions/runs/44383278082), `push` on `ci/dns-final-primary`, tested commit `2eccd8f21cf71261fdc0e0b7ab6199a2a19de4ce`, SUCCESS. `DNS_FINAL_PRIMARY_EXACT_SCOPE_PASS 17`, TypeScript PASS, Node 25/25, zone/domain UI 2 test files PASS, Python bridge PASS, production-only npm audit 0 vulnerabilities. Exact code and focused tests were copied by identical blob SHA from approved JILLU DNS candidate.
- **Final patch scope:** exactly 12 DNS source/test/doc paths, existing dedicated CI workflow and notes/003–006; no 118 other JILLU-changed paths, no historical reference material, release workflow or new auth/Prisma/mailserver code. This closure adds notes only, leaving verified application code unchanged.
- **Publish/sync:** Primary `main` and backup ref updates must be separately observed after this notes closure; never claim parity from this CI alone. Production Cloudflare/R2/DNS/VPS acceptance remains NOT RUN and NO-GO.

---

## 2026-11-19 — PRIMARY re-baseline and finite remaining work (current scoreboard)

| Dimension | Current verified disposition |
|---|---|
| Primary authoritative repository | `vibtoolshq/ReadBox` |
| Primary frozen source SHA / tree | `3dfac11f46165c262c3dc5ddb7e82563a56f9a7f` / `7a07c6d03588096f88d4aad1b1317f0aa3302bcf` |
| Historical R implementation progress | **6/6 source/CI implemented**, 0 old implementation phases remaining |
| New bounded pre-production work packages | **0/4 accepted** — NEXT-01, NEXT-02, NEXT-03, NEXT-04 |
| Original finding ledger | **32 total, 25 CI-contract verified, 7 OPEN** |
| DNS-FINAL source | Primary main contains zone-selection/immutable bind/CAS retry, [main CI #44384108878](https://github.com/vibtoolshq/ReadBox/actions/runs/44384108878) SUCCESS at exact frozen SHA |
| Original DNS-FINAL executable test | `2eccd8f21cf71261fdc0e0b7ab6199a2a19de4ce`; [CI #44383278082](https://github.com/vibtoolshq/ReadBox/actions/runs/44383278082) SUCCESS; closure changed notes only |
| Primary full R06 | [#44384109011](https://github.com/vibtoolshq/ReadBox/actions/runs/44384109011) **SKIPPED** due JILLU-only job condition, NOT a pass |
| Historical complete R06 | [JILLU #44374235430](https://github.com/JILLU-Games/ReadBox/actions/runs/44374235430) SUCCESS on different test-branch SHA; no substitution for Primary |
| Operator historical live evidence | [016](016-LIVE-INBOUND-DEPLOYMENT-ACCEPTANCE.md): one Gmail message and STARTTLS/local backup partially observed Nov 18; independent full acceptance still OPEN |
| Backup parity | **0/2** exact-SHA branches verified; JILLU main `952516a`, MdNurnobi-Dev main `511a773`, both unchanged; permission blocker |
| Production approval | **NO-GO**; no full independent RG-01–17 PASS |

### Required exact ordered next-step ledger

| Work package | Current state | What it will add or verify (NOT current live proof) | Prerequisite / exit evidence |
|---|---|---|---|
| **NEXT-01** Git backup + provenance inventory | **BLOCKED — incomplete 0/2** | Exact Primary SHA stored in both dedicated backup branches; historical AGPL inventory | Write-authorized Git identity, non-force transfer, 2/2 SHA readback; no legal GO |
| **NEXT-02** Primary R06 + Nginx legacy | **PLANNED 0/1** | Read-only R06 eligible on authoritative Primary and scoped Nginx host-template correction | Separately approved minimal source patch, one focused CI, sanitized evidence |
| **NEXT-03** Single-domain Cloudflare/R2 acceptance | **NOT RUN 0/1** | Controlled test-zone MX/A/SPF/DKIM/DMARC, encrypted escrow, public propagation, port/TLS observations | Explicit domain/zone/VPS/operator and additive-write approval; no other zone changes |
| **NEXT-04** End-to-end staging, offsite restore, manual gates | **NOT RUN 0/1** | Independently observed inbound attachment integrity, outages, disaster recovery, legal sign-off, RG-01..17 | Separate staging/live approval and source-SHA-matched evidence; NO-GO until all pass |

**Next approval target:** **NEXT-01 only**; don't conflate a blocked Git backup with lack of DNS source implementation. NEXT-02 or beyond requires new explicit approval, not automatic continuation.

### Documentation-first phase audit record (DOC-READY-20261119)

- **User-requested scope:** re-freeze current Primary source; reconcile 32 original findings, the 2026-11-18 operator observation and latest DNS/CI; produce complete 000–006/README Markdown truth tables, future exact path locks and progress/evidence schema. **No application/config/workflow/test edits**.
- **Current code unchanged:** `src/**`, `deployment/**`, `prisma/**`, `.github/workflows/**`, `scripts/**`, `reference/**`, LICENSE, Docker/Compose, auth and live mailbox volumes are out of scope.
- **Documentation validation required:** all 32 historic `### RB-Pxx-xx —` headings preserved, exactly 17 unique RG table definitions, 6 historical R phase records, 4 prospective NEXT work packages, every referenced current SHA and GitHub run verified; exact changed path list must be docs-only.
- **Evidence closure rule:** record generated documentation-only commit HEAD **separately** from the inspected immutable source SHA. If a branch/ref push fails, mark document phase BLOCKED, not synced/published. No CI job is labeled success unless it actually executed.

---

## NEXT-01 exact Git closure / NEXT-02 blocked attempt — 2026-11-19

**Current Primary main (unchanged):** `1393c48fdc821756213e9c0ca87dd166ee3f6b75`; tree `90b8ab4d7ec2b1965d3aa51fb83c474d6856cb58`. Original R-01..R-06 implementation 6/6 CI-verified; **new NEXT packages 1/4 completed (NEXT-01), NEXT-02 BLOCKED, NEXT-03/04 NOT RUN**. Original release findings 7 OPEN; formal production **NO-GO**.

- **NEXT-01 VERIFIED 2/2:** GitHub readbacks confirm `JILLU-Games/ReadBox` and `MdNurnobi-Dev/ReadBox` dedicated `backup/dns-final-primary-20261119` branches both at exact Primary SHA `1393c48fdc821756213e9c0ca87dd166ee3f6b75`. Their divergent `main` heads remain untouched. Read-only MIT vs AGPL/NOTICE provenance inventory completed; legal clearance `RB-P2-08` remains OPEN.
- **NEXT-02 code candidate:** isolated [Primary draft PR #1](https://github.com/vibtoolshq/ReadBox/pull/1), first commit `a3ce6ac1f2e7621e6a97b894917b535b5f24ac62`; one focused [CI #44505642726](https://github.com/vibtoolshq/ReadBox/actions/runs/44505642726) **FAILED**. The job executed (not SKIPPED), but lint reported four errors: two new scoped R06 test regex style and two in out-of-scope files.
- **One minimal in-scope fix:** corrected those two R06 test regex literal-space formats. Candidate `3adff246beec44c685d8885875a9d94f41dece4a`. Necessary [recheck CI #44505932658](https://github.com/vibtoolshq/ReadBox/actions/runs/44505932658) **FAILED** with exactly two unrelated/out-of-scope lint errors at `src/components/vcon/domain-form.tsx:185:5` (`react-hooks/set-state-in-effect`) and `tests/integration/admin-system-update.test.mjs:94:25` (`no-regex-spaces`). No suppression or unapproved edits applied.
- **NEXT-02 five code/docs candidate paths:** `.github/workflows/r06-production-readiness.yml`, `deployment/templates/nginx/app.conf.tpl`, `tests/integration/r06-release-gate.test.mjs`, new `tests/deployment/readbox-nginx-template-contract.test.mjs`, `docs/RELEASE-GOVERNANCE.md`; this record updates only notes/003–006.
- **Verified by CI:** runner checkout, dependency install, Prisma validate and actual lint invocation. **NOT executed/passed:** typecheck, new Nginx tests, remaining app/isolated SMTP/PostgreSQL/restore/full R06 release gates.
- **Source main publish and backup promotion WITHHELD:** mandatory CI failed; Primary and both backup refs remain at `1393c48...`; no VPS, secrets, DNS/R2, SMTP, release/tag or backup-main changes.
- **Required next authorization:** smallest NEXT-02/BLOCKER-LINT-01 exception covering ONLY the two failing files above, preserving domain UI behavior and update test semantics. One bounded recheck and scope audit then normal closure; do not silently start NEXT-03.

---

## NEXT-02 / BLOCKER-LINT-01 authorized fix and Primary R06 recheck — 2026-11-19

**Original Primary main stays** `1393c48fdc821756213e9c0ca87dd166ee3f6b75`. NEXT-01 exact backup synchronization **2/2 PASS** remains current. Original R-01–R-06 = 6/6 CI-implemented historically; remaining NEXT work packages: **NEXT-01 completed (1/4), NEXT-02 BLOCKED, NEXT-03/04 NOT RUN**. All 7 original release findings remain OPEN; production NO-GO.

- **User-approved exact two-file exception implemented** in isolated candidate `7ed2997d110ed30a6ec5dd901eff67bce1904c5f`: `src/components/vcon/domain-form.tsx` initializes `zoneLoading` from existing `databaseConfigured` and removes synchronous effect `setZoneLoading(true)` (Cloudflare fetch, error, completion and UI remain); `tests/integration/admin-system-update.test.mjs` replaces two regex spaces with `{2}`, no updater behavior change.
- **Focused Primary R06 CI [#44507511633](https://github.com/vibtoolshq/ReadBox/actions/runs/44507511633): FAILED overall at source SHA `7ed2997d...`.** Exact successful steps: complete app regression including lint, lint baseline, TypeScript, Node/UI tests, new Nginx negative contract tests and Next.js production build (`R06_APP_UI_AUTH_PROVENANCE_AND_NEGATIVE_GATES_PASS`); production `npm audit --omit=dev` found zero vulnerabilities (`R06_DEPENDENCY_AUDIT_PASS`).
- **New CI environment root cause:** `scripts/testing/r06-ephemeral-postgres.sh:5-8` explicitly requires `GITHUB_REPOSITORY=JILLU-Games/ReadBox` and `GITHUB_ACTIONS=true`; correct Primary context is `vibtoolshq/ReadBox`. PostgreSQL script emitted `R06: refusing non-CI PostgreSQL integration target`, exit 2 **before any ephemeral PostgreSQL start/migration**. `scripts/testing/r06-smtp-rehearsal.sh:6-9` has an identical old-JILLU allowlist; that step did **not** run after PostgreSQL failure. No database/SMTP failure observed.
- **NEXT-02/BLOCKER-R06-GUARD-02 (NEW, requires separate exact permission):** allow modifying **only** `scripts/testing/r06-ephemeral-postgres.sh` and `scripts/testing/r06-smtp-rehearsal.sh` guard predicates to accept the actual authoritative Primary (`vibtoolshq/ReadBox`) while preserving strict `GITHUB_ACTIONS=true`, fail-closed behavior, disposable target validation and every test body. **Do not** set a fake `GITHUB_REPOSITORY` environment variable; that would bypass the security boundary. One focused Primary R06 recheck after approval; if new failure, stop rather than unapproved changes.
- **Scope audit:** current candidate changes remain original NEXT-02 approved five source/test/docs paths plus user-approved two lint paths; this ledger update touches notes/003–006 only. No production-source promotion or backup sync on failed CI. Both dedicated backup branches remain exactly at original Primary `1393c48...`. No VPS, live DNS/R2/SMTP, secret, tag, release or force-push.

---

## 2026-11-19 — NEXT-02 FINAL CI-PASS closure (authoritative update after earlier BLOCKED attempts)

**ReadBox NEXT-02 Primary R06 + legacy Nginx — SOURCE/CI COMPLETE at code SHA `4d0b124af57c8d407bf609540b8b8b7a69a479b5` (Git tree `136c011b54687017aedaf35fd35397afaf1824b6`).** Focused disposable Primary R06 [run #44509947742](https://github.com/vibtoolshq/ReadBox/actions/runs/44509947742) finished **SUCCESS** and `consolidated-acceptance` job actually ran (not SKIPPED). This latest closure **supersedes the earlier NEXT-02 BLOCKED attempt status** in historical entries above. Release remains `NO_GO` because 7 original release findings remain OPEN; the 17 human staging gates are not independently accepted.

**Approved exact scope:** Original NEXT-02 allowlist plus separately approved lint-only files `src/components/vcon/domain-form.tsx` and `tests/integration/admin-system-update.test.mjs`, plus separately approved CI guard-only scripts `scripts/testing/r06-ephemeral-postgres.sh` and `scripts/testing/r06-smtp-rehearsal.sh`. Total **13 changed paths including notes/003–006**. No edit to `notes/002`, application auth, Prisma schema/migrations, Compose, mailserver, actual production services, DNS/DKIM/R2, `reference/MailStack`, `.github/workflows/readbox-first-release.yml`, release tags or secrets.

**Implemented and CI verified:** Primary `github.repository` R06 job guard; removal of four literal shell `\\n` sequences so lint/TypeScript commands run; matching `readbox_web` upstream/cache and `/var/log/readbox` host Nginx config; read-only negative security/static Nginx tests; behavior-preserving zone loading initial state and Admin Update regex format; both R06 wrappers now require `GITHUB_ACTIONS=true` **and** the actual `GITHUB_REPOSITORY=vibtoolshq/ReadBox` (other/non-CI identities exit 2); existing disposal/SMTP body unchanged.

**One approved guard-fix focused verification:** [R06 CI #44509947742](https://github.com/vibtoolshq/ReadBox/actions/runs/44509947742) **SUCCESS**: `R06_APP_UI_AUTH_PROVENANCE_AND_NEGATIVE_GATES_PASS`, `R06_DEPENDENCY_AUDIT_PASS`, `R06_EPHEMERAL_POSTGRES_TARGET_GUARDED_INTEGRATION_PASS`, `R06_ORIGINAL_R03_FULL_SMTP_LMTP_NEGATIVES_PASS`, `R06_ENCRYPTED_BACKUP_RESTORE_ROLLBACK_PASS`, `R06_QIS01_IMMUTABLE_SCOPE_AUDITS_PASS`, `R06_ALL_CI_CONTRACTS_PASS_PRODUCTION_NO_GO`. Source code, test and static host template passed in disposable GitHub runner; actual Nginx host config/TLS and offsite restore are **not independently live-tested**.

**Security/exact diff audit:** 13/13 approved paths; the two new CI script diffs are a **single literal repository-name replacement each**, preserving secure `GITHUB_ACTIONS` guard, `exit 2`, ephemeral local PostgreSQL target and SMTP negatives. Root 32 findings and 17 formal release-gate definitions preserved; added secret-pattern audit found no matches. The final documentation-only closure commit follows tested code SHA as a separate provenance step; no claim that a notes-only successor SHA was itself rerun through R06.

**Post-CI required ref verification:** After source-only non-force Primary fast-forward, update **only** `backup/dns-final-primary-20261119` on both backup repos to exact new Primary SHA without force. Their independent main branches must stay unchanged. For a credential/object-transfer failure record **BACKUP-SYNC BLOCKED**, never claim parity until both remote SHA reads match. NEXT-03 remains separately approval-gated; no production GO.

---

## Documentation-first current phase ledger — 2026-11-19 (pending notes-only commit)

**Source freeze (2026-11-19 Asia/Dhaka):** authoritative `vibtoolshq/ReadBox/main` 6f3bc1e3aeb441956e1fd0f4d81558a6aba2945f; tree `f82b07b6e0770850edd3431f041d5162848d442a`. Last full disposable Primary R06 CI ran against executable code 4d0b124af57c8d407bf609540b8b8b7a69a479b5: [run #44509947742](https://github.com/vibtoolshq/ReadBox/actions/runs/44509947742), SUCCESS. Compare 4d0b124af57c8d407bf609540b8b8b7a69a479b5..6f3bc1e3aeb441956e1fd0f4d81558a6aba2945f: **one documentation-only commit changing notes/003–006**, no executable change. At freeze time both dedicated backup refs `backup/dns-final-primary-20261119` matched 6f3bc1e3aeb441956e1fd0f4d81558a6aba2945f (2/2); backup repositories' separate `main` branches did not. **This new notes-only commit will advance Primary HEAD beyond the freeze; do not claim backup parity at that new HEAD without a new remote readback.** Historical source snapshots below are preserved and must not be mistaken for current source. Production remains **NO-GO**: 32 original findings, 25 CI-contract verified and 7 OPEN; 17 independently accepted production gates not evidenced. Historical R-01–R-06: 6/6 CI implemented. NEXT-01 and NEXT-02: 2/4 completed; NEXT-03 and NEXT-04: 2/4 pending.

| Track | Completed | Remaining | Current accepted outcome |
|---|---:|---:|---|
| Historic R source/CI implementation | 6/6 | 0 | Source CI completed; not a release GO |
| NEXT readiness work packages | 2/4 | 2/4 | NEXT-01 backup parity at input SHA; NEXT-02 source/CI closed at 4d0b124af57c8d407bf609540b8b8b7a69a479b5 |
| **Phase-01 = NEXT-03** | 0/1 | 1 | Test-domain Cloudflare/R2/DNS/TLS: NOT RUN / approval required |
| **Phase-02 = NEXT-04** | 0/1 | 1 | Independent staging delivery/restore/legal 17 gates: NOT RUN / approval required |
| Original release findings | 25/32 CI-contract verified | 7 OPEN | Production NO-GO |

**THIS DOCUMENTATION UPDATE:** only `notes/**`; no application code/CI workflow change; historical evidence preserved; no app tests or live probes executed here. Exact documentation commit SHA, changed-path readback and backup parity after publication must be appended/verified separately, not invented in advance. Future completion records must use [018](018-PHASE-EXECUTION-AND-CLOSURE-TEMPLATE.md); next separately approved step is **Phase-01 / NEXT-03**.
