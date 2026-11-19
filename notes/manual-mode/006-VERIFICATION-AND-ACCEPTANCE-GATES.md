# 006 — One focused Manual Mode verification and finish conditions

**Source freeze:** Primary vibtoolshq/ReadBox/main 2f1d16b2cd373cd332e79ddae2ef771deaf52928, Git tree 7be1bd36a312c780ea17b587f5525769fc2761d2 (2026-11-19, Asia/Dhaka). This is an immutable inspected input, not an assertion that the new documentation commit is the same SHA. All code excerpts are read-only observations pinned to this commit; any shown proposed patch is NOT applied. User-requested current scope: only the Add Domain Manual Mode checkbox for another Cloudflare account and its indispensable in-zone DNS export guard. No production operation, application code edit, schema, CI workflow, live DNS/R2/VPS or release is authorized by this documentation step.

## Targeted source-only acceptance (implemented/CI verified; exact mirror sync BLOCKED)

| Gate | Must observe | Result now |
|---|---|---|
| MM-G01 | Manual checkbox initially OFF, automatic selected active zone still required | SOURCE/UI CI PASS; standalone DNS checks PASS |
| MM-G02 | Checkbox ON hides/disables selector, empty zone accepted after DNS-reviewed confirmation | SOURCE/UI CI PASS; standalone DNS checks PASS |
| MM-G03 | Manual onCreate excludes autoDkim=true and zoneId; no provider DNS POST; optional zone-list GET doesn't block | SOURCE/UI CI PASS; standalone DNS checks PASS |
| MM-G04 | Toggle OFF restores default automatic payload and immutable bind rules | SOURCE/UI CI PASS; standalone DNS checks PASS |
| MM-G05 | Edit unbound domain: existing publish=false DKIM step uses verified escrow, returns public record | SOURCE/CI PASS; independent live escrow NOT RUN |
| MM-G06 | Export mailiq.shop MX -> mail.anyinbox.cc but no mail.anyinbox.cc A/AAAA owner | SOURCE/UI CI PASS; standalone DNS checks PASS |
| MM-G07 | In-zone A/AAAA is kept; TXT SPF/DKIM/DMARC, long DKIM segments preserved | SOURCE/UI CI PASS; standalone DNS checks PASS |
| MM-G08 | Invalid/unreviewed manual, invalid automatic zone, missing escrow and failed DNS routing remain denied | SOURCE/UI CI PASS; no live negative operation |
| MM-G09 | Modified file list exactly allowlist; no Prisma, UI outside feature, auth, R2 agent, live DNS, CI publish edits | PASS — five paths only, protected blobs unchanged |
| MM-G10 | One focused UI + Node export + TypeScript verification, scoped diff/secret audit, evidence log and authorized Git non-force sync | CI SUCCESS / source audit PASS; exact backup ref parity BLOCKED |

**Suggested one bounded command batch after implementation** (not executed in planning):

~~~bash
npm run test:ui -- tests/ui/domain-zone-selection.test.tsx tests/ui/vcon-phase3.test.tsx
node --conditions=react-server --import tsx --test tests/dns/r03-advisory-contract.test.ts
npm run typecheck
git diff --check
git diff --name-only <baseline-sha>...HEAD
~~~

The command spelling is grounded in the inspected package.json scripts; CI/local runner readiness is not claimed. If a test fails, one minimal in-scope repair/recheck at most, otherwise mark BLOCKED/FAIL. Do not run the full R06 production rehearsal or touch a live Cloudflare account merely to accept this checkbox.

**Manual Phase-01 completion** only when MM-G01..MM-G10 source gates are actually evidenced, exact paths approved, notes updated and Git result reported. **Production release is separate:** original 32 findings / 17 human release gates in top-level notes are not changed or closed by these small source-only checks. After Phase-01, manual route is **CI-supported**, not an independently tested other-account domain.

---

## Current verified implementation status

### MM-01 actual implementation and CI evidence — 2026-11-19

- **Source implementation:** [`55ea7dbc97ff78e8c537bfecf3975923639a854b`](https://github.com/vibtoolshq/ReadBox/commit/55ea7dbc97ff78e8c537bfecf3975923639a854b); exact Git tree `e0789807d0b6128e3a60593acc25e03a4b5e1de8`, from previous Primary head `4303b66bfb85f8062bc6cca025f3bbe5d6abfab5`. Exactly **five approved executable/test files** changed: `src/components/vcon/domain-form.tsx`, `src/core/dns/records.ts`, `tests/dns/r03-advisory-contract.test.ts`, `tests/ui/domain-zone-selection.test.tsx`, `tests/ui/vcon-phase3.test.tsx`. No other source, backend, secrets, schema, mailserver, R2 objects or DNS provider operations.
- **Existing read-only CI:** [R06 SUCCESS, run 44576640402](https://github.com/vibtoolshq/ReadBox/actions/runs/44576640402), verification PR [#3](https://github.com/vibtoolshq/ReadBox/pull/3), head `ff48998e8dc0d46c35c433d55ed50f689dcab278` with the **identical complete source tree** `e0789807d0b6128e3a60593acc25e03a4b5e1de8`. Verified npm CI source/lint, TypeScript typecheck, UI unit/Vitest regressions, build, dependency audit, disposable PostgreSQL/SMTP/LMTP/restore, immutable R06 gates; 0 CI failures. PR commit only adds an **empty-tree-delta** CI trigger, not application file modifications. No CI workflow file changed.
- **Focused functionality check:** 53 readback assertions PASS against minimally transpiled, *actual committed* `records.ts` export functions and UI source guards; foreign-zone mail-host A/AAAA owner absent, external MX retained for all three recorded domains on IPv4/IPv6, in-zone owner retained, SPF/DMARC/DKIM TXT and DKIM 255-octet segments preserved. This standalone check is **not** an independent live DNS test or the Node r03 test runner. The newly added `tests/dns/r03-advisory-contract.test.ts` cases were committed and typechecked but were **not separately executed** by the R06 workflow; do not mislabel them as a CLI Node test PASS.
- **Diff/security audit:** compare previous head..source commit gave exactly 5/5 allowlisted paths. Independent source blob readback shows `src/core/dns/domain-automation.ts`, `src/app/(workspace)/vcon/domains/actions.ts`, DKIM API route, DNS download panel and R2 agent-client **unchanged**. Private DKIM keys remain escrow-gated. No Prisma migration or new provider API.
- **Mirror closure BLOCKED:** dedicated `backup/dns-final-primary-20261119` refs in `JILLU-Games/ReadBox` and `MdNurnobi-Dev/ReadBox` were read at `6f3bc1e3aeb441956e1fd0f4d81558a6aba2945f`, **not** `55ea7dbc97ff78e8c537bfecf3975923639a854b`. Primary connector can write only Primary; alternate account can write JILLU-Games but **neither connected account has push permission to MdNurnobi-Dev**. These independent repositories also lack the newer Primary commit objects. Therefore **zero of two backup refs have verified exact latest SHA parity**. No attempt to force-push, rewrite backup history, claim parity, or create misleading unequal-SHA mirror commits. Finish exact **non-force fast-forward git object transfer** with authorized backup credentials and reread both refs; until then status is **SOURCE VERIFIED / EXACT MIRROR SYNC BLOCKED**, not fully closed.
- **Live environment:** no VPS, no real-domain DNS write, no live R2 operation, no deployment, no tag/release. The three preexisting domain successes are still **operator/chat-recorded**, not re-run or independently revalidated by this Phase-01. Original production 7 OPEN findings / 17 independent gates are unchanged; release remains **NO-GO**.

