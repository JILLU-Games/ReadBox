# Core Module Architecture

> **Authoritative Database Policy:** ReadBox uses exactly one PostgreSQL database for all application and database-backed mail-server management data. Prisma remains the application ORM. Maildir and message/attachment files remain on the filesystem.

The `src/core` directory contains the domain logic, services, and infrastructure adapters that power the ReadBox web application, administrative console, and background processing tasks.

## Core Modules Overview

| Module | Primary Responsibility | Key Files & Services |
| :--- | :--- | :--- |
| **`accounts/`** | User account management, security snapshots, access policy inheritance, and operator profiles. | `user-profile.ts`, `user-control-policy.ts` |
| **`audit/`** | Tamper-evident, redacted operational audit logging for administrative actions, auth attempts, and security events. | `queries.ts` |
| **`auth/`** | Credential authentication, Argon2id hashing, session registry, self-signup validation, and atomic password resets. | `credentials.ts`, `session-registry.ts`, `sign-up.ts`, `password-reset.ts` |
| **`contact/`** | Public contact inquiry processing, durable CSRF replay verification, and rate-limiting. | `service.ts` |
| **`database/`** | Prisma PostgreSQL client initialization with fail-closed production mode and typed database errors. | `client.ts` |
| **`dns/`** | Live DNS resolver, MX/A/AAAA verification checks, and automated SPF, DKIM, and DMARC zone record generation. | `resolver.ts` |
| **`domains/`** | Domain lifecycle, deliverability verification, and virtual mail mapping coordination. | `service.ts` |
| **`health/`** | System health snapshots and strict readiness gate (`/health/ready`) requiring active worker heartbeats. | `snapshot.ts` |
| **`ingestion/`** | RFC 822/5322 MIME email parsing, attachment extraction, size validation, and SHA-256 deduplication. | `parser.ts`, `attachments.ts`, `scanner.ts` |
| **`mailboxes/`** | Mailbox provisioning, address validation, storage quotas, and Maildir path confinement. | `service.ts`, `validators.ts`, `paths.ts` |
| **`mailserver/`** | PostgreSQL adapter syncing virtual domains, mailboxes, and aliases with Postfix and Dovecot. | `pg-adapter.ts` |
| **`messages/`** | Message queries, pagination, sandboxed HTML reader preparation, soft-deletion, and retention purge engine. | `service.ts` |
| **`operations/`** | Operational maintenance tools: Maildir sync, counter recalculations, SHA-256 body repairs, and retention purges. | `service.ts` |
| **`security/`** | Strict Content Security Policy (CSP), security headers, and path traversal protection. | `headers.ts` |
| **`server/`** | Structured JSON logging, safe error serialization, and runtime helpers. | `logger.ts` |
| **`settings/`** | Site branding, singleton configuration, public CORS headers, and media upload validation. | `service.ts` |
| **`setup/`** | System inspection, schema verification, and administrative bootstrap checks. | `trusted-operations.ts` |
| **`updates/`** | System update preflight checks, release asset verification, and container orchestrator detection. | `service.ts` |
