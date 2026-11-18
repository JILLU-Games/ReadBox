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
