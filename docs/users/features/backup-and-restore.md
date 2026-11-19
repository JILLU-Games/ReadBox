# Encrypted backups, Cloudflare R2 and guarded restore

**Admin → System & Settings → Backup** is the UI for root-mediated backup jobs. The web container does **not** directly hold root, the Docker socket, Age private keys or Cloudflare R2 secrets. The backend forwards strictly allowlisted, signed requests over a private Unix socket to a host backup agent.

## Local encrypted backup

The UI has **Create backup**, per-backup **Verify now**, and **Upload encrypted to R2** controls. Backup metadata and job events appear in **Local backups** and **Activity & logs**. **Verify backup** and **View files** top-level buttons may be disabled; use the actual per-backup action instead.

A host snapshot stops relevant writers for consistent PostgreSQL/Maildir capture, creates an Age-encrypted archive, verifies it, and resumes prior services. File access permissions and service state matter; a backup is not equivalent to a validated restore.

## Automatic schedule

**Automatic schedule** exposes an enable toggle, intervals of **6, 12 or 24 hours**, automatic R2 upload, retention-day selection and a local-copy count. The existing agent runs its own UTC scheduler; no systemd timer is required to be enabled. Automatic upload is conditional on R2 configuration. Missing or invalid configuration fails closed.

## Cloudflare R2

The **Cloudflare R2 storage** panel accepts the account ID, bucket and access key credentials. **Test connection** performs an owned object probe; **Refresh remote history** lists remote backup objects. Successful upload requires local archive verification, remote readback and digest comparison. Remote object listing is **not** by itself proof of backup integrity. Do not store R2 credentials in public source or share them in chat.

## Guarded recovery

The UI has **Test restore**, **Restore backup** and a distinct **Confirm guarded restore** step. Production restoration additionally requires a root-side gate file, a verified archive, a short-lived single-use permit, explicit typed confirmation and an encrypted rollback artifact. These protections do not authorize routine live restoration. A failed restore may require an operator to inspect rollback status before continuing.

**Observed 2026-11-20:** the VPS agent was active, scheduler and R2 auto-upload enabled, with 3 historical remote-verified job records; the Windows escrow recovery passphrase decrypted successfully and yielded the VPS agent public recipient. No independent current R2 readback or isolated restore was performed as part of the manual domain test.

**Source:** `src/components/vcon/backup-console.tsx`, `src/app/(workspace)/vcon/backup/actions.ts`, `src/core/backup/agent-client.ts`, `deployment/backup-agent/{agent,executor,r2,restore,scheduler,verification}.py`, `deployment/operations/compose_recovery.py`.
