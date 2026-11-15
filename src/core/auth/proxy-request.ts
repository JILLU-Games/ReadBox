const SAFE_HOST_PATTERN =
  /^(?:\[[0-9a-fA-F:]+\]|[a-zA-Z0-9.-]+)(?::\d{1,5})?$/;

function firstHeaderValue(value: string | null): string | null {
  if (!value) return null;
  const first = value.split(",")[0]?.trim();
  return first || null;
}

function isWildcardHost(host: string): boolean {
  const hostname = host.replace(/:\d+$/, "").toLowerCase();
  return hostname === "0.0.0.0" || hostname === "::" || hostname === "[::]";
}

function isKnownHttpsPreviewHost(host: string | null): boolean {
  if (!host) return false;
  const hostname = host.replace(/:\d+$/, "").toLowerCase();
  return (
    hostname.endsWith(".run.app") ||
    hostname.endsWith(".googleusercontent.com")
  );
}

export function isHttpsProxyRequest(
  headers: Pick<Headers, "get"> | undefined,
  rawUrl: string | undefined,
  nodeEnv: "development" | "test" | "production",
): boolean {
  if (rawUrl?.startsWith("https://")) {
    return true;
  }

  if (!headers) {
    return false;
  }

  const forwardedProto = firstHeaderValue(
    headers.get("x-forwarded-proto"),
  )?.toLowerCase();
  if (forwardedProto === "https") {
    return true;
  }

  const forwardedHeader = headers.get("forwarded")?.toLowerCase();
  if (forwardedHeader && /\bproto=https\b/.test(forwardedHeader)) {
    return true;
  }

  if (
    headers.get("x-forwarded-ssl")?.toLowerCase() === "on" ||
    firstHeaderValue(headers.get("x-forwarded-scheme"))?.toLowerCase() ===
      "https"
  ) {
    return true;
  }

  if (nodeEnv === "development") {
    const origin = headers.get("origin")?.toLowerCase();
    const referer = headers.get("referer")?.toLowerCase();
    if (origin?.startsWith("https://") || referer?.startsWith("https://")) {
      return true;
    }

    const forwardedHost = firstHeaderValue(headers.get("x-forwarded-host"));
    const host = firstHeaderValue(headers.get("host"));
    if (
      isKnownHttpsPreviewHost(forwardedHost) ||
      isKnownHttpsPreviewHost(host)
    ) {
      return true;
    }

    const cookieHeader = headers.get("cookie") ?? "";
    if (
      cookieHeader.includes("__SECURE-") ||
      cookieHeader.includes("__Host-")
    ) {
      return true;
    }

    if (headers.get("sec-fetch-site")?.toLowerCase() === "cross-site") {
      return true;
    }
  }

  return false;
}

export function resolveAuthRequestUrl(
  rawUrl: string,
  headers: Pick<Headers, "get">,
  options: {
    readonly trustForwardedHeaders: boolean;
    readonly authUrl?: string;
    readonly nodeEnv?: "development" | "test" | "production";
  },
): string {
  if (options.authUrl || !options.trustForwardedHeaders) {
    return rawUrl;
  }

  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return rawUrl;
  }

  const forwardedHost =
    firstHeaderValue(headers.get("x-forwarded-host")) ??
    firstHeaderValue(headers.get("host"));
  const host =
    forwardedHost &&
    SAFE_HOST_PATTERN.test(forwardedHost) &&
    !isWildcardHost(forwardedHost)
      ? forwardedHost
      : parsed.host;

  const forwardedProto = firstHeaderValue(
    headers.get("x-forwarded-proto"),
  )?.toLowerCase();
  const isHttps =
    forwardedProto === "https" ||
    isHttpsProxyRequest(
      headers,
      rawUrl,
      options.nodeEnv ?? "production",
    );
  const protocol = isHttps
    ? "https:"
    : forwardedProto === "http"
      ? "http:"
      : parsed.protocol;

  const targetOrigin = `${protocol}//${host}`;
  if (targetOrigin === parsed.origin) {
    return rawUrl;
  }

  return `${targetOrigin}${parsed.pathname}${parsed.search}`;
}
