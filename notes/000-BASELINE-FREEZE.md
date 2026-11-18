# 000 — Baseline Freeze & Development Scope Governance


> **CURRENT SOURCE RE-FREEZE — 2026-11-19 (Asia/Dhaka).** Authoritative PRIMARY is **vibtoolshq/ReadBox**, not the historical JILLU-Games upstream below. Immutable inspected PRIMARY main SHA: **3dfac11f46165c262c3dc5ddb7e82563a56f9a7f**; tree: **7a07c6d03588096f88d4aad1b1317f0aa3302bcf**. This is a **documentation-only re-baseline**; original 2026-11-17 freeze remains historical evidence and must not be overwritten. **No production GO; 7 original OPEN findings.** See the dated current-state section at the end of this file.


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

---

## Current authoritative production-readiness freeze — 2026-11-19

| Field | Current verified value / limitation |
|---|---|
| Primary and future source of truth | https://github.com/vibtoolshq/ReadBox |
| Immutable inspected main commit | `3dfac11f46165c262c3dc5ddb7e82563a56f9a7f` |
| Immutable inspected tree | `7a07c6d03588096f88d4aad1b1317f0aa3302bcf` |
| DNS-FINAL executable test commit | `2eccd8f21cf71261fdc0e0b7ab6199a2a19de4ce` |
| Main compared with tested commit | **Only notes/003–006 changed**; application and workflows use identical source blobs |
| Primary DNS-FINAL main CI | [#44384108878](https://github.com/vibtoolshq/ReadBox/actions/runs/44384108878), SUCCESS at exactly inspected main SHA |
| Primary R06 consolidated CI at this SHA | [#44384109011](https://github.com/vibtoolshq/ReadBox/actions/runs/44384109011), SKIPPED due to the workflow's JILLU-only job condition; **not a PASS** |
| Historical complete disposable R06 | [JILLU #44374235430](https://github.com/JILLU-Games/ReadBox/actions/runs/44374235430), SUCCESS on **different** JILLU candidate SHA; do not relabel as Primary-main R06 |
| Primary main branch protection | GitHub branch metadata: `protected: false`; mandatory admin-only enforcement not established |
| JILLU backup main | `952516a2cac27649824bf14329f511eae6ae9294` — not synced |
| MdNurnobi-Dev backup main | `511a77380ef8d41061164abb966cbe960b6d02a8` — divergent, not synced |
| Requested backup exact-SHA branches | `backup/dns-final-primary-20261119` absent in both backups at audit |
| Release status | **NO-GO**; original 32 IDs preserved, **25 CI-verified contracts / 7 OPEN**, formal 17 live gates not approved |
| Partial real VPS observation | [notes/016](016-LIVE-INBOUND-DEPLOYMENT-ACCEPTANCE.md) records operator screenshots/PuTTY output for one inbound Gmail message, STARTTLS and local encrypted backup on Nov 18; **not** independent complete staging GO |
| Out-of-scope during this documentation phase | No application/UI/auth/DB/migrations/Compose/mailserver/worker modifications; no secret handling, real DNS/R2, VPS, restoration, tag, release, or backup force-push |

**Important:** The old 2026-11-17 immutable SHA/tree at the top of this historical record are not wrong for their date. The repository's later DNS-FINAL main moved to the current value above. An eventual documentation-only commit advances main again **without changing the frozen inspected source tree**; always cite both the inspected code SHA and the eventual documentation HEAD separately.

### Authority, change and evidence policy

1. **Primary:** `vibtoolshq/ReadBox/main`. Backup repositories are `JILLU-Games/ReadBox` and `MdNurnobi-Dev/ReadBox`. Never treat backup as upstream for release decisions.
2. The six historic R-01 through R-06 implementation scopes are **6/6 CI-verified** and are not re-opened. The four finite follow-on readiness work packages in [002](002-PRODUCTION-PHASE-ROADMAP.md) cover the remaining acceptance and current-source mismatches; each requires separate approval.
3. The existing 32 findings remain in [001](001-PRODUCTION-RELEASE-BLOCKERS.md) with unchanged IDs/states until individually evidenced; new current-environment observations use **RN-xx supplemental identifiers** and are **not** silently added as 33rd/34th original finding.
4. The capability evidence must be typed as **CODE PRESENT / DISPOSABLE CI PASS / OPERATOR-OBSERVED PARTIAL LIVE / INDEPENDENT LIVE ACCEPTED / NOT RUN / BLOCKED**. No CI, screenshot, or local encrypted archive alone qualifies as production GO.
5. Every approved patch must freeze the actual Primary head first, use an **exact per-phase file allowlist**, run one focused verification and one patch/security audit, log SHA and evidence, then use only authorized non-force Git ref updates. A blocked backup credential is not grounds to force-push or rewrite unrelated history.
6. No real domain, Cloudflare token, R2 identity or VPS is assumed to be available. Live acceptance needs named domain/zone and explicit operator approval **later**, not in this documentation phase.
