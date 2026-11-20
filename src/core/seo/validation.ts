import { SEO_PAGE_KEYS } from "./types";
import { z } from "zod";

const safeCopy = (value: string): boolean =>
  !/[<>]/u.test(value) &&
  Array.from(value).every((char) => {
    const code = char.codePointAt(0) ?? 0;
    return code > 31 && code !== 127;
  });

export const seoPageKeySchema = z.enum(SEO_PAGE_KEYS);

const publicImagePath = /^\/(?:icons\/[a-zA-Z0-9._-]+|api\/media\/site-settings\/[a-zA-Z0-9._-]+)\.(?:png|webp|jpg|jpeg)$/;

export const seoPageInputSchema = z.object({
  pageKey: seoPageKeySchema,
  title: z.string().trim().max(120, "SEO title must be 120 characters or fewer.")
    .refine(safeCopy, "SEO title contains disallowed control or markup characters."),
  description: z.string().trim().max(320, "SEO description must be 320 characters or fewer.")
    .refine(safeCopy, "SEO description contains disallowed control or markup characters."),
  imagePath: z.string().trim().max(255, "Image path must be 255 characters or fewer.")
    .refine((value) => value === "" || publicImagePath.test(value),
      "Use an existing public PNG, WebP, or JPEG under /icons/ or /api/media/site-settings/."),
});

export function isTrustedSeoActionOrigin(
  requestHeaders: Pick<Headers, "get">,
  expectedPublicOrigin?: string | null,
): boolean {
  try {
    const origin = requestHeaders.get("origin");
    const host = requestHeaders.get("host");
    if (!origin || !host) return false;
    const actual = new URL(origin);
    if (!["https:", "http:"].includes(actual.protocol) || actual.username || actual.password) {
      return false;
    }
    const expected = expectedPublicOrigin
      ? new URL(expectedPublicOrigin).origin
      : `${actual.protocol}//${host}`;
    return actual.origin === expected && new URL(`${actual.protocol}//${host}`).host === actual.host;
  } catch {
    return false;
  }
}

export type SeoPageInput = z.infer<typeof seoPageInputSchema>;

export function seoValidationErrors(error: z.ZodError): Record<string, string> {
  const fields: Record<string, string> = {};
  for (const issue of error.issues) {
    const field = String(issue.path[0] ?? "form");
    if (!fields[field]) fields[field] = issue.message;
  }
  return fields;
}
