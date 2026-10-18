import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
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
const migrationLock = readFileSync(
  resolve(workspaceRoot, "prisma/migrations/migration_lock.toml"),
  "utf8",
);

test("Prisma models the verified app entities and excludes infrastructure databases", () => {
  for (const model of [
    "User",
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
