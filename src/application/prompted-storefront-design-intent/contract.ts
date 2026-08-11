import { z } from "zod";
import { containsExecutableContent } from "@/application/design-safety/executable-content";
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
const safeConceptTextSchema = (maximum: number) =>
  z
    .string()
    .min(1)
    .max(maximum)
    .refine((value) => value.trim().length > 0, "Design concept text cannot be blank.");

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
    evidenceDependentCapabilityKeys: z.array(stableKeySchema).max(100),
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

export const promptedStorefrontCapabilityPreferenceSchema = z
  .object({
    key: stableKeySchema,
    dimension: promptedStorefrontCapabilityDimensionSchema,
    semantics: promptedStorefrontPreferenceSemanticsSchema,
    rank: z.number().int().min(1).max(32).nullable(),
  })
  .strict()
  .superRefine((preference, context) => {
    if ((preference.semantics === "soft") !== (preference.rank !== null)) {
      context.addIssue({
        code: "custom",
        path: ["rank"],
        message: "Soft preferences require a rank and other preference semantics do not.",
      });
    }
  });

const promptedStorefrontCapabilityReferenceSchema = z
  .object({ key: stableKeySchema, dimension: promptedStorefrontCapabilityDimensionSchema })
  .strict();

const preferenceListSchema = z.array(promptedStorefrontCapabilityPreferenceSchema).max(32);
const referenceListSchema = z.array(promptedStorefrontCapabilityReferenceSchema).max(32);

const boundedParameterPreferenceSchema = z
  .object({
    key: stableKeySchema,
    dimension: z.literal("component.bounded-parameter"),
    semantics: promptedStorefrontPreferenceSemanticsSchema,
    rank: z.number().int().min(1).max(32).nullable(),
    value: z.union([z.string().min(1).max(160), z.number().finite()]),
  })
  .strict()
  .superRefine((preference, context) => {
    if ((preference.semantics === "soft") !== (preference.rank !== null)) {
      context.addIssue({
        code: "custom",
        path: ["rank"],
        message: "Soft parameter preferences require a rank and other semantics do not.",
      });
    }
  });

export const promptedStorefrontDesignIntentV2MaterialSchema = z
  .object({
    contractVersion: z.literal(PROMPTED_STOREFRONT_DESIGN_REQUEST_V2),
    requestFingerprint: fingerprintSchema,
    promptFingerprint: fingerprintSchema,
    concept: z
      .object({
        summary: safeConceptTextSchema(500),
        commercialPosture: safeConceptTextSchema(240),
        intendedCustomerExperience: safeConceptTextSchema(500),
      })
      .strict(),
    constraints: z
      .object({
        hard: preferenceListSchema,
        soft: preferenceListSchema,
        optional: preferenceListSchema,
        avoid: preferenceListSchema,
      })
      .strict(),
    designDna: z.object({ preferences: preferenceListSchema }).strict(),
    sharedFrame: z.object({ preferences: preferenceListSchema }).strict(),
    homepage: z
      .object({
        profilePreferences: preferenceListSchema,
        narrativeRoleSequence: referenceListSchema,
        requiredRoles: referenceListSchema,
        preferredRoles: referenceListSchema,
        optionalRoles: referenceListSchema,
        avoidedRoles: referenceListSchema,
        componentFamilyPreferences: preferenceListSchema,
        meaningfulVariantPreferences: preferenceListSchema,
        sectionCount: z
          .object({
            key: stableKeySchema,
            dimension: z.literal("homepage.section-count"),
            minimum: z.number().int().min(1).max(24),
            ideal: z.number().int().min(1).max(24),
            maximum: z.number().int().min(1).max(24),
          })
          .strict()
          .refine(({ minimum, ideal, maximum }) => minimum <= ideal && ideal <= maximum, {
            path: ["ideal"],
          }),
        sectionRhythmPreferences: preferenceListSchema,
        evidenceDependentOmission: z.enum(["omit", "fail-closed"]),
        approvedAssetRolePreferences: preferenceListSchema,
      })
      .strict(),
    collectionSearch: z
      .object({
        archetypePreferences: preferenceListSchema,
        discoveryPreferences: preferenceListSchema,
        densityPreferences: preferenceListSchema,
        filterSortPreferences: preferenceListSchema,
        childCollectionPreferences: preferenceListSchema,
        merchandisingPreferences: preferenceListSchema,
        productCardPreferences: preferenceListSchema,
        searchRelationshipPreferences: preferenceListSchema,
        searchExecutionExpectation: z.literal("registered-presentation-fail-closed-runtime"),
      })
      .strict(),
    productDetail: z
      .object({
        standardSimplePreferences: preferenceListSchema,
        configurablePreferences: preferenceListSchema,
        galleryLedPreferences: preferenceListSchema,
        highConsiderationPreferences: preferenceListSchema,
        genericFallbackPreferences: preferenceListSchema,
        productTypeIntentions: z
          .array(
            z
              .object({
                productTypeKey: stableKeySchema,
                preferences: preferenceListSchema.min(1),
              })
              .strict(),
          )
          .max(32),
        optionComplexityPreferences: preferenceListSchema,
        mediaPreferences: preferenceListSchema,
        purchaseDecisionHierarchyPreferences: preferenceListSchema,
        relatedMerchandisingPreferences: preferenceListSchema,
        productCardPreferences: preferenceListSchema,
      })
      .strict(),
    contentSupport: z
      .object({
        pageFamilyPreferences: preferenceListSchema,
        narrativePurposePreferences: preferenceListSchema,
        evidenceRequirements: referenceListSchema,
        safeOmissionBehavior: z.enum(["omit", "fail-closed"]),
      })
      .strict(),
    components: z
      .object({
        familyPreferences: preferenceListSchema,
        meaningfulVariantPreferences: preferenceListSchema,
        boundedParameterPreferences: z.array(boundedParameterPreferenceSchema).max(32),
      })
      .strict(),
    responsiveArtDirection: z
      .object({
        responsivePosturePreferences: preferenceListSchema,
        mobileHierarchyPreferences: preferenceListSchema,
        densityTransformationPreferences: preferenceListSchema,
        desktopNarrativePriority: referenceListSchema,
        mobileNarrativePriority: referenceListSchema,
        imagePosturePreferences: preferenceListSchema,
        cropFocalPreferences: preferenceListSchema,
        overlayPreferences: preferenceListSchema,
        approvedMediaRolePreferences: preferenceListSchema,
      })
      .strict(),
  })
  .strict()
  .superRefine((intent, context) => {
    for (const [field, semantics] of [
      ["hard", "hard"],
      ["soft", "soft"],
      ["optional", "optional"],
      ["avoid", "avoid"],
    ] as const) {
      intent.constraints[field].forEach((preference, index) => {
        if (preference.semantics !== semantics) {
          context.addIssue({
            code: "custom",
            path: ["constraints", field, index, "semantics"],
            message: `The ${field} constraint collection requires ${semantics} semantics.`,
          });
        }
      });
    }

    const preferenceCollections: Array<{
      path: readonly (string | number)[];
      values: readonly Readonly<{
        key: string;
        semantics: PromptedStorefrontPreferenceSemantics;
        rank: number | null;
      }>[];
    }> = [
      { path: ["constraints", "hard"], values: intent.constraints.hard },
      { path: ["constraints", "soft"], values: intent.constraints.soft },
      { path: ["constraints", "optional"], values: intent.constraints.optional },
      { path: ["constraints", "avoid"], values: intent.constraints.avoid },
      { path: ["designDna", "preferences"], values: intent.designDna.preferences },
      { path: ["sharedFrame", "preferences"], values: intent.sharedFrame.preferences },
      { path: ["homepage", "profilePreferences"], values: intent.homepage.profilePreferences },
      {
        path: ["homepage", "componentFamilyPreferences"],
        values: intent.homepage.componentFamilyPreferences,
      },
      {
        path: ["homepage", "meaningfulVariantPreferences"],
        values: intent.homepage.meaningfulVariantPreferences,
      },
      {
        path: ["homepage", "sectionRhythmPreferences"],
        values: intent.homepage.sectionRhythmPreferences,
      },
      {
        path: ["homepage", "approvedAssetRolePreferences"],
        values: intent.homepage.approvedAssetRolePreferences,
      },
      {
        path: ["collectionSearch", "archetypePreferences"],
        values: intent.collectionSearch.archetypePreferences,
      },
      {
        path: ["collectionSearch", "discoveryPreferences"],
        values: intent.collectionSearch.discoveryPreferences,
      },
      {
        path: ["collectionSearch", "densityPreferences"],
        values: intent.collectionSearch.densityPreferences,
      },
      {
        path: ["collectionSearch", "filterSortPreferences"],
        values: intent.collectionSearch.filterSortPreferences,
      },
      {
        path: ["collectionSearch", "childCollectionPreferences"],
        values: intent.collectionSearch.childCollectionPreferences,
      },
      {
        path: ["collectionSearch", "merchandisingPreferences"],
        values: intent.collectionSearch.merchandisingPreferences,
      },
      {
        path: ["collectionSearch", "productCardPreferences"],
        values: intent.collectionSearch.productCardPreferences,
      },
      {
        path: ["collectionSearch", "searchRelationshipPreferences"],
        values: intent.collectionSearch.searchRelationshipPreferences,
      },
      {
        path: ["productDetail", "standardSimplePreferences"],
        values: intent.productDetail.standardSimplePreferences,
      },
      {
        path: ["productDetail", "configurablePreferences"],
        values: intent.productDetail.configurablePreferences,
      },
      {
        path: ["productDetail", "galleryLedPreferences"],
        values: intent.productDetail.galleryLedPreferences,
      },
      {
        path: ["productDetail", "highConsiderationPreferences"],
        values: intent.productDetail.highConsiderationPreferences,
      },
      {
        path: ["productDetail", "genericFallbackPreferences"],
        values: intent.productDetail.genericFallbackPreferences,
      },
      {
        path: ["productDetail", "optionComplexityPreferences"],
        values: intent.productDetail.optionComplexityPreferences,
      },
      {
        path: ["productDetail", "mediaPreferences"],
        values: intent.productDetail.mediaPreferences,
      },
      {
        path: ["productDetail", "purchaseDecisionHierarchyPreferences"],
        values: intent.productDetail.purchaseDecisionHierarchyPreferences,
      },
      {
        path: ["productDetail", "relatedMerchandisingPreferences"],
        values: intent.productDetail.relatedMerchandisingPreferences,
      },
      {
        path: ["productDetail", "productCardPreferences"],
        values: intent.productDetail.productCardPreferences,
      },
      {
        path: ["contentSupport", "pageFamilyPreferences"],
        values: intent.contentSupport.pageFamilyPreferences,
      },
      {
        path: ["contentSupport", "narrativePurposePreferences"],
        values: intent.contentSupport.narrativePurposePreferences,
      },
      { path: ["components", "familyPreferences"], values: intent.components.familyPreferences },
      {
        path: ["components", "meaningfulVariantPreferences"],
        values: intent.components.meaningfulVariantPreferences,
      },
      {
        path: ["components", "boundedParameterPreferences"],
        values: intent.components.boundedParameterPreferences,
      },
      {
        path: ["responsiveArtDirection", "responsivePosturePreferences"],
        values: intent.responsiveArtDirection.responsivePosturePreferences,
      },
      {
        path: ["responsiveArtDirection", "mobileHierarchyPreferences"],
        values: intent.responsiveArtDirection.mobileHierarchyPreferences,
      },
      {
        path: ["responsiveArtDirection", "densityTransformationPreferences"],
        values: intent.responsiveArtDirection.densityTransformationPreferences,
      },
      {
        path: ["responsiveArtDirection", "imagePosturePreferences"],
        values: intent.responsiveArtDirection.imagePosturePreferences,
      },
      {
        path: ["responsiveArtDirection", "cropFocalPreferences"],
        values: intent.responsiveArtDirection.cropFocalPreferences,
      },
      {
        path: ["responsiveArtDirection", "overlayPreferences"],
        values: intent.responsiveArtDirection.overlayPreferences,
      },
      {
        path: ["responsiveArtDirection", "approvedMediaRolePreferences"],
        values: intent.responsiveArtDirection.approvedMediaRolePreferences,
      },
    ];
    intent.productDetail.productTypeIntentions.forEach((intention, index) => {
      preferenceCollections.push({
        path: ["productDetail", "productTypeIntentions", index, "preferences"],
        values: intention.preferences,
      });
    });

    const semanticsByKey = new Map<string, PromptedStorefrontPreferenceSemantics>();
    for (const collection of preferenceCollections) {
      const keys = new Set<string>();
      const softRanks = new Set<number>();
      collection.values.forEach((preference, index) => {
        if (keys.has(preference.key)) {
          context.addIssue({
            code: "custom",
            path: [...collection.path, index, "key"],
            message: "A capability key may appear only once within a preference list.",
          });
        }
        keys.add(preference.key);
        if (preference.semantics === "soft" && preference.rank !== null) {
          if (softRanks.has(preference.rank)) {
            context.addIssue({
              code: "custom",
              path: [...collection.path, index, "rank"],
              message: "Soft preference ranks must be unique within a ranked list.",
            });
          }
          softRanks.add(preference.rank);
        }
        const priorSemantics = semanticsByKey.get(preference.key);
        if (priorSemantics !== undefined && priorSemantics !== preference.semantics) {
          context.addIssue({
            code: "custom",
            path: [...collection.path, index, "semantics"],
            message: "A capability key cannot use contradictory semantics across one intent.",
          });
        } else {
          semanticsByKey.set(preference.key, preference.semantics);
        }
      });
    }

    const referenceCollections = [
      {
        path: ["homepage", "narrativeRoleSequence"],
        values: intent.homepage.narrativeRoleSequence,
      },
      { path: ["homepage", "requiredRoles"], values: intent.homepage.requiredRoles },
      { path: ["homepage", "preferredRoles"], values: intent.homepage.preferredRoles },
      { path: ["homepage", "optionalRoles"], values: intent.homepage.optionalRoles },
      { path: ["homepage", "avoidedRoles"], values: intent.homepage.avoidedRoles },
      {
        path: ["contentSupport", "evidenceRequirements"],
        values: intent.contentSupport.evidenceRequirements,
      },
      {
        path: ["responsiveArtDirection", "desktopNarrativePriority"],
        values: intent.responsiveArtDirection.desktopNarrativePriority,
      },
      {
        path: ["responsiveArtDirection", "mobileNarrativePriority"],
        values: intent.responsiveArtDirection.mobileNarrativePriority,
      },
    ] as const;
    for (const collection of referenceCollections) {
      const keys = new Set<string>();
      collection.values.forEach((reference, index) => {
        if (keys.has(reference.key)) {
          context.addIssue({
            code: "custom",
            path: [...collection.path, index, "key"],
            message: "A capability key may appear only once within a reference list.",
          });
        }
        keys.add(reference.key);
      });
    }

    const implicitRoleSemantics = [
      {
        path: ["homepage", "narrativeRoleSequence"] as const,
        values: intent.homepage.narrativeRoleSequence,
        semantics: "hard" as const,
      },
      {
        path: ["homepage", "requiredRoles"] as const,
        values: intent.homepage.requiredRoles,
        semantics: "hard" as const,
      },
      {
        path: ["homepage", "preferredRoles"] as const,
        values: intent.homepage.preferredRoles,
        semantics: "soft" as const,
      },
      {
        path: ["homepage", "optionalRoles"] as const,
        values: intent.homepage.optionalRoles,
        semantics: "optional" as const,
      },
      {
        path: ["homepage", "avoidedRoles"] as const,
        values: intent.homepage.avoidedRoles,
        semantics: "avoid" as const,
      },
      {
        path: ["responsiveArtDirection", "desktopNarrativePriority"] as const,
        values: intent.responsiveArtDirection.desktopNarrativePriority,
        semantics: "hard" as const,
      },
      {
        path: ["responsiveArtDirection", "mobileNarrativePriority"] as const,
        values: intent.responsiveArtDirection.mobileNarrativePriority,
        semantics: "hard" as const,
      },
    ];
    const roleSemanticsByKey = new Map<string, Set<PromptedStorefrontPreferenceSemantics>>();
    semanticsByKey.forEach((semantics, key) => roleSemanticsByKey.set(key, new Set([semantics])));
    const contradicts = (
      left: PromptedStorefrontPreferenceSemantics,
      right: PromptedStorefrontPreferenceSemantics,
    ) =>
      left !== right &&
      (left === "avoid" ||
        right === "avoid" ||
        (left === "hard" && right === "optional") ||
        (left === "optional" && right === "hard"));
    for (const collection of implicitRoleSemantics) {
      collection.values.forEach((reference, index) => {
        const current = roleSemanticsByKey.get(reference.key) ?? new Set();
        if ([...current].some((semantics) => contradicts(semantics, collection.semantics))) {
          context.addIssue({
            code: "custom",
            path: [...collection.path, index, "key"],
            message: "A narrative role cannot carry contradictory requirement semantics.",
          });
        }
        current.add(collection.semantics);
        roleSemanticsByKey.set(reference.key, current);
      });
    }

    const coreCoverage = [
      { path: ["designDna", "preferences"] as const, count: intent.designDna.preferences.length },
      {
        path: ["sharedFrame", "preferences"] as const,
        count: intent.sharedFrame.preferences.length,
      },
      {
        path: ["homepage"] as const,
        count:
          intent.homepage.profilePreferences.length +
          intent.homepage.narrativeRoleSequence.length +
          intent.homepage.componentFamilyPreferences.length +
          intent.homepage.meaningfulVariantPreferences.length,
      },
      {
        path: ["collectionSearch"] as const,
        count: Object.values(intent.collectionSearch).reduce(
          (total, value) => total + (Array.isArray(value) ? value.length : 0),
          0,
        ),
      },
      {
        path: ["productDetail"] as const,
        count:
          intent.productDetail.standardSimplePreferences.length +
          intent.productDetail.configurablePreferences.length +
          intent.productDetail.galleryLedPreferences.length +
          intent.productDetail.highConsiderationPreferences.length +
          intent.productDetail.genericFallbackPreferences.length +
          intent.productDetail.productTypeIntentions.reduce(
            (total, intention) => total + intention.preferences.length,
            0,
          ) +
          intent.productDetail.optionComplexityPreferences.length +
          intent.productDetail.mediaPreferences.length +
          intent.productDetail.purchaseDecisionHierarchyPreferences.length +
          intent.productDetail.relatedMerchandisingPreferences.length +
          intent.productDetail.productCardPreferences.length,
      },
      {
        path: ["components"] as const,
        count:
          intent.components.familyPreferences.length +
          intent.components.meaningfulVariantPreferences.length +
          intent.components.boundedParameterPreferences.length,
      },
      {
        path: ["responsiveArtDirection"] as const,
        count: Object.values(intent.responsiveArtDirection).reduce(
          (total, value) => total + value.length,
          0,
        ),
      },
    ];
    coreCoverage.forEach(({ path, count }) => {
      if (count === 0) {
        context.addIssue({
          code: "custom",
          path: [...path],
          message: "A prompted storefront design intent requires meaningful core-domain coverage.",
        });
      }
    });

    const productTypeKeys = new Set<string>();
    intent.productDetail.productTypeIntentions.forEach((intention, index) => {
      if (productTypeKeys.has(intention.productTypeKey)) {
        context.addIssue({
          code: "custom",
          path: ["productDetail", "productTypeIntentions", index, "productTypeKey"],
          message: "A product type may appear only once in a prompted storefront intent.",
        });
      }
      productTypeKeys.add(intention.productTypeKey);
    });

    if (containsExecutableContent(intent)) {
      context.addIssue({
        code: "custom",
        path: [],
        message: "Prompted storefront design intent cannot contain executable content.",
      });
    }
  });

export type PromptedStorefrontDesignIntentV2Material = z.infer<
  typeof promptedStorefrontDesignIntentV2MaterialSchema
>;

type NormalizablePreference = Readonly<{
  key: string;
  dimension: PromptedStorefrontCapabilityDimension;
  semantics: PromptedStorefrontPreferenceSemantics;
  rank: number | null;
}>;

type NormalizableReference = Readonly<{
  key: string;
  dimension: PromptedStorefrontCapabilityDimension;
}>;

const preferenceSemanticsOrder: Readonly<Record<PromptedStorefrontPreferenceSemantics, number>> = {
  hard: 0,
  soft: 1,
  optional: 2,
  avoid: 3,
};

function normalizedPreferenceList<T extends NormalizablePreference>(values: readonly T[]): T[] {
  return [...values].sort((left, right) => {
    const semantics =
      preferenceSemanticsOrder[left.semantics] - preferenceSemanticsOrder[right.semantics];
    if (semantics !== 0) return semantics;
    if (left.semantics === "soft" && right.semantics === "soft") {
      const rank = (left.rank ?? 0) - (right.rank ?? 0);
      if (rank !== 0) return rank;
    }
    return compareCanonical(`${left.dimension}:${left.key}`, `${right.dimension}:${right.key}`);
  });
}

function normalizedReferenceSet<T extends NormalizableReference>(values: readonly T[]): T[] {
  return [...values].sort((left, right) =>
    compareCanonical(`${left.dimension}:${left.key}`, `${right.dimension}:${right.key}`),
  );
}

function normalizeParsedPromptedStorefrontDesignIntentV2(
  material: PromptedStorefrontDesignIntentV2Material,
): PromptedStorefrontDesignIntentV2Material {
  return {
    ...material,
    constraints: {
      hard: normalizedPreferenceList(material.constraints.hard),
      soft: normalizedPreferenceList(material.constraints.soft),
      optional: normalizedPreferenceList(material.constraints.optional),
      avoid: normalizedPreferenceList(material.constraints.avoid),
    },
    designDna: { preferences: normalizedPreferenceList(material.designDna.preferences) },
    sharedFrame: { preferences: normalizedPreferenceList(material.sharedFrame.preferences) },
    homepage: {
      ...material.homepage,
      profilePreferences: normalizedPreferenceList(material.homepage.profilePreferences),
      narrativeRoleSequence: [...material.homepage.narrativeRoleSequence],
      requiredRoles: normalizedReferenceSet(material.homepage.requiredRoles),
      preferredRoles: normalizedReferenceSet(material.homepage.preferredRoles),
      optionalRoles: normalizedReferenceSet(material.homepage.optionalRoles),
      avoidedRoles: normalizedReferenceSet(material.homepage.avoidedRoles),
      componentFamilyPreferences: normalizedPreferenceList(
        material.homepage.componentFamilyPreferences,
      ),
      meaningfulVariantPreferences: normalizedPreferenceList(
        material.homepage.meaningfulVariantPreferences,
      ),
      sectionRhythmPreferences: normalizedPreferenceList(
        material.homepage.sectionRhythmPreferences,
      ),
      approvedAssetRolePreferences: normalizedPreferenceList(
        material.homepage.approvedAssetRolePreferences,
      ),
    },
    collectionSearch: {
      ...material.collectionSearch,
      archetypePreferences: normalizedPreferenceList(
        material.collectionSearch.archetypePreferences,
      ),
      discoveryPreferences: normalizedPreferenceList(
        material.collectionSearch.discoveryPreferences,
      ),
      densityPreferences: normalizedPreferenceList(material.collectionSearch.densityPreferences),
      filterSortPreferences: normalizedPreferenceList(
        material.collectionSearch.filterSortPreferences,
      ),
      childCollectionPreferences: normalizedPreferenceList(
        material.collectionSearch.childCollectionPreferences,
      ),
      merchandisingPreferences: normalizedPreferenceList(
        material.collectionSearch.merchandisingPreferences,
      ),
      productCardPreferences: normalizedPreferenceList(
        material.collectionSearch.productCardPreferences,
      ),
      searchRelationshipPreferences: normalizedPreferenceList(
        material.collectionSearch.searchRelationshipPreferences,
      ),
    },
    productDetail: {
      ...material.productDetail,
      standardSimplePreferences: normalizedPreferenceList(
        material.productDetail.standardSimplePreferences,
      ),
      configurablePreferences: normalizedPreferenceList(
        material.productDetail.configurablePreferences,
      ),
      galleryLedPreferences: normalizedPreferenceList(material.productDetail.galleryLedPreferences),
      highConsiderationPreferences: normalizedPreferenceList(
        material.productDetail.highConsiderationPreferences,
      ),
      genericFallbackPreferences: normalizedPreferenceList(
        material.productDetail.genericFallbackPreferences,
      ),
      productTypeIntentions: material.productDetail.productTypeIntentions
        .map((intention) => ({
          ...intention,
          preferences: normalizedPreferenceList(intention.preferences),
        }))
        .sort((left, right) => compareCanonical(left.productTypeKey, right.productTypeKey)),
      optionComplexityPreferences: normalizedPreferenceList(
        material.productDetail.optionComplexityPreferences,
      ),
      mediaPreferences: normalizedPreferenceList(material.productDetail.mediaPreferences),
      purchaseDecisionHierarchyPreferences: normalizedPreferenceList(
        material.productDetail.purchaseDecisionHierarchyPreferences,
      ),
      relatedMerchandisingPreferences: normalizedPreferenceList(
        material.productDetail.relatedMerchandisingPreferences,
      ),
      productCardPreferences: normalizedPreferenceList(
        material.productDetail.productCardPreferences,
      ),
    },
    contentSupport: {
      ...material.contentSupport,
      pageFamilyPreferences: normalizedPreferenceList(
        material.contentSupport.pageFamilyPreferences,
      ),
      narrativePurposePreferences: normalizedPreferenceList(
        material.contentSupport.narrativePurposePreferences,
      ),
      evidenceRequirements: normalizedReferenceSet(material.contentSupport.evidenceRequirements),
    },
    components: {
      familyPreferences: normalizedPreferenceList(material.components.familyPreferences),
      meaningfulVariantPreferences: normalizedPreferenceList(
        material.components.meaningfulVariantPreferences,
      ),
      boundedParameterPreferences: normalizedPreferenceList(
        material.components.boundedParameterPreferences,
      ),
    },
    responsiveArtDirection: {
      ...material.responsiveArtDirection,
      responsivePosturePreferences: normalizedPreferenceList(
        material.responsiveArtDirection.responsivePosturePreferences,
      ),
      mobileHierarchyPreferences: normalizedPreferenceList(
        material.responsiveArtDirection.mobileHierarchyPreferences,
      ),
      densityTransformationPreferences: normalizedPreferenceList(
        material.responsiveArtDirection.densityTransformationPreferences,
      ),
      desktopNarrativePriority: [...material.responsiveArtDirection.desktopNarrativePriority],
      mobileNarrativePriority: [...material.responsiveArtDirection.mobileNarrativePriority],
      imagePosturePreferences: normalizedPreferenceList(
        material.responsiveArtDirection.imagePosturePreferences,
      ),
      cropFocalPreferences: normalizedPreferenceList(
        material.responsiveArtDirection.cropFocalPreferences,
      ),
      overlayPreferences: normalizedPreferenceList(
        material.responsiveArtDirection.overlayPreferences,
      ),
      approvedMediaRolePreferences: normalizedPreferenceList(
        material.responsiveArtDirection.approvedMediaRolePreferences,
      ),
    },
  };
}

export function normalizePromptedStorefrontDesignIntentV2(
  material: z.input<typeof promptedStorefrontDesignIntentV2MaterialSchema>,
): PromptedStorefrontDesignIntentV2Material {
  return normalizeParsedPromptedStorefrontDesignIntentV2(
    promptedStorefrontDesignIntentV2MaterialSchema.parse(material),
  );
}

export const promptedStorefrontDesignIntentV2Schema = promptedStorefrontDesignIntentV2MaterialSchema
  .safeExtend({ intentFingerprint: fingerprintSchema })
  .strict()
  .superRefine((intent, context) => {
    const { intentFingerprint, ...material } = intent;
    if (intentFingerprint !== promptedStorefrontDesignIntentFingerprint(material)) {
      context.addIssue({
        code: "custom",
        path: ["intentFingerprint"],
        message: "The prompted storefront design intent fingerprint is stale.",
      });
    }
  });

export type PromptedStorefrontDesignIntentV2 = z.infer<
  typeof promptedStorefrontDesignIntentV2Schema
>;

export function promptedStorefrontDesignIntentFingerprint(
  material: z.input<typeof promptedStorefrontDesignIntentV2MaterialSchema>,
): string {
  return `prompted-storefront-design-intent-${canonicalValueFingerprint(
    normalizePromptedStorefrontDesignIntentV2(material),
  )}`;
}

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

export class PromptedStorefrontDesignIntentError extends Error {
  constructor(readonly code: PromptedStorefrontDesignIntentFailureCode) {
    super(`Prompted storefront design intent failed: ${code}.`);
    this.name = "PromptedStorefrontDesignIntentError";
  }
}

export type PromptedStorefrontDesignIntentValidationContext = Readonly<{
  capabilityAuthority: PromptedStorefrontCapabilityAuthority;
  currentAuthority: () => PromptedStorefrontCurrentAuthorityIdentity;
}>;

export interface PromptedStorefrontDesignIntentProvider {
  readonly id: string;
  readonly modelId: string | null;
  createDesignIntent(
    request: PromptedStorefrontDesignRequestV2,
    validation: PromptedStorefrontDesignIntentValidationContext,
  ): Promise<PromptedStorefrontDesignIntentV2>;
}
