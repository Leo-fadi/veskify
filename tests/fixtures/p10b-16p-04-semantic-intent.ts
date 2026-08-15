import {
  semanticStorefrontDesignIntentFingerprint,
  semanticStorefrontDesignIntentV1MaterialSchema,
  semanticStorefrontDesignIntentV1Schema,
  type SemanticStorefrontDesignIntentV1,
  type SemanticStorefrontDesignIntentV1Material,
  type SemanticStorefrontDesignRequestV1,
} from "@/application/prompted-storefront-design-intent";

export type SemanticDriverOverrides = Readonly<{
  designConceptSummary?: string;
  commercialPosture?: SemanticStorefrontDesignIntentV1Material["commercialPosture"];
  density?: SemanticStorefrontDesignIntentV1Material["globalVisualIntent"]["density"];
  navigationPosture?: SemanticStorefrontDesignIntentV1Material["sharedFrameIntent"]["navigationPosture"];
  storyCatalogueBalance?: SemanticStorefrontDesignIntentV1Material["homepageIntent"]["storyCatalogueBalance"];
  discoveryPosture?: SemanticStorefrontDesignIntentV1Material["collectionIntent"]["discoveryPosture"];
  configurableProductPosture?: SemanticStorefrontDesignIntentV1Material["pdpIntent"]["configurableProductPosture"];
  mobileHierarchy?: SemanticStorefrontDesignIntentV1Material["responsiveAndArtDirectionIntent"]["mobileHierarchy"];
  imageProminence?: SemanticStorefrontDesignIntentV1Material["responsiveAndArtDirectionIntent"]["imageProminence"];
}>;

export function semanticIntentMaterialFixture(
  request: Pick<
    SemanticStorefrontDesignRequestV1,
    | "requestFingerprint"
    | "promptFingerprint"
    | "currentAuthorityFingerprint"
    | "semanticAuthorityFingerprint"
  >,
  overrides: SemanticDriverOverrides = {},
): SemanticStorefrontDesignIntentV1Material {
  return semanticStorefrontDesignIntentV1MaterialSchema.parse({
    contractVersion: "prompted-storefront-semantic-intent-v1",
    requestFingerprint: request.requestFingerprint,
    promptFingerprint: request.promptFingerprint,
    currentAuthorityFingerprint: request.currentAuthorityFingerprint,
    semanticAuthorityFingerprint: request.semanticAuthorityFingerprint,
    designConceptSummary: overrides.designConceptSummary ?? "Balanced commercial storefront.",
    commercialPosture: overrides.commercialPosture ?? "minimal-commerce",
    globalVisualIntent: { density: overrides.density ?? "balanced" },
    sharedFrameIntent: { navigationPosture: overrides.navigationPosture ?? "minimal" },
    homepageIntent: { storyCatalogueBalance: overrides.storyCatalogueBalance ?? "balanced" },
    collectionIntent: { discoveryPosture: overrides.discoveryPosture ?? "dense-search" },
    pdpIntent: {
      configurableProductPosture: overrides.configurableProductPosture ?? "standard",
    },
    responsiveAndArtDirectionIntent: {
      mobileHierarchy: overrides.mobileHierarchy ?? "balanced",
      imageProminence: overrides.imageProminence ?? "balanced",
    },
  });
}

export function semanticIntentFixture(
  request: Parameters<typeof semanticIntentMaterialFixture>[0],
  overrides: SemanticDriverOverrides = {},
): SemanticStorefrontDesignIntentV1 {
  const material = semanticIntentMaterialFixture(request, overrides);
  return semanticStorefrontDesignIntentV1Schema.parse({
    ...material,
    semanticIntentFingerprint: semanticStorefrontDesignIntentFingerprint(material),
  });
}
