import { z } from "zod";
import { brandSystemSchema, type BrandSystem } from "@/domain/design-system";
import { exactBrandPalettePlanSchema } from "./brand-palette-contract";

export const registeredTokenRefinementPlanSchema = z
  .object({
    palette: exactBrandPalettePlanSchema.nullable(),
    typography: brandSystemSchema.shape.typography.nullable(),
    spacing: brandSystemSchema.shape.spacing.nullable(),
    preservePageStructure: z.literal(true),
    preserveComponentVariants: z.literal(true),
    preserveApprovedAssets: z.literal(true),
    preserveCanonicalCommerce: z.literal(true),
  })
  .strict()
  .superRefine((plan, context) => {
    if (plan.palette === null && plan.typography === null && plan.spacing === null) {
      context.addIssue({
        code: "custom",
        path: ["palette"],
        message: "A token-only refinement must change colours, typography, or spacing.",
      });
    }
  });

export type RegisteredTokenRefinementPlan = z.infer<typeof registeredTokenRefinementPlanSchema>;

export function applyRegisteredTokenRefinement(
  baseline: BrandSystem,
  plan: RegisteredTokenRefinementPlan,
): BrandSystem {
  return brandSystemSchema.parse({
    ...structuredClone(baseline),
    ...(plan.palette === null ? {} : { colors: structuredClone(plan.palette.colors) }),
    ...(plan.typography === null ? {} : { typography: structuredClone(plan.typography) }),
    ...(plan.spacing === null ? {} : { spacing: structuredClone(plan.spacing) }),
  });
}
