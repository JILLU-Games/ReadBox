# 005 — Actual Feature Implementation and Verified Working Tracker

**Frozen baseline:** `e28886e5e0f7a155cd64e23bc8ee8f6668d6699c`. **Implementation phases:** 1/6 CI VERIFIED; 5 remaining. **Release:** NO-GO.

## Terminology — critical distinction

- **CODE PRESENT**: exact implementation/source or configuration file exists; may have unit tests but not necessarily live.
- **CI VERIFIED**: inspected GitHub job demonstrated the stated subset at a specific tested SHA.
- **LIVE VERIFIED**: worked on a real configured staging/production VPS with mailserver and observed outcomes (**none granted** at baseline).
- **NOT DEPLOYED**: code template may exist but the published runtime Compose stack does not provision the service.
- **PLANNED**: not implemented. Never mark a proposed update as a current working feature.

## A. Currently present application code and evidence

| Feature ID | Feature / functionality actually in source | Exact path(s) | Verified level | Live VPS |
|---|---|---|---|---|
| F-01 | Next.js app routes, landing, user inbox and admin console | `src/app/page.tsx`, `src/app/(workspace)/users/**`, `src/app/(workspace)/vcon/**` | CODE PRESENT; build & 70 UI tests CI VERIFIED | UNVERIFIED |
| F-02 | Auth, route authorization, local account/reset/operator CLI | `src/auth.ts`, `src/core/auth/**`, `scripts/auth/operator.ts` | CODE PRESENT; focused CI unit/contract tests | UNVERIFIED |
| F-03 | PostgreSQL Prisma data client + migrations | `src/core/database/client.ts`, `prisma/schema.prisma`, `prisma/migrations/**` | CODE PRESENT; static Prisma validate CI VERIFIED | LIVE MIGRATION NOT VERIFIED |
| F-04 | Domains and managed mailbox provisioning | `src/core/domains/service.ts`, `src/core/mailboxes/service.ts` | CODE PRESENT; tests include admin contract | external SQL + Maildir unverified |
| F-05 | Single PostgreSQL mailserver schema + virtual map adapter | `src/core/mailserver/pg-adapter.ts`, `prisma/migrations/20261115000000_mailserver_schema_and_roles/migration.sql` | CODE PRESENT; adapter tests | external Postfix NOT DEPLOYED |
| F-06 | Filesystem path confinement, mailbox locks, Maildir tree | `src/core/mailboxes/paths.ts`, `src/core/mailboxes/provisioning.ts` | CODE PRESENT | vmail/nextjs identity unverified |
| F-07 | Incoming Maildir ingestion, MIME, attachment storage and counters | `src/workers/ingestion.ts`, `src/core/ingestion/**`, `scripts/mail/ingest.ts` | CODE PRESENT; unit tests | SMTP-to-inbox UNVERIFIED |
| F-08 | DNS suggestion/verification and DKIM public-key record reading | `src/core/dns/records.ts`, `src/core/dns/resolver.ts`, `src/core/dns/opendkim.ts` | CODE PRESENT | DNS publication and signer NOT DEPLOYED |
| F-09 | Admin operations/audit/retention/settings and user workspace | `src/core/operations/service.ts`, `src/core/audit/**`, `src/core/settings/**` | CODE PRESENT; subset CI tested | UNVERIFIED |
| F-10 | Health/readiness JSON endpoints and worker heartbeat logic | `src/core/health/snapshot.ts`, `src/app/health/live/route.ts`, `src/app/health/ready/route.ts` | CODE PRESENT | SMTP/LMTP readiness unverified |
| F-11 | Multi-stage production app Dockerfile and Compose definition | `Dockerfile`, `docker-compose.yml`, `entrypoint.sh` | CONFIG PRESENT; npm build passed, not image boot | UNVERIFIED |
| F-12 | Host-based recovery/update scripts and server templates | `scripts/ops/**`, `scripts/updater/**`, `deployment/templates/**` | SOURCE PRESENT | no Compose recovery/host installer proof |
| F-13 | Independent Postfix/Dovecot/LMTP mailserver binaries | production `docker-compose.yml` only lists postgres/web/worker | NOT DEPLOYED | NO |
| F-14 | SMTP submission/IMAP email-client services | `src/core/mailserver/pg-adapter.ts:274–275` disables password login; Dovecot template LMTP-only | NOT IN CURRENT PRODUCT PROOF | NO |

## B. Existing inspected CI run

**Source GitHub Actions:** https://github.com/JILLU-Games/ReadBox/actions/runs/44080430558

- `npm ci`: PASS (after fixed lockfile).
- `npm run db:validate`: PASS.
- `npm run lint` and `npm run typecheck`: PASS.
- `npm run test:unit`: 167 PASS, 0 failed.
- `npm run test:ui`: 70 PASS, 0 failed.
- `npm run build`: PASS.
- **Not established by this run:** production Docker image startup; `npm run test:postgres` with live disposable DB; real mail acceptance, Postfix/Dovecot, DNS/TLS, external reachability, reboot/restore; zero current dependency security advisories.

## C. Features or contract outcomes not proven before release

| Phase | Exact expected improvement (NOT YET WORKING-PROVEN) | State | Proof URL/commit when completed |
|---|---|---|---|
| R-01 | Production vs development Compose, secrets, reproducible Docker/dependency image, correct README | CI VERIFIED | https://github.com/JILLU-Games/ReadBox/actions/runs/44093204590 |
| R-02 | Working Postfix lookup/login role, schema parity, cross-UID Maildir permissions | NOT STARTED | — |
| R-03 | Operating SMTP→LMTP inbound mail flow, correct DNS/TLS/mailserver integration | NOT STARTED | — |
| R-04 | First-admin startup, trustworthy worker heartbeat, fail-closed readiness | NOT STARTED | — |
| R-05 | Tested container-aware encrypted/private backup, restore and update rollback | NOT STARTED | — |
| R-06 | Public inbound message + attachment acceptance on staging, release verification/GO | NOT STARTED | — |

## Per-phase actual-working append record (only after real verification)

```text
Phase:
Finding IDs:
What code was changed (exact paths):
What actually worked in CI (tested SHA/run URL):
What actually worked on VPS (timestamp/domain anonymized/log proof):
Negative cases and user-visible features that remained unchanged:
Remaining unverified / future improvements:
Source and mirrored SHA:
```

**No future features are marked complete.** The tracker must not be updated from code review alone to claim live production functionality.

## R-01 code-level working features (CI verified, NOT live VPS)

- Docker build uses immutable Node digest and one package-lock resolution. `prisma`, `tsx`, `dotenv` are available in runtime. App CI: https://github.com/JILLU-Games/ReadBox/actions/runs/44092311120.
- Default Compose defines `postgres`, `web`, `worker`; opt-in `compose.dev.yaml` preserves the development database setup.
- Docker entrypoint safely encodes arbitrary DB password symbols and fails on short DB/auth credentials. Docker and production npm audit CI: https://github.com/JILLU-Games/ReadBox/actions/runs/44093204590.
- Actual production VPS Postfix/Dovecot, mail receipt, real PostgreSQL migrations and disaster recovery: **NOT VERIFIED**. Existing UI, routes, auth behavior and messages unchanged.
