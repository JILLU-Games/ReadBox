import assert from "node:assert/strict";
import { test } from "node:test";
import { createHash, randomBytes } from "node:crypto";
import { getPrismaClient } from "@/core/database/client";
import { activateInitialAdmin, isInitialAdminActivationAllowed } from "@/core/setup/first-admin-activation";
import { completePasswordResetDetailed } from "@/core/auth/password-reset";

const code = randomBytes(32).toString("base64url");
const now = Date.now();
const context = {
  nodeEnv: "production",
  dockerRuntime: true,
  authEnabled: true,
  authSecret: "x".repeat(96),
  databaseUrl: "postgresql://readbox:synthetic@postgres:5432/readbox?schema=public",
  expectedOrigin: "https://mail.example.test",
  requestOrigin: "https://mail.example.test",
  requestHost: "mail.example.test",
  activationHash: createHash("sha256").update(code).digest("hex"),
  expiresAt: String(Math.ceil(now / 1000) + 300),
  now,
};
const account = {
  username: "QIS.Operator",
  email: "operator@qis.example.test",
  firstName: "QIS",
  lastName: "Operator",
  activationToken: code,
};

test("QIS01 owner-token preflight fails closed for all missing or unsafe conditions", () => {
  assert.equal(isInitialAdminActivationAllowed(code, context), true);
  for (const bad of [
    { nodeEnv: "development" }, { dockerRuntime: false },
    { authEnabled: false }, { authSecret: "weak" },
    { databaseUrl: "postgres://readbox:x@public.example:5432/readbox" },
    { requestOrigin: "http://mail.example.test" },
    { requestOrigin: "https://evil.example.test" },
    { requestHost: "evil.example.test" },
    { expectedOrigin: "https://other.example.test" },
    { activationHash: undefined },
    { activationHash: "0".repeat(64) },
    { expiresAt: String(Math.floor(now / 1000) - 1) },
    { expiresAt: String(Math.floor(now / 1000) + 86400 * 10) },
  ]) assert.equal(isInitialAdminActivationAllowed(code, { ...context, ...bad }), false);
  assert.equal(isInitialAdminActivationAllowed("x".repeat(43), context), false);
});

test("QIS01 single clean disposable PostgreSQL: concurrent initial-admin requests create at most one privileged AdminAccount and forced reset works once", { timeout: 60000 }, async () => {
  const db = getPrismaClient();
  // CI uses a new ephemeral tmpfs PostgreSQL. Never delete production data.
  assert.equal(await db.adminAccount.count(), 0, "CI target must be empty");
  assert.equal(await db.administratorProfile.count(), 0);
  const invalid = await activateInitialAdmin(db, {
    ...account, activationToken: "x".repeat(43),
  }, context);
  assert.deepEqual(invalid, { ok: false, reason: "invalid" });
  assert.equal(await db.adminAccount.count(), 0);

  const concurrent = await Promise.all([
    activateInitialAdmin(db, account, context),
    activateInitialAdmin(db, { ...account, username: "QIS.Other" }, context),
  ]);
  assert.equal(concurrent.filter((r) => r.ok).length, 1);
  assert.equal(await db.adminAccount.count(), 1);
  assert.equal(await db.user.count(), 0);
  assert.equal(await db.administratorProfile.count(), 0);

  const success = concurrent.find((r) => r.ok);
  assert.ok(success?.ok);
  const admin = await db.adminAccount.findFirst({ select: {
    isSuperuser: true, isActive: true, passwordResetRequired: true,
  } });
  assert.deepEqual(admin, {
    isSuperuser: true, isActive: true, passwordResetRequired: true,
  });
  assert.equal(await db.adminResetToken.count(), 1);
  const password = "QIS-01-Strong-Synthetic-Password-789!";
  const activated = await completePasswordResetDetailed(db, success.resetToken, password, password);
  assert.equal(activated.ok, true);
  const activatedAgain = await completePasswordResetDetailed(db, success.resetToken, password, password);
  assert.equal(activatedAgain.ok, false);
  assert.equal((await db.adminAccount.findFirst({ select: { passwordResetRequired: true } }))?.passwordResetRequired, false);
  assert.deepEqual(await activateInitialAdmin(db, account, context), { ok: false, reason: "unavailable" });
  assert.equal(await db.adminAccount.count(), 1);
});
