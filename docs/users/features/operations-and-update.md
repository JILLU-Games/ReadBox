---
title: "Operations, health monitoring and system updates"
description: "Inspect ReadBox health, perform guarded maintenance and use the safe system-update flow."
order: 50
draft: false
---

These actions are restricted to administrators. They affect live mail and storage, so use the application's safeguards and a maintenance window when required.

## Operations page

In **Admin → Overview & Ops → Operations**, ReadBox offers these numbered tasks:

| Task | Actual operation | Key boundary |
|---|---|---|
| Verify Postfix PostgreSQL contract | Inspect expected same-database schema/views and routing relationships | Read-only verification |
| Synchronize mail-server schema | Synchronize mailbox metadata; **Dry run** and **Strict validation** options | Writes only when explicitly invoked without dry-run |
| Provision Maildirs | Ensure confined Maildir paths and ownership for applicable mailboxes | May write storage |
| Rebuild mail index | Re-ingest new/cur Maildir messages into PostgreSQL | Can create/update index and attachments |
| Recalculate mailbox counters | Recompute total, unread and last-received values | DB update |
| Repair message bodies | Re-parse source messages with hash/path checks and bounded batch size | May update stored text/HTML |
| Run email retention purge | Apply configured retention policy to expired messages | Destructive; review scope and preview carefully |

These are actual admin-server actions implemented in `src/app/(workspace)/vcon/operations/actions.ts` and `src/core/operations/service.ts`. Do not run repair/purge repeatedly against production merely to confirm a button works.

## Health endpoints

`GET /health/live` returns `{"status":"live"}` when the web process responds; it does not exercise PostgreSQL or mail routing. `GET /health/ready` performs configuration, database, storage and worker-dependent checks and returns HTTP **200** only when ready, otherwise **503**. `GET /api/contact/health` is a small public contact-service liveness endpoint.

## System update page

**Admin → System & Settings → System update** shows installed version/source status, preflight, available release/source target and an update handoff. In Docker Compose mode, a separate **host-side update bridge** owns privileged execution; do not mistake clicking **Check** for a completed install. The UI uses `/api/vcon/update/check`, `preflight`, `start` and `status`, all admin-gated. A host updater first takes an encrypted snapshot and refuses dirty/unapproved Git history and active backup locks.

**Observed deployment:** the operator used `scripts/install/readbox-update.sh` to advance the VPS to `9c3d99d4...`; all six containers subsequently reported healthy. The later GitHub docs-only commit did not alter application executable behavior.

**Source:** `src/components/vcon/{operations-console,system-update-console}.tsx`, `src/core/operations/service.ts`, `src/core/updates/service.ts`, `src/core/health/snapshot.ts`, `scripts/install/readbox-update.sh`.
