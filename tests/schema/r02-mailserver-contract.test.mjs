import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

const root = process.cwd();
const read = (path) => readFileSync(resolve(root, path), "utf8");
const migration = read("prisma/migrations/20261117010000_postfix_login_identity/migration.sql");
const production = read("docker-compose.yml");

test("R02 creates additive login role without stored secrets or a second DB", () => {
  assert.match(migration, /CREATE ROLE "readbox_postfix" LOGIN INHERIT/);
  assert.match(migration, /PASSWORD NULL/);
  assert.match(migration, /GRANT "postfix_lookup" TO "readbox_postfix"/);
  assert.match(migration, /REVOKE ALL ON SCHEMA "public"/);
  assert.doesNotMatch(migration, /PASSWORD\s+'[^']+'/i);
  const migrations = readdirSync(resolve(root, "prisma/migrations"), { withFileTypes: true })
    .filter((entry) => entry.isDirectory()).map((entry) => entry.name).sort();
  assert.equal(migrations.at(-1), "20261117010000_postfix_login_identity");
  assert.ok(migrations.includes("20261115000000_mailserver_schema_and_roles"));
});

test("R02 Postfix maps use configurable private PG host and dedicated LOGIN role", () => {
  for (const name of ["domains", "mailboxes", "aliases"]) {
    const data = read("deployment/templates/postfix/pgsql-virtual-" + name + ".cf.tpl");
    assert.match(data, /^user = readbox_postfix$/m);
    assert.match(data, /^hosts = \{\{POSTFIX_DB_HOST\}\}:\{\{POSTFIX_DB_PORT\}\}$/m);
    assert.doesNotMatch(data, /^hosts = 127\.0\.0\.1$/m);
    assert.match(data, /mailserver\.postfix_virtual_/);
    assert.doesNotMatch(data, /password_hash/);
  }
});

test("R02 enforces shared delivery UID/GID without public PostgreSQL exposure", () => {
  assert.match(production, /web:\n\s+user: "1001:1001"/);
  assert.match(production, /worker:\n\s+user: "1001:1001"/);
  assert.equal((production.match(/MAILDIR_UID: "1001"/g) ?? []).length, 2);
  assert.equal((production.match(/MAILDIR_GID: "1001"/g) ?? []).length, 2);
  assert.match(production, /profiles: \["postfix-setup"\]/);
  assert.match(production, /POSTFIX_LOOKUP_PASSWORD/);
  assert.match(production, /ALTER ROLE "readbox_postfix" PASSWORD/);
  assert.doesNotMatch(production.split("  postgres:\n")[1].split("\n  web:\n")[0], /\n\s+ports:\n/);
  const dovecot = read("deployment/templates/dovecot/99-vibmail.conf.tpl");
  assert.match(dovecot, /mail_uid = \{\{VMAIL_UID\}\}/);
  assert.match(dovecot, /args = uid=\{\{VMAIL_UID\}\} gid=\{\{VMAIL_GID\}\}/);
  assert.doesNotMatch(dovecot, /uid=vmail/);
});
