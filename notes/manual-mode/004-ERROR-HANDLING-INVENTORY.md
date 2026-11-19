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

## Proposed phase-only negative acceptance (NOT YET IMPLEMENTED)

- MM-E01 Manual ON + empty zone: **save allowed only after existing DNS review confirmation**; never call Cloudflare DNS POST or send zoneId. Provider zone-list GET failure must not block.
- MM-E02 Manual OFF + empty zone: block exactly as baseline. Existing bound-zone immutability intact.
- MM-E03 Toggle ON/OFF repeatedly: no stale manual/auto state, no accidental autoDkim=true in manual request.
- MM-E04 Manual edit DKIM publish disabled: POST body publish:false with no zoneId; private escrow receipt is still required, and missing/invalid escrow fails closed.
- MM-E05 DNS export: external-owner mail.anyinbox.cc A/AAAA excluded for mailiq.shop/softlo.com/mailvib.com; MX destination remains mail.anyinbox.cc; same-zone mail A/AAAA is retained.
- MM-E06 DKIM not yet provisioned: visible guidance to provision before final file import; do not export a fake copyable DKIM TXT.
- MM-E07 Preview/download provider error or unsupported browser download: preserve existing error surface; do not silently modify production DNS or files.
- MM-E08 Invalid domain, unauthorized user, disabled domain or failed routing: existing backend authorization and fail-closed activation policy must remain.

If a proposed negative fails and needs a code patch outside five approved executable paths, STOP and request a minimal new path exception with a reproduced code-proof record. Never weaken auth, R2 escrow, conflict or DNS safety protections merely to make a manual checkbox work.
