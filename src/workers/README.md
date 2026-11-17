# Background Ingestion & Maintenance Worker

> **Authoritative Database Policy:** ReadBox background workers connect to the single authoritative PostgreSQL database using Prisma. Maildir message files and attachments remain on the filesystem.

The `src/workers` directory contains the background processing logic responsible for continuous Maildir monitoring, MIME parsing, and scheduled message retention purges.

## Worker Responsibilities

1. **Continuous Maildir Ingestion:**
   - Scans Maildir source directories (`new/`, `cur/`) across active mailboxes.
   - Extracts MIME structure, headers, plain text, and HTML bodies via `postal-mime`.
   - Safely isolates attachments with SHA-256 deduplication and root path confinement.
   - Updates unread and total message counters atomically in PostgreSQL.

2. **Automated Message Retention Lifecycle:**
   - Evaluates mailbox and user retention policies (`autoDeleteDays`, `autoDeleteEnabled`).
   - Runs periodic batch purges in bounded 500-row chunks to prevent database lock contention.
   - Reports detailed purge statistics and isolates per-mailbox errors.

3. **Health & Heartbeat Monitoring:**
   - Writes periodic operational heartbeats to the `ServiceHeartbeat` table.
   - Sets status to `"ok"` during regular operation and `"degraded"` with structured error context on processing failures.
   - Directly informs the `/health/ready` endpoint for orchestration health probes.

## Execution Entry Points

- **CLI / Manual Ingestion Pass:**
  ```bash
  npm run mail:ingest
  ```

- **Continuous Watch Mode (Worker Loop):**
  ```bash
  node --conditions=react-server --import tsx scripts/mail/ingest.ts --watch --interval 15
  ```

- **Containerized Worker Service:**
  In Docker Compose and Coolify environments, the worker runs as a dedicated `readbox-worker` service alongside the main web application container, sharing persistent storage volumes for mail storage, attachments, media, and file locks.
