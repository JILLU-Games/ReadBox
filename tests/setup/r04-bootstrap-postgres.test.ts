import {
  bootstrapInitialAdminAccount,
  getProductionAdminBootstrapError,
} from "@/core/auth/operator-bootstrap";
import { getPrismaClient } from "@/core/database/client";
import { runSetupVerificationInspection } from "@/core/setup/trusted-operations";
import { hashOpaqueToken } from "@/core/auth/opaque-token";
import assert from "node:assert/strict";
import { test } from "node:test";

test("R04 production bootstrap guard rejects noninteractive, untrusted DB, missing secret and no container", () => {
  const valid = {
    nodeEnv: "production",
    dockerRuntime: true,
    interactive: true,
    authEnabled: true,
    authSecret: "a".repeat(48),
    databaseUrl: "postgresql://readbox:fixture-secret@postgres:5432/readbox?schema=public",
  };
  assert.equal(getProductionAdminBootstrapError(valid), null);
  assert.ok(getProductionAdminBootstrapError({ ...valid, interactive: false }));
  assert.ok(getProductionAdminBootstrapError({ ...valid, dockerRuntime: false }));
  assert.ok(getProductionAdminBootstrapError({ ...valid, nodeEnv: "development" }));
  assert.ok(getProductionAdminBootstrapError({ ...valid, authEnabled: false }));
  assert.ok(getProductionAdminBootstrapError({ ...valid, authSecret: "short" }));
  assert.ok(getProductionAdminBootstrapError({
    ...valid,
    databaseUrl: "postgresql://readbox:fixture-secret@public.example:5432/readbox",
  }));
  assert.ok(getProductionAdminBootstrapError({
    ...valid,
    databaseUrl: "postgresql://readbox:fixture-secret@127.0.0.1:5432/readbox",
  }));
});

test("R04 clean disposable PostgreSQL creates one admin_login identity, verified by setup inspector", { timeout: 30000 }, async () => {
  const prisma = getPrismaClient();
  // The CI service container is disposable and must start empty. Never wipe
  // an existing database: fail if it unexpectedly contains users/admins.
  const [beforeAdmin, beforeUsers, beforeProfiles] = await Promise.all([
    prisma.adminAccount.count(),
    prisma.user.count(),
    prisma.administratorProfile.count(),
  ]);
  assert.equal(beforeAdmin, 0, "CI PostgreSQL must contain no existing admins");
  assert.equal(beforeUsers, 0, "CI PostgreSQL must contain no existing users");
  assert.equal(beforeProfiles, 0, "CI PostgreSQL must contain no existing admin profiles");

  const request = {
    username: "R04.Admin",
    firstName: "R04",
    lastName: "Operator",
    email: "operator@r04.example.test",
  };
  const result = await bootstrapInitialAdminAccount(prisma, request);
  assert.ok(result);
  const admin = await prisma.adminAccount.findUnique({
    where: { id: BigInt(result!.adminId) },
    select: {
      username: true,
      isActive: true,
      isSuperuser: true,
      passwordResetRequired: true,
    },
  });
  assert.deepEqual(admin, {
    username: "r04.admin",
    isActive: true,
    isSuperuser: true,
    passwordResetRequired: true,
  });
  assert.equal(await prisma.adminAccount.count(), 1);
  assert.equal(await prisma.user.count(), 0);
  assert.equal(await prisma.administratorProfile.count(), 0);
  const stored = await prisma.adminResetToken.findUnique({
    where: { adminId: BigInt(result!.adminId) },
  });
  assert.equal(stored?.tokenHash, hashOpaqueToken(result!.resetToken));
  assert.equal(stored?.tokenHash.includes(result!.resetToken), false);
  assert.ok(stored && stored.expiresAt > new Date());
  // No duplicate allowed. Also verifies case-insensitive account input.
  assert.equal(await bootstrapInitialAdminAccount(prisma, {
    ...request,
    username: "r04.admin",
  }), null);
  assert.equal(await prisma.adminAccount.count(), 1);
  assert.equal(await prisma.adminResetToken.count(), 1);
  const inspection = await runSetupVerificationInspection({ prisma });
  assert.equal(inspection.overallReady, true, JSON.stringify(inspection));
  assert.equal(inspection.steps.find((step) => step.step === "administrator-created")?.passed, true);
  assert.equal(inspection.steps.find((step) => step.step === "completion-verified")?.passed, true);
});
