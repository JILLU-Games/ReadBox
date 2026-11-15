import { env } from "@/config/env";
import { getAuthorizedAdminUser } from "@/core/auth/route-guards";
import { getPrismaClient } from "@/core/database/client";
import { verifyAllDnsRecords } from "@/core/dns/resolver";
import { getDomainByUuid } from "@/core/domains/service";
import { isValidUuid } from "@/core/mailboxes/validators";
import { NextRequest, NextResponse } from "next/server";

export async function GET(
  _request: NextRequest,
  context: { readonly params: Promise<{ uuid: string }> },
) {
  const admin = await getAuthorizedAdminUser();
  if (!admin) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const { uuid } = await context.params;
  if (!isValidUuid(uuid)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (!env.databaseUrl) {
    return NextResponse.json(
      {
        error:
          "Database is not connected in this local environment. Configure DATABASE_URL to inspect stored domain DNS status.",
      },
      { status: 503 },
    );
  }

  try {
    const domain = await getDomainByUuid(getPrismaClient(), uuid);
    if (!domain) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const result = await verifyAllDnsRecords(domain.name, {
      mailHostname: env.mailHostname,
      serverIp: env.serverIp,
      opendkimKeysRoot: env.opendkimKeysRoot,
      timeoutSeconds: env.dnsLookupTimeoutSeconds,
    });

    return NextResponse.json(
      {
        domain: domain.name,
        uuid: domain.uuid,
        ...result,
      },
      {
        status: 200,
        headers: { "Cache-Control": "no-store" },
      },
    );
  } catch {
    return NextResponse.json(
      { error: "Unable to complete DNS inspection safely right now." },
      { status: 500 },
    );
  }
}
