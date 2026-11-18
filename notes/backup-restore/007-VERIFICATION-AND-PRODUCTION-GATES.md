# 007 — Evidence-only test and release gate ledger

## Verified source/CI results (NOT VPS acceptance)

| Check | Exact evidence | Current result |
|---|---|---|
| Source and mirror main equality at freeze | Both `c08b9cd77ec30afc50fe36952eecb982ba90a982`, tree `e7cb8fb8db14046cabaae9b3768267cec0efd095` | PASS at audit |
| BR-03 candidate changed only approved original BR-03 paths | `c08b9cd77ec30afc50fe36952eecb982ba90a982`... `b8f3fc662d384211d4506e40f13859f9cfcb012a` compare: 14 changed (6 new, 8 existing) of 16 permitted | PASS |
| BR-03 hashed Python SDK resolver + exact lock | [CI #44202013012](https://github.com/JILLU-Games/ReadBox/actions/runs/44202013012), [#44203727204](https://github.com/JILLU-Games/ReadBox/actions/runs/44203727204) | PASS, CI venv only |
| BR-01/02 UI, admin auth, Prisma validate, lint, types, unit/UI/build | [BR03 CI #44203727204](https://github.com/JILLU-Games/ReadBox/actions/runs/44203727204) | PASS |
| Mock R2 invalid credentials, wrong endpoint, conflict, partial failure, encrypted upload remote digest | `tests/backup/r2-integration.test.mjs`; [BR03 CI](https://github.com/JILLU-Games/ReadBox/actions/runs/44203727204) | PASS — mocked R2 |
| UTC default OFF, restart, no replay, invalid schedule, min3/remote verified retention | `tests/backup/scheduler.test.mjs`; [BR03 CI](https://github.com/JILLU-Games/ReadBox/actions/runs/44203727204) | PASS — disposable |
| Signed Unix IPC / BR-02 age local and V2 tamper | `tests/backup/{agent-protocol,compose-integration}.test.mjs`; CI | PASS — disposable |
| Existing R-05 encrypted restore/rollback regression | `deployment/operations/tests/r05-rehearsal.sh`; CI | PASS — disposable |
| Host installer installs hashed R2 SDK | Existing `scripts/install/readbox-backup-agent-install.sh:11–113` does not provision SDK | **FAIL/MISSING implementation** |
| Automatic-upload durable handoff + retry/backoff + remote history paging | Candidate source lacks required mechanisms; see `001` | **OPEN** |
| Real Cloudflare R2 credentials, bucket access, probe cleanup, aged object retrieval | No authorized real R2 run | NOT RUN |
| VPS backup agent install / real offsite encrypted file / server-loss recovery | No VPS operation approved | NOT RUN |
| BR-04 UI restore, isolated restore capability + rollback + production approval | No implementation/approval | NOT RUN |

## Release governance is independent

The existing original seven blockers and [RG-01–RG-17 runbook](https://github.com/JILLU-Games/ReadBox/blob/c08b9cd77ec30afc50fe36952eecb982ba90a982/docs/PRODUCTION-ACCEPTANCE-RUNBOOK.md) are **not** closed by a fake S3 CI test. ReadBox stable production verdict remains **NO-GO**, regardless of any prior `v0.1.0-rc.1` prerelease artifact or operator-observed inbound test. No production release, tag, live SQL/mail mutation, VPS deployment, real R2 credentials or restore is authorized here.

## Next phase focused test contract (P-01)

- Prevent lost after-success auto upload: persist intent and prove recovery across agent interruption before/after local completion.
- Bounded retry/backoff and idempotency: 404/multipart object, 403, connection timeout, partial remote object, duplicate key, missing local and SHA mismatch; preserve previous working credentials and local archive.
- Owned-probe cleanup on ambiguous PUT result; never make broad remote deletes.
- Pagination + deterministic owned-object history; honest `remote_object_present` vs `remote_verified`.
- Exact 16-path BR-03 allowlist, no other source/UI/Prisma/mailserver edits; one focused disposable CI with existing BR-01/BR-02/R-05 regression.
- Record final commit/run SHA and actual PASS/FAIL in `003–007`. **P-02 installer/unit exception cannot be inferred from P-01 approval.**

## DOC-01 observed main-branch CI after notes cleanup

- [BR-02 CI run 44207319955](https://github.com/JILLU-Games/ReadBox/actions/runs/44207319955) **FAILED**, at old hard-coded BR-02 exact changed-file assertion `.github/workflows/readbox-backup-ci.yml:36–74`. Because HEAD is notes-only, expected cumulative BR-02 18-path diff condition fails. All later BR-02 test jobs were **SKIPPED**, not failed. This is a **workflow contract mismatch**, not a tested app regression. P-01 may change workflow, but DOC-01 scope remains strictly `notes/**`.
- [R-06 run 44207320065](https://github.com/JILLU-Games/ReadBox/actions/runs/44207320065) was triggered at documentation source SHA `7c848c45af654d95c3cd80a8bfa70f5dbc6c4f71`; the workflow completed **SUCCESS** at that exact documentation SHA, including disposable PostgreSQL, SMTP→LMTP and R-05 encrypted restore/rollback checks; this is **not** production signoff. The subsequent final notes-only ledger update has not yet received a separate exact-SHA CI run.

## P-01 / BR-03 hardening — completed source and focused CI evidence

| Gate | Source evidence | Result |
|---|---|---|
| Frozen main/mirror before phase | `92c3ced5724a7b7a48cca24856249ee88fed558c` both repos; BR02 app source from `c08b9cd...` | PASS at entry |
| Candidate code exact 16-path allowlist | Diff `c08b9cd...` to `e3a3128fd77ec7a9afa88bcf8bad2371c0cf8b93`: 14 changed, 8 modifications + 6 additions; no unrelated paths | PASS |
| Hashed boto3 + cryptography SDK | [CI 44210926362](https://github.com/JILLU-Games/ReadBox/actions/runs/44210926362), step 'Install exact hashed Python' | PASS — disposable Python 3.12 only |
| Main app and auth/regression | Same CI: Prisma validate, lint, typecheck, unit/UI, build and R05 contract | PASS |
| Agent syntax + restore-deny boundary | Same CI: py_compile, installer bash -n, no production restore code | PASS |
| Mocked R2 encrypted credential rotation, 403, transient three retries, SHA/immutable conflict, lost ACK, multi-page listing, bad tokens, orphan probe cleanup | `tests/backup/r2-integration.test.mjs`, [CI 44210926362](https://github.com/JILLU-Games/ReadBox/actions/runs/44210926362) | PASS — simulated, no Cloudflare account |
| Durable autoUpload journal persisted before backup; interrupted source recovery and 3-job durable retry cap | `tests/backup/scheduler.test.mjs`, [CI](https://github.com/JILLU-Games/ReadBox/actions/runs/44210926362) | PASS — disposable local journal |
| Existing BR02 HMAC/IPC, age V2 and tamper/restart integration | `tests/backup/agent-protocol.test.mjs`, `compose-integration.test.mjs`; [CI](https://github.com/JILLU-Games/ReadBox/actions/runs/44210926362) | PASS — disposable |
| Existing R05 encrypted restore/rollback | `deployment/operations/tests/r05-rehearsal.sh`; [CI](https://github.com/JILLU-Games/ReadBox/actions/runs/44210926362) | PASS — disposable only |
| Legacy BR02 workflow docs-only mismatch | New workflow `.github/workflows/readbox-backup-ci.yml:35–94` has explicit `notes_only` mode and BR03 mode; original docs-only failure [44207319955](https://github.com/JILLU-Games/ReadBox/actions/runs/44207319955) documented | Source code fix + BR03 candidate CI PASS; **separate notes-only-main run not yet evidenced** |
| Tested source equals published source app code | Final code commit `fbffce74040d63f5ea2a70f8e1f04dfcb725ab08`; 785 non-notes blob path+SHA equal tested branch `e3a3128...` | PASS (Git tree comparison); final documentation commit may have a different whole-tree SHA |
| VPS host SDK install / real Cloudflare bucket / production offsite key restore | Installer+unit outside approved P-01 allowlist; no approved real operations | **NOT RUN — P-02 blocker** |
| BR-04 guarded restore UI/API and independent RG-01–RG-17 acceptance | User has not authorized BR04 or production recovery | **NOT IMPLEMENTED / NO-GO** |

**CI scope:** exactly the P-01-approved 16 source paths and `notes/backup-restore/003–007`. The R-05 recovery engine, current production Docker Compose, private volume and mailserver are unchanged. No VPS, real R2 key, real restore, GitHub tag, image publication or release. Source/mirror parity must be explicitly verified after final commit; an identical code tree in a different Git commit is not enough.

## P-02 focused regression and patch audit (2026-11-18)

- Frozen source/mirror entry: `f813ad15ad5895c5cfea9ed3ce6b402b1cae7142`, exact tree `8bb0bda58402b4f81e24c3386263216a65cc11dd`.
- Approved actual code changes: `scripts/install/readbox-backup-agent-install.sh` (packaging and transactional update), `deployment/backup-agent/systemd/readbox-backup-agent.service` (pinned venv/one scheduler), plus **explicitly user-approved** `AGENTS.md` (compact phase rules). Existing `deployment/backup-agent/requirements.lock` is used verbatim; `notes/backup-restore/003–007` updated. No scope beyond these paths.
- **One GitHub CI regression (exact candidate):** [R-06 #44215136163](https://github.com/JILLU-Games/ReadBox/actions/runs/44215136163) **SUCCESS** at `4c619732e2cc53990cb4f41dbbfe5c17276c8ef8`: app/auth/UI/build, dependency advisories, disposable PostgreSQL, SMTP→LMTP and encrypted R-05 restore/rollback checks PASS. **Not covered:** executing P-02 installer/unit against actual systemd; those remain source-audited only, pending explicit operator acceptance.
- Source safety proof: locked release-digest venv, non-root mode, hashed binary-only pip, recheck marker, exact checksum guard for existing unit, atomic current/unit replacement and rollback, global backup lock + queued/running job refusal, no timer auto-start. Failure paths preserve live data but any nonfunctional rollback requires operator escalation.
- Production host/Cloudflare, real R2 offsite, private age identity disaster recovery, active service migration and guarded BR-04 restore: **NOT RUN**. Formal production release GO remains **NO-GO**. No VPS deployment, tag, release, root secret manipulation or restore.


**Exact patch scope:** compared with main baseline `f813ad15ad5895c5cfea9ed3ce6b402b1cae7142`: only host installer, systemd unit, user-authorized `AGENTS.md` rules, and notes 003–007 (8 paths), no deletion. Original `requirements.lock` hash-pinned source unchanged; existing app/UI/auth/Prisma/mailserver/volumes unaffected. Source/mirror SHA + tree parity requires post-publication verification.

## P-03 / BR-04 focused source + CI evidence ledger (2026-11-18)

| Check | Evidence and current status |
|---|---|
| Entry source/mirror parity | Both `main` at `62347e35b5b992f8f7c4ef802cd64addd74a5d08` before patch — PASS |
| Exact BR04 allowlist | Planned: up to 19 paths listed in `002`, plus `notes/003–007`; final diff pending |
| New guarded source | `deployment/backup-agent/{restore,legacy_gpg,agent,executor,storage}.py`, Next.js backed RPC/actions, Admin restore panel; source staged |
| Read-only and operator-only gate | Expected: host default-deny, disposable CI flag only, actor-bound hashed TTL permit, no arbitrary input paths; runtime CI pending |
| Failed/critical restore, file tamper/symlink and replay | New `tests/backup/{restore-contract,restore-failure,legacy-format}.test.mjs` and UI tests; CI pending |
| Existing R05 complete PostgreSQL/Maildir/queue/UID/ACL rollback | Existing `deployment/operations/tests/r05-rehearsal.sh`; CI pending |
| Auth/UI/build regression | Existing unit/UI lint/typecheck/build; CI pending |
| Actual production restore/R2/VPS install | **NOT RUN**, forbidden under P-03 |
| Production release | **NO-GO**, no tag or release |

**One focused disposable CI run only.** If its specific failures require a minimal scoped correction, run a necessary focused recheck only; do not run unrelated verification loops. A failed job is not a PASS.

## P-03 / BR-04 observed focused CI and final release separation (2026-11-18)

| Gate | Evidence | Result |
|---|---|---|
| Entry source/mirror main | Both `62347e35b5b992f8f7c4ef802cd64addd74a5d08` | PASS at entry |
| Final tested source/tree | `d4cc3ca386d64e9f9a3329b757881a280cb63a0e` / `edfa226dd47833477f1a7e597fd89154633865b2` | PASS |
| Exact source/notes scope | 21 changed paths: 16 within 19 allowed source/test, five `003–007` notes; zero unexpected/deletions | PASS |
| Successful focused CI | [JILLU BR04 run #44222091348](https://github.com/JILLU-Games/ReadBox/actions/runs/44222091348) at exact tested SHA | PASS |
| Existing app auth, UI, unit, lint-baseline, typecheck and build | BR04 job: `Existing auth, UI, database contracts and frontend regression` | PASS (disposable) |
| Actor/gate/one-time confirmation/replay, corrupt age and legacy GPG | BR04 job: `Guarded restore challenge, rollback-failure and legacy GPG negative tests` | PASS (isolated / mocked failure) |
| Existing R05 DB/Maildir/queue/ACL rollback | BR04 job: `Original R05 real disposable PostgreSQL/Maildir/queue/ACL restore and rollback` | PASS (disposable) |
| Python 3.12 locked deps and updater syntax | BR04 job: `Pinned Python SDK and age host toolchain on isolated runner` | PASS (isolated/static) |
| Live VPS installer, systemd, R2 API, host-loss private age identity and production restore | No such operation approved or performed | **NOT RUN** |
| Exact source/mirror main SHA/tree publication | Verify post-sync branch refs; do not infer from CI | **VERIFY AFTER NON-FORCE SYNC** |
| 17 live production acceptance gates, stable release | Separate formal authorization/evidence outstanding | **NO-GO** |

Previous seven original open R06 findings and historical baseline lint debt remain independent. This notes-only closure does not require unnecessary CI rerun or authorize VPS, SMTP, release/tag or live restore.
## PA-01 CI-Ready exact SHA gate ledger (2026-11-18)

| PA01 focused requirement | Evidence | Status |
|---|---|---|
| Source/mirror baseline at entry | Both `main` `415acc331e2a37e3cff8e1f2e98b46c33f9d8276` | PASS at freeze |
| Approved code scope | Five paths (two workflows, two new disposable rehearsal scripts, two-line installer heredoc correction); notes `003–007` only at closure | PASS |
| Exact verified candidate/tree | `4aab358ec40f67cd37fc581f51266eb2a79d712a` / `5bb30fecced6c064d70d5628acf66e9c7250650b` | PASS |
| Successful one focused recheck | [GitHub Actions #44230645414](https://github.com/JILLU-Games/ReadBox/actions/runs/44230645414), exact head | PASS |
| Disposable Ubuntu root installer + systemd / HMAC IPC / maintenance lock / rollback | Same CI steps; authenticated readiness bounded 10s | PASS (CI host only) |
| Mock Cloudflare R2, scheduling, BR04 security / IPC / GPG negatives | Same CI job | PASS (mock/disposable) |
| Offsite copy, escrowed age, wrong-key refusal, full synthetic restored volumes | Same CI job, independent copied key and destroyed/re-created disposable Compose volumes | PASS (simulated offsite) |
| R05 post-DB apply failure/automatic rollback, tamper rejection | Same CI job | PASS (disposable) |
| First failed attempts | [#44229192380](https://github.com/JILLU-Games/ReadBox/actions/runs/44229192380) syntax; [#44230130477](https://github.com/JILLU-Games/ReadBox/actions/runs/44230130477) restart race | FAIL (historical, corrected) |
| Live VPS install, Cloudflare R2, actual host loss, private key custody, production restore | No authorization or operation | **NOT RUN** |
| Source/mirror/local final main SHA/tree parity | Independently check AFTER notes commit / fast-forward sync | POST-PUBLICATION CHECK |
| Formal RG-01–17 and release | Independent live staging and human review missing | **PRODUCTION NO-GO** |

Do not count mocked R2 or synthetic host-loss as actual offsite production recovery. No tag, release, VPS update or live restoration is part of this phase.
