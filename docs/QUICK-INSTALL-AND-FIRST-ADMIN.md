# QIS-01 ReadBox Quick Installer & Browser Initial Admin

> **Current-documentation reconciliation — 2026-11-20:** Keep this document as a **dated technical, operator or release-governance record**. Its frozen code SHA and statements about what was source-only or not yet live are historical to that phase. The current source is the [documented audited baseline](index.md); consult [current user/operator guides](users/index.md) and [technical coverage](reference/coverage-and-verification.md) for subsequent implemented features and limited inbound operator evidence. No new stable-release or legal sign-off is implied: **R-06 formal 17-gate decision remains NO-GO**, and MIT/legacy AGPL distribution clearance requires separate human review.

**Implementation gate:** GitHub CI only. **Production release: NO-GO.** No VPS, real mail/DNS, public SMTP, tag or release is authorized.

## Fresh standalone host

Prerequisites: Git, Docker Engine + Compose v2, Bash, OpenSSL. Separately configure a trusted HTTPS reverse proxy; QIS-01 does NOT issue TLS certificates, manage domains/DNS, enable public SMTP or provide an Internet-accessible web listener.

```bash
git clone https://github.com/vibtoolshq/ReadBox.git
cd ReadBox
bash scripts/install/readbox-install.sh
```

This runs on an explicitly authorized VPS **only**. It creates private mode-0600 `.env` with independent crypto-random PostgreSQL, auth, and Postfix lookup secrets, never on an existing installation. PostgreSQL itself creates the `readbox` database and user. The installer displays a 43-character (256-bit) one-time owner code once in the terminal; stores **only SHA-256 and one-hour expiry** in the private env and passes only the hash/expiry to the web container. Docker Compose starts PostgreSQL/web/worker, uses existing idempotent Prisma migrations and prepares the private Postfix lookup role without starting the `mailserver` profile.

Web port 3000 is exposed only within Docker. Configure a **separately approved HTTPS proxy**, add `AUTH_URL=https://YOUR-APP-DOMAIN` to the private `.env` (or `PUBLIC_SITE_ORIGIN`), then access `https://YOUR-APP-DOMAIN/initial-setup`. The browser action refuses untrusted/non-HTTPS origins, nonproduction runtime, missing auth, nonprivate PostgreSQL endpoints, expired/invalid owner code, second admin or legacy superuser. On acceptance it reuses the R-04 PostgreSQL advisory-lock transaction to create the first `AdminAccount` with an unusable random password and forced reset. The HTTPS action carries a **one-time admin reset token in the private response**, not URL/log/cookie. Finish password activation with the existing reset action; log in at `/vcon/login`. Existing password rules and token expiry are preserved.

If the code expires or is lost, or browser password activation fails after the admin is created, use the **existing secure PuTTY operator recovery command**. Never delete/reset the DB, volumes or `.env` to get a new owner code. This patch does not change the existing operator CLI or authentication policy.

## Safe rerun and manual update

```bash
bash scripts/install/readbox-install.sh
```

Rerun preserves the existing secrets and volumes exactly; unsafe symlink or missing/weak secrets makes installer refuse modifications. It never runs `docker compose down -v` or rotates an existing DB password.

```bash
# Only after separately setting an authorized age public backup recipient:
bash scripts/install/readbox-update.sh
```

Update requires a private `READBOX_BACKUP_RECIPIENT=age1...` (in env or private `.env`), an available `age` CLI and pre-pulled, reviewed `ubuntu:24.04` recovery helper image. It refuses unapproved Git remotes, dirty worktrees, non-fast-forward histories and missing backup prerequisites. It captures an encrypted pre-update PostgreSQL/Maildir/attachment/media/(Postfix queue if present) backup **before code mutation**, explicitly freezes active writers during the maintenance window, then fast-forwards and rebuilds Compose. On failure **it does not automatically roll back incompatible database migrations**; the encrypted artifact is retained for separately authorized recovery. A local backup is not a replacement for independent offsite retention.

## Boundaries and evidence

QIS-01 has no public TCP/25, reverse proxy SSL, real DNS/MX/PTR, DKIM, SMTP emission or production deploy operation. The release remains **NO-GO**, seven external forensic findings and two R-04 lint issues stay OPEN. Test runs use disposable GitHub runner Docker/PostgreSQL only. No user mail, existing data, UI navigation, auth/login, Prisma schema or mailserver code is modified.

See `notes/015-QIS01-PATCH-AUDIT.md` for explicit implementation and CI evidence after verification.
