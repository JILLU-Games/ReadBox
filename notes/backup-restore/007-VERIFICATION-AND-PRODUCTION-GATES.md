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
