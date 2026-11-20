# 004 — Error Handling Inventory (Present, Missing, Future Test)

> **LATEST MANUAL MODE ERROR LOCK (2026-11-19):** Existing manual confirmation, automatic missing-zone refusal, DKIM escrow fail-closed and routing checks are **already implemented**; remaining single-feature negative tests concern checkbox ON/OFF mode isolation and safe foreign-zone A/AAAA export. [Current and planned controls](manual-mode/004-ERROR-HANDLING-INVENTORY.md). No security/backend changes are authorized.


> **LATEST AUTHORITATIVE RECONCILIATION — 2026-11-19.** **Source freeze (2026-11-19 Asia/Dhaka):** authoritative `vibtoolshq/ReadBox/main` 6f3bc1e3aeb441956e1fd0f4d81558a6aba2945f; tree `f82b07b6e0770850edd3431f041d5162848d442a`. Last full disposable Primary R06 CI ran against executable code 4d0b124af57c8d407bf609540b8b8b7a69a479b5: [run #44509947742](https://github.com/vibtoolshq/ReadBox/actions/runs/44509947742), SUCCESS. Compare 4d0b124af57c8d407bf609540b8b8b7a69a479b5..6f3bc1e3aeb441956e1fd0f4d81558a6aba2945f: **one documentation-only commit changing notes/003–006**, no executable change. At freeze time both dedicated backup refs `backup/dns-final-primary-20261119` matched 6f3bc1e3aeb441956e1fd0f4d81558a6aba2945f (2/2); backup repositories' separate `main` branches did not. **This new notes-only commit will advance Primary HEAD beyond the freeze; do not claim backup parity at that new HEAD without a new remote readback.** Historical source snapshots below are preserved and must not be mistaken for current source. Production remains **NO-GO**: 32 original findings, 25 CI-contract verified and 7 OPEN; 17 independently accepted production gates not evidenced. Historical R-01–R-06: 6/6 CI implemented. NEXT-01 and NEXT-02: 2/4 completed; NEXT-03 and NEXT-04: 2/4 pending. Detailed, immutable code excerpts and line links: [017](017-CURRENT-FORENSIC-PATCH-REFERENCES-2026-11-19.md); executable step/closure contract: [018](018-PHASE-EXECUTION-AND-CLOSURE-TEMPLATE.md). Earlier dated statements are retained as history, not latest status.


> **CURRENT ERROR AUDIT (2026-11-19):** Historical EH-E01–E13/EH-M01–M15 below are preserved. Primary code now includes DNS-final zone selection, guarded escrow and three-attempt CAS-safe domain verification at SHA `3dfac11f46165c262c3dc5ddb7e82563a56f9a7f`; focused CI PASSED but actual Cloudflare/R2/VPS failure cases remain untested. New current-source error/negative test contract **EH-N01–N12** is appended below, with exact NEXT ownership. Do not mistake desirable future handling for implemented behavior.


**Code evidence baseline:** `e28886e5e0f7a155cd64e23bc8ee8f6668d6699c`. **Historical starting status was OPEN; R-01–R-06 CI implementation is now verified, but R-06 live acceptance is NOT RUN and production recovery gates remain OPEN.** Static source presence does not prove error handling survives a live VPS outage. Every future test belongs to the six phase Scope Locks in `002`; UI/layout changes are forbidden outside explicit approval.

## A. Existing error handling actually implemented in source

| Error ID | Existing behavior | Exact code path / line(s) | Evidence classification |
|---|---|---|---|
| EH-E01 | Production PostgreSQL missing/malformed connection fails closed instead of using dev mock | `src/core/database/client.ts:66–113` | CODE PRESENT; live unverified |
| EH-E02 | Mailbox concurrent provisioning lock reports `ELOCKED` and safe filesystem errors | `src/core/mailboxes/provisioning.ts:31–101` | CODE PRESENT; live unverified |
| EH-E03 | Unsafe/symlink Maildir paths refused; partial directory creation rolled back | `src/core/mailboxes/provisioning.ts:106–184`, `src/core/mailboxes/paths.ts:37–124` | CODE PRESENT |
| EH-E04 | Mailbox SQL/DB creation catch and remote/maildir cleanup attempts | `src/core/mailboxes/service.ts:447–665` | CODE PRESENT; partial rollback is not transactional proof |
| EH-E05 | Domain create failure cleanup and structured error response | `src/core/domains/service.ts:183–310` | CODE PRESENT |
| EH-E06 | DNS resolution timeout/unavailable reported without false DNS success | `src/core/dns/resolver.ts:62–116,150–225` | CODE PRESENT |
| EH-E07 | Missing/unsafe source files and Maildir path confinement | `src/core/ingestion/service.ts:123–310` | CODE PRESENT |
| EH-E08 | Worker degraded/lock-busy conditions and heartbeat | `src/workers/ingestion.ts:151–208`, `scripts/mail/ingest.ts` | CODE PRESENT; health policy gap remains |
| EH-E09 | DB/storage readiness returns structured state and HTTP 503 when not-ready | `src/core/health/snapshot.ts:25–180`; `src/app/health/ready/route.ts:8–15` | CODE PRESENT; SMTP gate absent |
| EH-E10 | Database migration retry and nonzero abort | `entrypoint.sh:19–41` | CODE PRESENT; no live migration evidence |
| EH-E11 | Initial operator/bootstrap guarded and reset tokens persisted/validated | `scripts/auth/operator.ts:39–140`; `src/core/auth/password-reset.ts:108–209` | CODE PRESENT; first-admin setup gap remains |
| EH-E12 | Host backup/restore checksum, archive/path preflight | `scripts/ops/restore.sh:1–44`; `scripts/ops/backup.sh:124–175` | CODE PRESENT; Compose restore unverified |
| EH-E13 | Container in-app updater returns blocked/orchestrator-managed state | `src/core/updates/service.ts:433–481` | CODE PRESENT; expected limitation |

### Verbatim proof from frozen code

**`src/core/database/client.ts:79–87`**
```ts
if (!runtimeEnv.databaseUrl) {
  if (isProduction) {
    logger.error("database_configuration_missing_in_production");
    throw new DatabaseConfigurationError(
      "DATABASE_URL must be configured when running in production.",
    );
  }
```

**`src/core/mailboxes/provisioning.ts:81–90`**
```ts
} catch (error) {
  const code = (error as { code?: string })?.code;
  if (code === "ELOCKED") {
    throw new ProvisioningError(
      "lock",
      "Mailbox provisioning is already in progress for this address; try again.",
    );
  }
```

**`src/app/health/ready/route.ts:8–15`**
```ts
export async function GET() {
  const snapshot = await getReadinessSnapshot();
  logger.info("health_ready", { status: snapshot.status });
  return NextResponse.json(snapshot, {
    status: snapshot.status === "ready" ? 200 : 503,
    headers: { "Cache-Control": "no-store" },
  });
}
```

## B. Missing/uncertain production error contracts — future requirements

| Error ID | Owner | Failure/negative case not validated or not handled completely | Required production response | Source audit IDs | State |
|---|---|---|---|---|---|
| EH-M01 | R-01 | Dev Compose selected / demo password accidentally used | explicit prod selection and fail startup | RB-P0-01, RB-P1-01 | CI VERIFIED; live unverified |
| EH-M02 | R-01 | Missing/short secret and DB URL reserved-character corruption | clear, redacted refusal; valid URL encoding | RB-P1-01, RB-P2-03 | CI VERIFIED; live unverified |
| EH-M03 | R-01 | Reproducible production install fails/advisories unresolved | abort release; capture npm audit and lockfile evidence | RB-P1-14, RB-P1-15 | CI VERIFIED; live unverified |
| EH-M04 | R-02 | SQL role no-login, DB endpoint not reachable, permission denied | safe lookup rejection; one DB only; no leakage | RB-P0-03, RB-P1-08 | CI VERIFIED contract; external Postfix/VPS unverified |
| EH-M05 | R-02 | Maildir access denied due to differing UID/GID/ACL | no silent accepted-but-lost mail; no broad chmod | RB-P0-04 | CI VERIFIED identity; external Dovecot unverified |
| EH-M06 | R-02 | Missing/partial/out-of-order applied migrations | not-ready/abort, no destructive fallback | RB-P2-04 | CI VERIFIED CLOSED; live VPS unverified |
| EH-M07 | R-03 | SMTP daemon or LMTP socket missing/down | observable failed/queued/deferred delivery, mail preserved | RB-P0-02, RB-P0-05 | CI POSITIVE SMTP/LMTP PASS; LMTP-outage recovery still UNVERIFIED |
| EH-M08 | R-03 | Invalid/disabled recipient, bad alias, oversized MIME | proper SMTP reject/policy behavior, no silent loss | RB-P0-06 | CI unknown recipient and nonlocal relay REJECT PASS; alias/oversize not verified |
| EH-M09 | R-03 | Incorrect MX/port 25/TLS/certificate/DKIM | truthful distinct failure vs advisory status | RB-P1-09, RB-P1-10 | CI STARTTLS/missing-cert PASS; public MX/PTR/trusted TLS still OPEN |
| EH-M10 | R-04 | Duplicate bootstrap, missing operator, wrong admin table | secure one-time flow and consistent success verification | RB-P1-03, RB-P1-04 | CI VERIFIED; interactive VPS CLI not exercised |
| EH-M11 | R-04 | Worker absent/stale/stuck, Maildir unreadable | not-ready with bounded recovery and no duplicates | RB-P1-05, RB-P1-06, RB-P1-07, RB-P2-10 | CI VERIFIED health-negative/recovery; live outage untested |
| EH-M12 | R-05 | Partial backup, disk full, outage, unsafe restore ownership | fail and preserve prior state; checksum/ACL/data proof | RB-P1-11, RB-P1-12, RB-P1-13 | CI VERIFIED Compose data/ACL/rollback and explicit downtime; host/VPS untested |
| EH-M13 | R-05 | Secrets leaked into archive, updater crash or rollback failure | protect config and stop safely; observable result | RB-P2-02, RB-P2-07 | CI encrypted/no-plaintext and rollback tests pass; offsite retention/key custody OPEN |
| EH-M14 | R-06 | Real SMTP accepted but message never appears in web inbox | production NO-GO; capture mail queue, LMTP, Maildir and worker trace | RB-P0-06, RB-P1-16 | OPEN |
| EH-M15 | R-06 | VPS restarts/storage outage/DB fail/restore are untested | NO-GO until negative and recovery evidence exists | RB-P1-16 | OPEN |

### One focused test record per error case

```text
EH-ID:
Owner phase:
Exact input / failure injection:
Expected safe behavior:
Observed response / exit / sanitized log:
Impact on messages, attachments and DB:
Recovery/rollback:
CI job & tested SHA:
PASS / FAIL / SKIPPED / NOT RUN:
```

**Current state:** Existing handlers are code-level facts; all EH-M entries remain OPEN. No error-handling functionality or UI was implemented during this planning-only task.

## Error-handling closure tracker

| Phase | Existing handlers re-tested | New negative tests verified | Evidence URL / SHA | Status |
|---|---|---|---|---|
| R-01 | Startup/lockfile guards | Short credentials, reserved-character password, missing secrets, audit | https://github.com/JILLU-Games/ReadBox/actions/runs/44093204590 | CI VERIFIED |
| R-02 | PG lookup, Maildir identity and complete health migration parity | invalid/disabled mailbox, UID mismatch, missing/unfinished/failed migration ledger, broken bundle and query errors | https://github.com/JILLU-Games/ReadBox/actions/runs/44102834169 | VERIFIED CLOSED (CI) |
| R-03 | Postfix SMTP and private Dovecot LMTP | unknown RCPT/relay reject, STARTTLS, Maildir delivery, missing TLS | https://github.com/JILLU-Games/ReadBox/actions/runs/44107205810 | CI IMPLEMENTATION VERIFIED; external release gates OPEN |
| R-04 | First admin/operator identity + worker/readiness | reject duplicate, unsafe CLI, stale/future/missing worker, broken DB/storage; recovery | https://github.com/JILLU-Games/ReadBox/actions/runs/44112634511 | CI VERIFIED CLOSED; live VPS unverified |
| R-05 | Disposable encrypted PostgreSQL/Maildir/queue recovery and updater contract | post-DB apply rollback, tamper/ACL/UID checks, no plaintext env; runtime downtime explicit | https://github.com/JILLU-Games/ReadBox/actions/runs/44121121316 | CI IMPLEMENTATION VERIFIED; external offsite/host safety OPEN |
| R-06 | Consolidated isolated Docker/PostgreSQL/SMTP/LMTP/backup and 17-gate release reviewer | 32 finding states, 17 missing staging gates, forged all-PASS/wrong SHA, root license separation | https://github.com/JILLU-Games/ReadBox/actions/runs/44127481624 | CI gate implementation PASS; LIVE ACCEPTANCE OPEN |

## R-01 error handling patch proof

- EH-M01/EH-M02/EH-M03 verified by selected Compose service checks, short/missing secret rejection, reserved-character password round-trip, lockfile and production dependency audit: https://github.com/JILLU-Games/ReadBox/actions/runs/44093204590.
- A runtime password bug involving `%` escaping was found and corrected in Dockerfile before the successful run. Other mailserver and VPS error cases remain OPEN.

## R-02 error-handling evidence (2026-11-17)

- `EH-M04`: dedicated non-superuser LOGIN role can SELECT only authorized mailserver views; attempted password hash, app user and SQL writes rejected on disposable PostgreSQL. Host-installed Postfix is not yet connected.
- `EH-M05`: application delivery identity checked against UID/GID 1001; mismatch fails before provisioning and no automatic chown/permission widening is performed. Actual Dovecot LMTP filesystem access is not yet tested.
- `EH-M06`: migration manifest checker detects missing and unfinished rows in targeted tests; Prisma migrate deploy re-run is idempotent. `/health/ready` does not yet invoke this checker due explicit R-02 file Scope Lock; release gate remains OPEN.
- Proof: https://github.com/JILLU-Games/ReadBox/actions/runs/44099280332. Source commit `e1efdbd0b0380a94152947f7be47eb17c5c8d70c`. App UI/error messages and authentication unchanged.

## R-02 final EH-M06 negative outcomes (authorized closure)

- Existing expected-history helper is now invoked by `getReadinessSnapshot`, and `checks.migrations.ok` fails closed when any required migration is missing or unfinished, a failure row exists, migration directory/file is missing/unsafe, SQL query fails, or Prisma raw-query interface is absent.
- A complete matching history remains `ready` if all independent storage, DB/config and heartbeat requirements are also satisfied. No external user-visible error strings, login behavior or UI modified.
- **CI evidence:** https://github.com/JILLU-Games/ReadBox/actions/runs/44102834169. Code SHA: `b6ab76119a31f9bf4e81b3990a5fcc6d802a6892`. **Formal R-02:** CI VERIFIED CLOSED; SMTP/LMTP and actual VPS remain unverified.

## R-03 mailserver error handling verified vs remaining (2026-11-17)

- Actual Docker Postfix+LMTP delivery was verified from local SMTP port to the shared 1001-owned Maildir. Postfix denied unknown local RCPT and nonlocal relay, while missing TLS certificate prevented startup: https://github.com/JILLU-Games/ReadBox/actions/runs/44107205810.
- No SMTP AUTH/submission ports or IMAP service were enabled. One-shot SQL credential profile remains optional; default app-only Compose stays unaffected.
- Still **unverified** on real VPS: LMTP-down/queue replay and long outage recovery (`R-04/R-06`), bad-alias/oversized MIME acceptance policy, externally trusted/renewed certificate, public MX/PTR/firewall/provider port 25 and IPv6. Keep these cases OPEN in final acceptance; no false claims of comprehensive outage handling.

## R-04 first-admin and worker readiness error contract (2026-11-17)

- `EH-M10`: production operator CLI requires explicit `--bootstrap-production`, Docker runtime, interactive terminal, private PostgreSQL, enabled authentication and strong secret; bootstraps only dedicated `admin_accounts` with forced reset. Duplicate admin/legacy superuser is blocked, and setup inspector checks the same active superuser table. Real disposable database proof: https://github.com/JILLU-Games/ReadBox/actions/runs/44112634511.
- `EH-M11`: production readiness fails closed if ingestion heartbeat unknown, absent, stale, degraded, running, future-dated, or query fails; missing/symlinked/unreadable mail-storage path and DB fail return `not_ready`; healthy environment recovers. Initial ingestion worker exception writes a best-effort degraded heartbeat before rethrow. Docker worker health now checks both running process and full application readiness, while web liveness stays separate to prevent cyclic dependency.
- The JSON response explicitly shows `scope:"application"` and `checks.mailTransport.status:"not_checked"`; this is **not proof of live Postfix SMTP/LMTP**. No production operator terminal action, real outage replay or external network evidence was run.
- Tested executable-code SHA `88e57e2e81dc07a8f91b07f448df85e51d58e429`, focused CI https://github.com/JILLU-Games/ReadBox/actions/runs/44112634511. UI/auth policy and unrelated error surfaces unchanged. Existing original baseline examples in earlier sections remain historical facts, not current-state claims.

## R-05 encrypted recovery and updater negative error handling (2026-11-17)

- Exact verified executable-code SHA `a55ec82bb2f58804e910427c66ff6352cd5c14c6`, final successful CI https://github.com/JILLU-Games/ReadBox/actions/runs/44121121316. The Compose recovery program fails before mutation if input has an unknown target project/database, wrong encrypted identity, unauthenticated ciphertext, a symlink/traversal/special archive entry, or mismatched SHA-256 hashes. Decrypted staging stays private; no plaintext env/TLS secrets are included in output. Backup output and pre-restore rollback artifacts are encrypted with `age` and mode 0600.
- The system quiesces active Postfix/Dovecot/worker/web in a declared **SMTP downtime maintenance window**; only services previously running are restarted. A separate encrypted rollback snapshot is required before restoring any PostgreSQL data or named volume. CI injected a failure **after database apply** and explicitly required both the `R05_CI_FAILPOINT_AFTER_DATABASE_APPLY` and `R05_AUTOMATIC_ROLLBACK_PASS` markers, then compared restored pre-error public/mailserver rows and Maildir files. Tampered encrypted input failed without modifying the disposable DB.
- Both schema SQL rows, Maildir, attachments, media, Postfix queued content, numeric UID/GID 1001 and a real POSIX ACL were verified in disposable Compose. Host scripts exclude plaintext configuration, retain archived numeric ownership, and attempt upgrade rollback. Host-mode rollback behavior was **not run live**; no claim of full disk failure/sudden power-loss resilience.
- `RB-P2-01` still OPEN because legacy Nginx path changes fall outside R-05 allowed files. `RB-P2-07` still OPEN because verified encrypted local export alone does not demonstrate offsite retention/restore and secret-key custody. These require separately authorized future acceptance; production remains **NO-GO**.

## R-06 final release acceptance error and negative gate inventory (2026-11-17)

- **Successful focused CI:** https://github.com/JILLU-Games/ReadBox/actions/runs/44127481624; code SHA `807ca9f38adb02db2a8b73dc0901fce23ee5e63a`. Full app/unit/UI CI, production npm audit, strict disposable PostgreSQL migrations, Docker web/worker/Postfix/Dovecot test STARTTLS→LMTP→Maildir and unknown/nonlocal rejection, encrypted volume/queue backup→restore→automatic rollback and no-auto-release source gate passed.
- `EH-M14` and `EH-M15` remain **OPEN for LIVE acceptance**: no independent external sender-to-real-authenticated-inbox/attachment proof, no real public TCP/25/MX/PTR/renewing TLS or VPS storage/DB/LMTP outage replay/reboot. The existing R-03/R-05 unit/disposable failure scenarios are not substitutes.
- New negative governance checks refused forged 17/17 PASS with unresolved original findings, duplicate/missing RG IDs, wrong SHA, unsafe userinfo/token links, future observations, missing observers and falsely claimed release permission. Current real report `R06_PRODUCTION_NO_GO` with seven original findings OPEN and **zero of 17 live gate PASS claims**. A complete document may be only `MANUAL_RELEASE_REVIEW_REQUIRED`, never an automatic publication.
- Two pre-existing out-of-scope R-04 full-tree lint findings at `src/core/setup/trusted-operations.ts:366,386` remain; a strict lint-baseline negative gate proves exactly these two, while linting all other repository code. Do not infer full lint clean or waive them.
- Release/deploy/DNS/source code mutation impossible through R-06 workflow; `permissions: contents: read`. R-06 live acceptance **blocked** pending separate user approval. 6/6 implementation scopes CI verified, original 7 OPEN, production NO-GO.

## DKIM-01 — Explicit negative/failure handling (2026-11-18)

- Unconfigured isolated DKIM agent/socket/token => sanitized `DKIM_AGENT_NOT_INSTALLED`/`DKIM_AGENT_UNAVAILABLE`; no key creation through Web and no privileged/container Docker access.
- Invalid/weak RSA public key => `INVALID_PUBLIC_KEY`; public record without private identity, existing mismatched keypair, unsafe/symlink path => fail closed, **never overwrite, delete, rotate, or synthesize a private key for an existing public-only identity**.
- Agent requests are single action `provision`, validated domain only, bounded message, SO_PEERCRED UID 1001, HMAC-SHA256 token, timestamp/nonce/replay guard and bounded socket read time. Per-domain key creation serializes with a locked root and uses atomic no-replace hard links.
- Missing optional Cloudflare token/zone configuration => manual copy/export. Malformed zone, unrelated domain, wrong zone name, multiple/conflicting records, failed provider API => refuse DNS mutation. Only explicit DKIM TXT create is permitted, never PATCH/PUT/DELETE MX/SPF/DMARC.
- Existing domain is never deleted/recreated if opt-in DKIM provisioning fails after domain creation; operator gets an actionable follow-up. Status distinguishes public key, DNS publication and **inactive** signing.
- **Not yet proven:** live shared-volume ownership under an existing named-volume installation, the opt-in agent image Python tests, real network DNS propagation, pre-existing DNS record races and private-key escrow recovery. Preserve all failures for operator review, do not retry or force repair keys.

## DKIM-02/FIX-01 — RSA key-header bug and safe failure contract (2026-11-18)

- **Observed failure:** disposable image build with OpenSSL 3.x failed `test_key_generation_is_idempotent_and_private_not_public` and `test_conflicting_public_never_replaced` with `INVALID_PRIVATE_KEY`; the underlying RSA-2048 key could be valid but the key-size text parser rejected the comma/prime-count suffix.
- **Fix:** anchored regex accepts exactly legacy `Private-Key: (2048 bit)` and OpenSSL 3 `Private-Key: (2048 bit, 2 primes)`-style headers. Invalid or malformed headers continue fail closed. The existing `int(bits.group(1)) < 2048` rejection remains in place.
- **Regression:** embedded tests check both 2048-bit formats, explicitly reject 1024-bit legacy/v3, refuse malformed suffix and preserve original public-only conflict, conflicting public key, symlink/path and idempotency tests.
- **Disposable validation:** Python test suite **6/6 OK** during isolated Docker image build; no retry of production image build or production container activation was used to establish PASS. Real public-DNS record, key escrow, Cloudflare writes, volume ownership and SMTP signing are outside FIX-01.
- **Residual operator gates:** source candidate must be promoted via existing human-approved Admin Panel updater before a *separate* DKIM image build on the deployed SHA; any error must halt, without direct code patch in VPS, forcing Git, restoring production data or rotating/generating production keys.

## DKIM-02/FIX-02 — Agent startup permission denial (2026-11-18)

- **Runtime symptom:** `restarting/unhealthy`, exit code `2`, repeated `[Errno 13] Permission denied` opening `/usr/local/bin/dkim-agent.py` from the UID 1001 provisioner.
- **Cause:** Docker image `COPY` did not explicitly guarantee non-root readable mode; root-owned build-time tests succeeded but normal runtime process could not read the entrypoint script.
- **Fail-closed fix:** set only the image copy's agent script mode to `0644` (non-writable by UID 1001) and build-fail if UID 1001 cannot read and Python-compile that script. No blanket `chmod 777`, no privilege escalation, no agent network access, no runtime Docker socket or volume-permission workaround.
- **Reproduction/acceptance:** prior container log captured exact permission denial. Isolated uncached Docker build passed six existing agent regression tests and non-root smoke check with `DKIM02_FIX02_NONROOT_BUILD_PASS`.
- **Unverified until separate controlled rollout:** new production host image, container `healthy` state, IPC token/socket runtime startup. Do not infer live health from build success and do not generate a production DKIM key or publish DNS while encrypted private-key escrow remains missing.


## DKIM-03 — Fail-closed escrow and recovery inventory (2026-11-18)

- **No receipt/tampered receipt:** root ownership, mode 0644, bound domain, private PEM SHA256, RSA public DER SHA256, ciphertext SHA256, fixed immutable R2 key and verified marker are checked before agent can publish `mail.txt`. No receipt means new private material stays staged without public TXT; a mismatch blocks publication.
- **Unsafe files/paths:** symlinked private key or receipt, invalid domain/traversal, missing identity, unsafe private-key mode, RSA size below 2048 and public-key conflict are rejected. Private key never leaves the host in plaintext via R2 or application API.
- **Offsite conflict:** fixed `IfNoneMatch: *` conditional R2 write, immutable object path per domain/PEM hash; any existing mismatched remote bytes, digest, metadata or decrypt result rejects without overwrite or delete. Full streamed bounded remote GET SHA256 readback is required before receipt publication. Missing/rejected conditional write fails closed.
- **Crash/retry:** lost PUT ACK is accepted only after a complete matching GET/readback; crashed-after-upload/before-receipt resumes using identical remote ciphertext rather than re-encrypting a new blob. Interrupted upload never publishes a receipt.
- **Recovery:** only CI-disposable fresh directory; after deleting original fixture volume/receipt, recover from encrypted object + independent age identity, validate private digest and RSA public fingerprint, write mode 0600 without overwrite. Live recovery API/CLI is intentionally absent.
- **Observed CI failure:** initial #44293943849 hit `SyntaxError` in an orphaned inner `try` at receipt writer. Single minimal in-scope repair committed, along with deterministic `chmod 0644` so UID1001 can read even if host umask is 077. Required recheck #44294483799 SUCCESS.
- **Residual security boundary:** offline receipt reflects host-root verified R2 state when written; the non-networked DKIM agent does not independently query R2. A compromised trusted host or malicious writable DKIM private volume is outside the receipt-only threat model. Age identity and protected R2 credential recovery were **not** proven on a lost real VPS.


## DOMAIN-AUTO-01 — Automatic DNS/DKIM failure handling

- Missing Cloudflare token, zone not found/inactive, zone permission/network/JSON error -> sanitized DOMAIN_AUTOMATION refusal before new key staging; persisted mail domain stays disabled and repairable.
- DKIM first-call `ESCROW_REQUIRED` is expected stage transition; host `dkim.escrow` command is fixed, HMAC-authorized, validates domain, redacts subprocess output. Remote checksum/receipt conflict returns failure; public key remains gated.
- DNS records are preflighted at all required names before writes. Existing different SPF/MX/DMARC/DKIM, proxied mail A, CNAME conflict or invalid zone -> no initial write. Interrupted partial create is safely rechecked/reused on retry, never overwritten or deleted.
- Reverse-proxy POST Origin matching is constrained to trusted HTTPS Host or configured origins; cross-site and non-JSON requests remain refused.
- DNS propagation pending -> saved domain disabled; retries operate on original domain identity, never create a duplicate or rotate keys.

- **Verified negative cases:** cross-zone refusal, inactive zone, missing token, conflicting SPF/DKIM, proxied mail A, malformed/domain-traversal broker commands; idempotent repeat and unrelated TXT preserved. Focused source CI `44345525274` PASS (Node 14/14, broker Python 3/3). Live reverse-proxy Origin/Cloudflare DNS token acceptance, R2 and DNS propagation remain NOT RUN.


## DNS-FINAL — primary source integration failure and safety contracts

- Explicit Cloudflare zone ID is required before automatic DKIM staging/DNS publishing; invalid/foreign/inactive ID, conflicting record, missing token, stale zone or inconsistent metadata must fail closed. Admin-only read-only zone-list returns sanitized ID/name, never bearer token.
- CAS-controlled `checkDomainDns` re-reads JSON after a conflicting concurrent zone binding and retries at most three times, preserving unrelated metadata; exhausted CAS refuses false verification/audit. Guarded DKIM root escrow receipts, DNS record preflight and no overwrite/delete remain unchanged.
- Evidence basis until new primary CI: mocked JILLU tests only. **No real Cloudflare API write, real R2 escrow or production delivery accepted.** Primary focused verification pending.


- **DNS-FINAL CI negative contract PASS:** [#44383278082](https://github.com/vibtoolshq/ReadBox/actions/runs/44383278082) tests missing/mismatched/inactive Cloudflare zone IDs, immutable zone binding, optimistic JSON CAS interleaving/retry exhaustion, DNS record conflict preservation, safe DKIM escrow host boundaries and manual UI fallback. Focused tests 25/25 Node, 2/2 UI files and Python host bridge PASS.
- Provider-specific outages, public propagation, real R2 custody, full VPS delivery and independent live acceptance remain **NOT RUN**. Successful mocked/disposable tests do not authorize live DNS changes or prove external Cloudflare availability.

---

## Current PRIMARY error handling truth table — 2026-11-19

**Evidence classes:** `CODE` = source present; `CI` = disposable test PASS at exact SHA; `PARTIAL-OPERATOR` = historical operator test in [016](016-LIVE-INBOUND-DEPLOYMENT-ACCEPTANCE.md); `NOT-RUN` = no approved live proof; `PLANNED` = do not claim it already works. Existing EH-E and EH-M identifiers above remain historical and unchanged.

| Case | Existing handling and grounded code proof | Missing/needed negative case or proposed improvement | Current evidence | NEXT owner |
|---|---|---|---|---|
| **EH-N01 Cloudflare token/permission/network** | `src/core/dns/cloudflare-auto.ts:L40–74,L77–105` rejects absent token, forbidden API, unavailable/malformed replies | Real 401/403, timeout, token rotated and zone insufficient permissions must leave domain disabled, redact token, allow guarded recheck | CODE + mocked CI; provider **NOT-RUN** | NEXT-03 |
| **EH-N02 cross-zone/inactive/foreign selection** | `cloudflare-auto.ts` resolves exact managed zone; `src/core/domains/service.ts:L196–231` binds zone ID with guarded DB CAS | Real wrong-zone, inactive, revoked permission, re-binding conflict; no DNS write or DKIM staging before validation | CODE + mocked CI; live **NOT-RUN** | NEXT-03 |
| **EH-N03 DNS preflight conflicting record** | `cloudflare-auto.ts:L157–211` compares all required record sets; conflicting MX/SPF/DKIM/DMARC/A refuses create/replace | Test production-like DNS conflict and reused identical record, never delete/overwrite root website DNS or proxied mail host A | CODE + mocked CI; live **NOT-RUN** | NEXT-03 |
| **EH-N04 interrupted partial publish / propagation** | Published records read back; domain stays disabled on public DNS mismatch; saved-domain repair idempotent | Real provider partial success, public TTL delay, safe replay with same domain/key; no duplicate or false success | CODE + mocked CI; public propagation **NOT-RUN** | NEXT-03 |
| **EH-N05 concurrent zone metadata write** | `src/core/domains/service.ts:L470–541` optimistic Prisma JSON equality + fresh reread, maximum three CAS attempts | Concurrent verification vs bind; exhaustion returns unavailable without success audit; staging race remains untested | CODE + 25/25 Node [Primary DNS CI #44383278082](https://github.com/vibtoolshq/ReadBox/actions/runs/44383278082); external DB race **NOT-RUN** | NEXT-03 only if live issue |
| **EH-N06 DKIM root agent / key leak** | `src/core/dns/domain-automation.ts:L40–67` rejects unverified encrypted escrow, `deployment/backup-agent/agent.py` limits HMAC action; key confined to host | Missing agent socket, invalid HMAC, remote R2 conflict, crash before receipt, key exposure must fail closed; no sensitive stdout/log leakage | CODE + mock Python/Node; real R2 **NOT-RUN** | NEXT-03 |
| **EH-N07 offsite backup/retention/restore** | `deployment/backup-agent/{r2.py,storage.py,restore.py,scheduler.py}` and tests implement guarded host contracts; [016](016-LIVE-INBOUND-DEPLOYMENT-ACCEPTANCE.md) only verifies **local** GPG archive | Unreachable R2, interrupted upload, expired credentials, independent age key custody, retention, foreign object refusal, restore tampering and rollback with real offsite staging bytes | CODE/disposable CI + local operator GPG observation; **offsite/live restore NOT-RUN** | NEXT-03 and NEXT-04 |
| **EH-N08 external SMTP and recipient rejection** | `deployment/mailserver/postfix/**`, `deployment/mailserver/dovecot/**`, `src/workers/ingestion.ts` implement inbound path; CI SMTP/LMTP negatives PASS | Independent outside-in port 25, unknown/disabled/nonlocal RCPT, accepted-but-not-indexed, MIME size/attachment integrity and queue recovery | CI and one `016` operator message; **independent suite NOT-RUN** | NEXT-04 |
| **EH-N09 trusted TLS, cert renewal, firewall** | `deployment/templates/nginx/app.conf.tpl:L40–42` references external Let's Encrypt; Compose port 25 is loopback default | Expired/wrong SAN or missing cert, renewal, port-25 provider filtering, IPv6 inconsistency; fail closed without public insecure fallback | CODE; operator STARTTLS partial; public independent TLS **NOT-RUN** | NEXT-03/04 |
| **EH-N10 primary R06 skipped job** | `.github/workflows/r06-production-readiness.yml:L19–22` restricts job to JILLU while **primary** is vibtoolshq | Correct Primary-only eligibility; assert job is not SKIPPED, no write token, and formal NO-GO even when all code gates pass | **CONFIRMED STATIC** + [Primary R06 SKIPPED](https://github.com/vibtoolshq/ReadBox/actions/runs/44384109011) | NEXT-02 |
| **EH-N11 legacy host Nginx path** | `deployment/templates/nginx/app.conf.tpl:L15,L44,L54–55` still uses vibmail upstream/TLS cache/log paths | Explicit parser/config validation of corrected host template, log directory permission and no change to reverse-proxy routing | **CONFIRMED STATIC**, no host config reload test | NEXT-02 |
| **EH-N12 backup SHA/auth mismatch** | Primary `main` is `3dfac11...`; backup heads differ; Windows credential attempts returned write-403; alternate source commit object not present in backup | Exact-ref CAS/non-force transfer, no overwrite of backup main; ensure dry-run/auth and two backup branch SHA readbacks; credential failure must not mutate refs | **CONFIRMED REMOTE BLOCKER**, not app bug | NEXT-01 |

### Proposed user-visible error contract (NOT yet implemented automatically)

- API/UI: stable redacted error code, actionable single retry instruction, distinguish **retryable** provider outage from **non-retryable** conflict and immutable escrow refusal. Never disclose Cloudflare token, root-only R2 credentials, private RSA/age material, raw SMTP message or private backup contents.
- Domain provisioning: do not convert `DNS pending` into `verified` until actual public MX/mail-host routing passes. Allow a safeguarded saved-domain retry with original key and escrow receipt. No automatic cross-zone migration, key rotation, DNS delete, or website root takeover.
- Mailserver acceptance: a `250 accepted` response alone does not prove LMTP, Maildir, worker indexing, inbox display or attachment integrity; a failure must retain/trace accepted message safely and report its queue/ingest state.
- Backup: upload error must not delete the only local encrypted copy; restore failures must preserve encrypted rollback material and never silently mutate production. Record restoration of PostgreSQL schemas, Maildir and attachment checksum/ACL separately.
- Repository/CI: `SKIPPED` != `PASS`; wrong Primary repository guard is a release-blocking verification gap, not a reason to enable publishing or force-sync backup main.

### One focused negative verification per approved NEXT work package

NEXT-01 exact Git object/ref SHA and denied permission path; NEXT-02 R06 Primary eligibility/NO-GO and Nginx generated-config negative; NEXT-03 wrong zone/conflict/token outage/DKIM escrow/partial-publication on one authorized test domain; NEXT-04 independent SMTP reject/MIME/worker outage/offsite restore hash/ACL and 17 formal gates. Tests must report real results with SHA/run links; **none is executed by this documentation phase**.

---

## NEXT-02 focused failure / error handling record — 2026-11-19

- **RN-01 Primary R06 repository guard (candidate fix):** `github.repository == 'vibtoolshq/ReadBox'` makes [CI #44505642726](https://github.com/vibtoolshq/ReadBox/actions/runs/44505642726) actually execute rather than SKIP. No automatic tag, release or deploy authorization.
- **Shell literal-newline defect (candidate fix):** four literal backslash-n tokens in YAML shell comment separated into executable lint, lint-baseline and TypeScript lines; CI now demonstrably executes ESLint. Typecheck was **not reached**.
- **EH-N11 Nginx legacy mismatch (candidate fix):** `vibmail_web` -> `readbox_web` with three matching proxy targets, `VIBMAILTLS` -> `READBOXTLS`, `/var/log/vibmail` -> `/var/log/readbox`. New static negative tests exist but were **not reached by CI**. Host log directory must be provisioned at separately approved deployment; no actual Nginx host test.
- **NEXT-02/BLOCKER-LINT-01 CONFIRMED out-of-scope:** `src/components/vcon/domain-form.tsx:185:5` existing React setState-in-effect violation. An approved behavior-preserving UI-state correction is needed; **no blanket rule disable/ignore-file workaround permitted**.
- **NEXT-02/BLOCKER-LINT-02 CONFIRMED out-of-scope:** `tests/integration/admin-system-update.test.mjs:94:25` regex-space syntax violation; an approved one-regex formatting correction is needed. Do not modify underlying updater.
- First [CI #44505642726](https://github.com/vibtoolshq/ReadBox/actions/runs/44505642726) had 4 ESLint failures, 2 were in-scope test-format and corrected. One necessary [CI #44505932658](https://github.com/vibtoolshq/ReadBox/actions/runs/44505932658) confirmed **only the above 2 out-of-scope errors remain**. No successful full R06 accepted. Fail closed; request separate exact file exception rather than weakening validation.

---

## NEXT-02 / BLOCKER-R06-GUARD-02 — Root-cause evidence and security boundary (2026-11-19)

- **Resolved in isolated candidate, CI-confirmed:** `src/components/vcon/domain-form.tsx:147,185` no longer calls synchronous `setZoneLoading(true)` inside React effect; existing default loading starts from `databaseConfigured` and asynchronous `finally` clears it. `tests/integration/admin-system-update.test.mjs:94` uses `/\n {2}readbox_update_ipc:\n/`. No React lint disable, no update-service changes. [R06 #44507511633](https://github.com/vibtoolshq/ReadBox/actions/runs/44507511633) complete app/lint/typecheck/UI/Nginx/build step PASS.
- **New confirmed fail-closed guard mismatch:** `scripts/testing/r06-ephemeral-postgres.sh:5` checks `GITHUB_REPOSITORY != JILLU-Games/ReadBox`; actual immutable GitHub Actions Primary repo is `vibtoolshq/ReadBox`. Its exact safe-refusal `R06: refusing non-CI PostgreSQL integration target`, exit 2, appears in [run #44507511633](https://github.com/vibtoolshq/ReadBox/actions/runs/44507511633). PostgreSQL was **never launched**; the failure is not migration logic.
- **Second confirmed preflight guard mismatch (not yet executed):** `scripts/testing/r06-smtp-rehearsal.sh:6` has the same JILLU-only repository check; the SMTP CI step was SKIPPED after PostgreSQL gate failure. Do not claim an actual SMTP FAIL.
- **Scope exception REQUIRED:** only `scripts/testing/r06-ephemeral-postgres.sh` and `scripts/testing/r06-smtp-rehearsal.sh`, guarded Primary repository identity check, **retain `GITHUB_ACTIONS=true`**, unchanged secure ephemeral DB, no live targets. Never impersonate legacy JILLU in workflow env or suppress guards.
- **Negative tests to preserve:** non-CI execution must still abort, wrong repository must abort, only Primary CI may proceed with ephemeral service; retain local `compose.yaml` overwrite refusal and existing target-guarding tests.
- **Status:** NEXT-02 still **BLOCKED** because the additional two files are outside original + approved lint exception allowlist. Need new user approval before editing them.

---

## 2026-11-19 NEXT-02 — final error/guard correction and release boundary (LATEST)

**Earlier lint and JILLU-only checks were real blockers and were not bypassed.** Final code SHA `4d0b124af57c8d407bf609540b8b8b7a69a479b5`, [R06 #44509947742](https://github.com/vibtoolshq/ReadBox/actions/runs/44509947742), **SUCCESS**. Verified:
- `scripts/testing/r06-ephemeral-postgres.sh:5`: match **actual Primary CI only**, still require `GITHUB_ACTIONS=true` and fail closed with exit 2 for wrong context. Original isolated ephemeral DB create/target cleanup unchanged. PostgreSQL migration/auth tests PASS.
- `scripts/testing/r06-smtp-rehearsal.sh:6`: same narrow CI identity correction; original greeting timeout/SMTP→LMTP tests remain unchanged. Disposable SMTP rehearsal PASS.
- The regression `tests/integration/r06-release-gate.test.mjs` spawns each script in **non-CI**, **legacy-JILLU**, and **wrong-repo** environment and expects a safe refusal (exit 2) *before* Docker or live operation. Test PASS on CI.
- Nginx host template changes are source/static and cannot prove a deployed `/var/log/readbox` directory or real reverse-proxy TLS readiness. No host reload/config deployment.
- User-visible domain form zone-loading initialized from the existing `databaseConfigured` prop instead of synchronous React state update; fetch/error completion unchanged. CI lint/typecheck/UI PASS. Admin update test regex `{2}` matched old semantics. No weak lint suppression.
- The full disposable R06 runner includes negative SMTP/LMTP checks, encrypted backup restore/rollback and release NO-GO evidence; all PASS. The original release blockers (7) and independent 17 staging gates remain untouched. **Production NO-GO**, no automatic publish or deployment enabled.

**Do not treat this CI-only result as external domain DNS/DKIM/R2 proof, production host/TLS proof, independent AGPL legal approval or offsite recovery acceptance.** Provenance and gate closure still require NEXT-03/NEXT-04 and separate user approvals.

---

## Latest error handling status and phase-locked negative cases — 2026-11-19

**Source freeze (2026-11-19 Asia/Dhaka):** authoritative `vibtoolshq/ReadBox/main` 6f3bc1e3aeb441956e1fd0f4d81558a6aba2945f; tree `f82b07b6e0770850edd3431f041d5162848d442a`. Last full disposable Primary R06 CI ran against executable code 4d0b124af57c8d407bf609540b8b8b7a69a479b5: [run #44509947742](https://github.com/vibtoolshq/ReadBox/actions/runs/44509947742), SUCCESS. Compare 4d0b124af57c8d407bf609540b8b8b7a69a479b5..6f3bc1e3aeb441956e1fd0f4d81558a6aba2945f: **one documentation-only commit changing notes/003–006**, no executable change. At freeze time both dedicated backup refs `backup/dns-final-primary-20261119` matched 6f3bc1e3aeb441956e1fd0f4d81558a6aba2945f (2/2); backup repositories' separate `main` branches did not. **This new notes-only commit will advance Primary HEAD beyond the freeze; do not claim backup parity at that new HEAD without a new remote readback.** Historical source snapshots below are preserved and must not be mistaken for current source. Production remains **NO-GO**: 32 original findings, 25 CI-contract verified and 7 OPEN; 17 independently accepted production gates not evidenced. Historical R-01–R-06: 6/6 CI implemented. NEXT-01 and NEXT-02: 2/4 completed; NEXT-03 and NEXT-04: 2/4 pending.

**Already implemented at source/CI:** wrong-repo/non-CI R06 shell guards [Postgres:L5–12](https://github.com/vibtoolshq/ReadBox/blob/6f3bc1e3aeb441956e1fd0f4d81558a6aba2945f/scripts/testing/r06-ephemeral-postgres.sh#L5) and [SMTP:L6–9](https://github.com/vibtoolshq/ReadBox/blob/6f3bc1e3aeb441956e1fd0f4d81558a6aba2945f/scripts/testing/r06-smtp-rehearsal.sh#L6); Cloudflare provider/permission/invalid reply redacted codes [cloudflare-auto:L40–70](https://github.com/vibtoolshq/ReadBox/blob/6f3bc1e3aeb441956e1fd0f4d81558a6aba2945f/src/core/dns/cloudflare-auto.ts#L40); selected-zone validation and atomic conflict preflight [cloudflare-auto:L140–219](https://github.com/vibtoolshq/ReadBox/blob/6f3bc1e3aeb441956e1fd0f4d81558a6aba2945f/src/core/dns/cloudflare-auto.ts#L140); missing DKIM R2 escrow refuses publication [domain-automation:L39–67](https://github.com/vibtoolshq/ReadBox/blob/6f3bc1e3aeb441956e1fd0f4d81558a6aba2945f/src/core/dns/domain-automation.ts#L39); cross-origin/JSON/zone-binding refusal [DKIM route:L21–138](https://github.com/vibtoolshq/ReadBox/blob/6f3bc1e3aeb441956e1fd0f4d81558a6aba2945f/src/app/api/vcon/domains/[uuid]/dkim/route.ts#L21); protected backup-agent error surface [agent-client:L12–48](https://github.com/vibtoolshq/ReadBox/blob/6f3bc1e3aeb441956e1fd0f4d81558a6aba2945f/src/core/backup/agent-client.ts#L12). These are **not new missing handlers**. Source/CI does not prove real provider/host acceptance.

**Phase-01 additional negative *acceptance*, not an authorized feature patch:** invalid/foreign/inactive zone, token 403/timeout, DNS conflict and readback mismatch, crash/retry with same key, R2 receipt absence/tamper, public propagation pending, bad TLS/port/PTR. Fail closed without overwriting unrelated records or leaking secrets. **Phase-02 additional negative acceptance:** wrong/disabled recipient and relay refusal, accepted SMTP but missing worker index, attachment hash/MIME/bounds, DB/worker outage, malformed/offsite tampered archive, independent rollback UID/ACL, missing provenance signoff. Record actual tested result vs NOT RUN in 003/005/006. If defects are reproduced, get a narrow approval first. See [018 error table](018-PHASE-EXECUTION-AND-CLOSURE-TEMPLATE.md).

---

## Current verified implementation status

### MM-01 actual implementation and CI evidence — 2026-11-19

- **Source implementation:** [`55ea7dbc97ff78e8c537bfecf3975923639a854b`](https://github.com/vibtoolshq/ReadBox/commit/55ea7dbc97ff78e8c537bfecf3975923639a854b); exact Git tree `e0789807d0b6128e3a60593acc25e03a4b5e1de8`, from previous Primary head `4303b66bfb85f8062bc6cca025f3bbe5d6abfab5`. Exactly **five approved executable/test files** changed: `src/components/vcon/domain-form.tsx`, `src/core/dns/records.ts`, `tests/dns/r03-advisory-contract.test.ts`, `tests/ui/domain-zone-selection.test.tsx`, `tests/ui/vcon-phase3.test.tsx`. No other source, backend, secrets, schema, mailserver, R2 objects or DNS provider operations.
- **Existing read-only CI:** [R06 SUCCESS, run 44576640402](https://github.com/vibtoolshq/ReadBox/actions/runs/44576640402), verification PR [#3](https://github.com/vibtoolshq/ReadBox/pull/3), head `ff48998e8dc0d46c35c433d55ed50f689dcab278` with the **identical complete source tree** `e0789807d0b6128e3a60593acc25e03a4b5e1de8`. Verified npm CI source/lint, TypeScript typecheck, UI unit/Vitest regressions, build, dependency audit, disposable PostgreSQL/SMTP/LMTP/restore, immutable R06 gates; 0 CI failures. PR commit only adds an **empty-tree-delta** CI trigger, not application file modifications. No CI workflow file changed.
- **Focused functionality check:** 53 readback assertions PASS against minimally transpiled, *actual committed* `records.ts` export functions and UI source guards; foreign-zone mail-host A/AAAA owner absent, external MX retained for all three recorded domains on IPv4/IPv6, in-zone owner retained, SPF/DMARC/DKIM TXT and DKIM 255-octet segments preserved. This standalone check is **not** an independent live DNS test or the Node r03 test runner. The newly added `tests/dns/r03-advisory-contract.test.ts` cases were committed and typechecked but were **not separately executed** by the R06 workflow; do not mislabel them as a CLI Node test PASS.
- **Diff/security audit:** compare previous head..source commit gave exactly 5/5 allowlisted paths. Independent source blob readback shows `src/core/dns/domain-automation.ts`, `src/app/(workspace)/vcon/domains/actions.ts`, DKIM API route, DNS download panel and R2 agent-client **unchanged**. Private DKIM keys remain escrow-gated. No Prisma migration or new provider API.
- **Mirror closure BLOCKED:** dedicated `backup/dns-final-primary-20261119` refs in `JILLU-Games/ReadBox` and `MdNurnobi-Dev/ReadBox` were read at `6f3bc1e3aeb441956e1fd0f4d81558a6aba2945f`, **not** `55ea7dbc97ff78e8c537bfecf3975923639a854b`. Primary connector can write only Primary; alternate account can write JILLU-Games but **neither connected account has push permission to MdNurnobi-Dev**. These independent repositories also lack the newer Primary commit objects. Therefore **zero of two backup refs have verified exact latest SHA parity**. No attempt to force-push, rewrite backup history, claim parity, or create misleading unequal-SHA mirror commits. Finish exact **non-force fast-forward git object transfer** with authorized backup credentials and reread both refs; until then status is **SOURCE VERIFIED / EXACT MIRROR SYNC BLOCKED**, not fully closed.
- **Live environment:** no VPS, no real-domain DNS write, no live R2 operation, no deployment, no tag/release. The three preexisting domain successes are still **operator/chat-recorded**, not re-run or independently revalidated by this Phase-01. Original production 7 OPEN findings / 17 independent gates are unchanged; release remains **NO-GO**.

---

## 2026-11-20 — NEXT-03 blocked preflight: expected negative handling (NOT LIVE-TESTED)

Frozen code/ref snapshot: `b4265e8fb6d8d32ebf08a12e4857bb6f10e536c9` (tree `120c6b99fbcd2cbd7fe299aeff87893d678b80a6`). Review-only, no source patch, no provider request, no simulated PASS.

| Existing source contract | Immutable proof | NEXT-03 actual result |
|---|---|---|
| Missing/nonpublic mail IP: `PUBLIC_MAIL_IP_REQUIRED`; active selected Cloudflare zone must resolve before publication | [domain-automation.ts:L31-L40](https://github.com/vibtoolshq/ReadBox/blob/b4265e8fb6d8d32ebf08a12e4857bb6f10e536c9/src/core/dns/domain-automation.ts#L31-L40) | Code guard present; **NOT RUN live** |
| Missing/unverified encrypted R2 escrow receipt: `DKIM_R2_ESCROW_UNVERIFIED` / `DKIM_R2_ESCROW_UNAVAILABLE`, no public-key release on absent receipt | [domain-automation.ts:L41-L67](https://github.com/vibtoolshq/ReadBox/blob/b4265e8fb6d8d32ebf08a12e4857bb6f10e536c9/src/core/dns/domain-automation.ts#L41-L67) | Code guard present; real R2 readback **BLOCKED** |
| Wrong selected zone `CLOUDFLARE_ZONE_MISMATCH`; conflicting record `CLOUDFLARE_DNS_RECORD_CONFLICT`; missing readback `CLOUDFLARE_DNS_READBACK_FAILED` | [cloudflare-auto.ts:L148-L216](https://github.com/vibtoolshq/ReadBox/blob/b4265e8fb6d8d32ebf08a12e4857bb6f10e536c9/src/core/dns/cloudflare-auto.ts#L148-L216) | Source handlers present; wrong-zone/record-conflict/retry **NOT RUN live** |
| Cross-origin POST and immutable zone-bound API changes refused | [DKIM route:L21-L38](https://github.com/vibtoolshq/ReadBox/blob/b4265e8fb6d8d32ebf08a12e4857bb6f10e536c9/src/app/api/vcon/domains/%5Buuid%5D/dkim/route.ts#L21-L38), [L85-L138](https://github.com/vibtoolshq/ReadBox/blob/b4265e8fb6d8d32ebf08a12e4857bb6f10e536c9/src/app/api/vcon/domains/%5Buuid%5D/dkim/route.ts#L85-L138) | Source guards present; host negative **NOT RUN** |
| Invalid/missing agent input/secret refused with sanitized public error | [agent-client.ts:L13-L48](https://github.com/vibtoolshq/ReadBox/blob/b4265e8fb6d8d32ebf08a12e4857bb6f10e536c9/src/core/backup/agent-client.ts#L13-L48) | Source error contract present; live agent **NOT RUN** |
| Default SMTP bind remains loopback `127.0.0.1`; not proof of external ingress | [docker-compose.yml:L264-L265](https://github.com/vibtoolshq/ReadBox/blob/b4265e8fb6d8d32ebf08a12e4857bb6f10e536c9/docker-compose.yml#L264-L265) | External trusted TLS, TCP/25/provider/PTR **NOT RUN** |

**Reason for BLOCKED:** The approval explicitly forbids choosing an existing production domain and the NEXT-03 disposable domain/zone, staging VPS and R2 custodian are not named. No attempted negative external call failed: this is an authorization/preflight stop, not an application bug. Do not close RB-P1-09, RB-P1-10 or RB-P2-07 on source-presence evidence.
---

## 2026-11-20 — Manual DKIM zone validation: expected safeguard

Observed `vibmail.my` edit page showed `Select a Cloudflare zone before publishing DNS.` because **Publish DKIM TXT to configured Cloudflare zone** was selected while no matching zone was available. This is intended fail-closed UI validation, **not** a reproduced backend bug. For another account, operator unchecked Publish and used `Provision / Repair DKIM`; subsequent screenshot showed a ready key and copyable public TXT. Domain-level `DNS: verified` is routing verification only; authoritative DKIM TXT and negative external provider cases remain unverified. No source/error-handler edits were authorized.

## AU-PARITY-01 — fail-closed updater ref evidence (2026-11-20)

- Three fixed refs: Primary `vibtoolshq/ReadBox:main`, `JILLU-Games/ReadBox:backup/dns-final-primary-20261119`, `MdNurnobi-Dev/ReadBox:backup/dns-final-primary-20261119`. Backup repository `main` is deliberately NOT consulted.
- `src/core/updates/service.ts` returns `NO_COMPATIBLE_RELEASE` (409) for mismatched/invalid SHA and `UPSTREAM_UNAVAILABLE` (503) for unavailable/403/missing source; no download/update occurs.
- Host `remote_main_refs()` permits only hard-coded exact remote/ref pairs and valid full 40-hex SHA, requires equality across all 3, otherwise fails closed as `UNTRUSTED_REMOTE_REF`, `SOURCE_MIRROR_MISMATCH` or host command failure. Authenticated RPC action/permissions/nonce checks remain untouched.
- Opt-in pinned shell update gate validates all three refs against the approved target and returns `AU01_SOURCE_MIRROR_SHA_MISMATCH` on mismatch; inaccessible/missing `git ls-remote --exit-code` fails before snapshot/merge/Compose under `set -Eeuo pipefail`.
- Source/CI proof [44723412617](https://github.com/vibtoolshq/ReadBox/actions/runs/44723412617): 10/10 Node tests; host Python mock and shell fake-Git negative cases exercised with no live Git/VPS/DNS/R2. Actual production host behavior remains NOT LIVE VERIFIED.

## AU-R2-UPDATE-01 — source-level fail-closed safeguards; CI BLOCKED (2026-11-20)

- Preflight denies incorrect root/checkout, non-clean main, 3/3 ref mismatch, absent backup agent, unconfigured R2, unsafe private archive/identity, active job/restore review, missing pre-update rollback directory or insufficient backup space. The checked Git refs are immutable source-declared (no user-provided URL or backup path).
- Approved managed backup broker calls: root-only HMAC Unix `status`, `backup.create`, `job.get`, `backup.verify`, `r2.upload`; only an exact fresh V2 `.age` job ID and SHA256 receipt can authorize the guarded updater's opt-in `attest`. Existing R2 adapter full remote GET and journal receipt are reused.
- STOP before Git change for missing/invalid/corrupt ciphertext, failed/unavailable R2/403, digest mismatch, interrupted job, lock conflict or missing acknowledgment. Existing updater always keeps its independent encrypted R05 rollback snapshot; on post-FF failure no automated destructive restore/reset.
- Mocked Python agent/R2 negative cases PASS in recheck [44826908089](https://github.com/vibtoolshq/ReadBox/actions/runs/44826908089). Shell excerpt test FAIL because test fixture omitted ROOT; corrected candidate `3f377dd...` untested. This does not prove live R2 performance, remote object availability or host migration. No new R2 credentials, remote deletion or backup-agent source mutation.

## AU-R2-UPDATE-01 — Final error-handling verification supersedes prior CI failure (2026-11-20)

- [Successful CI #44827143074](https://github.com/vibtoolshq/ReadBox/actions/runs/44827143074) at exact corrected executable SHA `3f377dd6836c9726492eaaade451895c9595b9b4` verifies mocked HMAC backup job, V2 verification, R2 403/refusal, upload result mismatch, missing receipt, active-job refusal, corrupted ciphertext and host target mismatch negatives; isolated shell receipt gate and pinned existing Admin updater regressions, 10/10 PASS.
- Protected ordering: read-only pinned 3-ref/host/storage preflight first; fresh root-only managed `.age` backup → explicit decrypt/verify → existing R2 remote-streamed SHA-256 receipt → rollback-local snapshot → receipt re-attestation → guarded fast-forward → bounded health. Existing shared backup lock cannot be held while broker jobs run. No automatic destructive restore.
- Test result does **not** prove live host permissions, actual R2 service, database migration, mail delivery or independent offsite restore. Earlier BLOCKED entry is historical, superseded for source-only CI by this PASS.

## AU-R2-BOOTSTRAP-01 — exact error-handling truth (2026-11-20)

- Verified runtime structure: pinned Git fetch always targets `https://github.com/vibtoolshq/ReadBox.git refs/heads/main`; three fixed ref SHA, private 0700 /run staging, root-only 0600 script Git-blob verification, clean checkout and R2 receipt guards remain present at candidate `18e507c68c1a807201bc92fc4e698701a666e755`. These are source observations, NOT final CI or live host acceptance.
- CI #44831028239: `readbox-update.sh:128` unsupported line break inside Bash comparison caused syntax failure. Minimal two-line continuation fix landed in candidate `18e507c...`.
- CI #44831164135: parser PASS, 13 tests PASS, one assertion FAIL: prior literal `backup_r2_gate.py" attest` no longer matches deliberately variable-based `python3 "$receipt_helper" attest`. This is reproducible test-contract drift; independent end-to-end staging not fully green. No authorization for additional patch/recheck remains.
- Runtime wrong SHA, missing object/ref, dirty checkout, tampered blob, symlink, missing R2 receipt and lock conflict are designed fail-closed. Their complete acceptance cannot be claimed while CI red. No production update/restore executed.

## AU-R2-BOOTSTRAP-01 F-TEST-01 — stale static assertion resolved (2026-11-20)

- Prior CI failure: `tests/integration/au-r2-guarded-update.test.mjs:24` asserted a literal helper pathname; the new approved updater calls its verified staged helper through `python3 "$receipt_helper" attest`. Existing runtime logic was not defective in that particular assertion.
- User approved one and only one fixture correction: `assert.match(gate,/python3 "\$receipt_helper" attest/);` with the matching shell marker. The rest of the test, including the negative receipt refusal, stays intact.
- [Final focused CI #44832329196](https://github.com/vibtoolshq/ReadBox/actions/runs/44832329196) **SUCCESS** at `f6fceeafc5933b1fdb8327e2589be825183bd5a9`: syntax, 14/14 tests, typecheck, exact scope and CI-only/no-deploy marker passed. This supersedes previous CI-blocked source status. It does **not** establish live R2 receipt, offsite restore or VPS update readiness.

## OPS-CMD-FIX-01 — exact cause, negative contract and correction (2026-11-20)

- Before fix, nested `sudo bash -c` command in `docs/ADMIN-SYSTEM-UPDATE.md` used incorrectly escaped single-quote segments around `trap`, causing argument splitting (expected five), rather than one safe shell script argument. The user approved **documentation, test and workflow trigger** only.
- Corrected one-code-example fragment to `trap "rm -f -- \\"$entry\\"" EXIT`, whose inner Bash command retains shell quoting for a single root-only temporary entry path.
- The targeted test shadows `sudo` with a local shell function (never executes sudo), asserts exact argc=5 and argv boundaries, validates extracted inner shell via `bash -n`, and simulates EXIT trap cleanup for a disposable temporary file with spaces on both status 0 and status 19. All pre-existing tests remain unchanged.
- Verified [focused CI #44836416395](https://github.com/vibtoolshq/ReadBox/actions/runs/44836416395): 15/15 PASS; Bash/Python syntax, TypeScript, no-deployment and scope all PASS. No real VPS or production credentials/data involved; live operator success is unverified.
