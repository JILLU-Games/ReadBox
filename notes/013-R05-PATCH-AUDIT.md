# 013 — R-05 Encrypted Compose Recovery and Host Upgrade Safety Forensic Closure

**Date:** 2026-11-17 (Asia/Dhaka)
**Authoritative R-04 parent:** `592078d5750e37fce3ad7600b198d7b9b7932aaf`
**Focused CI tested code + temporary workflow commit:** `fe25bcd5cdf9dfa3b3ee288c53cc3624197fe82e`
**Published code-only SHA:** `a55ec82bb2f58804e910427c66ff6352cd5c14c6`
**Final successful GitHub CI:** https://github.com/JILLU-Games/ReadBox/actions/runs/44121121316
**R-05 status:** **CI IMPLEMENTATION VERIFIED CLOSED; two originally assigned findings remain OPEN** and are not silently waived.
**Project:** 5/6 implementation phases CI verified; **25/32 original findings CI verified, 7 OPEN**.
**Production:** **NO-GO** — no authorized VPS upgrade, backup, restore, offsite retention, public SMTP, DNS or release/tag.

## 1. Exact changed files, tested Scope Lock, and preservation

| Path | Approved R-05 change |
|---|---|
| `deployment/operations/compose_recovery.py` | New encrypted-only Compose PostgreSQL + volumes recovery engine, strict validation, authenticated age decrypt, mandatory private rollback and maintenance freeze |
| `deployment/operations/README.md` | Root/operator manual, separately protected keys/secrets, explicit SMTP downtime, no implied public recovery |
| `deployment/operations/ci-compose.yml` | Completely disposable PostgreSQL 16 and named-volume fixture; not deployable production stack |
| `deployment/operations/tests/r05-rehearsal.sh` | One disposable encrypted backup→restore→post-DB-apply forced rollback, tamper, UID/GID/ACL recovery acceptance test |
| `tests/operations/r05-contract.test.mjs` | Host backup/restore, repo mapping, container updater and config safety contract tests |
| `scripts/ops/backup.sh` | Explicitly quiesce active host mail writers, refuse failed stop, omit plaintext configuration/credentials |
| `scripts/ops/restore.sh` | Validate archive/secret-exclusion sentinel; restore files with numeric UID/GID, ACLs and xattrs; never overwrite all ownership with vmail |
| `scripts/updater/upgrade.sh` | Pre-mutation app and data snapshot; host failure rollback handling; truthful SMTP downtime; build dependencies before pruning |
| `scripts/updater/update_worker.py` | Verified repository alias normalization, fixed generic errors to avoid leaking arbitrary secret-bearing subprocess stderr |
| `src/core/updates/service.ts` | Map historic `vibtools/ReadBox` alias to canonical `vibtoolshq/ReadBox` for **production** release lookup/queue; preserve explicit/dev override behavior; Docker self-update remains blocked |
| `deployment/templates/systemd/vibmail-web.service.tpl` | Correct host systemd internal paths `/opt/readbox`, `/etc/readbox` and `/run/readbox` |
| `deployment/templates/systemd/vibmail-ingestion.service.tpl` | Correct the same host paths |
| `deployment/templates/systemd/vibmail-updater.service.tpl` | Correct the same host/updater paths |

**Only the 13 files above were published**, plus the eight Markdown phase closure documents. The 14th tested maintenance-branch file, `.github/workflows/one-time-r05-ci.yml`, was transport-only and excluded from product `main`.

**Verified untouched:** UI/screens/layout/colors, `src/app/**`, `src/components/**`, auth credentials/session policy, `prisma/**` schema/migrations, `deployment/mailserver/**` Postfix/Dovecot/LMTP config, Docker Compose runtime services/networks, real emails/mailboxes, original release workflow, real DNS and VPS.

## 2. Code-level proof — consistency and confidentiality

### Transactionally coherent maintenance window (not zero-downtime)

`deployment/operations/compose_recovery.py`:

```python
@contextlib.contextmanager
def frozen(args: argparse.Namespace):
    services = running_services(args)
    if services:
        print("R05_MAINTENANCE: stopping previously-running service(s): " +
              ",".join(services), flush=True)
        command(compose(args, "stop", *services))
    try:
        yield
    finally:
        if services:
            command(compose(args, "start", *list(reversed(services))))
            print("R05_MAINTENANCE: only previously-running services restarted", flush=True)
```

This freezes active inbound mail writers while PostgreSQL, Maildir and the queued message volume are snapshotted. **Postfix SMTP is intentionally unavailable during this maintenance window when it was previously active**; no false "keep Postfix active" claim remains. The test fixture verifies only previously active services restarted. The live downtime duration is **unknown**.

### One PostgreSQL + durable file volumes + POSIX metadata

`deployment/operations/compose_recovery.py`:

```python
dump_db(args, stage / "postgres.dump")
volume_tar(web, WEB_PREFIXES, stage / "web.tar.gz")
if postfix:
    volume_tar(postfix, QUEUE_PREFIXES, stage / "queue.tar.gz")
```

```python
command([
    "docker", "run", "--rm", "--network", "none", "--pull", "never",
    "--volumes-from", f"{container}:ro", IMAGE, "tar",
    "--acls", "--xattrs", "--numeric-owner",
    "-C", "/", "-czf", "-", *paths,
], output=destination)
```

No second database. Backed-up PostgreSQL contains both application and mailserver schemas. Named-volume archives retain numeric UID/GID (including 1001:1001), POSIX ACLs, extended attributes, permissions, Maildir and queued mail. The restore uses GNU tar `--acls --xattrs --same-owner --numeric-owner`, **not unconditional recursive chown**.

### Encryption, secret exclusion, checksum and fail-closed restore

`deployment/operations/compose_recovery.py`:

```python
metadata = {
    "format_version": VERSION,
    "compose_project": args.project,
    "db_name": args.db_name,
    "web_uid": 1001,
    "web_gid": 1001,
    "postfix_queue_included": bool(postfix),
    "config_and_secret_files_included": False,
    "snapshot_consistency": "writable services stopped before DB+volume dump",
}
```

```python
with frozen(args):
    create_snapshot(args, before)
    encrypt(before, args.rollback_output, args.recipient)
    print("R05_ROLLBACK_ARTIFACT_ENCRYPTED_PASS", flush=True)
    try:
        apply_snapshot(args, target, metadata)
    except Exception:
        print("R05_RESTORE_FAILED: attempting automatic local rollback",
              file=sys.stderr)
        try:
            apply_snapshot(args, before, validate_snapshot(before, args),
                           allow_test_failure=False)
            print("R05_AUTOMATIC_ROLLBACK_PASS", flush=True)
        except Exception:
            print("R05_CRITICAL: rollback failed; operator intervention required",
                  file=sys.stderr)
        raise
```

- Only a public `age1...` recipient is needed for backup. Restore requires its separately secured private key, valid authenticated ciphertext, a matching explicit Compose project and database, SHA-256 parity, safe tar member paths/types, explicit maintenance/restore flags and **a new encrypted rollback artifact created before mutation**.
- Disk output is encrypted (mode `0600`). Temporary plaintext staging is held in a private mode-`0700` directory and removed. No plaintext host `.env`, Postfix SQL credentials, TLS/DKIM keys or operator passwords are archived. Secret configuration must be restored through a **separately managed confidential backup**.
- Unsafe tar paths, symlinks, special files, missing/corrupt checksums, wrong project, absent encryption tool/identity or tampered ciphertext fail closed.
- **Not automatic**: no offsite upload, retention rotation, external key custody or periodic backup scheduling is claimed or provided.

### Host upgrade and restore safety boundary

`scripts/ops/backup.sh` now states actual SMTP maintenance downtime, refuses a failed stop and excludes confidential configuration. `scripts/ops/restore.sh` restores numeric ownership, xattrs and ACLs and refuses historical unencrypted secret-containing config snapshots. `scripts/updater/upgrade.sh` captures a pre-upgrade application+data snapshot and attempts rollback if a later mutation fails.

**Host/systemd backup, restore, upgrade, migration reversal and network recovery passed only Bash/Python syntax + source-contract tests; no live Ubuntu host integration or VPS upgrade was executed.** Therefore it would be inaccurate to claim proven host upgrade rollback under an actual service outage.

## 3. One focused CI — exact observed proof

**CI SUCCESS:** https://github.com/JILLU-Games/ReadBox/actions/runs/44121121316 — tested `fe25bcd5cdf9dfa3b3ee288c53cc3624197fe82e`.

| Focused test | Actual result |
|---|---|
| Prisma/schema validate, TypeScript, existing backend/unit tests | PASS |
| Existing UI regression (unchanged) | **70/70 PASS** |
| Next.js production build, host Bash and Python syntax | PASS |
| R-05 source paths and host safety checks | PASS |
| Disposable Compose: PostgreSQL 16, web/worker and mailserver stand-in containers with named volumes | PASS |
| Full PostgreSQL `public` + `mailserver` data dump and restore | PASS |
| Encrypted archive and encrypted pre-restore rollback artifact, mode 0600 | PASS |
| SHA-256 manifest and no plaintext credential configuration export | PASS |
| Maildir message, attachment, media and Postfix queued file bytes after restore | PASS |
| Numeric UID/GID 1001:1001 and real Linux POSIX ACL restored | PASS |
| **Failure deliberately injected after a completed DB apply**, then automated rollback | PASS |
| Recovered pre-failure DB rows and Maildir bytes after forced rollback | PASS |
| Authenticated ciphertext tampering rejected before mutation | PASS |
| Previously running maintenance services restarted | PASS |
| Exact 14-path temporary branch Scope Lock audit, Git diff whitespace validation | PASS |

**Proof markers in final CI logs:**

```text
R05_APP_SCRIPTS_UI_AUTH_CONTRACTS_PASS
R05_ENCRYPTED_PRIVATE_BACKUP_PASS
R05_DB_MAILDIR_QUEUE_UID_ACL_RESTORE_PASS
R05_PROVEN_POST_DATABASE_APPLY_AUTOMATIC_ROLLBACK_PASS
R05_AUTOMATIC_ROLLBACK_DB_MAILDIR_PASS
R05_TAMPER_NO_MUTATION_PASS
R05_DISPOSABLE_ONE_SHOT_BACKUP_RESTORE_ROLLBACK_PASS
R05_EXACT_SCOPE_14_PATHS_PASS
```

Earlier necessary targeted CI corrections kept phase scope: the original legacy update-repo test requires development/explicit override behavior; we retained that while canonicalizing the production default. Initial disposable SQL raced PostgreSQL boot, so the fixture now uses Compose `--wait`. The forced rollback test was additionally hardened to require evidence that the injected failure **occurred after DB apply** and that rollback actually succeeded. Final focused CI passed without changing app UI/auth/Prisma/mailserver runtime features.

## 4. Exact forensic finding reconciliation

| Finding | R-05 state | Honest limitation |
|---|---|---|
| `RB-P1-11` — host-only tooling cannot back up Compose volumes | **CI VERIFIED** | Disposable Compose backup/restore; real Coolify/VPS not yet |
| `RB-P1-12` — false zero-downtime backup/upgrade assumption | **CI VERIFIED** | SMTP downtime now explicit; real downtime still unmeasured |
| `RB-P1-13` — wrong ownership/ACL on restore | **CI VERIFIED** | Real disposable volume ACL, numeric 1001 preserved; host not verified |
| `RB-P2-01` — obsolete host service paths | **PARTIAL, REMAINS OPEN** | systemd path content corrected; legacy template filenames and Nginx references outside R-05 Scope Lock unchanged |
| `RB-P2-02` — container self-update and old source repo metadata | **CI VERIFIED boundary** | production repo normalization correct; in-app container update deliberately blocked, orchestrator-managed |
| `RB-P2-07` — confidentiality, offsite retention, recovery | **PARTIAL, REMAINS OPEN** | encrypted/private disposable restore verified; no offsite transfer/retention/key escrow or real host/VPS restore |

**Project:** 25/32 original findings CI verified; **7 OPEN**, including R-05's `RB-P2-01` and `RB-P2-07`, R-03 external public TLS/DNS/port-25 findings, and R-06 acceptance findings. **R-05 implementation/CI exit gate satisfied, phase 5/6 complete. Production remains NO-GO.**

## 5. Strict next-step and release constraints

**R-06** (separate user approval only): final consolidated GitHub acceptance/release governance, real inbound mail/attachment and negative tests, deployment docs, external TLS/DNS/SMTP/provider, auth/restart/recovery, offsite backup/restore evidence and formal GO/NO-GO. The current R-06 allowlist does **not** authorize editing the Nginx template; if it proves necessary, request a separately approved narrow scope exception before editing it. A user must also separately approve any **live VPS**, DNS mutation or production release/tag; requesting R-06 is not automatic authorization.

R-05 performed **no live VPS deployment, no public DNS/SMTP mutation, no release/tag, no mailbox or production database manipulation**, and no unrelated UI/UX or login/auth changes.
