# Getting started with ReadBox

ReadBox is an **inbound-mailbox** and team inbox application. It includes a public site, user account and mailbox workspaces, and a protected administrator panel. It receives mail through Postfix/Dovecot and indexes it from Maildir; **it is not an email-sending, IMAP, or POP3 product**.

## Choose your entry point

| Role | Open | What you can do |
|---|---|---|
| Visitor | `/`, `/contact` | Read the public site and send a contact inquiry |
| New user | `/sign-up` | Register if public registration is enabled by the administrator |
| Existing user | `/sign-in` → `/users` | See assigned inboxes; create mailboxes only if permitted |
| Administrator | `/vcon/login` → `/vcon` | Manage domains, mailboxes, users, backup, operations and settings |
| First installer | `/initial-setup` | Use the one-time installer code only while initial activation is allowed |

## First user session

1. Open **Sign up** if registration is enabled; follow the current form's required fields. A site may use instant registration, an invite code or administrator approval.
2. Sign in at `/sign-in`. An administrator may have assigned an existing mailbox, or your account may permit **Create mailbox** from **My mailboxes**.
3. Open **My mailboxes**, select an assigned mailbox, then select a message. Use search, read/unread and attachment filters where displayed.
4. Open **Settings** to edit permitted profile fields, change password and review/revoke sessions. Message/mailbox deletion buttons appear only if authorized.

A user cannot add an arbitrary mail domain from this workspace; domain onboarding is an administrator responsibility. A newly created domain must pass routing DNS verification before inbound service is activated.

## Administrator first tasks

In **Admin panel**, inspect **Domains**, **Mailboxes**, **Users**, **Users control**, **Operations**, **Backup**, **System update** and **Settings** from the grouped sidebar. Follow [Domain & DNS](features/domains-and-dns.md) before activating a new domain, and [Backup & recovery](features/backup-and-restore.md) before updates.

## What “verified” means

An **Active / DNS verified** domain means the required MX and mail-host A/AAAA routing check passed. It does **not** establish that the DKIM TXT is publicly present, that all SPF/DMARC records match, or that a stable product release has been signed off.

**Implementation:** `src/components/layout/app-shell.tsx`, `src/app/(workspace)/users/layout.tsx`, `src/app/(workspace)/vcon/layout.tsx`, `src/core/auth/sign-up.ts`, `src/core/domains/service.ts`. See [workflows](workflows.md) and [troubleshooting](troubleshooting.md).
