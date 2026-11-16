import { recordAudit } from "@/core/audit/record";
import type { AuditWriteClient } from "@/core/audit/types";
import { buildMailboxPaths, PathConfinementError } from "@/core/mailboxes/paths";
import {
  createMaildirTree,
  ProvisioningError,
  removeConfinedMailboxDirectory,
  removeConfinedStoredAttachment,
  rollbackCreatedMaildirPaths,
  withProvisionLock,
  type ProvisionLockOptions,
} from "@/core/mailboxes/provisioning";
import {
  isValidUuid,
  MailValidationError,
  SYSTEM_MAILBOX_LOCAL_PARTS,
  validateLocalPart,
  type SystemMailboxLocalPart,
} from "@/core/mailboxes/validators";
import {
  createMailserverMailbox,
  createPrismaSqlExecutor,
  deleteMailserverMailbox,
  mailserverMailboxExists,
  MailServerContractError,
  setMailserverMailboxActive,
  type PrismaRawQueryable,
  type SqlQueryExecutor,
} from "@/core/mailserver/pg-adapter";
import { logger } from "@/core/server/logger";
import type { PrismaClient } from "@prisma/client";
import "server-only";

export type MailboxPrismaClient = PrismaClient & PrismaRawQueryable;

export interface MailboxAuditContext {
  readonly actorId: bigint;
  readonly authSource?: "admin_table" | "user_table";
  readonly actorUsername?: string;
  readonly headers?: Pick<Headers, "get">;
  readonly clientIp?: string | null;
  readonly userAgent?: string | null;
  readonly trustProxyHeaders?: boolean;
}

export interface MailboxRuntimeConfig {
  readonly mailDomain: string;
  readonly mailStorageRoot: string;
  readonly attachmentStorageRoot: string;
  readonly mailboxProvisionLockRoot: string;
  readonly defaultQuotaBytes: number;
}

export interface AdminMailboxListItem {
  readonly id: string;
  readonly uuid: string;
  readonly localPart: string;
  readonly emailAddress: string;
  readonly domainUuid: string;
  readonly domainName: string;
  readonly status: string;
  readonly maildirRelativePath: string;
  readonly totalMessages: string;
  readonly unreadMessages: string;
  readonly lastReceivedAt: string | null;
  readonly createdAt: string;
  readonly assignedUserCount: number;
  readonly assignedUsernames: readonly string[];
}

export interface AdminMailboxListResult {
  readonly items: readonly AdminMailboxListItem[];
  readonly totalCount: number;
  readonly page: number;
  readonly pageSize: number;
  readonly totalPages: number;
  readonly query: string;
  readonly statusFilter: "all" | "active" | "disabled";
  readonly domainUuidFilter: string;
  readonly availableDomains: readonly {
    readonly uuid: string;
    readonly name: string;
  }[];
}

export interface MailboxCreationDomainOption {
  readonly id: string;
  readonly uuid: string;
  readonly name: string;
  readonly isDefault: boolean;
}

export interface MailboxCreationUserOption {
  readonly id: string;
  readonly username: string;
  readonly email: string;
}

export interface MailboxCreationOptions {
  readonly domains: readonly MailboxCreationDomainOption[];
  readonly users: readonly MailboxCreationUserOption[];
}

export interface MailboxPurgePreview {
  readonly uuid: string;
  readonly emailAddress: string;
  readonly domainName: string;
  readonly status: string;
  readonly totalMessages: string;
  readonly unreadMessages: string;
  readonly assignedUserCount: number;
}

export type MailboxActionResult<T = unknown> =
  | { readonly ok: true; readonly data: T; readonly message?: string }
  | {
      readonly ok: false;
      readonly code:
        | "validation"
        | "not_found"
        | "conflict"
        | "blocked"
        | "lock"
        | "filesystem"
        | "mailserver"
        | "unavailable";
      readonly error: string;
      readonly fieldErrors?: Record<string, string>;
    };

async function resolveActorIdForDatabase(
  db: Pick<PrismaClient, "user">,
  actorId: bigint,
  authSource?: "admin_table" | "user_table",
): Promise<bigint | null> {
  if (authSource === "admin_table") return null;
  if (actorId <= BigInt(0)) return null;
  const user = await db.user.findUnique({
    where: { id: actorId },
    select: { id: true },
  });
  return user?.id ?? null;
}

function normalizeAssignedUserIds(rawIds: readonly string[] | undefined): bigint[] {
  if (!rawIds?.length) return [];
  const unique = new Set<string>();
  const parsed: bigint[] = [];
  for (const raw of rawIds) {
    const trimmed = raw.trim();
    if (!/^[1-9]\d*$/.test(trimmed) || unique.has(trimmed)) continue;
    unique.add(trimmed);
    parsed.push(BigInt(trimmed));
  }
  return parsed;
}

export async function listMailboxesForAdmin(
  prisma: Pick<PrismaClient, "mailbox" | "domain">,
  options: {
    readonly query?: string;
    readonly status?: string;
    readonly domainUuid?: string;
    readonly page?: number;
    readonly pageSize?: number;
  } = {},
): Promise<AdminMailboxListResult> {
  const query = (options.query ?? "").trim();
  const statusFilter: "all" | "active" | "disabled" =
    options.status === "active" || options.status === "disabled"
      ? options.status
      : "all";
  const domainUuidFilter =
    options.domainUuid && isValidUuid(options.domainUuid)
      ? options.domainUuid.trim()
      : "";
  const pageSize = Math.max(1, Math.min(100, options.pageSize ?? 25));
  const requestedPage = Number.isFinite(options.page)
    ? Math.max(1, Math.floor(options.page ?? 1))
    : 1;

  const where = {
    deletedAt: null,
    ...(statusFilter !== "all" ? { status: statusFilter } : {}),
    ...(domainUuidFilter ? { domain: { uuid: domainUuidFilter } } : {}),
    ...(query
      ? {
          OR: [
            { localPart: { contains: query, mode: "insensitive" as const } },
            { emailAddress: { contains: query, mode: "insensitive" as const } },
          ],
        }
      : {}),
  };

  const [totalCount, domains] = await Promise.all([
    prisma.mailbox.count({ where }),
    prisma.domain.findMany({
      orderBy: [{ isDefault: "desc" }, { name: "asc" }],
      select: { uuid: true, name: true },
    }),
  ]);

  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const page = Math.min(requestedPage, totalPages);

  const rows = await prisma.mailbox.findMany({
    where,
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    skip: (page - 1) * pageSize,
    take: pageSize,
    select: {
      id: true,
      uuid: true,
      localPart: true,
      emailAddress: true,
      status: true,
      maildirRelativePath: true,
      totalMessages: true,
      unreadMessages: true,
      lastReceivedAt: true,
      createdAt: true,
      domain: { select: { uuid: true, name: true } },
      memberships: {
        orderBy: [{ user: { username: "asc" } }],
        select: { user: { select: { username: true } } },
      },
    },
  });

  return {
    items: rows.map((row) => ({
      id: row.id.toString(),
      uuid: row.uuid,
      localPart: row.localPart,
      emailAddress: row.emailAddress,
      domainUuid: row.domain.uuid,
      domainName: row.domain.name,
      status: row.status,
      maildirRelativePath: row.maildirRelativePath,
      totalMessages: row.totalMessages.toString(),
      unreadMessages: row.unreadMessages.toString(),
      lastReceivedAt: row.lastReceivedAt
        ? row.lastReceivedAt.toISOString()
        : null,
      createdAt: row.createdAt.toISOString(),
      assignedUserCount: row.memberships.length,
      assignedUsernames: row.memberships.map((m) => m.user.username),
    })),
    totalCount,
    page,
    pageSize,
    totalPages,
    query,
    statusFilter,
    domainUuidFilter,
    availableDomains: domains,
  };
}

export async function listMailboxCreationOptions(
  prisma: Pick<PrismaClient, "domain" | "user">,
): Promise<MailboxCreationOptions> {
  const [domains, users] = await Promise.all([
    prisma.domain.findMany({
      where: { status: "active", verificationStatus: "verified" },
      orderBy: [{ isDefault: "desc" }, { name: "asc" }],
      select: { id: true, uuid: true, name: true, isDefault: true },
    }),
    prisma.user.findMany({
      where: {
        isActive: true,
        administratorProfile: null,
      },
      orderBy: [{ username: "asc" }],
      select: { id: true, username: true, email: true },
    }),
  ]);

  return {
    domains: domains.map((d) => ({
      id: d.id.toString(),
      uuid: d.uuid,
      name: d.name,
      isDefault: d.isDefault,
    })),
    users: users.map((u) => ({
      id: u.id.toString(),
      username: u.username,
      email: u.email,
    })),
  };
}

export async function getMailboxForPurge(
  prisma: Pick<PrismaClient, "mailbox">,
  uuid: string,
): Promise<MailboxPurgePreview | null> {
  if (!isValidUuid(uuid)) return null;
  const mailbox = await prisma.mailbox.findFirst({
    where: { uuid: uuid.trim(), deletedAt: null },
    select: {
      uuid: true,
      emailAddress: true,
      status: true,
      totalMessages: true,
      unreadMessages: true,
      domain: { select: { name: true } },
      _count: { select: { memberships: true } },
    },
  });
  if (!mailbox) return null;

  return {
    uuid: mailbox.uuid,
    emailAddress: mailbox.emailAddress,
    domainName: mailbox.domain.name,
    status: mailbox.status,
    totalMessages: mailbox.totalMessages.toString(),
    unreadMessages: mailbox.unreadMessages.toString(),
    assignedUserCount: mailbox._count.memberships,
  };
}

export async function provisionMailbox(
  prisma: MailboxPrismaClient,
  input: {
    readonly localPart: string;
    readonly domainUuid?: string;
    readonly assignedUserIds?: readonly string[];
    readonly allowReserved?: boolean;
  },
  config: MailboxRuntimeConfig,
  ctx: MailboxAuditContext,
  options: {
    readonly sqlExecutor?: SqlQueryExecutor;
    readonly lockOptions?: ProvisionLockOptions;
  } = {},
): Promise<
  MailboxActionResult<{ uuid: string; emailAddress: string; localPart: string }>
> {
  const allowReserved = input.allowReserved === true;
  let normalizedLocal: string;
  try {
    normalizedLocal = validateLocalPart(input.localPart, { allowReserved });
  } catch (error) {
    const message =
      error instanceof MailValidationError
        ? error.message
        : "Enter a valid mailbox local part.";
    return {
      ok: false,
      code: "validation",
      error: message,
      fieldErrors: { localPart: message },
    };
  }

  let domain: {
    id: bigint;
    uuid: string;
    name: string;
    status: string;
    verificationStatus: string;
  } | null = null;

  try {
    if (input.domainUuid) {
      if (!isValidUuid(input.domainUuid)) {
        return {
          ok: false,
          code: "validation",
          error: "Select a valid active, DNS-verified domain.",
          fieldErrors: { domainUuid: "Select a valid domain." },
        };
      }
      domain = await prisma.domain.findUnique({
        where: { uuid: input.domainUuid.trim() },
        select: {
          id: true,
          uuid: true,
          name: true,
          status: true,
          verificationStatus: true,
        },
      });
    } else {
      domain =
        (await prisma.domain.findFirst({
          where: { isDefault: true },
          select: {
            id: true,
            uuid: true,
            name: true,
            status: true,
            verificationStatus: true,
          },
        })) ??
        (await prisma.domain.findFirst({
          where: { name: config.mailDomain.toLowerCase() },
          select: {
            id: true,
            uuid: true,
            name: true,
            status: true,
            verificationStatus: true,
          },
        }));
    }
  } catch {
    return {
      ok: false,
      code: "unavailable",
      error: "Unable to query domains right now.",
    };
  }

  if (!domain) {
    return {
      ok: false,
      code: "validation",
      error: "No active, DNS-verified domain is available for provisioning.",
      fieldErrors: { domainUuid: "Select an active, DNS-verified domain." },
    };
  }

  if (
    domain.status !== "active" ||
    domain.verificationStatus !== "verified"
  ) {
    return {
      ok: false,
      code: "blocked",
      error: "Mailbox provisioning requires an active, DNS-verified domain.",
      fieldErrors: {
        domainUuid: "Selected domain must be active and DNS-verified.",
      },
    };
  }

  const sqlExecutor = options.sqlExecutor ?? createPrismaSqlExecutor(prisma);
  const resolvedActorId = await resolveActorIdForDatabase(
    prisma,
    ctx.actorId,
    ctx.authSource,
  );
  const lockKey =
    domain.name === config.mailDomain.toLowerCase()
      ? normalizedLocal
      : `${domain.name}-${normalizedLocal}`;

  try {
    return await withProvisionLock(
      config.mailboxProvisionLockRoot,
      lockKey,
      async () => {
        const pathBundle = buildMailboxPaths(
          normalizedLocal,
          domain.name,
          config.mailStorageRoot,
          { allowReserved },
        );
        const emailAddress = `${pathBundle.localPart}@${pathBundle.domainName}`;

        const [appExists, remoteExists] = await Promise.all([
          prisma.mailbox.findFirst({
            where: {
              OR: [
                {
                  domainId: domain.id,
                  localPart: {
                    equals: pathBundle.localPart,
                    mode: "insensitive",
                  },
                },
                {
                  emailAddress: {
                    equals: emailAddress,
                    mode: "insensitive",
                  },
                },
              ],
            },
            select: { id: true },
          }),
          mailserverMailboxExists(sqlExecutor, {
            email: emailAddress,
            domainName: domain.name,
          }),
        ]);

        if (appExists || remoteExists) {
          return {
            ok: false,
            code: "conflict",
            error: `Mailbox ${emailAddress} already exists or is permanently reserved.`,
            fieldErrors: {
              localPart: `Mailbox ${emailAddress} already exists or is reserved.`,
            },
          };
        }

        let createdPaths: string[] = [];
        try {
          const tree = await createMaildirTree({
            mailStorageRoot: config.mailStorageRoot,
            domainName: pathBundle.domainName,
            localPart: pathBundle.localPart,
          });
          createdPaths = tree.createdPaths;
        } catch (error) {
          await recordAudit(prisma as unknown as AuditWriteClient, {
            actorId: resolvedActorId ?? ctx.actorId,
            authSource: ctx.authSource,
            actorUsername: ctx.actorUsername,
            action: "mailbox_provisioning_failure",
            targetType: "mailbox",
            targetIdentifier: emailAddress,
            headers: ctx.headers,
            clientIp: ctx.clientIp,
            userAgent: ctx.userAgent,
            trustProxyHeaders: ctx.trustProxyHeaders,
            details: {
              stage: "filesystem",
              error_type:
                error instanceof Error ? error.name : "FilesystemError",
            },
          });
          return {
            ok: false,
            code: "filesystem",
            error: "Unable to create the mailbox filesystem safely.",
          };
        }

        let remoteMailboxCreated = false;
        const requestedUserIds = normalizeAssignedUserIds(
          input.assignedUserIds,
        );

        try {
          const validUsers =
            requestedUserIds.length > 0
              ? await prisma.user.findMany({
                  where: {
                    id: { in: requestedUserIds },
                    isActive: true,
                    administratorProfile: null,
                  },
                  select: { id: true },
                })
              : [];
          const validUserIds = validUsers.map((user) => user.id);

          await createMailserverMailbox(sqlExecutor, {
            localPart: pathBundle.localPart,
            email: emailAddress,
            maildir: pathBundle.relativePath,
            domainName: pathBundle.domainName,
            quotaBytes: config.defaultQuotaBytes,
          });
          remoteMailboxCreated = true;

          const created = await prisma.$transaction(async (tx) => {
            const mailbox = await tx.mailbox.create({
              data: {
                domainId: domain.id,
                localPart: pathBundle.localPart,
                emailAddress,
                status: "active",
                maildirRelativePath: pathBundle.relativePath,
              },
              select: { id: true, uuid: true, emailAddress: true, localPart: true },
            });

            if (validUserIds.length > 0) {
              await tx.mailboxMembership.createMany({
                data: validUserIds.map((userId) => ({
                  userId,
                  mailboxId: mailbox.id,
                  assignedById: resolvedActorId,
                })),
                skipDuplicates: true,
              });
            }

            return mailbox;
          });

          await recordAudit(prisma as unknown as AuditWriteClient, {
            actorId: resolvedActorId ?? ctx.actorId,
            authSource: ctx.authSource,
            actorUsername: ctx.actorUsername,
            action: "mailbox_create",
            targetType: "mailbox",
            targetIdentifier: created.emailAddress,
            headers: ctx.headers,
            clientIp: ctx.clientIp,
            userAgent: ctx.userAgent,
            trustProxyHeaders: ctx.trustProxyHeaders,
            details: {
              assigned_user_ids: validUserIds.map((id) => id.toString()),
              system_mailbox: allowReserved,
            },
          });

          return {
            ok: true,
            data: {
              uuid: created.uuid,
              emailAddress: created.emailAddress,
              localPart: created.localPart,
            },
            message: `Mailbox ${created.emailAddress} created.`,
          };
        } catch (error) {
          if (remoteMailboxCreated) {
            try {
              await deleteMailserverMailbox(sqlExecutor, {
                email: emailAddress,
              });
            } catch {
              logger.error("mailbox_remote_rollback_failed", {
                emailAddress,
              });
            }
          }
          await rollbackCreatedMaildirPaths(createdPaths);

          await recordAudit(prisma as unknown as AuditWriteClient, {
            actorId: resolvedActorId ?? ctx.actorId,
            authSource: ctx.authSource,
            actorUsername: ctx.actorUsername,
            action: "mailbox_provisioning_failure",
            targetType: "mailbox",
            targetIdentifier: emailAddress,
            headers: ctx.headers,
            clientIp: ctx.clientIp,
            userAgent: ctx.userAgent,
            trustProxyHeaders: ctx.trustProxyHeaders,
            details: {
              stage: "database",
              error_type:
                error instanceof Error ? error.name : "DatabaseError",
            },
          });

          if (error instanceof MailServerContractError) {
            return {
              ok: false,
              code: "mailserver",
              error: error.message,
            };
          }

          return {
            ok: false,
            code: "unavailable",
            error: "Unable to create the mailbox database record.",
          };
        }
      },
      options.lockOptions,
    );
  } catch (error) {
    if (error instanceof ProvisioningError) {
      await recordAudit(prisma as unknown as AuditWriteClient, {
        actorId: resolvedActorId ?? ctx.actorId,
        authSource: ctx.authSource,
        actorUsername: ctx.actorUsername,
        action: "mailbox_provisioning_failure",
        targetType: "mailbox",
        targetIdentifier: `${normalizedLocal}@${domain.name}`,
        headers: ctx.headers,
        clientIp: ctx.clientIp,
        userAgent: ctx.userAgent,
        trustProxyHeaders: ctx.trustProxyHeaders,
        details: {
          stage: error.stage,
          error_type: error.name,
        },
      });
      return {
        ok: false,
        code: error.stage === "lock" ? "lock" : "filesystem",
        error: error.message,
      };
    }

    if (error instanceof PathConfinementError) {
      return {
        ok: false,
        code: "filesystem",
        error: error.message,
      };
    }

    return {
      ok: false,
      code: "unavailable",
      error: "Unable to provision mailbox right now.",
    };
  }
}

export async function setMailboxActive(
  prisma: MailboxPrismaClient,
  mailboxUuid: string,
  active: boolean,
  ctx: MailboxAuditContext,
  sqlExecutor: SqlQueryExecutor = createPrismaSqlExecutor(prisma),
): Promise<MailboxActionResult<{ uuid: string; status: string }>> {
  if (!isValidUuid(mailboxUuid)) {
    return { ok: false, code: "not_found", error: "Mailbox not found." };
  }

  try {
    const mailbox = await prisma.mailbox.findUnique({
      where: { uuid: mailboxUuid.trim() },
      select: {
        id: true,
        uuid: true,
        emailAddress: true,
        status: true,
        deletedAt: true,
      },
    });
    if (!mailbox) {
      return { ok: false, code: "not_found", error: "Mailbox not found." };
    }
    if (mailbox.deletedAt !== null || mailbox.status === "deleted") {
      return {
        ok: false,
        code: "blocked",
        error: "Deleted mailboxes cannot be enabled or disabled.",
      };
    }

    const targetStatus = active ? "active" : "disabled";
    const previousActive = mailbox.status === "active";

    await setMailserverMailboxActive(sqlExecutor, {
      email: mailbox.emailAddress,
      active,
    });

    try {
      await prisma.mailbox.update({
        where: { id: mailbox.id },
        data: { status: targetStatus },
      });
    } catch {
      try {
        await setMailserverMailboxActive(sqlExecutor, {
          email: mailbox.emailAddress,
          active: previousActive,
        });
      } catch {
        logger.error("mailbox_status_rollback_failed", {
          emailAddress: mailbox.emailAddress,
        });
      }
      return {
        ok: false,
        code: "unavailable",
        error: "Unable to update mailbox status safely.",
      };
    }

    const resolvedActorId = await resolveActorIdForDatabase(
      prisma,
      ctx.actorId,
      ctx.authSource,
    );
    await recordAudit(prisma as unknown as AuditWriteClient, {
      actorId: resolvedActorId ?? ctx.actorId,
      authSource: ctx.authSource,
      actorUsername: ctx.actorUsername,
      action: active ? "mailbox_enable" : "mailbox_disable",
      targetType: "mailbox",
      targetIdentifier: mailbox.emailAddress,
      headers: ctx.headers,
      clientIp: ctx.clientIp,
      userAgent: ctx.userAgent,
      trustProxyHeaders: ctx.trustProxyHeaders,
      details: { status: targetStatus },
    });

    return {
      ok: true,
      data: { uuid: mailbox.uuid, status: targetStatus },
      message: active ? "Mailbox enabled." : "Mailbox disabled.",
    };
  } catch (error) {
    if (error instanceof MailServerContractError) {
      return { ok: false, code: "mailserver", error: error.message };
    }
    return {
      ok: false,
      code: "unavailable",
      error: "Unable to update mailbox status safely.",
    };
  }
}

async function executeMailboxPurge(
  prisma: MailboxPrismaClient,
  mailbox: {
    readonly id: bigint;
    readonly uuid: string;
    readonly localPart: string;
    readonly emailAddress: string;
    readonly domain: { readonly name: string };
  },
  config: Pick<
    MailboxRuntimeConfig,
    "mailStorageRoot" | "attachmentStorageRoot"
  >,
  ctx: MailboxAuditContext,
  sqlExecutor: SqlQueryExecutor,
): Promise<MailboxActionResult<{ emailAddress: string }>> {
  const pathBundle = buildMailboxPaths(
    mailbox.localPart,
    mailbox.domain.name,
    config.mailStorageRoot,
    { allowReserved: true },
  );

  const attachments = await prisma.attachment.findMany({
    where: { message: { mailboxId: mailbox.id } },
    select: { storageRelativePath: true },
  });

  try {
    await deleteMailserverMailbox(sqlExecutor, {
      email: mailbox.emailAddress,
    });
  } catch (error) {
    if (error instanceof MailServerContractError) {
      logger.warn("mailbox_remote_purge_missing", {
        emailAddress: mailbox.emailAddress,
      });
    } else {
      throw error;
    }
  }

  await prisma.mailbox.delete({
    where: { id: mailbox.id },
  });

  let attachmentFailures = 0;
  for (const attachment of attachments) {
    const ok = await removeConfinedStoredAttachment(
      config.attachmentStorageRoot,
      attachment.storageRelativePath,
    );
    if (!ok) attachmentFailures += 1;
  }

  const maildirDeleted = await removeConfinedMailboxDirectory(
    config.mailStorageRoot,
    pathBundle.domainName,
    pathBundle.localPart,
  );

  const resolvedActorId = await resolveActorIdForDatabase(
    prisma,
    ctx.actorId,
    ctx.authSource,
  );
  await recordAudit(prisma as unknown as AuditWriteClient, {
    actorId: resolvedActorId ?? ctx.actorId,
    authSource: ctx.authSource,
    actorUsername: ctx.actorUsername,
    action: "mailbox_purged",
    targetType: "mailbox",
    targetIdentifier: mailbox.emailAddress,
    headers: ctx.headers,
    clientIp: ctx.clientIp,
    userAgent: ctx.userAgent,
    trustProxyHeaders: ctx.trustProxyHeaders,
    details: {
      storage_deleted: attachmentFailures === 0,
      attachment_count: attachments.length,
      maildir_deleted: maildirDeleted,
    },
  });

  return {
    ok: true,
    data: { emailAddress: mailbox.emailAddress },
    message: `Mailbox ${mailbox.emailAddress} permanently deleted.`,
  };
}

export async function purgeMailbox(
  prisma: MailboxPrismaClient,
  mailboxUuid: string,
  confirmationEmail: string,
  config: Pick<
    MailboxRuntimeConfig,
    "mailStorageRoot" | "attachmentStorageRoot"
  >,
  ctx: MailboxAuditContext,
  sqlExecutor: SqlQueryExecutor = createPrismaSqlExecutor(prisma),
): Promise<MailboxActionResult<{ emailAddress: string }>> {
  if (!isValidUuid(mailboxUuid)) {
    return { ok: false, code: "not_found", error: "Mailbox not found." };
  }

  try {
    const mailbox = await prisma.mailbox.findFirst({
      where: { uuid: mailboxUuid.trim(), deletedAt: null },
      select: {
        id: true,
        uuid: true,
        localPart: true,
        emailAddress: true,
        domain: { select: { name: true } },
      },
    });
    if (!mailbox) {
      return { ok: false, code: "not_found", error: "Mailbox not found." };
    }

    if (
      confirmationEmail.trim().toLowerCase() !==
      mailbox.emailAddress.toLowerCase()
    ) {
      return {
        ok: false,
        code: "validation",
        error: "Type the full mailbox address to confirm permanent deletion.",
        fieldErrors: {
          confirmation:
            "Confirmation does not match the full mailbox address.",
        },
      };
    }

    return await executeMailboxPurge(
      prisma,
      mailbox,
      config,
      ctx,
      sqlExecutor,
    );
  } catch {
    logger.error("mailbox_purge_failed");
    return {
      ok: false,
      code: "unavailable",
      error: "Unable to purge mailbox database records.",
    };
  }
}

export async function bulkPurgeMailboxes(
  prisma: MailboxPrismaClient,
  mailboxUuids: readonly string[],
  confirmed: boolean,
  config: Pick<
    MailboxRuntimeConfig,
    "mailStorageRoot" | "attachmentStorageRoot"
  >,
  ctx: MailboxAuditContext,
  sqlExecutor: SqlQueryExecutor = createPrismaSqlExecutor(prisma),
): Promise<MailboxActionResult<{ purgedCount: number; purgedEmails: string[] }>> {
  if (!confirmed) {
    return {
      ok: false,
      code: "validation",
      error: "Explicit confirmation is required before bulk purging mailboxes.",
    };
  }

  const validUuids = Array.from(
    new Set(mailboxUuids.map((u) => u.trim()).filter(isValidUuid)),
  );
  if (validUuids.length === 0) {
    return {
      ok: false,
      code: "validation",
      error: "Select at least one mailbox to permanently delete.",
    };
  }

  try {
    const targets = await prisma.mailbox.findMany({
      where: { uuid: { in: validUuids }, deletedAt: null },
      select: {
        id: true,
        uuid: true,
        localPart: true,
        emailAddress: true,
        domain: { select: { name: true } },
      },
    });

    const purgedEmails: string[] = [];
    for (const target of targets) {
      const result = await executeMailboxPurge(
        prisma,
        target,
        config,
        ctx,
        sqlExecutor,
      );
      if (result.ok) {
        purgedEmails.push(result.data.emailAddress);
      }
    }

    return {
      ok: true,
      data: {
        purgedCount: purgedEmails.length,
        purgedEmails,
      },
      message: `${purgedEmails.length} mailbox${purgedEmails.length === 1 ? "" : "es"} permanently deleted.`,
    };
  } catch {
    logger.error("mailbox_bulk_purge_failed");
    return {
      ok: false,
      code: "unavailable",
      error: "Unable to complete bulk mailbox deletion right now.",
    };
  }
}

export async function createSystemMailbox(
  prisma: MailboxPrismaClient,
  input: {
    readonly localPart: SystemMailboxLocalPart;
    readonly domainUuid?: string;
    readonly confirm: boolean;
  },
  config: MailboxRuntimeConfig,
  ctx: MailboxAuditContext,
  options: {
    readonly sqlExecutor?: SqlQueryExecutor;
    readonly lockOptions?: ProvisionLockOptions;
  } = {},
): Promise<
  MailboxActionResult<{ uuid: string; emailAddress: string; localPart: string }>
> {
  if (!SYSTEM_MAILBOX_LOCAL_PARTS.includes(input.localPart)) {
    return {
      ok: false,
      code: "validation",
      error: "System mailbox local part must be postmaster or abuse.",
    };
  }
  if (!input.confirm) {
    return {
      ok: false,
      code: "validation",
      error:
        "Confirm creation before provisioning a reserved system mailbox.",
    };
  }

  return provisionMailbox(
    prisma,
    {
      localPart: input.localPart,
      domainUuid: input.domainUuid,
      allowReserved: true,
      assignedUserIds: [],
    },
    config,
    ctx,
    options,
  );
}
