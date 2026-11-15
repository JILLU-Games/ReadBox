import { env } from "@/config/env";
import {
  formatPublicSiteSettingsJson,
  getSiteSettings,
  resolvePublicSiteCorsHeaders,
} from "@/core/settings/service";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const baseOrigin = request.nextUrl.origin;
  const settings = await getSiteSettings({ baseOrigin });
  const corsHeaders = resolvePublicSiteCorsHeaders(
    request.headers.get("Origin"),
    env.publicSiteOrigin,
  );

  return NextResponse.json(formatPublicSiteSettingsJson(settings), {
    status: 200,
    headers: {
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
      ...corsHeaders,
    },
  });
}
