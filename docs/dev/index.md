---
title: "ReadBox Developer Documentation"
description: "Entry point for ReadBox architecture, development, security, APIs, PostgreSQL and deployment guides."
order: 0
version: "0.1.0"
draft: false
---

This is the technical guide to the **active** Next.js 16 / Prisma / PostgreSQL implementation. Source code takes precedence over historical MailStack migration plans.

## Engineering entry points

| Topic | Read |
|---|---|
| Runtime data flow and architecture diagrams | [Architecture](architecture.md) |
| Directory/module ownership and legacy boundary | [Codebase structure](codebase-structure.md) |
| Local Node/PostgreSQL developer commands | [Local setup](local-setup.md) |
| HTTP routes and Next.js server actions | [API reference](api-reference.md) |
| Prisma entities and mailserver SQL schema | [Database schema](database-schema.md) |
| Auth, sessions, filesystem, R2 and HTTP trust boundaries | [Security](security.md) |
| Docker/host update, packaging, release constraints | [Build and deployment](building-packaging.md) |
| CI, unit/UI tests and formal release gates | [Testing](testing.md) |
| File allowlists, verification discipline and contribution policies | [Contributing](contributing.md) |

More details: [Configuration keys](https://github.com/vibtoolshq/ReadBox/blob/main/docs/reference/configuration-reference.md), [Dependencies](https://github.com/vibtoolshq/ReadBox/blob/main/docs/reference/dependencies.md), [Audit coverage](https://github.com/vibtoolshq/ReadBox/blob/main/docs/reference/coverage-and-verification.md).

**Source boundary:** root `src/`, `deployment/`, `scripts/`, `prisma/` and `docker-compose.yml` implement ReadBox. `reference/MailStack/` is an archived AGPL reference tree, not a live Django/MariaDB subsystem. Full R-06 stable-release status remains **NO-GO**, even though Manual Mode's basic inbound path has operator live acceptance.
