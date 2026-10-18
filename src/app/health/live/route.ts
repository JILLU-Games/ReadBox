import { logger } from "@/core/server/logger";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET() {
  logger.info("health_live");
  return NextResponse.json(
    { status: "live" },
    { headers: { "Cache-Control": "no-store" } },
  );
}
