# Frequently asked questions

### Does ReadBox send emails?

**No.** The current product is receive-only. It does not expose an outbound compose/send workflow, authenticated SMTP submission or outbound DKIM signer. `src/core/dns/dkim-provision.ts` reports signing as inactive.

### Can I add a domain using another Cloudflare account?

**Yes.** Enable **Manual Mode** on **Add domain**. After saving, uncheck **Publish DKIM TXT to configured Cloudflare zone**, provision the public DKIM key, download the updated zone file, add records in the external account and run routing verification.

### Is “DNS verified” the same as “all DNS records verified”?

**No.** Domain activation is gated by required MX and mail-host A/AAAA routing. The **Inspect all DNS records** control separately checks SPF, DKIM and DMARC TXT.

### Can an ordinary user create or delete a mailbox?

Only if the effective global and per-user policy permits it. Admins configure quota, domain access, create/delete capabilities and retention under **Users control**.

### Is webmail HTML safe to read?

The implementation sanitizes HTML/CSS and renders message HTML with restrictive CSP and sandboxing. This reduces common risks but should not be described as absolute protection against every malicious message.

### Are received attachments stored in PostgreSQL?

No. PostgreSQL stores metadata, hashes and confined paths; attachment bytes live in persistent filesystem storage.

### Are Cloudflare R2 backups automatic?

They can be: enable the backup agent's UTC schedule and **auto-upload**, then configure/test the R2 account and bucket. The UI includes remote checksum verification. Existing journal history is not a substitute for a tested restore.

### Does an update automatically roll back on failure?

No general automatic database rollback is promised. The guarded host updater preserves an encrypted pre-update snapshot, then stops on an incompatible or failed update. A restore requires separate authorization.

### Is this a fully certified production release?

The 2026-11-20 operator evidence establishes **Manual Mode basic inbound live PASS** on the tested domains. The repository's R-06 17-gate stable release decision remains **NO-GO** pending independent evidence and human signoff.

### Which repository is authoritative?

`vibtoolshq/ReadBox` `main`. At the 2026-11-20 pre-documentation audit, both dedicated backup branches on `JILLU-Games/ReadBox` and `MdNurnobi-Dev/ReadBox` pointed to the same `488f565a21f4434ed5a066c5d46794637520ddec` commit. Backup repository `main` branches are not the designated parity targets.

**Further reading:** [Getting started](getting-started.md), [Architecture](../dev/architecture.md), [Production acceptance](../PRODUCTION-ACCEPTANCE-RUNBOOK.md).
