import { recordAudit } from "@/core/audit/record";
import type { AuditWriteClient } from "@/core/audit/types";
import {
  verifyRoutingDns,
  type DnsLookupPort,
  type RoutingVerificationResult,
} from "@/core/dns/resolver";
import {
  isValidUuid,
  MailValidationError,
  normalizeDomain,
  validateDomain,
} from "@/core/mailboxes/validators";
import {
  createPrismaSqlExecutor,
  deleteMailserverDomain,
  ensureMailserverDomain,
  MailServerContractError,
  setMailserverDomainActive,
  type PrismaRawQueryable,
  type SqlQueryExecutor,
} from "@/core/mailserver/pg-adapter";
import { logger } from "@/core/server/logger";
import type { Prisma, PrismaClient } from "@prisma/client";
import type { CloudflareZoneChoice } from "@/core/dns/cloudflare-auto";
import "server-only";

export type DomainPrismaClient = PrismaClient & PrismaRawQueryable;

export interface DomainAuditContext {
  readonly actorId: bigint;
  readonly authSource?: "admin_table" | "user_table";
  readonly actorUsername?: string;
  readonly headers?: Pick<Headers, "get">;
  readonly clientIp?: string | null;
  readonly userAgent?: string | null;
  readonly trustProxyHeaders?: boolean;
}

export interface ManagedDomainItem {
  readonly id: string;
  readonly uuid: string;
  readonly name: string;
  readonly status: string;
  readonly verificationStatus: string;
  readonly isDefault: boolean;
  readonly lastCheckedAt: string | null;
  readonly mailboxCount: number;
  readonly totalMailboxCount: number;
  readonly verificationDetails: Record<string, unknown>;
}

export type DomainActionResult<T = unknown> =
  | { readonly ok: true; readonly data: T; readonly message?: string }
  | {
      readonly ok: false;
      readonly code:
        | "validation"
        | "not_found"
        | "conflict"
        | "blocked"
        | "mailserver"
        | "unavailable";
      readonly error: string;
      readonly fieldErrors?: Record<string, string>;
    };

function isUniqueConstraintError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === "P2002"
  );
}

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

function toJsonDetails(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
}

export async function listDomains(
  prisma: Pick<PrismaClient, "domain" | "mailbox">,
  options: { readonly query?: string } = {},
): Promise<readonly ManagedDomainItem[]> {
  const query = (options.query ?? "").trim();
  const where = query
    ? {
        OR: [
          { name: { contains: query, mode: "insensitive" as const } },
          { status: { contains: query, mode: "insensitive" as const } },
          {
            verificationStatus: {
              contains: query,
              mode: "insensitive" as const,
            },
          },
        ],
      }
    : {};

  const domains = await prisma.domain.findMany({
    where,
    orderBy: [{ isDefault: "desc" }, { name: "asc" }],
    include: {
      _count: {
        select: { mailboxes: true },
      },
      mailboxes: {
        where: { deletedAt: null },
        select: { id: true },
      },
    },
  });

  return domains.map((domain) => ({
    id: domain.id.toString(),
    uuid: domain.uuid,
    name: domain.name,
    status: domain.status,
    verificationStatus: domain.verificationStatus,
    isDefault: domain.isDefault,
    lastCheckedAt: domain.lastCheckedAt
      ? domain.lastCheckedAt.toISOString()
      : null,
    mailboxCount: domain.mailboxes.length,
    totalMailboxCount: domain._count.mailboxes,
    verificationDetails: toJsonDetails(domain.verificationDetails),
  }));
}

export async function getDomainByUuid(
  prisma: Pick<PrismaClient, "domain">,
  uuid: string,
): Promise<ManagedDomainItem | null> {
  if (!isValidUuid(uuid)) return null;
  const domain = await prisma.domain.findUnique({
    where: { uuid: uuid.trim() },
    include: {
      _count: {
        select: { mailboxes: true },
      },
      mailboxes: {
        where: { deletedAt: null },
        select: { id: true },
      },
    },
  });
  if (!domain) return null;

  return {
    id: domain.id.toString(),
    uuid: domain.uuid,
    name: domain.name,
    status: domain.status,
    verificationStatus: domain.verificationStatus,
    isDefault: domain.isDefault,
    lastCheckedAt: domain.lastCheckedAt
      ? domain.lastCheckedAt.toISOString()
      : null,
    mailboxCount: domain.mailboxes.length,
    totalMailboxCount: domain._count.mailboxes,
    verificationDetails: toJsonDetails(domain.verificationDetails),
  };
}

/** Bound zone IDs are stored in the existing Domain.verificationDetails JSON.
 * A different selected zone never silently replaces the original binding.
 */
export function getBoundCloudflareZone(details: Record<string, unknown>): CloudflareZoneChoice | null {
  const raw = details.cloudflareZone;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const value = raw as Record<string, unknown>;
  if (typeof value.id !== "string" || !/^[a-f0-9]{32}$/i.test(value.id) ||
      typeof value.name !== "string") return null;
  return { id: value.id, name: value.name };
}

/** Optimistic compare-and-swap prevents a concurrent DNS check erasing zone binding. */
export async function bindCloudflareZone(
  db: Pick<PrismaClient, "domain">,
  uuid: string,
  zone: CloudflareZoneChoice,
): Promise<void> {
  if (!isValidUuid(uuid) || !/^[a-f0-9]{32}$/i.test(zone.id) ||
      validateDomain(zone.name) !== zone.name) {
    throw new Error("CLOUDFLARE_ZONE_MISMATCH");
  }
  const domain = await db.domain.findUnique({
    where: { uuid },
    select: { verificationDetails: true },
  });
  if (!domain) throw new Error("CLOUDFLARE_DOMAIN_NOT_FOUND");
  const details = toJsonDetails(domain.verificationDetails);
  const current = getBoundCloudflareZone(details);
  if (current) {
    if (current.id === zone.id && current.name === zone.name) return;
    throw new Error("CLOUDFLARE_ZONE_BINDING_CONFLICT");
  }
  if ("cloudflareZone" in details) throw new Error("CLOUDFLARE_ZONE_BINDING_CONFLICT");
  const result = await db.domain.updateMany({
    where: { uuid, verificationDetails: { equals: details as Prisma.InputJsonValue } },
    data: { verificationDetails: { ...details, cloudflareZone: zone } },
  });
  if (result.count !== 1) throw new Error("CLOUDFLARE_ZONE_BINDING_CONFLICT");
}

export async function createDomain(
  prisma: DomainPrismaClient,
  input: { readonly name: string; readonly dnsConfirmed: boolean;
    readonly cloudflareZone?: CloudflareZoneChoice },
  ctx: DomainAuditContext,
  sqlExecutor: SqlQueryExecutor = createPrismaSqlExecutor(prisma),
): Promise<DomainActionResult<{ uuid: string; name: string }>> {
  if (!input.dnsConfirmed) {
    return {
      ok: false,
      code: "validation",
      error:
        "Confirm that all DNS records have been reviewed before saving the domain.",
      fieldErrors: {
        dnsConfirmed:
          "Confirm that all DNS records have been reviewed before saving the domain.",
      },
    };
  }

  let normalizedName: string;
  try {
    normalizedName = validateDomain(input.name);
  } catch (error) {
    const message =
      error instanceof MailValidationError
        ? error.message
        : "Enter a valid DNS domain name.";
    return {
      ok: false,
      code: "validation",
      error: message,
      fieldErrors: { name: message },
    };
  }

  let createdMailserverRow = false;
  try {
    const existing = await prisma.domain.findFirst({
      where: { name: { equals: normalizedName, mode: "insensitive" } },
      select: { id: true },
    });
    if (existing) {
      return {
        ok: false,
        code: "conflict",
        error: "A domain with this name already exists.",
        fieldErrors: { name: "A domain with this name already exists." },
      };
    }

    const ensured = await ensureMailserverDomain(sqlExecutor, {
      domainName: normalizedName,
      active: false,
    });
    createdMailserverRow = ensured.created;

    const created = await prisma.domain.create({
      data: {
        name: normalizedName,
        status: "disabled",
        verificationStatus: "pending",
        isDefault: false,
        verificationDetails: input.cloudflareZone ?
          { cloudflareZone: input.cloudflareZone } : {},
      },
      select: { uuid: true, name: true },
    });

    const resolvedActorId = await resolveActorIdForDatabase(
      prisma,
      ctx.actorId,
      ctx.authSource,
    );
    await recordAudit(prisma as unknown as AuditWriteClient, {
      actorId: resolvedActorId ?? ctx.actorId,
      authSource: ctx.authSource,
      actorUsername: ctx.actorUsername,
      action: "domain_create",
      targetType: "domain",
      targetIdentifier: created.name,
      headers: ctx.headers,
      clientIp: ctx.clientIp,
      userAgent: ctx.userAgent,
      trustProxyHeaders: ctx.trustProxyHeaders,
      details: { status: "disabled", verification_status: "pending" },
    });

    return {
      ok: true,
      data: { uuid: created.uuid, name: created.name },
      message: `Domain ${created.name} added. DNS records are ready to publish.`,
    };
  } catch (error) {
    if (createdMailserverRow) {
      try {
        await deleteMailserverDomain(sqlExecutor, {
          domainName: normalizedName,
        });
      } catch {
        logger.error("domain_create_mailserver_cleanup_failed", {
          domain: normalizedName,
        });
      }
    }

    if (isUniqueConstraintError(error)) {
      return {
        ok: false,
        code: "conflict",
        error: "A domain with this name already exists.",
        fieldErrors: { name: "A domain with this name already exists." },
      };
    }

    if (error instanceof MailServerContractError) {
      return {
        ok: false,
        code: "mailserver",
        error: "The domain could not be reconciled with the mail server.",
      };
    }

    logger.error("domain_create_failed", { domain: normalizedName });
    return {
      ok: false,
      code: "unavailable",
      error: "Unable to save domain right now.",
    };
  }
}

export async function updateDomainStatus(
  prisma: DomainPrismaClient,
  uuid: string,
  input: { readonly status: "active" | "disabled"; readonly submittedName?: string },
  ctx: DomainAuditContext,
  sqlExecutor: SqlQueryExecutor = createPrismaSqlExecutor(prisma),
): Promise<DomainActionResult<{ uuid: string; status: string }>> {
  if (!isValidUuid(uuid)) {
    return { ok: false, code: "not_found", error: "Domain not found." };
  }

  try {
    const domain = await prisma.domain.findUnique({
      where: { uuid: uuid.trim() },
      select: {
        id: true,
        uuid: true,
        name: true,
        status: true,
        verificationStatus: true,
      },
    });
    if (!domain) {
      return { ok: false, code: "not_found", error: "Domain not found." };
    }

    if (
      input.submittedName !== undefined &&
      normalizeDomain(input.submittedName) !== domain.name
    ) {
      return {
        ok: false,
        code: "validation",
        error:
          "Domain names cannot be changed after creation; add a new domain instead.",
        fieldErrors: {
          name: "Domain names cannot be changed after creation.",
        },
      };
    }

    if (
      input.status === "active" &&
      domain.verificationStatus !== "verified"
    ) {
      return {
        ok: false,
        code: "blocked",
        error: "A domain must pass DNS verification before it can be enabled.",
        fieldErrors: {
          status:
            "A domain must pass DNS verification before it can be enabled.",
        },
      };
    }

    const previousStatus = domain.status;
    await prisma.domain.update({
      where: { id: domain.id },
      data: { status: input.status },
    });

    try {
      await ensureMailserverDomain(sqlExecutor, {
        domainName: domain.name,
        active:
          input.status === "active" && domain.verificationStatus === "verified",
      });
    } catch {
      await prisma.domain.update({
        where: { id: domain.id },
        data: { status: previousStatus },
      });
      return {
        ok: false,
        code: "mailserver",
        error: "The domain could not be reconciled with the mail server.",
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
      action: "domain_update",
      targetType: "domain",
      targetIdentifier: domain.name,
      headers: ctx.headers,
      clientIp: ctx.clientIp,
      userAgent: ctx.userAgent,
      trustProxyHeaders: ctx.trustProxyHeaders,
      details: { from: previousStatus, to: input.status },
    });

    return {
      ok: true,
      data: { uuid: domain.uuid, status: input.status },
      message: `Domain ${domain.name} updated.`,
    };
  } catch {
    logger.error("domain_update_failed");
    return {
      ok: false,
      code: "unavailable",
      error: "Unable to update domain right now.",
    };
  }
}

export async function checkDomainDns(
  prisma: DomainPrismaClient,
  uuid: string,
  dnsOptions: {
    readonly mailHostname: string;
    readonly serverIp: string;
    readonly timeoutSeconds?: number;
    readonly lookup?: DnsLookupPort;
  },
  ctx: DomainAuditContext,
  sqlExecutor: SqlQueryExecutor = createPrismaSqlExecutor(prisma),
): Promise<DomainActionResult<RoutingVerificationResult>> {
  if (!isValidUuid(uuid)) {
    return { ok: false, code: "not_found", error: "Domain not found." };
  }

  try {
    const domain = await prisma.domain.findUnique({
      where: { uuid: uuid.trim() },
      select: { id: true, uuid: true, name: true, status: true,
        verificationDetails: true },
    });
    if (!domain) {
      return { ok: false, code: "not_found", error: "Domain not found." };
    }

    const result = await verifyRoutingDns(domain.name, {
      mailHostname: dnsOptions.mailHostname,
      expectedServerIp: dnsOptions.serverIp,
      timeoutSeconds: dnsOptions.timeoutSeconds,
      lookup: dnsOptions.lookup,
    });

    if (!result.verified) {
      try {
        await setMailserverDomainActive(sqlExecutor, {
          domainName: domain.name,
          active: false,
        });
      } catch {
        logger.error("domain_check_disable_mailserver_failed", {
          domain: domain.name,
        });
      }
    }

    await prisma.domain.update({
      where: { id: domain.id },
      data: {
        verificationStatus: result.verified ? "verified" : "failed",
        lastCheckedAt: new Date(),
        verificationDetails: {
          ...toJsonDetails(domain.verificationDetails),
          mx: [...result.mx],
          target: result.target,
          targetAddresses: [...result.targetAddresses],
          mxOk: result.mxOk,
          targetOk: result.targetOk,
          message: result.message,
          ...(result.errorCode ? { errorCode: result.errorCode } : {}),
        },
        ...(result.verified ? {} : { status: "disabled" }),
      },
    });

    const resolvedActorId = await resolveActorIdForDatabase(
      prisma,
      ctx.actorId,
      ctx.authSource,
    );
    await recordAudit(prisma as unknown as AuditWriteClient, {
      actorId: resolvedActorId ?? ctx.actorId,
      authSource: ctx.authSource,
      actorUsername: ctx.actorUsername,
      action: "domain_dns_check",
      targetType: "domain",
      targetIdentifier: domain.name,
      headers: ctx.headers,
      clientIp: ctx.clientIp,
      userAgent: ctx.userAgent,
      trustProxyHeaders: ctx.trustProxyHeaders,
      details: {
        verified: result.verified,
        mx_ok: result.mxOk,
        target_ok: result.targetOk,
        auto_disabled: !result.verified && domain.status === "active",
      },
    });

    return {
      ok: true,
      data: result,
      message: result.message,
    };
  } catch {
    logger.error("domain_check_failed");
    return {
      ok: false,
      code: "unavailable",
      error: "Unable to check domain DNS right now.",
    };
  }
}

export async function toggleDomainStatus(
  prisma: DomainPrismaClient,
  uuid: string,
  ctx: DomainAuditContext,
  sqlExecutor: SqlQueryExecutor = createPrismaSqlExecutor(prisma),
): Promise<DomainActionResult<{ uuid: string; status: string }>> {
  if (!isValidUuid(uuid)) {
    return { ok: false, code: "not_found", error: "Domain not found." };
  }

  try {
    const domain = await prisma.domain.findUnique({
      where: { uuid: uuid.trim() },
      select: {
        id: true,
        uuid: true,
        name: true,
        status: true,
        verificationStatus: true,
      },
    });
    if (!domain) {
      return { ok: false, code: "not_found", error: "Domain not found." };
    }

    const targetStatus = domain.status === "active" ? "disabled" : "active";
    if (
      targetStatus === "active" &&
      domain.verificationStatus !== "verified"
    ) {
      return {
        ok: false,
        code: "blocked",
        error: "A domain must pass DNS verification before it can be enabled.",
      };
    }

    await setMailserverDomainActive(sqlExecutor, {
      domainName: domain.name,
      active: targetStatus === "active",
    });

    await prisma.domain.update({
      where: { id: domain.id },
      data: { status: targetStatus },
    });

    const resolvedActorId = await resolveActorIdForDatabase(
      prisma,
      ctx.actorId,
      ctx.authSource,
    );
    await recordAudit(prisma as unknown as AuditWriteClient, {
      actorId: resolvedActorId ?? ctx.actorId,
      authSource: ctx.authSource,
      actorUsername: ctx.actorUsername,
      action: targetStatus === "active" ? "domain_enable" : "domain_disable",
      targetType: "domain",
      targetIdentifier: domain.name,
      headers: ctx.headers,
      clientIp: ctx.clientIp,
      userAgent: ctx.userAgent,
      trustProxyHeaders: ctx.trustProxyHeaders,
      details: { status: targetStatus },
    });

    return {
      ok: true,
      data: { uuid: domain.uuid, status: targetStatus },
      message: `Domain ${domain.name} ${targetStatus}.`,
    };
  } catch (error) {
    if (error instanceof MailServerContractError) {
      return { ok: false, code: "mailserver", error: error.message };
    }
    logger.error("domain_toggle_failed");
    return {
      ok: false,
      code: "unavailable",
      error: "Unable to update domain status right now.",
    };
  }
}

export async function setDefaultDomain(
  prisma: DomainPrismaClient,
  uuid: string,
  ctx: DomainAuditContext,
): Promise<DomainActionResult<{ uuid: string; name: string }>> {
  if (!isValidUuid(uuid)) {
    return { ok: false, code: "not_found", error: "Domain not found." };
  }

  try {
    const domain = await prisma.domain.findUnique({
      where: { uuid: uuid.trim() },
      select: {
        id: true,
        uuid: true,
        name: true,
        status: true,
        verificationStatus: true,
      },
    });
    if (!domain) {
      return { ok: false, code: "not_found", error: "Domain not found." };
    }

    if (
      domain.status !== "active" ||
      domain.verificationStatus !== "verified"
    ) {
      return {
        ok: false,
        code: "blocked",
        error: "Only an active, DNS-verified domain can be made default.",
      };
    }

    await prisma.$transaction([
      prisma.domain.updateMany({
        where: { isDefault: true },
        data: { isDefault: false },
      }),
      prisma.domain.update({
        where: { id: domain.id },
        data: { isDefault: true },
      }),
    ]);

    const resolvedActorId = await resolveActorIdForDatabase(
      prisma,
      ctx.actorId,
      ctx.authSource,
    );
    await recordAudit(prisma as unknown as AuditWriteClient, {
      actorId: resolvedActorId ?? ctx.actorId,
      authSource: ctx.authSource,
      actorUsername: ctx.actorUsername,
      action: "domain_set_default",
      targetType: "domain",
      targetIdentifier: domain.name,
      headers: ctx.headers,
      clientIp: ctx.clientIp,
      userAgent: ctx.userAgent,
      trustProxyHeaders: ctx.trustProxyHeaders,
      details: {},
    });

    return {
      ok: true,
      data: { uuid: domain.uuid, name: domain.name },
      message: `${domain.name} is now the default domain.`,
    };
  } catch {
    logger.error("domain_set_default_failed");
    return {
      ok: false,
      code: "unavailable",
      error: "Unable to set default domain right now.",
    };
  }
}

export async function deleteDomain(
  prisma: DomainPrismaClient,
  uuid: string,
  configuredMailDomain: string,
  ctx: DomainAuditContext,
  sqlExecutor: SqlQueryExecutor = createPrismaSqlExecutor(prisma),
): Promise<DomainActionResult<{ name: string }>> {
  if (!isValidUuid(uuid)) {
    return { ok: false, code: "not_found", error: "Domain not found." };
  }

  try {
    const domain = await prisma.domain.findUnique({
      where: { uuid: uuid.trim() },
      select: { id: true, name: true, isDefault: true },
    });
    if (!domain) {
      return { ok: false, code: "not_found", error: "Domain not found." };
    }

    if (
      domain.isDefault ||
      normalizeDomain(domain.name) === normalizeDomain(configuredMailDomain)
    ) {
      return {
        ok: false,
        code: "blocked",
        error: "The configured default domain cannot be removed.",
      };
    }

    const mailboxCount = await prisma.mailbox.count({
      where: { domainId: domain.id },
    });
    if (mailboxCount > 0) {
      return {
        ok: false,
        code: "blocked",
        error:
          "A domain with mailboxes cannot be removed; disable it instead.",
      };
    }

    await deleteMailserverDomain(sqlExecutor, { domainName: domain.name });
    await prisma.domain.delete({ where: { id: domain.id } });

    const resolvedActorId = await resolveActorIdForDatabase(
      prisma,
      ctx.actorId,
      ctx.authSource,
    );
    await recordAudit(prisma as unknown as AuditWriteClient, {
      actorId: resolvedActorId ?? ctx.actorId,
      authSource: ctx.authSource,
      actorUsername: ctx.actorUsername,
      action: "domain_delete",
      targetType: "domain",
      targetIdentifier: domain.name,
      headers: ctx.headers,
      clientIp: ctx.clientIp,
      userAgent: ctx.userAgent,
      trustProxyHeaders: ctx.trustProxyHeaders,
      details: {},
    });

    return {
      ok: true,
      data: { name: domain.name },
      message: `Domain ${domain.name} removed.`,
    };
  } catch (error) {
    if (error instanceof MailServerContractError) {
      return { ok: false, code: "mailserver", error: error.message };
    }
    logger.error("domain_delete_failed");
    return {
      ok: false,
      code: "unavailable",
      error: "Unable to delete domain right now.",
    };
  }
}
