# ReadBox

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Framework](https://img.shields.io/badge/Framework-Next.js%2015-black.svg)](https://nextjs.org)
[![Runtime](https://img.shields.io/badge/Runtime-Node.js%2022%20LTS-green.svg)](https://nodejs.org)
[![Database](https://img.shields.io/badge/Database-PostgreSQL%2016-336791.svg)](https://www.postgresql.org)
[![ORM](https://img.shields.io/badge/ORM-Prisma-2D3748.svg)](https://www.prisma.io)
[![Docker](https://img.shields.io/badge/Docker-Compose%20%26%20Coolify-2496ED.svg)](https://www.docker.com)
[![TypeScript](https://img.shields.io/badge/TypeScript-Strict-blue.svg)](https://www.typescriptlang.org)

**ReadBox** is a modern, privacy-focused, self-hosted webmail interface and mail server management platform. Built with **Next.js 15 (App Router)**, **PostgreSQL**, and **Tailwind CSS**, ReadBox provides personal server operators, development teams, and independent organizations with an elegant, responsive, and secure communication hub for their own mail infrastructure.

---

## Highlights & Value Proposition

- **Private & Self-Hosted:** Maintain complete ownership of your email communications, contacts, and mailbox data without third-party surveillance or vendor lock-in.
- **Enterprise-Grade Webmail:** Fast inbox navigation, live notifications, full-text search, unread filters, and attachment previews.
- **Sandboxed Email Reader:** HTML emails render inside an isolated, script-restricted iframe with strict Content Security Policy (CSP), protecting users against cross-site scripting (XSS), tracking pixels, and CSS injection.
- **Automated Maildir Ingestion:** Native compatibility with RFC 822 / RFC 5322 Maildir directories produced by standard mail delivery agents (Postfix, Dovecot, LMTP).
- **Domain & DNS Deliverability Management:** Real-time DNS verification for MX, A, and AAAA records alongside automatic SPF, DKIM, and DMARC zone record generation to ensure outbound deliverability and protect domain reputation.
- **Centralized Admin Console (`/vcon`):** Complete governance over domains, mailboxes, storage quotas, message retention policies, public contact inquiries, and operational audit trails.
- **Production-Ready Containers:** First-class support for Docker Compose and Coolify with isolated web and continuous background worker services.
- **Single-Database Architecture:** Authoritative PostgreSQL schema for all application, mailbox, and mail-server lookup data, managed cleanly through Prisma.

---

## System Architecture

```text
Inbound Email (Postfix / Dovecot / LMTP)
  │
  ▼
Maildir Filesystem Storage (/var/vmail/<domain>/<mailbox>)
  │
  ├──► ReadBox Background Worker (scripts/mail/ingest.ts)
  │      ├─ Incremental MIME parsing & attachment extraction
  │      ├─ SHA-256 attachment deduplication
  │      ├─ Periodic retention lifecycle purges
  │      └─ ServiceHeartbeat status tracking
  │
  ▼
PostgreSQL 16 Database (Prisma ORM)
  ├─ User accounts, Argon2id credentials & sessions
  ├─ Mailbox records, aliases, and virtual mappings
  ├─ Message metadata & attachment references
  ├─ Contact submissions & immutable audit logs
  │
  ▼
ReadBox Next.js 15 Application (App Router + React Server Components)
  ├─ User Workspace (/users) — Responsive Webmail & Reader
  ├─ Admin Console (/vcon) — Operations, Domains, DNS, Inquiries
  ├─ Public Portal (/) — Landing page, Privacy & Contact form
  └─ Readiness Gates (/health/ready) — Dependency & worker health
```

---

## Core Features

### 1. User Webmail Workspace (`/users`)
- **Organized Inbox:** Clean view of incoming mail with sender avatar badges, date grouping, unread indicators, and instant search.
- **Isolated HTML Viewing:** Emails are rendered in a sandboxed `<iframe sandbox="allow-same-origin allow-popups">` with `Content-Security-Policy: default-src 'none'; img-src data: 'self'` preventing remote tracking and script execution.
- **Attachment Management:** Extracted attachments with size validation, MIME detection, and secure stream downloading.
- **Live Notifications:** Real-time inbox update alerts without page reloads.
- **Self-Service Preferences:** Password changes, active session revocation, and personal mailbox overviews.

### 2. Administrative Control Console (`/vcon`)
- **Domain Management:** Add, configure, and monitor domains with live DNS health checks and automated SPF/DKIM/DMARC record generation.
- **Mailbox Provisioning:** Assign mailboxes, set storage thresholds, assign user memberships, and define automated retention purge schedules.
- **Contact Inquiries Console (`/vcon/inquiries`):** Review, filter, and inspect inbound contact submissions from the public portal with search and metadata inspection.
- **Operational Maintenance (`/vcon/operations`):** Run manual Maildir scans, recalculate mailbox counters, verify database integrity, and run bounded retention purges.
- **System Updates & Health (`/vcon/system-update`):** Container-aware update detection and system status verification.
- **Audit Trails (`/vcon/audit`):** Tamper-evident, redacted logs capturing administrative changes, authentication events, and security lockouts.

---

## Quick Start (Docker Compose)

The recommended way to run ReadBox in production is with Docker Compose:

```bash
# 1. Clone the repository
git clone https://github.com/your-org/readbox.git
cd readbox

# 2. Configure environment variables
cp .env.example .env
# Edit .env with your PostgreSQL credentials, domain names, and secrets

# 3. Start the services
docker compose up -d

# 4. Access the web interface
# Open http://localhost:3000 in your browser
```

The Docker Compose configuration provisions:
- **`app`**: The Next.js 15 production server.
- **`worker`**: The continuous Maildir ingestion and retention worker.
- **`db`**: PostgreSQL 16 database with persistent storage volumes.

---

## Coolify Deployment

ReadBox is optimized for one-click deployment on [Coolify](https://coolify.io):

1. Add a new **Docker Compose** application in Coolify.
2. Connect your Git repository.
3. Configure the environment variables matching `.env.example`.
4. Deploy — Coolify will build the container image and automatically orchestrate both the web app and background worker services.
5. The `/vcon/system-update` console automatically detects the Coolify environment and displays container orchestrator status.

---

## Local Development Setup

### Prerequisites
- Node.js 22.12+ LTS
- npm 10+
- PostgreSQL 16 (optional locally; a Docker container can be used)

### Installation Steps

```bash
# Install dependencies
npm install

# Configure local environment
cp .env.example .env.local

# Start PostgreSQL service
docker compose up -d postgres

# Run database migrations
npm run db:migrate

# Start Next.js development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to view the application.

---

## Verification & Testing

ReadBox maintains a comprehensive test suite across unit, UI, integration, and security layers:

```bash
# Run unit test suite
npm run test:unit

# Run UI component and accessibility test suite
npm run test:ui

# Validate Prisma schema against database policies
npm run db:validate

# Typecheck TypeScript codebase
npm run typecheck

# Lint source files
npm run lint

# Production build verification
npm run build
```

---

## Security & Privacy Philosophy

ReadBox is designed with a defense-in-depth security model:

- **Argon2id Password Hashing:** State-of-the-art key derivation for user and administrative credentials.
- **Fail-Closed Architecture:** Production database connections fail closed—never falling back to unauthenticated mocks or unverified states.
- **CSRF & Rate-Limiting Protection:** Durable token replay protection and IP-throttled contact submissions backed by database records.
- **Path Confinement:** Strict directory confinement prevents directory traversal attacks when reading Maildir sources or attachments.
- **Auditing & Redaction:** Security events are recorded with sensitive credential fields automatically redacted.
- **No Third-Party Analytics:** ReadBox contains zero advertising, third-party analytics trackers, or external script dependencies.

---

## Contributing

We welcome contributions from the open-source community! Please see [CONTRIBUTING.md](CONTRIBUTING.md) for contribution guidelines, coding standards, and branch practices.

---

## Security Policy

For security vulnerability reports, please review our [Security Policy](SECURITY.md). We practice responsible disclosure and address verified issues promptly.

---

## License

ReadBox is open-source software licensed under the [MIT License](LICENSE).
