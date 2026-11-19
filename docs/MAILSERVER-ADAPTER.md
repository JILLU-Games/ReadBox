# Mail-Server Adapter Foundation

> **Current-documentation reconciliation — 2026-11-20:** This page preserves a **historical design, migration, or phase snapshot**. Its dated status, legacy Django/MariaDB references, proposed tasks, and older runtime descriptions are **not current ReadBox implementation claims**. The active product is Next.js 16 / React 19 with one PostgreSQL database, inbound-only Postfix/Dovecot, the implemented browser first-admin flow, and optional Manual Mode DNS onboarding. Consult the [current architecture](dev/architecture.md), [current feature guides](users/features/index.md), and [verification report](reference/coverage-and-verification.md) for code-backed behavior. The 17-gate stable production-release decision remains **NO-GO**.

> **Authoritative database policy:** ReadBox uses exactly one PostgreSQL database for all application and database-backed mail-server management data. Prisma remains the application ORM. Any future Postfix/Dovecot database integration must use this same PostgreSQL database, with separate schemas and least-privilege roles where supported, after installed versions, configuration, schema, and lookup contract are verified. Do not add or connect MariaDB, MySQL, SQLite, or a second database. Maildir and message/attachment files remain on the filesystem. Any legacy multi-database descriptions below are historical/source context only and are superseded as target architecture.

## Boundary

ReadBox PostgreSQL is the application control plane. `ReadOnlyMailServerAdapter` is a separate, schema-agnostic port for future reads of domain, mailbox, and alias records used by mail-server routing. Its generic query and record types are supplied by a future integration; this foundation defines no table names, columns, lookup keys, status rules, or alias-resolution behavior.

Postfix routing and alias lookup are distinct from Dovecot or another service's mailbox storage and authentication responsibilities. The presence of a mailbox lookup operation does not imply that Postfix owns mailbox storage. This adapter does not connect to either service and performs no writes.

## Contract

Each lookup accepts a caller-defined query type and optional `AbortSignal`, and returns one of:

- `records`: zero or more typed records; an empty list is a successful empty result.
- `not_found`: the future integration has established that the query has no result.
- `ambiguous`: the future integration found multiple matches for a query that requires a unique result.
- `error`: a safe code (`invalid_input`, `unavailable`, `timeout`, `query_failed`, or `cancelled`) with no raw message, SQL, credentials, connection details, or cause.

The port does not log. Implementations must validate their schema-specific input before querying, parameterize values, avoid untrusted identifier interpolation, and translate internal errors to these safe codes. The mock catches thrown handler errors and returns only `query_failed`.

The `AbortSignal` is a cancellation hook; the port does not impose a timeout policy. A concrete integration must define timeout budgets and map timeout/cancellation consistently. Retries, audit events, bulk jobs, and reconciliation belong in a higher orchestration layer so individual lookups do not claim cross-database transaction support.

## Mock and Tests

`createMockReadOnlyMailServerAdapter` accepts injected handlers and supports deterministic result/failure cases without a database, driver, logger, or app PostgreSQL client. Its test-only fixture query uses a synthetic `scenario` field; that field is not a production lookup key.

Run `npm run test:postfix`. These are mock contract tests, not MariaDB/Postfix/Dovecot integration tests.

## Before a Real Integration

Obtain and review a sanitized, owner-approved mail-server contract specifying:

1. Which existing views/tables are the supported read surface.
2. Exact query fields, result fields, nullability, and cardinality for domain, mailbox, and alias operations.
3. Enabled/disabled filtering and the authoritative meaning of each status.
4. Whether aliases are returned as stored or resolved, and how duplicates/loops are represented.
5. PostgreSQL role/schema separation, least-privilege grants, timeout/pool behavior, and operational error mapping.

Choose a PostgreSQL client/driver only after that contract and dependency review. Use a dedicated least-privilege role and schema in the single PostgreSQL database, with credentials separate from the ReadBox application role and Postfix role. Never read mailbox password hashes or write mail-server rows in this read-only phase. Any later provisioning, bulk operation, or backup/restore work requires its own approved design and tests.
