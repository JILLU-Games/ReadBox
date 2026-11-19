---
title: "Troubleshooting ReadBox"
description: "Diagnose ReadBox authentication, DNS, inbox, backup and update failures safely."
order: 80
draft: false
---

Use the narrowest safe check before making changes. **Do not delete Docker volumes, reset Git, rotate DKIM keys, restore a production backup or overwrite Cloudflare DNS records as a generic fix.**

| Symptom | First check | Safe next step |
|---|---|---|
| Initial setup unavailable | HTTPS origin, installer code expiry, DB readiness and whether an admin already exists | Recheck [installation prerequisites](installation.md); never bypass activation gate |
| Cannot sign in | Correct user/admin route, account status, reset-required flag, recent lockout | Review `/vcon/audit` if admin; use approved password-reset flow |
| Manual domain says DKIM key missing | Was **Provision / Repair DKIM** run after domain save? | Uncheck **Publish DKIM TXT to configured Cloudflare zone** for another account and provision; inspect returned status |
| **Select a Cloudflare zone before publishing DNS** | Publish DKIM was ON while no matching configured zone was selected | Turn Publish OFF for the manual workflow; do not change unrelated DNS |
| Domain disabled despite DNS records | **Run routing check** and inspect required MX + mail-host A/AAAA statuses | Fix only the missing/mismatched record in the domain's DNS account; allow propagation |
| Domain green DNS but DKIM inspection missing | Routing badge covers MX/A/AAAA, not public DKIM TXT | Use **Inspect all DNS records**; compare TXT owner/segments in authoritative DNS |
| SMTP inbound mail absent | Domain/mailbox active, public MX target, SMTP bind/port, Postfix/Dovecot health, ingestion worker | Check `/health/ready` and Operations; avoid enabling open relay |
| Email accepted but not in inbox | Worker heartbeat, Maildir storage, ingestion/index status | Use guarded **Rebuild mail index** only with scope and approval |
| Attachment not downloadable | Is user a member of the mailbox? Does storage file exist and match confined path? | Expect uniform 404 on absent/unauthorized objects; do not expose arbitrary files |
| Backup agent unavailable | Host systemd unit, private socket, R2 configuration, lock conflict | Read **Backup → Activity & logs**; do not disable root-side controls |
| R2 history visible but recovery uncertain | Is the archive remotely checksum-verified and its Age recovery identity securely retained? | Validate recoverability in an isolated authorized environment; never assume list = restore |
| Update refuses to start | Clean Git, allowed origin, Age recipient, prepared recovery helper, backup lock | Preserve existing worktree and encrypted backups; inspect exact updater error |
| `/health/live` 200, `/health/ready` 503 | Liveness does not imply DB/volume/migration/worker readiness | Inspect readiness result and service health individually |

ReadBox deliberately fails closed on several invalid or unavailable states. A disabled control is sometimes a **permission or operational gate**, not an application bug.

**References:** `src/core/{auth/credentials,dns/resolver,ingestion/service,health/snapshot,backup/agent-client,updates/service}.ts`, `deployment/backup-agent/{agent,r2}.py`. See [FAQ](faq.md).
