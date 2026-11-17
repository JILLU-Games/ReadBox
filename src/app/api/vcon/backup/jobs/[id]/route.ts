import { getAuthorizedAdminUser } from "@/core/auth/route-guards";
import { getBackupJob } from "@/core/backup/agent-client";
import { isBackupOpaqueId } from "@/core/backup/validation";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "no-store" };

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  if (!(await getAuthorizedAdminUser())) {
    return NextResponse.json({ error: "Not found" }, { status: 404, headers });
  }
  const { id } = await context.params;
  if (!isBackupOpaqueId(id)) {
    return NextResponse.json({ error: "Invalid job" }, { status: 400, headers });
  }
  try {
    const job = await getBackupJob(id);
    if (!job) return NextResponse.json({ error: "Not found" }, { status: 404, headers });
    return NextResponse.json({ job }, { status: 200, headers });
  } catch {
    return NextResponse.json(
      { error: "Backup service unavailable" },
      { status: 503, headers },
    );
  }
}
