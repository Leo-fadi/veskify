import { z } from "zod";
import { idSchema } from "@/domain/shared";
import { canonicalValueString } from "@/domain/storefront";
import {
  legacyStorefrontTemplatePagePlanSchema,
  storefrontTemplatePagePlanSchema,
  type LegacyStorefrontTemplatePagePlan,
  type StorefrontTemplatePagePlan,
} from "./contract";
import { getTemplatePagePlan } from "./registry";

export const LEGACY_STOREFRONT_TEMPLATE_SELECTION_SCHEMA_VERSION = 2 as const;
export const STOREFRONT_TEMPLATE_SELECTION_SCHEMA_VERSION = 3 as const;

export const storefrontTemplateSelectionSourceSchema = z.enum(["recommended", "merchant-override"]);
export const storefrontTemplateSelectionStatusSchema = z.enum([
  "selected",
  "selected-with-warnings",
  "blocked",
]);

const localizedExplanationSchema = z
  .object({ en: z.string().trim().min(1), fi: z.string().trim().min(1) })
  .strict();

const selectionMessageSchema = z
  .object({ code: z.string().trim().min(1), message: z.string().trim().min(1) })
  .strict();

export const storefrontTemplateCandidateSchema = z
  .object({
    templateId: idSchema,
    score: z.number().int(),
    compatible: z.boolean(),
    reasonCodes: z.array(z.string().trim().min(1)),
    resolverWarnings: z.array(selectionMessageSchema),
    resolverErrors: z.array(selectionMessageSchema),
  })
  .strict();

const selectionPlanShape = {
  id: idSchema,
  briefId: idSchema,
  briefFingerprint: z.string().trim().min(1),
  selectedTemplateId: idSchema.nullable(),
  selectionSource: storefrontTemplateSelectionSourceSchema,
  status: storefrontTemplateSelectionStatusSchema,
  candidates: z.array(storefrontTemplateCandidateSchema),
  explanation: localizedExplanationSchema,
  assumptions: z.array(z.string().trim().min(1)),
  warnings: z.array(selectionMessageSchema),
  blockers: z.array(selectionMessageSchema),
} as const;

function validateSelectionPlanShape(
  plan: {
    selectedTemplateId: string | null;
    status: z.infer<typeof storefrontTemplateSelectionStatusSchema>;
    blockers: readonly unknown[];
  },
  context: z.RefinementCtx,
) {
  if (plan.status === "blocked" && plan.selectedTemplateId !== null) {
    context.addIssue({
      code: "custom",
      path: ["selectedTemplateId"],
      message: "A blocked selection cannot include a selected template.",
    });
  }
  if (plan.status !== "blocked" && plan.selectedTemplateId === null) {
    context.addIssue({
      code: "custom",
      path: ["selectedTemplateId"],
      message: "A selected plan must include a template.",
    });
  }
  if (plan.status === "blocked" && plan.blockers.length === 0) {
    context.addIssue({
      code: "custom",
      path: ["blockers"],
      message: "A blocked selection must explain its blockers.",
    });
  }
}

export const currentStorefrontTemplateSelectionPlanSchema = z
  .object({
    ...selectionPlanShape,
    schemaVersion: z.literal(STOREFRONT_TEMPLATE_SELECTION_SCHEMA_VERSION),
    resolvedPagePlans: z.array(storefrontTemplatePagePlanSchema),
  })
  .strict()
  .superRefine(validateSelectionPlanShape);

const legacyStorefrontTemplateSelectionPlanSchema = z
  .object({
    ...selectionPlanShape,
    schemaVersion: z.literal(LEGACY_STOREFRONT_TEMPLATE_SELECTION_SCHEMA_VERSION),
    resolvedPagePlans: z.array(legacyStorefrontTemplatePagePlanSchema),
  })
  .strict()
  .superRefine(validateSelectionPlanShape);

/** Accepts persisted v2 selections only so they can be deterministically migrated. */
export const storefrontTemplateSelectionPlanSchema = z.union([
  currentStorefrontTemplateSelectionPlanSchema,
  legacyStorefrontTemplateSelectionPlanSchema,
]);

export type StorefrontTemplateSelectionSource = z.infer<
  typeof storefrontTemplateSelectionSourceSchema
>;
export type StorefrontTemplateSelectionStatus = z.infer<
  typeof storefrontTemplateSelectionStatusSchema
>;
export type StorefrontTemplateCandidate = z.infer<typeof storefrontTemplateCandidateSchema>;
export type StorefrontTemplateSelectionPlan = z.infer<
  typeof currentStorefrontTemplateSelectionPlanSchema
>;
type LegacyStorefrontTemplateSelectionPlan = z.infer<
  typeof legacyStorefrontTemplateSelectionPlanSchema
>;
type PersistedStorefrontTemplateSelectionPlan = z.infer<
  typeof storefrontTemplateSelectionPlanSchema
>;

export class StorefrontTemplateSelectionMigrationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "StorefrontTemplateSelectionMigrationError";
  }
}

function legacyExecutionIdentity(
  plan: StorefrontTemplatePagePlan,
): LegacyStorefrontTemplatePagePlan {
  return legacyStorefrontTemplatePagePlanSchema.parse({
    pageType: plan.pageType,
    slots: plan.slots.map(
      ({
        id,
        required,
        sectionType,
        allowedVariants,
        defaultVariant,
        label,
        purpose,
        omitWhen,
      }) => ({
        id,
        required,
        sectionType,
        allowedVariants,
        defaultVariant,
        label,
        purpose,
        omitWhen,
      }),
    ),
  });
}

function migrateLegacySelectionPlan(
  legacy: LegacyStorefrontTemplateSelectionPlan,
): StorefrontTemplateSelectionPlan {
  const resolvedPagePlans = legacy.resolvedPagePlans.map((plan) => {
    if (!legacy.selectedTemplateId) {
      throw new StorefrontTemplateSelectionMigrationError(
        "A legacy blocked selection cannot contain resolved page plans.",
      );
    }
    const registered = getTemplatePagePlan(legacy.selectedTemplateId, plan.pageType);
    if (
      !registered ||
      canonicalValueString(plan) !== canonicalValueString(legacyExecutionIdentity(registered))
    ) {
      throw new StorefrontTemplateSelectionMigrationError(
        `Legacy ${plan.pageType} plan no longer matches registered template ${legacy.selectedTemplateId}.`,
      );
    }
    return structuredClone(registered);
  });
  return currentStorefrontTemplateSelectionPlanSchema.parse({
    ...legacy,
    schemaVersion: STOREFRONT_TEMPLATE_SELECTION_SCHEMA_VERSION,
    resolvedPagePlans,
  });
}

export function cloneStorefrontTemplateSelectionPlan(
  input: StorefrontTemplateSelectionPlan,
): StorefrontTemplateSelectionPlan {
  return deepFreeze(structuredClone(currentStorefrontTemplateSelectionPlanSchema.parse(input)));
}

export function validateStorefrontTemplateSelectionPlan(
  input: unknown,
): StorefrontTemplateSelectionPlan {
  const parsed: PersistedStorefrontTemplateSelectionPlan =
    storefrontTemplateSelectionPlanSchema.parse(input);
  const current =
    parsed.schemaVersion === LEGACY_STOREFRONT_TEMPLATE_SELECTION_SCHEMA_VERSION
      ? migrateLegacySelectionPlan(parsed)
      : parsed;
  return cloneStorefrontTemplateSelectionPlan(current);
}

function deepFreeze<T>(value: T): T {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    Object.values(value as Record<string, unknown>).forEach((entry) => deepFreeze(entry));
  }
  return value;
}
