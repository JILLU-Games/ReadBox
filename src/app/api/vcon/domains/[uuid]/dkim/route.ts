import { env } from "@/config/env";
import { getAuthorizedAdminUser } from "@/core/auth/route-guards";
import { getPrismaClient } from "@/core/database/client";
import { getDomainByUuid, checkDomainDns, updateDomainStatus,
  bindCloudflareZone, getBoundCloudflareZone } from "@/core/domains/service";
import { DomainAutomationError, resolveSelectedCloudflareZone } from "@/core/dns/cloudflare-auto";
import { getDkimStatus } from "@/core/dns/dkim-provision";
import { automateDomainSetup, domainSetupErrorCode } from "@/core/dns/domain-automation";
import { isValidUuid } from "@/core/mailboxes/validators";
import { NextRequest, NextResponse } from "next/server";

const noStore = { "Cache-Control": "no-store" };

async function authorizedDomain(uuid: string) {
  const user = await getAuthorizedAdminUser();
  if (!user || !isValidUuid(uuid) || !env.databaseUrl) return null;
  const domain = await getDomainByUuid(getPrismaClient(), uuid);
  return domain ? { user, domain } : null;
}

/** Reverse-proxy-aware, fail-closed origin check; never trust an arbitrary Origin. */
export function trustedDkimOrigin(request: NextRequest): boolean {
  const raw = request.headers.get("origin");
  if (!raw || request.headers.get("sec-fetch-site") === "cross-site") return false;
  let origin: URL;
  try { origin = new URL(raw); } catch { return false; }
  if (origin.pathname !== "/" || origin.search || origin.hash ||
      origin.username || origin.password) return false;
  const expected = [request.nextUrl.origin,
    process.env.PUBLIC_SITE_ORIGIN, process.env.AUTH_URL].filter(Boolean);
  if (expected.some((value) => {
    try { return new URL(value!).origin === origin.origin; } catch { return false; }
  })) return true;
  const host = request.headers.get("host");
  return env.trustProxyHeaders && origin.protocol === "https:" &&
    typeof host === "string" && /^[a-z0-9.-]+(?::[0-9]{1,5})?$/i.test(host) &&
    origin.host.toLowerCase() === host.toLowerCase();
}

export async function GET(
  _request: NextRequest,
  context: { readonly params: Promise<{ uuid: string }> },
) {
  const { uuid } = await context.params;
  const authorized = await authorizedDomain(uuid);
  if (!authorized) return NextResponse.json({ error: "Not found" }, { status: 404 });
  try {
    const status = await getDkimStatus(authorized.domain.name, env.opendkimKeysRoot);
    return NextResponse.json(status, { headers: noStore });
  } catch {
    return NextResponse.json({ error: "DKIM status is unavailable." },
      { status: 503, headers: noStore });
  }
}

export async function POST(
  request: NextRequest,
  context: { readonly params: Promise<{ uuid: string }> },
) {
  const { uuid } = await context.params;
  const authorized = await authorizedDomain(uuid);
  if (!authorized) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!trustedDkimOrigin(request)) {
    return NextResponse.json({ error: "Cross-origin DKIM changes are refused." },
      { status: 403, headers: noStore });
  }
  if (!request.headers.get("content-type")?.startsWith("application/json")) {
    return NextResponse.json({ error: "Expected JSON request." },
      { status: 415, headers: noStore });
  }
  let data: unknown;
  try { data = await request.json(); } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  if (!data || typeof data !== "object" || Array.isArray(data) ||
      Object.keys(data).some((key) => key !== "publish" && key !== "zoneId") ||
      typeof (data as { publish?: unknown }).publish !== "boolean" ||
      ("zoneId" in data && typeof (data as { zoneId?: unknown }).zoneId !== "string")) {
    return NextResponse.json({ error: "Invalid DKIM operation." },
      { status: 400, headers: noStore });
  }
  try {
    const publish = (data as { publish: boolean }).publish;
    const selectedId = (data as { zoneId?: string }).zoneId ?? "";
    if (publish) {
      const bound = getBoundCloudflareZone(authorized.domain.verificationDetails);
      if (bound && bound.id !== selectedId) {
        throw new DomainAutomationError("CLOUDFLARE_ZONE_BINDING_CONFLICT");
      }
      const zone = await resolveSelectedCloudflareZone(authorized.domain.name, selectedId);
      if (bound && bound.name !== zone.name) {
        throw new DomainAutomationError("CLOUDFLARE_ZONE_BINDING_CONFLICT");
      }
      try {
        await bindCloudflareZone(getPrismaClient(), uuid, { id: zone.id, name: zone.name });
      } catch {
        throw new DomainAutomationError("CLOUDFLARE_ZONE_BINDING_CONFLICT");
      }
    }
    const result = await automateDomainSetup(authorized.domain.name, {
      publish,
      ...(publish ? { zoneId: selectedId } : {}),
      opendkimKeysRoot: env.opendkimKeysRoot,
      mailHostname: env.mailHostname,
      serverIp: env.serverIp,
    });
    let routing: "verified" | "pending" | "manual" = "manual";
    if ((data as { publish: boolean }).publish) {
      const context = {
        actorId: authorized.user.id,
        authSource: authorized.user.authSource,
        actorUsername: authorized.user.username,
        headers: request.headers,
        trustProxyHeaders: env.trustProxyHeaders,
      };
      const checked = await checkDomainDns(
        getPrismaClient(), uuid,
        { mailHostname: env.mailHostname, serverIp: env.serverIp,
          timeoutSeconds: env.dnsLookupTimeoutSeconds }, context,
      );
      if (checked.ok && checked.data.verified) {
        const enabled = await updateDomainStatus(
          getPrismaClient(), uuid, { status: "active" }, context,
        );
        routing = enabled.ok ? "verified" : "pending";
      } else {
        routing = "pending";
      }
    }
    return NextResponse.json({ ok: true, ...result, routing }, { headers: noStore });
  } catch (error) {
    const code = domainSetupErrorCode(error);
    return NextResponse.json({ ok: false, code }, {
      status: code.includes("CONFLICT") ? 409 : 503, headers: noStore,
    });
  }
}
