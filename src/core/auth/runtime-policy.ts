export type DevAuthMode = "off" | "bypass" | "demo";

export interface AuthRuntimeConfiguration {
  readonly nodeEnv: "development" | "test" | "production";
  readonly authEnabled: boolean;
  readonly hasAuthSecret: boolean;
  readonly hasDatabaseUrl?: boolean;
  readonly devAuthMode?: DevAuthMode;
}

export function getAuthRuntimeConfigurationError(
  configuration: AuthRuntimeConfiguration,
): string | null {
  const devAuthMode = configuration.devAuthMode ?? "off";

  if (configuration.nodeEnv === "production" && devAuthMode !== "off") {
    return "Development authentication modes are forbidden in production";
  }

  if (configuration.authEnabled && !configuration.hasAuthSecret) {
    return "AUTH_SECRET is required when authentication is enabled";
  }

  if (
    configuration.nodeEnv === "production" &&
    configuration.authEnabled &&
    !configuration.hasDatabaseUrl
  ) {
    return "DATABASE_URL is required when authentication is enabled in production";
  }

  return null;
}

export interface AuthCookiePolicy {
  readonly sameSite: "lax" | "none";
  readonly secure: boolean;
  readonly partitioned: boolean;
  readonly sessionCookieName: string;
  readonly callbackCookieName: string;
  readonly csrfCookieName: string;
}

export function getAuthCookiePolicy(configuration: {
  readonly nodeEnv: "development" | "test" | "production";
  readonly isHttpsRequest: boolean;
}): AuthCookiePolicy {
  const isProduction = configuration.nodeEnv === "production";
  const useCrossSiteIframeCookies =
    configuration.nodeEnv === "development" && configuration.isHttpsRequest;

  return {
    sameSite: useCrossSiteIframeCookies ? "none" : "lax",
    secure: isProduction || useCrossSiteIframeCookies,
    partitioned: useCrossSiteIframeCookies,
    sessionCookieName: isProduction
      ? "__Secure-authjs.session-token"
      : "authjs.session-token",
    callbackCookieName: isProduction
      ? "__Secure-authjs.callback-url"
      : "authjs.callback-url",
    csrfCookieName: isProduction
      ? "__Host-authjs.csrf-token"
      : "authjs.csrf-token",
  };
}
