import { storefrontDesignSystemV1 } from "@/application/storefront-design-system";
import { storefrontTemplateDefinitions } from "@/application/storefront-templates";
import { veskifyComponentDefinitionsV2 } from "@/components/registry/v2-registry";

export type P903dCapabilityStatus =
  | "fully reachable"
  | "registered but unreachable"
  | "planner-visible but lost during compilation"
  | "render-only"
  | "incomplete"
  | "missing";

type RenderingReachability = "shared renderer" | "declared renderer without route bridge" | "none";

export type P903dComponentVariantRecord = Readonly<{
  canonicalId: string;
  version: string;
  registrationSource: string;
  requiredBindings: readonly string[];
  supportedPageTypes: readonly string[];
  responsiveContract: readonly string[];
  accessibilityContract: readonly string[];
  plannerExposure: Readonly<{
    recipeIds: readonly string[];
    blueprintIds: readonly string[];
    directionIds: readonly string[];
    advertisedToRealProvider: true;
  }>;
  deterministicSelectionEvidence: readonly string[];
  realProviderSchemaExposure: "registry-advertised" | "registry-and-direction-option";
  proposalCompilerPreservation:
    | "preserved directly"
    | "deferred to server runtime authority"
    | "dropped by dynamic-page replacement"
    | "recipe variant is not compiled"
    | "not selectable";
  canonicalSnapshotBoundary: string;
  editorRendering: RenderingReachability;
  previewRendering: RenderingReachability;
  publishedRendering: RenderingReachability;
  status: P903dCapabilityStatus;
}>;

export type P903dSystemCapabilityRecord = Readonly<{
  canonicalId: string;
  version: string;
  registrationSource: string;
  requiredBindings: readonly string[];
  supportedPageTypes: readonly string[];
  responsiveContract: string;
  accessibilityContract: string;
  plannerExposure: string;
  deterministicSelectionEvidence: readonly string[];
  realProviderSchemaExposure: string;
  proposalCompilerPreservation: string;
  editorRendering: string;
  previewRendering: string;
  publishedRendering: string;
  status: P903dCapabilityStatus;
}>;

const fullyReachable = new Set([
  "header:centered",
  "header:compact",
  "header:transparent",
  "hero:editorial",
  "hero:fullBleed",
  "hero:asymmetric",
  "featuredCategories:grid",
  "featuredCategories:editorialCards",
  "featuredCategories:imageLed",
  "productGrid:standard",
  "productGrid:editorial",
  "productGrid:compact",
  "campaignBanner:imageOverlay",
  "campaignBanner:split",
  "campaignBanner:minimal",
  "brandStory:editorial",
  "brandStory:minimal",
  "brandStory:imageLed",
  "benefitIcons:minimal",
  "benefitIcons:cards",
  "newsletter:inline",
  "newsletter:card",
  "footer:columns",
  "footer:editorial",
  "footer:compact",
  "imageText:imageLeft",
  "imageText:imageRight",
  "imageText:stacked",
  "relatedProducts:grid",
  "dynamicCollectionCommerce:editorial",
  "dynamicCollectionCommerce:compact",
  "dynamicProductDetail:balanced",
  "dynamicProductDetail:compact",
  "dynamicProductDetail:editorialSplit",
]);

const lostDuringCompilation = new Set([
  "announcementBar:singleLine",
  "announcementBar:minimal",
  "benefitIcons:threeColumn",
  "collectionHeader:editorial",
  "filterBar:horizontal",
  "productGallery:thumbnails",
  "productInfo:premium",
  "productOptions:buttons",
]);

const registeredButUnreachable = new Set([
  "announcementBar:rotating",
  "announcementBar:bold",
  "header:split",
  "header:editorial",
  "hero:restrained",
  "featuredCategories:carousel",
  "brandStory:timeline",
  "brandStory:founder",
  "benefitIcons:fourColumn",
  "newsletter:fullWidth",
  "footer:expanded",
  "footer:dark",
  "dynamicCollectionCommerce:standard",
  "dynamicCollectionCommerce:gallery",
  "dynamicProductDetail:editorial",
  "dynamicProductDetail:galleryDominant",
]);

const renderOnlyTypes = new Set([
  "homepageHero",
  "homepageFeaturedCollections",
  "homepageFeaturedProducts",
  "homepageCollectionNavigation",
  "homepagePromotion",
  "homepageTrust",
]);

const dynamicPageReplacementTypes = new Set([
  "collectionHeader",
  "filterBar",
  "productGallery",
  "productInfo",
  "productOptions",
]);

function versionString(version: { major: number; minor: number; patch: number }): string {
  return `${version.major}.${version.minor}.${version.patch}`;
}

function sourceFor(type: string): string {
  if (type === "dynamicCollectionCommerce") {
    return "src/components/registry/dynamic-collection-commerce.ts";
  }
  if (type === "dynamicProductDetail") {
    return "src/components/registry/dynamic-product-detail.ts";
  }
  if (renderOnlyTypes.has(type)) return "src/components/registry/homepage-commerce.ts";
  return "src/components/registry/registry.ts via v2-compatibility.ts";
}

function recipeIds(type: string, variant: string): string[] {
  return [
    ...storefrontDesignSystemV1.homepageRecipes,
    ...storefrontDesignSystemV1.collectionRecipes,
    ...storefrontDesignSystemV1.productRecipes,
  ]
    .filter((recipe) =>
      recipe.sections.some((section) => section.component === type && section.variant === variant),
    )
    .map((recipe) => recipe.id)
    .sort();
}

function blueprintIds(type: string, variant: string): string[] {
  return storefrontTemplateDefinitions
    .filter((template) =>
      template.pagePlans.some((page) =>
        page.slots.some(
          (slot) => slot.sectionType === type && slot.allowedVariants.includes(variant),
        ),
      ),
    )
    .map((template) => template.id)
    .sort();
}

function directionIds(type: string, variant: string): string[] {
  return storefrontDesignSystemV1.directions
    .filter((direction) => {
      if (direction.sectionVariants[type] === variant) return true;
      if (
        type === "dynamicCollectionCommerce" &&
        direction.collectionPresentation.variant === variant
      ) {
        return true;
      }
      return type === "dynamicProductDetail" && direction.productPresentation.variant === variant;
    })
    .map((direction) => direction.id)
    .sort();
}

function classification(type: string, variant: string): P903dCapabilityStatus {
  const key = `${type}:${variant}`;
  if (renderOnlyTypes.has(type)) return "render-only";
  if (fullyReachable.has(key)) return "fully reachable";
  if (lostDuringCompilation.has(key)) return "planner-visible but lost during compilation";
  if (registeredButUnreachable.has(key)) return "registered but unreachable";
  throw new Error(`P9-03D audit classification is missing ${key}.`);
}

function compilerPreservation(
  type: string,
  variant: string,
  status: P903dCapabilityStatus,
): P903dComponentVariantRecord["proposalCompilerPreservation"] {
  if (status === "render-only" || status === "registered but unreachable") return "not selectable";
  if (dynamicPageReplacementTypes.has(type)) return "dropped by dynamic-page replacement";
  if (type === "announcementBar" || `${type}:${variant}` === "benefitIcons:threeColumn") {
    return "recipe variant is not compiled";
  }
  if (type === "dynamicCollectionCommerce" || type === "dynamicProductDetail") {
    return "preserved directly";
  }
  return "deferred to server runtime authority";
}

function canonicalBoundary(
  type: string,
  status: P903dCapabilityStatus,
  preservation: P903dComponentVariantRecord["proposalCompilerPreservation"],
): string {
  if (status === "render-only") {
    return "No canonical SectionInstance, planner recipe, or Puck bridge reaches this V2 renderer.";
  }
  if (status === "registered but unreachable") {
    return "The real-provider request advertises the variant, but exact-plan validation exposes no direction that can select it.";
  }
  if (preservation === "dropped by dynamic-page replacement") {
    return "createWholeStorefrontGenerationPlan replaces the legacy collection/PDP section before proposal compilation.";
  }
  if (preservation === "recipe variant is not compiled") {
    return "The recipe carries the variant, but designSystemSelection.sectionVariants does not; the planner retains the source variant.";
  }
  if (preservation === "deferred to server runtime authority") {
    return "The proposal compiler retains the source variant; styledProjectedPage applies the registered direction before the canonical AI proposal snapshot.";
  }
  return "The planner creates the V2 instance and the proposal compiler preserves its variant and presentation props.";
}

function rendering(type: string): RenderingReachability {
  return renderOnlyTypes.has(type) ? "declared renderer without route bridge" : "shared renderer";
}

export function createP903dComponentVariantInventory(): P903dComponentVariantRecord[] {
  return veskifyComponentDefinitionsV2
    .flatMap((definition) =>
      definition.variants.map((variant) => {
        const status = classification(definition.type, variant.id);
        const directions = directionIds(definition.type, variant.id);
        const preservation = compilerPreservation(definition.type, variant.id, status);
        const renderer = rendering(definition.type);
        return {
          canonicalId: `component:${definition.type}@${versionString(definition.version)}#${variant.id}`,
          version: versionString(definition.version),
          registrationSource: sourceFor(definition.type),
          requiredBindings: definition.commerceBindingSlots
            .filter((slot) => slot.required)
            .map((slot) => slot.id)
            .sort(),
          supportedPageTypes: [...definition.supportedPageTypes].sort(),
          responsiveContract: definition.responsiveRules.map(
            (rule) =>
              `${rule.breakpoints.join("/")}; overflow=${String(rule.allowHorizontalOverflow)}`,
          ),
          accessibilityContract: Object.entries(definition.accessibilityRequirements)
            .filter((entry): entry is [string, string] => typeof entry[1] === "string")
            .map(([key, value]) => `${key}: ${value}`)
            .sort(),
          plannerExposure: {
            recipeIds: recipeIds(definition.type, variant.id),
            blueprintIds: blueprintIds(definition.type, variant.id),
            directionIds: directions,
            advertisedToRealProvider: true as const,
          },
          deterministicSelectionEvidence: directions.map(
            (directionId) => `direction:${directionId}`,
          ),
          realProviderSchemaExposure:
            directions.length > 0
              ? ("registry-and-direction-option" as const)
              : ("registry-advertised" as const),
          proposalCompilerPreservation: preservation,
          canonicalSnapshotBoundary: canonicalBoundary(definition.type, status, preservation),
          editorRendering: renderer,
          previewRendering: renderer,
          publishedRendering: renderer,
          status,
        } satisfies P903dComponentVariantRecord;
      }),
    )
    .sort((left, right) => left.canonicalId.localeCompare(right.canonicalId));
}

function systemCapability(
  input: Omit<
    P903dSystemCapabilityRecord,
    | "version"
    | "registrationSource"
    | "requiredBindings"
    | "supportedPageTypes"
    | "responsiveContract"
    | "accessibilityContract"
    | "editorRendering"
    | "previewRendering"
    | "publishedRendering"
  > &
    Partial<P903dSystemCapabilityRecord>,
): P903dSystemCapabilityRecord {
  return {
    version: storefrontDesignSystemV1.version,
    registrationSource: "src/application/storefront-design-system/registry.ts",
    requiredBindings: [],
    supportedPageTypes: ["home", "collection", "product"],
    responsiveContract: "mobile/tablet/desktop/wide; horizontal overflow forbidden",
    accessibilityContract: "inherits validated BrandSystem and registered component contracts",
    editorRendering: "canonical BrandSystem or section renderer",
    previewRendering: "same canonical BrandSystem or section renderer",
    publishedRendering: "same canonical BrandSystem or section renderer",
    ...input,
  };
}

const selectedTypography = new Set(
  storefrontDesignSystemV1.directions.map((direction) => direction.typographyDirectionId),
);
const selectedImages = new Set(
  storefrontDesignSystemV1.directions.map((direction) => direction.imageTreatmentId),
);
const selectedCards = new Set(
  storefrontDesignSystemV1.directions.map((direction) => direction.productCardFamilyId),
);
const selectedRecipes = new Set(
  storefrontDesignSystemV1.directions.flatMap((direction) => [
    direction.homepageRecipeId,
    direction.collectionRecipeId,
    direction.productRecipeId,
  ]),
);

export const p903dSystemCapabilityInventory: readonly P903dSystemCapabilityRecord[] = [
  ...storefrontDesignSystemV1.typographyDirections.map((typography) =>
    systemCapability({
      canonicalId: `typography:${typography.id}`,
      plannerExposure: selectedTypography.has(typography.id)
        ? "selected by a registered direction"
        : "registered but absent from direction options",
      deterministicSelectionEvidence: storefrontDesignSystemV1.directions
        .filter((direction) => direction.typographyDirectionId === typography.id)
        .map((direction) => `direction:${direction.id}`),
      realProviderSchemaExposure: "design-system registry; indirect through direction options",
      proposalCompilerPreservation: selectedTypography.has(typography.id)
        ? "materialized by registeredBrandSystemForDirection"
        : "not selectable",
      status: selectedTypography.has(typography.id)
        ? "fully reachable"
        : "registered but unreachable",
    }),
  ),
  ...storefrontDesignSystemV1.imageTreatments.map((treatment) =>
    systemCapability({
      canonicalId: `image-treatment:${treatment.id}`,
      plannerExposure: selectedImages.has(treatment.id)
        ? "selected by a registered direction"
        : "registered but absent from direction options",
      deterministicSelectionEvidence: storefrontDesignSystemV1.directions
        .filter((direction) => direction.imageTreatmentId === treatment.id)
        .map((direction) => `direction:${direction.id}`),
      realProviderSchemaExposure: "design-system registry; indirect through direction options",
      proposalCompilerPreservation: selectedImages.has(treatment.id)
        ? "materialized into BrandSystem imagery and visualSystem"
        : "not selectable",
      status: selectedImages.has(treatment.id) ? "fully reachable" : "registered but unreachable",
    }),
  ),
  ...storefrontDesignSystemV1.productCardFamilies.map((family) =>
    systemCapability({
      canonicalId: `product-card-family:${family.id}`,
      plannerExposure: selectedCards.has(family.id)
        ? "selected by a registered direction"
        : "registered but absent from direction options",
      deterministicSelectionEvidence: storefrontDesignSystemV1.directions
        .filter((direction) => direction.productCardFamilyId === family.id)
        .map((direction) => `direction:${direction.id}`),
      realProviderSchemaExposure: "direction options expose the family ID",
      proposalCompilerPreservation: selectedCards.has(family.id)
        ? "plan records ID; dynamic collection props carry the concrete card variant"
        : "not selectable",
      status: selectedCards.has(family.id) ? "fully reachable" : "registered but unreachable",
    }),
  ),
  ...[
    ...storefrontDesignSystemV1.homepageRecipes,
    ...storefrontDesignSystemV1.collectionRecipes,
    ...storefrontDesignSystemV1.productRecipes,
  ].map((recipe) =>
    systemCapability({
      canonicalId: `page-recipe:${recipe.id}`,
      supportedPageTypes: [recipe.pageType],
      plannerExposure: selectedRecipes.has(recipe.id)
        ? "selected by a registered direction"
        : "registered but absent from direction options",
      deterministicSelectionEvidence: storefrontDesignSystemV1.directions
        .filter((direction) =>
          [
            direction.homepageRecipeId,
            direction.collectionRecipeId,
            direction.productRecipeId,
          ].includes(recipe.id),
        )
        .map((direction) => `direction:${direction.id}`),
      realProviderSchemaExposure: "full recipe plus direction option IDs",
      proposalCompilerPreservation: selectedRecipes.has(recipe.id)
        ? "recipe ID survives; order is applied later, but not every recipe variant is compiled"
        : "not selectable",
      status: selectedRecipes.has(recipe.id) ? "incomplete" : "registered but unreachable",
    }),
  ),
  ...(["compact", "standard", "spacious"] as const).map((density) =>
    systemCapability({
      canonicalId: `spacing-density:${density}`,
      plannerExposure: "selected by a registered direction",
      deterministicSelectionEvidence: storefrontDesignSystemV1.directions
        .filter((direction) => direction.spacingDensity === density)
        .map((direction) => `direction:${direction.id}`),
      realProviderSchemaExposure: "direction option",
      proposalCompilerPreservation: "materialized into BrandSystem spacing and compatible props",
      status: "fully reachable",
    }),
  ),
  ...(["square", "soft", "rounded"] as const).map((shape) =>
    systemCapability({
      canonicalId: `shape:${shape}`,
      plannerExposure: "selected by a registered direction",
      deterministicSelectionEvidence: storefrontDesignSystemV1.directions
        .filter((direction) => direction.cornerTreatment === shape)
        .map((direction) => `direction:${direction.id}`),
      realProviderSchemaExposure: "direction option",
      proposalCompilerPreservation: "materialized into BrandSystem radius and compatible props",
      status: "fully reachable",
    }),
  ),
  ...(["flat", "subtle", "layered"] as const).map((surface) =>
    systemCapability({
      canonicalId: `surface-depth:${surface}`,
      plannerExposure: "selected by a registered direction",
      deterministicSelectionEvidence: storefrontDesignSystemV1.directions
        .filter((direction) => direction.surfaceDepth === surface)
        .map((direction) => `direction:${direction.id}`),
      realProviderSchemaExposure: "direction option",
      proposalCompilerPreservation: "materialized into BrandSystem visualSystem.surfaceDepth",
      status: "fully reachable",
    }),
  ),
  systemCapability({
    canonicalId: "border-treatment:direction-bundle",
    plannerExposure: "semantic role only; no registered direction value",
    deterministicSelectionEvidence: [],
    realProviderSchemaExposure: "not exposed in direction options",
    proposalCompilerPreservation: "baseline border treatment is retained",
    status: "missing",
  }),
  systemCapability({
    canonicalId: "localization:en-fi",
    plannerExposure: "languagePlan carries both locales with explicit missing-translation policy",
    deterministicSelectionEvidence: ["fixture:Lumo EN/FI", "fixture:Aurum EN/FI"],
    realProviderSchemaExposure: "approved brief language plan",
    proposalCompilerPreservation: "localized content and selected locale plan are preserved",
    status: "fully reachable",
  }),
  systemCapability({
    canonicalId: "responsive:375-768-1024-1440",
    plannerExposure: "all recipes and component definitions forbid horizontal overflow",
    deterministicSelectionEvidence: ["P9 responsive acceptance suite"],
    realProviderSchemaExposure: "responsive-safe registered IDs only",
    proposalCompilerPreservation:
      "contracts survive; evidence is not exhaustive for all 73 variants",
    status: "incomplete",
  }),
  systemCapability({
    canonicalId: "accessibility:registered-contracts",
    plannerExposure: "component definitions expose keyboard, semantics, labels and focus contracts",
    deterministicSelectionEvidence: ["component and route accessibility suites"],
    realProviderSchemaExposure:
      "provider receives bounded component IDs, not raw accessibility props",
    proposalCompilerPreservation:
      "registered implementation is preserved; per-variant evidence is incomplete",
    status: "incomplete",
  }),
].sort((left, right) => left.canonicalId.localeCompare(right.canonicalId));

export const p903dDesignCapabilityInventory = Object.freeze({
  schemaVersion: 1,
  generatedFrom: Object.freeze({
    componentRegistry: "veskifyComponentDefinitionsV2",
    designSystem: storefrontDesignSystemV1.fingerprint,
    blueprints: storefrontTemplateDefinitions.map(
      (template) => `${template.id}@${template.version}`,
    ),
  }),
  componentVariants: Object.freeze(createP903dComponentVariantInventory()),
  systemCapabilities: Object.freeze([...p903dSystemCapabilityInventory]),
});
