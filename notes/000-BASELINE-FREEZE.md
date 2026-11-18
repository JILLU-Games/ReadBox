# 000 — Baseline Freeze & Development Scope Governance

**Freeze date:** 2026-11-17 (Asia/Dhaka)
**Immutable Git commit:** `e28886e5e0f7a155cd64e23bc8ee8f6668d6699c`
**Immutable Git tree:** `9a3d935cfc66bcfc1f5f717d77b99bfd3006d63c`
**Upstream:** https://github.com/JILLU-Games/ReadBox
**Mirror:** https://github.com/vibtoolshq/ReadBox
**Original forensic code baseline:** `810fb81c5ad4d1fafe4f1d255561dfcaa60707cb`
**Source findings:** [VPS-PRODUCTION-FORENSIC-AUDIT-2026-11-17.md](VPS-PRODUCTION-FORENSIC-AUDIT-2026-11-17.md)
**Release decision:** **NO-GO**; **no production fix started**.

## Git baseline proof

The two repositories were checked to have the same `refs/heads/main` SHA and tree above, with no additional refs. Recursive source tree: **950 entries; 716 tracked files**, including **206 `src/`**, **42 `tests/`**, **10 `scripts/`**, **391 `reference/`**, **12 `docs/`**, **8 `deployment/`** and **10 `prisma/`** blobs.

Git Compare from inspected code baseline `810fb81...` to the frozen commit `e28886e5e0f7a155cd64e23bc8ee8f6668d6699c` showed changes **only under `notes/`**. Therefore the prior forensic code findings still apply. The older report retains its own historical inspected SHA: do not silently rewrite it to this newer documentation-only freeze. Note that this planning-document commit creates a new HEAD but **does not move the immutable baseline**.

Previously verified GitHub CI: 167 unit/contract + 70 UI tests, `npm ci`, schema validation, typecheck, lint and Next.js production build passed. Evidence: https://github.com/JILLU-Games/ReadBox/actions/runs/44080430558. This is *not* a Docker/SMTP/live VPS or restore test.

## Non-negotiable global Scope Lock

1. Preserve the existing app UI/UX, screens/layout/CSS, route names, feature behavior, session/auth authorization, users/mailbox state and message/attachment data; exception only for a documented, approved, directly necessary release blocker.
2. **One authoritative PostgreSQL database** with `public` and `mailserver` schemas (`AGENTS.md:1–3`). Prisma remains ORM. No MySQL, MariaDB, SQLite, Redis or second production data store.
3. Canonical Maildir: `/var/vmail/<domain>/<local>/Maildir/{new,cur,tmp}`, canonical relative path `domain/local/Maildir/`, attachments `/var/lib/readbox/attachments`. No broad permission opening, silent data deletion or path rewrites.
4. `reference/MailStack/` remains separate upstream reference with AGPL license/NOTICE; do not rewrite or remove third-party legal obligations.
5. Each of **six** implementation phases must use only the allowed exact files/patterns in `002-PRODUCTION-PHASE-ROADMAP.md`. For shared files (e.g. `docker-compose.yml`), only the phase-owned section may change.
6. **No implementation authorization is implied** by this roadmap. No application/config/schema edit, live VPS/DNS change, SMTP sending/receiving, real credential access, release/tag/publish or force-push in this documentation phase.
7. Prior to implementation of each separately approved phase: verify current SHA, inspect relevant old behavior and commit changes only after one focused phase test + patch audit, record evidence, then fast-forward both repos to the same commit SHA.
8. Preserve existing migrations; old applied migration files are immutable. Data-affecting work needs reversible steps and tested backups.
9. Release **GO** is forbidden without real Postfix/Dovecot SMTP→LMTP→Maildir→UI acceptance plus negative, security and recovery evidence (`006`).

## Evidence/status vocabulary

- **CONFIRMED STATIC:** source/config mismatch observed.
- **VERIFIED CI:** test completed with a run URL and tested SHA.
- **UNVERIFIED LIVE:** no real host/service/network evidence; not necessarily a reproduced failure.
- **OPEN / IN PROGRESS / BLOCKED / VERIFIED CLOSED:** tracker states; all 32 findings currently **OPEN**.
- A phase is not complete merely because code exists or a CI run for an earlier SHA passed.

## Documentation index

- `001-PRODUCTION-RELEASE-BLOCKERS.md` — all 32 issue IDs, source-code excerpts, exact paths and acceptance criteria.
- `002-PRODUCTION-PHASE-ROADMAP.md` — 6 ordered Scope-Locked phases and path allowlists.
- `003-PHASE-PROGRESS-AND-CHANGE-LOG.md` — immutable phase completion ledger.
- `004-ERROR-HANDLING-INVENTORY.md` — implemented error handlers vs unverified production errors.
- `005-ACTUAL-IMPLEMENTATION-TRACKER.md` — present code vs CI-tested vs real-VPS tested.
- `006-VERIFICATION-AND-RELEASE-GATES.md` — real GO/NO-GO test evidence.
- `007-VPS-MAILSERVER-CONTRACTS.md` — DB, Maildir, SMTP, TLS, operator and ops boundaries.

**Re-freeze policy:** Never overwrite the immutable commit/tree in this file after implementation. Append dated phase status to `003`. An approved new baseline requires a separate dated record.
