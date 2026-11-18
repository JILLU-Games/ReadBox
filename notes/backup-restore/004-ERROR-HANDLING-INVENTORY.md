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

## P-01 verified hardening / actual new error codes (source/CI 2026-11-18)

| Code/state | Source proof at `e3a3128` | Behavior and negative-case proof |
|---|---|---|
| `R2_RETRY_EXHAUSTED` | `deployment/backup-agent/r2.py:295–333` | Three transient network attempts maximum (short bounded 0.15s/0.45s backoff); 403 never retries; immutable conflict never overwritten; simulated partial failures exhausted ([CI](https://github.com/JILLU-Games/ReadBox/actions/runs/44210926362)) |
| `R2_PAGE_INVALID` | `r2.py:215–253` | Rejects missing/repeated/malformed continuation tokens, not silently returning partial remote objects |
| `R2_PAGE_LIMIT_REACHED` | `r2.py:215–255` | After up to 25 pages / MaxKeys100, refuses to claim remote list complete |
| `autoUpload`, `autoSourceJob` persisted | `storage.py:108–179`, `agent.py:163–184` | On restart reconciles verified archive from interrupted/completed source; one claimed attempt at a time; max 3 auto upload jobs and durable 30s/120s inter-job backoff |
| `R2_CONNECTION_FAILED` after lost probe ACK | `r2.py:152–183` | Ambiguous health PUT tries exact owned key DELETE; failed deletion becomes `R2_PROBE_CLEANUP_FAILED`, credential rotation fails closed |

**Not implemented:** named `R2_PENDING_UPLOAD_RECONCILE` is unnecessary as a public error because reconciliation is a private persisted workflow. Real host SDK provisioning/age key offsite custody, Cloudflare credentials permission testing, restore/rollback operator automation and all `RESTORE_*` remain OPEN / NOT RUN. No raw botocore errors, secret values or file paths exposed in returned error codes.

## P-02 host packaging error contract (source, not VPS-tested)

| Refusal / result code | Trigger in `scripts/install/readbox-backup-agent-install.sh` | Safety |
|---|---|---|
| `BR03_PYTHON_312_REQUIRED` | System Python not CPython 3.12 | Does not silently use unknown Python ABI |
| `BR03_HASH_LOCK_MISSING_OR_UNSAFE` / `BR03_LOCK_DIGEST_INVALID` | Missing/symlinked/unusable locked dependency inventory | No unpinned SDK installation |
| `BR03_RUNTIME_ROOT_UNSAFE`, `BR03_RUNTIME_POINTER_UNSAFE`, `BR03_EXISTING_RELEASE_UNTRUSTED` | Root-only ownership/mode, symlink or release identity mismatch | Refuse unknown runtime or symlink traversal |
| `BR03_CONCURRENT_INSTALL_REFUSED`, `BR03_LIVE_MAINTENANCE_REFUSED` | Root installer lock busy or global backup maintenance active | No live-backup restart race |
| `BR03_ACTIVE_JOB_OR_UNREADABLE_JOURNAL_REFUSED` | Journal queued/running or corrupt/untrusted JSON | Refuse service disruption while job exists |
| `EXISTING_SERVICE_DIFFERS_REVIEW_MANUALLY` | Installed service is neither exact BR-02 baseline unit nor approved P-02 unit | Never overwrite custom unit |
| `BR03_PYTHON_VENV_REQUIRED`, `BR03_HASH_LOCK_INSTALL_FAILED` | Missing Ubuntu venv support or resolved wheel mismatch/network failure | Stage never activated; previous runtime preserved |
| `BR03_RUNTIME_DEPENDENCY_CHECK_FAILED`, `BR03_RUNTIME_IMPORT_CHECK_FAILED` | Runtime dependency/import/ABI invalid | Reject before service activation |
| `BR03_AGENT_NOT_HEALTHY_ROLLING_BACK` | systemd service or Unix agent socket not healthy after restart | Attempt exact previous runtime/unit restore; record inability if rollback itself fails |
| `BR03_HOST_RUNTIME_HASH_VERIFIED_SERVICE_ACTIVE` | Installer completed runtime/unit activation and checks | Operational output only; not a claim from CI |

Never include decrypted credentials, pip index tokens, private age identity, raw mail content or subprocess stderr in operator-facing error codes. Root-only isolated interpreter does **not** make real Cloudflare API access or host-loss key recovery tested.


**P-02 CI:** [Single disposable regression #44215136163](https://github.com/JILLU-Games/ReadBox/actions/runs/44215136163) PASS; the installer refusal/error paths are source-audited and have not been runtime fault-injected on a host. Do not mark rollback operationally proven.

## BR-04 guarded restore error/refusal inventory (2026-11-18)

| Sanitized code/state | Exact implementation trigger |
|---|---|
| `RESTORE_OPERATOR_GATE_CLOSED` | No fixed root-owned 0600 `/etc/readbox-backup-restore.allow` with exact operator authorization; disposable project requires two explicit CI flags |
| `RESTORE_INPUT_INVALID`, `RESTORE_BACKUP_NOT_FOUND`, `RESTORE_BACKUP_NOT_VERIFIED` | Wrong type, unknown or non-V2 local age snapshot |
| `RESTORE_ARCHIVE_UNSAFE`, `RESTORE_ARCHIVE_UNAVAILABLE`, `RESTORE_PREFLIGHT_FAILED` | Symlink, wrong mode, missing file, wrong age identity, digest/manifest/project/mailserver metadata mismatch; no services stopped |
| `RESTORE_CONFIRMATION_REQUIRED`, `RESTORE_PERMIT_EXPIRED`, `RESTORE_PERMIT_LIMIT` | No exact `RESTORE <32hex>` phrase, wrong admin actor/token, expired or replayed single-use SHA256-stored permit, or too many outstanding permits |
| `RESTORE_SOURCE_CHANGED`, `RESTORE_ROLLBACK_EXISTS` | Archive changed after permit or rollback output exists; refuse overwrite/mutation |
| `RESTORE_FAILED_ROLLED_BACK` | R05 reported automatic rollback success after restore failure; original rollback age file retained |
| `RESTORE_ROLLBACK_CRITICAL`, `RESTORE_FAILED_REVIEW_ROLLBACK`, `RESTORE_TIMEOUT_OPERATOR_REVIEW` | Failed/unknown rollback or timeout: no false success; operator must review |
| `RESTORE_OPERATOR_REVIEW_REQUIRED` | Interrupted or critical restore journal record prevents future automatic/manual backups and restore jobs |
| `RESTORE_RESULT_UNVERIFIED`, `RESTORE_ENGINE_UNAVAILABLE` | Missing expected R05 success marker/rollback artifact or invocation failure |
| Sanitized job activity | No raw R05 stdout/stderr, private age key, filesystem path or mail content emitted to UI/log |

**Known limitation:** source-only test restore is a destructive-action-free preflight; it is not a stand-alone full isolated recovery. Full disposable R05 recovery is a CI test. Production remains default-deny and must never be assumed enabled.
