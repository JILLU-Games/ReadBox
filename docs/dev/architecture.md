# ReadBox architecture and data flows

**Source baseline:** `488f565a21f4434ed5a066c5d46794637520ddec` (documentation-only successor of deployed executable `9c3d99d4...`). The active product is a Next.js 16 App Router + React 19 application with Node.js 22 workers, a **single PostgreSQL** database managed through Prisma, Maildir file storage, and optional mailserver/backup Docker profiles.

## Component architecture

```mermaid
flowchart TD
  Browser[Public site / User workspace / Admin workspace]
  Next[Next.js App Router: pages, actions, API routes]
  Auth[Auth.js credentials + DB session registry]
  Core[ReadBox core services: users / domains / messages / operations]
  PG[(Single PostgreSQL: public + mailserver schemas)]
  SMTP[Postfix: inbound SMTP]
  LMTP[Dovecot: LMTP delivery]
  Maildir[(Persistent Maildir)]
  Worker[Node ingestion + retention worker]
  Files[(Attachments and media volumes)]
  Broker[Host backup agent: HMAC Unix socket]
  R2[Cloudflare R2]
  CF[Cloudflare DNS API, optional]
  Browser --> Next
  Next --> Auth
  Next --> Core
  Auth --> PG
  Core --> PG
  Core --> Files
  Core --> CF
  Next --> Broker
  Broker --> R2
  Broker --> PG
  Broker --> Maildir
  SMTP --> PG
  SMTP --> LMTP
  LMTP --> Maildir
  Worker --> Maildir
  Worker --> PG
  Worker --> Files
```

The line between `SMTP` and `LMTP` represents **inbound delivery**, not outgoing mail. The backup agent is **host-only**, not a publicly exposed API. Cloudflare interactions apply only to explicitly configured/selected zones; Manual Mode omits DNS publishing.

## Browser and server boundaries

- Public pages in `src/app/page.tsx`, `contact/`, `privacy/`; protected route groups `(workspace)/users` and `(workspace)/vcon`.
- UI components in `src/components/`; Next.js server actions in route-local `actions.ts` files.
- Business logic under `src/core/`; most stateful services require authorization context, Prisma client and scoped object IDs.
- Authentication in `src/auth.ts` and `src/core/auth/`, using Credentials + Argon2 and a DB-backed active session registry. Admin and ordinary account records have separate identity paths.
- File-backed message/attachment bytes are **not** stored as whole MIME objects in PostgreSQL. PostgreSQL persists message text, sanitized HTML, metadata and storage references.

## Inbound message pipeline

```mermaid
sequenceDiagram
  participant S as External SMTP sender
  participant P as Postfix
  participant D as Dovecot LMTP
  participant F as Maildir
  participant W as Node ingestion worker
  participant DB as PostgreSQL
  participant U as Authenticated inbox
  S->>P: SMTP delivery to allowed domain/mailbox
  P->>DB: Recipient/domain lookup in mailserver schema
  P->>D: Deliver accepted mail
  D->>F: Save message file
  W->>F: Scan new/cur and read MIME
  W->>W: Parse, sanitize, hash, confine attachments
  W->>DB: Insert message, attachment metadata, counters, heartbeat
  U->>DB: Read assigned mailbox data
```

Source: `deployment/mailserver/{postfix,dovecot}/`, `src/core/mailserver/pg-adapter.ts`, `src/core/ingestion/{service,parser,sanitizer,attachments}.ts`, `src/workers/ingestion.ts`, `src/core/messages/service.ts`.

## Domain provisioning

- Manual path: create disabled domain → admin provisions DKIM with Cloudflare publish OFF → escrow-gated public TXT → manual zone export → routing DNS check → activation.
- Automatic path: selected active Cloudflare zone validation → escrow-gated DKIM → additive conflict-safe DNS publish/readback → DNS routing check → activation or pending result.
- DKIM public key readiness and authoritative DKIM TXT visibility are separate states. `signing: inactive` is intentional for this inbound-only product.

## Backup and updates

Admin server actions use authenticated private agent RPC for encrypted backups, scheduled R2 uploads and guarded restore. A separate approved host updater takes an encrypted pre-update snapshot before Git fast-forward and Compose rebuild. Neither the browser nor Next.js has unbounded shell access.

**See:** [Security](security.md), [API](api-reference.md), [Database](database-schema.md), [Deployment](building-packaging.md).
