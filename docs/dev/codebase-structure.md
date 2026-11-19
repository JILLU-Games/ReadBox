---
title: "Active codebase map"
description: "Active ReadBox source-code structure and ownership boundaries versus historical MailStack reference."
order: 20
draft: false
---

The repository contains **active ReadBox source**, retained **historical reference/MailStack**, production scripts, tests and documentation. Do **not** treat archived Django/MariaDB code under `reference/` as the running implementation.

| Directory/file | Actual responsibility |
|---|---|
| `src/app/` | Next.js App Router public pages, user/admin route groups, server actions and API routes |
| `src/components/auth/` | Login, sign-up and reset forms |
| `src/components/users/` | Inbox, message reader, mailbox creation, live mail notifier, profile/settings |
| `src/components/vcon/` | Admin directory, domain/DNS, users, backup, operations, system update, settings |
| `src/components/ui/` | Shared accessible UI primitives, tables, dialogs, alerts and navigation |
| `src/core/accounts/` | Managed accounts, policy overrides, profile/session operations |
| `src/core/auth/` + `src/auth.ts` | Credentials validation, route guards, reset tokens, persistent sessions |
| `src/core/domains/` + `src/core/dns/` | Domain lifecycle, routing DNS, Cloudflare zone selection, DKIM/public record |
| `src/core/mailboxes/` + `src/core/mailserver/` | Mailbox provisioning, path confinement, PostgreSQL mailserver lookup contracts |
| `src/core/messages/` | User-scoped message listing/details, retention, safe HTML and downloads |
| `src/core/ingestion/` + `src/workers/ingestion.ts` | Maildir scanning, MIME parser, sanitizer, attachment storage, heartbeat |
| `src/core/backup/` + `deployment/backup-agent/` | HMAC Unix RPC, Agent job journal, encrypted archive, R2, schedule, guarded restore |
| `src/core/operations/` | Admin maintenance operations with validation and audit |
| `src/core/settings/`, `src/core/contact/`, `src/core/updates/` | Branding/contact, public inquiries, update policy/handoff |
| `src/core/setup/` | First-admin activation, setup authorization/lifecycle |
| `src/config/env-schema.ts` | Runtime Zod environment validation |
| `prisma/schema.prisma`, `prisma/migrations/` | Authoritative Prisma model and ordered PostgreSQL migrations |
| `docker-compose.yml`, `Dockerfile`, `entrypoint.sh` | Production container and profiles; web/worker migration/health behavior |
| `scripts/install/`, `deployment/operations/` | Standalone secure installer, host update, recovery helpers |
| `scripts/testing/`, `tests/`, `.github/workflows/` | Disposable verification harnesses and CI |
| `public/` | App icons, PWA service worker and public/static assets |
| `docs/`, `notes/` | Product guides, historical planning, evidence and release-gate records |
| `reference/MailStack/` | Historical/reference implementation **not** the active Next.js runtime |

## Dependency direction

Pages/actions call `src/core/` services; core accesses Prisma and file-service boundaries; mailserver and host agents run as separate processes. UI components must not gain a privileged Docker socket, raw R2 credentials or private DKIM keys.

Detailed entry points: [API reference](api-reference.md); [Architecture](architecture.md); [Source coverage](https://github.com/vibtoolshq/ReadBox/blob/main/docs/reference/coverage-and-verification.md).
