import { SEO_PAGE_KEYS } from "./types";
import { z } from "zod";

const safeCopy = (value: string): boolean =>
  !/[\u0000-\u001F\u007F<>]/u.test(value);

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

export type SeoPageInput = z.infer<typeof seoPageInputSchema>;

export function seoValidationErrors(error: z.ZodError): Record<string, string> {
  const fields: Record<string, string> = {};
  for (const issue of error.issues) {
    const field = String(issue.path[0] ?? "form");
    if (!fields[field]) fields[field] = issue.message;
  }
  return fields;
}
