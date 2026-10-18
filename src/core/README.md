# Core Module Map

> **Authoritative database policy:** ReadBox uses one PostgreSQL database only, accessed by the application through Prisma. Future database-backed Postfix/Dovecot management integration must use this same database with separate schemas and least-privilege roles where supported. Do not add MariaDB, MySQL, SQLite, or any second database. Maildir and message/attachment files remain on the filesystem.

This foundation creates the ownership boundaries from the implementation blueprint. Domain engines are intentionally unimplemented.

| Module       | Responsibility when implemented                                                                                                          |
| ------------ | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `accounts/`  | Managed users, access policy and mailbox memberships.                                                                                    |
| `auth/`      | Credentials, sessions, throttling and CSRF.                                                                                              |
| `audit/`     | Redacted application audit events.                                                                                                       |
| `database/`  | Prisma client for the single PostgreSQL database; separate schemas and least-privilege roles for app, mail-management, and contact data. |
| `delivery/`  | Maildir indexing and message parsing; not SMTP/LMTP.                                                                                     |
| `domains/`   | Domain lifecycle and mail-server reconciliation.                                                                                         |
| `dns/`       | DNS preview and separately scoped verification checks.                                                                                   |
| `health/`    | Liveness/readiness status; current implementation does not connect to a database.                                                        |
| `mailboxes/` | Mailbox lifecycle and cross-system provisioning orchestration.                                                                           |
| `messages/`  | Scoped message queries and state transitions.                                                                                            |
| `postfix/`   | Adapter to the existing MariaDB recipient views.                                                                                         |
| `security/`  | Shared authorization, headers, validation and path policy.                                                                               |
| `server/`    | Runtime configuration, process and logging helpers.                                                                                      |
| `storage/`   | Confined Maildir and attachment storage.                                                                                                 |
| `updates/`   | Future verified release request protocol.                                                                                                |

Only `database/`, `health/`, and `server/` contain foundation scaffolding at this stage. No Postfix, Dovecot, DNS, Maildir or message-processing code is present.
