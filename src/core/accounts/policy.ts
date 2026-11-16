import type { PrismaClient } from "@prisma/client";
import "server-only";

export interface AdministratorProfileCarrier {
  readonly administratorProfile?: { readonly isSuperuser?: boolean } | null;
}

export interface AccountRoleFlags {
  readonly isAdministrator: boolean;
  readonly isSuperuser: boolean;
}

export interface UserAccessCapabilities {
  readonly canDeleteMessages: boolean;
  readonly canDeleteMailboxes: boolean;
  readonly canCreateMailboxes?: boolean;
  readonly maxMailboxes?: number;
  readonly allowedDomainUuids?: readonly string[];
  readonly autoDeleteEnabled?: boolean;
  readonly autoDeleteDays?: number;
}

/**
 * Authoritative role check per ARCHITECTURE-DECISIONS D-009.
 * Never inspects legacy User.isStaff / User.isSuperuser booleans.
 */
export function isAccountAdministrator(
  account: AdministratorProfileCarrier | null | undefined,
): boolean {
  return (
    account?.administratorProfile !== null &&
    account?.administratorProfile !== undefined
  );
}

export function getAccountRoleFlags(
  account: AdministratorProfileCarrier | null | undefined,
): AccountRoleFlags {
  const administrator = isAccountAdministrator(account);
  return {
    isAdministrator: administrator,
    isSuperuser:
      administrator && account?.administratorProfile?.isSuperuser === true,
  };
}

export async function ensureUserAccessPolicy(
  prisma: Pick<PrismaClient, "userAccessPolicy">,
  userId: bigint,
  defaults: Partial<UserAccessCapabilities> = {},
): Promise<UserAccessCapabilities> {
  const canDeleteMessages = defaults.canDeleteMessages === true;
  const canDeleteMailboxes = defaults.canDeleteMailboxes === true;

  const policy = await prisma.userAccessPolicy.upsert({
    where: { userId },
    create: {
      userId,
      canDeleteMessages,
      canDeleteMailboxes,
    },
    update: {},
    select: {
      canDeleteMessages: true,
      canDeleteMailboxes: true,
    },
  });

  return {
    canDeleteMessages: policy.canDeleteMessages,
    canDeleteMailboxes: policy.canDeleteMailboxes,
  };
}

export async function getUserAccessCapabilities(
  prisma: Pick<PrismaClient, "userAccessPolicy">,
  userId: bigint,
): Promise<UserAccessCapabilities> {
  const policy = await prisma.userAccessPolicy.findUnique({
    where: { userId },
    select: {
      canDeleteMessages: true,
      canDeleteMailboxes: true,
    },
  });

  return {
    canDeleteMessages: policy?.canDeleteMessages === true,
    canDeleteMailboxes: policy?.canDeleteMailboxes === true,
  };
}
