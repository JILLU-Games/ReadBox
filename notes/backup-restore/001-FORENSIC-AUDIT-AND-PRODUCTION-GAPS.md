# 001 — Source-derived BR-03 forensic audit, not a Markdown-only estimate

**Baseline:** `c08b9cd77ec30afc50fe36952eecb982ba90a982` (BR-02), **candidate:** `b8f3fc662d384211d4506e40f13859f9cfcb012a`, **CI:** [#44203727204](https://github.com/JILLU-Games/ReadBox/actions/runs/44203727204) SUCCESS on the candidate only.

## Code evidence, exact paths and anchors

| State | Exact path:line at that SHA | Actual inspected code behavior |
|---|---|---|
| MAIN | `src/app/(workspace)/vcon/backup/page.tsx:4–12` | Imports `requireAdminUser()`, calls `readBackupDashboard()`; prior admin boundary exists |
| MAIN | `src/core/backup/agent-client.ts:9–10,112–128` | Fixed Unix socket/token and dashboard helper; no root Web shell |
| MAIN | `deployment/backup-agent/executor.py:69–81,83–169` | Existing BR-02 local `backup`/`verify` only, delegates to unchanged R-05 |
| MAIN | `deployment/backup-agent/storage.py:55–168` | Persistent private jobs/backups JSON and verified local archive metadata |
| CANDIDATE | `src/app/(workspace)/vcon/backup/actions.ts:46–102` | Authenticated `configureR2Action`, test/list/upload, schedule actions added |
| CANDIDATE | `src/core/backup/validation.ts:7–56` | Payload types strictly enumerate R2 + schedule |
| CANDIDATE | `deployment/backup-agent/agent.py:118–173,293–304` | Signed IPC dispatch for R2/schedule, UTC polling thread (default OFF) |
| CANDIDATE | `deployment/backup-agent/r2.py:53–66,133–273` | Endpoint pinned to `https://{validated accountId}.r2.cloudflarestorage.com`; AESGCM local credential file; probe; `age`-only upload + streamed remote SHA256; remote list |
| CANDIDATE | `deployment/backup-agent/scheduler.py:9–13,60–115` | Default OFF; fixed UTC 6/12/24h intervals; local-only retention with minimum 3 and remote verification |
| CANDIDATE | `src/components/vcon/backup-console.tsx:267–364,414–434` | UI schedule + R2 control; existing restore buttons remain disabled |
| CANDIDATE | `tests/backup/r2-integration.test.mjs:5–133`, `tests/backup/scheduler.test.mjs:5–66` | **Mock** R2 failures/rotation/upload and UTC retention safety tests |
| CANDIDATE | `.github/workflows/readbox-backup-ci.yml:35–126` | Exact path scope check, hashed SDK install, UI/auth/build, disposable tests and existing R-05 recovery |

Source anchors referenced above are at [main](https://github.com/JILLU-Games/ReadBox/blob/c08b9cd77ec30afc50fe36952eecb982ba90a982/deployment/backup-agent/storage.py) or [candidate](https://github.com/JILLU-Games/ReadBox/tree/b8f3fc662d384211d4506e40f13859f9cfcb012a) as stated, **not** the current deployment.

## Exact candidate patch audit

Against `c08b9cd77ec30afc50fe36952eecb982ba90a982`: **14 changed paths**, all inside original BR-03's 16-path allowlist: **six new**, **eight existing modified**. The originally allowed `deployment/backup-agent/executor.py` and `deployment/backup-agent/verification.py` were **not modified**. No auth, mailserver, SQL schema/migration, Dockerfile/Compose, original operator backup script, R-05 recovery, prior deployment data or other UI touched. `notes/**` are separate documentation scope.

## Open evidence-backed blockers (do NOT call production PASS)

1. **BR03-DEP-01 — actual host dependency install gap.** Existing installer `scripts/install/readbox-backup-agent-install.sh:11–15,102–113` checks `python3`, `age` etc then installs/enables a systemd unit; it **does not install** `deployment/backup-agent/requirements.lock`. Unit `deployment/backup-agent/systemd/readbox-backup-agent.service` executes `/usr/bin/python3` directly. Candidate `r2.py:54,94` imports `boto3` and `cryptography` at runtime. CI creates a separate venv: this is **not proof** required libraries are present on VPS. BR-03's existing allowlist **excludes** installer/unit: separate scope exception required.
2. **BR03-REL-02 — bounded retry/backoff missing.** `r2.py:210–273` executes upload/check once and returns a failure on network error; no persisted exponential retry or backoff queue. Candidate does not meet original BR-03 exit wording on bounded retry.
3. **BR03-REL-03 — possible missed auto-upload on interruption.** `agent.py:64–97` marks local backup completed then queues `r2_upload` in a separate operation; restart between those two can leave a verified local backup not auto-uploaded. `autoUpload` assignment after `state.create` is in-memory only (`agent.py:166–181`). Recovery reconciliation + targeted test needed.
4. **BR03-OBS-04 — remote history bounded/incomplete.** `r2.py:193–208` reads only the first `MaxKeys=100` page and displays up to 30; no continuation token or durable complete remote listing. A listing indicates object presence, **not** full remote digest verification.
5. **BR03-SEC-05 — connection-probe cleanup edge case.** `r2.py:133–162` sets `created=True` only **after** successful PUT return; a remote-created object with lost PUT acknowledgement may leave an orphan `health/` object. Test negative cleanup case before claiming strict no-orphan behavior.
6. **BR03-OPS-06 — timer is source-only.** `deployment/backup-agent/systemd/readbox-backup-agent.timer` exists on candidate but is not copied/enabled by existing installer. Actual source agent has an in-process 15-second scheduler thread; timer is **not** a deployed independent scheduler.
7. **BR03-DR-07 — key custody/offsite recovery not proven.** AES master key and encrypted R2 config are in same root-private state directory; independent key custody, real R2 bucket permissions, offsite restore and host-loss survivability have **not** been checked.

**Historical release blockers remain OPEN:** [release governance](https://github.com/JILLU-Games/ReadBox/blob/c08b9cd77ec30afc50fe36952eecb982ba90a982/docs/RELEASE-GOVERNANCE.md) and [17-gate acceptance runbook](https://github.com/JILLU-Games/ReadBox/blob/c08b9cd77ec30afc50fe36952eecb982ba90a982/docs/PRODUCTION-ACCEPTANCE-RUNBOOK.md). A green disposable R2 test is narrower than production readiness.
