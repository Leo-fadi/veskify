import {
  approvedGenerationAssetContextSchema,
  type ApprovedGenerationAssetContext,
} from "@/application/ai-storefront-generation/approved-asset-context";
import { createDynamicCommerceProductMatchContext } from "@/application/dynamic-commerce-routes/product-match-context";
import {
  listExecutablePageBlueprintProfiles,
  resolveCommercialHomepageEvidenceAvailability,
  resolveCommercialHomepageProfileSlots,
} from "@/application/storefront-templates/registry";
import {
  registeredBrandSystemForDirection,
  storefrontDesignSystemV1,
} from "@/application/storefront-design-system";
import type {
  ExecutablePageBlueprintProfile,
  StorefrontTemplatePagePlan,
} from "@/application/storefront-templates/contract";
import { validateExecutablePageBlueprintAuthority } from "@/application/storefront-templates/profile-authority";
import {
  dynamicCollectionCommerceContentSchema,
  dynamicCollectionCommerceDefinition,
  dynamicCollectionCommercePropsSchema,
  dynamicCollectionCommerceStyleOverridesSchema,
} from "@/components/registry/dynamic-collection-commerce";
import {
  dynamicProductDetailContentSchema,
  dynamicProductDetailDefinition,
  dynamicProductDetailPropsSchema,
  dynamicProductDetailStyleOverridesSchema,
} from "@/components/registry/dynamic-product-detail";
import { veskifyComponentCapabilityManifest } from "@/components/registry/capability-manifest";
import {
  responsiveImageCropSchema,
  responsiveImageOverlaySchema,
  responsiveImageRatioSchema,
} from "@/domain/asset-presentation";
import {
  catalogueDisplayModelSchema,
  type CatalogueDisplayModel,
  type ProductDisplayModel,
} from "@/domain/catalogue";
import {
  getBoundedParameterRuntimeProjectionAuthority,
  type CommercialGrammarCategory,
} from "@/domain/component-platform";
import {
  brandSystemDesignDnaFingerprint,
  designDnaSchema,
  resolveBrandSystemDesignDna,
} from "@/domain/design-system";
import {
  canonicalProductCardAuthority,
  canonicalProductTypePresentationId,
} from "@/domain/product-card";
import {
  storefrontDesignBriefContractSchema,
  type StorefrontDesignBriefContract,
} from "@/domain/source-discovery";
import {
  canonicalValueFingerprint,
  canonicalValueString,
  commercialSharedFrameProfiles,
  dynamicCommercePresentationAuthoritySchema,
  listPageFamilyDefinitions,
  storefrontSnapshotSchema,
  type DynamicCommerceCollectionSearchArchetype,
  type DynamicCommerceProductDetailArchetype,
  type StorefrontSnapshot,
} from "@/domain/storefront";
import {
  PROMPTED_STOREFRONT_CAPABILITY_PROJECTION_VERSION,
  promptedStorefrontCapabilityAuthorityReferenceSchema,
  promptedStorefrontCapabilityEntrySchema,
  promptedStorefrontCapabilityProjectionFingerprint,
  promptedStorefrontCapabilityProjectionSchema,
  promptedStorefrontCatalogueCharacteristicsSchema,
  PromptedStorefrontDesignIntentError,
  type PromptedStorefrontCapabilityAuthority,
  type PromptedStorefrontCapabilityAuthorityReference,
  type PromptedStorefrontCapabilityDimension,
  type PromptedStorefrontCapabilityEntry,
  type PromptedStorefrontCapabilityIntentRole,
} from "./contract";

type CatalogueCharacteristics = ReturnType<
  typeof promptedStorefrontCatalogueCharacteristicsSchema.parse
>;

type ProjectionInput = Readonly<{
  draft: StorefrontSnapshot;
  catalogue: CatalogueDisplayModel;
  approvedBrief: StorefrontDesignBriefContract;
  approvedAssetContext: ApprovedGenerationAssetContext | null;
}>;

const searchCapabilityState = Object.freeze({
  registration: "registered-presentation-authority" as const,
  execution: "unavailable" as const,
  behavior: "fail-closed" as const,
  reason: "missing-canonical-search-results-adapter" as const,
});

function compareCanonical(left: string, right: string): number {
  return left === right ? 0 : left < right ? -1 : 1;
}

function sortedUnique<T extends string>(values: readonly T[]): T[] {
  return [...new Set(values)].sort(compareCanonical);
}

function designLabel(value: string): string {
  return value
    .replaceAll(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replaceAll(/[._-]+/g, " ")
    .replaceAll(/\s+/g, " ")
    .trim()
    .toLocaleLowerCase("en");
}

function safeCatalogueLabel(value: string): string {
  const label = designLabel(value)
    .replaceAll(/[^\p{L}\p{N}&'’/ -]+/gu, " ")
    .replaceAll(/\s+/g, " ")
    .trim()
    .slice(0, 80)
    .trim();
  return label || "catalogue product type";
}

function exactAbsenceFingerprint(authority: string): string {
  return `${authority}-${canonicalValueFingerprint({ state: "absent" })}`;
}

function exactHomepageAssetAuthorityId(material: {
  profileId: string;
  slotId: string;
  component: string;
  assetSlotId: string;
  role: string;
  assetId: string;
  assetRevision: string;
  materialFingerprint: string;
}): string {
  return `approved-homepage-asset-${canonicalValueFingerprint(material)}`;
}

function commercialAuthority(profile: ExecutablePageBlueprintProfile) {
  return (
    profile.commercialHomepage ??
    profile.commercialCollectionSearch ??
    profile.commercialProductDetail ??
    profile.commercialContentSupport ??
    profile.commercialUtility
  );
}

function currentCommercialProfiles(): ExecutablePageBlueprintProfile[] {
  return listExecutablePageBlueprintProfiles()
    .flatMap(({ profile }) => (profile && commercialAuthority(profile) ? [profile] : []))
    .sort((left, right) => compareCanonical(left.id, right.id));
}

/**
 * Fingerprints every current commercial PageBlueprint profile, including the
 * content/support and utility authorities omitted from the legacy manifest
 * profile projection. It does not materialize any profile.
 */
export function promptedStorefrontPageBlueprintAuthorityFingerprint(): string {
  const profiles = currentCommercialProfiles().map((profile) => {
    const manifestProfile = veskifyComponentCapabilityManifest.getByProfileId(profile.id);
    const authority = commercialAuthority(profile);
    if (!manifestProfile || !authority) {
      throw new PromptedStorefrontDesignIntentError("stale-authority");
    }
    return {
      id: profile.id,
      version: profile.version,
      scope: profile.scope,
      manifestProfileFingerprint: manifestProfile.fingerprint,
      commercialStructuralFingerprint: authority.structuralFingerprint,
    };
  });
  return `prompted-page-blueprint-authority-${canonicalValueFingerprint(profiles)}`;
}

function countBucket(value: number): "none" | "one" | "twoToThree" | "fourOrMore" {
  if (value === 0) return "none";
  if (value === 1) return "one";
  if (value <= 3) return "twoToThree";
  return "fourOrMore";
}

function emptyDistribution() {
  return { none: 0, one: 0, twoToThree: 0, fourOrMore: 0 };
}

function productTypeRows(products: readonly ProductDisplayModel[]) {
  const grouped = new Map<string, ProductDisplayModel[]>();
  for (const product of products) {
    const key = canonicalProductTypePresentationId(product.productType);
    const current = grouped.get(key) ?? [];
    current.push(product);
    grouped.set(key, current);
  }
  if (grouped.size > 32) {
    throw new PromptedStorefrontDesignIntentError("invalid-request");
  }
  return [...grouped.entries()]
    .sort(([left], [right]) => compareCanonical(left, right))
    .map(([canonicalProductTypeId, entries]) => {
      const contexts = entries.map((product) => createDynamicCommerceProductMatchContext(product));
      const optionCounts = contexts.map(({ optionGroupCount }) => optionGroupCount);
      const mediaCounts = entries.map(({ images }) => images.length);
      return {
        productTypeKey: `pdp.product-type.${canonicalProductTypeId}`,
        safeLabel: safeCatalogueLabel(
          [...entries].map(({ productType }) => productType).sort(compareCanonical)[0] ?? "",
        ),
        productCount: entries.length,
        simpleProductCount: contexts.filter(({ optionStructure }) => optionStructure === "simple")
          .length,
        configurableProductCount: contexts.filter(
          ({ optionStructure }) => optionStructure === "configurable",
        ).length,
        optionGroupCountRange: {
          minimum: Math.min(...optionCounts),
          maximum: Math.max(...optionCounts),
        },
        mediaDepthRange: {
          minimum: Math.min(...mediaCounts),
          maximum: Math.max(...mediaCounts),
        },
        highConsiderationPresentationCount: contexts.filter(
          ({ highConsideration }) => highConsideration,
        ).length,
      };
    });
}

/** Compact, deterministic catalogue characteristics without commerce rows. */
export function createPromptedStorefrontCatalogueCharacteristics(
  catalogueInput: CatalogueDisplayModel,
): CatalogueCharacteristics {
  const catalogue = catalogueDisplayModelSchema.parse(structuredClone(catalogueInput));
  const contexts = catalogue.products.map((product) =>
    createDynamicCommerceProductMatchContext(product),
  );
  const optionGroupComplexity = emptyDistribution();
  const mediaDepth = emptyDistribution();
  contexts.forEach(({ optionGroupCount }) => {
    optionGroupComplexity[countBucket(optionGroupCount)] += 1;
  });
  catalogue.products.forEach(({ images }) => {
    mediaDepth[countBucket(images.length)] += 1;
  });
  const membershipSizes = catalogue.collections.map(({ productIds }) => productIds.length);
  const membershipTotal = membershipSizes.reduce((total, size) => total + size, 0);
  return promptedStorefrontCatalogueCharacteristicsSchema.parse({
    productCount: catalogue.products.length,
    collectionCount: catalogue.collections.length,
    productTypes: productTypeRows(catalogue.products),
    simpleProductCount: contexts.filter(({ optionStructure }) => optionStructure === "simple")
      .length,
    configurableProductCount: contexts.filter(
      ({ optionStructure }) => optionStructure === "configurable",
    ).length,
    optionGroupComplexity,
    mediaDepth,
    highConsiderationPresentationCount: contexts.filter(
      ({ highConsideration }) => highConsideration,
    ).length,
    collectionMembershipSize: {
      minimum: membershipSizes.length === 0 ? 0 : Math.min(...membershipSizes),
      maximum: membershipSizes.length === 0 ? 0 : Math.max(...membershipSizes),
      averageRounded:
        membershipSizes.length === 0 ? 0 : Math.round(membershipTotal / membershipSizes.length),
    },
    collectionHierarchy: { depth: "unavailable", childCollections: "unavailable" },
  });
}

export function promptedStorefrontCatalogueProjectionFingerprint(
  input: CatalogueDisplayModel | CatalogueCharacteristics,
): string {
  const parsed = promptedStorefrontCatalogueCharacteristicsSchema.safeParse(input);
  const characteristics = parsed.success
    ? parsed.data
    : createPromptedStorefrontCatalogueCharacteristics(input as CatalogueDisplayModel);
  return `prompted-catalogue-projection-${canonicalValueFingerprint(characteristics)}`;
}

function grammarDimension(
  categoryId: CommercialGrammarCategory["id"],
): PromptedStorefrontCapabilityDimension {
  if (categoryId === "typography.scale") return "design-dna.typography-scale";
  if (categoryId.startsWith("typography.")) return "design-dna.typography-hierarchy";
  if (categoryId === "layout.sectionRhythm") return "homepage.section-rhythm";
  if (categoryId === "layout.density") return "design-dna.density";
  if (categoryId.startsWith("layout.")) return "design-dna.spacing";
  if (categoryId === "surface.role") return "design-dna.surface";
  if (categoryId === "shape.elevation") return "design-dna.depth";
  if (categoryId.startsWith("shape.")) return "design-dna.shape";
  if (categoryId === "action.hierarchy" || categoryId === "control.posture") {
    return "design-dna.control";
  }
  if (categoryId === "media.crop" || categoryId === "media.focalPoint") {
    return "responsive.crop";
  }
  if (categoryId === "media.overlay") return "responsive.overlay";
  if (categoryId.startsWith("media.")) return "design-dna.media";
  if (categoryId === "responsive.transformation") return "responsive.posture";
  return "homepage.narrative-role";
}

function addEntry(
  entries: PromptedStorefrontCapabilityEntry[],
  references: Map<string, PromptedStorefrontCapabilityAuthorityReference>,
  entryInput: PromptedStorefrontCapabilityEntry,
  referenceInput: Omit<
    PromptedStorefrontCapabilityAuthorityReference,
    "key" | "dimension" | "availability" | "selection"
  >,
): void {
  const entry = promptedStorefrontCapabilityEntrySchema.parse(entryInput);
  if (references.has(entry.key)) {
    throw new PromptedStorefrontDesignIntentError("stale-authority");
  }
  const reference = promptedStorefrontCapabilityAuthorityReferenceSchema.parse({
    key: entry.key,
    dimension: entry.dimension,
    availability: entry.availability,
    selection: entry.selection,
    ...referenceInput,
  });
  entries.push(Object.freeze(entry));
  references.set(entry.key, Object.freeze(reference));
}

function addGrammarCapabilities(
  draft: StorefrontSnapshot,
  entries: PromptedStorefrontCapabilityEntry[],
  references: Map<string, PromptedStorefrontCapabilityAuthorityReference>,
): void {
  const grammar = veskifyComponentCapabilityManifest.manifest.commercialDesignGrammar;
  const designDnaFingerprint = brandSystemDesignDnaFingerprint(draft.brandSystem);
  const reachableDna = reachableRegisteredDesignDna(draft);
  const values = <T extends string>(project: (dna: (typeof reachableDna)[number]) => T) =>
    new Set(reachableDna.map(project));
  const designDnaValues: Readonly<Record<string, readonly string[]>> = {
    "typography.scale": [...values(({ typography }) => typography.scale.posture)],
    "typography.weight": [...values(({ typography }) => String(typography.weightPosture))],
    "typography.tracking": [...values(({ typography }) => typography.trackingPosture)],
    "typography.lineHeight": [...values(({ typography }) => typography.lineHeightPosture)],
    "layout.sectionRhythm": [...values(({ spacing }) => spacing.sectionRhythm)],
    "layout.pageGutter": [...values(({ spacing }) => spacing.pageGutter)],
    "layout.gridRhythm": [...values(({ spacing }) => spacing.gridGap)],
    "layout.density": [
      ...values(({ density }) => (density.posture === "balanced" ? "standard" : density.posture)),
    ],
    "control.posture": [...values(({ controls }) => controls.height)],
    "shape.border": [...values(({ surfaces }) => surfaces.border)],
    "shape.radius": [...values(({ surfaces }) => surfaces.radius)],
    "shape.elevation": [...values(({ surfaces }) => surfaces.elevation)],
    "media.ratio": [...values(({ media }) => media.ratio)],
    "media.crop": [...values(({ media }) => media.crop)],
    "media.overlay": [...values(({ media }) => media.overlay)],
    "media.emphasis": [...values(({ media }) => media.prominence)],
  };
  for (const category of grammar.categories) {
    const dimension = grammarDimension(category.id);
    for (const value of category.values) {
      const designDnaConsumesValue = designDnaValues[category.id]?.includes(value) ?? false;
      addEntry(
        entries,
        references,
        {
          key: `${dimension}.${category.id}.${value}`,
          dimension,
          description: `Use the registered ${designLabel(value)} ${designLabel(category.id)} posture.`,
          contexts: ["storefront"],
          availability: designDnaConsumesValue ? "available" : "registered-fail-closed",
          requirements: designDnaConsumesValue
            ? []
            : [
                "Requires an exact PageBlueprint slot, component variant, or other canonical runtime consumer before material selection.",
              ],
          selection: { kind: "capability" },
        },
        {
          authorityKind: designDnaConsumesValue ? "design-dna" : "commercial-grammar",
          authorityId: `${category.id}:${value}`,
          authorityFingerprint: designDnaConsumesValue ? designDnaFingerprint : grammar.fingerprint,
          productTypeKey: false,
        },
      );
    }
  }
}

function reachableRegisteredDesignDna(draft: StorefrontSnapshot) {
  return storefrontDesignSystemV1.directions.map((direction) =>
    resolveBrandSystemDesignDna(
      registeredBrandSystemForDirection(draft.brandSystem, storefrontDesignSystemV1, direction.id, {
        spacingDensity: direction.spacingDensity,
        surfaceDepth: direction.surfaceDepth,
      }),
    ),
  );
}

function exactExecutableResponsiveModes(
  profiles: readonly ExecutablePageBlueprintProfile[],
): ReadonlySet<string> {
  const modes = new Set<string>();
  const addComponentVariant = (
    componentType: string,
    variantId: string,
    defaultVariant: string,
  ) => {
    const component = veskifyComponentCapabilityManifest.getByComponentType(componentType);
    const anatomy = component?.commercialAnatomy;
    const variant = component?.variants.find(({ id }) => id === variantId);
    const anatomyVariant = anatomy?.variants.find((candidate) => candidate.variantId === variantId);
    if (
      !component ||
      !anatomy ||
      !variant ||
      !anatomyVariant ||
      (variantId !== defaultVariant &&
        variant.structuralClassification !== "meaningfulStructuralVariant")
    ) {
      return;
    }
    for (const transformationId of anatomyVariant.structure.responsiveTransformationIds) {
      const transformation = anatomy.responsiveTransformations.find(
        ({ id }) => id === transformationId,
      );
      if (!transformation) throw new PromptedStorefrontDesignIntentError("stale-authority");
      modes.add(transformation.mode);
    }
  };
  const addProductCard = (anatomyId: string | undefined) => {
    if (!anatomyId) return;
    const anatomy = canonicalProductCardAuthority.anatomies.find(({ id }) => id === anatomyId);
    if (!anatomy) throw new PromptedStorefrontDesignIntentError("stale-authority");
    anatomy.responsiveTransformations.forEach(({ mode }) => modes.add(mode));
  };

  for (const profile of profiles) {
    for (const selection of profile.componentSelections) {
      selection.variants.forEach((variantId) =>
        addComponentVariant(selection.component, variantId, selection.defaultVariant),
      );
    }
    addProductCard(profile.commercialHomepage?.productCardAnatomyId);
    addProductCard(profile.commercialCollectionSearch?.productCardAnatomyId);
    addProductCard(profile.commercialProductDetail?.relatedProductCardAnatomyId);
  }
  return modes;
}

function addDesignDnaCapabilities(
  draft: StorefrontSnapshot,
  entries: PromptedStorefrontCapabilityEntry[],
  references: Map<string, PromptedStorefrontCapabilityAuthorityReference>,
): void {
  const reachableDna = reachableRegisteredDesignDna(draft);
  const fingerprint = brandSystemDesignDnaFingerprint(draft.brandSystem);
  const dimensions = [
    {
      dimension: "design-dna.typography-pairing" as const,
      authorityId: "typography.pairing",
      values: designDnaSchema.shape.typography.shape.pairing.options,
      reachable: new Set<string>(reachableDna.map(({ typography }) => typography.pairing)),
    },
    {
      dimension: "design-dna.colour" as const,
      authorityId: "colour.surfaceRelationship",
      values: designDnaSchema.shape.colour.shape.surfaceRelationship.options,
      reachable: new Set<string>(reachableDna.map(({ colour }) => colour.surfaceRelationship)),
    },
    {
      dimension: "design-dna.colour" as const,
      authorityId: "colour.actionRelationship",
      values: designDnaSchema.shape.colour.shape.actionRelationship.options,
      reachable: new Set<string>(reachableDna.map(({ colour }) => colour.actionRelationship)),
    },
    {
      dimension: "design-dna.media" as const,
      authorityId: "media.posture",
      values: designDnaSchema.shape.media.shape.posture.options,
      reachable: new Set<string>(reachableDna.map(({ media }) => media.posture)),
    },
  ];
  dimensions.forEach(({ dimension, authorityId, values, reachable }) => {
    values.forEach((value) => {
      const materiallyReachable = (reachable as ReadonlySet<string>).has(value);
      return addEntry(
        entries,
        references,
        {
          key: `${dimension}.${authorityId}.${value}`,
          dimension,
          description: `Use the bounded ${designLabel(value)} ${designLabel(authorityId)} posture.`,
          contexts: ["storefront"],
          availability: materiallyReachable ? "available" : "registered-fail-closed",
          requirements: materiallyReachable
            ? []
            : ["No exact registered BrandSystem materialization currently produces this value."],
          selection: { kind: "capability" },
        },
        {
          authorityKind: "design-dna",
          authorityId: `${authorityId}:${value}`,
          authorityFingerprint: fingerprint,
          productTypeKey: false,
        },
      );
    });
  });
}

function sharedFrameAggregateFingerprint(): string {
  return `prompted-shared-frame-authority-${canonicalValueFingerprint(
    [...commercialSharedFrameProfiles]
      .sort((left, right) => compareCanonical(left.id, right.id))
      .map(({ id, version, authorityFingerprint }) => ({ id, version, authorityFingerprint })),
  )}`;
}

function addSharedFrameCapabilities(
  entries: PromptedStorefrontCapabilityEntry[],
  references: Map<string, PromptedStorefrontCapabilityAuthorityReference>,
): void {
  for (const frame of [...commercialSharedFrameProfiles].sort((left, right) =>
    compareCanonical(left.id, right.id),
  )) {
    const common = {
      authorityKind: "shared-frame" as const,
      authorityId: frame.id,
      authorityFingerprint: frame.authorityFingerprint,
      productTypeKey: false,
    };
    const traits = [
      ["shared-frame.profile", "profile", frame.id, `Use the ${designLabel(frame.title)} frame.`],
      [
        "shared-frame.header",
        "header",
        frame.headerVariant,
        `Use a ${designLabel(frame.headerVariant)} header posture.`,
      ],
      [
        "shared-frame.navigation",
        "navigation",
        frame.desktopComposition,
        `Use the ${designLabel(frame.desktopComposition)} primary navigation composition.`,
      ],
      [
        "shared-frame.announcement",
        "announcement",
        frame.serviceStrip,
        frame.serviceStrip === "none"
          ? "Use a frame without a service announcement strip."
          : "Use the canonical service announcement treatment.",
      ],
      [
        "shared-frame.utility-navigation",
        "utility-navigation",
        frame.semanticRegions.includes("utilityNavigation") ? "present" : "restrained",
        frame.semanticRegions.includes("utilityNavigation")
          ? "Include a distinct utility-navigation region."
          : "Keep utility navigation restrained within the primary frame.",
      ],
      [
        "shared-frame.footer",
        "footer",
        frame.footerComposition,
        `Use the ${designLabel(frame.footerComposition)} footer composition.`,
      ],
      [
        "shared-frame.mobile-navigation",
        "mobile-navigation",
        frame.mobileNavigationMode,
        `Use ${designLabel(frame.mobileNavigationMode)} mobile navigation.`,
      ],
    ] as const;
    traits.forEach(([dimension, trait, value, description]) =>
      addEntry(
        entries,
        references,
        {
          key: `${dimension}.${frame.id}.${trait}.${value}`,
          dimension,
          description,
          contexts: ["shared-frame", frame.id],
          availability: "available",
          requirements: [],
          selection: { kind: "capability" },
        },
        common,
      ),
    );
    for (const transformationId of sortedUnique(frame.responsiveTransformationIds)) {
      addEntry(
        entries,
        references,
        {
          key: `shared-frame.responsive.${frame.id}.${transformationId}`,
          dimension: "shared-frame.responsive",
          description: `Preserve the ${designLabel(transformationId)} responsive frame behavior.`,
          contexts: ["shared-frame", frame.id],
          availability: "available",
          requirements: [],
          selection: { kind: "capability" },
        },
        common,
      );
    }
  }
}

function profileReference(
  profile: ExecutablePageBlueprintProfile,
): Omit<
  PromptedStorefrontCapabilityAuthorityReference,
  "key" | "dimension" | "availability" | "selection"
> {
  const authority = commercialAuthority(profile);
  if (!authority) throw new PromptedStorefrontDesignIntentError("stale-authority");
  return {
    authorityKind: "page-blueprint",
    authorityId: `${profile.id}@${profile.version}`,
    authorityFingerprint: authority.structuralFingerprint,
    productTypeKey: false,
  };
}

function pdpIntentRoles(
  presentation: NonNullable<
    ExecutablePageBlueprintProfile["commercialProductDetail"]
  >["presentation"],
  genericFallback = false,
): PromptedStorefrontCapabilityIntentRole[] {
  const role =
    presentation === "standard-commerce"
      ? "pdp-standard-simple"
      : presentation === "variant-led"
        ? "pdp-configurable"
        : presentation === "gallery-led"
          ? "pdp-gallery-led"
          : "pdp-high-consideration";
  return genericFallback ? [role, "pdp-generic-fallback"] : [role];
}

function homepageSlotHasApprovedMedia(
  profile: ExecutablePageBlueprintProfile,
  slotId: string,
  approvedAssetRoles: ReadonlySet<string>,
): boolean {
  const selection = profile.componentSelections.find((candidate) => candidate.slotId === slotId);
  const manifestEntry = selection
    ? veskifyComponentCapabilityManifest.getByComponentType(selection.component)
    : undefined;
  if (!selection || !manifestEntry) {
    throw new PromptedStorefrontDesignIntentError("stale-authority");
  }
  return manifestEntry.supportedAssetRoles.some((role) => approvedAssetRoles.has(role));
}

function addPageBlueprintCapabilities(
  draft: StorefrontSnapshot,
  catalogue: CatalogueDisplayModel,
  approvedBrief: StorefrontDesignBriefContract,
  approvedAssetContext: ApprovedGenerationAssetContext | null,
  entries: PromptedStorefrontCapabilityEntry[],
  references: Map<string, PromptedStorefrontCapabilityAuthorityReference>,
): Readonly<{
  reachableVariants: Map<string, Set<string>>;
  exactCandidateComponents: Set<string>;
  exactHomepageComponents: Set<string>;
  exactOverrideTargets: Map<
    string,
    Array<Readonly<{ pageType: "home" | "product"; variants: readonly string[] }>>
  >;
}> {
  const reachableVariants = new Map<string, Set<string>>();
  const exactCandidateComponents = new Set<string>();
  const exactHomepageComponents = new Set<string>();
  const exactOverrideTargets = new Map<
    string,
    Array<Readonly<{ pageType: "home" | "product"; variants: readonly string[] }>>
  >();
  const addExactOverrideTargets = (
    pageType: "home" | "product",
    selections: ExecutablePageBlueprintProfile["componentSelections"],
  ) => {
    const targetsByComponent = new Map<string, typeof selections>();
    selections.forEach((selection) => {
      const targets = targetsByComponent.get(selection.component) ?? [];
      targetsByComponent.set(selection.component, [...targets, selection]);
    });
    targetsByComponent.forEach((targets, component) => {
      const target = targets.length === 1 ? targets[0] : undefined;
      if (!target) return;
      const current = exactOverrideTargets.get(component) ?? [];
      exactOverrideTargets.set(component, [
        ...current,
        { pageType, variants: [...target.variants] },
      ]);
    });
  };
  const exactContentSupportAvailability = (
    profile: ExecutablePageBlueprintProfile,
    familyId: string,
  ): PromptedStorefrontCapabilityEntry["availability"] => {
    const currentPages = draft.pages.filter(
      ({ pageFamily }) =>
        pageFamily?.familyId === familyId &&
        pageFamily.profileId === profile.id &&
        pageFamily.profileVersion === profile.version,
    );
    if (currentPages.length === 0) return "registered-fail-closed";
    const hasExactApprovedEvidence = currentPages.every(({ pageFamily }) => {
      if (!pageFamily || pageFamily.evidenceReferences.length === 0) return false;
      return pageFamily.evidenceReferences.every((reference) =>
        draft.contentSupportFactDocuments.some(
          (document) =>
            document.payload.familyId === familyId &&
            canonicalValueString(document.evidence) === canonicalValueString(reference),
        ),
      );
    });
    return hasExactApprovedEvidence ? "available" : "evidence-dependent";
  };
  const homepageEvidence = resolveCommercialHomepageEvidenceAvailability({
    canonicalProductCount: catalogue.products.length,
    canonicalCollectionCount: catalogue.collections.length,
    merchantDescription: approvedBrief.businessIdentity.shortDescription,
    briefApprovalStatus: approvedBrief.approval.status,
    approvedEvidenceFingerprint: approvedBrief.approvedEvidenceFingerprint,
  });
  const approvedMerchantEvidenceAvailable = homepageEvidence.approvedMerchantEvidence;
  const approvedAssetRoles = new Set(approvedAssetContext?.assets.map(({ role }) => role) ?? []);
  const plansByProfileId = new Map(
    listExecutablePageBlueprintProfiles().flatMap((plan) =>
      plan.profile ? [[plan.profile.id, plan] as const] : [],
    ),
  );
  for (const profile of currentCommercialProfiles()) {
    profile.componentSelections.forEach(({ component, variants }) => {
      const reachable = reachableVariants.get(component) ?? new Set<string>();
      variants.forEach((variant) => reachable.add(variant));
      reachableVariants.set(component, reachable);
    });
    if (profile.commercialHomepage) {
      const authority = profile.commercialHomepage;
      const plan = plansByProfileId.get(profile.id);
      if (!plan) throw new PromptedStorefrontDesignIntentError("stale-authority");
      const evidenceIsUnsatisfied = (
        requirement: (typeof authority.evidenceRequirements)[number],
      ) => {
        if (requirement.authority === "canonical-commerce") {
          if (!homepageEvidence.canonicalCommerce) return true;
          const cardinality = authority.contentCardinality.find(
            ({ slotId }) => slotId === requirement.slotId,
          );
          if (!cardinality) return false;
          const count =
            cardinality.resource === "products"
              ? catalogue.products.length
              : catalogue.collections.length;
          return count < cardinality.minimum;
        }
        if (requirement.authority === "approved-media") {
          return !homepageSlotHasApprovedMedia(profile, requirement.slotId, approvedAssetRoles);
        }
        if (requirement.authority === "approved-merchant-evidence") {
          return !approvedMerchantEvidenceAvailable;
        }
        return false;
      };
      const unsatisfiedEvidence = [
        ...authority.evidenceRequirements.filter(
          (requirement) =>
            requirement.unsatisfiedPolicy === "fail-closed" && evidenceIsUnsatisfied(requirement),
        ),
        ...authority.contentCardinality.flatMap((cardinality) => {
          const availableCount =
            cardinality.resource === "products"
              ? catalogue.products.length
              : catalogue.collections.length;
          const alreadyDeclared = authority.evidenceRequirements.some(
            (requirement) =>
              requirement.slotId === cardinality.slotId &&
              requirement.authority === "canonical-commerce" &&
              requirement.unsatisfiedPolicy === "fail-closed",
          );
          return availableCount < cardinality.minimum && !alreadyDeclared
            ? [
                {
                  slotId: cardinality.slotId,
                  authority: "canonical-commerce" as const,
                  unsatisfiedPolicy: "fail-closed" as const,
                },
              ]
            : [];
        }),
      ].filter(
        (requirement, index, requirements) =>
          requirements.findIndex(
            (candidate) =>
              candidate.slotId === requirement.slotId &&
              candidate.authority === requirement.authority,
          ) === index,
      );
      const availability = unsatisfiedEvidence.length === 0 ? "available" : "evidence-dependent";
      const approvedMediaSlotIds = plan.slots
        .filter((slot) => homepageSlotHasApprovedMedia(profile, slot.id, approvedAssetRoles))
        .map((slot) => slot.id);
      const includedSlotIds =
        availability === "available"
          ? new Set(
              resolveCommercialHomepageProfileSlots(profile.id, {
                ...homepageEvidence,
                approvedMediaSlotIds,
              }).includedSlotIds,
            )
          : new Set(plan.slots.map((slot) => slot.id));
      if (availability === "available") {
        const exactSelections = profile.componentSelections.filter(({ slotId }) =>
          includedSlotIds.has(slotId),
        );
        exactSelections.forEach(({ component }) => {
          exactCandidateComponents.add(component);
          exactHomepageComponents.add(component);
        });
        addExactOverrideTargets("home", exactSelections);
      }
      addEntry(
        entries,
        references,
        {
          key: `homepage.profile.${profile.id}`,
          dimension: "homepage.profile",
          description: `Use the registered ${designLabel(profile.id)} homepage narrative.`,
          contexts: ["home", ...authority.compatibleSharedFrameProfileIds],
          availability,
          requirements: unsatisfiedEvidence.map(
            ({ authority: evidenceAuthority }) =>
              `Requires current ${designLabel(evidenceAuthority)} authority.`,
          ),
          selection: { kind: "capability" },
        },
        profileReference(profile),
      );
      // The current materializer includes every evidence-resolved slot exactly once; it does
      // not expose provider-controlled optional cardinality. Advertise that executable count,
      // rather than the wider registered design-time range, so a valid hard count can never be
      // accepted and then silently materialized differently.
      const minimum = includedSlotIds.size;
      const maximum = includedSlotIds.size;
      addEntry(
        entries,
        references,
        {
          key: `homepage.section-count.${profile.id}`,
          dimension: "homepage.section-count",
          description: `Keep the ${designLabel(profile.id)} homepage within its registered section range.`,
          contexts: ["home", profile.id],
          availability,
          requirements: unsatisfiedEvidence.map(
            ({ authority: evidenceAuthority }) =>
              `Requires current ${designLabel(evidenceAuthority)} authority.`,
          ),
          selection: { kind: "number", minimum, maximum },
        },
        profileReference(profile),
      );
      for (const slot of [...plan.slots].sort((left, right) =>
        compareCanonical(left.id, right.id),
      )) {
        const slotEvidence = authority.evidenceRequirements.filter(
          (requirement) => requirement.slotId === slot.id && evidenceIsUnsatisfied(requirement),
        );
        const unavailableEvidence = [...unsatisfiedEvidence, ...slotEvidence].filter(
          (requirement, index, requirements) =>
            requirements.findIndex(
              (candidate) =>
                candidate.slotId === requirement.slotId &&
                candidate.authority === requirement.authority,
            ) === index,
        );
        addEntry(
          entries,
          references,
          {
            key: `homepage.narrative-role.${profile.id}.${slot.id}.${slot.narrativeRole}`,
            dimension: "homepage.narrative-role",
            description: `Use ${designLabel(slot.narrativeRole)} in the ${designLabel(slot.id)} homepage role.`,
            contexts: ["home", profile.id, slot.id],
            availability: unavailableEvidence.length === 0 ? "available" : "evidence-dependent",
            requirements: unavailableEvidence.map(
              ({ authority: evidenceAuthority }) =>
                `Requires current ${designLabel(evidenceAuthority)} authority.`,
            ),
            selection: { kind: "capability" },
          },
          {
            ...profileReference(profile),
            authorityId: `${profile.id}@${profile.version}:${slot.id}`,
          },
        );
      }
      for (const selection of [...profile.componentSelections].sort((left, right) =>
        compareCanonical(left.slotId, right.slotId),
      )) {
        const manifestEntry = veskifyComponentCapabilityManifest.getByComponentType(
          selection.component,
        );
        if (!manifestEntry?.commercialAnatomy) {
          throw new PromptedStorefrontDesignIntentError("stale-authority");
        }
        const executableAssetSlots = new Set(
          selection.variants.flatMap((variantId) => {
            const variant = manifestEntry.variants.find(({ id }) => id === variantId);
            const anatomyVariant = manifestEntry.commercialAnatomy?.variants.find(
              ({ variantId: candidateId }) => candidateId === variantId,
            );
            return variant &&
              anatomyVariant &&
              (variantId === selection.defaultVariant ||
                variant.structuralClassification === "meaningfulStructuralVariant")
              ? anatomyVariant.structure.assetPlacements.map(({ slotId }) => slotId)
              : [];
          }),
        );
        for (const assetSlot of [...manifestEntry.assetSlots]
          .filter(({ id }) => executableAssetSlots.has(id))
          .sort((left, right) => compareCanonical(left.id, right.id))) {
          for (const role of [...assetSlot.acceptedRoles]
            .filter(
              (candidate) =>
                candidate !== "productMainImage" && candidate !== "productAlternativeImage",
            )
            .sort(compareCanonical)) {
            const approvedAsset = approvedAssetContext?.assets
              .filter((asset) => asset.role === role)
              .sort((left, right) => compareCanonical(left.assetId, right.assetId))[0];
            addEntry(
              entries,
              references,
              {
                key: `homepage.asset-role.${profile.id}.${selection.slotId}.${assetSlot.id}.${role}`,
                dimension: "homepage.asset-role",
                description: `Use approved ${designLabel(role)} imagery in the registered ${designLabel(selection.slotId)} homepage placement.`,
                contexts: ["home", profile.id, selection.slotId, selection.component],
                availability: approvedAsset ? "available" : "evidence-dependent",
                requirements: approvedAsset
                  ? []
                  : [`Requires an approved ${designLabel(role)} asset.`],
                selection: { kind: "capability" },
              },
              {
                authorityKind: "approved-assets",
                authorityId: approvedAsset
                  ? exactHomepageAssetAuthorityId({
                      profileId: profile.id,
                      slotId: selection.slotId,
                      component: selection.component,
                      assetSlotId: assetSlot.id,
                      role,
                      assetId: approvedAsset.assetId,
                      assetRevision: approvedAsset.revision,
                      materialFingerprint: approvedAsset.materialFingerprint,
                    })
                  : `approved-assets:none:${profile.id}:${selection.slotId}:${selection.component}:${assetSlot.id}:${role}`,
                authorityFingerprint:
                  approvedAssetContext?.fingerprint ?? exactAbsenceFingerprint("approved-assets"),
                productTypeKey: false,
              },
            );
          }
        }
      }
    }
    if (profile.commercialCollectionSearch) {
      const authority = profile.commercialCollectionSearch;
      const missingAssetRoles = profile.requiredAssetRoles.filter(
        (role) => !approvedAssetRoles.has(role),
      );
      const availability = missingAssetRoles.length === 0 ? "available" : "evidence-dependent";
      const requirements = missingAssetRoles.map(
        (role) => `Requires an approved ${designLabel(role)} asset.`,
      );
      if (availability === "available") {
        profile.componentSelections.forEach(({ component }) =>
          exactCandidateComponents.add(component),
        );
        // Collection and search profiles are selected together. Their shared component identity
        // is therefore not a single generic instance-override target; exact profile authority
        // remains available, while generic variant/parameter authority stays fail closed.
      }
      const capabilities = [
        [
          "collection-search.archetype",
          "archetype",
          profile.id,
          `Use the registered ${designLabel(authority.presentationMode)} collection PageBlueprint.`,
        ],
        [
          "collection-search.discovery",
          "discovery",
          authority.presentationMode,
          `Use ${designLabel(authority.presentationMode)} product discovery.`,
        ],
        [
          "collection-search.density",
          "density",
          authority.gridDensity,
          `Use ${designLabel(authority.gridDensity)} result density.`,
        ],
        [
          "collection-search.filter-sort",
          "filter-sort",
          authority.filterLayout,
          `Use a ${designLabel(authority.filterLayout)} filter and sort posture.`,
        ],
        [
          "collection-search.child-collection",
          "child-collection",
          authority.childCollectionTreatment,
          `Use ${designLabel(authority.childCollectionTreatment)} child-collection presentation.`,
        ],
        [
          "collection-search.merchandising",
          "merchandising",
          authority.resultsTreatment,
          `Use ${designLabel(authority.resultsTreatment)} merchandising.`,
        ],
      ] as const;
      capabilities.forEach(([dimension, trait, value, description]) =>
        addEntry(
          entries,
          references,
          {
            key: `${dimension}.profile.${profile.id}.${trait}.${value}`,
            dimension,
            description,
            contexts: ["collection", profile.id],
            availability,
            requirements,
            selection: { kind: "capability" },
          },
          profileReference(profile),
        ),
      );
    }
    if (profile.commercialProductDetail) {
      const authority = profile.commercialProductDetail;
      const evidenceIsUnsatisfied = (
        requirement: (typeof authority.evidenceRequirements)[number],
      ) => {
        if (requirement.authority === "canonical-commerce") {
          return catalogue.products.length === 0;
        }
        if (requirement.authority === "approved-media") return approvedAssetRoles.size === 0;
        return !approvedMerchantEvidenceAvailable;
      };
      const unsatisfiedEvidence = authority.evidenceRequirements.filter(
        (requirement) =>
          requirement.unsatisfiedPolicy === "fail-closed" && evidenceIsUnsatisfied(requirement),
      );
      const availability = unsatisfiedEvidence.length === 0 ? "available" : "evidence-dependent";
      const requirements = unsatisfiedEvidence.map(
        ({ authority: evidenceAuthority }) =>
          `Requires current ${designLabel(evidenceAuthority)} authority.`,
      );
      if (availability === "available") {
        profile.componentSelections.forEach(({ component }) =>
          exactCandidateComponents.add(component),
        );
        addExactOverrideTargets("product", profile.componentSelections);
      }
      const reference = {
        ...profileReference(profile),
        intentRoles: pdpIntentRoles(authority.presentation),
      };
      const capabilities = [
        [
          "pdp.archetype",
          "archetype",
          authority.presentation,
          `Use the registered ${designLabel(authority.presentation)} PDP PageBlueprint.`,
        ],
        [
          "pdp.media",
          "media",
          authority.dynamicProductDetailProps.mediaTreatment,
          `Use ${designLabel(authority.dynamicProductDetailProps.mediaTreatment)} product-media presentation.`,
        ],
        [
          "pdp.purchase-hierarchy",
          "purchase-hierarchy",
          authority.presentation,
          `Use the ${designLabel(authority.presentation)} purchase-decision hierarchy.`,
        ],
        [
          "pdp.related-merchandising",
          "related-merchandising",
          authority.relatedProductCardAnatomyId,
          `Use ${designLabel(authority.relatedProductCardAnatomyId)} related-product merchandising.`,
        ],
      ] as const;
      capabilities.forEach(([dimension, trait, value, description]) =>
        addEntry(
          entries,
          references,
          {
            key: `${dimension}.profile.${profile.id}.${trait}.${value}`,
            dimension,
            description,
            contexts: ["product", profile.id],
            availability,
            requirements,
            selection: { kind: "capability" },
          },
          reference,
        ),
      );
    }
    if (profile.commercialContentSupport) {
      const authority = profile.commercialContentSupport;
      for (const familyId of [...authority.pageFamilyIds].sort(compareCanonical)) {
        const availability = exactContentSupportAvailability(profile, familyId);
        const requirements =
          availability === "available"
            ? []
            : availability === "evidence-dependent"
              ? ["Requires current approved merchant facts for this exact page family."]
              : [
                  "Requires this exact profile to be selected by the current canonical page-family authority.",
                ];
        addEntry(
          entries,
          references,
          {
            key: `content-support.profile.${profile.id}.${familyId}`,
            dimension: "content-support.profile",
            description: `Use the ${designLabel(profile.id)} approved-fact composition for ${designLabel(familyId)}.`,
            contexts: [familyId],
            availability,
            requirements,
            selection: { kind: "capability" },
          },
          {
            ...profileReference(profile),
            authorityId: `${profile.id}@${profile.version}:${familyId}`,
          },
        );
        for (const role of sortedUnique(profile.orderedNarrativeRoles)) {
          addEntry(
            entries,
            references,
            {
              key: `content-support.narrative-purpose.${profile.id}.${familyId}.${role}`,
              dimension: "content-support.narrative-purpose",
              description: `Use the ${designLabel(role)} narrative purpose for approved ${designLabel(familyId)} content.`,
              contexts: [familyId],
              availability,
              requirements,
              selection: { kind: "capability" },
            },
            {
              ...profileReference(profile),
              authorityId: `${profile.id}@${profile.version}:${familyId}:${role}`,
            },
          );
        }
      }
    }
    if (profile.commercialUtility) {
      const authority = profile.commercialUtility;
      addEntry(
        entries,
        references,
        {
          key: `utility.profile.${profile.id}`,
          dimension: "utility.profile",
          description: `Use the governed ${designLabel(authority.state)} presentation state.`,
          contexts: ["utility", profile.scope],
          availability: "available",
          requirements: authority.requiredRuntimeCapabilities.map(
            (capability) => `The runtime must supply ${designLabel(capability)} action authority.`,
          ),
          selection: { kind: "capability" },
        },
        profileReference(profile),
      );
    }
  }
  for (const family of listPageFamilyDefinitions()
    .filter(({ evidenceRequirement }) => evidenceRequirement === "approved-facts")
    .sort((left, right) => compareCanonical(left.id, right.id))) {
    addEntry(
      entries,
      references,
      {
        key: `content-support.omission.${family.id}.${family.omissionBehavior}`,
        dimension: "content-support.omission",
        description:
          family.presenceAuthority.kind === "optional"
            ? `Omit ${designLabel(family.id)} safely when approved facts are unavailable.`
            : `Fail closed when required ${designLabel(family.id)} facts are unavailable.`,
        contexts: [family.id],
        availability: "available",
        requirements: ["Never invent merchant policy, service, location, or campaign facts."],
        selection: { kind: "capability" },
      },
      {
        authorityKind: "approved-evidence",
        authorityId: family.id,
        authorityFingerprint: `approved-evidence-${canonicalValueFingerprint(
          draft.contentSupportFactDocuments
            .filter(({ payload }) => payload.familyId === family.id)
            .map(({ fingerprint }) => fingerprint)
            .sort(compareCanonical),
        )}`,
        productTypeKey: false,
      },
    );
  }
  return {
    reachableVariants,
    exactCandidateComponents,
    exactHomepageComponents,
    exactOverrideTargets,
  };
}

function candidateInfluencingComponents(
  profiles: readonly ExecutablePageBlueprintProfile[],
): ReadonlySet<string> {
  return new Set(
    profiles.flatMap((profile) =>
      profile.commercialHomepage ||
      profile.commercialCollectionSearch ||
      profile.commercialProductDetail
        ? profile.componentSelections.map(({ component }) => component)
        : [],
    ),
  );
}

function addComponentCapabilities(
  profiles: readonly ExecutablePageBlueprintProfile[],
  reachableVariants: ReadonlyMap<string, ReadonlySet<string>>,
  exactCandidateComponents: ReadonlySet<string>,
  exactHomepageComponents: ReadonlySet<string>,
  exactOverrideTargets: ReadonlyMap<
    string,
    ReadonlyArray<Readonly<{ pageType: "home" | "product"; variants: readonly string[] }>>
  >,
  entries: PromptedStorefrontCapabilityEntry[],
  references: Map<string, PromptedStorefrontCapabilityAuthorityReference>,
): void {
  const candidateComponents = candidateInfluencingComponents(profiles);
  const componentContexts = new Map<string, Set<string>>();
  profiles.forEach((profile) =>
    profile.componentSelections.forEach(({ component }) => {
      const contexts = componentContexts.get(component) ?? new Set<string>();
      contexts.add(profile.scope);
      componentContexts.set(component, contexts);
    }),
  );
  for (const component of veskifyComponentCapabilityManifest.manifest.entries) {
    const contexts = [...(componentContexts.get(component.componentType) ?? [])].sort(
      compareCanonical,
    );
    const reachable = reachableVariants.get(component.componentType);
    if (!component.commercialAnatomy || !reachable || contexts.length === 0) continue;
    const reachesExactCandidate = exactCandidateComponents.has(component.componentType);
    const componentOverrideTargets = exactOverrideTargets.get(component.componentType) ?? [];
    const influencesCoreCandidate =
      candidateComponents.has(component.componentType) && reachesExactCandidate;
    addEntry(
      entries,
      references,
      {
        key: `component.family.${component.componentType}`,
        dimension: "component.family",
        description: `Use the registered ${designLabel(component.componentType)} ${designLabel(component.family)} family.`,
        contexts,
        availability: influencesCoreCandidate ? "available" : "registered-fail-closed",
        requirements: influencesCoreCandidate
          ? []
          : [
              "No selected core storefront candidate or canonical materialization consumes this generic component family.",
            ],
        selection: { kind: "capability" },
      },
      {
        authorityKind: "component-manifest",
        authorityId: component.componentType,
        authorityFingerprint: component.fingerprint,
        productTypeKey: false,
      },
    );
    if (contexts.includes("home")) {
      addEntry(
        entries,
        references,
        {
          key: `homepage.component-family.${component.componentType}`,
          dimension: "homepage.component-family",
          description: `Use ${designLabel(component.componentType)} in a compatible homepage profile.`,
          contexts: ["home"],
          availability: exactHomepageComponents.has(component.componentType)
            ? "available"
            : "registered-fail-closed",
          requirements: exactHomepageComponents.has(component.componentType)
            ? []
            : ["Current evidence does not permit a materialized homepage slot using this family."],
          selection: { kind: "capability" },
        },
        {
          authorityKind: "component-manifest",
          authorityId: component.componentType,
          authorityFingerprint: component.fingerprint,
          productTypeKey: false,
        },
      );
    }
    for (const variant of component.variants.filter(
      ({ id, structuralClassification }) =>
        reachable.has(id) && structuralClassification === "meaningfulStructuralVariant",
    )) {
      const hasExactVariantTarget = componentOverrideTargets.some(({ variants }) =>
        variants.includes(variant.id),
      );
      const hasExactHomepageVariantTarget = componentOverrideTargets.some(
        ({ pageType, variants }) => pageType === "home" && variants.includes(variant.id),
      );
      const reference = {
        authorityKind: "component-manifest" as const,
        authorityId: `${component.componentType}:${variant.id}`,
        authorityFingerprint: component.commercialAnatomy.fingerprint,
        productTypeKey: false,
      };
      addEntry(
        entries,
        references,
        {
          key: `component.meaningful-variant.${component.componentType}.${variant.id}`,
          dimension: "component.meaningful-variant",
          description: `Use the materially distinct ${designLabel(variant.id)} ${designLabel(component.componentType)} anatomy.`,
          contexts,
          availability: hasExactVariantTarget ? "available" : "registered-fail-closed",
          requirements: hasExactVariantTarget
            ? []
            : ["No single exact materialized PageBlueprint slot accepts this generic variant."],
          selection: { kind: "capability" },
        },
        reference,
      );
      if (contexts.includes("home")) {
        addEntry(
          entries,
          references,
          {
            key: `homepage.meaningful-variant.${component.componentType}.${variant.id}`,
            dimension: "homepage.meaningful-variant",
            description: `Use the ${designLabel(variant.id)} ${designLabel(component.componentType)} homepage anatomy.`,
            contexts: ["home"],
            availability: hasExactHomepageVariantTarget ? "available" : "registered-fail-closed",
            requirements: hasExactHomepageVariantTarget
              ? []
              : ["No single exact materialized PageBlueprint slot accepts this generic variant."],
            selection: { kind: "capability" },
          },
          reference,
        );
      }
    }
    for (const parameter of component.boundedParameters) {
      const runtimeProjection = getBoundedParameterRuntimeProjectionAuthority(
        component.componentType,
        parameter.id,
      );
      let selection: PromptedStorefrontCapabilityEntry["selection"];
      if (runtimeProjection?.allowedValues) {
        const allowedValues = runtimeProjection.allowedValues.map(String).sort(compareCanonical);
        if (allowedValues.length > 32) {
          throw new PromptedStorefrontDesignIntentError("stale-authority");
        }
        selection = { kind: "enum", allowedValues };
      } else if (runtimeProjection?.numericRange) {
        selection = { kind: "number", ...runtimeProjection.numericRange };
      } else if (parameter.allowedValues) {
        selection = {
          kind: "enum",
          allowedValues: parameter.allowedValues.map(String).sort(compareCanonical),
        };
      } else if (parameter.numericRange) {
        selection = { kind: "number", ...parameter.numericRange };
      } else {
        throw new PromptedStorefrontDesignIntentError("stale-authority");
      }
      const materiallyAvailable =
        parameter.authority.instanceOverrideAllowed &&
        runtimeProjection !== null &&
        componentOverrideTargets.some(
          ({ pageType, variants }) =>
            parameter.compatiblePageTypes.includes(pageType) &&
            (parameter.compatibleVariants.length === 0 ||
              variants.some((variant) => parameter.compatibleVariants.includes(variant))),
        );
      addEntry(
        entries,
        references,
        {
          key: `component.bounded-parameter.${component.componentType}.${parameter.id}`,
          dimension: "component.bounded-parameter",
          description: `Set the bounded ${designLabel(parameter.id)} parameter for ${designLabel(component.componentType)}.`,
          contexts,
          availability: materiallyAvailable ? "available" : "registered-fail-closed",
          requirements: materiallyAvailable
            ? []
            : [
                parameter.authority.instanceOverrideAllowed && runtimeProjection !== null
                  ? "No single exact materialized PageBlueprint slot accepts this generic bounded parameter."
                  : parameter.authority.instanceOverrideAllowed
                    ? "This bounded value has no exact current renderer projection and cannot be selected materially."
                    : "This value is registered for PageBlueprint or component-variant authority and cannot be selected as an instance override.",
              ],
          selection,
        },
        {
          authorityKind: "component-manifest",
          authorityId: `${component.componentType}:${parameter.id}`,
          authorityFingerprint: component.fingerprint,
          productTypeKey: false,
        },
      );
    }
  }
}

function addProductCardCapabilities(
  entries: PromptedStorefrontCapabilityEntry[],
  references: Map<string, PromptedStorefrontCapabilityAuthorityReference>,
): void {
  for (const anatomy of [...canonicalProductCardAuthority.anatomies].sort((left, right) =>
    compareCanonical(left.id, right.id),
  )) {
    const reference = {
      authorityKind: "product-card" as const,
      authorityId: anatomy.id,
      authorityFingerprint: canonicalProductCardAuthority.fingerprint,
      productTypeKey: false,
    };
    if (
      anatomy.supportedContexts.includes("collectionResults") ||
      anatomy.supportedContexts.includes("searchResults")
    ) {
      addEntry(
        entries,
        references,
        {
          key: `collection-search.product-card.${anatomy.id}`,
          dimension: "collection-search.product-card",
          description: `Use the ${designLabel(anatomy.semanticName)} product-card anatomy for discovery results.`,
          contexts: anatomy.supportedContexts.filter((context) =>
            ["collectionResults", "searchResults"].includes(context),
          ),
          availability: "available",
          requirements: ["Canonical product facts and media remain protected."],
          selection: { kind: "capability" },
        },
        reference,
      );
    }
    if (anatomy.supportedContexts.includes("relatedProducts")) {
      for (const dimension of ["pdp.product-card", "pdp.related-merchandising"] as const) {
        addEntry(
          entries,
          references,
          {
            key: `${dimension}.${anatomy.id}`,
            dimension,
            description: `Use the ${designLabel(anatomy.semanticName)} product-card anatomy for related merchandising.`,
            contexts: ["product", "related-products"],
            availability: "available",
            requirements: ["Canonical related-product facts remain protected."],
            selection: { kind: "capability" },
          },
          reference,
        );
      }
    }
  }
}

function assertDynamicAuthorityMatchesCatalogue(
  catalogue: CatalogueDisplayModel,
  productTypeIds: readonly string[],
): void {
  const current = sortedUnique(
    catalogue.products.map(({ productType }) => canonicalProductTypePresentationId(productType)),
  );
  const registered = sortedUnique(productTypeIds);
  if (
    current.length !== registered.length ||
    current.some((productTypeId, index) => productTypeId !== registered[index])
  ) {
    throw new PromptedStorefrontDesignIntentError("stale-authority");
  }
}

function assertProjectedDynamicArchetypeAuthority(
  archetype: DynamicCommerceCollectionSearchArchetype | DynamicCommerceProductDetailArchetype,
  plan: StorefrontTemplatePagePlan,
  currentSharedFrameProfileId: string | undefined,
): void {
  const profile = plan.profile;
  if (!profile) throw new PromptedStorefrontDesignIntentError("stale-authority");
  const profileAuthority =
    archetype.family === "collection-search"
      ? profile.commercialCollectionSearch
      : profile.commercialProductDetail;
  const expectedComponent =
    archetype.family === "collection-search" ? "dynamicCollectionCommerce" : "dynamicProductDetail";
  const expectedAnatomyId =
    archetype.family === "collection-search"
      ? profile.commercialCollectionSearch?.productCardAnatomyId
      : profile.commercialProductDetail?.relatedProductCardAnatomyId;
  const expectedImagePosture = profileAuthority?.designDnaNarrowing.imagePosture[0];
  const expectedArtDirection = expectedImagePosture
    ? {
        imagePosture: expectedImagePosture,
        ratio:
          archetype.family === "product-detail" && expectedImagePosture === "contained"
            ? "portrait"
            : "natural",
        crop: expectedImagePosture === "contained" ? "contain" : "editorial",
        overlay: "none",
      }
    : undefined;
  const canonicalStrings = (values: readonly string[]) => [...values].sort(compareCanonical);
  const canonicalNarrowing = (value: {
    spacingDensity: readonly string[];
    surfaceDepth: readonly string[];
    imagePosture: readonly string[];
  }) => ({
    spacingDensity: canonicalStrings(value.spacingDensity),
    surfaceDepth: canonicalStrings(value.surfaceDepth),
    imagePosture: canonicalStrings(value.imagePosture),
  });

  let authorityValidation: ReturnType<typeof validateExecutablePageBlueprintAuthority>;
  try {
    authorityValidation = validateExecutablePageBlueprintAuthority({ pagePlan: plan });
  } catch {
    throw new PromptedStorefrontDesignIntentError("stale-authority");
  }

  if (
    !profileAuthority ||
    archetype.profile.fingerprint !== authorityValidation.fingerprint ||
    profile.version !== archetype.profile.profileVersion ||
    archetype.componentPresentations.length !== plan.slots.length ||
    (currentSharedFrameProfileId !== undefined &&
      !archetype.compatibleSharedFrameProfileIds.includes(currentSharedFrameProfileId)) ||
    canonicalValueString(canonicalStrings(profileAuthority.compatibleSharedFrameProfileIds)) !==
      canonicalValueString(canonicalStrings(archetype.compatibleSharedFrameProfileIds)) ||
    profileAuthority.defaultSharedFrameProfileId !== archetype.defaultSharedFrameProfileId ||
    canonicalValueString(canonicalNarrowing(profileAuthority.designDnaNarrowing)) !==
      canonicalValueString(canonicalNarrowing(archetype.designDnaNarrowing)) ||
    canonicalValueString(profileAuthority.responsiveArchitecture) !==
      canonicalValueString(archetype.responsivePosture) ||
    canonicalValueString(expectedArtDirection) !==
      canonicalValueString(archetype.artDirectionPosture) ||
    archetype.fallbackBehavior !== "use-family-fallback"
  ) {
    throw new PromptedStorefrontDesignIntentError("stale-authority");
  }
  try {
    archetype.componentPresentations.forEach((presentation, index) => {
      const slot = plan.slots[index];
      const selection = profile.componentSelections[index];
      const boundedParameters = slot
        ? authorityValidation.boundedParametersBySlotId[slot.id]
        : undefined;
      const definition =
        archetype.family === "collection-search"
          ? dynamicCollectionCommerceDefinition
          : dynamicProductDetailDefinition;
      if (
        !slot ||
        !selection ||
        !boundedParameters ||
        slot.sectionType !== expectedComponent ||
        !definition.supportedPageTypes.includes(plan.pageType) ||
        !definition.variants.some(({ id }) => id === slot.defaultVariant) ||
        presentation.slotId !== slot.id ||
        presentation.component !== slot.sectionType ||
        !selection.variants.includes(presentation.variant) ||
        (slot.required && !presentation.visible) ||
        presentation.anatomyId !== expectedAnatomyId ||
        canonicalValueString(presentation.boundedParameters) !==
          canonicalValueString(boundedParameters)
      ) {
        throw new Error("The projected component presentation is stale.");
      }
      if (archetype.family === "collection-search") {
        dynamicCollectionCommerceContentSchema.parse(presentation.content);
        dynamicCollectionCommercePropsSchema.parse(presentation.props);
        if (presentation.styleOverrides) {
          dynamicCollectionCommerceStyleOverridesSchema.parse(presentation.styleOverrides);
        }
      } else {
        dynamicProductDetailContentSchema.parse(presentation.content);
        dynamicProductDetailPropsSchema.parse(presentation.props);
        if (presentation.styleOverrides) {
          dynamicProductDetailStyleOverridesSchema.parse(presentation.styleOverrides);
        }
      }
    });
  } catch {
    throw new PromptedStorefrontDesignIntentError("stale-authority");
  }
}

function addDynamicCommerceCapabilities(
  draft: StorefrontSnapshot,
  catalogue: CatalogueDisplayModel,
  plansByProfileId: ReadonlyMap<string, StorefrontTemplatePagePlan>,
  entries: PromptedStorefrontCapabilityEntry[],
  references: Map<string, PromptedStorefrontCapabilityAuthorityReference>,
): void {
  if (!draft.dynamicCommercePresentation) {
    throw new PromptedStorefrontDesignIntentError("stale-authority");
  }
  const authority = dynamicCommercePresentationAuthoritySchema.parse(
    draft.dynamicCommercePresentation,
  );
  assertDynamicAuthorityMatchesCatalogue(
    catalogue,
    authority.productTypeMappings.map(({ productTypeId }) => productTypeId),
  );
  const dynamicReference = (authorityId: string, productTypeKey = false) => ({
    authorityKind: "dynamic-commerce" as const,
    authorityId,
    authorityFingerprint: authority.authorityFingerprint,
    productTypeKey,
  });
  for (const archetype of [...authority.collectionSearchArchetypes].sort((left, right) =>
    compareCanonical(left.id, right.id),
  )) {
    const plan = plansByProfileId.get(archetype.profile.profileId);
    const profile = plan?.profile;
    const profileAuthority = profile?.commercialCollectionSearch;
    if (!plan || !profileAuthority) {
      throw new PromptedStorefrontDesignIntentError("stale-authority");
    }
    assertProjectedDynamicArchetypeAuthority(archetype, plan, draft.sharedFrame?.profileId);
    const availability = archetype.supportedContexts.includes("collection")
      ? "available"
      : "registered-fail-closed";
    const capabilities = [
      [
        "collection-search.archetype",
        "archetype",
        archetype.id,
        `Use the ${designLabel(profileAuthority.presentationMode)} collection archetype.`,
      ],
      [
        "collection-search.discovery",
        "discovery",
        profileAuthority.presentationMode,
        `Use ${designLabel(profileAuthority.presentationMode)} product discovery.`,
      ],
      [
        "collection-search.density",
        "density",
        profileAuthority.gridDensity,
        `Use ${designLabel(profileAuthority.gridDensity)} result density.`,
      ],
      [
        "collection-search.filter-sort",
        "filter-sort",
        profileAuthority.filterLayout,
        `Use a ${designLabel(profileAuthority.filterLayout)} filter and sort posture.`,
      ],
      [
        "collection-search.child-collection",
        "child-collection",
        profileAuthority.childCollectionTreatment,
        `Use ${designLabel(profileAuthority.childCollectionTreatment)} child-collection presentation.`,
      ],
      [
        "collection-search.merchandising",
        "merchandising",
        profileAuthority.resultsTreatment,
        `Use ${designLabel(profileAuthority.resultsTreatment)} merchandising.`,
      ],
    ] as const;
    capabilities.forEach(([dimension, trait, value, description]) =>
      addEntry(
        entries,
        references,
        {
          key: `${dimension}.${archetype.id}.${trait}.${value}`,
          dimension,
          description,
          contexts: [...archetype.supportedContexts].sort(compareCanonical),
          availability,
          requirements: [],
          selection: { kind: "capability" },
        },
        dynamicReference(archetype.id),
      ),
    );
    if (archetype.supportedContexts.includes("search")) {
      addEntry(
        entries,
        references,
        {
          key: `collection-search.search-relationship.${archetype.id}.presentation-only`,
          dimension: "collection-search.search-relationship",
          description:
            "Use registered search-result presentation only when canonical results exist.",
          contexts: ["search"],
          availability: "available",
          requirements: [
            "No first-class canonical search query and results adapter is currently executable.",
          ],
          selection: { kind: "capability" },
        },
        dynamicReference(archetype.id),
      );
    }
  }
  for (const archetype of [...authority.productDetailArchetypes].sort((left, right) =>
    compareCanonical(left.id, right.id),
  )) {
    const plan = plansByProfileId.get(archetype.profile.profileId);
    const profile = plan?.profile;
    const profileAuthority = profile?.commercialProductDetail;
    if (!plan || !profileAuthority) {
      throw new PromptedStorefrontDesignIntentError("stale-authority");
    }
    assertProjectedDynamicArchetypeAuthority(archetype, plan, draft.sharedFrame?.profileId);
    const isFallback = archetype.id === authority.fallbacks.productDetailArchetypeId;
    const reference = {
      ...dynamicReference(archetype.id),
      intentRoles: pdpIntentRoles(profileAuthority.presentation, isFallback),
    };
    const capabilities = [
      [
        "pdp.archetype",
        isFallback ? "generic-fallback" : "archetype",
        archetype.id,
        isFallback
          ? "Use the governed generic PDP fallback for unsupported product structures."
          : `Use the ${designLabel(profileAuthority.presentation)} PDP purchase experience.`,
      ],
      [
        "pdp.media",
        "media",
        archetype.artDirectionPosture.imagePosture,
        `Use ${designLabel(archetype.artDirectionPosture.imagePosture)} product-media presentation.`,
      ],
      [
        "pdp.purchase-hierarchy",
        "purchase-hierarchy",
        profileAuthority.presentation,
        `Use the ${designLabel(profileAuthority.presentation)} purchase-decision hierarchy.`,
      ],
      [
        "pdp.related-merchandising",
        "related-merchandising",
        profileAuthority.relatedProductCardAnatomyId,
        `Use ${designLabel(profileAuthority.relatedProductCardAnatomyId)} related-product merchandising.`,
      ],
    ] as const;
    capabilities.forEach(([dimension, trait, value, description]) =>
      addEntry(
        entries,
        references,
        {
          key: `${dimension}.${archetype.id}.${trait}.${value}`,
          dimension,
          description,
          contexts: ["product"],
          availability: "available",
          requirements: [
            "Canonical options, variants, price, availability, and media remain protected.",
          ],
          selection: { kind: "capability" },
        },
        reference,
      ),
    );
  }
  for (const rule of [...authority.productComplexityRules].sort((left, right) =>
    compareCanonical(left.id, right.id),
  )) {
    const match = rule.match;
    addEntry(
      entries,
      references,
      {
        key: `pdp.option-complexity.${rule.id}`,
        dimension: "pdp.option-complexity",
        description: `Match ${designLabel(match.optionStructure)} option structure with ${designLabel(match.mediaAvailability)} media availability.`,
        contexts: ["product"],
        availability: "available",
        requirements: ["Option complexity is derived only from canonical catalogue structure."],
        selection: { kind: "capability" },
      },
      dynamicReference(rule.id),
    );
  }
  const archetypeById = new Map(
    authority.productDetailArchetypes.map((archetype) => [archetype.id, archetype]),
  );
  for (const mapping of [...authority.productTypeMappings].sort((left, right) =>
    compareCanonical(left.productTypeId, right.productTypeId),
  )) {
    const archetype = archetypeById.get(mapping.archetypeId);
    if (!archetype) throw new PromptedStorefrontDesignIntentError("stale-authority");
    addEntry(
      entries,
      references,
      {
        key: `pdp.product-type.${mapping.productTypeId}`,
        dimension: "pdp.product-type",
        description: "Apply the current registered PDP archetype for this aggregate product type.",
        contexts: ["product"],
        availability: "available",
        requirements: [
          "The exact product-type label and commerce rows stay outside capability authority.",
        ],
        selection: { kind: "capability" },
      },
      dynamicReference(`${mapping.productTypeId}:${mapping.archetypeId}`, true),
    );
  }
}

function addResponsiveAndAssetCapabilities(
  draft: StorefrontSnapshot,
  approvedAssetContext: ApprovedGenerationAssetContext | null,
  profiles: readonly ExecutablePageBlueprintProfile[],
  entries: PromptedStorefrontCapabilityEntry[],
  references: Map<string, PromptedStorefrontCapabilityAuthorityReference>,
): void {
  const manifest = veskifyComponentCapabilityManifest.manifest;
  const registeredTransformationModes = new Set<string>();
  manifest.entries.forEach(({ commercialAnatomy }) =>
    commercialAnatomy?.responsiveTransformations.forEach(({ mode }) =>
      registeredTransformationModes.add(mode),
    ),
  );
  canonicalProductCardAuthority.anatomies.forEach(({ responsiveTransformations }) =>
    responsiveTransformations.forEach(({ mode }) => registeredTransformationModes.add(mode)),
  );
  const executableTransformationModes = exactExecutableResponsiveModes(profiles);
  for (const mode of [...registeredTransformationModes].sort(compareCanonical)) {
    const dimension: PromptedStorefrontCapabilityDimension = [
      "condense",
      "simplify",
      "hide-optional",
    ].includes(mode)
      ? "responsive.density"
      : ["stack", "reorder", "collapse", "disclosure"].includes(mode)
        ? "responsive.mobile-hierarchy"
        : "responsive.posture";
    addEntry(
      entries,
      references,
      {
        key: `${dimension}.${mode}`,
        dimension,
        description: `Use the registered ${designLabel(mode)} responsive transformation.`,
        contexts: ["storefront", "mobile"],
        availability: executableTransformationModes.has(mode)
          ? "available"
          : "registered-fail-closed",
        requirements: executableTransformationModes.has(mode)
          ? []
          : [
              "No exact current executable PageBlueprint variant or product-card anatomy consumes this responsive mode.",
            ],
        selection: { kind: "capability" },
      },
      {
        authorityKind: "component-manifest",
        authorityId: `responsive:${mode}`,
        authorityFingerprint: manifest.fingerprint,
        productTypeKey: false,
      },
    );
  }
  const imageTraits = [
    ...responsiveImageRatioSchema.options.map(
      (value) => ["responsive.image", "ratio", value] as const,
    ),
    ...responsiveImageCropSchema.shape.mode.options.map(
      (value) => ["responsive.crop", "crop", value] as const,
    ),
    ...responsiveImageOverlaySchema.options.map(
      (value) => ["responsive.overlay", "overlay", value] as const,
    ),
  ];
  const reachableDna = reachableRegisteredDesignDna(draft);
  const dynamicArchetypes = [
    ...(draft.dynamicCommercePresentation?.collectionSearchArchetypes ?? []),
    ...(draft.dynamicCommercePresentation?.productDetailArchetypes ?? []),
  ];
  const approvedArtDirections = draft.pages.flatMap(({ sections }) =>
    sections.flatMap(({ approvedAssetPresentations }) =>
      (approvedAssetPresentations ?? []).flatMap(({ artDirection }) =>
        artDirection ? [artDirection] : [],
      ),
    ),
  );
  imageTraits.forEach(([dimension, trait, value]) => {
    const reachableDnaConsumesValue = reachableDna.some(({ media }) => media[trait] === value);
    const dynamicAuthorityConsumesValue = dynamicArchetypes.some(
      ({ artDirectionPosture }) => artDirectionPosture[trait] === value,
    );
    const approvedAssetConsumesValue = approvedArtDirections.some(
      ({ sourceTreatment, responsiveTreatments, derivatives }) =>
        (trait === "crop" ? sourceTreatment.crop.mode : sourceTreatment[trait]) === value ||
        responsiveTreatments.some(
          ({ treatment }) => (trait === "crop" ? treatment.crop.mode : treatment[trait]) === value,
        ) ||
        derivatives.some(
          ({ transform }) => (trait === "crop" ? transform.crop.mode : transform[trait]) === value,
        ),
    );
    const materiallyAvailable = reachableDnaConsumesValue || dynamicAuthorityConsumesValue;
    const exactAuthority = reachableDnaConsumesValue
      ? {
          authorityKind: "design-dna" as const,
          authorityId: `media.${trait}:${value}`,
          authorityFingerprint: brandSystemDesignDnaFingerprint(draft.brandSystem),
        }
      : dynamicAuthorityConsumesValue
        ? {
            authorityKind: "dynamic-commerce" as const,
            authorityId: `art-direction:${trait}:${value}`,
            authorityFingerprint: draft.dynamicCommercePresentation!.authorityFingerprint,
          }
        : approvedAssetConsumesValue
          ? {
              authorityKind: "approved-assets" as const,
              authorityId: `responsive-image:${trait}:${value}`,
              authorityFingerprint:
                approvedAssetContext?.fingerprint ??
                `approved-presentations-${canonicalValueFingerprint(approvedArtDirections)}`,
            }
          : {
              authorityKind: "component-manifest" as const,
              authorityId: `responsive-image:${trait}:${value}`,
              authorityFingerprint: manifest.fingerprint,
            };
    addEntry(
      entries,
      references,
      {
        key: `${dimension}.${trait}.${value}`,
        dimension,
        description: `Use the approved ${designLabel(value)} image ${designLabel(trait)} posture.`,
        contexts: ["storefront", "approved-media"],
        availability: materiallyAvailable ? "available" : "evidence-dependent",
        requirements: materiallyAvailable
          ? ["Canonical product media may be presented but never modified."]
          : approvedAssetConsumesValue
            ? [
                "Approved presentation evidence exists, but exact asset, placement, and responsive-image authority must be bound before selection.",
              ]
            : [
                "Requires exact current Design DNA, dynamic-commerce art direction, or approved asset-presentation authority.",
              ],
        selection: { kind: "capability" },
      },
      {
        ...exactAuthority,
        productTypeKey: false,
      },
    );
  });
  const assetFingerprint =
    approvedAssetContext?.fingerprint ?? exactAbsenceFingerprint("approved-assets");
  const approvedByRole = new Map<string, number>();
  approvedAssetContext?.assets.forEach(({ role }) =>
    approvedByRole.set(role, (approvedByRole.get(role) ?? 0) + 1),
  );
  const registeredRoles = sortedUnique(
    manifest.entries.flatMap(({ supportedAssetRoles }) => supportedAssetRoles),
  );
  const protectedProductAssetRoles = new Set(["productMainImage", "productAlternativeImage"]);
  for (const role of registeredRoles) {
    const protectedProductRole = protectedProductAssetRoles.has(role);
    const evidenceAvailable = !protectedProductRole && (approvedByRole.get(role) ?? 0) > 0;
    addEntry(
      entries,
      references,
      {
        key: `responsive.asset-role.${role}`,
        dimension: "responsive.asset-role",
        description: `Use approved ${designLabel(role)} assets where registered slots permit them.`,
        contexts: ["storefront", "approved-media"],
        availability: protectedProductRole
          ? "registered-fail-closed"
          : evidenceAvailable
            ? "registered-fail-closed"
            : "evidence-dependent",
        requirements: protectedProductRole
          ? [
              "Canonical product media is protected and cannot be selected as an approved source asset.",
            ]
          : evidenceAvailable
            ? [
                "Approved role evidence exists, but an exact PageBlueprint slot and component-variant placement must be selected.",
              ]
            : [`Requires an approved ${designLabel(role)} asset.`],
        selection: { kind: "capability" },
      },
      {
        authorityKind: "approved-assets",
        authorityId: approvedAssetContext ? `approved-assets:${role}` : "approved-assets:none",
        authorityFingerprint: assetFingerprint,
        productTypeKey: false,
      },
    );
  }
  const responsiveTreatmentEvidencePresent =
    approvedAssetContext?.assets.some(({ presentation }) =>
      presentation.responsiveCrops.some(({ breakpoint }) => breakpoint !== undefined),
    ) ?? false;
  addEntry(
    entries,
    references,
    {
      key: "responsive.crop.approved-responsive-focal-treatment",
      dimension: "responsive.crop",
      description:
        "Preserve approved focal and responsive crop authority without exposing coordinates.",
      contexts: ["storefront", "approved-media"],
      availability: "evidence-dependent",
      requirements: responsiveTreatmentEvidencePresent
        ? [
            "Approved focal or responsive-crop evidence exists, but exact asset, placement, and presentation authority must be bound before selection.",
          ]
        : ["Requires approved responsive crop or focal-point evidence."],
      selection: { kind: "capability" },
    },
    {
      authorityKind: "approved-assets",
      authorityId: approvedAssetContext ? "approved-assets:responsive" : "approved-assets:none",
      authorityFingerprint: assetFingerprint,
      productTypeKey: false,
    },
  );
  addEntry(
    entries,
    references,
    {
      key: "responsive.crop.safe-area.unavailable",
      dimension: "responsive.crop",
      description:
        "Safe-area selection is unavailable because current approved assets expose no safe-area authority.",
      contexts: ["storefront", "approved-media"],
      availability: "unavailable",
      requirements: ["A future canonical safe-area field is required before selection."],
      selection: { kind: "capability" },
    },
    {
      authorityKind: "approved-assets",
      authorityId: "approved-assets:safe-area-unavailable",
      authorityFingerprint: assetFingerprint,
      productTypeKey: false,
    },
  );
}

/**
 * Projects current registered design authority into compact provider-safe
 * semantic keys. The private reference map is retained locally and contains no
 * completed plan, materialized page, route instance, proposal, or candidate.
 */
export function createPromptedStorefrontCapabilityAuthority(
  input: ProjectionInput,
): PromptedStorefrontCapabilityAuthority {
  const draft = storefrontSnapshotSchema.parse(structuredClone(input.draft));
  const catalogue = catalogueDisplayModelSchema.parse(structuredClone(input.catalogue));
  const approvedBrief = storefrontDesignBriefContractSchema.parse(
    structuredClone(input.approvedBrief),
  );
  const approvedAssetContext = input.approvedAssetContext
    ? approvedGenerationAssetContextSchema.parse(structuredClone(input.approvedAssetContext))
    : null;
  if (
    draft.catalogueRef !== catalogue.id ||
    !draft.dynamicCommercePresentation ||
    approvedBrief.status !== "approved" ||
    approvedBrief.approval.status !== "approved" ||
    approvedBrief.approvedEvidenceFingerprint === null ||
    approvedBrief.approvedEvidenceFingerprint !== approvedBrief.evidenceFingerprint ||
    approvedBrief.canonicalCommerceProjectionRef !== catalogue.id ||
    (approvedBrief.approvedAssetAssignments.length > 0 && approvedAssetContext === null) ||
    (approvedAssetContext !== null &&
      (approvedAssetContext.briefId !== approvedBrief.id ||
        approvedAssetContext.briefRevision !== approvedBrief.revision ||
        approvedAssetContext.approvedEvidenceFingerprint !==
          approvedBrief.approvedEvidenceFingerprint))
  ) {
    throw new PromptedStorefrontDesignIntentError("stale-authority");
  }
  createPromptedStorefrontCatalogueCharacteristics(catalogue);

  const entries: PromptedStorefrontCapabilityEntry[] = [];
  const references = new Map<string, PromptedStorefrontCapabilityAuthorityReference>();
  addGrammarCapabilities(draft, entries, references);
  addDesignDnaCapabilities(draft, entries, references);
  addSharedFrameCapabilities(entries, references);
  const profiles = currentCommercialProfiles();
  const plansByProfileId = new Map(
    listExecutablePageBlueprintProfiles().flatMap((plan) =>
      plan.profile ? [[plan.profile.id, plan] as const] : [],
    ),
  );
  const {
    reachableVariants,
    exactCandidateComponents,
    exactHomepageComponents,
    exactOverrideTargets,
  } = addPageBlueprintCapabilities(
    draft,
    catalogue,
    approvedBrief,
    approvedAssetContext,
    entries,
    references,
  );
  addComponentCapabilities(
    profiles,
    reachableVariants,
    exactCandidateComponents,
    exactHomepageComponents,
    exactOverrideTargets,
    entries,
    references,
  );
  addProductCardCapabilities(entries, references);
  addDynamicCommerceCapabilities(draft, catalogue, plansByProfileId, entries, references);
  addResponsiveAndAssetCapabilities(draft, approvedAssetContext, profiles, entries, references);

  const capabilities = [...entries].sort((left, right) =>
    compareCanonical(`${left.dimension}:${left.key}`, `${right.dimension}:${right.key}`),
  );
  const material = {
    version: PROMPTED_STOREFRONT_CAPABILITY_PROJECTION_VERSION,
    capabilities,
    search: searchCapabilityState,
  };
  const projection = promptedStorefrontCapabilityProjectionSchema.parse({
    ...material,
    fingerprint: promptedStorefrontCapabilityProjectionFingerprint(material),
  });
  if (projection.capabilities.length !== references.size) {
    throw new PromptedStorefrontDesignIntentError("stale-authority");
  }
  return Object.freeze({
    projection: Object.freeze(projection),
    referencesByPreferenceKey: references,
  });
}

export const promptedStorefrontSharedFrameAuthorityFingerprint = sharedFrameAggregateFingerprint;
