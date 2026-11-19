# Mailboxes, inbox and safe message reading

## Admin mailbox management

Go to **Admin → Mail & Domains → Mailboxes** to search/filter addresses by domain or status, create mailboxes, enable/disable a mailbox and review assigned users. **Create mailbox** lets an administrator select a domain, enter or generate a local part, assign users and optionally choose **Create & copy**. The **System mailbox** dialog handles reserved `postmaster` and `abuse` names. Deletion and **Purge selected** are permanent and use guarded confirmation; do not use them as a diagnostic shortcut.

Mailbox provisioning stores its record in PostgreSQL, creates a confined Maildir tree and synchronizes routing data with the single PostgreSQL mailserver schema. It uses filesystem locks and rollback helpers for partial provisioning failures. New mail can reach the address only when the relevant domain, mailbox and mailserver routing are correctly active.

## User mailbox management

At `/users/mailboxes`, each authenticated user sees mailboxes allowed by their assignments and policies. Where permitted, **Create mailbox** opens the self-service form. Domain allowlists, per-user mailbox quota and create/delete permissions originate in **Admin → Users control** and may be overridden per user. Deleting a mailbox is not generally available by default.

## Read messages

1. Open an assigned mailbox, then select a message from its inbox.
2. Use search and the read/unread and attachment filters supported by the list UI.
3. Open a message to see sender, recipients, subject, date, body and attachment controls.
4. Use **Mark unread** or delete only when your access policy allows. A delete is a soft-delete in the message database path; retention and eventual cleanup are separate worker/operations responsibilities.
5. Download attachments through an authenticated endpoint. Their stored paths are checked against the confined attachment root.

ReadBox parses MIME via `postal-mime` and sanitizes HTML and CSS using `sanitize-html`/`css-tree`. The HTML reader applies its own CSP and sandboxing; remote tracking content is not automatically trusted. Inline CID images may be resolved from authorized stored attachments.

## Live updates

The user shell polls `/api/messages/live` with the required `X-ReadBox-Live-Request: 1` header, bounded cursors and mailbox filters. The client includes a live mail notifier. This is not an SMTP push service or a guarantee of immediate delivery during a worker outage.

**Limits:** ReadBox does **not** provide a mail compose/send page, SMTP submission, public IMAP/POP3, or automatic outbound DKIM signing. A successful received test message only proves the observed inbound path, not the MIME/attachment recovery matrix.

**Source:** `src/components/users/{user-mailboxes-view,mailbox-inbox-view,message-reader-view,live-mail-notifier}.tsx`, `src/core/messages/service.ts`, `src/core/mailboxes/{service,provisioning}.ts`, `src/core/ingestion/{service,parser,sanitizer,attachments}.ts`.
