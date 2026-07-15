import { z } from "zod";

export const idSchema = z
  .string()
  .trim()
  .min(3)
  .max(80)
  .regex(/^[a-z0-9]+(?:[-_][a-z0-9]+)*$/, "Use lowercase letters, numbers, hyphens or underscores.");

export const isoDateTimeSchema = z.string().datetime({ offset: true });
export const localeSchema = z.enum(["en", "fi"]);
export type Locale = z.infer<typeof localeSchema>;

export const localizedTextSchema = z
  .object({ en: z.string().trim().min(1).optional(), fi: z.string().trim().min(1).optional() })
  .strict()
  .refine((value) => value.en !== undefined || value.fi !== undefined, "At least one locale is required.");

export const localizedSeoSchema = z
  .object({
    title: localizedTextSchema,
    metaDescription: localizedTextSchema,
  })
  .strict();

export const safeExternalUrlSchema = z
  .string()
  .url()
  .refine((value) => {
    try {
      return new URL(value).protocol === "https:";
    } catch {
      return false;
    }
  }, "External URLs must use HTTPS.");

export const assetRefSchema = z
  .object({
    id: idSchema,
    url: safeExternalUrlSchema.or(z.string().regex(/^\/(assets|images)\/[a-zA-Z0-9/_:.-]+$/)),
    alt: localizedTextSchema.optional(),
    decorative: z.boolean().default(false),
  })
  .strict()
  .refine((asset) => asset.decorative || asset.alt !== undefined, {
    message: "Non-decorative assets require localized alt text.",
    path: ["alt"],
  });

export type LocalizedText = z.infer<typeof localizedTextSchema>;
export type LocalizedSEO = z.infer<typeof localizedSeoSchema>;
export type AssetRef = z.infer<typeof assetRefSchema>;
