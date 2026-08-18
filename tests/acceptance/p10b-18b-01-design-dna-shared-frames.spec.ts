import { expect, test, type TestInfo } from "@playwright/test";
import { resolveDynamicCommerceRoutePage } from "@/application/dynamic-commerce-routes";
import { executeCompiledSemanticStorefrontDesignIntentV1 } from "@/application/prompted-storefront-design-compiler";
import { catalogueDisplayModelSchema, type ProductDisplayModel } from "@/domain/catalogue";
import { designDnaFingerprint } from "@/domain/design-system";
import { projectSchema } from "@/domain/project";
import { resolveLocalizedText } from "@/domain/shared";
import {
  canonicalStorefrontContentFingerprint,
  canonicalValueFingerprint,
  canonicalValueString,
  getCommercialSharedFrameProfile,
  storefrontSnapshotSchema,
  type CommercialSharedFrameProfileId,
  type StorefrontSnapshot,
} from "@/domain/storefront";
import { validateProjectAggregate } from "@/services/storage/repository-validation";
import { semanticIntentFixture } from "../fixtures/p10b-16p-04-semantic-intent";
import {
  compileP10b18aAuditCase,
  p10b18aMaterializerDesignAuthorityFingerprint,
  p10b18aNormalizedDesignTopologyFingerprint,
  selectP10b18aAuditCase,
  type P10b18aCompiledAuditResult,
  type P10b18aSemanticVariation,
  type P10b18aShapeAuthority,
} from "../helpers/p10b-18a-commercial-authority";
import {
  initializeP10B18AStorage,
  installP10B18AOfflineAuthority,
  p10b18aOrigin,
  readP10B18AAggregate,
  seedP10B18AAggregate,
  type P10B18ALocale,
  type P10B18ARuntimeAuthority,
  type P10B18AStoreManifestEntry,
  type P10B18ASurface,
  type P10B18AWidth,
} from "./p10b-18a-browser-evidence";
import {
  captureP10B18B01Evidence,
  writeP10B18B01EvidenceManifest,
  type P10B18B01CaptureEvidence,
  type P10B18B01CaptureRole,
  type P10B18B01StorageEvidence,
  type P10B18B01StoreBinding,
} from "./p10b-18b-01-browser-evidence";

const directions = ["premiumEditorial", "modernTechnical", "warmApproachable"] as const;
type Direction = (typeof directions)[number];

const renderedGeometryBySpacingDensity = {
  compact: {
    sectionRhythm: "clamp(2.5rem, 5vw, 4rem)",
    pageGutter: "clamp(1rem, 3vw, 2rem)",
    gridGap: "0.75rem",
    cardInset: "0.75rem",
    controlHeight: "2.5rem",
    globalDensity: "0.86",
    navigationDensity: "0.86",
    contentDensity: "0.86",
    commerceDensity: "0.86",
  },
  standard: {
    sectionRhythm: "clamp(4rem, 8vw, 7rem)",
    pageGutter: "clamp(1rem, 5vw, 5rem)",
    gridGap: "1.5rem",
    cardInset: "1.25rem",
    controlHeight: "2.75rem",
    globalDensity: "1",
    navigationDensity: "1",
    contentDensity: "1",
    commerceDensity: "1",
  },
  spacious: {
    sectionRhythm: "clamp(5.5rem, 10vw, 9rem)",
    pageGutter: "clamp(1.25rem, 7vw, 7rem)",
    gridGap: "2.25rem",
    cardInset: "2rem",
    controlHeight: "3.25rem",
    globalDensity: "1.16",
    navigationDensity: "1.16",
    contentDensity: "1.16",
    commerceDensity: "1",
  },
} as const;

type CaseDefinition = Readonly<{
  key: string;
  role: P10B18B01StoreBinding["role"];
  shapeId: string;
  variationId: string;
  expectedDirection: Direction;
  expectedFrame: CommercialSharedFrameProfileId;
}>;

const caseDefinitions = [
  {
    key: "premium-primary",
    role: "primary",
    shapeId: "aurum-approved-presentation-image-rich",
    variationId: "premium-story-image",
    expectedDirection: "premiumEditorial",
    expectedFrame: "editorial-masthead",
  },
  {
    key: "premium-alternate-dna",
    role: "alternate-dna",
    shapeId: "aurum-approved-presentation-image-rich",
    variationId: "premium-product-restrained",
    expectedDirection: "premiumEditorial",
    expectedFrame: "editorial-masthead",
  },
  {
    key: "modern-primary",
    role: "primary",
    shapeId: "medium-mixed-jewellery",
    variationId: "technical-catalogue-dense",
    expectedDirection: "modernTechnical",
    expectedFrame: "compact-technical",
  },
  {
    key: "modern-alternate-dna",
    role: "alternate-dna",
    shapeId: "medium-mixed-jewellery",
    variationId: "technical-conversion-contained",
    expectedDirection: "modernTechnical",
    expectedFrame: "commerce-utility",
  },
  {
    key: "warm-primary",
    role: "primary",
    shapeId: "mixed-jewellery-watch",
    variationId: "minimal-product-first",
    expectedDirection: "warmApproachable",
    expectedFrame: "centered-minimal",
  },
  {
    key: "warm-alternate-dna",
    role: "alternate-dna",
    shapeId: "mixed-jewellery-watch",
    variationId: "minimal-story-airy",
    expectedDirection: "warmApproachable",
    expectedFrame: "editorial-masthead",
  },
  {
    key: "editorial-long-navigation",
    role: "long-navigation",
    shapeId: "medium-mixed-jewellery",
    variationId: "premium-story-image",
    expectedDirection: "premiumEditorial",
    expectedFrame: "editorial-masthead",
  },
] as const satisfies readonly CaseDefinition[];

type CompiledCase = Readonly<{
  definition: CaseDefinition;
  authority: P10b18aShapeAuthority;
  variation: P10b18aSemanticVariation;
  result: P10b18aCompiledAuditResult;
}>;

type MaterializedStore = Readonly<{
  compiled: CompiledCase;
  snapshot: StorefrontSnapshot;
  aggregate: ReturnType<typeof validateProjectAggregate>;
  binding: P10B18B01StoreBinding;
  collectionArchetype: string;
}>;

type CapturePlanEntry = Readonly<{
  storeKey: string;
  role: P10B18B01CaptureRole;
  surface: "home" | "collection";
  width: P10B18AWidth;
}>;

function requireDirection(value: string): Direction {
  if (!directions.includes(value as Direction)) {
    throw new Error(`P10B-18B-01 selected an out-of-scope direction: ${value}.`);
  }
  return value as Direction;
}

function requireLocale(value: string): P10B18ALocale {
  if (value !== "en" && value !== "fi") {
    throw new Error(`P10B-18B-01 selected an unsupported locale: ${value}.`);
  }
  return value;
}

function runtimeAuthority(authority: P10b18aShapeAuthority): P10B18ARuntimeAuthority {
  return authority.fixtureAuthority === "p10b16p04j-aurum-approved"
    ? "p04-integrated-mock"
    : "p03-standalone";
}

function compileCase(definition: CaseDefinition): CompiledCase {
  const { authority, variation } = selectP10b18aAuditCase(
    definition.shapeId,
    definition.variationId,
  );
  const result = compileP10b18aAuditCase(authority, variation);
  expect(requireDirection(result.compiledDecision.designDna.directionId)).toBe(
    definition.expectedDirection,
  );
  expect(result.compiledDecision.sharedFrame.profileId).toBe(definition.expectedFrame);
  return { definition, authority, variation, result };
}

function evidenceAggregate(authority: P10b18aShapeAuthority, candidate: StorefrontSnapshot) {
  const project = structuredClone(authority.aggregate.project);
  const draft = storefrontSnapshotSchema.parse({
    ...structuredClone(candidate),
    id: project.draftSnapshotId,
    projectId: project.id,
    catalogueRef: authority.catalogue.id,
    createdBy: "user",
  });
  const published = storefrontSnapshotSchema.parse({
    ...structuredClone(authority.currentRequestInput.draft),
    id: project.publishedSnapshotId,
    projectId: project.id,
    catalogueRef: authority.catalogue.id,
    createdBy: "system",
  });
  expect(canonicalStorefrontContentFingerprint(draft)).not.toBe(
    canonicalStorefrontContentFingerprint(published),
  );
  return validateProjectAggregate({
    project,
    catalogue: structuredClone(authority.catalogue),
    snapshots: [published, draft],
  });
}

function isConfigurable(product: ProductDisplayModel): boolean {
  return product.variants.length > 0 || (product.orderOptions?.length ?? 0) > 0;
}

function materializeStore(compiled: CompiledCase): MaterializedStore {
  const { definition, authority, variation, result } = compiled;
  const catalogueBefore = canonicalValueString(authority.catalogue);
  const commerceBefore = authority.commerceFingerprint;
  const mediaBefore = authority.mediaFingerprint;
  const providerIntent = semanticIntentFixture(authority.request, {
    designConceptSummary: `${authority.id}:${variation.id}`,
    ...variation.drivers,
  });
  const execution = executeCompiledSemanticStorefrontDesignIntentV1({
    originalRequest: authority.request,
    providerIntent,
    currentRequestInput: authority.currentRequestInput,
    compatibilityInput: authority.compatibilityInput,
    semanticCapabilityIndex: authority.semanticCapabilityIndex,
    preparedAuthority: authority.preparedAuthority,
    compiledDecision: result.compiledDecision,
    synthesisDecision: result.synthesisDecision,
    pageEvidenceAuthority: authority.pageEvidenceAuthority,
    contentFactAuthority: authority.contentFactAuthority,
    approvedAssetPresentations: authority.approvedAssetPresentations,
  });
  expect(canonicalValueString(authority.catalogue)).toBe(catalogueBefore);
  expect(authority.commerceFingerprint).toBe(commerceBefore);
  expect(authority.mediaFingerprint).toBe(mediaBefore);
  const aggregate = evidenceAggregate(authority, execution.synthesis.materialization.snapshot);
  const snapshot = aggregate.snapshots.find(({ id }) => id === aggregate.project.draftSnapshotId);
  if (!snapshot?.brandSystem.designDna) {
    throw new Error(`${definition.key} did not materialize canonical Design DNA.`);
  }
  const exactDesignDnaValueFingerprint = canonicalValueFingerprint(
    result.compiledDecision.designDna.value,
  );
  const exactCompiledDesignDnaFingerprint = `compiled-design-dna-${exactDesignDnaValueFingerprint}`;
  const synthesisDesignDnaFingerprint = `design-dna-${exactDesignDnaValueFingerprint}`;
  const rendererCssDesignDnaFingerprint = designDnaFingerprint(
    result.compiledDecision.designDna.value,
  );
  const materializedDesignDnaValueFingerprint = canonicalValueFingerprint(
    snapshot.brandSystem.designDna,
  );
  const materializedDesignDnaFingerprint = designDnaFingerprint(snapshot.brandSystem.designDna);
  expect(result.compiledDecision.designDna.authorityFingerprint).toBe(
    exactCompiledDesignDnaFingerprint,
  );
  expect(result.synthesisDecision.designDna.fingerprint).toBe(synthesisDesignDnaFingerprint);
  expect(materializedDesignDnaValueFingerprint).toBe(exactDesignDnaValueFingerprint);
  expect(materializedDesignDnaFingerprint).toBe(rendererCssDesignDnaFingerprint);
  expect(snapshot.sharedFrame?.profileId).toBe(definition.expectedFrame);

  const collectionRoute = authority.representativeRoutes.collection;
  const productRoute =
    authority.representativeRoutes.highConsiderationProduct ??
    authority.representativeRoutes.configurableProduct ??
    authority.representativeRoutes.simpleProduct;
  if (!collectionRoute || !productRoute) {
    throw new Error(`${definition.key} has no representative commerce routes.`);
  }
  const collectionResolution = resolveDynamicCommerceRoutePage({
    snapshot,
    catalogue: authority.catalogue,
    route: collectionRoute,
  });
  const productResolution = resolveDynamicCommerceRoutePage({
    snapshot,
    catalogue: authority.catalogue,
    route: productRoute,
  });
  const resolvedCollectionRoute = collectionResolution.route;
  const resolvedProductRoute = productResolution.route;
  if (resolvedCollectionRoute.kind !== "collection" || resolvedProductRoute.kind !== "product") {
    throw new Error(`${definition.key} representative route authority is stale.`);
  }
  const collection = authority.catalogue.collections.find(
    ({ id }) => id === resolvedCollectionRoute.collectionId,
  );
  const product = authority.catalogue.products.find(
    ({ id }) => id === resolvedProductRoute.productId,
  );
  if (!collection || !product) {
    throw new Error(`${definition.key} representative commerce is unavailable.`);
  }
  const dynamic = result.compiledDecision.dynamicCommerceSelection;
  const homepageProfileSelection = result.synthesisDecision.pageProfileSelections.find(
    ({ profileId }) => profileId === result.compiledDecision.profiles.homepage.profileId,
  );
  if (!homepageProfileSelection) {
    throw new Error(`${definition.key} lacks its exact homepage profile selection.`);
  }
  const selectedRuntimeAuthority = runtimeAuthority(authority);
  const locale = requireLocale(aggregate.project.primaryLocale);
  const frame = getCommercialSharedFrameProfile(definition.expectedFrame);
  const legacyManifest: P10B18AStoreManifestEntry = {
    caseId: `${authority.id}--${variation.id}`,
    fixtureAuthority: authority.fixtureAuthority,
    fixtureKind: authority.fixtureKind,
    fixtureSourceDraftId: authority.fixtureSetup.sourceDraftId,
    fixtureSourceDraftKind: authority.fixtureSetup.sourceDraftKind,
    runtimeAuthority: selectedRuntimeAuthority,
    projectId: aggregate.project.id,
    locale,
    shapeId: authority.id,
    directionId: definition.expectedDirection,
    semanticVariationId: variation.id,
    semanticIntentFingerprint: providerIntent.semanticIntentFingerprint,
    semanticDrivers: Object.fromEntries(
      Object.entries(variation.drivers).map(([key, value]) => [key, String(value)]),
    ),
    compiledDecisionFingerprint: result.compiledDecision.compiledDecisionFingerprint,
    compilerStructuralFingerprint: result.compiledDecision.structuralFingerprint,
    consumedAuthorityFingerprint: p10b18aMaterializerDesignAuthorityFingerprint(result),
    normalizedAuthorityTopologyFingerprint: p10b18aNormalizedDesignTopologyFingerprint(result),
    candidateSnapshotFingerprint: canonicalStorefrontContentFingerprint(snapshot),
    catalogueFingerprint: authority.catalogueFingerprint,
    approvedEvidenceFingerprint: authority.approvedEvidenceFingerprint,
    approvedAssetContextFingerprint: authority.approvedAssetContextFingerprint,
    approvedAssetPresentationFingerprint: authority.approvedAssetPresentationFingerprint,
    approvedAssetRoleSelections: result.synthesisDecision.approvedAssetRoleSelections.map(
      ({
        profileId,
        slotId,
        component,
        assetSlotId,
        role,
        assetId,
        assetRevision,
        materialFingerprint,
      }) => ({
        profileId,
        slotId,
        component,
        assetSlotId,
        role,
        assetId,
        assetRevision,
        materialFingerprint,
      }),
    ),
    commerceFingerprintBefore: authority.commerceFingerprint,
    commerceFingerprintAfter: authority.commerceFingerprint,
    mediaFingerprintBefore: authority.mediaFingerprint,
    mediaFingerprintAfter: authority.mediaFingerprint,
    frame: definition.expectedFrame,
    profiles: {
      homepage: result.compiledDecision.profiles.homepage.profileId,
      collection: result.compiledDecision.profiles.collection.profileId,
      search: result.compiledDecision.profiles.search.profileId,
      productDetail: result.compiledDecision.profiles.productDetail.profileId,
    },
    archetypes: {
      collection: dynamic.collectionArchetypeId,
      search: dynamic.searchArchetypeId,
      standardSimple: dynamic.standardSimpleArchetypeId,
      configurable: dynamic.configurableArchetypeId,
      galleryLed: dynamic.galleryLedArchetypeId,
      highConsideration: dynamic.highConsiderationArchetypeId,
      representativeCollection: collectionResolution.archetype.id,
      representativeProduct: productResolution.archetype.id,
    },
    componentVariants: result.synthesisDecision.componentChoices.map(
      ({ component, variant, anatomyId }) => ({ component, variant, anatomyId }),
    ),
    homepageComponentSequence: result.synthesisDecision.componentChoices
      .filter(({ pageKey }) => pageKey === homepageProfileSelection.pageKey)
      .map(({ slotId, component, variant }) => ({ slotId, component, variant })),
    selectionSummary: {
      designDnaFingerprints: {
        canonicalValue: exactDesignDnaValueFingerprint,
        compiledAuthority: exactCompiledDesignDnaFingerprint,
        synthesisAuthority: synthesisDesignDnaFingerprint,
        rendererCss: rendererCssDesignDnaFingerprint,
        materializedValue: materializedDesignDnaValueFingerprint,
        materializedRendererCss: materializedDesignDnaFingerprint,
      },
      boundedParameters: result.synthesisDecision.boundedParameters,
      semanticAcceptedPaths:
        result.compiledDecision.semanticResolution?.acceptedSemanticPaths ?? [],
      semanticSubstitutedPaths:
        result.compiledDecision.semanticResolution?.substitutedSemanticPaths ?? [],
    },
    representativeRoutes: { home: "/", collection: collectionRoute, productDetail: productRoute },
    representativeContext: {
      collectionId: collection.id,
      collectionProductCount: collection.productIds.length,
      productId: product.id,
      productType: product.productType,
      productConfigurable: isConfigurable(product),
    },
  };
  const binding: P10B18B01StoreBinding = {
    key: definition.key,
    role: definition.role,
    legacyManifest,
    fixtureAuthority: authority.fixtureAuthority,
    shapeId: authority.id,
    directionId: definition.expectedDirection,
    designSystemSpacingDensity: result.compiledDecision.exactSelection.designSystemSpacingDensity,
    semanticVariationId: variation.id,
    semanticIntentFingerprint: providerIntent.semanticIntentFingerprint,
    semanticDrivers: legacyManifest.semanticDrivers,
    compiledDecisionFingerprint: result.compiledDecision.compiledDecisionFingerprint,
    compilerStructuralFingerprint: result.compiledDecision.structuralFingerprint,
    exactCompiledDesignDnaFingerprint,
    compiledDesignDnaAuthorityFingerprint: exactCompiledDesignDnaFingerprint,
    materializedDesignDnaFingerprint,
    consumedAuthorityFingerprint: legacyManifest.consumedAuthorityFingerprint,
    normalizedAuthorityTopologyFingerprint: legacyManifest.normalizedAuthorityTopologyFingerprint,
    candidateSnapshotFingerprint: legacyManifest.candidateSnapshotFingerprint,
    commerceFingerprint: authority.commerceFingerprint,
    mediaFingerprint: authority.mediaFingerprint,
    frameAuthority: {
      profileId: frame.id,
      version: frame.version,
      authorityFingerprint: frame.authorityFingerprint,
      headerVariant: frame.headerVariant,
      mobileNavigationMode: frame.mobileNavigationMode,
      footerVariant: frame.footerVariant,
      footerComposition: frame.footerComposition,
      responsiveTransformationIds: frame.responsiveTransformationIds,
    },
    profiles: legacyManifest.profiles,
    runtimeAuthority: selectedRuntimeAuthority,
    projectId: aggregate.project.id,
    locale,
  };
  return {
    compiled,
    snapshot,
    aggregate,
    binding,
    collectionArchetype: collectionResolution.archetype.id,
  };
}

function capturePlan(): readonly CapturePlanEntry[] {
  const required = ["premium-primary", "modern-primary", "warm-primary"].flatMap((storeKey) =>
    (["home", "collection"] as const).flatMap((surface) =>
      ([375, 1440] as const).map((width) => ({
        storeKey,
        role: "required-direction-surface-width" as const,
        surface,
        width,
      })),
    ),
  );
  return [
    ...required,
    ...["premium-alternate-dna", "modern-alternate-dna", "warm-alternate-dna"].map((storeKey) => ({
      storeKey,
      role: "within-direction-alternate-dna" as const,
      surface: "home" as const,
      width: 1440 as const,
    })),
    ...([1024, 1440] as const).map((width) => ({
      storeKey: "editorial-long-navigation",
      role: "editorial-long-navigation" as const,
      surface: "home" as const,
      width,
    })),
  ];
}

function storedDraft(aggregate: ReturnType<typeof validateProjectAggregate>): StorefrontSnapshot {
  const draft = aggregate.snapshots.find(({ id }) => id === aggregate.project.draftSnapshotId);
  if (!draft) throw new Error("P10B-18B-01 stored aggregate has no current draft.");
  return draft;
}

function storedDesignDnaFingerprint(snapshot: StorefrontSnapshot): string {
  if (!snapshot.brandSystem.designDna) {
    throw new Error("P10B-18B-01 stored draft has no canonical Design DNA.");
  }
  return designDnaFingerprint(snapshot.brandSystem.designDna);
}

function captureFor(
  captures: readonly P10B18B01CaptureEvidence[],
  storeKey: string,
  surface: P10B18ASurface,
  viewport: P10B18AWidth,
): P10B18B01CaptureEvidence {
  const capture = captures.find(
    (candidate) =>
      candidate.storeKey === storeKey &&
      candidate.surface === surface &&
      candidate.viewport === viewport,
  );
  if (!capture) throw new Error(`Missing capture ${storeKey}:${surface}:${viewport}.`);
  return capture;
}

test.describe.configure({ timeout: 1_800_000 });

test("retains deterministic Design DNA and shared-frame evidence across seventeen focused captures", async ({
  browser,
  browserName,
}, testInfo: TestInfo) => {
  test.skip(browserName !== "chromium", "P10B-18B-01 retains one deterministic Chromium run.");
  const stores = caseDefinitions.map(compileCase).map(materializeStore);
  expect(stores).toHaveLength(7);
  expect(new Set(stores.map(({ binding }) => binding.fixtureAuthority))).toEqual(
    new Set(["karvonen-raw", "p10b16p04j-aurum-approved"]),
  );
  expect(new Set(stores.map(({ binding }) => binding.shapeId))).toEqual(
    new Set([
      "aurum-approved-presentation-image-rich",
      "medium-mixed-jewellery",
      "mixed-jewellery-watch",
    ]),
  );
  const plan = capturePlan();
  expect(plan).toHaveLength(17);
  const requiredMatrix = plan.filter(({ role }) => role === "required-direction-surface-width");
  expect(requiredMatrix).toHaveLength(12);

  const context = await browser.newContext({ baseURL: p10b18aOrigin() });
  const page = await context.newPage();
  const ledger = await installP10B18AOfflineAuthority(page);
  const captures: P10B18B01CaptureEvidence[] = [];
  const storage: P10B18B01StorageEvidence[] = [];
  try {
    for (const selectedRuntimeAuthority of ["p03-standalone", "p04-integrated-mock"] as const) {
      await initializeP10B18AStorage(page, selectedRuntimeAuthority);
      for (const store of stores.filter(
        ({ binding }) => binding.runtimeAuthority === selectedRuntimeAuthority,
      )) {
        const seeded = await seedP10B18AAggregate(page, store.aggregate, selectedRuntimeAuthority);
        const seededAggregate = validateProjectAggregate({
          project: projectSchema.parse(seeded.project),
          catalogue: catalogueDisplayModelSchema.parse(seeded.catalogue),
          snapshots: storefrontSnapshotSchema.array().parse(seeded.snapshots),
        });
        const persistedDraft = storedDraft(seededAggregate);
        expect(canonicalStorefrontContentFingerprint(persistedDraft)).toBe(
          store.binding.candidateSnapshotFingerprint,
        );
        expect(storedDesignDnaFingerprint(persistedDraft)).toBe(
          store.binding.materializedDesignDnaFingerprint,
        );
        expect(canonicalValueString(seededAggregate.catalogue)).toBe(
          canonicalValueString(store.aggregate.catalogue),
        );
        expect(seeded.staleProjectState).toEqual({
          history: 0,
          publicationOperations: 0,
          compiledPublicationArtifacts: 0,
          publishedStorefrontVersions: 0,
          activePublishedStorefrontPointer: 0,
        });
        for (const entry of plan.filter(({ storeKey }) => storeKey === store.binding.key)) {
          const route =
            entry.surface === "home"
              ? store.binding.legacyManifest.representativeRoutes.home
              : store.binding.legacyManifest.representativeRoutes.collection;
          captures.push(
            await captureP10B18B01Evidence({
              page,
              store: store.binding,
              snapshot: store.snapshot,
              captureRole: entry.role,
              surface: entry.surface,
              route,
              width: entry.width,
              profileOrArchetype:
                entry.surface === "home"
                  ? store.binding.profiles.homepage
                  : store.collectionArchetype,
            }),
          );
        }
        const retained = await readP10B18AAggregate(
          page,
          store.aggregate.project.id,
          store.aggregate.catalogue.id,
          selectedRuntimeAuthority,
        );
        const retainedAggregate = validateProjectAggregate({
          project: projectSchema.parse(retained.project),
          catalogue: catalogueDisplayModelSchema.parse(retained.catalogue),
          snapshots: storefrontSnapshotSchema.array().parse(retained.snapshots),
        });
        const reloadedDraft = storedDraft(retainedAggregate);
        expect(canonicalStorefrontContentFingerprint(reloadedDraft)).toBe(
          store.binding.candidateSnapshotFingerprint,
        );
        expect(storedDesignDnaFingerprint(reloadedDraft)).toBe(
          store.binding.materializedDesignDnaFingerprint,
        );
        expect(canonicalValueFingerprint(retainedAggregate.project)).toBe(
          canonicalValueFingerprint(store.aggregate.project),
        );
        expect(canonicalValueString(retainedAggregate.catalogue)).toBe(
          canonicalValueString(store.aggregate.catalogue),
        );
        expect(retained.staleProjectState).toEqual(seeded.staleProjectState);
        storage.push({
          storeKey: store.binding.key,
          persistedSnapshotFingerprint: canonicalStorefrontContentFingerprint(persistedDraft),
          persistedDesignDnaFingerprint: storedDesignDnaFingerprint(persistedDraft),
          reloadedSnapshotFingerprint: canonicalStorefrontContentFingerprint(reloadedDraft),
          reloadedDesignDnaFingerprint: storedDesignDnaFingerprint(reloadedDraft),
          commerceFingerprint: store.binding.commerceFingerprint,
          mediaFingerprint: store.binding.mediaFingerprint,
        });
      }
    }
  } finally {
    await context.close();
  }

  expect(captures).toHaveLength(17);
  expect(storage).toHaveLength(7);
  expect(new Set(captures.map(({ filename }) => filename)).size).toBe(17);
  expect(
    captures.flatMap(({ storeKey, surface, viewport, destructiveLinkLabels }) =>
      destructiveLinkLabels.map((label) => `${storeKey}:${surface}:${viewport}:${label}`),
    ),
  ).toEqual([]);
  const requiredKeys = requiredMatrix.map(({ storeKey, surface, width }) => {
    const store = stores.find(({ binding }) => binding.key === storeKey)!;
    return `${store.binding.directionId}:${surface}:${width}`;
  });
  expect(new Set(requiredKeys).size).toBe(12);

  const compactCaptures = captures.filter(({ frame }) => frame === "compact-technical");
  expect(new Set(compactCaptures.map(({ viewport }) => viewport))).toEqual(new Set([375, 1440]));
  expect(
    compactCaptures.every(
      ({ mobileNavigationMode, footerComposition }) =>
        mobileNavigationMode === "drawer" && footerComposition === "compact-commerce-legal",
    ),
  ).toBe(true);

  const utility = captureFor(captures, "modern-alternate-dna", "home", 1440);
  const utilityStore = stores.find(({ binding }) => binding.key === "modern-alternate-dna")!;
  expect(utility.footerComposition).toBe("service-navigation");
  expect(utility.footerHeight).toBeLessThanOrEqual(420);
  expect(utility.footerStorePageItemCount).toBe(utilityStore.snapshot.navigation.primary.length);
  expect(utility.footerInformationItemCount).toBe(utilityStore.snapshot.navigation.footer.length);

  const centered = captureFor(captures, "warm-primary", "home", 1440);
  expect(centered.frame).toBe("centered-minimal");
  expect(centered.footerComposition).toBe("navigation-columns");
  expect(centered.contentTransitionWidth).toBeGreaterThan(0);

  for (const surface of ["home", "collection"] as const) {
    for (const width of [375, 1440] as const) {
      const premium = captureFor(captures, "premium-primary", surface, width);
      expect(premium.frame).toBe("editorial-masthead");
      expect(premium.footerWordmarkLineCount).toBe(1);
      expect(premium.footerWordmarkOverflows).toBe(false);
    }
  }

  const longNavigationStore = stores.find(
    ({ binding }) => binding.key === "editorial-long-navigation",
  )!;
  expect(
    longNavigationStore.snapshot.navigation.primary.map(({ label }) =>
      resolveLocalizedText(
        label,
        longNavigationStore.binding.locale,
        longNavigationStore.binding.locale,
      ),
    ),
  ).toEqual(expect.arrayContaining([expect.stringMatching(/.{18,}/u)]));
  expect(longNavigationStore.snapshot.navigation.primary.length).toBeGreaterThanOrEqual(10);
  expect(
    longNavigationStore.snapshot.navigation.primary.reduce(
      (total, { label }) =>
        total +
        resolveLocalizedText(
          label,
          longNavigationStore.binding.locale,
          longNavigationStore.binding.locale,
        ).length,
      0,
    ),
  ).toBeGreaterThanOrEqual(70);
  for (const width of [1024, 1440] as const) {
    const longNavigation = captureFor(captures, "editorial-long-navigation", "home", width);
    expect(longNavigation.frame).toBe("editorial-masthead");
    expect(longNavigation.primaryNavigationMaxLineCount).toBe(1);
  }

  for (const [primaryKey, alternateKey] of [
    ["premium-primary", "premium-alternate-dna"],
    ["modern-primary", "modern-alternate-dna"],
    ["warm-primary", "warm-alternate-dna"],
  ] as const) {
    const primary = stores.find(({ binding }) => binding.key === primaryKey)!;
    const alternate = stores.find(({ binding }) => binding.key === alternateKey)!;
    expect(alternate.binding.shapeId).toBe(primary.binding.shapeId);
    expect(alternate.binding.directionId).toBe(primary.binding.directionId);
    if (primary.binding.directionId === "premiumEditorial") {
      expect(alternate.binding.profiles.homepage).toBe(primary.binding.profiles.homepage);
      expect(alternate.binding.legacyManifest.homepageComponentSequence).toEqual(
        primary.binding.legacyManifest.homepageComponentSequence,
      );
    } else {
      expect([primary.binding.profiles.homepage, alternate.binding.profiles.homepage]).toEqual(
        primary.binding.directionId === "modernTechnical"
          ? ["homepage-commerce-led-discovery", "homepage-collection-gateway"]
          : ["homepage-minimal-brand-commerce", "homepage-editorial-storytelling"],
      );
      expect(alternate.binding.profiles.homepage).not.toBe(primary.binding.profiles.homepage);
      expect(alternate.binding.legacyManifest.homepageComponentSequence).not.toEqual(
        primary.binding.legacyManifest.homepageComponentSequence,
      );
    }
    expect(alternate.binding.designSystemSpacingDensity).not.toBe(
      primary.binding.designSystemSpacingDensity,
    );
    expect(alternate.binding.commerceFingerprint).toBe(primary.binding.commerceFingerprint);
    expect(alternate.binding.mediaFingerprint).toBe(primary.binding.mediaFingerprint);
    expect(alternate.binding.exactCompiledDesignDnaFingerprint).not.toBe(
      primary.binding.exactCompiledDesignDnaFingerprint,
    );
    const primaryCapture = captureFor(captures, primaryKey, "home", 1440);
    const alternateCapture = captureFor(captures, alternateKey, "home", 1440);
    expect(primaryCapture.renderedGeometry).toEqual(
      renderedGeometryBySpacingDensity[primary.binding.designSystemSpacingDensity],
    );
    expect(alternateCapture.renderedGeometry).toEqual(
      renderedGeometryBySpacingDensity[alternate.binding.designSystemSpacingDensity],
    );
    expect(alternateCapture.renderedCssDesignDnaFingerprint).not.toBe(
      primaryCapture.renderedCssDesignDnaFingerprint,
    );
    expect(alternateCapture.renderedCssProjectionFingerprint).not.toBe(
      primaryCapture.renderedCssProjectionFingerprint,
    );
    if (primary.binding.directionId === "premiumEditorial") {
      expect(alternate.binding.frameAuthority.profileId).toBe(
        primary.binding.frameAuthority.profileId,
      );
      expect(alternate.binding.profiles).toEqual(primary.binding.profiles);
    }
  }

  expect(ledger).toEqual({
    external: [],
    provider: [],
    Vesko: [],
    generation: [],
    publication: [],
    runtimeErrors: [],
  });
  const manifestPath = await writeP10B18B01EvidenceManifest({
    stores: stores.map(({ binding }) => binding),
    captures,
    ledger,
    capturePlan: plan,
    storage,
  });
  await testInfo.attach("p10b-18b-01-design-dna-shared-frame-browser-manifest", {
    path: manifestPath,
    contentType: "application/json",
  });
});
