export interface AuthRuntimeConfiguration {
  readonly nodeEnv: "development" | "test" | "production";
  readonly authEnabled: boolean;
  readonly hasAuthSecret: boolean;
}

export function getAuthRuntimeConfigurationError(
  configuration: AuthRuntimeConfiguration,
): string | null {
  if (
    configuration.authEnabled &&
    configuration.nodeEnv !== "development" &&
    configuration.nodeEnv !== "test"
  ) {
    return "This authentication foundation is restricted to local development";
  }

  if (configuration.authEnabled && !configuration.hasAuthSecret) {
    return "AUTH_SECRET is required when authentication is enabled";
  }

  return null;
}
