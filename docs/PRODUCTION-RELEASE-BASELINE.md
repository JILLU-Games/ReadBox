# ReadBox first-release baseline — frozen 2026-11-18

**Software package version:** `0.1.0` (unchanged).
**First GitHub candidate tag:** `v0.1.0-rc.1` (prerelease only).
**Formal stable production-release decision:** **NO-GO**. Do not call this v1.0.0 or a production-certified release.
**Deployed source baseline:** `0849bc8d4f4b703800ba73f157f16d5a742ee6e7`; source and mirror `main` both pointed to this exact commit when inspected on 2026-11-18.
**Source:** https://github.com/JILLU-Games/ReadBox
**Mirror:** https://github.com/vibtoolshq/ReadBox
**Evidence record:** [notes/016-LIVE-INBOUND-DEPLOYMENT-ACCEPTANCE.md](../notes/016-LIVE-INBOUND-DEPLOYMENT-ACCEPTANCE.md)

## What has actually been verified

On the authorized Ubuntu/Contabo VPS, the operator reported successful installation of the Compose web, worker, PostgreSQL, Postfix and Dovecot services; an active HTTPS site at `https://anyinbox.cc`; domain MX/A/PTR checks; SMTP STARTTLS, `554` external-relay rejection, `550` unknown local recipient rejection; receipt of one real Gmail message in the authenticated ReadBox inbox; active `postmaster` and `abuse` mailboxes; a local backup with verified checksums/readable PostgreSQL dump; and a GPG AES-256-encrypted backup successfully decrypted for an archive-list check. Five services and HTTPS liveness were healthy in a subsequent operator command.

These are **operator-provided operational observations**, not reproducible GitHub CI evidence or independently signed acceptance. Live mail header and attachment hash tests, formal failure/restart negative tests and all 17 RG gates have **not** been completed as a documented set. Do not elevate partial evidence to complete sign-off.

## Out of scope / outstanding release blockers

- ReadBox remains **inbound-only**. No public authenticated submission, outbound DKIM signer, IMAP or POP3 service is included.
- The original formal seven findings from [release governance](RELEASE-GOVERNANCE.md) remain OPEN in the source ledger until individually reconciled; do not silently rewrite history.
- RG-08 independent Internet/provider testing, RG-10 attachment integrity, RG-11 negative cases, RG-12 admin/auth adversarial tests, RG-13 outage/recovery, RG-14 **encrypted offsite transfer and isolated restore/rollback**, RG-15 monitoring/capacity/incident readiness, RG-16 legal/advisory provenance and RG-17 independent sign-off are incomplete.
- The encrypted backup is retained **on the same VPS** outside the application directory, not offsite: `/var/backups/readbox-encrypted/20261117T205245Z.tar.gz.gpg`; original plaintext backup is also retained locally. Passwords, private keys, tokens and backup contents are **never** committed or attached to GitHub.
- Existing host backup scripts and the operator-created Docker backup helper are not interchangeable; restore must be separately reviewed and tested in disposable resources.
- No operator VPS changes, DNS edits, sending, backup restore, automatic schedule, image publishing or auto-deployment are authorized by this source release-candidate workflow.

## Publication / clean next-update boundary

The first publication is permitted only as a clearly labeled `v0.1.0-rc.1` **GitHub prerelease candidate** after a successful exact-SHA R-06 GitHub Actions run. It publishes a sanitized manifest and tag; it does **not** publish Docker images, deploy, or change the running VPS. A **stable production release remains blocked**, even if CI passes; all historical formal RG gates and independent review must be resolved first.

Future fixes/features start from the reviewed main SHA after source/mirror parity verification. Preserve existing mailbox data, private environment, persistent volumes, migrations, auth/UI policies and proven inbound behavior. Require separately scoped commits, focused CI and explicit release promotion.
