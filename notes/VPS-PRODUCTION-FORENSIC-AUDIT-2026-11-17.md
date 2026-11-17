# ReadBox — VPS Production Installation & Mail Server Forensic Audit

**Audit date:** 2026-11-17 (Asia/Dhaka)
**Repository baseline:** `810fb81c5ad4d1fafe4f1d255561dfcaa60707cb`
**Source:** `JILLU-Games/ReadBox` · **Mirror:** `vibtoolshq/ReadBox`
**Scope:** Current tracked source code, configuration, migrations, Docker/Compose, installer/updater, Postfix/Dovecot integration contract, Maildir, auth/admin bootstrap, DNS, security, backup/restore, CI and release evidence.
**Method:** GitHub repository static forensic review plus existing GitHub Actions log evidence. No live VPS access, Docker image launch, DNS lookup against a configured production domain, live SMTP delivery, PostgreSQL integration environment, or destructive recovery test was performed in this audit.
**Change restriction:** Report/notes cleanup only. No application/source/configuration/CI fix has been implemented in this report-only task.

## Executive verdict

**FULL VPS MAIL SERVER PRODUCTION: NO-GO.** The application is buildable and unit/UI tests pass, but the published repository is **not a self-contained, validated SMTP-receiving production mailserver installer**. Its production Compose stack starts PostgreSQL, a Next.js web service and an ingestion worker; it does **not** install/start or connect Postfix, Dovecot/LMTP, DKIM signing, public SMTP listeners or TLS certificate lifecycle. The documented default Compose command chooses the development database-only file, not the production stack.

**WEB APP STAGING: CONDITIONALLY TESTABLE, NOT PROVEN DEPLOYED.** Proper configuration, selected Compose file, secrets, migrations and operator setup are prerequisites; no end-to-end VPS smoke evidence exists. Claims in old project notes such as "production ready" are **not independent proof**.

**Finding definitions:** `P0` = directly prevents or makes unsafe a claimed full production mailserver deployment; `P1` = significant runtime/operational or security risk; `P2` = documentation/maintainability/conditional gap. `CONFIRMED` means demonstrated by committed source/configuration. `UNVERIFIED` means live proof is missing; not an assertion that a runtime failure occurred.

### Audit coverage and evidence boundary

- Tracked tree at baseline: **724 files** (including **206 `src/` files, 42 `tests/` files, 10 `scripts/` files** and a separately bundled **`reference/MailStack/`** tree).
- Previously verified focused GitHub Actions: **167 unit/contract tests + 70 UI tests passed**, Prisma schema validation, ESLint, TypeScript, clean npm installation and Next.js application build passed after lockfile reconciliation. These are **not** Docker/full mail-server integration tests.
- The corrected `package-lock.json` remains tracked and matches `package.json` for `npm ci`. Previous FA-M01 lockfile mismatch is closed.
- Current source and destination initially had the same baseline commit. The present report does not alter any executable file.

## P0 — Production blockers

### RB-P0-01 — Default Docker Compose starts the wrong stack [CONFIRMED]
**Evidence:** `compose.yaml:1–41` defines `postgres` and optional `postgres-test` only, with a development-only password. `docker-compose.yml:12–165` separately defines `postgres`, `web` and `worker`. `README.md:194–229` instructs `docker compose up -d` without specifying a file. Docker Compose prioritizes `compose.yaml` over legacy `docker-compose.yml` when both exist (Docker documentation: https://docs.docker.com/compose/intro/compose-application-model/).
**Impact:** Following the published quick-start does not start the web application or Maildir worker and can select the development database configuration.

### RB-P0-02 — SMTP/MTA and mailbox-delivery services absent from production Compose [CONFIRMED]
**Evidence:** `docker-compose.yml:12–165` has exactly `postgres`, `web` and `worker`; web only `expose`s port 3000; no Postfix, Dovecot/LMTP, DKIM signer, SMTP service or published port 25/465/587. The README architectural diagram (`README.md:149–189`) assumes an independently running Postfix + Dovecot system.
**Impact:** A newly deployed VPS does not become an Internet-facing mail-receiving server merely by starting this Compose stack; externally arriving SMTP cannot be handled by these containers.

### RB-P0-03 — Published Postfix lookup template cannot reach the Compose database as configured [CONFIRMED CONFIGURATION CONFLICT]
**Evidence:** `deployment/templates/postfix/pgsql-virtual-{domains,mailboxes,aliases}.cf.tpl:1–5` hardcode `hosts = 127.0.0.1` and expect a credentialed `POSTFIX_DB_USER`. `docker-compose.yml:13–30` defines PostgreSQL only inside `readbox_internal` with no host port published; the app connects using hostname `postgres` (`docker-compose.yml:48,134`).
**Impact:** Host-installed or separately containerized Postfix using the supplied template has no configured network route to this PostgreSQL endpoint. The template cannot be treated as a working production mail-routing integration.

### RB-P0-04 — Maildir ownership/permissions contract incomplete across web, worker and MTA [CONFIRMED INTEGRATION RISK]
**Evidence:** `Dockerfile:42–63,82` creates and runs as `nextjs`, UID/GID 1001. `src/core/mailboxes/provisioning.ts:126–160` creates mailbox/Maildir paths with `0700` permissions and no explicit ownership mapping to a mail delivery identity. `deployment/templates/dovecot/99-vibmail.conf.tpl:6–18` uses `vmail` identity. `docker-compose.yml:96–102,153–159` shares named volumes only between web/worker; neither an external Postfix/Dovecot volume mount nor UID/GID contract is supplied.
**Impact:** Unless the external mail delivery process shares the precise UID or an equivalent permission contract, it cannot traverse/write the newly created Maildir. Mail receipt may fail even if DNS and Postfix are otherwise configured.

### RB-P0-05 — No executable end-to-end installation of the external mailserver [CONFIRMED]
**Evidence:** `deployment/templates/postfix/*.tpl`, `deployment/templates/dovecot/99-vibmail.conf.tpl`, `deployment/templates/systemd/vibmail-*.service.tpl` and `deployment/templates/nginx/app.conf.tpl` contain unresolved template values/legacy host paths; no root-level production mailserver installer or Compose service applies these templates, provisions `vmail`, installs system packages, wires LMTP/SQL socket contracts or starts mailserver services. `scripts/ops/backup.sh` and updater scripts presuppose such a host installation.
**Impact:** Repository cloning + app container deployment cannot complete Postfix/Dovecot/mail-server setup from the committed artifacts alone.

### RB-P0-06 — No independently observed live SMTP acceptance-to-inbox acceptance proof [UNVERIFIED RELEASE GATE]
**Evidence:** `package.json` defines unit, UI and a separate `test:postgres` entry but not a complete SMTP/MX/LMTP/Maildir-to-inbox live acceptance test. The reviewed successful Actions job executed npm checks/build, not a production VPS with DNS, port 25, live Postfix and Dovecot.
**Impact:** No trustworthy production GO can be issued for real inbound messages, multi-domain delivery, attachments or mailserver resilience from the existing evidence.

## P1 — High-impact defects, missing integrations and operational risks

### RB-P1-01 — Standalone Compose cannot run from unconfigured sample secrets [CONFIRMED]
**Evidence:** `docker-compose.yml:18,53,134,136` requires `SERVICE_PASSWORD_DB` and `SERVICE_BASE64_64_SECRET`; `.env.example:9–11,29–30` leaves them empty. Automatic generation is a Coolify convention, not native standalone Docker Compose behavior.
**Impact:** An unconfigured standalone installation is rejected during Compose variable validation. Published "copy .env + up" instructions are not sufficient.

### RB-P1-02 — README environment variables and service names diverge from the running configuration [CONFIRMED]
**Evidence:** `README.md:208–229,275–291` refers to `NEXTAUTH_SECRET`, `app`, `db`, Next.js 15 and older storage variable names. Actual Compose uses `AUTH_SECRET` supplied from `SERVICE_BASE64_64_SECRET`, services `web`/`postgres`, and current `package.json` has Next.js **16.4.2**.
**Impact:** Direct copy/paste may misconfigure authentication, database access and runtime deployment.

### RB-P1-03 — First administrator bootstrapping is not wired into Compose startup [CONFIRMED]
**Evidence:** `entrypoint.sh:1–42` creates storage paths, runs migrations and starts the passed process; it does not create an operator account. `scripts/auth/operator.ts:39–76` is an interactive privileged CLI bootstrap. `src/core/auth/operator-bootstrap.ts:23–67` creates the first admin-capable user and a one-time token.
**Impact:** Deploying containers does not automatically complete authenticated first-admin setup; login readiness depends on an additional operator action.

### RB-P1-04 — Setup inspection checks a different administrator table from the bootstrap path [CONFIRMED LOGIC MISMATCH]
**Evidence:** `src/core/auth/operator-bootstrap.ts:45–64` creates a `user` and an `administratorProfile`. `src/core/setup/trusted-operations.ts:397–418` checks only `adminAccount.count()` for the "administrator-created" step.
**Impact:** A valid first administrator created via the project CLI can be misreported as missing by setup verification (false-negative), depending on whether a separate legacy admin row exists.

### RB-P1-05 — HTTP liveness does not prove database, migration or mail readiness [CONFIRMED]
**Evidence:** `docker-compose.yml:104–109` and `Dockerfile:85–87` check `/health/live`; `src/app/health/ready/route.ts:8–15` and `src/core/health/snapshot.ts:69–180` contain the stronger readiness probe.
**Impact:** A green container status may coexist with broken migrations, unavailable mail storage or a failing worker.

### RB-P1-06 — Default readiness policy can accept missing worker heartbeat [CONFIRMED]
**Evidence:** `docker-compose.yml:88` sets `REQUIRE_INGESTION_READY=false`; `src/core/health/snapshot.ts:80–81,111–130,145–158` initializes ingestion as `unknown` and in non-required mode blocks only specific degraded/stale/unavailable values.
**Impact:** `/health/ready` can report ready without proof that a mail ingestion heartbeat has ever been received.

### RB-P1-07 — Worker container health verifies process presence, not successful ingestion [CONFIRMED]
**Evidence:** `docker-compose.yml:160–164` uses `pgrep -f 'scripts/mail/ingest.ts'`, while `src/workers/ingestion.ts` supports degraded heartbeat/error reporting.
**Impact:** Worker may be marked healthy when polling is stuck, mail storage is inaccessible, or ingestion errors persist. No full operational SLO proof is present.

### RB-P1-08 — Postfix DB login role provisioning incomplete [CONFIRMED]
**Evidence:** `prisma/migrations/20261115000000_mailserver_schema_and_roles/migration.sql:103–128` creates `postfix_lookup NOLOGIN` and grants read privileges; `deployment/templates/postfix/pgsql-virtual-*.cf.tpl:1–5` expects a separate login username/password. There is no verified automatically created login principal, secret, network access rule or executable map-file deployment in the production stack.
**Impact:** Even with migrated tables, the Postfix virtual-lookup contract is not fully operational.

### RB-P1-09 — DKIM signing, TLS and external DNS are not provisioned [CONFIRMED MISSING STACK / UNVERIFIED EXTERNALS]
**Evidence:** `src/core/dns/opendkim.ts:52–66` only reads an already existing `mail.txt`; `docker-compose.yml` only mounts a named key volume and provides no OpenDKIM signing daemon or key-generation lifecycle; Nginx template `deployment/templates/nginx/app.conf.tpl:36–42` references external Let's Encrypt certificate files. `src/core/dns/records.ts:45–109` computes suggested DNS values rather than publishing them.
**Impact:** The stack cannot by itself furnish validated mail transport TLS, DKIM signing or a working public DNS configuration. DKIM is mainly essential for any future outbound signing; incoming-only operation must still validate MX/A/PTR/SMTP reachability and applicable TLS policy.

### RB-P1-10 — No production port/DNS/VPS routing evidence [UNVERIFIED]
**Evidence:** No documented successful live check of inbound TCP/25 from the Internet, VPS provider port policy, MX/A/AAAA, reverse PTR, firewall policy, IPv6, TLS certificate trust or end-to-end LMTP delivery in the checked repository and Actions evidence. `.env.example:52–55` defaults to `readbox.local` and loopback `127.0.0.1`.
**Impact:** Network and deliverability readiness remain unknown even if the app build succeeds.

### RB-P1-11 — Backup and restore tools target systemd host layout, not Compose volumes [CONFIRMED]
**Evidence:** `scripts/ops/backup.sh:6–15,40–122` requires root, host env files, `systemctl` and system mail services; `scripts/ops/restore.sh:28–45,65–115` requires host tools, physical paths and services. `docker-compose.yml:167–175` uses Docker named volumes.
**Impact:** Current scripts are not demonstrated as a valid Compose/Coolify backup/restore procedure; in particular, volume names, credentials and service orchestration differ.

### RB-P1-12 — Backup flow deliberately stops Postfix and Dovecot [CONFIRMED OPERATIONAL DOWNTIME]
**Evidence:** `scripts/ops/backup.sh:86–122` builds a service list including `postfix`/`dovecot`, then stops these services before database and file backups. `scripts/updater/upgrade.sh:125–151` claims to keep them active while invoking that backup script.
**Impact:** Mail receipt can be interrupted during backup/upgrades in a host-mode deployment. Upgrade assumptions and backup behavior conflict.

### RB-P1-13 — Restore ownership differs from Docker user identity [CONFIRMED RISK]
**Evidence:** `scripts/ops/restore.sh:94–106` extracts data and runs `chown -R vmail:vmail` on mail, attachments and media; `Dockerfile:42–63,82` runs app/worker as `nextjs`. The backup uses ACL/xattr options (`scripts/ops/backup.sh:133–139`), while restore tar invocation does not explicitly restore the same options.
**Impact:** In a combined Docker/host deployment, a restore may make app data inaccessible or alter expected permissions/ACLs without an explicit UID compatibility contract.

### RB-P1-14 — Separate runtime dependency install is not fully lockfile-reproducible [CONFIRMED]
**Evidence:** `Dockerfile:18–31` runs a fresh `npm install --no-save` for a separately built migrator/runtime dependency set, unlike the main `npm ci` in `Dockerfile:8–16`. Base image `node:22-alpine` is not pinned to an immutable digest.
**Impact:** The npm lockfile correction does not alone guarantee identical production runtime dependency resolution or base-image contents across rebuilds.

### RB-P1-15 — Previous npm audit advisories remain in the reconciled lockfile [CONFIRMED VERSION EVIDENCE]
**Evidence:** Prior GitHub Actions dependency audit reported **two moderate findings** for `next` and `fast-uri`. Current `package-lock.json` still locks `next@16.4.2` and `fast-uri@3.1.8`. The prior Next.js advisory was `GHSA-mfr8-8qww-v76h` and fast-uri had multiple URI parsing advisories. This audit has not re-run `npm audit` on the latest external advisory feed.
**Impact:** Security dependency remediation is not evidenced; severity and fixed versions should not be assumed current without a fresh advisory check. This is **not** proof of a working exploit.

### RB-P1-16 — Production image, external PostgreSQL and failure-recovery integration unverified [UNVERIFIED]
**Evidence:** Successful CI covers `npm ci`, `db:validate`, lint, typecheck, unit, UI and `npm run build`. `package.json` has a separate `test:postgres` script; no evidence in checked completed CI of Docker image build/start, real DB migrations on a disposable PostgreSQL instance, worker + Maildir persistence, SMTP-to-Maildir smoke, host reboot, storage failure or restore drill.
**Impact:** Test PASS does not prove deployability or operational recovery.

## P2 — Conditional bugs, outdated contracts and maintenance findings

### RB-P2-01 — Legacy service names and installation paths remain in production template files [CONFIRMED]
**Evidence:** `deployment/templates/systemd/vibmail-*.service.tpl` uses `/opt/vibmail/app` and `/etc/vibmail/vibmail.env`, `deployment/templates/nginx/app.conf.tpl:15–16,54–55` uses legacy identifiers and log paths; `scripts/updater/upgrade.sh:9–18` still documents legacy paths.
**Impact:** Host-mode installation from these templates can mix names, paths and owners unless explicitly adapted.

### RB-P2-02 — Container update control is intentionally blocked, despite UI availability [CONFIRMED / EXPECTED LIMITATION]
**Evidence:** `src/core/updates/service.ts:433–481` detects Docker/Coolify and returns a blocked updater state directing users to container orchestration. `docker-compose.yml:95` and `.env.example:83` still default `UPDATE_GITHUB_REPO=vibtools/ReadBox` rather than the synchronized target organization.
**Impact:** In-app update expectations and configured release source do not match a fully automated self-update workflow; stale repository metadata is present.

### RB-P2-03 — Password-in-URI construction needs character-safe verification [CONDITIONAL]
**Evidence:** `docker-compose.yml:48,134` interpolates `SERVICE_PASSWORD_DB` directly into PostgreSQL URL credentials.
**Impact:** Secrets containing URL-reserved characters may lead to invalid or misparsed URLs unless encoded appropriately. No evidence demonstrates arbitrary-character passwords work.

### RB-P2-04 — Setup readiness does not establish complete migration history [CONFIRMED]
**Evidence:** `src/core/health/snapshot.ts:99–110` checks unfinished/rolled-back rows in `_prisma_migrations`, not parity against the entire expected migration set.
**Impact:** A manually incomplete database with an existing migrations table could pass this limited migration condition; runtime schema usage may still fail.

### RB-P2-05 — DNS record generator is advisory, not DNS automation [CONFIRMED]
**Evidence:** `src/core/dns/records.ts:45–109` generates MX, A, SPF, DKIM and DMARC suggestions; `src/core/dns/resolver.ts:150–306` checks answers. No production DNS-provider credential, mutation API or zone provisioning is wired to the Compose service.
**Impact:** Dashboard record previews must not be interpreted as DNS records already published. Default DMARC policy `p=none` is monitoring, not enforcement.

### RB-P2-06 — Full two-way mailbox server features are outside the demonstrated stack [CONFIRMED PRODUCT BOUNDARY]
**Evidence:** `src/core/mailserver/pg-adapter.ts:274–275` produces a deliberately disabled mailbox password hash; `deployment/templates/dovecot/99-vibmail.conf.tpl:1` enables LMTP only; `docker-compose.yml` has no outbound SMTP submission/MTA component.
**Impact:** This is primarily an incoming Maildir reader/management application plus a mailserver contract, **not** proof of SMTP sending, authenticated IMAP, mailbox client interoperability or outbound deliverability.

### RB-P2-07 — Backup confidentiality, off-site retention and restore reproducibility unproven [UNVERIFIED]
**Evidence:** `scripts/ops/backup.sh:45–80,124–174` includes configuration files potentially containing secrets and writes local archives; no verified encrypted off-site backup, retention enforcement or container volume restore test is present.
**Impact:** Disaster recovery and exposure controls cannot receive a production GO from static inspection alone.

### RB-P2-08 — Historical reference source and license require clear provenance [CONFIRMED]
**Evidence:** `reference/MailStack/LICENSE` declares AGPL and `reference/MailStack/NOTICE.md` describes separate license/branding conditions; root `LICENSE` declares MIT for ReadBox. Approximately 391 tracked blobs live under `reference/`. `.dockerignore:38–46` excludes this reference source from the Docker build context.
**Impact:** The main app license must not be assumed to override reference-source license obligations. This is a distribution/provenance review item, not a demonstrated runtime failure.

### RB-P2-09 — Archived source history and documentation can still contain outdated assertions [CONFIRMED]
**Evidence:** `README.md` contains stale framework/version/configuration details; old historical `notes/` files were removed from the current tree by this documentation-only audit change (Git history remains intact).
**Impact:** Prior notes describing phases as "production-ready" must not supersede the current evidence-based NO-GO verdict.

### RB-P2-10 — Production readiness defaults do not require a live mailserver [CONFIRMED]
**Evidence:** `src/core/health/snapshot.ts:145–180` checks config, DB, migration table, writable storage and optionally worker heartbeat; it does not open an SMTP connection to Postfix or an LMTP connection to Dovecot.
**Impact:** A green app readiness endpoint is **not** a full-mailserver-ready signal.

## Component-by-component verdict

| Component / operational gate | Static evidence | Verified on a live VPS? | Verdict |
|---|---|---|---|
| React/Next.js application build | PASS in previous GitHub Actions | No | Build validated only |
| Unit/contract tests | 167 passing previously | N/A | PASS, limited scope |
| UI tests | 70 passing previously | N/A | PASS, limited scope |
| npm lockfile reproducibility | Corrected; `npm ci` PASS | No | PASS, code stage |
| Dockerfile (source structure) | Present, standalone runtime stages | No image boot proof | UNVERIFIED |
| Default Compose invocation | Conflicts with production Compose file | Not required to show conflict | BLOCKER |
| PostgreSQL schema/migrations | SQL and Prisma migrations present | No live integration confirmation | UNVERIFIED |
| PostgreSQL → Postfix SQL lookup | Host/container addressing conflict | No | BLOCKER |
| Maildir permissions / UID / GID | `nextjs` vs `vmail` contract absent | No | BLOCKER |
| Postfix SMTP receiving | Not deployed by Compose | No | BLOCKER |
| Dovecot LMTP delivery | Template only, not deployed | No | BLOCKER |
| Public MX/PTR/port-25 delivery | Infrastructure outside repository | No | UNVERIFIED |
| HTTPS/TLS and DKIM | External dependencies/templates | No | UNVERIFIED |
| First-admin creation | Separate interactive operator CLI | No | INCOMPLETE INSTALL FLOW |
| Maildir worker execution | Code and Compose process present | No | UNVERIFIED |
| Ingestion & attachments | Unit tests / implementation | No real received-message E2E | UNVERIFIED |
| Readiness/health | Process and app probes present | No SMTP/LMTP gate | INCOMPLETE |
| Backup/restore | Host/systemd scripts present | No container restore drill | UNVERIFIED |
| Update/release/rollback | Different host/container modes | No live rollout/rollback | UNVERIFIED |
| Security advisories | Existing moderate dependency advisories | No production pen-test | OPEN |

## Findings not claimed

This report does **not** claim that live Postfix, Dovecot, PostgreSQL, reverse DNS, provider firewall or a mail delivery attempt actually failed; those systems were not accessible. It does **not** claim that every possible source vulnerability has been discovered or that passed unit tests prove real-world mail security. Static mismatches are evidenced; external/integration outcomes remain explicitly **UNVERIFIED**.

## Scope and file hygiene

- Current `notes/` is reserved for **this single current forensic report**. The eight older Markdown reports/trackers and `notes/.gitkeep` are removed from the current tree, not from historic Git commits.
- No application source files, Docker or mailserver configuration, schema, infrastructure, tests, releases, tags or live VPS were modified.
- No implementation sequence, patch plan or deployment instructions are included: this document is **findings-only**.

**Final outcome:** **NO-GO for production VPS mailserver operation**; project is a test-passing application snapshot with significant unintegrated mailserver/operations requirements and no live acceptance evidence.
