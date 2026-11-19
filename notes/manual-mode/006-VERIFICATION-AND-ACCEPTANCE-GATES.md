# 006 — One focused Manual Mode verification and finish conditions

**Source freeze:** Primary vibtoolshq/ReadBox/main 2f1d16b2cd373cd332e79ddae2ef771deaf52928, Git tree 7be1bd36a312c780ea17b587f5525769fc2761d2 (2026-11-19, Asia/Dhaka). This is an immutable inspected input, not an assertion that the new documentation commit is the same SHA. All code excerpts are read-only observations pinned to this commit; any shown proposed patch is NOT applied. User-requested current scope: only the Add Domain Manual Mode checkbox for another Cloudflare account and its indispensable in-zone DNS export guard. No production operation, application code edit, schema, CI workflow, live DNS/R2/VPS or release is authorized by this documentation step.

## Targeted, disposable source-only acceptance (PLANNED, not run)

| Gate | Must observe | Result now |
|---|---|---|
| MM-G01 | Manual checkbox initially OFF, automatic selected active zone still required | NOT RUN on new UI |
| MM-G02 | Checkbox ON hides/disables selector, empty zone accepted after DNS-reviewed confirmation | NOT RUN |
| MM-G03 | Manual onCreate excludes autoDkim=true and zoneId; no provider DNS POST; optional zone-list GET doesn't block | NOT RUN |
| MM-G04 | Toggle OFF restores default automatic payload and immutable bind rules | NOT RUN |
| MM-G05 | Edit unbound domain: existing publish=false DKIM step uses verified escrow, returns public record | Existing code/mock contract; NEW UI guidance NOT RUN |
| MM-G06 | Export mailiq.shop MX -> mail.anyinbox.cc but no mail.anyinbox.cc A/AAAA owner | NOT RUN; source risk |
| MM-G07 | In-zone A/AAAA is kept; TXT SPF/DKIM/DMARC, long DKIM segments preserved | NOT RUN on new export fix |
| MM-G08 | Invalid/unreviewed manual, invalid automatic zone, missing escrow and failed DNS routing remain denied | NOT RUN as combined focused regression |
| MM-G09 | Modified file list exactly allowlist; no Prisma, UI outside feature, auth, R2 agent, live DNS, CI publish edits | NOT RUN |
| MM-G10 | One focused UI + Node export + TypeScript verification, scoped diff/secret audit, evidence log and authorized Git non-force sync | NOT RUN |

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
