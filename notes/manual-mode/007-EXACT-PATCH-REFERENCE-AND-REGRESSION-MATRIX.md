# 007 — Exact source patch map (PROPOSED, not applied)

**Source freeze:** Primary vibtoolshq/ReadBox/main 2f1d16b2cd373cd332e79ddae2ef771deaf52928, Git tree 7be1bd36a312c780ea17b587f5525769fc2761d2 (2026-11-19, Asia/Dhaka). This is an immutable inspected input, not an assertion that the new documentation commit is the same SHA. All code excerpts are read-only observations pinned to this commit; any shown proposed patch is NOT applied. User-requested current scope: only the Add Domain Manual Mode checkbox for another Cloudflare account and its indispensable in-zone DNS export guard. No production operation, application code edit, schema, CI workflow, live DNS/R2/VPS or release is authorized by this documentation step.

## Patch A — one Add Domain form, no backend migration

**Allowed target:** src/components/vcon/domain-form.tsx, [L132–148](https://github.com/vibtoolshq/ReadBox/blob/2f1d16b2cd373cd332e79ddae2ef771deaf52928/src/components/vcon/domain-form.tsx#L132), [L281–309](https://github.com/vibtoolshq/ReadBox/blob/2f1d16b2cd373cd332e79ddae2ef771deaf52928/src/components/vcon/domain-form.tsx#L281), [L634–739](https://github.com/vibtoolshq/ReadBox/blob/2f1d16b2cd373cd332e79ddae2ef771deaf52928/src/components/vcon/domain-form.tsx#L634).

**Existing baseline (verbatim excerpts):**

~~~tsx
const [autoDkim, setAutoDkim] = useState(true);
const [dkimPublish, setDkimPublish] = useState(true);
~~~

~~~tsx
if (autoDkim && !zoneId) {
  const msg = "Select a Cloudflare zone before automatic setup.";
  setFieldErrors({ zoneId: msg });
  setFormError(msg);
  return;
}
~~~

**Implementation intent, illustrative pseudocode ONLY (not a copied implemented patch):**

~~~tsx
// New create-only UI state. Keep existing autoDkim default and backend.
// const [manualMode, setManualMode] = useState(false);
// const useAutomatic = autoDkim && !manualMode;
// Manual Mode checkbox: default false, label "Manual Mode — Use another Cloudflare account"
// When ON: hide/disable zone selector, show the manual steps;
// useAutomatic must be false, and the existing dnsConfirmed review is still required.
// onCreate(useAutomatic
//   ? { name, dnsConfirmed: true, autoDkim: true, zoneId }
//   : { name, dnsConfirmed });
// In Edit: existing provision uses publish:false with zoneId omitted.
// No new persisted manualMode field, API flag, Prisma column, auth changes.
~~~

**Why:** Explicit UI mode is merely a presentation of the already implemented manual backend branch. Never remove the existing auto zone requirement, immutable bound-zone protection or routing verification.

## Patch B — one zone-file exporter function

**Allowed target:** src/core/dns/records.ts, **buildCloudflareZoneFile at L118–164 ONLY**. Source expected records L45–106 must remain unchanged. In-zone owner definition: equal to exported domain or ends with "." + exported domain. Keep MX target foreign hostname: a target is not a zone-file record owner.

**Existing baseline (verbatim):**

~~~ts
for (const record of records) {
  const cleanValue = sanitizeZoneToken(record.value);
  const hostFqdn = ensureFqdn(record.host);
~~~

**Implementation intent, illustrative pseudocode ONLY:**

~~~ts
// Inside buildCloudflareZoneFile, before serializing current record:
// const owner = normalizeDnsHost(record.host);
// const belongsToExportZone = owner === domain || owner.endsWith("." + domain);
// if ((record.type === "A" || record.type === "AAAA") && !belongsToExportZone) {
//   continue; // no foreign-zone mail-host owner in another zone's import file
// }
// Do NOT filter MX just because its destination lies in a different zone.
// Do NOT delete/modify any actual DNS record, expected lookup or central A record.
~~~

**Expected negative example:**

~~~dns
; Export for mailiq.shop
mailiq.shop. IN MX 10 mail.anyinbox.cc.
; mail.anyinbox.cc. IN A <central-ip> MUST NOT be in this zone export
mail._domainkey.mailiq.shop. IN TXT (...)  ; after escrow/public key provision
~~~

Placeholder comments above are illustrative, not literal file content. Actual zone serialization still uses explicit TTL and split DKIM text.

## Existing and new focused tests — exact paths

| Allowed file | Test contract |
|---|---|
| tests/ui/domain-zone-selection.test.tsx | Automatic unchanged; manual checkbox ON/OFF/zone skip; previous immutable edit zone |
| tests/ui/vcon-phase3.test.tsx | Manual confirmation, visible guidance, successful save without autoDkim/zoneId, router transition |
| tests/dns/r03-advisory-contract.test.ts | Zone-file foreign host A/AAAA owner excluded, MX foreign target retained, in-zone A/AAAA retained, SPF/DKIM/DMARC and long DKIM TXT preserved |

**No edits allowed** to actions.ts, DKIM API, domain-automation.ts, any Cloudflare publisher, backup/R2 agent, Prisma schema or docs outside phase closure notes. The five executable-file allowlist is a **maximum**; fewer changed files is better. One focused verification, exact path/security audit, notes completion, normal commit/sync. This document authorizes no actual patch yet.
