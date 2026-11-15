import { z } from "zod";

const databaseUrlSchema = z
  .string()
  .url()
  .refine(
    (value) => ["postgres:", "postgresql:"].includes(new URL(value).protocol),
    {
      message: "DATABASE_URL must use the PostgreSQL protocol",
    },
  );

const environmentSchema = z
  .object({
    NODE_ENV: z
      .enum(["development", "test", "production"])
      .default("development"),
    DATABASE_URL: z.preprocess(
      (value) =>
        typeof value === "string" && value.trim() === "" ? undefined : value,
      databaseUrlSchema.optional(),
    ),
    AUTH_ENABLED: z
      .enum(["true", "false"])
      .default("false")
      .transform((value) => value === "true"),
    AUTH_SECRET: z.preprocess(
      (value) =>
        typeof value === "string" && value.trim() === "" ? undefined : value,
      z.string().min(32).optional(),
    ),
    AUTH_TRUST_HOST: z
      .enum(["true", "false"])
      .default("false")
      .transform((value) => value === "true"),
    DEV_AUTH_MODE: z.enum(["off", "bypass", "demo"]).default("off"),
    DEV_AUTH_ROLE: z.enum(["user", "admin"]).default("admin"),
    LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),
  })
  .superRefine((value, context) => {
    if (value.AUTH_ENABLED && !value.AUTH_SECRET) {
      context.addIssue({
        code: "custom",
        path: ["AUTH_SECRET"],
        message: "AUTH_SECRET is required when AUTH_ENABLED=true",
      });
    }

    if (
      value.NODE_ENV === "production" &&
      value.AUTH_ENABLED &&
      !value.DATABASE_URL
    ) {
      context.addIssue({
        code: "custom",
        path: ["DATABASE_URL"],
        message:
          "DATABASE_URL is required when AUTH_ENABLED=true in production",
      });
    }
  });

export type MailStackEnv = Readonly<{
  nodeEnv: "development" | "test" | "production";
  databaseUrl: string | undefined;
  authEnabled: boolean;
  authSecret: string | undefined;
  authTrustHost: boolean;
  devAuthMode: "off" | "bypass" | "demo";
  devAuthRole: "user" | "admin";
  logLevel: "debug" | "info" | "warn" | "error";
}>;

export function parseEnvironment(
  rawEnv: Record<string, string | undefined>,
): MailStackEnv {
  const result = environmentSchema.safeParse(rawEnv);

  if (!result.success) {
    const invalidKeys = result.error.issues
      .map((issue) => issue.path.join("."))
      .join(", ");
    throw new Error(
      `Invalid MailStack environment configuration: ${invalidKeys}`,
    );
  }

  const devAuthMode =
    result.data.NODE_ENV === "production" ? "off" : result.data.DEV_AUTH_MODE;

  return Object.freeze({
    nodeEnv: result.data.NODE_ENV,
    databaseUrl: result.data.DATABASE_URL,
    authEnabled: result.data.AUTH_ENABLED,
    authSecret: result.data.AUTH_SECRET,
    authTrustHost: result.data.AUTH_TRUST_HOST,
    devAuthMode,
    devAuthRole: result.data.DEV_AUTH_ROLE,
    logLevel: result.data.LOG_LEVEL,
  });
}
