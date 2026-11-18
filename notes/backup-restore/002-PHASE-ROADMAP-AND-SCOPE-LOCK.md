# 002 — New documentation-first roadmap and immutable file Scope Locks

## Strict status

**DOC-01 — this task: clean/rebuild `notes/` before more coding.** Only `notes/**` is permitted. Old dev reports may be removed from the active tree only with links preserved, full Git history maintained and exact preclean SHA documented. No BR-03 candidate source changes in DOC-01.

**Next P-01 / BR-03 hardening:** The candidate already exists on `maintenance/readbox-br03-20261118` at `b8f3fc662d384211d4506e40f13859f9cfcb012a` and [CI passed](https://github.com/JILLU-Games/ReadBox/actions/runs/44203727204); it is **not on main**. Before merging, fix BR03-REL-02, BR03-REL-03, BR03-OBS-04 and BR03-SEC-05, add direct failure/restart tests, check exactly scoped patch + one focused CI. No real R2 keys or live network. BR03-DEP-01 cannot be fixed inside this allowlist.

### P-01 exact ORIGINAL BR-03 allowlist — NO additions

Existing BR files:
1. `src/components/vcon/backup-console.tsx`
2. `src/app/(workspace)/vcon/backup/actions.ts`
3. `src/core/backup/contracts.ts`
4. `src/core/backup/validation.ts`
5. `src/core/backup/agent-client.ts`
6. `deployment/backup-agent/agent.py`
7. `deployment/backup-agent/executor.py`
8. `deployment/backup-agent/storage.py`
9. `deployment/backup-agent/verification.py`
10. `.github/workflows/readbox-backup-ci.yml`

New files (already present in candidate):
11. `deployment/backup-agent/r2.py`
12. `deployment/backup-agent/scheduler.py`
13. `deployment/backup-agent/requirements.lock`
14. `deployment/backup-agent/systemd/readbox-backup-agent.timer`
15. `tests/backup/r2-integration.test.mjs`
16. `tests/backup/scheduler.test.mjs`

**P-01 patch anchors:** `agent.py:64–97` auto-upload handoff, `r2.py:133–162,193–273` connection/upload/history, `scheduler.py:60–115` UTC/retention, `storage.py` durable journal, `tests/backup/{r2-integration,scheduler}.test.mjs` fault injection, `src/components/vcon/backup-console.tsx:267–364` R2 controls.

**Exit:** bounded retries + idempotency tested; durable auto-upload survives interrupt; R2 owned probe and pagination hardened; existing BR-01/BR-02 UI/security regression and unchanged R-05 restoration PASS; exact allowlist audited and documented. **No code edits or merging under DOC-01.**

### P-02 / BR-03 host packaging exception — separate explicit approval REQUIRED

**NOT APPROVED under original BR-03 Scope Lock.** To make R2 usable on a real host, propose a separately reviewed exception only for `scripts/install/readbox-backup-agent-install.sh`, `deployment/backup-agent/systemd/readbox-backup-agent.service`, and existing `deployment/backup-agent/requirements.lock` as applicable. Fix pinned `--require-hashes` dependency installation into a controlled root-only interpreter/venv, fail closed on mismatched Python versions, safe idempotent upgrade/rollback without replacing existing identities/secrets/volumes; explicitly decide whether timer is used or in-process scheduler is authoritative. Separate CI and phase audit. **Do not edit installer or systemd files until approval.**

### P-03 / BR-04 RESTORE — future separately authorized phase

**Previously approved *plan*, NOT approved for implementation by this documentation request.** Original allowed files only:
1. `src/components/vcon/backup-console.tsx`
2. `src/app/(workspace)/vcon/backup/actions.ts`
3. `src/app/(workspace)/vcon/backup/page.tsx`
4. `src/core/backup/permissions.ts`
5. `src/core/backup/contracts.ts`
6. `src/core/backup/validation.ts`
7. `deployment/backup-agent/agent.py`
8. `deployment/backup-agent/executor.py`
9. `deployment/backup-agent/storage.py`
10. `deployment/backup-agent/verification.py`
11. `scripts/install/readbox-update.sh` (shared maintenance lock ONLY)
12. `.github/workflows/readbox-backup-ci.yml`
13. `deployment/backup-agent/restore.py` (new)
14. `deployment/backup-agent/legacy_gpg.py` (new, optional read-only detection)
15. `tests/backup/restore-contract.test.mjs` (new)
16. `tests/backup/restore-failure.test.mjs` (new)
17. `tests/backup/legacy-format.test.mjs` (new)
18. `tests/ui/vcon-backup.test.tsx`
19. `tests/ui/app-shell.test.tsx`.

BR-04 exit: isolated disposable DB/Maildir/ACL/queue restoration, pre-restore encrypted rollback and fail-closed role/identity confirmation; **no real production restore without a second independent operator approval**. No compatibility assumption between legacy GPG and age R-05.

### Production acceptance (not a phase of this source work)

Real Cloudflare R2 proof, independent age identity custody, offsite restoration test, remaining [RG-01–17](https://github.com/JILLU-Games/ReadBox/blob/c08b9cd77ec30afc50fe36952eecb982ba90a982/docs/PRODUCTION-ACCEPTANCE-RUNBOOK.md) and separate release decision all remain outside current authorization. **No VPS, real credentials, DNS, SMTP, release, tag, image, or remote source/mirror merge until its intended phase and authorization.**

## Per-phase close

Baseline SHA/tree → exact allowlist diff → source audit + minimal fix → focused disposable CI + safety regression → Markdown `003–007` actual PASS/FAIL → local source/mirror exact SHA fast-forward sync **when that phase is approved for publication** → next short approval prompt. No unverified completion claim.
