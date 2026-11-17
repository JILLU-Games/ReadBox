import {
  ensureUserAccessPolicy,
  isAccountAdministrator,
} from "@/core/accounts/policy";
import { recordAudit } from "@/core/audit/record";
import type { AuditWriteClient } from "@/core/audit/types";
import { hashPassword } from "@/core/auth/password";
import {
  MAX_PASSWORD_LENGTH,
  MIN_PASSWORD_LENGTH,
} from "@/core/auth/password-policy";
import { logger } from "@/core/server/logger";
import type { PrismaClient } from "@prisma/client";
import "server-only";
import { z } from "zod";

const USERNAME_PATTERN = /^[a-zA-Z0-9.@+_-]{2,150}$/;

const baseUserSchema = z.object({
  username: z
    .string()
    .trim()
    .min(2, "Username must be at least 2 characters.")
    .max(150, "Username cannot exceed 150 characters.")
    .regex(
      USERNAME_PATTERN,
      "Username may contain letters, numbers, and . @ + _ - characters only.",
    ),
  firstName: z.string().trim().max(150).default(""),
  lastName: z.string().trim().max(150).default(""),
  email: z
    .string()
    .trim()
    .max(254)
    .refine(
      (value) => value === "" || z.string().email().safeParse(value).success,
      "Enter a valid email address or leave blank.",
    )
    .default(""),
  isActive: z.boolean().default(true),
  canDeleteMessages: z.boolean().default(false),
  canDeleteMailboxes: z.boolean().default(false),
  assignedMailboxIds: z.array(z.string()).default([]),
});

const createUserSchema = baseUserSchema
  .extend({
    password: z
      .string()
      .min(
        MIN_PASSWORD_LENGTH,
        `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`,
      )
      .max(
        MAX_PASSWORD_LENGTH,
        `Password cannot exceed ${MAX_PASSWORD_LENGTH} characters.`,
      ),
    passwordConfirmation: z.string(),
  })
  .refine((data) => data.password === data.passwordConfirmation, {
    path: ["passwordConfirmation"],
    message: "Password confirmation does not match.",
  });

const updateUserSchema = baseUserSchema;

export interface ManagedUserListItem {
  readonly id: string;
  readonly username: string;
  readonly firstName: string;
  readonly lastName: string;
  readonly email: string;
  readonly isAdministrator: boolean;
  readonly isActive: boolean;
  readonly mailboxCount: number;
  readonly canDeleteMessages: boolean;
  readonly canDeleteMailboxes: boolean;
  readonly dateJoined: string;
  readonly lastLogin: string | null;
}

export interface ManagedUserListResult {
  readonly items: readonly ManagedUserListItem[];
  readonly totalCount: number;
  readonly page: number;
  readonly pageSize: number;
  readonly totalPages: number;
  readonly query: string;
}

export interface AssignableMailboxOption {
  readonly id: string;
  readonly uuid: string;
  readonly emailAddress: string;
  readonly status: string;
}

export interface ManagedUserEditRecord {
  readonly id: string;
  readonly username: string;
  readonly firstName: string;
  readonly lastName: string;
  readonly email: string;
  readonly isActive: boolean;
  readonly canDeleteMessages: boolean;
  readonly canDeleteMailboxes: boolean;
  readonly assignedMailboxIds: readonly string[];
  readonly dateJoined: string;
  readonly lastLogin: string | null;
}

export interface UserAuditContext {
  readonly actorId: bigint;
  readonly authSource?: "admin_table" | "user_table";
  readonly actorUsername?: string;
  readonly headers?: Pick<Headers, "get">;
  readonly clientIp?: string | null;
  readonly userAgent?: string | null;
  readonly trustProxyHeaders?: boolean;
}

export type ManagedUserResult<T = unknown> =
  | { readonly ok: true; readonly data: T }
  | {
      readonly ok: false;
      readonly code:
        | "validation"
        | "not_found"
        | "admin_protected"
        | "self_delete"
        | "last_admin"
        | "unavailable";
      readonly error: string;
      readonly fieldErrors?: Record<string, string>;
    };

export function parseBigIntId(rawId: string): bigint | null {
  const trimmed = rawId.trim();
  if (!/^[1-9]\d*$/.test(trimmed)) return null;
  try {
    return BigInt(trimmed);
  } catch {
    return null;
  }
}

function normalizeAssignedMailboxIds(rawIds: readonly string[]): bigint[] {
  const unique = new Set<string>();
  const parsed: bigint[] = [];
  for (const raw of rawIds) {
    const id = parseBigIntId(raw);
    if (id !== null && !unique.has(id.toString())) {
      unique.add(id.toString());
      parsed.push(id);
    }
  }
  return parsed;
}

function formatZodFieldErrors(error: z.ZodError): Record<string, string> {
  const fieldErrors: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path[0];
    if (typeof key === "string" && !fieldErrors[key]) {
      fieldErrors[key] = issue.message;
    }
  }
  return fieldErrors;
}

function isUniqueConstraintError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === "P2002"
  );
}

async function resolveActorIdForDatabase(
  tx: Pick<PrismaClient, "user">,
  actorId: bigint,
  authSource?: "admin_table" | "user_table",
): Promise<bigint | null> {
  if (authSource === "admin_table") return null;
  if (actorId <= BigInt(0)) return null;
  const existing = await tx.user.findUnique({
    where: { id: actorId },
    select: { id: true },
  });
  return existing?.id ?? null;
}

export async function listAssignableMailboxes(
  prisma: Pick<PrismaClient, "mailbox">,
): Promise<AssignableMailboxOption[]> {
  const mailboxes = await prisma.mailbox.findMany({
    where: { deletedAt: null },
    orderBy: [{ emailAddress: "asc" }],
    select: {
      id: true,
      uuid: true,
      emailAddress: true,
      status: true,
    },
  });

  return mailboxes.map((mailbox) => ({
    id: mailbox.id.toString(),
    uuid: mailbox.uuid,
    emailAddress: mailbox.emailAddress,
    status: mailbox.status,
  }));
}

export async function listManagedUsers(
  prisma: Pick<PrismaClient, "user">,
  options: {
    readonly query?: string;
    readonly page?: number;
    readonly pageSize?: number;
  } = {},
): Promise<ManagedUserListResult> {
  const query = (options.query ?? "").trim();
  const pageSize = Math.max(1, Math.min(100, options.pageSize ?? 25));
  const requestedPage = Number.isFinite(options.page)
    ? Math.max(1, Math.floor(options.page ?? 1))
    : 1;

  const where = query
    ? {
        OR: [
          { username: { contains: query, mode: "insensitive" as const } },
          { firstName: { contains: query, mode: "insensitive" as const } },
          { lastName: { contains: query, mode: "insensitive" as const } },
          { email: { contains: query, mode: "insensitive" as const } },
        ],
      }
    : {};

  const totalCount = await prisma.user.count({ where });
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const page = Math.min(requestedPage, totalPages);

  const users = await prisma.user.findMany({
    where,
    orderBy: [{ username: "asc" }],
    skip: (page - 1) * pageSize,
    take: pageSize,
    select: {
      id: true,
      username: true,
      firstName: true,
      lastName: true,
      email: true,
      isActive: true,
      dateJoined: true,
      lastLogin: true,
      administratorProfile: {
        select: { isSuperuser: true },
      },
      accessPolicy: {
        select: {
          canDeleteMessages: true,
          canDeleteMailboxes: true,
        },
      },
      _count: {
        select: {
          memberships: {
            where: {
              mailbox: {
                deletedAt: null,
              },
            },
          },
        },
      },
    },
  });

  return {
    items: users.map((user) => ({
      id: user.id.toString(),
      username: user.username,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      isAdministrator: isAccountAdministrator(user),
      isActive: user.isActive,
      mailboxCount: user._count.memberships,
      canDeleteMessages: user.accessPolicy?.canDeleteMessages === true,
      canDeleteMailboxes: user.accessPolicy?.canDeleteMailboxes === true,
      dateJoined: user.dateJoined.toISOString(),
      lastLogin: user.lastLogin ? user.lastLogin.toISOString() : null,
    })),
    totalCount,
    page,
    pageSize,
    totalPages,
    query,
  };
}

export async function getManagedUserForEdit(
  prisma: Pick<PrismaClient, "user" | "userAccessPolicy">,
  rawUserId: string,
): Promise<ManagedUserResult<ManagedUserEditRecord>> {
  const userId = parseBigIntId(rawUserId);
  if (userId === null) {
    return { ok: false, code: "not_found", error: "User not found." };
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      username: true,
      firstName: true,
      lastName: true,
      email: true,
      isActive: true,
      dateJoined: true,
      lastLogin: true,
      administratorProfile: { select: { isSuperuser: true } },
      accessPolicy: {
        select: {
          canDeleteMessages: true,
          canDeleteMailboxes: true,
        },
      },
      memberships: {
        where: { mailbox: { deletedAt: null } },
        select: { mailboxId: true },
      },
    },
  });

  if (!user) {
    return { ok: false, code: "not_found", error: "User not found." };
  }

  if (isAccountAdministrator(user)) {
    return {
      ok: false,
      code: "admin_protected",
      error: "Administrator accounts are not editable in this interface.",
    };
  }

  const policy =
    user.accessPolicy ?? (await ensureUserAccessPolicy(prisma, user.id));

  return {
    ok: true,
    data: {
      id: user.id.toString(),
      username: user.username,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      isActive: user.isActive,
      canDeleteMessages: policy.canDeleteMessages,
      canDeleteMailboxes: policy.canDeleteMailboxes,
      assignedMailboxIds: user.memberships.map((m) => m.mailboxId.toString()),
      dateJoined: user.dateJoined.toISOString(),
      lastLogin: user.lastLogin ? user.lastLogin.toISOString() : null,
    },
  };
}

export async function createManagedUser(
  prisma: PrismaClient,
  rawInput: unknown,
  auditContext: UserAuditContext,
  hashPasswordFn: (password: string) => Promise<string> = hashPassword,
): Promise<ManagedUserResult<{ id: string; username: string }>> {
  const parsed = createUserSchema.safeParse(rawInput);
  if (!parsed.success) {
    const fieldErrors = formatZodFieldErrors(parsed.error);
    return {
      ok: false,
      code: "validation",
      error: parsed.error.issues[0]?.message ?? "Review the form fields.",
      fieldErrors,
    };
  }

  const data = parsed.data;
  const mailboxIds = normalizeAssignedMailboxIds(data.assignedMailboxIds);

  try {
    const existingUsername = await prisma.user.findFirst({
      where: { username: { equals: data.username, mode: "insensitive" } },
      select: { id: true },
    });
    if (existingUsername) {
      return {
        ok: false,
        code: "validation",
        error: "A user with that username already exists.",
        fieldErrors: { username: "A user with that username already exists." },
      };
    }

    if ("adminAccount" in prisma && prisma.adminAccount) {
      const existingAdminUsername = await prisma.adminAccount.findFirst({
        where: { username: { equals: data.username, mode: "insensitive" } },
        select: { id: true },
      });
      if (existingAdminUsername) {
        return {
          ok: false,
          code: "validation",
          error: "A user with that username already exists.",
          fieldErrors: { username: "A user with that username already exists." },
        };
      }
    }

    const validMailboxes = mailboxIds.length
      ? await prisma.mailbox.findMany({
          where: { id: { in: mailboxIds }, deletedAt: null },
          select: { id: true, emailAddress: true },
        })
      : [];

    if (validMailboxes.length !== mailboxIds.length) {
      return {
        ok: false,
        code: "validation",
        error: "One or more selected mailboxes are no longer available.",
        fieldErrors: {
          assignedMailboxIds:
            "One or more selected mailboxes are no longer available.",
        },
      };
    }

    const passwordHash = await hashPasswordFn(data.password);

    const created = await prisma.$transaction(async (tx) => {
      const dbActorId = await resolveActorIdForDatabase(
        tx,
        auditContext.actorId,
        auditContext.authSource,
      );

      const user = await tx.user.create({
        data: {
          username: data.username,
          passwordHash,
          firstName: data.firstName,
          lastName: data.lastName,
          email: data.email,
          isActive: data.isActive,
          isStaff: false,
          isSuperuser: false,
          passwordResetRequired: false,
        },
        select: { id: true, username: true, isActive: true },
      });

      await tx.userAccessPolicy.create({
        data: {
          userId: user.id,
          canDeleteMessages: data.canDeleteMessages,
          canDeleteMailboxes: data.canDeleteMailboxes,
        },
      });

      if (validMailboxes.length > 0) {
        await tx.mailboxMembership.createMany({
          data: validMailboxes.map((mailbox) => ({
            userId: user.id,
            mailboxId: mailbox.id,
            assignedById: dbActorId,
          })),
          skipDuplicates: true,
        });
      }

      const auditClient = tx as unknown as AuditWriteClient;
      for (const mailbox of validMailboxes) {
        await recordAudit(auditClient, {
          actorId: dbActorId ?? auditContext.actorId,
          authSource: auditContext.authSource,
          actorUsername: auditContext.actorUsername,
          action: "mailbox_assignment_added",
          targetType: "user",
          targetIdentifier: user.username,
          headers: auditContext.headers,
          clientIp: auditContext.clientIp,
          userAgent: auditContext.userAgent,
          trustProxyHeaders: auditContext.trustProxyHeaders,
          details: { mailbox: mailbox.emailAddress },
        });
      }

      if (data.canDeleteMessages || data.canDeleteMailboxes) {
        await recordAudit(auditClient, {
          actorId: dbActorId ?? auditContext.actorId,
          authSource: auditContext.authSource,
          actorUsername: auditContext.actorUsername,
          action: "user_delete_permissions_changed",
          targetType: "user",
          targetIdentifier: user.username,
          headers: auditContext.headers,
          clientIp: auditContext.clientIp,
          userAgent: auditContext.userAgent,
          trustProxyHeaders: auditContext.trustProxyHeaders,
          details: {
            can_delete_messages: { from: false, to: data.canDeleteMessages },
            can_delete_mailboxes: { from: false, to: data.canDeleteMailboxes },
          },
        });
      }

      const assignedEmails = validMailboxes
        .map((mailbox) => mailbox.emailAddress)
        .sort();

      await recordAudit(auditClient, {
        actorId: dbActorId ?? auditContext.actorId,
        authSource: auditContext.authSource,
        actorUsername: auditContext.actorUsername,
        action: "user_created",
        targetType: "user",
        targetIdentifier: user.username,
        headers: auditContext.headers,
        clientIp: auditContext.clientIp,
        userAgent: auditContext.userAgent,
        trustProxyHeaders: auditContext.trustProxyHeaders,
        details: {
          assigned_mailboxes: assignedEmails,
          can_delete_messages: data.canDeleteMessages,
          can_delete_mailboxes: data.canDeleteMailboxes,
          active: user.isActive,
        },
      });

      return user;
    });

    return {
      ok: true,
      data: { id: created.id.toString(), username: created.username },
    };
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      return {
        ok: false,
        code: "validation",
        error: "A user with that username already exists.",
        fieldErrors: { username: "A user with that username already exists." },
      };
    }
    logger.error("managed_user_create_failed");
    return {
      ok: false,
      code: "unavailable",
      error: "Could not create user. Try again later.",
    };
  }
}

export async function updateManagedUser(
  prisma: PrismaClient,
  rawUserId: string,
  rawInput: unknown,
  auditContext: UserAuditContext,
): Promise<ManagedUserResult<{ id: string; username: string }>> {
  const userId = parseBigIntId(rawUserId);
  if (userId === null) {
    return { ok: false, code: "not_found", error: "User not found." };
  }

  const parsed = updateUserSchema.safeParse(rawInput);
  if (!parsed.success) {
    return {
      ok: false,
      code: "validation",
      error: parsed.error.issues[0]?.message ?? "Review the form fields.",
      fieldErrors: formatZodFieldErrors(parsed.error),
    };
  }

  const data = parsed.data;
  const mailboxIds = normalizeAssignedMailboxIds(data.assignedMailboxIds);

  try {
    const existingTarget = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        username: true,
        isActive: true,
        administratorProfile: { select: { isSuperuser: true } },
        accessPolicy: {
          select: {
            canDeleteMessages: true,
            canDeleteMailboxes: true,
          },
        },
        memberships: {
          where: { mailbox: { deletedAt: null } },
          select: {
            mailboxId: true,
            mailbox: { select: { emailAddress: true } },
          },
        },
      },
    });

    if (!existingTarget) {
      return { ok: false, code: "not_found", error: "User not found." };
    }

    if (isAccountAdministrator(existingTarget)) {
      return {
        ok: false,
        code: "admin_protected",
        error: "Administrator accounts are not editable in this interface.",
      };
    }

    const duplicateUsername = await prisma.user.findFirst({
      where: {
        username: { equals: data.username, mode: "insensitive" },
        id: { not: userId },
      },
      select: { id: true },
    });
    if (duplicateUsername) {
      return {
        ok: false,
        code: "validation",
        error: "A user with that username already exists.",
        fieldErrors: { username: "A user with that username already exists." },
      };
    }

    if ("adminAccount" in prisma && prisma.adminAccount) {
      const duplicateAdminUsername = await prisma.adminAccount.findFirst({
        where: {
          username: { equals: data.username, mode: "insensitive" },
        },
        select: { id: true },
      });
      if (duplicateAdminUsername) {
        return {
          ok: false,
          code: "validation",
          error: "A user with that username already exists.",
          fieldErrors: { username: "A user with that username already exists." },
        };
      }
    }

    const selectedMailboxes = mailboxIds.length
      ? await prisma.mailbox.findMany({
          where: { id: { in: mailboxIds }, deletedAt: null },
          select: { id: true, emailAddress: true },
        })
      : [];

    if (selectedMailboxes.length !== mailboxIds.length) {
      return {
        ok: false,
        code: "validation",
        error: "One or more selected mailboxes are no longer available.",
        fieldErrors: {
          assignedMailboxIds:
            "One or more selected mailboxes are no longer available.",
        },
      };
    }

    const updated = await prisma.$transaction(async (tx) => {
      const dbActorId = await resolveActorIdForDatabase(
        tx,
        auditContext.actorId,
        auditContext.authSource,
      );

      const previousPolicy = existingTarget.accessPolicy ?? {
        canDeleteMessages: false,
        canDeleteMailboxes: false,
      };
      const oldMemberships = new Map<string, string>(
        existingTarget.memberships.map((m) => [
          m.mailboxId.toString(),
          m.mailbox.emailAddress,
        ]),
      );
      const selectedIdSet = new Set(
        selectedMailboxes.map((mailbox) => mailbox.id.toString()),
      );

      const addedMailboxes = selectedMailboxes.filter(
        (mailbox) => !oldMemberships.has(mailbox.id.toString()),
      );
      const removedAddresses = Array.from(oldMemberships.entries())
        .filter(([mailboxId]) => !selectedIdSet.has(mailboxId))
        .map(([, emailAddress]) => emailAddress);

      const savedUser = await tx.user.update({
        where: { id: userId },
        data: {
          username: data.username,
          firstName: data.firstName,
          lastName: data.lastName,
          email: data.email,
          isActive: data.isActive,
        },
        select: { id: true, username: true, isActive: true },
      });

      await tx.userAccessPolicy.upsert({
        where: { userId },
        create: {
          userId,
          canDeleteMessages: data.canDeleteMessages,
          canDeleteMailboxes: data.canDeleteMailboxes,
        },
        update: {
          canDeleteMessages: data.canDeleteMessages,
          canDeleteMailboxes: data.canDeleteMailboxes,
        },
      });

      await tx.mailboxMembership.deleteMany({
        where: {
          userId,
          ...(mailboxIds.length > 0 ? { mailboxId: { notIn: mailboxIds } } : {}),
        },
      });

      if (addedMailboxes.length > 0) {
        await tx.mailboxMembership.createMany({
          data: addedMailboxes.map((mailbox) => ({
            userId,
            mailboxId: mailbox.id,
            assignedById: dbActorId,
          })),
          skipDuplicates: true,
        });
      }

      const auditClient = tx as unknown as AuditWriteClient;

      for (const mailbox of addedMailboxes) {
        await recordAudit(auditClient, {
          actorId: dbActorId ?? auditContext.actorId,
          authSource: auditContext.authSource,
          actorUsername: auditContext.actorUsername,
          action: "mailbox_assignment_added",
          targetType: "user",
          targetIdentifier: savedUser.username,
          headers: auditContext.headers,
          clientIp: auditContext.clientIp,
          userAgent: auditContext.userAgent,
          trustProxyHeaders: auditContext.trustProxyHeaders,
          details: { mailbox: mailbox.emailAddress },
        });
      }

      for (const address of removedAddresses) {
        await recordAudit(auditClient, {
          actorId: dbActorId ?? auditContext.actorId,
          authSource: auditContext.authSource,
          actorUsername: auditContext.actorUsername,
          action: "mailbox_assignment_removed",
          targetType: "user",
          targetIdentifier: savedUser.username,
          headers: auditContext.headers,
          clientIp: auditContext.clientIp,
          userAgent: auditContext.userAgent,
          trustProxyHeaders: auditContext.trustProxyHeaders,
          details: { mailbox: address },
        });
      }

      if (
        previousPolicy.canDeleteMessages !== data.canDeleteMessages ||
        previousPolicy.canDeleteMailboxes !== data.canDeleteMailboxes
      ) {
        await recordAudit(auditClient, {
          actorId: dbActorId ?? auditContext.actorId,
          authSource: auditContext.authSource,
          actorUsername: auditContext.actorUsername,
          action: "user_delete_permissions_changed",
          targetType: "user",
          targetIdentifier: savedUser.username,
          headers: auditContext.headers,
          clientIp: auditContext.clientIp,
          userAgent: auditContext.userAgent,
          trustProxyHeaders: auditContext.trustProxyHeaders,
          details: {
            can_delete_messages: {
              from: previousPolicy.canDeleteMessages,
              to: data.canDeleteMessages,
            },
            can_delete_mailboxes: {
              from: previousPolicy.canDeleteMailboxes,
              to: data.canDeleteMailboxes,
            },
          },
        });
      }

      if (existingTarget.isActive !== savedUser.isActive) {
        await recordAudit(auditClient, {
          actorId: dbActorId ?? auditContext.actorId,
          authSource: auditContext.authSource,
          actorUsername: auditContext.actorUsername,
          action: savedUser.isActive ? "user_activated" : "user_deactivated",
          targetType: "user",
          targetIdentifier: savedUser.username,
          headers: auditContext.headers,
          clientIp: auditContext.clientIp,
          userAgent: auditContext.userAgent,
          trustProxyHeaders: auditContext.trustProxyHeaders,
        });
      }

      await recordAudit(auditClient, {
        actorId: dbActorId ?? auditContext.actorId,
        authSource: auditContext.authSource,
        actorUsername: auditContext.actorUsername,
        action: "user_updated",
        targetType: "user",
        targetIdentifier: savedUser.username,
        headers: auditContext.headers,
        clientIp: auditContext.clientIp,
        userAgent: auditContext.userAgent,
        trustProxyHeaders: auditContext.trustProxyHeaders,
        details: {
          assigned_mailboxes: selectedMailboxes
            .map((mailbox) => mailbox.emailAddress)
            .sort(),
          can_delete_messages: data.canDeleteMessages,
          can_delete_mailboxes: data.canDeleteMailboxes,
          active: savedUser.isActive,
        },
      });

      return savedUser;
    });

    return {
      ok: true,
      data: { id: updated.id.toString(), username: updated.username },
    };
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      return {
        ok: false,
        code: "validation",
        error: "A user with that username already exists.",
        fieldErrors: { username: "A user with that username already exists." },
      };
    }
    logger.error("managed_user_update_failed");
    return {
      ok: false,
      code: "unavailable",
      error: "Could not update user. Try again later.",
    };
  }
}

export async function deleteManagedUser(
  prisma: PrismaClient,
  rawUserId: string,
  auditContext: UserAuditContext,
): Promise<ManagedUserResult<{ username: string }>> {
  const userId = parseBigIntId(rawUserId);
  if (userId === null) {
    return { ok: false, code: "not_found", error: "User not found." };
  }

  if (auditContext.authSource !== "admin_table" && userId === auditContext.actorId) {
    return {
      ok: false,
      code: "self_delete",
      error: "You cannot delete your current administrator account.",
    };
  }

  try {
    const target = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        username: true,
        isActive: true,
        administratorProfile: { select: { isSuperuser: true } },
      },
    });

    if (!target) {
      return { ok: false, code: "not_found", error: "User not found." };
    }

    if (isAccountAdministrator(target)) {
      const activeAdminCount = await prisma.user.count({
        where: {
          isActive: true,
          administratorProfile: { isNot: null },
        },
      });
      if (activeAdminCount <= 1) {
        return {
          ok: false,
          code: "last_admin",
          error: "The last active administrator cannot be deleted.",
        };
      }
      return {
        ok: false,
        code: "admin_protected",
        error: "Administrator accounts are not deletable in this interface.",
      };
    }

    await prisma.$transaction(async (tx) => {
      const dbActorId = await resolveActorIdForDatabase(
        tx,
        auditContext.actorId,
        auditContext.authSource,
      );

      await recordAudit(tx as unknown as AuditWriteClient, {
        actorId: dbActorId ?? auditContext.actorId,
        authSource: auditContext.authSource,
        actorUsername: auditContext.actorUsername,
        action: "user_deleted",
        targetType: "user",
        targetIdentifier: target.username,
        headers: auditContext.headers,
        clientIp: auditContext.clientIp,
        userAgent: auditContext.userAgent,
        trustProxyHeaders: auditContext.trustProxyHeaders,
        details: { mailboxes_preserved: true },
      });

      await tx.user.delete({
        where: { id: target.id },
      });
    });

    return { ok: true, data: { username: target.username } };
  } catch {
    logger.error("managed_user_delete_failed");
    return {
      ok: false,
      code: "unavailable",
      error: "Could not delete user. Try again later.",
    };
  }
}
