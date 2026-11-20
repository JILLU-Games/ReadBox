export const SEO_PAGE_KEYS = ["home", "contact", "privacy"] as const;
export type SeoPageKey = (typeof SEO_PAGE_KEYS)[number];

export interface SeoPageValues {
  readonly title: string;
  readonly description: string;
  readonly imagePath: string;
}

export interface SeoSettingsSnapshot {
  readonly pages: Record<SeoPageKey, SeoPageValues>;
  readonly databaseConnected: boolean;
}

export interface SeoSaveResult {
  readonly ok: boolean;
  readonly settings?: SeoPageValues;
  readonly pageKey?: SeoPageKey;
  readonly error?: string;
  readonly fieldErrors?: Readonly<Record<string, string>>;
}

export function emptySeoValues(): SeoPageValues {
  return { title: "", description: "", imagePath: "" };
}

export function emptySeoPages(): Record<SeoPageKey, SeoPageValues> {
  return {
    home: emptySeoValues(),
    contact: emptySeoValues(),
    privacy: emptySeoValues(),
  };
}
