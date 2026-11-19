# 018 — Scope-Locked Phase Execution, Error Handling and Closure Template

**Current planning input:** 6f3bc1e3aeb441956e1fd0f4d81558a6aba2945f, tree `f82b07b6e0770850edd3431f041d5162848d442a`; tested executable revision 4d0b124af57c8d407bf609540b8b8b7a69a479b5; R06 CI [#44509947742](https://github.com/vibtoolshq/ReadBox/actions/runs/44509947742). Baseline snapshot is immutable even when notes-only HEAD advances.

## Step-by-step production-update protocol

1. Choose **one** authorized phase: **Phase-01 = NEXT-03** (controlled one-zone DNS/R2/TLS) then **Phase-02 = NEXT-04** (isolated staging delivery/restore and formal human GO review). Earlier R-01–R-06 remain 6/6 source-CI completed; NEXT-01 and NEXT-02 remain 2/4 completed.
2. Freeze the *then-current* Primary SHA and actual Git tree. Compare exact baseline code and historical 001 finding; never assume a stale link at 3dfac11 or historic JILLU implementation matches current Primary.
3. Obtain separate user approval of named phase, exact environment, DNS names/mailboxes, any external actions and **exact written file allowlist**. Phase-01 and Phase-02 have **no default executable source patch rights**. If approval or required safe fixtures are missing, mark BLOCKED.
4. Capture **before** status, protect secrets and data, show no tokens/private PEM/age key/message body; create or confirm encrypted rollback material where a data-changing authorized operation warrants it.
5. Execute one bounded, disposable/focused verification matching the named phase; do not repeatedly run broad test loops. Actual Cloudflare/VPS/offsite/SMTP operations require their own authorizations, even if CI source tests passed.
6. For a failure, save sanitized reproduction code+line, ID, specific impact, exact one-defect allowlist amendment and expected negative test. Do not silently change UI, auth, Prisma schema, original migrations, Maildir, production data, Compose topology or release publishing.
7. Inspect exact changed paths, `git diff --check`, no new secrets or generated private material, negative protections, no unexpected tag/branch changes. Commit only after allowed focused gate and audit; publish only through separately authorized non-force refs.
8. Append the structured record below to `notes/003`; update error truth in `004`, live-feature truth in `005`, formal evidence in `006`, and optional new finding appendix in `017`. Note any backup parity gap at **post-commit** SHA separately.
9. Close phase **VERIFIED / BLOCKED / FAILED** with tested code SHA, operator proof and remaining open gates. A completed source phase does not imply production GO.

## Per-phase append-only record (copy into notes/003 after evidence)

```md
### YYYY-MM-DD — Phase-01 / NEXT-03 (or Phase-02 / NEXT-04)
- State: PLANNED | APPROVED | RUNNING | BLOCKED | FAILED | VERIFIED
- Authority: user approval reference; approved environment/domain/test mailbox (redacted)
- Source before: <40-char Primary SHA>; tree: <40-char tree SHA>
- Findings: <original RB IDs; supplemental RN IDs if applicable>
- Exact patch Scope Lock: <literal allowlist or NONE — OPERATION/EVIDENCE ONLY>
- Changed files: <literal git diff --name-only result>
- Behavior before / after: <grounded facts>
- Existing working behavior retained: <UI/auth/data/mailserver/DNS/backup negative>
- Actual code proof: <immutable file:Lx–Ly permalink and excerpt>
- Error codes/negative cases: <tested facts and expected fail-closed behavior>
- CI: <URL, tested SHA, job status> or NOT RUN (reason)
- External evidence: <independent observer, timestamp, sanitized result> or NOT RUN
- Secrets/rollback: <protected / verified without revealing material>
- Diff/security audit: <allowed/actual path count, secret scan, outcome>
- SHA post-commit: <40-char>; Primary+both backup SHA refs: <value or UNVERIFIED>
- Original findings OPEN: <exact unresolved IDs>
- Formal RG-01..17: <each gate PASS/FAIL/NOT RUN with source>; release NO-GO by default
- Overall historical R phases: 6/6; NEXT packages complete: <2/4, 3/4 or 4/4 only if actually accepted>; remaining: <...>
- Next authorized phase: <phase name>; unresolved blockers; explicit next approval required
```

## Error and evidence rules

| Failure | Expected response | Owner |
|---|---|---|
| Cloudflare token missing/403, stale/inactive zone | Redacted error; stop before key/DNS write | Phase-01 |
| Selected zone mismatch or existing SPF/DKIM/MX/DMARC conflict | Deny mutation, preserve old DNS; report exact code | Phase-01 |
| R2 encrypted receipt missing, remote mismatch, damaged readback | Refuse public DKIM TXT release, retain private key and ciphertext; guarded same-key retry only | Phase-01 |
| DNS propagation pending, partial provider response | Re-query records and only accept matching readback; no false active status | Phase-01 |
| External TCP/25 or trusted TLS unavailable | Record blocked public acceptance; do not blindly open/bypass firewall/TLS | Phase-01 / Phase-02 |
| Accepted SMTP not ingested, bad MIME/attachment digest | Trace queue/LMTP/Maildir/worker with privacy-safe identifiers; do not claim delivery based on SMTP 250 | Phase-02 |
| PostgreSQL/worker/storage outage or migration mismatch | Fail closed readiness, preserve data, controlled staging recovery | Phase-02 |
| Offsite restore tampering/UID/ACL mismatch | Stop and restore tested encrypted rollback in isolated staging; never edit live user data | Phase-02 |
| License/NOTICE provenance not signed, live gate partial | Preserve OPEN, `NO-GO`, no tag or artifact publication | Phase-02 |

## Immutable state and forbidden shortcuts

- Existing DNS records, R2 objects, DKIM private keys, local/offsite backups, user messages, real PostgreSQL data, authorization, PWA/UI and Maildir must remain unchanged unless a **specific later explicit environment authorization** exists.
- No blanket catch/ignore, test-skip-to-PASS, security predicate weakening, fake `GITHUB_REPOSITORY`, undocumented new phase, silent code change, force push or bypass of root MIT / historical AGPL provenance.
- Release threshold: original findings individually dispositioned, exact release SHA/image/artifact/provenance, all 17 independent gate signatures, then **manual reviewer approval**; only an additional explicit user instruction can publish/tag/deploy.
