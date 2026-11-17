import { env } from "@/config/env";
import { recordAudit } from "@/core/audit/record";
import type { AuditWriteClient } from "@/core/audit/types";
import { getPrismaClient } from "@/core/database/client";
import { confinedPath, PathConfinementError } from "@/core/mailboxes/paths";
import { logger } from "@/core/server/logger";
import { randomBytes } from "node:crypto";
import { constants as fsConstants } from "node:fs";
import {
  access,
  lstat,
  mkdir,
  readFile,
  unlink,
  writeFile,
} from "node:fs/promises";
import { extname, posix, resolve } from "node:path";
import { z } from "zod";
import {
  DEFAULT_SITE_SETTINGS,
  getCachedSiteSettingsSnapshot,
  resetDevFallbackSiteSettings as resetSnapshotFallback,
  setCachedSiteSettingsSnapshot,
} from "./snapshot";

let dbCheckCooldownUntil = 0;

export function resetDevFallbackSiteSettings(): void {
  resetSnapshotFallback();
  dbCheckCooldownUntil = 0;
}

export { getCachedSiteSettingsSnapshot };

export const MAX_LOGO_SIZE_BYTES = 5 * 1024 * 1024;
export const MAX_FAVICON_SIZE_BYTES = 512 * 1024;

export const ALLOWED_LOGO_MIME_TYPES = new Set([
  "image/gif",
  "image/jpeg",
  "image/png",
  "image/svg+xml",
  "image/webp",
]);

export const ALLOWED_FAVICON_MIME_TYPES = new Set([
  "image/gif",
  "image/x-icon",
  "image/vnd.microsoft.icon",
  "image/png",
  "image/svg+xml",
  "image/webp",
]);

const MIME_TO_EXTENSIONS: Readonly<Record<string, readonly string[]>> = {
  "image/gif": [".gif"],
  "image/jpeg": [".jpg", ".jpeg"],
  "image/png": [".png"],
  "image/svg+xml": [".svg"],
  "image/webp": [".webp"],
  "image/x-icon": [".ico"],
  "image/vnd.microsoft.icon": [".ico"],
};

const EXTENSION_TO_MIME: Readonly<Record<string, string>> = {
  ".gif": "image/gif",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
};

export interface SiteSettingsRecord {
  readonly id: bigint;
  readonly siteName: string;
  readonly siteTagline: string;
  readonly logoPath: string;
  readonly faviconPath: string;
  readonly supportEmail: string;
  readonly contactPhone: string;
  readonly officeAddress: string;
  readonly footerDescription: string;
  readonly copyrightText: string;
  readonly sourceCodeUrl: string;
  readonly privacyUrl: string;
  readonly updatedAt: Date;
}

export interface SiteSettingsView extends SiteSettingsRecord {
  readonly logoUrl: string;
  readonly faviconUrl: string;
  readonly databaseConnected: boolean;
}

export interface SiteAssetUploadInput {
  readonly filename: string;
  readonly contentType: string;
  readonly sizeBytes: number;
  readonly buffer: Buffer;
}

export interface UpdateSiteSettingsInput {
  readonly siteName: string;
  readonly siteTagline?: string;
  readonly supportEmail?: string;
  readonly contactPhone?: string;
  readonly officeAddress?: string;
  readonly footerDescription?: string;
  readonly copyrightText?: string;
  readonly sourceCodeUrl?: string;
  readonly privacyUrl?: string;
  readonly clearLogo?: boolean;
  readonly clearFavicon?: boolean;
  readonly logoUpload?: SiteAssetUploadInput | null;
  readonly faviconUpload?: SiteAssetUploadInput | null;
}

export type UpdateSiteSettingsResult =
  | {
      readonly ok: true;
      readonly settings: SiteSettingsView;
      readonly message: string;
    }
  | {
      readonly ok: false;
      readonly error: string;
      readonly fieldErrors?: Readonly<Record<string, string>>;
    };

export interface SiteSettingsPrismaLike extends AuditWriteClient {
  readonly siteSettings: {
    findFirst(args?: {
      orderBy?: { id: "asc" };
    }): Promise<SiteSettingsRecord | null>;
    upsert(args: {
      where: { id: bigint };
      create: Omit<SiteSettingsRecord, "id" | "updatedAt">;
      update: Partial<Omit<SiteSettingsRecord, "id" | "updatedAt">>;
    }): Promise<SiteSettingsRecord>;
  };
}

function isValidHttpOrHttpsUrl(value: string): boolean {
  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

export function isValidPrivacyOrTermsUrl(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed) return true;
  if (trimmed.startsWith("/")) {
    return !trimmed.startsWith("//") && !/[\r\n\0]/.test(trimmed);
  }
  return isValidHttpOrHttpsUrl(trimmed);
}

const siteSettingsFieldsSchema = z.object({
  siteName: z
    .string()
    .trim()
    .min(1, "Site name is required.")
    .max(120, "Site name must be 120 characters or fewer."),
  siteTagline: z
    .string()
    .trim()
    .max(200, "Site tagline must be 200 characters or fewer.")
    .default(""),
  supportEmail: z
    .string()
    .trim()
    .max(254, "Support email must be 254 characters or fewer.")
    .refine(
      (val) => val === "" || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val),
      "Enter a valid support email address.",
    )
    .default(""),
  contactPhone: z
    .string()
    .trim()
    .max(40, "Contact phone must be 40 characters or fewer.")
    .default(""),
  officeAddress: z
    .string()
    .trim()
    .max(255, "Office address must be 255 characters or fewer.")
    .default(""),
  footerDescription: z
    .string()
    .trim()
    .max(2000, "Footer description must be 2000 characters or fewer.")
    .default(""),
  copyrightText: z
    .string()
    .trim()
    .max(255, "Copyright text must be 255 characters or fewer.")
    .default(""),
  sourceCodeUrl: z
    .string()
    .trim()
    .max(200, "Source code URL must be 200 characters or fewer.")
    .refine(
      (val) => val === "" || isValidHttpOrHttpsUrl(val),
      "Source code URL must be a valid http:// or https:// URL.",
    )
    .default(""),
  privacyUrl: z
    .string()
    .trim()
    .max(500, "Privacy / Terms URL must be 500 characters or fewer.")
    .refine(
      isValidPrivacyOrTermsUrl,
      "Privacy / Terms URL must be a relative path (/...) or http(s):// URL.",
    )
    .default(""),
});

export function validateSiteAssetUpload(
  upload: SiteAssetUploadInput,
  kind: "logo" | "favicon",
): { readonly ok: true; readonly extension: string } | { readonly ok: false; readonly error: string } {
  const maxBytes =
    kind === "logo" ? MAX_LOGO_SIZE_BYTES : MAX_FAVICON_SIZE_BYTES;
  const maxLabel = kind === "logo" ? "5 MB" : "512 KB";
  const label = kind === "logo" ? "Logo" : "Favicon";

  if (upload.sizeBytes <= 0 || upload.buffer.byteLength <= 0) {
    return { ok: false, error: `${label} file cannot be empty.` };
  }

  if (upload.sizeBytes > maxBytes || upload.buffer.byteLength > maxBytes) {
    return {
      ok: false,
      error: `${label} must be ${maxLabel} or smaller.`,
    };
  }

  const normalizedMime = upload.contentType.trim().toLowerCase();
  const allowedMimes =
    kind === "logo" ? ALLOWED_LOGO_MIME_TYPES : ALLOWED_FAVICON_MIME_TYPES;
  if (!allowedMimes.has(normalizedMime)) {
    return {
      ok: false,
      error: `${label} must be a supported image file.`,
    };
  }

  const rawExt = extname(upload.filename || "").toLowerCase();
  const expectedExtensions = MIME_TO_EXTENSIONS[normalizedMime] ?? [];
  if (rawExt && !expectedExtensions.includes(rawExt)) {
    return {
      ok: false,
      error: `${label} file extension (${rawExt}) does not match declared image type (${normalizedMime}).`,
    };
  }

  const resolvedExt = rawExt || expectedExtensions[0] || ".bin";

  if (normalizedMime === "image/svg+xml") {
    const snippet = upload.buffer.subarray(0, 4096).toString("utf8");
    if (!snippet.includes("<svg")) {
      return {
        ok: false,
        error: `${label} SVG file does not contain a valid <svg> root element.`,
      };
    }
    if (/<script\b|javascript:|onload=|onerror=/i.test(snippet)) {
      return {
        ok: false,
        error: `${label} SVG file contains prohibited active script content.`,
      };
    }
  }

  return { ok: true, extension: resolvedExt };
}

export async function resolveWritableMediaRoot(
  configuredRoot: string = env.mediaRoot,
): Promise<string> {
  try {
    await mkdir(configuredRoot, { recursive: true, mode: 0o755 });
    await access(configuredRoot, fsConstants.R_OK | fsConstants.W_OK);
    return configuredRoot;
  } catch (error) {
    if (
      env.nodeEnv !== "production" &&
      configuredRoot === "/var/lib/readbox/media"
    ) {
      const localFallback = resolve(process.cwd(), ".runtime", "media");
      await mkdir(localFallback, { recursive: true, mode: 0o755 });
      return localFallback;
    }
    throw error;
  }
}

export function buildMediaUrl(relativePath: string, baseOrigin?: string): string {
  const trimmed = relativePath.trim().replace(/^\/+/, "");
  if (!trimmed) return "";
  const urlPath = `/api/media/${trimmed}`;
  if (!baseOrigin) return urlPath;
  try {
    return new URL(urlPath, baseOrigin).toString();
  } catch {
    return urlPath;
  }
}

export function toSiteSettingsView(
  record: SiteSettingsRecord,
  databaseConnected: boolean,
  baseOrigin?: string,
): SiteSettingsView {
  return {
    ...record,
    logoUrl: buildMediaUrl(record.logoPath, baseOrigin),
    faviconUrl: buildMediaUrl(record.faviconPath, baseOrigin),
    databaseConnected,
  };
}

export async function getSiteSettings(options?: {
  readonly prisma?: SiteSettingsPrismaLike | null;
  readonly baseOrigin?: string;
  readonly nodeEnv?: "development" | "test" | "production";
}): Promise<SiteSettingsView> {
  const effectiveNodeEnv = options?.nodeEnv ?? env.nodeEnv;
  const now = Date.now();
  if (now < dbCheckCooldownUntil && options?.prisma === undefined) {
    if (effectiveNodeEnv === "production") {
      logger.warn("site_settings_cooldown_fallback_active");
    }
    return toSiteSettingsView(
      getCachedSiteSettingsSnapshot(),
      false,
      options?.baseOrigin,
    );
  }

  let client: SiteSettingsPrismaLike | null = null;
  if (options?.prisma !== undefined) {
    client = options.prisma;
  } else if (env.databaseUrl) {
    try {
      client = getPrismaClient() as unknown as SiteSettingsPrismaLike;
    } catch (error) {
      dbCheckCooldownUntil = Date.now() + 30_000;
      logger.error("site_settings_client_init_failed", {
        reason: error instanceof Error ? error.name : "unknown_error",
      });
      return toSiteSettingsView(
        effectiveNodeEnv === "production"
          ? DEFAULT_SITE_SETTINGS
          : getCachedSiteSettingsSnapshot(),
        false,
        options?.baseOrigin,
      );
    }
  }

  if (!client) {
    if (effectiveNodeEnv === "production") {
      logger.warn("site_settings_database_not_configured");
    }
    return toSiteSettingsView(
      effectiveNodeEnv === "production"
        ? DEFAULT_SITE_SETTINGS
        : getCachedSiteSettingsSnapshot(),
      false,
      options?.baseOrigin,
    );
  }

  try {
    const existing = await client.siteSettings.findFirst({
      orderBy: { id: "asc" },
    });
    if (existing) {
      setCachedSiteSettingsSnapshot(existing);
      dbCheckCooldownUntil = 0;
      return toSiteSettingsView(existing, true, options?.baseOrigin);
    }

    const created = await client.siteSettings.upsert({
      where: { id: BigInt(1) },
      create: {
        siteName: DEFAULT_SITE_SETTINGS.siteName,
        siteTagline: DEFAULT_SITE_SETTINGS.siteTagline,
        logoPath: DEFAULT_SITE_SETTINGS.logoPath,
        faviconPath: DEFAULT_SITE_SETTINGS.faviconPath,
        supportEmail: DEFAULT_SITE_SETTINGS.supportEmail,
        contactPhone: DEFAULT_SITE_SETTINGS.contactPhone,
        officeAddress: DEFAULT_SITE_SETTINGS.officeAddress,
        footerDescription: DEFAULT_SITE_SETTINGS.footerDescription,
        copyrightText: DEFAULT_SITE_SETTINGS.copyrightText,
        sourceCodeUrl: DEFAULT_SITE_SETTINGS.sourceCodeUrl,
        privacyUrl: DEFAULT_SITE_SETTINGS.privacyUrl,
      },
      update: {},
    });
    setCachedSiteSettingsSnapshot(created);
    dbCheckCooldownUntil = 0;
    return toSiteSettingsView(created, true, options?.baseOrigin);
  } catch (error) {
    dbCheckCooldownUntil = Date.now() + 30_000;
    const logFields = {
      reason: error instanceof Error ? error.name : "unknown_error",
      message: error instanceof Error ? error.message : "unknown_error",
    };
    if (effectiveNodeEnv === "production") {
      logger.error("site_settings_load_failed", logFields);
    } else {
      logger.warn("site_settings_load_fallback", logFields);
    }
    return toSiteSettingsView(
      effectiveNodeEnv === "production"
        ? DEFAULT_SITE_SETTINGS
        : getCachedSiteSettingsSnapshot(),
      false,
      options?.baseOrigin,
    );
  }
}

async function storeSiteAssetFile(
  upload: SiteAssetUploadInput,
  kind: "logo" | "favicon",
  extension: string,
  mediaRootOption?: string,
): Promise<string> {
  const root = await resolveWritableMediaRoot(mediaRootOption ?? env.mediaRoot);
  const token = randomBytes(8).toString("hex");
  const filename = `${kind}-${token}${extension}`;
  const relativePath = posix.join("site-settings", filename);
  const directoryPath = await confinedPath(root, "site-settings");
  await mkdir(directoryPath, { recursive: true, mode: 0o755 });
  const targetPath = await confinedPath(root, "site-settings", filename);
  await writeFile(targetPath, upload.buffer, { mode: 0o640 });
  return relativePath;
}

async function removeSiteAssetFileBestEffort(
  relativePath: string,
  mediaRootOption?: string,
): Promise<void> {
  const trimmed = relativePath.trim().replace(/^\/+/, "");
  if (!trimmed.startsWith("site-settings/")) return;
  const parts = trimmed.split("/");
  if (parts.length !== 2) return;
  try {
    const root = await resolveWritableMediaRoot(mediaRootOption ?? env.mediaRoot);
    const targetPath = await confinedPath(root, parts[0]!, parts[1]!);
    await unlink(targetPath);
  } catch {
    // Ignore missing or already-removed asset files
  }
}

export async function updateSiteSettings(
  input: UpdateSiteSettingsInput,
  options?: {
    readonly prisma?: SiteSettingsPrismaLike | null;
    readonly mediaRoot?: string;
    readonly actorId?: bigint | null;
    readonly authSource?: "admin_table" | "user_table";
    readonly actorUsername?: string;
    readonly headers?: Pick<Headers, "get">;
    readonly nodeEnv?: "development" | "test" | "production";
  },
): Promise<UpdateSiteSettingsResult> {
  const effectiveNodeEnv = options?.nodeEnv ?? env.nodeEnv;
  const parsed = siteSettingsFieldsSchema.safeParse({
    siteName: input.siteName,
    siteTagline: input.siteTagline ?? "",
    supportEmail: input.supportEmail ?? "",
    contactPhone: input.contactPhone ?? "",
    officeAddress: input.officeAddress ?? "",
    footerDescription: input.footerDescription ?? "",
    copyrightText: input.copyrightText ?? "",
    sourceCodeUrl: input.sourceCodeUrl ?? "",
    privacyUrl: input.privacyUrl ?? "",
  });

  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = String(issue.path[0] ?? "form");
      if (!fieldErrors[key]) {
        fieldErrors[key] = issue.message;
      }
    }
    return {
      ok: false,
      error: "Please correct the highlighted fields.",
      fieldErrors,
    };
  }

  let validatedLogoExt: string | null = null;
  if (input.logoUpload) {
    const check = validateSiteAssetUpload(input.logoUpload, "logo");
    if (!check.ok) {
      return {
        ok: false,
        error: check.error,
        fieldErrors: { logo: check.error },
      };
    }
    validatedLogoExt = check.extension;
  }

  let validatedFaviconExt: string | null = null;
  if (input.faviconUpload) {
    const check = validateSiteAssetUpload(input.faviconUpload, "favicon");
    if (!check.ok) {
      return {
        ok: false,
        error: check.error,
        fieldErrors: { favicon: check.error },
      };
    }
    validatedFaviconExt = check.extension;
  }

  const current = await getSiteSettings({ prisma: options?.prisma });
  let nextLogoPath = input.clearLogo ? "" : current.logoPath;
  let nextFaviconPath = input.clearFavicon ? "" : current.faviconPath;

  let newlyStoredLogoPath: string | null = null;
  let newlyStoredFaviconPath: string | null = null;

  try {
    if (input.logoUpload && validatedLogoExt) {
      newlyStoredLogoPath = await storeSiteAssetFile(
        input.logoUpload,
        "logo",
        validatedLogoExt,
        options?.mediaRoot,
      );
      nextLogoPath = newlyStoredLogoPath;
    }

    if (input.faviconUpload && validatedFaviconExt) {
      newlyStoredFaviconPath = await storeSiteAssetFile(
        input.faviconUpload,
        "favicon",
        validatedFaviconExt,
        options?.mediaRoot,
      );
      nextFaviconPath = newlyStoredFaviconPath;
    }

    const payload = {
      siteName: parsed.data.siteName,
      siteTagline: parsed.data.siteTagline,
      logoPath: nextLogoPath,
      faviconPath: nextFaviconPath,
      supportEmail: parsed.data.supportEmail,
      contactPhone: parsed.data.contactPhone,
      officeAddress: parsed.data.officeAddress,
      footerDescription: parsed.data.footerDescription,
      copyrightText: parsed.data.copyrightText,
      sourceCodeUrl: parsed.data.sourceCodeUrl,
      privacyUrl: parsed.data.privacyUrl,
    };

    let client: SiteSettingsPrismaLike | null = null;
    if (options?.prisma !== undefined) {
      client = options.prisma;
    } else if (env.databaseUrl) {
      client = getPrismaClient() as unknown as SiteSettingsPrismaLike;
    }

    if (!client && effectiveNodeEnv === "production") {
      return {
        ok: false,
        error: "Database connection is required to save site settings.",
      };
    }

    let savedRecord: SiteSettingsRecord;
    let dbConnected = false;

    if (client) {
      savedRecord = await client.siteSettings.upsert({
        where: { id: BigInt(1) },
        create: payload,
        update: payload,
      });
      dbConnected = true;
      dbCheckCooldownUntil = 0;
    } else {
      savedRecord = {
        id: BigInt(1),
        ...payload,
        updatedAt: new Date(),
      };
    }

    setCachedSiteSettingsSnapshot(savedRecord);

    if (
      current.logoPath &&
      current.logoPath !== savedRecord.logoPath
    ) {
      await removeSiteAssetFileBestEffort(current.logoPath, options?.mediaRoot);
    }
    if (
      current.faviconPath &&
      current.faviconPath !== savedRecord.faviconPath
    ) {
      await removeSiteAssetFileBestEffort(
        current.faviconPath,
        options?.mediaRoot,
      );
    }

    if (client && dbConnected) {
      await recordAudit(client, {
        actorId: options?.actorId ?? null,
        authSource: options?.authSource,
        actorUsername: options?.actorUsername,
        action: "site_settings_updated",
        targetType: "site_settings",
        targetIdentifier: "singleton",
        headers: options?.headers,
        details: {
          site_name: savedRecord.siteName,
          support_email: savedRecord.supportEmail,
          logo_updated: Boolean(newlyStoredLogoPath || input.clearLogo),
          favicon_updated: Boolean(
            newlyStoredFaviconPath || input.clearFavicon,
          ),
        },
      });
    }

    return {
      ok: true,
      settings: toSiteSettingsView(savedRecord, dbConnected),
      message: "Settings saved successfully.",
    };
  } catch (error) {
    if (newlyStoredLogoPath) {
      await removeSiteAssetFileBestEffort(
        newlyStoredLogoPath,
        options?.mediaRoot,
      );
    }
    if (newlyStoredFaviconPath) {
      await removeSiteAssetFileBestEffort(
        newlyStoredFaviconPath,
        options?.mediaRoot,
      );
    }
    logger.error("site_settings_update_failed", {
      reason: error instanceof Error ? error.name : "unknown_error",
    });
    return {
      ok: false,
      error: "Unable to save site settings right now. Please try again.",
    };
  }
}

export async function readConfinedSiteMedia(
  segments: readonly string[],
  options?: { readonly mediaRoot?: string },
): Promise<{
  readonly buffer: Buffer;
  readonly contentType: string;
  readonly filename: string;
} | null> {
  if (segments.length !== 2 || segments[0] !== "site-settings") {
    return null;
  }

  const filename = segments[1]!;
  if (
    !filename ||
    filename.includes("/") ||
    filename.includes("\\") ||
    filename.startsWith(".")
  ) {
    return null;
  }

  const ext = extname(filename).toLowerCase();
  const contentType = EXTENSION_TO_MIME[ext];
  if (!contentType) {
    return null;
  }

  try {
    const root = await resolveWritableMediaRoot(
      options?.mediaRoot ?? env.mediaRoot,
    );
    const fullPath = await confinedPath(root, "site-settings", filename);
    const stats = await lstat(fullPath);
    if (!stats.isFile() || stats.isSymbolicLink()) {
      return null;
    }
    const buffer = await readFile(fullPath);
    return {
      buffer,
      contentType,
      filename,
    };
  } catch (error) {
    if (error instanceof PathConfinementError) {
      return null;
    }
    return null;
  }
}

export function resolvePublicSiteCorsHeaders(
  requestOrigin: string | null | undefined,
  configuredPublicOrigin: string | undefined = env.publicSiteOrigin,
): Record<string, string> {
  const publicOrigin = (configuredPublicOrigin ?? "").trim();
  const originHeader = (requestOrigin ?? "").trim();
  if (!publicOrigin || !originHeader) {
    return {};
  }

  const normalizedPublic = publicOrigin.replace(/\/+$/, "");
  const normalizedRequest = originHeader.replace(/\/+$/, "");
  if (normalizedPublic && normalizedRequest === normalizedPublic) {
    return {
      "Access-Control-Allow-Origin": publicOrigin,
      Vary: "Origin",
    };
  }

  return {};
}

export function formatPublicSiteSettingsJson(
  settings: SiteSettingsView,
): Record<string, string> {
  return {
    site_name: settings.siteName,
    site_tagline: settings.siteTagline,
    logo_url: settings.logoUrl,
    favicon_url: settings.faviconUrl,
    support_email: settings.supportEmail,
    contact_phone: settings.contactPhone,
    office_address: settings.officeAddress,
    footer_description: settings.footerDescription,
    copyright_text: settings.copyrightText,
    source_code_url: settings.sourceCodeUrl,
    privacy_url: settings.privacyUrl,
  };
}
