import { z } from "zod";
import { storefrontIndustrySchema } from "@/domain/design-brief";
import { brandSystemSchema } from "@/domain/design-system";
import { idSchema } from "@/domain/shared";

export const BRAND_FOUNDATION_PLAN_SCHEMA_VERSION = 1 as const;
export const BRAND_FOUNDATION_PLANNER_SOURCE_VERSION = "brand-foundation-planner-v1" as const;

export const brandFoundationPlanStatusSchema = z.enum(["ready", "ready-with-warnings", "blocked"]);
export type BrandFoundationPlanStatus = z.infer<typeof brandFoundationPlanStatusSchema>;

export const localizedPlanCopySchema = z
  .object({ en: z.string().trim().min(1).max(1_000), fi: z.string().trim().min(1).max(1_000) })
  .strict();
export type LocalizedPlanCopy = z.infer<typeof localizedPlanCopySchema>;

export const brandFoundationWarningSchema = z
  .object({
    code: z.string().trim().min(3).max(80),
    severity: z.enum(["warning", "info"]),
    message: localizedPlanCopySchema,
  })
  .strict();
export type BrandFoundationWarning = z.infer<typeof brandFoundationWarningSchema>;

const provenanceSourceSchema = z.enum([
  "merchant-preference",
  "accessibility",
  "visual-style-preset",
  "typography-preference",
  "generation-preference",
  "controlled-default",
]);

export const brandFoundationProvenanceEntrySchema = z
  .object({ source: provenanceSourceSchema, detail: localizedPlanCopySchema })
  .strict();

export const brandFoundationProvenanceSchema = z
  .object({
    colors: brandFoundationProvenanceEntrySchema,
    typography: brandFoundationProvenanceEntrySchema,
    shape: brandFoundationProvenanceEntrySchema,
    spacing: brandFoundationProvenanceEntrySchema,
    imagery: brandFoundationProvenanceEntrySchema,
    voice: brandFoundationProvenanceEntrySchema,
  })
  .strict();
export type BrandFoundationProvenance = z.infer<typeof brandFoundationProvenanceSchema>;

export const brandFoundationPresetSchema = z
  .object({
    id: idSchema,
    version: z.literal(1),
    name: localizedPlanCopySchema,
    description: localizedPlanCopySchema,
    supportedVisualStyleDirections: z
      .array(z.enum(["minimal", "editorial", "luxury", "playful", "bold", "natural"]))
      .min(1),
    suitability: z
      .object({
        defaultRank: z.number().int().min(0),
        industryWeights: z
          .record(z.string().min(1), z.number().int().min(0).max(100))
          .superRefine((weights, context) => {
            Object.keys(weights).forEach((industry) => {
              if (!storefrontIndustrySchema.safeParse(industry).success) {
                context.addIssue({
                  code: "custom",
                  path: [industry],
                  message: "Suitability metadata must use a supported storefront industry.",
                });
              }
            });
          }),
      })
      .strict(),
    brandSystem: brandSystemSchema,
  })
  .strict();
export type BrandFoundationPreset = z.infer<typeof brandFoundationPresetSchema>;

export const brandFoundationPlanSchema = z
  .object({
    schemaVersion: z.literal(BRAND_FOUNDATION_PLAN_SCHEMA_VERSION),
    sourceVersion: z.literal(BRAND_FOUNDATION_PLANNER_SOURCE_VERSION),
    id: idSchema,
    briefId: idSchema,
    status: brandFoundationPlanStatusSchema,
    brandSystem: brandSystemSchema,
    selectedPresetId: idSchema,
    explanation: localizedPlanCopySchema,
    assumptions: z
      .object({
        en: z.array(z.string().trim().min(1).max(500)),
        fi: z.array(z.string().trim().min(1).max(500)),
      })
      .strict(),
    warnings: z.array(brandFoundationWarningSchema),
    provenance: brandFoundationProvenanceSchema,
  })
  .strict();
export type BrandFoundationPlan = z.infer<typeof brandFoundationPlanSchema>;

export class BrandFoundationPlannerError extends Error {
  readonly code: "invalid-brief" | "invalid-plan" | "invalid-preset";

  constructor(code: BrandFoundationPlannerError["code"], message: string) {
    super(message);
    this.name = "BrandFoundationPlannerError";
    this.code = code;
  }
}
