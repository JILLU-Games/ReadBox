import { hashOpaqueToken, isOpaqueToken } from "@/core/auth/opaque-token";
import type { PrismaClient } from "@prisma/client";
import "server-only";

export interface SessionRegistryOptions {
  readonly authSource?: "admin_table" | "user_table";
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
      adminEntry.expiresAt <= new Date() ||
      !adminEntry.admin.isActive ||
      adminEntry.admin.passwordResetRequired
    ) {
      return null;
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
    registryEntry.expiresAt <= new Date() ||
    !registryEntry.user.isActive ||
    registryEntry.user.passwordResetRequired
  ) {
    return null;
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
