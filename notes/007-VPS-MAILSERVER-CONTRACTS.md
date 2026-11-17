# 007 — VPS / Postfix / Dovecot / Maildir / Database Integration Contracts

**Frozen baseline:** `e28886e5e0f7a155cd64e23bc8ee8f6668d6699c`. **Status:** interface contract for future scope-approved work; NOT a deployer.

## Deployment mode boundary

| Mode | Exact tracked artifact | Actual availability |
|---|---|---|
| Development DB | `compose.yaml`: `postgres` and profile `postgres-test` | development only; password `local-development-only` |
| Production application | `docker-compose.yml`: `postgres`/`web`/`worker` | exists, does not contain SMTP/LMTP mailserver |
| Host mail services | `deployment/templates/postfix/*.cf.tpl` and `deployment/templates/dovecot/99-vibmail.conf.tpl` | templates only, not an installer |
| Host web/systemd | `deployment/templates/systemd/vibmail-*.service.tpl` and `deployment/templates/nginx/app.conf.tpl` | legacy paths, not applied by Docker |
| Coolify | special `SERVICE_PASSWORD_DB`, `SERVICE_BASE64_64_SECRET` env conventions | requires actual configured secrets and mailserver integration |

**Current supported feature boundary:** inbound Maildir reading/management; the published stack does not prove IMAP/SMTP submission or outbound mail. `src/core/mailserver/pg-adapter.ts:274–275` creates disabled mailbox password hashes; `deployment/templates/dovecot/99-vibmail.conf.tpl:1` sets `protocols = lmtp`. No extra outbound/IMAP scope without explicit approval.

## One authoritative database and filesystem

- Exactly one PostgreSQL with `public` and `mailserver` schemas, Prisma as ORM (`AGENTS.md:1–3`, `prisma/schema.prisma`). Never create another DB.
- Postfix virtual map tables/views: `mailserver.postfix_virtual_domains`, `mailserver.postfix_virtual_mailboxes`, `mailserver.postfix_virtual_aliases` (`prisma/migrations/20261115000000_mailserver_schema_and_roles/migration.sql:75–101`).
- Canonical relative mailbox `<domain>/<local>/Maildir/`; canonical absolute filesystem `/var/vmail/<domain>/<local>/Maildir/{new,cur,tmp}` (`src/core/mailboxes/paths.ts:133–160` and `src/core/mailboxes/provisioning.ts:126–160`).
- Maildir originals and attachment files stay on filesystem; runtime attachments `/var/lib/readbox/attachments` and media `/var/lib/readbox/media`. No deletion during tests.
- Docker web + worker run `nextjs` UID/GID 1001 (`Dockerfile:42–63,82`). Dovecot host template uses `vmail` (`deployment/templates/dovecot/99-vibmail.conf.tpl:6–18`); maildirs are created with `0700`. A tested exact UID/GID/ACL and mount-sharing contract is mandatory.
- Postfix virtual SQL access must use an actual least-privilege login account and network endpoint: `postfix_lookup NOLOGIN` in the migration alone is not sufficient.

### Source code proof — Postfix SQL network mismatch

`deployment/templates/postfix/pgsql-virtual-domains.cf.tpl:1–5`

```ini
user = {{POSTFIX_DB_USER}}
password = {{POSTFIX_DB_PASSWORD}}
hosts = 127.0.0.1
dbname = {{PG_DB_NAME}}
query = SELECT name FROM mailserver.postfix_virtual_domains WHERE name = LOWER('%s')
```

`docker-compose.yml:13–18`

```yaml
postgres:
  image: postgres:16.14-alpine
  restart: unless-stopped
  environment:
    POSTGRES_USER: ${POSTGRES_USER:-readbox}
    POSTGRES_PASSWORD: ${SERVICE_PASSWORD_DB:?Coolify auto-generates SERVICE_PASSWORD_DB}
```

The Postfix localhost SQL template cannot use the Compose-private PostgreSQL endpoint by default. Exposing PostgreSQL publicly is not authorized or an acceptable workaround; service addressing and credentials must be designed and verified.

## Mail transport, DNS, TLS, privacy and admin contracts

1. Public MX → SMTP port 25 Postfix → Dovecot LMTP → authoritative Maildir → ingestion worker → authenticated inbox. Every boundary has a positive, negative and retry/recovery check.
2. Internet port 25, IPv4/IPv6, PTR and firewall depend on the real VPS/provider; DNS previews are *advisory*, not published records (`src/core/dns/records.ts:45–109`).
3. OpenDKIM module only reads public-key text (`src/core/dns/opendkim.ts:52–66`); it does not run a signer or issue certificates. Web HTTPS and SMTP TLS are separate concerns.
4. Web `expose: 3000` is not SMTP; external mailserver listeners must not imply public database exposure.
5. Missing/stale worker heartbeat must not return a misleading production green. `/health/live` is web liveness only, `/health/ready` is not full SMTP/LMTP readiness.
6. Secure first-admin bootstrap from `scripts/auth/operator.ts` uses `src/core/auth/operator-bootstrap.ts` and must match inspector identity semantics in `src/core/setup/trusted-operations.ts`.
7. Backup/restore and updater must match **host** vs **Compose/Coolify** mode, DB, volume, mail/attachment UID and confidential secrets. Existing `scripts/ops/*.sh` are host/systemd-oriented.
8. `reference/MailStack/LICENSE` AGPL and `reference/MailStack/NOTICE.md` remain subject to separate reference license/branding obligations despite root MIT.

## Decisions which must not be silently expanded

- Incoming-only default vs additional SMTP submission/IMAP/outbound features. **Default = inbound-only**.
- Host Postfix/Dovecot + Docker web/worker vs fully containerized MTA. A phase must document one actually supported topology, not create mixed storage/port assumptions.
- Standalone Compose vs Coolify secret-generation/volume contract.
- Backup availability: permitted Postfix downtime is unresolved; no hidden service interruption.
- DNS control: preview/checking only unless DNS-provider mutation is separately requested.

**No live VPS changes, network routing, DNS edits, user-mail sends, production backup actions or release publication are authorized by this plan.** Final GO only under `006`.

## R-02 current implementation addendum (2026-11-17)

Frozen source contract above remains historically correct at baseline. New CI-tested changes at `e1efdbd0b0380a94152947f7be47eb17c5c8d70c`:

- `docker-compose.yml` web/worker have `user: "1001:1001"`, plus `MAILDIR_UID/GID=1001`. Existing data is **never** silently recursively chowned; ownership mismatch stops provisioning. Dovecot LMTP template placeholders `VMAIL_UID/GID` must be set to the same numeric identity in R-03 integration.
- `prisma/migrations/20261117010000_postfix_login_identity/migration.sql` adds a dedicated `readbox_postfix` LOGIN role with NO password initially; it inherits the existing `postfix_lookup` group. A profile-only `postfix-db-credential` service can set a separately managed SCRAM password without exposing PostgreSQL on host ports. Default Compose does not run this provisioning job.
- Postfix `pgsql-virtual-{domains,mailboxes,aliases}.cf.tpl` templates now use `readbox_postfix` and explicit `POSTFIX_DB_HOST/PORT` placeholders. **The renderer, Postfix service, and externally validated network attachment do not yet exist**; supplying the wrong network host still prevents delivery.
- Actual SQL role, positive/negative lookup and migration replay tests passed: https://github.com/JILLU-Games/ReadBox/actions/runs/44099280332.
- **Known residual:** `src/core/health/snapshot.ts` remains unchanged; complete expected migration-history parity is not part of its readiness gate and RB-P2-04 is OPEN until an explicitly approved bounded exception/deferral.
