# 06 — Environment Modes & VPS Cutover Reference

> **Document ID:** `DOC-006`  
> **Purpose:** Clear separation between **AI Studio / Local UI Development**, **Isolated PostgreSQL Testing**, and **Real Ubuntu VPS Production Cutover** so smooth local testing never weakens production security.

---

## 1. Three Operating Modes Compared

| Mode | Where Used | Env Settings | Database Required? | Auth Behavior |
|---|---|---|---|---|
| **Dev Bypass** | AI Studio preview / fast UI work | `NODE_ENV=development` (`.env.development`: `DEV_AUTH_MODE=bypass`, `DEV_AUTH_ROLE=admin\|user`) | Optional | Opens `/users` & `/vcon` directly using in-memory `demo.admin` or `demo.user`. |
| **Dev Demo Auth** | Testing `/sign-in`, roles, iframe cookies, logout | `NODE_ENV=development`, `DEV_AUTH_MODE=demo` | Optional | `/sign-in` uses `demo.admin` / `demo-admin-local-dev` & `demo.user` / `demo-user-local-dev` + `SameSite=None; Secure; Partitioned` on HTTPS iframes. |
| **Real DB Local / Isolated Test** | Auth & schema testing against Postgres | `NODE_ENV=test\|development`, `DEV_AUTH_MODE=off`, `AUTH_ENABLED=true`, `AUTH_TEST_*` + `compose.yaml` | **Yes** (`postgres-test`) | Exercises real Argon2id, `AppSession`, `AdministratorProfile`, `LoginAttempt`, and `mailserver.*` views. |
| **Production VPS** | Live mail server behind Nginx + Postfix + Dovecot | `NODE_ENV=production`, `AUTH_ENABLED=true`, `AUTH_SECRET` (>=32), `DATABASE_URL`, `AUTH_TRUST_HOST=true` | **Yes** (Single PostgreSQL) | **Always clamps `DEV_AUTH_MODE=off`**. Strict `__Secure-`/`__Host-` `SameSite=Lax` cookies, lockout, audit logs, real filesystem roots. |

---

## 2. Production VPS Cutover Prerequisites (Before Live Deployment)

Do **not** deploy to a live VPS until Phases `0–7` pass and every host requirement below is verified:
1. **Host OS & Services:** Clean Ubuntu 24.04 LTS node with inbound TCP `25`, `80`, `443`, valid public `A`/`AAAA`/`MX`/`PTR`, PostgreSQL (`readbox` DB with `public` + `mailserver` schemas and `postfix_lookup` role), Postfix (`pgsql:` lookup configs), Dovecot (`protocols = lmtp`, `vmail:vmail`), OpenDKIM (`/etc/opendkim/keys/<domain>/mail.txt`), and Nginx reverse proxy (restricting `/health/ready` to `127.0.0.1`).
2. **Bootstrap First Superuser Admin:** Run `npm run auth:operator` on VPS -> issue single-use `PasswordResetToken` -> complete password set on `/reset-password` before enabling public traffic.
3. **Filesystem Ownership (`vmail:vmail`, `0700`/`0600`):** `MAIL_STORAGE_ROOT`, `ATTACHMENT_STORAGE_ROOT`, `MEDIA_ROOT`, `MAILBOX_PROVISION_LOCK_ROOT`, `INGESTION_LOCK_FILE`, and `UPDATE_RUNTIME_DIR` (`/run/vibmail`).
4. **Systemd Workers:**
   - `readbox-web.service` (Next.js production server on loopback/Unix socket, unprivileged `vmail` user)
   - `readbox-ingestion.service` (Node Maildir ingestion daemon, `vmail` user, updates `ServiceHeartbeat("maildir_ingestion")`)
   - `readbox-updater.service` (Root-owned privileged worker watching `/run/vibmail/update_request.json` owned by `vmail` mode `0600`/`0640`)
5. **Development Files Never Used in Prod:** `.env.development` is automatically ignored by `next start` / `NODE_ENV=production`, and `/notes/` is strictly a dev-only planning folder.
