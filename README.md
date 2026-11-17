# ReadBox

<div align="center">

# 📬 ReadBox
### Modern Self-Hosted Email Workspace & Mail Server Management Platform

**Practical software for real workflows. Deploy. Connect. Scale.**

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Organization](https://img.shields.io/badge/Maintained%20by-Vib%20Tools-6366f1.svg)](https://vib.tools/)
[![GitHub](https://img.shields.io/badge/GitHub-vibtoolshq%2Freadbox-181717.svg?logo=github)](https://github.com/vibtoolshq)
[![Framework](https://img.shields.io/badge/Framework-Next.js%2015%20App%20Router-black.svg?logo=next.js)](https://nextjs.org)
[![Runtime](https://img.shields.io/badge/Runtime-Node.js%2022%20LTS-339933.svg?logo=node.js)](https://nodejs.org)
[![Database](https://img.shields.io/badge/Database-PostgreSQL%2016-336791.svg?logo=postgresql)](https://www.postgresql.org)
[![ORM](https://img.shields.io/badge/ORM-Prisma%207-2D3748.svg?logo=prisma)](https://www.prisma.io)
[![Docker](https://img.shields.io/badge/Deployment-Docker%20Compose%20%7C%20Coolify-2496ED.svg?logo=docker)](https://coolify.io)
[![TypeScript](https://img.shields.io/badge/TypeScript-Strict%20Typechecked-3178C6.svg?logo=typescript)](https://www.typescriptlang.org)
[![Tests](https://img.shields.io/badge/Tests-70%20UI%20%2B%20Unit%20Passing-brightgreen.svg)]()

<p align="center">
  <a href="#-highlights--why-readbox">Highlights</a> •
  <a href="#-a-to-z-complete-feature-catalog">A-Z Features</a> •
  <a href="#-system-architecture">Architecture</a> •
  <a href="#-quick-start-with-docker-compose">Quick Start</a> •
  <a href="#-coolify-deployment-guide">Coolify Guide</a> •
  <a href="#-environment-configuration">Configuration</a> •
  <a href="#-security-and-defense-in-depth">Security</a> •
  <a href="#-author--company-profile">Author & Company</a> •
  <a href="#-license">License</a>
</p>

</div>

---

## 🔍 SEO & Semantic Search Meta

> **Keywords:** `self-hosted webmail`, `open source mail server web client`, `postfix dovecot webmail`, `maildir web interface`, `docker email server webmail`, `coolify mail server webmail`, `private business email server`, `sandboxed email reader xss protection`, `spf dkim dmarc dns generator`, `nextjs webmail`, `vib tools`.  
> **Description:** ReadBox is a fast, secure, privacy-first open-source webmail interface and mail server management platform by Vib Tools. Built on Next.js 15, PostgreSQL 16, and Tailwind CSS with sandboxed HTML email rendering, Maildir ingestion, and automated SPF/DKIM/DMARC deliverability verification.

---

## 🌟 Highlights & Why ReadBox?

Legacy webmail solutions (like Roundcube, SquirrelMail, or Horde) were built for a different era—they can be heavy, difficult to maintain, and vulnerable to cross-site scripting (XSS) and remote tracking beacons.

**ReadBox** bridges the gap between modern web engineering and reliable UNIX mail standards:

- **100% Data Ownership & Privacy:** Your emails, contacts, and metadata live entirely on your own PostgreSQL database and Maildir storage. Zero telemetry, zero external tracking, and zero advertising.
- **Sandboxed Email Reader:** Complete protection against malicious email payloads. Emails render in an isolated, script-restricted iframe with strict Content Security Policy (`default-src 'none'; img-src data: 'self'`).
- **Standard Maildir & Postfix/Dovecot Compatibility:** Natively reads standard RFC 822 / RFC 5322 Maildir directories (`new/`, `cur/`) written by Postfix, Dovecot, or LMTP delivery agents.
- **Automated Deliverability & DNS Engine:** Live DNS checking for MX and A/AAAA records with automated generation of SPF, DKIM, and DMARC zone files to guarantee high outbound deliverability and protect domain reputation.
- **Single PostgreSQL Database Architecture:** Authoritative relational schema for users, credentials, virtual domains, mailboxes, messages, public inquiries, and audit logs managed cleanly through Prisma ORM.
- **Container-First Orchestration:** Built for modern DevOps workflows with first-class Docker Compose and Coolify one-click deployment, featuring isolated web and continuous background worker containers.

---

## 📋 A-to-Z Complete Feature Catalog

### [A] — Account Management & Authentication
- **Argon2id Key Derivation:** State-of-the-art password hashing for user accounts and administrative operators.
- **Session Registry & Instant Revocation:** View all active web sessions with IP/device metadata and revoke compromised sessions with a single click.
- **Brute-Force Protection:** IP and username lockout thresholds prevent credential-stuffing attacks.
- **Atomic Password Resets:** Durable, single-use reset tokens stored securely in PostgreSQL.

### [B] — Background Ingestion Worker (`scripts/mail/ingest.ts`)
- **Continuous Maildir Scanner:** High-performance filesystem polling worker monitoring `new/` and `cur/` folders.
- **Streaming MIME Extraction:** Fast message parsing via `postal-mime` extracting headers, plain text, and HTML.
- **SHA-256 Attachment Deduplication:** Content-addressed attachment extraction preventing duplicate disk usage.
- **Heartbeat Telemetry:** Records periodic operational heartbeats to `ServiceHeartbeat` to inform `/health/ready`.

### [C] — Contact Inquiries Console (`/vcon/inquiries`)
- **Centralized Inbound Portal:** Review, triage, and inspect messages submitted through the public `/contact` form.
- **Topic Classification & Search:** Instant filtering across inquiries (Support, Account, Business, General) with full-text search.
- **Metadata Inspector & Fast Copy:** View sender details, IP hashes, timestamps, and copy contact details or request IDs with one click.

### [D] — Domain & DNS Deliverability Management
- **Multi-Domain Support:** Add and govern multiple private or corporate email domains from one dashboard.
- **Live DNS Status Probes:** Instant verification of MX records and target mail server A/AAAA address resolution.
- **Automated DNS Zone Generator:** Automatically generates standard DNS records:
  - `MX` (Mail Exchanger priority records)
  - `SPF` (Sender Policy Framework TXT records)
  - `DKIM` (DomainKeys Identified Mail public key records)
  - `DMARC` (Domain-based Message Authentication, Reporting & Conformance policy)

### [E] — Email Viewing with Zero-Trust Isolation
- **Isolated `<iframe sandbox>` Reader:** Prevents malicious HTML emails from executing JavaScript, submitting forms, or accessing the host DOM.
- **Strict Content Security Policy (CSP):** Blocks external tracking pixels and remote image beacons while allowing inline `cid:` attachment images.
- **Dynamic Auto-Height Resizing:** Seamless reading experience using modern `ResizeObserver` without inner scrollbars.
- **Error & Timeout Resilience:** Automatic detection of malformed payloads with a dedicated **Retry** button and safe plain-text fallback.

### [F] — Fail-Closed Database Architecture
- **Zero Mock Data in Production:** Production environments fail closed with explicit exceptions if PostgreSQL is unreachable.
- **Route Error Recovery Boundaries (`error.tsx`):** Dedicated, accessible error recovery panels throughout user and admin routes.
- **Single Source of Truth:** Strictly enforces a single PostgreSQL database across all application and mailserver schemas.

### [G] — Governance & Storage Policies
- **User Control Settings:** Global defaults for mailbox quotas, creation permissions, and message retention rules.
- **Dynamic Policy Inheritance:** User accounts dynamically inherit global policies while allowing granular per-user overrides.
- **Disk Path Confinement:** Strict directory boundary enforcement preventing path traversal attacks (`../`).

### [H] — Health Gates & Monitoring
- **Readiness Probes (`/health/ready`):** Returns HTTP 200 only when database connectivity and the ingestion worker are healthy; returns HTTP 503 if the worker is degraded or stale.
- **Liveness Probes (`/health/live`):** Lightweight probe for container orchestrator liveness checks.

### [I] — Inbound RFC 822 / 5322 Ingestion
- **Standard Maildir Structure:** ReadBox reads standard email files directly from `/var/vmail/<domain>/<mailbox>`.
- **Read-Only Source Integrity:** Routine ingestion never alters, renames, or deletes the original Maildir source files.

### [L] — Live Updates & Notifications
- **Real-Time Polling (`/api/messages/live`):** Efficient lightweight polling cursor alerting users to new mail without refreshing.
- **Browser Notification Support:** Opt-in desktop notifications for incoming messages.

### [M] — Mailbox Governance & Provisioning
- **Address Validation:** Enforces RFC-compliant local-part syntax and case-insensitive uniqueness.
- **Virtual Mail Server Synchronization:** Coordinates mailbox state with PostgreSQL virtual tables for Postfix and Dovecot.
- **Storage Thresholds:** Real-time quota monitoring and mailbox usage statistics.

### [O] — Operational Maintenance Console (`/vcon/operations`)
- **On-Demand Maildir Indexing:** Trigger manual mailbox scans or re-index unindexed messages.
- **Counter Recalculations:** Atomic recalculation of unread, total, and last-received message counts.
- **Hash-Verified Body Repairs:** Safe message body reconstruction from authoritative source Maildir files.
- **Scheduled Retention Purges:** Run live or dry-run retention purges in safe, bounded 500-row database transactions.

### [P] — Progressive Web App & Accessibility
- **PWA Ready:** Dynamic `manifest.webmanifest` with custom brand icon generation and offline shell caching.
- **Mobile Responsive Design:** Flawless rendering from 320px mobile viewports to 4K desktop screens.
- **Accessible & High-Contrast:** Full keyboard navigation, ARIA labels, contrast-compliant light and dark themes, and `prefers-reduced-motion` compliance.

### [R] — Retention Lifecycle Engine
- **Automated Purge Cycles:** Bounded batch purges automatically remove messages exceeding mailbox or user retention limits.
- **Per-Mailbox Exception Isolation:** Failures in one mailbox do not halt retention processing for others.

### [S] — System Updates & Orchestrator Detection (`/vcon/system-update`)
- **Container Orchestrator Detection:** Automatically detects Docker Compose or Coolify environments.
- **Preflight Verification Checklist:** Validates runtime environment, database connectivity, and deployment status.

### [T] — Tamper-Evident Audit Trails (`/vcon/audit`)
- **Immutable Audit Logging:** Captures administrative actions, mailbox creation, security changes, and authentication events.
- **Automated Sensitive Redaction:** Passwords, tokens, cookies, and secret keys are stripped before writing to disk.

### [U] — User Webmail Workspace (`/users`)
- **Responsive Webmail Interface:** Rapid inbox filtering, sender badges, date grouping, unread counters, and search.
- **Attachment Streaming:** Direct streaming download of attachments with safe `Content-Disposition` and `nosniff` headers.

---

## 🏗️ System Architecture

```text
┌─────────────────────────────────────────────────────────────────────────┐
│                      INBOUND INTERNET SMTP (Port 25)                    │
└────────────────────────────────────┬────────────────────────────────────┘
                                     │
                                     ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                    POSTFIX MTA + DOVECOT LMTP AGENT                     │
│  - Recipient verification via PostgreSQL virtual views                  │
│  - Delivers raw MIME messages to canonical Maildir storage              │
└────────────────────────────────────┬────────────────────────────────────┘
                                     │
                                     ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                   AUTHORITATIVE MAILDIR FILESYSTEM                      │
│            /var/vmail/<domain>/<local-part>/{new, cur, tmp}             │
└─────────────────┬─────────────────────────────────────┬─────────────────┘
                  │                                     │
                  │ Reads (Read-Only)                   │ Reads (Confined)
                  ▼                                     ▼
┌───────────────────────────────────┐ ┌───────────────────────────────────┐
│     READBOX BACKGROUND WORKER     │ │   READBOX NEXT.JS 15 WEB APP      │
│     (scripts/mail/ingest.ts)      │ │   (App Router + RSC + Actions)    │
│  - Continuous incremental scan    │ │  - User Webmail Workspace (/users)│
│  - MIME parse via postal-mime     │ │  - Sandboxed Reader (<iframe CSP>)│
│  - SHA-256 attachment extractor   │ │  - Admin Control Console (/vcon)  │
│  - Scheduled retention purge      │ │  - Inquiries Console (/inquiries) │
│  - Heartbeat status to PostgreSQL │ │  - Readiness Gate (/health/ready) │
└─────────────────┬─────────────────┘ └─────────────────┬─────────────────┘
                  │                                     │
                  │ Writes Metadata & Extracted Files   │ Queries & Governs
                  ▼                                     ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                       POSTGRESQL 16 DATABASE (PRISMA)                   │
│   - Application Users, Credentials (Argon2id), AppSession & Tokens      │
│   - Virtual Domains, Mailboxes, Aliases & Mailserver Tables             │
│   - Message Index, Attachment Records, Inbound Inquiries & Audit Logs   │
│   - ServiceHeartbeat & Global User Governance Settings                  │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 🚀 Quick Start with Docker Compose

The fastest way to deploy ReadBox in production:

### 1. Clone the Repository
```bash
git clone https://github.com/vibtoolshq/readbox.git
cd readbox
```

### 2. Configure Environment
```bash
cp .env.example .env
```
Edit `.env` to define your domain, PostgreSQL password, and security secrets:
```dotenv
DATABASE_URL="postgresql://readbox_app:StrongPassword123@db:5432/readbox?schema=public"
NEXTAUTH_SECRET="your-32-char-random-secret-key-here"
MAIL_DOMAIN="yourdomain.com"
APP_HOSTNAME="mail.yourdomain.com"
```

### 3. Launch Services
```bash
docker compose up -d
```

### 4. Verify Services
Check running containers:
```bash
docker compose ps
```
The compose stack launches three isolated services:
1. **`app`**: The Next.js 15 production web application (`http://localhost:3000`).
2. **`worker`**: The continuous Maildir ingestion and scheduled retention worker.
3. **`db`**: PostgreSQL 16 database with persistent storage volumes.

---

## 📦 Coolify Deployment Guide

ReadBox is optimized for seamless one-click orchestration on [Coolify](https://coolify.io):

1. **Create Application:** In your Coolify dashboard, select **New Resource** → **Docker Compose Application**.
2. **Repository Source:** Connect the Git repository `https://github.com/vibtoolshq/readbox.git` (or your private fork).
3. **Environment Variables:** Populate environment variables from `.env.example`.
4. **Deploy:** Click **Deploy**. Coolify builds the multi-stage production Docker image and runs both the web application and background worker with shared volume mounts.
5. **System Updates:** The `/vcon/system-update` console automatically detects Coolify orchestration and displays container status.

---

## 💻 Local Development Setup

### Prerequisites
- **Node.js:** `>= 22.12.0 LTS`
- **npm:** `>= 10`
- **Docker:** (Optional, for running local PostgreSQL)

### Setup Steps

```bash
# 1. Install dependencies
npm install

# 2. Configure local environment
cp .env.example .env.local

# 3. Start local PostgreSQL
docker compose up -d postgres

# 4. Generate Prisma client & apply migrations
npm run db:migrate

# 5. Start the development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## ⚙️ Environment Configuration

| Variable | Type | Default | Description |
| :--- | :---: | :--- | :--- |
| `DATABASE_URL` | String | *Required in Prod* | PostgreSQL connection string (`postgresql://user:pass@host:5432/db`). |
| `NEXTAUTH_SECRET` | String | *Auto/Required* | 32+ character random secret for JWT and session signing. |
| `NEXTAUTH_URL` | URL | `http://localhost:3000` | Canonical URL of the application. |
| `NODE_ENV` | String | `development` | Set to `production` for strict fail-closed database mode. |
| `DEV_AUTH_MODE` | String | `standard` | Set to `demo` in development only to enable test preview credentials. |
| `MAIL_DOMAIN` | String | `readbox.local` | Default primary mail domain name. |
| `MAIL_HOSTNAME` | String | `mail.readbox.local` | Mail server FQDN used for MX and DNS deliverability checks. |
| `APP_HOSTNAME` | String | `app.readbox.local` | Application web hostname. |
| `SERVER_IP` | IP | `""` | Public IPv4 address for DNS deliverability checks. |
| `VMAIL_ROOT` | Path | `/var/vmail` | Filesystem root where Maildir folders reside. |
| `ATTACHMENTS_ROOT` | Path | `/var/vmail/attachments` | Storage directory for extracted email attachments. |
| `REQUIRE_INGESTION_READY`| Boolean| `false` | When `true`, `/health/ready` requires an active worker heartbeat. |
| `USE_X_ACCEL_REDIRECT` | Boolean| `false` | Enable Nginx `X-Accel-Redirect` for high-performance attachment downloads. |
| `CONTACT_SECRET_KEY` | String | *Optional* | Optional secret key for CSRF token signature verification. |

---

## 🧪 Testing & Verification Suite

ReadBox enforces rigorous automated testing across database schemas, API routes, and UI components:

```bash
# Validate Prisma schema configuration against PostgreSQL policies
npm run db:validate

# Run TypeScript strict typecheck
npm run typecheck

# Run ESLint code quality checks
npm run lint

# Run backend unit test suites (auth, admin, messages, ingestion, DNS)
npm run test:unit

# Run full UI component test suite (Vitest + React Testing Library)
npm run test:ui

# Verify production build compilation
npm run build
```

---

## 🛡️ Security and Defense-in-Depth

ReadBox adheres to the **Vib Tools** core security principles:

1. **Zero Script Execution in Email Reader:** Incoming emails are stripped of `<script>`, `<iframe>`, `<object>`, and form tags before being isolated inside a sandboxed iframe with strict Content Security Policy.
2. **Fail-Closed Design:** In production, any database disconnect or configuration error immediately fails closed to prevent unauthenticated data leaks.
3. **Durable CSRF & Abuse Prevention:** Inbound contact forms enforce single-use cryptographic CSRF tokens stored in PostgreSQL with IP rate-limiting to prevent automated spam.
4. **Strict Confinement:** All file access on disk is validated against canonical root paths to eliminate directory traversal risks.
5. **No Telemetry / No Surveillance:** ReadBox does not embed third-party analytics scripts, Google Fonts, or external CDNs. All assets are self-contained.

---

## 🏢 Author & Company Profile

**ReadBox** is an open-source project designed, built, and maintained by **[Vib Tools](https://vib.tools/)**.

### About Vib Tools
> **"Practical software for real workflows. Build useful tools. Share them openly."**

Vib Tools is an open-source software organization based in Bangladesh that builds practical desktop software, self-hosted services, automation tooling, and developer utilities designed for real-world workflows without unnecessary platform complexity.

### Verified Contact Details

- **Official Website:** [https://vib.tools/](https://vib.tools/)
- **GitHub Organization:** [https://github.com/vibtoolshq](https://github.com/vibtoolshq)
- **GitLab Organization:** [https://gitlab.com/vibtools](https://gitlab.com/vibtools)
- **General & Partnerships:** [hello@vibtools.io](mailto:hello@vibtools.io)
- **Technical & Product Support:** [support@vibtools.io](mailto:support@vibtools.io)
- **Phone / WhatsApp:** `+880 1795-470603` (GMT+6 / Asia-Dhaka)
- **Head Office:**  
  Vib Tools HQ  
  5660 Kochakata, Nageswari  
  Kurigram, Rangpur  
  Bangladesh

### Social & Community Profiles
- **X / Twitter:** [@vibtools](https://x.com/vibtools)
- **Facebook:** [vib.tools](https://www.facebook.com/vib.tools)
- **Instagram:** [@vib.tools](https://www.instagram.com/vib.tools/)
- **Reddit:** [u/VibTools](https://www.reddit.com/user/VibTools/)
- **TikTok:** [@vibtools](https://www.tiktok.com/@vibtools)

---

## 🤝 Community & Support

- **Bug Reports & Issues:** [GitHub Issues](https://github.com/vibtoolshq/readbox/issues)
- **Discussions & Feedback:** [GitHub Discussions](https://github.com/vibtoolshq/readbox/discussions)
- **Contribution Guidelines:** [CONTRIBUTING.md](CONTRIBUTING.md)
- **Support Guidelines:** [SUPPORT.md](SUPPORT.md)
- **Code of Conduct:** [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md)
- **Security Vulnerability Reporting:** [SECURITY.md](SECURITY.md)

---

## 📄 License

ReadBox is free open-source software licensed under the **[MIT License](LICENSE)**.  
Copyright © 2026 **[Vib Tools](https://vib.tools/)** and ReadBox Contributors.
