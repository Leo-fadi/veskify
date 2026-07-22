import { z } from "zod";
import {
  moneyDisplaySchema,
  productMediaPresentationSchema,
  unavailableCombinationSchema,
} from "@/domain/component-platform";
import { idSchema, localizedTextSchema } from "@/domain/shared";

export const enumeratedOptionSelectionSchema = z
  .object({
    groupId: idSchema,
    valueId: idSchema,
  })
  .strict();

export const textOptionEntrySchema = z
  .object({
    groupId: idSchema,
    value: z.string().max(500),
    valid: z.boolean(),
    validationMessages: z.array(z.string().trim().min(1)),
  })
  .strict();

export const productOptionSelectionStateSchema = z
  .object({
    selectedValues: z.array(enumeratedOptionSelectionSchema),
    textEntries: z.array(
      z
        .object({
          groupId: idSchema,
          value: z.string().max(500),
        })
        .strict(),
    ),
  })
  .strict();

export const productOptionSelectionIntentSchema = z.discriminatedUnion("type", [
  z
    .object({
      type: z.literal("selectEnumeratedValue"),
      groupId: idSchema,
      valueId: idSchema,
    })
    .strict(),
  z
    .object({
      type: z.literal("clearOptionalSelection"),
      groupId: idSchema,
    })
    .strict(),
  z
    .object({
      type: z.literal("enterTextOption"),
      groupId: idSchema,
      value: z.string().max(500),
    })
    .strict(),
  z
    .object({
      type: z.literal("clearTextOption"),
      groupId: idSchema,
    })
    .strict(),
  z.object({ type: z.literal("resetSelections") }).strict(),
]);

export const disabledOptionValueSchema = z
  .object({
    groupId: idSchema,
    valueId: idSchema,
    reasons: z
      .array(z.enum(["canonical", "dependency", "unavailableCombination", "resolver"]))
      .min(1),
  })
  .strict();

export const optionDependencyStateSchema = z
  .object({
    groupId: idSchema,
    satisfied: z.boolean(),
    unmetGroupIds: z.array(idSchema),
  })
  .strict();

export const productOptionWarningSchema = z
  .object({
    code: z.enum([
      "dependentSelectionCleared",
      "textEntryIncomplete",
      "canonicalResolutionUnavailable",
      "configurationUnavailable",
      "resolverWarning",
    ]),
    message: z.string().trim().min(1),
    groupId: idSchema.optional(),
  })
  .strict();

export const resolvedProductConfigurationSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("baseProduct") }).strict(),
  z.object({ kind: z.literal("variant"), variantId: idSchema }).strict(),
  z.object({ kind: z.literal("configuration"), configurationId: idSchema }).strict(),
]);

export const canonicalResolverDisabledValueSchema = z
  .object({
    groupId: idSchema,
    valueId: idSchema,
  })
  .strict();

export const canonicalProductConfigurationResultSchema = z
  .object({
    resolvedConfiguration: resolvedProductConfigurationSchema.optional(),
    purchasable: z.boolean(),
    price: moneyDisplaySchema.optional(),
    compareAtPrice: moneyDisplaySchema.optional(),
    availability: localizedTextSchema.optional(),
    mediaAssetIds: z.array(idSchema).optional(),
    disabledOptionValues: z.array(canonicalResolverDisabledValueSchema).default([]),
    warnings: z.array(z.string().trim().min(1)).default([]),
  })
  .strict()
  .superRefine((result, context) => {
    if (result.purchasable && result.resolvedConfiguration === undefined) {
      context.addIssue({
        code: "custom",
        message: "Purchasable resolver results require a canonical resolved configuration.",
        path: ["resolvedConfiguration"],
      });
    }
    const disabledKeys = result.disabledOptionValues.map(
      (value) => `${value.groupId}:${value.valueId}`,
    );
    if (new Set(disabledKeys).size !== disabledKeys.length) {
      context.addIssue({
        code: "custom",
        message: "Resolver-disabled option values must be unique.",
        path: ["disabledOptionValues"],
      });
    }
    if (
      result.mediaAssetIds !== undefined &&
      new Set(result.mediaAssetIds).size !== result.mediaAssetIds.length
    ) {
      context.addIssue({
        code: "custom",
        message: "Resolved media references must be unique.",
        path: ["mediaAssetIds"],
      });
    }
  });

export const canonicalProductConfigurationInputSchema = z
  .object({
    productId: idSchema,
    catalogueRevision: z.string().trim().min(1).max(120),
    selectedValues: z.array(enumeratedOptionSelectionSchema),
    textEntries: z.array(z.object({ groupId: idSchema, value: z.string().max(500) }).strict()),
  })
  .strict();

export const productOptionResolutionResultSchema = z
  .object({
    productId: idSchema,
    catalogueRevision: z.string().trim().min(1).max(120),
    selectedValues: z.array(enumeratedOptionSelectionSchema),
    textEntryValues: z.array(textOptionEntrySchema),
    incompleteRequiredGroupIds: z.array(idSchema),
    disabledOptionValues: z.array(disabledOptionValueSchema),
    unavailableCombinations: z.array(unavailableCombinationSchema),
    dependencyState: z.array(optionDependencyStateSchema),
    resolvedConfiguration: resolvedProductConfigurationSchema.optional(),
    displayedPrice: moneyDisplaySchema.optional(),
    displayedCompareAtPrice: moneyDisplaySchema.optional(),
    displayedAvailability: localizedTextSchema.optional(),
    selectedMediaReferences: z.array(productMediaPresentationSchema),
    validationWarnings: z.array(productOptionWarningSchema),
    canAddToCart: z.boolean(),
  })
  .strict();

export const productOptionResolutionErrorCodeSchema = z.enum([
  "INVALID_CONTEXT",
  "INVALID_INTENT",
  "STALE_RESULT",
  "UNKNOWN_GROUP",
  "UNKNOWN_VALUE",
  "WRONG_OPTION_KIND",
  "REQUIRED_SELECTION_CANNOT_BE_CLEARED",
  "DEPENDENCY_UNSATISFIED",
  "OPTION_DISABLED",
  "TEXT_CONSTRAINT_VIOLATION",
  "INVALID_SELECTION_STATE",
  "RESOLVER_FAILURE",
  "INVALID_RESOLVER_RESULT",
]);

export const productOptionResolutionErrorSchema = z
  .object({
    code: productOptionResolutionErrorCodeSchema,
    message: z.string().trim().min(1),
    groupId: idSchema.optional(),
    valueId: idSchema.optional(),
  })
  .strict();

export type DeepReadonly<T> = T extends (...args: never[]) => unknown
  ? T
  : T extends readonly (infer Item)[]
    ? readonly DeepReadonly<Item>[]
    : T extends object
      ? { readonly [Key in keyof T]: DeepReadonly<T[Key]> }
      : T;

export type ProductOptionSelectionIntent = z.infer<typeof productOptionSelectionIntentSchema>;
export type ProductOptionSelectionState = z.infer<typeof productOptionSelectionStateSchema>;
export type ProductOptionWarning = z.infer<typeof productOptionWarningSchema>;
export type CanonicalProductConfigurationInput = DeepReadonly<
  z.infer<typeof canonicalProductConfigurationInputSchema>
>;
export type CanonicalProductConfigurationResult = z.infer<
  typeof canonicalProductConfigurationResultSchema
>;
export type ProductOptionResolutionResult = DeepReadonly<
  z.infer<typeof productOptionResolutionResultSchema>
>;
export type ProductOptionResolutionError = z.infer<typeof productOptionResolutionErrorSchema>;
export type ProductOptionResolutionErrorCode = z.infer<
  typeof productOptionResolutionErrorCodeSchema
>;

export type CanonicalProductConfigurationResolver = {
  resolve(input: CanonicalProductConfigurationInput): unknown;
};

export type ProductOptionResolutionOutcome =
  | { readonly ok: true; readonly result: ProductOptionResolutionResult }
  | {
      readonly ok: false;
      readonly error: ProductOptionResolutionError;
      readonly result: ProductOptionResolutionResult | null;
    };
