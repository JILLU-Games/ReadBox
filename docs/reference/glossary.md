# ReadBox Terminology and Glossary

| Term | Meaning in ReadBox |
|---|---|
| **ReadBox** | Active inbound-only webmail and mailbox administration application |
| **Public site** | Visitor-facing pages at `/`, `/contact`, `/privacy` |
| **User workspace** | Authenticated mailbox and account UI at `/users` |
| **Admin panel / vcon** | Protected administrative workspace under `/vcon` |
| **Manual Mode** | Domain onboarding without automatic Cloudflare publication, used for another Cloudflare account |
| **Automatic setup** | Domain onboarding with explicitly selected validated Cloudflare zone and guarded DNS publish |
| **DNS routing verified** | Required MX target and mail-host A/AAAA resolve as expected; permits domain activation |
| **All DNS records matched** | Separate full inspection of MX, mail A/AAAA, SPF, DKIM, DMARC; not implied by routing badge |
| **DKIM public key ready** | A public `mail._domainkey` TXT value exists to publish; does not mean external DNS already matches |
| **DKIM escrow** | Encrypted root-only/offsite custody prerequisite to releasing DKIM public material |
| **DKIM signing: inactive** | Inbound-only app does not sign outgoing messages |
| **MX** | Mail exchanger record pointing inbound mail to a hostname |
| **SPF / DMARC** | DNS TXT policies related to sender authorization and authentication disposition |
| **Maildir** | Persistent filesystem format used by Dovecot LMTP and indexed by the worker |
| **Mailserver schema** | PostgreSQL schema with Postfix recipient/mailbox/alias lookup tables/views |
| **Prisma** | ORM and migration system for active ReadBox PostgreSQL data |
| **Mailbox membership** | Explicit user-to-mailbox assignment used to enforce inbox access |
| **Ingestion worker** | Node.js process parsing Maildir MIME and indexing message/attachment metadata |
| **Message soft-delete** | Database visibility/deletion flag; not equivalent to filesystem archive destruction |
| **Retention purge** | Separate guarded operation/worker task for expired data |
| **R2** | Cloudflare object storage for encrypted, remotely verified backups |
| **Age recipient** | Public X25519 address used to encrypt backups; not a secret/private identity |
| **Age identity** | Private key used to decrypt eligible backups; protect it separately from VPS |
| **Root-only broker / backup agent** | Privileged host Python process receiving authenticated narrow Unix-socket jobs |
| **Restore permit** | Short-lived, single-use authorization required for guarded recovery commit |
| **R-06** | Formal ReadBox production readiness acceptance program, not a feature number |
| **RG-01..RG-17** | Mandatory independent acceptance gates for universal stable release |
| **MM-01** | Manual Mode source/CI implementation and operator-observed inbound workflow phase |
| **Production-use scoped PASS** | Observed domain/inbound flow works; not general security/recovery release certification |
| **Full product NO-GO** | Stable release not independently signed because formal gates remain open |
| **Dedicated backup branch** | `backup/dns-final-primary-20261119` on external backup repositories, not their `main` |
| **Legacy MailStack reference** | Retained non-runtime AGPL historical source tree under `reference/MailStack/` |

See [Getting started](../users/getting-started.md), [Architecture](../dev/architecture.md) and [Release acceptance](../PRODUCTION-ACCEPTANCE-RUNBOOK.md).
