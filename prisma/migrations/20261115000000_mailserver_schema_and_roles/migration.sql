CREATE SCHEMA IF NOT EXISTS "mailserver";

CREATE TABLE IF NOT EXISTS "mailserver"."mail_domains" (
    "id" BIGSERIAL NOT NULL,
    "name" VARCHAR(253) NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "mail_domains_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "mail_domains_name_lowercase_check" CHECK ("name" = lower("name"))
);

CREATE UNIQUE INDEX IF NOT EXISTS "mail_domains_name_ci_key"
ON "mailserver"."mail_domains"(lower("name"));

CREATE INDEX IF NOT EXISTS "mail_domains_active_idx"
ON "mailserver"."mail_domains"("active");

CREATE TABLE IF NOT EXISTS "mailserver"."mailboxes" (
    "id" BIGSERIAL NOT NULL,
    "domain_id" BIGINT NOT NULL,
    "local_part" VARCHAR(64) NOT NULL,
    "email" VARCHAR(320) NOT NULL,
    "password_hash" VARCHAR(255) NOT NULL,
    "maildir" VARCHAR(255) NOT NULL,
    "quota_bytes" BIGINT NOT NULL DEFAULT 2147483648,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "mailboxes_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "mailboxes_quota_nonnegative_check" CHECK ("quota_bytes" >= 0),
    CONSTRAINT "mailboxes_domain_id_fkey"
      FOREIGN KEY ("domain_id") REFERENCES "mailserver"."mail_domains"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "mailserver_mailboxes_email_ci_key"
ON "mailserver"."mailboxes"(lower("email"));

CREATE UNIQUE INDEX IF NOT EXISTS "mailserver_mailboxes_domain_local_ci_key"
ON "mailserver"."mailboxes"("domain_id", lower("local_part"));

CREATE INDEX IF NOT EXISTS "mailserver_mailboxes_active_idx"
ON "mailserver"."mailboxes"("active");

CREATE INDEX IF NOT EXISTS "mailserver_mailboxes_domain_id_idx"
ON "mailserver"."mailboxes"("domain_id");

CREATE TABLE IF NOT EXISTS "mailserver"."mail_aliases" (
    "id" BIGSERIAL NOT NULL,
    "domain_id" BIGINT NOT NULL,
    "source" VARCHAR(320) NOT NULL,
    "destination" VARCHAR(320) NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "mail_aliases_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "mail_aliases_domain_id_fkey"
      FOREIGN KEY ("domain_id") REFERENCES "mailserver"."mail_domains"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "mail_aliases_source_destination_ci_key"
ON "mailserver"."mail_aliases"(lower("source"), lower("destination"));

CREATE INDEX IF NOT EXISTS "mail_aliases_source_active_idx"
ON "mailserver"."mail_aliases"(lower("source"), "active");

CREATE INDEX IF NOT EXISTS "mail_aliases_domain_id_idx"
ON "mailserver"."mail_aliases"("domain_id");

CREATE OR REPLACE VIEW "mailserver"."postfix_virtual_domains"
WITH (security_invoker = true) AS
SELECT lower("name") AS "name"
FROM "mailserver"."mail_domains"
WHERE "active" = true;

CREATE OR REPLACE VIEW "mailserver"."postfix_virtual_mailboxes"
WITH (security_invoker = true) AS
SELECT lower(m."email") AS "email",
       m."maildir" AS "maildir"
FROM "mailserver"."mailboxes" AS m
INNER JOIN "mailserver"."mail_domains" AS d ON d."id" = m."domain_id"
WHERE m."active" = true
  AND d."active" = true
  AND lower(m."email") = lower(m."local_part") || '@' || lower(d."name")
  AND m."maildir" = lower(d."name") || '/' || lower(m."local_part") || '/Maildir/'
  AND lower(m."local_part") ~ '^[a-z0-9](?:[a-z0-9._-]{0,62}[a-z0-9])?$'
  AND position('..' IN m."local_part") = 0;

CREATE OR REPLACE VIEW "mailserver"."postfix_virtual_aliases"
WITH (security_invoker = true) AS
SELECT lower(a."source") AS "source",
       a."destination" AS "destination"
FROM "mailserver"."mail_aliases" AS a
INNER JOIN "mailserver"."mail_domains" AS d ON d."id" = a."domain_id"
WHERE a."active" = true
  AND d."active" = true;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'postfix_lookup') THEN
    BEGIN
      CREATE ROLE "postfix_lookup" NOLOGIN;
    EXCEPTION WHEN insufficient_privilege THEN
      NULL;
    END;
  END IF;

  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'postfix_lookup') THEN
    REVOKE ALL ON SCHEMA "mailserver" FROM PUBLIC;
    REVOKE ALL ON ALL TABLES IN SCHEMA "mailserver" FROM PUBLIC;

    GRANT USAGE ON SCHEMA "mailserver" TO "postfix_lookup";
    GRANT SELECT ("id", "name", "active")
      ON "mailserver"."mail_domains" TO "postfix_lookup";
    GRANT SELECT ("id", "domain_id", "local_part", "email", "maildir", "quota_bytes", "active")
      ON "mailserver"."mailboxes" TO "postfix_lookup";
    GRANT SELECT ("id", "domain_id", "source", "destination", "active")
      ON "mailserver"."mail_aliases" TO "postfix_lookup";
    GRANT SELECT ON "mailserver"."postfix_virtual_domains" TO "postfix_lookup";
    GRANT SELECT ON "mailserver"."postfix_virtual_mailboxes" TO "postfix_lookup";
    GRANT SELECT ON "mailserver"."postfix_virtual_aliases" TO "postfix_lookup";
  END IF;
END
$$;
