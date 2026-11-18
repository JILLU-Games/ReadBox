import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
test("QIS01 web gets only a hashed owner code and an expiry; database stays private", () => {
  const compose=readFileSync("docker-compose.yml","utf8");
  const web=compose.slice(compose.indexOf("  web:"),compose.indexOf("  worker:"));
  assert.match(web,/READBOX_SETUP_TOKEN_SHA256: \$\{READBOX_SETUP_TOKEN_SHA256:-\}/);
  assert.match(web,/READBOX_SETUP_TOKEN_EXPIRES_AT: \$\{READBOX_SETUP_TOKEN_EXPIRES_AT:-\}/);
  assert.doesNotMatch(web,/READBOX_SETUP_TOKEN_PLAINTEXT|READBOX_INITIAL_ADMIN_PASSWORD/);
  assert.doesNotMatch(compose.slice(compose.indexOf("  postgres:"),compose.indexOf("  web:")),/\s+ports:/);
  assert.match(compose,/SMTP_BIND_ADDRESS:-127\.0\.0\.1/);
});
test("QIS01 browser calls the R04 transactional admin function and existing forced password reset", () => {
  const core=readFileSync("src/core/setup/first-admin-activation.ts","utf8");
  const action=readFileSync("src/app/initial-setup/actions.ts","utf8");
  const form=readFileSync("src/components/setup/first-admin-form.tsx","utf8");
  assert.match(core,/bootstrapInitialAdminAccount/);
  assert.match(core,/timingSafeEqual/);
  assert.match(core,/observed\.protocol !== "https:"/);
  assert.match(action,/createFirstAdminAction/);
  assert.match(form,/completePasswordResetAction/);
  assert.match(form,/name="token" value=\{token\}/);
  assert.doesNotMatch(action,/console\.log|stdout\.write|redirect\(.+resetToken/);
});
test("QIS01 preserves existing operator CLI, Prisma migration path and release NO-GO",()=>{
  assert.match(readFileSync("scripts/auth/operator.ts","utf8"),/--bootstrap-production/);
  assert.match(readFileSync("entrypoint.sh","utf8"),/migrate deploy/);
  assert.match(readFileSync("scripts/testing/r06-release-gate.mjs","utf8"),/production_release_authorized: false/);
});
