import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { expect, test, type Page, type TestInfo } from "@playwright/test";
import { resolveDynamicCommerceRoutePage } from "@/application/dynamic-commerce-routes";
import {
  compileSemanticStorefrontDesignIntentV1,
  executeCompiledSemanticStorefrontDesignIntentV1,
} from "@/application/prompted-storefront-design-compiler";
import { catalogueDisplayModelSchema } from "@/domain/catalogue";
import { projectSchema } from "@/domain/project";
import {
  canonicalStorefrontContentFingerprint,
  canonicalValueFingerprint,
  canonicalValueString,
  storefrontSnapshotSchema,
  type StorefrontSnapshot,
} from "@/domain/storefront";
import { validateProjectAggregate } from "@/services/storage/repository-validation";
import { semanticIntentFixture } from "../fixtures/p10b-16p-04-semantic-intent";
import {
  p10b18aMaterializerDesignAuthorityFingerprint,
  p10b18aNormalizedDesignTopologyFingerprint,
  selectP10b18aAuditCase,
  type P10b18aCompiledAuditResult,
  type P10b18aShapeAuthority,
} from "../helpers/p10b-18a-commercial-authority";
import type { SemanticDriverOverrides } from "../fixtures/p10b-16p-04-semantic-intent";
import {
  captureP10B18AEvidence,
  initializeP10B18AStorage,
  installP10B18AOfflineAuthority,
  p10b18aEvidenceDirectory,
  p10b18aEvidenceRunId,
  p10b18aOrigin,
  readP10B18AAggregate,
  seedP10B18AAggregate,
  type P10B18AEvidenceEntry,
  type P10B18AStoreManifestEntry,
  type P10B18AWidth,
} from "./p10b-18a-browser-evidence";

type CaseDefinition = Readonly<{
  key: "rich-image-led" | "rich-balanced" | "sparse-no-assets";
  shapeId: string;
  variationId: string;
  imageProminence?: "balanced";
}>;

const cases: readonly CaseDefinition[] = [
  {
    key: "rich-image-led",
    shapeId: "aurum-approved-presentation-image-rich",
    variationId: "premium-story-image",
  },
  {
    key: "rich-balanced",
    shapeId: "aurum-approved-presentation-image-rich",
    variationId: "premium-story-image",
    imageProminence: "balanced",
  },
  {
    key: "sparse-no-assets",
    shapeId: "medium-mixed-jewellery",
    variationId: "technical-catalogue-dense",
  },
];

type Store = Readonly<{
  definition: CaseDefinition;
  authority: P10b18aShapeAuthority;
  variation: Readonly<{ id: string; drivers: SemanticDriverOverrides }>;
  result: P10b18aCompiledAuditResult;
  providerIntent: ReturnType<typeof semanticIntentFixture>;
  snapshot: StorefrontSnapshot;
  aggregate: ReturnType<typeof validateProjectAggregate>;
  manifest: P10B18AStoreManifestEntry;
  collectionRoute: string;
  collectionArchetype: string;
}>;

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
  return validateProjectAggregate({
    project,
    catalogue: structuredClone(authority.catalogue),
    snapshots: [published, draft],
  });
}

function compileCase(definition: CaseDefinition): Store {
  const { authority, variation: retainedVariation } = selectP10b18aAuditCase(
    definition.shapeId,
    definition.variationId,
  );
  const variation = definition.imageProminence
    ? {
        ...retainedVariation,
        id: `${retainedVariation.id}-${definition.imageProminence}`,
        drivers: {
          ...retainedVariation.drivers,
          imageProminence: definition.imageProminence,
        },
      }
    : retainedVariation;
  const providerIntent = semanticIntentFixture(authority.request, {
    designConceptSummary: `${authority.id}:${variation.id}`,
    ...variation.drivers,
  });
  const result = compileSemanticStorefrontDesignIntentV1({
    originalRequest: authority.request,
    providerIntent,
    currentRequestInput: authority.currentRequestInput,
    compatibilityInput: authority.compatibilityInput,
    semanticCapabilityIndex: authority.semanticCapabilityIndex,
    preparedAuthority: authority.preparedAuthority,
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
  const snapshot = execution.synthesis.materialization.snapshot;
  const aggregate = evidenceAggregate(authority, snapshot);
  const collectionRoute = authority.representativeRoutes.collection;
  if (!collectionRoute) throw new Error(`${definition.key} lacks a collection route.`);
  const collectionResolution = resolveDynamicCommerceRoutePage({
    snapshot,
    catalogue: authority.catalogue,
    route: collectionRoute,
  });
  if (collectionResolution.route.kind !== "collection") {
    throw new Error(`${definition.key} resolved a non-collection route.`);
  }
  const resolvedCollectionRoute = collectionResolution.route;
  const collection = authority.catalogue.collections.find(
    ({ id }) => id === resolvedCollectionRoute.collectionId,
  )!;
  const productRoute =
    authority.representativeRoutes.highConsiderationProduct ??
    authority.representativeRoutes.configurableProduct ??
    authority.representativeRoutes.simpleProduct;
  if (!productRoute) throw new Error(`${definition.key} lacks a product route.`);
  const productResolution = resolveDynamicCommerceRoutePage({
    snapshot,
    catalogue: authority.catalogue,
    route: productRoute,
  });
  if (productResolution.route.kind !== "product") {
    throw new Error(`${definition.key} resolved a non-product route.`);
  }
  const resolvedProductRoute = productResolution.route;
  const product = authority.catalogue.products.find(
    ({ id }) => id === resolvedProductRoute.productId,
  )!;
  const dynamic = result.compiledDecision.dynamicCommerceSelection;
  const homepageProfileSelection = result.synthesisDecision.pageProfileSelections.find(
    ({ profileId }) => profileId === result.compiledDecision.profiles.homepage.profileId,
  )!;
  const manifest: P10B18AStoreManifestEntry = {
    caseId: `p10b18b06-${definition.key}`,
    fixtureAuthority: authority.fixtureAuthority,
    fixtureKind: authority.fixtureKind,
    fixtureSourceDraftId: authority.fixtureSetup.sourceDraftId,
    fixtureSourceDraftKind: authority.fixtureSetup.sourceDraftKind,
    runtimeAuthority:
      authority.fixtureAuthority === "p10b16p04j-aurum-approved"
        ? "p04-integrated-mock"
        : "p03-standalone",
    projectId: aggregate.project.id,
    locale: aggregate.project.primaryLocale,
    shapeId: authority.id,
    directionId: result.compiledDecision.designDna.directionId,
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
    approvedAssetPresentationFingerprint: canonicalValueFingerprint(
      snapshot.pages.flatMap(({ sections }) =>
        sections.flatMap(({ approvedAssetPresentations }) => approvedAssetPresentations ?? []),
      ),
    ),
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
      imageProminence: variation.drivers.imageProminence,
      artDirectionPosture: result.compiledDecision.exactSelection.artDirectionPosture,
      approvedAssetPlacementFingerprint: canonicalValueFingerprint(
        snapshot.pages.flatMap(({ sections }) =>
          sections.flatMap(({ approvedAssetPlacements }) => approvedAssetPlacements ?? []),
        ),
      ),
    },
    representativeRoutes: { home: "/", collection: collectionRoute, productDetail: productRoute },
    representativeContext: {
      collectionId: collection.id,
      collectionProductCount: collection.productIds.length,
      productId: product.id,
      productType: product.productType,
      productConfigurable: product.variants.length > 0 || (product.orderOptions?.length ?? 0) > 0,
    },
  };
  return {
    definition,
    authority,
    variation,
    result,
    providerIntent,
    snapshot,
    aggregate,
    manifest,
    collectionRoute,
    collectionArchetype: collectionResolution.archetype.id,
  };
}

async function inspectAssets(page: Page) {
  return page.locator(".project-preview__storefront").evaluate((root) => {
    const hero = root.querySelector<HTMLElement>('[data-component="homepageHero"]');
    const logo = root.querySelector<HTMLImageElement>(
      '[data-frame-region="header"] .store-brand img',
    );
    const sources = [...(hero?.querySelectorAll<HTMLSourceElement>("picture source") ?? [])].map(
      (source) => ({
        breakpoint: source.dataset.artBreakpoint ?? "",
        sourceId: source.dataset.artSourceId ?? "",
        sourceChange: source.dataset.artSourceChange ?? "",
        treatmentChange: source.dataset.artTreatmentChange ?? "",
        result: source.dataset.artResponsiveResult ?? "",
        srcset: source.getAttribute("srcset") ?? "",
        crop: source.dataset.artCrop ?? "",
        focal: source.dataset.artFocal ?? "",
        overlay: source.dataset.artOverlay ?? "",
      }),
    );
    const approvedImageIds = [...root.querySelectorAll<HTMLElement>("[data-asset-id]")]
      .map((node) => node.dataset.assetId ?? "")
      .filter(Boolean);
    return {
      logoSrc: logo?.getAttribute("src") ?? null,
      brandText: root.querySelector<HTMLElement>('[data-frame-region="header"] .store-brand')
        ?.textContent,
      heroAssetId: hero?.querySelector<HTMLElement>("[data-asset-id]")?.dataset.assetId ?? null,
      heroAuthorityFingerprint:
        hero?.querySelector<HTMLElement>("[data-art-direction-fingerprint]")?.dataset
          .artDirectionFingerprint ?? null,
      sources,
      approvedImageIds,
      documentWidth: document.documentElement.scrollWidth,
      viewportWidth: document.documentElement.clientWidth,
      brokenImages: [...root.querySelectorAll<HTMLImageElement>("img")]
        .filter(
          (image) =>
            image.getClientRects().length > 0 && (!image.complete || image.naturalWidth === 0),
        )
        .map((image) => image.getAttribute("src") ?? ""),
    };
  });
}

const capturePlan = [
  ...([375, 768, 1024, 1440] as const).map((width) => ({
    storeKey: "rich-image-led" as const,
    surface: "home" as const,
    width,
  })),
  ...([375, 1440] as const).map((width) => ({
    storeKey: "rich-image-led" as const,
    surface: "collection" as const,
    width,
  })),
  ...([375, 1440] as const).map((width) => ({
    storeKey: "rich-balanced" as const,
    surface: "home" as const,
    width,
  })),
  { storeKey: "rich-balanced" as const, surface: "collection" as const, width: 1440 as const },
  ...([375, 1440] as const).flatMap((width) => [
    { storeKey: "sparse-no-assets" as const, surface: "home" as const, width },
    { storeKey: "sparse-no-assets" as const, surface: "collection" as const, width },
  ]),
] satisfies readonly Readonly<{
  storeKey: CaseDefinition["key"];
  surface: "home" | "collection";
  width: P10B18AWidth;
}>[];

test.describe.configure({ timeout: 1_800_000 });

test("retains thirteen asset-composition and art-direction captures", async ({
  browser,
  browserName,
}, testInfo: TestInfo) => {
  test.skip(browserName !== "chromium", "P10B-18B-06 retains one deterministic Chromium run.");
  const stores = cases.map(compileCase);
  expect(capturePlan).toHaveLength(13);
  const richImage = stores.find(({ definition }) => definition.key === "rich-image-led")!;
  const richBalanced = stores.find(({ definition }) => definition.key === "rich-balanced")!;
  const sparse = stores.find(({ definition }) => definition.key === "sparse-no-assets")!;
  const { artDirectionPosture: _imagePosture, ...imageBackbone } =
    richImage.result.compiledDecision.exactSelection;
  const { artDirectionPosture: _balancedPosture, ...balancedBackbone } =
    richBalanced.result.compiledDecision.exactSelection;
  expect(canonicalValueString(imageBackbone)).toBe(canonicalValueString(balancedBackbone));
  expect([_balancedPosture, _imagePosture]).toEqual(["editorial", "immersive"]);
  expect(richImage.authority.mediaFingerprint).toBe(richBalanced.authority.mediaFingerprint);
  expect(sparse.authority.approvedAssetContextFingerprint).toBeNull();

  const context = await browser.newContext({ baseURL: p10b18aOrigin() });
  const page = await context.newPage();
  const ledger = await installP10B18AOfflineAuthority(page);
  const captures: Array<
    P10B18AEvidenceEntry &
      Readonly<{ storeKey: string; assetEvidence: Awaited<ReturnType<typeof inspectAssets>> }>
  > = [];
  const storage: Array<Readonly<{ storeKey: string; persisted: string; reloaded: string }>> = [];
  try {
    for (const runtimeAuthority of ["p03-standalone", "p04-integrated-mock"] as const) {
      await initializeP10B18AStorage(page, runtimeAuthority);
      for (const store of stores.filter(
        ({ manifest }) => manifest.runtimeAuthority === runtimeAuthority,
      )) {
        const seeded = await seedP10B18AAggregate(page, store.aggregate, runtimeAuthority);
        const seededAggregate = validateProjectAggregate({
          project: projectSchema.parse(seeded.project),
          catalogue: catalogueDisplayModelSchema.parse(seeded.catalogue),
          snapshots: storefrontSnapshotSchema.array().parse(seeded.snapshots),
        });
        const persisted = seededAggregate.snapshots.find(
          ({ id }) => id === seededAggregate.project.draftSnapshotId,
        )!;
        expect(canonicalStorefrontContentFingerprint(persisted)).toBe(
          store.manifest.candidateSnapshotFingerprint,
        );
        for (const entry of capturePlan.filter(
          ({ storeKey }) => storeKey === store.definition.key,
        )) {
          const route = entry.surface === "home" ? "/" : store.collectionRoute;
          const base = await captureP10B18AEvidence({
            page,
            store: store.manifest,
            surface: entry.surface,
            route,
            width: entry.width,
            profileOrArchetype:
              entry.surface === "home"
                ? store.result.compiledDecision.profiles.homepage.profileId
                : store.collectionArchetype,
          });
          const assetEvidence = await inspectAssets(page);
          expect(assetEvidence.brokenImages).toEqual([]);
          expect(assetEvidence.documentWidth).toBeLessThanOrEqual(assetEvidence.viewportWidth + 1);
          captures.push({ ...base, storeKey: store.definition.key, assetEvidence });
        }
        const reloaded = await readP10B18AAggregate(
          page,
          store.aggregate.project.id,
          store.aggregate.catalogue.id,
          runtimeAuthority,
        );
        const reloadedAggregate = validateProjectAggregate({
          project: projectSchema.parse(reloaded.project),
          catalogue: catalogueDisplayModelSchema.parse(reloaded.catalogue),
          snapshots: storefrontSnapshotSchema.array().parse(reloaded.snapshots),
        });
        const reloadedDraft = reloadedAggregate.snapshots.find(
          ({ id }) => id === reloadedAggregate.project.draftSnapshotId,
        )!;
        storage.push({
          storeKey: store.definition.key,
          persisted: canonicalStorefrontContentFingerprint(persisted),
          reloaded: canonicalStorefrontContentFingerprint(reloadedDraft),
        });
      }
    }
  } finally {
    await context.close();
  }

  expect(captures).toHaveLength(13);
  expect(storage.every(({ persisted, reloaded }) => persisted === reloaded)).toBe(true);
  const richHome = captures.filter(
    ({ storeKey, surface }) => storeKey === "rich-image-led" && surface === "home",
  );
  expect(richHome).toHaveLength(4);
  expect(
    richHome.every(({ assetEvidence }) => assetEvidence.logoSrc?.includes("aurum-nordic-logo.svg")),
  ).toBe(true);
  const mobile = richHome.find(({ viewport }) => viewport === 375)!;
  const wide = richHome.find(({ viewport }) => viewport === 1440)!;
  expect(
    mobile.assetEvidence.sources.find(({ breakpoint }) => breakpoint === "mobile"),
  ).toMatchObject({
    sourceId: "asset_p10b18b06_aurum_hero_mobile",
    sourceChange: "changed",
    treatmentChange: "changed",
    result: "source-and-treatment",
    srcset: expect.stringContaining("aurum-mobile-hero.svg"),
    focal: "0.5,0.38",
  });
  expect(wide.assetEvidence.sources.find(({ breakpoint }) => breakpoint === "wide")).toMatchObject({
    sourceId: "asset_p10b16p04_aurum_hero",
    sourceChange: "same",
    treatmentChange: "changed",
    result: "treatment-only",
    focal: "0.58,0.45",
  });
  expect(
    new Set(
      wide.assetEvidence.approvedImageIds.filter(
        (assetId) => assetId !== "asset_p10b18b06_aurum_logo",
      ),
    ).size,
  ).toBeGreaterThan(1);
  const balancedWide = captures.find(
    ({ storeKey, surface, viewport }) =>
      storeKey === "rich-balanced" && surface === "home" && viewport === 1440,
  )!;
  expect(balancedWide.assetEvidence.heroAuthorityFingerprint).not.toBe(
    wide.assetEvidence.heroAuthorityFingerprint,
  );
  const sparseCaptures = captures.filter(({ storeKey }) => storeKey === "sparse-no-assets");
  expect(sparseCaptures).toHaveLength(4);
  expect(sparseCaptures.every(({ assetEvidence }) => assetEvidence.logoSrc === null)).toBe(true);
  expect(
    sparseCaptures.every(({ assetEvidence }) => Boolean(assetEvidence.brandText?.trim())),
  ).toBe(true);
  expect(ledger).toEqual({
    external: [],
    provider: [],
    Vesko: [],
    generation: [],
    publication: [],
    runtimeErrors: [],
  });

  const directory = p10b18aEvidenceDirectory();
  await mkdir(directory, { recursive: true });
  const manifestPath = resolve(
    directory,
    "p10b-18b-06-asset-composition-art-direction-manifest.json",
  );
  const material = {
    contractVersion: "p10b-18b-06-asset-composition-art-direction-browser-evidence-v1",
    runId: p10b18aEvidenceRunId(),
    fixtureClassification:
      "production-disabled fictional Aurum rich authority and Karvonen sparse authority",
    captureCount: captures.length,
    capturePlan,
    stores: stores.map(({ definition, result, snapshot, authority }) => ({
      key: definition.key,
      shapeId: authority.id,
      exactSelection: result.compiledDecision.exactSelection,
      approvedAssetRoleSelections: result.compiledDecision.approvedAssetRoleSelections,
      sharedFrameAssets: snapshot.sharedFrame?.header.approvedAssetPlacements ?? [],
      materializedPlacements: snapshot.pages.flatMap(({ sections }) =>
        sections.flatMap(({ approvedAssetPlacements }) => approvedAssetPlacements ?? []),
      ),
      productMediaFingerprint: authority.mediaFingerprint,
    })),
    storage,
    captures,
    requestLedger: ledger,
  };
  await writeFile(manifestPath, `${JSON.stringify(material, null, 2)}\n`, "utf8");
  await testInfo.attach("p10b-18b-06-asset-composition-art-direction-browser-manifest", {
    path: manifestPath,
    contentType: "application/json",
  });
});
