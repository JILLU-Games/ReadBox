# ReadBox AU-01 — Admin Panel Docker Compose system updates

> **Current-documentation reconciliation — 2026-11-20:** Keep this document as a **dated technical, operator or release-governance record**. Its frozen code SHA and statements about what was source-only or not yet live are historical to that phase. The current source is the [documented audited baseline](index.md); consult [current user/operator guides](users/index.md) and [technical coverage](reference/coverage-and-verification.md) for subsequent implemented features and limited inbound operator evidence. No new stable-release or legal sign-off is implied: **R-06 formal 17-gate decision remains NO-GO**, and MIT/legacy AGPL distribution clearance requires separate human review.

## Scope, tested versus live
AU-01 is a **source-only implementation**, not permission to change an existing VPS.
The current production Compose installation lives at /opt/readbox on the host.
The web app runs as UID/GID 1001 and must never receive root, a privileged
container, a writable host root, or /var/run/docker.sock.

The original ZIP/systemd upgrade.sh remains for legacy host installations.
It is incompatible with a Docker Compose web container and must never be
run from that container. The AU-01 Docker path instead uses the existing
host-side scripts/install/readbox-update.sh, which captures an encrypted R05
consistent snapshot before a clean non-force Git fast-forward and Compose
rebuild. No automatic destructive database rollback is attempted.

## Host architecture
- Docker Compose creates a dedicated named volume: readbox_readbox_update_ipc.
- The web service mounts it READ-ONLY at /run/readbox-updater. It contains only
  a root-managed Unix socket and a root:1001 0640 HMAC access token.
- The root-only systemd unit readbox-updater-bridge.service runs
  scripts/updater/compose_host_worker.py on the approved host.
- The worker accepts authenticated Unix POST /rpc actions ONLY: status,
  preflight, start with a 40-hex lower-case target SHA + explicit confirmation.
  SO_PEERCRED enforces UID/GID 1001; fresh timestamp/nonce/HMAC and replay
  refusal are required. No user-submitted commands, URL, path or Docker args.
- A single persisted root-only status file records lifecycle, sanitized error
  or success; an interrupted update becomes operator-review-required and
  cannot be retried from the UI.
- When starting, the host verifies Primary main and BOTH dedicated backup SHA refs independently,
  refuses mismatch, checks a clean main checkout, private environment/key,
  recovery image, private backup folder and existing guarded updater, before
  executing scripts/install/readbox-update.sh with a pinned target.
- The updater takes the same global backup/restore maintenance lock and
  creates an encrypted R05 backup. Docker health checks are bounded. It
  never resets the database, deletes volumes or issues an automatic restore.

## Safe installation boundary — DO NOT run before independent approval
An operator, only after explicit approval and a snapshot of the current
deployment, deploys the approved source release with the existing operator
workflow, then installs the root bridge:

    cd /opt/readbox
    bash scripts/install/readbox-updater-host-install.sh

Prerequisites: age + Python 3.12, pre-existing mode-0600 .env, private
/var/lib/readbox-backup/identity.txt, mode-0700
/root/.readbox-secrets/pre-update, Ubuntu 24.04 recovery image, Docker
Engine/Compose, a clean main Git checkout and a Compose-created
readbox_readbox_update_ipc volume. The installer is idempotent, never
rotates an existing token, never replaces an unknown customized systemd
unit, and never starts an update. Test the installed bridge with the
Admin Panel's Recheck Preflight.

## Browser flow
1. Authorized admin opens System Update and selects Check for Updates.
2. Docker mode reads Primary main and both dedicated backup GitHub refs; a mismatch
   BLOCKS update. If an approved stable release is present it is displayed
   as informational metadata only: the Docker flow uses verified source SHA,
   not untrusted ZIP assets or an implicit stable-release claim.
3. The screen shows current host SHA, proposed immutable SHA and readiness.
   Unavailable host bridge / active backup / failed update => BLOCKED.
4. After explicit admin confirmation, the server routes a SHA-only request
   through the authenticated root Unix socket; it never accepts remote URLs
   or shell arguments in Docker mode.
5. The root worker independently checks all three fixed refs and the host preflight,
   obtains encrypted pre-update backup, runs safe fast-forward/Compose update,
   bounds the health gate and records sanitized durable status. A failed
   backup prevents code mutation. A failed build/migration preserves the
   encrypted artifact and requires an operator-directed recovery decision.

## Security and limitations
- No live VPS deployment, Docker build on production, real Cloudflare R2,
  production restore, release tag or stable release was performed by AU-01.
- Source SHA equality is NOT a cryptographic signature over a release binary,
  and a successful GitHub CI run is not proof of a live VPS update.
- The root bridge must not run in Coolify or another orchestrator unless its
  exact filesystem/deployment owner and update policy match the approved
  /opt/readbox Compose contract; otherwise remain BLOCKED.
- An interrupted or failed update requires host operator review.
- The private age decryption identity needs independent off-VPS custody;
  local snapshots alone do not constitute independent disaster recovery.
- A live update needs a fresh approval and maintenance window. No browser
  backup/restore/update action should be used as a shortcut for production GO.

## AU-01/UI-01 — Display-only consistency

- In Docker Compose mode, the System Update installation header displays the
  canonical `vibtoolshq/ReadBox` repository instead of the legacy
  `vibtools/ReadBox` environment alias. Non-Docker installations preserve
  their existing repository display behavior.
- After a verified Docker source-channel check, the **System is Up to Date**
  modal displays the current host Git SHA (first 12 hex characters), exactly
  as the Current Version card does, rather than the package `0.1.0` version.
  A missing verified host SHA displays `Unknown`, never a misleading package
  version. The legacy stable-release dialog continues to display its semantic
  package version unchanged.
- This is a UI-only source correction: no update execution, Docker build,
  host updater changes, production VPS deployment, mailserver or R2 actions.

## AU-02 — Controlled live Admin Panel auto-update E2E test marker (2026-11-18)

- Marker ID: `AU02-E2E-DOCS-ONLY-20261118`. This approved documentation-only
  source change creates one new immutable Git main SHA after focused CI.
- The historic AU-02 marker was created when the updater required both
  source/mirror `main` refs; AU-PARITY-01 supersedes that check with the Primary
  `main` and both dedicated backup refs. This marker **is not** a stable
  `v1.0.0` release, a feature change, a database migration, or a signed bundle.
- The next update is **not automatically started** by this marker or Git sync.
  A human must first verify the 17/17 host preflight, the matching new SHA in
  all three approved refs, and an existing encrypted-backup prerequisite.
- An authorized administrator may then explicitly confirm a **single** browser
  update. Its guarded host updater must obtain the global maintenance lock,
  create the encrypted pre-update snapshot, fast-forward main without rewriting
  history, rebuild Compose services, and report a final host SHA/health status.
- If failure occurs, **stop**; do not retry, reset Git, restore production,
  remove volumes, tag/release, modify R2 or override the operator-review gate.
  Record sanitized evidence only; never publish keys, database or mail data.
- The resulting Git/CI verification and the eventual live browser execution
  are **separate gates**. The latter must remain NOT RUN until actual evidence
  confirms it. The formal `v1.0.0` production release remains NO-GO.

## AU-PARITY-01 — Fixed three-ref compatibility, source-only (2026-11-20)

The update preflight must read the same immutable commit from:
- `vibtoolshq/ReadBox:refs/heads/main` (authoritative source).
- `JILLU-Games/ReadBox:refs/heads/backup/dns-final-primary-20261119`.
- `MdNurnobi-Dev/ReadBox:refs/heads/backup/dns-final-primary-20261119`.

The backup repositories' `main` branches intentionally remain unchanged. The web API, root worker, and pinned shell updater independently verify all three refs, accept only the identical lowercase 40-hex SHA, and refuse unavailable/invalid/mismatched refs. URL/ref lists are fixed in source; no user-provided ref or URL can be executed. The host origin allowlist, HMAC/UID/nonce policy, global maintenance lock, encrypted pre-update snapshot, non-force fast-forward, and no-destructive-rollback rules remain unchanged.

This correction does **not** install or trigger an update, migrate a database, or evidence live VPS readiness. A separate user-approved host operation and recovery plan remain mandatory; formal ReadBox release remains NO-GO.

## AU-R2-UPDATE-01 — guarded one-command source workflow (2026-11-20)

**Source implementation only.** The new host runner is intentionally NOT a command
to run against an older \`/opt/readbox\` checkout. First install the audited
guarded runner, Python R2 helper and compatible existing updater/host worker
through a separately authorized, integrity-pinned operator staging procedure.
The runner explicitly refuses an older updater without an R2 receipt guard.
Do not use \`curl | bash\`, a force push, or an unchecked Git object.

Approved exact SHA contract: \`vibtoolshq/ReadBox:main\` plus both
\`backup/dns-final-primary-20261119\` dedicated backup refs. Root-only
entrypoint (after staged, explicit host approval):

\`\`\`sh
sudo bash /opt/readbox/scripts/install/readbox-guarded-update.sh --target-sha <verified-40-hex-target>
\`\`\`

The single command performs bounded, ordered gates:
1. **Read-only preflight:** approved \`/opt/readbox\` root, clean \`main\`,
   exact 3/3 ref equality, Docker/Compose/recovery image, existing healthy
   core service inventory, private \`.env\`, active installed backup agent,
   root-owned age identity and 0700 managed archive directory, configured
   existing R2 credentials, no active/restore-review backup job and backup space.
   No Cloudflare write is performed at this step.
2. **Fresh local V2 archive:** existing HMAC Unix backup broker
   \`backup.create\` → durable job completion → \`backup.verify\` completed.
   The local \`/var/backups/readbox-managed/<backup-id>.age\` is a
   root-owned mode-0600 ciphertext. Validate its SHA256 and record;
   never export private identity.
3. **Offsite proof:** existing \`r2.upload\` on that exact backup ID only,
   bounded wait, adapter's remote HEAD + streamed GET SHA256 and V2 receipt
   \`remoteState=remote_verified\`, matching owned remote key, verified UTC
   timestamp and preserved local ciphertext. R2 403, network error, missing
   or mismatched receipt → STOP before Git or Compose mutation.
4. **Existing safe update:** release the backup agent's global maintenance lock
   after its job, then let \`readbox-update.sh\` acquire the existing global
   lock, produce its independent encrypted pre-update rollback snapshot under
   \`/root/.readbox-secrets/pre-update\` (0700), re-attest the managed
   R2 receipt, and perform pinned non-force Git FF + existing Compose rebuild.
   A competing backup/restore stops the update; no deadlock or silent retry.
5. **Bounded health and manual gate:** exact clean target Git SHA, all
   previously-running Compose services (strict health for postgres/web/worker),
   internal \`/health/live\` and \`/health/ready\` status, Prisma \`migrate status\`
   and backup-agent availability; report fixed markers
   \`AU_R2_UPDATE_HEALTH_PASS\` and
   \`AU_R2_UPDATE_MANUAL_ACCEPTANCE_PENDING\`.
   Host health and human acceptance are separate from 17 formal release gates.

**Fail-safe rules:** no implicit update when prerequisites, R2 or checksum are
unverified. A failed backup or R2 upload preserves local archives. A failed
build, migration or health check preserves both backup artifacts and requires
operator-directed review; **never automatically reset Git, delete volumes or
restore live production data**. Backup bundles deliberately exclude secrets
and are not full host disaster recovery. The age identity and encrypted R2
credential master key require independently retained custody. No UI/auth/Prisma,
mailserver, DNS or unrelated data contract changes.

**Operator final handoff:** after approved host operation, provide sanitized
SHA, backup ID and checksum confirmation, R2 receipt, Compose/Prisma/readiness
and manual inbox/auth/media acceptance results. Only after manual PASS and
permitted notes/SHA reconciliation may the live operation be labelled CLOSED.
The formal R-06 RG-01..17 release review remains **NO-GO** until separately
approved evidence and human signoff.
