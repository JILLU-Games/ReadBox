# 004 — Backup agent actual error inventory (vs next-phase proposals)

**Source split:** BR-02 main `c08b9cd77ec30afc50fe36952eecb982ba90a982`, BR-03 candidate `b8f3fc662d384211d4506e40f13859f9cfcb012a`. Do not ascribe candidate behavior to deployed production.

## Existing and proven source behavior

| Signal | Existing source code | Current behavior / evidence |
|---|---|---|
| `BACKUP_AGENT_UNAVAILABLE` | `src/core/backup/agent-client.ts` | Missing socket/secret/transport fails closed; UI shows unconnected |
| `FORBIDDEN`, replay/TTL rejection | `deployment/backup-agent/agent.py` | HMAC timestamp/nonce, Linux peer UID and bounded requests |
| `BACKUP_INPUT_INVALID`, `BACKUP_NOT_FOUND`, `JOB_CONFLICT` | `src/core/backup/validation.ts`, `storage.py` | Invalid IDs refused, one active job |
| `failed`, `interrupted`, `needs_review` | `storage.py` | Persistent sanitized journal; corrupted age archive not green V2 |

## BR-03 candidate-only error contract

| Candidate code | Source | Meaning |
|---|---|---|
| `R2_CONFIG_INVALID` | `r2.py:105–131` | Invalid field names/account ID/bucket/credential shapes |
| `R2_NOT_CONFIGURED` | `r2.py:182–190,210–232` | Test/upload requires prior saved config |
| `R2_CONNECTION_FAILED` | `r2.py:133–162,193–208` | S3 auth/network/test/list refused; no false success |
| `R2_PROBE_UNVERIFIED`, `R2_PROBE_CLEANUP_FAILED` | `r2.py:133–162` | Probe content or remote cleanup not proven |
| `R2_REMOTE_OBJECT_CONFLICT`, `R2_REMOTE_OBJECT_UNVERIFIED` | `r2.py:210–273` | Never overwrite mismatched immutable key; re-read content digest |
| `R2_UPLOAD_FAILED`, `R2_LOCAL_ARCHIVE_UNAVAILABLE` | `r2.py:210–273` | Local file missing or upload/remote verify failed; local backup is retained |
| `R2_BACKUP_NOT_V2_VERIFIED` | `agent.py:143–164`, `r2.py:210–217` | Reject V1/tampered/needs-review as upload source |
| `SCHEDULE_INVALID` | `scheduler.py:23–56` | Only UTC 6/12/24h, booleans, retention 0/7/14/30/60/90/180/365, min local 3–30 |
| `R2_NOT_CONFIGURED` during schedule | `scheduler.py:60–71` | Cannot enable configured auto upload with no R2 |
| `BACKUP_AGENT_EXECUTION_FAILED` | `agent.py:84–108` | Sanitized generic error for unexpected host exception |

**Limits / missing:** No explicit persisted backoff or retry-exhausted state; no durable pending upload on agent death between local-success and auto enqueue; no page-continuation error; no proven R2 real credentials handling on VPS. New proposals are **not implemented**, including `R2_RETRY_EXHAUSTED`, `R2_PENDING_UPLOAD_RECONCILE`, `R2_PROBE_ORPHAN_POSSIBLE`, `R2_PAGE_TRUNCATED` and all future `RESTORE_*`. Do not claim them working without code+tests.

**Security policy:** Never put credential values, presigned URLs, full S3 exception messages, raw SMTP/mail body, local plaintext host config, identity keys or contents of backups into app logs. Fail closed and show a generic UI message on unmapped errors; do not leak internal paths.
