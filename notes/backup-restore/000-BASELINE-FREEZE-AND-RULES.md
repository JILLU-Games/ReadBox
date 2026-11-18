# 000 — Frozen baseline and documentation-first rules (2026-11-18)

## Immutable source truth

| Field | Observed Git state |
|---|---|
| Source repo | `JILLU-Games/ReadBox` |
| Mirror repo | `vibtoolshq/ReadBox` |
| Both `main` at forensic freeze | `c08b9cd77ec30afc50fe36952eecb982ba90a982` |
| Both `main` tree | `e7cb8fb8db14046cabaae9b3768267cec0efd095` |
| BR-03 maintenance-only candidate | `b8f3fc662d384211d4506e40f13859f9cfcb012a` |
| Candidate tree | `413155ee2672f4347c676b23c847997038688ed2` |
| BR-03 CI evidence (candidate only) | [GitHub Actions #44203727204](https://github.com/JILLU-Games/ReadBox/actions/runs/44203727204) — `success` |
| Pre-cleanup `notes/` | 26 original tracked note blobs at source/main `c08b9cd77ec30afc50fe36952eecb982ba90a982`; original copy recoverable by Git SHA |
| Released / deployed state | **NOT established for this candidate**; no new VPS deployment, real R2 probe, production restore, release or tag |

All report claims below distinguish **on-main**, **candidate only**, **CI-simulated**, **operator-observed earlier** and **not implemented**.

## Scope of this cleanup

Only `notes/**`. Retain referenced R-phase governance `notes/000–007` and live-evidence `notes/016`. Remove unreferenced patch reports `008`, `009`, `011`, `013`, `014` from current tree; replace referenced `010`, `012`, `015` and older VPS forensic with short immutable Git-history pointers, leaving existing incoming documentation links functional. Replace the Backup `000–007` series in place; add `notes/README.md` as new active index. No unrelated source or config changes.

## Rules for every following phase

1. Establish source + mirror exact SHA/tree and compare against this audited freeze; record any drift before edits.
2. Reopen source paths and exact code anchors; a Markdown claim is **not** proof of working behavior.
3. One approved phase = only its allowlisted source paths; any extra installer/service/CI path needs **new explicit exception** before editing.
4. At phase start update scope; implement targeted patch; run one focused disposable CI and necessary minimal failure recheck; perform security regression and exact changed-path/scope diff.
5. Document **pass/fail/skip** with commit/run URL in `003–007`, close only when exit criteria actually pass. Source/mirror exact commit SHA parity using fast-forward only after validated phase approval.
6. Preserve auth, session, existing Inbox/UI, Prisma schema/migrations, Maildir, Postfix/Dovecot and live volumes. No real SMTP, VPS modification, real credentials, live restore, tag or release under documentation/planning approval.
7. New encryption-key custody, Cloudflare R2 real API tests and actual restore require separate operator permissions. CI mocks never constitute remote production acceptance.
8. Explicit next-phase approval required before additional code modification. Active update plan `002`; historical R-01..R-06 phase reports remain at immutable [pre-cleanup Git commit](https://github.com/JILLU-Games/ReadBox/blob/c08b9cd77ec30afc50fe36952eecb982ba90a982/notes/002-PRODUCTION-PHASE-ROADMAP.md).

**Previous BR-03 approved implementation scope**: [exact archived 002](https://github.com/JILLU-Games/ReadBox/blob/c08b9cd77ec30afc50fe36952eecb982ba90a982/notes/backup-restore/002-PHASE-ROADMAP-AND-SCOPE-LOCK.md). Its 16 BR-03 paths and 19 BR-04 paths have been copied into the new `002`; do not silently broaden them.
