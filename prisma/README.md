# Prisma Database Architecture

> **Authoritative Database Policy:** ReadBox uses exactly one PostgreSQL database for all application, mailbox, and mail-server management data. Prisma is the application ORM. Maildir and message/attachment files remain on the filesystem.

The database layer manages user accounts, administrative operator profiles, session registries, virtual mail domains and mailboxes, message metadata, public contact submissions, and immutable operational audit trails.

## Database Migrations

ReadBox manages database evolution through version-controlled SQL migrations located in `prisma/migrations`:

| Migration | Scope & Description |
| :--- | :--- |
| `20261017000000_initial_application_schema` | Core application models: Users, Domains, Mailboxes, Memberships, Messages, Attachments, AuditLog, and ServiceHeartbeat. |
| `20261017190000_local_auth_reset` | Password reset tokens and authentication lifecycle constraints. |
| `20261018120000_administrator_profiles` | One-to-one `AdministratorProfile` table linked to canonical users with unique indexes. |
| `20261115000000_mailserver_schema_and_roles` | Mail-server integration schema and lookup views. |
| `20261116000000_phase1_admin_reset_and_security` | PostgreSQL-backed durable `AdminResetToken` table and security audit targets. |
| `20261116010000_phase2_user_access_policy_inheritance` | Dynamic global policy inheritance for `UserAccessPolicy` columns. |

## CLI Commands & Operations

```bash
# Validate Prisma schema configuration
npm run db:validate

# Generate Prisma Client
npm run db:generate

# Apply pending migrations to the configured database
npm run db:migrate

# Check migration deployment status
npm run db:status

# Start local PostgreSQL container (development)
npm run db:up

# Stop local PostgreSQL container
npm run db:down
```

## Production Fail-Closed Policy

In production (`NODE_ENV=production`), ReadBox enforces a strict fail-closed database connection model:
- If `DATABASE_URL` is missing, malformed, or unreachable, the application throws explicit `DatabaseConfigurationError` or `DatabaseUnavailableError` exceptions.
- Mock database fallbacks are strictly prohibited in production, preventing unauthorized access or silent data loss.
- The `/health/ready` endpoint returns HTTP 503 (`status: "not_ready"`) if the database connection cannot be verified.
