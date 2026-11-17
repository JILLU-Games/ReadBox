# Changelog

All notable changes to **ReadBox** will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [0.1.0] - 2026-11-16

### Added
- **Modern User Webmail Workspace (`/users`):**
  - Instant inbox filtering, sender badges, message search, and unread counters.
  - Sandboxed email reader `<iframe sandbox="allow-same-origin allow-popups">` with strict `Content-Security-Policy: default-src 'none'; img-src data: 'self'` preventing client-side script execution and tracking beacons.
  - Attachment preview, download streaming, and SHA-256 deduplication.
  - Real-time inbox update alerts without page reloads.
  - Account profile management, password updates, and session revocation.
- **Administrative Control Console (`/vcon`):**
  - **Domains & DNS Deliverability:** Domain lifecycle management, live MX and A/AAAA status checks, and automated SPF, DKIM, and DMARC zone file generators.
  - **Mailbox Governance:** Mailbox provisioning, storage thresholds, alias routing, and automated retention lifecycle configuration.
  - **Contact Inquiries Console (`/vcon/inquiries`):** Centralized dashboard for inbound public contact submissions with full-text search, topic filters, and detail modals.
  - **Operational Maintenance (`/vcon/operations`):** Manual Maildir indexing passes, counter recalculation, hash-verified body repairs, and on-demand retention purges.
  - **System Updates & Health (`/vcon/system-update`):** Container orchestrator detection (Docker Compose / Coolify) and preflight verification checks.
  - **Audit Logs (`/vcon/audit`):** Immutable, redacted security audit trails and authentication lockout monitors.
- **Background Maildir Ingestion Worker (`scripts/mail/ingest.ts`):**
  - Continuous incremental RFC 822/5322 MIME email parsing via `postal-mime`.
  - Automatic extraction and root-confined storage of attachments.
  - Automated hourly message retention lifecycle purges in bounded 500-row chunks.
  - `ServiceHeartbeat` operational tracking reporting to `/health/ready`.
- **Infrastructure & Deployment:**
  - Production `Dockerfile` with standalone Next.js server and background worker dependencies.
  - `docker-compose.yml` with web app, background ingestion worker, and PostgreSQL 16 services sharing persistent volumes.
  - Native Coolify one-click deployment support.
  - Single authoritative PostgreSQL database architecture managed via Prisma 7.
- **Security Hardening:**
  - Argon2id password hashing for user and administrative credentials.
  - Fail-closed database connection model in production.
  - Durable CSRF replay protection and database-backed rate-limiting.
  - Accessible route error recovery boundaries (`error.tsx`).
  - Open-source MIT License and responsible vulnerability disclosure policy.
