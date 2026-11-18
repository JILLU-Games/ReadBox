"use server";

import { env } from "@/config/env";
import { requireAdminUser } from "@/core/auth/route-guards";
import { getPrismaClient } from "@/core/database/client";
import type { RoutingVerificationResult } from "@/core/dns/resolver";
import { automateDomainSetup, domainSetupErrorCode } from "@/core/dns/domain-automation";
import {
  checkDomainDns,
  createDomain,
  deleteDomain,
  setDefaultDomain,
  toggleDomainStatus,
  updateDomainStatus,
  type DomainActionResult,
  type DomainPrismaClient,
} from "@/core/domains/service";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";

function databaseUnavailableResult(): DomainActionResult<never> {
  return {
    ok: false,
    code: "unavailable",
    error:
      "Database is not connected in this local environment. Configure DATABASE_URL to manage persistent domains.",
  };
}

function revalidateDomainPaths(uuid?: string) {
  revalidatePath("/vcon/domains");
  if (uuid) {
    revalidatePath(`/vcon/domains/${uuid}/edit`);
  }
  revalidatePath("/vcon/mailboxes");
  revalidatePath("/vcon");
  revalidatePath("/vcon/audit");
}

export async function createDomainAction(input: {
  readonly name: string;
  readonly dnsConfirmed: boolean;
  readonly autoDkim?: boolean;
}): Promise<DomainActionResult<{ uuid: string; name: string }>> {
  const actor = await requireAdminUser();
  if (!env.databaseUrl) {
    return databaseUnavailableResult();
  }

  const requestHeaders = await headers();
  const result = await createDomain(
    getPrismaClient() as unknown as DomainPrismaClient,
    { name: input.name, dnsConfirmed: input.dnsConfirmed || input.autoDkim === true },
    {
      actorId: actor.id,
      authSource: actor.authSource,
      actorUsername: actor.username,
      headers: requestHeaders,
      trustProxyHeaders: env.trustProxyHeaders,
    },
  );

  if (result.ok) {
    revalidateDomainPaths(result.data.uuid);
    if (input.autoDkim === true) {
      try {
        const setup = await automateDomainSetup(result.data.name, {
          publish: true,
          opendkimKeysRoot: env.opendkimKeysRoot,
          mailHostname: env.mailHostname,
          serverIp: env.serverIp,
        });
        const context = {
          actorId: actor.id,
          authSource: actor.authSource,
          actorUsername: actor.username,
          headers: requestHeaders,
          trustProxyHeaders: env.trustProxyHeaders,
        };
        const checked = await checkDomainDns(
          getPrismaClient() as unknown as DomainPrismaClient,
          result.data.uuid,
          { mailHostname: env.mailHostname, serverIp: env.serverIp,
            timeoutSeconds: env.dnsLookupTimeoutSeconds }, context,
        );
        if (checked.ok && checked.data.verified) {
          const enabled = await updateDomainStatus(
            getPrismaClient() as unknown as DomainPrismaClient,
            result.data.uuid, { status: "active" }, context,
          );
          if (enabled.ok) return { ...result, message:
            "Domain added, DKIM escrow verified, Cloudflare DNS configured and mail routing activated." };
        }
        return { ...result, message:
          "Domain added and DNS configured (zone: " + setup.zone +
          "). Routing propagation is pending. Recheck DNS on this page." };
      } catch (error) {
        // Domain creation must not be repeated after an external partial success.
        return { ...result, message:
          "Domain saved disabled. Automatic setup paused: " +
          domainSetupErrorCode(error) + ". Use Provision / Repair to safely resume." };
      }
    }
  }

  return result;
}

export async function updateDomainStatusAction(
  uuid: string,
  input: { readonly status: "active" | "disabled"; readonly submittedName?: string },
): Promise<DomainActionResult<{ uuid: string; status: string }>> {
  const actor = await requireAdminUser();
  if (!env.databaseUrl) {
    return databaseUnavailableResult();
  }

  const requestHeaders = await headers();
  const result = await updateDomainStatus(
    getPrismaClient() as unknown as DomainPrismaClient,
    uuid,
    input,
    {
      actorId: actor.id,
      authSource: actor.authSource,
      actorUsername: actor.username,
      headers: requestHeaders,
      trustProxyHeaders: env.trustProxyHeaders,
    },
  );

  if (result.ok) {
    revalidateDomainPaths(uuid);
  }

  return result;
}

export async function checkDomainDnsAction(
  uuid: string,
): Promise<DomainActionResult<RoutingVerificationResult>> {
  const actor = await requireAdminUser();
  if (!env.databaseUrl) {
    return databaseUnavailableResult();
  }

  const requestHeaders = await headers();
  const result = await checkDomainDns(
    getPrismaClient() as unknown as DomainPrismaClient,
    uuid,
    {
      mailHostname: env.mailHostname,
      serverIp: env.serverIp,
      timeoutSeconds: env.dnsLookupTimeoutSeconds,
    },
    {
      actorId: actor.id,
      authSource: actor.authSource,
      actorUsername: actor.username,
      headers: requestHeaders,
      trustProxyHeaders: env.trustProxyHeaders,
    },
  );

  revalidateDomainPaths(uuid);
  return result;
}

export async function toggleDomainStatusAction(
  uuid: string,
): Promise<DomainActionResult<{ uuid: string; status: string }>> {
  const actor = await requireAdminUser();
  if (!env.databaseUrl) {
    return databaseUnavailableResult();
  }

  const requestHeaders = await headers();
  const result = await toggleDomainStatus(
    getPrismaClient() as unknown as DomainPrismaClient,
    uuid,
    {
      actorId: actor.id,
      authSource: actor.authSource,
      actorUsername: actor.username,
      headers: requestHeaders,
      trustProxyHeaders: env.trustProxyHeaders,
    },
  );

  if (result.ok) {
    revalidateDomainPaths(uuid);
  }

  return result;
}

export async function setDefaultDomainAction(
  uuid: string,
): Promise<DomainActionResult<{ uuid: string; name: string }>> {
  const actor = await requireAdminUser();
  if (!env.databaseUrl) {
    return databaseUnavailableResult();
  }

  const requestHeaders = await headers();
  const result = await setDefaultDomain(
    getPrismaClient() as unknown as DomainPrismaClient,
    uuid,
    {
      actorId: actor.id,
      authSource: actor.authSource,
      actorUsername: actor.username,
      headers: requestHeaders,
      trustProxyHeaders: env.trustProxyHeaders,
    },
  );

  if (result.ok) {
    revalidateDomainPaths(uuid);
  }

  return result;
}

export async function deleteDomainAction(
  uuid: string,
): Promise<DomainActionResult<{ name: string }>> {
  const actor = await requireAdminUser();
  if (!env.databaseUrl) {
    return databaseUnavailableResult();
  }

  const requestHeaders = await headers();
  const result = await deleteDomain(
    getPrismaClient() as unknown as DomainPrismaClient,
    uuid,
    env.mailDomain,
    {
      actorId: actor.id,
      authSource: actor.authSource,
      actorUsername: actor.username,
      headers: requestHeaders,
      trustProxyHeaders: env.trustProxyHeaders,
    },
  );

  if (result.ok) {
    revalidateDomainPaths();
  }

  return result;
}
