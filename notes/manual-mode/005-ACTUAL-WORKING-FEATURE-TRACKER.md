# 005 — Current actual-working features versus future Manual Mode

**Source freeze:** Primary vibtoolshq/ReadBox/main 2f1d16b2cd373cd332e79ddae2ef771deaf52928, Git tree 7be1bd36a312c780ea17b587f5525769fc2761d2 (2026-11-19, Asia/Dhaka). This is an immutable inspected input, not an assertion that the new documentation commit is the same SHA. All code excerpts are read-only observations pinned to this commit; any shown proposed patch is NOT applied. User-requested current scope: only the Add Domain Manual Mode checkbox for another Cloudflare account and its indispensable in-zone DNS export guard. No production operation, application code edit, schema, CI workflow, live DNS/R2/VPS or release is authorized by this documentation step.

## Feature evidence matrix at frozen source

| Feature | Exact source | Current status | Phase-01 expected delta |
|---|---|---|---|
| Automatic zone-select Add Domain | domain-form.tsx; actions.ts | CODE PRESENT, previous UI/CI and operator 3-domain reports PASS | UNCHANGED, negative regression |
| mailiq.shop / softlo.com / mailvib.com live Gmail inbound | Recorded latest project conversation | OPERATOR/CHAT RECORDED PASS, NOT freshly independently tested here | No new domain operation/test; retain working data |
| Manual save without autoDkim | domain-form.tsx:L281–300; actions.ts:L41–67 | CODE PRESENT, implied by existing auto checkbox OFF | Make explicit Manual Mode checkbox UI |
| Dedicated Manual Mode checkbox / other-account hint | domain-form.tsx:L634–739 | MISSING | New small control, default OFF, zone skipped ON |
| Existing DKIM Provision / Repair with publish=false | domain-form.tsx:L208–242; DKIM API route | CODE PRESENT | Reuse without backend change; show workflow hint |
| Encrypted root-only R2 DKIM escrow guard | domain-automation.ts:L39–65 | CODE PRESENT, mocked CI; independent live custody not accepted | Must remain unchanged and mandatory |
| DNS Preview / Download Cloudflare Zone | dns-records-panel.tsx:L42–95; records.ts | CODE PRESENT | Preserve UI; safe exported owner filtering |
| Foreign-zone mail-host A/AAAA inside exported zone | records.ts:L118–145 | CONFIRMED STATIC RISK | Exclude only foreign owner from exported zone; keep MX target |
| Public DNS routing check, enable after verified | resolver.ts, domain-form.tsx, domain actions | CODE PRESENT; recorded prior domain successes | UNCHANGED |
| Outbound SMTP signing/IMAP | Separate inbound-only product boundary | NOT PART OF THIS FEATURE | No new capability |
| Independent R2 restore/key custody and formal release | Historical production ledger | NOT ACCEPTED | Not in Manual Mode Phase-01 |

## Phase delta log

**Before Phase-01:** 0/1 Manual Mode code implemented; 3/3 operator-reported auto domain tests exist; existing feature data preserved. **After Phase-01:** change this table only after exact CI/code evidence and source SHA. Never mark manual Other Cloudflare account production tested by a mocked UI test. Pending scope is **one small feature**, not a new DNS engine, Cloudflare account connector or bulk mail service.
