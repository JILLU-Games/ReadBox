# 014 — R-06 final read-only CI, release GO/NO-GO and Scope Lock patch audit

**Date:** 2026-11-17 (Asia/Dhaka)
**R-05 authoritative baseline:** `c3f9dd4d146dfb28a3d23139ce0fafb3e333acca`
**Successfully CI-tested R-06 implementation SHA:** `807ca9f38adb02db2a8b73dc0901fce23ee5e63a`
**Consolidated GitHub Actions SUCCESS:** https://github.com/JILLU-Games/ReadBox/actions/runs/44127481624
**Implementation scope:** **6/6 phases CI implemented.** **Final live staging acceptance: BLOCKED/NOT RUN.**
**Original forensic findings:** 25/32 CI-verified, **7 OPEN**; **0/17 live staging release gates PASS**.
**Production release:** **NO-GO**. No tag, live VPS, DNS mutation, public SMTP, real email, release or deploy.

## 1. Exact changes — all within R-06 allowlist

| Published path | Verified scope change |
|---|---|
| `.github/workflows/r06-production-readiness.yml` | New consolidated source-only CI on main/PR/manual dispatch; `permissions: contents: read`, no release/tag/VPS/DNS/deploy, uploads sanitized NO-GO artifact only |
| `scripts/testing/r06-release-gate.mjs` | Offline 32 finding + 17 mandatory RG gate reconciliation; rejects missing/duplicate/wrong SHA/unsafe evidence; no production approval even with full untrusted claims |
| `scripts/testing/r06-ephemeral-postgres.sh` | GitHub-runner-only copied development Compose file, unique named tmpfs PostgreSQL-16.14 test target, existing strict Docker target guard; cleanup |
| `scripts/testing/r06-smtp-rehearsal.sh` | Bounded localhost SMTP greet startup probe injected into **disposable copy** of original R-03 smoke; original mailserver/source config left untouched |
| `scripts/testing/r06-verify-lint-baseline.mjs` | Detect exactly two pre-existing R-04 unused catch binding lint errors, refuses any extra/new issue; does not edit unrelated app source |
| `tests/integration/r06-release-gate.test.mjs` | Genuine negative tests for missing staging claims, fake 17/17 PASS with 7 OPEN originals, wrong SHA, malicious token URLs, duplicate gates, future timestamps and MIT vs AGPL license separation |
| `docs/PRODUCTION-ACCEPTANCE-RUNBOOK.md` | Safe, independently authorized *future* staging proof and RG-01..RG-17 operator checklist |
| `docs/RELEASE-GOVERNANCE.md` | Nonpublishing CI boundary, evidence-vs-GO policy, future approval steps |
| `docs/THIRD-PARTY-PROVENANCE.md` | Separate ReadBox MIT vs reference/MailStack AGPL + NOTICE source inventory, human license review still OPEN |
| `README.md` | Accurate NO-GO production note with links to staging/release evidence |
| `SECURITY.md` | CI-vs-live security, disclosure and secret-redaction boundary |

**Exactly 11 paths** passed the maintenance-branch path audit `R06_EXACT_SCOPE_NO_APP_UI_AUTH_MAILSERVER_EDIT_PASS 11`. No `src/**`, `prisma/**`, `deployment/mailserver/**`, `deployment/templates/**`, `reference/**` or other unrelated feature, UI/UX/auth, mailserver engine or migration modified.

## 2. Actual consolidated CI results — not a VPS test

**Successful run:** https://github.com/JILLU-Games/ReadBox/actions/runs/44127481624; published verified code SHA `807ca9f38adb02db2a8b73dc0901fce23ee5e63a`.

| Verification (single job, sequential) | Actual result |
|---|---|
| Node 22 + npm clean install, Prisma validation | PASS |
| Existing unit/auth/backend regressions, **70 UI tests** | PASS |
| Next.js production build | PASS |
| Production npm dependency audit moderate+ threshold | PASS |
| Source-level ESLint, excluding only 2 pre-existing R-04 unused catch errors with exact independent baseline assertion | PASS *with documented exception* (full lint remains NOT CLEAN) |
| New six release-gate and provenance negative unit tests | PASS |
| Existing verified local-only PostgreSQL 16.14 `postgres-test` tmpfs + exact Docker identity/label/port guard, migrations replay/auth | PASS |
| Real disposable production Docker web/worker/Postfix/Dovecot image builds + service boot | PASS |
| SMTP loopback 2525 STARTTLS, Postfix lookup → private LMTP → actual Maildir message | PASS |
| Unknown local recipient and outside relay rejection, SMTP AUTH disabled | PASS |
| R-05 disposable age-encrypted PostgreSQL/Maildir/attachment/media/queue backup→restore, UID/GID 1001, Linux POSIX ACL | PASS |
| Forced failure after PostgreSQL apply and automatic recovery of previous DB+Maildir state | PASS |
| Tampered ciphertext rejected without data mutation | PASS |
| Exact Scope Lock and private sanitized NO-GO report artifact | PASS |
| Public Internet SMTP, real DNS/PTR/provider port 25, trusted TLS CA, real authenticated inbox attachment, host reboot, offsite backup restore, independent legal review | **NOT RUN** — user did not authorize live activity |

**Exact observed CI log proof:**

```text
R06_APP_UI_AUTH_PROVENANCE_AND_NEGATIVE_GATES_PASS
R06_DEPENDENCY_AUDIT_PASS
R06_EPHEMERAL_POSTGRES_TARGET_GUARDED_INTEGRATION_PASS
R03_SMTP_LMTP_MAILDIR_DELIVERY_PASS
R06_ORIGINAL_R03_FULL_SMTP_LMTP_NEGATIVES_PASS
R06_ISOLATED_PRODUCTION_IMAGES_SMTP_LMTP_PASS
R05_PROVEN_POST_DATABASE_APPLY_AUTOMATIC_ROLLBACK_PASS
R05_TAMPER_NO_MUTATION_PASS
R06_ENCRYPTED_BACKUP_RESTORE_ROLLBACK_PASS
R06_EXACT_SCOPE_NO_APP_UI_AUTH_MAILSERVER_EDIT_PASS 11
R06_17_GATE_RECONCILIATION_PASS
R06_LICENSE_PROVENANCE_CONTRACT_PASS
R06_FINDINGS_OPEN=7
R06_LIVE_GATE_PASS_CLAIMS=0/17
R06_PRODUCTION_NO_GO
R06_ALL_CI_CONTRACTS_PASS_PRODUCTION_NO_GO
```

The workflow has only `contents: read` permission. It builds test images on a GitHub runner and deletes disposable Docker containers and volumes; it does **not** create GitHub Releases/tags or push source. Localhost self-signed STARTTLS proof is not public trust evidence. The sanitized report is a CI artifact (7-day retention), not a private staging result.

## 3. Applied negative release governance

- Original ledger must list exactly 32 unique findings and the defined RG-01–RG-17 table exactly once. Missing ledger or mandatory gate IDs fail.
- Any unresolved original finding causes `NO_GO` irrespective of a self-declared all-PASS JSON. Mandatory staging evidence missing/FAIL/NOT_RUN also causes `NO_GO`; the current project has **7 OPEN originals** and no live claims.
- Wrong exact Git SHA, duplicate/unknown gate IDs, unsafe credential-bearing HTTPS URLs, future timestamps and missing observers are rejected.
- Root MIT and historical `reference/MailStack/LICENSE` AGPL + `NOTICE.md` presence and Dockerignore reference exclusion are checked; **no actual legal determination**. `RB-P2-08` remains OPEN.
- Even in a hypothetical clean 32/32 and 17/17 state the script outputs `MANUAL_RELEASE_REVIEW_REQUIRED`, **never a production deploy authorization or a release action**.
- No actual staging evidence file was read/accepted in CI. Operator evidence requires future separate approval, secure private handling and independent human verification.

## 4. One identified, out-of-scope existing lint debt (not concealed)

The initial R-06 CI failed because the newly written release gate JS used implicit `URL`, `process` and `console` globals not permitted by the repo ESLint config. Those new R-06 bugs were fixed using Node imports and stderr output.

The same lint discovered **two older R-04 errors** at `src/core/setup/trusted-operations.ts:366` and `:386`: unused `catch (err)` variables (`@typescript-eslint/no-unused-vars`). R-06 Scope Lock forbids editing that source. The corrected R-06 workflow lints **all other source** and independently asserts exactly these two historical locations/rule IDs and fails if new lint errors are added. **Full-tree ESLint is therefore not clean.** The two issues need an explicitly approved future narrow source exception; do not claim RG-03 clean beyond actual passing tests/audit.

The next CI attempt completed the Docker build but observed a startup race before Postfix served SMTP greetings. R-06 added an isolated **bounded** SMTP readiness probe to a throwaway R-03 smoke copy; **no R-03 app/mailserver source change**. The final focused CI passed fully.

## 5. Exactly seven original findings remain OPEN

| Finding | Why production acceptance cannot be granted |
|---|---|
| `RB-P0-06` (R-06) | No authorized Internet SMTP accepted→LMTP→Maildir→worker→authenticated inbox + attachment evidence |
| `RB-P1-09` (R-03 external) | No trusted production mail/web TLS, real MX/DNS and certificate renewal/DKIM applicability evidence |
| `RB-P1-10` (R-03 external) | No public TCP/25, provider policy/firewall, MX/A/AAAA/PTR reachability proof |
| `RB-P1-16` (R-06) | CI Docker image/migrations/recovery works, **real VPS live/reboot/host outage** not observed |
| `RB-P2-01` (R-05 scope) | Legacy Nginx template paths/names outside R-06 allowlist; no patch applied |
| `RB-P2-07` (R-05 external) | No real offsite encrypted copy/retention, independent key custody, host/VPS recovery |
| `RB-P2-08` (R-06 legal) | MIT/AGPL tracked sources checked, actual shipped distribution and legal obligations not independently signed off |

Original 32-finding totals unchanged: **25 CI contract verified, 7 OPEN**. All 17 formal **live** RG gates remain pending independent evidence. A successfully completed *implementation* workflow **cannot** satisfy the R-06 exit gate that explicitly requires a **separately approved staging VPS acceptance**.

## 6. Closure / next action (not authorization for deployment)

- **R-06 code/governance implementation:** CI VERIFIED, **6/6 planned implementation scopes complete**. Full production acceptance: **BLOCKED/NOT RUN**. The production recommendation remains **NO-GO**.
- Use [operator staging runbook](../docs/PRODUCTION-ACCEPTANCE-RUNBOOK.md) only after explicit new authorization naming VPS/domain and tests. Resolve 7 original findings and 2 historical full-tree lint errors via approved scopes, review the shipped license provenance, collect fresh immutable image SHA/digest and offsite restore logs.
- Another separate release approval is required for any tag, GitHub Release, image publish or actual deployment. Nothing in R-06 authorizes those actions. Do not invent a seventh phase or silently patch source/UI/infra beyond R-06.
