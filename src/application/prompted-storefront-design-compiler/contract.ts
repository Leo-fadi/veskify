import { z } from "zod";
import { boundedStorefrontSynthesisExactSelectionSchema } from "@/application/bounded-storefront-synthesis";
import {
  promptedStorefrontCapabilityAuthorityReferenceSchema,
  promptedStorefrontPreferenceSemanticsSchema,
} from "@/application/prompted-storefront-design-intent";
import {
  wholeStorefrontApprovedAssetRoleSelectionsSchema,
  wholeStorefrontPageBlueprintSelectionOverridesSchema,
} from "@/application/whole-storefront-generation-plan";
import { designDnaSchema } from "@/domain/design-system";
import { canonicalValueFingerprint } from "@/domain/storefront";

export const COMPILED_PROMPTED_STOREFRONT_DESIGN_DECISION_V2 = "2.0.0" as const;
export const MAX_PROMPTED_STOREFRONT_COMPILER_CANDIDATES = 8_192 as const;

const fingerprintSchema = z.string().trim().min(1).max(240);
const referenceSchema = z.string().trim().min(1).max(240);
const boundedValueSchema = z.union([z.string(), z.number()]);

export const promptedStorefrontResolutionOutcomeSchema = z.enum([
  "accepted",
  "substituted",
  "rejected",
  "omitted",
  "defaulted",
]);

export const promptedStorefrontCompilerReasonCodeSchema = z.enum([
  "exact-current-authority",
  "highest-ranked-compatible",
  "higher-ranked-incompatible",
  "optional-compatible",
  "optional-unavailable",
  "avoided-selection",
  "registered-safe-default",
  "fixed-page-blueprint-order",
  "missing-approved-evidence",
  "missing-approved-asset",
  "incompatible-context",
  "unavailable-capability",
  "lower-ranked-compatible",
]);

export const promptedStorefrontResolutionDiagnosticSchema = z
  .object({
    preferencePath: z.string().trim().min(1).max(320),
    preferenceKey: referenceSchema,
    semantics: promptedStorefrontPreferenceSemanticsSchema,
    requestedRank: z.number().int().min(1).max(32).nullable(),
    requestedValue: boundedValueSchema.nullable(),
    outcome: promptedStorefrontResolutionOutcomeSchema,
    selectedAuthority: promptedStorefrontCapabilityAuthorityReferenceSchema.nullable(),
    reasonCode: promptedStorefrontCompilerReasonCodeSchema,
    authorityFingerprint: fingerprintSchema,
  })
  .strict();

const profileSelectionSchema = z
  .object({
    profileId: referenceSchema,
    authorityFingerprint: fingerprintSchema,
  })
  .strict();

const dynamicCommerceSelectionSchema = z
  .object({
    authorityFingerprint: fingerprintSchema,
    collectionArchetypeId: referenceSchema,
    searchArchetypeId: referenceSchema,
    searchExecution: z.literal("registered-presentation-fail-closed-runtime"),
    standardSimpleArchetypeId: referenceSchema,
    configurableArchetypeId: referenceSchema,
    galleryLedArchetypeId: referenceSchema,
    highConsiderationArchetypeId: referenceSchema,
    genericFallbackArchetypeId: referenceSchema,
    productTypeMappings: z
      .array(z.object({ productTypeId: referenceSchema, archetypeId: referenceSchema }).strict())
      .max(32),
  })
  .strict();

const promptedStorefrontCompiledDecisionMaterialSchema = z
  .object({
    contractVersion: z.literal(COMPILED_PROMPTED_STOREFRONT_DESIGN_DECISION_V2),
    identity: z
      .object({
        requestFingerprint: fingerprintSchema,
        promptFingerprint: fingerprintSchema,
        providerIntentFingerprint: fingerprintSchema,
        currentAuthorityFingerprint: fingerprintSchema,
        capabilityReferenceAuthorityFingerprint: fingerprintSchema,
        baseSnapshotId: referenceSchema,
        baseSnapshotRevision: z.number().int().nonnegative(),
      })
      .strict(),
    exactSelection: boundedStorefrontSynthesisExactSelectionSchema,
    designDna: z
      .object({
        directionId: referenceSchema,
        authorityFingerprint: fingerprintSchema,
        value: designDnaSchema,
      })
      .strict(),
    sharedFrame: z
      .object({
        profileId: referenceSchema,
        profileVersion: z.string().regex(/^\d+\.\d+\.\d+$/),
        authorityFingerprint: fingerprintSchema,
      })
      .strict(),
    profiles: z
      .object({
        homepage: profileSelectionSchema,
        collection: profileSelectionSchema,
        search: profileSelectionSchema,
        productDetail: profileSelectionSchema,
      })
      .strict(),
    dynamicCommerceSelection: dynamicCommerceSelectionSchema,
    pageBlueprintSelectionOverrides: wholeStorefrontPageBlueprintSelectionOverridesSchema,
    approvedAssetRoleSelections: wholeStorefrontApprovedAssetRoleSelectionsSchema,
    productCardAnatomyIds: z.array(referenceSchema).max(8),
    selectedCapabilityReferences: z
      .array(promptedStorefrontCapabilityAuthorityReferenceSchema)
      .max(160),
    staticContentSupportSelections: z.array(referenceSchema).max(40),
    utilityPresentationSelections: z.array(referenceSchema).max(24),
    narrative: z
      .object({
        homepageRoleSequence: z.array(referenceSchema).min(1).max(24),
        desktopPriority: z.array(referenceSchema).max(24),
        mobilePriority: z.array(referenceSchema).max(24),
      })
      .strict(),
    responsiveArtDirection: z
      .object({
        responsiveMode: referenceSchema,
        responsiveCapabilityKeys: z.array(referenceSchema).max(32),
        artDirectionCapabilityKeys: z.array(referenceSchema).max(32),
        approvedAssetRoleKeys: z.array(referenceSchema).max(32),
      })
      .strict(),
    evidenceBackedOmissions: z.array(referenceSchema).max(40),
    diagnostics: z.array(promptedStorefrontResolutionDiagnosticSchema).max(400),
    exactAuthorityFingerprints: z.array(fingerprintSchema).min(1).max(240),
    structuralFingerprint: fingerprintSchema,
    dynamicRoutePresentationFingerprint: fingerprintSchema,
  })
  .strict();

export const compiledPromptedStorefrontDesignDecisionV2Schema =
  promptedStorefrontCompiledDecisionMaterialSchema
    .extend({ compiledDecisionFingerprint: fingerprintSchema })
    .strict()
    .superRefine((decision, context) => {
      const { compiledDecisionFingerprint, ...material } = decision;
      const expected = compiledPromptedStorefrontDesignDecisionFingerprint(material);
      if (compiledDecisionFingerprint !== expected) {
        context.addIssue({
          code: "custom",
          path: ["compiledDecisionFingerprint"],
          message: "The compiled prompted storefront decision fingerprint is stale.",
        });
      }
    });

export type CompiledPromptedStorefrontDesignDecisionV2 = z.infer<
  typeof compiledPromptedStorefrontDesignDecisionV2Schema
>;
export type PromptedStorefrontResolutionDiagnostic = z.infer<
  typeof promptedStorefrontResolutionDiagnosticSchema
>;

export function compiledPromptedStorefrontDesignDecisionFingerprint(
  input: z.input<typeof promptedStorefrontCompiledDecisionMaterialSchema>,
): string {
  return `compiled-prompted-storefront-design-v2-${canonicalValueFingerprint(
    promptedStorefrontCompiledDecisionMaterialSchema.parse(input),
  )}`;
}

export const promptedStorefrontDesignCompilerErrorCodes = [
  "invalid-input",
  "stale-authority",
  "insufficient-material-intent",
  "contradictory-preferences",
  "unsatisfied-hard-preference",
  "no-compatible-selection",
  "candidate-budget-exceeded",
  "incompatible-component-selection",
  "invalid-bounded-parameter",
  "materialization-failed",
] as const;

export type PromptedStorefrontDesignCompilerErrorCode =
  (typeof promptedStorefrontDesignCompilerErrorCodes)[number];

export class PromptedStorefrontDesignCompilerError extends Error {
  constructor(
    readonly code: PromptedStorefrontDesignCompilerErrorCode,
    message: string,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = "PromptedStorefrontDesignCompilerError";
  }
}
