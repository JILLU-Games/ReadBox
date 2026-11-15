# Migration Boundary

> **Authoritative database policy:** This application uses one PostgreSQL database only. Prisma is the application ORM. Mail-server management data, if integrated later, must use this same database under separate schemas and least-privilege roles where supported. MariaDB, MySQL, SQLite, and second databases are prohibited. Maildir/message/attachment bytes remain on the filesystem.

`20261017000000_initial_application_schema/migration.sql` is the reviewed initial PostgreSQL DDL artifact. It was generated from the Prisma model, then extended with functional lower-case indexes, source status/range checks and the target-only session table. It was applied to the fresh disposable Phase 6.4 test database; this does not establish its state in any other database. `tests/schema/postgres-schema.test.mjs` protects those custom additions from being lost when regenerating a diff.

`20261018120000_administrator_profiles/migration.sql` is an additive migration artifact that creates the one-to-one application administrator profile and its foreign key to `users`. It does not backfill or promote existing accounts. During Phase 6.4 it was applied twice successfully to the fresh disposable PostgreSQL test database; the integration suite verified the actual unique index and cascading foreign key. No existing development or production database was queried.

Future changes must be reviewed and tested against an isolated PostgreSQL instance, then run explicitly by an operator. Do not use `db push` or connect this setup to a production database.
