import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";

const get = (file: string) => readFileSync(file, "utf8");
test("QIS01 installer only creates a new private .env and retains existing data", () => {
  const sh = get("scripts/install/readbox-install.sh");
  assert.match(sh, /openssl rand -hex 32/);
  assert.match(sh, /READBOX_SETUP_TOKEN_SHA256/);
  assert.match(sh, /READBOX_SETUP_TOKEN_EXPIRES_AT/);
  assert.match(sh, /chmod 0600/);
  assert.match(sh, /ln "\$tmp" "\$ENV_FILE"/);
  assert.match(sh, /QIS01_EXISTING_SECRETS_PRESERVED/);
  assert.doesNotMatch(sh, /docker compose.*down -v|docker volume rm|docker volume prune|git reset --hard/);
  assert.match(sh, /--profile postfix-setup/);
  assert.doesNotMatch(sh, /--profile mailserver/);
});
test("QIS01 update requires encrypted backup and rejects unsafe source mutation", () => {
  const sh = get("scripts/install/readbox-update.sh");
  assert.match(sh, /age1/);
  assert.match(sh, /compose_recovery\.py backup/);
  assert.match(sh, /git merge --ff-only/);
  assert.match(sh, /READBOX_BACKUP_RECIPIENT/);
  assert.match(sh, /Do NOT run git reset/);
  assert.doesNotMatch(sh, /docker compose.*down -v|docker volume rm|git reset --hard/);
});
test("QIS01 no extra Postfix ports or application authentication bypass", () => {
  const c = get("docker-compose.yml");
  const env = get(".env.example");
  assert.match(c, /READBOX_SETUP_TOKEN_SHA256:/);
  assert.match(c, /READBOX_SETUP_TOKEN_EXPIRES_AT:/);
  assert.match(env, /READBOX_SETUP_TOKEN_SHA256=/);
  assert.match(env, /READBOX_BACKUP_RECIPIENT=/);
  assert.match(c, /SMTP_BIND_ADDRESS:-127\.0\.0\.1/);
  const action = get("src/app/initial-setup/actions.ts");
  assert.match(action, /activateInitialAdmin/);
  assert.doesNotMatch(action, /DEV_AUTH_MODE|role:\s*["']admin/);
});
