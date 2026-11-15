import { getAuthorizedAdminUser } from "@/core/auth/route-guards";
import { readUpdateStatus } from "@/core/updates/service";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const admin = await getAuthorizedAdminUser();
  if (!admin) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const status = await readUpdateStatus();
  return NextResponse.json(status, {
    status: 200,
    headers: { "Cache-Control": "no-store" },
  });
}
