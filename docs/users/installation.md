---
title: "Installation and first administrator setup"
description: "Set up ReadBox using the guarded Docker installer and browser-based first administrator activation."
order: 20
draft: false
---

This guide covers the **existing standalone Docker Compose installer**, not an arbitrary server deployment. Perform any installation, firewall, DNS, secret or data operation only on an authorized host with a backup/rollback plan.

## Requirements

Git; Docker Engine and Docker Compose v2; Bash and OpenSSL; an approved HTTPS reverse proxy for browser access; a PostgreSQL-capable host with persistent volume storage. The runtime image uses Node.js 22 Alpine, while `package.json` declares Node `>=22.12.0`.

```bash
git clone https://github.com/vibtoolshq/ReadBox.git
cd ReadBox
bash scripts/install/readbox-install.sh
```

These commands are the repository's documented **fresh-checkout** path; do not run the installer over an unknown running installation. The installer validates Git checkout and Compose and creates a private mode-0600 `.env` **only if not already present**. It creates strong database/auth/Postfix lookup secrets, starts **postgres**, **web** and **worker**, and prepares the Postfix lookup credential role via an opt-in setup service. It does not automatically configure a public SMTP port or provision HTTPS certificates.

## Browser activation

1. Securely retain the **one-time setup code** displayed by the installer. Only its hash and expiry are saved; never commit or share the code.
2. Provision a trusted HTTPS proxy separately; configure canonical application origin values following [configuration](configuration.md).
3. Visit `/initial-setup` while the first-admin activation gate is valid. Supply the installation code and requested initial admin details.
4. Complete the **forced password-reset** activation returned by the one-time flow, then visit `/vcon/login`.

An expired token, second-admin attempt, unsafe origin or unavailable database is rejected rather than bypassed. The first-admin flow is not a general public registration route.

## Existing installation and updates

Do **not** rerun the fresh installer to update. The checked-in update path is `bash scripts/install/readbox-update.sh`; it requires a clean Git checkout, private `.env`, an authorized Age **public recipient**, the Age CLI, a prepared recovery image and a non-conflicting backup lock. It takes an encrypted pre-update snapshot, fast-forwards the source and rebuilds the Compose web/worker. It **does not automatically reverse a database migration** if a later stage fails; preserve the snapshot and follow a separately approved recovery plan.

The deployed ReadBox source observed on 2026-11-20 was `9c3d99d4...` with 6/6 healthy containers; the subsequent `488f565a...` commit changed documentation only. These are historical operator observations, not a guarantee about a future host.

**Source:** `scripts/install/readbox-install.sh`, `scripts/install/readbox-update.sh`, `src/core/setup/first-admin-activation.ts`, `src/app/initial-setup/actions.ts`, `docker-compose.yml`. More: [Dev build/deployment](https://github.com/vibtoolshq/ReadBox/blob/main/docs/dev/building-packaging.md).
