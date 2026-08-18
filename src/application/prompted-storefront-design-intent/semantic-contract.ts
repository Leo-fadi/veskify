import { z } from "zod";
import { canonicalValueFingerprint } from "@/domain/storefront";

export const SEMANTIC_STOREFRONT_DESIGN_REQUEST_V1 =
  "prompted-storefront-semantic-request-v1" as const;
export const SEMANTIC_STOREFRONT_DESIGN_INTENT_V1 =
  "prompted-storefront-semantic-intent-v1" as const;
export const DERIVED_SEMANTIC_CAPABILITY_INDEX_V1 = "derived-semantic-capability-index-v1" as const;
export const SEMANTIC_INFLUENCE_AUTHORITY_V1 = "semantic-influence-authority-v1" as const;

const fingerprintSchema = z.string().trim().min(1).max(240);
const boundedTextSchema = z.string().trim().min(1).max(500);
const safeKeySchema = z.string().trim().min(1).max(120);

export const commercialPostureSchema = z.enum([
  "premium-editorial",
  "modern-technical",
  "minimal-commerce",
  "warm-approachable",
  "bold-campaign",
  "catalogue-comparison",
  "high-consideration",
  "fast-conversion",
]);
export const densityPostureSchema = z.enum(["low", "balanced", "high"]);
export const mediaEmphasisSchema = z.enum(["restrained", "balanced", "image-led"]);
export const navigationPostureSchema = z.enum(["editorial", "catalogue", "compact", "minimal"]);
export const storyCatalogueBalanceSchema = z.enum(["story-first", "balanced", "catalogue-first"]);
export const collectionDiscoveryPostureSchema = z.enum([
  "editorial",
  "catalogue-comparison",
  "campaign",
  "dense-search",
]);
export const configurableProductPostureSchema = z.enum(["standard", "guided", "technical"]);
export const semanticPageFamilySchema = z.enum([
  "about",
  "contact-locations",
  "faq",
  "service-policy",
  "campaign-landing",
  "generic-content",
]);
export const mobileHierarchySchema = z.enum([
  "story-led",
  "product-led",
  "conversion-led",
  "balanced",
]);
export const semanticProviderDriverPaths = [
  "commercialPosture",
  "globalVisualIntent.density",
  "sharedFrameIntent.navigationPosture",
  "homepageIntent.storyCatalogueBalance",
  "collectionIntent.discoveryPosture",
  "pdpIntent.configurableProductPosture",
  "responsiveAndArtDirectionIntent.mobileHierarchy",
  "responsiveAndArtDirectionIntent.imageProminence",
] as const;
export const semanticProviderDriverPathSchema = z.enum(semanticProviderDriverPaths);
export type SemanticProviderDriverPath = z.infer<typeof semanticProviderDriverPathSchema>;
export const semanticInfluenceModeSchema = z.enum([
  "direct",
  "compound-driver",
  "derived",
  "substitution-only",
  "unavailable",
]);
export const semanticInfluenceReasonCodeSchema = z.enum([
  "independent-exact-axis",
  "coupled-axis-provider-driver",
  "derived-from-compound-axis",
  "correlated-candidate-substitution",
  "single-compatible-exact-value",
]);

const semanticInfluenceRelationshipSchema = z
  .object({
    exactAxisId: safeKeySchema,
    mode: semanticInfluenceModeSchema,
    reasonCode: semanticInfluenceReasonCodeSchema,
    providerDriverPath: semanticProviderDriverPathSchema.nullable(),
    coupledExactAxisIds: z.array(safeKeySchema).max(16),
    semanticValueCount: z.number().int().nonnegative(),
    exactValueCount: z.number().int().nonnegative(),
  })
  .strict();

export const semanticInfluenceAuthorityMaterialSchema = z
  .object({
    contractVersion: z.literal(SEMANTIC_INFLUENCE_AUTHORITY_V1),
    sampleCount: z.number().int().positive(),
    fields: z
      .array(
        z
          .object({
            path: semanticProviderDriverPathSchema,
            supportedValues: z.array(safeKeySchema).min(1).max(16),
            relationships: z.array(semanticInfluenceRelationshipSchema).min(1).max(8),
            fieldAuthorityFingerprint: fingerprintSchema,
          })
          .strict(),
      )
      .length(semanticProviderDriverPaths.length),
  })
  .strict()
  .superRefine((authority, context) => {
    if (
      new Set(authority.fields.map(({ path }) => path)).size !== semanticProviderDriverPaths.length
    ) {
      context.addIssue({
        code: "custom",
        path: ["fields"],
        message: "Every semantic influence field requires exactly one authority row.",
      });
    }
    const driversByAxis = new Map<string, Set<string>>();
    for (const field of authority.fields) {
      const { fieldAuthorityFingerprint, ...fieldMaterial } = field;
      if (
        fieldAuthorityFingerprint !==
        `semantic-influence-field-${canonicalValueFingerprint(fieldMaterial)}`
      ) {
        context.addIssue({
          code: "custom",
          path: ["fields"],
          message: "A semantic influence field fingerprint is stale.",
        });
      }
      for (const relationship of field.relationships) {
        if (
          new Set(relationship.coupledExactAxisIds).size !==
            relationship.coupledExactAxisIds.length ||
          relationship.coupledExactAxisIds.includes(relationship.exactAxisId) ||
          relationship.coupledExactAxisIds.some(
            (axis, index) => index > 0 && axis < relationship.coupledExactAxisIds[index - 1],
          )
        ) {
          context.addIssue({
            code: "custom",
            path: ["fields"],
            message: "Coupled exact axes must be unique, sorted collateral axes.",
          });
        }
        if (
          relationship.mode !== "compound-driver" &&
          relationship.coupledExactAxisIds.length > 0
        ) {
          context.addIssue({
            code: "custom",
            path: ["fields"],
            message: "Only a compound relationship may retain coupled exact axes.",
          });
        }
        const drives = relationship.mode === "direct" || relationship.mode === "compound-driver";
        if (
          (drives || relationship.mode === "derived") &&
          relationship.providerDriverPath !== field.path
        ) {
          context.addIssue({
            code: "custom",
            path: ["fields"],
            message: "A causal relationship must name its owning semantic driver.",
          });
        }
        if (
          (relationship.mode === "substitution-only" || relationship.mode === "unavailable") &&
          relationship.providerDriverPath !== null
        ) {
          context.addIssue({
            code: "custom",
            path: ["fields"],
            message: "A non-causal relationship cannot claim a provider driver.",
          });
        }
        if (relationship.providerDriverPath === null) continue;
        const drivers = driversByAxis.get(relationship.exactAxisId) ?? new Set<string>();
        drivers.add(relationship.providerDriverPath);
        driversByAxis.set(relationship.exactAxisId, drivers);
      }
    }
    if ([...driversByAxis.values()].some((drivers) => drivers.size > 1)) {
      context.addIssue({
        code: "custom",
        path: ["fields"],
        message: "An exact influence axis may have only one provider driver.",
      });
    }
  });

export const semanticInfluenceAuthoritySchema = semanticInfluenceAuthorityMaterialSchema.safeExtend(
  { authorityFingerprint: fingerprintSchema },
);
export type SemanticInfluenceAuthority = z.infer<typeof semanticInfluenceAuthoritySchema>;
export type SemanticInfluenceAuthorityMaterial = z.infer<
  typeof semanticInfluenceAuthorityMaterialSchema
>;

export function semanticInfluenceAuthorityFingerprint(
  material: SemanticInfluenceAuthorityMaterial,
): string {
  return `semantic-influence-authority-${canonicalValueFingerprint(
    semanticInfluenceAuthorityMaterialSchema.parse(material),
  )}`;
}

export const semanticStorefrontAtomCount = new Set(
  [
    commercialPostureSchema,
    densityPostureSchema,
    mediaEmphasisSchema,
    navigationPostureSchema,
    storyCatalogueBalanceSchema,
    collectionDiscoveryPostureSchema,
    configurableProductPostureSchema,
    mobileHierarchySchema,
  ].flatMap((schema) => schema.options),
).size;

const explicitConstraintFieldSchema = z.enum([
  "commercial-posture",
  "shared-frame-family",
  "required-evidence",
  "required-asset-role",
]);
export const serverVerifiedConstraintSchema = z
  .object({
    clauseReference: safeKeySchema,
    field: explicitConstraintFieldSchema,
    value: safeKeySchema,
    semantics: z.enum(["hard", "avoid"]),
  })
  .strict();

export const trustedExactHintsSchema = z
  .object({
    directionPackageId: safeKeySchema.nullable(),
    frameFamilyId: safeKeySchema.nullable(),
  })
  .strict();

const aggregateRangeSchema = z
  .object({ minimum: z.number().int().nonnegative(), maximum: z.number().int().nonnegative() })
  .strict();
const aggregateCatalogueSchema = z
  .object({
    productCount: z.number().int().nonnegative(),
    collectionCount: z.number().int().nonnegative(),
    productTypeCount: z.number().int().nonnegative(),
    simpleProductCount: z.number().int().nonnegative(),
    configurableProductCount: z.number().int().nonnegative(),
    highConsiderationProductCount: z.number().int().nonnegative(),
    optionGroupCountRange: aggregateRangeSchema,
    mediaDepthRange: aggregateRangeSchema,
  })
  .strict();

export const semanticStorefrontDesignRequestV1MaterialSchema = z
  .object({
    contractVersion: z.literal(SEMANTIC_STOREFRONT_DESIGN_REQUEST_V1),
    requestFingerprint: fingerprintSchema,
    promptFingerprint: fingerprintSchema,
    currentAuthorityFingerprint: fingerprintSchema,
    semanticAuthorityFingerprint: fingerprintSchema,
    merchantPrompt: z
      .string()
      .min(1)
      .max(12_000)
      .refine((value) => value.trim().length > 0, "A merchant prompt cannot be blank."),
    merchantContext: z
      .object({
        locale: z.enum(["en", "fi"]),
        industry: z.string().trim().min(1).max(120),
        approvedBrandDirection: z.string().trim().min(1).max(240),
      })
      .strict(),
    catalogueCharacteristics: aggregateCatalogueSchema,
    evidenceAvailability: z
      .object({ approvedFamilies: z.array(semanticPageFamilySchema).max(6) })
      .strict(),
    assetAvailability: z
      .object({
        approvedRoleCount: z.number().int().nonnegative(),
        editorialOrBrandImageryAvailable: z.boolean(),
        responsiveTreatmentAvailable: z.boolean(),
      })
      .strict(),
    supportedPageFamilies: z.array(semanticPageFamilySchema).max(6),
    explicitConstraintAuthority: z.array(serverVerifiedConstraintSchema).max(8),
    trustedExactHints: trustedExactHintsSchema,
    fixedRuntimeTruth: z
      .object({
        commerce: z.literal("read-only"),
        canonicalMedia: z.literal("protected"),
        searchExecution: z.literal("canonical-transient-query-results"),
      })
      .strict(),
    semanticInfluenceAuthority: semanticInfluenceAuthoritySchema,
  })
  .strict();
export const semanticStorefrontDesignRequestV1Schema =
  semanticStorefrontDesignRequestV1MaterialSchema;
export type SemanticStorefrontDesignRequestV1 = z.infer<
  typeof semanticStorefrontDesignRequestV1Schema
>;

export const semanticStorefrontDesignIntentV1MaterialSchema = z
  .object({
    contractVersion: z.literal(SEMANTIC_STOREFRONT_DESIGN_INTENT_V1),
    requestFingerprint: fingerprintSchema,
    promptFingerprint: fingerprintSchema,
    currentAuthorityFingerprint: fingerprintSchema,
    semanticAuthorityFingerprint: fingerprintSchema,
    designConceptSummary: boundedTextSchema,
    commercialPosture: commercialPostureSchema,
    globalVisualIntent: z
      .object({
        density: densityPostureSchema,
      })
      .strict(),
    sharedFrameIntent: z
      .object({
        navigationPosture: navigationPostureSchema,
      })
      .strict(),
    homepageIntent: z
      .object({
        storyCatalogueBalance: storyCatalogueBalanceSchema,
      })
      .strict(),
    collectionIntent: z
      .object({
        discoveryPosture: collectionDiscoveryPostureSchema,
      })
      .strict(),
    pdpIntent: z
      .object({
        configurableProductPosture: configurableProductPostureSchema,
      })
      .strict(),
    responsiveAndArtDirectionIntent: z
      .object({
        mobileHierarchy: mobileHierarchySchema,
        imageProminence: mediaEmphasisSchema,
      })
      .strict(),
  })
  .strict();

export const semanticStorefrontDesignIntentV1Schema =
  semanticStorefrontDesignIntentV1MaterialSchema.safeExtend({
    semanticIntentFingerprint: fingerprintSchema,
  });
export type SemanticStorefrontDesignIntentV1 = z.infer<
  typeof semanticStorefrontDesignIntentV1Schema
>;
export type SemanticStorefrontDesignIntentV1Material = z.infer<
  typeof semanticStorefrontDesignIntentV1MaterialSchema
>;

export function semanticStorefrontDesignIntentFingerprint(
  material: SemanticStorefrontDesignIntentV1Material,
): string {
  return `semantic-storefront-intent-${canonicalValueFingerprint(
    semanticStorefrontDesignIntentV1MaterialSchema.parse(material),
  )}`;
}

export type SemanticStorefrontDesignIntentValidationContext = Readonly<{
  currentAuthorityFingerprint: () => string;
  semanticAuthorityFingerprint: () => string;
}>;

export interface SemanticStorefrontDesignIntentProvider {
  readonly id: string;
  readonly modelId: string | null;
  createDesignIntent(
    request: SemanticStorefrontDesignRequestV1,
    validation: SemanticStorefrontDesignIntentValidationContext,
  ): Promise<SemanticStorefrontDesignIntentV1>;
}
