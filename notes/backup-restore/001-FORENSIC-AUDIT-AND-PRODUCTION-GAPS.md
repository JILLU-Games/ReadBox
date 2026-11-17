# BR-001 — Source-Level Forensic Audit and Production Gaps

**Immutable code baseline:** `0e8a19e583719e56c054406581bedcf5599f1ace`. Evidence types: **CONFIRMED CODE** = direct file/line; **OPERATOR-OBSERVED** = earlier VPS output/screenshots; **PROPOSED** = not currently implemented. Do not treat any proposed contract as existing code.

## Finding F-01 — Exact admin navigation insertion (CONFIRMED CODE, additive only)

`src/components/layout/app-shell.tsx:109–118` currently defines:

```tsx
{
  id: "system-settings",
  label: "System & Settings",
  icon: Settings,
  items: [
    { href: "/vcon/settings", label: "Settings", icon: Settings },
    { href: "/vcon/system-update", label: "System update", icon: ArrowUpCircle },
  ],
},
```

Anchor: [source](https://github.com/JILLU-Games/ReadBox/blob/0e8a19e583719e56c054406581bedcf5599f1ace/src/components/layout/app-shell.tsx#L109-L118). **Gap:** no `/vcon/backup` route or link in the inspected source tree. Proposed: one additive navigation item and icon import; preserve active-route logic (`:122–132`) and group behavior.

## Finding F-02 — Admin gate exists; superuser restore gate needed (CONFIRMED CODE)

`src/app/(workspace)/vcon/layout.tsx:4–8`:

```tsx
export default async function AdminVconLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  await requireAdminUser();
  return children;
}
```

`src/core/auth/route-access-policy.ts:17–19`:

```ts
if (!authEnabled || !user) return "sign-in";
if (adminOnly && !user.isAdministrator) return "not-found";
return "allow";
```

`src/core/auth/current-user.ts:114–118` provides existing `requireSuperuser()`. See [route source](https://github.com/JILLU-Games/ReadBox/blob/0e8a19e583719e56c054406581bedcf5599f1ace/src/core/auth/route-access-policy.ts#L7-L20). **Gap:** page-level administrator permission is not a restore-specific elevated privilege. Restore/secret rotation must additionally check `requireSuperuser` server-side and a fresh high-risk confirmation. Keep login/session policies intact.

## Finding F-03 — Web cannot safely execute host Docker restore (CONFIRMED CODE)

`docker-compose.yml:34–35`:

```yaml
web:
  user: "1001:1001"
```

`Dockerfile:105` is `USER nextjs`. Web mounts only application data/lock volumes (`docker-compose.yml:107–112`), not the Docker socket. Agent may communicate via a dedicated narrowly permissioned Unix IPC channel; **do not mount** `/var/run/docker.sock` in Web and do not run Web as root. [Compose proof](https://github.com/JILLU-Games/ReadBox/blob/0e8a19e583719e56c054406581bedcf5599f1ace/docker-compose.yml#L34-L112).

## Finding F-04 — Legacy scripts are systemd/host-oriented (CONFIRMED CODE)

`scripts/ops/backup.sh:8–16` resolves `/etc/readbox/readbox.env` and sources a shell env file; `:50–94` invokes `systemctl`. `scripts/ops/restore.sh:54–84` uses `systemctl` and `:123–126` checks `nginx -t`. [Backup](https://github.com/JILLU-Games/ReadBox/blob/0e8a19e583719e56c054406581bedcf5599f1ace/scripts/ops/backup.sh#L50-L94) / [Restore](https://github.com/JILLU-Games/ReadBox/blob/0e8a19e583719e56c054406581bedcf5599f1ace/scripts/ops/restore.sh#L123-L126).

**Gap:** these scripts are not a safe native Docker Compose/UI restore API. Do not call them from the new UI. Do not rewrite them during this feature.

## Finding F-05 — R-05 Compose recovery is real, limited reusable functionality (CONFIRMED CODE)

`deployment/operations/compose_recovery.py:24–28`:

```python
IMAGE = "ubuntu:24.04"
VERSION = 1
DATA_FILES = ("postgres.dump", "web.tar.gz")
WEB_PREFIXES = ("var/vmail", "var/lib/readbox/attachments", "var/lib/readbox/media")
QUEUE_PREFIXES = ("var/spool/postfix",)
```

`:151–163` stops previously-running Postfix/Dovecot/worker/web services and restarts them; `:166–189` dumps DB and archives volumes; `:192–210` encrypts with `age`; `:307–336` creates rollback and attempts rollback on restore failure. Proven **in disposable CI** by `deployment/operations/tests/r05-rehearsal.sh:48–128` (DB, Maildir, attachment, queue, ACL, injected failure, tamper negative). [R-05 source](https://github.com/JILLU-Games/ReadBox/blob/0e8a19e583719e56c054406581bedcf5599f1ace/deployment/operations/compose_recovery.py#L151-L210).

**Gap:** no browser-facing job/history/API; existing R-05 snapshot excludes config/secrets; CI fixture is **not** live restore verification. Treat unavoidable maintenance downtime and mail loss after snapshot time as explicit user-facing risks.

## Finding F-06 — Historical VPS GPG file is NOT R-05 age format (CONFIRMED CODE + OPERATOR-OBSERVED)

Repository engine: `deployment/operations/compose_recovery.py:192–210,254–279`, `age -r` / `age -d`. Earlier user-operated VPS backup: `/var/backups/readbox-encrypted/20261117T205245Z.tar.gz.gpg`, successfully listed after GPG decryption; the host's custom `/usr/local/sbin/readbox-compose-backup` is **not tracked** by GitHub tree. **Gap:** incompatible cryptography, layout, config inclusion and manifest. Never claim the GPG archive is directly restorable by the R-05 engine. Legacy backup initially: visible as `legacy/unverified for restore` until separate format-specific isolated verification.

## Finding F-07 — Restore is destructive and rollback is best-effort (CONFIRMED CODE, critical safety boundary)

`deployment/operations/compose_recovery.py:111–128`:

```python
"find \"$p\" -mindepth 1 -maxdepth 1 -exec rm -rf -- {} +; "
"done; "
"tar --acls --xattrs --same-owner --numeric-owner "
```

`:282–293` also executes `pg_restore` and then volume replacement. `:326–335` explicitly handles a *possible* rollback failure. [Code](https://github.com/JILLU-Games/ReadBox/blob/0e8a19e583719e56c054406581bedcf5599f1ace/deployment/operations/compose_recovery.py#L111-L128). **Gap:** unsuitable for direct browser request without preflight, exact project/format match, pre-restore snapshot, privilege separation and a persistent recovery journal.

## Finding F-08 — Backup job/R2 models do not exist (CONFIRMED CODE)

The complete `prisma/schema.prisma` defines `User, AdminAccount, ... AuditLog, ServiceHeartbeat, SiteSettings` but **no** `BackupJob`, `BackupSchedule` or `R2Credential` (`prisma/schema.prisma:322–369`). `package.json:39–69` has no direct S3/R2 SDK. Inspected tree has no `src/app/(workspace)/vcon/backup/`, `src/core/backup/` or `deployment/backup-agent/`. [Schema](https://github.com/JILLU-Games/ReadBox/blob/0e8a19e583719e56c054406581bedcf5599f1ace/prisma/schema.prisma#L322-L369).

**Proposal, not current fact:** new *host-managed* durable job/schedule/credential state; no changes to existing Prisma schema. R2 credential store is encrypted at rest and inaccessible from browser/localStorage.

## Finding F-09 — Existing audit redaction can be reused (CONFIRMED CODE)

`src/core/audit/record.ts:14–31` redacts keys including `password`, `secret`, `token`, `credential` and `private_key`; `:130–190` records DB audits with fail-soft handling. `src/core/server/logger.ts:13–48` redacts structured logs. [Audit source](https://github.com/JILLU-Games/ReadBox/blob/0e8a19e583719e56c054406581bedcf5599f1ace/src/core/audit/record.ts#L14-L31). **Gap:** DB audit records can be reverted by a database restore. Persist privileged job/restore history separately outside the DB; copy logs must be sanitized.

## Finding F-10 — Existing update guard has no common backup maintenance lock (CONFIRMED CODE)

`scripts/install/readbox-update.sh:18–25` enforces a clean checkout and trusted remote; `:58–67` creates a pre-update age snapshot then redeploys. No backup-agent conflict lock is acquired in the inspected file. [Update script](https://github.com/JILLU-Games/ReadBox/blob/0e8a19e583719e56c054406581bedcf5599f1ace/scripts/install/readbox-update.sh#L18-L67). **Gap:** update/backup/restore coordination must use a single host global maintenance lock. Minimal guard edit only in BR-04, separately tested.

## Finding F-11 — Current recovery coverage is NOT full host disaster recovery (CONFIRMED CODE)

R-05 metadata `config_and_secret_files_included: False` (`deployment/operations/compose_recovery.py:173–181`). Compose also has `readbox_locks`, `readbox_opendkim` and database data volume (`docker-compose.yml:266–273`); R-05 archives Web volume paths and optional queue, not a portable Caddy/TLS/.env/Postfix credential pack. `pg_dump` is database logical data, **not** whole host config or PostgreSQL global roles. Keep a separately encrypted, operator-controlled configuration/identity recovery contract (explicit opt-in) and never silently include secrets in an R2 upload. [Compose volumes](https://github.com/JILLU-Games/ReadBox/blob/0e8a19e583719e56c054406581bedcf5599f1ace/docker-compose.yml#L266-L273).

## Finding F-12 — UI pattern exists but system-update logs are volatile (CONFIRMED CODE)

`src/components/vcon/operations-console.tsx:1–42` uses current `PageHeader/Panel/StatGrid/Badge/Button` components. `src/components/vcon/system-update-console.tsx:105–116` stores logs in React state and `:225–255` polls status. These patterns can be reused for *appearance only*. Backup status must remain available across refresh, web restart and restore; browser-local React logs alone are inadequate. [UI source](https://github.com/JILLU-Games/ReadBox/blob/0e8a19e583719e56c054406581bedcf5599f1ace/src/components/vcon/system-update-console.tsx#L103-L116).

## Priorities and truth labels

- **Confirmed mismatch/risk:** F-04 (systemd vs Compose), F-06 (GPG vs age), F-07 (destructive restore), F-10 (update concurrency), F-11 (incomplete host coverage).
- **Confirmed missing module:** F-01 page/link, F-08 jobs/R2/scheduler, F-12 persistent backup logs.
- **Architectural/security constraints, not existing bugs:** F-02, F-03, F-05, F-09.
- **Not claimed:** new live security exploit, broken Gmail receipt, failed existing CI tests or guaranteed restore/data loss. No production execution took place for this audit.

Formal historic R-06 open findings remain outside Backup/Restore scope except `RB-P2-07`, for which later tested capability/evidence may contribute; no original finding is automatically closed by planning.
