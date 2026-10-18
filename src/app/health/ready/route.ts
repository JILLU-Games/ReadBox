import { getReadinessSnapshot } from "@/core/health/snapshot";
import { logger } from "@/core/server/logger";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const snapshot = await getReadinessSnapshot();
  logger.info("health_ready", { status: snapshot.status });
  return NextResponse.json(snapshot, {
    status: snapshot.status === "ready" ? 200 : 503,
    headers: { "Cache-Control": "no-store" },
  });
}
