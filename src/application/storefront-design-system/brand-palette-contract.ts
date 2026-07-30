import { z } from "zod";
import { brandSystemSchema } from "@/domain/design-system";
import { localizedTextSchema } from "@/domain/shared";

export const brandColourTokenSchema = z.enum([
  "primary",
  "secondary",
  "accent",
  "background",
  "surface",
  "text",
  "mutedText",
  "border",
]);

export const exactBrandPalettePlanSchema = z
  .object({
    colors: brandSystemSchema.shape.colors,
    requestedTokens: z.array(brandColourTokenSchema).min(1),
    correctedTokens: z.array(brandColourTokenSchema),
    warnings: z.array(localizedTextSchema),
    source: z.enum(["hex", "named", "mixed", "existing"]),
  })
  .strict();

export type BrandColourToken = z.infer<typeof brandColourTokenSchema>;
export type ExactBrandPalettePlan = z.infer<typeof exactBrandPalettePlanSchema>;
