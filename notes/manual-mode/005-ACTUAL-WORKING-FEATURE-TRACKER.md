# 005 — Current actual-working features versus future Manual Mode

**Source freeze:** Primary vibtoolshq/ReadBox/main 2f1d16b2cd373cd332e79ddae2ef771deaf52928, Git tree 7be1bd36a312c780ea17b587f5525769fc2761d2 (2026-11-19, Asia/Dhaka). This is an immutable inspected input, not an assertion that the new documentation commit is the same SHA. All code excerpts are read-only observations pinned to this commit; any shown proposed patch is NOT applied. User-requested current scope: only the Add Domain Manual Mode checkbox for another Cloudflare account and its indispensable in-zone DNS export guard. No production operation, application code edit, schema, CI workflow, live DNS/R2/VPS or release is authorized by this documentation step.

## Feature evidence matrix at frozen source

| Feature | Exact source | Current status | Phase-01 expected delta |
|---|---|---|---|
| Automatic zone-select Add Domain | domain-form.tsx; actions.ts | CODE PRESENT, previous UI/CI and operator 3-domain reports PASS | UNCHANGED, negative regression |
| mailiq.shop / softlo.com / mailvib.com live Gmail inbound | Recorded latest project conversation | OPERATOR/CHAT RECORDED PASS, NOT freshly independently tested here | No new domain operation/test; retain working data |
| Manual save without autoDkim | domain-form.tsx:L281–300; actions.ts:L41–67 | CODE PRESENT, implied by existing auto checkbox OFF | Make explicit Manual Mode checkbox UI |
| Dedicated Manual Mode checkbox / other-account hint | domain-form.tsx (MM-01 source commit) | SOURCE IMPLEMENTED / UI CI PASS | Checkbox default OFF; manual skips zone; other-account instructions |
| Existing DKIM Provision / Repair with publish=false | domain-form.tsx:L208–242; DKIM API route | CODE PRESENT | Reuse without backend change; show workflow hint |
| Encrypted root-only R2 DKIM escrow guard | domain-automation.ts:L39–65 | CODE PRESENT, mocked CI; independent live custody not accepted | Must remain unchanged and mandatory |
| DNS Preview / Download Cloudflare Zone | dns-records-panel.tsx:L42–95; records.ts | CODE PRESENT | Preserve UI; safe exported owner filtering |
| Foreign-zone mail-host A/AAAA inside exported zone | records.ts buildCloudflareZoneFile (MM-01 source commit) | SOURCE FIXED / standalone executed checks PASS | Foreign owner excluded only from zone export; MX kept |
| Public DNS routing check, enable after verified | resolver.ts, domain-form.tsx, domain actions | CODE PRESENT; recorded prior domain successes | UNCHANGED |
| Outbound SMTP signing/IMAP | Separate inbound-only product boundary | NOT PART OF THIS FEATURE | No new capability |
| Independent R2 restore/key custody and formal release | Historical production ledger | NOT ACCEPTED | Not in Manual Mode Phase-01 |

## Phase delta log

**Before Phase-01:** 0/1 Manual Mode code implemented; 3/3 operator-reported auto domain tests exist; existing feature data preserved. **After Phase-01:** change this table only after exact CI/code evidence and source SHA. Never mark manual Other Cloudflare account production tested by a mocked UI test. Pending scope is **one small feature**, not a new DNS engine, Cloudflare account connector or bulk mail service.

---

## Current verified implementation status

### MM-01 actual implementation and CI evidence — 2026-11-19

- **Source implementation:** [`55ea7dbc97ff78e8c537bfecf3975923639a854b`](https://github.com/vibtoolshq/ReadBox/commit/55ea7dbc97ff78e8c537bfecf3975923639a854b); exact Git tree `e0789807d0b6128e3a60593acc25e03a4b5e1de8`, from previous Primary head `4303b66bfb85f8062bc6cca025f3bbe5d6abfab5`. Exactly **five approved executable/test files** changed: `src/components/vcon/domain-form.tsx`, `src/core/dns/records.ts`, `tests/dns/r03-advisory-contract.test.ts`, `tests/ui/domain-zone-selection.test.tsx`, `tests/ui/vcon-phase3.test.tsx`. No other source, backend, secrets, schema, mailserver, R2 objects or DNS provider operations.
- **Existing read-only CI:** [R06 SUCCESS, run 44576640402](https://github.com/vibtoolshq/ReadBox/actions/runs/44576640402), verification PR [#3](https://github.com/vibtoolshq/ReadBox/pull/3), head `ff48998e8dc0d46c35c433d55ed50f689dcab278` with the **identical complete source tree** `e0789807d0b6128e3a60593acc25e03a4b5e1de8`. Verified npm CI source/lint, TypeScript typecheck, UI unit/Vitest regressions, build, dependency audit, disposable PostgreSQL/SMTP/LMTP/restore, immutable R06 gates; 0 CI failures. PR commit only adds an **empty-tree-delta** CI trigger, not application file modifications. No CI workflow file changed.
- **Focused functionality check:** 53 readback assertions PASS against minimally transpiled, *actual committed* `records.ts` export functions and UI source guards; foreign-zone mail-host A/AAAA owner absent, external MX retained for all three recorded domains on IPv4/IPv6, in-zone owner retained, SPF/DMARC/DKIM TXT and DKIM 255-octet segments preserved. This standalone check is **not** an independent live DNS test or the Node r03 test runner. The newly added `tests/dns/r03-advisory-contract.test.ts` cases were committed and typechecked but were **not separately executed** by the R06 workflow; do not mislabel them as a CLI Node test PASS.
- **Diff/security audit:** compare previous head..source commit gave exactly 5/5 allowlisted paths. Independent source blob readback shows `src/core/dns/domain-automation.ts`, `src/app/(workspace)/vcon/domains/actions.ts`, DKIM API route, DNS download panel and R2 agent-client **unchanged**. Private DKIM keys remain escrow-gated. No Prisma migration or new provider API.
- **Mirror closure BLOCKED:** dedicated `backup/dns-final-primary-20261119` refs in `JILLU-Games/ReadBox` and `MdNurnobi-Dev/ReadBox` were read at `6f3bc1e3aeb441956e1fd0f4d81558a6aba2945f`, **not** `55ea7dbc97ff78e8c537bfecf3975923639a854b`. Primary connector can write only Primary; alternate account can write JILLU-Games but **neither connected account has push permission to MdNurnobi-Dev**. These independent repositories also lack the newer Primary commit objects. Therefore **zero of two backup refs have verified exact latest SHA parity**. No attempt to force-push, rewrite backup history, claim parity, or create misleading unequal-SHA mirror commits. Finish exact **non-force fast-forward git object transfer** with authorized backup credentials and reread both refs; until then status is **SOURCE VERIFIED / EXACT MIRROR SYNC BLOCKED**, not fully closed.
- **Live environment:** no VPS, no real-domain DNS write, no live R2 operation, no deployment, no tag/release. The three preexisting domain successes are still **operator/chat-recorded**, not re-run or independently revalidated by this Phase-01. Original production 7 OPEN findings / 17 independent gates are unchanged; release remains **NO-GO**.

