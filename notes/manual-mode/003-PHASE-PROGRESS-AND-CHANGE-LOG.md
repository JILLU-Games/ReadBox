# 003 — Manual Mode phase scoreboard and append-only completion log

> **Latest MM-01 backup status (2026-11-20):** Two dedicated backup refs matched Primary exactly at `405bb16e9d8e46f544d608d6754e84eb0700b309` (2/2 VERIFIED). This new notes-only successor must be synchronized separately before final exact-SHA closure. See the 2026-11-20 addendum at the end; earlier planning/BLOCKED entries are historical snapshots.

**Source freeze:** Primary vibtoolshq/ReadBox/main 2f1d16b2cd373cd332e79ddae2ef771deaf52928, Git tree 7be1bd36a312c780ea17b587f5525769fc2761d2 (2026-11-19, Asia/Dhaka). This is an immutable inspected input, not an assertion that the new documentation commit is the same SHA. All code excerpts are read-only observations pinned to this commit; any shown proposed patch is NOT applied. User-requested current scope: only the Add Domain Manual Mode checkbox for another Cloudflare account and its indispensable in-zone DNS export guard. No production operation, application code edit, schema, CI workflow, live DNS/R2/VPS or release is authorized by this documentation step.

## One-feature progress (documentation only)

| Dimension | Completed | Remaining | Truth |
|---|---:|---:|---|
| Manual Mode MM Phase-01 source implementation | 1/1 | 0/1 | SOURCE IMPLEMENTED and CI verified; backup parity pending |
| Recorded existing automatic domains | 3/3 user/operator reported | 0 domain re-onboard required | mailiq.shop, softlo.com, mailvib.com; separate from this feature |
| Manual Mode focused acceptance tests | 1/1 source UI CI | 0 source UI CI | R06 CI SUCCESS, standalone 53 checks; Node r03 CLI not separately run |
| R-01–R-06 historical source/CI phases | 6/6 | 0 | Preserve previous CI evidence; not release GO |
| Overall production release | n/a | 7 original OPEN findings and independent gates | NO-GO; outside this feature |

**Documentation session:** source frozen 2f1d16b2cd373cd332e79ddae2ef771deaf52928; only docs planned. No checkbox, export fix, tests, live DNS/VPS or Git runtime deployment is claimed implemented. Historical root notes/003 remains historical; never overwrite old phase counts.

## Required completion record (append after Phase-01 implementation, no fabricated values)

~~~md
### MM Phase-01 — YYYY-MM-DD
- State: VERIFIED | FAILED | BLOCKED
- Baseline SHA/tree: <40-char>, <40-char>
- User approval: <message/date>; exact Scope Lock source: manual-mode/002
- Changed executable paths: <exact literal list>
- Before / after UI: <Manual toggle evidence>
- No-auto-publish evidence: <onCreate payload / mocked create and API>
- Zone-file negative: <foreign mail.anyinbox.cc A/AAAA absent, MX preserved>
- Existing auto regressions: <tests and results>
- Escrow: <unchanged source contract / any actual verification if performed>
- CI/local focused verification: <commands, run URL, exact tested SHA, pass/fail>
- Exact patch/security review: <allowed count vs actual; secret/data protection>
- Actual working: <CODE / CI / OPERATOR OBSERVED / INDEPENDENT LIVE>
- Git commit / source main / backup branch refs: <exact SHAs, no guessed parity>
- Manual phases: 1/1 complete only on verified evidence, otherwise 0/1
- Remaining work: <actual blockers only, not automatic new feature phase>
- Global release findings: <still OPEN / independently accepted changes only>
- Next action: <separate user approval if any new scope required>
~~~

---

## Documentation planning publication — 2026-11-19

- Frozen inspected executable source SHA: `2f1d16b2cd373cd332e79ddae2ef771deaf52928`; tree `7be1bd36a312c780ea17b587f5525769fc2761d2`.
- First notes-only forensic/roadmap document commit: [`87af1d60a0102173fca80133b33f2d4ad7dc72d3`](https://github.com/vibtoolshq/ReadBox/commit/87af1d60a0102173fca80133b33f2d4ad7dc72d3). **18 changed files, all notes/**, including nine new `notes/manual-mode/**` Markdown files.
- One read-only focused Git comparison and document integrity audit PASS: 18/18 notes-only paths; original 32 release findings and 17 RG definitions preserved; all nine new Manual Mode documents have balanced Markdown source fences. Exact new notes index and this closure entry are a subsequent documentation-only commit.
- No app code patch, Manual checkbox, exporter fix, targeted app CI, VPS/domain/R2 action, production restore, release or tag executed.
- Manual Mode Phase-01 stays **PLANNED 0/1, 1 remaining**. Three recorded automatic domains remain separate historical operator evidence. No new live test asserted; global production NO-GO unchanged.
- Backup dedicated-branch SHA parity **not verified at new notes-only HEAD**; do not call this docs update mirrored without actual non-force sync/readback.

---

## Current verified implementation status

### MM-01 actual implementation and CI evidence — 2026-11-19

- **Source implementation:** [`55ea7dbc97ff78e8c537bfecf3975923639a854b`](https://github.com/vibtoolshq/ReadBox/commit/55ea7dbc97ff78e8c537bfecf3975923639a854b); exact Git tree `e0789807d0b6128e3a60593acc25e03a4b5e1de8`, from previous Primary head `4303b66bfb85f8062bc6cca025f3bbe5d6abfab5`. Exactly **five approved executable/test files** changed: `src/components/vcon/domain-form.tsx`, `src/core/dns/records.ts`, `tests/dns/r03-advisory-contract.test.ts`, `tests/ui/domain-zone-selection.test.tsx`, `tests/ui/vcon-phase3.test.tsx`. No other source, backend, secrets, schema, mailserver, R2 objects or DNS provider operations.
- **Existing read-only CI:** [R06 SUCCESS, run 44576640402](https://github.com/vibtoolshq/ReadBox/actions/runs/44576640402), verification PR [#3](https://github.com/vibtoolshq/ReadBox/pull/3), head `ff48998e8dc0d46c35c433d55ed50f689dcab278` with the **identical complete source tree** `e0789807d0b6128e3a60593acc25e03a4b5e1de8`. Verified npm CI source/lint, TypeScript typecheck, UI unit/Vitest regressions, build, dependency audit, disposable PostgreSQL/SMTP/LMTP/restore, immutable R06 gates; 0 CI failures. PR commit only adds an **empty-tree-delta** CI trigger, not application file modifications. No CI workflow file changed.
- **Focused functionality check:** 53 readback assertions PASS against minimally transpiled, *actual committed* `records.ts` export functions and UI source guards; foreign-zone mail-host A/AAAA owner absent, external MX retained for all three recorded domains on IPv4/IPv6, in-zone owner retained, SPF/DMARC/DKIM TXT and DKIM 255-octet segments preserved. This standalone check is **not** an independent live DNS test or the Node r03 test runner. The newly added `tests/dns/r03-advisory-contract.test.ts` cases were committed and typechecked but were **not separately executed** by the R06 workflow; do not mislabel them as a CLI Node test PASS.
- **Diff/security audit:** compare previous head..source commit gave exactly 5/5 allowlisted paths. Independent source blob readback shows `src/core/dns/domain-automation.ts`, `src/app/(workspace)/vcon/domains/actions.ts`, DKIM API route, DNS download panel and R2 agent-client **unchanged**. Private DKIM keys remain escrow-gated. No Prisma migration or new provider API.
- **Mirror closure BLOCKED:** dedicated `backup/dns-final-primary-20261119` refs in `JILLU-Games/ReadBox` and `MdNurnobi-Dev/ReadBox` were read at `6f3bc1e3aeb441956e1fd0f4d81558a6aba2945f`, **not** `55ea7dbc97ff78e8c537bfecf3975923639a854b`. Primary connector can write only Primary; alternate account can write JILLU-Games but **neither connected account has push permission to MdNurnobi-Dev**. These independent repositories also lack the newer Primary commit objects. Therefore **zero of two backup refs have verified exact latest SHA parity**. No attempt to force-push, rewrite backup history, claim parity, or create misleading unequal-SHA mirror commits. Finish exact **non-force fast-forward git object transfer** with authorized backup credentials and reread both refs; until then status is **SOURCE VERIFIED / EXACT MIRROR SYNC BLOCKED**, not fully closed.
- **Live environment:** no VPS, no real-domain DNS write, no live R2 operation, no deployment, no tag/release. The three preexisting domain successes are still **operator/chat-recorded**, not re-run or independently revalidated by this Phase-01. Original production 7 OPEN findings / 17 independent gates are unchanged; release remains **NO-GO**.

---

## 2026-11-20 — MM-01 dedicated backup synchronization verified (final notes successor sync pending)

**Verified state at this snapshot:** GitHub readback showed all three exact refs at `405bb16e9d8e46f544d608d6754e84eb0700b309`: Primary `vibtoolshq/ReadBox:main`, `JILLU-Games/ReadBox:backup/dns-final-primary-20261119`, `MdNurnobi-Dev/ReadBox:backup/dns-final-primary-20261119`. The user completed two **non-force**, same-object Git pushes from the authenticated Windows CMD (first `upstream` via Team Dark Devil SSH, then `origin` via the active `MdNurnobi-Dev` GitHub CLI credential helper). Both backup refs advanced from `6f3bc1e3aeb441956e1fd0f4d81558a6aba2945f` to `405bb16e9d8e46f544d608d6754e84eb0700b309`; both backup `main` branches and all local working files stayed outside this push scope.

**Code/CI status:** Manual Mode Phase-01 source implemented at `55ea7dbc97ff78e8c537bfecf3975923639a854b`, successful read-only R06 CI [run #44576640402](https://github.com/vibtoolshq/ReadBox/actions/runs/44576640402), original source change exactly five approved files. No new code edit or CI replay in this backup-closure step. User/operator recorded prior three-domain inbound successes are historical; **no new live test or VPS/DNS/R2 interaction was executed**. Original seven OPEN product release findings and seventeen independent release gates remain **NO-GO**, unaffected by this one-feature closure.

**Final-notes publication parity rule:** This log itself will be added in a **documentation-only successor commit** to `405bb16e9d8e46f544d608d6754e84eb0700b309`. Therefore `2/2` backup parity is VERIFIED **only for the pre-note snapshot** `405bb16e9d8e46f544d608d6754e84eb0700b309`, **not** automatically for the new Primary HEAD. After publication, transfer that exact new commit (non-force) to the same two dedicated backup branches, read back all three SHA refs and only then call the complete MM-01 source+notes backup closure **DONE**. Do **not** create an additional notes commit solely to record the successor SHA, since that would again break parity; the GitHub readback and conversation record serve as final confirmation. Any auth failure, new remote divergence or withheld transfer must be reported as **FINAL NOTES SYNC PENDING**, not falsely closed.
---

## 2026-11-20 — MM-01 source-to-VPS live inbound closure

The Manual Mode source feature implemented at `55ea7dbc97ff78e8c537bfecf3975923639a854b` is deployed as part of authoritative executable tree `9c3d99d4ec26707c2aec3a5c9ee959dea39dcbb5`. Operator's ReadBox VPS `/opt/readbox` safe updater made encrypted pre-update backup, fast-forwarded successfully, rebuilt web/worker; post-update Git worktree CLEAN and 6/6 Docker healthy. Two external-Cloudflare-account Manual Mode domains (`vibmail.my`, `pypal.pl`) showed **Active / routing DNS verified** with a newly created mailbox and received real Gmail test message for each. On `vibmail.my`, DKIM public key initially missing was generated successfully through the manual publish-off path; `DKIM key: ready` and public TXT shown.

**MM-01 implementation and basic inbound live acceptance: CLOSED / operator-approved for this observed production use.** Screenshot of `DKIM DNS: missing` means authoritative public DKIM TXT was not independently accepted; overall provider/R2/TLS/restore and all RG-01..17 release acceptance remain NO-GO outside this scope. No code or CI changed as part of this evidence-only closing addendum. Exact source/backup parity applies only to the pre-note input SHA until successor object is transferred non-force and independently reread on both dedicated backup refs.
