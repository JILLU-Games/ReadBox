import { env } from "@/config/env";
import { recordAudit } from "@/core/audit/record";
import type { AuditWriteClient } from "@/core/audit/types";
import { getPrismaClient } from "@/core/database/client";
import { logger } from "@/core/server/logger";
import {
  emptySeoPages, emptySeoValues, SEO_PAGE_KEYS,
  type SeoPageKey, type SeoPageValues,
  type SeoSaveResult, type SeoSettingsSnapshot,
} from "./types";
import { seoPageInputSchema, seoValidationErrors } from "./validation";
import "server-only";

interface SeoRecord extends SeoPageValues {
  readonly pageKey: string;
  readonly updatedAt: Date;
}

interface SeoTable {
  findMany(): Promise<SeoRecord[]>;
  upsert(args: {
    where: { pageKey: SeoPageKey };
    create: { pageKey: SeoPageKey } & SeoPageValues;
    update: SeoPageValues;
  }): Promise<SeoRecord>;
}

export interface SeoDatabase {
  readonly siteSeoSettings: SeoTable;
  readonly auditLog: AuditWriteClient["auditLog"];
  $transaction<T>(callback: (client: SeoDatabase) => Promise<T>): Promise<T>;
}

function databaseFromOptions(options?: { database?: SeoDatabase | null }): SeoDatabase | null {
  if (options?.database !== undefined) return options.database;
  if (!env.databaseUrl) return null;
  return getPrismaClient() as unknown as SeoDatabase;
}

export async function getSeoSettingsSnapshot(
  options?: { database?: SeoDatabase | null },
): Promise<SeoSettingsSnapshot> {
  const pages = emptySeoPages();
  try {
    const database = databaseFromOptions(options);
    if (!database) return { pages, databaseConnected: false };
    const rows = await database.siteSeoSettings.findMany();
    for (const row of rows) {
      if (SEO_PAGE_KEYS.includes(row.pageKey as SeoPageKey)) {
        pages[row.pageKey as SeoPageKey] = {
          title: row.title, description: row.description, imagePath: row.imagePath,
        };
      }
    }
    return { pages, databaseConnected: true };
  } catch (error) {
    logger.warn("seo_settings_load_fallback", {
      reason: error instanceof Error ? error.name : "unknown_error",
    });
    return { pages, databaseConnected: false };
  }
}

export async function getSeoPageSettings(
  pageKey: SeoPageKey,
  options?: { database?: SeoDatabase | null },
): Promise<SeoPageValues> {
  const snapshot = await getSeoSettingsSnapshot(options);
  return snapshot.pages[pageKey] ?? emptySeoValues();
}

export async function updateSeoPageSettings(
  input: unknown,
  options?: {
    database?: SeoDatabase | null;
    actorId?: bigint | null;
    actorUsername?: string | null;
    authSource?: "admin_table" | "user_table";
    headers?: Pick<Headers, "get">;
  },
): Promise<SeoSaveResult> {
  const parsed = seoPageInputSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Please correct the SEO fields.",
      fieldErrors: seoValidationErrors(parsed.error) };
  }

  try {
    const database = databaseFromOptions(options);
    if (!database) {
      return { ok: false, error: "SEO settings cannot be saved while PostgreSQL is unavailable." };
    }
    const { pageKey, title, description, imagePath } = parsed.data;
    const saved = await database.$transaction(async (tx) => {
      const result = await tx.siteSeoSettings.upsert({
        where: { pageKey },
        create: { pageKey, title, description, imagePath },
        update: { title, description, imagePath },
      });
      const audit = await recordAudit(tx, {
        actorId: options?.actorId ?? null,
        actorUsername: options?.actorUsername,
        authSource: options?.authSource,
        headers: options?.headers,
        action: "site_seo_updated",
        targetType: "site_seo_settings",
        targetIdentifier: pageKey,
        details: { page_key: pageKey, has_title: !!title,
          has_description: !!description, has_image: !!imagePath },
      });
      if (audit === null) throw new Error("SEO_AUDIT_PERSISTENCE_REQUIRED");
      return result;
    });
    return {
      ok: true, pageKey,
      settings: { title: saved.title, description: saved.description, imagePath: saved.imagePath },
    };
  } catch (error) {
    logger.error("seo_settings_update_failed", {
      reason: error instanceof Error ? error.name : "unknown_error",
    });
    return { ok: false, error: "Unable to save SEO settings. No changes were confirmed." };
  }
}
