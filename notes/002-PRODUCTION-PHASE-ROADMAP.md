# 002 — ReadBox Production Bugfix Roadmap (Exactly 6 Scope-Locked Phases)

> **LATEST USER-SCOPED CHANGE (2026-11-19):** For the requested **Manual Mode checkbox**, the implementation roadmap is a **single Manual Mode Phase-01** at [notes/manual-mode/002](manual-mode/002-PHASE-ROADMAP-AND-SCOPE-LOCK.md), frozen source 2f1d16b2cd373cd332e79ddae2ef771deaf52928. This is separate from historical NEXT-03/NEXT-04 production live acceptance (which may still require independent R2/host/release gates); do not treat the older phrase 'Phase-01 == NEXT-03' in this dated archive as current Manual Mode implementation instruction. Source edits remain forbidden until a new explicit Phase-01 approval.


> **LATEST AUTHORITATIVE RECONCILIATION — 2026-11-19.** **Source freeze (2026-11-19 Asia/Dhaka):** authoritative `vibtoolshq/ReadBox/main` 6f3bc1e3aeb441956e1fd0f4d81558a6aba2945f; tree `f82b07b6e0770850edd3431f041d5162848d442a`. Last full disposable Primary R06 CI ran against executable code 4d0b124af57c8d407bf609540b8b8b7a69a479b5: [run #44509947742](https://github.com/vibtoolshq/ReadBox/actions/runs/44509947742), SUCCESS. Compare 4d0b124af57c8d407bf609540b8b8b7a69a479b5..6f3bc1e3aeb441956e1fd0f4d81558a6aba2945f: **one documentation-only commit changing notes/003–006**, no executable change. At freeze time both dedicated backup refs `backup/dns-final-primary-20261119` matched 6f3bc1e3aeb441956e1fd0f4d81558a6aba2945f (2/2); backup repositories' separate `main` branches did not. **This new notes-only commit will advance Primary HEAD beyond the freeze; do not claim backup parity at that new HEAD without a new remote readback.** Historical source snapshots below are preserved and must not be mistaken for current source. Production remains **NO-GO**: 32 original findings, 25 CI-contract verified and 7 OPEN; 17 independently accepted production gates not evidenced. Historical R-01–R-06: 6/6 CI implemented. NEXT-01 and NEXT-02: 2/4 completed; NEXT-03 and NEXT-04: 2/4 pending. Detailed, immutable code excerpts and line links: [017](017-CURRENT-FORENSIC-PATCH-REFERENCES-2026-11-19.md); executable step/closure contract: [018](018-PHASE-EXECUTION-AND-CLOSURE-TEMPLATE.md). Earlier dated statements are retained as history, not latest status.


> **CURRENT PLAN (2026-11-19):** The **original six R-01–R-06 source implementation phases are 6/6 CI-verified**; they are retained below unchanged as historical plan. New **exactly FOUR remaining finite readiness work packages NEXT-01–NEXT-04** are defined at the end of this file using Primary `vibtoolshq/ReadBox` baseline `3dfac11f46165c262c3dc5ddb7e82563a56f9a7f`. **0/4** NEXT work packages are completed/approved. These are NOT retroactively a seventh historical implementation phase. Each requires its own explicit approval, one focused verification and no scope expansion. Production release stays NO-GO.


**Frozen baseline:** `e28886e5e0f7a155cd64e23bc8ee8f6668d6699c`.
**Finding source:** [001-PRODUCTION-RELEASE-BLOCKERS.md](001-PRODUCTION-RELEASE-BLOCKERS.md) and the earlier forensic report.
**Status:** R-01 through R-06 IMPLEMENTATION VERIFIED (CI); `6/6` implementation scopes complete, 0 implementation phases remaining. Final R-06 staging acceptance is BLOCKED (no live authorization/evidence), 7 original findings OPEN, production NO-GO.

## Implementation sequencing and shared controls

Implement **R-01 → R-02 → R-03 → R-04 → R-05 → R-06** in sequence only after the user separately requests each phase. Dependencies matter; no parallel edits to `docker-compose.yml` or shared runtime modules. The phase list is exactly SIX—no indefinite micro-phases or endless test loops. A new finding cannot silently trigger extra work. Existing features/UI, mailbox data, auth behavior and one-PostgreSQL architecture remain preserved except for precisely documented bugs. Each phase allows one focused CI verification, patch audit, commit, authorized push and mirror-SHA equality check.

## Phase summary

| Phase | Scope focus | Owner findings | Status |
|---|---|---:|---|
| R-01 | Deployment foundation + reproducibility | 7 | VERIFIED CLOSED (CI) |
| R-02 | PostgreSQL/Postfix SQL and Maildir identity | 4 | VERIFIED CLOSED (CI; authorized readiness exception) |
| R-03 | Inbound SMTP/LMTP mailserver and DNS/TLS | 6 | CI IMPLEMENTATION VERIFIED CLOSED; 2 external acceptance findings OPEN for R-06 |
| R-04 | Operator bootstrap and fail-closed runtime health | 6 | CI VERIFIED CLOSED |
| R-05 | Backup/restore, upgrade and operations safety | 6 | CI IMPLEMENTATION VERIFIED CLOSED; 4 CI findings closed, 2 OPEN code/external acceptance |
| R-06 | Full production acceptance and release governance | 3 | CI IMPLEMENTATION VERIFIED; LIVE STAGING/FINAL ACCEPTANCE BLOCKED, all 3 owned findings OPEN |

**Total:** 32 finding assignments / 32 unique original IDs; all 32 covered once.

## R-01 — Deployment foundation + reproducibility

**Position:** 1/6 · **Prerequisite:** 000 frozen baseline · **Current state:** VERIFIED CLOSED (CI).

**Owned findings (single owner):** `RB-P0-01`, `RB-P1-01`, `RB-P1-02`, `RB-P1-14`, `RB-P1-15`, `RB-P2-03`, `RB-P2-09`.

**Target behavior:** Production/dev Compose selection; standalone/Coolify secrets; URL-safe DB auth; reproducible image/deps and advisory audit; accurate quick-start documentation.

### Exact Scope Lock — ALLOW

- `compose.yaml (development isolation only)`
- `docker-compose.yml (service selection, env and DB URL interpolation only)`
- `Dockerfile`
- `.dockerignore`
- `.env.example`
- `README.md`
- `package.json`
- `package-lock.json`
- `tests/deployment/** (new focused tests only)`
- `notes/**`

### Exact Scope Lock — DENY

- src/app/** and src/components/** UI/routes
- src/core/auth/** authentication policy
- prisma/migrations/** and schema rewrite
- Postfix/Dovecot SMTP behavior
- unrelated refactoring

### Exit gate (one focused verification)

One GitHub CI focused run with explicit Compose config validation, missing-secret negative test, npm ci, security/advisory evidence and production Docker image build; preserve 237 baseline tests as appropriate.

**Closure:** One focused test run on phase candidate SHA → patch/diff path audit → preserve baseline UI/routes/auth/data/regression → inspect outcome/negative cases → log CI URL and SHA in `003` → update `004`, `005`, `006` → approved source commit and target fast-forward equal SHA. Any failed gate = OPEN/BLOCKED, never silently continue.

**New issues:** Record forensic proof in `001` as candidate but do not expand the active phase or add an extra phase without explicit scope approval.

## R-02 — PostgreSQL/Postfix SQL and Maildir identity

**Position:** 2/6 · **Prerequisite:** R-01 VERIFIED CLOSED · **Current state:** VERIFIED CLOSED (CI; specifically approved RB-P2-04 readiness exception).

**Owned findings (single owner):** `RB-P0-03`, `RB-P0-04`, `RB-P1-08`, `RB-P2-04`.

**Target behavior:** Single-DB virtual SQL routing with least privilege, migration parity, Maildir owner/UID/GID/ACL consistency.

### Exact Scope Lock — ALLOW

- `prisma/schema.prisma (only documented compatible additions)`
- `prisma/migrations/<new_timestamp>_*.sql (append-only; old files immutable)`
- `src/core/mailserver/pg-adapter.ts`
- `src/core/mailboxes/paths.ts`
- `src/core/mailboxes/provisioning.ts`
- `src/core/mailboxes/service.ts`
- `deployment/templates/postfix/*.cf.tpl`
- `deployment/templates/dovecot/99-vibmail.conf.tpl`
- `docker-compose.yml (PostgreSQL and volume identity sections only)`
- `tests/postfix/**`
- `tests/schema/**`
- `tests/admin/** (only mailbox contract tests)`
- `notes/**`

### Exact Scope Lock — DENY

- new database engine/second database
- old migration edits/rebase
- UI/UX changes and unrelated mailbox features
- live mailbox deletion
- external DNS/public SMTP changes

### Exit gate (one focused verification)

One focused CI integration run on disposable PostgreSQL: migration twice and parity, virtual map valid/invalid queries, Postfix LOGIN role least privilege, representative Maildir UID/GID permissions; no production data.

**Closure:** One focused test run on phase candidate SHA → patch/diff path audit → preserve baseline UI/routes/auth/data/regression → inspect outcome/negative cases → log CI URL and SHA in `003` → update `004`, `005`, `006` → approved source commit and target fast-forward equal SHA. Any failed gate = OPEN/BLOCKED, never silently continue.

**New issues:** Record forensic proof in `001` as candidate but do not expand the active phase or add an extra phase without explicit scope approval.

## R-03 — Inbound SMTP/LMTP mailserver and DNS/TLS

**Position:** 3/6 · **Prerequisite:** R-02 VERIFIED CLOSED · **Current state:** CI IMPLEMENTATION VERIFIED CLOSED (external trusted TLS/DNS/public port evidence deferred to R-06's explicitly required live staging gates).

**Owned findings (single owner):** `RB-P0-02`, `RB-P0-05`, `RB-P1-09`, `RB-P1-10`, `RB-P2-05`, `RB-P2-06`.

**Target behavior:** Supported Postfix/Dovecot installation/integration, port and socket contract, documented DNS/TLS/DKIM boundaries; inbound-only vs other capabilities explicit.

### Exact Scope Lock — ALLOW

- `docker-compose.yml (mailservice/ingress section only)`
- `deployment/templates/postfix/**`
- `deployment/templates/dovecot/**`
- `deployment/templates/nginx/app.conf.tpl`
- `deployment/mailserver/** (new)`
- `deployment/templates/opendkim/** (new, if signing within approved scope)`
- `src/core/dns/opendkim.ts`
- `src/core/dns/records.ts`
- `src/core/dns/resolver.ts`
- `src/core/domains/service.ts`
- `tests/mailserver/** (new)`
- `tests/dns/** (new)`
- `notes/**`

### Exact Scope Lock — DENY

- new outbound SMTP/IMAP service without explicit approval
- DNS provider API mutations or real DNS credentials
- general UI redesign/auth rewrite
- second DB/schema fragmentation
- live VPS changes without separate authorization

### Exit gate (one focused verification)

One disposable SMTP→LMTP→Maildir integration test including invalid recipient rejection, Postfix/Dovecot config lint, TLS setup and advisory DNS checks. Live public port/MX/PTR remains final staging evidence.

**Closure:** One focused test run on phase candidate SHA → patch/diff path audit → preserve baseline UI/routes/auth/data/regression → inspect outcome/negative cases → log CI URL and SHA in `003` → update `004`, `005`, `006` → approved source commit and target fast-forward equal SHA. Any failed gate = OPEN/BLOCKED, never silently continue.

**New issues:** Record forensic proof in `001` as candidate but do not expand the active phase or add an extra phase without explicit scope approval.

## R-04 — Operator bootstrap and fail-closed runtime health

**Position:** 4/6 · **Prerequisite:** R-03 VERIFIED CLOSED · **Current state:** CI VERIFIED CLOSED (one clean PostgreSQL, admin/health negatives, existing UI regression).

**Owned findings (single owner):** `RB-P1-03`, `RB-P1-04`, `RB-P1-05`, `RB-P1-06`, `RB-P1-07`, `RB-P2-10`.

**Target behavior:** First admin setup, consistent user/admin source, worker heartbeat and readiness gates, actionable errors for outages and recovery.

### Exact Scope Lock — ALLOW

- `scripts/auth/operator.ts`
- `src/core/auth/operator-bootstrap.ts (bootstrap defect only)`
- `src/core/setup/trusted-operations.ts`
- `src/core/setup/lifecycle.ts (verified setup contract only)`
- `src/core/health/snapshot.ts`
- `src/app/health/**`
- `src/workers/ingestion.ts`
- `src/core/ingestion/service.ts (only heartbeat/error paths)`
- `entrypoint.sh (startup/first-admin handoff only)`
- `docker-compose.yml (healthcheck section only)`
- `tests/setup/**`
- `tests/auth/** (operator case only)`
- `tests/admin/** (health case only)`
- `notes/**`

### Exact Scope Lock — DENY

- change to login UI/layout/colors
- auth bypass/access weakening
- unrelated core auth refactor
- mailserver network redesign
- real user data mutation

### Exit gate (one focused verification)

One focused CI run with clean PostgreSQL and temporary Maildir: bootstrap once, reject duplicate, verify same admin table, broken DB/worker/mail storage fail closed, recovery works; preserve current auth/UI tests.

**Closure:** One focused test run on phase candidate SHA → patch/diff path audit → preserve baseline UI/routes/auth/data/regression → inspect outcome/negative cases → log CI URL and SHA in `003` → update `004`, `005`, `006` → approved source commit and target fast-forward equal SHA. Any failed gate = OPEN/BLOCKED, never silently continue.

**New issues:** Record forensic proof in `001` as candidate but do not expand the active phase or add an extra phase without explicit scope approval.

## R-05 — Backup/restore, upgrade and operations safety

**Position:** 5/6 · **Prerequisite:** R-04 VERIFIED CLOSED · **Current state:** CI IMPLEMENTATION VERIFIED CLOSED (disposable encrypted backup→restore→post-DB-apply rollback; out-of-scope Nginx and real offsite retention remain OPEN).

**Owned findings (single owner):** `RB-P1-11`, `RB-P1-12`, `RB-P1-13`, `RB-P2-01`, `RB-P2-02`, `RB-P2-07`.

**Target behavior:** Container-aware and host-aware backup/restore, secret protection, downtime consistency, UID/ACL restore, updater repo correctness and rollback.

### Exact Scope Lock — ALLOW

- `scripts/ops/backup.sh`
- `scripts/ops/restore.sh`
- `scripts/updater/**`
- `src/core/updates/service.ts`
- `deployment/templates/systemd/**`
- `deployment/operations/** (new)`
- `docker-compose.yml (persistent volumes, health and backup only)`
- `tests/operations/** (new)`
- `notes/**`

### Exact Scope Lock — DENY

- production destructive restore or deleting mail
- modifying source app/UI/features
- mailserver user/SQL schema redesign
- automatically publishing releases

### Exit gate (one focused verification)

One isolated backup→restore→rollback rehearsal with checksums, DB/Maildir parity, UID/GID/ACL and confidential config checks; log any SMTP downtime and recovery.

**Closure:** One focused test run on phase candidate SHA → patch/diff path audit → preserve baseline UI/routes/auth/data/regression → inspect outcome/negative cases → log CI URL and SHA in `003` → update `004`, `005`, `006` → approved source commit and target fast-forward equal SHA. Any failed gate = OPEN/BLOCKED, never silently continue.

**New issues:** Record forensic proof in `001` as candidate but do not expand the active phase or add an extra phase without explicit scope approval.

## R-06 — Full production acceptance and release governance

**Position:** 6/6 · **Prerequisite:** R-05 VERIFIED CLOSED · **Current state:** CI IMPLEMENTATION VERIFIED; live staging/real release GO BLOCKED, all three R-06-owned findings OPEN.

**Owned findings (single owner):** `RB-P0-06`, `RB-P1-16`, `RB-P2-08`.

**Target behavior:** Final GitHub CI and separately approved staging VPS evidence: real inbound mail, DNS/TLS, runtime integration, negative tests, backup/restore, licensing and formal GO/NO-GO.

### Exact Scope Lock — ALLOW

- `.github/workflows/** (new final CI/release gates only)`
- `scripts/testing/**`
- `tests/integration/** (new)`
- `README.md (validated installation instructions only)`
- `SECURITY.md (security disclosure updates only)`
- `docs/** (deployment and provenance evidence only)`
- `notes/**`

### Exact Scope Lock — DENY

- new application features or UI refactor
- new framework major-version migration not required by finding
- unreviewed license deletion or editing third-party reference LICENSE/NOTICE
- live mail send/server changes without separate approval
- releasing/tagging/publishing without explicit final approval

### Exit gate (one focused verification)

One consolidated CI regression/release-gate run plus authorized staging VPS acceptance (external SMTP→LMTP→Maildir→UI, inbound attachments, TLS/DNS/port, auth, worker outages, reboot, backup restore, negative tests); only evidence-backed GO.

**Closure:** One focused test run on phase candidate SHA → patch/diff path audit → preserve baseline UI/routes/auth/data/regression → inspect outcome/negative cases → log CI URL and SHA in `003` → update `004`, `005`, `006` → approved source commit and target fast-forward equal SHA. Any failed gate = OPEN/BLOCKED, never silently continue.

**New issues:** Record forensic proof in `001` as candidate but do not expand the active phase or add an extra phase without explicit scope approval.


## Final release condition

`R-06` must not claim production GO until all `006` gates and outstanding findings have recorded evidence at the actual release SHA plus live staging VPS checks. Existing CI's 237 tests are an initial regression baseline only, not an SMTP deployment proof. Do not run live services, edit source, create tags or publish releases on the authority of this planning document.

### R-01 implementation verification

- The seven R-01 owned findings are CI closed. Source code commit: `113663cdabacf1460af5b06a334d99ab3db833c2`.
- Scoped checks: https://github.com/JILLU-Games/ReadBox/actions/runs/44093204590 (Docker, secrets, npm audit), https://github.com/JILLU-Games/ReadBox/actions/runs/44092311120 (167 unit/70 UI, app build).
- No `src/`, UI/UX, business logic, Prisma migration or mailserver template changes. Next scope: **R-02** after explicit approval.

## R-02 historical scope conflict (resolved by subsequent explicit approval)

- Code SHA: `e1efdbd0b0380a94152947f7be47eb17c5c8d70c`. CI https://github.com/JILLU-Games/ReadBox/actions/runs/44099280332 PASS: repeatable single PostgreSQL migrations; Postfix role positive/negative queries; file ownership and Compose contract checks.
- Exact change allowlist respected. `src/core/health/snapshot.ts` was NOT edited; health migration history check therefore remains incomplete (`RB-P2-04` OPEN).
- Prerequisite to call R-02 VERIFIED CLOSED: explicit approval for a bounded migration-readiness correction in the existing R-04-owned health source, or an approved change to the roadmap assigning that residual finding to R-04. Without that decision R-03 is planned but its R-02 prerequisite is not fulfilled.

## R-02 final closure after bounded exception — supersedes historical BLOCKED state

- User explicitly approved only `RB-P2-04` migration parity enforcement inside `src/core/health/snapshot.ts` and targeted health tests; all other R-02 finding contracts remained unchanged.
- Verified code SHA: `b6ab76119a31f9bf4e81b3990a5fcc6d802a6892`. Focused CI: https://github.com/JILLU-Games/ReadBox/actions/runs/44102834169 (Prisma validation, TypeScript, 10 health tests, 3 R-02 parity tests, Next production build, file Scope Lock audit). Earlier PostgreSQL integration: https://github.com/JILLU-Games/ReadBox/actions/runs/44099280332.
- All four R-02 findings CI VERIFIED CLOSED; total completed phases **2/6**. Next approved sequence remains **R-03 → R-04 → R-05 → R-06**, requiring separate approval per phase.
- No UI/auth/other feature or old migration changes. Real mailserver/staging GO still **NO-GO**.

## R-03 phase closure and bounded production acceptance deferral (2026-11-17)

- Implemented exactly approved R-03 paths: opt-in Compose mailserver profile; Postfix config/image/renderer and TLS fail-close; Dovecot private LMTP image/config; disposable SMTP→LMTP→Maildir acceptance script; DNS advisory tests and installation contract. **No application UI/auth/source feature or existing database migration changed.**
- CI https://github.com/JILLU-Games/ReadBox/actions/runs/44107205810 SUCCESS, tested patch SHA `d0f3272ea298de012da83c6f01b588fa0513d1da` (published code SHA without temporary CI workflow). Valid sender and real mailbox delivered; unknown recipient/nonlocal relay rejected; STARTTLS and absent certificate negative passed.
- R-03 implementation can close based on its documented exit gate, which explicitly defers **real public TCP/25, MX/PTR and trusted TLS** to R-06 staging. Accordingly `RB-P1-09`, `RB-P1-10` remain OPEN external release gates, not falsely claimed as solved. `RB-P0-02`, `RB-P0-05`, `RB-P2-05`, `RB-P2-06` CI CLOSED.
- **Phases complete 3/6, remaining 3 (R-04→R-05→R-06)**; production GO/NO-GO stays **NO-GO** until external verification. No new micro-phase added.

## R-04 verified closure (2026-11-17)

- Exactly documented R-04 allowlist: CLI bootstrap `scripts/auth/operator.ts`, additive bootstrap helper in `src/core/auth/operator-bootstrap.ts`, setup inspector `src/core/setup/trusted-operations.ts`, snapshot health `src/core/health/snapshot.ts`, ingestion worker initial failure heartbeat, `docker-compose.yml` worker **healthcheck section only**, and narrow setup/admin test files. **No app UI/layout/route, credential authorization policy or unrelated feature edited.**
- Focused CI https://github.com/JILLU-Games/ReadBox/actions/runs/44112634511 SUCCESS; committed code SHA `88e57e2e81dc07a8f91b07f448df85e51d58e429`. Prisma migrations, types, existing unit/backend/UI 70/70, build; real disposable PostgreSQL bootstrap once+duplicate refusal+inspector identity; worker/storage outage negatives and recovery; strict diff audit.
- Production operator bootstrap remains an **explicit interactive one-shot** and never auto-creates insecure default credentials; see `notes/012-R04-PATCH-AUDIT.md` for command and approval boundary. Any live VPS installation and password activation require separate authorization.
- App readiness does **not** measure public Postfix/LMTP acceptability, DNS, TLS or mail delivery; R-06 remains an independent public acceptance gate. **Phases 4/6 completed, 2 remaining (R-05 → R-06).**

## R-05 closure boundary — 2026-11-17

- Verified 13 code/config/test paths inside exact approved R-05 allowlist, plus a one-time temporary CI workflow excluded from published main. Successful focused CI https://github.com/JILLU-Games/ReadBox/actions/runs/44121121316; published code SHA `a55ec82bb2f58804e910427c66ff6352cd5c14c6`.
- Confidential backups use age public-key encryption; only encrypted artifact leaves a private 0700 staging area; `0600` output, SHA-256 integrity, manual maintenance freezes active writers (including SMTP), and preserved Postfix queue/DB/Maildir/ACL. **Not an online snapshot**; no inbound email is accepted while an active Postfix is intentionally stopped.
- CI demonstrably restored both PostgreSQL schemas and volume contents, rejected tampering, and automatically rolled back from an injected **post-database-apply** error. Host/systemd updater rollback code passed syntax/static checks only; no host upgrade was performed.
- `RB-P2-01` **OPEN**: Nginx templates/legacy filenames cannot be changed in R-05 Scope Lock; requires a separate explicitly authorized exception, potentially before R-06 production GO. `RB-P2-07` **OPEN**: offsite backup transfer, retention, key custody and actual VPS/host restore evidence not yet available. Do not silently reassign or close these findings.
- **5/6 phases implemented/CI verified, 1 remaining, 25/32 findings CI verified, 7 still OPEN, production NO-GO.** Next R-06 is final acceptance/governance and must not assume real VPS tests without separate authorization.

## R-06 implementation closeout, external acceptance still blocked (2026-11-17)

- Verified source code SHA `807ca9f38adb02db2a8b73dc0901fce23ee5e63a`, consolidated full-stack disposable CI https://github.com/JILLU-Games/ReadBox/actions/runs/44127481624. Exactly 11 published allowed workflow/scripts/testing/tests/integration/README/SECURITY/docs paths; no app/UI/auth/migration/mailserver runtime file or reference LICENSE/NOTICE modified. The read-only final workflow has no tags/releases/DNS/VPS/production credentials and explicitly outputs `R06_PRODUCTION_NO_GO`.
- Existing app regression, production npm dependency audit, guarded tmpfs PostgreSQL migration/auth integration, Docker image boot and loopback SMTP→LMTP→Maildir, recipient/relay rejection, encrypted backup/restore and forced post-DB rollback, provenance marker tests and 11-path patch audit all PASS.
- Two **pre-existing R-04 lint errors** inside `src/core/setup/trusted-operations.ts` were *not fixed* (outside R-06 Scope Lock). Rest of the tree linted; an exact negative baseline check refuses any extra error. The full lint gate and live RG-01–RG-17 remain NO-GO.
- Implementation phase count **6/6**; this is **not** final staging/release acceptance. No actual VPS or independent DNS/TLS/public SMTP/user inbox/offsite/host recovery/legal approval, and original 7 findings still OPEN. R-06 exit conditions requiring authorized live staging are **NOT MET**. Only a separately approved staging acceptance and explicit exceptions for legacy template paths and old lint source can change that fact; no automatic new phase or production release.

---

## CURRENT remaining production readiness roadmap — four bounded NEXT work packages (2026-11-19)

**Authority and freeze:** Primary `vibtoolshq/ReadBox/main` `3dfac11f46165c262c3dc5ddb7e82563a56f9a7f`; tree `7a07c6d03588096f88d4aad1b1317f0aa3302bcf`. Old R-01–R-06 = 6/6 source-CI completed; remaining four NEXT work packages = **0/4 accepted** as of this audit. Seven original external/code release findings remain OPEN. See current [001](001-PRODUCTION-RELEASE-BLOCKERS.md) supplement and [016](016-LIVE-INBOUND-DEPLOYMENT-ACCEPTANCE.md) for limited operator-observed live evidence.

| Order | Work package | Why now | Owner IDs | Current state |
|---|---|---|---|---|
| 1 | **NEXT-01 / BACKUP-AND-PROVENANCE-PREFLIGHT** | Fix Git SHA parity evidence, avoid backup-main release trigger; collect AGPL provenance inventory | RN-02, RN-04, RB-P2-08 (inventory only) | **BLOCKED by write access / no legal sign-off** |
| 2 | **NEXT-02 / PRIMARY-CI-AND-LEGACY-TEMPLATE-SAFETY** | Make read-only R06 test eligible on authoritative Primary; narrowly correct proven legacy Nginx path/name | RN-01, RB-P2-01, RB-P1-16 (CI only) | **PLANNED — separate source-edit approval needed** |
| 3 | **NEXT-03 / GUARDED-DNS-R2-TLS-PREFLIGHT** | Verify one test domain's actual Cloudflare DNS/DKIM escrow, public port and TLS without touching other domains | RB-P1-09, RB-P1-10, RB-P2-07 (R2 custody preflight), RN-05 | **NOT RUN — separate named-domain/host approval needed** |
| 4 | **NEXT-04 / STAGING-DELIVERY-RECOVERY-AND-HUMAN-GO-REVIEW** | Independently check full inbox/attachment, failure recovery, offsite restore and all 17 formal release gates | RB-P0-06, RB-P1-16, RB-P2-07, RB-P2-08, RG-01..17 | **NOT RUN — separate staging approval and qualified review needed** |

**Completion counting rule:** R-01–R-06 source phases stay **6/6**. NEXT gates are a separate **0/4** ledger; a blocked gate remains blocked and is not replaced by an additional invented phase. After NEXT-04, release/tag/image/deploy still needs an independent explicit user command, not an assumed automatic NEXT-05.

### NEXT-01 — Exact Git identity, backup branch parity and legal inventory

- **Baseline/input:** Primary commit and tree above, JILLU backup `main=952516a2cac27649824bf14329f511eae6ae9294`, MdNurnobi-Dev `main=511a77380ef8d41061164abb966cbe960b6d02a8`; candidate backup branch `backup/dns-final-primary-20261119` is absent on both at freeze.
- **ALLOW:** Read-only Git SHA/ancestry, repository permission checks; secure **operator-owned browser login** (no secret pasted in chat/logs); temporary isolated bare Git object transfer; non-force creation of **only** `JILLU-Games/ReadBox:backup/dns-final-primary-20261119` and `MdNurnobi-Dev/ReadBox:backup/dns-final-primary-20261119` at the same exact **Primary** SHA; artifact/package/AGPL NOTICE/license dependency inventory; subsequent notes/003–006 status-only entries if separately approved.
- **DENY:** Any repository `main` update, force push, rebase/merge, new commit, source/workflow/license/reference rewrite, secret/file download outside temporary work directory, tag/release, VPS, DNS/R2.
- **Static/provenance context:** `reference/MailStack/LICENSE` and `NOTICE.md` are AGPL-governed; root `LICENSE` MIT. Never claim legal clearance from file presence or Docker ignore. A qualified human needs to separately sign off before distributing source/artifacts.
- **ONE focused verification:** Primary SHA readback; both dedicated backup branch SHA readbacks **exactly equal Primary**; original mains unchanged; temporary transfer directory removed. Credential 403 = **BLOCKED** not PASSED. A backup branch is valid when history diverges; do not force equality of main branches without explicit later approval.
- **Exit:** 2/2 exact-SHA **backup branch** parity or precise per-repo BLOCKED report; no source files modified. If an independent provenance reviewer has not signed off, keep RB-P2-08 OPEN.

### NEXT-02 — Primary R06 readonly CI ownership + legacy Nginx config

- **Prerequisite:** NEXT-01 branch parity preferred; if permission-blocked, continue only on **separate explicit user authorization** that accepts the parity gate remaining OPEN. Freeze the then-current Primary SHA again; do not assume the 2026-11-19 SHA will remain HEAD.
- **CONFIRMED ROOT 1:** `.github/workflows/r06-production-readiness.yml:L21` has a JILLU-only `github.repository` check and the Primary main [R06 #44384109011](https://github.com/vibtoolshq/ReadBox/actions/runs/44384109011) was SKIPPED. This is a **Primary CI eligibility defect**, not proof app regression fails.
- **CONFIRMED ROOT 2:** `deployment/templates/nginx/app.conf.tpl:L15,L44,L54-L55` uses legacy `vibmail_web`, `VIBMAILTLS` and `/var/log/vibmail`; `deployment/templates/systemd/vibmail-web.service.tpl:L12-L13` already uses **current ReadBox directories**. Fix only the actual template issue, not all historic names or upstream reverse-proxy layout.
- **ALLOW exact source/config:** `.github/workflows/r06-production-readiness.yml` (**only Primary-repository job condition and safe CI compatibility**); `deployment/templates/nginx/app.conf.tpl` (**only legacy upstream/cache/log names and matching references; no proxy routing/TLS policy redesign**); `tests/integration/r06-release-gate.test.mjs` (**new negative repo-guard/NO-GO regression only**); new `tests/deployment/readbox-nginx-template-contract.test.mjs` (**lint/static template tests only**); `docs/RELEASE-GOVERNANCE.md` (**current Primary source guidance**); `notes/003–006` (**phase evidence only**).
- **DENY:** `.github/workflows/readbox-first-release.yml` and all tag/release-related code, auth, Prisma, compose ports, Postfix/Dovecot config, DKIM/R2, existing unrelated UI or source, reference/MailStack/legal files, live host/reload/restart.
- **ONE focused disposable CI:** Assert Primary read-only R06 actually executes (not SKIPPED), default-deny production `R06_PRODUCTION_NO_GO` remains, static/parsed Nginx consistency PASS and no implicit publish job. A failure requires one minimal in-scope correction/recheck, never a release bypass.
- **Exit:** Tested exact SHA, successful or honestly failed primary repo R06 job result, patch/Scope Lock audit and notes/003–006 closure. **No release/tag or live deployment.**

### NEXT-03 — Controlled test-domain Cloudflare DNS/DKIM/R2 and public readiness

- **Prerequisite:** NEXT-02 CI source readiness, independently agreed **test domain**, Cloudflare managed zone ID/active status, allowed DNS names/records, authorized host/staging environment and trusted operator. Do not require any domain during documentation planning; ask only at NEXT-03 explicit authorization.
- **ALLOW (operations only, not code):** Read-only preflight of one named test domain, Cloudflare zone delegation/token permissions, relevant current MX/A/AAAA/SPF/DKIM/DMARC, `MAIL_HOSTNAME`, server IP and provider TCP/25 conditions; separately approved **additive** DNS publish only for explicitly listed test-zone names; host-root DKIM stage + encrypted R2 escrow receipt/public TXT, public resolver recheck; one guarded idempotent repair; sanitized success/failure evidence in notes/003–006 and docs/DOMAIN-AUTOMATION.md if later authorized.
- **DENY:** Unlisted zones/domains, registrar nameserver change by the app, overwrite/delete of existing records, key rotation or plaintext private-key export, production mailbox/DB edits, TLS private keys in logs, use of secrets in chat, public SMTP submission/outbound sending.
- **ONE bounded live acceptance:** Record before/after DNS values (redacted sensitive details), source SHA, hosted zone and owner, escrow receipt verified by host-only broker, negative conflict refusal, public DNS propagation and TLS/port evidence as applicable. On provider outage or conflicting DNS return **BLOCKED**, preserve existing records.
- **Exit:** Domain-specific **live verified** or **NOT RUN/BLOCKED**. Source-only CI PASS cannot close RB-P1-09/10 or RB-P2-07 by itself. No general production GO.

### NEXT-04 — Independent staging mailflow, restore, provenance, manual GO/NO-GO

- **Prerequisites:** Explicit staging/VPS/domain/mailbox identities, approval for all external SMTP and recovery actions, reversible encrypted backup/rollback plan; qualified AGPL/distribution review; source/repo SHA checks; NEXT-03 evidence for relevant DNS/TLS conditions. Operator-observed Nov 18 evidence can be cited as **partial history only**.
- **ALLOW operations only (no source edits by default):** Independently probe external port 25/MX/PTR and trusted TLS; authorized test message with attachment from an approved sender to disposable test mailbox; follow Postfix accepted -> Dovecot LMTP -> Maildir -> ingester -> authenticated inbox, assert digest; invalid recipient/nonlocal-relay/MIME negatives; unique staging PostgreSQL/worker/host restart and outage; **offsite encrypted** backup/retention and **isolated** restore/rollback/UID/ACL/custody without touching live production user data; observe privacy-safe logs; qualified license and release artifact inventory at exact candidate SHA.
- **DENY:** Unapproved VPS/DB/production restore, real-user mail or credentials in logs, broad domain sending, forced DNS overwrite, destructive changes, new feature development, automatic tag/release/image/deploy.
- **ONE bounded consolidated acceptance:** Evaluate **all RG-01..RG-17 individually**, attach operator/independent evidence ID, SHA, timestamps, negative cases and hash/digest checks. Record PASS / FAIL / NOT RUN per gate; initial default is NO-GO. A gate is not PASS merely because a different SHA's CI, a screenshot or a local backup exists.
- **Exit:** 17 independently corroborated PASS and 0 unresolved original release blockers -> **MANUAL_RELEASE_REVIEW_REQUIRED**, not automatic GO; otherwise NO-GO with exact blockers. Actual tag/release/deploy requires a second distinct user approval.

### Global immutable controls for ALL future NEXT work

1. Re-freeze **Primary** current SHA/tree and one approved work package before any edits; exact path allowlist is a MAXIMUM, not permission to change all files.
2. Existing application routes, UI/UX, auth, one PostgreSQL/Prisma schema and migrations, inbound-only Postfix/Dovecot topology, Maildir/attachments, encrypted backup and domain-specific safe DNS contract remain unchanged outside approved narrow defect.
3. One focused verification, one exact diff/security audit, one closure log in [003–006](003-PHASE-PROGRESS-AND-CHANGE-LOG.md). If a test fails, only the minimal authorized repair and one necessary recheck; stop when blocked.
4. **No live actions by implication.** Separate explicit approval for named domain, VPS, credentials, DNS/R2, backup/restore, SMTP and all releases. Never invent checked results or silently migrate to a backup repository as Primary.

---

## Current executable roadmap — Phase-01 and Phase-02 only (2026-11-19)

**Source freeze (2026-11-19 Asia/Dhaka):** authoritative `vibtoolshq/ReadBox/main` 6f3bc1e3aeb441956e1fd0f4d81558a6aba2945f; tree `f82b07b6e0770850edd3431f041d5162848d442a`. Last full disposable Primary R06 CI ran against executable code 4d0b124af57c8d407bf609540b8b8b7a69a479b5: [run #44509947742](https://github.com/vibtoolshq/ReadBox/actions/runs/44509947742), SUCCESS. Compare 4d0b124af57c8d407bf609540b8b8b7a69a479b5..6f3bc1e3aeb441956e1fd0f4d81558a6aba2945f: **one documentation-only commit changing notes/003–006**, no executable change. At freeze time both dedicated backup refs `backup/dns-final-primary-20261119` matched 6f3bc1e3aeb441956e1fd0f4d81558a6aba2945f (2/2); backup repositories' separate `main` branches did not. **This new notes-only commit will advance Primary HEAD beyond the freeze; do not claim backup parity at that new HEAD without a new remote readback.** Historical source snapshots below are preserved and must not be mistaken for current source. Production remains **NO-GO**: 32 original findings, 25 CI-contract verified and 7 OPEN; 17 independently accepted production gates not evidenced. Historical R-01–R-06: 6/6 CI implemented. NEXT-01 and NEXT-02: 2/4 completed; NEXT-03 and NEXT-04: 2/4 pending.

Historical R-01–R-06 and completed NEXT-01/NEXT-02 must **not** be restarted. No extra speculative phase. **Phase-01 == NEXT-03**: after separate test-domain/zone/VPS/R2 authorization, controlled DNS/DKIM encrypted escrow and external TLS/port preflight; **no source edits by default**, only append-only `notes/003–006,017` evidence; `docs/DOMAIN-AUTOMATION.md` operator contract only if independently approved. **Phase-02 == NEXT-04**: after separate isolated staging/live-test authorization, independently verify SMTP→LMTP→Maildir→ingestion→inbox attachment SHA/rejections, offsite independent restore and rollback, host Nginx and human legal/release acceptance. **No source edits by default**; only `notes/003–006,017` and separately approved `docs/PRODUCTION-ACCEPTANCE-RUNBOOK.md`/`docs/THIRD-PARTY-PROVENANCE.md` reporting. Source file references are **READ-ONLY INSPECTION PATHS**, not patch allowlists. Exact stage-specific source-reference paths, safety limits, one bounded verification and exit are documented in [017 §C](017-CURRENT-FORENSIC-PATCH-REFERENCES-2026-11-19.md) and the [018 execution contract](018-PHASE-EXECUTION-AND-CLOSURE-TEMPLATE.md). Any reproducible bug needs a user-approved one-defect amendment before implementation. NEXT-04 completion still does not authorize release; 17 independently reviewed gates and separate explicit release approval are mandatory.
