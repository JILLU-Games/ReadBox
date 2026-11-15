import { readConfinedSiteMedia } from "@/core/settings/service";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _request: NextRequest,
  context: { readonly params: Promise<{ path: string[] }> },
) {
  const { path } = await context.params;
  if (!Array.isArray(path) || path.length === 0) {
    return new NextResponse("Not Found", {
      status: 404,
      headers: {
        "X-Content-Type-Options": "nosniff",
        "Cache-Control": "private, no-store",
      },
    });
  }

  const asset = await readConfinedSiteMedia(path);
  if (!asset) {
    return new NextResponse("Not Found", {
      status: 404,
      headers: {
        "X-Content-Type-Options": "nosniff",
        "Cache-Control": "private, no-store",
      },
    });
  }

  return new NextResponse(new Uint8Array(asset.buffer), {
    status: 200,
    headers: {
      "Content-Type": asset.contentType,
      "Content-Length": String(asset.buffer.byteLength),
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy":
        "default-src 'none'; img-src 'self' data:; style-src 'unsafe-inline'; sandbox",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
