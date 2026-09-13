import { z } from "zod";
import { storefrontDesignDirectionIdSchema } from "@/application/storefront-design-system";
import {
  commercialCollectionSearchProfileIdSchema,
  commercialHomepageProfileIdSchema,
  commercialPdpProfileIdSchema,
} from "@/application/storefront-templates";
import {
  canonicalValueFingerprint,
  commercialSharedFrameProfileIdSchema,
} from "@/domain/storefront";
import { dynamicCommerceDesignSelectionSchema } from "@/application/dynamic-commerce-routes";
import {
  wholeStorefrontApprovedAssetRoleSelectionsSchema,
  wholeStorefrontPageBlueprintSelectionOverridesSchema,
} from "@/application/whole-storefront-generation-plan/contract";

export const BOUNDED_STOREFRONT_SYNTHESIS_CONTRACT_VERSION = 2 as const;

const fingerprintSchema = z.string().trim().min(1).max(240);
const referenceSchema = z.string().trim().min(1).max(200);
const boundedValueSchema = z.union([z.string(), z.number(), z.boolean()]);

export const boundedStorefrontSynthesisIntentSchema = z.enum([
  "prompted-design-v2",
  "editorial-led",
  "commerce-led",
  "restrained-minimal",
  "dense-catalogue",
  "high-consideration",
  "campaign-emphasis",
  "stronger-brand-storytelling",
]);

export const boundedStorefrontSynthesisRequestSchema = z
  .object({
    intent: boundedStorefrontSynthesisIntentSchema,
    deterministicSeed: z.string().trim().min(1).max(120).default("canonical"),
  })
  .strict();

/**
 * Exact, already-governed narrowing supplied by a higher-level coordinated-direction authority.
 * Every value remains inside the existing P10B-15 registered selection vocabulary; the
 * synthesizer still resolves the current profile, frame, component and evidence authorities.
 */
export const boundedStorefrontSynthesisSelectionNarrowingSchema = z
  .object({
    authorityId: referenceSchema,
    authorityVersion: z.string().regex(/^\d+\.\d+\.\d+$/),
    authorityFingerprint: fingerprintSchema,
    selectionId: referenceSchema,
    directionId: storefrontDesignDirectionIdSchema,
    designSystemSpacingDensity: z.enum(["compact", "standard", "spacious"]),
    designSystemSurfaceDepth: z.enum(["flat", "subtle", "layered"]),
    sharedFrameProfileId: commercialSharedFrameProfileIdSchema,
    homepageProfileId: commercialHomepageProfileIdSchema,
    collectionProfileId: commercialCollectionSearchProfileIdSchema,
    searchProfileId: commercialCollectionSearchProfileIdSchema,
    pdpProfileId: commercialPdpProfileIdSchema,
    includedOptionalPageFamilyIds: z.array(referenceSchema).max(40),
    narrativePosture: z.enum([
      "story-led",
      "discovery-led",
      "restrained",
      "catalogue-dense",
      "considered-purchase",
      "campaign-led",
    ]),
    merchandisingPosture: z.enum([
      "curated",
      "discovery",
      "restrained",
      "dense",
      "considered",
      "campaign",
    ]),
    informationDensityPosture: z.enum(["compact", "balanced", "airy"]),
    artDirectionPosture: z.enum(["contained", "editorial", "immersive"]),
    responsiveMode: z.enum(["content-first", "commerce-first", "balanced"]),
  })
  .strict();

/**
 * Exact transient synthesis authority emitted by the prompted V2 compiler.
 * Unlike the compatibility-only coordinated-direction narrowing, this is not
 * a retained candidate/selection identity. It carries only the registered
 * values that canonical synthesis must execute.
 */
export const boundedStorefrontSynthesisExactSelectionSchema =
  boundedStorefrontSynthesisSelectionNarrowingSchema.omit({
    authorityId: true,
    authorityVersion: true,
    authorityFingerprint: true,
    selectionId: true,
  });

const narrativeRoleSchema = z.enum([
  "orientation",
  "primary-discovery",
  "secondary-discovery",
  "product-focus",
  "product-proof",
  "brand-story",
  "brand-proof",
  "education",
  "campaign",
  "trust",
  "service",
  "conversion",
  "continuation",
]);

const synthesisMaterialSchema = z
  .object({
    contractVersion: z.literal(BOUNDED_STOREFRONT_SYNTHESIS_CONTRACT_VERSION),
    request: boundedStorefrontSynthesisRequestSchema,
    merchantContextFingerprint: fingerprintSchema,
    approvedEvidenceRevisions: z.array(
      z
        .object({
          source: referenceSchema,
          authorityId: referenceSchema,
          revision: referenceSchema,
        })
        .strict(),
    ),
    commerceContextFingerprint: fingerprintSchema,
    assetAuthorityFingerprint: fingerprintSchema.nullable(),
    designDna: z
      .object({
        directionId: storefrontDesignDirectionIdSchema,
        spacingDensity: z.enum(["compact", "standard", "spacious"]),
        surfaceDepth: z.enum(["flat", "subtle", "layered"]),
        fingerprint: fingerprintSchema,
      })
      .strict(),
    siteMap: z
      .object({
        fingerprint: fingerprintSchema,
        pageSetFingerprint: fingerprintSchema,
        pageKeys: z.array(referenceSchema).min(1),
      })
      .strict(),
    sharedFrame: z
      .object({
        profileId: commercialSharedFrameProfileIdSchema,
        profileVersion: z.string().regex(/^\d+\.\d+\.\d+$/),
        authorityFingerprint: fingerprintSchema,
      })
      .strict(),
    commercialProfiles: z
      .object({
        homepageProfileId: commercialHomepageProfileIdSchema,
        collectionProfileId: commercialCollectionSearchProfileIdSchema,
        searchProfileId: commercialCollectionSearchProfileIdSchema,
        pdpProfileId: commercialPdpProfileIdSchema,
      })
      .strict(),
    pageProfileSelections: z.array(
      z
        .object({
          pageKey: referenceSchema,
          familyId: referenceSchema,
          profileId: referenceSchema,
          profileVersion: z.string().regex(/^\d+\.\d+\.\d+$/),
          profileFingerprint: fingerprintSchema,
          narrativeRoles: z.array(narrativeRoleSchema),
        })
        .strict(),
    ),
    narrative: z
      .object({
        posture: z.enum([
          "story-led",
          "discovery-led",
          "restrained",
          "catalogue-dense",
          "considered-purchase",
          "campaign-led",
        ]),
        roleSequence: z.array(narrativeRoleSchema).min(1),
        pageContributions: z.array(
          z.object({ pageKey: referenceSchema, roles: z.array(narrativeRoleSchema) }).strict(),
        ),
        discoveryPath: z.boolean(),
        conversionPath: z.boolean(),
      })
      .strict(),
    merchandisingPosture: z.enum([
      "curated",
      "discovery",
      "restrained",
      "dense",
      "considered",
      "campaign",
    ]),
    informationDensityPosture: z.enum(["compact", "balanced", "airy"]),
    artDirectionPosture: z.enum(["contained", "editorial", "immersive"]),
    componentChoices: z.array(
      z
        .object({
          pageKey: referenceSchema,
          slotId: referenceSchema,
          component: referenceSchema,
          variant: referenceSchema,
          anatomyId: referenceSchema.nullable(),
          transitionIntent: z.string().trim().min(1).max(80).optional(),
          capabilityFingerprint: fingerprintSchema,
        })
        .strict(),
    ),
    pageBlueprintSelectionOverrides: wholeStorefrontPageBlueprintSelectionOverridesSchema,
    approvedAssetRoleSelections: wholeStorefrontApprovedAssetRoleSelectionsSchema,
    dynamicCommerceSelection: dynamicCommerceDesignSelectionSchema.nullable(),
    exactSelectionAuthority: z
      .object({
        pageBlueprintSelectionFingerprint: fingerprintSchema,
        approvedAssetRoleSelectionFingerprint: fingerprintSchema,
        dynamicCommerceAuthorityFingerprint: fingerprintSchema.nullable(),
        dynamicCommerceSelectionFingerprint: fingerprintSchema.nullable(),
      })
      .strict(),
    boundedParameters: z.record(referenceSchema, boundedValueSchema),
    evidenceComposition: z
      .object({
        requiredPageKeys: z.array(referenceSchema),
        optionalPageKeys: z.array(referenceSchema),
        omittedPageKeys: z.array(referenceSchema),
      })
      .strict(),
    responsivePosture: z
      .object({
        breakpoints: z.tuple([z.literal(375), z.literal(768), z.literal(1024), z.literal(1440)]),
        mode: z.enum(["content-first", "commerce-first", "balanced"]),
      })
      .strict(),
    promptedExecutionAuthority: z
      .object({
        responsiveCapabilityKeys: z.array(referenceSchema).max(32),
        artDirectionCapabilityKeys: z.array(referenceSchema).max(32),
        approvedAssetRoleKeys: z.array(referenceSchema).max(32),
        desktopNarrativePriority: z.array(referenceSchema).max(24),
        mobileNarrativePriority: z.array(referenceSchema).max(24),
      })
      .strict()
      .nullable(),
    currentAuthority: z
      .object({
        wholeStorefrontTargetFingerprint: fingerprintSchema,
        componentRegistryFingerprint: fingerprintSchema,
        recipeContextFingerprint: fingerprintSchema,
      })
      .strict(),
    decisions: z.array(
      z
        .object({
          code: referenceSchema,
          outcome: referenceSchema,
          authorityReferences: z.array(referenceSchema),
        })
        .strict(),
    ),
  })
  .strict();

export const boundedStorefrontSynthesisDecisionSchema = synthesisMaterialSchema
  .extend({ synthesisFingerprint: fingerprintSchema })
  .strict()
  .superRefine((decision, context) => {
    const { synthesisFingerprint, ...material } = decision;
    const expected = `bounded-storefront-synthesis-${canonicalValueFingerprint(material)}`;
    if (synthesisFingerprint !== expected) {
      context.addIssue({
        code: "custom",
        path: ["synthesisFingerprint"],
        message: "The bounded storefront synthesis fingerprint is stale.",
      });
    }
    const expectedPageBlueprintFingerprint = `bounded-page-blueprint-selections-${canonicalValueFingerprint(
      decision.pageBlueprintSelectionOverrides,
    )}`;
    if (
      decision.exactSelectionAuthority.pageBlueprintSelectionFingerprint !==
      expectedPageBlueprintFingerprint
    ) {
      context.addIssue({
        code: "custom",
        path: ["exactSelectionAuthority", "pageBlueprintSelectionFingerprint"],
        message: "The exact PageBlueprint selection fingerprint is stale.",
      });
    }
    const expectedAssetSelectionFingerprint = `bounded-approved-asset-role-selections-${canonicalValueFingerprint(
      decision.approvedAssetRoleSelections,
    )}`;
    if (
      decision.exactSelectionAuthority.approvedAssetRoleSelectionFingerprint !==
      expectedAssetSelectionFingerprint
    ) {
      context.addIssue({
        code: "custom",
        path: ["exactSelectionAuthority", "approvedAssetRoleSelectionFingerprint"],
        message: "The exact approved asset-role selection fingerprint is stale.",
      });
    }
    if (decision.dynamicCommerceSelection === null) {
      if (
        decision.exactSelectionAuthority.dynamicCommerceAuthorityFingerprint !== null ||
        decision.exactSelectionAuthority.dynamicCommerceSelectionFingerprint !== null
      ) {
        context.addIssue({
          code: "custom",
          path: ["exactSelectionAuthority", "dynamicCommerceSelectionFingerprint"],
          message: "Absent dynamic-commerce selection cannot claim execution authority.",
        });
      }
    } else {
      const expectedDynamicFingerprint = `bounded-dynamic-commerce-selection-${canonicalValueFingerprint(
        decision.dynamicCommerceSelection,
      )}`;
      if (
        decision.exactSelectionAuthority.dynamicCommerceAuthorityFingerprint !==
          decision.dynamicCommerceSelection.authorityFingerprint ||
        decision.exactSelectionAuthority.dynamicCommerceSelectionFingerprint !==
          expectedDynamicFingerprint
      ) {
        context.addIssue({
          code: "custom",
          path: ["exactSelectionAuthority", "dynamicCommerceSelectionFingerprint"],
          message: "The exact dynamic-commerce selection authority is stale.",
        });
      }
    }
  });

export type BoundedStorefrontSynthesisIntent = z.infer<
  typeof boundedStorefrontSynthesisIntentSchema
>;
export type BoundedStorefrontSynthesisRequest = z.infer<
  typeof boundedStorefrontSynthesisRequestSchema
>;
export type BoundedStorefrontSynthesisSelectionNarrowing = z.infer<
  typeof boundedStorefrontSynthesisSelectionNarrowingSchema
>;
export type BoundedStorefrontSynthesisExactSelection = z.infer<
  typeof boundedStorefrontSynthesisExactSelectionSchema
>;
export type BoundedStorefrontSynthesisDecision = z.infer<
  typeof boundedStorefrontSynthesisDecisionSchema
>;

export const boundedStorefrontSynthesisErrorCodes = [
  "invalid-request",
  "unsupported-constraint",
  "incomplete-page-set",
  "missing-approved-evidence",
  "stale-authority",
  "incompatible-frame-profile",
  "unsupported-narrative-role",
  "impossible-required-role",
  "invalid-component-capability",
  "invalid-bounded-override",
  "non-deterministic-selection",
] as const;
export type BoundedStorefrontSynthesisErrorCode =
  (typeof boundedStorefrontSynthesisErrorCodes)[number];

export class BoundedStorefrontSynthesisError extends Error {
  constructor(
    readonly code: BoundedStorefrontSynthesisErrorCode,
    message: string,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = "BoundedStorefrontSynthesisError";
  }
}
