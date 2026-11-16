import { hashOpaqueToken, isOpaqueToken } from "@/core/auth/opaque-token";
import type { PrismaClient } from "@prisma/client";
import "server-only";

export interface SessionRegistryOptions {
  readonly authSource?: "admin_table" | "user_table";
  readonly ipAddress?: string | null;
  readonly userAgent?: string | null;
  readonly now?: Date;
}

function normalizeSessionIp(rawIp: string | null | undefined): string | null {
  const trimmed = (rawIp ?? "").trim();
  if (!trimmed) return null;
  return trimmed.slice(0, 64);
}

function normalizeSessionUserAgent(
  rawUserAgent: string | null | undefined,
): string {
  const trimmed = (rawUserAgent ?? "").trim();
  if (!trimmed) return "";
  return trimmed.slice(0, 500);
}

export async function registerAppSession(
  prisma: PrismaClient,
  userId: string,
  sessionId: string,
  expiresAt: Date,
  options: SessionRegistryOptions = {},
): Promise<boolean> {
  if (!/^[1-9]\d*$/.test(userId) || !isOpaqueToken(sessionId)) return false;

  const id = BigInt(userId);
  const now = options.now ?? new Date();
  const ipAddress = normalizeSessionIp(options.ipAddress);
  const userAgent = normalizeSessionUserAgent(options.userAgent);

  return prisma.$transaction(async (transaction) => {
    if (
      options.authSource === "admin_table" &&
      "adminSession" in transaction &&
      transaction.adminSession
    ) {
      const eligibleAdmin = await transaction.$queryRaw<Array<{ id: bigint }>>`
        SELECT "id" FROM "admin_accounts"
        WHERE "id" = ${id} AND "is_active" = true AND "password_reset_required" = false
        FOR UPDATE
      `;
      if (eligibleAdmin.length !== 1) return false;

      await transaction.adminSession.create({
        data: {
          adminId: id,
          tokenHash: hashOpaqueToken(sessionId),
          expiresAt,
          lastSeenAt: now,
          ...(ipAddress ? { ipAddress } : {}),
          ...(userAgent ? { userAgent } : {}),
        },
      });
      return true;
    }

    const eligible = await transaction.$queryRaw<Array<{ id: bigint }>>`
      SELECT "id" FROM "users"
      WHERE "id" = ${id} AND "is_active" = true AND "password_reset_required" = false
      FOR UPDATE
    `;
    if (eligible.length !== 1) return false;

    await transaction.appSession.create({
      data: {
        userId: id,
        tokenHash: hashOpaqueToken(sessionId),
        expiresAt,
        lastSeenAt: now,
        ...(ipAddress ? { ipAddress } : {}),
        ...(userAgent ? { userAgent } : {}),
      },
    });
    return true;
  });
}

export async function getActiveAppSession(
  prisma: PrismaClient,
  userId: string,
  sessionId: string,
  options: SessionRegistryOptions = {},
) {
  if (!/^[1-9]\d*$/.test(userId) || !isOpaqueToken(sessionId)) return null;

  let id: bigint;
  try {
    id = BigInt(userId);
  } catch {
    return null;
  }

  const tokenHash = hashOpaqueToken(sessionId);
  const now = options.now ?? new Date();
  const ipAddress = normalizeSessionIp(options.ipAddress);
  const userAgent = normalizeSessionUserAgent(options.userAgent);

  if (
    options.authSource === "admin_table" &&
    "adminSession" in prisma &&
    prisma.adminSession
  ) {
    const adminEntry = await prisma.adminSession.findUnique({
      where: { tokenHash },
      select: {
        adminId: true,
        expiresAt: true,
        ipAddress: true,
        userAgent: true,
        admin: {
          select: {
            id: true,
            username: true,
            firstName: true,
            lastName: true,
            email: true,
            isActive: true,
            isSuperuser: true,
            passwordResetRequired: true,
          },
        },
      },
    });

    if (
      !adminEntry ||
      adminEntry.adminId !== id ||
      adminEntry.expiresAt <= now ||
      !adminEntry.admin.isActive ||
      adminEntry.admin.passwordResetRequired
    ) {
      return null;
    }

    if (
      "update" in prisma.adminSession &&
      typeof prisma.adminSession.update === "function"
    ) {
      try {
        await prisma.adminSession.update({
          where: { tokenHash },
          data: {
            lastSeenAt: now,
            ...(!adminEntry.ipAddress && ipAddress ? { ipAddress } : {}),
            ...(!adminEntry.userAgent && userAgent ? { userAgent } : {}),
          },
        });
      } catch {
        // Non-fatal session telemetry refresh
      }
    }

    return {
      id: adminEntry.admin.id,
      username: adminEntry.admin.username,
      firstName: adminEntry.admin.firstName,
      lastName: adminEntry.admin.lastName,
      email: adminEntry.admin.email,
      isActive: adminEntry.admin.isActive,
      passwordResetRequired: adminEntry.admin.passwordResetRequired,
      isAdministrator: true,
      isSuperuser: adminEntry.admin.isSuperuser,
      authSource: "admin_table" as const,
    };
  }

  const registryEntry = await prisma.appSession.findUnique({
    where: { tokenHash },
    select: {
      userId: true,
      expiresAt: true,
      ipAddress: true,
      userAgent: true,
      user: {
        select: {
          id: true,
          username: true,
          firstName: true,
          lastName: true,
          email: true,
          isActive: true,
          passwordResetRequired: true,
          administratorProfile: {
            select: { isSuperuser: true },
          },
        },
      },
    },
  });

  if (
    !registryEntry ||
    registryEntry.userId !== id ||
    registryEntry.expiresAt <= now ||
    !registryEntry.user.isActive ||
    registryEntry.user.passwordResetRequired
  ) {
    return null;
  }

  if (
    "update" in prisma.appSession &&
    typeof prisma.appSession.update === "function"
  ) {
    try {
      await prisma.appSession.update({
        where: { tokenHash },
        data: {
          lastSeenAt: now,
          ...(!registryEntry.ipAddress && ipAddress ? { ipAddress } : {}),
          ...(!registryEntry.userAgent && userAgent ? { userAgent } : {}),
        },
      });
    } catch {
      // Non-fatal session telemetry refresh
    }
  }

  const { administratorProfile, ...user } = registryEntry.user;
  return {
    ...user,
    isAdministrator: administratorProfile !== null,
    isSuperuser: administratorProfile?.isSuperuser === true,
    authSource: "user_table" as const,
  };
}

export async function revokeAppSession(
  prisma: PrismaClient,
  sessionId: string,
): Promise<void> {
  if (!isOpaqueToken(sessionId)) return;

  const tokenHash = hashOpaqueToken(sessionId);

  await prisma.appSession.deleteMany({
    where: { tokenHash },
  });

  if ("adminSession" in prisma && prisma.adminSession) {
    await prisma.adminSession.deleteMany({
      where: { tokenHash },
    });
  }
}
