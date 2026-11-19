# ReadBox Documentation Manifest

**Documentation taxonomy and historical-source reconciliation.** The active guide suite is rooted at [index.md](index.md). All new guides are generated from the inspected active repository baseline `488f565a21f4434ed5a066c5d46794637520ddec`; historical notes preserve their own older frozen SHAs.

## Current user documentation

| Document | Purpose |
|---|---|
| [Users index](users/index.md) | All user/admin manuals |
| [Getting started](users/getting-started.md) | Roles, account access and first tasks |
| [Installation](users/installation.md) | Standalone Compose and one-time admin setup |
| [Configuration](users/configuration.md) | Safe deployment/environment settings |
| [Workflows](users/workflows.md) | Common verified UI task sequences |
| [Feature guide index](users/features/index.md) | Feature-focused reference navigation |
| [Domains and DNS](users/features/domains-and-dns.md) | Manual/automatic Cloudflare modes, DKIM and verification |
| [Mailboxes and inbox](users/features/mailboxes-and-inbox.md) | Mailboxes, message access, attachment safety |
| [Accounts and permissions](users/features/admin-and-accounts.md) | Administrator, users control, account/session policy |
| [Backups and restore](users/features/backup-and-restore.md) | Age, R2, UTC schedule and guarded recovery |
| [Operations and updates](users/features/operations-and-update.md) | Admin operational controls, health and safe update |
| [Public site and contact](users/features/public-site-and-contact.md) | Visitor pages, contact API and branding |
| [Troubleshooting](users/troubleshooting.md) | Safe symptom-to-check guidance |
| [FAQ](users/faq.md) | Capability boundaries and answers |

## Current developer and reference documentation

| Document | Purpose |
|---|---|
| [Developer index](dev/index.md) | Technical documentation navigation |
| [Architecture](dev/architecture.md) | Component and data flow diagrams |
| [Codebase map](dev/codebase-structure.md) | Active/legacy source boundary |
| [Local setup](dev/local-setup.md) | Verified script names and development prerequisites |
| [API reference](dev/api-reference.md) | Actual route handlers and server actions |
| [Database schema](dev/database-schema.md) | Eighteen Prisma models and PostgreSQL-only storage |
| [Security](dev/security.md) | Trust boundaries and residual risks |
| [Build and deployment](dev/building-packaging.md) | Docker, update and prerelease limitations |
| [Testing](dev/testing.md) | CI, tests and evidence classification |
| [Contributing](dev/contributing.md) | Scope lock and source/mirror policies |
| [Reference index](reference/index.md) | Detailed reference navigation |
| [Configuration reference](reference/configuration-reference.md) | Key names, defaults, source validators |
| [Dependencies](reference/dependencies.md) | Runtime, major libraries and services |
| [Glossary](reference/glossary.md) | Consistent terms and vocabulary |
| [Coverage and verification](reference/coverage-and-verification.md) | Audit scope, exclusions, unresolved claims |

## Retained specialized runbooks and evidence

The following **existing** documents remain for traceable, topic-specific contracts; the up-to-date navigation above takes precedence for current product behavior: [Domain automation](DOMAIN-AUTOMATION.md), [DKIM DNS](DKIM-DNS.md), [DKIM escrow](DKIM-ESCROW.md), [Admin system update](ADMIN-SYSTEM-UPDATE.md), [Quick install and first admin](QUICK-INSTALL-AND-FIRST-ADMIN.md), [Release governance](RELEASE-GOVERNANCE.md), [Production acceptance](PRODUCTION-ACCEPTANCE-RUNBOOK.md), [Third-party provenance](THIRD-PARTY-PROVENANCE.md) and [Production release baseline](PRODUCTION-RELEASE-BASELINE.md).

## Historical plans and migration-era documents

These files document **past decisions, proposed migrations or old code freezes**, not a second currently running stack: [Architecture](ARCHITECTURE.md), [Architecture decisions](ARCHITECTURE-DECISIONS.md), [Feature parity](FEATURE-PARITY.md), [Implementation blueprint](IMPLEMENTATION-BLUEPRINT.md), [Implementation roadmap](IMPLEMENTATION-ROADMAP.md), [Installer architecture](INSTALLER-ARCHITECTURE.md), [Migration plan](MIGRATION-PLAN.md), [Data migration rehearsal](DATA-MIGRATION-REHEARSAL-PLAN.md), [PostgreSQL model migration mapping](POSTGRESQL-DATA-MODEL.md), [Product plan](PRODUCT-PLAN.md), [Mailserver adapter foundation](MAILSERVER-ADAPTER.md) and [Security migration review](SECURITY-REVIEW.md).

The root [notes progress ledger](../notes/003-PHASE-PROGRESS-AND-CHANGE-LOG.md) and [live evidence log](../notes/016-LIVE-INBOUND-DEPLOYMENT-ACCEPTANCE.md) are preserved outside the docs-only edit scope. **Not all release acceptance gates are closed.**

**Maintenance:** Update this manifest when adding/removing current docs. Do not delete provenance or historical AGPL notices.
