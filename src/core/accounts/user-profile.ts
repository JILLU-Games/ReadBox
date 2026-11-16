import { isAccountAdministrator } from "@/core/accounts/policy";
import { getUserControlSettings } from "@/core/accounts/user-control-policy";
import {
  DEFAULT_USER_PASSWORD_POLICY,
  formatSecurityEventLabel,
  formatUserAgentSummary,
  type UserPasswordPolicySummary,
  type UserProfileActionResult,
  type UserProfileRecord,
  type UserSecuritySnapshot,
  validateUserPasswordInput,
  validateUserProfileInput,
} from "@/core/accounts/user-profile-schema";
import { recordAudit } from "@/core/audit/record";
import type { AuditWriteClient } from "@/core/audit/types";
import { hashOpaqueToken, isOpaqueToken } from "@/core/auth/opaque-token";
import { hashPassword, verifyPassword } from "@/core/auth/password";
import { logger } from "@/core/server/logger";
import type { PrismaClient } from "@prisma/client";
import "server-only";

export interface UserProfileActorContext {
  readonly userId: bigint;
  readonly authSource: "user_table" | "admin_table";
  readonly headers?: Pick<Headers, "get">;
  readonly clientIp?: string | null;
  readonly userAgent?: string | null;
  readonly trustProxyHeaders?: boolean;
}

const USER_SECURITY_AUDIT_ACTIONS = [
  "login_success",
  "login_failure",
  "user_password_changed",
  "password_reset_requested",
  "password_reset_completed",
  "user_self_signup",
  "user_signup_approved",
  "user_signup_rejected",
  "user_profile_updated",
  "user_session_revoked",
  "user_sessions_revoked",
] as const;

function parseSessionBigIntId(rawId: string): bigint | null {
  const trimmed = rawId.trim();
  if (!/^[1-9]\d*$/.test(trimmed)) return null;
  try {
    return BigInt(trimmed);
  } catch {
    return null;
  }
}

export async function resolveEffectiveUserPasswordPolicy(
  prisma: PrismaClient,
): Promise<UserPasswordPolicySummary> {
  try {
    const settings = await getUserControlSettings(prisma);
    return {
      minLength: Math.max(8, settings.minPasswordLength),
      requireStrongPassword: settings.requireStrongPassword,
    };
  } catch {
    return DEFAULT_USER_PASSWORD_POLICY;
  }
}

export async function getUserProfile(
  prisma: Pick<PrismaClient, "user" | "adminAccount">,
  actor: Pick<UserProfileActorContext, "userId" | "authSource">,
): Promise<UserProfileActionResult<UserProfileRecord>> {
  if (actor.userId <= BigInt(0)) {
    return { ok: false, code: "not_found", error: "Account not found." };
  }

  try {
    if (actor.authSource === "admin_table") {
      const admin = await prisma.adminAccount.findUnique({
        where: { id: actor.userId },
        select: {
          id: true,
          username: true,
          firstName: true,
          lastName: true,
          email: true,
          createdAt: true,
          lastLogin: true,
        },
      });
      if (!admin) {
        return { ok: false, code: "not_found", error: "Account not found." };
      }

      return {
        ok: true,
        message: "Profile loaded.",
        data: {
          id: admin.id.toString(),
          username: admin.username,
          firstName: admin.firstName,
          lastName: admin.lastName,
          email: admin.email,
          phone: "",
          isAdministrator: true,
          authSource: "admin_table",
          editable: false,
          dateJoined: admin.createdAt.toISOString(),
          lastLogin: admin.lastLogin ? admin.lastLogin.toISOString() : null,
        },
      };
    }

    const user = await prisma.user.findUnique({
      where: { id: actor.userId },
      select: {
        id: true,
        username: true,
        firstName: true,
        lastName: true,
        email: true,
        phone: true,
        dateJoined: true,
        lastLogin: true,
        administratorProfile: { select: { isSuperuser: true } },
      },
    });

    if (!user) {
      return { ok: false, code: "not_found", error: "Account not found." };
    }

    return {
      ok: true,
      message: "Profile loaded.",
      data: {
        id: user.id.toString(),
        username: user.username,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        phone: user.phone,
        isAdministrator: isAccountAdministrator(user),
        authSource: "user_table",
        editable: true,
        dateJoined: user.dateJoined.toISOString(),
        lastLogin: user.lastLogin ? user.lastLogin.toISOString() : null,
      },
    };
  } catch {
    logger.error("user_profile_load_failed");
    return {
      ok: false,
      code: "unavailable",
      error: "Could not load your profile right now.",
    };
  }
}

export async function updateUserProfile(
  prisma: PrismaClient,
  actor: UserProfileActorContext,
  rawInput: unknown,
): Promise<UserProfileActionResult<UserProfileRecord>> {
  const validated = validateUserProfileInput(rawInput);
  if (!validated.ok) {
    return {
      ok: false,
      code: "validation",
      error: validated.error,
      fieldErrors: validated.fieldErrors,
    };
  }

  if (actor.authSource === "admin_table") {
    return {
      ok: false,
      code: "admin_protected",
      error: "Administrator accounts cannot update personal profile fields here.",
    };
  }

  if (actor.userId <= BigInt(0)) {
    return { ok: false, code: "not_found", error: "Account not found." };
  }

  try {
    const saved = await prisma.$transaction(async (tx) => {
      const existing = await tx.user.findUnique({
        where: { id: actor.userId },
        select: {
          id: true,
          username: true,
          firstName: true,
          lastName: true,
          email: true,
          phone: true,
          administratorProfile: { select: { isSuperuser: true } },
        },
      });
      if (!existing) return null;

      const updated = await tx.user.update({
        where: { id: actor.userId },
        data: {
          firstName: validated.data.firstName,
          lastName: validated.data.lastName,
          email: validated.data.email,
          phone: validated.data.phone,
        },
        select: {
          id: true,
          username: true,
          firstName: true,
          lastName: true,
          email: true,
          phone: true,
          dateJoined: true,
          lastLogin: true,
          administratorProfile: { select: { isSuperuser: true } },
        },
      });

      const changedFields: string[] = [];
      if (existing.firstName !== updated.firstName) changedFields.push("firstName");
      if (existing.lastName !== updated.lastName) changedFields.push("lastName");
      if (existing.email !== updated.email) changedFields.push("email");
      if (existing.phone !== updated.phone) changedFields.push("phone");

      await recordAudit(tx as unknown as AuditWriteClient, {
        actorId: updated.id,
        action: "user_profile_updated",
        targetType: "user",
        targetIdentifier: updated.username,
        headers: actor.headers,
        clientIp: actor.clientIp,
        userAgent: actor.userAgent,
        trustProxyHeaders: actor.trustProxyHeaders,
        details: { changed_fields: changedFields },
      });

      return updated;
    });

    if (!saved) {
      return { ok: false, code: "not_found", error: "Account not found." };
    }

    return {
      ok: true,
      message: "Profile settings saved.",
      data: {
        id: saved.id.toString(),
        username: saved.username,
        firstName: saved.firstName,
        lastName: saved.lastName,
        email: saved.email,
        phone: saved.phone,
        isAdministrator: isAccountAdministrator(saved),
        authSource: "user_table",
        editable: true,
        dateJoined: saved.dateJoined.toISOString(),
        lastLogin: saved.lastLogin ? saved.lastLogin.toISOString() : null,
      },
    };
  } catch {
    logger.error("user_profile_update_failed");
    return {
      ok: false,
      code: "unavailable",
      error: "Could not save profile changes. Try again later.",
    };
  }
}

export async function getUserSecuritySnapshot(
  prisma: PrismaClient,
  actor: Pick<UserProfileActorContext, "userId" | "authSource"> & {
    readonly username?: string;
  },
  options: {
    readonly currentSessionId?: string | null;
    readonly passwordPolicy?: UserPasswordPolicySummary;
  } = {},
): Promise<UserSecuritySnapshot> {
  const passwordPolicy =
    options.passwordPolicy ?? (await resolveEffectiveUserPasswordPolicy(prisma));

  if (actor.authSource === "admin_table" || actor.userId <= BigInt(0)) {
    return {
      passwordPolicy,
      activeSessions: [],
      recentEvents: [],
      canManageSecurity: false,
    };
  }

  const currentHash =
    options.currentSessionId && isOpaqueToken(options.currentSessionId)
      ? hashOpaqueToken(options.currentSessionId)
      : null;

  try {
    const now = new Date();
    const [sessions, events] = await Promise.all([
      prisma.appSession.findMany({
        where: {
          userId: actor.userId,
          expiresAt: { gt: now },
        },
        orderBy: [{ createdAt: "desc" }],
        take: 25,
        select: {
          id: true,
          tokenHash: true,
          ipAddress: true,
          userAgent: true,
          createdAt: true,
          lastSeenAt: true,
          expiresAt: true,
        },
      }),
      prisma.auditLog.findMany({
        where: {
          action: { in: [...USER_SECURITY_AUDIT_ACTIONS] },
          OR: [
            { actorId: actor.userId },
            ...(actor.username
              ? [
                  {
                    targetType: "user",
                    targetIdentifier: actor.username,
                  },
                ]
              : []),
          ],
        },
        orderBy: [{ createdAt: "desc" }],
        take: 10,
        select: {
          id: true,
          action: true,
          ipAddress: true,
          createdAt: true,
        },
      }),
    ]);

    return {
      passwordPolicy,
      canManageSecurity: true,
      activeSessions: sessions.map((session) => ({
        id: session.id.toString(),
        label: formatUserAgentSummary(session.userAgent),
        ipAddress: session.ipAddress ?? null,
        createdAt: session.createdAt.toISOString(),
        lastSeenAt: session.lastSeenAt ? session.lastSeenAt.toISOString() : null,
        expiresAt: session.expiresAt.toISOString(),
        isCurrent: Boolean(currentHash && session.tokenHash === currentHash),
      })),
      recentEvents: events.map((evt) => {
        const formatted = formatSecurityEventLabel(evt.action);
        return {
          id: evt.id.toString(),
          action: evt.action,
          label: formatted.label,
          ipAddress: evt.ipAddress ?? null,
          createdAt: evt.createdAt.toISOString(),
          outcome: formatted.outcome,
        };
      }),
    };
  } catch {
    logger.error("user_security_snapshot_failed");
    return {
      passwordPolicy,
      activeSessions: [],
      recentEvents: [],
      canManageSecurity: true,
    };
  }
}

export async function updateUserPassword(
  prisma: PrismaClient,
  actor: UserProfileActorContext,
  rawInput: unknown,
  options: {
    readonly currentSessionId?: string | null;
    readonly passwordPolicy?: UserPasswordPolicySummary;
    readonly hashPasswordFn?: (password: string) => Promise<string>;
    readonly verifyPasswordFn?: (
      storedHash: string | null,
      candidate: string,
    ) => Promise<boolean>;
  } = {},
): Promise<UserProfileActionResult<{ readonly revokedOtherSessions: number }>> {
  if (actor.authSource === "admin_table") {
    return {
      ok: false,
      code: "admin_protected",
      error: "Administrator accounts cannot update password here.",
    };
  }

  if (actor.userId <= BigInt(0)) {
    return { ok: false, code: "not_found", error: "Account not found." };
  }

  const passwordPolicy =
    options.passwordPolicy ?? (await resolveEffectiveUserPasswordPolicy(prisma));
  const validated = validateUserPasswordInput(rawInput, passwordPolicy);
  if (!validated.ok) {
    return {
      ok: false,
      code: "validation",
      error: validated.error,
      fieldErrors: validated.fieldErrors,
    };
  }

  const verifyFn = options.verifyPasswordFn ?? verifyPassword;
  const hashFn = options.hashPasswordFn ?? hashPassword;
  const currentSessionHash =
    options.currentSessionId && isOpaqueToken(options.currentSessionId)
      ? hashOpaqueToken(options.currentSessionId)
      : null;

  try {
    const existing = await prisma.user.findUnique({
      where: { id: actor.userId },
      select: {
        id: true,
        username: true,
        passwordHash: true,
        isActive: true,
      },
    });

    if (!existing) {
      return { ok: false, code: "not_found", error: "Account not found." };
    }

    const matches = await verifyFn(
      existing.passwordHash,
      validated.data.currentPassword,
    );
    if (!matches) {
      return {
        ok: false,
        code: "validation",
        error: "Current password is incorrect.",
        fieldErrors: {
          currentPassword: "Current password is incorrect.",
        },
      };
    }

    const nextHash = await hashFn(validated.data.newPassword);

    const revokedOtherSessions = await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: existing.id },
        data: {
          passwordHash: nextHash,
          passwordResetRequired: false,
        },
      });

      let revoked = 0;
      if (validated.data.revokeOtherSessions) {
        const deleted = await tx.appSession.deleteMany({
          where: {
            userId: existing.id,
            ...(currentSessionHash
              ? { tokenHash: { not: currentSessionHash } }
              : {}),
          },
        });
        revoked = deleted.count;
      }

      await recordAudit(tx as unknown as AuditWriteClient, {
        actorId: existing.id,
        action: "user_password_changed",
        targetType: "user",
        targetIdentifier: existing.username,
        headers: actor.headers,
        clientIp: actor.clientIp,
        userAgent: actor.userAgent,
        trustProxyHeaders: actor.trustProxyHeaders,
        details: { revoked_other_sessions: revoked },
      });

      return revoked;
    });

    return {
      ok: true,
      data: { revokedOtherSessions },
      message:
        revokedOtherSessions > 0
          ? `Password updated and ${revokedOtherSessions} other active session(s) signed out.`
          : "Password updated.",
    };
  } catch {
    logger.error("user_password_update_failed");
    return {
      ok: false,
      code: "unavailable",
      error: "Could not update your password. Try again later.",
    };
  }
}

export async function revokeUserSessionById(
  prisma: PrismaClient,
  actor: UserProfileActorContext,
  rawSessionId: string,
  options: { readonly currentSessionId?: string | null } = {},
): Promise<UserProfileActionResult<{ readonly revoked: number }>> {
  if (actor.authSource === "admin_table") {
    return {
      ok: false,
      code: "admin_protected",
      error: "Administrator accounts cannot manage sessions here.",
    };
  }

  const sessionId = parseSessionBigIntId(rawSessionId);
  if (sessionId === null || actor.userId <= BigInt(0)) {
    return { ok: false, code: "not_found", error: "Session not found." };
  }

  const currentHash =
    options.currentSessionId && isOpaqueToken(options.currentSessionId)
      ? hashOpaqueToken(options.currentSessionId)
      : null;

  try {
    const outcome = await prisma.$transaction(async (tx) => {
      const target = await tx.appSession.findFirst({
        where: { id: sessionId, userId: actor.userId },
        select: {
          id: true,
          tokenHash: true,
          user: { select: { username: true } },
        },
      });
      if (!target) {
        return { status: "not_found" as const };
      }

      if (currentHash && target.tokenHash === currentHash) {
        return { status: "current_protected" as const };
      }

      await tx.appSession.delete({ where: { id: target.id } });
      await recordAudit(tx as unknown as AuditWriteClient, {
        actorId: actor.userId,
        action: "user_session_revoked",
        targetType: "user",
        targetIdentifier: target.user.username,
        headers: actor.headers,
        clientIp: actor.clientIp,
        userAgent: actor.userAgent,
        trustProxyHeaders: actor.trustProxyHeaders,
        details: { session_id: target.id.toString() },
      });
      return { status: "revoked" as const };
    });

    if (outcome.status === "not_found") {
      return { ok: false, code: "not_found", error: "Session not found." };
    }
    if (outcome.status === "current_protected") {
      return {
        ok: false,
        code: "validation",
        error: "Use Sign out in the header to end your current session.",
      };
    }

    return {
      ok: true,
      data: { revoked: 1 },
      message: "Session revoked.",
    };
  } catch {
    logger.error("user_session_revoke_failed");
    return {
      ok: false,
      code: "unavailable",
      error: "Could not revoke session. Try again later.",
    };
  }
}

export async function revokeOtherUserSessions(
  prisma: PrismaClient,
  actor: UserProfileActorContext,
  options: { readonly currentSessionId?: string | null } = {},
): Promise<UserProfileActionResult<{ readonly revoked: number }>> {
  if (actor.authSource === "admin_table") {
    return {
      ok: false,
      code: "admin_protected",
      error: "Administrator accounts cannot manage sessions here.",
    };
  }

  if (actor.userId <= BigInt(0)) {
    return { ok: false, code: "not_found", error: "Account not found." };
  }

  const currentHash =
    options.currentSessionId && isOpaqueToken(options.currentSessionId)
      ? hashOpaqueToken(options.currentSessionId)
      : null;

  try {
    const revokedCount = await prisma.$transaction(async (tx) => {
      const user = await tx.user.findUnique({
        where: { id: actor.userId },
        select: { username: true },
      });
      if (!user) return null;

      const deleted = await tx.appSession.deleteMany({
        where: {
          userId: actor.userId,
          ...(currentHash ? { tokenHash: { not: currentHash } } : {}),
        },
      });

      if (deleted.count > 0) {
        await recordAudit(tx as unknown as AuditWriteClient, {
          actorId: actor.userId,
          action: "user_sessions_revoked",
          targetType: "user",
          targetIdentifier: user.username,
          headers: actor.headers,
          clientIp: actor.clientIp,
          userAgent: actor.userAgent,
          trustProxyHeaders: actor.trustProxyHeaders,
          details: { revoked_count: deleted.count },
        });
      }

      return deleted.count;
    });

    if (revokedCount === null) {
      return { ok: false, code: "not_found", error: "Account not found." };
    }

    return {
      ok: true,
      data: { revoked: revokedCount },
      message:
        revokedCount > 0
          ? `Signed out ${revokedCount} other active session(s).`
          : "No other active sessions to sign out.",
    };
  } catch {
    logger.error("user_sessions_revoke_failed");
    return {
      ok: false,
      code: "unavailable",
      error: "Could not sign out other sessions. Try again later.",
    };
  }
}
