CREATE TABLE IF NOT EXISTS "admin_reset_tokens" (
    "id" BIGSERIAL NOT NULL,
    "admin_id" BIGINT NOT NULL,
    "token_hash" CHAR(64) NOT NULL,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "admin_reset_tokens_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "admin_reset_tokens_admin_id_fkey"
      FOREIGN KEY ("admin_id") REFERENCES "admin_accounts"("id")
      ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "admin_reset_tokens_admin_id_key"
ON "admin_reset_tokens"("admin_id");

CREATE UNIQUE INDEX IF NOT EXISTS "admin_reset_tokens_token_hash_key"
ON "admin_reset_tokens"("token_hash");

CREATE INDEX IF NOT EXISTS "admin_reset_tokens_expires_at_idx"
ON "admin_reset_tokens"("expires_at");
