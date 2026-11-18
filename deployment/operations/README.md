# R-05 — encrypted ReadBox Compose backup/restore contract

**Never run these procedures without an authorized maintenance window and an independent, separately approved staging/VPS restore plan.** R-05 CI operates on disposable Compose volumes only.

ReadBox uses **one** PostgreSQL 16 database, including the `public` and `mailserver` schemas, and persistent Maildir, attachments/media and Postfix queue named volumes. The Compose recovery utility records a consistent database + volume backup while **stopping the active Postfix, Dovecot, worker and web services**. **SMTP reception is temporarily unavailable whenever the Postfix service was running.** All previously running services are restarted in a guaranteed cleanup path; stopped services are not accidentally started.

## Security and external prerequisites

Install the `docker compose` CLI, Ubuntu 24.04 sidecar image (pull separately before scheduling a backup), `python3` (3.11+), `age` public-key encryption CLI, and GNU tar on the **operator host**. Prepare an age X25519 identity on **another secured machine** using `age-keygen -o backup-key.txt`, retain the secret identity **offline**, and supply only its public `age1...` recipient to backup. CI uses a disposable identity. The tool refuses to create plaintext deliverable backups or include environment files, TLS private keys, database connection strings, authentication secrets or deployment configs. The *encrypted* archive is output mode `0600`; temporary plaintext data is isolated inside a `0700` directory and removed after finishing.

Encrypted output is **not automatically uploaded off-site**, and no retention policy is executed automatically. The operator must transfer the encrypted artifact through an approved secure backup store, validate checksum and expiry/retention, separately protect the age private key, and separately preserve credentials/DNS/TLS config with an approved secret manager. Thus real offsite recoverability remains a release acceptance gate.

### Back up on authorized maintenance host (example only)

```bash
python3 deployment/operations/compose_recovery.py backup \
  --compose-file "$PWD/docker-compose.yml" \
  --project readbox --db-user readbox --db-name readbox \
  --recipient 'age1...REAL_PUBLIC_RECIPIENT...' \
  --output /secure/backups/readbox-2026-11-17.age \
  --confirm-maintenance
```

The recovery tool requires an explicitly named Compose project, pre-existing web/postgres service containers and explicitly staged image. It stops active application writers; the operation is not online-zero-downtime. **It does not change auth or web UI.** It archives only `/var/vmail`, `/var/lib/readbox/attachments`, `/var/lib/readbox/media` and, when an opt-in Postfix container exists, `/var/spool/postfix`. All original numeric file owners, mode bits, extended attributes and POSIX ACLs are preserved with GNU tar. It includes the **full PostgreSQL database** as a custom `pg_dump` artifact. It does **not** include live configuration/secrets or ephemeral lock files; re-create these by separate approved runbooks.

### Restore (EXPLICITLY DESTRUCTIVE; never executed on VPS during R-05)

```bash
python3 deployment/operations/compose_recovery.py restore \
  --compose-file "$PWD/docker-compose.yml" \
  --project readbox --db-user readbox --db-name readbox \
  --recipient 'age1...REAL_PUBLIC_RECIPIENT...' \
  --input /secure/backups/readbox-2026-11-17.age \
  --identity /secure/offline/backup-key.txt \
  --rollback-output /secure/backups/pre-restore-rollback.age \
  --confirm-maintenance --confirm-restore
```

**Safeguards:** verify and decrypt into private staging **before stopping anything**; verify bundle paths/checksums, provenance project and schema target; stop active writer services; capture the *current* database and volumes as a separately encrypted rollback artifact **before mutating**; restore PostgreSQL and all saved volumes with numeric owner/ACL/xattr retention; if apply fails, automatically attempt the saved rollback. The rollback file is not overwritten; if rollback fails the operator must intervene. The utility refuses unknown archive members, symlinks, tar traversal, unexpected target project or database, missing private identity, missing Postfix queue container, or missing encryptor/image. Restoration has a documented downtime window.

Do **not** treat a successful 2026-11-17 disposable test as proof that the VPS firewall, public SMTP queue, external snapshots, backup rotation, secret manager, TLS/DNS or offsite storage work. These need operator evidence in R-06.

## Host systemd mode

Legacy `scripts/ops/backup.sh`, `scripts/ops/restore.sh` and `scripts/updater/upgrade.sh` remain strictly host/systemd tools. They must never be pointed at Docker named volumes. The host backup freezes active mail and ingestion writers and documents the downtime; the host restore preserves recorded numeric ownership and ACLs rather than unconditionally chowning to `vmail`. Existing host upgrade uses explicit archive checksum verification and local rollback; in-container update is intentionally blocked until the orchestrator deploys an image. Source release metadata targets the verified `vibtoolshq/ReadBox` repository.

## R-05 CI proof boundary

`deployment/operations/tests/r05-rehearsal.sh` is the one disposable integration scenario: an ephemeral PostgreSQL 16 database, fake web/worker/Postfix/Dovecot **service containers** mounting named volumes, encrypted backup, destructive mutation of those disposable volumes only, verified restore, owner/ACL retention and deliberately injected restore failure with automatic rollback. It does **not** run a real production service or claim live SMTP uptime. Source UI/auth features stay unchanged.
