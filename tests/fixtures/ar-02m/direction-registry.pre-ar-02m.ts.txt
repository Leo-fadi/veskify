import {
  getCommercialCollectionSearchProfile,
  getCommercialHomepageProfile,
  getCommercialPdpProfile,
} from "@/application/storefront-templates";
import { canonicalProductCardAnatomyIdSchema } from "@/domain/product-card";
import type { CanonicalProductCardAnatomyId } from "@/domain/product-card";
import { canonicalValueFingerprint, getCommercialSharedFrameProfile } from "@/domain/storefront";
import {
  COORDINATED_STOREFRONT_DIRECTION_AUTHORITY_VERSION,
  CoordinatedStorefrontDirectionError,
  coordinatedStorefrontDirectionPackageSchema,
  type CoordinatedStorefrontDirectionId,
  type CoordinatedStorefrontDirectionPackage,
} from "./direction-contract";
import type { BoundedStorefrontSynthesisSelectionNarrowing } from "./contract";

type PackageInput = Omit<CoordinatedStorefrontDirectionPackage, "authorityFingerprint">;

export function informationDensityPostureForDesignSystemSpacingDensity(
  spacingDensity: BoundedStorefrontSynthesisSelectionNarrowing["designSystemSpacingDensity"],
): BoundedStorefrontSynthesisSelectionNarrowing["informationDensityPosture"] {
  return (
    {
      compact: "compact",
      standard: "balanced",
      spacious: "airy",
    } as const
  )[spacingDensity];
}

function direction(input: PackageInput): CoordinatedStorefrontDirectionPackage {
  return coordinatedStorefrontDirectionPackageSchema.parse({
    ...input,
    authorityFingerprint: `coordinated-direction-${canonicalValueFingerprint(input)}`,
  });
}

const packages = [
  direction({
    version: COORDINATED_STOREFRONT_DIRECTION_AUTHORITY_VERSION,
    id: "premium-editorial",
    label: "Premium Editorial",
    intent: "editorial-led",
    plannerDescription:
      "Expressive image-led hierarchy, spacious editorial pacing, considered merchandising and evidence-backed story continuity.",
    constraints: {
      designSystemDirectionIds: ["premiumEditorial"],
      designSystemSpacingDensities: ["standard", "spacious"],
      designSystemSurfaceDepths: ["layered"],
      sharedFrameProfileIds: ["editorial-masthead", "centered-minimal", "commerce-utility"],
      homepageProfileIds: [
        "homepage-editorial-storytelling",
        "homepage-campaign-led",
        "homepage-high-consideration",
      ],
      collectionProfileIds: ["collection-editorial-discovery", "collection-campaign-led-discovery"],
      searchProfileIds: ["collection-dense-search"],
      pdpProfileIds: ["pdp-high-consideration", "pdp-gallery-led"],
      optionalPageFamilyCompositions: [
        ["about", "faq", "policy-legal", "not-found"],
        ["about", "shipping-information", "returns-information", "not-found"],
        ["faq", "campaign-editorial", "not-found"],
      ],
      productCardAnatomyIds: ["editorial", "imageFirst", "horizontal", "compact"],
      narrativePostures: ["story-led", "campaign-led", "considered-purchase"],
      merchandisingPostures: ["curated", "campaign", "considered"],
      informationDensityPostures: ["balanced", "airy"],
      artDirectionPostures: ["editorial", "immersive"],
      responsiveModes: ["content-first", "balanced"],
      postureDefaults: {
        narrativePosture: "story-led",
        merchandisingPosture: "curated",
        informationDensityPosture: "balanced",
        artDirectionPosture: "editorial",
        responsiveMode: "content-first",
      },
      designDna: {
        typographyPairings: ["serif-led"],
        // Premium retains expressive identity while exact registered spacing
        // selects its bounded balanced or generous density domain.
        spacingScales: ["balanced", "generous"],
        surfacePostures: ["quiet", "layered", "contrast"],
        controlDensities: ["balanced", "spacious"],
        mediaPostures: ["editorial"],
      },
    },
    protectedCommerceImmutable: true,
    approvedEvidenceImmutable: true,
    canonicalProductMediaImmutable: true,
  }),
  direction({
    version: COORDINATED_STOREFRONT_DIRECTION_AUTHORITY_VERSION,
    id: "modern-technical",
    label: "Modern Technical",
    intent: "commerce-led",
    plannerDescription:
      "Product-first information architecture, controlled density, polished technical controls and factual comparison clarity.",
    constraints: {
      designSystemDirectionIds: ["modernTechnical"],
      designSystemSpacingDensities: ["compact", "standard"],
      designSystemSurfaceDepths: ["flat"],
      sharedFrameProfileIds: ["compact-technical", "commerce-utility", "centered-minimal"],
      homepageProfileIds: [
        "homepage-commerce-led-discovery",
        "homepage-collection-gateway",
        "homepage-high-consideration",
        "homepage-minimal-brand-commerce",
      ],
      collectionProfileIds: [
        "collection-catalogue-comparison",
        "collection-dense-search",
        "collection-editorial-discovery",
      ],
      searchProfileIds: ["collection-dense-search", "collection-catalogue-comparison"],
      pdpProfileIds: ["pdp-variant-led", "pdp-standard-commerce", "pdp-high-consideration"],
      optionalPageFamilyCompositions: [
        ["contact", "shipping-information", "returns-information", "cart", "error-state"],
        ["contact", "cart", "no-results", "error-state"],
        ["shipping-information", "returns-information", "cart", "no-results"],
      ],
      productCardAnatomyIds: ["compact", "horizontal", "standard", "editorial"],
      narrativePostures: ["discovery-led", "catalogue-dense", "considered-purchase"],
      merchandisingPostures: ["discovery", "dense", "considered"],
      informationDensityPostures: ["compact", "balanced"],
      artDirectionPostures: ["contained", "editorial"],
      responsiveModes: ["commerce-first", "balanced"],
      postureDefaults: {
        narrativePosture: "discovery-led",
        merchandisingPosture: "discovery",
        informationDensityPosture: "compact",
        artDirectionPosture: "contained",
        responsiveMode: "commerce-first",
      },
      designDna: {
        typographyPairings: ["sans-led"],
        spacingScales: ["compact", "balanced"],
        surfacePostures: ["quiet"],
        controlDensities: ["compact", "balanced"],
        mediaPostures: ["product-led"],
      },
    },
    protectedCommerceImmutable: true,
    approvedEvidenceImmutable: true,
    canonicalProductMediaImmutable: true,
  }),
  direction({
    version: COORDINATED_STOREFRONT_DIRECTION_AUTHORITY_VERSION,
    id: "minimal-commerce",
    label: "Minimal Commerce",
    intent: "restrained-minimal",
    plannerDescription:
      "Restrained composition, fewer stronger blocks, direct merchandising and controlled conversion continuity without unfinished generic output.",
    constraints: {
      designSystemDirectionIds: ["warmApproachable"],
      designSystemSpacingDensities: ["standard", "spacious"],
      designSystemSurfaceDepths: ["subtle"],
      sharedFrameProfileIds: ["centered-minimal", "commerce-utility", "editorial-masthead"],
      homepageProfileIds: [
        "homepage-minimal-brand-commerce",
        "homepage-high-consideration",
        "homepage-editorial-storytelling",
      ],
      collectionProfileIds: ["collection-editorial-discovery", "collection-dense-search"],
      searchProfileIds: ["collection-dense-search"],
      pdpProfileIds: ["pdp-standard-commerce", "pdp-high-consideration"],
      optionalPageFamilyCompositions: [
        ["about", "contact", "faq", "policy-legal", "cart", "not-found"],
        ["contact", "shipping-information", "returns-information", "cart", "checkout"],
        ["about", "faq", "shipping-information", "returns-information", "not-found"],
      ],
      productCardAnatomyIds: ["standard", "horizontal", "compact", "editorial"],
      narrativePostures: ["restrained", "discovery-led", "considered-purchase"],
      merchandisingPostures: ["restrained", "discovery", "considered"],
      informationDensityPostures: ["balanced", "airy"],
      artDirectionPostures: ["contained", "editorial"],
      responsiveModes: ["balanced", "commerce-first"],
      postureDefaults: {
        narrativePosture: "restrained",
        merchandisingPosture: "restrained",
        informationDensityPosture: "balanced",
        artDirectionPosture: "contained",
        responsiveMode: "balanced",
      },
      designDna: {
        typographyPairings: ["serif-led"],
        spacingScales: ["balanced", "generous"],
        surfacePostures: ["quiet", "layered", "contrast"],
        controlDensities: ["balanced", "spacious"],
        mediaPostures: ["restrained"],
      },
    },
    protectedCommerceImmutable: true,
    approvedEvidenceImmutable: true,
    canonicalProductMediaImmutable: true,
  }),
] as const;

function referencedAnatomies(
  entry: CoordinatedStorefrontDirectionPackage,
): CanonicalProductCardAnatomyId[] {
  return [
    ...entry.constraints.homepageProfileIds.map(
      (id) => getCommercialHomepageProfile(id)?.profile?.commercialHomepage?.productCardAnatomyId,
    ),
    ...entry.constraints.collectionProfileIds.map(
      (id) =>
        getCommercialCollectionSearchProfile(id)?.profile?.commercialCollectionSearch
          ?.productCardAnatomyId,
    ),
    ...entry.constraints.searchProfileIds.map(
      (id) =>
        getCommercialCollectionSearchProfile(id)?.profile?.commercialCollectionSearch
          ?.productCardAnatomyId,
    ),
    ...entry.constraints.pdpProfileIds.map(
      (id) =>
        getCommercialPdpProfile(id)?.profile?.commercialProductDetail?.relatedProductCardAnatomyId,
    ),
  ].flatMap((id) => (id ? [id] : []));
}

export function validateCoordinatedStorefrontDirectionRegistry(
  values: readonly unknown[] = packages,
): readonly CoordinatedStorefrontDirectionPackage[] {
  const parsed = values.map((value) => coordinatedStorefrontDirectionPackageSchema.parse(value));
  if (
    parsed.length !== 3 ||
    new Set(parsed.map(({ id }) => id)).size !== 3 ||
    !["premium-editorial", "modern-technical", "minimal-commerce"].every((id) =>
      parsed.some((entry) => entry.id === id),
    )
  ) {
    throw new CoordinatedStorefrontDirectionError(
      "invalid-direction-reference",
      "Exactly the three canonical coordinated directions must be registered.",
    );
  }
  for (const entry of parsed) {
    entry.constraints.sharedFrameProfileIds.forEach(getCommercialSharedFrameProfile);
    entry.constraints.homepageProfileIds.forEach((id) => {
      if (!getCommercialHomepageProfile(id)) throw new Error(`Unknown homepage profile ${id}.`);
    });
    [...entry.constraints.collectionProfileIds, ...entry.constraints.searchProfileIds].forEach(
      (id) => {
        if (!getCommercialCollectionSearchProfile(id))
          throw new Error(`Unknown collection/search profile ${id}.`);
      },
    );
    entry.constraints.pdpProfileIds.forEach((id) => {
      if (!getCommercialPdpProfile(id)) throw new Error(`Unknown PDP profile ${id}.`);
    });
    const allowed = new Set(entry.constraints.productCardAnatomyIds);
    for (const anatomyId of referencedAnatomies(entry)) {
      canonicalProductCardAnatomyIdSchema.parse(anatomyId);
      if (!allowed.has(canonicalProductCardAnatomyIdSchema.parse(anatomyId))) {
        throw new CoordinatedStorefrontDirectionError(
          "invalid-direction-reference",
          `${entry.id} omits referenced product-card anatomy ${anatomyId}.`,
        );
      }
    }
  }
  return Object.freeze(parsed.map((entry) => Object.freeze(structuredClone(entry))));
}

const validatedPackages = validateCoordinatedStorefrontDirectionRegistry();
const byId = new Map(validatedPackages.map((entry) => [entry.id, entry]));

export function listCoordinatedStorefrontDirections() {
  return validatedPackages.map((entry) => structuredClone(entry));
}

export function getCoordinatedStorefrontDirection(
  id: CoordinatedStorefrontDirectionId,
): CoordinatedStorefrontDirectionPackage {
  const resolved = byId.get(id);
  if (!resolved) {
    throw new CoordinatedStorefrontDirectionError(
      "unknown-direction",
      `Unknown coordinated storefront direction ${id}.`,
    );
  }
  return structuredClone(resolved);
}

export function validateDirectionSelectionNarrowing(
  narrowing: BoundedStorefrontSynthesisSelectionNarrowing,
): CoordinatedStorefrontDirectionPackage {
  const parsedDirectionId = narrowing.authorityId.replace(/^coordinated-direction:/, "");
  const entry = byId.get(parsedDirectionId as CoordinatedStorefrontDirectionId);
  if (
    !entry ||
    narrowing.authorityId !== `coordinated-direction:${entry.id}` ||
    narrowing.authorityVersion !== entry.version ||
    narrowing.authorityFingerprint !== entry.authorityFingerprint
  ) {
    throw new CoordinatedStorefrontDirectionError(
      "stale-direction-authority",
      "The coordinated selection narrowing does not match current direction authority.",
    );
  }
  const constraints = entry.constraints;
  const included = (value: string, allowed: readonly string[], label: string): void => {
    if (!allowed.includes(value)) {
      throw new CoordinatedStorefrontDirectionError(
        "unsupported-characteristic",
        `${value} is outside ${entry.id} ${label} constraints.`,
      );
    }
  };
  included(narrowing.directionId, constraints.designSystemDirectionIds, "Design DNA");
  included(
    narrowing.designSystemSpacingDensity,
    constraints.designSystemSpacingDensities,
    "Design DNA spacing",
  );
  included(
    narrowing.designSystemSurfaceDepth,
    constraints.designSystemSurfaceDepths,
    "Design DNA surface",
  );
  included(narrowing.sharedFrameProfileId, constraints.sharedFrameProfileIds, "frame");
  included(narrowing.homepageProfileId, constraints.homepageProfileIds, "homepage");
  included(narrowing.collectionProfileId, constraints.collectionProfileIds, "collection");
  included(narrowing.searchProfileId, constraints.searchProfileIds, "search");
  included(narrowing.pdpProfileId, constraints.pdpProfileIds, "PDP");
  if (
    !constraints.optionalPageFamilyCompositions.some(
      (composition) =>
        canonicalValueFingerprint(composition) ===
        canonicalValueFingerprint(narrowing.includedOptionalPageFamilyIds),
    )
  ) {
    throw new CoordinatedStorefrontDirectionError(
      "unsupported-characteristic",
      "The optional page-family composition is outside current direction authority.",
    );
  }
  included(narrowing.narrativePosture, constraints.narrativePostures, "narrative");
  included(narrowing.merchandisingPosture, constraints.merchandisingPostures, "merchandising");
  included(narrowing.informationDensityPosture, constraints.informationDensityPostures, "density");
  if (
    narrowing.informationDensityPosture !==
    informationDensityPostureForDesignSystemSpacingDensity(narrowing.designSystemSpacingDensity)
  ) {
    throw new CoordinatedStorefrontDirectionError(
      "unsupported-characteristic",
      "Information density must be the canonical semantic projection of exact Design DNA spacing.",
    );
  }
  included(narrowing.artDirectionPosture, constraints.artDirectionPostures, "art direction");
  included(narrowing.responsiveMode, constraints.responsiveModes, "responsive");
  return structuredClone(entry);
}
