# Migration Boundary

> **Authoritative database policy:** This application uses one PostgreSQL database only. Prisma is the application ORM. Mail-server management data, if integrated later, must use this same database under separate schemas and least-privilege roles where supported. MariaDB, MySQL, SQLite, and second databases are prohibited. Maildir/message/attachment bytes remain on the filesystem.

`20261017000000_initial_application_schema/migration.sql` is the reviewed, unapplied initial PostgreSQL DDL artifact. It was generated from the Prisma model, then extended with functional lower-case indexes, source status/range checks and the target-only session table. `tests/schema/postgres-schema.test.mjs` protects those custom additions from being lost when regenerating a diff.

This SQL has **not** been applied to any database. Future changes must be reviewed and tested against an isolated PostgreSQL instance, then run explicitly by an operator. Do not use `db push` or connect this setup to a production database.
