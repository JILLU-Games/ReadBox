import { handlers } from "@/auth";
import { env } from "@/config/env";
import { resolveAuthRequestUrl } from "@/core/auth/proxy-request";
import { NextRequest } from "next/server";

export const runtime = "nodejs";

function withProxyRequest(req: NextRequest): NextRequest {
  const rewrittenUrl = resolveAuthRequestUrl(req.url, req.headers, {
    trustForwardedHeaders: env.nodeEnv !== "production" || env.authTrustHost,
    authUrl: process.env.AUTH_URL ?? process.env.NEXTAUTH_URL,
    nodeEnv: env.nodeEnv,
  });

  if (rewrittenUrl === req.url) {
    return req;
  }

  return new NextRequest(rewrittenUrl, req);
}

export async function GET(req: NextRequest) {
  return handlers.GET(withProxyRequest(req));
}

export async function POST(req: NextRequest) {
  return handlers.POST(withProxyRequest(req));
}