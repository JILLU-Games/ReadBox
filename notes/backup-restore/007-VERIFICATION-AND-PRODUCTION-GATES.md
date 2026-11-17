# BR-007 — Exact Focused Verification, Rollback and Release Gates

**Source baseline:** `0e8a19e583719e56c054406581bedcf5599f1ace`; BR-01 exact code commit `f742231e25c5d4969d76cb5ec441b4f23eeddfc8` validated by [R-06 consolidated CI](https://github.com/JILLU-Games/ReadBox/actions/runs/44186452845). **BR-01 source/CI PASS; BR-02–04 gates NOT RUN.** Existing R-05 CI may pass, but does not prove future UI/agent/R2/production restore. Never conflate planned tests with actual results.

## BR-01 — focused UI contract

- Admin in `/vcon` sees only one new `Backup` item under `System & Settings`; active and collapsed states unchanged.
- Non-admin cannot view management navigation; direct `/vcon/backup` denies per existing rule; unauthenticated redirects appropriately.
- Desktop/mobile, light/dark theme and disabled controls use existing components; no fake backup state, secret input or active restore.
- Source diff limited exactly to BR-01 allowlist; existing `tests/ui/app-shell.test.tsx` and new `tests/ui/vcon-backup.test.tsx` PASS; lint/typecheck as part of focused CI.
- No browser network request to invented/privileged agent; no SMTP/web/mailbox changes.

## BR-02 — focused encrypted backup & job persistence

- Container non-root UID1001 remains, Web has no Docker socket, unchanged Postfix/Dovecot/worker mounts/ports and no public backup port.
- Agent missing/unavailable is safe; unauthorized requests cannot enqueue jobs; input unknown action/path traversal/JSON oversize fails closed.
- Local backup disposable Compose contains PostgreSQL public+mailserver, Maildir, attachments, media and selected queue; encrypted before publication; ACL and UID 1001 intact.
- Verify V2 detects archive tamper, wrong key, wrong project, wrong UID, malformed paths and partial temp archives.
- Stop/restart exact original writers; protect against concurrent run, web restart or agent restart, disk-full and command failure.
- Job status remains queryable from persisted agent state, audit/log redaction and copy safe; no plaintext secrets or message bodies.
- Existing `deployment/operations/tests/r05-rehearsal.sh` runs unchanged as focused regression; **never** run against VPS. Install opt-in only after separate explicit approval.

## BR-03 — R2 and schedule

- R2 credential add, replace, test and revoke; wrong key, bucket missing, denied list/write/delete, TLS error, network timeout, no bucket scope leakage.
- Upload starts only for V2 verified encrypted snapshot; duplicate upload idempotent; interrupted upload cannot appear verified; remote content digest verified (not ETag inference).
- Auto schedule disabled by default; test daily/weekly/hourly, timezone/DST, missed run, restart, conflicting restore, retention, no loss of last recovery point.
- R2 mock/emulator CI uses **test-only credentials**; no real user R2 bucket access or production secrets in CI.
- New dependency lock SHA/version and license/security checks PASS.

## BR-04 — isolated restore + negative/rollback

- R05 compatible age backup restores in **disposable named volumes**, DB schemas, mailbox message/attachment hashes, UID/GID, numeric ACL and Postfix queue.
- Wrong project, wrong DB, wrong identity, corrupt archive, unsupported GPG and bad metadata are rejected **before mutation**.
- Post-DB-apply fault injection rolls back; agent termination/restart and rollback failure persist accurate critical state; no false success.
- Superuser authorization, fresh confirm, typed target phrase, maintenance disclosure and duplicate click idempotency enforced server-side and agent-side.
- Cross-operation host lock blocks `scripts/install/readbox-update.sh` while maintenance/restore active, and vice versa.
- All five main services return expected health after disposable successful restore; production SMTP/inbox remains untouched by CI.

## One focused workflow and scope audit per phase

Required evidence fields for each BR phase:
`before_SHA, after_SHA, changed_paths, allowed_paths, test_command, test_exit_code, tests_passed, tests_failed, CI_run_URL, scope_review, risk_and_rollback, source/mirror_SHA, reviewer, approval`.

Patch gate: no deleted/renamed existing source or UI functions; file whitelist exact; `git diff --check` clean. Run latest existing consolidated R06 regression against phase SHA if applicable; do not falsely certify live production from CI-only outputs. Re-run only failed focused subset once after targeted fix and document the reason; no broad test loops.

## Rollback strategy

- Code/UI regression: revert only approved BR phase commit(s) after preserving host backup agent journal, never run `docker compose down -v` or purge real DB; return previous known-good image/config.
- Agent install failure: fail closed, turn off backup UI operations, maintain existing web/mail operations. Do not overwrite preexisting `/var/backups/readbox`, `/var/backups/readbox-encrypted` or keys.
- Snapshot failure: quarantine incomplete artifact, restart previously-running services, explicit failed status; data stays unchanged.
- Restore partial failure: use encrypted pre-restore rollback and verify; if rollback cannot complete, show `CRITICAL_RECOVERY_REQUIRED`, retain artifacts and require operator remediation.
- Remote R2 problems: local backup valid even when upload fails, clearly `R2_SYNC_PENDING/FAILED`; never mark disaster-recovery GO from a successful upload alone.

## Existing release gates are independent

BR-01/BR-02/BR-03/BR-04 completion means **backup module capability acceptance**, not full ReadBox stable production GO. Original R-06 seven historical findings and 17 gates must be reconciled separately with real evidence. Notably offsite policy may conflict with operator's local-only preference; document the exception/risk and obtain explicit approval; never record `RG-14 PASS` without required proof.

## Completion record (update on every phase)

| Phase | Focused CI | App regression | Patch allowlist | Agent/restore evidence | Docs log | Closure |
|---|---|---|---|---|---|---|
| BR-01 | PASS — [R06 Actions](https://github.com/JILLU-Games/ReadBox/actions/runs/44186452845) | PASS — unit/UI/build | PASS — exact 5-path diff, 10/10 disabled | N/A; no agent yet | UPDATED | CLOSED (source/CI) |
| BR-02 | NOT RUN | NOT RUN | NOT REVIEWED | NOT RUN | PLANNED | OPEN |
| BR-03 | NOT RUN | NOT RUN | NOT REVIEWED | NOT RUN | PLANNED | OPEN |
| BR-04 | NOT RUN | NOT RUN | NOT REVIEWED | NOT RUN | PLANNED | OPEN |

BR-01 build and tests ran **only in GitHub Actions against disposable resources**; no production deployment, live SMTP sending, backup/restore execution, tag or stable release was performed in BR-01. BR-02 remains a separate approval-dependent Scope Lock.

## BR-01 implementation patch audit and evidence

- Before SHA: `29c2663cc24c3bb5788932f177ee3bf7f1c1111e`; code SHA: `f742231e25c5d4969d76cb5ec441b4f23eeddfc8`.
- Approved code paths: `src/components/layout/app-shell.tsx`, `tests/ui/app-shell.test.tsx`, `src/app/(workspace)/vcon/backup/page.tsx`, `src/components/vcon/backup-console.tsx`, `tests/ui/vcon-backup.test.tsx`.
- Actual code diff: EXACT SAME FIVE PATHS, 2 modified with additive changes (+2/+5) and 3 added; 0 removed/renamed. Scope violation: 0.
- Static target audit: 1 link, server `requireAdminUser()`, no fetch/child process/hooks, 10/10 disabled action buttons, no fake status. PASS.
- One full CI run: https://github.com/JILLU-Games/ReadBox/actions/runs/44186452845. Code SHA `f742231e25c5d4969d76cb5ec441b4f23eeddfc8`. The consolidated frontend/type/build, dependency audit, PostgreSQL integration, SMTP+LMTP smoke, R05 disposable backup+restore+rollback and immutable historical gates completed with success.
- CI is *not* a live VPS browser acceptance or actual host backup restore; remain honest on production readiness.
- Next BR-02 must test host agent privilege boundary and existing functionality without allowing backup/restore from an uninstalled or unhealthy agent.
