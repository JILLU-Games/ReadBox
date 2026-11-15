import { env } from "@/config/env";
import { getAuthorizedAdminUser } from "@/core/auth/route-guards";
import { getExpectedDnsRecordsForDomain } from "@/core/dns/resolver";
import { MailValidationError } from "@/core/mailboxes/validators";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const admin = await getAuthorizedAdminUser();
  if (!admin) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const domainParam = request.nextUrl.searchParams.get("domain") ?? "";
  try {
    const records = await getExpectedDnsRecordsForDomain(domainParam, {
      mailHostname: env.mailHostname,
      serverIp: env.serverIp,
      opendkimKeysRoot: env.opendkimKeysRoot,
    });

    return NextResponse.json(
      {
        domain: domainParam.trim().replace(/\.+$/, "").toLowerCase(),
        mailHostname: env.mailHostname,
        serverIp: env.serverIp,
        records,
      },
      {
        status: 200,
        headers: { "Cache-Control": "no-store" },
      },
    );
  } catch (error) {
    const message =
      error instanceof MailValidationError
        ? error.message
        : "Enter a valid domain name before previewing DNS records.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
