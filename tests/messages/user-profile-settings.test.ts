import {
  getUserProfile,
  getUserSecuritySnapshot,
  revokeOtherUserSessions,
  revokeUserSessionById,
  updateUserPassword,
  updateUserProfile,
} from "@/core/accounts/user-profile";
import {
  formatUserAgentSummary,
  validateUserPasswordInput,
  validateUserProfileInput,
} from "@/core/accounts/user-profile-schema";
import {
  authorizeDevDemoCredentials,
  clearDevDemoSessions,
  getDevDemoProfile,
  getDevDemoSecuritySnapshot,
  getDevDemoUserById,
  registerDevDemoSession,
  revokeDevDemoOtherUserSessions,
  revokeDevDemoUserSessionById,
  updateDevDemoPassword,
  updateDevDemoProfile,
} from "@/core/auth/dev-demo-auth";
import { createOpaqueToken, hashOpaqueToken } from "@/core/auth/opaque-token";
import type { PrismaClient } from "@prisma/client";
import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";

describe("User personal profile validation, demo persistence, and DB service", () => {
  afterEach(() => {
    clearDevDemoSessions();
  });

  it("validates personal profile fields and rejects malformed email or phone", () => {
    const valid = validateUserProfileInput({
      firstName: "  Tariq  ",
      lastName: " Hasan ",
      email: "tariq@readbox.local",
      phone: "+880 1711-000111",
    });
    assert.equal(valid.ok, true);
    if (valid.ok) {
      assert.equal(valid.data.firstName, "Tariq");
      assert.equal(valid.data.lastName, "Hasan");
      assert.equal(valid.data.email, "tariq@readbox.local");
      assert.equal(valid.data.phone, "+880 1711-000111");
    }

    const badEmail = validateUserProfileInput({
      firstName: "Tariq",
      lastName: "Hasan",
      email: "not-an-email",
      phone: "",
    });
    assert.equal(badEmail.ok, false);
    if (!badEmail.ok) {
      assert.match(badEmail.fieldErrors.email ?? "", /valid email/i);
    }

    const badPhone = validateUserProfileInput({
      firstName: "Tariq",
      lastName: "Hasan",
      email: "",
      phone: "abc",
    });
    assert.equal(badPhone.ok, false);
    if (!badPhone.ok) {
      assert.match(badPhone.fieldErrors.phone ?? "", /valid phone/i);
    }
  });

  it("validates user password policy and formats user-agent summaries cleanly", () => {
    const weak = validateUserPasswordInput(
      {
        currentPassword: "old-password",
        newPassword: "short",
        confirmPassword: "short",
      },
      { minLength: 12, requireStrongPassword: true },
    );
    assert.equal(weak.ok, false);
    if (!weak.ok) {
      assert.match(weak.fieldErrors.newPassword ?? "", /at least 12/i);
    }

    const missingComplexity = validateUserPasswordInput(
      {
        currentPassword: "old-password",
        newPassword: "alllowercasepassword",
        confirmPassword: "alllowercasepassword",
      },
      { minLength: 12, requireStrongPassword: true },
    );
    assert.equal(missingComplexity.ok, false);
    if (!missingComplexity.ok) {
      assert.match(missingComplexity.fieldErrors.newPassword ?? "", /uppercase/i);
    }

    const mismatch = validateUserPasswordInput(
      {
        currentPassword: "old-password",
        newPassword: "Valid#Password99",
        confirmPassword: "Different#Password99",
      },
      { minLength: 12, requireStrongPassword: true },
    );
    assert.equal(mismatch.ok, false);
    if (!mismatch.ok) {
      assert.match(mismatch.fieldErrors.confirmPassword ?? "", /does not match/i);
    }

    assert.equal(
      formatUserAgentSummary(
        "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/130.0.0.0 Safari/537.36",
      ),
      "Chrome · Linux",
    );
    assert.equal(formatUserAgentSummary(""), "Web session");
  });

  it("persists demo user profile overrides cleanly across reads and clears on reset", () => {
    const initial = getDevDemoProfile("9002");
    assert.ok(initial);
    assert.equal(initial.username, "demo.user");
    assert.equal(initial.editable, true);

    const updated = updateDevDemoProfile("9002", {
      firstName: "Nadia",
      lastName: "Karim",
      email: "nadia@readbox.local",
      phone: "+880 1800 555666",
    });
    assert.ok(updated);
    assert.equal(updated.firstName, "Nadia");
    assert.equal(updated.lastName, "Karim");
    assert.equal(updated.email, "nadia@readbox.local");
    assert.equal(updated.phone, "+880 1800 555666");

    const identity = getDevDemoUserById("development", "9002");
    assert.ok(identity);
    assert.equal(identity.firstName, "Nadia");
    assert.equal(identity.phone, "+880 1800 555666");

    assert.equal(
      updateDevDemoProfile("9001", {
        firstName: "Admin",
        lastName: "Blocked",
        email: "admin@readbox.local",
        phone: "",
      }),
      null,
    );

    clearDevDemoSessions();
    const resetProfile = getDevDemoProfile("9002");
    assert.equal(resetProfile?.firstName, "Demo");
  });

  it("updates demo user password, verifies new login password, and manages active demo sessions", () => {
    const sidCurrent = createOpaqueToken();
    const sidOther = createOpaqueToken();
    assert.equal(registerDevDemoSession("development", "9002", sidCurrent), true);
    assert.equal(registerDevDemoSession("development", "9002", sidOther), true);

    const wrongCurrent = updateDevDemoPassword(
      "9002",
      {
        currentPassword: "wrong-password",
        newPassword: "Strong!DemoPass2026",
        confirmPassword: "Strong!DemoPass2026",
        revokeOtherSessions: true,
      },
      sidCurrent,
    );
    assert.equal(wrongCurrent.ok, false);
    if (!wrongCurrent.ok) {
      assert.match(wrongCurrent.error, /incorrect/i);
    }

    const updated = updateDevDemoPassword(
      "9002",
      {
        currentPassword: "demo-user-local-dev",
        newPassword: "Strong!DemoPass2026",
        confirmPassword: "Strong!DemoPass2026",
        revokeOtherSessions: true,
      },
      sidCurrent,
    );
    assert.equal(updated.ok, true);
    if (updated.ok) {
      assert.equal(updated.data.revokedOtherSessions, 1);
    }

    // Old password rejected, new password accepted
    assert.equal(
      authorizeDevDemoCredentials("development", {
        username: "demo.user",
        password: "demo-user-local-dev",
        loginScope: "user",
      }),
      null,
    );
    assert.ok(
      authorizeDevDemoCredentials("development", {
        username: "demo.user",
        password: "Strong!DemoPass2026",
        loginScope: "user",
      }),
    );

    const snapshot = getDevDemoSecuritySnapshot("9002", sidCurrent);
    assert.equal(snapshot.activeSessions.length, 1);
    assert.equal(snapshot.activeSessions[0]?.isCurrent, true);
    assert.ok(snapshot.recentEvents.some((e) => e.action === "user_password_changed"));

    // Register another session and revoke it individually & in bulk
    const sidExtra = createOpaqueToken();
    assert.equal(registerDevDemoSession("development", "9002", sidExtra), true);
    const snap2 = getDevDemoSecuritySnapshot("9002", sidCurrent);
    const otherSession = snap2.activeSessions.find((s) => !s.isCurrent);
    assert.ok(otherSession);

    const revokedOne = revokeDevDemoUserSessionById("9002", otherSession.id, sidCurrent);
    assert.equal(revokedOne.ok, true);

    const currentSess = snap2.activeSessions.find((s) => s.isCurrent);
    assert.ok(currentSess);
    const protectCurrent = revokeDevDemoUserSessionById("9002", currentSess.id, sidCurrent);
    assert.equal(protectCurrent.ok, false);

    const sidExtra2 = createOpaqueToken();
    registerDevDemoSession("development", "9002", sidExtra2);
    const revokedAll = revokeDevDemoOtherUserSessions("9002", sidCurrent);
    assert.equal(revokedAll.data.revoked, 1);
  });

  it("reads and updates user profile via Prisma transaction and writes user_profile_updated audit log", async () => {
    const auditEntries: Array<{ action: string; details: unknown }> = [];
    let currentRow = {
      id: BigInt(42),
      username: "user.one",
      firstName: "Old",
      lastName: "Name",
      email: "old@readbox.local",
      phone: "",
      passwordHash: "stored-hash",
      isActive: true,
      dateJoined: new Date("2026-11-01T00:00:00.000Z"),
      lastLogin: new Date("2026-11-15T10:00:00.000Z"),
      administratorProfile: null,
    };

    const currentSid = createOpaqueToken();
    const otherSid = createOpaqueToken();
    let sessions = [
      {
        id: BigInt(101),
        userId: BigInt(42),
        tokenHash: hashOpaqueToken(currentSid),
        ipAddress: "127.0.0.1",
        userAgent: "Chrome/130.0 Linux",
        createdAt: new Date("2026-11-16T08:00:00.000Z"),
        lastSeenAt: new Date("2026-11-16T09:00:00.000Z"),
        expiresAt: new Date(Date.now() + 3600_000),
      },
      {
        id: BigInt(102),
        userId: BigInt(42),
        tokenHash: hashOpaqueToken(otherSid),
        ipAddress: "10.0.0.5",
        userAgent: "Firefox/131.0 Windows",
        createdAt: new Date("2026-11-16T07:00:00.000Z"),
        lastSeenAt: null,
        expiresAt: new Date(Date.now() + 3600_000),
      },
    ];

    const fakePrisma = {
      user: {
        findUnique: async () => currentRow,
        update: async ({ data }: { data: Partial<typeof currentRow> }) => {
          currentRow = {
            ...currentRow,
            ...data,
          };
          return currentRow;
        },
      },
      adminAccount: {
        findUnique: async () => null,
      },
      userControlSettings: {
        findFirst: async () => null,
      },
      appSession: {
        findMany: async () => sessions,
        findFirst: async ({ where }: { where: { id: bigint; userId: bigint } }) => {
          const found = sessions.find(
            (s) => s.id === where.id && s.userId === where.userId,
          );
          return found ? { ...found, user: { username: currentRow.username } } : null;
        },
        delete: async ({ where }: { where: { id: bigint } }) => {
          sessions = sessions.filter((s) => s.id !== where.id);
        },
        deleteMany: async ({
          where,
        }: {
          where: { userId: bigint; tokenHash?: { not: string } };
        }) => {
          const before = sessions.length;
          sessions = sessions.filter((s) => {
            if (s.userId !== where.userId) return true;
            if (where.tokenHash?.not && s.tokenHash === where.tokenHash.not) {
              return true;
            }
            return false;
          });
          return { count: before - sessions.length };
        },
      },
      auditLog: {
        findMany: async () => [
          {
            id: BigInt(1),
            action: "login_success",
            ipAddress: "127.0.0.1",
            createdAt: new Date("2026-11-16T08:00:00.000Z"),
          },
        ],
        create: async ({ data }: { data: { action: string; details: unknown } }) => {
          auditEntries.push({ action: data.action, details: data.details });
          return data;
        },
      },
      $transaction: async <T>(fn: (tx: unknown) => Promise<T>) =>
        fn(fakePrisma),
    } as unknown as PrismaClient;

    const loaded = await getUserProfile(fakePrisma, {
      userId: BigInt(42),
      authSource: "user_table",
    });
    assert.equal(loaded.ok, true);

    const saved = await updateUserProfile(
      fakePrisma,
      { userId: BigInt(42), authSource: "user_table" },
      {
        firstName: "New",
        lastName: "Person",
        email: "new@readbox.local",
        phone: "+1 555 222 3333",
      },
    );
    assert.equal(saved.ok, true);

    const snap = await getUserSecuritySnapshot(
      fakePrisma,
      { userId: BigInt(42), authSource: "user_table", username: "user.one" },
      {
        currentSessionId: currentSid,
        passwordPolicy: { minLength: 12, requireStrongPassword: true },
      },
    );
    assert.equal(snap.activeSessions.length, 2);
    assert.equal(snap.activeSessions[0]?.isCurrent, true);
    assert.equal(snap.recentEvents[0]?.label, "Signed in");

    const passUpdate = await updateUserPassword(
      fakePrisma,
      { userId: BigInt(42), authSource: "user_table" },
      {
        currentPassword: "old-secret-password",
        newPassword: "New!StrongPassword2026",
        confirmPassword: "New!StrongPassword2026",
        revokeOtherSessions: true,
      },
      {
        currentSessionId: currentSid,
        passwordPolicy: { minLength: 12, requireStrongPassword: true },
        verifyPasswordFn: async (_h, c) => c === "old-secret-password",
        hashPasswordFn: async () => "new-argon2-hash",
      },
    );
    assert.equal(passUpdate.ok, true);
    if (passUpdate.ok) {
      assert.equal(passUpdate.data.revokedOtherSessions, 1);
    }
    assert.equal(currentRow.passwordHash, "new-argon2-hash");
    assert.equal(sessions.length, 1);
    assert.equal(
      auditEntries.some((entry) => entry.action === "user_password_changed"),
      true,
    );

    const revokeProtected = await revokeUserSessionById(
      fakePrisma,
      { userId: BigInt(42), authSource: "user_table" },
      "101",
      { currentSessionId: currentSid },
    );
    assert.equal(revokeProtected.ok, false);

    const revokeNoneLeft = await revokeOtherUserSessions(
      fakePrisma,
      { userId: BigInt(42), authSource: "user_table" },
      { currentSessionId: currentSid },
    );
    assert.equal(revokeNoneLeft.ok, true);
    if (revokeNoneLeft.ok) {
      assert.equal(revokeNoneLeft.data.revoked, 0);
    }
  });
});
