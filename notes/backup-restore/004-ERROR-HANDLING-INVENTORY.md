# BR-004 — Error-Handling Inventory and Planned Failure Contract

**Evidence baseline:** `0e8a19e583719e56c054406581bedcf5599f1ace`. Status columns separate **EXISTS in repository** from **TO ADD**; nothing in TO ADD currently works.

## Actual existing error handling

| Code path | Source lines | What it currently handles | Limit / caution |
|---|---|---|---|
| `src/core/auth/route-access-policy.ts` | 13–20 | unauthed redirects/not-found admin denial | No restore-specific superuser action or re-auth gate |
| `src/app/api/vcon/update/start/route.ts` | 8–24,52–68 | admin check, bad JSON, safe HTTP response | Update-specific only; backup API must independently enforce authorization |
| `src/core/audit/record.ts` | 14–40,130–191 | redact sensitive fields, record audit and log persistence errors | DB restore can rewrite DB audit log; separate host journal needed |
| `src/core/server/logger.ts` | 13–48 | key-based structured log redaction | Unstructured stdout/stderr must never be exposed raw |
| `deployment/operations/compose_recovery.py` | 31–39,41–75 | fail closed for subprocess, missing/symlink, malformed tar entries | Does not prove live R2 or host restore |
| same | 213–250 | version/project/UID/checksum/archive/PGDMP guard | GPG legacy archive incompatible; not full secret/config backup |
| same | 307–336,354–376 | encrypted pre-restore rollback, explicit flags, bounded error report | Rollback is best-effort; a critical partial failure is possible |
| `scripts/install/readbox-update.sh` | 15–25,35–51,58–68 | permission, Git fast-forward, encrypted pre-update snapshot, build failure | No shared lock with future backup agent |
| `src/core/updates/service.ts` | 441–489 | blocks managed Docker UI updater safely | Do not bypass by piggybacking backup actions |
| `src/components/vcon/system-update-console.tsx` | 105–116,225–255 | client-side logs and poll error state | Not durable across web restart |

## Proposed Backup API error contract (NOT IMPLEMENTED)

All responses have opaque `requestId`/`jobId`, stable `code`, generic redacted `message` and unambiguous `state`; never include passwords, R2 secret keys, signed URLs, raw Docker stderr or message bodies.

| Code | When | UI result / response | Required safe behavior |
|---|---|---|---|
| `BACKUP_AGENT_UNAVAILABLE` | IPC down, host agent missing | 503, warning panel | Existing app unaffected; no fake job created |
| `BACKUP_FORBIDDEN` | non-admin or insufficient superuser | 403/404 per route policy | No sensitive existence leak; audit denial |
| `BACKUP_INPUT_INVALID` | malformed schedule/ID/prefix | 400 | Strict schema; no arbitrary shell/path |
| `BACKUP_DUPLICATE_JOB` | overlapping backup/restore/update | 409/423 | Persistent global lock, show running job |
| `BACKUP_NO_SPACE` | insufficient free space/permissions | 507/503 | No partial completion; clean staging only |
| `BACKUP_DB_DUMP_FAILED` | PostgreSQL unavailable/dump nonzero | job failed | No snapshot published; writer services restart |
| `BACKUP_VOLUME_ARCHIVE_FAILED` | maildir/file ACL or tar issue | job failed | Incomplete artifact quarantined; preserve data |
| `BACKUP_ARCHIVE_INVALID` | checksum/manifest/version mismatch | 422 | Fail before any restore mutation |
| `BACKUP_FORMAT_UNSUPPORTED` | old GPG/archive vs age v1 | 422, Legacy/Unsupported | Read-only inspect only until explicitly proven compatible |
| `BACKUP_ENCRYPTION_KEY_MISSING` | age identity/recipient inaccessible | 503/422 | Stop; do not create plaintext R2 upload |
| `R2_NOT_CONFIGURED` | missing R2 bucket or credentials | 409/503 | No upload; local backup remains |
| `R2_ACCESS_DENIED` | invalid/expired R2 key | 403 generic | Retain last safe config; never display raw key |
| `R2_CONNECTION_TIMEOUT` | network/DNS/TLS issue | 503 retryable | Bounded backoff; no uncontrolled retries |
| `R2_UPLOAD_PARTIAL` | upload interrupted/checksum mismatch | failed/retryable | Resume safely or cleanup only owned temp object |
| `R2_OBJECT_UNVERIFIED` | remote checksum unverified | warning, not verified | Do not qualify for automated deletion/restore |
| `SCHEDULE_INVALID` | invalid interval/timezone or DST | 400 | Preserve previous schedule; default disabled |
| `RESTORE_PREFLIGHT_BLOCKED` | wrong source/target, no rollback, insufficient space | 409/422 | **No live mutation** |
| `RESTORE_CONFIRMATION_REQUIRED` | absent superuser fresh confirmation | 403/409 | No restore submitted |
| `RESTORE_MAINTENANCE_FAILED` | cannot stop all writers | critical blocked | Fail closed; restart previously running services |
| `RESTORE_APPLY_FAILED` | DB/volume apply error | failed; rollback attempt | Audit stage/recovery journal; no fake PASS |
| `RESTORE_ROLLBACK_FAILED` | rollback itself fails | CRITICAL / operator intervention | Keep recovery artifact, halt normal success label |
| `BACKUP_JOB_INTERRUPTED` | agent/service restart | interrupted/recovering | Durable persisted state reconciled on startup |

## Global policies

- Status checks and log retrieval must be authenticated, rate limited, paginated, `no-store`, bounded to owned/authorized job IDs; poll with backoff, no unbounded requests.
- Secrets redacted in server **and** host agent logs. UI log copy exactly matches sanitized server payload, with line and byte limits; no raw subprocess stderr.
- Error detail cannot expose bucket credentials, encryption identity, absolute privileged paths, email content, tokens or a private backup archive.
- Do not use automatic retries for production restore. Scheduler may retry uploads on safe idempotent object keys only.
- Restore timeouts, cancellation and web disconnection are not considered success. Actual status is from host agent's durable journal.
- New error codes/tests must be added to this file when implemented, **not** reported as existing until real CI proof and tested path exist.
