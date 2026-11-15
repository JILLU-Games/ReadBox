export interface OperatorEnvironmentConfiguration {
  readonly nodeEnv: string;
  readonly databaseUrl: string | undefined;
  readonly interactive: boolean;
}

export function getOperatorEnvironmentError(
  configuration: OperatorEnvironmentConfiguration,
): string | null {
  if (configuration.nodeEnv !== "development" || !configuration.databaseUrl) {
    return "Local development configuration required";
  }

  let databaseUrl: URL;
  try {
    databaseUrl = new URL(configuration.databaseUrl);
  } catch {
    return "Loopback PostgreSQL is required";
  }

  if (
    !["postgres:", "postgresql:"].includes(databaseUrl.protocol) ||
    !["127.0.0.1", "localhost", "[::1]"].includes(databaseUrl.hostname)
  ) {
    return "Loopback PostgreSQL is required";
  }

  let databaseName: string;
  try {
    databaseName = decodeURIComponent(databaseUrl.pathname.slice(1));
  } catch {
    return "A permitted local database is required";
  }

  if (!databaseName || databaseName.toLowerCase() === "mailstack_dev") {
    return "A permitted local database is required";
  }

  if (!configuration.interactive) {
    return "An interactive local terminal is required";
  }

  return null;
}
