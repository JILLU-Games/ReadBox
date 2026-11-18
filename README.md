# ReadBox

> **QIS-01 quick-install onboarding (CI implementation only):** `bash scripts/install/readbox-install.sh` generates private database/auth/Postfix credentials and a one-time browser setup code, then starts PostgreSQL, web, worker and the private Postfix lookup role. An approved HTTPS proxy is required for `/initial-setup`; the installer does not publish SMTP, DNS or TLS. See [QIS-01 quick install and first admin](docs/QUICK-INSTALL-AND-FIRST-ADMIN.md).

> **Deployment / production status (2026-11-17): NO-GO until external staging acceptance.** R-01–R-05 were verified in disposable CI; public TCP/25, DNS/MX/PTR, trusted TLS, real SMTP→LMTP→ingestion→authenticated inbox, offsite recovery, license signoff and final production approval are **not** evidenced. The R-06 workflow runs only isolated tests and **never releases or deploys**. Read the [17-gate staging runbook](docs/PRODUCTION-ACCEPTANCE-RUNBOOK.md), [release governance](docs/RELEASE-GOVERNANCE.md) and [actual verification ledger](notes/006-VERIFICATION-AND-RELEASE-GATES.md) before following any production examples below. Run no live procedures without separate approval.

<div align="center">

# 📬 ReadBox
### Modern Self-Hosted Email Workspace & Mail Server Management Platform

**Practical software for real workflows. Deploy. Connect. Scale.**

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Organization](https://img.shields.io/badge/Maintained%20by-Vib%20Tools-6366f1.svg)](https://vib.tools/)
[![GitHub](https://img.shields.io/badge/GitHub-vibtoolshq%2Freadbox-181717.svg?logo=github)](https://github.com/vibtoolshq)
[![Framework](https://img.shields.io/badge/Framework-Next.js%2016%20App%20Router-black.svg?logo=next.js)](https://nextjs.org)
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
> **Description:** ReadBox is a fast, secure, privacy-first open-source webmail interface and mail server management platform by Vib Tools. Built on Next.js 16.4.5, PostgreSQL 16, and Tailwind CSS with sandboxed HTML email rendering, Maildir ingestion, and automated SPF/DKIM/DMARC deliverability verification.

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

**Scope:** This starts the ReadBox Next.js app, PostgreSQL 16 and Maildir ingestion worker. **It does NOT install or start Postfix/Dovecot and cannot receive Internet email by itself.** Full mailserver integration and public SMTP/DNS acceptance remain release blockers documented in [notes/001](notes/001-PRODUCTION-RELEASE-BLOCKERS.md). Production mailserver verdict: **NO-GO**.

### 1. Clone
```bash
git clone https://github.com/vibtoolshq/ReadBox.git
cd ReadBox
```

### 2. Configure secrets and hostnames
```bash
cp .env.example .env
# Generate TWO DIFFERENT secrets, for SERVICE_PASSWORD_DB and SERVICE_BASE64_64_SECRET:
openssl rand -hex 32
openssl rand -hex 48
```
Set the generated values in your private `.env`; keep them stable across restarts and never commit them. Set real `MAIL_DOMAIN`, `MAIL_HOSTNAME`, `APP_HOSTNAME` and `SERVER_IP` before DNS/SMTP integration. The Docker runtime derives the PostgreSQL URL and percent-encodes passwords safely, including `@`, `#` and `%`. For Docker deployment do not set a second `DATABASE_URL` in Compose; the example `DATABASE_URL=` is for standalone local tooling only.

### 3. Validate and launch the intended application stack
```bash
docker compose -f docker-compose.yml config --quiet
docker compose -f docker-compose.yml up -d --build
docker compose -f docker-compose.yml ps
```

The services are `postgres`, `web` and `worker`. Do not use the development-only `compose.dev.yaml` for production; its password is intentionally insecure. The web image validates its authorization secret (32+ characters) and PostgreSQL credential inputs before starting; failures do not log secrets. Configure a secure HTTPS reverse proxy separately and never assume `expose: 3000` publishes a mail SMTP listener.

### 4. Operator setup and real-mail limitations
The secure first administrator still requires the separate operator CLI `npm run auth:operator` in an appropriately configured runtime; production first-run operator orchestration is tracked for R-04. The application alone cannot receive mail: Postfix/Dovecot, SQL map access, Maildir permissions, public MX/PTR, inbound port 25 and TLS need separate integration and testing in R-02/R-03/R-06.

---

## 📦 Coolify Deployment Guide

1. Add `https://github.com/vibtoolshq/ReadBox.git` as a Docker Compose resource using **`docker-compose.yml`** (not `compose.dev.yaml`).
2. Configure persistent `SERVICE_PASSWORD_DB` and `SERVICE_BASE64_64_SECRET`. Coolify may generate these when its service-secret conventions apply; verify both are non-empty and `AUTH_SECRET` is 32+ chars. Standalone Compose does **not** auto-generate them.
3. Configure domain and public app reverse proxy in Coolify. The web is internal port 3000; `postgres` remains on the private Compose network.
4. Deploy the application containers and inspect web + worker logs. This is **application staging**, **not** completed inbound mailserver setup.
5. A working production inbound mailbox still requires a supported Postfix/Dovecot service, shared ownership-safe Maildir volume, SQL lookup network, DNS and an external mail acceptance test.

---

## 💻 Local Development Setup

### Prerequisites
- **Node.js:** `>= 22.12.0 LTS`
- **npm:** `>= 10`
- **Docker:** (Optional, for running local PostgreSQL)

### Setup Steps

```bash
# 1. Install exact locked dependencies
npm ci

# 2. Configure local environment
cp .env.example .env.local

# 3. Start local PostgreSQL (explicit development Compose)
docker compose -f compose.dev.yaml up -d postgres

# 4. Generate Prisma client & apply migrations
npm run db:migrate

# 5. Start the development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## ⚙️ Environment Configuration

| Variable | Required mode | Description |
|---|---|---|
| `SERVICE_PASSWORD_DB` | Standalone Compose / Coolify | Private PostgreSQL password, 24+ characters. Compose runtime URL-encodes arbitrary characters. |
| `SERVICE_BASE64_64_SECRET` | Standalone Compose / Coolify | Auth signature secret, at least 32 characters. Never commit or print. |
| `POSTGRES_USER` / `POSTGRES_DB` | Compose defaults `readbox` | Shared single PostgreSQL identity/database. |
| `DATABASE_URL` | Local non-container execution | Local tooling connection string; **not** used directly in production Compose. |
| `AUTH_SECRET` | Local non-container execution | Container maps `SERVICE_BASE64_64_SECRET` to `AUTH_SECRET`. |
| `AUTH_URL` / `PUBLIC_SITE_ORIGIN` | Optional / production proxy | Canonical application origin, HTTPS recommended. |
| `NODE_ENV` | Production auto-set | Always `production` in Docker; development-only demo auth remains disabled. |
| `MAIL_DOMAIN` / `MAIL_HOSTNAME` | Configure before real mail | Mailbox domain and server MX target, not SMTP installation. |
| `APP_HOSTNAME` / `SERVER_IP` | Configure before public DNS | Web domain and public IP for DNS display/verification. |
| `MAIL_STORAGE_ROOT` | Docker defaults `/var/vmail` | Persisted canonical Maildir source shared with a future delivery service. |
| `ATTACHMENT_STORAGE_ROOT` / `MEDIA_ROOT` | Container defaults | Persistent files, not another database. |
| `REQUIRE_INGESTION_READY` | Default `false` | R-04 will tighten live worker readiness; green liveness is not SMTP proof. |

The default `docker compose` detects `docker-compose.yml` because the development file is named `compose.dev.yaml`. Use explicit `-f` in all automated scripts to prevent future ambiguity. Never run real production restore/migrations with development data.

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
