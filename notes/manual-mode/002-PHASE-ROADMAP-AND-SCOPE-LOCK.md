# 002 — Exact Scope Lock and one-phase implementation roadmap

**Source freeze:** Primary vibtoolshq/ReadBox/main 2f1d16b2cd373cd332e79ddae2ef771deaf52928, Git tree 7be1bd36a312c780ea17b587f5525769fc2761d2 (2026-11-19, Asia/Dhaka). This is an immutable inspected input, not an assertion that the new documentation commit is the same SHA. All code excerpts are read-only observations pinned to this commit; any shown proposed patch is NOT applied. User-requested current scope: only the Add Domain Manual Mode checkbox for another Cloudflare account and its indispensable in-zone DNS export guard. No production operation, application code edit, schema, CI workflow, live DNS/R2/VPS or release is authorized by this documentation step.

## Decision: ONE implementation phase, no artificial extra steps

**Phase-01 / MM-01 — Add Domain Manual Mode checkbox + safe foreign-zone export.** State: SOURCE IMPLEMENTED and CI VERIFIED (1/1 source), exact backup SHA sync BLOCKED (0/2); see closure evidence below. Existing automatic live domains are PRE-EXISTING PASS BY OPERATOR REPORT, **not** part of this new phase or an excuse to re-onboard them. This is a small controlled change, not a production release or new DKIM architecture.

### Exact ALLOW — executable files (maximum)

1. src/components/vcon/domain-form.tsx — Add a small accessible checkbox **Manual Mode — Use another Cloudflare account** in Add Domain zone area. Default OFF. ON => no zone required; use existing manual dnsConfirmed path and manual-mode guidance. OFF => preserve automatic zone validation and existing default autoDkim true. Edit-time DKIM guidance may be changed **only in this same component**, preserving all existing controls.
2. src/core/dns/records.ts — In **buildCloudflareZoneFile only**, exclude a mail-host A/AAAA record whose owner is outside exported domain apex/subdomains. Keep the MX record's external target unchanged, keep A/AAAA for in-zone host, preserve DKIM TXT segmentation and unrelated records. Do NOT change buildExpectedDnsRecords, routing resolver or Cloudflare publisher.
3. tests/ui/domain-zone-selection.test.tsx — New Manual ON/OFF, zone bypass, auto unchanged, confirmation and bound-zone regressions.
4. tests/ui/vcon-phase3.test.tsx — Limited existing Add Domain manual UX/submit regression.
5. tests/dns/r03-advisory-contract.test.ts — Add focused zone-export foreign owner, MX target, in-zone owner and DKIM-preservation assertions.
6. notes/manual-mode/** (only this documentation log/plan) and notes/003-PHASE-PROGRESS-AND-CHANGE-LOG.md, notes/004-ERROR-HANDLING-INVENTORY.md, notes/005-ACTUAL-IMPLEMENTATION-TRACKER.md, notes/006-VERIFICATION-AND-RELEASE-GATES.md — append verified closure results only.

**Read-only references, NOT patch permission:** src/app/(workspace)/vcon/domains/actions.ts, src/app/api/vcon/domains/[uuid]/dkim/route.ts, src/core/dns/domain-automation.ts, src/core/backup/**, deployment/backup-agent/**, src/components/vcon/dns-records-panel.tsx, src/core/dns/resolver.ts, src/core/dns/cloudflare-auto.ts, all Prisma/schema files.

### Hard DENY

All other src/, tests/, .github/workflows/, scripts/, deployment/, docker-compose.yml, Dockerfile, README/docs outside notes, auth/session, Prisma schema/migrations, Postfix/Dovecot, R2 encrypted objects/private PEM, existing Cloudflare zones and DNS records, production mailboxes, UI outside one Add Domain section, CI security guards, tagging/releases, live DNS/R2 operations, VPS host installs and any force-push. A new needed path requires a separately approved Scope Lock amendment with source proof, not silent expansion.

### Exact user-visible behavior and order

1. **Manual checkbox default OFF:** automatic flow stays identical: zone load/list/selection, autoDkim=true, encrypted escrow and guarded Cloudflare publication. Existing bindings cannot change.
2. **Manual checkbox ON:** zone selector hidden or disabled; absent zone never blocks save; require existing DNS review confirmation. Submit using existing manual payload **without autoDkim=true and without zoneId**. There must be **no create-time Cloudflare POST/DNS publisher invocation**. Zone-list GET may exist as harmless read-only background behavior; failure must not block manual save.
3. After save, edit page: use existing **Provision / Repair DKIM**, explicitly instruct user to leave **Publish DKIM TXT to configured Cloudflare zone** unchecked. Existing root escrow verification is mandatory, and the public TXT can only become available after its receipt.
4. **Refresh Preview DNS / Download Cloudflare zone** after DKIM succeeds; external-zone central mail-host A/AAAA owner must not appear in the exported file; imported zone still contains MX target, SPF, DKIM TXT and DMARC.
5. Import file in the *other* account manually (out of application scope), inspect all records and run routing verification. Domain remains disabled until existing verification/activation succeeds.
6. Toggle Manual OFF again before create: selector/automatic validation and matching payload must work exactly as baseline.

### One focused test / closure

- Freeze actual primary SHA before source edit; run targeted UI and export tests with installed dependencies:
  - npm run test:ui -- tests/ui/domain-zone-selection.test.tsx tests/ui/vcon-phase3.test.tsx
  - node --conditions=react-server --import tsx --test tests/dns/r03-advisory-contract.test.ts
  - npm run typecheck (same bounded verification batch; no repeated loops)
- If browser tests or typecheck fail, fix only allowlisted defect and perform at most one necessary focused recheck. One exact diff/secret/security audit; verify only listed paths, no production data/secrets; update 003/004/005/006 and this index. Normal Git commit and **non-force** source + dedicated backup ref parity if actually authorized/available; report BLOCKED if they cannot be equal, do not force backup-main branches.
- **PASS exit:** Manual ON/OFF behavior, no CF publish for Manual, safe zone TXT export, existing auto tests PASS, no new auth/DB/backend code, source/backup status recorded. CI/static PASS != production GO. **No live domain test is necessary for this small source-only code phase unless separately authorized.**
- On any new unrelated bug, stop rather than invent Phase-02. Separate user approval required to implement Phase-01 after documentation.

## Copy-ready next approval text

ReadBox Manual Mode Phase-01 implement করো। Baseline/current Primary HEAD recheck করে notes/manual-mode/002-এর exact five executable-file allowlist এবং four phase log files মেনে শুধু Add Domain-এর Manual Mode checkbox, existing manual DKIM/R2 flow guidance ও out-of-zone mail-host A/AAAA export safety fix করো। Existing automatic mode, তিনটি working domain, UI/auth, Prisma, mailserver, DNS/R2 data unchanged। One focused disposable verification, exact diff/security audit, notes closure, normal Git commit ও authorized non-force source/backup sync। কোনো VPS/live DNS/R2 operation, deployment, tag, release বা force-push নয়।

---

## Current verified implementation status

### MM-01 actual implementation and CI evidence — 2026-11-19

- **Source implementation:** [`55ea7dbc97ff78e8c537bfecf3975923639a854b`](https://github.com/vibtoolshq/ReadBox/commit/55ea7dbc97ff78e8c537bfecf3975923639a854b); exact Git tree `e0789807d0b6128e3a60593acc25e03a4b5e1de8`, from previous Primary head `4303b66bfb85f8062bc6cca025f3bbe5d6abfab5`. Exactly **five approved executable/test files** changed: `src/components/vcon/domain-form.tsx`, `src/core/dns/records.ts`, `tests/dns/r03-advisory-contract.test.ts`, `tests/ui/domain-zone-selection.test.tsx`, `tests/ui/vcon-phase3.test.tsx`. No other source, backend, secrets, schema, mailserver, R2 objects or DNS provider operations.
- **Existing read-only CI:** [R06 SUCCESS, run 44576640402](https://github.com/vibtoolshq/ReadBox/actions/runs/44576640402), verification PR [#3](https://github.com/vibtoolshq/ReadBox/pull/3), head `ff48998e8dc0d46c35c433d55ed50f689dcab278` with the **identical complete source tree** `e0789807d0b6128e3a60593acc25e03a4b5e1de8`. Verified npm CI source/lint, TypeScript typecheck, UI unit/Vitest regressions, build, dependency audit, disposable PostgreSQL/SMTP/LMTP/restore, immutable R06 gates; 0 CI failures. PR commit only adds an **empty-tree-delta** CI trigger, not application file modifications. No CI workflow file changed.
- **Focused functionality check:** 53 readback assertions PASS against minimally transpiled, *actual committed* `records.ts` export functions and UI source guards; foreign-zone mail-host A/AAAA owner absent, external MX retained for all three recorded domains on IPv4/IPv6, in-zone owner retained, SPF/DMARC/DKIM TXT and DKIM 255-octet segments preserved. This standalone check is **not** an independent live DNS test or the Node r03 test runner. The newly added `tests/dns/r03-advisory-contract.test.ts` cases were committed and typechecked but were **not separately executed** by the R06 workflow; do not mislabel them as a CLI Node test PASS.
- **Diff/security audit:** compare previous head..source commit gave exactly 5/5 allowlisted paths. Independent source blob readback shows `src/core/dns/domain-automation.ts`, `src/app/(workspace)/vcon/domains/actions.ts`, DKIM API route, DNS download panel and R2 agent-client **unchanged**. Private DKIM keys remain escrow-gated. No Prisma migration or new provider API.
- **Mirror closure BLOCKED:** dedicated `backup/dns-final-primary-20261119` refs in `JILLU-Games/ReadBox` and `MdNurnobi-Dev/ReadBox` were read at `6f3bc1e3aeb441956e1fd0f4d81558a6aba2945f`, **not** `55ea7dbc97ff78e8c537bfecf3975923639a854b`. Primary connector can write only Primary; alternate account can write JILLU-Games but **neither connected account has push permission to MdNurnobi-Dev**. These independent repositories also lack the newer Primary commit objects. Therefore **zero of two backup refs have verified exact latest SHA parity**. No attempt to force-push, rewrite backup history, claim parity, or create misleading unequal-SHA mirror commits. Finish exact **non-force fast-forward git object transfer** with authorized backup credentials and reread both refs; until then status is **SOURCE VERIFIED / EXACT MIRROR SYNC BLOCKED**, not fully closed.
- **Live environment:** no VPS, no real-domain DNS write, no live R2 operation, no deployment, no tag/release. The three preexisting domain successes are still **operator/chat-recorded**, not re-run or independently revalidated by this Phase-01. Original production 7 OPEN findings / 17 independent gates are unchanged; release remains **NO-GO**.

