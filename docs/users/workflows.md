# Practical ReadBox workflows

These flows use controls present in the current application. Administrator actions require an authorized administrator session; user actions require mailbox access.

## Add a domain through another Cloudflare account

**Admin → Mail & Domains → Domains → Add domain** → enter bare domain → enable **Manual Mode — Use another Cloudflare account** → **Preview DNS** → confirm that records were reviewed → **Add domain**. Open the saved domain, **uncheck** `Publish DKIM TXT to configured Cloudflare zone`, then **Provision / Repair DKIM**. When key/public record is ready, download the **updated** Cloudflare zone file, manually add records in the domain's own DNS zone and verify routing before activation. [Detailed guide](features/domains-and-dns.md).

## Create an admin-managed mailbox

**Admin → Mail & Domains → Mailboxes → Create mailbox** → choose an active domain, enter or **Generate** a local part, select assigned users → **Create & copy** if credentials should be copied during the creation flow. Do not paste generated passwords into tickets or documentation. Reserved `postmaster`/`abuse` mailboxes have their own **System mailbox** control. [Mailbox guide](features/mailboxes-and-inbox.md).

## Read received mail

**User workspace → My mailboxes** → open a mailbox → use the message list's search, read/unread and attachment filters → open a message. HTML email is shown with a sanitized, sandboxed renderer. Attachment download is gated by mailbox membership and serves as an attachment, not as arbitrary web content.

## Manage user access

**Admin → Users → Add user** for account creation; **Users control** for global sign-up, verification modes, domain access, per-user quota, permissions and retention. A non-admin cannot read or delete another user's messages by guessing an ID.

## Verify health and recover operations

Check `/health/live` for process liveness and `/health/ready` for dependency readiness (returns HTTP 503 when not ready). **Admin → Operations** exposes guarded mailserver contract verification, sync, Maildir provisioning, index/counter repair and retention tasks. **Admin → Backup** exposes encrypted backups, R2 status and guarded restore workflows. A restore requires a separate root-side safety gate and operator approval; never use it as a routine troubleshooting click.

**Sources:** `src/components/layout/app-shell.tsx`, `src/components/vcon/{domain-form,mailbox-form,operations-console,backup-console}.tsx`, `src/components/users/{mailbox-inbox-view,message-reader-view}.tsx`.
