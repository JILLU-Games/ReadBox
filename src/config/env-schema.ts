import { isIP } from "node:net";
import { z } from "zod";

const emptyToUndefined = (value: unknown) =>
  typeof value === "string" && value.trim() === "" ? undefined : value;

const normalizeLogLevel = (value: unknown) => {
  if (typeof value !== "string") return value;
  const trimmed = value.trim().toLowerCase();
  if (!trimmed) return undefined;
  if (trimmed === "warning") return "warn";
  if (
    trimmed === "debug" ||
    trimmed === "info" ||
    trimmed === "warn" ||
    trimmed === "error"
  ) {
    return trimmed;
  }
  return "info";
};

const normalizeDevAuthRole = (value: unknown) => {
  if (typeof value !== "string") return value;
  const trimmed = value.trim().toLowerCase();
  if (!trimmed) return undefined;
  if (trimmed === "user" || trimmed === "admin") return trimmed;
  return "admin";
};

const normalizeLowercaseEmpty = (value: unknown) => {
  if (typeof value !== "string") return value;
  const trimmed = value.trim().toLowerCase();
  return trimmed === "" ? undefined : trimmed;
};

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
    NODE_ENV: z.preprocess(
      emptyToUndefined,
      z.enum(["development", "test", "production"]).default("development"),
    ),
    DATABASE_URL: z.preprocess(emptyToUndefined, databaseUrlSchema.optional()),
    AUTH_ENABLED: z.preprocess(
      emptyToUndefined,
      z
        .enum(["true", "false"])
        .default("false")
        .transform((value) => value === "true"),
    ),
    AUTH_SECRET: z.preprocess(
      emptyToUndefined,
      z.string().min(32).optional(),
    ),
    AUTH_TRUST_HOST: z.preprocess(
      emptyToUndefined,
      z
        .enum(["true", "false"])
        .default("false")
        .transform((value) => value === "true"),
    ),
    TRUST_PROXY_HEADERS: z.preprocess(
      emptyToUndefined,
      z
        .enum(["true", "false"])
        .default("false")
        .transform((value) => value === "true"),
    ),
    DEV_AUTH_MODE: z.preprocess(
      normalizeLowercaseEmpty,
      z.enum(["off", "bypass", "demo"]).default("off"),
    ),
    DEV_AUTH_ROLE: z.preprocess(
      normalizeDevAuthRole,
      z.enum(["user", "admin"]).default("admin"),
    ),
    LOGIN_FAILURE_LIMIT: z.preprocess(
      emptyToUndefined,
      z.coerce.number().int().min(1).max(100).default(5),
    ),
    LOGIN_FAILURE_WINDOW_SECONDS: z.preprocess(
      emptyToUndefined,
      z.coerce.number().int().min(60).max(86_400).default(900),
    ),
    LOGIN_LOCKOUT_SECONDS: z.preprocess(
      emptyToUndefined,
      z.coerce.number().int().min(60).max(86_400).default(900),
    ),
    LOG_LEVEL: z.preprocess(
      normalizeLogLevel,
      z.enum(["debug", "info", "warn", "error"]).default("info"),
    ),
    MAIL_DOMAIN: z.preprocess(
      emptyToUndefined,
      z
        .string()
        .trim()
        .min(3)
        .max(253)
        .transform((value) => value.toLowerCase().replace(/\.+$/, ""))
        .default("mailstack.local"),
    ),
    MAIL_HOSTNAME: z.preprocess(
      emptyToUndefined,
      z
        .string()
        .trim()
        .min(3)
        .max(253)
        .transform((value) => value.toLowerCase().replace(/\.+$/, ""))
        .default("mail.mailstack.local"),
    ),
    APP_HOSTNAME: z.preprocess(
      emptyToUndefined,
      z
        .string()
        .trim()
        .min(3)
        .max(253)
        .transform((value) => value.toLowerCase().replace(/\.+$/, ""))
        .default("app.mailstack.local"),
    ),
    SERVER_IP: z.preprocess(
      emptyToUndefined,
      z
        .string()
        .trim()
        .refine((value) => isIP(value) !== 0, {
          message: "SERVER_IP must be a valid IPv4 or IPv6 address",
        })
        .default("127.0.0.1"),
    ),
    MAIL_STORAGE_ROOT: z.preprocess(
      emptyToUndefined,
      z.string().trim().min(1).default("/var/vmail"),
    ),
    ATTACHMENT_STORAGE_ROOT: z.preprocess(
      emptyToUndefined,
      z.string().trim().min(1).default("/var/lib/readbox/attachments"),
    ),
    MAILBOX_PROVISION_LOCK_ROOT: z.preprocess(
      emptyToUndefined,
      z.string().trim().min(1).default("/var/lock/readbox-provision"),
    ),
    MAILBOX_DEFAULT_QUOTA_BYTES: z.preprocess(
      emptyToUndefined,
      z.coerce.number().int().min(0).max(10_995_116_277_760).default(2_147_483_648),
    ),
    OPENDKIM_KEYS_ROOT: z.preprocess(
      emptyToUndefined,
      z.string().trim().min(1).default("/etc/opendkim/keys"),
    ),
    DNS_LOOKUP_TIMEOUT_SECONDS: z.preprocess(
      emptyToUndefined,
      z.coerce.number().min(0.5).max(30).default(3),
    ),
    INGESTION_STALE_AFTER_SECONDS: z.preprocess(
      emptyToUndefined,
      z.coerce.number().int().min(15).max(86_400).default(120),
    ),
    INGESTION_INTERVAL_SECONDS: z.preprocess(
      emptyToUndefined,
      z.coerce.number().int().min(1).max(3_600).default(15),
    ),
    INGESTION_LOCK_FILE: z.preprocess(
      emptyToUndefined,
      z.string().trim().min(1).default("/var/lock/readbox-ingestion.lock"),
    ),
    MAX_MESSAGE_SIZE_MB: z.preprocess(
      emptyToUndefined,
      z.coerce.number().int().min(1).max(200).default(25),
    ),
    MAX_ATTACHMENT_SIZE_MB: z.preprocess(
      emptyToUndefined,
      z.coerce.number().int().min(1).max(100).default(20),
    ),
    MAX_ATTACHMENTS_PER_MESSAGE: z.preprocess(
      emptyToUndefined,
      z.coerce.number().int().min(1).max(200).default(25),
    ),
    MEDIA_ROOT: z.preprocess(
      emptyToUndefined,
      z.string().trim().min(1).default("/var/lib/readbox/media"),
    ),
    PUBLIC_SITE_ORIGIN: z.preprocess(
      emptyToUndefined,
      z.string().trim().url().optional(),
    ),
    UPDATE_RUNTIME_DIR: z.preprocess(
      emptyToUndefined,
      z.string().trim().min(1).default("/run/vibmail"),
    ),
    UPDATE_SERVICE_NAME: z.preprocess(
      emptyToUndefined,
      z.string().trim().min(1).default("vibmail-updater.service"),
    ),
    UPDATE_SCRIPT_PATH: z.preprocess(
      emptyToUndefined,
      z
        .string()
        .trim()
        .min(1)
        .default("/opt/vibmail/app/scripts/updater/upgrade.sh"),
    ),
    UPDATE_GITHUB_REPO: z.preprocess(
      emptyToUndefined,
      z
        .string()
        .trim()
        .regex(/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/, {
          message: "UPDATE_GITHUB_REPO must be in owner/repo format",
        })
        .default("vibtools/ReadBox"),
    ),
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

export type ReadBoxEnv = Readonly<{
  nodeEnv: "development" | "test" | "production";
  databaseUrl: string | undefined;
  authEnabled: boolean;
  authSecret: string | undefined;
  authTrustHost: boolean;
  trustProxyHeaders: boolean;
  devAuthMode: "off" | "bypass" | "demo";
  devAuthRole: "user" | "admin";
  loginFailureLimit: number;
  loginFailureWindowSeconds: number;
  loginLockoutSeconds: number;
  logLevel: "debug" | "info" | "warn" | "error";
  mailDomain: string;
  mailHostname: string;
  appHostname: string;
  serverIp: string;
  mailStorageRoot: string;
  attachmentStorageRoot: string;
  mailboxProvisionLockRoot: string;
  mailboxDefaultQuotaBytes: number;
  opendkimKeysRoot: string;
  dnsLookupTimeoutSeconds: number;
  ingestionStaleAfterSeconds: number;
  ingestionIntervalSeconds: number;
  ingestionLockFile: string;
  maxMessageSizeMb: number;
  maxAttachmentSizeMb: number;
  maxAttachmentsPerMessage: number;
  mediaRoot: string;
  publicSiteOrigin: string | undefined;
  updateRuntimeDir: string;
  updateServiceName: string;
  updateScriptPath: string;
  updateGithubRepo: string;
}>;

export function parseEnvironment(
  rawEnv: Record<string, string | undefined>,
): ReadBoxEnv {
  const result = environmentSchema.safeParse(rawEnv);

  if (!result.success) {
    const invalidKeys = result.error.issues
      .map((issue) => issue.path.join("."))
      .join(", ");
    throw new Error(
      `Invalid ReadBox environment configuration: ${invalidKeys}`,
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
    trustProxyHeaders: result.data.TRUST_PROXY_HEADERS,
    devAuthMode,
    devAuthRole: result.data.DEV_AUTH_ROLE,
    loginFailureLimit: result.data.LOGIN_FAILURE_LIMIT,
    loginFailureWindowSeconds: result.data.LOGIN_FAILURE_WINDOW_SECONDS,
    loginLockoutSeconds: result.data.LOGIN_LOCKOUT_SECONDS,
    logLevel: result.data.LOG_LEVEL,
    mailDomain: result.data.MAIL_DOMAIN,
    mailHostname: result.data.MAIL_HOSTNAME,
    appHostname: result.data.APP_HOSTNAME,
    serverIp: result.data.SERVER_IP,
    mailStorageRoot: result.data.MAIL_STORAGE_ROOT,
    attachmentStorageRoot: result.data.ATTACHMENT_STORAGE_ROOT,
    mailboxProvisionLockRoot: result.data.MAILBOX_PROVISION_LOCK_ROOT,
    mailboxDefaultQuotaBytes: result.data.MAILBOX_DEFAULT_QUOTA_BYTES,
    opendkimKeysRoot: result.data.OPENDKIM_KEYS_ROOT,
    dnsLookupTimeoutSeconds: result.data.DNS_LOOKUP_TIMEOUT_SECONDS,
    ingestionStaleAfterSeconds: result.data.INGESTION_STALE_AFTER_SECONDS,
    ingestionIntervalSeconds: result.data.INGESTION_INTERVAL_SECONDS,
    ingestionLockFile: result.data.INGESTION_LOCK_FILE,
    maxMessageSizeMb: result.data.MAX_MESSAGE_SIZE_MB,
    maxAttachmentSizeMb: result.data.MAX_ATTACHMENT_SIZE_MB,
    maxAttachmentsPerMessage: result.data.MAX_ATTACHMENTS_PER_MESSAGE,
    mediaRoot: result.data.MEDIA_ROOT,
    publicSiteOrigin: result.data.PUBLIC_SITE_ORIGIN,
    updateRuntimeDir: result.data.UPDATE_RUNTIME_DIR,
    updateServiceName: result.data.UPDATE_SERVICE_NAME,
    updateScriptPath: result.data.UPDATE_SCRIPT_PATH,
    updateGithubRepo: result.data.UPDATE_GITHUB_REPO,
  });
}
