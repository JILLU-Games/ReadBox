# Prisma Foundation

> **Authoritative database policy:** This application uses one PostgreSQL database only. Prisma is the application ORM. Mail-server management data, if integrated later, must use this same database under separate schemas and least-privilege roles where supported. MariaDB, MySQL, SQLite, and second databases are prohibited. Maildir/message/attachment bytes remain on the filesystem.

The Prisma 7 client and PostgreSQL datasource are configured. The initial application schema and its reviewed PostgreSQL constraints are in `schema.prisma` and `migrations/20261017000000_initial_application_schema/migration.sql`. The checked-in migration is applied to the local Docker PostgreSQL development database only; it has not been applied to any remote database.

- `npm run db:validate` validates the schema/configuration without contacting PostgreSQL.
- `npm run db:generate` generates the local client and does not run migrations.
- `npm run db:up` starts PostgreSQL 16.14 on loopback with a persistent named volume.
- `npm run db:migrate` applies checked-in migrations to the local database; `npm run db:status` reports migration status.
- `npm run db:down` stops the local service without deleting its volume.
- `npm run test:compat` runs read-only original-source contracts and PostgreSQL schema assertions; it does not start Django or connect to any database.
- No `db push`, seed, remote database, or production connection is configured. Prisma CLI loads `.env.local` and `.env`, defaults only to the local development URL, and rejects non-loopback database hosts. Runtime configuration still requires `DATABASE_URL`.
