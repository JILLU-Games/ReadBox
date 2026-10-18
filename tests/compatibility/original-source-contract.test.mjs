import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const workspaceRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const referenceRoot = resolve(workspaceRoot, "reference/MailStack/mailbox-app");
const deploymentRoot = resolve(
  workspaceRoot,
  "reference/MailStack/deployment/templates",
);

function source(path) {
  return readFileSync(resolve(referenceRoot, path), "utf8");
}

function deployment(path) {
  return readFileSync(resolve(deploymentRoot, path), "utf8");
}

test("original models define the application records and deletion relationships", () => {
  const accountModels = source("apps/accounts/models.py");
  const mailboxModels = source("apps/mailboxes/models.py");
  const messageModels = source("apps/messages/models.py");
  const auditModels = source("apps/audit/models.py");
  const coreModels = source("apps/core/models.py");

  for (const model of ["LoginAttempt", "UserAccessPolicy"])
    assert.match(accountModels, new RegExp(`class ${model}\\(`));
  for (const model of ["Domain", "Mailbox", "MailboxMembership"])
    assert.match(mailboxModels, new RegExp(`class ${model}\\(`));
  for (const model of ["Message", "Attachment"])
    assert.match(messageModels, new RegExp(`class ${model}\\(`));
  assert.match(auditModels, /class AuditLog\(/);
  for (const model of ["ServiceHeartbeat", "SiteSettings"])
    assert.match(coreModels, new RegExp(`class ${model}\\(`));

  assert.match(mailboxModels, /on_delete=models\.PROTECT/);
  assert.match(mailboxModels, /on_delete=models\.CASCADE/);
  assert.match(mailboxModels, /on_delete=models\.SET_NULL/);
  assert.match(messageModels, /on_delete=models\.CASCADE/);
  assert.match(messageModels, /fields=\["mailbox", "source_file_key"\]/);
});

test("original admin and object access depend on staff flags, memberships, and explicit delete grants", () => {
  const access = source("apps/core/access.py");
  const accountForms = source("apps/accounts/forms.py");

  assert.match(access, /is_staff.*is_superuser|is_superuser.*is_staff/s);
  assert.match(access, /memberships__user=user/);
  assert.match(access, /can_delete_messages/);
  assert.match(access, /can_delete_mailboxes/);
  assert.match(accountForms, /user\.is_staff = False/);
  assert.match(accountForms, /user\.is_superuser = False/);
});

test("original admin operations protect administrators and keep user deletion separate from mailbox deletion", () => {
  const accounts = source("apps/accounts/views.py");
  const accessTests = readFileSync(
    resolve(
      workspaceRoot,
      "reference/MailStack/mailbox-app/tests/integration/test_v1_2_access_live_delete.py",
    ),
    "utf8",
  );
  const operationTests = readFileSync(
    resolve(
      workspaceRoot,
      "reference/MailStack/mailbox-app/tests/integration/test_commands_health_postfix.py",
    ),
    "utf8",
  );

  assert.match(accounts, /if user\.pk == request\.user\.pk/);
  assert.match(accounts, /last active administrator cannot be deleted/);
  assert.match(accounts, /Administrator accounts are not deletable/);
  assert.match(
    accessTests,
    /test_admin_creates_edits_and_deletes_user_without_deleting_mailbox/,
  );
  assert.match(accessTests, /test_current_administrator_cannot_delete_itself/);
  assert.match(operationTests, /test_create_initial_admin_from_environment/);
  assert.match(
    operationTests,
    /test_create_system_mailbox_requires_confirmation/,
  );
});

test("mailbox creation requires verified domain, canonical Maildir, lock, and compensation", () => {
  const mailboxService = source("apps/mailboxes/services.py");
  const mailboxViews = source("apps/mailboxes/views.py");
  const mailboxForms = source("apps/mailboxes/forms.py");
  const provisioningTests = readFileSync(
    resolve(
      workspaceRoot,
      "reference/MailStack/mailbox-app/tests/unit/test_provisioning_ingestion.py",
    ),
    "utf8",
  );

  assert.match(
    mailboxService,
    /verification_status != Domain\.VerificationStatus\.VERIFIED/,
  );
  assert.match(mailboxService, /FileLock\(/);
  assert.match(mailboxService, /"new", "cur", "tmp"/);
  assert.match(mailboxService, /create_mailserver_mailbox/);
  assert.match(mailboxService, /delete_mailserver_mailbox\(email=email\)/);
  assert.match(mailboxService, /maildir_relative_path/);
  assert.match(mailboxForms, /assigned_users/);
  assert.match(mailboxViews, /else \[request\.user\]/);
  assert.match(
    provisioningTests,
    /test_provisioning_rolls_back_new_empty_tree_on_database_failure/,
  );
  assert.match(
    provisioningTests,
    /test_provisioning_does_not_remove_preexisting_tree_on_database_failure/,
  );
  assert.match(
    provisioningTests,
    /test_provisioning_filesystem_failure_creates_no_mailbox/,
  );
});

test("mailbox soft-delete and UI purge are separate source behaviors", () => {
  const mailboxService = source("apps/mailboxes/services.py");
  const mailboxViews = source("apps/mailboxes/views.py");
  const frontend = source("static/js/app.js");

  assert.match(mailboxService, /def soft_delete_mailbox\(/);
  assert.match(mailboxService, /def purge_mailbox\(/);
  assert.match(mailboxViews, /purge_mailbox\(mailbox/);
  assert.match(
    mailboxViews,
    /confirmation != mailbox\.email_address\.lower\(\)/,
  );
  assert.match(frontend, /Permanently delete the selected mailboxes/);
  assert.match(mailboxViews, /mailbox_bulk_delete/);
});

test("domain full-record status and activation checks have different requirements", () => {
  const dns = source("apps/mailboxes/dns.py");
  const views = source("apps/mailboxes/views.py");
  const tests = readFileSync(
    resolve(
      workspaceRoot,
      "reference/MailStack/mailbox-app/tests/unit/test_domains.py",
    ),
    "utf8",
  );

  assert.match(dns, /def verify_domain\(/);
  assert.match(dns, /mx_ok and target_ok/);
  assert.match(dns, /def verify_dns_records\(/);
  assert.match(dns, /all\(record\["status"\] == "verified"/);
  assert.match(views, /result = verify_domain\(domain\.name\)/);
  assert.match(
    views,
    /if not result\["verified"\]:[\s\S]*?set_mailserver_domain_active/,
  );
  assert.match(tests, /test_dns_record_verification_reports_each_record/);
  assert.match(tests, /test_failed_dns_check_disables_delivery/);
});

test("Maildir indexing is read-only, idempotent, scoped to new/cur, and preserves metadata", () => {
  const ingestion = source("apps/ingestion/service.py");
  const messageModel = source("apps/messages/models.py");
  const reliabilityTests = readFileSync(
    resolve(
      workspaceRoot,
      "reference/MailStack/mailbox-app/tests/reliability/test_reliability.py",
    ),
    "utf8",
  );

  assert.match(ingestion, /relative\.parts\[0\] not in \{"new", "cur"\}/);
  assert.match(ingestion, /source_file_key=key/);
  assert.match(ingestion, /source_sha256=digest/);
  assert.match(ingestion, /recipient_addresses=parsed\.recipient_addresses/);
  assert.match(ingestion, /cc_addresses=parsed\.cc_addresses/);
  assert.match(ingestion, /sanitized_html_body=parsed\.sanitized_html_body/);
  assert.match(ingestion, /entry\.is_file\(follow_symlinks=False\)/);
  assert.match(messageModel, /fields=\["mailbox", "source_file_key"\]/);
  assert.match(reliabilityTests, /test_worker_restart_reprocess_is_duplicate/);
  assert.match(reliabilityTests, /test_malformed_then_valid_message_continues/);
});

test("attachment delivery is object-scoped and path-confined", () => {
  const messageViews = source("apps/messages/views.py");
  const storage = source("apps/ingestion/storage.py");
  const accessTests = readFileSync(
    resolve(
      workspaceRoot,
      "reference/MailStack/mailbox-app/tests/integration/test_v1_2_access_live_delete.py",
    ),
    "utf8",
  );

  assert.match(
    messageViews,
    /accessible_messages\(request\.user\).*uuid=message_uuid, mailbox__uuid=mailbox_uuid/s,
  );
  assert.match(
    messageViews,
    /confined_path\(settings\.ATTACHMENT_STORAGE_ROOT/,
  );
  assert.match(messageViews, /X-Accel-Redirect/);
  assert.match(messageViews, /X-Content-Type-Options.*nosniff/);
  assert.match(storage, /os\.O_EXCL/);
  assert.match(storage, /os\.O_WRONLY \| os\.O_CREAT \| os\.O_EXCL/);
  assert.match(accessTests, /test_attachment_access_is_scoped/);
  const securityTests = readFileSync(
    resolve(
      workspaceRoot,
      "reference/MailStack/mailbox-app/tests/security/test_security_controls.py",
    ),
    "utf8",
  );
  assert.match(
    securityTests,
    /test_path_confinement_rejects_absolute_and_parent/,
  );
});

test("Postfix, Dovecot, and mail-server tables are a separate MariaDB delivery contract", () => {
  const adapter = source("apps/mailboxes/mailserver.py");
  const postfixMailboxMap = deployment(
    "postfix/mysql-virtual-mailboxes.cf.tpl",
  );
  const dovecot = deployment("dovecot/99-vibmail.conf.tpl");
  const databaseBootstrap = deployment("mariadb/bootstrap.sql.tpl");

  assert.match(adapter, /MAILSERVER_DB_NAME/);
  assert.match(adapter, /password_hash, maildir, quota_bytes, active/);
  assert.match(postfixMailboxMap, /dbname = \{\{MAIL_DB_NAME\}\}/);
  assert.match(postfixMailboxMap, /postfix_virtual_mailboxes/);
  assert.match(dovecot, /protocols = lmtp/);
  assert.match(dovecot, /mail_location = maildir:\/var\/vmail/);
  assert.match(
    databaseBootstrap,
    /CREATE OR REPLACE SQL SECURITY INVOKER VIEW/,
  );
  assert.match(
    databaseBootstrap,
    /GRANT SELECT \(`domain_id`, `local_part`, `email`, `maildir`, `active`\)/,
  );
  assert.doesNotMatch(
    databaseBootstrap,
    /GRANT[^;]*password_hash[^;]*TO '\{\{POSTFIX_DB_USER\}\}'/s,
  );
});

test("health and backup/restore are explicit operations, not inferred from app data", () => {
  const health = source("apps/core/views.py");
  const backup = readFileSync(
    resolve(workspaceRoot, "reference/MailStack/mailbox-app/scripts/backup.sh"),
    "utf8",
  );
  const restore = readFileSync(
    resolve(
      workspaceRoot,
      "reference/MailStack/mailbox-app/scripts/restore.sh",
    ),
    "utf8",
  );
  const operationsTests = readFileSync(
    resolve(workspaceRoot, "reference/MailStack/scripts/test_operations.py"),
    "utf8",
  );

  assert.match(health, /def live\(/);
  assert.match(health, /def ready\(/);
  assert.match(health, /MigrationExecutor/);
  assert.match(backup, /--databases "\$DB_NAME" "\$MAILSERVER_DB_NAME"/);
  assert.match(backup, /maildir\.tar\.gz/);
  assert.match(backup, /attachments\.tar\.gz/);
  assert.match(restore, /validate_tar_archive/);
  assert.match(restore, /postfix check/);
  assert.match(restore, /nginx -t/);
  assert.match(operationsTests, /BACKUP_RESTORE_CONTRACT=PASS/);
});
