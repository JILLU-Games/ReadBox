# ReadBox Documentation

**Source-verified product and engineering documentation for ReadBox** — an inbound-only, custom-domain mailbox and team-inbox application. This documentation describes the active Next.js/PostgreSQL/Docker implementation rather than the retained legacy MailStack reference.

**Audited source baseline:** `vibtoolshq/ReadBox@488f565a21f4434ed5a066c5d46794637520ddec` (2026-11-20). This is a documentation-only successor of the operator-deployed executable baseline `9c3d99d4...`. No release tag or new deployment is implied by this documentation.

## Start here

| Reader | Recommended starting point |
|---|---|
| New user | [Getting started](users/getting-started.md), then [Mailboxes and inbox](users/features/mailboxes-and-inbox.md) |
| Administrator | [User workflows](users/workflows.md), [Domains and DNS](users/features/domains-and-dns.md), [Accounts and permissions](users/features/admin-and-accounts.md) |
| VPS operator | [Installation](users/installation.md), [Configuration](users/configuration.md), [Backup and recovery](users/features/backup-and-restore.md), [Operations and updates](users/features/operations-and-update.md) |
| Contributor | [Architecture](dev/architecture.md), [Codebase map](dev/codebase-structure.md), [Local setup](dev/local-setup.md), [Testing](dev/testing.md) |
| API / security reviewer | [API reference](dev/api-reference.md), [Database](dev/database-schema.md), [Security](dev/security.md), [Coverage report](reference/coverage-and-verification.md) |

## Documentation sections

**[Users and administrators](users/index.md)** — account setup, installation, inbox usage, domain configuration, administration, backups and troubleshooting.

**[Developers and operators](dev/index.md)** — system architecture, codebase, PostgreSQL, APIs, security, CI and safe deployment.

**[Reference material](reference/index.md)** — configuration keys, dependencies, source coverage, terminology and historical-document inventory.

The [documentation manifest](MANIFEST.md) records every new guide and the status of retained historical materials.

## Current feature and release status

The original R-01–R-06 source/CI implementation phases and MM-01 Manual Mode source implementation are completed. On the controlled VPS, the operator verified a clean executable checkout, six healthy Docker services, two external-account manual domains (`vibmail.my`, `pypal.pl`) with DNS routing verified and one inbound Gmail message received per mailbox. This is **Manual Mode basic inbound functional acceptance**, **not** proof of all provider, MIME, disaster-recovery or release gates.

**Full stable product release: NO-GO until remaining independent R-06 / RG-01..RG-17 gates are accepted.** Inbound-only means no outbound sending, authenticated SMTP submission, IMAP, POP3 or active DKIM signing.

## Source-of-truth rules

The actual `src/`, `prisma/`, `deployment/`, `scripts/` and `docker-compose.yml` code is authoritative. The `reference/MailStack/` tree is **historical** and contains AGPL-licensed reference materials; it is **not** the active runtime architecture. Older planning notes are preserved as dated snapshots and do not override current code.

Technical assertions cite code paths/symbols, and [coverage limitations](reference/coverage-and-verification.md) identify what remains unverified. Never place real secrets, recovery keys or customer message content in documentation.
