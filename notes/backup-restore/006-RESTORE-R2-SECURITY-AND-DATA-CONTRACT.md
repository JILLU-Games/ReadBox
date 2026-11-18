# 006 — Backup/R2 security contract, source-backed implementation limits

## Trust boundaries (unchanged)

`Admin browser → authenticated Next.js server action → HMAC Unix IPC on Web-only named volume → root-only host backup agent → existing fixed R-05 backup/verify → optional Cloudflare R2`.

- User has no arbitrary shell, file path, Compose override, endpoint URL or production restore action.
- Existing `src/core/backup/permissions.ts`, `src/app/(workspace)/vcon/backup/page.tsx` admin guard and `deployment/backup-agent/agent.py` peer+signature checks are maintained.
- No `.env` secrets, private age identity or source mail bodies should reach R2 or frontend. R-05 `.age` bundle excludes host/TLS/DB-global credentials; data-only encrypted backup is **not full host disaster recovery**.
- R2 endpoint is derived from exact 32-lowercase-hex account ID as `https://ACCOUNT.r2.cloudflarestorage.com` (`r2.py:53–66`). No arbitrary endpoint, public R2 restore or presigned URL.
- Host private R2 config is AESGCM-encrypted, key stored as separate mode 0600 root-only file under same state path (`r2.py:73–104,164–181`). **This is encryption-at-rest, not independent master-key custody.** The private age identity and R2 config/master-key must be independently preserved for host-loss recovery; no plaintext keys in Git or logs.
- `r2.configure` probes list + unique `readbox/managed/health/...` object PUT/head/GET/delete before replacing ciphertext. Failed probe/rotation preserves existing working encrypted config. Probe PUT-ack orphan risk is documented as BR03-SEC-05.
- Only an existing `verified`/`V2` local `.age` snapshot may be uploaded; `r2.py:210–273` re-decrypts/validates, rejects immutable key conflict, verifies remote length and streamed SHA256 before `storage.py.set_remote_verified()`. R2 multipart ETag is never misrepresented as MD5.
- Owned immutable object names: `readbox/managed/<32hex>.age`. Current listing is **partial** (first 100, max30 returned) and does not mark objects remote_verified without explicit upload verification. Remote DELETE is limited to owned health probes; **no arbitrary object/bulk prefix deletion, no remote backup purge**.
- Schedule defaults OFF; UTC only; 6/12/24h; no missed-run catch-up burst. Automatic upload after backup is candidate best-effort only until durable handoff/backoff gap closes.
- Local retention defaults OFF and keeps >=3 local, requires remote_verified first and fresh network/upload re-verification before deleting any local `.age`; does **not** delete remote R2 data. Still requires further crash/power-loss test before operational acceptance.
- The .timer file on candidate is **not installed/enabled by BR-02 installer**, and only agent in-process polling is wired. Host installation, dependency provisioning, environment compatibility, rollback/key backup and real R2 permission probes need separate approval.
- BR-04 restore remains strictly disabled. It must require a preflight+fresh superuser confirmation, immutable format/identity check, encrypted pre-restore rollback and disposable isolated recovery/rollback tests. Never let CI touch production data or use legacy GPG as age without separate parser.

## Strict source/change boundary

No edits to `src/core/auth/**`, mailserver Postfix/Dovecot, Prisma schema/migrations, unrelated app pages, `Dockerfile`, production `docker-compose.yml`, DNS/Caddy/VPS volumes, R-05 `deployment/operations/compose_recovery.py` in the planning task. Candidate BR-03 already changes only 14 approved backup paths. Future host installer changes are **a separately approved exception**, not implicitly allowed by BR-03.

**Evidence:** [source main](https://github.com/JILLU-Games/ReadBox/blob/c08b9cd77ec30afc50fe36952eecb982ba90a982/deployment/backup-agent/agent.py), [BR-03 candidate R2 adapter](https://github.com/JILLU-Games/ReadBox/blob/b8f3fc662d384211d4506e40f13859f9cfcb012a/deployment/backup-agent/r2.py), [candidate scheduler](https://github.com/JILLU-Games/ReadBox/blob/b8f3fc662d384211d4506e40f13859f9cfcb012a/deployment/backup-agent/scheduler.py), [current original installer](https://github.com/JILLU-Games/ReadBox/blob/c08b9cd77ec30afc50fe36952eecb982ba90a982/scripts/install/readbox-backup-agent-install.sh), [successful mock/disposable CI](https://github.com/JILLU-Games/ReadBox/actions/runs/44203727204).
