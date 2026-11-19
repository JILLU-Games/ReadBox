# 007 — Exact patch map (historical proposal, now applied at source commit 55ea7dbc)

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

---

## Current verified implementation status

### MM-01 actual implementation and CI evidence — 2026-11-19

- **Source implementation:** [`55ea7dbc97ff78e8c537bfecf3975923639a854b`](https://github.com/vibtoolshq/ReadBox/commit/55ea7dbc97ff78e8c537bfecf3975923639a854b); exact Git tree `e0789807d0b6128e3a60593acc25e03a4b5e1de8`, from previous Primary head `4303b66bfb85f8062bc6cca025f3bbe5d6abfab5`. Exactly **five approved executable/test files** changed: `src/components/vcon/domain-form.tsx`, `src/core/dns/records.ts`, `tests/dns/r03-advisory-contract.test.ts`, `tests/ui/domain-zone-selection.test.tsx`, `tests/ui/vcon-phase3.test.tsx`. No other source, backend, secrets, schema, mailserver, R2 objects or DNS provider operations.
- **Existing read-only CI:** [R06 SUCCESS, run 44576640402](https://github.com/vibtoolshq/ReadBox/actions/runs/44576640402), verification PR [#3](https://github.com/vibtoolshq/ReadBox/pull/3), head `ff48998e8dc0d46c35c433d55ed50f689dcab278` with the **identical complete source tree** `e0789807d0b6128e3a60593acc25e03a4b5e1de8`. Verified npm CI source/lint, TypeScript typecheck, UI unit/Vitest regressions, build, dependency audit, disposable PostgreSQL/SMTP/LMTP/restore, immutable R06 gates; 0 CI failures. PR commit only adds an **empty-tree-delta** CI trigger, not application file modifications. No CI workflow file changed.
- **Focused functionality check:** 53 readback assertions PASS against minimally transpiled, *actual committed* `records.ts` export functions and UI source guards; foreign-zone mail-host A/AAAA owner absent, external MX retained for all three recorded domains on IPv4/IPv6, in-zone owner retained, SPF/DMARC/DKIM TXT and DKIM 255-octet segments preserved. This standalone check is **not** an independent live DNS test or the Node r03 test runner. The newly added `tests/dns/r03-advisory-contract.test.ts` cases were committed and typechecked but were **not separately executed** by the R06 workflow; do not mislabel them as a CLI Node test PASS.
- **Diff/security audit:** compare previous head..source commit gave exactly 5/5 allowlisted paths. Independent source blob readback shows `src/core/dns/domain-automation.ts`, `src/app/(workspace)/vcon/domains/actions.ts`, DKIM API route, DNS download panel and R2 agent-client **unchanged**. Private DKIM keys remain escrow-gated. No Prisma migration or new provider API.
- **Mirror closure BLOCKED:** dedicated `backup/dns-final-primary-20261119` refs in `JILLU-Games/ReadBox` and `MdNurnobi-Dev/ReadBox` were read at `6f3bc1e3aeb441956e1fd0f4d81558a6aba2945f`, **not** `55ea7dbc97ff78e8c537bfecf3975923639a854b`. Primary connector can write only Primary; alternate account can write JILLU-Games but **neither connected account has push permission to MdNurnobi-Dev**. These independent repositories also lack the newer Primary commit objects. Therefore **zero of two backup refs have verified exact latest SHA parity**. No attempt to force-push, rewrite backup history, claim parity, or create misleading unequal-SHA mirror commits. Finish exact **non-force fast-forward git object transfer** with authorized backup credentials and reread both refs; until then status is **SOURCE VERIFIED / EXACT MIRROR SYNC BLOCKED**, not fully closed.
- **Live environment:** no VPS, no real-domain DNS write, no live R2 operation, no deployment, no tag/release. The three preexisting domain successes are still **operator/chat-recorded**, not re-run or independently revalidated by this Phase-01. Original production 7 OPEN findings / 17 independent gates are unchanged; release remains **NO-GO**.

