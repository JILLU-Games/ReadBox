# 017 — ReadBox current forensic proof, patch reference and pre-production implementation plan

> **MANUAL MODE SCOPE CORRECTION (2026-11-19):** This older broad NEXT-03/04 plan remains historical production-release planning. The latest user request is **only** a Manual Mode checkbox + narrow foreign-zone DNS export safeguard, with [frozen file:line proof](manual-mode/001-FORENSIC-AUDIT-AND-CODE-PROOF.md) and [single Phase-01 allowlist](manual-mode/002-PHASE-ROADMAP-AND-SCOPE-LOCK.md). Do not use the earlier 'Phase-01 = NEXT-03' for this feature; three automatic domain tests are operator recorded, not all NOT RUN.


**Source freeze (2026-11-19 Asia/Dhaka):** authoritative `vibtoolshq/ReadBox/main` 6f3bc1e3aeb441956e1fd0f4d81558a6aba2945f; tree `f82b07b6e0770850edd3431f041d5162848d442a`. Last full disposable Primary R06 CI ran against executable code 4d0b124af57c8d407bf609540b8b8b7a69a479b5: [run #44509947742](https://github.com/vibtoolshq/ReadBox/actions/runs/44509947742), SUCCESS. Compare 4d0b124af57c8d407bf609540b8b8b7a69a479b5..6f3bc1e3aeb441956e1fd0f4d81558a6aba2945f: **one documentation-only commit changing notes/003–006**, no executable change. At freeze time both dedicated backup refs `backup/dns-final-primary-20261119` matched 6f3bc1e3aeb441956e1fd0f4d81558a6aba2945f (2/2); backup repositories' separate `main` branches did not. **This new notes-only commit will advance Primary HEAD beyond the freeze; do not claim backup parity at that new HEAD without a new remote readback.** Historical source snapshots below are preserved and must not be mistaken for current source. Production remains **NO-GO**: 32 original findings, 25 CI-contract verified and 7 OPEN; 17 independently accepted production gates not evidenced. Historical R-01–R-06: 6/6 CI implemented. NEXT-01 and NEXT-02: 2/4 completed; NEXT-03 and NEXT-04: 2/4 pending.

## Evidence standard and limits

This is a **read-only source, Git reference and CI-evidence audit**, not a fresh live VPS login, Cloudflare write, R2 credential/key inspection, independent external SMTP probe, disaster-recovery exercise or legal opinion. A missing live gate is **UNVERIFIED**, not a reproduced source defect. Code links are pinned to the immutable frozen source SHA, not a moving `main`. The complete original 32 findings and 17 acceptance gates remain in [001](001-PRODUCTION-RELEASE-BLOCKERS.md) and [006](006-VERIFICATION-AND-RELEASE-GATES.md). The 2026-11-18 one-message VPS observation is partial operator evidence in [016](016-LIVE-INBOUND-DEPLOYMENT-ACCEPTANCE.md).

## A. Exact current-state code proof / historical patch mapping

### A01 — Primary R06 identity and non-publishing permission (previously fixed, no new patch)

**File:** [`.github/workflows/r06-production-readiness.yml:L11–22`](https://github.com/vibtoolshq/ReadBox/blob/6f3bc1e3aeb441956e1fd0f4d81558a6aba2945f/.github/workflows/r06-production-readiness.yml#L11)

```yaml
permissions:
  contents: read
jobs:
  consolidated-acceptance:
    if: github.repository == 'vibtoolshq/ReadBox'
```

Result: Primary job actually executed; [R06 #44509947742](https://github.com/vibtoolshq/ReadBox/actions/runs/44509947742) SUCCESS on 4d0b124af57c8d407bf609540b8b8b7a69a479b5. An older 3dfac11 snapshot's JILLU-only condition is *historical* and must not be used as a current bug report. **No release approval follows from CI.**

### A02 — CI target isolation (previously fixed, no new patch)

**Files:** [`scripts/testing/r06-ephemeral-postgres.sh:L4–12`](https://github.com/vibtoolshq/ReadBox/blob/6f3bc1e3aeb441956e1fd0f4d81558a6aba2945f/scripts/testing/r06-ephemeral-postgres.sh#L4) and [`scripts/testing/r06-smtp-rehearsal.sh:L5–9`](https://github.com/vibtoolshq/ReadBox/blob/6f3bc1e3aeb441956e1fd0f4d81558a6aba2945f/scripts/testing/r06-smtp-rehearsal.sh#L5).

```bash
if [[ "${GITHUB_ACTIONS:-}" != "true" || "${GITHUB_REPOSITORY:-}" != "vibtoolshq/ReadBox" ]]; then
  echo "R06: refusing non-CI PostgreSQL integration target" >&2
  exit 2
fi
```

The SMTP script uses the same mandatory identity predicate but has its own error text. Wrong repo/non-CI refusal and disposable smoke were CI-tested. **Do not broaden this guard or point it at live production targets.**

### A03 — Corrected host Nginx identifiers (CI static proof; live host not accepted)

**File:** [`deployment/templates/nginx/app.conf.tpl:L15,L40–55`](https://github.com/vibtoolshq/ReadBox/blob/6f3bc1e3aeb441956e1fd0f4d81558a6aba2945f/deployment/templates/nginx/app.conf.tpl#L15); [contract test](https://github.com/vibtoolshq/ReadBox/blob/6f3bc1e3aeb441956e1fd0f4d81558a6aba2945f/tests/deployment/readbox-nginx-template-contract.test.mjs#L1).

```nginx
upstream readbox_web {
    server 127.0.0.1:3000 fail_timeout=0;
}
ssl_session_cache shared:READBOXTLS:10m;
access_log /var/log/readbox/nginx-access.log;
error_log /var/log/readbox/nginx-error.log warn;
```

Previously recorded `vibmail_web`, `VIBMAILTLS` and `/var/log/vibmail` defects are no longer present in the checked-in template. Original finding **RB-P2-01 remains OPEN for actual host generated-config/path-permission/TLS validation**, not for an unfixed source rename. Never edit host Nginx in this notes-only phase.

### A04 — Domain automation escrow prerequisite and stable redacted error codes

**File:** [`src/core/dns/domain-automation.ts:L18–85`](https://github.com/vibtoolshq/ReadBox/blob/6f3bc1e3aeb441956e1fd0f4d81558a6aba2945f/src/core/dns/domain-automation.ts#L18).

```ts
const zone = settings.publish ?
  await resolveSelectedCloudflareZone(domain, settings.zoneId ?? "") : null;
try {
  await requestDkimProvision(domain);
} catch (error) {
  if (!(error instanceof DkimProvisionError && error.code === "ESCROW_REQUIRED")) {
    throw error;
  }
}
```

After staging, `callBackupAgent("dkim.escrow", { domain })` must return `verified` or `verified_existing`; otherwise `DKIM_R2_ESCROW_UNVERIFIED` or `DKIM_R2_ESCROW_UNAVAILABLE` is returned. Public TXT release is later in the function and gated on the escrow receipt. Explicit `PUBLIC_MAIL_IP_REQUIRED` rejects loopback/nonpublic placeholders. Source and mock CI are present; real R2 custody and DNS are unverified.

### A05 — Non-destructive DNS conflict/readback logic (present; test real zone in Phase-01)

**File:** [`src/core/dns/cloudflare-auto.ts:L140–219`](https://github.com/vibtoolshq/ReadBox/blob/6f3bc1e3aeb441956e1fd0f4d81558a6aba2945f/src/core/dns/cloudflare-auto.ts#L140).

```ts
if (matchingType.length === 0) {
  pending.push(item);
} else if (matchingType.length === 1 && recordIsSame(matchingType[0], item)) {
  existing++;
} else {
  throw new DomainAutomationError("CLOUDFLARE_DNS_RECORD_CONFLICT");
}
```

All desired names are preflighted before initial write. POST failure is followed by record readback; missing result fails with `CLOUDFLARE_DNS_READBACK_FAILED`. Existing unrelated records must not be deleted/overwritten. **No recursive uncontrolled DNS reconciliation or registrar nameserver edit is implemented.**

### A06 — Guarded admin DKIM endpoint and immutable zone binding

**File:** [`src/app/api/vcon/domains/[uuid]/dkim/route.ts:L21–138`](https://github.com/vibtoolshq/ReadBox/blob/6f3bc1e3aeb441956e1fd0f4d81558a6aba2945f/src/app/api/vcon/domains/[uuid]/dkim/route.ts#L21).

```ts
if (!trustedDkimOrigin(request)) {
  return NextResponse.json({ error: "Cross-origin DKIM changes are refused." },
    { status: 403, headers: noStore });
}
```

POST also enforces JSON/schema, existing zone binding and active selected zone; a conflict emits `CLOUDFLARE_ZONE_BINDING_CONFLICT`, and downstream failures return sanitized error code (409 conflict, otherwise 503). An actual authorization/cross-origin staging check has not been independently accepted.

### A07 — Read-only status cannot claim active outbound signing

**File:** [`src/core/dns/dkim-provision.ts:L204–226`](https://github.com/vibtoolshq/ReadBox/blob/6f3bc1e3aeb441956e1fd0f4d81558a6aba2945f/src/core/dns/dkim-provision.ts#L204).

```ts
return {
  key,
  dns, publishing: process.env.READBOX_CF_DNS_TOKEN ? "configured" : "manual",
  signing: "inactive",
  record: record.available ? record.value : null,
  host,
};
```

The product is primarily **inbound-only**; DNS DKIM TXT and encrypted private-key escrow do not establish real outbound DKIM signing. This is an explicit non-goal, not a missing test automatically eligible for arbitrary new feature work.

### A08 — Private backup agent error surface

**File:** [`src/core/backup/agent-client.ts:L12–48`](https://github.com/vibtoolshq/ReadBox/blob/6f3bc1e3aeb441956e1fd0f4d81558a6aba2945f/src/core/backup/agent-client.ts#L12).

```ts
export class BackupAgentError extends Error {
  constructor(readonly code: string) {
    super("Backup agent unavailable or operation refused");
    this.name = "BackupAgentError";
  }
}
```

The request rejects invalid payload, missing agent secret/socket and malformed HMAC setup without surfacing the private backup object/key. Actual independent offsite encrypted restore and custody remain UNVERIFIED (RB-P2-07).

### A09 — Loopback-by-default public SMTP boundary

**File:** [`docker-compose.yml:L264–265`](https://github.com/vibtoolshq/ReadBox/blob/6f3bc1e3aeb441956e1fd0f4d81558a6aba2945f/docker-compose.yml#L264).

```yaml
ports:
  - "${SMTP_BIND_ADDRESS:-127.0.0.1}:${SMTP_PUBLISHED_PORT:-25}:25"
```

This is a secure default, **not evidence of externally reachable port 25**. External reachability requires separate named VPS/provider/firewall approval; do not automatically replace 127.0.0.1 with 0.0.0.0 as a generic “bug fix”.

### A10 — Existing release ledger is fail-closed

**File:** [`tests/integration/r06-release-gate.test.mjs:L22–29`](https://github.com/vibtoolshq/ReadBox/blob/6f3bc1e3aeb441956e1fd0f4d81558a6aba2945f/tests/integration/r06-release-gate.test.mjs#L22).

```js
assert.equal(ledger.original, 32);
assert.equal(ledger.open, 7);
assert.equal(ledger.verified, 25);
```

Do not rewrite original `### RB-P*-*` headings, fabricate closing evidence or change the 17 canonical release gate definitions just to make CI green. Real evidence must precede each ledger transition.

## B. Remaining original release findings — exact ownership

| Finding | Current truth | Phase owner / exit |
|---|---|---|
| RB-P0-06 | One operator-observed Gmail inbox message, not complete independent negative/MIME/digest acceptance | **Phase-02 / NEXT-04**: independent SMTP -> LMTP -> Maildir -> ingestion -> inbox + attachment SHA, rejects |
| RB-P1-09 | DNS/DKIM sources and mock CI, no accepted public TLS/cert-renewal/escrow evidence | **Phase-01 / NEXT-03**: named-zone real DNS/DKIM/R2/TLS; outbound signing remains non-goal |
| RB-P1-10 | Partial operator STARTTLS/port test, no external network/registrar/PTR/IPv6 matrix | **Phase-01** external proof, recheck in Phase-02 |
| RB-P1-16 | R06 disposable CI PASS at 4d0b124af57c8d407bf609540b8b8b7a69a479b5, no independently accepted staging reboot/outage/host recovery | **Phase-02** source-matched controlled recovery |
| RB-P2-01 | Nginx template names **fixed in source + static CI**, host configuration still unverified | **Phase-02** generated-config, ownership and trusted TLS on approved host |
| RB-P2-07 | Local encrypted GPG archive observed, independent offsite retention/key-custody/restore not proven | **Phase-01** R2 preflight; **Phase-02** isolated offsite restore/rollback |
| RB-P2-08 | Root MIT vs historical `reference/MailStack` AGPL/NOTICE requires qualified signoff | **Phase-02** exact release artifact/legal review; NEXT-01 inventory was not a legal signoff |

**No newly proven production source bug from this read-only audit.** If a controlled test later reproduces one, the result must be recorded with minimal new allowlist and separate approval; the table is not permission to edit code.

## C. Exact phase scope locks (planned, NOT approved for execution)

### Phase-01 = existing NEXT-03, GUARD-DNS-R2-TLS

**Prerequisite:** named disposable domain, Cloudflare zone ID and delegated nameservers, supported IP/hostname, one test VPS, operator authorization and R2/key-custodian approval. No actual DNS/R2/VPS access is assumed now.

**Read-only source reference paths (NOT patch permission):** `src/core/dns/{domain-automation.ts,cloudflare-auto.ts,dkim-provision.ts,records.ts,resolver.ts}`, `src/core/domains/service.ts`, `src/app/api/vcon/domains/[uuid]/dkim/route.ts`, `src/core/backup/{agent-client.ts,validation.ts}`, `deployment/backup-agent/{agent.py,r2.py,storage.py}`, `deployment/dkim/{agent.py,escrow.py}`, `docs/DOMAIN-AUTOMATION.md`, `tests/dns/{domain-automation.test.ts,domain-zone-selection.test.ts}`.

**Permitted *future evidence documentation* paths only:** `notes/003-PHASE-PROGRESS-AND-CHANGE-LOG.md`, `notes/004-ERROR-HANDLING-INVENTORY.md`, `notes/005-ACTUAL-IMPLEMENTATION-TRACKER.md`, `notes/006-VERIFICATION-AND-RELEASE-GATES.md`, `notes/017-CURRENT-FORENSIC-PATCH-REFERENCES-2026-11-19.md` (append-only); `docs/DOMAIN-AUTOMATION.md` only upon separately approved operator-runbook correction.

**Operation lock when independently approved:** read-only delegation/zone conflicts/selected id, scoped Cloudflare additive writes at explicitly listed DNS names only, host-root encrypted DKIM R2 escrow and readback, one safe same-key replay, public resolver and TLS/port probes. A conflicting existing DNS record must cause STOP/NO WRITE. Never delete/overwrite arbitrary DNS, reveal tokens/PEM/age keys, rotate existing keys, alter unrelated zones, deploy to unapproved VPS, open SMTP broadly or edit source by default.

**One bounded evidence gate:** selected active zone, wrong-zone refusal, existing-record conflict refusal, first publish/readback, idempotent repeat, encrypted R2 receipt, public MX/A/SPF/DKIM/DMARC where applicable, TLS trust/port route; log PASS/FAIL/NOT RUN separately. Provider failure => BLOCKED, not fabricated PASS. No production GO.

### Phase-02 = existing NEXT-04, STAGING-DELIVERY-RESTORE-GO-REVIEW

**Prerequisite:** Phase-01 evidence (or a documented BLOCKED exception), named isolated staging environment, test mailbox, permitted sender, independent operator, encrypted offsite backup and qualified provenance reviewer.

**Read-only source reference paths (NOT patch permission):** `deployment/mailserver/{postfix,dovecot}/**`, `docker-compose.yml`, `src/workers/ingestion.ts`, `src/core/ingestion/**`, `src/core/health/snapshot.ts`, `deployment/backup-agent/{restore.py,scheduler.py,storage.py,r2.py}`, `deployment/operations/compose_recovery.py`, `docs/{PRODUCTION-ACCEPTANCE-RUNBOOK.md,THIRD-PARTY-PROVENANCE.md}`.

**Permitted *future evidence documentation* paths only:** `notes/003-PHASE-PROGRESS-AND-CHANGE-LOG.md`, `notes/004-ERROR-HANDLING-INVENTORY.md`, `notes/005-ACTUAL-IMPLEMENTATION-TRACKER.md`, `notes/006-VERIFICATION-AND-RELEASE-GATES.md`, `notes/017-CURRENT-FORENSIC-PATCH-REFERENCES-2026-11-19.md`; approved runbook correction limited to `docs/PRODUCTION-ACCEPTANCE-RUNBOOK.md` or `docs/THIRD-PARTY-PROVENANCE.md`.

**Operational lock when independently approved:** one controlled outside-in SMTP/LMTP/Maildir/UI attachment digest and disabled/invalid-recipient/relay negatives; recoverable isolated worker/DB/restart failure; offsite encrypted object and independent key custody; **isolated staging only** restore/rollback checksums and UID/ACL; inspect host Nginx generated config/cert renewals, secret-redacted alerts and license artifact inventory. No real-user data, destructive production restore, feature refactor, distribution or automatic release.

**One bounded gate:** record independent PASS/FAIL/NOT RUN for each existing RG-01..RG-17 and retain **NO-GO** unless 17/17 independently evidenced and all seven original findings properly dispositioned. At most advance to `MANUAL_RELEASE_REVIEW_REQUIRED`; separate user approval required for any tag/release/deployment.

## D. Scope-expansion/patch exception protocol

A future **newly reproduced** defect must be recorded first: immutable tested SHA, exact file:line, minimal *actual* code excerpt, sanitized redacted error, isolated reproduction, risk, rollback, requested file allowlist, acceptance and negative test. Only then request an explicit one-defect scope exception. Approved patch must be a minimal diff in that allowlist; one focused CI, one exact path/security audit, commit, evidence log. Never implement proposed patches merely because they are mentioned here.

## E. Verification commands (read-only examples; NOT executed here)

```bash
git rev-parse HEAD
git status --porcelain
git diff --name-only <approved-phase-baseline>...HEAD
git diff --check
```

Follow [018](018-PHASE-EXECUTION-AND-CLOSURE-TEMPLATE.md) for per-phase recording. This planning freeze did not run app tests or any live probes. No tag/release/deployment is authorized.

---

## 2026-11-20 — NEXT-03 current Primary immutable proof addendum (BLOCKED preflight)

**Snapshot/provenance:** Primary `vibtoolshq/ReadBox/main` `b4265e8fb6d8d32ebf08a12e4857bb6f10e536c9`, tree `120c6b99fbcd2cbd7fe299aeff87893d678b80a6`. At read-only freeze both `JILLU-Games/ReadBox` and `MdNurnobi-Dev/ReadBox` dedicated `backup/dns-final-primary-20261119` refs matched this input commit. Historical excerpts above remain frozen at their stated SHA.

| Evidence type | Actual current source proof | Interpretation |
|---|---|---|
| Public IP/zone before DKIM key stage | [domain-automation.ts:L31-L40](https://github.com/vibtoolshq/ReadBox/blob/b4265e8fb6d8d32ebf08a12e4857bb6f10e536c9/src/core/dns/domain-automation.ts#L31-L40) `PUBLIC_MAIL_IP_REQUIRED`, `resolveSelectedCloudflareZone` | Source guard exists, live zone not selected |
| Root-only escrow must verify before DNS release | [domain-automation.ts:L41-L69](https://github.com/vibtoolshq/ReadBox/blob/b4265e8fb6d8d32ebf08a12e4857bb6f10e536c9/src/core/dns/domain-automation.ts#L41-L69) `callBackupAgent("dkim.escrow", { domain })`, `verified`/`verified_existing` | Source contract present; no host-side R2 object receipt independently tested |
| Zone/refusal/readback | [cloudflare-auto.ts:L148-L216](https://github.com/vibtoolshq/ReadBox/blob/b4265e8fb6d8d32ebf08a12e4857bb6f10e536c9/src/core/dns/cloudflare-auto.ts#L148-L216) `CLOUDFLARE_ZONE_MISMATCH`, `CLOUDFLARE_DNS_RECORD_CONFLICT`, `CLOUDFLARE_DNS_READBACK_FAILED` | Safe additive preflight present; no provider mutation or idempotent live replay |
| DKIM API origin + binding | [route.ts:L21-L38](https://github.com/vibtoolshq/ReadBox/blob/b4265e8fb6d8d32ebf08a12e4857bb6f10e536c9/src/app/api/vcon/domains/%5Buuid%5D/dkim/route.ts#L21-L38), [L85-L138](https://github.com/vibtoolshq/ReadBox/blob/b4265e8fb6d8d32ebf08a12e4857bb6f10e536c9/src/app/api/vcon/domains/%5Buuid%5D/dkim/route.ts#L85-L138) | Source fail-closed; no live authorization test |
| Agent public error and SMTP default | [agent-client.ts:L13-L48](https://github.com/vibtoolshq/ReadBox/blob/b4265e8fb6d8d32ebf08a12e4857bb6f10e536c9/src/core/backup/agent-client.ts#L13-L48), [Compose:L264-L265](https://github.com/vibtoolshq/ReadBox/blob/b4265e8fb6d8d32ebf08a12e4857bb6f10e536c9/docker-compose.yml#L264-L265) | Redacted errors and loopback binding; no claim of provider availability/public TCP |
| Inbound-only signing status | [dkim-provision.ts:L204-L211](https://github.com/vibtoolshq/ReadBox/blob/b4265e8fb6d8d32ebf08a12e4857bb6f10e536c9/src/core/dns/dkim-provision.ts#L204-L211) `signing: "inactive"` | Outbound signing is intentionally not a NEXT-03 live acceptance claim |

**Scope/stop root cause:** NEXT-03 approval is conditional upon a separately named disposable domain and explicit Cloudflare active zone/delegation + DNS owner list, approved staging VPS/hostname/public IP and authorized R2 escrow/key custody. None were supplied for this step. Existing operator-recorded domains are production observations, not disposable test fixtures. Therefore **stop before all live writes**, classify NEXT-03 **BLOCKED**, and do not describe missing independent evidence as an implementation failure.

**Focused scope/security audit:** Documentation-only intended change paths are the exact five approved `notes/{003,004,005,006,017}` Markdown files. No source, tests, workflow, auth, Prisma, mailserver, UI, mail data, provider API, secrets or private keys modified; no host/DNS/R2/TLS operation. No fresh CI execution or independent gate PASS inferred. Next resume requires named fixtures and distinct external authorization; a reproduced source bug requires an explicit one-defect code patch exception. Original 32 finding headings, canonical 17 RG definitions and historical code/CI references are preserved. Source/backup post-commit exact SHA parity must be verified separately; never claim it from this input-snapshot evidence.
---

## 2026-11-20 — Current MM-01 deployed-source and live evidence addendum

**Immutable executable source baseline now deployed:** `9c3d99d4ec26707c2aec3a5c9ee959dea39dcbb5`. Operator PuTTY readback: worktree CLEAN, Compose six services healthy, safe updater completed encrypted pre-update backup. GitHub Primary and both dedicated backup **input** refs matched this SHA at start of docs publication.

**Evidence mapping:** [Manual checkbox/zone bypass](https://github.com/vibtoolshq/ReadBox/blob/9c3d99d4ec26707c2aec3a5c9ee959dea39dcbb5/src/components/vcon/domain-form.tsx#L641-L665), [manual DKIM publish control](https://github.com/vibtoolshq/ReadBox/blob/9c3d99d4ec26707c2aec3a5c9ee959dea39dcbb5/src/components/vcon/domain-form.tsx#L714-L742), [out-of-zone A/AAAA exclusion](https://github.com/vibtoolshq/ReadBox/blob/9c3d99d4ec26707c2aec3a5c9ee959dea39dcbb5/src/core/dns/records.ts#L118-L150), [host updater](https://github.com/vibtoolshq/ReadBox/blob/9c3d99d4ec26707c2aec3a5c9ee959dea39dcbb5/scripts/install/readbox-update.sh#L27-L100). Operator screenshots show `vibmail.my` and `pypal.pl` Active, routing verified and received external Gmail test; `vibmail.my` DKIM public key ready, no independent authoritative DKIM TXT acceptance.

**New documentation-only allowlist:** `docs/DOMAIN-AUTOMATION.md`; `notes/003`, `004`, `005`, `006`, `016`, `017` and `notes/manual-mode/003`, `004`, `005`, `006` (exact names in Git commit file list). No code/schema/UI/auth/CI/mailserver/keys/DNS/VPS change. Existing release blockers and all RG definitions preserved. Post-commit 3/3 backup parity must be proven by non-force same-object transfer/readback; no tag/release or new CI.
