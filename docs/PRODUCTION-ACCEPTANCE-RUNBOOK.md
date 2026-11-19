# ReadBox R-06 staging acceptance runbook (NO-GO unless separately authorized)

> **Current-documentation reconciliation — 2026-11-20:** Keep this document as a **dated technical, operator or release-governance record**. Its frozen code SHA and statements about what was source-only or not yet live are historical to that phase. The current source is the [documented audited baseline](index.md); consult [current user/operator guides](users/index.md) and [technical coverage](reference/coverage-and-verification.md) for subsequent implemented features and limited inbound operator evidence. No new stable-release or legal sign-off is implied: **R-06 formal 17-gate decision remains NO-GO**, and MIT/legacy AGPL distribution clearance requires separate human review.

**Current 2026-11-17 verdict: NO-GO.** This is a manual staging acceptance contract; **not** proof that any VPS, public DNS, Internet SMTP or production mail has been touched.

## Permission and safety

Before ANY live DNS lookup/probe, SMTP handshake/send, VPS SSH, user creation, backup/restore, firewall/TLS mutation, Git tag, or release publication, obtain **separate user approval** for the exact staging VPS/domain, action, sender/recipient, maintenance window and operator. This R-06 authorization allows CI and documentation only. Never use real mailbox data for CI, never send unsolicited mail, and never put credentials, TLS keys, SMTP mail bodies or private backup keys into GitHub logs.

## The 17 mandatory formal gates

Each gate is currently NOT RUN on approved staging and must have independently corroborated, sanitized evidence before a production GO.

| Gate | Must verify separately on authorized staging |
|---|---|
| RG-01 | 32 findings reconciled, zero unresolved P0, all P1/P2 analyzed and dispositioned |
| RG-02 | Exact source/mirror SHA/tree, version and immutable production Docker image digest |
| RG-03 | Full CI at release SHA and acceptable dependency/security audit |
| RG-04 | Correct production Compose, strong unique secrets, hardened VPS/Coolify config |
| RG-05 | Real web/worker startup, complete PostgreSQL migrations, persistent volumes, restart |
| RG-06 | One PostgreSQL, restricted Postfix SQL role, valid/invalid mailbox and permission checks |
| RG-07 | Incoming Postfix TCP/25 → private LMTP → canonical Maildir UID/GID and ACL |
| RG-08 | Independent MX/A/AAAA/PTR, provider ingress/egress port policy, firewall and IPv6 if used |
| RG-09 | Trusted web/mail TLS certificate/hostname/renewal and applicable DKIM requirement |
| RG-10 | Authorized outside sender → Postfix → LMTP → Maildir → ingestion → authenticated inbox and attachment hash |
| RG-11 | Unknown/disabled recipient and nonlocal relay rejection, MIME/size negatives, no accepted-but-lost mail |
| RG-12 | First-admin reset, unauthorized access denial, expired reset token |
| RG-13 | Worker/DB/storage outages are not_ready; restart/recovery without duplicates or loss |
| RG-14 | Encrypted offsite backup transfer, retention, private key custody, restore integrity/ACL, rollback, downtime |
| RG-15 | Sanitized logs/alerts, disk quotas and capacity, incident response and secret handling |
| RG-16 | Third-party provenance review, MIT root vs AGPL reference source, advisories and packaged artifact inventory |
| RG-17 | Independently reviewed evidence and a **separate explicit human release approval** |

**Evidence must include** gate ID, exact SHA/tree/image digest, environment, UTC time, observer, authorized action, expected and observed result, sanitized private evidence reference and negative-case outcome. Missing/skipped means NOT_RUN, not PASS. Read [notes/006](../notes/006-VERIFICATION-AND-RELEASE-GATES.md) for the authoritative 17-gate ledger.

## Optional operator evidence input: NOT a production authorization

The read-only gate script accepts an untracked **private** JSON file such as:

```json
{
  "schema_version": 1,
  "environment": "staging",
  "target_sha": "REPLACE_WITH_40_HEX_COMMIT_SHA",
  "gates": [
    {"id": "RG-01", "status": "NOT_RUN"},
    {"id": "RG-02", "status": "NOT_RUN"}
  ]
}
```

Supply all 17 gate records when available. A PASS claim requires `observer`, `observed_at` and a sanitized HTTPS `evidence_url` without credentials. Such JSON is an **assertion**, not independently verified proof: the script does not fetch evidence, trust a self-reported PASS, auto-approve, release or deploy.

```bash
node scripts/testing/r06-release-gate.mjs --ci
node scripts/testing/r06-release-gate.mjs --evidence /secure/private/staging-evidence.json --require-live --output /secure/private/release-review.json
```

- `--ci` exits 0 on valid CI-contract checks and prints `R06_PRODUCTION_NO_GO` unless external gate facts are established.
- `--require-live` exits 3 for missing/failed gates or unresolved original findings; invalid evidence exits 2.
- If all claims and source facts ever appear complete, the recorder can emit only `MANUAL_RELEASE_REVIEW_REQUIRED`, **never a production approval**.

## Future staging procedure: only AFTER explicit approval

1. Identify the approved staging VPS, exact Git SHA/tree and immutable image. Ensure standalone production Compose rather than dev Compose, no default secrets and authorized maintenance window.
2. From an independent authorized location, use `dig` for MX/A/AAAA/PTR and inspect approved provider firewall/port-25 reachability. **Do not modify DNS.**
3. Only with live-probe approval, observe inbound SMTP STARTTLS/hostname trust using an appropriate command such as `openssl s_client -starttls smtp -connect mail.example.test:25 -servername mail.example.test -verify_return_error`. Verify no unintended public SMTP AUTH/open relay/IMAP/LMTP.
4. With a separately approved disposable sender/recipient, record SMTP ID, LMTP acceptance, canonical Maildir hash, ingestion DB index, authenticated inbox and attachment digest; sanitize all evidence.
5. Test invalid recipient, nonlocal relay, MIME limits, worker/DB/storage outage and recovery/reboot under an approved staging maintenance window; check queue/data retention.
6. Independently verify **offsite** encrypted backup, key custody, actual disposable restore (both PostgreSQL schemas, Maildir, attachment, queue and ACL) and rollback without using a live production restore.
7. Obtain review of license provenance and current dependency advisories, then independent human release approval. A new explicit command is required for a tag/release or VPS deployment.

**Prior disposable R-03 SMTP/LMTP and R-05 encrypted restore CI pass do NOT constitute public SMTP/TLS/MX, real inbox ingestion, offsite or VPS proof.** ReadBox is inbound-only; it does not offer public IMAP/POP3/submission. **Production NO-GO.**
