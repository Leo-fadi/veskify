import { z } from "zod";
import { storefrontDesignDirectionIdSchema } from "@/application/storefront-design-system";
import {
  commercialCollectionSearchProfileIdSchema,
  commercialHomepageProfileIdSchema,
  commercialPdpProfileIdSchema,
} from "@/application/storefront-templates";
import { canonicalProductCardAnatomyIdSchema } from "@/domain/product-card";
import {
  canonicalValueFingerprint,
  commercialSharedFrameProfileIdSchema,
} from "@/domain/storefront";

export const COORDINATED_STOREFRONT_DIRECTION_AUTHORITY_VERSION = "1.1.0" as const;
export const COORDINATED_STOREFRONT_DIVERSITY_CONTRACT_VERSION = "1.0.0" as const;

export const coordinatedStorefrontDirectionIdSchema = z.enum([
  "premium-editorial",
  "modern-technical",
  "minimal-commerce",
]);

const narrativePostureSchema = z.enum([
  "story-led",
  "discovery-led",
  "restrained",
  "catalogue-dense",
  "considered-purchase",
  "campaign-led",
]);
const merchandisingPostureSchema = z.enum([
  "curated",
  "discovery",
  "restrained",
  "dense",
  "considered",
  "campaign",
]);
const densityPostureSchema = z.enum(["compact", "balanced", "airy"]);
const artDirectionPostureSchema = z.enum(["contained", "editorial", "immersive"]);
const responsiveModeSchema = z.enum(["content-first", "commerce-first", "balanced"]);

const directionConstraintsSchema = z
  .object({
    designSystemDirectionIds: z.array(storefrontDesignDirectionIdSchema).min(1),
    designSystemSpacingDensities: z.array(z.enum(["compact", "standard", "spacious"])).min(1),
    designSystemSurfaceDepths: z.array(z.enum(["flat", "subtle", "layered"])).min(1),
    sharedFrameProfileIds: z.array(commercialSharedFrameProfileIdSchema).min(1),
    homepageProfileIds: z.array(commercialHomepageProfileIdSchema).min(2),
    collectionProfileIds: z.array(commercialCollectionSearchProfileIdSchema).min(2),
    searchProfileIds: z.array(commercialCollectionSearchProfileIdSchema).min(1),
    pdpProfileIds: z.array(commercialPdpProfileIdSchema).min(2),
    optionalPageFamilyCompositions: z
      .array(z.array(z.string().trim().min(1).max(80)).max(24))
      .min(2),
    productCardAnatomyIds: z.array(canonicalProductCardAnatomyIdSchema).min(2),
    narrativePostures: z.array(narrativePostureSchema).min(2),
    merchandisingPostures: z.array(merchandisingPostureSchema).min(2),
    informationDensityPostures: z.array(densityPostureSchema).min(1),
    artDirectionPostures: z.array(artDirectionPostureSchema).min(1),
    responsiveModes: z.array(responsiveModeSchema).min(1),
    postureDefaults: z
      .object({
        narrativePosture: narrativePostureSchema,
        merchandisingPosture: merchandisingPostureSchema,
        informationDensityPosture: densityPostureSchema,
        artDirectionPosture: artDirectionPostureSchema,
        responsiveMode: responsiveModeSchema,
      })
      .strict(),
    designDna: z
      .object({
        typographyPairings: z.array(z.enum(["serif-led", "sans-led", "mixed"])).min(1),
        spacingScales: z.array(z.enum(["compact", "balanced", "generous"])).min(1),
        surfacePostures: z.array(z.enum(["quiet", "layered", "contrast"])).min(1),
        controlDensities: z.array(z.enum(["compact", "balanced", "spacious"])).min(1),
        mediaPostures: z.array(z.enum(["restrained", "editorial", "product-led"])).min(1),
      })
      .strict(),
  })
  .strict()
  .superRefine((constraints, context) => {
    const relationships = [
      ["narrativePosture", constraints.narrativePostures],
      ["merchandisingPosture", constraints.merchandisingPostures],
      ["informationDensityPosture", constraints.informationDensityPostures],
      ["artDirectionPosture", constraints.artDirectionPostures],
      ["responsiveMode", constraints.responsiveModes],
    ] as const;
    for (const [field, options] of relationships) {
      if (!options.includes(constraints.postureDefaults[field] as never)) {
        context.addIssue({
          code: "custom",
          path: ["postureDefaults", field],
          message: "The canonical posture default must be one of the registered options.",
        });
      }
    }
  });

const directionMaterialSchema = z
  .object({
    version: z.literal(COORDINATED_STOREFRONT_DIRECTION_AUTHORITY_VERSION),
    id: coordinatedStorefrontDirectionIdSchema,
    label: z.string().trim().min(1).max(80),
    intent: z.enum(["editorial-led", "commerce-led", "restrained-minimal"]),
    plannerDescription: z.string().trim().min(1).max(400),
    constraints: directionConstraintsSchema,
    protectedCommerceImmutable: z.literal(true),
    approvedEvidenceImmutable: z.literal(true),
    canonicalProductMediaImmutable: z.literal(true),
  })
  .strict();

export const coordinatedStorefrontDirectionPackageSchema = directionMaterialSchema
  .extend({ authorityFingerprint: z.string().trim().min(1).max(240) })
  .strict()
  .superRefine((direction, context) => {
    const { authorityFingerprint, ...material } = direction;
    const expected = `coordinated-direction-${canonicalValueFingerprint(material)}`;
    if (authorityFingerprint !== expected) {
      context.addIssue({
        code: "custom",
        path: ["authorityFingerprint"],
        message: "The coordinated direction authority fingerprint is stale.",
      });
    }
  });

export const coordinatedDirectionCharacteristicsSchema = z
  .object({
    sharedFrameProfileId: commercialSharedFrameProfileIdSchema.optional(),
    homepageProfileId: commercialHomepageProfileIdSchema.optional(),
    collectionProfileId: commercialCollectionSearchProfileIdSchema.optional(),
    pdpProfileId: commercialPdpProfileIdSchema.optional(),
    includedOptionalPageFamilyIds: z.array(z.string().trim().min(1).max(80)).max(24).optional(),
    narrativePosture: narrativePostureSchema.optional(),
    merchandisingPosture: merchandisingPostureSchema.optional(),
    informationDensityPosture: densityPostureSchema.optional(),
    artDirectionPosture: artDirectionPostureSchema.optional(),
    responsiveMode: responsiveModeSchema.optional(),
  })
  .strict();

export const coordinatedDirectionRequestSchema = z
  .object({
    directionId: coordinatedStorefrontDirectionIdSchema,
    deterministicSeed: z.string().trim().min(1).max(120).default("canonical"),
    characteristics: coordinatedDirectionCharacteristicsSchema.optional(),
  })
  .strict();

export const diversityClassificationSchema = z.enum([
  "exact-duplicate",
  "palette-only",
  "shallow-component-swap",
  "near-duplicate",
  "materially-different",
]);

export const storefrontDiversityFingerprintSchema = z
  .object({
    version: z.literal(COORDINATED_STOREFRONT_DIVERSITY_CONTRACT_VERSION),
    exactFingerprint: z.string().min(1),
    structuralFingerprint: z.string().min(1),
    paletteFingerprint: z.string().min(1),
    dimensions: z
      .object({
        designDna: z.string().min(1),
        pageSet: z.string().min(1),
        pageProfiles: z.string().min(1),
        sharedFrame: z.string().min(1),
        componentAnatomies: z.string().min(1),
        boundedParameters: z.string().min(1),
        artDirection: z.string().min(1),
        density: z.string().min(1),
        narrative: z.string().min(1),
        responsive: z.string().min(1),
      })
      .strict(),
  })
  .strict();

export type CoordinatedStorefrontDirectionId = z.infer<
  typeof coordinatedStorefrontDirectionIdSchema
>;
export type CoordinatedStorefrontDirectionPackage = z.infer<
  typeof coordinatedStorefrontDirectionPackageSchema
>;
export type CoordinatedDirectionRequest = z.infer<typeof coordinatedDirectionRequestSchema>;
export type StorefrontDiversityFingerprint = z.infer<typeof storefrontDiversityFingerprintSchema>;
export type DiversityClassification = z.infer<typeof diversityClassificationSchema>;

export class CoordinatedStorefrontDirectionError extends Error {
  constructor(
    readonly code:
      | "unknown-direction"
      | "stale-direction-authority"
      | "unsupported-characteristic"
      | "invalid-direction-reference"
      | "incompatible-direction"
      | "no-valid-diversity",
    message: string,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = "CoordinatedStorefrontDirectionError";
  }
}
