---
title: "ReadBox User and Administrator Guides"
description: "ReadBox user, administrator, and operator documentation for inbound mail and self-hosted accounts."
order: 0
version: "0.1.0"
draft: false
---

ReadBox is a receive-only mailbox web application. These guides explain the actual application controls for users, administrators and self-host operators.

## First steps

Start with [Getting started](getting-started.md). For an authorized new server, use [Installation and first administrator](installation.md) and [Configuration](configuration.md). For tasks across several screens see [Workflows](workflows.md).

## Feature guides

- [Domains, Manual Mode and DNS verification](features/domains-and-dns.md)
- [Mailboxes, team inboxes, HTML and attachments](features/mailboxes-and-inbox.md)
- [Users, permissions, login, sessions and audit](features/admin-and-accounts.md)
- [Encrypted backups, Cloudflare R2 and restore](features/backup-and-restore.md)
- [Operations, worker maintenance and system updates](features/operations-and-update.md)
- [Public site, contact form and branding](features/public-site-and-contact.md)

See [Feature index](features/index.md) for a quick feature/status cross-reference.

## Help

[Workflow reference](workflows.md) · [Troubleshooting](troubleshooting.md) · [FAQ](faq.md).

**Boundaries:** ReadBox does not send outbound mail or expose IMAP/POP3. A domain's green DNS badge is routing-only. The observed Manual Mode inbound workflow works on the operator-tested host, but a 17-gate universal production release GO has not been signed.
