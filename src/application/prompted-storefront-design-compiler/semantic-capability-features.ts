import type { BoundedStorefrontSynthesisSelectionNarrowing } from "@/application/bounded-storefront-synthesis";
import {
  getCommercialCollectionSearchProfile,
  getCommercialHomepageProfile,
  getCommercialPdpProfile,
} from "@/application/storefront-templates";
import type { DesignDna } from "@/domain/design-system";
import { canonicalValueFingerprint, getCommercialSharedFrameProfile } from "@/domain/storefront";

export type SemanticFeatureMap = Readonly<Record<string, readonly string[]>>;

export const semanticExactInfluenceAxisIds = [
  "direction-package",
  "design-dna",
  "typography",
  "spacing-density",
  "shared-frame",
  "frame-responsive-authority",
  "homepage-profile",
  "narrative-posture",
  "collection-profile",
  "merchandising-posture",
  "pdp-profile",
  "component-variants",
  "product-card-anatomy",
  "optional-page-set",
  "art-direction-posture",
] as const;

export type SemanticExactInfluenceAxisId = (typeof semanticExactInfluenceAxisIds)[number];
export type SemanticExactInfluenceAxisMap = Readonly<Record<SemanticExactInfluenceAxisId, string>>;

export function uniqueSemanticValues(values: readonly string[]): readonly string[] {
  return Object.freeze([...new Set(values)].sort((left, right) => left.localeCompare(right)));
}

function featureMap(entries: readonly [string, readonly string[]][]): SemanticFeatureMap {
  return Object.freeze(
    Object.fromEntries(
      entries
        .map(([path, values]) => [path, uniqueSemanticValues(values)] as const)
        .sort(([left], [right]) => left.localeCompare(right)),
    ),
  );
}

export function semanticOptionalFamilies(selection: BoundedStorefrontSynthesisSelectionNarrowing) {
  const values: string[] = [];
  for (const id of selection.includedOptionalPageFamilyIds) {
    if (/about|brand-story/u.test(id)) values.push("about");
    if (/contact|location/u.test(id)) values.push("contact-locations");
    if (/faq/u.test(id)) values.push("faq");
    if (/shipping|return|policy|service/u.test(id)) values.push("service-policy");
    if (/campaign|editorial/u.test(id)) values.push("campaign-landing");
    if (/generic|content/u.test(id)) values.push("generic-content");
  }
  return uniqueSemanticValues(values);
}

function registeredProfileAuthority(selection: BoundedStorefrontSynthesisSelectionNarrowing) {
  const frame = getCommercialSharedFrameProfile(selection.sharedFrameProfileId);
  const homepagePlan = getCommercialHomepageProfile(selection.homepageProfileId);
  const collectionPlan = getCommercialCollectionSearchProfile(selection.collectionProfileId);
  const pdpPlan = getCommercialPdpProfile(selection.pdpProfileId);
  const homepage = homepagePlan?.profile?.commercialHomepage;
  const collection = collectionPlan?.profile?.commercialCollectionSearch;
  const pdp = pdpPlan?.profile?.commercialProductDetail;
  if (!homepage || !collection || !pdp) {
    throw new Error(
      "A current compatible selection references unavailable registered profile metadata.",
    );
  }
  return { frame, homepagePlan, collectionPlan, pdpPlan, homepage, collection, pdp };
}

function commercialPostures(
  selection: BoundedStorefrontSynthesisSelectionNarrowing,
  campaign: boolean,
): readonly string[] {
  const frameId = selection.sharedFrameProfileId;
  const spacing = selection.designSystemSpacingDensity;
  if (selection.directionId === "premiumEditorial") {
    return [
      ...(frameId === "editorial-masthead" ? ["premium-editorial"] : []),
      ...(frameId === "centered-minimal" && spacing === "standard" ? ["high-consideration"] : []),
      ...(campaign && frameId === "editorial-masthead" && spacing === "spacious"
        ? ["bold-campaign"]
        : []),
    ];
  }
  if (selection.directionId === "modernTechnical") {
    const compactTechnical = spacing === "compact" && frameId === "compact-technical";
    const balancedUtility = spacing === "standard" && frameId === "commerce-utility";
    return [
      ...(compactTechnical || balancedUtility ? ["modern-technical"] : []),
      ...(balancedUtility ? ["catalogue-comparison"] : []),
      ...(compactTechnical ? ["fast-conversion"] : []),
    ];
  }
  const balancedMinimal = spacing === "standard" && frameId === "centered-minimal";
  const airyEditorial = spacing === "spacious" && frameId === "editorial-masthead";
  const balancedUtility = spacing === "standard" && frameId === "commerce-utility";
  return [
    ...(balancedMinimal || airyEditorial ? ["minimal-commerce"] : []),
    ...(airyEditorial ? ["warm-approachable"] : []),
    ...(balancedUtility ? ["fast-conversion"] : []),
  ];
}

function navigationPosture(frameId: string): string {
  const value: Readonly<Record<string, string>> = {
    "editorial-masthead": "editorial",
    "commerce-utility": "catalogue",
    "centered-minimal": "minimal",
    "compact-technical": "compact",
  };
  const result = value[frameId];
  if (!result) throw new Error("Registered shared-frame authority lacks a semantic mapping.");
  return result;
}

function storyCatalogueBalance(narrativePosture: string): string {
  if (narrativePosture === "story-led" || narrativePosture === "campaign-led") {
    return "story-first";
  }
  return narrativePosture === "catalogue-dense" || narrativePosture === "discovery-led"
    ? "catalogue-first"
    : "balanced";
}

function collectionDiscoveryPosture(
  presentationMode: string,
  merchandisingPosture: string,
): string {
  if (merchandisingPosture === "campaign") return "campaign";
  if (merchandisingPosture === "dense") return "dense-search";
  if (merchandisingPosture === "curated") return "editorial";
  const mapped: Readonly<Record<string, string>> = {
    "editorial-discovery": "editorial",
    "catalogue-comparison": "catalogue-comparison",
    "campaign-led-discovery": "campaign",
    "dense-search": "dense-search",
  };
  const result = mapped[presentationMode];
  if (!result) throw new Error("Registered collection authority lacks a semantic mapping.");
  return result;
}

function configurableProductPosture(
  pdp: ReturnType<typeof registeredProfileAuthority>["pdp"],
): string {
  if (pdp.presentation === "variant-led") return "technical";
  if (pdp.presentation === "high-consideration" || pdp.presentation === "gallery-led") {
    return "guided";
  }
  if (pdp.presentation === "standard-commerce") return "standard";
  throw new Error("Registered PDP authority lacks a semantic presentation mapping.");
}

function densityPosture(spacingDensity: string): string {
  if (spacingDensity === "compact") return "high";
  return spacingDensity === "spacious" ? "low" : "balanced";
}

function mobileHierarchy(frame: ReturnType<typeof registeredProfileAuthority>["frame"]): string {
  if (frame.mobileNavigationMode === "stacked-disclosure") return "conversion-led";
  if (frame.mobileNavigationMode === "compact-overlay") return "balanced";
  return frame.responsiveTransformationIds.includes("technical-to-drawer")
    ? "product-led"
    : "story-led";
}

function imageProminence(artDirectionPosture: string): string {
  if (artDirectionPosture === "contained") return "restrained";
  return artDirectionPosture === "immersive" ? "image-led" : "balanced";
}

/** Provider-visible semantic features for the eight independent bounded-hybrid drivers. */
export function semanticFeaturesFor(
  selection: BoundedStorefrontSynthesisSelectionNarrowing,
): SemanticFeatureMap {
  const { frame, homepage, collection, pdp } = registeredProfileAuthority(selection);
  const campaign =
    selection.narrativePosture === "campaign-led" ||
    homepage.merchandisingEmphasis === "campaign-conversion";
  return featureMap([
    ["commercialPosture", commercialPostures(selection, campaign)],
    ["globalVisualIntent.density", [densityPosture(selection.designSystemSpacingDensity)]],
    ["sharedFrameIntent.navigationPosture", [navigationPosture(frame.id)]],
    ["homepageIntent.storyCatalogueBalance", [storyCatalogueBalance(selection.narrativePosture)]],
    [
      "collectionIntent.discoveryPosture",
      [collectionDiscoveryPosture(collection.presentationMode, selection.merchandisingPosture)],
    ],
    ["pdpIntent.configurableProductPosture", [configurableProductPosture(pdp)]],
    ["responsiveAndArtDirectionIntent.mobileHierarchy", [mobileHierarchy(frame)]],
    [
      "responsiveAndArtDirectionIntent.imageProminence",
      [imageProminence(selection.artDirectionPosture)],
    ],
  ]);
}

/** Exact metadata axes used only by the deterministic resolver; values never cross to OpenAI. */
export function semanticExactInfluenceAxesFor(
  selection: BoundedStorefrontSynthesisSelectionNarrowing,
  designDna: DesignDna,
): SemanticExactInfluenceAxisMap {
  const { frame, homepagePlan, collectionPlan, pdpPlan, homepage, collection, pdp } =
    registeredProfileAuthority(selection);
  const slots = [homepagePlan, collectionPlan, pdpPlan].flatMap(
    (plan) =>
      plan?.slots.map(({ id, sectionType, defaultVariant }) => ({
        id,
        sectionType,
        defaultVariant,
      })) ?? [],
  );
  return Object.freeze({
    "direction-package": selection.directionId,
    "design-dna": canonicalValueFingerprint(designDna),
    typography: canonicalValueFingerprint(designDna.typography),
    "spacing-density": canonicalValueFingerprint({
      designSystemSpacingDensity: selection.designSystemSpacingDensity,
      spacing: designDna.spacing,
      controls: {
        height: designDna.controls.height,
        density: designDna.controls.density,
      },
      density: designDna.density,
    }),
    "shared-frame": selection.sharedFrameProfileId,
    "frame-responsive-authority": canonicalValueFingerprint({
      profileId: frame.id,
      mobileNavigationMode: frame.mobileNavigationMode,
      responsiveTransformationIds: frame.responsiveTransformationIds,
    }),
    "homepage-profile": selection.homepageProfileId,
    "narrative-posture": selection.narrativePosture,
    "collection-profile": selection.collectionProfileId,
    "merchandising-posture": selection.merchandisingPosture,
    "pdp-profile": selection.pdpProfileId,
    "component-variants": canonicalValueFingerprint(slots),
    "product-card-anatomy": canonicalValueFingerprint([
      homepage.productCardAnatomyId,
      collection.productCardAnatomyId,
      pdp.relatedProductCardAnatomyId,
    ]),
    "optional-page-set": canonicalValueFingerprint(selection.includedOptionalPageFamilyIds),
    "art-direction-posture": selection.artDirectionPosture,
  });
}
