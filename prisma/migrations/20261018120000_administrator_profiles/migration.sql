CREATE TABLE "administrator_profiles" (
    "id" BIGSERIAL NOT NULL,
    "user_id" BIGINT NOT NULL,
    "is_superuser" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "administrator_profiles_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "administrator_profiles_user_id_key"
ON "administrator_profiles"("user_id");

ALTER TABLE "administrator_profiles"
ADD CONSTRAINT "administrator_profiles_user_id_fkey"
FOREIGN KEY ("user_id") REFERENCES "users"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
