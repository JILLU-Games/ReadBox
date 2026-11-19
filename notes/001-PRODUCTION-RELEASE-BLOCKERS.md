# 001 — Production Blocker Ledger & Exact Baseline Code Proof

> **MANUAL MODE FORENSIC RECONCILIATION (2026-11-19):** Latest manual-checkbox request is a **separate small feature** with findings MM-01 (dedicated checkbox missing), MM-03 (foreign-zone A/AAAA export risk); MM-02/04/05 are existing manual-save/DKIM/zone-download capabilities. [Exact frozen source proof and proposed patch](manual-mode/001-FORENSIC-AUDIT-AND-CODE-PROOF.md). Three automatic domain results are operator/chat recorded; do not describe all domain onboarding as NOT RUN. **Do not add these MM IDs to the 32 original release findings** or change the existing seven OPEN statuses without formal independent evidence.


> **LATEST AUTHORITATIVE RECONCILIATION — 2026-11-19.** **Source freeze (2026-11-19 Asia/Dhaka):** authoritative `vibtoolshq/ReadBox/main` 6f3bc1e3aeb441956e1fd0f4d81558a6aba2945f; tree `f82b07b6e0770850edd3431f041d5162848d442a`. Last full disposable Primary R06 CI ran against executable code 4d0b124af57c8d407bf609540b8b8b7a69a479b5: [run #44509947742](https://github.com/vibtoolshq/ReadBox/actions/runs/44509947742), SUCCESS. Compare 4d0b124af57c8d407bf609540b8b8b7a69a479b5..6f3bc1e3aeb441956e1fd0f4d81558a6aba2945f: **one documentation-only commit changing notes/003–006**, no executable change. At freeze time both dedicated backup refs `backup/dns-final-primary-20261119` matched 6f3bc1e3aeb441956e1fd0f4d81558a6aba2945f (2/2); backup repositories' separate `main` branches did not. **This new notes-only commit will advance Primary HEAD beyond the freeze; do not claim backup parity at that new HEAD without a new remote readback.** Historical source snapshots below are preserved and must not be mistaken for current source. Production remains **NO-GO**: 32 original findings, 25 CI-contract verified and 7 OPEN; 17 independently accepted production gates not evidenced. Historical R-01–R-06: 6/6 CI implemented. NEXT-01 and NEXT-02: 2/4 completed; NEXT-03 and NEXT-04: 2/4 pending. Detailed, immutable code excerpts and line links: [017](017-CURRENT-FORENSIC-PATCH-REFERENCES-2026-11-19.md); executable step/closure contract: [018](018-PHASE-EXECUTION-AND-CLOSURE-TEMPLATE.md). Earlier dated statements are retained as history, not latest status.


> **CURRENT FORENSIC RECONCILIATION (2026-11-19):** Authoritative Primary `vibtoolshq/ReadBox/main` = `3dfac11f46165c262c3dc5ddb7e82563a56f9a7f`. All **32 original finding records below stay intact**; 25 CI-contract verified and **7 OPEN**. New present-day checks, root cause, exact source proof and phase ownership are appended below as supplemental RN-xx observations. The old baseline excerpts remain immutable historical code proof, not a claim that today's files have the same line content. **Formal production GO: NO.**


**Baseline SHA:** `e28886e5e0f7a155cd64e23bc8ee8f6668d6699c`, **tree:** `9a3d935cfc66bcfc1f5f717d77b99bfd3006d63c`.
**Audit reconciliation:** **32 / 32** original findings = **6 P0 + 16 P1 + 10 P2**. **7 OPEN; 25 CI-CONTRACT VERIFIED (7 R-01 + 4 R-02 + 4 R-03 + 6 R-04 + 4 R-05). Public TLS/DNS/VPS, real offsite retention and host-mode recovery remain NO-GO.**
**Primary source:** [VPS production forensic audit](VPS-PRODUCTION-FORENSIC-AUDIT-2026-11-17.md).
**Status:** R-01 through R-06 IMPLEMENTATION CI VERIFIED (6/6); final R-06 LIVE ACCEPTANCE BLOCKED without separate staging authorization. The same 7 original findings, including 3 R-06-owned, remain OPEN. Production release NO-GO.

Every record below has **one owner phase**, exact source filename and GitHub line permalink at the immutable baseline, source-verbatim code excerpt (with line numbers), finding/impact from the original audit and a required future outcome. Absence of a service or missing live proof is established by the whole repository/configuration and original audit; a short code excerpt alone cannot prove absence. `CONFIRMED` is static evidence, `UNVERIFIED` is lack of live proof, not a witnessed runtime error.

## Full 32-finding register

### RB-P0-01 — Default Docker Compose starts the wrong stack
- **Owner:** R-01. **Baseline assessment:** CONFIRMED. **Current state:** VERIFIED CLOSED (R-01 CI; live unverified).
- **Audit evidence:** `compose.yaml:1–41` defines `postgres` and optional `postgres-test` only, with a development-only password. `docker-compose.yml:12–165` separately defines `postgres`, `web` and `worker`. `README.md:194–229` instructs `docker compose up -d` without specifying a file. Docker Compose prioritizes `compose.yaml` over legacy `docker-compose.yml` when both exist (Docker documentation: https://docs.docker.com/compose/intro/compose-application-model/).
- **Impact:** Following the published quick-start does not start the web application or Maildir worker and can select the development database configuration.
- **Required outcome before closure:** Explicit production Compose entrypoint, never default to development DB.
- **Exact immutable source:** [`compose.yaml:L2-L9`](https://github.com/vibtoolshq/ReadBox/blob/e28886e5e0f7a155cd64e23bc8ee8f6668d6699c/compose.yaml#L2-L9).

```yaml
  2 | services:
  3 |   postgres:
  4 |     image: postgres:16.14-alpine
  5 |     environment:
  6 |       POSTGRES_DB: mailstack_dev
  7 |       POSTGRES_USER: mailstack
  8 |       POSTGRES_PASSWORD: local-development-only
  9 |     ports:
```

- **Scope Lock:** ONLY R-01 allowlisted files and named contract in [002](002-PRODUCTION-PHASE-ROADMAP.md). No unrelated UI/app/schema/runtime modifications; status closed by focused R-01 CI evidence in [003](003-PHASE-PROGRESS-AND-CHANGE-LOG.md) and [006](006-VERIFICATION-AND-RELEASE-GATES.md).

### RB-P0-02 — SMTP/MTA and mailbox-delivery services absent from production Compose
- **Owner:** R-03. **Baseline assessment:** CONFIRMED. **Current state:** CI VERIFIED CLOSED (opt-in SMTP+LMTP container integration delivered a real message to Maildir; public VPS unverified).
- **Audit evidence:** `docker-compose.yml:12–165` has exactly `postgres`, `web` and `worker`; web only `expose`s port 3000; no Postfix, Dovecot/LMTP, DKIM signer, SMTP service or published port 25/465/587. The README architectural diagram (`README.md:149–189`) assumes an independently running Postfix + Dovecot system.
- **Impact:** A newly deployed VPS does not become an Internet-facing mail-receiving server merely by starting this Compose stack; externally arriving SMTP cannot be handled by these containers.
- **Required outcome before closure:** Tested Postfix SMTP + Dovecot LMTP integration, supported ingress/ports.
- **Exact immutable source:** [`docker-compose.yml:L12-L18`](https://github.com/vibtoolshq/ReadBox/blob/e28886e5e0f7a155cd64e23bc8ee8f6668d6699c/docker-compose.yml#L12-L18).

```text
 12 | services:
 13 |   postgres:
 14 |     image: postgres:16.14-alpine
 15 |     restart: unless-stopped
 16 |     environment:
 17 |       POSTGRES_USER: ${POSTGRES_USER:-readbox}
 18 |       POSTGRES_PASSWORD: ${SERVICE_PASSWORD_DB:?Coolify auto-generates SERVICE_PASSWORD_DB}
```

- **Scope Lock:** ONLY R-03 allowlisted files and named contract in [002](002-PRODUCTION-PHASE-ROADMAP.md). No unrelated UI/app/schema/runtime modifications; status remains OPEN until evidence is recorded in [003](003-PHASE-PROGRESS-AND-CHANGE-LOG.md) and [006](006-VERIFICATION-AND-RELEASE-GATES.md).

### RB-P0-03 — Published Postfix lookup template cannot reach the Compose database as configured
- **Owner:** R-02. **Baseline assessment:** CONFIRMED CONFIGURATION CONFLICT. **Current state:** CI CONTRACT VERIFIED (role and SQL endpoint tested on isolated PostgreSQL; external Postfix/VPS not deployed).
- **Audit evidence:** `deployment/templates/postfix/pgsql-virtual-{domains,mailboxes,aliases}.cf.tpl:1–5` hardcode `hosts = 127.0.0.1` and expect a credentialed `POSTFIX_DB_USER`. `docker-compose.yml:13–30` defines PostgreSQL only inside `readbox_internal` with no host port published; the app connects using hostname `postgres` (`docker-compose.yml:48,134`).
- **Impact:** Host-installed or separately containerized Postfix using the supplied template has no configured network route to this PostgreSQL endpoint. The template cannot be treated as a working production mail-routing integration.
- **Required outcome before closure:** Postfix SQL map reaches one authenticated least-privilege PostgreSQL endpoint.
- **Exact immutable source:** [`deployment/templates/postfix/pgsql-virtual-domains.cf.tpl:L1-L5`](https://github.com/vibtoolshq/ReadBox/blob/e28886e5e0f7a155cd64e23bc8ee8f6668d6699c/deployment/templates/postfix/pgsql-virtual-domains.cf.tpl#L1-L5).

```text
  1 | user = {{POSTFIX_DB_USER}}
  2 | password = {{POSTFIX_DB_PASSWORD}}
  3 | hosts = 127.0.0.1
  4 | dbname = {{PG_DB_NAME}}
  5 | query = SELECT name FROM mailserver.postfix_virtual_domains WHERE name = LOWER('%s')
```

- **Scope Lock:** ONLY R-02 allowlisted files and named contract in [002](002-PRODUCTION-PHASE-ROADMAP.md). No unrelated UI/app/schema/runtime modifications; status remains OPEN until evidence is recorded in [003](003-PHASE-PROGRESS-AND-CHANGE-LOG.md) and [006](006-VERIFICATION-AND-RELEASE-GATES.md).

### RB-P0-04 — Maildir ownership/permissions contract incomplete across web, worker and MTA
- **Owner:** R-02. **Baseline assessment:** CONFIRMED INTEGRATION RISK. **Current state:** CI CONTRACT VERIFIED (UID/GID=1001 and fail-closed Maildir provisioning; Dovecot live delivery unverified).
- **Audit evidence:** `Dockerfile:42–63,82` creates and runs as `nextjs`, UID/GID 1001. `src/core/mailboxes/provisioning.ts:126–160` creates mailbox/Maildir paths with `0700` permissions and no explicit ownership mapping to a mail delivery identity. `deployment/templates/dovecot/99-vibmail.conf.tpl:6–18` uses `vmail` identity. `docker-compose.yml:96–102,153–159` shares named volumes only between web/worker; neither an external Postfix/Dovecot volume mount nor UID/GID contract is supplied.
- **Impact:** Unless the external mail delivery process shares the precise UID or an equivalent permission contract, it cannot traverse/write the newly created Maildir. Mail receipt may fail even if DNS and Postfix are otherwise configured.
- **Required outcome before closure:** App/worker/delivery-agent Maildir access tested under explicit UID/GID/ACL.
- **Exact immutable source:** [`Dockerfile:L80-L84`](https://github.com/vibtoolshq/ReadBox/blob/e28886e5e0f7a155cd64e23bc8ee8f6668d6699c/Dockerfile#L80-L84).

```dockerfile
 80 | ENV DOCKER_RUNTIME=true
 81 |
 82 | USER nextjs
 83 |
 84 | EXPOSE 3000
```

- **Scope Lock:** ONLY R-02 allowlisted files and named contract in [002](002-PRODUCTION-PHASE-ROADMAP.md). No unrelated UI/app/schema/runtime modifications; status remains OPEN until evidence is recorded in [003](003-PHASE-PROGRESS-AND-CHANGE-LOG.md) and [006](006-VERIFICATION-AND-RELEASE-GATES.md).

### RB-P0-05 — No executable end-to-end installation of the external mailserver
- **Owner:** R-03. **Baseline assessment:** CONFIRMED. **Current state:** CI VERIFIED CLOSED (Docker Compose opt-in mailserver provisioned and syntax/delivery tests passed).
- **Audit evidence:** `deployment/templates/postfix/*.tpl`, `deployment/templates/dovecot/99-vibmail.conf.tpl`, `deployment/templates/systemd/vibmail-*.service.tpl` and `deployment/templates/nginx/app.conf.tpl` contain unresolved template values/legacy host paths; no root-level production mailserver installer or Compose service applies these templates, provisions `vmail`, installs system packages, wires LMTP/SQL socket contracts or starts mailserver services. `scripts/ops/backup.sh` and updater scripts presuppose such a host installation.
- **Impact:** Repository cloning + app container deployment cannot complete Postfix/Dovecot/mail-server setup from the committed artifacts alone.
- **Required outcome before closure:** Repeatable Postfix/Dovecot provisioning and syntax/routing tests.
- **Exact immutable source:** [`deployment/templates/dovecot/99-vibmail.conf.tpl:L13-L20`](https://github.com/vibtoolshq/ReadBox/blob/e28886e5e0f7a155cd64e23bc8ee8f6668d6699c/deployment/templates/dovecot/99-vibmail.conf.tpl#L13-L20).

```text
 13 | mail_home = /var/vmail/%Ld/%Ln
 14 | mail_location = maildir:/var/vmail/%Ld/%Ln/Maildir
 15 |
 16 | userdb {
 17 |   driver = static
 18 |   args = uid=vmail gid=vmail home=/var/vmail/%Ld/%Ln
 19 | }
 20 |
```

- **Scope Lock:** ONLY R-03 allowlisted files and named contract in [002](002-PRODUCTION-PHASE-ROADMAP.md). No unrelated UI/app/schema/runtime modifications; status remains OPEN until evidence is recorded in [003](003-PHASE-PROGRESS-AND-CHANGE-LOG.md) and [006](006-VERIFICATION-AND-RELEASE-GATES.md).

### RB-P0-06 — No independently observed live SMTP acceptance-to-inbox acceptance proof
- **Owner:** R-06. **Baseline assessment:** UNVERIFIED RELEASE GATE. **Current state:** OPEN.
- **Audit evidence:** `package.json` defines unit, UI and a separate `test:postgres` entry but not a complete SMTP/MX/LMTP/Maildir-to-inbox live acceptance test. The reviewed successful Actions job executed npm checks/build, not a production VPS with DNS, port 25, live Postfix and Dovecot.
- **Impact:** No trustworthy production GO can be issued for real inbound messages, multi-domain delivery, attachments or mailserver resilience from the existing evidence.
- **Required outcome before closure:** External SMTP→LMTP→Maildir→inbox acceptance and negative tests recorded.
- **Exact immutable source:** [`package.json:L23-L25`](https://github.com/vibtoolshq/ReadBox/blob/e28886e5e0f7a155cd64e23bc8ee8f6668d6699c/package.json#L23-L25).

```json
 23 |     "test:auth:target-guard": "node --import tsx --test tests/auth/postgres-target.test.ts",
 24 |     "test:postgres": "node --conditions=react-server --import tsx scripts/testing/postgres-integration.ts",
 25 |     "mail:ingest": "node --conditions=react-server --import tsx scripts/mail/ingest.ts",
```

- **Scope Lock:** ONLY R-06 allowlisted files and named contract in [002](002-PRODUCTION-PHASE-ROADMAP.md). No unrelated UI/app/schema/runtime modifications; status remains OPEN until evidence is recorded in [003](003-PHASE-PROGRESS-AND-CHANGE-LOG.md) and [006](006-VERIFICATION-AND-RELEASE-GATES.md).

### RB-P1-01 — Standalone Compose cannot run from unconfigured sample secrets
- **Owner:** R-01. **Baseline assessment:** CONFIRMED. **Current state:** VERIFIED CLOSED (R-01 CI; live unverified).
- **Audit evidence:** `docker-compose.yml:18,53,134,136` requires `SERVICE_PASSWORD_DB` and `SERVICE_BASE64_64_SECRET`; `.env.example:9–11,29–30` leaves them empty. Automatic generation is a Coolify convention, not native standalone Docker Compose behavior.
- **Impact:** An unconfigured standalone installation is rejected during Compose variable validation. Published "copy .env + up" instructions are not sufficient.
- **Required outcome before closure:** Production secrets validated and safely initialized/persisted per deployment mode.
- **Exact immutable source:** [`docker-compose.yml:L16-L20`](https://github.com/vibtoolshq/ReadBox/blob/e28886e5e0f7a155cd64e23bc8ee8f6668d6699c/docker-compose.yml#L16-L20).

```text
 16 |     environment:
 17 |       POSTGRES_USER: ${POSTGRES_USER:-readbox}
 18 |       POSTGRES_PASSWORD: ${SERVICE_PASSWORD_DB:?Coolify auto-generates SERVICE_PASSWORD_DB}
 19 |       POSTGRES_DB: ${POSTGRES_DB:-readbox}
 20 |     volumes:
```

- **Scope Lock:** ONLY R-01 allowlisted files and named contract in [002](002-PRODUCTION-PHASE-ROADMAP.md). No unrelated UI/app/schema/runtime modifications; status closed by focused R-01 CI evidence in [003](003-PHASE-PROGRESS-AND-CHANGE-LOG.md) and [006](006-VERIFICATION-AND-RELEASE-GATES.md).

### RB-P1-02 — README environment variables and service names diverge from the running configuration
- **Owner:** R-01. **Baseline assessment:** CONFIRMED. **Current state:** VERIFIED CLOSED (R-01 CI; live unverified).
- **Audit evidence:** `README.md:208–229,275–291` refers to `NEXTAUTH_SECRET`, `app`, `db`, Next.js 15 and older storage variable names. Actual Compose uses `AUTH_SECRET` supplied from `SERVICE_BASE64_64_SECRET`, services `web`/`postgres`, and current `package.json` has Next.js **16.4.2**.
- **Impact:** Direct copy/paste may misconfigure authentication, database access and runtime deployment.
- **Required outcome before closure:** Correct README instructions/env names/service names/framework version.
- **Exact immutable source:** [`README.md:L209-L214`](https://github.com/vibtoolshq/ReadBox/blob/e28886e5e0f7a155cd64e23bc8ee8f6668d6699c/README.md#L209-L214).

```text
209 | ```dotenv
210 | DATABASE_URL="postgresql://readbox_app:StrongPassword123@db:5432/readbox?schema=public"
211 | NEXTAUTH_SECRET="your-32-char-random-secret-key-here"
212 | MAIL_DOMAIN="yourdomain.com"
213 | APP_HOSTNAME="mail.yourdomain.com"
214 | ```
```

- **Scope Lock:** ONLY R-01 allowlisted files and named contract in [002](002-PRODUCTION-PHASE-ROADMAP.md). No unrelated UI/app/schema/runtime modifications; status closed by focused R-01 CI evidence in [003](003-PHASE-PROGRESS-AND-CHANGE-LOG.md) and [006](006-VERIFICATION-AND-RELEASE-GATES.md).

### RB-P1-03 — First administrator bootstrapping is not wired into Compose startup
- **Owner:** R-04. **Baseline assessment:** CONFIRMED. **Current state:** CI VERIFIED CLOSED (manual explicit production bootstrap command supported; disposable database first-admin once, no default credential or live VPS).
- **Audit evidence:** `entrypoint.sh:1–42` creates storage paths, runs migrations and starts the passed process; it does not create an operator account. `scripts/auth/operator.ts:39–76` is an interactive privileged CLI bootstrap. `src/core/auth/operator-bootstrap.ts:23–67` creates the first admin-capable user and a one-time token.
- **Impact:** Deploying containers does not automatically complete authenticated first-admin setup; login readiness depends on an additional operator action.
- **Required outcome before closure:** Secure first-admin operator bootstrap verified on clean DB.
- **Exact immutable source:** [`entrypoint.sh:L37-L41`](https://github.com/vibtoolshq/ReadBox/blob/e28886e5e0f7a155cd64e23bc8ee8f6668d6699c/entrypoint.sh#L37-L41).

```bash
 37 | fi
 38 |
 39 | echo "[entrypoint] Starting ReadBox process ($*)..."
 40 | exec "$@"
 41 |
```

- **Scope Lock:** ONLY R-04 allowlisted files and named contract in [002](002-PRODUCTION-PHASE-ROADMAP.md). No unrelated UI/app/schema/runtime modifications; status remains OPEN until evidence is recorded in [003](003-PHASE-PROGRESS-AND-CHANGE-LOG.md) and [006](006-VERIFICATION-AND-RELEASE-GATES.md).

### RB-P1-04 — Setup inspection checks a different administrator table from the bootstrap path
- **Owner:** R-04. **Baseline assessment:** CONFIRMED LOGIC MISMATCH. **Current state:** CI VERIFIED CLOSED (admin login and inspector use active superuser admin_accounts source).
- **Audit evidence:** `src/core/auth/operator-bootstrap.ts:45–64` creates a `user` and an `administratorProfile`. `src/core/setup/trusted-operations.ts:397–418` checks only `adminAccount.count()` for the "administrator-created" step.
- **Impact:** A valid first administrator created via the project CLI can be misreported as missing by setup verification (false-negative), depending on whether a separate legacy admin row exists.
- **Required outcome before closure:** Setup verification checks the admin identity the bootstrap actually creates.
- **Exact immutable source:** [`src/core/setup/trusted-operations.ts:L401-L406`](https://github.com/vibtoolshq/ReadBox/blob/e28886e5e0f7a155cd64e23bc8ee8f6668d6699c/src/core/setup/trusted-operations.ts#L401-L406).

```ts
401 |     try {
402 |       if (typeof resolvedClient.adminAccount?.count === "function") {
403 |         const count = await resolvedClient.adminAccount.count();
404 |         adminCreated = count > 0;
405 |         adminDetail = adminCreated
406 |           ? `Found ${count} admin account(s)`
```

- **Scope Lock:** ONLY R-04 allowlisted files and named contract in [002](002-PRODUCTION-PHASE-ROADMAP.md). No unrelated UI/app/schema/runtime modifications; status remains OPEN until evidence is recorded in [003](003-PHASE-PROGRESS-AND-CHANGE-LOG.md) and [006](006-VERIFICATION-AND-RELEASE-GATES.md).

### RB-P1-05 — HTTP liveness does not prove database, migration or mail readiness
- **Owner:** R-04. **Baseline assessment:** CONFIRMED. **Current state:** CI VERIFIED CLOSED (web liveness and worker full application readiness separated; public mailserver GO is not implied).
- **Audit evidence:** `docker-compose.yml:104–109` and `Dockerfile:85–87` check `/health/live`; `src/app/health/ready/route.ts:8–15` and `src/core/health/snapshot.ts:69–180` contain the stronger readiness probe.
- **Impact:** A green container status may coexist with broken migrations, unavailable mail storage or a failing worker.
- **Required outcome before closure:** Separate liveness/readiness promotion; don't call green process status a mailserver GO.
- **Exact immutable source:** [`docker-compose.yml:L103-L107`](https://github.com/vibtoolshq/ReadBox/blob/e28886e5e0f7a155cd64e23bc8ee8f6668d6699c/docker-compose.yml#L103-L107).

```text
103 |       - readbox_internal
104 |     healthcheck:
105 |       test: ["CMD", "node", "-e", "fetch('http://127.0.0.1:3000/health/live').then((r) => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"]
106 |       interval: 30s
107 |       timeout: 5s
```

- **Scope Lock:** ONLY R-04 allowlisted files and named contract in [002](002-PRODUCTION-PHASE-ROADMAP.md). No unrelated UI/app/schema/runtime modifications; status remains OPEN until evidence is recorded in [003](003-PHASE-PROGRESS-AND-CHANGE-LOG.md) and [006](006-VERIFICATION-AND-RELEASE-GATES.md).

### RB-P1-06 — Default readiness policy can accept missing worker heartbeat
- **Owner:** R-04. **Baseline assessment:** CONFIRMED. **Current state:** CI VERIFIED CLOSED (missing/stale/future/degraded heartbeat fails production readiness even when configured false).
- **Audit evidence:** `docker-compose.yml:88` sets `REQUIRE_INGESTION_READY=false`; `src/core/health/snapshot.ts:80–81,111–130,145–158` initializes ingestion as `unknown` and in non-required mode blocks only specific degraded/stale/unavailable values.
- **Impact:** `/health/ready` can report ready without proof that a mail ingestion heartbeat has ever been received.
- **Required outcome before closure:** Missing/stale worker heartbeat yields not-ready under production policy.
- **Exact immutable source:** [`src/core/health/snapshot.ts:L145-L153`](https://github.com/vibtoolshq/ReadBox/blob/e28886e5e0f7a155cd64e23bc8ee8f6668d6699c/src/core/health/snapshot.ts#L145-L153).

```ts
145 |     ingestionStatus === "stale" ||
146 |     ingestionStatus === "degraded" ||
147 |     ingestionStatus === "unavailable";
148 |   const ingestionGateOk = runtimeEnv.requireIngestionReady
149 |     ? mailServicesConnected
150 |     : !ingestionDegradedOrStale;
151 |
152 |   const ready =
153 |     configuration.ok &&
```

- **Scope Lock:** ONLY R-04 allowlisted files and named contract in [002](002-PRODUCTION-PHASE-ROADMAP.md). No unrelated UI/app/schema/runtime modifications; status remains OPEN until evidence is recorded in [003](003-PHASE-PROGRESS-AND-CHANGE-LOG.md) and [006](006-VERIFICATION-AND-RELEASE-GATES.md).

### RB-P1-07 — Worker container health verifies process presence, not successful ingestion
- **Owner:** R-04. **Baseline assessment:** CONFIRMED. **Current state:** CI VERIFIED CLOSED (worker healthcheck checks process plus app readiness/ingestion heartbeat; VPS recovery unverified).
- **Audit evidence:** `docker-compose.yml:160–164` uses `pgrep -f 'scripts/mail/ingest.ts'`, while `src/workers/ingestion.ts` supports degraded heartbeat/error reporting.
- **Impact:** Worker may be marked healthy when polling is stuck, mail storage is inaccessible, or ingestion errors persist. No full operational SLO proof is present.
- **Required outcome before closure:** Worker health uses fresh ingestion/progress evidence.
- **Exact immutable source:** [`docker-compose.yml:L159-L163`](https://github.com/vibtoolshq/ReadBox/blob/e28886e5e0f7a155cd64e23bc8ee8f6668d6699c/docker-compose.yml#L159-L163).

```text
159 |       - readbox_internal
160 |     healthcheck:
161 |       test: ["CMD-SHELL", "pgrep -f 'scripts/mail/ingest.ts' >/dev/null || exit 1"]
162 |       interval: 30s
163 |       timeout: 5s
```

- **Scope Lock:** ONLY R-04 allowlisted files and named contract in [002](002-PRODUCTION-PHASE-ROADMAP.md). No unrelated UI/app/schema/runtime modifications; status remains OPEN until evidence is recorded in [003](003-PHASE-PROGRESS-AND-CHANGE-LOG.md) and [006](006-VERIFICATION-AND-RELEASE-GATES.md).

### RB-P1-08 — Postfix DB login role provisioning incomplete
- **Owner:** R-02. **Baseline assessment:** CONFIRMED. **Current state:** CI CONTRACT VERIFIED (LOGIN role, SCRAM password, positive/negative permission tests).
- **Audit evidence:** `prisma/migrations/20261115000000_mailserver_schema_and_roles/migration.sql:103–128` creates `postfix_lookup NOLOGIN` and grants read privileges; `deployment/templates/postfix/pgsql-virtual-*.cf.tpl:1–5` expects a separate login username/password. There is no verified automatically created login principal, secret, network access rule or executable map-file deployment in the production stack.
- **Impact:** Even with migrated tables, the Postfix virtual-lookup contract is not fully operational.
- **Required outcome before closure:** Dedicated Postfix LOGIN role, grants and connection tested.
- **Exact immutable source:** [`prisma/migrations/20261115000000_mailserver_schema_and_roles/migration.sql:L105-L110`](https://github.com/vibtoolshq/ReadBox/blob/e28886e5e0f7a155cd64e23bc8ee8f6668d6699c/prisma/migrations/20261115000000_mailserver_schema_and_roles/migration.sql#L105-L110).

```sql
105 |   IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'postfix_lookup') THEN
106 |     BEGIN
107 |       CREATE ROLE "postfix_lookup" NOLOGIN;
108 |     EXCEPTION WHEN insufficient_privilege THEN
109 |       NULL;
110 |     END;
```

- **Scope Lock:** ONLY R-02 allowlisted files and named contract in [002](002-PRODUCTION-PHASE-ROADMAP.md). No unrelated UI/app/schema/runtime modifications; status remains OPEN until evidence is recorded in [003](003-PHASE-PROGRESS-AND-CHANGE-LOG.md) and [006](006-VERIFICATION-AND-RELEASE-GATES.md).

### RB-P1-09 — DKIM signing, TLS and external DNS are not provisioned
- **Owner:** R-03. **Baseline assessment:** CONFIRMED MISSING STACK / UNVERIFIED EXTERNALS. **Current state:** OPEN external acceptance (CI STARTTLS with ephemeral certificate passes; production trusted TLS, renewal, DNS and DKIM signer are NOT provisioned; signer is outside inbound-only scope).
- **Audit evidence:** `src/core/dns/opendkim.ts:52–66` only reads an already existing `mail.txt`; `docker-compose.yml` only mounts a named key volume and provides no OpenDKIM signing daemon or key-generation lifecycle; Nginx template `deployment/templates/nginx/app.conf.tpl:36–42` references external Let's Encrypt certificate files. `src/core/dns/records.ts:45–109` computes suggested DNS values rather than publishing them.
- **Impact:** The stack cannot by itself furnish validated mail transport TLS, DKIM signing or a working public DNS configuration. DKIM is mainly essential for any future outbound signing; incoming-only operation must still validate MX/A/PTR/SMTP reachability and applicable TLS policy.
- **Required outcome before closure:** TLS, certificates and any DKIM signing lifecycle are actually provisioned/verified.
- **Exact immutable source:** [`src/core/dns/opendkim.ts:L56-L61`](https://github.com/vibtoolshq/ReadBox/blob/e28886e5e0f7a155cd64e23bc8ee8f6668d6699c/src/core/dns/opendkim.ts#L56-L61).

```ts
 56 |   try {
 57 |     const normalizedDomain = validateDomain(domain);
 58 |     const keyFilePath = confinedPath(keysRoot, normalizedDomain, "mail.txt");
 59 |     const content = await readFile(keyFilePath, "ascii");
 60 |     return parseOpenDkimPublicKeyFile(content);
 61 |   } catch {
```

- **Scope Lock:** ONLY R-03 allowlisted files and named contract in [002](002-PRODUCTION-PHASE-ROADMAP.md). No unrelated UI/app/schema/runtime modifications; status remains OPEN until evidence is recorded in [003](003-PHASE-PROGRESS-AND-CHANGE-LOG.md) and [006](006-VERIFICATION-AND-RELEASE-GATES.md).

### RB-P1-10 — No production port/DNS/VPS routing evidence
- **Owner:** R-03. **Baseline assessment:** UNVERIFIED. **Current state:** OPEN external acceptance (CI SMTP bound to loopback only; actual VPS port-25/MX/A/PTR/firewall/IPv6 untested).
- **Audit evidence:** No documented successful live check of inbound TCP/25 from the Internet, VPS provider port policy, MX/A/AAAA, reverse PTR, firewall policy, IPv6, TLS certificate trust or end-to-end LMTP delivery in the checked repository and Actions evidence. `.env.example:52–55` defaults to `readbox.local` and loopback `127.0.0.1`.
- **Impact:** Network and deliverability readiness remain unknown even if the app build succeeds.
- **Required outcome before closure:** Real VPS public IP, port 25, DNS/MX/PTR and firewall evidence.
- **Exact immutable source:** [`.env.example:L53-L57`](https://github.com/vibtoolshq/ReadBox/blob/e28886e5e0f7a155cd64e23bc8ee8f6668d6699c/.env.example#L53-L57).

```text
 53 | MAIL_HOSTNAME=mail.readbox.local
 54 | APP_HOSTNAME=app.readbox.local
 55 | SERVER_IP=127.0.0.1
 56 | DNS_LOOKUP_TIMEOUT_SECONDS=3
 57 |
```

- **Scope Lock:** ONLY R-03 allowlisted files and named contract in [002](002-PRODUCTION-PHASE-ROADMAP.md). No unrelated UI/app/schema/runtime modifications; status remains OPEN until evidence is recorded in [003](003-PHASE-PROGRESS-AND-CHANGE-LOG.md) and [006](006-VERIFICATION-AND-RELEASE-GATES.md).

### RB-P1-11 — Backup and restore tools target systemd host layout, not Compose volumes
- **Owner:** R-05. **Baseline assessment:** CONFIRMED. **Current state:** CI VERIFIED CLOSED (disposable Docker Compose PostgreSQL public+mailserver schemas, Maildir, attachments, media and optional Postfix queue encrypted backup→restore).
- **Audit evidence:** `scripts/ops/backup.sh:6–15,40–122` requires root, host env files, `systemctl` and system mail services; `scripts/ops/restore.sh:28–45,65–115` requires host tools, physical paths and services. `docker-compose.yml:167–175` uses Docker named volumes.
- **Impact:** Current scripts are not demonstrated as a valid Compose/Coolify backup/restore procedure; in particular, volume names, credentials and service orchestration differ.
- **Required outcome before closure:** Verified Docker/Coolify-compatible backup and restore.
- **Exact immutable source:** [`scripts/ops/backup.sh:L118-L124`](https://github.com/vibtoolshq/ReadBox/blob/e28886e5e0f7a155cd64e23bc8ee8f6668d6699c/scripts/ops/backup.sh#L118-L124).

```bash
118 | trap cleanup_on_exit EXIT INT TERM
119 |
120 | for service in "${SERVICES[@]}"; do
121 |   systemctl stop "$service.service" 2>/dev/null || true
122 | done
123 |
124 | # Single PostgreSQL database dump (includes both public and mailserver schemas per AGENTS.md)
```

- **Scope Lock:** ONLY R-05 allowlisted files and named contract in [002](002-PRODUCTION-PHASE-ROADMAP.md). No unrelated UI/app/schema/runtime modifications; status remains OPEN until evidence is recorded in [003](003-PHASE-PROGRESS-AND-CHANGE-LOG.md) and [006](006-VERIFICATION-AND-RELEASE-GATES.md).

### RB-P1-12 — Backup flow deliberately stops Postfix and Dovecot
- **Owner:** R-05. **Baseline assessment:** CONFIRMED OPERATIONAL DOWNTIME. **Current state:** CI VERIFIED CLOSED as explicit downtime contract (stops only active SMTP/LMTP/worker/web writers and restarts prior running services; no zero-downtime claim).
- **Audit evidence:** `scripts/ops/backup.sh:86–122` builds a service list including `postfix`/`dovecot`, then stops these services before database and file backups. `scripts/updater/upgrade.sh:125–151` claims to keep them active while invoking that backup script.
- **Impact:** Mail receipt can be interrupted during backup/upgrades in a host-mode deployment. Upgrade assumptions and backup behavior conflict.
- **Required outcome before closure:** No undocumented Postfix downtime; backup/upgrade behavior agrees.
- **Exact immutable source:** [`scripts/ops/backup.sh:L84-L89`](https://github.com/vibtoolshq/ReadBox/blob/e28886e5e0f7a155cd64e23bc8ee8f6668d6699c/scripts/ops/backup.sh#L84-L89).

```bash
 84 | install -d -m 0700 "$DEST"
 85 |
 86 | SERVICES=(postfix dovecot)
 87 | for candidate in "${READBOX_INGESTION_SERVICE:-}" "readbox-ingestion" "vibmail-ingestion"; do
 88 |   unit="${candidate%.service}"
 89 |   if systemctl list-unit-files "${unit}.service" >/dev/null 2>&1; then
```

- **Scope Lock:** ONLY R-05 allowlisted files and named contract in [002](002-PRODUCTION-PHASE-ROADMAP.md). No unrelated UI/app/schema/runtime modifications; status remains OPEN until evidence is recorded in [003](003-PHASE-PROGRESS-AND-CHANGE-LOG.md) and [006](006-VERIFICATION-AND-RELEASE-GATES.md).

### RB-P1-13 — Restore ownership differs from Docker user identity
- **Owner:** R-05. **Baseline assessment:** CONFIRMED RISK. **Current state:** CI VERIFIED CLOSED (numeric UID/GID 1001, file mode, xattrs and real named-volume POSIX ACL restore verified).
- **Audit evidence:** `scripts/ops/restore.sh:94–106` extracts data and runs `chown -R vmail:vmail` on mail, attachments and media; `Dockerfile:42–63,82` runs app/worker as `nextjs`. The backup uses ACL/xattr options (`scripts/ops/backup.sh:133–139`), while restore tar invocation does not explicitly restore the same options.
- **Impact:** In a combined Docker/host deployment, a restore may make app data inaccessible or alter expected permissions/ACLs without an explicit UID compatibility contract.
- **Required outcome before closure:** Restore preserves app + mail delivery identities and metadata.
- **Exact immutable source:** [`scripts/ops/restore.sh:L99-L99`](https://github.com/vibtoolshq/ReadBox/blob/e28886e5e0f7a155cd64e23bc8ee8f6668d6699c/scripts/ops/restore.sh#L99-L99).

```bash
 99 | chown -R vmail:vmail "$MAIL_STORAGE_ROOT" "$ATTACHMENT_STORAGE_ROOT" "$MEDIA_ROOT"
```

- **Scope Lock:** ONLY R-05 allowlisted files and named contract in [002](002-PRODUCTION-PHASE-ROADMAP.md). No unrelated UI/app/schema/runtime modifications; status remains OPEN until evidence is recorded in [003](003-PHASE-PROGRESS-AND-CHANGE-LOG.md) and [006](006-VERIFICATION-AND-RELEASE-GATES.md).

### RB-P1-14 — Separate runtime dependency install is not fully lockfile-reproducible
- **Owner:** R-01. **Baseline assessment:** CONFIRMED. **Current state:** VERIFIED CLOSED (R-01 CI; live unverified).
- **Audit evidence:** `Dockerfile:18–31` runs a fresh `npm install --no-save` for a separately built migrator/runtime dependency set, unlike the main `npm ci` in `Dockerfile:8–16`. Base image `node:22-alpine` is not pinned to an immutable digest.
- **Impact:** The npm lockfile correction does not alone guarantee identical production runtime dependency resolution or base-image contents across rebuilds.
- **Required outcome before closure:** Production deps and build image are reproducible/pinned.
- **Exact immutable source:** [`Dockerfile:L19-L24`](https://github.com/vibtoolshq/ReadBox/blob/e28886e5e0f7a155cd64e23bc8ee8f6668d6699c/Dockerfile#L19-L24).

```dockerfile
 19 | FROM base AS migrator
 20 | WORKDIR /migrator
 21 | RUN npm install --no-save --no-audit --no-fund \
 22 |   prisma@7.10.1 \
 23 |   dotenv@18.0.8 \
 24 |   tsx@4.23.15 \
```

- **Scope Lock:** ONLY R-01 allowlisted files and named contract in [002](002-PRODUCTION-PHASE-ROADMAP.md). No unrelated UI/app/schema/runtime modifications; status closed by focused R-01 CI evidence in [003](003-PHASE-PROGRESS-AND-CHANGE-LOG.md) and [006](006-VERIFICATION-AND-RELEASE-GATES.md).

### RB-P1-15 — Previous npm audit advisories remain in the reconciled lockfile
- **Owner:** R-01. **Baseline assessment:** CONFIRMED VERSION EVIDENCE. **Current state:** VERIFIED CLOSED (R-01 CI; live unverified).
- **Audit evidence:** Prior GitHub Actions dependency audit reported **two moderate findings** for `next` and `fast-uri`. Current `package-lock.json` still locks `next@16.4.2` and `fast-uri@3.1.8`. The prior Next.js advisory was `GHSA-mfr8-8qww-v76h` and fast-uri had multiple URI parsing advisories. This audit has not re-run `npm audit` on the latest external advisory feed.
- **Impact:** Security dependency remediation is not evidenced; severity and fixed versions should not be assumed current without a fresh advisory check. This is **not** proof of a working exploit.
- **Required outcome before closure:** Fresh dependency security review/remediation or documented risk acceptance.
- **Exact immutable source:** [`package.json:L52-L55`](https://github.com/vibtoolshq/ReadBox/blob/e28886e5e0f7a155cd64e23bc8ee8f6668d6699c/package.json#L52-L55).

```json
 52 |     "lucide-react": "^1.59.0",
 53 |     "next": "16.4.2",
 54 |     "next-auth": "^5.0.0-beta.32",
 55 |     "next-themes": "^0.4.6",
```

- **Scope Lock:** ONLY R-01 allowlisted files and named contract in [002](002-PRODUCTION-PHASE-ROADMAP.md). No unrelated UI/app/schema/runtime modifications; status closed by focused R-01 CI evidence in [003](003-PHASE-PROGRESS-AND-CHANGE-LOG.md) and [006](006-VERIFICATION-AND-RELEASE-GATES.md).

### RB-P1-16 — Production image, external PostgreSQL and failure-recovery integration unverified
- **Owner:** R-06. **Baseline assessment:** UNVERIFIED. **Current state:** OPEN.
- **Audit evidence:** Successful CI covers `npm ci`, `db:validate`, lint, typecheck, unit, UI and `npm run build`. `package.json` has a separate `test:postgres` script; no evidence in checked completed CI of Docker image build/start, real DB migrations on a disposable PostgreSQL instance, worker + Maildir persistence, SMTP-to-Maildir smoke, host reboot, storage failure or restore drill.
- **Impact:** Test PASS does not prove deployability or operational recovery.
- **Required outcome before closure:** Actual Docker image boot, PostgreSQL migrations and operational recovery proven.
- **Exact immutable source:** [`package.json:L23-L26`](https://github.com/vibtoolshq/ReadBox/blob/e28886e5e0f7a155cd64e23bc8ee8f6668d6699c/package.json#L23-L26).

```json
 23 |     "test:auth:target-guard": "node --import tsx --test tests/auth/postgres-target.test.ts",
 24 |     "test:postgres": "node --conditions=react-server --import tsx scripts/testing/postgres-integration.ts",
 25 |     "mail:ingest": "node --conditions=react-server --import tsx scripts/mail/ingest.ts",
 26 |     "verify:safe": "node scripts/testing/verify-safe.mjs",
```

- **Scope Lock:** ONLY R-06 allowlisted files and named contract in [002](002-PRODUCTION-PHASE-ROADMAP.md). No unrelated UI/app/schema/runtime modifications; status remains OPEN until evidence is recorded in [003](003-PHASE-PROGRESS-AND-CHANGE-LOG.md) and [006](006-VERIFICATION-AND-RELEASE-GATES.md).

### RB-P2-01 — Legacy service names and installation paths remain in production template files
- **Owner:** R-05. **Baseline assessment:** CONFIRMED. **Current state:** OPEN. **R-05 PARTIAL:** systemd template internals now use ReadBox paths, but legacy template basenames and Nginx paths outside R-05 allowlist were not changed; remains OPEN pending separately approved scope.
- **Audit evidence:** `deployment/templates/systemd/vibmail-*.service.tpl` uses `/opt/vibmail/app` and `/etc/vibmail/vibmail.env`, `deployment/templates/nginx/app.conf.tpl:15–16,54–55` uses legacy identifiers and log paths; `scripts/updater/upgrade.sh:9–18` still documents legacy paths.
- **Impact:** Host-mode installation from these templates can mix names, paths and owners unless explicitly adapted.
- **Required outcome before closure:** Legacy host/systemd paths normalized only in supported host deployment.
- **Exact immutable source:** [`deployment/templates/systemd/vibmail-web.service.tpl:L12-L12`](https://github.com/vibtoolshq/ReadBox/blob/e28886e5e0f7a155cd64e23bc8ee8f6668d6699c/deployment/templates/systemd/vibmail-web.service.tpl#L12-L12).

```text
 12 | WorkingDirectory=/opt/vibmail/app
```

- **Scope Lock:** ONLY R-05 allowlisted files and named contract in [002](002-PRODUCTION-PHASE-ROADMAP.md). No unrelated UI/app/schema/runtime modifications; status remains OPEN until evidence is recorded in [003](003-PHASE-PROGRESS-AND-CHANGE-LOG.md) and [006](006-VERIFICATION-AND-RELEASE-GATES.md).

### RB-P2-02 — Container update control is intentionally blocked, despite UI availability
- **Owner:** R-05. **Baseline assessment:** CONFIRMED / EXPECTED LIMITATION. **Current state:** CI VERIFIED CLOSED as canonical production release-source and container-managed updater boundary (in-app Docker update remains blocked).
- **Audit evidence:** `src/core/updates/service.ts:433–481` detects Docker/Coolify and returns a blocked updater state directing users to container orchestration. `docker-compose.yml:95` and `.env.example:83` still default `UPDATE_GITHUB_REPO=vibtools/ReadBox` rather than the synchronized target organization.
- **Impact:** In-app update expectations and configured release source do not match a fully automated self-update workflow; stale repository metadata is present.
- **Required outcome before closure:** Container updater is truthful; canonical repo and release source are correct.
- **Exact immutable source:** [`docker-compose.yml:L94-L97`](https://github.com/vibtoolshq/ReadBox/blob/e28886e5e0f7a155cd64e23bc8ee8f6668d6699c/docker-compose.yml#L94-L97).

```text
 94 |       # Optional Release Check Settings
 95 |       UPDATE_GITHUB_REPO: ${UPDATE_GITHUB_REPO:-vibtools/ReadBox}
 96 |     volumes:
 97 |       - readbox_vmail:/var/vmail
```

- **Scope Lock:** ONLY R-05 allowlisted files and named contract in [002](002-PRODUCTION-PHASE-ROADMAP.md). No unrelated UI/app/schema/runtime modifications; status remains OPEN until evidence is recorded in [003](003-PHASE-PROGRESS-AND-CHANGE-LOG.md) and [006](006-VERIFICATION-AND-RELEASE-GATES.md).

### RB-P2-03 — Password-in-URI construction needs character-safe verification
- **Owner:** R-01. **Baseline assessment:** CONDITIONAL. **Current state:** VERIFIED CLOSED (R-01 CI; live unverified).
- **Audit evidence:** `docker-compose.yml:48,134` interpolates `SERVICE_PASSWORD_DB` directly into PostgreSQL URL credentials.
- **Impact:** Secrets containing URL-reserved characters may lead to invalid or misparsed URLs unless encoded appropriately. No evidence demonstrates arbitrary-character passwords work.
- **Required outcome before closure:** Reserved characters in DB secrets handled without credential misparse.
- **Exact immutable source:** [`docker-compose.yml:L47-L50`](https://github.com/vibtoolshq/ReadBox/blob/e28886e5e0f7a155cd64e23bc8ee8f6668d6699c/docker-compose.yml#L47-L50).

```text
 47 |       # Database & Migrations (Coolify auto-generates SERVICE_PASSWORD_DB)
 48 |       DATABASE_URL: postgresql://${POSTGRES_USER:-readbox}:${SERVICE_PASSWORD_DB}@postgres:5432/${POSTGRES_DB:-readbox}?schema=public
 49 |       PRISMA_CLI_ALLOW_REMOTE: "true"
 50 |
```

- **Scope Lock:** ONLY R-01 allowlisted files and named contract in [002](002-PRODUCTION-PHASE-ROADMAP.md). No unrelated UI/app/schema/runtime modifications; status closed by focused R-01 CI evidence in [003](003-PHASE-PROGRESS-AND-CHANGE-LOG.md) and [006](006-VERIFICATION-AND-RELEASE-GATES.md).

### RB-P2-04 — Setup readiness does not establish complete migration history
- **Owner:** R-02. **Baseline assessment:** CONFIRMED. **Current state:** VERIFIED CLOSED (R-02 authorized readiness exception, CI negative tests; live VPS not run).
- **Audit evidence:** `src/core/health/snapshot.ts:99–110` checks unfinished/rolled-back rows in `_prisma_migrations`, not parity against the entire expected migration set.
- **Impact:** A manually incomplete database with an existing migrations table could pass this limited migration condition; runtime schema usage may still fail.
- **Required outcome before closure:** Expected migration history and real schema readiness confirmed.
- **Exact immutable source:** [`src/core/health/snapshot.ts:L102-L108`](https://github.com/vibtoolshq/ReadBox/blob/e28886e5e0f7a155cd64e23bc8ee8f6668d6699c/src/core/health/snapshot.ts#L102-L108).

```ts
102 |         >`
103 |           SELECT COUNT(*)::bigint AS pending_count
104 |           FROM "_prisma_migrations"
105 |           WHERE "finished_at" IS NULL AND "rolled_back_at" IS NULL
106 |         `;
107 |         const pendingCount = Number(failedRows?.[0]?.pending_count ?? 0);
108 |         migrationsOk = pendingCount === 0;
```

- **Scope Lock:** ONLY R-02 allowlisted files and named contract in [002](002-PRODUCTION-PHASE-ROADMAP.md). No unrelated UI/app/schema/runtime modifications; closure documented in 010-R02-READINESS-CLOSURE.md with CI evidence; live acceptance remains open in [003](003-PHASE-PROGRESS-AND-CHANGE-LOG.md) and [006](006-VERIFICATION-AND-RELEASE-GATES.md).

### RB-P2-05 — DNS record generator is advisory, not DNS automation
- **Owner:** R-03. **Baseline assessment:** CONFIRMED. **Current state:** CI VERIFIED CLOSED as advisory boundary (DNS previews remain read-only; no provider mutation or live publication).
- **Audit evidence:** `src/core/dns/records.ts:45–109` generates MX, A, SPF, DKIM and DMARC suggestions; `src/core/dns/resolver.ts:150–306` checks answers. No production DNS-provider credential, mutation API or zone provisioning is wired to the Compose service.
- **Impact:** Dashboard record previews must not be interpreted as DNS records already published. Default DMARC policy `p=none` is monitoring, not enforcement.
- **Required outcome before closure:** DNS preview remains advisory unless DNS-provider write separately authorized.
- **Exact immutable source:** [`src/core/dns/records.ts:L102-L102`](https://github.com/vibtoolshq/ReadBox/blob/e28886e5e0f7a155cd64e23bc8ee8f6668d6699c/src/core/dns/records.ts#L102-L102).

```ts
102 | value: `v=DMARC1; p=none; rua=mailto:postmaster@${domain}`,
```

- **Scope Lock:** ONLY R-03 allowlisted files and named contract in [002](002-PRODUCTION-PHASE-ROADMAP.md). No unrelated UI/app/schema/runtime modifications; status remains OPEN until evidence is recorded in [003](003-PHASE-PROGRESS-AND-CHANGE-LOG.md) and [006](006-VERIFICATION-AND-RELEASE-GATES.md).

### RB-P2-06 — Full two-way mailbox server features are outside the demonstrated stack
- **Owner:** R-03. **Baseline assessment:** CONFIRMED PRODUCT BOUNDARY. **Current state:** CI VERIFIED CLOSED as inbound-only product boundary (no IMAP, SMTP submission or outbound sending/relay).
- **Audit evidence:** `src/core/mailserver/pg-adapter.ts:274–275` produces a deliberately disabled mailbox password hash; `deployment/templates/dovecot/99-vibmail.conf.tpl:1` enables LMTP only; `docker-compose.yml` has no outbound SMTP submission/MTA component.
- **Impact:** This is primarily an incoming Maildir reader/management application plus a mailserver contract, **not** proof of SMTP sending, authenticated IMAP, mailbox client interoperability or outbound deliverability.
- **Required outcome before closure:** Incoming-only boundary explicit; no claims of SMTP submission/IMAP.
- **Exact immutable source:** [`src/core/mailserver/pg-adapter.ts:L273-L277`](https://github.com/vibtoolshq/ReadBox/blob/e28886e5e0f7a155cd64e23bc8ee8f6668d6699c/src/core/mailserver/pg-adapter.ts#L273-L277).

```ts
273 |
274 | export function generateDisabledMailboxPasswordHash(): string {
275 |   return `!READBOX-READ-ONLY!${randomBytes(36).toString("base64url")}`;
276 | }
277 |
```

- **Scope Lock:** ONLY R-03 allowlisted files and named contract in [002](002-PRODUCTION-PHASE-ROADMAP.md). No unrelated UI/app/schema/runtime modifications; status remains OPEN until evidence is recorded in [003](003-PHASE-PROGRESS-AND-CHANGE-LOG.md) and [006](006-VERIFICATION-AND-RELEASE-GATES.md).

### RB-P2-07 — Backup confidentiality, off-site retention and restore reproducibility unproven
- **Owner:** R-05. **Baseline assessment:** UNVERIFIED. **Current state:** OPEN. **R-05 PARTIAL:** encrypted, SHA-256-verified and reproducibly restored disposable Compose backup passes; actual offsite transfer, retention/rotation, key escrow, and VPS/host recovery remain unverified; stays OPEN.
- **Audit evidence:** `scripts/ops/backup.sh:45–80,124–174` includes configuration files potentially containing secrets and writes local archives; no verified encrypted off-site backup, retention enforcement or container volume restore test is present.
- **Impact:** Disaster recovery and exposure controls cannot receive a production GO from static inspection alone.
- **Required outcome before closure:** Backup secrets protected, offsite retention and restore tested.
- **Exact immutable source:** [`scripts/ops/backup.sh:L6-L11`](https://github.com/vibtoolshq/ReadBox/blob/e28886e5e0f7a155cd64e23bc8ee8f6668d6699c/scripts/ops/backup.sh#L6-L11).

```bash
  6 | [[ ${EUID:-$(id -u)} -eq 0 ]] || { printf 'Run as root.\n' >&2; exit 1; }
  7 |
  8 | ENV_FILE=${READBOX_ENV_FILE:-${VIBMAIL_ENV_FILE:-/etc/readbox/readbox.env}}
  9 | if [[ ! -r "$ENV_FILE" && -r "/etc/vibmail/vibmail.env" ]]; then
 10 |   ENV_FILE="/etc/vibmail/vibmail.env"
 11 | fi
```

- **Scope Lock:** ONLY R-05 allowlisted files and named contract in [002](002-PRODUCTION-PHASE-ROADMAP.md). No unrelated UI/app/schema/runtime modifications; status remains OPEN until evidence is recorded in [003](003-PHASE-PROGRESS-AND-CHANGE-LOG.md) and [006](006-VERIFICATION-AND-RELEASE-GATES.md).

### RB-P2-08 — Historical reference source and license require clear provenance
- **Owner:** R-06. **Baseline assessment:** CONFIRMED. **Current state:** OPEN.
- **Audit evidence:** `reference/MailStack/LICENSE` declares AGPL and `reference/MailStack/NOTICE.md` describes separate license/branding conditions; root `LICENSE` declares MIT for ReadBox. Approximately 391 tracked blobs live under `reference/`. `.dockerignore:38–46` excludes this reference source from the Docker build context.
- **Impact:** The main app license must not be assumed to override reference-source license obligations. This is a distribution/provenance review item, not a demonstrated runtime failure.
- **Required outcome before closure:** Third-party license/provenance requirements verified and preserved.
- **Exact immutable source:** [`reference/MailStack/LICENSE:L1-L1`](https://github.com/vibtoolshq/ReadBox/blob/e28886e5e0f7a155cd64e23bc8ee8f6668d6699c/reference/MailStack/LICENSE#L1-L1).

```text
  1 |                     GNU AFFERO GENERAL PUBLIC LICENSE
```

- **Scope Lock:** ONLY R-06 allowlisted files and named contract in [002](002-PRODUCTION-PHASE-ROADMAP.md). No unrelated UI/app/schema/runtime modifications; status remains OPEN until evidence is recorded in [003](003-PHASE-PROGRESS-AND-CHANGE-LOG.md) and [006](006-VERIFICATION-AND-RELEASE-GATES.md).

### RB-P2-09 — Archived source history and documentation can still contain outdated assertions
- **Owner:** R-01. **Baseline assessment:** CONFIRMED. **Current state:** VERIFIED CLOSED (R-01 CI; live unverified).
- **Audit evidence:** `README.md` contains stale framework/version/configuration details; old historical `notes/` files were removed from the current tree by this documentation-only audit change (Git history remains intact).
- **Impact:** Prior notes describing phases as "production-ready" must not supersede the current evidence-based NO-GO verdict.
- **Required outcome before closure:** Document actual Next.js 16.4.2/current commands.
- **Exact immutable source:** [`README.md:L39-L42`](https://github.com/vibtoolshq/ReadBox/blob/e28886e5e0f7a155cd64e23bc8ee8f6668d6699c/README.md#L39-L42).

```text
 39 | > **Keywords:** `self-hosted webmail`, `open source mail server web client`, `postfix dovecot webmail`, `maildir web interface`, `docker email server webmail`, `coolify mail server webmail`, `private business email server`, `sandboxed email reader xss protection`, `spf dkim dmarc dns generator`, `nextjs webmail`, `vib tools`.
 40 | > **Description:** ReadBox is a fast, secure, privacy-first open-source webmail interface and mail server management platform by Vib Tools. Built on Next.js 15, PostgreSQL 16, and Tailwind CSS with sandboxed HTML email rendering, Maildir ingestion, and automated SPF/DKIM/DMARC deliverability verification.
 41 |
 42 | ---
```

- **Scope Lock:** ONLY R-01 allowlisted files and named contract in [002](002-PRODUCTION-PHASE-ROADMAP.md). No unrelated UI/app/schema/runtime modifications; status closed by focused R-01 CI evidence in [003](003-PHASE-PROGRESS-AND-CHANGE-LOG.md) and [006](006-VERIFICATION-AND-RELEASE-GATES.md).

### RB-P2-10 — Production readiness defaults do not require a live mailserver
- **Owner:** R-04. **Baseline assessment:** CONFIRMED. **Current state:** CI VERIFIED CLOSED as application-vs-transport boundary (readiness states application only and mailTransport not_checked; live SMTP/LMTP still unverified).
- **Audit evidence:** `src/core/health/snapshot.ts:145–180` checks config, DB, migration table, writable storage and optionally worker heartbeat; it does not open an SMTP connection to Postfix or an LMTP connection to Dovecot.
- **Impact:** A green app readiness endpoint is **not** a full-mailserver-ready signal.
- **Required outcome before closure:** App readiness and actual SMTP/LMTP readiness differentiated.
- **Exact immutable source:** [`src/core/health/snapshot.ts:L150-L159`](https://github.com/vibtoolshq/ReadBox/blob/e28886e5e0f7a155cd64e23bc8ee8f6668d6699c/src/core/health/snapshot.ts#L150-L159).

```ts
150 |     : !ingestionDegradedOrStale;
151 |
152 |   const ready =
153 |     configuration.ok &&
154 |     databaseOk &&
155 |     migrationsOk &&
156 |     mailStorage.ok &&
157 |     attachmentStorage.ok &&
158 |     ingestionGateOk;
159 |
```

- **Scope Lock:** ONLY R-04 allowlisted files and named contract in [002](002-PRODUCTION-PHASE-ROADMAP.md). No unrelated UI/app/schema/runtime modifications; status remains OPEN until evidence is recorded in [003](003-PHASE-PROGRESS-AND-CHANGE-LOG.md) and [006](006-VERIFICATION-AND-RELEASE-GATES.md).

## Owner reconciliation (one finding → one phase)

- **R-01** (7): RB-P0-01, RB-P1-01, RB-P1-02, RB-P1-14, RB-P1-15, RB-P2-03, RB-P2-09.
- **R-02** (4): RB-P0-03, RB-P0-04, RB-P1-08, RB-P2-04.
- **R-03** (6): RB-P0-02, RB-P0-05, RB-P1-09, RB-P1-10, RB-P2-05, RB-P2-06.
- **R-04** (6): RB-P1-03, RB-P1-04, RB-P1-05, RB-P1-06, RB-P1-07, RB-P2-10.
- **R-05** (6): RB-P1-11, RB-P1-12, RB-P1-13, RB-P2-01, RB-P2-02, RB-P2-07.
- **R-06** (3): RB-P0-06, RB-P1-16, RB-P2-08.

**Totals:** 32 records; 32 unique owner assignments; no duplicate or orphan. This document does not authorize any source edit, server action or live mail sending. Current code and historical report stay unchanged. New defects must have new evidence and explicit scope authorization; do not silently add them to a running phase.

## R-01 closure evidence (2026-11-17)

- Seven findings CI-verified: RB-P0-01, RB-P1-01, RB-P1-02, RB-P1-14, RB-P1-15, RB-P2-03, RB-P2-09.
- Tested source patch SHA: `113663cdabacf1460af5b06a334d99ab3db833c2`; Docker/Compose/security proof https://github.com/JILLU-Games/ReadBox/actions/runs/44093204590; complete app regression proof https://github.com/JILLU-Games/ReadBox/actions/runs/44092311120.
- 25 findings OPEN. SMTP/LMTP and real VPS acceptance remain unverified. Historical code excerpts intentionally preserve the original baseline.

## R-02 evidence and held readiness gate (2026-11-17)

- Code SHA: `e1efdbd0b0380a94152947f7be47eb17c5c8d70c`. Focused GitHub CI: https://github.com/JILLU-Games/ReadBox/actions/runs/44099280332. Seven Prisma migrations applied on disposable PostgreSQL 16, second deploy reported no pending migrations. Dedicated `readbox_postfix` login queried domain/mailbox/alias views, and password-hash, app user data and writes were denied.
- Three CI contract findings addressed: `RB-P0-03`, `RB-P0-04`, `RB-P1-08`. These are not proof of external live Postfix/Dovecot.
- `RB-P2-04` remains **OPEN**: `src/core/mailserver/pg-adapter.ts` now checks an expected migration manifest with unit tests, but `src/core/health/snapshot.ts` still checks only unfinished rows. That file is **not** in R-02's allowlist (it belongs to R-04); therefore scope discipline prohibits a silent edit. R-02 cannot be marked fully VERIFIED CLOSED under its own phase exit rule without separately approving a narrowly bounded health-readiness exception or explicit documented deferral.
- Original baseline snippets are historical proof, not assertions that the patched tree still has old configuration.

## R-02 authorized RB-P2-04 closure (2026-11-17)

- Verified source code SHA: `b6ab76119a31f9bf4e81b3990a5fcc6d802a6892`; focused negative CI: https://github.com/JILLU-Games/ReadBox/actions/runs/44102834169. Previous full disposable PostgreSQL 16 role/permission/migrations CI: https://github.com/JILLU-Games/ReadBox/actions/runs/44099280332.
- `src/core/health/snapshot.ts` now reuses the existing R-02 SQL migration parity helper with an authoritative checked-in migration manifest. Missing, unfinished and inaccessible migration history returns `not_ready` (the route continues to return 503 for `not_ready`).
- **4/4 R-02 owner findings CI CLOSED**; total 11 CI verified, 21 remaining OPEN. Historical baseline excerpts and the interim blocked phase report are preserved as forensic history.
- No VPS, SMTP, Dovecot, external DNS or other out-of-phase capability verified. Production remains **NO-GO**. See [010](010-R02-READINESS-CLOSURE.md).

## R-03 inbound private mailserver CI closure (2026-11-17)

- Verified source code SHA: `d0f3272ea298de012da83c6f01b588fa0513d1da`; scoped CI: https://github.com/JILLU-Games/ReadBox/actions/runs/44107205810. Opt-in containerized Postfix SQL recipient checking + Dovecot private LMTP delivered a real SMTP message to the shared Maildir on a disposable runner. STARTTLS, nonlocal relay rejection, unknown recipient rejection, certificate absence fail-close, mailserver config syntax and ownership succeeded.
- Four R-03 owner contracts CI CLOSED: `RB-P0-02`, `RB-P0-05`, `RB-P2-05`, `RB-P2-06`. **Two R-03 findings REMAIN OPEN for external acceptance:** `RB-P1-09` trusted/renewed public TLS+DNS/DKIM applicability, `RB-P1-10` public VPS port 25/MX/PTR/firewall/IPv6 reachability. They require R-06 live staging evidence; do not mistake the test's self-signed certificate for trusted production TLS.
- **Total:** 15/32 CI verified, 17 OPEN; source UI/auth/migrations unchanged; no SMTP submission/IMAP/outbound or public DNS mutation. Production **NO-GO**.

## R-04 scoped CI closure proof (2026-11-17)

- Code SHA `88e57e2e81dc07a8f91b07f448df85e51d58e429`; successful focused CI https://github.com/JILLU-Games/ReadBox/actions/runs/44112634511. One disposable PostgreSQL 16 ran all migrations; the initial admin was created exactly once in `admin_accounts` with `passwordResetRequired=true`, a one-time hashed `admin_reset_tokens` record, and an unrelated normal-user table left empty. Duplicate bootstrap was rejected; the setup inspector found that same identity.
- `/health/ready` now requires a fresh healthy/ok ingestion heartbeat in production regardless of the legacy `REQUIRE_INGESTION_READY=false` env value; absent/stale/future/failed workers, database or storage cause `not_ready`. Web liveness remains separate to prevent a circular web↔worker startup dependency; worker health additionally checks app readiness.
- `checks.mailTransport: { verified:false,status:"not_checked" }` and `scope:"application"` explicitly differentiate app/ingestion readiness from true external SMTP/LMTP delivery; **no mailserver GO can be inferred from an app 200 response**.
- Six R-04 findings CI-level CLOSED: `RB-P1-03`, `RB-P1-04`, `RB-P1-05`, `RB-P1-06`, `RB-P1-07`, `RB-P2-10`. **Overall 21 CI-verified / 11 OPEN**; R-05/R-06 and real VPS production readiness remain NO-GO.
- Interactive production operator CLI, actual production credentials and public VPS deployment were NOT executed in CI. Historical baseline evidence above preserved unchanged.

## R-05 scoped encrypted Compose recovery CI reconciliation (2026-11-17)

- **Verified code SHA:** `a55ec82bb2f58804e910427c66ff6352cd5c14c6`; **focused successful CI:** https://github.com/JILLU-Games/ReadBox/actions/runs/44121121316. Disposable named Docker volumes and real PostgreSQL 16 `public`+`mailserver` schemas: age X25519-encrypted archive, SHA-256 checksum, private output (0600), restored Maildir+attachments+media+Postfix queued message, numeric UID/GID, real POSIX ACL and data parity. A forced failure **after database apply** recovered the pre-restore DB+Maildir; tampered ciphertext was rejected before mutation; active services restarted.
- **Four R-05 findings CI verified:** `RB-P1-11`, `RB-P1-12`, `RB-P1-13`, `RB-P2-02`. **Two still OPEN:** `RB-P2-01` (unsupported Nginx/old template naming outside approved R-05 file list) and `RB-P2-07` (off-site encrypted artifact transfer/retention/key escrow and real host/VPS restore not demonstrated). Historical baseline excerpts remain immutable evidence.
- Host `scripts/ops/backup.sh` excludes plaintext configuration; restore preserves archived numeric ownership, ACLs and xattrs. Host `upgrade.sh` includes failure rollback handling, but the host systemd execution path was **syntax/static inspected only**, not live tested. Operator must maintain credentials/TLS material in a separate approved secret manager, outside the encrypted data bundle.
- The repo alias `vibtools/ReadBox` maps to `vibtoolshq/ReadBox` in **production** update metadata/privileged worker; Docker/Coolify self-update stays blocked, no silent upgrade.
- **Overall:** 25/32 CI-verified, 7 OPEN, R-01…R-05 implementation phases CI closed (5/6), next R-06 separately approved. **Production NO-GO.**

## R-06 final consolidated CI and live-release finding reconciliation (2026-11-17)

- **Successful focused CI:** https://github.com/JILLU-Games/ReadBox/actions/runs/44127481624, tested and published code SHA `807ca9f38adb02db2a8b73dc0901fce23ee5e63a`. Production-readonly workflow performed actual isolated Docker web/worker/Postfix/Dovecot images, test-only SMTP STARTTLS→LMTP→Maildir with recipient and relay negatives, verified guarded disposable PostgreSQL 16 migrations/auth, full app/UI tests, production npm audit, age encrypted backup→restore and post-DB-apply rollback, release gate/AGPL marker negatives and exact **11-path** Scope Lock audit. The gate reported `R06_PRODUCTION_NO_GO`, `R06_FINDINGS_OPEN=7` and `R06_LIVE_GATE_PASS_CLAIMS=0/17`.
- **R-06-owned original findings remain OPEN**: `RB-P0-06` (no external Internet SMTP→Maildir→ingestion→authenticated inbox/attachments acceptance), `RB-P1-16` (CI Docker/migrations/rollback pass but real VPS reboot, external PostgreSQL and host outage recovery absent), `RB-P2-08` (source MIT/AGPL provenance markers checked; no independent license/actual distribution signoff). These **cannot** be reclassified as fully resolved by CI-only observations.
- **Other OPEN original findings unchanged:** `RB-P1-09` and `RB-P1-10` (real TLS/DNS/public TCP/25/port policy), `RB-P2-01` (historical Nginx naming path outside R-06 Scope Lock) and `RB-P2-07` (real offsite key custody/retention/restore). **Overall still 25/32 CI verified, 7 OPEN**.
- **Pre-existing lint debt, separate from 32 forensic findings:** `src/core/setup/trusted-operations.ts:366,386` contains exactly two R-04 `@typescript-eslint/no-unused-vars` errors. R-06 source linted all *other* tracked files; its tightly specified lint-baseline check asserts those two exist and fails on any additional violations. The unmodified R-04 source was NOT edited because it is outside R-06 allowlist; therefore **full-tree lint is not clean** and RG-03 cannot be pronounced fully release PASS.
- The final CI produced only sanitized, nonproduction evidence. No staging/VPS access, DNS modification, public port binding, user real mailbox sending, production restore, release/tag or artifact distribution happened. R-06 implementation complete at CI level; **production acceptance and release remain NO-GO** until a new separate approval and independently observed evidence.

---

## 2026-11-19 CURRENT Primary forensic findings — source SHA 3dfac11f

**Audit approach:** Read-only recursive Primary tree (1108 entries, not truncated), 000–006 + 016 + backup-restore records, DNS orchestration/zone API/escrow, Postfix/Dovecot Compose, Nginx template, GitHub Actions and completed run outcomes. This is a **source/config and recorded-evidence audit**, **not** a fresh VPS login, Cloudflare call or R2 account audit. Only the issues below have current supporting evidence; do not invent a reproduced live outage.

### Original 7 OPEN findings — one-to-one remaining work

| Original ID | Current exact status and evidence | Required outcome | Next owner |
|---|---|---|---|
| RB-P0-06 | **OPEN — partial operator observation.** [016](016-LIVE-INBOUND-DEPLOYMENT-ACCEPTANCE.md) records one Gmail-to-authenticated-inbox delivery and SMTP negatives on a VPS; no independently observed multipart attachment digest, broad MIME/disabled recipient/load/reboot acceptance | Independently observed external SMTP -> LMTP -> Maildir -> ingestion -> authenticated inbox, attachment integrity, rejects and recoveries | NEXT-04 |
| RB-P1-09 | **OPEN — CI DNS/DKIM source only.** Primary [DNS CI #44384108878](https://github.com/vibtoolshq/ReadBox/actions/runs/44384108878) passed mocks. Trusted mail/web TLS/renewal, public DNS and any applicable DKIM signer not proven. Inbound-only product does **not** imply outbound DKIM signing | Approved test-zone MX/A/SPF/DKIM/DMARC, escrow receipt/public DNS and applicable trusted TLS evidence; explicitly document non-goals | NEXT-03 |
| RB-P1-10 | **OPEN — external preflight incomplete.** [016](016-LIVE-INBOUND-DEPLOYMENT-ACCEPTANCE.md) has an operator VPS-side port-25/STARTTLS check; no independently corroborated provider/registrar/MX/A/AAAA/PTR/firewall and public reachability | Independent external public DNS/port/hostname/IPv6-as-applicable proof, without broad production DNS overwrites | NEXT-03 |
| RB-P1-16 | **OPEN — production recovery incomplete.** Historical [JILLU R06 CI #44374235430](https://github.com/JILLU-Games/ReadBox/actions/runs/44374235430) passed disposable Docker/PG/SMTP/restore at **a different SHA**; Primary R06 [#44384109011](https://github.com/vibtoolshq/ReadBox/actions/runs/44384109011) is **SKIPPED**. One VPS service-health snapshot is recorded but not a complete independently observed restart/failure-recovery campaign | Correct Primary CI gating and observe controlled staging boot, migrations, restart, worker/DB outage and recovery | NEXT-02, NEXT-04 |
| RB-P2-01 | **OPEN — confirmed current static mismatch.** `deployment/templates/nginx/app.conf.tpl` retains `vibmail_web` upstream (L15), `VIBMAILTLS` cache (L44), `/var/log/vibmail` (L54–55). Current systemd template *internals* use `/opt/readbox/app`; do not claim all systemd paths remain broken | Narrowly correct approved host-mode Nginx legacy names/log paths, test generated config and preserve historical service compatibility | NEXT-02 |
| RB-P2-07 | **OPEN — offsite/restore evidence gap.** [016](016-LIVE-INBOUND-DEPLOYMENT-ACCEPTANCE.md) confirms a local checksum and an AES256-GPG encrypted local archive, **not** offsite age/R2 custody, rotation or independent restoration | Secure offsite encrypted object, verified retention/key custody and disposable restore/rollback with hash/UID/ACL | NEXT-03, NEXT-04 |
| RB-P2-08 | **OPEN — legal/provenance review.** Root `LICENSE` declares MIT; `reference/MailStack/LICENSE` declares AGPL and NOTICE limits branding. `.dockerignore` excludes reference from Docker context, not all source archives | Qualified provenance/derivative/license/distribution review at exact release SHA + artifact inventory; no relabeling of AGPL assets | NEXT-01, final NEXT-04 |

**Disposition arithmetic:** 32 original IDs = 25 CI-contract verified + 7 OPEN. The partial 2026-11-18 operator observation does **not** automatically close RB-P0-06, RB-P1-10 or another original finding. The 17 independent RG gates in `006` still require individual acceptance.

### Additional current-source issues (RN IDs are NOT extra original RB findings)

| RN ID / classification | Exact source proof at the new freeze | Root cause / scope-limited mitigation | Owner |
|---|---|---|---|
| **RN-01 CONFIRMED CI CONFIG MISMATCH** | [Primary `.github/workflows/r06-production-readiness.yml:L19-L22`](https://github.com/vibtoolshq/ReadBox/blob/3dfac11f46165c262c3dc5ddb7e82563a56f9a7f/.github/workflows/r06-production-readiness.yml#L19-L22) has job `if: github.repository == 'JILLU-Games/ReadBox'`; actual [Primary #44384109011](https://github.com/vibtoolshq/ReadBox/actions/runs/44384109011) outcome is **SKIPPED** | History originated on backup JILLU; repository condition never matches Primary. Later patch ONLY the inspected read-only workflow condition and focused negative tests; don't enable any release action | NEXT-02 |
| **RN-02 CONFIRMED BACKUP SYNC BLOCKER** | Current JILLU `main` `952516a2cac27649824bf14329f511eae6ae9294`; MdNurnobi-Dev `main` `511a77380ef8d41061164abb966cbe960b6d02a8`. Neither has exact-SHA backup branch. Previous non-interactive Git push reported 403/no credentials | Credential/permission obstacle, **not** a DNS source defect. Transfer exact Primary Git objects into dedicated backup branches once authorized; no force, no unrelated history merge/main updates | NEXT-01 |
| **RN-03 CONFIRMED DOCUMENTATION AUTHORITY DRIFT** | Historic [000](000-BASELINE-FREEZE.md) calls JILLU upstream; [notes README](README.md) defaults to backup-restore index; current Primary is vibtoolshq | Preserve historical content and add dated authoritative current overlay/index; no source changes | DOCUMENTATION-ONLY (this phase) |
| **RN-04 RELEASE GUARD BOUNDARY (NOT a reproduced release bug)** | [Primary release workflow L13–19](https://github.com/vibtoolshq/ReadBox/blob/3dfac11f46165c262c3dc5ddb7e82563a56f9a7f/.github/workflows/readbox-first-release.yml#L13-L19) is JILLU-specific. On Primary, release job skips; on old JILLU `main` the historical publishing condition is present | Do not accidentally push JILLU `main`; prefer backup branches. Keep all tags/releases unchanged. Never turn on publishing by fixing CI conditions | NEXT-01, NEXT-02 |
| **RN-05 UNVERIFIED EXTERNAL AUTOMATION ACCEPTANCE** | [Domain automation code](https://github.com/vibtoolshq/ReadBox/blob/3dfac11f46165c262c3dc5ddb7e82563a56f9a7f/src/core/dns/domain-automation.ts) and [zone selector](https://github.com/vibtoolshq/ReadBox/blob/3dfac11f46165c262c3dc5ddb7e82563a56f9a7f/src/app/api/vcon/domains/cloudflare-zones/route.ts) have disposable CI, no known real Cloudflare/R2/registrar proof | One preapproved test domain/zone, redacted token and offsite custody preflight, idempotent publish, public propagation, failure/repair evidence. **Not** a confirmed source bug | NEXT-03 |

### Small exact current source proof (no modifications authorized now)

**RN-01 — wrong repository gate (primary code, L19–22):**

~~~yaml
jobs:
  consolidated-acceptance:
    if: github.repository == 'JILLU-Games/ReadBox'
~~~

**RB-P2-01 — legacy host-template identifiers (current Nginx L15 and L54–55):**

~~~nginx
upstream vibmail_web {
    server 127.0.0.1:3000 fail_timeout=0;
}
access_log /var/log/vibmail/nginx-access.log;
error_log /var/log/vibmail/nginx-error.log warn;
~~~

**RB-P1-10 — default SMTP is loopback-only, not proof of public availability (Compose L264–265):**

~~~yaml
ports:
  - "${SMTP_BIND_ADDRESS:-127.0.0.1}:${SMTP_PUBLISHED_PORT:-25}:25"
~~~

### Forensic boundaries and what NOT to do

- No observed application-source defect justifies auth/session bypass, Prisma migration rewrite, mailserver architecture change, default Docker port exposure or adding outbound SMTP/IMAP; those are separately scoped features, not release blockers for the inbound-only contract.
- Formal original 32 finding records retain **exact original headings** to avoid breaking `parseLedger` and corresponding release-gate tests. RN-xx are a current-source supplement, not a new counted phase.
- Detailed approved future per-phase allowlists and hard prohibitions are in [002](002-PRODUCTION-PHASE-ROADMAP.md). Do not implement until the operator separately approves the named work package.

---

## Latest seven-OPEN reconciliation — code source 6f3bc1e3aeb441956e1fd0f4d81558a6aba2945f

**Source freeze (2026-11-19 Asia/Dhaka):** authoritative `vibtoolshq/ReadBox/main` 6f3bc1e3aeb441956e1fd0f4d81558a6aba2945f; tree `f82b07b6e0770850edd3431f041d5162848d442a`. Last full disposable Primary R06 CI ran against executable code 4d0b124af57c8d407bf609540b8b8b7a69a479b5: [run #44509947742](https://github.com/vibtoolshq/ReadBox/actions/runs/44509947742), SUCCESS. Compare 4d0b124af57c8d407bf609540b8b8b7a69a479b5..6f3bc1e3aeb441956e1fd0f4d81558a6aba2945f: **one documentation-only commit changing notes/003–006**, no executable change. At freeze time both dedicated backup refs `backup/dns-final-primary-20261119` matched 6f3bc1e3aeb441956e1fd0f4d81558a6aba2945f (2/2); backup repositories' separate `main` branches did not. **This new notes-only commit will advance Primary HEAD beyond the freeze; do not claim backup parity at that new HEAD without a new remote readback.** Historical source snapshots below are preserved and must not be mistaken for current source. Production remains **NO-GO**: 32 original findings, 25 CI-contract verified and 7 OPEN; 17 independently accepted production gates not evidenced. Historical R-01–R-06: 6/6 CI implemented. NEXT-01 and NEXT-02: 2/4 completed; NEXT-03 and NEXT-04: 2/4 pending.

The original 32 finding headings and statuses **remain unchanged**; all seven OPEN entries must retain release-blocker status until accepted evidence is appended. **Status corrections to the older 3dfac11 snapshot:** RN-01 Primary R06 job condition is now `vibtoolshq/ReadBox` in [workflow:L21](https://github.com/vibtoolshq/ReadBox/blob/6f3bc1e3aeb441956e1fd0f4d81558a6aba2945f/.github/workflows/r06-production-readiness.yml#L21) and successful [CI #44509947742](https://github.com/vibtoolshq/ReadBox/actions/runs/44509947742) actually ran. RN-02 exact-SHA dedicated backup refs 2/2 matched 6f3bc1e3aeb441956e1fd0f4d81558a6aba2945f at freeze (backup **mains remain divergent**). Historical RB-P2-01 *source* `vibmail` identifiers were corrected: [Nginx:L15,L44,L54–55](https://github.com/vibtoolshq/ReadBox/blob/6f3bc1e3aeb441956e1fd0f4d81558a6aba2945f/deployment/templates/nginx/app.conf.tpl#L15), static test CI PASS; **live host Nginx/permissions/TLS unverified** so original finding remains OPEN. RB-P0-06, RB-P1-09, RB-P1-10, RB-P1-16, RB-P2-07, RB-P2-08 retain their independent/live/legal evidence gaps. None are new confirmed source regressions. See exact frozen code blocks and phase owner in [017](017-CURRENT-FORENSIC-PATCH-REFERENCES-2026-11-19.md).
