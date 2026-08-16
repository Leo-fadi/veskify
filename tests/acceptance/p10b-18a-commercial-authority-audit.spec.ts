import { expect, test, type Locator, type TestInfo } from "@playwright/test";
import { resolveDynamicCommerceRoutePage } from "@/application/dynamic-commerce-routes";
import { executeCompiledSemanticStorefrontDesignIntentV1 } from "@/application/prompted-storefront-design-compiler";
import { catalogueDisplayModelSchema, type ProductDisplayModel } from "@/domain/catalogue";
import { projectSchema } from "@/domain/project";
import {
  canonicalStorefrontContentFingerprint,
  canonicalValueFingerprint,
  canonicalValueString,
  storefrontSnapshotSchema,
  type StorefrontSnapshot,
} from "@/domain/storefront";
import { validateProjectAggregate } from "@/services/storage/repository-validation";
import {
  compileP10b18aAuditCase,
  createP10b18aShapeAuthorities,
  p10b18aMaterializerDesignAuthorityFingerprint,
  p10b18aNormalizedDesignTopology,
  p10b18aNormalizedDesignTopologyFingerprint,
  p10b18aSemanticVariations,
  type P10b18aCompiledAuditResult,
  type P10b18aSemanticVariation,
  type P10b18aShapeAuthority,
} from "../helpers/p10b-18a-commercial-authority";
import { semanticIntentFixture } from "../fixtures/p10b-16p-04-semantic-intent";
import {
  captureP10B18AEvidence,
  initializeP10B18AStorage,
  installP10B18AOfflineAuthority,
  p10b18aEvidenceDirectory,
  p10b18aOrigin,
  p10b18aWidths,
  readP10B18AAggregate,
  seedP10B18AAggregate,
  writeP10B18AEvidenceManifest,
  type P10B18AEvidenceEntry,
  type P10B18ALocale,
  type P10B18ARuntimeAuthority,
  type P10B18AStoreManifestEntry,
  type P10B18ASurface,
} from "./p10b-18a-browser-evidence";

const auditDirections = ["premiumEditorial", "modernTechnical", "warmApproachable"] as const;
type AuditDirection = (typeof auditDirections)[number];

type CompiledMatrixCase = Readonly<{
  caseId: string;
  authority: P10b18aShapeAuthority;
  variation: P10b18aSemanticVariation;
  result: P10b18aCompiledAuditResult;
  directionId: AuditDirection;
  consumedAuthorityFingerprint: string;
  normalizedTopologyFingerprint: string;
}>;

type MaterializedAuditStore = Readonly<{
  matrixCase: CompiledMatrixCase;
  snapshot: StorefrontSnapshot;
  aggregate: ReturnType<typeof validateProjectAggregate>;
  manifest: P10B18AStoreManifestEntry;
  routeAuthority: Readonly<{
    collectionProductCount: number;
    collectionArchetype: string;
    product: ProductDisplayModel;
    productArchetype: string;
  }>;
}>;

function requireDirection(value: string): AuditDirection {
  if (!auditDirections.includes(value as AuditDirection)) {
    throw new Error(`P10B-18A selected an out-of-scope direction: ${value}.`);
  }
  return value as AuditDirection;
}

function runtimeAuthority(authority: P10b18aShapeAuthority): P10B18ARuntimeAuthority {
  return authority.fixtureAuthority === "p10b16p04j-aurum-approved"
    ? "p04-integrated-mock"
    : "p03-standalone";
}

function requireLocale(value: string): P10B18ALocale {
  if (value !== "en" && value !== "fi") {
    throw new Error(`P10B-18A selected an unsupported primary locale: ${value}.`);
  }
  return value;
}

function compileAuditMatrix(): readonly CompiledMatrixCase[] {
  return createP10b18aShapeAuthorities().flatMap((authority) =>
    p10b18aSemanticVariations.map((variation) => {
      const result = compileP10b18aAuditCase(authority, variation);
      return {
        caseId: `${authority.id}--${variation.id}`,
        authority,
        variation,
        result,
        directionId: requireDirection(result.compiledDecision.designDna.directionId),
        consumedAuthorityFingerprint: p10b18aMaterializerDesignAuthorityFingerprint(result),
        normalizedTopologyFingerprint: p10b18aNormalizedDesignTopologyFingerprint(result),
      };
    }),
  );
}

function caseOrder(left: CompiledMatrixCase, right: CompiledMatrixCase): number {
  return left.caseId.localeCompare(right.caseId);
}

function representativeCases(matrix: readonly CompiledMatrixCase[]): readonly CompiledMatrixCase[] {
  const selected: CompiledMatrixCase[] = [];
  const selectedIds = new Set<string>();
  const directionCount = (direction: AuditDirection) =>
    selected.filter(({ directionId }) => directionId === direction).length;
  const select = (candidate: CompiledMatrixCase) => {
    selected.push(candidate);
    selectedIds.add(candidate.caseId);
  };
  const remaining = (direction: AuditDirection, shapeId?: string) =>
    matrix
      .filter(
        (candidate) =>
          candidate.directionId === direction &&
          !selectedIds.has(candidate.caseId) &&
          (shapeId === undefined || candidate.authority.id === shapeId),
      )
      .sort(caseOrder);
  const noveltyOrder = (direction: AuditDirection, candidates: readonly CompiledMatrixCase[]) => {
    const topologies = new Set(
      selected.map(({ normalizedTopologyFingerprint }) => normalizedTopologyFingerprint),
    );
    const consumed = new Set(
      selected.map(({ consumedAuthorityFingerprint }) => consumedAuthorityFingerprint),
    );
    const directionShapes = new Set(
      selected
        .filter(({ directionId }) => directionId === direction)
        .map(({ authority }) => authority.id),
    );
    return [...candidates].sort((left, right) => {
      const score = (candidate: CompiledMatrixCase) =>
        (topologies.has(candidate.normalizedTopologyFingerprint) ? 0 : 100) +
        (consumed.has(candidate.consumedAuthorityFingerprint) ? 0 : 20) +
        (directionShapes.has(candidate.authority.id) ? 0 : 5);
      return score(right) - score(left) || caseOrder(left, right);
    });
  };

  const shapeIds = [...new Set(matrix.map(({ authority }) => authority.id))].sort();
  const aurumShapeId = matrix.find(
    ({ authority }) => authority.fixtureAuthority === "p10b16p04j-aurum-approved",
  )?.authority.id;
  if (!aurumShapeId) throw new Error("P10B-18A has no approved Aurum fixture stratum.");

  // Each direction must be seen through the approved fictional merchant's evidence and assets.
  for (const direction of auditDirections) {
    const candidate = noveltyOrder(direction, remaining(direction, aurumShapeId))[0];
    if (!candidate) throw new Error(`Aurum has no ${direction} representative case.`);
    select(candidate);
  }

  // Retain each remaining catalogue shape while leaving one deliberate collapse-witness slot.
  for (const [index, shapeId] of shapeIds.filter((id) => id !== aurumShapeId).entries()) {
    const rotatedDirections = auditDirections.map(
      (_, offset) => auditDirections[(index + offset) % auditDirections.length],
    );
    const direction = rotatedDirections
      .filter((candidate) => directionCount(candidate) < 5)
      .sort(
        (left, right) => directionCount(left) - directionCount(right) || left.localeCompare(right),
      )
      .find((candidate) => remaining(candidate, shapeId).length > 0);
    if (!direction) throw new Error(`No representative direction exists for ${shapeId}.`);
    select(noveltyOrder(direction, remaining(direction, shapeId))[0]);
  }

  // Keep five varied cases per direction, then add one deliberate near-duplicate witness.
  for (const direction of auditDirections) {
    while (directionCount(direction) < 5) {
      const candidate = noveltyOrder(direction, remaining(direction))[0];
      if (!candidate) throw new Error(`P10B-18A cannot fill the ${direction} review cohort.`);
      select(candidate);
    }
    const directionTopologies = new Set(
      selected
        .filter(({ directionId }) => directionId === direction)
        .map(({ normalizedTopologyFingerprint }) => normalizedTopologyFingerprint),
    );
    const duplicateWitness = remaining(direction).find(({ normalizedTopologyFingerprint }) =>
      directionTopologies.has(normalizedTopologyFingerprint),
    );
    if (!duplicateWitness) {
      throw new Error(`P10B-18A has no deliberate ${direction} topology-collapse witness.`);
    }
    select(duplicateWitness);
  }

  if (selected.length !== 18 || selectedIds.size !== 18) {
    throw new Error("P10B-18A must select exactly eighteen deterministic cases.");
  }
  for (const direction of auditDirections) {
    if (directionCount(direction) !== 6) {
      throw new Error(`P10B-18A must retain six ${direction} cases.`);
    }
  }
  if (new Set(selected.map(({ authority }) => authority.id)).size !== shapeIds.length) {
    throw new Error("P10B-18A did not retain every catalogue shape.");
  }
  for (const direction of auditDirections) {
    if (
      !selected.some(
        ({ authority, directionId }) => authority.id === aurumShapeId && directionId === direction,
      )
    ) {
      throw new Error(`P10B-18A did not retain Aurum in ${direction}.`);
    }
    const directionTopologies = selected
      .filter(({ directionId }) => directionId === direction)
      .map(({ normalizedTopologyFingerprint }) => normalizedTopologyFingerprint);
    if (new Set(directionTopologies).size === directionTopologies.length) {
      throw new Error(`P10B-18A did not retain a ${direction} topology-collapse witness.`);
    }
    const collapseWitness = selected.find(
      (candidate) =>
        candidate.directionId === direction &&
        selected.some(
          (peer) =>
            peer.directionId === direction &&
            peer.caseId !== candidate.caseId &&
            peer.normalizedTopologyFingerprint === candidate.normalizedTopologyFingerprint &&
            peer.result.compiledDecision.compiledDecisionFingerprint !==
              candidate.result.compiledDecision.compiledDecisionFingerprint,
        ),
    );
    if (!collapseWitness) {
      throw new Error(`${direction} collapse witness does not have distinct compiled authority.`);
    }
  }
  return [...selected].sort(
    (left, right) =>
      auditDirections.indexOf(left.directionId) - auditDirections.indexOf(right.directionId) ||
      caseOrder(left, right),
  );
}

function auditAggregate(authority: P10b18aShapeAuthority, candidate: StorefrontSnapshot) {
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
  if (
    canonicalStorefrontContentFingerprint(draft) ===
    canonicalStorefrontContentFingerprint(published)
  ) {
    throw new Error("P10B-18A requires distinct candidate-draft and raw published authority.");
  }
  return validateProjectAggregate({
    project,
    catalogue: structuredClone(authority.catalogue),
    snapshots: [published, draft],
  });
}

function materializeAuditStore(matrixCase: CompiledMatrixCase): MaterializedAuditStore {
  const { authority, variation, result } = matrixCase;
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

  const snapshot = execution.synthesis.materialization.snapshot;
  expect(snapshot.catalogueRef).toBe(authority.catalogue.id);
  const aggregate = auditAggregate(authority, snapshot);
  const draft = aggregate.snapshots.find(({ id }) => id === aggregate.project.draftSnapshotId)!;
  const collectionRoute = authority.representativeRoutes.collection;
  const productRoute =
    authority.representativeRoutes.highConsiderationProduct ??
    authority.representativeRoutes.configurableProduct ??
    authority.representativeRoutes.simpleProduct;
  if (!collectionRoute || !productRoute) {
    throw new Error(`${matrixCase.caseId} has no representative commerce routes.`);
  }
  const collectionResolution = resolveDynamicCommerceRoutePage({
    snapshot: draft,
    catalogue: authority.catalogue,
    route: collectionRoute,
  });
  const productResolution = resolveDynamicCommerceRoutePage({
    snapshot: draft,
    catalogue: authority.catalogue,
    route: productRoute,
  });
  if (
    collectionResolution.route.kind !== "collection" ||
    productResolution.route.kind !== "product"
  ) {
    throw new Error(`${matrixCase.caseId} representative routes have stale identities.`);
  }
  const resolvedCollectionRoute = collectionResolution.route;
  const resolvedProductRoute = productResolution.route;
  const collection = authority.catalogue.collections.find(
    ({ id }) => id === resolvedCollectionRoute.collectionId,
  );
  const product = authority.catalogue.products.find(
    ({ id }) => id === resolvedProductRoute.productId,
  );
  if (!collection || !product) {
    throw new Error(`${matrixCase.caseId} representative commerce no longer resolves.`);
  }
  const dynamic = result.compiledDecision.dynamicCommerceSelection;
  const topology = p10b18aNormalizedDesignTopology(result);
  const locale = requireLocale(aggregate.project.primaryLocale);
  const selectedRuntimeAuthority = runtimeAuthority(authority);
  const expectedLocale = selectedRuntimeAuthority === "p04-integrated-mock" ? "en" : "fi";
  if (locale !== expectedLocale) {
    throw new Error(`${matrixCase.caseId} must render in its fixture authority's primary locale.`);
  }
  if (
    selectedRuntimeAuthority === "p04-integrated-mock" &&
    (!authority.approvedEvidenceFingerprint || !authority.approvedAssetContextFingerprint)
  ) {
    throw new Error(`${matrixCase.caseId} lacks the approved P04 evidence or asset authority.`);
  }
  const homepageProfileSelection = result.synthesisDecision.pageProfileSelections.find(
    ({ profileId }) => profileId === result.compiledDecision.profiles.homepage.profileId,
  );
  if (!homepageProfileSelection) {
    throw new Error(`${matrixCase.caseId} lacks its exact homepage profile selection.`);
  }
  const manifest: P10B18AStoreManifestEntry = {
    caseId: matrixCase.caseId,
    fixtureAuthority: authority.fixtureAuthority,
    fixtureKind: authority.fixtureKind,
    fixtureSourceDraftId: authority.fixtureSetup.sourceDraftId,
    fixtureSourceDraftKind: authority.fixtureSetup.sourceDraftKind,
    runtimeAuthority: selectedRuntimeAuthority,
    projectId: aggregate.project.id,
    locale,
    shapeId: authority.id,
    directionId: matrixCase.directionId,
    semanticVariationId: variation.id,
    semanticIntentFingerprint: providerIntent.semanticIntentFingerprint,
    semanticDrivers: Object.fromEntries(
      Object.entries(variation.drivers).map(([key, value]) => [key, String(value)]),
    ),
    compiledDecisionFingerprint: result.compiledDecision.compiledDecisionFingerprint,
    compilerStructuralFingerprint: result.compiledDecision.structuralFingerprint,
    consumedAuthorityFingerprint: matrixCase.consumedAuthorityFingerprint,
    normalizedAuthorityTopologyFingerprint: matrixCase.normalizedTopologyFingerprint,
    candidateSnapshotFingerprint: canonicalStorefrontContentFingerprint(draft),
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
    commerceFingerprintBefore: commerceBefore,
    commerceFingerprintAfter: authority.commerceFingerprint,
    mediaFingerprintBefore: mediaBefore,
    mediaFingerprintAfter: authority.mediaFingerprint,
    frame: result.compiledDecision.sharedFrame.profileId,
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
      fixtureAssertions: authority.assertions,
      fixtureClassification:
        authority.fixtureAuthority === "p10b16p04j-aurum-approved"
          ? "fictional production-disabled P04J approved presentation authority"
          : "production-disabled P03 audit authority",
      productCount: authority.catalogue.products.length,
      collectionCount: authority.catalogue.collections.length,
      designDna: topology.designDnaCategories,
      boundedLayoutParameters: result.synthesisDecision.boundedParameters,
      exactPosturesNotAssumedConsumed: {
        narrative: result.synthesisDecision.narrative.posture,
        merchandising: result.synthesisDecision.merchandisingPosture,
        informationDensity: result.synthesisDecision.informationDensityPosture,
        responsive: result.synthesisDecision.responsivePosture.mode,
        artDirection: result.synthesisDecision.artDirectionPosture,
      },
      approvedAssetSelectionCount: result.synthesisDecision.approvedAssetRoleSelections.length,
      semanticAcceptedPaths:
        result.compiledDecision.semanticResolution?.acceptedSemanticPaths ?? [],
      semanticSubstitutedPaths:
        result.compiledDecision.semanticResolution?.substitutedSemanticPaths ?? [],
    },
    representativeRoutes: {
      home: "/",
      collection: collectionRoute,
      productDetail: productRoute,
    },
    representativeContext: {
      collectionId: collection.id,
      collectionProductCount: collection.productIds.length,
      productId: product.id,
      productType: product.productType,
      productConfigurable: isConfigurable(product),
    },
  };
  return {
    matrixCase,
    snapshot: draft,
    aggregate,
    manifest,
    routeAuthority: {
      collectionProductCount: collection.productIds.length,
      collectionArchetype: collectionResolution.archetype.id,
      product,
      productArchetype: productResolution.archetype.id,
    },
  };
}

function localized(value: { en?: string; fi?: string }, locale: P10B18ALocale): string {
  return value[locale] ?? value.fi ?? value.en ?? "";
}

function isConfigurable(product: ProductDisplayModel): boolean {
  return product.variants.length > 0 || (product.orderOptions?.length ?? 0) > 0;
}

async function assertRenderedCommerce(
  root: Locator,
  store: MaterializedAuditStore,
  surface: P10B18ASurface,
): Promise<void> {
  if (surface === "home") {
    await expect(root.locator('[data-component^="homepage"]').first()).toBeVisible();
    if (store.manifest.runtimeAuthority === "p04-integrated-mock") {
      const renderedHomepageSequence = await root
        .locator('[data-component^="homepage"]')
        .evaluateAll((nodes) =>
          nodes.map((node) => ({
            component: node.getAttribute("data-component"),
            variant: node.getAttribute("data-variant"),
          })),
        );
      expect(renderedHomepageSequence).toEqual(
        store.manifest.homepageComponentSequence.map(({ component, variant }) => ({
          component,
          variant,
        })),
      );
      const exactProofSelected = store.manifest.homepageComponentSequence.some(
        ({ component }) => component === "homepageProof",
      );
      if (exactProofSelected) {
        const proof = root
          .locator('[data-component="homepageProof"][data-evidence-state="approved"]')
          .first();
        await expect(proof).toBeVisible();
        expect(await proof.locator("[data-evidence-authority]").count()).toBeGreaterThan(0);
      }
      const expectedAssets = store.manifest.approvedAssetRoleSelections.filter(
        ({ profileId }) => profileId === store.manifest.profiles.homepage,
      );
      if (!exactProofSelected && expectedAssets.length === 0) {
        throw new Error(`${store.manifest.caseId} consumes no approved P04 homepage authority.`);
      }
      const renderedAssets = await root
        .locator("[data-asset-id][data-asset-role]")
        .evaluateAll((nodes) =>
          nodes.map((node) => ({
            assetId: node.getAttribute("data-asset-id"),
            role: node.getAttribute("data-asset-role"),
          })),
        );
      for (const asset of expectedAssets) {
        expect(renderedAssets).toContainEqual({ assetId: asset.assetId, role: asset.role });
      }
    }
    return;
  }
  if (surface === "collection") {
    const grid = root.locator("[data-canonical-product-count]").first();
    await expect(grid).toHaveAttribute(
      "data-canonical-product-count",
      String(store.routeAuthority.collectionProductCount),
    );
    const presented = Number(await grid.getAttribute("data-presented-product-count"));
    expect(presented).toBeGreaterThan(0);
    await expect(root.locator("article[data-card-anatomy]")).toHaveCount(presented);
    return;
  }
  await expect(root.getByRole("heading", { level: 1 })).toContainText(
    localized(store.routeAuthority.product.title, store.manifest.locale),
  );
  await expect(root.getByLabel(store.manifest.locale === "en" ? "Price" : "Hinta")).toBeVisible();
  await expect(
    root.getByLabel(store.manifest.locale === "en" ? "Purchase action" : "Ostotoiminto"),
  ).toBeVisible();
  if (isConfigurable(store.routeAuthority.product)) {
    const options = root.locator("[data-option-group-count]");
    await expect(options).toBeVisible();
    expect(Number(await options.getAttribute("data-option-group-count"))).toBeGreaterThan(0);
    await expect(
      root.getByRole("heading", {
        name:
          store.manifest.locale === "en" ? "Choose product options" : "Valitse tuotevaihtoehdot",
      }),
    ).toBeVisible();
  }
}

function sortedAggregateFingerprint(value: ReturnType<typeof validateProjectAggregate>): string {
  return canonicalValueFingerprint({
    project: value.project,
    catalogue: value.catalogue,
    snapshots: [...value.snapshots].sort((left, right) => left.id.localeCompare(right.id)),
  });
}

test.describe.configure({ timeout: 3_600_000 });

test("renders eighteen representative compiled stores through the canonical preview routes", async ({
  browser,
  browserName,
}, testInfo: TestInfo) => {
  test.skip(browserName !== "chromium", "P10B-18A retains one deterministic Chromium audit.");
  const matrix = compileAuditMatrix();
  expect(matrix).toHaveLength(72);
  expect(
    matrix.every(({ authority }) => authority.fixtureSetup.matrixCaseMaterializationCount === 0),
  ).toBe(true);
  const selected = representativeCases(matrix);
  expect(new Set(selected.map(({ authority }) => authority.id)).size).toBe(9);
  for (const direction of auditDirections) {
    expect(selected.filter(({ directionId }) => directionId === direction)).toHaveLength(6);
    expect(
      selected.some(
        ({ authority, directionId }) =>
          authority.fixtureAuthority === "p10b16p04j-aurum-approved" && directionId === direction,
      ),
    ).toBe(true);
  }
  const fixtureAuthorities = [
    ...new Map(matrix.map(({ authority }) => [authority.id, authority])).values(),
  ];
  const workerFixtureBootstrapMaterializationCount = fixtureAuthorities.reduce(
    (count, authority) => count + authority.fixtureSetup.fixtureBootstrapMaterializationCount,
    0,
  );
  expect(workerFixtureBootstrapMaterializationCount).toBe(1);
  let sampledStorefrontMaterializationCount = 0;
  const stores = selected.map((matrixCase) => {
    sampledStorefrontMaterializationCount += 1;
    return materializeAuditStore(matrixCase);
  });
  expect(stores).toHaveLength(18);
  expect(sampledStorefrontMaterializationCount).toBe(18);
  expect(
    stores.every(
      ({ manifest }) => manifest.commerceFingerprintAfter === manifest.commerceFingerprintBefore,
    ),
  ).toBe(true);
  expect(
    stores.every(
      ({ manifest }) => manifest.mediaFingerprintAfter === manifest.mediaFingerprintBefore,
    ),
  ).toBe(true);

  const context = await browser.newContext({ baseURL: p10b18aOrigin() });
  const page = await context.newPage();
  const ledger = await installP10B18AOfflineAuthority(page);
  const evidence: P10B18AEvidenceEntry[] = [];
  try {
    for (const selectedRuntimeAuthority of ["p03-standalone", "p04-integrated-mock"] as const) {
      const runtimeStores = stores.filter(
        ({ manifest }) => manifest.runtimeAuthority === selectedRuntimeAuthority,
      );
      expect(runtimeStores.length).toBeGreaterThan(0);
      await initializeP10B18AStorage(page, selectedRuntimeAuthority);
      for (const store of runtimeStores) {
        const stored = await seedP10B18AAggregate(
          page,
          store.aggregate,
          store.manifest.runtimeAuthority,
        );
        const storedAggregate = validateProjectAggregate({
          project: projectSchema.parse(stored.project),
          catalogue: catalogueDisplayModelSchema.parse(stored.catalogue),
          snapshots: storefrontSnapshotSchema.array().parse(stored.snapshots),
        });
        expect(sortedAggregateFingerprint(storedAggregate)).toBe(
          sortedAggregateFingerprint(store.aggregate),
        );
        expect(stored.staleProjectState).toEqual({
          history: 0,
          publicationOperations: 0,
          compiledPublicationArtifacts: 0,
          publishedStorefrontVersions: 0,
          activePublishedStorefrontPointer: 0,
        });
        const surfaces = [
          {
            id: "home" as const,
            route: store.manifest.representativeRoutes.home,
            profile: store.manifest.profiles.homepage,
          },
          {
            id: "collection" as const,
            route: store.manifest.representativeRoutes.collection,
            profile: store.routeAuthority.collectionArchetype,
          },
          {
            id: "product-detail" as const,
            route: store.manifest.representativeRoutes.productDetail,
            profile: store.routeAuthority.productArchetype,
          },
        ];
        for (const width of p10b18aWidths) {
          for (const surface of surfaces) {
            evidence.push(
              await captureP10B18AEvidence({
                page,
                store: store.manifest,
                surface: surface.id,
                route: surface.route,
                width,
                profileOrArchetype: surface.profile,
              }),
            );
            await assertRenderedCommerce(
              page.locator(".project-preview__storefront"),
              store,
              surface.id,
            );
          }
        }
        const retained = await readP10B18AAggregate(
          page,
          store.aggregate.project.id,
          store.aggregate.catalogue.id,
          store.manifest.runtimeAuthority,
        );
        const retainedAggregate = validateProjectAggregate({
          project: projectSchema.parse(retained.project),
          catalogue: catalogueDisplayModelSchema.parse(retained.catalogue),
          snapshots: storefrontSnapshotSchema.array().parse(retained.snapshots),
        });
        expect(sortedAggregateFingerprint(retainedAggregate)).toBe(
          sortedAggregateFingerprint(store.aggregate),
        );
        expect(canonicalValueString(retainedAggregate.catalogue)).toBe(
          canonicalValueString(store.matrixCase.authority.catalogue),
        );
        expect(retained.staleProjectState).toEqual(stored.staleProjectState);
      }
    }
  } finally {
    await context.close();
  }

  expect(evidence).toHaveLength(108);
  expect(new Set(evidence.map(({ filename }) => filename)).size).toBe(108);
  expect(ledger).toEqual({
    external: [],
    provider: [],
    Vesko: [],
    generation: [],
    publication: [],
    runtimeErrors: [],
  });
  const manifestPath = await writeP10B18AEvidenceManifest({
    stores: stores.map(({ manifest }) => manifest),
    captures: evidence,
    ledger,
    sampledStorefrontMaterializationCount,
    workerFixtureBootstrapMaterializationCount,
  });
  await testInfo.attach("p10b-18a-commercial-authority-browser-manifest", {
    path: manifestPath,
    contentType: "application/json",
  });
  await testInfo.attach("p10b-18a-evidence-directory", {
    body: Buffer.from(`${p10b18aEvidenceDirectory()}\n`, "utf8"),
    contentType: "text/plain",
  });
});
