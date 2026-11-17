# BR-006 — Backup Agent, Snapshot, R2 and Restore Safety Contract

**Architecture contract — BR-02 local encrypted backup/verify SOURCE + CI VERIFIED, BR-03 R2 and BR-04 restore NOT IMPLEMENTED.** Grounding: `docker-compose.yml:34–35,107–112,266–273`, `Dockerfile:105`, `deployment/operations/compose_recovery.py:24–28,99–128,151–163,166–210,213–279,282–336`, `src/core/auth/current-user.ts:114–118`, `scripts/install/readbox-update.sh:42–65`.

## Architecture and trust boundaries

`Browser → admin authenticated new Next.js Backup page/actions (UID 1001) → private limited Unix socket → host broker/agent with strict action allowlist → durable host job store → locked privileged worker → existing Docker Compose recovery/age + R2 adapter`.

- Unix socket exposed **only** to authorized Web UID/GID via a dedicated narrow mount; never mount Docker daemon socket or host root FS to Web. Agent request **types only**: `backup.create`, `backup.verify`, `backup.list`, `job.status`, `job.logs`, `r2.configure`, `r2.test`, `r2.upload`, `r2.list`, `schedule.update`, `restore.test`, `restore.production`. No command strings or user-selected filesystem paths.
- Agent must not trust requests from compromised Web; enforce fixed project root and Compose name, known volume names and static command argument arrays, scoped HMAC/request expiry/replay protection, peer permissions, input validation, bounded payloads, user/operator approval binding and audit. Root worker isolated behind a least-privilege broker.
- Durable atomic job journal and sanitized event logs outside application PostgreSQL and outside git tree; supports process restart, stateless UI refresh, unique job ID, monotonic state, locking and age-key custody. Host-side private state (proposed `/var/lib/readbox-backup`) mode 0700, logs and keys mode 0600. Distinct private backup destination (proposed `/var/backups/readbox-managed`), never overwritten.
- Restore that stops Web cannot depend on the original HTTP request to finish. UI may reconnect to poll persisted status after restart.

## Backup formats and data scope

**Canonical new snapshot:** R-05-compatible `age` encrypted bundle, with `postgres.dump`, `web.tar.gz` for Maildir/attachments/media, optional `queue.tar.gz`, `metadata.json` and `SHA256SUMS` (see source). Require source SHA/format version, project identity, DB identity, UID/GID, snapshot time, scope manifest, crypto identity reference and precise exclusions in **host-side metadata**. Do not silently change R-05 v1 accepted format; any extended version must have a separate validator and migration contract, preserving old support.

**Excluded from R-05 v1:** .env/credentials, external Caddy/TLS, PostgreSQL globals, Op enDKIM key recovery and whole-system bootstrap. A separate operator-controlled encrypted config/identity recovery track would be required before claiming full server DR. Inbound data backup ≠ complete bare-metal disaster recovery.

**Existing old VPS file:** GPG `.tar.gz.gpg` with different layout and plaintext secrets inside its encrypted payload; it is **legacy**, not age v1. Never pass it to `compose_recovery.py restore`. Read-only inventory/verify may be offered later. Legacy conversion/restoration requires separate isolated tests and independent authorization.

**Verification levels:** (V1) encrypted file exists + mode; (V2) authenticated decrypt and manifest/checksum/tar validation; (V3) isolated actual DB+volume restore and content/ownership comparisons; (V4) approved recovery drill + app/SMTP readiness. UI badges must show the attained level, not merely "verified" for V1.

## Privileged production restore state machine (BR-04)

`DRAFT → PREFLIGHT → AWAITING_FRESH_SUPERUSER_CONFIRMATION → QUEUED → LOCKED → PRE_RESTORE_ENCRYPTED_ROLLBACK_VERIFIED → WRITERS_QUIESCED → APPLY_DB → APPLY_VOLUMES → VALIDATE_AND_RESTART → SUCCEEDED`.

Failure branches: `BLOCKED` before mutation, `ROLLING_BACK` after mutation, `ROLLED_BACK` when proven, `CRITICAL_RECOVERY_REQUIRED` when rollback unverified. Record each step atomically before/after mutation. No retry on production restore; only one in flight across backup/restore/update. Stop previously-running services only; do not bring up services that were deliberately stopped.

Preflight: exact `project` / `db` / `UID 1001`, expected volume names, backup age/format, decrypt identity, checksums and archive allowlist, sufficient disk space for current+rollback, health, maintenance confirmation and concurrent update/backup lock. Reject symlink/absolute/`..`/hardlink/device content. Show data-loss window relative to snapshot UTC date. Before destructive apply, create an encrypted rollback; fail closed if rollback output cannot be verified. After restore: DB query and source schema validation, Maildir/attachments metadata+ACL check, Dovecot/Postfix health, Web/worker `/health/ready`, known inbox sample smoke, operator sign-off. On fatal partial state keep rollback and explicit recovery instructions. Never run CI restore against actual deployed volumes.

## Cloudflare R2 contract (BR-03)

- Config fields: *account ID*, *bucket*, *region/endpoint derived only from verified account ID*, *access key ID*, *secret access key*, optional fixed owned prefix. No freeform arbitrary endpoint to root worker; HTTPS only, TLS verification on.
- Credentials are submitted encrypted in transit, stored host-side encrypted with independently protected local master key, redacted after save (view **only** last4), rotatable/revocable. Key version and creation date allowed in history; never expose value or signed management URLs. Keep old working credentials until new connection test and atomic swap.
- Connection check tests authentication and explicitly needed list/read/write/delete capability on a unique owned temporary key; always attempt cleanup and show partial cleanup errors. Do not silently require broader bucket permissions.
- Upload **only** complete V2-verified encrypted blobs, immutable names scoped to a configured prefix; use content SHA-256 from local file and verify remote via stored metadata and optional streamed download digest. Do not treat multipart ETag as universal MD5. Mark R2 `uploaded` versus `remote_verified` separately.
- Auto-upload only after successful local snapshot and verify, with bounded retry, exponential backoff, idempotency key; no duplicate schedule jobs and no simultaneous restore.
- History includes object key (sanitized), source SHA, size, creation time, encryption format, status and verification result. Remote object listing is restricted to owned prefix; no arbitrary key download to live restore.
- Retention: default OFF; keep minimum proven recovery points locally and remotely. Never delete last verified backup, pre-restore rollback, in-flight upload or an unverified remote object. Remote deletion disabled in initial release unless separate approved destructive scope.
- User wants no manual WinSCP: R2 setup is optional; "local only" state is allowed with clear single-VPS-loss risk shown. R2 upload may be manual or scheduled after verified setup.

## Backup logs, UI and operational controls

Reuse existing `PageHeader`, `Panel`, `Badge`, `Table`, `Dialog`, `StatGrid`, `notify` from `src/components/vcon/operations-console.tsx:1–42`. Four sections: Overview/Backups, Schedule, R2 Storage and Activity. Visible action statuses `not configured`, `queued`, `running`, `verified`, `failed`, `blocked`, `interrupted`; do not label a UI-only mock "working". Log paging/copy must be sanitized, size-limited and tied to a specific authenticated job ID.

## Strong no-change boundary

ReadBox session/auth source, existing Prisma schema, all mailserver services and port25 configuration, Caddy, DNS, user inbox, message parsing, existing update UI and old CLI scripts unchanged. Minimal `docker-compose.yml` Web-only IPC mount in BR-02 and minimal maintenance lock in `scripts/install/readbox-update.sh` in BR-04 are the ONLY planned existing production infrastructure edits. Both require CI guards and a documented rollback plan. No new public port.

## BR-02 actual implemented boundary and verified deviations from roadmap design

- **Actual RPC actions:** `status`, `job.get`, `backup.create`, `backup.verify` only; no user-supplied path/command; other roadmap actions remain future-only. Signed timestamp/nonce HMAC protects Unix IPC; kernel peer UID restricted to 0/1001; fixed socket + group-only access; agent root execution is separate from Web UID1001. No Docker socket in Web; only `readbox_backup_ipc:/run/readbox-backup-agent:ro` mount.
- **Host side:** opt-in idempotent installer `scripts/install/readbox-backup-agent-install.sh` and restricted systemd unit are **source only**, not run on VPS. Production Compose project/root remain pinned; exact `readboxbr02-ci` + `READBOX_BR02_DISPOSABLE=1` is the sole fixture mode. Root journal `/var/lib/readbox-backup`, encrypted output `/var/backups/readbox-managed` and age identity in root-only mode are created only after separately approved installation.
- **Crypto / snapshot:** unchanged R-05 v1 package `postgres.dump`, `web.tar.gz`, optional `queue.tar.gz`, `metadata.json`, `SHA256SUMS`. Encrypted with `age`; verification decrypts to isolated temporary path, strictly checks format, project/DB/UID, content/checksum and archive types; no write to production during V2 verify. R-05 test restore/rollback is **CI-only** and not exposed from new agent.
- **Persistence:** atomically written per-job journal and backup metadata survive agent/Web restart; active jobs become interrupted on unclean restart; sanitized known event strings only; 30 latest jobs/backups returned, bounded by client response. Ciphertext corruption on reverify marks the backup `needs_review` rather than continuing to display V2.
- **Operational warning:** local snapshot is **not** full system/credential/SSL DR; age private identity must be safeguarded independently. No R2 offsite storage or schedules yet. Old VPS GPG bundle remains legacy, not age-compatible. Offline disposable CI success does not prove on-VPS installer behavior.
- **Security/acceptance evidence:** exact 18 approved code files changed (including only +3 Compose lines, no other service/port change); [BR-02 isolated CI PASS](https://github.com/JILLU-Games/ReadBox/actions/runs/44198139364) verified HMAC/replay, preserved journal, age V2, tamper downgrade and R-05 disposable recovery. No production mutation or new public ports.
