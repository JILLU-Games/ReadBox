# Forensic Audit Coverage and Verification Report

**Audit date:** 2026-11-20 (Asia/Dhaka). **Authoritative source:** `vibtoolshq/ReadBox:main` at immutable pre-documentation commit `488f565a21f4434ed5a066c5d46794637520ddec`, Git tree `c74712866011609704b448de79c13289efdd6b6f`. The previously operator-deployed executable SHA was `9c3d99d4ec26707c2aec3a5c9ee959dea39dcbb5` (the successor included documentation-only evidence). This audit used remote **read-only source content** plus **documentation-only Git objects**; it did not connect to a live VPS, mutate DNS/R2, inspect private data, or run application tests.

## File inventory and inspection boundaries

| Category | Tracked files | What was actually checked |
|---|---:|---|
| `src/` | 223 | **223/223** content fetched; entry points, exports and module signatures scanned; high-risk auth, domain, backup, ingestion, page/API flows inspected in greater depth |
| `deployment/` | 37 | **37/37** content fetched; host backup, DKIM, Postfix/Dovecot, templates, recovery modules reviewed |
| `scripts/` | 23 | **23/23** content fetched; installer, host updater, verification and operator boundaries reviewed |
| `prisma/` | 11 | **11/11** content fetched; 18 Prisma models, seven SQL migrations, migration metadata, README reviewed |
| `.github/workflows/` | 8 | **8/8** content fetched; repository/branch conditions, CI and prerelease-only boundary reviewed |
| `tests/` | 73 | **73/73** content fetched; test identifiers/subjects and scripted assertions inventoried; **not executed** in this phase |
| Pre-existing `docs/` | 21 | **21/21** full text fetched; dated migration/phase/current-status conflicts identified, reconciliation banners planned/applied |
| Other active text (root config, `notes/`, public JS/HTML/SVG, contribution docs) | 63 | **63/63** text files fetched; critical release evidence and config reviewed |
| Binary/very large generated support | 6 | Five tracked PNG images and `package-lock.json` inventoried, **not fully decoded/independently audited** |
| Retained `reference/MailStack/` | 391 | **391 historical/reference blobs inventoried**; not re-audited as current executable ReadBox; licensing boundary reviewed |
| **Total at baseline** | **856** | **459 active/current text files content-inspected**, six assets/lock not fully inspected, 391 legacy/reference entries not code-deep-scanned |

**Depth limitation:** A successful fetch and exports/entry-point scan is **not** proof that each function body and every execution branch has been exhaustively manually reviewed. Deep traces focused on identity/authorization, DNS/DKIM/escrow, email ingestion/reader, PostgreSQL routing, host backups, updater and actual UI controls. The legacy reference tree is not current runtime. Do not claim universal source-line coverage, host E2E, full binary/provenance audit or semantic accuracy of every dated historical line.

## Current feature-to-source-to-document coverage

**47 separately tracked feature/capability areas** are mapped below. Each has actual source evidence, but "code path verified" does **not** mean every live acceptance and negative test passed. Operator-observed live acceptance applies only where explicitly stated.

| ID | Feature / capability | Source anchor | Current guide | Evidence class |
|---|---|---|---|---|
| F-01 | Public landing, FAQ, SEO metadata | `src/app/page.tsx` | [Guide](../users/features/public-site-and-contact.md) | Code path verified; live acceptance case-specific |
| F-02 | Public contact form and anti-replay CSRF | `src/core/contact/service.ts` | [Guide](../users/features/public-site-and-contact.md) | Code path verified; live acceptance case-specific |
| F-03 | Administrative contact inquiry review | `src/components/vcon/inquiries-console.tsx` | [Guide](../users/features/public-site-and-contact.md) | Code path verified; live acceptance case-specific |
| F-04 | Branding, media assets and public settings | `src/core/settings/service.ts` | [Guide](../users/features/public-site-and-contact.md) | Code path verified; live acceptance case-specific |
| F-05 | Public user registration / verification choices | `src/core/auth/sign-up.ts` | [Guide](../users/features/admin-and-accounts.md) | Code path verified; live acceptance case-specific |
| F-06 | Ordinary credential login | `src/core/auth/credentials.ts` | [Guide](../users/getting-started.md) | Code path verified; live acceptance case-specific |
| F-07 | Admin credential login and role guard | `src/core/auth/route-guards.ts` | [Guide](../users/features/admin-and-accounts.md) | Code path verified; live acceptance case-specific |
| F-08 | First admin one-time browser activation | `src/core/setup/first-admin-activation.ts` | [Guide](../users/installation.md) | Code path verified; live acceptance case-specific |
| F-09 | Token-based user and admin password reset | `src/core/auth/password-reset.ts` | [Guide](../users/features/admin-and-accounts.md) | Code path verified; live acceptance case-specific |
| F-10 | User profile editing | `src/core/accounts/user-profile.ts` | [Guide](../users/features/admin-and-accounts.md) | Code path verified; live acceptance case-specific |
| F-11 | Password update and session revocation | `src/core/accounts/user-profile.ts` | [Guide](../users/features/admin-and-accounts.md) | Code path verified; live acceptance case-specific |
| F-12 | Managed user create/update/delete | `src/core/accounts/users.ts` | [Guide](../users/features/admin-and-accounts.md) | Code path verified; live acceptance case-specific |
| F-13 | Global user control / signup form policy | `src/core/accounts/user-control-policy.ts` | [Guide](../users/features/admin-and-accounts.md) | Code path verified; live acceptance case-specific |
| F-14 | Per-user allowed domains/quotas/capabilities | `src/core/accounts/user-control-policy.ts` | [Guide](../users/features/admin-and-accounts.md) | Code path verified; live acceptance case-specific |
| F-15 | Action audit log, query and monitoring | `src/core/audit/queries.ts` | [Guide](../users/features/admin-and-accounts.md) | Code path verified; live acceptance case-specific |
| F-16 | Login failures and lockout safeguards | `src/core/auth/credentials.ts` | [Guide](../dev/security.md) | Code path verified; live acceptance case-specific |
| F-17 | Domain CRUD, default and activation | `src/core/domains/service.ts` | [Guide](../users/features/domains-and-dns.md) | Code path verified; live acceptance case-specific |
| F-18 | Automatic Cloudflare zone and DNS publication | `src/core/dns/cloudflare-auto.ts` | [Guide](../users/features/domains-and-dns.md) | Code path verified; live acceptance case-specific |
| F-19 | Manual Mode for another Cloudflare account | `src/components/vcon/domain-form.tsx` | [Guide](../users/features/domains-and-dns.md) | Code path verified; live acceptance case-specific |
| F-20 | DKIM staged key/public record and encrypted escrow gate | `src/core/dns/domain-automation.ts` | [Guide](../users/features/domains-and-dns.md) | Code path verified; live acceptance case-specific |
| F-21 | Expected DNS preview / zone file export | `src/core/dns/records.ts` | [Guide](../users/features/domains-and-dns.md) | Code path verified; live acceptance case-specific |
| F-22 | Required MX + mail-host A/AAAA routing verification | `src/core/dns/resolver.ts` | [Guide](../users/features/domains-and-dns.md) | Code path verified; live acceptance case-specific |
| F-23 | Full MX/A/SPF/DKIM/DMARC inspection | `src/app/api/vcon/domains/[uuid]/dns-status/route.ts` | [Guide](../users/features/domains-and-dns.md) | Code path verified; live acceptance case-specific |
| F-24 | Admin mailbox creation and Maildir provisioning | `src/core/mailboxes/service.ts` | [Guide](../users/features/mailboxes-and-inbox.md) | Code path verified; live acceptance case-specific |
| F-25 | Reserved postmaster and abuse system mailboxes | `src/core/mailboxes/service.ts` | [Guide](../users/features/mailboxes-and-inbox.md) | Code path verified; live acceptance case-specific |
| F-26 | Mailbox membership and access scoping | `prisma/schema.prisma` | [Guide](../users/features/mailboxes-and-inbox.md) | Code path verified; live acceptance case-specific |
| F-27 | Self-service mailbox create/delete per policy | `src/core/messages/service.ts` | [Guide](../users/features/mailboxes-and-inbox.md) | Code path verified; live acceptance case-specific |
| F-28 | Admin irreversible mailbox purge and bulk purge | `src/core/mailboxes/service.ts` | [Guide](../users/features/mailboxes-and-inbox.md) | Code path verified; live acceptance case-specific |
| F-29 | Inbox lists, search, read/attachment filters | `src/core/messages/service.ts` | [Guide](../users/features/mailboxes-and-inbox.md) | Code path verified; live acceptance case-specific |
| F-30 | Message details, MIME text and safe HTML rendering | `src/core/messages/service.ts` | [Guide](../users/features/mailboxes-and-inbox.md) | Code path verified; live acceptance case-specific |
| F-31 | Confined authorized attachment download | `src/app/api/messages/attachment/[attachmentUuid]/route.ts` | [Guide](../users/features/mailboxes-and-inbox.md) | Code path verified; live acceptance case-specific |
| F-32 | Mark unread and soft-delete message | `src/core/messages/service.ts` | [Guide](../users/features/mailboxes-and-inbox.md) | Code path verified; live acceptance case-specific |
| F-33 | Bounded inbox live polling and notifications | `src/components/users/live-mail-notifier.tsx` | [Guide](../users/features/mailboxes-and-inbox.md) | Code path verified; live acceptance case-specific |
| F-34 | Maildir scanning, MIME parsing and ingestion worker | `src/core/ingestion/service.ts` | [Guide](../dev/architecture.md) | Code path verified; live acceptance case-specific |
| F-35 | Automatic configurable retention and purge | `src/core/messages/service.ts` | [Guide](../users/features/operations-and-update.md) | Code path verified; live acceptance case-specific |
| F-36 | Receive-only SMTP/Postfix -> Dovecot LMTP | `deployment/mailserver/postfix/main.cf.tpl` | [Guide](../dev/architecture.md) | Code path verified; live acceptance case-specific |
| F-37 | Admin Postfix/PostgreSQL verification and maintenance | `src/core/operations/service.ts` | [Guide](../users/features/operations-and-update.md) | Code path verified; live acceptance case-specific |
| F-38 | Local Age encrypted backup create/verify | `deployment/backup-agent/executor.py` | [Guide](../users/features/backup-and-restore.md) | Code path verified; live acceptance case-specific |
| F-39 | Backup scheduler and per-job history | `deployment/backup-agent/scheduler.py` | [Guide](../users/features/backup-and-restore.md) | Code path verified; live acceptance case-specific |
| F-40 | Cloudflare R2 configuration/upload/readback | `deployment/backup-agent/r2.py` | [Guide](../users/features/backup-and-restore.md) | Code path verified; live acceptance case-specific |
| F-41 | Guarded restore test, permit, rollback | `deployment/backup-agent/restore.py` | [Guide](../users/features/backup-and-restore.md) | Code path verified; live acceptance case-specific |
| F-42 | Host-scoped Docker update bridge and preflight | `src/core/updates/service.ts` | [Guide](../users/features/operations-and-update.md) | Code path verified; live acceptance case-specific |
| F-43 | Liveness and dependency readiness | `src/core/health/snapshot.ts` | [Guide](../users/features/operations-and-update.md) | Code path verified; live acceptance case-specific |
| F-44 | PWA manifest, service worker and theme UI | `src/app/manifest.ts` | [Guide](../users/getting-started.md) | Code path verified; live acceptance case-specific |
| F-45 | Development-only demo account / workspace | `src/core/messages/demo-workspace.ts` | [Guide](../dev/local-setup.md) | Code path verified; live acceptance case-specific |
| F-46 | Standalone secure Compose installer | `scripts/install/readbox-install.sh` | [Guide](../users/installation.md) | Code path verified; live acceptance case-specific |
| F-47 | Setup lifecycle/trusted operation authorization | `src/core/setup/authorization.ts` | [Guide](../dev/security.md) | Code path verified; live acceptance case-specific |

## Feature-status classification

- **Implemented in source (47 areas):** all F-01 through F-47; availability depends on actual policy, configuration and host deployment. The area count is an audit taxonomy, **not** a claim of 47 independently production-accepted features.
- **Operator-observed, scoped functional PASS:** two Manual Mode external-account domains, `vibmail.my` and `pypal.pl`, demonstrated active routing, mailbox creation and an inbound Gmail message visible in ReadBox. A separate earlier `mailiq.shop` operator observation involved auto-published DNS and inbound mail. The operator also observed an active backup agent and healthy Compose services. These are **not** fresh tests from this audit, independent offsite proof, or universal public delivery certification.
- **Partial / deployment-gated:** automatic Cloudflare provider, root-only encrypted DKIM escrow receipt, live TLS/PTR/IPv6/public port configuration, full host updater and private recovery are implemented as source contracts but **not independently accepted for all environments**.
- **Explicitly unavailable / intentional:** no outgoing mail composer or SMTP AUTH submission/relay; no outbound DKIM signing; no IMAP/POP3. See `docker-compose.yml` and `src/core/dns/dkim-provision.ts`.
- **Disabled UI placeholders:** top-level `Verify backup` and `View files` controls in `src/components/vcon/backup-console.tsx` are disabled; a distinct per-backup **Verify now** control is wired. These disabled buttons are **not** documented as working features.
- **Historical or superseded:** the archived Django/MariaDB MailStack reference and migration-era proposals in root `docs/*.md`; not active ReadBox services. No blanket “unused” claim is made for untraced compatibility helpers.

## Documentation drift and reconciliation

The prior 21 docs contained dated/planned descriptions that could be mistaken for the current system: **Next.js 15 vs 16**, reference MariaDB/SQLite versus **one PostgreSQL database**, an old **“no public registration”** requirement versus governed `/sign-up`, **no browser setup** versus guarded `/initial-setup`, and phase-specific “source-only / no live VPS” claims versus later limited operator-observed live tests. Some earlier roadmaps used the phrase **“production verified”** even while the formal R-06 acceptance gates remained open.

The correction deliberately preserves historical evidence (including frozen SHA and provenance) while marking retained phase documents as **dated snapshots** and directing readers to the new source-verified index, guides and this coverage report. No `reference/MailStack`, `notes/`, source, migration, workflow, private data or executable configuration was modified by this documentation phase.

## Current formal release blockers and risk boundaries

The independent R-06 ledger still has **25/32 CI-contract-verified findings and seven OPEN**: `RB-P0-06`, `RB-P1-09`, `RB-P1-10`, `RB-P1-16`, `RB-P2-01`, `RB-P2-07`, and `RB-P2-08`. The original `RG-01..RG-17` formal gates lack a complete independent signed acceptance set. These include authoritative DNS/TLS/R2 escrow verification, public mail transport, end-to-end MIME/attachment hashes, controlled host outage/restart, isolated encrypted restore and MIT/AGPL distribution provenance. Thus **full stable production release = NO-GO**.

## Validation and what was not executed

**Documentation-only changes** are intended under `docs/**`. Verification targets: every current guide/index/manifest link resolves, referenced source paths exist in the inspected baseline, balanced code fences and Markdown headings, and an exact docs-only commit comparison. A GitHub source-only inspection is not a substitute for running `npm ci`, `npm run test:unit`, `npm run test:ui`, `npm run build`, live SMTP, DNS, R2 or restore. These commands/tests were **not rerun** merely for Markdown changes.

**Sources of record:** `AGENTS.md`, `prisma/schema.prisma`, `package.json`, `notes/001-PRODUCTION-RELEASE-BLOCKERS.md`, `notes/003-PHASE-PROGRESS-AND-CHANGE-LOG.md`, `notes/006-VERIFICATION-AND-RELEASE-GATES.md`, and [production acceptance runbook](../PRODUCTION-ACCEPTANCE-RUNBOOK.md). Old phase notes remain immutable historical evidence; this report is the current audit classification.
