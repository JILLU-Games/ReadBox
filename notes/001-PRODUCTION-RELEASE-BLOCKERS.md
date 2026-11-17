# 001 — Production Blocker Ledger & Exact Baseline Code Proof

**Baseline SHA:** `e28886e5e0f7a155cd64e23bc8ee8f6668d6699c`, **tree:** `9a3d935cfc66bcfc1f5f717d77b99bfd3006d63c`.
**Audit reconciliation:** **32 / 32** original findings = **6 P0 + 16 P1 + 10 P2**. **17 OPEN; 15 CI-CONTRACT VERIFIED (7 R-01 + 4 R-02 + 4 R-03); R-03 private mailserver implementation CI VERIFIED; external TLS/DNS/VPS release gates remain NO-GO.**
**Primary source:** [VPS production forensic audit](VPS-PRODUCTION-FORENSIC-AUDIT-2026-11-17.md).
**Status:** R-01, R-02 and R-03 implementation phases CI VERIFIED; R-04 through R-06 NOT STARTED. External public SMTP/DNS/TLS evidence remains NO-GO.

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
- **Owner:** R-04. **Baseline assessment:** CONFIRMED. **Current state:** OPEN.
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
- **Owner:** R-04. **Baseline assessment:** CONFIRMED LOGIC MISMATCH. **Current state:** OPEN.
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
- **Owner:** R-04. **Baseline assessment:** CONFIRMED. **Current state:** OPEN.
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
- **Owner:** R-04. **Baseline assessment:** CONFIRMED. **Current state:** OPEN.
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
- **Owner:** R-04. **Baseline assessment:** CONFIRMED. **Current state:** OPEN.
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
- **Owner:** R-05. **Baseline assessment:** CONFIRMED. **Current state:** OPEN.
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
- **Owner:** R-05. **Baseline assessment:** CONFIRMED OPERATIONAL DOWNTIME. **Current state:** OPEN.
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
- **Owner:** R-05. **Baseline assessment:** CONFIRMED RISK. **Current state:** OPEN.
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
- **Owner:** R-05. **Baseline assessment:** CONFIRMED. **Current state:** OPEN.
- **Audit evidence:** `deployment/templates/systemd/vibmail-*.service.tpl` uses `/opt/vibmail/app` and `/etc/vibmail/vibmail.env`, `deployment/templates/nginx/app.conf.tpl:15–16,54–55` uses legacy identifiers and log paths; `scripts/updater/upgrade.sh:9–18` still documents legacy paths.
- **Impact:** Host-mode installation from these templates can mix names, paths and owners unless explicitly adapted.
- **Required outcome before closure:** Legacy host/systemd paths normalized only in supported host deployment.
- **Exact immutable source:** [`deployment/templates/systemd/vibmail-web.service.tpl:L12-L12`](https://github.com/vibtoolshq/ReadBox/blob/e28886e5e0f7a155cd64e23bc8ee8f6668d6699c/deployment/templates/systemd/vibmail-web.service.tpl#L12-L12).

```text
 12 | WorkingDirectory=/opt/vibmail/app
```

- **Scope Lock:** ONLY R-05 allowlisted files and named contract in [002](002-PRODUCTION-PHASE-ROADMAP.md). No unrelated UI/app/schema/runtime modifications; status remains OPEN until evidence is recorded in [003](003-PHASE-PROGRESS-AND-CHANGE-LOG.md) and [006](006-VERIFICATION-AND-RELEASE-GATES.md).

### RB-P2-02 — Container update control is intentionally blocked, despite UI availability
- **Owner:** R-05. **Baseline assessment:** CONFIRMED / EXPECTED LIMITATION. **Current state:** OPEN.
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
- **Owner:** R-05. **Baseline assessment:** UNVERIFIED. **Current state:** OPEN.
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
- **Owner:** R-04. **Baseline assessment:** CONFIRMED. **Current state:** OPEN.
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
