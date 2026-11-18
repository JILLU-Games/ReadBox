import { getAuthorizedAdminUser } from "@/core/auth/route-guards";
import { DomainAutomationError, listCloudflareZones } from "@/core/dns/cloudflare-auto";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
const noStore = { "Cache-Control": "no-store" };

export async function GET() {
  const actor = await getAuthorizedAdminUser();
  if (!actor) return NextResponse.json({ error: "Not found" },
    { status: 404, headers: noStore });
  try {
    const zones = await listCloudflareZones();
    return NextResponse.json({ zones }, { headers: noStore });
  } catch (error) {
    const code = error instanceof DomainAutomationError ?
      error.code : "CLOUDFLARE_UNAVAILABLE";
    return NextResponse.json({ error: code },
      { status: 503, headers: noStore });
  }
}
