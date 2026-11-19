---
title: "ReadBox Feature Guide Index"
description: "ReadBox user and administrator feature guide navigation with verified implementation boundaries."
order: 0
draft: false
---

Each guide maps to a verified UI component and its backend implementation. Availability of actions depends on your current role, database connection, domain status and configured policy.

| Feature | UI / route | Guide |
|---|---|---|
| Domains, external Cloudflare Manual Mode, automatic zones, DNS and DKIM | Admin → Domains (`/vcon/domains`) | [Domains and DNS](domains-and-dns.md) |
| Admin mailbox provisioning, reserved system mailboxes, user mailbox/inbox, attachments | Admin → Mailboxes; User → My mailboxes | [Mailboxes and inbox](mailboxes-and-inbox.md) |
| Users, account approval, signup rules, permissions, sessions and audit | Admin → Users / Users control / Audit & security | [Admin and accounts](admin-and-accounts.md) |
| Age encrypted backups, R2 upload/schedule, guarded restore | Admin → Backup | [Backup and restore](backup-and-restore.md) |
| Maildir/Pg operations, retention, health and update bridge | Admin → Operations / System update | [Operations and update](operations-and-update.md) |
| Website pages, branding, contact inquiries | `/`, `/contact`; Admin → Settings / Contact inquiries | [Public site](public-site-and-contact.md) |

The first line of evidence for all user features is the actual `src/components/` and `src/app/` implementation. Live operator observations are limited and do not demonstrate every failure/negative case. See [coverage report](https://github.com/vibtoolshq/ReadBox/blob/main/docs/reference/coverage-and-verification.md).
