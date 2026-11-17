# 008 — R-01 Post-Implementation Audit and Evidence

**Date:** 2026-11-17
**Frozen baseline:** `73c6c4a47ee8f40c9de9070d260e7f9b746cc666`
**Tested source code commit:** `113663cdabacf1460af5b06a334d99ab3db833c2`
**Status:** R-01 CI VERIFIED CLOSED — **1/6 completed, 5 remaining**.
**Production SMTP/LMTP:** **NO-GO**; no live VPS installation or mail send/receive was performed.

## Exact changed paths and scope

| Source path | Patch | Scope |
|---|---|---|
| `compose.yaml` → `compose.dev.yaml` | Removes dev-only PostgreSQL from default production Compose selection | R-01 |
| `docker-compose.yml` | Supplies structured DB credentials to runtime rather than unsafe direct interpolation in DATABASE_URL | R-01 |
| `Dockerfile` | Root lockfile runtime graph, immutable Node image digest, and validated/encoded DB URL at startup | R-01 |
| `package.json`, `package-lock.json` | Next.js 16.4.5, fast-uri 3.1.9 and production prisma/tsx/dotenv runtime dependencies | R-01 |
| `.env.example`, `.dockerignore`, `README.md` | Standalone/Coolify secret guidance, explicit dev config and corrected install docs | R-01 |
| `tests/deployment/phase-r01-contract.test.mjs` | Static regression tests of default Compose, secrets and lockfile runtime | R-01 |
| `AGENTS.md` | Permanent user-requested single focused verification and Scope Lock rules | Explicit user-approved exception |

**Unchanged:** all `src/`, UI components/screens/layout/styles, authentication/business logic, Maildir ingestion algorithm, `prisma/`, Postfix/Dovecot templates, user messages and attachments. The temporary GitHub Actions workflow was deliberately excluded from the published application code tree.

## Exact bug fix caught in Docker smoke

Node's URL password setter did not escape a literal raw percent sign; this caused a URI parsing error even after a successful Docker build. The scoped Dockerfile patch now encodes the password before assigning it:

```js
url.password = encodeURIComponent(password);
```

This safely handles test credentials containing `%`, `@`, `#` and other URI-reserved characters. The final targeted test also rejects short DB/auth secrets and confirms runtime `tsx`/`prisma` availability.

## Evidence and truthful verification boundary

- Full app regression PASS **inside** earlier CI: https://github.com/JILLU-Games/ReadBox/actions/runs/44092311120 — npm ci, Prisma validate, ESLint, TypeScript, 167 unit and 70 UI tests, Next.js build. That run's Docker smoke failed and led to the targeted bugfix.
- Final focused deployment/security CI SUCCESS: https://github.com/JILLU-Games/ReadBox/actions/runs/44093204590 — npm audit on production dependencies, base Node digest resolution, production Docker image build, correct Compose services, URI-encoded password smoke and negative secret tests.
- The final change since the full app regression modified **only Dockerfile, targeted deployment test and temporary CI workflow**.
- No real PostgreSQL migration, SMTP/LMTP, TLS, DNS, VPS, backup/restore or published release verified in R-01.
- **Conclusion:** seven R-01 findings CI closed, 25 findings remain; overall production mailserver NO-GO.

## Next: R-02 (separate approval required)

R-02 owns one PostgreSQL/Postfix virtual SQL lookup contract, least-privilege login role, expected schema/migration verification, and Maildir UID/GID/ACL compatibility across web/worker/delivery. Exact file allowlist is in [002-PRODUCTION-PHASE-ROADMAP.md](002-PRODUCTION-PHASE-ROADMAP.md). No application UI/UX/features outside that Scope Lock are authorized.
