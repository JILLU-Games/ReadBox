# 001 — Manual Mode focused forensic findings and exact current code proof

**Source freeze:** Primary vibtoolshq/ReadBox/main 2f1d16b2cd373cd332e79ddae2ef771deaf52928, Git tree 7be1bd36a312c780ea17b587f5525769fc2761d2 (2026-11-19, Asia/Dhaka). This is an immutable inspected input, not an assertion that the new documentation commit is the same SHA. All code excerpts are read-only observations pinned to this commit; any shown proposed patch is NOT applied. User-requested current scope: only the Add Domain Manual Mode checkbox for another Cloudflare account and its indispensable in-zone DNS export guard. No production operation, application code edit, schema, CI workflow, live DNS/R2/VPS or release is authorized by this documentation step.

## Finding MM-01 — Manual Mode checkbox UX is missing (confirmed static)

**Current file:** [src/components/vcon/domain-form.tsx:L132–148](https://github.com/vibtoolshq/ReadBox/blob/2f1d16b2cd373cd332e79ddae2ef771deaf52928/src/components/vcon/domain-form.tsx#L132). Current source, verbatim excerpt:

~~~tsx
const [dnsConfirmed, setDnsConfirmed] = useState(false);
const [autoDkim, setAutoDkim] = useState(true);
const [dkimPublish, setDkimPublish] = useState(true);
const [zoneId, setZoneId] = useState(boundZone?.id ?? "");
~~~

Current zone section [L634–666](https://github.com/vibtoolshq/ReadBox/blob/2f1d16b2cd373cd332e79ddae2ef771deaf52928/src/components/vcon/domain-form.tsx#L634) is rendered with:

~~~tsx
{(isCreate ? autoDkim : dkimPublish) ? (
  <Panel data-testid="cloudflare-zone-panel">
~~~

There is **no dedicated checkbox** labeled Manual Mode for the other Cloudflare account. The existing automatic setup checkbox doubles as an implicit manual switch; the user must understand that unchecking automatic setup selects a different workflow. This is a UX feature gap, not proof that the manual backend is absent.

## Finding MM-02 — Manual domain save exists, but mode is implicit (confirmed current behavior)

**File:** [src/components/vcon/domain-form.tsx:L281–309](https://github.com/vibtoolshq/ReadBox/blob/2f1d16b2cd373cd332e79ddae2ef771deaf52928/src/components/vcon/domain-form.tsx#L281).

~~~tsx
if (!dnsConfirmed && !autoDkim) {
  const msg =
    "Confirm that all DNS records have been reviewed before saving the domain.";
}
if (autoDkim && !zoneId) {
  const msg = "Select a Cloudflare zone before automatic setup.";
}
const result = await onCreate(autoDkim
  ? { name, dnsConfirmed: true, autoDkim: true, zoneId }
  : { name, dnsConfirmed });
~~~

**Server:** [src/app/(workspace)/vcon/domains/actions.ts:L41–85](https://github.com/vibtoolshq/ReadBox/blob/2f1d16b2cd373cd332e79ddae2ef771deaf52928/src/app/(workspace)/vcon/domains/actions.ts#L41).

~~~ts
if (input.autoDkim === true) {
  const zone = await resolveSelectedCloudflareZone(input.name, input.zoneId ?? "");
}
~~~

Server calls automatic provisioning only for autoDkim=true; **absence of this flag already avoids Cloudflare DNS auto-publish**. Proposed Manual Mode must reuse this existing false/absent backend contract, not add a new database column, server route or privileged API. Existing manual save confirmation and disabled-until-routing-verification controls must remain.

## Finding MM-03 — Export of a foreign-zone mail host (confirmed static, focused safety fix)

**Source:** [src/core/dns/records.ts:L30–42](https://github.com/vibtoolshq/ReadBox/blob/2f1d16b2cd373cd332e79ddae2ef771deaf52928/src/core/dns/records.ts#L30), [L45–80](https://github.com/vibtoolshq/ReadBox/blob/2f1d16b2cd373cd332e79ddae2ef771deaf52928/src/core/dns/records.ts#L45), and [L118–145](https://github.com/vibtoolshq/ReadBox/blob/2f1d16b2cd373cd332e79ddae2ef771deaf52928/src/core/dns/records.ts#L118).

~~~ts
return mailHostname.split(".")[0] || "mail";
~~~

~~~ts
{
  type: addressType,
  category: "routing",
  host: mailHostname,
  cfHost: mailSubdomainHost,
  value: serverIp,
  priority: "-",
  copyable: true,
},
~~~

~~~ts
for (const record of records) {
  const cleanValue = sanitizeZoneToken(record.value);
  const hostFqdn = ensureFqdn(record.host);
  // ... MX, A/AAAA and TXT are serialized
}
~~~

For a mailiq.shop zone whose globally configured mail hostname is mail.anyinbox.cc, **MX must still point to mail.anyinbox.cc**, but the generated mailiq.shop DNS zone file must **not** contain an A/AAAA record whose owner is mail.anyinbox.cc. Existing serializer currently iterates that record unconditionally. This is a **confirmed source contract risk**, not a claim that a user already imported a faulty export. **Fix only in buildCloudflareZoneFile** (export filtering); preserve buildExpectedDnsRecords and the existing DNS resolver, because routing verification legitimately needs the central hostname IP.

## Finding MM-04 — Manual DKIM + secure escrow already exists (working code; no refactor)

**File:** [src/components/vcon/domain-form.tsx:L208–245](https://github.com/vibtoolshq/ReadBox/blob/2f1d16b2cd373cd332e79ddae2ef771deaf52928/src/components/vcon/domain-form.tsx#L208).

~~~tsx
body: JSON.stringify({ publish: dkimPublish,
  ...(dkimPublish ? { zoneId } : {}) }),
~~~

**API:** [src/app/api/vcon/domains/[uuid]/dkim/route.ts:L100–106](https://github.com/vibtoolshq/ReadBox/blob/2f1d16b2cd373cd332e79ddae2ef771deaf52928/src/app/api/vcon/domains/[uuid]/dkim/route.ts#L100).

~~~ts
const result = await automateDomainSetup(authorized.domain.name, {
  publish,
  ...(publish ? { zoneId: selectedId } : {}),
~~~

**Secure backend:** [src/core/dns/domain-automation.ts:L39–66](https://github.com/vibtoolshq/ReadBox/blob/2f1d16b2cd373cd332e79ddae2ef771deaf52928/src/core/dns/domain-automation.ts#L39) stages DKIM, requires callBackupAgent("dkim.escrow", {domain}) and a verified escrow receipt, then releases public key. Manual publish=false yields dns:"manual". The private key must **never** be returned in the exported zone file. No agent/DKIM/backend change authorized.

## Finding MM-05 — Existing download control and verification (working code)

**Download:** [src/components/vcon/dns-records-panel.tsx:L42–95](https://github.com/vibtoolshq/ReadBox/blob/2f1d16b2cd373cd332e79ddae2ef771deaf52928/src/components/vcon/dns-records-panel.tsx#L42).

~~~tsx
const zoneText = buildCloudflareZoneFile(domainName, records);
link.download = `${domainName}-cloudflare-dns.txt`;
~~~

**Preview:** [src/app/api/vcon/domains/dns-preview/route.ts:L7–19](https://github.com/vibtoolshq/ReadBox/blob/2f1d16b2cd373cd332e79ddae2ef771deaf52928/src/app/api/vcon/domains/dns-preview/route.ts#L7). **DNS check:** [src/core/dns/resolver.ts:L150–166](https://github.com/vibtoolshq/ReadBox/blob/2f1d16b2cd373cd332e79ddae2ef771deaf52928/src/core/dns/resolver.ts#L150). Preserve existing Preview DNS, zone download and routing check; after escrow/public-key provision, refresh/preview and download the complete file. Pre-provision DKIM placeholder is NOT a valid DKIM record: the existing exporter comments noncopyable content rather than silently generating a real key.

## Existing regressions to preserve

- [tests/ui/domain-zone-selection.test.tsx:L41–56](https://github.com/vibtoolshq/ReadBox/blob/2f1d16b2cd373cd332e79ddae2ef771deaf52928/tests/ui/domain-zone-selection.test.tsx#L41) requires selected zone and autoDkim=true in automatic mode.
- [tests/ui/domain-zone-selection.test.tsx:L59–81](https://github.com/vibtoolshq/ReadBox/blob/2f1d16b2cd373cd332e79ddae2ef771deaf52928/tests/ui/domain-zone-selection.test.tsx#L59) preserves edit-time immutable bound zone and publish=true.
- [tests/dns/domain-automation.test.ts:L132–141](https://github.com/vibtoolshq/ReadBox/blob/2f1d16b2cd373cd332e79ddae2ef771deaf52928/tests/dns/domain-automation.test.ts#L132) asserts central mail-host outside the managed zone is never Cloudflare-published.
- [tests/ui/vcon-phase3.test.tsx:L138–179](https://github.com/vibtoolshq/ReadBox/blob/2f1d16b2cd373cd332e79ddae2ef771deaf52928/tests/ui/vcon-phase3.test.tsx#L138) covers manual DNS confirmation.
- The focused new export regression must prove MX pointing to the central host remains, foreign-zone A/AAAA owner is absent, in-zone A/AAAA owner remains, and non-DKIM/unknown records are not silently rewritten.

**Finding disposition:** MM-01 and MM-03 are proposed narrow patch targets; MM-02/04/05 are existing implemented contracts to reuse, not new bugs. No claim of reproduced live outage or deployment bug.

---

## Current verified implementation status

### MM-01 actual implementation and CI evidence — 2026-11-19

- **Source implementation:** [`55ea7dbc97ff78e8c537bfecf3975923639a854b`](https://github.com/vibtoolshq/ReadBox/commit/55ea7dbc97ff78e8c537bfecf3975923639a854b); exact Git tree `e0789807d0b6128e3a60593acc25e03a4b5e1de8`, from previous Primary head `4303b66bfb85f8062bc6cca025f3bbe5d6abfab5`. Exactly **five approved executable/test files** changed: `src/components/vcon/domain-form.tsx`, `src/core/dns/records.ts`, `tests/dns/r03-advisory-contract.test.ts`, `tests/ui/domain-zone-selection.test.tsx`, `tests/ui/vcon-phase3.test.tsx`. No other source, backend, secrets, schema, mailserver, R2 objects or DNS provider operations.
- **Existing read-only CI:** [R06 SUCCESS, run 44576640402](https://github.com/vibtoolshq/ReadBox/actions/runs/44576640402), verification PR [#3](https://github.com/vibtoolshq/ReadBox/pull/3), head `ff48998e8dc0d46c35c433d55ed50f689dcab278` with the **identical complete source tree** `e0789807d0b6128e3a60593acc25e03a4b5e1de8`. Verified npm CI source/lint, TypeScript typecheck, UI unit/Vitest regressions, build, dependency audit, disposable PostgreSQL/SMTP/LMTP/restore, immutable R06 gates; 0 CI failures. PR commit only adds an **empty-tree-delta** CI trigger, not application file modifications. No CI workflow file changed.
- **Focused functionality check:** 53 readback assertions PASS against minimally transpiled, *actual committed* `records.ts` export functions and UI source guards; foreign-zone mail-host A/AAAA owner absent, external MX retained for all three recorded domains on IPv4/IPv6, in-zone owner retained, SPF/DMARC/DKIM TXT and DKIM 255-octet segments preserved. This standalone check is **not** an independent live DNS test or the Node r03 test runner. The newly added `tests/dns/r03-advisory-contract.test.ts` cases were committed and typechecked but were **not separately executed** by the R06 workflow; do not mislabel them as a CLI Node test PASS.
- **Diff/security audit:** compare previous head..source commit gave exactly 5/5 allowlisted paths. Independent source blob readback shows `src/core/dns/domain-automation.ts`, `src/app/(workspace)/vcon/domains/actions.ts`, DKIM API route, DNS download panel and R2 agent-client **unchanged**. Private DKIM keys remain escrow-gated. No Prisma migration or new provider API.
- **Mirror closure BLOCKED:** dedicated `backup/dns-final-primary-20261119` refs in `JILLU-Games/ReadBox` and `MdNurnobi-Dev/ReadBox` were read at `6f3bc1e3aeb441956e1fd0f4d81558a6aba2945f`, **not** `55ea7dbc97ff78e8c537bfecf3975923639a854b`. Primary connector can write only Primary; alternate account can write JILLU-Games but **neither connected account has push permission to MdNurnobi-Dev**. These independent repositories also lack the newer Primary commit objects. Therefore **zero of two backup refs have verified exact latest SHA parity**. No attempt to force-push, rewrite backup history, claim parity, or create misleading unequal-SHA mirror commits. Finish exact **non-force fast-forward git object transfer** with authorized backup credentials and reread both refs; until then status is **SOURCE VERIFIED / EXACT MIRROR SYNC BLOCKED**, not fully closed.
- **Live environment:** no VPS, no real-domain DNS write, no live R2 operation, no deployment, no tag/release. The three preexisting domain successes are still **operator/chat-recorded**, not re-run or independently revalidated by this Phase-01. Original production 7 OPEN findings / 17 independent gates are unchanged; release remains **NO-GO**.

