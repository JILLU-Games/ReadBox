# Forensic Audit & Implementation Blueprint: `/vcon` Admin Panel (Reference: `reference/MailStack` v1.3.5.5)

> **Scope & Status:** Development-time forensic audit of `reference/MailStack` (all admin and user features) mapped against ReadBox's current Next.js + PostgreSQL + Prisma foundation.  
> **Authoritative Database Policy (`AGENTS.md`):** ReadBox uses **exactly one PostgreSQL database** (`Prisma` ORM) for all application and database-backed mail-server management data, using separate schemas and least-privilege roles where supported for future Postfix/Dovecot lookups. **Do not** add MariaDB, MySQL, SQLite, or a second database. Maildir and attachment/media files remain filesystem data.

---

## 1. Executive Summary

`reference/MailStack` is a self-hosted **receive-only** team mail platform (`Django 5.2` + `MariaDB` + `Postfix` + `Dovecot LMTP` + `OpenDKIM` + `Nginx`). Every administrative workflow—user/RBAC provisioning, domain & DNS verification, mailbox creation/purging, mail-server lookup synchronization, branding/site settings, system health telemetry, and self-upgrading—was audited across views, forms, models, services, templates, JavaScript, systemd workers, deployment templates, and CLI commands.

ReadBox has already migrated the **database schema** (14 tables in `prisma/schema.prisma` + PostgreSQL functional case-insensitive indexes), **NextAuth session/credentials + operator password-reset core** (`src/core/auth/*`), **PostgreSQL readiness probe** (`src/app/health/{live,ready}/route.ts`), **setup lifecycle/authorization pure planners** (`src/core/setup/*`), **read-only Postfix adapter contracts** (`src/core/postfix/read-adapter.ts`), and **UI shell/design tokens** (`src/components/layout/app-shell.tsx`, `src/app/globals.css`). However, `/vcon` (`src/vcon/overview-panel.tsx`) and `/users` (`src/users/overview-panel.tsx`) are currently static `"Foundation"` placeholders.

To reach full parity (and close verified gaps in the reference app) inside `/vcon`, ReadBox needs:
1. **Multi-route `/vcon` workspace** replacing the single placeholder panel (`/vcon`, `/vcon/users`, `/vcon/domains`, `/vcon/mailboxes`, `/vcon/audit`, `/vcon/operations`, `/vcon/settings`, `/vcon/system-update`).
2. **Server-side domain modules under `src/core/`** (`audit`, `accounts`, `domains`, `dns`, `mailboxes`, `mailserver`, `settings`, `updates`, `ingestion`) enforcing `AdministratorProfile` checks, atomic locks, and redacted `AuditLog` persistence.
3. **Single-PostgreSQL `mailserver` schema + least-privilege `postfix_lookup` role** replacing `reference/MailStack`'s separate MariaDB `mailserver` database while honoring the exact 3-view Postfix contract (`postfix_virtual_domains`, `postfix_virtual_mailboxes`, `postfix_virtual_aliases`).
4. **Node/host worker & OS boundaries** for Maildir ingestion (`ServiceHeartbeat`), OpenDKIM key inspection, DNS queries, and privilege-separated system updates.

---

## 2. Forensic Audit of Reference Admin Features (`reference/MailStack`)

### 2.1 Admin Gate & Navigation Visibility
- **Source files:** `apps/core/access.py`, `apps/core/context_processors.py`, `templates/base.html`
- **Access predicate:** `is_admin(user)` requires `user.is_authenticated and user.is_active and (user.is_staff or user.is_superuser)`.
- **Denied behavior:**
  - `require_admin` decorator returns **HTTP 403** (`apps/core/access.py`) on `/accounts/users/*`, `/mailboxes/domains/*`, `/mailboxes/<uuid>/status/`.
  - `/settings/` (`site_settings`) and `/system-update/`, `/api/update/*` also return HTTP 403 (`JsonResponse` for `/api/update/*`, HTML `HttpResponseForbidden` for views).
  - `/mailboxes/<uuid>/delete/` returns **HTTP 404** if neither admin nor `can_delete_mailboxes`.
  - **ReadBox Policy Difference:** ReadBox's `/vcon` layout (`src/app/(workspace)/vcon/layout.tsx` / `page.tsx` via `requireAdminUser()`) returns **404 (`notFound()`)** for non-administrators to avoid route enumeration (`src/core/auth/route-access-policy.ts`). All new `/vcon/*` routes and `/api/vcon/*` handlers should preserve non-enumerating 404 or strict 403/404 consistency.
- **Admin sidebar section ("Management") in `templates/base.html`:**
  - Shared top nav (`Overview`: `Dashboard`, `Mail`: `Mailboxes`, `Create mailbox`, `Enable notifications` button).
  - Admin-only section (`Management`):
    1. `Domains` -> `/mailboxes/domains/`
    2. `User management` -> `/accounts/users/`
    3. `System Update` -> `/system-update/`
    4. `Site Settings` -> `/settings/`

### 2.2 Admin Overview Dashboard & Health Telemetry
- **Source files:** `apps/dashboard/views.py`, `templates/dashboard/index.html`, `apps/core/models.py`
- **Admin KPIs computed globally (non-deleted scope):**
  - `total_mailboxes`, `active_mailboxes`, `disabled_mailboxes`
  - `total_messages`, `total_unread`, `last_received`
- **Admin-only System Health Strip (`system_health`):**
  1. `Ingestion service`: queries `ServiceHeartbeat(service_name="maildir_ingestion")`; evaluates `status`, `last_seen_at`, and staleness threshold (`INGESTION_STALE_AFTER_SECONDS`, default `120s`), surfacing warning/stale/healthy states and worker details.
  2. `Mail storage`: checks `MAIL_STORAGE_ROOT` existence, directory flag, and `os.access(R_OK | W_OK | X_OK)`.
  3. `Database`: executes `SELECT 1` on default DB.
- **Recent Activity Feeds:**
  - `recent_messages` (latest 8 non-deleted messages across all mailboxes) with mailbox pill, sender, subject, unread indicator, timestamp, and link to inbox/detail.
  - `recent_mailboxes` (latest 8 non-deleted mailboxes) with status badge and **click-to-copy email button** (`[data-copy-text]` in `static/js/app.js`).

### 2.3 User & Access Policy Management
- **Source files:** `apps/accounts/{urls.py,models.py,forms.py,views.py,signals.py,admin.py}`, `templates/accounts/{user_list.html,user_form.html,user_confirm_delete.html}`, `static/js/app.js`
- **Routes:**
  - `GET /accounts/users/` (`user_list`) — search `q` (`username`, `first_name`, `last_name`, `email`), Paginator (`25` per page), `mailbox_count` annotation (`Count("mailbox_memberships", filter=Q(mailbox_memberships__mailbox__deleted_at__isnull=True), distinct=True)`). Displays username, full name, role (`Admin` vs `User`), active status, mailbox count, delete flags (`can_delete_messages`, `can_delete_mailboxes`), `last_login`, Edit/Delete actions.
  - `GET/POST /accounts/users/create/` (`user_create`)
  - `GET/POST /accounts/users/<int:user_id>/edit/` (`user_edit`)
  - `GET/POST /accounts/users/<int:user_id>/delete/` (`user_delete`)
- **Models & Signals:**
  - `User` + `UserAccessPolicy` (OneToOne, auto-created via `post_save` signal with `can_delete_messages=False`, `can_delete_mailboxes=False`).
  - `LoginAttempt`: `username_normalized`, `ip_address`, `succeeded`, `created_at`. Lockout rule: `LOGIN_FAILURE_LIMIT = 5` failures within `LOGIN_FAILURE_WINDOW_SECONDS = 900` triggers `LOGIN_LOCKOUT_SECONDS = 900` block; old rows pruned at `max(window, lockout) * 8`; cleared on successful login.
- **Create/Edit Form Mechanics (`AdminUserCreateForm`, `AdminUserUpdateForm`, `user_form.html`, `app.js`):**
  - Case-insensitive username uniqueness (`User.objects.filter(username__iexact=username)`).
  - Always creates standard non-admin users (`is_staff=False, is_superuser=False` hardcoded).
  - Fields: `username`, `first_name`, `last_name`, `email`, `password` (create only — **edit form has NO password reset field**), `is_active`, `can_delete_messages`, `can_delete_mailboxes`, `mailboxes` (`CheckboxSelectMultiple` over non-deleted mailboxes).
  - **JS UX Helpers (`app.js`):**
    - `Generate` username button: picks random US first+last name + 2-digit suffix (`first.lastNN`).
    - `Generate` password button (on create): 14-char cryptographically random password mixing upper/lower/digits/symbols; show/hide toggle; `"Create & copy"` submits with a hidden flag and renders a post-create clipboard modal/copy bar containing username + generated password!
    - Live mailbox search filter + `"N selected"` live counter on the checkbox picker.
- **Critical Guards & Security Rules:**
  - **Admin Edit/Delete Block:** If target user has `is_staff` or `is_superuser`, `user_edit` and `user_delete` **refuse** the operation with warning message: `"Administrator accounts are not editable/deletable in this interface."`
  - **Self-Delete & Last-Active-Admin Guards:** Explicit check blocking `target_user.pk == request.user.pk` and blocking deletion if active admin count `<= 1`.
  - **Deletion Semantics (`user_delete`):** Preserves all mailboxes, messages, attachments, and audit history (cascades only `MailboxMembership` & `UserAccessPolicy`; `SET_NULL` on `deleted_by`/`assigned_by`/`actor`).
- **Audit Events Recorded:**
  - `user_created`, `user_updated`, `user_deleted`
  - `user_activated` / `user_deactivated`
  - `user_delete_permissions_changed` (logs `from` / `to` diff)
  - `mailbox_assignment_added` / `mailbox_assignment_removed`
  - `login_success`, `login_failure`, `logout`

### 2.4 Domain & DNS Management
- **Source files:** `apps/mailboxes/{views.py,forms.py,models.py,dns.py,validators.py,mailserver.py}`, `templates/mailboxes/{domains.html,domain_form.html}`, `static/js/app.js`
- **Routes (all `require_admin`):**
  - `GET /mailboxes/domains/` — lists domains ordered by `-is_default, name`, annotated with non-deleted `mailbox_count`, status (`active`/`disabled`), verification (`pending`/`verified`/`failed`), last checked timestamp, actions.
  - `GET /mailboxes/domains/dns-preview/?domain=<name>` — validates domain syntax and returns JSON for the 5 expected DNS records.
  - `GET/POST /mailboxes/domains/create/` — requires previewing DNS and checking `dns_confirmed`; initializes `status="disabled"`, `verification_status="pending"`; syncs row into `mail_domains` (`active=False`); redirects to `domain_edit` so admin can run verification & copy records.
  - `GET/POST /mailboxes/domains/<uuid>/edit/` — `name` is **immutable** once created (`disabled=True` in form); cannot set `status="active"` unless `verification_status == "verified"`.
  - `POST /mailboxes/domains/<uuid>/check/` — runs `verify_domain(domain.name)`, persists `verification_status`, `last_checked_at`, `verification_details`.
  - `GET /mailboxes/domains/<uuid>/dns-status/` — runs `verify_dns_records(domain.name)`, returns live per-record pass/fail JSON for the DNS modal.
  - `POST /mailboxes/domains/<uuid>/toggle/` — toggles `active` <-> `disabled` (blocks enabling if `verification_status != "verified"`); calls `set_mailserver_domain_active`.
  - `POST /mailboxes/domains/<uuid>/default/` — atomic switch of `is_default`; requires both `status == "active"` and `verification_status == "verified"`.
  - `POST /mailboxes/domains/<uuid>/delete/` — blocks if `is_default`, `name == MAIL_DOMAIN`, or domain has any mailboxes (including soft-deleted ones); deletes from `mail_domains` then app DB.
- **5 Generated DNS Records (`apps/mailboxes/dns.py`):**
  1. **MX:** `@` -> `{MAIL_HOSTNAME}` (priority `10`)
  2. **A or AAAA:** subdomain label derived from `MAIL_HOSTNAME` relative to domain (e.g., `mail`) -> `{SERVER_IP}` (IPv4 `A` or IPv6 `AAAA` depending on `ipaddress.ip_address(SERVER_IP).version`)
  3. **TXT (SPF):** `@` -> `v=spf1 a:{MAIL_HOSTNAME} -all`
  4. **TXT (DKIM):** `mail._domainkey` -> parsed from `/etc/opendkim/keys/{domain}/mail.txt` (reconstructs quoted TXT chunks; if key file absent, marks record `status: "unavailable"`, `copyable: false`, not checked as fatal until generated)
  5. **TXT (DMARC):** `_dmarc` -> `v=DMARC1; p=none; rua=mailto:postmaster@{domain}`
- **DNS Client & Resolver Implementation (`dns.py`):**
  - Pure stdlib UDP/TCP DNS wire-protocol client (no `dnspython` dependency!) reading nameservers from `/etc/resolv.conf` (fallback `127.0.0.53`), with retries and `DNS_LOOKUP_TIMEOUT_SECONDS` (`3.0s`).
  - Also builds **Cloudflare BIND Zone File** export in `static/js/app.js` (`buildCloudflareZone()` -> downloads `<domain>-cloudflare-dns.txt`).
- **Verified Subtlety / Discrepancy to Handle in ReadBox:**
  - Server `verify_domain()` (called by `/check/`) **only** requires `MX == MAIL_HOSTNAME` and `A/AAAA` for `MAIL_HOSTNAME` to resolve to `SERVER_IP`—it does **not** require SPF/DKIM/DMARC.
  - If `verify_domain()` fails, it **forcibly sets `domain.status = disabled`** and `set_mailserver_domain_active(active=False)`. If it succeeds, it **does NOT auto-enable** a disabled domain (admin must explicitly toggle or save active).
  - Meanwhile, the DNS modal JS (`app.js` lines ~1191–1206) hits `/dns-status/` (which checks all 5 records) and auto-POSTs `/check/` only when all 5 pass. ReadBox `/vcon/domains` should make the distinction between **Required Routing Records (MX + A/AAAA)** and **Recommended Deliverability Records (SPF + DKIM + DMARC)** explicit in both UI and API!

### 2.5 Mailbox Provisioning, Lifecycle & Mail-Server Sync
- **Source files:** `apps/mailboxes/{views.py,forms.py,services.py,mailserver.py,validators.py}`, `templates/mailboxes/{list.html,_create_modal.html,confirm_delete.html}`, `static/js/app.js`
- **Routes:**
  - `GET /mailboxes/` — Admin sees **all non-deleted mailboxes** across the system; regular users see only assigned memberships (`accessible_mailboxes`). Supports search (`q` on `email_address`/`local_part`), status filter (`active`/`disabled`), Paginator (`25`), counters (`total_messages`, `unread_messages`), last received, assigned user count/preview, status toggle (admin only), and delete link (admin or `can_delete_mailboxes`).
  - `GET/POST /mailboxes/create/` (and global create modal `_create_modal.html`) — Domain dropdown lists only `status="active"` & `verification_status="verified"` domains, defaulting to `is_default=True`.
    - Admin can assign mailbox to one or more active **non-admin** users (`is_active=True, is_staff=False, is_superuser=False`).
    - Non-admin self-creates mailbox assigned automatically to `[request.user]`.
    - Includes random `first.lastNN` generator (`Generate`), `"Create & copy"` email clipboard flow, and `RESERVED_LOCAL_PARTS` rejection (`root`, `admin`, `administrator`, `webmaster`, `hostmaster`, `mailer-daemon`, `noreply`, `no-reply`, `security`, `system`, `support-system`, `postmaster`, `abuse`) unless `allow_reserved=True` (CLI only).
  - `POST /mailboxes/<uuid>/status/` (`require_admin`, `action=enable|disable`) — updates mailserver DB `active` flag and app `Mailbox.status`; audits `mailbox_enable` / `mailbox_disable`.
  - `GET/POST /mailboxes/<uuid>/delete/` — requires exact typed full `email_address` confirmation (`confirm_delete.html`); calls **`purge_mailbox()`**.
  - `POST /mailboxes/bulk-delete/` — multi-select checkboxes + `window.confirm()` on `mailboxes/list.html`; calls **`purge_mailbox()`** for each selected accessible mailbox.
- **Orchestrated Provisioning (`provision_mailbox`):**
  1. Acquires cross-process lock file under `MAILBOX_PROVISION_LOCK_ROOT` (`timeout=15s`).
  2. Validates `local_part` regex (`^[a-z0-9._+-]{1,64}$`, no `..`, no leading/trailing `.`), domain `active` + `verified`, and `confined_path(MAIL_STORAGE_ROOT, "{domain}/{local_part}")` (no path traversal/symlinks).
  3. Checks app DB collision, mailserver DB mailbox collision, and mailserver alias source collision (`_alias_source_exists`).
  4. Creates Maildir tree `{domain}/{local_part}/Maildir/{new,cur,tmp}` with `0700` permissions (honoring `UMASK` / `vmail` ownership).
  5. Inserts mailserver mailbox row with unrecoverable placeholder password hash (`!VIBMAIL-READ-ONLY!<32-char-token>`) and `MAILBOX_DEFAULT_QUOTA_BYTES` (`2 GiB`).
  6. Creates app `Mailbox` + `MailboxMembership` rows in transaction.
  7. **Compensating rollback on failure:** deletes mailserver row and removes newly created empty Maildir directories if app DB write fails, recording `mailbox_provisioning_failure` audit.
- **Verified Discrepancy (`soft_delete_mailbox` vs `purge_mailbox`):**
  - `apps/mailboxes/services.py` implements `soft_delete_mailbox()` (`Status.DELETED`, `deleted_at`, `deleted_by`) and `schema` has `deleted_at`/`deleted_by` columns, **but no web route calls `soft_delete_mailbox()`**. Both single delete and bulk delete invoke permanent `purge_mailbox()` (deletes stored attachment files from disk, removes mailserver row, hard-deletes app `Mailbox` cascading `Message`/`Attachment`/`MailboxMembership`, `shutil.rmtree` on Maildir root, audits `mailbox_purged`). ReadBox `/vcon/mailboxes` should explicitly decide whether to expose **Soft Delete (Archive)** separately from **Permanent Purge** or match permanent purge with strict typed confirmation.

### 2.6 Mail-Server SQL Contract & Postfix/Dovecot Topology
- **Source files:** `apps/mailboxes/mailserver.py`, `deployment/templates/mariadb/bootstrap.sql.tpl`, `deployment/templates/postfix/*.cf.tpl`, `deployment/templates/dovecot/99-vibmail.conf.tpl`, `apps/mailboxes/management/commands/verify_postfix_contract.py`
- **Reference Topology (MariaDB in reference -> single PostgreSQL `mailserver` schema in ReadBox):**
  - Tables: `mail_domains (domain, active)`, `mailboxes (email, domain, local_part, password_hash, maildir, quota_bytes, active)`, `mail_aliases (source_email, destination_email, active)`.
  - **3 Read-Only Postfix SQL Views:**
    - `postfix_virtual_domains` (`SELECT domain FROM mail_domains WHERE active = true`)
    - `postfix_virtual_mailboxes` (`SELECT email, maildir FROM mailboxes WHERE active = true AND domain IN active domains`)
    - `postfix_virtual_aliases` (`SELECT source_email, destination_email FROM mail_aliases WHERE active = true`)
  - **Postfix Config (`main.cf`):** `virtual_mailbox_domains`, `virtual_mailbox_maps`, `virtual_alias_maps` query those 3 views using a **read-only, column-scoped DB user**; `virtual_transport = lmtp:unix:private/dovecot-lmtp`.
  - **Dovecot Config (`99-vibmail.conf.tpl`):** `protocols = lmtp` (IMAP/POP3/SMTP AUTH intentionally disabled), static `userdb` (`uid=vmail gid=vmail home=/var/vmail/%d/%n`), `mail_location = maildir:~/Maildir`, `passdb` deny-all / unrecoverable.
  - **Identifier Safety:** `mailserver.py` enforces `^[A-Za-z0-9_]+$` on configured schema/table/view identifiers and tests column contract via `verify_postfix_contract`.

### 2.7 Site Settings & Public Branding API
- **Source files:** `apps/core/{models.py,forms.py,views.py}`, `apps/dashboard/views.py`, `templates/dashboard/site_settings.html`
- **Routes:**
  - `GET/POST /settings/` (`require_admin`, HTML 403) — edits singleton `SiteSettings (pk=1)`.
  - `GET /health/site-settings/` (`site_settings_api`, public unauthenticated JSON) — exposes branding fields with optional `Access-Control-Allow-Origin` strictly matched against `PUBLIC_SITE_ORIGIN` (`Vary: Origin`).
- **Fields & Upload Validation:**
  - `site_name`, `site_tagline`, `support_email`, `contact_phone`, `office_address`, `footer_description`, `copyright_text`, `source_code_url`, `privacy_url` (relative `/...` or `http(s)://...`).
  - `logo`: max **5 MB**, allowed extensions/MIME (`gif`, `jpeg`, `png`, `svg`, `webp`).
  - `favicon`: max **512 KB**, allowed extensions/MIME (`gif`, `x-icon`, `ico`, `png`, `svg`, `webp`).
  - Clearable file controls + live upload/metadata persisted to `MEDIA_ROOT/site-settings/` (note SVG uploads in admin settings should be served cleanly/safely via `<img src>` and `nosniff`, never inline executed).

### 2.8 System Update & Privilege-Separated Worker
- **Source files:** `apps/dashboard/views.py`, `templates/dashboard/system_update.html`, `mailbox-app/scripts/{update_worker.py,upgrade.sh}`, `deployment/templates/systemd/vibmail-updater.service.tpl`
- **Admin Routes (`require_admin`):**
  - `GET /system-update/` — reads version from `pyproject.toml` or `VERSION`, renders current version, preflight checklist, latest release card, progress bar, confirmation modal, and live terminal log viewer.
  - `GET /api/update/check/` — fetches `https://api.github.com/repos/vibtools/MailStack/releases/latest` (timeout `10s`, rejects `draft` / `prerelease`), locates `-source.zip` and `-source.zip.sha256` assets, parses release notes/tag/published date.
  - `GET /api/update/preflight/` — returns structured check array verifying:
    1. `/run/vibmail` runtime directory exists & writable
    2. No active update request/lock
    3. `vibmail-updater.service` unit exists & active
    4. `/opt/vibmail/app/scripts/upgrade.sh` exists & executable
    5. Required paths (`app`, `venv`, `data`, `backup`) exist
    6. 13 required OS commands (`unzip`, `sha256sum`, `curl`, `systemctl`, `mysqldump`, etc. — `pg_dump`/`pg_restore` in ReadBox)
    7. 7 active systemd services (`nginx`, `postfix`, `dovecot`, `mariadb`->`postgresql`, `opendkim`, `vibmail-web`, `vibmail-ingestion`)
    8. `vmail` OS user exists
    9. Free disk space >= `100 MB`
  - `POST /api/update/start/` — strictly validates `archive_url` and `checksum_url` match `https://github.com/vibtools/MailStack/releases/download/...` (no query/fragment), checks `409 Conflict` if already queued/running and `503` if preflight fails, writes temp file mode `0640` and atomically hard-links (`os.link`) `/run/vibmail/update_request.json` with exact keys `{ "archive_url", "checksum_url", "confirm_upgrade": true }`.
  - `GET /api/update/status/` — reads `/run/vibmail/update_status.json` (`state`, `step`, `message`, `progress`, `log_lines`).
- **Root Updater Boundary (`update_worker.py` + `upgrade.sh`):**
  - `vibmail-updater.service` runs as `root` polling `/run/vibmail/update_request.json` every `1s`.
  - Verifies via `lstat`: regular non-symlink file, owned by `vmail` UID, mode `0600` or `0640`, exact 3 JSON keys, exact official GitHub URL prefix.
  - Downloads zip + `.sha256` into `0700` temp dir, runs `upgrade.sh --archive ... --checksum ... --confirm-upgrade` under `flock`.
  - `upgrade.sh` verifies SHA-256, checks pending schema migrations (blocks unless `--allow-migrations`), runs full pre-upgrade backup (`backup.sh`), stops web/ingestion while keeping Postfix/Dovecot live, deploys code/deps/migrations/static build, verifies health checks, and auto-rolls back source on non-migration failure.

### 2.9 Audit Logging, Operator CLI Commands & Health Endpoints
- **Audit Logging (`apps/audit/{models.py,services.py}`):**
  - `AuditLog`: `uuid`, `actor` (`SET_NULL`), `action`, `target_type`, `target_identifier`, `ip_address` (extracts first IP from `X-Forwarded-For` only when `TRUST_PROXY_HEADERS=True`, else `REMOTE_ADDR`), `user_agent` (max 500 chars), `details` JSON, `created_at`.
  - Recursive key redaction matching case-insensitive substrings: `password`, `secret`, `token`, `cookie`, `session`, `authorization`, `credential`, `private_key`.
  - Best-effort DB write (catches DB failures, logs error, never breaks admin action).
  - **Verified Reference Gap:** `AuditLog` and `LoginAttempt` exist only in Django Admin (`admin.py`), and `config/urls.py` didn't even mount `/admin/`! There is **no** UI page in `reference/MailStack` to browse audit logs, login lockouts, or trigger message repair/reindex. ReadBox `/vcon` should add dedicated `/vcon/audit` and `/vcon/operations` views!
- **Operator Management Commands (10 commands):**
  - `create_initial_admin` (`--username`, `--password-env`, `--if-missing`)
  - `create_system_mailbox` (`postmaster` / `abuse`, `--confirm`, `--if-missing`)
  - `sync_mailserver_mailboxes` (`--dry-run`, `--strict`)
  - `provision_maildirs` (`--mailbox`)
  - `verify_mailserver_schema`, `verify_postfix_contract`, `verify_mail_storage`
  - `ingest_maildir` (`--once` / `--watch`, `--interval`, `--mailbox`, `--rebuild-missing`, `--dry-run`, `FileLock`, updates `ServiceHeartbeat("maildir_ingestion")`)
  - `rebuild_mail_index` (wraps `ingest_maildir`; note `--rebuild-missing` flag in `reference/MailStack` is redundant/no-op because `ingest_all` already walks all unindexed files)
  - `repair_message_bodies` (`--mailbox`, `--message`, `--limit`, `--dry-run`, `--confirm-repair`; verifies `source_sha256` matches Maildir file before overwriting `text_body` / `sanitized_html_body`)
  - `update_mailbox_counters` (recomputes `total_messages`, `unread_messages`, `last_received_at` on `Mailbox`)
- **Backup/Restore & Health:**
  - `backup.sh` / `restore.sh`: stops web+ingestion, dumps DBs, archives Maildir/attachments/media/config, writes `SHA256SUMS`; `restore.sh` rejects symlinks/path-traversal tar entries.
  - `GET /health/live/` -> `200 OK` JSON (`{"status": "ok"}`).
  - `GET /health/ready/` (loopback-only in Nginx) -> `200`/`503` JSON verifying `SELECT 1`, zero unapplied migrations, writable `MAIL_STORAGE_ROOT` & `ATTACHMENT_STORAGE_ROOT`, and mandatory production settings.

---

## 3. Forensic Audit of Reference User Features & Shared Boundaries

Understanding the user workspace (`apps/messages/*`, `apps/mailboxes/*`, `templates/messages/*`, `static/js/app.js`) is essential because `/vcon` provisions the entities and permission flags that govern `/users`:

1. **Scoped Overview Dashboard (`/`):** Non-admins see KPIs and `recent_messages` / `recent_mailboxes` strictly scoped to their `MailboxMembership` rows (`accessible_mailboxes(user)`), and **do not** see the System Health strip or Management nav section.
2. **Mailbox List & Self-Provisioning (`/mailboxes/`):**
   - Non-admins see only assigned mailboxes, can **self-create** a mailbox under any `active + verified` domain (auto-assigned to themselves), **cannot** toggle `enable/disable`, and can **single/bulk purge** mailboxes **only** if `UserAccessPolicy.can_delete_mailboxes == True`.
3. **Inbox (`/messages/mailbox/<uuid>/`):**
   - Requires `accessible_mailboxes(user)` match (admins implicitly have access to all non-deleted mailboxes).
   - Search (`q` across `sender_name`, `sender_address`, `subject`), filters (`unread=1|0`, `has_attachments=1|0`), pagination (`30/page`), sorted `received_at DESC NULLS LAST, id DESC`.
   - Unfiltered page 1 auto-prepends new messages pushed by live polling.
4. **Message Reader & Safe Rendering (`/messages/mailbox/<m_uuid>/<msg_uuid>/`):**
   - **Auto-read:** Opening an unread message marks `is_read=True`, updates mailbox `unread_messages`, and writes `message_auto_read` + `message_view` audit events.
   - **Mark unread:** `POST .../unread/`.
   - **Soft Delete (`POST .../delete/`):** Guarded by `can_delete_messages == True` OR `is_admin`. Marks `Message.deleted_at` and `deleted_by` while **preserving the raw Maildir `.eml` file on disk** and recalculating mailbox counters.
   - **HTML Sanitization & Iframe Isolation (`/messages/html/<msg_uuid>/`):**
     - Ingestion sanitizes HTML via `bleach` allowlist + `tinycss2` inline-style property allowlist (stripping scripts, remote URLs, `url()`, `@import`, SVG `<svg>`, `position:fixed/absolute`, event handlers, `javascript:`/`vbscript:`, keeping only safe `data:image/*` excluding SVG).
     - Served inside `<iframe sandbox="" referrerpolicy="no-referrer">` from a dedicated endpoint returning strict CSP: `default-src 'none'; img-src data:; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'; frame-ancestors 'self'; navigate-to 'none'`.
   - **Confined Attachment Download (`/messages/mailbox/<m_uuid>/<msg_uuid>/attachment/<att_uuid>/`):**
     - Verifies confined path inside `ATTACHMENT_STORAGE_ROOT`, responds with `Content-Disposition: attachment` (RFC 5987 safe filename), `X-Content-Type-Options: nosniff`, `Cache-Control: private, no-store`, supporting Nginx `X-Accel-Redirect` or direct streaming.
5. **Live Updates & Notifications (`GET /messages/live/`):**
   - Accepts `?cursor=...&bootstrap=1&mailboxes=<comma-uuids>`; requires `X-MailStack-Live-Request: 1` or `Accept: application/json`.
   - Client polling (`static/js/app.js`): `5s` when visible, `15s` when hidden, exponential backoff up to `60s` on network errors; cross-tab deduplication via `localStorage`, `BroadcastChannel`, and `navigator.locks`; fires Web Notifications API + in-app toast + live unread counter updates.

---

## 4. Forensic Gap Analysis: Current ReadBox vs Target `/vcon`

| Domain Area | Present in ReadBox Today | Missing / Needs Adaptation for `/vcon` |
|---|---|---|
| **DB Schema (`prisma/schema.prisma`)** | All 14 core app models already exist (`User`, `AdministratorProfile`, `LoginAttempt`, `UserAccessPolicy`, `AppSession`, `PasswordResetToken`, `Domain`, `Mailbox`, `MailboxMembership`, `Message`, `Attachment`, `AuditLog`, `ServiceHeartbeat`, `SiteSettings`). | Add PostgreSQL `mailserver` schema (`mail_domains`, `mailboxes`, `mail_aliases`, `postfix_virtual_domains`, `postfix_virtual_mailboxes`, `postfix_virtual_aliases`) + least-privilege `postfix_lookup` role in PostgreSQL migrations (single-DB policy). |
| **Auth & Admin Identity (`src/core/auth/*`)** | Session auth, Argon2id hashing, `PasswordResetToken` operator CLI, `AdministratorProfile` (`isAdministrator`, `isSuperuser`), `requireAdminUser()` -> `notFound()` (`src/core/auth/route-guards.ts`), `dev-demo-auth.ts`. | `LoginAttempt` brute-force tracking & IP/username lockout enforcement on sign-in, `UserAccessPolicy` auto-provisioning/queries, `lastLogin` updates, and admin user CRUD services. Note: `User` has both legacy `isStaff`/`isSuperuser` columns and `AdministratorProfile`; consolidate authorization strictly on `AdministratorProfile`! |
| **Layout & Navigation (`src/components/layout/app-shell.tsx`)** | Basic sidebar with 2 links (`/users`, `/vcon`) visible to all signed-in workspace users + `"Foundation mode"` footer banner. | Role-aware navigation (hide `/vcon/*` from non-admins; show `Management` sub-nav for admins: Overview, Users, Domains, Mailboxes, Operations, Audit & Security, Settings, System Update), dynamic `SiteSettings` branding/favicon, sign-out button, user menu. |
| **Admin UI (`src/vcon/*`)** | Single static card in `src/vcon/overview-panel.tsx` (`"Services not connected"`). | Full `/vcon` multi-page App Router subtree (`page.tsx` + 7 sub-sections), search/filter/pagination, confirmation modals, copy-to-clipboard flows, DNS record verification drawer, and live status polling. |
| **User UI (`src/users/*`)** | Single static card in `src/users/overview-panel.tsx`. | Scoped dashboard, mailbox list & self-create, inbox list, message reader + sandboxed HTML iframe + attachment download + live polling (shared backend services provisioned from `/vcon`). |
| **Mail-Server & Postfix Adapter (`src/core/postfix/*`)** | Pure TypeScript interfaces in `read-adapter.ts` + mock stub `mock-read-adapter.ts`. | Real PostgreSQL `mailserver` schema read/write adapter (`PgMailServerAdapter`), Postfix view contract verifier (`verifyPostfixContract`), and Dovecot/OpenDKIM path inspectors. |
| **Setup & Operations (`src/core/setup/*`)** | Pure state machines (`lifecycle.ts`, `progress.ts`, `authorization.ts`, `trusted-operations.ts`) with no persistence or UI wiring. | Wire setup/upgrade/operational actions cleanly with persistent state, `ServiceHeartbeat`, and privileged worker contract without bypassing `trusted-operations.ts` security boundaries. |
| **Audit Logging** | `AuditLog` Prisma table exists (`uuid`, `actorId`, `action`, `targetType`, `targetIdentifier`, `ipAddress`, `userAgent`, `details`). | `recordAudit()` helper with recursive key redaction (`password`, `secret`, `token`, `cookie`, `session`, `authorization`, `credential`, `private_key`), trusted-proxy IP parser, and `/vcon/audit` viewer UI. |
| **Health Probes (`src/core/health/snapshot.ts`)** | `getReadinessSnapshot()` only checks `env.databaseUrl` + `SELECT 1`; hardcodes `mailServices: { connected: false }`. | Extend readiness & admin telemetry to check `ServiceHeartbeat("maildir_ingestion")`, `MAIL_STORAGE_ROOT`/`ATTACHMENT_STORAGE_ROOT` RWX permissions, `mailserver` schema contract, and loop-only detailed diagnostics vs minimal public `/health/ready`. |
| **Ingestion & Sanitization** | Empty placeholder `src/workers/README.md`; no MIME parser or sanitizer packages installed. | Node Maildir watcher/ingestion worker, MIME parser, HTML/CSS allowlist sanitizer matching `bleach`+`tinycss2` security invariants, attachment storage confinement, body repair, and counter recalculation. |

---

## 5. Complete Requirements Blueprint for ReadBox `/vcon` Admin Panel

### 5.1 App Router Page & Navigation Architecture
Replace the single `/vcon` placeholder with a dedicated admin navigation group (rendered in `AppShell` only when `currentUser.isAdministrator === true`) and nested Next.js App Router pages all guarded by `await requireAdminUser()` (returning `notFound()` otherwise):

1. **`/vcon` — System Overview Dashboard**
   - **Global KPIs:** Total Mailboxes, Active Mailboxes, Disabled Mailboxes, Total Messages, Unread Messages, Last Delivery Timestamp.
   - **System Health Strip:** Database (`SELECT 1` + `mailserver` schema check), Maildir Ingestion (`ServiceHeartbeat` freshness vs `INGESTION_STALE_AFTER_SECONDS`), Mail & Attachment Storage (`MAIL_STORAGE_ROOT` / `ATTACHMENT_STORAGE_ROOT` RWX permissions), Postfix Lookup Contract status.
   - **Recent Deliveries (8)** & **Recently Created Mailboxes (8)** with click-to-copy email address and quick links.
2. **`/vcon/users` — User & Access Policy Management**
   - Search (`q` across username, first/last name, email) + server-side pagination (`25/page`), mailbox count badge, role badge (`Admin` vs `User`), status badge, permission badges (`Delete messages`, `Delete mailboxes`), `lastLogin`.
   - **`/vcon/users/new`** (Create User): `username` + random `first.lastNN` generator, `firstName`, `lastName`, `email`, `password` + 14-char CSPRNG generator + show/hide + `"Create & copy"` credential modal, `isActive`, `canDeleteMessages`, `canDeleteMailboxes`, searchable multi-select `mailboxes` checkbox list + selected counter.
   - **`/vcon/users/[id]/edit`** (Edit User): Case-insensitive uniqueness check, metadata/status/permissions/mailbox-membership diffing; **blocks editing admins** (`AdministratorProfile !== null`) unless future superuser workflow is explicitly scoped; optional ReadBox **operator password-reset token** integration note (without exposing password fields directly on standard edit if maintaining MailStack parity, or generating a one-time `PasswordResetToken` link cleanly).
   - **Delete User Dialog/Action:** Blocks deleting admins, blocks self-deletion, blocks deleting last active admin; preserves mailboxes/messages/audits; cascades `MailboxMembership`/`UserAccessPolicy`/`AppSession`.
3. **`/vcon/domains` — Domain & DNS Verification**
   - Domain list sorted by `isDefault DESC, name ASC`, showing non-deleted mailbox count, `status` (`active`/`disabled`), `verificationStatus` (`pending`/`verified`/`failed`), `lastCheckedAt`.
   - **`/vcon/domains/new`** (Add Domain): Live `/api/vcon/domains/dns-preview?domain=...` preview of all 5 records (`MX`, `A/AAAA`, `SPF`, `DKIM`, `DMARC`), Cloudflare BIND zone download (`<domain>-cloudflare-dns.txt`), per-record copy, required `"I have reviewed DNS records"` checkbox; creates domain as `disabled` + `pending` + syncs `mailserver.mail_domains` -> redirects to `/vcon/domains/[uuid]/edit`.
   - **`/vcon/domains/[uuid]/edit`**: Immutable domain `name`; DNS Verification Panel distinguishing **Required Routing (`MX` + `A/AAAA`)** from **Deliverability (`SPF` + `DKIM` + `DMARC`)**; live `"Check DNS"` modal (`/api/vcon/domains/[uuid]/dns-status` & `POST .../check`); auto-disables domain + `mailserver.mail_domains` if routing verification fails; Toggle Active/Disabled, Set Default (requires `active && verified`), Delete (blocked if `isDefault`, `== MAIL_DOMAIN`, or `mailboxCount > 0`).
4. **`/vcon/mailboxes` — Global Mailbox Administration**
   - All non-deleted mailboxes (plus optional ReadBox filter for soft-deleted if soft-delete is surfaced), search (`q`), status filter (`all`/`active`/`disabled`), pagination (`25/page`).
   - **Create Mailbox Modal / Page:** Domain selector (`active && verified` domains only, defaults to `isDefault`), local-part validator + `RESERVED_LOCAL_PARTS` enforcement + random `first.lastNN` generator, multi-user picker (active non-admin users), `"Create & copy"` email.
   - **Admin Actions:** Enable/Disable toggle (`POST` updating both `mailboxes.status` and `mailserver.mailboxes.active`), Single Permanent Purge (modal requiring exact `emailAddress` typed confirmation), Bulk Permanent Purge (multi-select checkboxes + strict confirmation modal listing targets).
   - **System Mailboxes Panel/CTA:** Dedicated admin-confirmed creation of `postmaster@<domain>` and `abuse@<domain>` (matching CLI `create_system_mailbox`) so operators don't have to SSH just to create RFC-required system aliases/mailboxes.
5. **`/vcon/operations` — Mail-Server Diagnostics & Maintenance** *(closes reference UI gap)*
   - Live status & manual triggers (admin-only + audited) for:
     - `verify_postfix_contract` & `sync_mailserver_mailboxes` (`dry-run` preview + `strict` reconcile diff between `public.mailboxes`/`domains` and `mailserver.*`).
     - `provision_maildirs` (ensure `{domain}/{local_part}/Maildir/{new,cur,tmp}` `0700` exists).
     - `rebuild_mail_index` (scan unindexed Maildir files) & `update_mailbox_counters`.
     - `repair_message_bodies` (dry-run preview + SHA-256 verified confirm action).
6. **`/vcon/audit` — Audit Trail & Login Security** *(closes reference UI gap)*
   - Paginated filterable viewer for `AuditLog` (`action`, `targetType`, `actor`, date range, JSON details viewer—already redacted on write).
   - `LoginAttempt` security monitor showing active IP/username lockouts (failures within window) and audited lockout clear/inspection.
7. **`/vcon/settings` — Site Settings & Branding**
   - Singleton `SiteSettings` (`id=1`) form: `siteName`, `siteTagline`, `supportEmail`, `contactPhone`, `officeAddress`, `footerDescription`, `copyrightText`, `sourceCodeUrl`, `privacyUrl` (validated relative `/...` or `http(s)://...`).
   - Logo (<= 5 MB) & Favicon (<= 512 KB) upload with strict MIME + extension checks and clear toggles, saved outside public repo or under confined `MEDIA_ROOT/site-settings/` and served safely with `X-Content-Type-Options: nosniff`.
   - Public read-only endpoint `GET /api/site-settings` (or `/health/site-settings`) with strict `PUBLIC_SITE_ORIGIN` CORS matching.
8. **`/vcon/system-update` — Release & System Upgrade Console**
   - Reads running ReadBox version, checks `https://api.github.com/repos/.../releases/latest` (non-draft, non-prerelease, `-source.zip` + `.sha256` assets), renders 9-item preflight checklist, enforces double confirmation, triggers atomic hard-linked request file to privileged root updater, and polls status/logs.

---

### 5.2 Authorization, Security & Mutation Rules (Server Actions / API Routes)
Every `/vcon` Server Action and `/api/vcon/*` route handler **must**:
1. **Call `requireAdminUser()` / `requireStaffUser()` server-side** (`src/core/auth/current-user.ts`) — never trust client navigation or props. Return 404 (`notFound()`) or generic 404 JSON for non-admins.
2. **Validate inputs with Zod** (`zod` already installed) — reject invalid UUIDs, out-of-range pagination, unsafe SQL/path characters, invalid URLs, or oversized uploads before touching DB or filesystem.
3. **Verify CSRF / Origin** on all state-changing `POST`/`DELETE` route handlers (Next.js Server Actions have built-in Origin/Host checks; custom `/api/vcon/*` routes must explicitly validate Origin/Host when `AUTH_ENABLED=true`).
4. **Enforce Domain Invariants:**
   - Cannot modify or delete `AdministratorProfile` users from `/vcon/users` standard management (or require explicit superuser-only CLI/flow + self-delete + last-active-admin guard).
   - Domain `name` immutable after creation; `status="active"` requires `verificationStatus="verified"`; `isDefault=true` requires `active && verified`; delete blocked if default, `MAIL_DOMAIN`, or any mailboxes exist.
   - Mailbox local-part rejects `RESERVED_LOCAL_PARTS`, path traversal, `..`, leading/trailing `.`; Maildir & attachment paths must pass `realpath` confinement check inside `MAIL_STORAGE_ROOT` / `ATTACHMENT_STORAGE_ROOT`.
   - Destructive purge requires exact email address string match on server (`input.confirmation === mailbox.emailAddress`) and cleans up: attachment files on disk -> `mailserver.mailboxes` -> Prisma `Mailbox` (cascading messages/attachments/memberships) -> Maildir tree on disk.
5. **Write Redacted `AuditLog` (`recordAudit()`):**
   - Extract client IP (`X-Forwarded-For` first hop only if `TRUST_PROXY_HEADERS=true`).
   - Recursively redact sensitive keys (`password`, `secret`, `token`, `cookie`, `session`, `authorization`, `credential`, `private_key`).
   - Best-effort persistence (never mask primary success if audit insert errors, but log structured error via `src/core/server/logger.ts`).

---

### 5.3 Single-PostgreSQL Mail-Server Schema & Postfix/Dovecot Plan
To strictly comply with `AGENTS.md` (single PostgreSQL database, no MariaDB/MySQL/SQLite):
1. **Create dedicated PostgreSQL schema `mailserver`** inside the existing ReadBox PostgreSQL database via Prisma SQL migration:
   - `mailserver.mail_domains (id, domain UNIQUE, active, updated_at)`
   - `mailserver.mailboxes (id, email UNIQUE, domain, local_part, password_hash, maildir, quota_bytes, active, updated_at)`
   - `mailserver.mail_aliases (id, source_email, destination_email, active, updated_at)`
2. **Create 3 read-only views in `mailserver`** matching Postfix's exact expectations:
   - `mailserver.postfix_virtual_domains` -> `SELECT domain FROM mailserver.mail_domains WHERE active = TRUE`
   - `mailserver.postfix_virtual_mailboxes` -> `SELECT m.email, m.maildir FROM mailserver.mailboxes m JOIN mailserver.mail_domains d ON d.domain = m.domain WHERE m.active = TRUE AND d.active = TRUE`
   - `mailserver.postfix_virtual_aliases` -> `SELECT source_email, destination_email FROM mailserver.mail_aliases WHERE active = TRUE`
3. **Create a least-privilege PostgreSQL role (`postfix_lookup`)** granted **only** `USAGE ON SCHEMA mailserver` and `SELECT` on the three `postfix_virtual_*` views (zero access to `public.*` app tables, sessions, password hashes, or messages).
4. **Upgrade `src/core/postfix/read-adapter.ts` implementation:** Implement `PgReadOnlyMailServerAdapter` querying `mailserver.postfix_virtual_*` views, plus a privileged app-owned `MailServerSyncService` used inside `provisionMailbox()`, `setMailboxStatus()`, `purgeMailbox()`, and domain activation/deletion with compensating rollback if Maildir/PostgreSQL cross-step provisioning fails.
5. **Postfix/Dovecot Host Configs:** Migrate `deployment/templates/postfix/sql-*.cf.tpl` from `hosts = ...` MariaDB driver to Postfix `pgsql:` lookup tables (`hosts = ...`, `dbname = readbox`, `user = postfix_lookup`, `query = ... FROM mailserver.postfix_virtual_*`). Keep Dovecot LMTP (`vmail:vmail`, `maildir:/var/vmail/%d/%n/Maildir`) identical.

---

### 5.4 New Server Modules Needed (`src/core/`)
- `src/core/audit/record.ts` — `recordAudit()`, `redactSensitiveData()`, proxy-aware `extractClientIp()`.
- `src/core/accounts/users.ts` — `listUsers()`, `createManagedUser()`, `updateManagedUser()`, `deleteManagedUser()`, `checkLoginLockout()`, `recordLoginAttempt()`.
- `src/core/domains/service.ts` — `listDomains()`, `createDomain()`, `updateDomain()`, `toggleDomainStatus()`, `setDefaultDomain()`, `deleteDomain()`, `verifyAndPersistDomain()`.
- `src/core/dns/resolver.ts` — Node `node:dns/promises` + raw DNS fallback (`MX`, `A`/`AAAA`, `TXT` SPF/DKIM/DMARC), OpenDKIM `/etc/opendkim/keys/<domain>/mail.txt` reader, `buildExpectedDnsRecords()`, `buildCloudflareZone()`.
- `src/core/mailboxes/service.ts` — `accessibleMailboxes()`, `provisionMailbox()` (locked + confined + mailserver-synced + compensating rollback), `setMailboxActive()`, `purgeMailbox()`, `createSystemMailbox()`.
- `src/core/mailserver/pg-adapter.ts` — `mailserver.*` read/write contract + `verifyPostfixContract()` + `syncMailserverMailboxes()`.
- `src/core/settings/service.ts` — `getSiteSettings()`, `updateSiteSettings()`, safe multipart logo/favicon persistence & removal.
- `src/core/updates/service.ts` — GitHub latest release check, 9-point preflight runner, atomic `0640` hard-linked request writer, status/log reader (integrating cleanly with `src/core/setup/trusted-operations.ts`).
- `src/core/ingestion/parser.ts` + `sanitizer.ts` + `service.ts` + `repair.ts` — Maildir reader (`new`/`cur` -> `Message` + `Attachment`), strict HTML/CSS allowlist sanitizer, SHA-256 deduplication & repair, `ServiceHeartbeat("maildir_ingestion")` writer, `recalculateMailboxCounters()`.

---

### 5.5 Environment Variables, Filesystem & System Dependencies Needed
**New Env Vars to extend `src/config/env-schema.ts` & `.env.example`:**
- Mail identity & DNS: `MAIL_DOMAIN`, `MAIL_HOSTNAME`, `APP_HOSTNAME`, `SERVER_IP`, `DNS_LOOKUP_TIMEOUT_SECONDS`, `OPENDKIM_KEYS_ROOT`
- Storage & Locks: `MAIL_STORAGE_ROOT`, `ATTACHMENT_STORAGE_ROOT`, `MEDIA_ROOT`, `MAILBOX_PROVISION_LOCK_ROOT`, `INGESTION_LOCK_FILE`, `MAILBOX_DEFAULT_QUOTA_BYTES`
- Security & Networking: `TRUST_PROXY_HEADERS`, `PUBLIC_SITE_ORIGIN`, `USE_X_ACCEL_REDIRECT`, `LOGIN_FAILURE_LIMIT`, `LOGIN_FAILURE_WINDOW_SECONDS`, `LOGIN_LOCKOUT_SECONDS`, `INGESTION_STALE_AFTER_SECONDS`
- Updater: `UPDATE_RUNTIME_DIR` (`/run/vibmail`), `UPDATE_SERVICE_NAME`, `UPDATE_SCRIPT_PATH`, `UPDATE_GITHUB_REPO`

**Packages to Evaluate & Install Later (when building `/vcon` & ingestion):**
- **MIME parsing:** `mailparser` (+ `@types/mailparser`) or `postal-mime` (pure JS, zero native addons) for `.eml` parsing in Node ingestion/repair.
- **HTML & CSS sanitization:** `sanitize-html` (+ `@types/sanitize-html`) or `isomorphic-dompurify`/`dompurify`+`jsdom` paired with `css-tree` (`@types/css-tree`) for AST-level CSS property allowlisting (`url()`/`@import`/expression blocking, replacing `bleach` + `tinycss2`).
- **Cross-process locking:** `proper-lockfile` (+ `@types/proper-lockfile`) or PostgreSQL `pg_advisory_lock` + POSIX `fs.open(..., 'wx')` lockfiles.
- **Note:** `lucide-react`, `zod`, `@node-rs/argon2`, `pg`, `@prisma/client`, `@radix-ui/react-dialog`, `@radix-ui/react-label`, `sonner` are already installed.

---

### 5.6 Security Invariants & Acceptance Verification Matrix
Before any `/vcon` phase is marked complete, unit tests (`node:test`), UI tests (`vitest`), and PostgreSQL integration tests (`scripts/testing/postgres-integration.ts`) should verify:

| Category | Required Verification Checks |
|---|---|
| **Authorization** | Non-admin hitting `/vcon` or any `/vcon/*` or `/api/vcon/*` receives 404 (`notFound()`) without leaking existence; `devBypassActive` respects role switching cleanly. |
| **User Protections** | Cannot edit/delete `AdministratorProfile` accounts from `/vcon/users`; cannot self-delete; cannot delete last active admin; `UserAccessPolicy` auto-created; `AuditLog` redacts password/token keys. |
| **Login Lockout** | 5 consecutive failed logins from same IP/username trigger timed lockout; successful login clears failure window; stale attempts pruned. |
| **Domain & DNS** | Domain `name` immutable; `disabled` on create; cannot activate/default until verified; failed routing verification auto-disables domain + `mailserver.mail_domains`; cannot delete default/`MAIL_DOMAIN`/non-empty domain. |
| **Mailbox Provisioning & Purge** | Reserved local parts rejected in UI; path traversal/symlink rejected by `confinedPath`; DB failure triggers compensating Maildir + `mailserver.mailboxes` cleanup; purge requires exact typed email confirmation and removes Maildir + attachments + DB rows. |
| **HTML & Attachment Safety** | Ingested HTML strips `<script>`, `<svg>`, `on*`, `javascript:`, remote URLs, CSS `url()`/`@import`; iframe uses `sandbox=""` + strict CSP; attachment download sets `Content-Disposition: attachment` + `nosniff`. |
| **PostgreSQL Single-DB Policy** | `tests/schema/postgres-schema.test.mjs` and `verify-safe.mjs` pass; `postfix_lookup` role has `SELECT` only on `mailserver.postfix_virtual_*` views and zero access to `public.*`. |

---

### 5.7 Recommended Phased Implementation Plan
1. **Phase 1 — Foundation Services & Schema Extension:** Add `mailserver` PostgreSQL schema + `postfix_lookup` role migration; implement `src/core/audit/record.ts`, `UserAccessPolicy`/`LoginAttempt` helpers, and role-aware `AppShell` navigation + `SiteSettings` loader.
2. **Phase 2 — `/vcon` Overview & Users (`/vcon`, `/vcon/users/*`, `/vcon/audit`):** Build admin KPIs + health strip, full user CRUD with username/password generators & `"Create & copy"`, mailbox assignment picker, admin/self/last-admin guards, and AuditLog/LoginAttempt viewer.
3. **Phase 3 — `/vcon/domains/*` & `/vcon/mailboxes/*`:** Build DNS record preview/check/Cloudflare export + OpenDKIM inspection, mailserver DB sync + compensating provisioning, global mailbox table, enable/disable toggle, typed-email single/bulk purge, and system mailbox creator.
4. **Phase 4 — Maildir Ingestion, Sandboxed Reader & `/users` Workspace:** Implement Node Maildir ingestion worker + HTML/CSS sanitizer + `ServiceHeartbeat` writer, `/vcon/operations` diagnostics (Postfix contract check, reindex, body repair, counter sync), and the full `/users` inbox/reader/live-polling UI.
5. **Phase 5 — `/vcon/settings` & `/vcon/system-update`:** Build singleton branding settings + safe logo/favicon upload + public CORS JSON endpoint, and preflight/release-check/atomic-request system updater console.
6. **Phase 6 — Host Deployment & End-to-End Rehearsal:** Update `deployment/templates/postfix/*` to `pgsql:` lookup configs, adapt `backup.sh`/`restore.sh` to `pg_dump`/`pg_restore`, and run full Playwright/Vitest/PostgreSQL acceptance suite.
