import "server-only";
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

const environmentSchema = z.object({
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
  LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),
}).superRefine((value, context) => {
  if (value.AUTH_ENABLED && !value.AUTH_SECRET) {
    context.addIssue({
      code: "custom",
      path: ["AUTH_SECRET"],
      message: "AUTH_SECRET is required when AUTH_ENABLED=true",
    });
  }
});

const result = environmentSchema.safeParse(process.env);

if (!result.success) {
  const invalidKeys = result.error.issues
    .map((issue) => issue.path.join("."))
    .join(", ");
  throw new Error(
    `Invalid MailStack environment configuration: ${invalidKeys}`,
  );
}

export const env = Object.freeze({
  nodeEnv: result.data.NODE_ENV,
  databaseUrl: result.data.DATABASE_URL,
  authEnabled: result.data.AUTH_ENABLED,
  authSecret: result.data.AUTH_SECRET,
  logLevel: result.data.LOG_LEVEL,
});
