-- Phase 2: Make UserAccessPolicy global-inheritable override fields nullable (FA-006)
-- NULL means inherit global UserControlSettings; non-NULL is an explicit per-user override.

ALTER TABLE "user_access_policies"
  ALTER COLUMN "can_create_mailboxes" DROP NOT NULL,
  ALTER COLUMN "can_create_mailboxes" DROP DEFAULT,
  ALTER COLUMN "max_mailboxes" DROP NOT NULL,
  ALTER COLUMN "max_mailboxes" DROP DEFAULT,
  ALTER COLUMN "auto_delete_enabled" DROP NOT NULL,
  ALTER COLUMN "auto_delete_enabled" DROP DEFAULT,
  ALTER COLUMN "auto_delete_days" DROP NOT NULL,
  ALTER COLUMN "auto_delete_days" DROP DEFAULT;

-- Reset legacy untouched default policy rows to NULL so existing non-overridden
-- users automatically inherit global UserControlSettings updates.
UPDATE "user_access_policies"
SET
  "can_create_mailboxes" = NULL,
  "max_mailboxes" = NULL,
  "auto_delete_enabled" = NULL,
  "auto_delete_days" = NULL
WHERE
  "can_create_mailboxes" = true
  AND "max_mailboxes" = 3
  AND "auto_delete_enabled" = false
  AND "auto_delete_days" = 0
  AND "allowed_domain_uuids"::text = '[]';
