import { getAuthorizedAdminUser } from "@/core/auth/route-guards";
import { queueUpdateRequest } from "@/core/updates/service";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const admin = await getAuthorizedAdminUser();
  if (!admin) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  let body: { archive_url?: unknown; checksum_url?: unknown } = {};
  try {
    body = (await request.json()) as {
      archive_url?: unknown;
      checksum_url?: unknown;
    };
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON request body." },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }

  const result = await queueUpdateRequest(
    {
      archiveUrl: body.archive_url,
      checksumUrl: body.checksum_url,
    },
    {
      actorId: admin.id ? BigInt(admin.id) : null,
      headers: request.headers,
    },
  );

  if (!result.ok) {
    return NextResponse.json(
      {
        error: result.error,
        code: result.code,
        ...(result.preflight ? { preflight: result.preflight } : {}),
      },
      {
        status: result.status,
        headers: { "Cache-Control": "no-store" },
      },
    );
  }

  return NextResponse.json(result.payload, {
    status: 200,
    headers: { "Cache-Control": "no-store" },
  });
}
