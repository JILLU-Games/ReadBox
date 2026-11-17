# Database Migrations

> **Authoritative Database Policy:** ReadBox uses exactly one PostgreSQL database for all application and database-backed mail-server management data. Prisma is the application ORM. Maildir and message/attachment files remain on the filesystem.

All migrations are tracked sequentially and applied via Prisma Migrate:

1. **`20261017000000_initial_application_schema`**: Initial application DDL establishing core tables (`users`, `domains`, `mailboxes`, `mailbox_memberships`, `messages`, `attachments`, `audit_logs`, `service_heartbeats`, `site_settings`).
2. **`20261017190000_local_auth_reset`**: Schema updates for authentication credentials, password reset flows, and session validation.
3. **`20261018120000_administrator_profiles`**: Additive migration introducing the `administrator_profiles` table linked one-to-one with authorized administrative users.
4. **`20261115000000_mailserver_schema_and_roles`**: PostgreSQL-backed mailserver schema with virtual domain and mailbox mappings for Postfix and Dovecot.
5. **`20261116000000_phase1_admin_reset_and_security`**: Persistent `admin_reset_tokens` table with cascading foreign keys for operator password recovery across worker restarts.
6. **`20261116010000_phase2_user_access_policy_inheritance`**: Nullable access policy overrides enabling non-overridden user accounts to inherit global governance settings dynamically.
