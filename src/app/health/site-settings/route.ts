import { GET as getSiteSettingsRoute } from "@/app/api/site-settings/route";
import type { NextRequest } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  return getSiteSettingsRoute(request);
}
