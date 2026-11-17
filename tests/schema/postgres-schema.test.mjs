import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const workspaceRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const prismaSchema = readFileSync(
  resolve(workspaceRoot, "prisma/schema.prisma"),
  "utf8",
);
const initialMigration = readFileSync(
  resolve(
    workspaceRoot,
    "prisma/migrations/20261017000000_initial_application_schema/migration.sql",
  ),
  "utf8",
);
const administratorMigration = readFileSync(
  resolve(
    workspaceRoot,
    "prisma/migrations/20261018120000_administrator_profiles/migration.sql",
  ),
  "utf8",
);
const mailserverMigration = readFileSync(
  resolve(
    workspaceRoot,
    "prisma/migrations/20261115000000_mailserver_schema_and_roles/migration.sql",
  ),
  "utf8",
);
const migrationLock = readFileSync(
  resolve(workspaceRoot, "prisma/migrations/migration_lock.toml"),
  "utf8",
);

test("Prisma models the verified app entities and excludes infrastructure databases", () => {
  for (const model of [
    "User",
    "AdminAccount",
    "AdminSession",
    "AdminResetToken",
    "AdministratorProfile",
    "LoginAttempt",
    "UserAccessPolicy",
    "AppSession",
    "Domain",
    "Mailbox",
    "MailboxMembership",
    "Message",
    "Attachment",
    "AuditLog",
    "ServiceHeartbeat",
    "SiteSettings",
  ]) {
    assert.match(prismaSchema, new RegExp(`model ${model} \\{`));
  }
  assert.match(prismaSchema, /provider = "postgresql"/);
  assert.doesNotMatch(
    prismaSchema,
    /model (MailAlias|MailServerDomain|PostfixVirtualMailbox|ContactSubmission)\s*\{/,
  );
  assert.doesNotMatch(
    initialMigration,
    /CREATE TABLE "(mail_domains|mail_aliases|postfix_virtual_mailboxes|contact_submissions|csrf_tokens)"/,
  );
});

test("schema defines stable identifiers, relationships, deletion actions, and source indexes", () => {
  assert.match(prismaSchema, /id\s+BigInt\s+@id @default\(autoincrement\(\)\)/);
  assert.match(
    prismaSchema,
    /uuid\s+String\s+@unique @default\(uuid\(\)\) @db\.Uuid/,
  );
  assert.match(prismaSchema, /@@unique\(\[mailboxId, sourceFileKey\]\)/);
  assert.match(prismaSchema, /@@unique\(\[userId, mailboxId\]\)/);
  assert.match(prismaSchema, /onDelete: Restrict/);
  assert.match(prismaSchema, /onDelete: SetNull/);
  assert.match(prismaSchema, /onDelete: Cascade/);
  assert.match(prismaSchema, /verificationDetails\s+Json/);
  assert.match(prismaSchema, /recipientAddresses\s+Json/);
  assert.match(prismaSchema, /textBody\s+String.*@db\.Text/);
  assert.match(prismaSchema, /deletedAt\s+DateTime\?/);
  assert.match(prismaSchema, /tokenHash String\s+@unique/);
  assert.match(initialMigration, /CREATE TABLE "app_sessions"/);
  assert.match(initialMigration, /django sessions are invalidated/i);
});

test("administrator profile is a unique linked identity with no automatic promotion", () => {
  assert.match(prismaSchema, /administratorProfile\s+AdministratorProfile\?/);
  assert.match(prismaSchema, /model AdministratorProfile\s*\{/);
  assert.match(prismaSchema, /userId\s+BigInt\s+@unique @map\("user_id"\)/);
  assert.match(
    prismaSchema,
    /isSuperuser Boolean\s+@default\(false\).*@map\("is_superuser"\)/,
  );
  assert.match(
    prismaSchema,
    /user User @relation\(fields: \[userId\], references: \[id\], onDelete: Cascade\)/,
  );
  assert.match(
    administratorMigration,
    /CREATE UNIQUE INDEX "administrator_profiles_user_id_key"/,
  );
  assert.match(
    administratorMigration,
    /"is_superuser" BOOLEAN NOT NULL DEFAULT false/,
  );
  assert.match(administratorMigration, /ON DELETE CASCADE ON UPDATE CASCADE/);
  assert.doesNotMatch(administratorMigration, /INSERT\s+INTO/i);
  assert.doesNotMatch(
    administratorMigration,
    /\b(?:DROP\s+(?:TABLE|SCHEMA)|TRUNCATE|DELETE\s+FROM|UPDATE\s+\w+\s+SET)\b/i,
  );

  const migrationDirectories = readdirSync(
    resolve(workspaceRoot, "prisma/migrations"),
    { withFileTypes: true },
  )
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
  assert.ok(
    migrationDirectories.includes("20261115000000_mailserver_schema_and_roles"),
  );
  assert.equal(
    migrationDirectories.at(-1),
    "20261117010000_postfix_login_identity",
  );
  const phase1Migration = readFileSync(
    resolve(
      workspaceRoot,
      "prisma/migrations/20261116000000_phase1_admin_reset_and_security/migration.sql",
    ),
    "utf8",
  );
  assert.match(phase1Migration, /CREATE TABLE IF NOT EXISTS "admin_reset_tokens"/);

  const phase2Migration = readFileSync(
    resolve(
      workspaceRoot,
      "prisma/migrations/20261116010000_phase2_user_access_policy_inheritance/migration.sql",
    ),
    "utf8",
  );
  assert.match(
    phase2Migration,
    /ALTER COLUMN "can_create_mailboxes" DROP NOT NULL/,
  );
  assert.match(
    phase2Migration,
    /ALTER COLUMN "auto_delete_enabled" DROP NOT NULL/,
  );
  assert.match(
    prismaSchema,
    /canCreateMailboxes\s+Boolean\?\s+@map\("can_create_mailboxes"\)/,
  );
  assert.match(
    prismaSchema,
    /autoDeleteEnabled\s+Boolean\?\s+@map\("auto_delete_enabled"\)/,
  );
});

test("migration preserves source foreign-key delete actions and supporting indexes", () => {
  const foreignKeys = [
    ["user_access_policies_user_id_fkey", "user_id", "users", "CASCADE"],
    ["mailboxes_domain_id_fkey", "domain_id", "domains", "RESTRICT"],
    ["mailboxes_deleted_by_id_fkey", "deleted_by_id", "users", "SET NULL"],
    ["mailbox_memberships_user_id_fkey", "user_id", "users", "CASCADE"],
    [
      "mailbox_memberships_mailbox_id_fkey",
      "mailbox_id",
      "mailboxes",
      "CASCADE",
    ],
    [
      "mailbox_memberships_assigned_by_id_fkey",
      "assigned_by_id",
      "users",
      "SET NULL",
    ],
    ["messages_mailbox_id_fkey", "mailbox_id", "mailboxes", "CASCADE"],
    ["messages_deleted_by_id_fkey", "deleted_by_id", "users", "SET NULL"],
    ["attachments_message_id_fkey", "message_id", "messages", "CASCADE"],
    ["audit_logs_actor_id_fkey", "actor_id", "users", "SET NULL"],
    ["app_sessions_user_id_fkey", "user_id", "users", "CASCADE"],
  ];

  for (const [constraint, column, table, action] of foreignKeys) {
    assert.ok(
      initialMigration.includes(
        `CONSTRAINT "${constraint}" FOREIGN KEY ("${column}") REFERENCES "${table}"("id") ON DELETE ${action} ON UPDATE CASCADE`,
      ),
      constraint,
    );
  }

  for (const index of [
    '"mailboxes_domain_id_idx" ON "mailboxes"("domain_id")',
    '"mailboxes_deleted_by_id_idx" ON "mailboxes"("deleted_by_id")',
    '"mailboxes_created_at_idx" ON "mailboxes"("created_at")',
    '"mailbox_memberships_assigned_by_id_idx" ON "mailbox_memberships"("assigned_by_id")',
    '"messages_deleted_by_id_idx" ON "messages"("deleted_by_id")',
    '"messages_is_read_idx" ON "messages"("is_read")',
    '"attachments_message_id_idx" ON "attachments"("message_id")',
    '"audit_logs_actor_id_idx" ON "audit_logs"("actor_id")',
  ]) {
    assert.ok(initialMigration.includes(`CREATE INDEX ${index}`), index);
  }
});

test("unapplied PostgreSQL SQL adds case-insensitive unique indexes and status/range checks", () => {
  for (const indexName of [
    "users_username_ci_key",
    "domains_name_ci_key",
    "mailboxes_domain_local_part_ci_key",
    "mailboxes_email_address_ci_key",
  ]) {
    assert.match(
      initialMigration,
      new RegExp(`CREATE UNIQUE INDEX "${indexName}"`),
    );
  }
  for (const constraintName of [
    "domains_status_check",
    "domains_verification_status_check",
    "mailboxes_status_check",
    "mailboxes_counters_nonnegative_check",
    "messages_parse_status_check",
    "messages_size_nonnegative_check",
    "attachments_size_nonnegative_check",
  ]) {
    assert.match(
      initialMigration,
      new RegExp(`ADD CONSTRAINT "${constraintName}" CHECK`),
    );
  }
});

test("current audit migration is explicitly generated but not applied", () => {
  assert.match(migrationLock, /^provider = "postgresql"\s*$/m);
  assert.match(initialMigration, /CREATE TABLE "users"/);
  assert.match(initialMigration, /CREATE TABLE "messages"/);
  assert.match(initialMigration, /CREATE TABLE "attachments"/);
  assert.match(initialMigration, /FOREIGN KEY/);
});

test("mailserver schema migration stays in the single PostgreSQL database with least-privilege postfix_lookup grants", () => {
  assert.match(mailserverMigration, /CREATE SCHEMA IF NOT EXISTS "mailserver"/);
  assert.match(
    mailserverMigration,
    /CREATE TABLE IF NOT EXISTS "mailserver"\."mail_domains"/,
  );
  assert.match(
    mailserverMigration,
    /CREATE TABLE IF NOT EXISTS "mailserver"\."mailboxes"/,
  );
  assert.match(
    mailserverMigration,
    /CREATE TABLE IF NOT EXISTS "mailserver"\."mail_aliases"/,
  );
  assert.match(
    mailserverMigration,
    /CREATE OR REPLACE VIEW "mailserver"\."postfix_virtual_domains"[\s\S]*security_invoker = true/,
  );
  assert.match(
    mailserverMigration,
    /CREATE OR REPLACE VIEW "mailserver"\."postfix_virtual_mailboxes"[\s\S]*security_invoker = true/,
  );
  assert.match(
    mailserverMigration,
    /CREATE OR REPLACE VIEW "mailserver"\."postfix_virtual_aliases"[\s\S]*security_invoker = true/,
  );
  assert.match(
    mailserverMigration,
    /GRANT SELECT \("id", "domain_id", "local_part", "email", "maildir", "quota_bytes", "active"\)\s+ON "mailserver"\."mailboxes" TO "postfix_lookup"/,
  );
  assert.doesNotMatch(
    mailserverMigration,
    /GRANT[^;]*password_hash[^;]*TO "postfix_lookup"/i,
  );
});
