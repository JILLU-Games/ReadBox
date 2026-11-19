# 004 — Manual Mode existing and proposed error handling

**Source freeze:** Primary vibtoolshq/ReadBox/main 2f1d16b2cd373cd332e79ddae2ef771deaf52928, Git tree 7be1bd36a312c780ea17b587f5525769fc2761d2 (2026-11-19, Asia/Dhaka). This is an immutable inspected input, not an assertion that the new documentation commit is the same SHA. All code excerpts are read-only observations pinned to this commit; any shown proposed patch is NOT applied. User-requested current scope: only the Add Domain Manual Mode checkbox for another Cloudflare account and its indispensable in-zone DNS export guard. No production operation, application code edit, schema, CI workflow, live DNS/R2/VPS or release is authorized by this documentation step.

## Existing implemented error handling (code present; do not rewrite the backend)

| Case | Current exact code/source | Status |
|---|---|---|
| Automatic without zone | domain-form.tsx:L289–294 | Blocks create; preserve when Manual OFF |
| Existing manual without DNS review | domain-form.tsx:L281–288 | Blocks create; preserve when Manual ON |
| Cloudflare zone read fails | domain-form.tsx:L182–199,L659–664 | Warning; new Manual ON must remain usable |
| Automatic provider invalid/inactive zone | actions.ts:L52–61 | Server rejects before auto bind; preserve |
| Partial automatic DNS/escrow setup | actions.ts:L113–117 | Domain saved disabled; retries via existing repair |
| DKIM Publish without zone | domain-form.tsx:L208–213 | Existing client guard; manual publish unchecked avoids it |
| Manual DKIM escrow unavailable | domain-automation.ts:L39–67 | Fail closed before TXT public-key release |
| Wrong origin / invalid DKIM JSON / bound-zone conflict | src/app/api/vcon/domains/[uuid]/dkim/route.ts:L21–103 | Existing 403/400/409 controls |
| Routing DNS pending / invalid | existing checkDomainDns and DomainForm routing check | Disabled until verified |
| Export before DKIM public key | records.ts:L147–150 | Noncopyable key serialized as a comment; do not claim valid DKIM |

## Implemented phase-only source guards (CI verified; no independent external live negative tests)

- MM-E01 Manual ON + empty zone: **save allowed only after existing DNS review confirmation**; never call Cloudflare DNS POST or send zoneId. Provider zone-list GET failure must not block.
- MM-E02 Manual OFF + empty zone: block exactly as baseline. Existing bound-zone immutability intact.
- MM-E03 Toggle ON/OFF repeatedly: no stale manual/auto state, no accidental autoDkim=true in manual request.
- MM-E04 Manual edit DKIM publish disabled: POST body publish:false with no zoneId; private escrow receipt is still required, and missing/invalid escrow fails closed.
- MM-E05 DNS export: external-owner mail.anyinbox.cc A/AAAA excluded for mailiq.shop/softlo.com/mailvib.com; MX destination remains mail.anyinbox.cc; same-zone mail A/AAAA is retained.
- MM-E06 DKIM not yet provisioned: visible guidance to provision before final file import; do not export a fake copyable DKIM TXT.
- MM-E07 Preview/download provider error or unsupported browser download: preserve existing error surface; do not silently modify production DNS or files.
- MM-E08 Invalid domain, unauthorized user, disabled domain or failed routing: existing backend authorization and fail-closed activation policy must remain.

If a proposed negative fails and needs a code patch outside five approved executable paths, STOP and request a minimal new path exception with a reproduced code-proof record. Never weaken auth, R2 escrow, conflict or DNS safety protections merely to make a manual checkbox work.

---

## Current verified implementation status

### MM-01 actual implementation and CI evidence — 2026-11-19

- **Source implementation:** [`55ea7dbc97ff78e8c537bfecf3975923639a854b`](https://github.com/vibtoolshq/ReadBox/commit/55ea7dbc97ff78e8c537bfecf3975923639a854b); exact Git tree `e0789807d0b6128e3a60593acc25e03a4b5e1de8`, from previous Primary head `4303b66bfb85f8062bc6cca025f3bbe5d6abfab5`. Exactly **five approved executable/test files** changed: `src/components/vcon/domain-form.tsx`, `src/core/dns/records.ts`, `tests/dns/r03-advisory-contract.test.ts`, `tests/ui/domain-zone-selection.test.tsx`, `tests/ui/vcon-phase3.test.tsx`. No other source, backend, secrets, schema, mailserver, R2 objects or DNS provider operations.
- **Existing read-only CI:** [R06 SUCCESS, run 44576640402](https://github.com/vibtoolshq/ReadBox/actions/runs/44576640402), verification PR [#3](https://github.com/vibtoolshq/ReadBox/pull/3), head `ff48998e8dc0d46c35c433d55ed50f689dcab278` with the **identical complete source tree** `e0789807d0b6128e3a60593acc25e03a4b5e1de8`. Verified npm CI source/lint, TypeScript typecheck, UI unit/Vitest regressions, build, dependency audit, disposable PostgreSQL/SMTP/LMTP/restore, immutable R06 gates; 0 CI failures. PR commit only adds an **empty-tree-delta** CI trigger, not application file modifications. No CI workflow file changed.
- **Focused functionality check:** 53 readback assertions PASS against minimally transpiled, *actual committed* `records.ts` export functions and UI source guards; foreign-zone mail-host A/AAAA owner absent, external MX retained for all three recorded domains on IPv4/IPv6, in-zone owner retained, SPF/DMARC/DKIM TXT and DKIM 255-octet segments preserved. This standalone check is **not** an independent live DNS test or the Node r03 test runner. The newly added `tests/dns/r03-advisory-contract.test.ts` cases were committed and typechecked but were **not separately executed** by the R06 workflow; do not mislabel them as a CLI Node test PASS.
- **Diff/security audit:** compare previous head..source commit gave exactly 5/5 allowlisted paths. Independent source blob readback shows `src/core/dns/domain-automation.ts`, `src/app/(workspace)/vcon/domains/actions.ts`, DKIM API route, DNS download panel and R2 agent-client **unchanged**. Private DKIM keys remain escrow-gated. No Prisma migration or new provider API.
- **Mirror closure BLOCKED:** dedicated `backup/dns-final-primary-20261119` refs in `JILLU-Games/ReadBox` and `MdNurnobi-Dev/ReadBox` were read at `6f3bc1e3aeb441956e1fd0f4d81558a6aba2945f`, **not** `55ea7dbc97ff78e8c537bfecf3975923639a854b`. Primary connector can write only Primary; alternate account can write JILLU-Games but **neither connected account has push permission to MdNurnobi-Dev**. These independent repositories also lack the newer Primary commit objects. Therefore **zero of two backup refs have verified exact latest SHA parity**. No attempt to force-push, rewrite backup history, claim parity, or create misleading unequal-SHA mirror commits. Finish exact **non-force fast-forward git object transfer** with authorized backup credentials and reread both refs; until then status is **SOURCE VERIFIED / EXACT MIRROR SYNC BLOCKED**, not fully closed.
- **Live environment:** no VPS, no real-domain DNS write, no live R2 operation, no deployment, no tag/release. The three preexisting domain successes are still **operator/chat-recorded**, not re-run or independently revalidated by this Phase-01. Original production 7 OPEN findings / 17 independent gates are unchanged; release remains **NO-GO**.

