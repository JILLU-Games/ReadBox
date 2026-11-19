---
title: "Testing, CI and acceptance evidence"
description: "Focused source test commands, CI workflow scope, and formal release evidence classification."
order: 80
draft: false
---

ReadBox uses TypeScript/Node's built-in test runner, Vitest for React UI, disposable Docker/PostgreSQL and mailserver rehearsals, and some focused Python tests for backup/DKIM host tooling. Tests in a source tree are **not** proof a live production operation was run.

## Declared local scripts

| Command | Scope |
|---|---|
| `npm run lint` | ESLint code/static checks |
| `npm run typecheck` | Next.js route types + TypeScript `tsc --noEmit` |
| `npm run test:unit` | Compatibility, Postfix, setup, auth, audit, admin, messages and auth target guard |
| `npm run test:ui` | Vitest/React UI suite |
| `npm run test:postgres` | Isolated target PostgreSQL integration script, requires safe environment |
| `npm run db:validate` | Prisma model validation |
| `npm run build` | Next.js production build |

`tests/` contains namespaced suites: `auth`, `admin`, `audit`, `backup`, `dns`, `deployment`, `integration`, `mailserver`, `messages`, `operations`, `postfix`, `schema`, `setup`, and `ui`. `scripts/testing/` contains CI-only isolated host/mailserver rehearsal helpers.

## GitHub Actions boundaries

- `r06-production-readiness.yml`: read-only, runs selected code quality checks, disposable PostgreSQL/SMTP/LMTP/restore, dependency audit and a sanitized **NO-GO** report; repository conditional targets `vibtoolshq/ReadBox`.
- `readbox-backup-ci.yml`: BR-04 scoped tests, guarded branch/repository condition; not proof a real recovery was performed.
- `domain-auto01-ci.yml`, `dkim03-ci.yml`, `au01-ci.yml`, `qis01-ci.yml`: phase-specific CI, conditional triggers and exact scope.
- `readbox-first-release.yml`: specially gated **prerelease** metadata only; not a stable production deployment.

## Evidence levels

1. **Source present:** symbol/configuration or code path actually exists.
2. **Automated test PASS:** specific CI run, exact SHA, suite and exclusions documented.
3. **Operator live PASS:** observed PuTTY/UI result on named host/domain; does not prove independently captured network/storage state.
4. **Independent acceptance:** separately checked DNS/R2/TLS/restore, full negative cases, signed release gate.

2026-11-20 operator evidence documents the Manual Mode path and Gmail inbound at `vibmail.my` and `pypal.pl` as **scoped live PASS**. DKIM authoritative TXT, complete attachment hashes and R2 disaster recovery remain unaccepted. Preserve the 17 formal release gates in [production acceptance](https://github.com/vibtoolshq/ReadBox/blob/main/docs/PRODUCTION-ACCEPTANCE-RUNBOOK.md).

## Phase verification rule

Per `AGENTS.md`: one exact Scope Lock → one focused verification batch → one exact diff/security audit → evidence notes and clean commit/sync. Avoid test loops and do not rerun full production rehearsals for documentation-only changes. This documentation update itself cannot honestly claim a fresh Node/Docker/SMTP test run.

**Sources:** `package.json`, `.github/workflows/`, `tests/`, `scripts/testing/`, `AGENTS.md`.
