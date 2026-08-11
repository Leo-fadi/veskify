import {
  getCommercialCollectionSearchProfile,
  getCommercialPdpProfile,
  listCommercialCollectionSearchProfiles,
  listCommercialPdpProfiles,
  materializeExecutablePageBlueprint,
} from "@/application/storefront-templates";
import {
  dynamicCollectionCommerceBridgeContentSchema,
  dynamicCollectionCommerceContentSchema,
  dynamicCollectionCommerceDefaultContent,
  dynamicCollectionCommerceDefaultProps,
  dynamicCollectionCommerceDefaultStyleOverrides,
  dynamicCollectionCommercePropsSchema,
  dynamicCollectionCommerceStyleOverridesSchema,
  dynamicProductDetailBridgeContentSchema,
  dynamicProductDetailContentSchema,
  dynamicProductDetailDefaultContent,
  dynamicProductDetailDefaultStyleOverrides,
  dynamicProductDetailPropsSchema,
  dynamicProductDetailStyleOverridesSchema,
  veskifyComponentDefinitionsV2,
} from "@/components/registry";
import {
  catalogueDisplayModelSchema,
  type CatalogueDisplayModel,
  type CollectionDisplayModel,
  type ProductDisplayModel,
} from "@/domain/catalogue";
import { canonicalProductTypePresentationId } from "@/domain/product-card";
import {
  DYNAMIC_COMMERCE_PRESENTATION_CONTRACT_VERSION,
  PAGE_FAMILY_AUTHORITY_VERSION,
  SITE_MAP_SHARED_FRAME,
  canonicalValueFingerprint,
  canonicalValueString,
  createDynamicCommercePresentationAuthority,
  dynamicCommercePresentationAuthoritySchema,
  dynamicCommerceRouteInventoryEntrySchema,
  storefrontSnapshotSchema,
  type DynamicCommerceCollectionSearchArchetype,
  type DynamicCommerceCollectionContextRule,
  type DynamicCommerceComponentPresentation,
  type DynamicCommercePresentationAuthority,
  type DynamicCommerceProductComplexityRule,
  type DynamicCommerceRouteInventoryEntry,
  type DynamicCommerceProductDetailArchetype,
  type PageFamilyAuthority,
  type PageModel,
  type SectionInstance,
  type StorefrontSnapshot,
} from "@/domain/storefront";

const COLLECTION_PROFILE_TO_ARCHETYPE = {
  "collection-editorial-discovery": "archetype_collection_editorial",
  "collection-catalogue-comparison": "archetype_collection_comparison",
  "collection-campaign-led-discovery": "archetype_collection_campaign",
  "collection-dense-search": "archetype_collection_search_dense",
} as const;

const PDP_PROFILE_TO_ARCHETYPE = {
  "pdp-standard-commerce": "archetype_pdp_standard",
  "pdp-high-consideration": "archetype_pdp_high_consideration",
  "pdp-gallery-led": "archetype_pdp_gallery",
  "pdp-variant-led": "archetype_pdp_configurable",
} as const;

const GENERIC_PDP_ARCHETYPE_ID = "archetype_pdp_generic_fallback" as const;

export const dynamicCommerceRouteAuthorityErrorCodes = [
  "missing-authority",
  "stale-authority",
  "unknown-route",
  "unknown-commerce-identity",
  "unknown-archetype",
  "stale-profile",
  "incompatible-shared-frame",
  "invalid-presentation",
] as const;

export type DynamicCommerceRouteAuthorityErrorCode =
  (typeof dynamicCommerceRouteAuthorityErrorCodes)[number];

export class DynamicCommerceRouteAuthorityError extends Error {
  constructor(
    readonly code: DynamicCommerceRouteAuthorityErrorCode,
    message: string,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = "DynamicCommerceRouteAuthorityError";
  }
}

export type DynamicCommerceMigrationDecision = Readonly<{
  code:
    | "missing-route-identity"
    | "missing-catalogue-identity"
    | "missing-profile-identity"
    | "unknown-profile"
    | "unknown-commerce-identity"
    | "invalid-route-namespace"
    | "route-family-component-mismatch"
    | "invalid-legacy-schema"
    | "unsupported-legacy-layout"
    | "conflicting-legacy-presentation"
    | "conflicting-product-type-mapping"
    | "dynamic-parent-reference";
  routeIds: readonly string[];
  message: string;
}>;

export type DynamicCommerceMigrationResult =
  | Readonly<{
      status: "current";
      snapshot: StorefrontSnapshot;
      authority: DynamicCommercePresentationAuthority;
    }>
  | Readonly<{
      status: "migrated";
      snapshot: StorefrontSnapshot;
      authority: DynamicCommercePresentationAuthority;
      migratedRouteCount: number;
    }>
  | Readonly<{
      status: "requires-decision";
      snapshot: StorefrontSnapshot;
      decisions: readonly DynamicCommerceMigrationDecision[];
    }>;

export class DynamicCommerceMigrationError extends Error {
  constructor(readonly decisions: readonly DynamicCommerceMigrationDecision[]) {
    super("Legacy dynamic-commerce pages require an explicit migration decision.");
    this.name = "DynamicCommerceMigrationError";
  }
}

function fail(
  code: DynamicCommerceRouteAuthorityErrorCode,
  message: string,
  cause?: unknown,
): never {
  throw new DynamicCommerceRouteAuthorityError(code, message, cause ? { cause } : undefined);
}

function collectionArchetypeId(profileId: string): string {
  return (
    COLLECTION_PROFILE_TO_ARCHETYPE[profileId as keyof typeof COLLECTION_PROFILE_TO_ARCHETYPE] ?? ""
  );
}

function productArchetypeId(profileId: string): string {
  return PDP_PROFILE_TO_ARCHETYPE[profileId as keyof typeof PDP_PROFILE_TO_ARCHETYPE] ?? "";
}

function collectionPresentation(
  profileId: string,
  legacySection?: SectionInstance,
): DynamicCommerceComponentPresentation {
  const plan = getCommercialCollectionSearchProfile(profileId);
  const authority = plan?.profile?.commercialCollectionSearch;
  if (!plan?.profile || !authority) fail("stale-profile", "Collection profile is unavailable.");
  const materialized = materializeExecutablePageBlueprint({
    pagePlan: plan,
    componentDefinitions: veskifyComponentDefinitionsV2,
    availableBindingCategories: ["collection", "productList"],
  });
  const slot = materialized.slots[0];
  if (!slot || slot.component !== "dynamicCollectionCommerce") {
    fail("stale-profile", "Collection profile has no canonical dynamic component slot.");
  }
  let content = structuredClone(dynamicCollectionCommerceDefaultContent);
  if (legacySection) {
    const {
      collectionId: _collectionId,
      productIds: _productIds,
      canonicalRevision: _canonicalRevision,
      ...presentationContent
    } = legacySection.content;
    void _collectionId;
    void _productIds;
    void _canonicalRevision;
    content = dynamicCollectionCommerceContentSchema.parse(presentationContent);
  }
  return {
    slotId: slot.slotId,
    component: "dynamicCollectionCommerce",
    variant: legacySection?.variant ?? slot.variant,
    anatomyId: authority.productCardAnatomyId,
    visible: legacySection?.visible ?? true,
    content,
    props: structuredClone(
      dynamicCollectionCommercePropsSchema.parse(
        legacySection?.props ?? {
          ...dynamicCollectionCommerceDefaultProps,
          gridDensity: authority.gridDensity,
          cardVariant: authority.productCardAnatomyId,
          filterLayout: authority.filterLayout,
          showChildCollections: authority.childCollectionTreatment !== "omit",
        },
      ),
    ),
    styleOverrides: structuredClone(
      legacySection?.styleOverrides ?? dynamicCollectionCommerceDefaultStyleOverrides,
    ),
    boundedParameters: structuredClone(slot.boundedParameters),
  };
}

function productPresentation(
  profileId: string,
  legacySection?: SectionInstance,
): DynamicCommerceComponentPresentation {
  const plan = getCommercialPdpProfile(profileId);
  const authority = plan?.profile?.commercialProductDetail;
  if (!plan?.profile || !authority) fail("stale-profile", "PDP profile is unavailable.");
  const materialized = materializeExecutablePageBlueprint({
    pagePlan: plan,
    componentDefinitions: veskifyComponentDefinitionsV2,
    availableBindingCategories: ["product"],
  });
  const slot = materialized.slots[0];
  if (!slot || slot.component !== "dynamicProductDetail") {
    fail("stale-profile", "PDP profile has no canonical dynamic component slot.");
  }
  let content = structuredClone(dynamicProductDetailDefaultContent);
  if (legacySection) {
    const {
      productId: _productId,
      relatedProductIds: _relatedProductIds,
      canonicalRevision: _canonicalRevision,
      ...presentationContent
    } = legacySection.content;
    void _productId;
    void _relatedProductIds;
    void _canonicalRevision;
    content = dynamicProductDetailContentSchema.parse(presentationContent);
  }
  return {
    slotId: slot.slotId,
    component: "dynamicProductDetail",
    variant: legacySection?.variant ?? slot.variant,
    anatomyId: authority.relatedProductCardAnatomyId,
    visible: legacySection?.visible ?? true,
    content,
    props: structuredClone(
      dynamicProductDetailPropsSchema.parse(
        legacySection?.props ?? authority.dynamicProductDetailProps,
      ),
    ),
    styleOverrides: structuredClone(
      legacySection?.styleOverrides ?? dynamicProductDetailDefaultStyleOverrides,
    ),
    boundedParameters: structuredClone(slot.boundedParameters),
  };
}

function createCollectionArchetype(
  profileId: string,
  legacySection?: SectionInstance,
  supportsSearch = profileId === "collection-dense-search",
): DynamicCommerceCollectionSearchArchetype {
  const plan = getCommercialCollectionSearchProfile(profileId);
  const profile = plan?.profile;
  const authority = profile?.commercialCollectionSearch;
  if (!plan || !profile || !authority) {
    return fail("stale-profile", `Collection profile ${profileId} is unavailable.`);
  }
  const materialized = materializeExecutablePageBlueprint({
    pagePlan: plan,
    componentDefinitions: veskifyComponentDefinitionsV2,
    availableBindingCategories: ["collection", "productList"],
  });
  const id = collectionArchetypeId(profileId);
  if (!id) return fail("stale-profile", `Collection profile ${profileId} has no archetype ID.`);
  return {
    id,
    archetypeVersion: DYNAMIC_COMMERCE_PRESENTATION_CONTRACT_VERSION,
    family: "collection-search" as const,
    supportedContexts: supportsSearch
      ? (["collection", "search"] as const)
      : (["collection"] as const),
    profile: {
      profileId,
      profileVersion: profile.version,
      fingerprint: materialized.fingerprint,
    },
    compatibleSharedFrameProfileIds: [...authority.compatibleSharedFrameProfileIds],
    defaultSharedFrameProfileId: authority.defaultSharedFrameProfileId,
    designDnaNarrowing: structuredClone(authority.designDnaNarrowing),
    componentPresentations: [collectionPresentation(profileId, legacySection)],
    responsivePosture: authority.responsiveArchitecture,
    artDirectionPosture: {
      imagePosture: authority.designDnaNarrowing.imagePosture[0],
      ratio: "natural",
      crop: authority.designDnaNarrowing.imagePosture[0] === "contained" ? "contain" : "editorial",
      overlay: "none",
    },
    fallbackBehavior: "use-family-fallback",
    commerceBindingPolicy: "runtime-collection-membership",
  };
}

function createProductArchetype(
  profileId: string,
  legacySection?: SectionInstance,
  generic = false,
): DynamicCommerceProductDetailArchetype {
  const plan = getCommercialPdpProfile(profileId);
  const profile = plan?.profile;
  const authority = profile?.commercialProductDetail;
  if (!plan || !profile || !authority) {
    return fail("stale-profile", `PDP profile ${profileId} is unavailable.`);
  }
  const materialized = materializeExecutablePageBlueprint({
    pagePlan: plan,
    componentDefinitions: veskifyComponentDefinitionsV2,
    availableBindingCategories: ["product"],
  });
  const id = generic ? GENERIC_PDP_ARCHETYPE_ID : productArchetypeId(profileId);
  if (!id) return fail("stale-profile", `PDP profile ${profileId} has no archetype ID.`);
  return {
    id,
    archetypeVersion: DYNAMIC_COMMERCE_PRESENTATION_CONTRACT_VERSION,
    family: "product-detail" as const,
    profile: {
      profileId,
      profileVersion: profile.version,
      fingerprint: materialized.fingerprint,
    },
    compatibleSharedFrameProfileIds: [...authority.compatibleSharedFrameProfileIds],
    defaultSharedFrameProfileId: authority.defaultSharedFrameProfileId,
    designDnaNarrowing: structuredClone(authority.designDnaNarrowing),
    componentPresentations: [productPresentation(profileId, legacySection)],
    responsivePosture: authority.responsiveArchitecture,
    artDirectionPosture: {
      imagePosture: authority.designDnaNarrowing.imagePosture[0],
      ratio: authority.designDnaNarrowing.imagePosture[0] === "contained" ? "portrait" : "natural",
      crop: authority.designDnaNarrowing.imagePosture[0] === "contained" ? "contain" : "editorial",
      overlay: "none",
    },
    fallbackBehavior: "use-family-fallback",
    optionArchitecture: "generic-canonical-options",
    commerceBindingPolicy: "runtime-protected-product",
  };
}

function sectionFingerprint(profileId: string, section: SectionInstance): string {
  if (section.component === "dynamicCollectionCommerce") {
    return canonicalValueString(collectionPresentation(profileId, section));
  }
  if (section.component === "dynamicProductDetail") {
    return canonicalValueString(productPresentation(profileId, section));
  }
  return canonicalValueString(section);
}

function legacyDynamicSection(page: PageModel): SectionInstance | undefined {
  return page.sections.find(({ component }) =>
    ["dynamicCollectionCommerce", "dynamicProductDetail"].includes(component),
  );
}

function isLegacyDynamicPage(page: PageModel): boolean {
  return (
    page.pageFamily?.familyId === "collection" ||
    page.pageFamily?.familyId === "search-results" ||
    page.pageFamily?.familyId === "product-detail" ||
    legacyDynamicSection(page) !== undefined
  );
}

function inBoundedRange(value: number, range?: { minimum: number; maximum: number }): boolean {
  return range === undefined || (value >= range.minimum && value <= range.maximum);
}

function requireUniqueHighestPriorityRule<T extends { id: string; priority: number }>(
  family: "collection" | "product",
  rules: readonly T[],
): T {
  if (rules.length === 0) {
    return fail(
      "invalid-presentation",
      `No registered ${family} matching rule supports the current canonical context.`,
    );
  }
  const priority = Math.max(...rules.map((rule) => rule.priority));
  const selected = rules.filter((rule) => rule.priority === priority);
  if (selected.length !== 1) {
    return fail(
      "invalid-presentation",
      `The current canonical ${family} context matches ambiguous rules at priority ${priority}.`,
    );
  }
  return selected[0];
}

export type DynamicCommerceProductMatchContext = Readonly<{
  optionStructure: "simple" | "configurable";
  optionGroupCount: number;
  mediaAvailability: "none" | "single" | "multiple";
  highConsideration: boolean;
}>;

function productMatchContext(
  product: ProductDisplayModel,
  highConsideration?: boolean,
): DynamicCommerceProductMatchContext {
  const canonicalOptionGroupCount = product.orderOptions?.length ?? 0;
  const optionStructure =
    canonicalOptionGroupCount > 0 || product.variants.length > 1 ? "configurable" : "simple";
  return {
    optionStructure,
    // A multi-variant product is structurally configurable even when the
    // projection has no separate order-option groups.
    optionGroupCount: Math.max(
      canonicalOptionGroupCount,
      optionStructure === "configurable" ? 1 : 0,
    ),
    mediaAvailability:
      product.images.length === 0 ? "none" : product.images.length === 1 ? "single" : "multiple",
    highConsideration: highConsideration ?? canonicalOptionGroupCount >= 4,
  };
}

function selectProductComplexityRule(input: {
  product: ProductDisplayModel;
  rules: readonly DynamicCommerceProductComplexityRule[];
  highConsideration?: boolean;
}): DynamicCommerceProductComplexityRule {
  const context = productMatchContext(input.product, input.highConsideration);
  const matches = input.rules.filter((rule) => {
    const match = rule.match;
    return (
      (match.optionStructure === "any" || match.optionStructure === context.optionStructure) &&
      inBoundedRange(context.optionGroupCount, match.optionGroupCount) &&
      (match.mediaAvailability === "any" ||
        match.mediaAvailability === context.mediaAvailability) &&
      (match.highConsideration === "any" ||
        (match.highConsideration === "required" && context.highConsideration) ||
        (match.highConsideration === "excluded" && !context.highConsideration))
    );
  });
  return requireUniqueHighestPriorityRule("product", matches);
}

export function resolveProductComplexityArchetype(input: {
  product: ProductDisplayModel;
  rules: readonly DynamicCommerceProductComplexityRule[];
  highConsideration?: boolean;
}): string {
  return selectProductComplexityRule(input).archetypeId;
}

export type DynamicCommerceCollectionMatchContext = Readonly<{
  depth: number;
  productCount: number;
  childCollections: boolean;
  campaignEvidence: boolean;
  merchandisingDensity: "compact" | "standard" | "spacious";
}>;

function selectCollectionContextRule(input: {
  context: DynamicCommerceCollectionMatchContext;
  rules: readonly DynamicCommerceCollectionContextRule[];
}): DynamicCommerceCollectionContextRule {
  const matches = input.rules.filter((rule) => {
    const match = rule.match;
    return (
      inBoundedRange(input.context.depth, match.depth) &&
      inBoundedRange(input.context.productCount, match.productCount) &&
      (match.childCollections === "any" ||
        (match.childCollections === "present" && input.context.childCollections) ||
        (match.childCollections === "absent" && !input.context.childCollections)) &&
      (match.campaignEvidence === "any" ||
        (match.campaignEvidence === "present" && input.context.campaignEvidence) ||
        (match.campaignEvidence === "absent" && !input.context.campaignEvidence)) &&
      (match.merchandisingDensity === "any" ||
        match.merchandisingDensity === input.context.merchandisingDensity)
    );
  });
  return requireUniqueHighestPriorityRule("collection", matches);
}

export function resolveCollectionContextArchetype(input: {
  context: DynamicCommerceCollectionMatchContext;
  rules: readonly DynamicCommerceCollectionContextRule[];
}): string {
  return selectCollectionContextRule(input).archetypeId;
}

function productTypeMappings(
  catalogue: CatalogueDisplayModel,
  rules: readonly DynamicCommerceProductComplexityRule[],
) {
  const byType = new Map<
    string,
    Readonly<{
      productTypeId: string;
      archetypeId: string;
      ruleId: string;
      priority: number;
      productId: string;
    }>
  >();
  catalogue.products.forEach((product) => {
    const productTypeId = canonicalProductTypePresentationId(product.productType);
    const selected = selectProductComplexityRule({ product, rules });
    const candidate = {
      productTypeId,
      archetypeId: selected.archetypeId,
      ruleId: selected.id,
      priority: selected.priority,
      productId: product.id,
    };
    const current = byType.get(productTypeId);
    if (
      !current ||
      candidate.priority > current.priority ||
      (candidate.priority === current.priority &&
        candidate.productId.localeCompare(current.productId) < 0)
    ) {
      byType.set(productTypeId, candidate);
    }
  });
  return [...byType.values()]
    .sort((left, right) => left.productTypeId.localeCompare(right.productTypeId))
    .map(({ productTypeId, archetypeId }) => ({ productTypeId, archetypeId }));
}

function collectionPageDepth(snapshot: StorefrontSnapshot, page: PageModel): number {
  const pages = new Map(snapshot.pages.map((candidate) => [candidate.id, candidate]));
  const visited = new Set([page.id]);
  let depth = 0;
  let parentId = page.pageFamily?.parentPageId;
  while (parentId) {
    if (visited.has(parentId)) {
      return fail("invalid-presentation", "Collection route parent authority is cyclic.");
    }
    visited.add(parentId);
    depth += 1;
    parentId = pages.get(parentId)?.pageFamily?.parentPageId;
  }
  return depth;
}

function collectionMatchContext(
  snapshot: StorefrontSnapshot,
  page: PageModel,
  collection: CollectionDisplayModel,
): DynamicCommerceCollectionMatchContext {
  const profile = getCommercialCollectionSearchProfile(page.pageFamily?.profileId ?? "")?.profile
    ?.commercialCollectionSearch;
  return {
    depth: collectionPageDepth(snapshot, page),
    productCount: collection.productIds.length,
    // The canonical collection projection currently carries no child relation.
    // Never infer one from collection order or naming.
    childCollections: false,
    campaignEvidence: (page.pageFamily?.evidenceReferences.length ?? 0) > 0,
    merchandisingDensity: profile?.designDnaNarrowing.spacingDensity[0] ?? "standard",
  };
}

function createCollectionContextRules(
  collectionArchetypeIds: ReadonlySet<string>,
  collectionFallbackId: string,
): DynamicCommerceCollectionContextRule[] {
  return [
    {
      id: "collection_rule_campaign",
      priority: 90,
      match: {
        childCollections: "any",
        campaignEvidence: "present",
        merchandisingDensity: "spacious",
      },
      archetypeId: collectionArchetypeIds.has("archetype_collection_campaign")
        ? "archetype_collection_campaign"
        : collectionFallbackId,
    },
    {
      id: "collection_rule_children",
      priority: 80,
      match: {
        childCollections: "present",
        campaignEvidence: "any",
        merchandisingDensity: "any",
      },
      archetypeId: collectionArchetypeIds.has("archetype_collection_editorial")
        ? "archetype_collection_editorial"
        : collectionFallbackId,
    },
    {
      id: "collection_rule_dense",
      priority: 70,
      match: {
        productCount: { minimum: 12, maximum: 100_000 },
        childCollections: "any",
        campaignEvidence: "any",
        merchandisingDensity: "compact",
      },
      archetypeId: collectionArchetypeIds.has("archetype_collection_comparison")
        ? "archetype_collection_comparison"
        : collectionFallbackId,
    },
    {
      id: "collection_rule_default",
      priority: 0,
      match: {
        childCollections: "any",
        campaignEvidence: "any",
        merchandisingDensity: "any",
      },
      archetypeId: collectionFallbackId,
    },
  ];
}

function createProductComplexityRules(
  productArchetypeIds: ReadonlySet<string>,
): DynamicCommerceProductComplexityRule[] {
  return [
    {
      id: "product_rule_considered",
      priority: 100,
      match: {
        optionStructure: "configurable",
        optionGroupCount: { minimum: 4, maximum: 100 },
        mediaAvailability: "any",
        highConsideration: "required",
      },
      archetypeId: productArchetypeIds.has("archetype_pdp_high_consideration")
        ? "archetype_pdp_high_consideration"
        : GENERIC_PDP_ARCHETYPE_ID,
    },
    {
      id: "product_rule_options",
      priority: 90,
      match: {
        optionStructure: "configurable",
        optionGroupCount: { minimum: 3, maximum: 100 },
        mediaAvailability: "any",
        highConsideration: "any",
      },
      archetypeId: productArchetypeIds.has("archetype_pdp_high_consideration")
        ? "archetype_pdp_high_consideration"
        : GENERIC_PDP_ARCHETYPE_ID,
    },
    {
      id: "product_rule_configurable",
      priority: 80,
      match: {
        optionStructure: "configurable",
        optionGroupCount: { minimum: 1, maximum: 100 },
        mediaAvailability: "any",
        highConsideration: "any",
      },
      archetypeId: productArchetypeIds.has("archetype_pdp_configurable")
        ? "archetype_pdp_configurable"
        : GENERIC_PDP_ARCHETYPE_ID,
    },
    {
      id: "product_rule_gallery",
      priority: 70,
      match: {
        optionStructure: "any",
        mediaAvailability: "multiple",
        highConsideration: "excluded",
      },
      archetypeId: productArchetypeIds.has("archetype_pdp_gallery")
        ? "archetype_pdp_gallery"
        : GENERIC_PDP_ARCHETYPE_ID,
    },
    {
      id: "product_rule_simple",
      priority: 0,
      match: {
        optionStructure: "simple",
        mediaAvailability: "any",
        highConsideration: "excluded",
      },
      archetypeId: productArchetypeIds.has("archetype_pdp_standard")
        ? "archetype_pdp_standard"
        : GENERIC_PDP_ARCHETYPE_ID,
    },
  ];
}

function legacyMigrationPreflight(input: {
  catalogue: CatalogueDisplayModel;
  dynamicPages: readonly PageModel[];
}): DynamicCommerceMigrationDecision[] {
  const decisions: DynamicCommerceMigrationDecision[] = [];
  const knownCollectionIds = new Set(input.catalogue.collections.map(({ id }) => id));
  const knownProductIds = new Set(input.catalogue.products.map(({ id }) => id));

  for (const page of input.dynamicPages) {
    const section = legacyDynamicSection(page);
    if (!section || page.sections.length !== 1) continue;
    if (!section.visible) {
      decisions.push({
        code: "unsupported-legacy-layout",
        routeIds: [page.id],
        message:
          "A required legacy dynamic-commerce composite cannot be migrated as a hidden archetype.",
      });
    }

    const familyId = page.pageFamily?.familyId;
    const profileId = page.pageFamily?.profileId;
    const commerceContext = page.pageFamily?.commerceContext;
    if (!profileId) {
      decisions.push({
        code: "missing-profile-identity",
        routeIds: [page.id],
        message: "A legacy dynamic-commerce route has no PageBlueprint profile identity.",
      });
    }

    const expected =
      familyId === "product-detail"
        ? ({ component: "dynamicProductDetail", pageType: "product", context: "product" } as const)
        : familyId === "collection"
          ? ({
              component: "dynamicCollectionCommerce",
              pageType: "collection",
              context: "collection",
            } as const)
          : familyId === "search-results"
            ? ({
                component: "dynamicCollectionCommerce",
                pageType: "collection",
                context: "search",
              } as const)
            : undefined;

    if (
      !expected ||
      section.component !== expected.component ||
      page.type !== expected.pageType ||
      commerceContext?.kind !== expected.context
    ) {
      decisions.push({
        code: "route-family-component-mismatch",
        routeIds: [page.id],
        message:
          "A legacy dynamic-commerce route family, commerce context, page type, and composite component do not agree.",
      });
      continue;
    }

    const plan =
      expected.context === "product"
        ? getCommercialPdpProfile(profileId ?? "")
        : getCommercialCollectionSearchProfile(profileId ?? "");
    if (
      profileId &&
      (!plan?.profile ||
        plan.profile.version !== page.pageFamily?.profileVersion ||
        !plan.profile.componentSelections.some(
          (selection) =>
            selection.component === expected.component &&
            selection.variants.includes(section.variant),
        ))
    ) {
      decisions.push({
        code: plan?.profile ? "route-family-component-mismatch" : "unknown-profile",
        routeIds: [page.id],
        message: plan?.profile
          ? "A legacy dynamic-commerce route does not match its exact registered profile component and variant."
          : "A legacy dynamic-commerce route references an unknown PageBlueprint profile.",
      });
    }

    if (expected.context === "product" && commerceContext.kind === "product") {
      if (typeof section.content.productId !== "string") {
        decisions.push({
          code: "missing-catalogue-identity",
          routeIds: [page.id],
          message: "A legacy product component has no canonical product identity.",
        });
      }
      const content = dynamicProductDetailBridgeContentSchema.safeParse(section.content);
      const props = dynamicProductDetailPropsSchema.safeParse(section.props);
      if (!content.success || !props.success) {
        decisions.push({
          code: "invalid-legacy-schema",
          routeIds: [page.id],
          message: "A legacy product route does not satisfy its registered component schema.",
        });
      } else {
        if (content.data.productId !== commerceContext.productId) {
          decisions.push({
            code: "missing-catalogue-identity",
            routeIds: [page.id],
            message:
              "A legacy product route has conflicting canonical product identities in its route and component binding.",
          });
        }
        const referencedProductIds = [content.data.productId, ...content.data.relatedProductIds];
        if (
          !knownProductIds.has(commerceContext.productId) ||
          referencedProductIds.some((productId) => !knownProductIds.has(productId))
        ) {
          decisions.push({
            code: "unknown-commerce-identity",
            routeIds: [page.id],
            message:
              "A legacy product route references a product absent from the current catalogue.",
          });
        }
      }
      if (
        !dynamicCommerceRouteInventoryEntrySchema.safeParse({
          id: page.id,
          kind: "product",
          route: page.slug,
          productId: commerceContext.productId,
        }).success
      ) {
        decisions.push({
          code: "invalid-route-namespace",
          routeIds: [page.id],
          message: "A legacy product route must use the /products/<slug> namespace.",
        });
      }
      continue;
    }

    if (typeof section.content.collectionId !== "string") {
      decisions.push({
        code: "missing-catalogue-identity",
        routeIds: [page.id],
        message: "A legacy collection/search component has no canonical collection identity.",
      });
    }
    const content = dynamicCollectionCommerceBridgeContentSchema.safeParse(section.content);
    const props = dynamicCollectionCommercePropsSchema.safeParse(section.props);
    if (!content.success || !props.success) {
      decisions.push({
        code: "invalid-legacy-schema",
        routeIds: [page.id],
        message:
          "A legacy collection/search route does not satisfy its registered component schema.",
      });
    } else {
      if (
        commerceContext.kind === "collection" &&
        content.data.collectionId !== commerceContext.collectionId
      ) {
        decisions.push({
          code: "missing-catalogue-identity",
          routeIds: [page.id],
          message:
            "A legacy collection route has conflicting canonical collection identities in its route and component binding.",
        });
      }
      if (
        !knownCollectionIds.has(content.data.collectionId) ||
        content.data.productIds.some((productId) => !knownProductIds.has(productId)) ||
        (commerceContext.kind === "collection" &&
          !knownCollectionIds.has(commerceContext.collectionId))
      ) {
        decisions.push({
          code: "unknown-commerce-identity",
          routeIds: [page.id],
          message:
            "A legacy collection/search route references commerce absent from the current catalogue.",
        });
      }
    }
    const routeInput =
      commerceContext.kind === "collection"
        ? {
            id: page.id,
            kind: "collection" as const,
            route: page.slug,
            collectionId: commerceContext.collectionId,
          }
        : { id: page.id, kind: "search" as const, route: page.slug };
    if (!dynamicCommerceRouteInventoryEntrySchema.safeParse(routeInput).success) {
      decisions.push({
        code: "invalid-route-namespace",
        routeIds: [page.id],
        message:
          commerceContext.kind === "collection"
            ? "A legacy collection route must use the /collections/<slug> namespace."
            : "The legacy search route must be exactly /search.",
      });
    }
  }

  return decisions;
}

function buildAuthority(input: {
  snapshot: StorefrontSnapshot;
  catalogue: CatalogueDisplayModel;
  dynamicPages: readonly PageModel[];
}): DynamicCommercePresentationAuthority | DynamicCommerceMigrationDecision[] {
  const decisions: DynamicCommerceMigrationDecision[] = [];
  const pageSections = new Map<string, SectionInstance>();
  input.dynamicPages.forEach((page) => {
    const section = legacyDynamicSection(page);
    if (!section || page.sections.length !== 1) {
      decisions.push({
        code: "unsupported-legacy-layout",
        routeIds: [page.id],
        message: "A legacy commerce route is not one registered composite presentation.",
      });
      return;
    }
    pageSections.set(page.id, section);
  });
  if (decisions.length) return decisions;

  decisions.push(
    ...legacyMigrationPreflight({
      catalogue: input.catalogue,
      dynamicPages: input.dynamicPages,
    }),
  );
  if (decisions.length) return decisions;

  const byProfile = new Map<string, Array<{ page: PageModel; section: SectionInstance }>>();
  input.dynamicPages.forEach((page) => {
    const profileId = page.pageFamily?.profileId;
    const section = pageSections.get(page.id);
    if (!profileId || !section) return;
    const values = byProfile.get(profileId) ?? [];
    values.push({ page, section });
    byProfile.set(profileId, values);
  });
  for (const [profileId, entries] of byProfile) {
    const fingerprints = new Set(
      entries.map(({ section }) => sectionFingerprint(profileId, section)),
    );
    if (fingerprints.size > 1) {
      decisions.push({
        code: "conflicting-legacy-presentation",
        routeIds: entries.map(({ page }) => page.id),
        message: `Legacy routes using ${profileId} have materially different presentation choices.`,
      });
    }
  }

  const productProfilesByType = new Map<string, Set<string>>();
  input.dynamicPages.forEach((page) => {
    const commerceContext = page.pageFamily?.commerceContext;
    if (commerceContext?.kind !== "product") return;
    const product = input.catalogue.products.find(({ id }) => id === commerceContext.productId);
    const profileId = page.pageFamily?.profileId;
    if (!product || !profileId) return;
    const typeId = canonicalProductTypePresentationId(product.productType);
    const profiles = productProfilesByType.get(typeId) ?? new Set<string>();
    profiles.add(profileId);
    productProfilesByType.set(typeId, profiles);
  });
  for (const [typeId, profiles] of productProfilesByType) {
    if (profiles.size > 1) {
      decisions.push({
        code: "conflicting-product-type-mapping",
        routeIds: input.dynamicPages
          .filter((page) => {
            const commerceContext = page.pageFamily?.commerceContext;
            if (commerceContext?.kind !== "product") return false;
            const product = input.catalogue.products.find(
              ({ id }) => id === commerceContext.productId,
            );
            return product && canonicalProductTypePresentationId(product.productType) === typeId;
          })
          .map(({ id }) => id),
        message: "One product type has incompatible legacy PDP profile choices.",
      });
    }
  }
  if (decisions.length) return decisions;

  const frameProfileId = input.snapshot.sharedFrame?.profileId;
  const compatibleCollectionPlans = listCommercialCollectionSearchProfiles().filter(
    ({ profile }) =>
      profile?.commercialCollectionSearch &&
      (!frameProfileId ||
        new Set<string>(profile.commercialCollectionSearch.compatibleSharedFrameProfileIds).has(
          frameProfileId,
        )),
  );
  const compatibleProductPlans = listCommercialPdpProfiles().filter(
    ({ profile }) =>
      profile?.commercialProductDetail &&
      (!frameProfileId ||
        new Set<string>(profile.commercialProductDetail.compatibleSharedFrameProfileIds).has(
          frameProfileId,
        )),
  );
  const compatibleProfileIds = new Set([
    ...compatibleCollectionPlans.map(({ profile }) => profile!.id),
    ...compatibleProductPlans.map(({ profile }) => profile!.id),
  ]);
  const incompatibleLegacyRoutes = input.dynamicPages.filter(
    ({ pageFamily }) => pageFamily?.profileId && !compatibleProfileIds.has(pageFamily.profileId),
  );
  if (incompatibleLegacyRoutes.length) {
    return [
      {
        code: "conflicting-legacy-presentation",
        routeIds: incompatibleLegacyRoutes.map(({ id }) => id),
        message: "A legacy dynamic-commerce profile is incompatible with the current shared frame.",
      },
    ];
  }
  if (!compatibleCollectionPlans.length || !compatibleProductPlans.length) {
    return [
      {
        code: "conflicting-legacy-presentation",
        routeIds: input.dynamicPages.map(({ id }) => id),
        message: "The current shared frame has no compatible dynamic-commerce archetypes.",
      },
    ];
  }
  const legacySearchProfileId = input.dynamicPages.find(
    ({ pageFamily }) => pageFamily?.familyId === "search-results",
  )?.pageFamily?.profileId;
  const searchPlan =
    compatibleCollectionPlans.find(({ profile }) => profile?.id === legacySearchProfileId) ??
    compatibleCollectionPlans.find(({ profile }) => profile?.id === "collection-dense-search") ??
    compatibleCollectionPlans[0];
  const searchProfileId = searchPlan.profile!.id;
  const collectionSearchArchetypes = compatibleCollectionPlans.map((plan) => {
    const profileId = plan.profile!.id;
    return createCollectionArchetype(
      profileId,
      byProfile.get(profileId)?.[0]?.section,
      profileId === searchProfileId,
    );
  });
  const genericProductPlan =
    compatibleProductPlans.find(({ profile }) => profile?.id === "pdp-standard-commerce") ??
    compatibleProductPlans.find(({ profile }) => byProfile.has(profile!.id)) ??
    compatibleProductPlans[0];
  const productDetailArchetypes = [
    ...compatibleProductPlans.map((plan) => {
      const profileId = plan.profile!.id;
      return createProductArchetype(profileId, byProfile.get(profileId)?.[0]?.section);
    }),
    createProductArchetype(genericProductPlan.profile!.id, undefined, true),
  ];

  const routeInventory: DynamicCommerceRouteInventoryEntry[] = input.dynamicPages.map((page) => {
    const context = page.pageFamily?.commerceContext;
    if (context?.kind === "collection") {
      return {
        id: page.id,
        kind: "collection",
        route: page.slug,
        collectionId: context.collectionId,
      };
    }
    if (context?.kind === "product") {
      const section = pageSections.get(page.id);
      const content = dynamicProductDetailBridgeContentSchema.parse(section?.content);
      return {
        id: page.id,
        kind: "product",
        route: page.slug,
        productId: context.productId,
        relatedProductIds: [...content.relatedProductIds],
      };
    }
    if (context?.kind === "search" || page.slug === "/search") {
      return { id: page.id, kind: "search", route: "/search" };
    }
    throw new DynamicCommerceMigrationError([
      {
        code: "missing-route-identity",
        routeIds: [page.id],
        message: "A legacy dynamic route has no canonical commerce identity.",
      },
    ]);
  });
  if (!routeInventory.some(({ kind }) => kind === "search")) {
    routeInventory.push({ id: "dynamic_search_route", kind: "search", route: "/search" });
  }

  const collectionArchetypeIds = new Set(collectionSearchArchetypes.map(({ id }) => id));
  const collectionFallbackId =
    collectionArchetypeId(
      compatibleCollectionPlans.find(({ profile }) => byProfile.has(profile!.id))?.profile?.id ??
        compatibleCollectionPlans[0].profile!.id,
    ) || collectionSearchArchetypes[0].id;
  const collectionContextRules = createCollectionContextRules(
    collectionArchetypeIds,
    collectionFallbackId,
  );
  const collectionRouteMappings = routeInventory.flatMap((route) => {
    if (route.kind !== "collection") return [];
    const page = input.dynamicPages.find(({ id }) => id === route.id);
    const profileArchetype = page?.pageFamily?.profileId
      ? collectionArchetypeId(page.pageFamily.profileId)
      : "";
    const collection = input.catalogue.collections.find(({ id }) => id === route.collectionId);
    if (!page || !collection) return [];
    const contextualArchetypeId = resolveCollectionContextArchetype({
      context: collectionMatchContext(input.snapshot, page, collection),
      rules: collectionContextRules,
    });
    if (profileArchetype && collectionArchetypeIds.has(profileArchetype)) {
      return [{ routeId: route.id, archetypeId: profileArchetype }];
    }
    return [
      {
        routeId: route.id,
        archetypeId: contextualArchetypeId,
      },
    ];
  });

  const productArchetypeIds = new Set(productDetailArchetypes.map(({ id }) => id));
  const productComplexityRules = createProductComplexityRules(productArchetypeIds);
  const legacyProductMappings = new Map<string, { archetypeId: string }>();
  input.dynamicPages.forEach((page) => {
    const commerceContext = page.pageFamily?.commerceContext;
    if (commerceContext?.kind !== "product") return;
    const product = input.catalogue.products.find(({ id }) => id === commerceContext.productId);
    const archetypeId = productArchetypeId(page.pageFamily?.profileId ?? "");
    if (product && archetypeId) {
      legacyProductMappings.set(canonicalProductTypePresentationId(product.productType), {
        archetypeId,
      });
    }
  });
  const mappedByComplexity = productTypeMappings(input.catalogue, productComplexityRules);
  const mappings = mappedByComplexity.map((mapping) => ({
    productTypeId: mapping.productTypeId,
    archetypeId: (() => {
      const selected =
        legacyProductMappings.get(mapping.productTypeId)?.archetypeId ?? mapping.archetypeId;
      return productArchetypeIds.has(selected) ? selected : GENERIC_PDP_ARCHETYPE_ID;
    })(),
  }));

  const material = {
    contractVersion: DYNAMIC_COMMERCE_PRESENTATION_CONTRACT_VERSION,
    authorityId: `dynamic_commerce_${canonicalValueFingerprint({
      projectId: input.snapshot.projectId,
      snapshotId: input.snapshot.id,
    }).slice(-24)}`,
    authorityRevision: 1,
    routeInventory,
    collectionSearchArchetypes,
    productDetailArchetypes,
    collectionRouteMappings,
    collectionContextRules,
    productTypeMappings: mappings,
    productComplexityRules,
    searchArchetypeId: collectionArchetypeId(searchProfileId),
    fallbacks: {
      collectionArchetypeId: collectionFallbackId,
      searchArchetypeId: collectionArchetypeId(searchProfileId),
      productDetailArchetypeId: GENERIC_PDP_ARCHETYPE_ID,
    },
  };
  return createDynamicCommercePresentationAuthority(material);
}

export function migrateLegacyDynamicCommerceRoutes(
  snapshotInput: StorefrontSnapshot,
  catalogue: CatalogueDisplayModel,
): DynamicCommerceMigrationResult {
  const snapshotCandidate = structuredClone(snapshotInput);
  const snapshotResult = storefrontSnapshotSchema.safeParse(snapshotCandidate);
  if (!snapshotResult.success) {
    return {
      status: "requires-decision",
      snapshot: snapshotCandidate,
      decisions: [
        {
          code: "invalid-legacy-schema",
          routeIds: [],
          message: "The legacy snapshot does not satisfy the canonical storefront schema.",
        },
      ],
    };
  }
  const snapshot = snapshotResult.data;
  const catalogueResult = catalogueDisplayModelSchema.safeParse(structuredClone(catalogue));
  if (!catalogueResult.success) {
    return {
      status: "requires-decision",
      snapshot,
      decisions: [
        {
          code: "invalid-legacy-schema",
          routeIds: [],
          message: "The current catalogue does not satisfy the canonical commerce schema.",
        },
      ],
    };
  }
  const currentCatalogue = catalogueResult.data;
  if (snapshot.catalogueRef !== currentCatalogue.id) {
    return {
      status: "requires-decision",
      snapshot,
      decisions: [
        {
          code: "missing-catalogue-identity",
          routeIds: [],
          message:
            "The legacy snapshot catalogue reference does not match the supplied canonical catalogue.",
        },
      ],
    };
  }
  if (snapshot.dynamicCommercePresentation) {
    const authority = dynamicCommercePresentationAuthoritySchema.parse(
      snapshot.dynamicCommercePresentation,
    );
    return { status: "current", snapshot, authority };
  }
  const dynamicPages = snapshot.pages.filter(isLegacyDynamicPage);
  if (dynamicPages.length === 0) {
    return {
      status: "requires-decision",
      snapshot,
      decisions: [
        {
          code: "missing-route-identity",
          routeIds: [],
          message: "The legacy snapshot has no concrete dynamic-commerce route inventory.",
        },
      ],
    };
  }
  const removedIds = new Set(dynamicPages.map(({ id }) => id));
  const dynamicParentPages = snapshot.pages.filter(
    (page) =>
      !removedIds.has(page.id) &&
      page.pageFamily?.parentPageId &&
      removedIds.has(page.pageFamily.parentPageId),
  );
  if (dynamicParentPages.length) {
    return {
      status: "requires-decision",
      snapshot,
      decisions: [
        {
          code: "dynamic-parent-reference",
          routeIds: dynamicParentPages.map(({ id }) => id),
          message: "A static page depends on a concrete commerce page as its parent.",
        },
      ],
    };
  }
  let authority: DynamicCommercePresentationAuthority | DynamicCommerceMigrationDecision[];
  try {
    authority = buildAuthority({ snapshot, catalogue: currentCatalogue, dynamicPages });
  } catch (cause) {
    if (cause instanceof DynamicCommerceMigrationError) {
      return { status: "requires-decision", snapshot, decisions: cause.decisions };
    }
    return {
      status: "requires-decision",
      snapshot,
      decisions: [
        {
          code: "invalid-legacy-schema",
          routeIds: dynamicPages.map(({ id }) => id),
          message:
            "Legacy dynamic-commerce presentation cannot be projected through current registered schemas.",
        },
      ],
    };
  }
  if (Array.isArray(authority)) {
    return { status: "requires-decision", snapshot, decisions: authority };
  }
  const routeIds = new Set(authority.routeInventory.map(({ id }) => id));
  const migratedResult = storefrontSnapshotSchema.safeParse({
    ...structuredClone(snapshot),
    pages: snapshot.pages.filter(({ id }) => !removedIds.has(id)),
    navigation: Object.fromEntries(
      Object.entries(snapshot.navigation).map(([area, items]) => [
        area,
        items.map((item) =>
          item.target.type === "page" && routeIds.has(item.target.pageId)
            ? {
                ...item,
                target: { type: "dynamic-commerce-route" as const, routeId: item.target.pageId },
              }
            : structuredClone(item),
        ),
      ]),
    ),
    dynamicCommercePresentation: authority,
  });
  if (!migratedResult.success) {
    return {
      status: "requires-decision",
      snapshot,
      decisions: [
        {
          code: "invalid-legacy-schema",
          routeIds: dynamicPages.map(({ id }) => id),
          message:
            "The migrated dynamic-commerce authority does not satisfy the canonical storefront schema.",
        },
      ],
    };
  }
  const migrated = migratedResult.data;
  return {
    status: "migrated",
    snapshot: migrated,
    authority,
    migratedRouteCount: dynamicPages.length,
  };
}

export function requireMigratedDynamicCommerceSnapshot(
  snapshot: StorefrontSnapshot,
  catalogue: CatalogueDisplayModel,
): StorefrontSnapshot {
  const result = migrateLegacyDynamicCommerceRoutes(snapshot, catalogue);
  if (result.status === "requires-decision")
    throw new DynamicCommerceMigrationError(result.decisions);
  return result.snapshot;
}

function assertCurrentArchetype(
  snapshot: StorefrontSnapshot,
  archetype: DynamicCommerceCollectionSearchArchetype | DynamicCommerceProductDetailArchetype,
) {
  const plan =
    archetype.family === "collection-search"
      ? getCommercialCollectionSearchProfile(archetype.profile.profileId)
      : getCommercialPdpProfile(archetype.profile.profileId);
  if (!plan?.profile || plan.profile.version !== archetype.profile.profileVersion) {
    fail("stale-profile", "The dynamic route references a stale PageBlueprint profile.");
  }
  const materialized = materializeExecutablePageBlueprint({
    pagePlan: plan,
    componentDefinitions: veskifyComponentDefinitionsV2,
    availableBindingCategories:
      archetype.family === "collection-search" ? ["collection", "productList"] : ["product"],
  });
  const profileAuthority =
    archetype.family === "collection-search"
      ? plan.profile.commercialCollectionSearch
      : plan.profile.commercialProductDetail;
  const semanticFrameIds = (values: readonly string[]) => [...values].sort();
  const semanticDesignDnaNarrowing = (value: {
    spacingDensity: readonly string[];
    surfaceDepth: readonly string[];
    imagePosture: readonly string[];
  }) => ({
    spacingDensity: [...value.spacingDensity].sort(),
    surfaceDepth: [...value.surfaceDepth].sort(),
    imagePosture: [...value.imagePosture].sort(),
  });
  const registeredImagePosture = profileAuthority?.designDnaNarrowing.imagePosture[0];
  const expectedArtDirectionPosture = registeredImagePosture
    ? archetype.family === "collection-search"
      ? {
          imagePosture: registeredImagePosture,
          ratio: "natural",
          crop: registeredImagePosture === "contained" ? "contain" : "editorial",
          overlay: "none",
        }
      : {
          imagePosture: registeredImagePosture,
          ratio: registeredImagePosture === "contained" ? "portrait" : "natural",
          crop: registeredImagePosture === "contained" ? "contain" : "editorial",
          overlay: "none",
        }
    : undefined;
  if (
    materialized.fingerprint !== archetype.profile.fingerprint ||
    !profileAuthority ||
    canonicalValueString(semanticFrameIds(profileAuthority.compatibleSharedFrameProfileIds)) !==
      canonicalValueString(semanticFrameIds(archetype.compatibleSharedFrameProfileIds)) ||
    profileAuthority.defaultSharedFrameProfileId !== archetype.defaultSharedFrameProfileId ||
    canonicalValueString(semanticDesignDnaNarrowing(profileAuthority.designDnaNarrowing)) !==
      canonicalValueString(semanticDesignDnaNarrowing(archetype.designDnaNarrowing)) ||
    canonicalValueString(profileAuthority.responsiveArchitecture) !==
      canonicalValueString(archetype.responsivePosture) ||
    canonicalValueString(expectedArtDirectionPosture) !==
      canonicalValueString(archetype.artDirectionPosture) ||
    archetype.fallbackBehavior !== "use-family-fallback"
  ) {
    fail("stale-profile", "The dynamic route archetype no longer matches registered authority.");
  }
  if (
    archetype.componentPresentations.length !== materialized.slots.length ||
    archetype.componentPresentations.some((presentation, index) => {
      const selection = plan.profile!.componentSelections[index];
      const slot = materialized.slots[index];
      const expectedAnatomyId =
        archetype.family === "collection-search" &&
        profileAuthority &&
        "productCardAnatomyId" in profileAuthority
          ? profileAuthority.productCardAnatomyId
          : archetype.family === "product-detail" &&
              profileAuthority &&
              "relatedProductCardAnatomyId" in profileAuthority
            ? profileAuthority.relatedProductCardAnatomyId
            : undefined;
      return (
        slot?.slotId !== presentation.slotId ||
        slot.component !== presentation.component ||
        selection?.slotId !== presentation.slotId ||
        !selection.variants.includes(presentation.variant) ||
        (plan.slots[index]?.required === true && !presentation.visible) ||
        presentation.anatomyId !== expectedAnatomyId ||
        canonicalValueString(presentation.boundedParameters) !==
          canonicalValueString(slot.boundedParameters)
      );
    })
  ) {
    fail(
      "invalid-presentation",
      "The dynamic route archetype does not match its registered PageBlueprint presentation.",
    );
  }
  try {
    for (const presentation of archetype.componentPresentations) {
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
      projectSectionStyleOverrides(presentation.styleOverrides);
    }
  } catch (cause) {
    fail(
      "invalid-presentation",
      "The dynamic route archetype fails its registered component schema.",
      cause,
    );
  }
  if (
    snapshot.sharedFrame &&
    !archetype.compatibleSharedFrameProfileIds.includes(snapshot.sharedFrame.profileId)
  ) {
    fail(
      "incompatible-shared-frame",
      "The dynamic route archetype is incompatible with the current frame.",
    );
  }
}

/**
 * Validates the complete compact authority against the current executable
 * PageBlueprint and component registry contracts without materializing route
 * commerce bindings.
 */
export function validateCurrentDynamicCommercePresentationAuthority(
  snapshot: StorefrontSnapshot,
): void {
  if (!snapshot.dynamicCommercePresentation) return;
  const authority = exactAuthority(snapshot);
  for (const archetype of authority.collectionSearchArchetypes) {
    assertCurrentArchetype(snapshot, archetype);
  }
  for (const archetype of authority.productDetailArchetypes) {
    assertCurrentArchetype(snapshot, archetype);
  }
}

function exactAuthority(snapshot: StorefrontSnapshot): DynamicCommercePresentationAuthority {
  if (!snapshot.dynamicCommercePresentation) {
    return fail(
      "missing-authority",
      "This snapshot has no dynamic-commerce presentation authority.",
    );
  }
  const parsed = dynamicCommercePresentationAuthoritySchema.safeParse(
    snapshot.dynamicCommercePresentation,
  );
  if (!parsed.success)
    return fail("stale-authority", "Dynamic-commerce authority is invalid.", parsed.error);
  return parsed.data;
}

function pageAuthority(
  snapshot: StorefrontSnapshot,
  archetype: DynamicCommerceCollectionSearchArchetype | DynamicCommerceProductDetailArchetype,
  commerceContext: PageFamilyAuthority["commerceContext"],
): PageFamilyAuthority {
  const localeCoverage = [
    ...new Set(snapshot.pages.flatMap((page) => page.pageFamily?.localeCoverage ?? [])),
  ];
  return {
    familyId:
      archetype.family === "product-detail"
        ? "product-detail"
        : commerceContext.kind === "search"
          ? "search-results"
          : "collection",
    familyVersion: PAGE_FAMILY_AUTHORITY_VERSION,
    profileId: archetype.profile.profileId,
    profileVersion: archetype.profile.profileVersion,
    localeCoverage: localeCoverage.length > 0 ? localeCoverage : ["en"],
    sharedFrameId: SITE_MAP_SHARED_FRAME.id,
    sharedFrameVersion: SITE_MAP_SHARED_FRAME.version,
    commerceContext,
    commerceOperationAuthority: "read-only-presentation",
    navigationAreas: [],
    evidenceReferences: [],
  };
}

function projectSectionStyleOverrides(
  styleOverrides:
    DynamicCommerceComponentPresentation["styleOverrides"] | SectionInstance["styleOverrides"],
): SectionInstance["styleOverrides"] {
  if (!styleOverrides) return undefined;
  const { surfaceTreatment, ...allowed } = styleOverrides as NonNullable<
    DynamicCommerceComponentPresentation["styleOverrides"]
  >;
  if (surfaceTreatment === "soft") {
    if (allowed.surface && allowed.surface !== "surface") {
      return fail(
        "invalid-presentation",
        "Soft surface treatment conflicts with the explicit section surface.",
      );
    }
    return { ...allowed, surface: "surface" };
  }
  return Object.keys(allowed).length > 0 ? allowed : undefined;
}

function routeSection(
  archetype: DynamicCommerceCollectionSearchArchetype | DynamicCommerceProductDetailArchetype,
  route: DynamicCommerceRouteInventoryEntry,
  catalogue: CatalogueDisplayModel,
  projection: "runtime" | "editor" | undefined,
): SectionInstance {
  const presentation = archetype.componentPresentations[0];
  if (!presentation) return fail("invalid-presentation", "The selected archetype is empty.");
  const revision = `canonical-commerce-${canonicalValueFingerprint(catalogue)}`;
  if (route.kind === "product" && archetype.family === "product-detail") {
    const relatedProductIds = route.relatedProductIds ?? [];
    if (
      relatedProductIds.some(
        (relatedProductId) => !catalogue.products.some(({ id }) => id === relatedProductId),
      )
    ) {
      return fail(
        "unknown-commerce-identity",
        "A protected related-product binding is unavailable in the current catalogue.",
      );
    }
    return {
      id:
        projection === "editor" ? `section_${archetype.id}` : `section_${route.id}_${archetype.id}`,
      component: "dynamicProductDetail",
      variant: presentation.variant,
      visible: presentation.visible,
      content: {
        ...structuredClone(presentation.content),
        productId: route.productId,
        // This is an exact protected runtime binding retained from canonical
        // materialization or migration. Never infer relations from catalogue
        // order or place them in editable archetype design state.
        relatedProductIds: [...relatedProductIds],
        canonicalRevision: revision,
      },
      props: structuredClone(presentation.props),
      styleOverrides: structuredClone(projectSectionStyleOverrides(presentation.styleOverrides)),
      approvedAssetPlacements: [],
      approvedAssetPresentations: [],
    };
  }
  if (route.kind === "collection" && archetype.family === "collection-search") {
    const collection = catalogue.collections.find(({ id }) => id === route.collectionId);
    if (!collection)
      return fail("unknown-commerce-identity", "The route collection is unavailable.");
    return {
      id:
        projection === "editor" ? `section_${archetype.id}` : `section_${route.id}_${archetype.id}`,
      component: "dynamicCollectionCommerce",
      variant: presentation.variant,
      visible: presentation.visible,
      content: {
        ...structuredClone(presentation.content),
        collectionId: collection.id,
        productIds: [...collection.productIds],
        canonicalRevision: revision,
      },
      props: structuredClone(presentation.props),
      styleOverrides: structuredClone(projectSectionStyleOverrides(presentation.styleOverrides)),
      approvedAssetPlacements: [],
      approvedAssetPresentations: [],
    };
  }
  if (route.kind === "search" && archetype.family === "collection-search") {
    return fail(
      "unknown-commerce-identity",
      "Search presentation requires an exact transient canonical search-result projection.",
    );
  }
  return fail(
    "unknown-archetype",
    "The selected archetype does not match the dynamic route family.",
  );
}

export type ResolvedDynamicCommerceRoutePage = Readonly<{
  route: DynamicCommerceRouteInventoryEntry;
  archetype: DynamicCommerceCollectionSearchArchetype | DynamicCommerceProductDetailArchetype;
  page: PageModel;
}>;

type DynamicCommerceRouteResolutionInput = Readonly<{
  snapshot: StorefrontSnapshot;
  catalogue: CatalogueDisplayModel;
  route?: string;
  routeId?: string;
}> &
  (
    | Readonly<{ projection: "editor"; archetypeId?: string }>
    | Readonly<{ projection?: "runtime"; archetypeId?: never }>
  );

export function resolveDynamicCommerceRoutePage(
  input: DynamicCommerceRouteResolutionInput,
): ResolvedDynamicCommerceRoutePage {
  const authority = exactAuthority(input.snapshot);
  const route = authority.routeInventory.find((candidate) =>
    input.routeId ? candidate.id === input.routeId : candidate.route === input.route,
  );
  if (!route) return fail("unknown-route", "The requested dynamic commerce route is unavailable.");
  // Runtime selection is always recomputed from the snapshot's canonical
  // route/type mappings. A caller may select a different registered archetype
  // only while explicitly projecting that archetype into the editor.
  let archetypeId = input.projection === "editor" ? input.archetypeId : undefined;
  if (!archetypeId && route.kind === "collection") {
    archetypeId =
      authority.collectionRouteMappings.find(({ routeId }) => routeId === route.id)?.archetypeId ??
      authority.fallbacks.collectionArchetypeId;
  }
  if (!archetypeId && route.kind === "search") archetypeId = authority.searchArchetypeId;
  if (!archetypeId && route.kind === "product") {
    const product = input.catalogue.products.find(({ id }) => id === route.productId);
    if (!product) return fail("unknown-commerce-identity", "The route product is unavailable.");
    archetypeId =
      authority.productTypeMappings.find(
        ({ productTypeId }) =>
          productTypeId === canonicalProductTypePresentationId(product.productType),
      )?.archetypeId ?? authority.fallbacks.productDetailArchetypeId;
  }
  const archetype =
    authority.collectionSearchArchetypes.find(({ id }) => id === archetypeId) ??
    authority.productDetailArchetypes.find(({ id }) => id === archetypeId);
  if (!archetype)
    return fail("unknown-archetype", "The selected dynamic-commerce archetype is unavailable.");
  assertCurrentArchetype(input.snapshot, archetype);
  const product =
    route.kind === "product"
      ? input.catalogue.products.find(({ id }) => id === route.productId)
      : undefined;
  const collection =
    route.kind === "collection"
      ? input.catalogue.collections.find(({ id }) => id === route.collectionId)
      : undefined;
  if (route.kind === "product" && !product)
    return fail("unknown-commerce-identity", "The route product is unavailable.");
  if (route.kind === "collection" && !collection)
    return fail("unknown-commerce-identity", "The route collection is unavailable.");
  const commerceContext: PageFamilyAuthority["commerceContext"] =
    route.kind === "product"
      ? { kind: "product", productId: route.productId }
      : route.kind === "collection"
        ? { kind: "collection", collectionId: route.collectionId }
        : { kind: "search" };
  const title = product?.title ?? collection?.title ?? ({ en: "Search", fi: "Haku" } as const);
  const description =
    product?.description ??
    collection?.description ??
    ({ en: "Search the storefront catalogue.", fi: "Hae verkkokaupan valikoimasta." } as const);
  return {
    route: structuredClone(route),
    archetype: structuredClone(archetype),
    page: {
      id: input.projection === "editor" ? archetype.id : route.id,
      type: route.kind === "product" ? "product" : "collection",
      slug: route.route,
      title: structuredClone(title),
      seo: product?.seo ?? {
        title: structuredClone(title),
        metaDescription: structuredClone(description),
      },
      pageFamily: pageAuthority(input.snapshot, archetype, commerceContext),
      sections: [routeSection(archetype, route, input.catalogue, input.projection)],
    },
  };
}

export type DynamicCommerceEditorProjection = ResolvedDynamicCommerceRoutePage &
  Readonly<{ representativeRouteId: string }>;

export function projectDynamicCommerceArchetypePages(
  snapshot: StorefrontSnapshot,
  catalogue: CatalogueDisplayModel,
  representativeRouteIds: Readonly<Record<string, string>> = {},
): DynamicCommerceEditorProjection[] {
  const authority = exactAuthority(snapshot);
  const projections: DynamicCommerceEditorProjection[] = [];
  for (const archetype of authority.collectionSearchArchetypes) {
    const mapped = authority.collectionRouteMappings.find(
      ({ archetypeId }) => archetypeId === archetype.id,
    );
    const fallbackRoute = authority.routeInventory.find(({ kind }) => kind === "collection");
    const requested = authority.routeInventory.find(
      ({ id, kind }) => id === representativeRouteIds[archetype.id] && kind === "collection",
    );
    const routeId = requested?.id ?? mapped?.routeId ?? fallbackRoute?.id;
    if (!routeId) continue;
    const resolved = resolveDynamicCommerceRoutePage({
      snapshot,
      catalogue,
      routeId,
      archetypeId: archetype.id,
      projection: "editor",
    });
    projections.push({ ...resolved, representativeRouteId: routeId });
  }
  for (const archetype of authority.productDetailArchetypes) {
    const mappedType = authority.productTypeMappings.find(
      ({ archetypeId }) => archetypeId === archetype.id,
    );
    const mappedProduct = mappedType
      ? catalogue.products.find(
          (product) =>
            canonicalProductTypePresentationId(product.productType) === mappedType.productTypeId,
        )
      : undefined;
    const fallbackRoute = authority.routeInventory.find(
      (route) =>
        route.kind === "product" && (!mappedProduct || route.productId === mappedProduct.id),
    );
    const requested = authority.routeInventory.find(
      ({ id, kind }) => id === representativeRouteIds[archetype.id] && kind === "product",
    );
    const routeId = requested?.id ?? fallbackRoute?.id;
    if (!routeId) continue;
    const resolved = resolveDynamicCommerceRoutePage({
      snapshot,
      catalogue,
      routeId,
      archetypeId: archetype.id,
      projection: "editor",
    });
    projections.push({ ...resolved, representativeRouteId: routeId });
  }
  return projections;
}

export function applyDynamicCommerceArchetypePage(
  snapshotInput: StorefrontSnapshot,
  page: PageModel,
): StorefrontSnapshot {
  const snapshot = storefrontSnapshotSchema.parse(structuredClone(snapshotInput));
  const authority = exactAuthority(snapshot);
  const collectionIndex = authority.collectionSearchArchetypes.findIndex(
    ({ id }) => id === page.id,
  );
  const productIndex = authority.productDetailArchetypes.findIndex(({ id }) => id === page.id);
  if (collectionIndex < 0 && productIndex < 0) return snapshot;
  if (page.sections.length !== 1)
    return fail("invalid-presentation", "An archetype must retain one composite section.");
  const section = page.sections[0];
  const current =
    collectionIndex >= 0
      ? authority.collectionSearchArchetypes[collectionIndex]
      : authority.productDetailArchetypes[productIndex];
  const presentation =
    current.family === "collection-search"
      ? collectionPresentation(current.profile.profileId, section)
      : productPresentation(current.profile.profileId, section);
  const currentPresentation = current.componentPresentations[0];
  const canonicalPresentation =
    currentPresentation &&
    canonicalValueString(projectSectionStyleOverrides(currentPresentation.styleOverrides)) ===
      canonicalValueString(projectSectionStyleOverrides(presentation.styleOverrides))
      ? {
          ...presentation,
          styleOverrides: structuredClone(currentPresentation.styleOverrides),
        }
      : presentation;
  if (
    canonicalValueString(current.componentPresentations) ===
    canonicalValueString([canonicalPresentation])
  ) {
    return snapshot;
  }
  const nextArchetype = {
    ...structuredClone(current),
    componentPresentations: [canonicalPresentation],
  } as typeof current;
  const nextAuthorityWithoutFingerprint = {
    ...structuredClone(authority),
    authorityRevision: authority.authorityRevision + 1,
    collectionSearchArchetypes:
      collectionIndex >= 0
        ? authority.collectionSearchArchetypes.map((entry, index) =>
            index === collectionIndex
              ? (nextArchetype as DynamicCommerceCollectionSearchArchetype)
              : entry,
          )
        : authority.collectionSearchArchetypes,
    productDetailArchetypes:
      productIndex >= 0
        ? authority.productDetailArchetypes.map((entry, index) =>
            index === productIndex
              ? (nextArchetype as DynamicCommerceProductDetailArchetype)
              : entry,
          )
        : authority.productDetailArchetypes,
  };
  const { authorityFingerprint: _authorityFingerprint, ...material } =
    nextAuthorityWithoutFingerprint;
  void _authorityFingerprint;
  const dynamicCommercePresentation = createDynamicCommercePresentationAuthority(material);
  return storefrontSnapshotSchema.parse({ ...snapshot, dynamicCommercePresentation });
}

export function expandDynamicCommerceRoutePages(
  snapshotInput: StorefrontSnapshot,
  catalogue: CatalogueDisplayModel,
): StorefrontSnapshot {
  const snapshot = storefrontSnapshotSchema.parse(structuredClone(snapshotInput));
  const authority = exactAuthority(snapshot);
  const pages = [
    ...snapshot.pages.map((page) => structuredClone(page)),
    ...authority.routeInventory
      .filter(({ kind }) => kind !== "search")
      .map(({ id }) => resolveDynamicCommerceRoutePage({ snapshot, catalogue, routeId: id }).page),
  ];
  const navigation = Object.fromEntries(
    Object.entries(snapshot.navigation).map(([area, items]) => [
      area,
      items.flatMap((item) => {
        const target = item.target;
        if (target.type !== "dynamic-commerce-route") return [structuredClone(item)];
        const route = authority.routeInventory.find(({ id }) => id === target.routeId);
        return route?.kind === "search"
          ? []
          : [{ ...item, target: { type: "page" as const, pageId: target.routeId } }];
      }),
    ]),
  );
  const { dynamicCommercePresentation: _authority, ...legacy } = snapshot;
  void _authority;
  return storefrontSnapshotSchema.parse({ ...legacy, pages, navigation });
}

export function dynamicCommerceRouteForProduct(
  snapshot: StorefrontSnapshot,
  productId: string,
): string | undefined {
  return snapshot.dynamicCommercePresentation?.routeInventory.find(
    (route) => route.kind === "product" && route.productId === productId,
  )?.route;
}

export function dynamicCommerceRouteForCollection(
  snapshot: StorefrontSnapshot,
  collectionId: string,
): string | undefined {
  return snapshot.dynamicCommercePresentation?.routeInventory.find(
    (route) => route.kind === "collection" && route.collectionId === collectionId,
  )?.route;
}
