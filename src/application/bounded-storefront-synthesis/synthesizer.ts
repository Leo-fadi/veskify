import { registeredBrandSystemForDirection } from "@/application/storefront-design-system";
import {
  getCommercialCollectionSearchProfile,
  getCommercialHomepageProfile,
  getCommercialPdpProfile,
  getExecutablePageBlueprintProfile,
  materializeExecutablePageBlueprint,
  type CommercialCollectionSearchProfileId,
  type CommercialHomepageProfileId,
  type CommercialPdpProfileId,
} from "@/application/storefront-templates";
import type { StorefrontSiteMapDecision } from "@/application/storefront-site-map";
import {
  createWholeStorefrontGenerationTarget,
  materializeCompleteStorefrontSelection,
  type ApprovedAssetPresentation,
  type CompleteStorefrontMaterialization,
  type WholeStorefrontGenerationPlan,
  wholeStorefrontPageBlueprintSelectionOverridesSchema,
  type WholeStorefrontPlanningInput,
} from "@/application/whole-storefront-generation-plan";
import type { ContentSupportFactAuthority } from "@/application/content-support-pages";
import type { PageFactEvidenceAuthority } from "@/application/storefront-site-map";
import {
  dynamicCommerceDesignSelectionSchema,
  validateDynamicCommerceDesignSelection,
  type DynamicCommerceDesignSelection,
} from "@/application/dynamic-commerce-routes";
import {
  applyCommercialSharedFrame,
  canonicalValueFingerprint,
  canonicalValueString,
  commercialSharedFrameProfileIds,
  getCommercialSharedFrameProfile,
  type PageFactEvidenceReference,
  type CommercialSharedFrameProfileId,
} from "@/domain/storefront";
import {
  BOUNDED_STOREFRONT_SYNTHESIS_CONTRACT_VERSION,
  boundedStorefrontSynthesisDecisionSchema,
  boundedStorefrontSynthesisRequestSchema,
  boundedStorefrontSynthesisSelectionNarrowingSchema,
  BoundedStorefrontSynthesisError,
  type BoundedStorefrontSynthesisDecision,
  type BoundedStorefrontSynthesisRequest,
  type BoundedStorefrontSynthesisSelectionNarrowing,
} from "./contract";
import { validateDirectionSelectionNarrowing } from "./direction-registry";

type Selection = Readonly<{
  directionId: WholeStorefrontGenerationPlan["designSystemSelection"]["directionId"];
  homepageProfileId: CommercialHomepageProfileId;
  collectionProfileId: CommercialCollectionSearchProfileId;
  searchProfileId: CommercialCollectionSearchProfileId;
  pdpProfileId: CommercialPdpProfileId;
  narrativePosture: BoundedStorefrontSynthesisDecision["narrative"]["posture"];
  merchandisingPosture: BoundedStorefrontSynthesisDecision["merchandisingPosture"];
  densityPosture: BoundedStorefrontSynthesisDecision["informationDensityPosture"];
  artDirectionPosture: BoundedStorefrontSynthesisDecision["artDirectionPosture"];
  responsiveMode: BoundedStorefrontSynthesisDecision["responsivePosture"]["mode"];
  decisions: BoundedStorefrontSynthesisDecision["decisions"];
}>;

export type BoundedStorefrontSynthesisInput = Readonly<{
  planningInput: WholeStorefrontPlanningInput;
  siteMapDecision: StorefrontSiteMapDecision;
  approvedEvidenceReferences: readonly PageFactEvidenceReference[];
  request: BoundedStorefrontSynthesisRequest;
  selectionNarrowing?: BoundedStorefrontSynthesisSelectionNarrowing;
  pageBlueprintSelectionOverrides?: WholeStorefrontGenerationPlan["pageBlueprintSelectionOverrides"];
  dynamicCommerceSelection?: DynamicCommerceDesignSelection;
  promptedExecutionAuthority?: NonNullable<
    BoundedStorefrontSynthesisDecision["promptedExecutionAuthority"]
  >;
}>;

export type BoundedStorefrontSynthesisExecutionInput = BoundedStorefrontSynthesisInput &
  Readonly<{
    decision: BoundedStorefrontSynthesisDecision;
    pageEvidenceAuthority: PageFactEvidenceAuthority;
    contentFactAuthority: ContentSupportFactAuthority;
    approvedAssetPresentations: readonly ApprovedAssetPresentation[];
  }>;

export type BoundedStorefrontSynthesisResult = Readonly<{
  decision: BoundedStorefrontSynthesisDecision;
  materialization: CompleteStorefrontMaterialization;
}>;

function fail(
  code: ConstructorParameters<typeof BoundedStorefrontSynthesisError>[0],
  message: string,
  cause?: unknown,
): never {
  throw new BoundedStorefrontSynthesisError(code, message, cause ? { cause } : undefined);
}

function hasConfigurableProducts(input: WholeStorefrontPlanningInput): boolean {
  return input.catalogue.products.some((product) => (product.orderOptions?.length ?? 0) > 0);
}

function selectionFor(
  input: BoundedStorefrontSynthesisInput,
  request: BoundedStorefrontSynthesisRequest,
): Selection {
  if (input.selectionNarrowing) {
    const narrowing = boundedStorefrontSynthesisSelectionNarrowingSchema.safeParse(
      input.selectionNarrowing,
    );
    if (!narrowing.success) {
      fail("unsupported-constraint", "The governed synthesis narrowing is invalid.");
    }
    try {
      validateDirectionSelectionNarrowing(narrowing.data);
    } catch (error) {
      fail(
        "unsupported-constraint",
        "The governed synthesis narrowing is stale or unsupported.",
        error,
      );
    }
    return {
      directionId: narrowing.data.directionId,
      homepageProfileId: narrowing.data.homepageProfileId,
      collectionProfileId: narrowing.data.collectionProfileId,
      searchProfileId: narrowing.data.searchProfileId,
      pdpProfileId: narrowing.data.pdpProfileId,
      narrativePosture: narrowing.data.narrativePosture,
      merchandisingPosture: narrowing.data.merchandisingPosture,
      densityPosture: narrowing.data.informationDensityPosture,
      artDirectionPosture: narrowing.data.artDirectionPosture,
      responsiveMode: narrowing.data.responsiveMode,
      decisions: [
        {
          code: "governed-selection-narrowing",
          outcome: narrowing.data.selectionId,
          authorityReferences: [
            `authority:${narrowing.data.authorityId}`,
            `version:${narrowing.data.authorityVersion}`,
            `fingerprint:${narrowing.data.authorityFingerprint}`,
            `request:${request.intent}`,
          ],
        },
      ],
    };
  }
  if (request.intent === "prompted-design-v2") {
    fail(
      "unsupported-constraint",
      "Prompted Design Intent V2 requires one exact governed synthesis narrowing.",
    );
  }
  const productCount = input.planningInput.catalogue.products.length;
  const configurable = hasConfigurableProducts(input.planningInput);
  const chosen = (
    selection: Omit<Selection, "decisions">,
    decisions: BoundedStorefrontSynthesisDecision["decisions"],
  ): Selection => ({ ...selection, decisions });
  const authorityReferences = [
    `request:${request.intent}`,
    `catalogue-products:${productCount}`,
    `configurable-products:${String(configurable)}`,
  ];

  if (request.intent === "editorial-led" || request.intent === "stronger-brand-storytelling") {
    return chosen(
      {
        directionId: "premiumEditorial",
        homepageProfileId: "homepage-editorial-storytelling",
        collectionProfileId: "collection-editorial-discovery",
        searchProfileId: "collection-dense-search",
        pdpProfileId: "pdp-high-consideration",
        narrativePosture: "story-led",
        merchandisingPosture: "curated",
        densityPosture: "airy",
        artDirectionPosture: "immersive",
        responsiveMode: "content-first",
      },
      [
        {
          code: "story-authority-selected",
          outcome: "editorial homepage and considered PDP",
          authorityReferences,
        },
      ],
    );
  }
  if (request.intent === "restrained-minimal") {
    return chosen(
      {
        directionId: "warmApproachable",
        homepageProfileId: "homepage-minimal-brand-commerce",
        collectionProfileId: "collection-editorial-discovery",
        searchProfileId: "collection-dense-search",
        pdpProfileId: "pdp-standard-commerce",
        narrativePosture: "restrained",
        merchandisingPosture: "restrained",
        densityPosture: "balanced",
        artDirectionPosture: "contained",
        responsiveMode: "balanced",
      },
      [
        {
          code: "restrained-authority-selected",
          outcome: "minimal homepage and standard commerce progression",
          authorityReferences,
        },
      ],
    );
  }
  if (request.intent === "campaign-emphasis") {
    const hasEditorialMedia = input.planningInput.approvedAssetContext?.assets.some(
      (asset) => asset.role === "editorialImage",
    );
    if (!hasEditorialMedia) {
      fail(
        "missing-approved-evidence",
        "Campaign emphasis requires current approved editorial media.",
      );
    }
    return chosen(
      {
        directionId: "premiumEditorial",
        homepageProfileId: "homepage-campaign-led",
        collectionProfileId: "collection-campaign-led-discovery",
        searchProfileId: "collection-dense-search",
        pdpProfileId: "pdp-high-consideration",
        narrativePosture: "campaign-led",
        merchandisingPosture: "campaign",
        densityPosture: "airy",
        artDirectionPosture: "immersive",
        responsiveMode: "content-first",
      },
      [
        {
          code: "campaign-authority-selected",
          outcome: "approved-media campaign profiles",
          authorityReferences: [...authorityReferences, "asset-role:editorialImage"],
        },
      ],
    );
  }

  const denseRequested = request.intent === "dense-catalogue";
  const densityAvailable = productCount >= 8;
  const collectionProfileId =
    denseRequested && densityAvailable
      ? "collection-dense-search"
      : "collection-editorial-discovery";
  const narrowed = denseRequested && !densityAvailable;
  return chosen(
    {
      directionId: "warmApproachable",
      homepageProfileId: "homepage-high-consideration",
      collectionProfileId,
      searchProfileId: "collection-dense-search",
      pdpProfileId: configurable ? "pdp-high-consideration" : "pdp-standard-commerce",
      narrativePosture:
        request.intent === "high-consideration"
          ? "considered-purchase"
          : denseRequested && densityAvailable
            ? "catalogue-dense"
            : "discovery-led",
      merchandisingPosture:
        denseRequested && densityAvailable
          ? "dense"
          : request.intent === "high-consideration"
            ? "considered"
            : "discovery",
      densityPosture: denseRequested && densityAvailable ? "compact" : "balanced",
      artDirectionPosture: "editorial",
      responsiveMode: denseRequested && densityAvailable ? "commerce-first" : "balanced",
    },
    [
      {
        code: narrowed ? "dense-request-narrowed" : "commerce-authority-selected",
        outcome: narrowed
          ? "catalogue is too small for dense collection composition; discovery profile selected"
          : configurable
            ? "discovery profile and considered configurable-product path"
            : "discovery profile and standard product path",
        authorityReferences,
      },
    ],
  );
}

function selectedSiteMap(
  input: StorefrontSiteMapDecision,
  selection: Selection,
  includedOptionalPageFamilyIds?: readonly string[],
): StorefrontSiteMapDecision {
  const includedOptionalFamilies = new Set(includedOptionalPageFamilyIds ?? []);
  return {
    ...structuredClone(input),
    pages: input.pages
      .filter(
        (page) =>
          includedOptionalPageFamilyIds === undefined ||
          page.required ||
          includedOptionalFamilies.has(page.familyId),
      )
      .map((page) => {
        const profileId =
          page.familyId === "home"
            ? selection.homepageProfileId
            : page.familyId === "collection"
              ? selection.collectionProfileId
              : page.familyId === "search-results"
                ? selection.searchProfileId
                : page.familyId === "product-detail"
                  ? selection.pdpProfileId
                  : page.profile.id;
        return { ...structuredClone(page), profile: { ...page.profile, id: profileId } };
      }),
  };
}

function profileCompatibility(profileId: string): readonly CommercialSharedFrameProfileId[] {
  const profile = getExecutablePageBlueprintProfile(profileId)?.profile;
  if (!profile) fail("stale-authority", `PageBlueprint profile ${profileId} is unavailable.`);
  return (
    profile.commercialHomepage?.compatibleSharedFrameProfileIds ??
    profile.commercialProductDetail?.compatibleSharedFrameProfileIds ??
    profile.commercialCollectionSearch?.compatibleSharedFrameProfileIds ??
    profile.commercialContentSupport?.compatibleSharedFrameProfileIds ??
    profile.commercialUtility?.compatibleSharedFrameProfileIds ??
    commercialSharedFrameProfileIds
  );
}

function selectSharedFrame(
  decision: StorefrontSiteMapDecision,
  preferred: readonly CommercialSharedFrameProfileId[],
): CommercialSharedFrameProfileId {
  const compatible = commercialSharedFrameProfileIds.filter((frameId) =>
    decision.pages.every((page) => profileCompatibility(page.profile.id).includes(frameId)),
  );
  const selected = preferred.find((frameId) => compatible.includes(frameId)) ?? compatible[0];
  if (!selected) {
    fail(
      "incompatible-frame-profile",
      "No registered shared-frame profile is compatible with the selected complete page set.",
    );
  }
  return selected;
}

function preferredFrames(selection: Selection): readonly CommercialSharedFrameProfileId[] {
  if (selection.directionId === "premiumEditorial") {
    return ["editorial-masthead", "centered-minimal"];
  }
  if (selection.densityPosture === "compact") {
    return ["compact-technical", "commerce-utility", "centered-minimal"];
  }
  return ["centered-minimal", "commerce-utility", "editorial-masthead"];
}

function selectedFrame(
  siteMap: StorefrontSiteMapDecision,
  selection: Selection,
  narrowing: BoundedStorefrontSynthesisSelectionNarrowing | undefined,
): CommercialSharedFrameProfileId {
  if (!narrowing) return selectSharedFrame(siteMap, preferredFrames(selection));
  const resolved = selectSharedFrame(siteMap, [narrowing.sharedFrameProfileId]);
  if (resolved !== narrowing.sharedFrameProfileId) {
    fail(
      "incompatible-frame-profile",
      `The governed frame ${narrowing.sharedFrameProfileId} is incompatible with the selected complete page set.`,
    );
  }
  return resolved;
}

function approvedEvidenceRevisions(input: BoundedStorefrontSynthesisInput) {
  const approved = new Map(
    input.approvedEvidenceReferences.map((reference) => [
      `${reference.source}:${reference.authorityId}:${reference.revision}`,
      reference,
    ]),
  );
  for (const page of input.siteMapDecision.pages.filter(({ required }) => required)) {
    for (const reference of page.evidenceReferences) {
      const key = `${reference.source}:${reference.authorityId}:${reference.revision}`;
      const current = approved.get(key);
      if (!current || current.status !== "approved") {
        fail(
          "missing-approved-evidence",
          `Page ${page.key} references evidence that is not in the current approved revision set.`,
        );
      }
    }
  }
  return [...approved.values()]
    .map(({ source, authorityId, revision }) => ({ source, authorityId, revision }))
    .sort((left, right) =>
      `${left.source}:${left.authorityId}:${left.revision}`.localeCompare(
        `${right.source}:${right.authorityId}:${right.revision}`,
      ),
    );
}

function evidenceAwareSiteMap(input: BoundedStorefrontSynthesisInput): {
  siteMap: StorefrontSiteMapDecision;
  omittedPageKeys: string[];
} {
  const approved = new Set(
    input.approvedEvidenceReferences
      .filter(({ status }) => status === "approved")
      .map(({ source, authorityId, revision }) => `${source}:${authorityId}:${revision}`),
  );
  const omittedPageKeys: string[] = [];
  const pages = input.siteMapDecision.pages.filter((page) => {
    const satisfied = page.evidenceReferences.every((reference) =>
      approved.has(`${reference.source}:${reference.authorityId}:${reference.revision}`),
    );
    if (satisfied) return true;
    if (page.required) {
      fail(
        "missing-approved-evidence",
        `Required page ${page.key} does not have current approved evidence.`,
      );
    }
    omittedPageKeys.push(page.key);
    return false;
  });
  return {
    siteMap: { ...structuredClone(input.siteMapDecision), pages },
    omittedPageKeys,
  };
}

function pageTypeForFamily(
  familyId: string,
): WholeStorefrontGenerationPlan["pageBlueprintSelectionOverrides"][number]["pageType"] | null {
  if (familyId === "home") return "home";
  if (familyId === "collection") return "collection";
  if (familyId === "product-detail") return "product";
  return null;
}

function normalizePageBlueprintSelectionOverrides(
  input: BoundedStorefrontSynthesisInput,
  selection: Selection,
  siteMap: StorefrontSiteMapDecision,
): WholeStorefrontGenerationPlan["pageBlueprintSelectionOverrides"] {
  const parsed = wholeStorefrontPageBlueprintSelectionOverridesSchema.safeParse(
    input.pageBlueprintSelectionOverrides ?? [],
  );
  if (!parsed.success) {
    fail(
      "invalid-bounded-override",
      "Exact PageBlueprint selections do not satisfy the canonical execution contract.",
      parsed.error,
    );
  }
  const expectedProfiles = {
    home: selection.homepageProfileId,
    collection: selection.collectionProfileId,
    product: selection.pdpProfileId,
  } as const;
  const availablePageTypes = new Set(
    siteMap.pages
      .map(({ familyId }) => pageTypeForFamily(familyId))
      .filter((pageType): pageType is "home" | "collection" | "product" => pageType !== null),
  );
  const normalized = [...parsed.data]
    .sort((left, right) => left.pageType.localeCompare(right.pageType))
    .map((entry) => {
      if (
        entry.profileId !== expectedProfiles[entry.pageType] ||
        !availablePageTypes.has(entry.pageType)
      ) {
        fail(
          "invalid-bounded-override",
          `Exact ${entry.pageType} PageBlueprint selection does not target the selected current profile.`,
        );
      }
      return {
        ...structuredClone(entry),
        slotSelections: [...entry.slotSelections].sort((left, right) =>
          left.slotId.localeCompare(right.slotId),
        ),
      };
    });
  return wholeStorefrontPageBlueprintSelectionOverridesSchema.parse(normalized);
}

function normalizeDynamicCommerceSelection(input: BoundedStorefrontSynthesisInput): Readonly<{
  selection: DynamicCommerceDesignSelection | null;
  authorityFingerprint: string | null;
  selectionFingerprint: string | null;
}> {
  if (input.dynamicCommerceSelection === undefined) {
    return { selection: null, authorityFingerprint: null, selectionFingerprint: null };
  }
  const parsed = dynamicCommerceDesignSelectionSchema.safeParse(input.dynamicCommerceSelection);
  if (!parsed.success) {
    fail(
      "invalid-bounded-override",
      "Exact dynamic-commerce selection does not satisfy its canonical execution contract.",
      parsed.error,
    );
  }
  const currentAuthority = input.planningInput.draft.dynamicCommercePresentation;
  if (
    !currentAuthority ||
    currentAuthority.authorityFingerprint !== parsed.data.authorityFingerprint
  ) {
    fail(
      "stale-authority",
      "Exact dynamic-commerce selection does not target the current draft authority.",
    );
  }
  const normalizedSelection = dynamicCommerceDesignSelectionSchema.parse({
    ...parsed.data,
    productTypeMappings: Object.fromEntries(
      Object.entries(parsed.data.productTypeMappings).sort(([left], [right]) =>
        left.localeCompare(right),
      ),
    ),
  });
  try {
    const selection = validateDynamicCommerceDesignSelection(
      input.planningInput.draft,
      input.planningInput.catalogue,
      normalizedSelection,
    );
    return {
      selection,
      authorityFingerprint: currentAuthority.authorityFingerprint,
      selectionFingerprint: `bounded-dynamic-commerce-selection-${canonicalValueFingerprint(
        selection,
      )}`,
    };
  } catch (error) {
    fail(
      "invalid-bounded-override",
      "Exact dynamic-commerce selection is not executable against current authority.",
      error,
    );
  }
}

function profileMaterial(
  siteMap: StorefrontSiteMapDecision,
  input: WholeStorefrontPlanningInput,
  pageBlueprintSelectionOverrides: WholeStorefrontGenerationPlan["pageBlueprintSelectionOverrides"],
) {
  const pageProfileSelections: BoundedStorefrontSynthesisDecision["pageProfileSelections"] = [];
  const componentChoices: BoundedStorefrontSynthesisDecision["componentChoices"] = [];
  const pageContributions: BoundedStorefrontSynthesisDecision["narrative"]["pageContributions"] =
    [];
  const selectedDesignScopes = new Set<string>();
  for (const page of siteMap.pages) {
    const plan = getExecutablePageBlueprintProfile(page.profile.id);
    if (!plan?.profile || plan.profile.version !== page.profile.version) {
      fail("stale-authority", `Page ${page.key} has a stale PageBlueprint profile reference.`);
    }
    // Dynamic routes share one compact archetype authority. Validate and project each exact
    // profile only once instead of repeatedly materializing identical per-route metadata.
    const dynamicFamily = ["collection", "search-results", "product-detail"].includes(
      page.familyId,
    );
    const designScopeKey = dynamicFamily
      ? `dynamic:${page.familyId}:${plan.profile.id}:${plan.profile.version}`
      : `static:${page.key}`;
    if (selectedDesignScopes.has(designScopeKey)) continue;
    selectedDesignScopes.add(designScopeKey);
    const availableAssetRoles = new Set(
      input.approvedAssetContext?.assets.map(({ role }) => role) ?? [],
    );
    for (const requiredRole of plan.profile.requiredAssetRoles) {
      if (!availableAssetRoles.has(requiredRole)) {
        fail(
          "missing-approved-evidence",
          `Page ${page.key} requires approved asset role ${requiredRole}.`,
        );
      }
    }
    const roles = plan.slots.map((slot) => slot.narrativeRole);
    if (roles.some((role) => role === undefined)) {
      fail("unsupported-narrative-role", `Page ${page.key} has an unsupported narrative role.`);
    }

    const pageType = pageTypeForFamily(page.familyId);
    const selectionOverride = pageType
      ? pageBlueprintSelectionOverrides.find((entry) => entry.pageType === pageType)
      : undefined;
    if (selectionOverride && selectionOverride.profileId !== plan.profile.id) {
      fail(
        "invalid-bounded-override",
        `Exact ${pageType} PageBlueprint selection no longer targets ${plan.profile.id}.`,
      );
    }
    let materialization: ReturnType<typeof materializeExecutablePageBlueprint>;
    try {
      materialization = materializeExecutablePageBlueprint({
        pagePlan: plan,
        componentDefinitions: input.componentDefinitions,
        availableBindingCategories: plan.profile.requiredBindingCategories,
        ...(selectionOverride ? { slotSelectionOverrides: selectionOverride.slotSelections } : {}),
      });
    } catch (error) {
      fail(
        "invalid-bounded-override",
        `Exact PageBlueprint selection for ${plan.profile.id} is not executable.`,
        error,
      );
    }

    // Collection, search and PDP routes are runtime instances of compact root
    // archetypes. They remain distinct in the site-map/route inventory, but one
    // route must not count as one independently designed profile or component
    // anatomy. Static pages retain their page-specific design scope.
    const designPageKey = dynamicFamily
      ? `archetype_${page.familyId.replaceAll("-", "_")}_${plan.profile.id.replaceAll("-", "_")}`
      : page.key;
    pageProfileSelections.push({
      pageKey: designPageKey,
      familyId: page.familyId,
      profileId: plan.profile.id,
      profileVersion: plan.profile.version,
      profileFingerprint: materialization.fingerprint,
      narrativeRoles: [...materialization.roleOrder],
    });
    pageContributions.push({ pageKey: designPageKey, roles: [...materialization.roleOrder] });
    for (const slot of materialization.slots) {
      const definition = input.componentDefinitions.find(
        (candidate) => candidate.type === slot.component,
      );
      if (!definition || !definition.variants.some(({ id }) => id === slot.variant)) {
        fail(
          "invalid-component-capability",
          `Page ${page.key} selects unavailable ${slot.component}/${slot.variant}.`,
        );
      }
      const anatomyId =
        plan.profile.commercialHomepage?.productCardAnatomyId ??
        plan.profile.commercialCollectionSearch?.productCardAnatomyId ??
        plan.profile.commercialProductDetail?.relatedProductCardAnatomyId ??
        null;
      componentChoices.push({
        pageKey: designPageKey,
        slotId: slot.slotId,
        component: slot.component,
        variant: slot.variant,
        anatomyId,
        capabilityFingerprint: `component-capability-${canonicalValueFingerprint(definition)}`,
      });
    }
  }
  return { pageProfileSelections, componentChoices, pageContributions };
}

function validateNarrative(
  siteMap: StorefrontSiteMapDecision,
  pageContributions: BoundedStorefrontSynthesisDecision["narrative"]["pageContributions"],
) {
  for (const page of pageContributions) {
    for (let index = 2; index < page.roles.length; index += 1) {
      if (
        page.roles[index] === page.roles[index - 1] &&
        page.roles[index] === page.roles[index - 2]
      ) {
        fail(
          "impossible-required-role",
          `Page ${page.pageKey} repeats the same narrative role three times consecutively.`,
        );
      }
    }
  }
  const roles = pageContributions.flatMap(({ roles: values }) => values);
  const hasCatalogue = siteMap.pages.some(({ familyId }) =>
    ["collection", "search-results"].includes(familyId),
  );
  const discoveryPath = roles.some((role) =>
    ["primary-discovery", "secondary-discovery", "orientation"].includes(role),
  );
  const conversionPath = roles.includes("conversion") || roles.includes("product-focus");
  if (hasCatalogue && !discoveryPath) {
    fail("impossible-required-role", "The selected catalogue page set has no discovery path.");
  }
  if (!conversionPath) {
    fail("impossible-required-role", "The selected storefront has no bounded conversion path.");
  }
  const roleSequence = roles.filter((role, index) => role !== roles[index - 1]);
  return { roleSequence, discoveryPath, conversionPath };
}

function boundedParameters(
  selection: Selection,
  frameId: CommercialSharedFrameProfileId,
): Record<string, string | number | boolean> {
  const collection = getCommercialCollectionSearchProfile(selection.collectionProfileId)?.profile
    ?.commercialCollectionSearch;
  const homepage = getCommercialHomepageProfile(selection.homepageProfileId)?.profile
    ?.commercialHomepage;
  const pdp = getCommercialPdpProfile(selection.pdpProfileId)?.profile?.commercialProductDetail;
  if (!collection || !homepage || !pdp) {
    fail("stale-authority", "Selected commercial profile authority is unavailable.");
  }
  return {
    "frame.profile": frameId,
    "homepage.merchandising": homepage.merchandisingEmphasis,
    "homepage.productCardAnatomy": homepage.productCardAnatomyId,
    "collection.gridDensity": collection.gridDensity,
    "collection.filterLayout": collection.filterLayout,
    "collection.productCardAnatomy": collection.productCardAnatomyId,
    "pdp.presentation": pdp.presentation,
    "pdp.relatedProductCardAnatomy": pdp.relatedProductCardAnatomyId,
  };
}

export function createBoundedStorefrontSynthesisDecision(
  inputValue: BoundedStorefrontSynthesisInput,
): BoundedStorefrontSynthesisDecision {
  const request = boundedStorefrontSynthesisRequestSchema.safeParse(inputValue.request);
  if (!request.success) fail("invalid-request", "The bounded synthesis request is invalid.");
  const input = { ...inputValue, request: request.data };
  const target = createWholeStorefrontGenerationTarget(input.planningInput);
  const selection = selectionFor(input, request.data);
  const evidenceAware = evidenceAwareSiteMap(input);
  const siteMap = selectedSiteMap(
    evidenceAware.siteMap,
    selection,
    input.selectionNarrowing?.includedOptionalPageFamilyIds,
  );
  const directionOmittedPageKeys = evidenceAware.siteMap.pages
    .filter((page) => !siteMap.pages.some(({ key }) => key === page.key))
    .map(({ key }) => key);
  const frameId = selectedFrame(siteMap, selection, input.selectionNarrowing);
  const frame = getCommercialSharedFrameProfile(frameId);
  const pageBlueprintSelectionOverrides = normalizePageBlueprintSelectionOverrides(
    input,
    selection,
    siteMap,
  );
  const dynamicCommerce = normalizeDynamicCommerceSelection(input);
  const profileAuthority = profileMaterial(
    siteMap,
    input.planningInput,
    pageBlueprintSelectionOverrides,
  );
  const narrativePaths = validateNarrative(siteMap, profileAuthority.pageContributions);
  const brandSystem = registeredBrandSystemForDirection(
    input.planningInput.draft.brandSystem,
    input.planningInput.recipeContext.designSystem,
    selection.directionId,
    input.selectionNarrowing
      ? {
          spacingDensity: input.selectionNarrowing.designSystemSpacingDensity,
          surfaceDepth: input.selectionNarrowing.designSystemSurfaceDepth,
        }
      : undefined,
  );
  const selectedDirection = input.planningInput.recipeContext.designSystem.directions.find(
    ({ id }) => id === selection.directionId,
  );
  if (!selectedDirection) fail("stale-authority", "Selected Design DNA authority is unavailable.");
  const material = {
    contractVersion: BOUNDED_STOREFRONT_SYNTHESIS_CONTRACT_VERSION,
    request: request.data,
    merchantContextFingerprint: `merchant-context-${canonicalValueFingerprint({
      project: input.planningInput.project,
      briefId: input.planningInput.brief.id,
      briefRevision: input.planningInput.brief.revision,
      approvedEvidenceFingerprint: input.planningInput.brief.approvedEvidenceFingerprint,
    })}`,
    approvedEvidenceRevisions: approvedEvidenceRevisions(input),
    commerceContextFingerprint: target.canonicalCommerceFingerprint,
    assetAuthorityFingerprint: input.planningInput.approvedAssetContext?.fingerprint ?? null,
    designDna: {
      directionId: selection.directionId,
      spacingDensity:
        input.selectionNarrowing?.designSystemSpacingDensity ?? selectedDirection.spacingDensity,
      surfaceDepth:
        input.selectionNarrowing?.designSystemSurfaceDepth ?? selectedDirection.surfaceDepth,
      fingerprint: `design-dna-${canonicalValueFingerprint(brandSystem.designDna)}`,
    },
    siteMap: {
      fingerprint: `site-map-decision-${canonicalValueFingerprint(siteMap)}`,
      pageSetFingerprint: `page-set-${canonicalValueFingerprint(
        siteMap.pages.map(({ key, familyId, route, profile }) => ({
          key,
          familyId,
          route,
          profile,
        })),
      )}`,
      pageKeys: siteMap.pages.map(({ key }) => key),
    },
    sharedFrame: {
      profileId: frame.id,
      profileVersion: frame.version,
      authorityFingerprint: frame.authorityFingerprint,
    },
    commercialProfiles: {
      homepageProfileId: selection.homepageProfileId,
      collectionProfileId: selection.collectionProfileId,
      searchProfileId: selection.searchProfileId,
      pdpProfileId: selection.pdpProfileId,
    },
    pageProfileSelections: profileAuthority.pageProfileSelections,
    narrative: {
      posture: selection.narrativePosture,
      roleSequence: narrativePaths.roleSequence,
      pageContributions: profileAuthority.pageContributions,
      discoveryPath: narrativePaths.discoveryPath,
      conversionPath: narrativePaths.conversionPath,
    },
    merchandisingPosture: selection.merchandisingPosture,
    informationDensityPosture: selection.densityPosture,
    artDirectionPosture: selection.artDirectionPosture,
    componentChoices: profileAuthority.componentChoices,
    pageBlueprintSelectionOverrides,
    dynamicCommerceSelection: dynamicCommerce.selection,
    exactSelectionAuthority: {
      pageBlueprintSelectionFingerprint: `bounded-page-blueprint-selections-${canonicalValueFingerprint(
        pageBlueprintSelectionOverrides,
      )}`,
      dynamicCommerceAuthorityFingerprint: dynamicCommerce.authorityFingerprint,
      dynamicCommerceSelectionFingerprint: dynamicCommerce.selectionFingerprint,
    },
    boundedParameters: boundedParameters(selection, frame.id),
    evidenceComposition: {
      requiredPageKeys: siteMap.pages.filter(({ required }) => required).map(({ key }) => key),
      optionalPageKeys: siteMap.pages.filter(({ required }) => !required).map(({ key }) => key),
      omittedPageKeys: [...evidenceAware.omittedPageKeys, ...directionOmittedPageKeys],
    },
    responsivePosture: {
      breakpoints: [375, 768, 1024, 1440] as [375, 768, 1024, 1440],
      mode: selection.responsiveMode,
    },
    promptedExecutionAuthority: input.promptedExecutionAuthority
      ? structuredClone(input.promptedExecutionAuthority)
      : null,
    currentAuthority: {
      wholeStorefrontTargetFingerprint: target.fingerprint,
      componentRegistryFingerprint: target.registryFingerprint,
      recipeContextFingerprint: target.recipeFingerprint,
    },
    decisions: selection.decisions,
  };
  return boundedStorefrontSynthesisDecisionSchema.parse({
    ...material,
    synthesisFingerprint: `bounded-storefront-synthesis-${canonicalValueFingerprint(material)}`,
  });
}

export function validateBoundedStorefrontSynthesisDecision(
  decisionValue: unknown,
  input: BoundedStorefrontSynthesisInput,
): BoundedStorefrontSynthesisDecision {
  const parsed = boundedStorefrontSynthesisDecisionSchema.safeParse(decisionValue);
  if (!parsed.success) {
    fail("stale-authority", "The bounded synthesis contract is invalid or stale.", parsed.error);
  }
  const expected = createBoundedStorefrontSynthesisDecision(input);
  if (canonicalValueString(parsed.data) !== canonicalValueString(expected)) {
    fail(
      "stale-authority",
      "The bounded synthesis decision does not match current canonical authority.",
    );
  }
  return parsed.data;
}

export function executeBoundedStorefrontSynthesis(
  input: BoundedStorefrontSynthesisExecutionInput,
): BoundedStorefrontSynthesisResult {
  const decision = validateBoundedStorefrontSynthesisDecision(input.decision, input);
  const planningInput = {
    ...structuredClone(input.planningInput),
    draft: applyCommercialSharedFrame(input.planningInput.draft, decision.sharedFrame.profileId),
  } satisfies WholeStorefrontPlanningInput;
  const selectedDecision = selectedSiteMap(input.siteMapDecision, {
    directionId: decision.designDna.directionId,
    ...decision.commercialProfiles,
    narrativePosture: decision.narrative.posture,
    merchandisingPosture: decision.merchandisingPosture,
    densityPosture: decision.informationDensityPosture,
    artDirectionPosture: decision.artDirectionPosture,
    responsiveMode: decision.responsivePosture.mode,
    decisions: decision.decisions,
  });
  const includedPageKeys = new Set(decision.siteMap.pageKeys);
  const siteMapDecision = {
    ...selectedDecision,
    pages: selectedDecision.pages.filter(({ key }) => includedPageKeys.has(key)),
  };
  const materialization = materializeCompleteStorefrontSelection({
    planningInput,
    siteMapDecision,
    pageEvidenceAuthority: input.pageEvidenceAuthority,
    contentFactAuthority: input.contentFactAuthority,
    approvedAssetPresentations: input.approvedAssetPresentations,
    directionId: decision.designDna.directionId,
    designSystemNarrowing: {
      spacingDensity: decision.designDna.spacingDensity,
      surfaceDepth: decision.designDna.surfaceDepth,
    },
    pageBlueprintSelectionOverrides: decision.pageBlueprintSelectionOverrides,
    ...(decision.dynamicCommerceSelection
      ? { dynamicCommerceSelection: decision.dynamicCommerceSelection }
      : {}),
    materializationIdPrefix: `p10b15_${decision.synthesisFingerprint.slice(-12)}`,
  });
  return Object.freeze({
    decision: structuredClone(decision),
    materialization,
  });
}
