import { z } from "zod";
import { canonicalValueFingerprint } from "@/domain/storefront";

export const PROMPTED_STOREFRONT_DESIGN_REQUEST_V2 = "2.0.0" as const;
export const PROMPTED_STOREFRONT_CAPABILITY_PROJECTION_VERSION = "1.0.0" as const;

const fingerprintSchema = z.string().min(1).max(240);
const stableKeySchema = z
  .string()
  .min(3)
  .max(200)
  .regex(/^[a-z][A-Za-z0-9]*(?:[._-][A-Za-z0-9]+)*$/);
const safeTextSchema = z.string().min(1).max(500);

function compareCanonical(left: string, right: string): number {
  return left === right ? 0 : left < right ? -1 : 1;
}

export const promptedStorefrontCapabilityDimensions = [
  "design-dna.typography-pairing",
  "design-dna.typography-hierarchy",
  "design-dna.typography-scale",
  "design-dna.spacing",
  "design-dna.density",
  "design-dna.surface",
  "design-dna.depth",
  "design-dna.control",
  "design-dna.shape",
  "design-dna.media",
  "design-dna.colour",
  "shared-frame.profile",
  "shared-frame.header",
  "shared-frame.navigation",
  "shared-frame.announcement",
  "shared-frame.utility-navigation",
  "shared-frame.footer",
  "shared-frame.mobile-navigation",
  "shared-frame.responsive",
  "homepage.profile",
  "homepage.narrative-role",
  "homepage.component-family",
  "homepage.meaningful-variant",
  "homepage.section-count",
  "homepage.section-rhythm",
  "homepage.asset-role",
  "collection-search.archetype",
  "collection-search.discovery",
  "collection-search.density",
  "collection-search.filter-sort",
  "collection-search.child-collection",
  "collection-search.merchandising",
  "collection-search.product-card",
  "collection-search.search-relationship",
  "pdp.archetype",
  "pdp.product-type",
  "pdp.option-complexity",
  "pdp.media",
  "pdp.purchase-hierarchy",
  "pdp.related-merchandising",
  "pdp.product-card",
  "content-support.profile",
  "content-support.narrative-purpose",
  "content-support.omission",
  "utility.profile",
  "component.family",
  "component.meaningful-variant",
  "component.bounded-parameter",
  "responsive.posture",
  "responsive.mobile-hierarchy",
  "responsive.density",
  "responsive.image",
  "responsive.crop",
  "responsive.overlay",
  "responsive.asset-role",
] as const;

export const promptedStorefrontCapabilityDimensionSchema = z.enum(
  promptedStorefrontCapabilityDimensions,
);
export type PromptedStorefrontCapabilityDimension = z.infer<
  typeof promptedStorefrontCapabilityDimensionSchema
>;

export const promptedStorefrontCapabilityAvailabilitySchema = z.enum([
  "available",
  "evidence-dependent",
  "registered-fail-closed",
  "unavailable",
]);
export type PromptedStorefrontCapabilityAvailability = z.infer<
  typeof promptedStorefrontCapabilityAvailabilitySchema
>;

export const promptedStorefrontCapabilityIntentRoleSchema = z.enum([
  "pdp-standard-simple",
  "pdp-configurable",
  "pdp-gallery-led",
  "pdp-high-consideration",
  "pdp-generic-fallback",
]);
export type PromptedStorefrontCapabilityIntentRole = z.infer<
  typeof promptedStorefrontCapabilityIntentRoleSchema
>;

export const promptedStorefrontCapabilitySelectionSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("capability") }).strict(),
  z
    .object({ kind: z.literal("enum"), allowedValues: z.array(safeTextSchema).min(1).max(32) })
    .strict(),
  z
    .object({
      kind: z.literal("number"),
      minimum: z.number().finite(),
      maximum: z.number().finite(),
    })
    .strict()
    .refine(({ minimum, maximum }) => minimum <= maximum, { path: ["maximum"] }),
]);

export const promptedStorefrontCapabilityEntrySchema = z
  .object({
    key: stableKeySchema,
    dimension: promptedStorefrontCapabilityDimensionSchema,
    description: safeTextSchema,
    contexts: z.array(stableKeySchema).min(1).max(16),
    availability: promptedStorefrontCapabilityAvailabilitySchema,
    requirements: z.array(safeTextSchema).max(12),
    selection: promptedStorefrontCapabilitySelectionSchema,
  })
  .strict();

const searchCapabilityStateSchema = z
  .object({
    registration: z.literal("registered-presentation-authority"),
    execution: z.literal("unavailable"),
    behavior: z.literal("fail-closed"),
    reason: z.literal("missing-canonical-search-results-adapter"),
  })
  .strict();

const promptedStorefrontCapabilityProjectionMaterialSchema = z
  .object({
    version: z.literal(PROMPTED_STOREFRONT_CAPABILITY_PROJECTION_VERSION),
    capabilities: z.array(promptedStorefrontCapabilityEntrySchema).min(1).max(800),
    search: searchCapabilityStateSchema,
  })
  .strict();

export const promptedStorefrontCapabilityProjectionSchema =
  promptedStorefrontCapabilityProjectionMaterialSchema
    .extend({ fingerprint: fingerprintSchema })
    .strict()
    .superRefine((projection, context) => {
      const keys = projection.capabilities.map(({ key }) => key);
      if (new Set(keys).size !== keys.length) {
        context.addIssue({
          code: "custom",
          path: ["capabilities"],
          message: "Provider capability preference keys must be unique.",
        });
      }
      const canonical = [...projection.capabilities].sort((left, right) =>
        compareCanonical(`${left.dimension}:${left.key}`, `${right.dimension}:${right.key}`),
      );
      if (canonical.some((entry, index) => entry.key !== projection.capabilities[index]?.key)) {
        context.addIssue({
          code: "custom",
          path: ["capabilities"],
          message: "Provider capabilities must use deterministic dimension/key ordering.",
        });
      }
      const expected = promptedStorefrontCapabilityProjectionFingerprint({
        version: projection.version,
        capabilities: projection.capabilities,
        search: projection.search,
      });
      if (projection.fingerprint !== expected) {
        context.addIssue({
          code: "custom",
          path: ["fingerprint"],
          message: "Provider capability projection fingerprint is stale.",
        });
      }
    });

export type PromptedStorefrontCapabilityEntry = z.infer<
  typeof promptedStorefrontCapabilityEntrySchema
>;
export type PromptedStorefrontCapabilityProjection = z.infer<
  typeof promptedStorefrontCapabilityProjectionSchema
>;

export function promptedStorefrontCapabilityProjectionFingerprint(
  material: z.input<typeof promptedStorefrontCapabilityProjectionMaterialSchema>,
): string {
  return `prompted-capability-projection-${canonicalValueFingerprint(
    promptedStorefrontCapabilityProjectionMaterialSchema.parse(material),
  )}`;
}

export const promptedStorefrontCapabilityAuthorityReferenceSchema = z
  .object({
    key: stableKeySchema,
    dimension: promptedStorefrontCapabilityDimensionSchema,
    availability: promptedStorefrontCapabilityAvailabilitySchema,
    authorityKind: z.enum([
      "commercial-grammar",
      "design-dna",
      "shared-frame",
      "page-blueprint",
      "component-manifest",
      "dynamic-commerce",
      "product-card",
      "approved-evidence",
      "approved-assets",
      "catalogue",
    ]),
    authorityId: z.string().min(1).max(240),
    authorityFingerprint: fingerprintSchema,
    selection: promptedStorefrontCapabilitySelectionSchema,
    productTypeKey: z.boolean(),
    intentRoles: z.array(promptedStorefrontCapabilityIntentRoleSchema).max(5).optional(),
  })
  .strict();
export type PromptedStorefrontCapabilityAuthorityReference = z.infer<
  typeof promptedStorefrontCapabilityAuthorityReferenceSchema
>;

export function promptedStorefrontCapabilityReferenceAuthorityFingerprint(
  references: Iterable<PromptedStorefrontCapabilityAuthorityReference>,
): string {
  const material = [...references]
    .map((reference) => {
      const parsed = promptedStorefrontCapabilityAuthorityReferenceSchema.parse(reference);
      return {
        ...parsed,
        ...(parsed.intentRoles
          ? { intentRoles: [...parsed.intentRoles].sort(compareCanonical) }
          : {}),
      };
    })
    .sort((left, right) => compareCanonical(left.key, right.key));
  return `prompted-capability-reference-authority-${canonicalValueFingerprint(material)}`;
}

export type PromptedStorefrontCapabilityAuthority = Readonly<{
  projection: PromptedStorefrontCapabilityProjection;
  referencesByPreferenceKey: ReadonlyMap<string, PromptedStorefrontCapabilityAuthorityReference>;
}>;

export const promptedStorefrontCurrentAuthorityIdentitySchema = z
  .object({
    projectId: z.string().min(1).max(160),
    projectRevision: z.number().int().nonnegative(),
    draftSnapshotId: z.string().min(1).max(160),
    draftRevision: z.number().int().nonnegative(),
    storefrontSnapshotFingerprint: fingerprintSchema,
    dynamicCommercePresentationFingerprint: fingerprintSchema,
    capabilityManifestFingerprint: fingerprintSchema,
    pageBlueprintAuthorityFingerprint: fingerprintSchema,
    designDnaAuthorityFingerprint: fingerprintSchema,
    approvedBriefFingerprint: fingerprintSchema,
    approvedBriefEvidenceFingerprint: fingerprintSchema,
    approvedAssetAuthorityFingerprint: fingerprintSchema.nullable(),
    canonicalCommerceAuthorityFingerprint: fingerprintSchema,
    catalogueProjectionFingerprint: fingerprintSchema,
    capabilityProjectionFingerprint: fingerprintSchema,
    capabilityReferenceAuthorityFingerprint: fingerprintSchema,
  })
  .strict();
export type PromptedStorefrontCurrentAuthorityIdentity = z.infer<
  typeof promptedStorefrontCurrentAuthorityIdentitySchema
>;

const approvedMerchantContextSchema = z
  .object({
    businessName: z.string().min(1).max(120),
    industry: z.string().min(1).max(120).nullable(),
    approvedBrandSummary: z.string().min(1).max(2_000),
    targetCustomer: z.string().min(1).max(500),
    primaryMarket: z.string().min(1).max(120),
    approvedToneOrVisualPriorities: z.array(z.string().min(1).max(500)).max(24),
    supportedLocales: z
      .array(z.enum(["en", "fi"]))
      .min(1)
      .max(2),
    excludedClaimsOrUnsupportedRequirements: z.array(z.string().min(1).max(500)).max(32),
  })
  .strict();

export const catalogueProductTypeCharacteristicSchema = z
  .object({
    productTypeKey: stableKeySchema,
    safeLabel: z.string().min(1).max(80),
    productCount: z.number().int().nonnegative(),
    simpleProductCount: z.number().int().nonnegative(),
    configurableProductCount: z.number().int().nonnegative(),
    optionGroupCountRange: z
      .object({ minimum: z.number().int().nonnegative(), maximum: z.number().int().nonnegative() })
      .strict(),
    mediaDepthRange: z
      .object({ minimum: z.number().int().positive(), maximum: z.number().int().positive() })
      .strict(),
    highConsiderationPresentationCount: z.number().int().nonnegative(),
  })
  .strict();

const countDistributionSchema = z
  .object({
    none: z.number().int().nonnegative(),
    one: z.number().int().nonnegative(),
    twoToThree: z.number().int().nonnegative(),
    fourOrMore: z.number().int().nonnegative(),
  })
  .strict();

export const promptedStorefrontCatalogueCharacteristicsSchema = z
  .object({
    productCount: z.number().int().nonnegative(),
    collectionCount: z.number().int().nonnegative(),
    productTypes: z.array(catalogueProductTypeCharacteristicSchema).max(32),
    simpleProductCount: z.number().int().nonnegative(),
    configurableProductCount: z.number().int().nonnegative(),
    optionGroupComplexity: countDistributionSchema,
    mediaDepth: countDistributionSchema,
    highConsiderationPresentationCount: z.number().int().nonnegative(),
    collectionMembershipSize: z
      .object({
        minimum: z.number().int().nonnegative(),
        maximum: z.number().int().nonnegative(),
        averageRounded: z.number().int().nonnegative(),
      })
      .strict(),
    collectionHierarchy: z
      .object({ depth: z.literal("unavailable"), childCollections: z.literal("unavailable") })
      .strict(),
  })
  .strict();

const approvedEvidenceAndAssetsSchema = z
  .object({
    approvedEvidenceFamilies: z.array(stableKeySchema).max(16),
    approvedPresentationAssetRoles: z.array(stableKeySchema).max(16),
    editorialOrBrandImageryAvailable: z.boolean(),
    responsiveAssetTreatmentAvailable: z.boolean(),
    evidenceDependentCapabilityKeys: z.array(stableKeySchema).max(800),
    unresolvedSafeOmissions: z.array(z.string().min(1).max(500)).max(32),
  })
  .strict();

const priorDiversityEvidenceSchema = z
  .object({
    recentAcceptedStructuralFingerprints: z.array(fingerprintSchema).max(20),
    recentRejectedStructuralFingerprints: z.array(fingerprintSchema).max(20),
    recentlyUsedPostureKeys: z.array(stableKeySchema).max(40),
    merchantAvoidancePreferenceKeys: z.array(stableKeySchema).max(40),
  })
  .strict();

export const promptedStorefrontDesignRequestV2MaterialSchema = z
  .object({
    contractVersion: z.literal(PROMPTED_STOREFRONT_DESIGN_REQUEST_V2),
    requestId: z.string().min(1).max(240),
    merchantPrompt: z
      .string()
      .min(1)
      .max(12_000)
      .refine((value) => value.trim().length > 0, "A merchant prompt cannot be blank."),
    promptFingerprint: fingerprintSchema,
    currentAuthority: promptedStorefrontCurrentAuthorityIdentitySchema,
    approvedMerchantContext: approvedMerchantContextSchema,
    catalogueCharacteristics: promptedStorefrontCatalogueCharacteristicsSchema,
    evidenceAndAssets: approvedEvidenceAndAssetsSchema,
    capabilityProjection: promptedStorefrontCapabilityProjectionSchema,
    priorDiversityEvidence: priorDiversityEvidenceSchema,
  })
  .strict();

export const promptedStorefrontDesignRequestV2Schema =
  promptedStorefrontDesignRequestV2MaterialSchema
    .extend({ requestFingerprint: fingerprintSchema })
    .strict()
    .superRefine((request, context) => {
      const expectedPrompt = promptedStorefrontPromptFingerprint(request.merchantPrompt);
      if (request.promptFingerprint !== expectedPrompt) {
        context.addIssue({
          code: "custom",
          path: ["promptFingerprint"],
          message: "The exact merchant prompt fingerprint is stale.",
        });
      }
      if (
        request.currentAuthority.capabilityProjectionFingerprint !==
        request.capabilityProjection.fingerprint
      ) {
        context.addIssue({
          code: "custom",
          path: ["currentAuthority", "capabilityProjectionFingerprint"],
          message: "The request capability projection authority is stale.",
        });
      }
      const material = {
        contractVersion: request.contractVersion,
        requestId: request.requestId,
        merchantPrompt: request.merchantPrompt,
        promptFingerprint: request.promptFingerprint,
        currentAuthority: request.currentAuthority,
        approvedMerchantContext: request.approvedMerchantContext,
        catalogueCharacteristics: request.catalogueCharacteristics,
        evidenceAndAssets: request.evidenceAndAssets,
        capabilityProjection: request.capabilityProjection,
        priorDiversityEvidence: request.priorDiversityEvidence,
      };
      if (request.requestFingerprint !== promptedStorefrontDesignRequestFingerprint(material)) {
        context.addIssue({
          code: "custom",
          path: ["requestFingerprint"],
          message: "The prompted storefront request fingerprint is stale.",
        });
      }
    });

export type PromptedStorefrontDesignRequestV2 = z.infer<
  typeof promptedStorefrontDesignRequestV2Schema
>;

export function promptedStorefrontPromptFingerprint(prompt: string): string {
  return `prompted-storefront-prompt-${canonicalValueFingerprint(prompt)}`;
}

export function promptedStorefrontDesignRequestFingerprint(
  material: z.input<typeof promptedStorefrontDesignRequestV2MaterialSchema>,
): string {
  return `prompted-storefront-request-${canonicalValueFingerprint(
    promptedStorefrontDesignRequestV2MaterialSchema.parse(material),
  )}`;
}

export const promptedStorefrontPreferenceSemanticsSchema = z.enum([
  "hard",
  "soft",
  "optional",
  "avoid",
]);
export type PromptedStorefrontPreferenceSemantics = z.infer<
  typeof promptedStorefrontPreferenceSemanticsSchema
>;

export const promptedStorefrontDesignIntentFailureCodes = [
  "invalid-request",
  "unsupported-contract-version",
  "malformed-output",
  "strict-schema-invalid",
  "request-fingerprint-mismatch",
  "prompt-fingerprint-mismatch",
  "unknown-capability",
  "wrong-capability-dimension",
  "unavailable-capability",
  "invalid-bounded-parameter",
  "unknown-product-type",
  "route-instance-reference",
  "executable-content",
  "protected-content",
  "stale-authority",
  "provider-refusal",
  "provider-timeout",
  "provider-transport",
  "credentials-unavailable",
] as const;
export type PromptedStorefrontDesignIntentFailureCode =
  (typeof promptedStorefrontDesignIntentFailureCodes)[number];

export type PromptedStorefrontDesignIntentSafeDiagnostic = Readonly<{
  kind: "schema-validation";
  issueCount: number;
  issueCodes: readonly string[];
  issuePaths: readonly string[];
  fingerprint: string;
}>;

export class PromptedStorefrontDesignIntentError extends Error {
  constructor(
    readonly code: PromptedStorefrontDesignIntentFailureCode,
    readonly safeDiagnostic?: PromptedStorefrontDesignIntentSafeDiagnostic,
  ) {
    super(`Prompted storefront design intent failed: ${code}.`);
    this.name = "PromptedStorefrontDesignIntentError";
  }
}
