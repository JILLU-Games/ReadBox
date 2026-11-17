# BR-002 — Exact Four-Phase Implementation Roadmap / Scope Lock

**Target source freeze:** `0e8a19e583719e56c054406581bedcf5599f1ace`. **Status:** PLAN ONLY; no implementation. Every path below is relative to repository root and is an **explicit allowlist for its phase**, not a claim it currently exists. Phase notes (`003–007`) may be updated at phase close; no other Markdown file may be rewritten silently.

## Global rules and interface

- Add `System & Settings → Backup` at `/vcon/backup`. Keep current colors, layout, navigation semantics and existing pages unchanged.
- Host privileged execution separate from UID 1001 Web; never expose raw Docker socket, arbitrary shell args, host paths or a root-access HTTP port to Web. Mutations are strict enumerated jobs and durable/safe.
- Preserve `prisma/schema.prisma` and all existing migrations. Use private host-local state with transaction/atomic persistence for job/credentials/schedules; this survives DB restore.
- Data snapshots use source-approved `age` format with manifest/scope. Preexisting `.tar.gz.gpg` is a distinct legacy format; do not route to age restore or claim cross-format support without evidence.
- No production VPS data mutation, live SMTP sends, restore, root-agent installation or tag/release during normal implementation phases. Production restore remains disabled until BR-04 test and separate authorization.
- One focused suite per phase plus a scoped patch review; no local full-product build loop. CI actions use disposable resources, never real VPS. Scope exception requires explicit recorded approval.

## BR-01 — Sidebar + read-only compact UI skeleton

**Existing files allowed (minimal additive):**
1. `src/components/layout/app-shell.tsx` — at `:14–33` add only icon import; at `:109–118` append one `{ href: "/vcon/backup", label: "Backup", icon: HardDrive }` entry inside existing `system-settings` items.
2. `tests/ui/app-shell.test.tsx` — append exact administrator-visible and regular-user-hidden navigation assertions only.

**New files allowed:**
3. `src/app/(workspace)/vcon/backup/page.tsx` — server page with `requireAdminUser()` and unavailable/not-configured summary; no privileged work.
4. `src/components/vcon/backup-console.tsx` — compact existing UI primitives, sections for Overview/Backups/Schedule/R2/Activity; buttons *disabled with explanation* until corresponding phase. Never fake success/connection.
5. `tests/ui/vcon-backup.test.tsx` — UI role, layout, disabled placeholder, responsive and state labels.

**Exact source patch anchors (before → after, proposed only):**

```diff
--- a/src/components/layout/app-shell.tsx
+++ b/src/components/layout/app-shell.tsx
@@ imports (existing "lucide-react" list, lines 14-33)
+  HardDrive,
@@ system-settings items (existing lines 113-116)
     { href: "/vcon/settings", label: "Settings", icon: Settings },
     { href: "/vcon/system-update", label: "System update", icon: ArrowUpCircle },
+    { href: "/vcon/backup", label: "Backup", icon: HardDrive },
```

**Exit:** route renders with existing admin gate; no user route visible to non-admin; no new network activity; old UI/navigation tests PASS. **Do not** introduce agent/API, restore handler or secret form yet.

## BR-02 — Privilege-separated local encrypted backup, verify, durable logs

**Existing files allowed:**
1. `docker-compose.yml` — strictly under `web.volumes` at `:107–112`, add one narrowly-scoped agent IPC mount. No changes to `postgres`, `worker`, `postfix`, `dovecot`, named data volumes, ports, environments/secrets or restart policy.
2. `src/app/(workspace)/vcon/backup/page.tsx` — actual agent-status + job summary.
3. `src/components/vcon/backup-console.tsx` — operational Manual Backup, Verify, progress, sanitized Copy Logs.

**New files allowed:**
4. `src/app/(workspace)/vcon/backup/actions.ts` — admin-scoped Server Actions to queue only allowlisted backup/verify jobs, no long blocking execution.
5. `src/app/api/vcon/backup/jobs/[id]/route.ts` — authenticated no-store job status/log pagination (bounded).
6. `src/core/backup/contracts.ts` — typed job IDs, states, status and snapshots.
7. `src/core/backup/validation.ts` — strict schema validation, safe opaque IDs and no arbitrary paths.
8. `src/core/backup/permissions.ts` — admin/superuser predicates; server enforcement.
9. `src/core/backup/agent-client.ts` — private authenticated Unix IPC, bounded timeouts and no root shell.
10. `deployment/backup-agent/agent.py` — constrained local broker and durable journal.
11. `deployment/backup-agent/executor.py` — allowlisted job runner invoking existing **unchanged** `deployment/operations/compose_recovery.py`; one global lock; interrupted jobs recoverable.
12. `deployment/backup-agent/storage.py` — private host-side atomic state, encryption-key reference, job history and retention metadata.
13. `deployment/backup-agent/verification.py` — format/checksum/decrypt/manifest/size/quota checks, no production mutation.
14. `deployment/backup-agent/systemd/readbox-backup-agent.service` — host-side restricted daemon service, exact install-time project/UID.
15. `scripts/install/readbox-backup-agent-install.sh` — idempotent opt-in guarded install, no existing secrets/volumes overwrite.
16. `tests/backup/agent-protocol.test.mjs` — auth, unsafe input, interruption/lock and job journal.
17. `tests/backup/compose-integration.test.mjs` — disposable Compose encrypted backup/verify, UID/GID/ACL, restart and no-production-target guards.
18. `.github/workflows/readbox-backup-ci.yml` — focused CI, readonly repo token, isolated services.

**Exit:** one locally encrypted, age-backed data snapshot created and verified on disposable Compose; persistent job history/logs across web restart; no raw secret leakage; existing mail ingestion regression PASS. If host agent unavailable, old app works and new UI shows `Agent unavailable`. No production restore yet.

## BR-03 — R2 storage, credentials, scheduling, automatic/manual upload

**Existing BR files allowed to extend:**
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

**New files allowed:**
11. `deployment/backup-agent/r2.py` — restricted S3-compatible R2 adapter, pinned safe SDK, TLS-only endpoint and exact bucket/prefix.
12. `deployment/backup-agent/scheduler.py` — atomic persisted schedule, deduplication, maintenance lock, no overlap, default OFF.
13. `deployment/backup-agent/requirements.lock` — exact pinned package versions **and hashes**, frozen after dependency/license audit.
14. `deployment/backup-agent/systemd/readbox-backup-agent.timer` — scheduled wakeup, disabled until opted in.
15. `tests/backup/r2-integration.test.mjs` — mock/S3-compatible emulator, wrong credentials, timeout, upload verify, duplicate and partial failure.
16. `tests/backup/scheduler.test.mjs` — restart, missed run, timezone/DST, lock, retry and retention tests.

**Exit:** authenticated/rotatable R2 credentials never echoed back; connection test with least privilege; manual and auto encrypted upload with content checksum verification; remote listing/history; failures retry with bounded backoff; retention preserves minimum verified recovery points. No delete-by-prefix operations; no plaintext R2 uploads. No restore from R2 until BR-04.

## BR-04 — Guarded test restore, production restore, rollback and end-to-end closure

**Existing files allowed:**
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
11. `scripts/install/readbox-update.sh` — **only** a narrow shared maintenance lock check/guard before update/snapshot at `:42–63`, preserving original update semantics.
12. `.github/workflows/readbox-backup-ci.yml`

**New files allowed:**
13. `deployment/backup-agent/restore.py` — audited local rollback/isolated restore orchestration; exact project/DB/volume match.
14. `deployment/backup-agent/legacy_gpg.py` — optional read-only detection/listing of the previously observed GPG bundle; never silently auto-restore incompatible format.
15. `tests/backup/restore-contract.test.mjs` — temp project DB+Maildir+ACL+queue restore, successful restart, identity match.
16. `tests/backup/restore-failure.test.mjs` — corrupt archive, missing key, DB apply failure, SIGTERM, host agent restart, rollback partial failure.
17. `tests/backup/legacy-format.test.mjs` — GPG/age mismatch and explicit unsupported state.
18. `tests/ui/vcon-backup.test.tsx` — restore UI role and confirmation tests.
19. `tests/ui/app-shell.test.tsx` — regression recheck, only test assertions if needed.

**Exit:** verify/read-only, disposable full restore, and explicit superuser-confirmed production restore *capability* with encrypted pre-restore rollback, durable recovery journal and postchecks. **CI exercises destructive restore only against disposable volume/project**; no real production restore is authorized. R2 restore staged local and verified before any production mutation. Independent acceptance needed before production enablement.

## Phase closure mechanics

Each phase: inspect exact `main` and mirror SHAs → freeze allowlist → implement only allowed source paths → one focused test suite + full existing CI gate as applicable → targeted diff audit (`git diff --name-only`, `git diff --check`) → update `003`, `004` if needed, `005`, `007` → one commit and mirror exact sync. No tag, release, automatic VPS update, secrets or database migration unless separately authorized.

### Permanent denylist in all four phases

`src/core/auth/**`, `src/core/ingestion/**`, `src/core/mailboxes/**`, `src/core/messages/**`, `deployment/mailserver/**`, `prisma/schema.prisma`, `prisma/migrations/**`, `Dockerfile`, `scripts/ops/backup.sh`, `scripts/ops/restore.sh`, `deployment/operations/compose_recovery.py`, existing settings/operations/system-update consoles, existing release docs and current production volumes. File deletion or renaming is excluded. Exceptions only through a separate signed Scope Lock before any change.

**Important:** the planned host agent design is not complete until IPC, key provisioning, filesystem/mount permissions and safe unattended recovery are exercised in isolated tests. These docs do not assert their success.
