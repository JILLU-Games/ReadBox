-- SEO-01: additive, optional per-page metadata in the existing PostgreSQL database.
-- Does not modify site_settings or any existing application/mailserver table.
CREATE TABLE "site_seo_settings" (
    "page_key" VARCHAR(32) NOT NULL,
    "title" VARCHAR(120) NOT NULL DEFAULT '',
    "description" VARCHAR(320) NOT NULL DEFAULT '',
    "image_path" VARCHAR(255) NOT NULL DEFAULT '',
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "site_seo_settings_pkey" PRIMARY KEY ("page_key")
);
