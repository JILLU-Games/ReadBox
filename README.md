# MailStack

> **Authoritative database policy:** ReadBox uses exactly one PostgreSQL database for all application and database-backed mail-server management data. Prisma remains the application ORM. Any future Postfix/Dovecot database integration must use this same PostgreSQL database, with separate schemas and least-privilege roles where supported, after installed versions, configuration, schema, and lookup contract are verified. Do not add or connect MariaDB, MySQL, SQLite, or a second database. Maildir and message/attachment files remain on the filesystem. Any legacy multi-database descriptions below are historical/source context only and are superseded as target architecture.

Node.js foundation for the MailStack rebuild. The reference implementation under `reference/MailStack/` is read-only. This phase does not implement authentication, mailbox operations, mail processing, or production service connections.

## Requirements

- Node.js 22.12 or newer
- npm 10 or newer
- PostgreSQL is not required to start the development UI or validate/generate the Prisma client

## Development

```powershell
npm.cmd install
npm.cmd run dev
```

Open `http://localhost:3000`. `/users` and `/vcon` are UI-only route foundations; authorization is not implemented, so do not expose this scaffold as a production admin application.

## PostgreSQL and Prisma

Copy `.env.example` to `.env.local` for local settings. Prisma CLI loads `.env.local` and `.env`, uses the matching local-only fallback URL if neither defines `DATABASE_URL`, and rejects non-loopback database hosts. The runtime database client requires `DATABASE_URL` to be configured.

```powershell
npm.cmd run db:up
npm.cmd run db:validate
npm.cmd run db:generate
npm.cmd run db:migrate
npm.cmd run db:status
```

`db:up` starts PostgreSQL 16.14 bound to `127.0.0.1` with persistent named storage. `db:down` stops the Compose service without deleting its volume. `db:migrate` applies the checked-in Prisma migrations to the local database. No seed or production connection is configured. See [Prisma foundation](prisma/README.md) and [core module map](src/core/README.md).

## Checks

```powershell
npm.cmd run lint
npm.cmd run typecheck
npm.cmd run build
```

All shared styling is defined in `src/app/globals.css`. The PWA service worker caches only versioned static resources and a generic offline page; mailbox data and API responses are never cached.
