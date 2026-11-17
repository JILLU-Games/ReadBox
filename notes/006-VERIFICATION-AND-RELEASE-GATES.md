# 006 — Verification, Regression, Production Release & Rollback Gates

**Frozen baseline:** `e28886e5e0f7a155cd64e23bc8ee8f6668d6699c`. **Release status: NO-GO.** All future mail/VPS/restore gates are **NOT RUN** at freeze.

## Historic test evidence — do not confuse with production proof

| Gate | Historic result | GitHub Actions evidence | Does not prove |
|---|---|---|---|
| `npm ci` | PASS after FA-M01 lockfile correction | https://github.com/JILLU-Games/ReadBox/actions/runs/44080430558 | Docker runtime |
| `npm run db:validate` | PASS | Same run | live database migration |
| `npm run lint`, `npm run typecheck` | PASS | Same run | server security |
| `npm run test:unit` | 167 PASS | Same run | SMTP/LMTP delivery |
| `npm run test:ui` | 70 PASS | Same run | real inbound mail |
| `npm run build` | PASS | Same run | Docker image start |
| `npm run test:postgres` | NOT EXECUTED in that CI | Separate `package.json` script | live PostgreSQL |
| Production Docker image boot | NOT VERIFIED | no completed evidence in inspected runner | production readiness |

## Exactly one focused CI verification per approved phase

- **R-01:** production Compose selection, missing secret and password-URL negative cases, lockfile CI build, npm security audit and image provenance.
- **R-02:** disposable PostgreSQL migration replay, role/virtual map positive + negative SQL tests, Maildir delivery/app UID/ACL checks.
- **R-03:** disposable Postfix/Dovecot syntax, SMTP receipt and LMTP Maildir delivery, unknown recipient rejection, DNS/TLS contract.
- **R-04:** clean DB bootstrap, correct administrator identity check, unavailable/stale worker and failing DB/storage readiness, auth negatives, normal recovery.
- **R-05:** isolated backup/restore/rollback, data and ACL integrity, secrets handling, upgrades and downtime/availability evidence.
- **R-06:** consolidated source/mirror CI plus separately authorized live staging VPS acceptance, real DNS/port/TLS/SMTP/LMTP/mailbox, rollback and license/security review.

### Example checks, NOT executed in this documentation phase

```bash
npm ci
npm run db:validate
npm run lint
npm run typecheck
npm run test:unit
npm run test:ui
npm run build

# Explicit production file; do NOT use implicit compose.yaml development config.
docker compose -f docker-compose.yml config
docker compose -f docker-compose.yml build web worker

# Only with an isolated, disposable PostgreSQL test target:
npm run test:postgres
```

The target SHA, sanitized log, positive/negative result and command exit code must be recorded. A successful Compose parse is not proof of a running mailserver. Tests against production user data are forbidden.

## R-06 formal release GO gates

| Gate | Exact required evidence | Current |
|---|---|---|
| RG-01 | 32 audit IDs reconciled; zero open P0; all residual P1/P2 assessed | OPEN |
| RG-02 | Source and target same release SHA/tree; version and immutable image digest | NOT RUN |
| RG-03 | CI build, all tests, dependency audit at **actual release SHA** | NOT RUN |
| RG-04 | No dev Compose/default password; correct secure environment on chosen VPS/Coolify | NOT RUN |
| RG-05 | Running web/worker containers, fresh PostgreSQL migrations, persisted volumes and healthy restart | NOT RUN |
| RG-06 | Single PostgreSQL and actual Postfix SQL login + views, no unauthorized DB access | NOT RUN |
| RG-07 | Postfix TCP/25/SMTP and Dovecot LMTP routing work with canonical Maildir and UID/GID | NOT RUN |
| RG-08 | Actual public MX/A/AAAA/PTR + provider port 25 + host firewall checked externally | NOT RUN |
| RG-09 | Trusted web/mail TLS, certificate renewal and applicable DKIM operation | NOT RUN |
| RG-10 | External inbound mail accepted → Maildir original → worker indexed → inbox displayed → attachment accessible | NOT RUN |
| RG-11 | Unknown/disabled recipient rejection, MIME limits and no accepted-but-lost messages | NOT RUN |
| RG-12 | First-admin safe bootstrap, unauthorized route rejection and reset-token expiry | NOT RUN |
| RG-13 | Worker/DB/storage outages fail closed; recover without duplication or mail loss | NOT RUN |
| RG-14 | Backup confidentiality, restored DB/Maildir/attachments, hashes, ownership/ACL, rollback and downtime evidence | NOT RUN |
| RG-15 | Observability, logs/redaction, capacity, storage limits, alert/runbook and security checks | NOT RUN |
| RG-16 | MIT root vs AGPL reference license provenance and current advisories reviewed | NOT RUN |
| RG-17 | Final CI/job, live staging logs, release approver and explicit GO/NO-GO | NOT RUN |

**NO-GO triggers:** any open P0, broken secrets/migrations, SMTP/LMTP not working, no real DNS/port evidence, unsafe Maildir permissions, missed incoming mail, untested restore, false worker readiness or source-target mismatch. `NOT RUN` and `SKIPPED` never count as PASS. No production release unless all mandatory gates have objective evidence.

## Standard evidence and rollback records

```text
Gate ID / Phase / tested exact SHA:
Git tree and Docker image digest:
CI or staging environment (no raw credentials):
Test input incl. negative case:
Expected vs actual result:
Exit code/HTTP/SMTP reply and sanitized logs/artifact URL:
Maildir file ID and message/attachment integrity if applicable:
Reboot/restore/rollback and uptime result:
PASS / FAIL / SKIPPED / NOT RUN:
Author and timestamp:
```

Rollback contracts: no modifications to applied migrations; backup before changing data; retained original Maildir; only reversible image/config changes; retain database compatibility; no destructive release tests against production. A failed phase stays blocked—never silently release or auto-publish.
