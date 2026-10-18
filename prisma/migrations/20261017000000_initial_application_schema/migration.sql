-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "users" (
    "id" BIGSERIAL NOT NULL,
    "password_hash" VARCHAR(128) NOT NULL,
    "last_login" TIMESTAMPTZ(6),
    "is_superuser" BOOLEAN NOT NULL DEFAULT false,
    "username" VARCHAR(150) NOT NULL,
    "first_name" VARCHAR(150) NOT NULL DEFAULT '',
    "last_name" VARCHAR(150) NOT NULL DEFAULT '',
    "email" VARCHAR(254) NOT NULL DEFAULT '',
    "is_staff" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "date_joined" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "login_attempts" (
    "id" BIGSERIAL NOT NULL,
    "username_normalized" VARCHAR(150) NOT NULL,
    "ip_address" INET,
    "succeeded" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "login_attempts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_access_policies" (
    "id" BIGSERIAL NOT NULL,
    "user_id" BIGINT NOT NULL,
    "can_delete_messages" BOOLEAN NOT NULL DEFAULT false,
    "can_delete_mailboxes" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "user_access_policies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "domains" (
    "id" BIGSERIAL NOT NULL,
    "uuid" UUID NOT NULL,
    "name" VARCHAR(253) NOT NULL,
    "status" VARCHAR(16) NOT NULL DEFAULT 'active',
    "verification_status" VARCHAR(16) NOT NULL DEFAULT 'pending',
    "last_checked_at" TIMESTAMPTZ(6),
    "verification_details" JSONB NOT NULL DEFAULT '{}',
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "domains_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mailboxes" (
    "id" BIGSERIAL NOT NULL,
    "uuid" UUID NOT NULL,
    "domain_id" BIGINT NOT NULL,
    "local_part" VARCHAR(64) NOT NULL,
    "email_address" VARCHAR(320) NOT NULL,
    "status" VARCHAR(16) NOT NULL DEFAULT 'active',
    "maildir_relative_path" VARCHAR(255) NOT NULL,
    "total_messages" BIGINT NOT NULL DEFAULT 0,
    "unread_messages" BIGINT NOT NULL DEFAULT 0,
    "last_received_at" TIMESTAMPTZ(6),
    "deleted_at" TIMESTAMPTZ(6),
    "deleted_by_id" BIGINT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "mailboxes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mailbox_memberships" (
    "id" BIGSERIAL NOT NULL,
    "user_id" BIGINT NOT NULL,
    "mailbox_id" BIGINT NOT NULL,
    "assigned_by_id" BIGINT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "mailbox_memberships_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "messages" (
    "id" BIGSERIAL NOT NULL,
    "uuid" UUID NOT NULL,
    "mailbox_id" BIGINT NOT NULL,
    "source_file_key" VARCHAR(1024) NOT NULL,
    "source_sha256" VARCHAR(64) NOT NULL,
    "message_id_header" VARCHAR(998) NOT NULL DEFAULT '',
    "sender_name" VARCHAR(500) NOT NULL DEFAULT '',
    "sender_address" VARCHAR(320) NOT NULL DEFAULT '',
    "recipient_addresses" JSONB NOT NULL DEFAULT '[]',
    "cc_addresses" JSONB NOT NULL DEFAULT '[]',
    "subject" VARCHAR(998) NOT NULL DEFAULT '',
    "received_at" TIMESTAMPTZ(6),
    "parsed_at" TIMESTAMPTZ(6) NOT NULL,
    "text_body" TEXT NOT NULL DEFAULT '',
    "sanitized_html_body" TEXT NOT NULL DEFAULT '',
    "size_bytes" BIGINT NOT NULL DEFAULT 0,
    "is_read" BOOLEAN NOT NULL DEFAULT false,
    "has_attachments" BOOLEAN NOT NULL DEFAULT false,
    "parse_status" VARCHAR(16) NOT NULL DEFAULT 'ok',
    "parse_warning" TEXT NOT NULL DEFAULT '',
    "deleted_at" TIMESTAMPTZ(6),
    "deleted_by_id" BIGINT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attachments" (
    "id" BIGSERIAL NOT NULL,
    "uuid" UUID NOT NULL,
    "message_id" BIGINT NOT NULL,
    "original_filename" VARCHAR(1000) NOT NULL DEFAULT '',
    "safe_filename" VARCHAR(255) NOT NULL,
    "stored_filename" VARCHAR(255) NOT NULL,
    "declared_mime_type" VARCHAR(255) NOT NULL DEFAULT '',
    "detected_mime_type" VARCHAR(255) NOT NULL DEFAULT '',
    "size_bytes" BIGINT NOT NULL,
    "sha256" VARCHAR(64) NOT NULL,
    "storage_relative_path" VARCHAR(500) NOT NULL,
    "is_inline" BOOLEAN NOT NULL DEFAULT false,
    "content_id" VARCHAR(998) NOT NULL DEFAULT '',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "attachments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" BIGSERIAL NOT NULL,
    "uuid" UUID NOT NULL,
    "actor_id" BIGINT,
    "action" VARCHAR(80) NOT NULL,
    "target_type" VARCHAR(80) NOT NULL DEFAULT '',
    "target_identifier" VARCHAR(255) NOT NULL DEFAULT '',
    "ip_address" INET,
    "user_agent" VARCHAR(500) NOT NULL DEFAULT '',
    "details" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "service_heartbeats" (
    "id" BIGSERIAL NOT NULL,
    "service_name" VARCHAR(80) NOT NULL,
    "status" VARCHAR(32) NOT NULL DEFAULT 'unknown',
    "details" JSONB NOT NULL DEFAULT '{}',
    "last_seen_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "service_heartbeats_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "site_settings" (
    "id" BIGSERIAL NOT NULL,
    "site_name" VARCHAR(120) NOT NULL DEFAULT 'MailStack',
    "site_tagline" VARCHAR(200) NOT NULL DEFAULT 'Self-hosted mail server and shared team inbox.',
    "logo_path" VARCHAR(100) NOT NULL DEFAULT '',
    "favicon_path" VARCHAR(100) NOT NULL DEFAULT '',
    "support_email" VARCHAR(254) NOT NULL DEFAULT '',
    "contact_phone" VARCHAR(40) NOT NULL DEFAULT '',
    "office_address" VARCHAR(255) NOT NULL DEFAULT '',
    "footer_description" TEXT NOT NULL DEFAULT '',
    "copyright_text" VARCHAR(255) NOT NULL DEFAULT 'Authorized team use only.',
    "source_code_url" VARCHAR(200) NOT NULL DEFAULT 'https://github.com/vibtools/MailStack',
    "privacy_url" VARCHAR(500) NOT NULL DEFAULT '/privacy/',
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "site_settings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "users_username_idx" ON "users"("username");

-- CreateIndex
CREATE INDEX "login_attempts_username_normalized_idx" ON "login_attempts"("username_normalized");

-- CreateIndex
CREATE INDEX "login_attempts_ip_address_idx" ON "login_attempts"("ip_address");

-- CreateIndex
CREATE INDEX "login_attempts_created_at_idx" ON "login_attempts"("created_at");

-- CreateIndex
CREATE INDEX "login_attempts_username_normalized_ip_address_created_at_idx" ON "login_attempts"("username_normalized", "ip_address", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "user_access_policies_user_id_key" ON "user_access_policies"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "domains_uuid_key" ON "domains"("uuid");

-- CreateIndex
CREATE INDEX "domains_status_idx" ON "domains"("status");

-- CreateIndex
CREATE INDEX "domains_verification_status_idx" ON "domains"("verification_status");

-- CreateIndex
CREATE INDEX "domains_is_default_idx" ON "domains"("is_default");

-- CreateIndex
CREATE UNIQUE INDEX "mailboxes_uuid_key" ON "mailboxes"("uuid");

-- CreateIndex
CREATE INDEX "mailboxes_status_created_at_idx" ON "mailboxes"("status", "created_at");

-- CreateIndex
CREATE INDEX "mailboxes_deleted_at_status_idx" ON "mailboxes"("deleted_at", "status");
CREATE INDEX "mailboxes_domain_id_idx" ON "mailboxes"("domain_id");
CREATE INDEX "mailboxes_deleted_by_id_idx" ON "mailboxes"("deleted_by_id");
CREATE INDEX "mailboxes_created_at_idx" ON "mailboxes"("created_at");

-- CreateIndex
CREATE INDEX "mailbox_memberships_user_id_mailbox_id_idx" ON "mailbox_memberships"("user_id", "mailbox_id");

-- CreateIndex
CREATE INDEX "mailbox_memberships_mailbox_id_user_id_idx" ON "mailbox_memberships"("mailbox_id", "user_id");
CREATE INDEX "mailbox_memberships_assigned_by_id_idx" ON "mailbox_memberships"("assigned_by_id");

-- CreateIndex
CREATE UNIQUE INDEX "mailbox_memberships_user_id_mailbox_id_key" ON "mailbox_memberships"("user_id", "mailbox_id");

-- CreateIndex
CREATE UNIQUE INDEX "messages_uuid_key" ON "messages"("uuid");

-- CreateIndex
CREATE INDEX "messages_sender_address_idx" ON "messages"("sender_address");

-- CreateIndex
CREATE INDEX "messages_subject_idx" ON "messages"("subject");

-- CreateIndex
CREATE INDEX "messages_mailbox_id_received_at_idx" ON "messages"("mailbox_id", "received_at" DESC);

-- CreateIndex
CREATE INDEX "messages_mailbox_id_is_read_idx" ON "messages"("mailbox_id", "is_read");

-- CreateIndex
CREATE INDEX "messages_mailbox_id_has_attachments_idx" ON "messages"("mailbox_id", "has_attachments");

-- CreateIndex
CREATE INDEX "messages_mailbox_id_deleted_at_is_read_idx" ON "messages"("mailbox_id", "deleted_at", "is_read");

-- CreateIndex
CREATE INDEX "messages_deleted_at_id_idx" ON "messages"("deleted_at", "id");
CREATE INDEX "messages_deleted_by_id_idx" ON "messages"("deleted_by_id");
CREATE INDEX "messages_is_read_idx" ON "messages"("is_read");

-- CreateIndex
CREATE INDEX "messages_parse_status_idx" ON "messages"("parse_status");

-- CreateIndex
CREATE UNIQUE INDEX "messages_mailbox_id_source_file_key_key" ON "messages"("mailbox_id", "source_file_key");

-- CreateIndex
CREATE UNIQUE INDEX "attachments_uuid_key" ON "attachments"("uuid");

-- CreateIndex
CREATE UNIQUE INDEX "attachments_stored_filename_key" ON "attachments"("stored_filename");

-- CreateIndex
CREATE UNIQUE INDEX "attachments_storage_relative_path_key" ON "attachments"("storage_relative_path");
CREATE INDEX "attachments_message_id_idx" ON "attachments"("message_id");

-- CreateIndex
CREATE UNIQUE INDEX "audit_logs_uuid_key" ON "audit_logs"("uuid");

-- CreateIndex
CREATE INDEX "audit_logs_action_idx" ON "audit_logs"("action");

-- CreateIndex
CREATE INDEX "audit_logs_created_at_idx" ON "audit_logs"("created_at" DESC);
CREATE INDEX "audit_logs_actor_id_idx" ON "audit_logs"("actor_id");

-- CreateIndex
CREATE UNIQUE INDEX "service_heartbeats_service_name_key" ON "service_heartbeats"("service_name");

-- AddForeignKey
ALTER TABLE "user_access_policies" ADD CONSTRAINT "user_access_policies_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mailboxes" ADD CONSTRAINT "mailboxes_domain_id_fkey" FOREIGN KEY ("domain_id") REFERENCES "domains"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mailboxes" ADD CONSTRAINT "mailboxes_deleted_by_id_fkey" FOREIGN KEY ("deleted_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mailbox_memberships" ADD CONSTRAINT "mailbox_memberships_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mailbox_memberships" ADD CONSTRAINT "mailbox_memberships_mailbox_id_fkey" FOREIGN KEY ("mailbox_id") REFERENCES "mailboxes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mailbox_memberships" ADD CONSTRAINT "mailbox_memberships_assigned_by_id_fkey" FOREIGN KEY ("assigned_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_mailbox_id_fkey" FOREIGN KEY ("mailbox_id") REFERENCES "mailboxes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_deleted_by_id_fkey" FOREIGN KEY ("deleted_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_message_id_fkey" FOREIGN KEY ("message_id") REFERENCES "messages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Preserve Django form/model case-insensitive uniqueness in PostgreSQL.
CREATE UNIQUE INDEX "users_username_ci_key" ON "users" (lower("username"));
CREATE UNIQUE INDEX "domains_name_ci_key" ON "domains" (lower("name"));
CREATE UNIQUE INDEX "mailboxes_domain_local_part_ci_key" ON "mailboxes" ("domain_id", lower("local_part"));
CREATE UNIQUE INDEX "mailboxes_email_address_ci_key" ON "mailboxes" (lower("email_address"));

-- Preserve Django field choices and PositiveBigIntegerField ranges.
ALTER TABLE "domains" ADD CONSTRAINT "domains_status_check" CHECK ("status" IN ('active', 'disabled'));
ALTER TABLE "domains" ADD CONSTRAINT "domains_verification_status_check" CHECK ("verification_status" IN ('pending', 'verified', 'failed'));
ALTER TABLE "mailboxes" ADD CONSTRAINT "mailboxes_status_check" CHECK ("status" IN ('active', 'disabled', 'deleted'));
ALTER TABLE "mailboxes" ADD CONSTRAINT "mailboxes_counters_nonnegative_check" CHECK ("total_messages" >= 0 AND "unread_messages" >= 0);
ALTER TABLE "messages" ADD CONSTRAINT "messages_parse_status_check" CHECK ("parse_status" IN ('ok', 'warning', 'error', 'oversized'));
ALTER TABLE "messages" ADD CONSTRAINT "messages_size_nonnegative_check" CHECK ("size_bytes" >= 0);
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_size_nonnegative_check" CHECK ("size_bytes" >= 0);

-- Target-only replacement session store. Existing Django sessions are invalidated,
-- not imported because their signed payload format is framework-specific.
CREATE TABLE "app_sessions" (
    "id" BIGSERIAL NOT NULL,
    "token_hash" CHAR(64) NOT NULL,
    "user_id" BIGINT NOT NULL,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_seen_at" TIMESTAMPTZ(6),
    "ip_address" INET,
    "user_agent" VARCHAR(500) NOT NULL DEFAULT '',

    CONSTRAINT "app_sessions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "app_sessions_token_hash_key" ON "app_sessions"("token_hash");
CREATE INDEX "app_sessions_user_id_expires_at_idx" ON "app_sessions"("user_id", "expires_at");
CREATE INDEX "app_sessions_expires_at_idx" ON "app_sessions"("expires_at");
ALTER TABLE "app_sessions" ADD CONSTRAINT "app_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
