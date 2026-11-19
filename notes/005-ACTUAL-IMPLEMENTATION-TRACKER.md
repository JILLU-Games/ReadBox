# 005 — Actual Feature Implementation and Verified Working Tracker

> **LATEST MANUAL MODE WORKING TRUTH (2026-11-19):** The three automatic domains mailiq.shop, softlo.com, mailvib.com were **operator/chat-recorded as Active/DNS Verified/Gmail inbound PASS**; not independently retested at source 2f1d16b2cd373cd332e79ddae2ef771deaf52928. Existing manual save, DKIM escrow-guarded provision and DNS download are **CODE PRESENT**. Dedicated Manual Mode checkbox is **NOT IMPLEMENTED**; foreign-zone A/AAAA export filter is **NOT IMPLEMENTED**. See [manual-mode/005](manual-mode/005-ACTUAL-WORKING-FEATURE-TRACKER.md). Other independent release gates remain NO-GO.


> **LATEST AUTHORITATIVE RECONCILIATION — 2026-11-19.** **Source freeze (2026-11-19 Asia/Dhaka):** authoritative `vibtoolshq/ReadBox/main` 6f3bc1e3aeb441956e1fd0f4d81558a6aba2945f; tree `f82b07b6e0770850edd3431f041d5162848d442a`. Last full disposable Primary R06 CI ran against executable code 4d0b124af57c8d407bf609540b8b8b7a69a479b5: [run #44509947742](https://github.com/vibtoolshq/ReadBox/actions/runs/44509947742), SUCCESS. Compare 4d0b124af57c8d407bf609540b8b8b7a69a479b5..6f3bc1e3aeb441956e1fd0f4d81558a6aba2945f: **one documentation-only commit changing notes/003–006**, no executable change. At freeze time both dedicated backup refs `backup/dns-final-primary-20261119` matched 6f3bc1e3aeb441956e1fd0f4d81558a6aba2945f (2/2); backup repositories' separate `main` branches did not. **This new notes-only commit will advance Primary HEAD beyond the freeze; do not claim backup parity at that new HEAD without a new remote readback.** Historical source snapshots below are preserved and must not be mistaken for current source. Production remains **NO-GO**: 32 original findings, 25 CI-contract verified and 7 OPEN; 17 independently accepted production gates not evidenced. Historical R-01–R-06: 6/6 CI implemented. NEXT-01 and NEXT-02: 2/4 completed; NEXT-03 and NEXT-04: 2/4 pending. Detailed, immutable code excerpts and line links: [017](017-CURRENT-FORENSIC-PATCH-REFERENCES-2026-11-19.md); executable step/closure contract: [018](018-PHASE-EXECUTION-AND-CLOSURE-TEMPLATE.md). Earlier dated statements are retained as history, not latest status.


> **CURRENT ACTUAL WORKING STATE — 2026-11-19:** Authoritative Primary `vibtoolshq/ReadBox`, SHA `3dfac11f46165c262c3dc5ddb7e82563a56f9a7f`. Historic 6/6 R-phase implementation source scopes are verified by CI. **One 2026-11-18 VPS inbound-message observation exists** in [016](016-LIVE-INBOUND-DEPLOYMENT-ACCEPTANCE.md), but full independent live acceptance has not been signed off. The new feature-by-feature **CODE / CI / OPERATOR-OBSERVED / LIVE ACCEPTED** matrix at this file's end supersedes overly broad historical “no live tests ever” wording without changing old records.


**Frozen baseline:** `e28886e5e0f7a155cd64e23bc8ee8f6668d6699c`. **Implementation phases:** 6/6 CI IMPLEMENTATION VERIFIED; no remaining implementation phase. R-06 live staging/production acceptance NOT RUN, 7 original findings OPEN. **Release:** NO-GO.

## Terminology — critical distinction

- **CODE PRESENT**: exact implementation/source or configuration file exists; may have unit tests but not necessarily live.
- **CI VERIFIED**: inspected GitHub job demonstrated the stated subset at a specific tested SHA.
- **LIVE VERIFIED**: worked on a real configured staging/production VPS with mailserver and observed outcomes (**none granted** at baseline).
- **NOT DEPLOYED**: code template may exist but the published runtime Compose stack does not provision the service.
- **PLANNED**: not implemented. Never mark a proposed update as a current working feature.

## A. Currently present application code and evidence

| Feature ID | Feature / functionality actually in source | Exact path(s) | Verified level | Live VPS |
|---|---|---|---|---|
| F-01 | Next.js app routes, landing, user inbox and admin console | `src/app/page.tsx`, `src/app/(workspace)/users/**`, `src/app/(workspace)/vcon/**` | CODE PRESENT; build & 70 UI tests CI VERIFIED | UNVERIFIED |
| F-02 | Auth, route authorization, local account/reset/operator CLI | `src/auth.ts`, `src/core/auth/**`, `scripts/auth/operator.ts` | R-04 initial admin/CLI guard CI VERIFIED; existing login/auth policy unchanged | LIVE VPS UNVERIFIED |
| F-03 | PostgreSQL Prisma data client + migrations | `src/core/database/client.ts`, `prisma/schema.prisma`, `prisma/migrations/**` | CODE PRESENT; static Prisma validate CI VERIFIED | LIVE MIGRATION NOT VERIFIED |
| F-04 | Domains and managed mailbox provisioning | `src/core/domains/service.ts`, `src/core/mailboxes/service.ts` | CODE PRESENT; tests include admin contract | external SQL + Maildir unverified |
| F-05 | Single PostgreSQL mailserver schema + virtual map adapter | `src/core/mailserver/pg-adapter.ts`, `prisma/migrations/20261115000000_mailserver_schema_and_roles/migration.sql` | CODE PRESENT; adapter tests | external Postfix NOT DEPLOYED |
| F-06 | Filesystem path confinement, mailbox locks, Maildir tree | `src/core/mailboxes/paths.ts`, `src/core/mailboxes/provisioning.ts` | CODE PRESENT | vmail/nextjs identity unverified |
| F-07 | Incoming Maildir ingestion, MIME, attachment storage and counters | `src/workers/ingestion.ts`, `src/core/ingestion/**`, `scripts/mail/ingest.ts` | CODE PRESENT; unit tests | SMTP-to-inbox UNVERIFIED |
| F-08 | DNS suggestion/verification and DKIM public-key record reading | `src/core/dns/records.ts`, `src/core/dns/resolver.ts`, `src/core/dns/opendkim.ts` | CODE PRESENT | DNS publication and signer NOT DEPLOYED |
| F-09 | Admin operations/audit/retention/settings and user workspace | `src/core/operations/service.ts`, `src/core/audit/**`, `src/core/settings/**` | CODE PRESENT; subset CI tested | UNVERIFIED |
| F-10 | Health/readiness JSON endpoints and worker heartbeat logic | `src/core/health/snapshot.ts`, `src/app/health/live/route.ts`, `src/app/health/ready/route.ts` | R-04 production heartbeat/DB/storage negative cases CI VERIFIED | SMTP/LMTP readiness still unverified |
| F-11 | Multi-stage production app Dockerfile and Compose definition | `Dockerfile`, `docker-compose.yml`, `entrypoint.sh` | CONFIG PRESENT; npm build passed, not image boot | UNVERIFIED |
| F-12 | Compose recovery and host update/backup/restore scripts | `deployment/operations/**`, `scripts/ops/**`, `scripts/updater/**`, `deployment/templates/systemd/**` | R-05 disposable PostgreSQL+named-volume encrypted restore/rollback CI VERIFIED; host scripts syntax/static only | REAL VPS/HOST UNVERIFIED |
| F-13 | Independent Postfix/Dovecot/LMTP mailserver binaries | `docker-compose.yml` now has opt-in Postfix+Dovecot `mailserver` profile | CI DOCKER VERIFIED; NOT VPS DEPLOYED | NO |
| F-14 | SMTP submission/IMAP email-client services | `src/core/mailserver/pg-adapter.ts:274–275` disables password login; Dovecot template LMTP-only | NOT IN CURRENT PRODUCT PROOF | NO |

## B. Existing inspected CI run

**Source GitHub Actions:** https://github.com/JILLU-Games/ReadBox/actions/runs/44080430558

- `npm ci`: PASS (after fixed lockfile).
- `npm run db:validate`: PASS.
- `npm run lint` and `npm run typecheck`: PASS.
- `npm run test:unit`: 167 PASS, 0 failed.
- `npm run test:ui`: 70 PASS, 0 failed.
- `npm run build`: PASS.
- **Not established by this run:** production Docker image startup; `npm run test:postgres` with live disposable DB; real mail acceptance, Postfix/Dovecot, DNS/TLS, external reachability, reboot/restore; zero current dependency security advisories.

## C. Features or contract outcomes not proven before release

| Phase | Exact expected improvement (NOT YET WORKING-PROVEN) | State | Proof URL/commit when completed |
|---|---|---|---|
| R-01 | Production vs development Compose, secrets, reproducible Docker/dependency image, correct README | CI VERIFIED | https://github.com/JILLU-Games/ReadBox/actions/runs/44093204590 |
| R-02 | Working Postfix lookup/login role, schema parity, cross-UID Maildir permissions | VERIFIED CLOSED (CI; authorized health exception) | https://github.com/JILLU-Games/ReadBox/actions/runs/44102834169 |
| R-03 | Operating SMTP→LMTP inbound mail flow, correct DNS/TLS/mailserver integration | CI VERIFIED in disposable Docker; public SMTP/DNS/TLS unverified | https://github.com/JILLU-Games/ReadBox/actions/runs/44107205810 |
| R-04 | First-admin startup, trustworthy worker heartbeat, fail-closed readiness | CI VERIFIED CLOSED | https://github.com/JILLU-Games/ReadBox/actions/runs/44112634511 |
| R-05 | Encrypted Compose volume and PostgreSQL backup→restore→rollback; host updater boundary | CI IMPLEMENTATION VERIFIED, 2 findings OPEN | https://github.com/JILLU-Games/ReadBox/actions/runs/44121121316 |
| R-06 | Read-only final consolidated CI and 17-gate human approval; actual public inbound/inbox and disaster recovery staging | CI IMPLEMENTATION VERIFIED; 3 owned live findings OPEN | https://github.com/JILLU-Games/ReadBox/actions/runs/44127481624 |

## Per-phase actual-working append record (only after real verification)

```text
Phase:
Finding IDs:
What code was changed (exact paths):
What actually worked in CI (tested SHA/run URL):
What actually worked on VPS (timestamp/domain anonymized/log proof):
Negative cases and user-visible features that remained unchanged:
Remaining unverified / future improvements:
Source and mirrored SHA:
```

**No future features are marked complete.** The tracker must not be updated from code review alone to claim live production functionality.

## R-01 code-level working features (CI verified, NOT live VPS)

- Docker build uses immutable Node digest and one package-lock resolution. `prisma`, `tsx`, `dotenv` are available in runtime. App CI: https://github.com/JILLU-Games/ReadBox/actions/runs/44092311120.
- Default Compose defines `postgres`, `web`, `worker`; opt-in `compose.dev.yaml` preserves the development database setup.
- Docker entrypoint safely encodes arbitrary DB password symbols and fails on short DB/auth credentials. Docker and production npm audit CI: https://github.com/JILLU-Games/ReadBox/actions/runs/44093204590.
- Actual production VPS Postfix/Dovecot, mail receipt, real PostgreSQL migrations and disaster recovery: **NOT VERIFIED**. Existing UI, routes, auth behavior and messages unchanged.

## R-02 actual working delta (isolated CI only)

- **PostgreSQL 16:** seven Prisma migrations applied to disposable DB, and repeat `migrate deploy` succeeded without changes. New migration `prisma/migrations/20261117010000_postfix_login_identity/migration.sql` creates the restricted `readbox_postfix` LOGIN principal, inheriting the original `postfix_lookup` read-only group.
- **Virtual lookups:** enabled domain/mailbox/alias SQL views returned the expected values; disabled domain, unknown mailbox and unauthorized table writes/password-hash/user SELECT were rejected. Tests used the real PostgreSQL server in CI, not a mock.
- **Maildir:** `docker-compose.yml` pins web/worker runtime UID/GID 1001; Dovecot template now accepts matching numeric values; `src/core/mailboxes/provisioning.ts` refuses unexpected directory owners without chowning existing data.
- **Migration parity:** `src/core/mailserver/pg-adapter.ts` exposes a checked manifest verifier; unit tests cover successful, missing and unfinished migrations. The application `/health/ready` is **NOT** connected to this checker, so `RB-P2-04` remains OPEN and R-02 phase closure is BLOCKED under Scope Lock.
- **Proof:** https://github.com/JILLU-Games/ReadBox/actions/runs/44099280332. Code SHA: `e1efdbd0b0380a94152947f7be47eb17c5c8d70c`.
- **Not verified:** real Postfix/Dovecot installed or running, external mail delivery, DB provisioning one-shot profile invocation in a deployed stack, public DNS/TLS, VPS mounts and backups. No change to app UI/routes/auth/features.

## R-02 final verified working delta (2026-11-17)

- `getReadinessSnapshot()` now uses `verifyMailserverMigrationParity()` from the existing R-02 PG adapter, enumerating expected checked-in migrations at runtime with a mandatory seven-migration baseline. `checks.migrations.ok` is `false` for missing/unfinished history and query errors; `/health/ready` continues returning HTTP 503 on `not_ready` without editing its route.
- Positive and negative health tests and Next production build pass: https://github.com/JILLU-Games/ReadBox/actions/runs/44102834169; original disposable PostgreSQL/role/UID contract proof preserved in 009.
- This **does not install Postfix/Dovecot**; real mailbox reception and public VPS health remain unverified. Other features, UI/auth, routes, historical migrations and existing mailbox data unchanged.
- R-02 completed CI-wise; R-03, R-04, R-05, R-06 not started.

## R-03 actual working contract (CI only, not production VPS)

- Production Compose now **optionally** starts `postfix` and `dovecot` through `--profile mailserver`; default web, worker and PostgreSQL remain as before. The Postfix queue is persistently volume-backed, Dovecot writes to the existing Maildir volume as numeric UID/GID 1001. Postfix SQL queries use the same PostgreSQL role from R-02.
- Verified real disposable-runner behavior: SMTP STARTTLS, valid `support@r03.example.test` delivery to Maildir, unknown mailbox RCPT reject, nonlocal relay reject, missing TLS refusal, Postfix and Dovecot config lint. Evidence https://github.com/JILLU-Games/ReadBox/actions/runs/44107205810; code commit `d0f3272ea298de012da83c6f01b588fa0513d1da`.
- `deployment/mailserver/README.md` documents private certificate handoff and DNS/MX/PTR as manual provider/VPS responsibilities. No DKIM signing daemon is included (inbound-only); previews remain advisory.
- NOT LIVE VERIFIED: public TCP/25, MX/PTR, production cert/renewal, sender reputation, automatic DNS provisioning, IMAP/SMTP submission/outbound, actual user inbox on VPS, backup/restore. **Existing UI/auth/routes/business source unchanged.**

## R-04 actual working implementation delta (2026-11-17)

- **New code-level flow:** `bootstrapInitialAdminAccount` creates one real `admin_accounts` admin with a random unusable password, `passwordResetRequired=true`, hashed expiring `admin_reset_tokens`; concurrent bootstrap guarded by transaction advisory lock. Existing legacy user bootstrap implementation remains unchanged for compatibility, but the operator's `bootstrap` action uses the correct admin-table flow.
- **Explicit production operator path:** `scripts/auth/operator.ts --bootstrap-production` requires private-container interactive operation and never auto-runs on normal app startup. Clean disposable PostgreSQL once+duplicate+inspector parity verified at https://github.com/JILLU-Games/ReadBox/actions/runs/44112634511; interactive VPS terminal session not tested.
- **Application readiness:** production always requires a fresh, healthy ingestion heartbeat; DB, migrations and writable/readable storage must pass; stale/future/degraded/unavailable states fail closed. Existing `/health/live` remains process liveness, worker health additionally queries `/health/ready`. No new public route, no login policy change.
- **Transport honesty:** `scope: application` and `mailTransport: not_checked` indicate SMTP/LMTP receipt is not verified by a 200 application readiness. Existing R-03 public DNS/TLS/VPS uncertainties remain.
- **Evidence:** https://github.com/JILLU-Games/ReadBox/actions/runs/44112634511; SHA `88e57e2e81dc07a8f91b07f448df85e51d58e429`. No production/mailbox data modified, no live VPS tested. Next R-05/R-06 still OPEN.

## R-05 actual working recovery contract (CI only)

- **Published code:** `a55ec82bb2f58804e910427c66ff6352cd5c14c6`. **Full focused CI:** https://github.com/JILLU-Games/ReadBox/actions/runs/44121121316. The new `deployment/operations/compose_recovery.py` tool stopped **active** writer containers, dumped the real disposable PostgreSQL 16 database (public + mailserver schemas), captured the web Maildir/attachments/media volume mounts and a Postfix queue volume, and wrote an `age` public-key encrypted 0600 archive with SHA-256 manifest. Configuration files and plaintext credentials were deliberately excluded.
- Verified in same disposable Compose CI: the restore returned pre-mutation SQL rows, Maildir/attachment/media/queue bytes, numeric UID/GID 1001 and a named-volume POSIX ACL. A deliberate failure **after database apply** forced encrypted pre-restore rollback, which recovered the modified pre-state. Tampered ciphertext was rejected before service changes. Previously-running containers restarted; this is a downtime maintenance process, **not online backup**.
- `scripts/ops/backup.sh`, `restore.sh`, host `upgrade.sh` and systemd template paths were corrected for secret exclusion, numeric owner+ACL, explicit downtime and rollback handling. **Only static and syntax CI proof exists for these host/systemd paths, not actual host upgrade or VPS restore.** The privileged updater worker normalizes obsolete release repo alias; in-app Docker self-update stays blocked and requires orchestrator-managed image deploy.
- **Not yet working-proven:** offsite transport/retention, encryption private-key custody/recovery, actual VPS systemd/Compose restore, zero-downtime SMTP, real public MX/LMTP, service recovery after a power failure; original RB-P2-01 legacy Nginx path outside this Scope Lock. UI/auth/routes/schema/mailserver engine unchanged.
- **Phase count 5/6**, verified findings **25/32**, remaining **7**. Full production **NO-GO**.

## R-06 actual working implementation vs external readiness (2026-11-17)

- **Actual source code:** `807ca9f38adb02db2a8b73dc0901fce23ee5e63a` with `.github/workflows/r06-production-readiness.yml` (source-only, contents read, no release/tag), `scripts/testing/r06-release-gate.mjs`, `r06-ephemeral-postgres.sh`, `r06-smtp-rehearsal.sh`, `r06-verify-lint-baseline.mjs` and `tests/integration/r06-release-gate.test.mjs`; dedicated docs on staging, release/GO governance and MIT/AGPL provenance. README/SECURITY carry explicit NO-GO warning.
- **CI actually worked:** https://github.com/JILLU-Games/ReadBox/actions/runs/44127481624: complete existing auth/unit/UI regression and build, production npm audit, disposable tmpfs PostgreSQL 16.14 auth/migration replay (verified target guard), real disposable production Docker web/worker/Postfix/Dovecot build+startup, localhost test STARTTLS→LMTP→Maildir delivery plus SMTP negatives, age encrypted PostgreSQL/Maildir/queue backup→restore with UID 1001/ACL and injected automatic rollback. 32 finding/17 formal gate metadata and strict no-go evidence tests PASS. Exact 11-source-path Scope Lock audit PASS.
- **Limits explicitly OPEN:** no real Internet MX/A/PTR/certificate or public port 25, no live SMTP→LMTP→actual authenticated inbox+attachment success, no real VPS/storage/reboot, no actual offsite retained encrypted restore, no final license distribution review, no user approval to publish. All 7 original findings remain OPEN; `RG-01..RG-17` external staging evidence not provided.
- **Lint debt:** full-tree ESLint has exactly two earlier R-04 unused catch bindings; source excluded narrowly from R-06 lint and checked by separate strict two-error inventory. The full lint gate remains unmet, not presented as clean.
- **Phase implementation:** 6/6 CI complete, **production GO/NO-GO = NO-GO**. No user/app/auth/mailserver data/UX changes. Next step is separate live staging authorization and, if needed, a narrow scope exception—not another default implementation phase.

## DKIM-01 — Feature state and precise test boundary (2026-11-18)

| Capability | Status |
|---|---|
| Isolated no-network RSA-2048 keypair implementation | SOURCE PRESENT; optional Docker profile not live-tested |
| Private key storage separate from Web, public-only record mount | SOURCE PRESENT; Docker Compose/patch audit PASS |
| Existing/new domain admin control, explicit opt-in | UI/source integrated; R06 UI regression PASS |
| Zone-scoped Cloudflare DKIM TXT create/reconcile | SOURCE PRESENT; mocked tests PASS, **real API NOT RUN** |
| Missing token manual TXT / zone export | SOURCE PRESENT; focused Node test PASS |
| Duplicate requests/invalid public/foreign zone/conflict fail closed | Focused mock/negative tests PASS; live gates pending |
| Independent key/public DNS/signing-status UI | SOURCE PRESENT; signer explicitly inactive |
| Default Postfix/Dovecot service topology | Unchanged by `profiles: ["dkim"]`; R06 SMTP/LMTP PASS |
| Private DKIM key encrypted backup/escrow/restore | **NOT IMPLEMENTED**; requires separate approved scope |
| Live VPS deployment, Cloudflare write, real signing or outbound SMTP | **NOT RUN / NOT ENABLED** |

Implementation is DKIM DNS *preparation*, not outbound DKIM signing. Exact CI candidate tree `3f6dc44bc96a0fa595fba0362012e5214a7b53fe`; R06 [#44273197408](https://github.com/JILLU-Games/ReadBox/actions/runs/44273197408) SUCCESS; local DKIM Node six focused cases PASS. The opt-in agent image build and its embedded Python unit tests are **not** part of the default CI run and must be verified in isolated deployment readiness.

## DKIM-02/FIX-01 — Feature delta (2026-11-18)

| Item | State |
|---|---|
| OpenSSL 3.x comma/prime-count RSA-size text compatibility | **IMPLEMENTED** in `deployment/dkim/agent.py` |
| Legacy OpenSSL RSA-size header compatibility | **PRESERVED** |
| RSA-2048 lower bound / malformed key rejection | **PRESERVED; TESTED** |
| Idempotent key creation / never overwrite existing private or public conflict | **UNCHANGED; disposable test PASS** |
| Embedded Python key-agent test suite | **6/6 PASS** in disposable Docker image build |
| Existing application, UI, auth, Prisma, Compose and mailserver | **UNCHANGED** |
| R06 read-only regression at mirror candidate | **SUCCESS**, [#44280725129](https://github.com/JILLU-Games/ReadBox/actions/runs/44280725129) |
| Live key escrow, production DKIM key generation, provider DNS write | **NOT RUN / NOT APPROVED BY FIX-01** |
| New feature source deploy to existing VPS via Admin Panel | **SEPARATE CONTROLLED ROLLOUT PENDING** |

Frozen baseline `69b7f4c91100dd30c83ab56b24c29a4a0a9384b1`; tested implementation tree `c973d0db780939a5049d2366540b81e5f589738d`. Only the two approved Python files changed before documentation closure. DKIM signing/outbound SMTP remain disabled.

## DKIM-02/FIX-02 — Implementation status (2026-11-18)

| Item | State |
|---|---|
| Non-root-readable `/usr/local/bin/dkim-agent.py` at mode `0644` | **IMPLEMENTED** in `deployment/dkim/Dockerfile` |
| Build-time user `1001:1001` Python read/compile smoke test | **IMPLEMENTED; PASS** |
| Existing agent Python regression suite | **6/6 PASS** in single disposable uncached Docker build |
| Existing `agent.py`, tests, Docker Compose and mailserver | **UNCHANGED** |
| Existing UI/auth/Prisma, backup/R2, secrets and volumes | **UNCHANGED** |
| Test output marker | `DKIM02_FIX02_NONROOT_BUILD_PASS` |
| Live VPS deployment of FIX-02 and healthy-agent assertion | **NOT RUN — separate controlled update** |
| Encrypted private-key escrow/recovery and domain DKIM generation/DNS | **NOT RUN — safety gate remains** |

Frozen baseline `ebb2e2bddd0ef26671b283a4f71bc4d35bb32dbd`; code tree `d34e6b539e7ba3aae3a2f03f8046a5f2821dcfcf`. This is a runtime image permission compatibility fix, not outbound signing or DNS publishing.


## DKIM-03 — Implemented versus not-run features (2026-11-18)

| Contract | State |
|---|---|
| Offline DKIM key staging without public TXT before escrow | **IMPLEMENTED / disposable agent tests PASS** |
| Per-domain root-issued SHA/fingerprint-bound immutable R2 receipt gate | **IMPLEMENTED / negative tests PASS** |
| Host-only existing age recipient/identity plus protected R2 credentials reuse | **IMPLEMENTED; no real credentials accessed in CI** |
| Fixed `readbox/dkim-escrow/v1/<domain>/<private SHA256>.age` immutable object | **IMPLEMENTED; mocked R2 verified** |
| Local age decrypt + bounded remote ciphertext readback + public RSA fingerprint | **11/11 disposable escrow tests PASS** |
| Lost upload ACK, interrupted upload, existing object conflict, crash-before-receipt | **PASS in mocked R2 cases** |
| New disposable volume recovery after original key/receipt deletion | **PASS; no production restore path** |
| Existing agent Docker RSA regression and non-root smoke | **8/8 tests + Docker build PASS** |
| Existing R05/BR04 managed backups, UI/auth/Prisma/mailserver/Compose | **UNCHANGED** |
| Real Cloudflare R2 API conditional PUT/GET and independent age-key custody | **NOT RUN; requires separately authorized operator acceptance** |
| VPS DKIM03 source deploy / live key / real DNS / outbound signer | **NOT RUN** |

Exact verified tested code tree: `4cccc52ea7d92bdaf4a06b27fc15a8039aae8036`.
Final notes-only closure commits change documentation, not the tested code or frozen release gate.


## DOMAIN-AUTO-01 — implemented source, not deployed

- Automatic Add Domain default, manual opt-out with DNS-review checkbox, admin-domain repair POST; no unrelated screen/feature edits.
- `src/core/dns/cloudflare-auto.ts` verifies exact active managed Cloudflare zone, preflights and idempotently creates scoped records. Shared mail host outside zone is never modified.
- `src/core/dns/domain-automation.ts` orchestrates existing isolated DKIM agent, narrow host-root HMAC escrow and Cloudflare publishing. Actual private/R2 credentials stay host-only.
- `deployment/backup-agent/agent.py` action `dkim.escrow` strictly limits host subprocess to existing `deployment/dkim/escrow.py escrow <domain>`. Agent client/validation allow only domain payload.
- Immediate DNS routing recheck activates only verified domains; pending propagation remains disabled. Full unattended long-term background reconciliation is **not implemented** in this source phase.
- One focused test workflow and no-secret documentation added. Source-only: live token setup, VPS rollout and live provider acceptance remain pending.

- **Verification/source status:** source commit `f7b5d7a97aa24274c70f74891e2adf39f2b17bad`; dedicated [source CI #44345525274](https://github.com/vibtoolshq/ReadBox/actions/runs/44345525274) SUCCESS (exact 17-path scope, TS, 14 Node + 3 Python tests). Local checkout staged tree matches published source tree. Independent mirror remains at original baseline pending exact non-force Git object transfer; **not phase-closed/synced**.


## DNS-FINAL — primary-only integration candidate

| Item | State |
|---|---|
| DOMAIN-AUTO-01 DNS/escrow baseline in vibtoolshq/main | SOURCE PRESENT before phase |
| DOMAIN-AUTO-02 selector/zone API/create and repair binding | DNS-only content integrated into isolated primary candidate; CI pending |
| CAS-safe domain DNS verification and regression tests | Integrated; CI pending |
| Legacy manual opt-out UI contract | Focused test integrated; CI pending |
| Production provider/DNS/R2/host deployment | NOT RUN |
| Primary main publication / backup exact SHA parity | PENDING scoped CI PASS and safe non-force refs |
| Additional features or MailStack reference changes | OUT OF SCOPE / NO EDIT |


- **DNS-FINAL primary integration CI COMPLETE:** `2eccd8f21cf71261fdc0e0b7ab6199a2a19de4ce`, [primary #44383278082](https://github.com/vibtoolshq/ReadBox/actions/runs/44383278082) success, exact 17-file allowlist, 25/25 Node, 2/2 UI files, Python bridge PASS, TypeScript PASS, production dependency audit 0 vulnerabilities.
- Implemented in isolated Primary branch: domain-specific Cloudflare zone UI/API, active zone validation, persisted binding in existing JSON, guarded add/repair, CAS-safe routing verification. Existing DOMAIN-AUTO-01 encrypted DKIM escrow/DNS preflight unchanged; no new schema or unrelated user feature.
- Main publish and same-SHA backup transfer: pending explicit ref/readback in this phase. External live DNS, R2 escrow and VPS test NOT RUN.

---

## Current Primary actual-working truth matrix — 2026-11-19

**Evidence columns MUST be interpreted separately:** `PRESENT` = compiled/current source; `CI PASS` = disposable verified at specified SHA; `OPERATOR PARTIAL` = specifically recorded screenshots/PuTTY observations; `LIVE ACCEPTED` requires separately corroborated domain/host/recovery proof and human approval. **No entry below is independently signed-off production READY.**

| Capability / current feature | Source implementation (exact paths) | Verified test or limited observation | What is still NOT proven |
|---|---|---|---|
| Web landing, administrator and user inbox | `src/app/page.tsx`, `src/app/(workspace)/vcon/**`, `src/app/(workspace)/users/**` | Historical full UI/build CI; operator [016](016-LIVE-INBOUND-DEPLOYMENT-ACCEPTANCE.md) saw an authenticated inbox with one message | Repeated multi-user live journeys, failure/reboot, full browser acceptance |
| Auth, roles, initial setup and password reset | `src/auth.ts`, `src/core/auth/**`, `src/core/setup/**`, `src/app/initial-setup/**`, `scripts/auth/operator.ts` | R-04/QIS-01 source/CI contracts and negative access checks | Fresh approved VPS activation, public HTTPS session behavior and recovery |
| Single PostgreSQL / Prisma mailserver role | `prisma/schema.prisma`, `prisma/migrations/**`, `src/core/mailserver/pg-adapter.ts` | Isolated PostgreSQL CI with migrations, SQL/auth negatives | Full current Primary staging migrate/restart and disaster recovery |
| Domains, mailbox provisioning and Maildir isolation | `src/core/domains/service.ts`, `src/core/mailboxes/{service,provisioning,paths}.ts` | Tests and historical R-03 SQL/LMTP + UID/GID CI | Real multi-domain end-to-end with ACL and failure recovery |
| Maildir message ingestion/attachment display | `src/workers/ingestion.ts`, `src/core/ingestion/**`, message/attachment paths | Historic tests and operator one incoming Gmail subject/body/date in inbox in [016](016-LIVE-INBOUND-DEPLOYMENT-ACCEPTANCE.md) | Independent attachment hash, MIME limits, accepted-but-lost queue and repeated inbound load |
| Opt-in inbound Postfix + Dovecot LMTP | `docker-compose.yml:L194–265`, `deployment/mailserver/**` | Disposable R-03/R06 SMTP -> LMTP -> Maildir; operator VPS-side port 25 STARTTLS and one Gmail delivery | Independent public ingress/MX/PTR/IPv6/TLS trust and reboot/failover |
| DNS suggestion and public routing verification | `src/core/dns/{records,resolver,opendkim}.ts` | DNS resolver mock/contract CI | Actual public authoritative domain routing across all zones |
| **Automatic domain setup (DOMAIN-AUTO-01)** | `src/core/dns/{cloudflare-auto,domain-automation}.ts`, `deployment/backup-agent/agent.py` | Primary DNS [#44384108878](https://github.com/vibtoolshq/ReadBox/actions/runs/44384108878) PASS; idempotent create/repair mock cases | Real Cloudflare API write, registrar delegation, propagation, per-zone production permission |
| **Explicit per-domain Cloudflare Zone selection (DOMAIN-AUTO-02)** | `src/app/api/vcon/domains/cloudflare-zones/route.ts`, `src/components/vcon/domain-form.tsx`, `src/app/(workspace)/vcon/domains/actions.ts` | Exact Primary integration Node 25/25 + zone/domain UI 2 test files [#44383278082](https://github.com/vibtoolshq/ReadBox/actions/runs/44383278082) PASS | Real active token/zone selection under operator Cloudflare account |
| **CAS-safe domain verification metadata** | `src/core/domains/service.ts:L470–541`, `tests/admin/phase3-domains-mailboxes.test.ts` | Deterministic mocked conflict+retry and primary CI PASS | External PostgreSQL race/infrastructure pressure on deployed current source |
| Host-only DKIM generation, receipt-bound age/R2 escrow | `deployment/dkim/{agent.py,escrow.py}`, `src/core/dns/dkim-provision.ts`, `src/core/backup/agent-client.ts` | DKIM-03 mocked R2 recovery/source tests and DNS pipeline CI; public key held until receipt | Real private-key custodial recovery and remote Cloudflare R2 conditional upload/readback |
| Backup admin, R2 and scheduled backup controls | `src/app/(workspace)/vcon/backup/**`, `src/components/vcon/backup-console.tsx`, `deployment/backup-agent/{r2,scheduler,restore}.py` | BR-03/04 source and disposable mock/restore CI; operator [016](016-LIVE-INBOUND-DEPLOYMENT-ACCEPTANCE.md) saw checksum-verified local encrypted **GPG** archive | Independent live offsite R2 age identity, rotation/deletion safety, staging restore and rollback |
| Application health and worker heartbeat | `src/core/health/snapshot.ts`, `src/app/health/{live,ready}/route.ts` | R-04 negative tests, operator /health/live 200 and five-container snapshot | /health/ready and ingress/LMTP readiness on current staging SHA; production alerts |
| Safe host update and Admin Docker updater | `src/core/updates/service.ts`, `scripts/install/readbox-update.sh`, `scripts/updater/**`, admin system-update UI | AU-01/UI-01 CI and an earlier operator UI `Ready (17/17)` snapshot in backup notes | Actual operator-approved live browser update with encrypted backup, new SHA and successful recovery |
| Host nginx legacy template | `deployment/templates/nginx/app.conf.tpl` | Source present; current legacy vibmail names/log paths **confirmed** | Corrected config lint/host nginx reload under a narrow approved patch |
| Repository R06 consolidated gate | `.github/workflows/r06-production-readiness.yml` | [JILLU complete R06 #44374235430](https://github.com/JILLU-Games/ReadBox/actions/runs/44374235430) PASS at *different* SHA | On Primary main [R06 #44384109011](https://github.com/vibtoolshq/ReadBox/actions/runs/44384109011) is **SKIPPED**; must repair repo check before counting as Primary full CI |
| Backups / Git parity | Primary `main` at frozen source SHA | Primary DNS CI passes at exact main SHA | Both backup dedicated exact-SHA branches missing; write credentials blocked; no backup-main force push allowed |
| Release artifacts / provenance | `LICENSE`, `reference/MailStack/{LICENSE,NOTICE.md}`, `docs/THIRD-PARTY-PROVENANCE.md` | Source inventory, root MIT and separate AGPL historical reference observed | Independent legal/derivative distribution clearance; source and immutable image digest match; manual GO |

### Explicitly **not currently included / not accepted as working**

- ReadBox remains **inbound-only**: no public SMTP submission, outbound relay/send, IMAP or POP3 service guaranteed. Current DKIM DNS preparation is **not** proof that an outbound signing daemon runs.
- **Registrar nameserver delegation**, blanket Cloudflare DNS take-over, destructive DNS repair, automatic certificate issuance/renewal, and arbitrary zone editing are outside approved DOMAIN-AUTO-01/02 features. There is no promised perpetual background DNS reconciliation loop; provisioning/repair performs the guarded recheck.
- Local operator test of **one** Gmail message does not prove all domains, attachment hashes, R2 recovery, production restore or independent RG-01..17 acceptance. Public mail hostname/PTR/IPv6 and TLS trust remain separately gated.
- The original 6/6 source CI implementation result does **not** imply stable production release or 0 open findings. Seven forensic findings remain OPEN.

### Per-update actual-working reporting contract

After NEXT-01..NEXT-04 only, append a dated subsection with: exact Primary code SHA/tree; changed path list; feature behavior observed before and after; one focused CI run URL or approved operator test evidence; sanitized negative cases; persisted data/rollback outcome; **CODE, CI, OPERATOR PARTIAL, INDEPENDENT LIVE** states; changed backup SHA/ref parity; remaining 7 findings and next fixed work package. Do **not** change an original feature state until evidence supports it.

---

## NEXT-01/NEXT-02 feature reality — 2026-11-19

| Feature/condition | Actual status |
|---|---|
| Exact Primary Git backup to both independent repositories | **PASS / NEXT-01 CLOSED** — both dedicated backup branches at `1393c48fdc821756213e9c0ca87dd166ee3f6b75`, existing `main` unchanged |
| R06 job execution on Primary | **RUN CONFIRMED in isolated candidate PR**; first source CI and focused recheck **FAILED** at ESLint, so NOT full-R06 accepted or promoted to main |
| Separate R06 lint/typecheck commands | **CODE PRESENT in candidate**; lint actually ran and failed, typecheck NOT RUN |
| Host Nginx renamed upstream/cache/log paths | **CODE PRESENT in candidate ONLY**; static test source present, CI test NOT RUN, no live Nginx host validation |
| Two existing unrelated lint blockers | **CONFIRMED** `domain-form.tsx:185` and `admin-system-update.test.mjs:94`; exact minimal scope exception pending |
| App UI/auth/Prisma/Compose/mailserver/DNS/DKIM/R2 | **UNMODIFIED** in NEXT-02 candidate |
| Formal production readiness | **NO-GO**; 7 original findings OPEN, 17 individual live gates not accepted |

Candidate code SHA: `3adff246beec44c685d8885875a9d94f41dece4a` ([failed CI #44505932658](https://github.com/vibtoolshq/ReadBox/actions/runs/44505932658)). No source promotion or backup branch update. NEW notes-only candidate closure does not make those unexecuted tests PASS.

---

## NEXT-02 source/CI actual-working truth — 2026-11-19

| Capability | Evidence | Outcome |
|---|---|---|
| React domain-zone loading and Admin Update regex corrections | `7ed2997d110ed30a6ec5dd901eff67bce1904c5f`, isolated source | Applied only in candidate; zone fetch/error and updater semantics unchanged; independently deployed behavior NOT tested |
| Full Primary R06 app regression and TypeScript check | [CI #44507511633](https://github.com/vibtoolshq/ReadBox/actions/runs/44507511633) | **PASS**: lint, typecheck, unit/UI, R06 negative contracts, Nginx static contracts, Next.js build |
| Production dependency advisories | Same CI, `npm audit --omit=dev` | **PASS**, reported 0 vulnerabilities at tested source SHA |
| Ephemeral PostgreSQL | Same CI | **NOT STARTED**; repository guard blocked before Docker/DB tests |
| Loopback SMTP->LMTP, encrypted restore, final NO_GO gate | Same CI | **NOT RUN** (skipped after PostgreSQL gate fail) |
| Candidate code and notes | Isolated draft PR #1 | NOT merged; Primary `main` and both backup SHA refs remain `1393c48...` |
| External staging and production | No authorized operations | Unchanged; seven original findings still OPEN, release NO-GO |

**Next:** exact 2-file guard-only exception to make actual Primary GitHub Actions eligible, with fail-closed protections preserved. No DNS domain or VPS required for this CI fix.

---

## NEXT-02 actual feature/status correction — 2026-11-19 latest evidence

| Verified item | Actual outcome at tested code SHA `4d0b124af57c8d407bf609540b8b8b7a69a479b5` |
|---|---|
| Primary R06 eligibility and literal shell newlines | **PASS**: read-only Primary R06 job ran, lint/typecheck were actual executable statements |
| Initial zone-loading and Admin Update test lint exceptions | **PASS**: scoped source/test changes; lint, TS, UI/test/build all successful in CI |
| R06 host Nginx legacy names and negative static contract | **PASS source/CI only**: matching upstream/cache/log/proxy refs; actual host Nginx not tested |
| Disposable PostgreSQL integration | **PASS**: Primary-specific shell gate, ephemeral target, migrations/auth tests |
| Disposable SMTP/LMTP/Maildir and negative cases | **PASS**: loopback Docker image rehearsal; **not an external production mail acceptance** |
| Isolated encrypted backup/restore, ACL and rollback | **PASS** in disposable CI; offsite custody/live restore **NOT TESTED** |
| NO-GO governance and original security/provenance | **PASS fail-closed CI enforcement**: 7 original findings still OPEN, 17 live-stage gates still unaccepted |
| NEXT-01 dedicated backup branches | **Previous 2/2 PASS at earlier Primary SHA** `1393c48fdc821756213e9c0ca87dd166ee3f6b75`; new source-ref parity must be verified **after** NEXT-02 Primary promotion |

**Canonical verification:** [Primary R06 #44509947742](https://github.com/vibtoolshq/ReadBox/actions/runs/44509947742) SUCCESS on `4d0b124af57c8d407bf609540b8b8b7a69a479b5`. This section supersedes historical NEXT-02 "BLOCKED" status entries after the new guarded source tests passed. Next operation is non-force Primary/backup ref synchronization, then separately approved NEXT-03 controlled test domain; production NO-GO remains.

---

## Latest actual-working truth — 2026-11-19 source freeze

**Source freeze (2026-11-19 Asia/Dhaka):** authoritative `vibtoolshq/ReadBox/main` 6f3bc1e3aeb441956e1fd0f4d81558a6aba2945f; tree `f82b07b6e0770850edd3431f041d5162848d442a`. Last full disposable Primary R06 CI ran against executable code 4d0b124af57c8d407bf609540b8b8b7a69a479b5: [run #44509947742](https://github.com/vibtoolshq/ReadBox/actions/runs/44509947742), SUCCESS. Compare 4d0b124af57c8d407bf609540b8b8b7a69a479b5..6f3bc1e3aeb441956e1fd0f4d81558a6aba2945f: **one documentation-only commit changing notes/003–006**, no executable change. At freeze time both dedicated backup refs `backup/dns-final-primary-20261119` matched 6f3bc1e3aeb441956e1fd0f4d81558a6aba2945f (2/2); backup repositories' separate `main` branches did not. **This new notes-only commit will advance Primary HEAD beyond the freeze; do not claim backup parity at that new HEAD without a new remote readback.** Historical source snapshots below are preserved and must not be mistaken for current source. Production remains **NO-GO**: 32 original findings, 25 CI-contract verified and 7 OPEN; 17 independently accepted production gates not evidenced. Historical R-01–R-06: 6/6 CI implemented. NEXT-01 and NEXT-02: 2/4 completed; NEXT-03 and NEXT-04: 2/4 pending.

- **CODE PRESENT:** admin/user inbox, authenticated routes, PostgreSQL/Prisma, opt-in Postfix/Dovecot/LMTP, Maildir/ingestion, backup/restore agents, Cloudflare per-domain zone selection, idempotent MX/A/SPF/DKIM/DMARC source publishing and DKIM encrypted R2 escrow guard. Exact code paths: [017](017-CURRENT-FORENSIC-PATCH-REFERENCES-2026-11-19.md). **Not** equivalent to a current live production deployment.
- **DISPOSABLE CI PASS:** Primary R06 [#44509947742](https://github.com/vibtoolshq/ReadBox/actions/runs/44509947742) at 4d0b124af57c8d407bf609540b8b8b7a69a479b5: lint/typecheck/Next build, disposable PostgreSQL, SMTP/LMTP negative tests, encrypted isolated restore/rollback, template checks, final NO-GO enforcement. Later source freeze 6f3bc1e3aeb441956e1fd0f4d81558a6aba2945f differs **only by notes/003–006**.
- **OPERATOR-OBSERVED PARTIAL LIVE:** [016](016-LIVE-INBOUND-DEPLOYMENT-ACCEPTANCE.md) one Gmail to authenticated inbox, STARTTLS and local GPG archive; it does not establish current-SHA deployment, external DNS and offsite restore acceptance.
- **NOT IN PRODUCT:** outbound SMTP submission or active DKIM signing; `src/core/dns/dkim-provision.ts` returns `signing: "inactive"`. Do not label intentional inbound-only boundaries as defective.
- **STILL UNVERIFIED:** Phase-01 real Cloudflare/R2/registrar/TLS/port evidence; Phase-02 independent staging mail+attachment digest/host recovery/offsite retention/restore/legal and all 17 formal gates. Hence no independent production GO. Per-phase actual feature delta must use [018](018-PHASE-EXECUTION-AND-CLOSURE-TEMPLATE.md).
