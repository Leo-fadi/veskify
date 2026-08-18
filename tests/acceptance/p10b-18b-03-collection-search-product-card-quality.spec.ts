import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { expect, test, type Page, type TestInfo } from "@playwright/test";
import {
  compileSemanticStorefrontDesignIntentV1,
  executeCompiledSemanticStorefrontDesignIntentV1,
} from "@/application/prompted-storefront-design-compiler";
import { catalogueDisplayModelSchema } from "@/domain/catalogue";
import { projectSchema } from "@/domain/project";
import {
  canonicalStorefrontContentFingerprint,
  canonicalValueFingerprint,
  storefrontSnapshotSchema,
  type StorefrontSnapshot,
} from "@/domain/storefront";
import { validateProjectAggregate } from "@/services/storage/repository-validation";
import { semanticIntentFixture } from "../fixtures/p10b-16p-04-semantic-intent";
import {
  createP10b18aShapeAuthorities,
  p10b18aMaterializerDesignAuthorityFingerprint,
  p10b18aNormalizedDesignTopologyFingerprint,
  p10b18aSemanticVariations,
  type P10b18aCompiledAuditResult,
  type P10b18aShapeAuthority,
} from "../helpers/p10b-18a-commercial-authority";
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
  type P10B18ARuntimeAuthority,
  type P10B18AStoreManifestEntry,
  type P10B18ASurface,
  type P10B18AWidth,
} from "./p10b-18a-browser-evidence";

type CaseKey =
  "editorial-low" | "editorial-rich" | "comparison" | "campaign" | "dense" | "minimal-dense";

type CaseDefinition = Readonly<{
  key: CaseKey;
  shapeId:
    | "neutral-true-high-consideration"
    | "medium-mixed-jewellery"
    | "aurum-approved-presentation-image-rich";
  variationId: (typeof p10b18aSemanticVariations)[number]["id"];
}>;

const cases = [
  {
    key: "editorial-low",
    shapeId: "neutral-true-high-consideration",
    variationId: "premium-story-image",
  },
  {
    key: "editorial-rich",
    shapeId: "medium-mixed-jewellery",
    variationId: "premium-story-image",
  },
  {
    key: "comparison",
    shapeId: "medium-mixed-jewellery",
    variationId: "technical-catalogue-dense",
  },
  {
    key: "campaign",
    shapeId: "aurum-approved-presentation-image-rich",
    variationId: "premium-product-restrained",
  },
  {
    key: "dense",
    shapeId: "medium-mixed-jewellery",
    variationId: "technical-conversion-contained",
  },
  {
    key: "minimal-dense",
    shapeId: "medium-mixed-jewellery",
    variationId: "minimal-product-first",
  },
] as const satisfies readonly CaseDefinition[];

type CapturePlanEntry = Readonly<{
  storeKey: CaseKey;
  surface: P10B18ASurface;
  width: P10B18AWidth;
  query?: "multiple" | "one" | "zero";
}>;

const capturePlan: readonly CapturePlanEntry[] = [
  { storeKey: "editorial-low", surface: "collection", width: 375 },
  { storeKey: "editorial-low", surface: "collection", width: 1440 },
  { storeKey: "editorial-rich", surface: "collection", width: 1440 },
  { storeKey: "comparison", surface: "collection", width: 375 },
  { storeKey: "comparison", surface: "collection", width: 768 },
  { storeKey: "comparison", surface: "collection", width: 1024 },
  { storeKey: "comparison", surface: "collection", width: 1440 },
  { storeKey: "campaign", surface: "collection", width: 375 },
  { storeKey: "campaign", surface: "collection", width: 1440 },
  { storeKey: "dense", surface: "collection", width: 375 },
  { storeKey: "dense", surface: "collection", width: 1440 },
  { storeKey: "minimal-dense", surface: "collection", width: 375 },
  { storeKey: "minimal-dense", surface: "collection", width: 1440 },
  { storeKey: "comparison", surface: "search", width: 375, query: "multiple" },
  { storeKey: "comparison", surface: "search", width: 1440, query: "multiple" },
  { storeKey: "dense", surface: "search", width: 375, query: "multiple" },
  { storeKey: "dense", surface: "search", width: 1440, query: "multiple" },
  { storeKey: "dense", surface: "search", width: 1440, query: "one" },
  { storeKey: "dense", surface: "search", width: 375, query: "zero" },
  { storeKey: "dense", surface: "search", width: 1440, query: "zero" },
  { storeKey: "comparison", surface: "home", width: 1440 },
];

type Store = Readonly<{
  definition: CaseDefinition;
  authority: P10b18aShapeAuthority;
  result: P10b18aCompiledAuditResult;
  snapshot: StorefrontSnapshot;
  aggregate: ReturnType<typeof validateProjectAggregate>;
  manifest: P10B18AStoreManifestEntry;
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

function compileCase(
  definition: CaseDefinition,
  authorities: ReadonlyMap<string, P10b18aShapeAuthority>,
): Store {
  const authority = authorities.get(definition.shapeId);
  const variation = p10b18aSemanticVariations.find(({ id }) => id === definition.variationId);
  if (!authority || !variation) throw new Error(`Missing ${definition.key} fixture authority.`);
  const providerIntent = semanticIntentFixture(authority.request, {
    designConceptSummary: `${authority.id}:${variation.id}:p10b-18b-03`,
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
  const dynamic = result.compiledDecision.dynamicCommerceSelection;
  const homepageProfileSelection = result.synthesisDecision.pageProfileSelections.find(
    ({ profileId }) => profileId === result.compiledDecision.profiles.homepage.profileId,
  );
  const collectionRoute = authority.representativeRoutes.collection;
  const productRoute =
    authority.representativeRoutes.highConsiderationProduct ??
    authority.representativeRoutes.configurableProduct ??
    authority.representativeRoutes.simpleProduct;
  const collectionPage = authority.siteMapDecision.pages.find(
    ({ route }) => route === collectionRoute,
  );
  const collectionId =
    collectionPage?.commerceContext.kind === "collection"
      ? collectionPage.commerceContext.collectionId
      : null;
  const collection = authority.catalogue.collections.find(({ id }) => id === collectionId);
  const product = authority.catalogue.products[0];
  if (!homepageProfileSelection || !collectionRoute || !productRoute || !collection || !product) {
    throw new Error(`${definition.key} lacks representative canonical commerce.`);
  }
  const runtimeAuthority: P10B18ARuntimeAuthority =
    authority.fixtureAuthority === "p10b16p04j-aurum-approved"
      ? "p04-integrated-mock"
      : "p03-standalone";
  const manifest: P10B18AStoreManifestEntry = {
    caseId: `p10b18b03-${definition.key}`,
    fixtureAuthority: authority.fixtureAuthority,
    fixtureKind: authority.fixtureKind,
    fixtureSourceDraftId: authority.fixtureSetup.sourceDraftId,
    fixtureSourceDraftKind: authority.fixtureSetup.sourceDraftKind,
    runtimeAuthority,
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
    approvedAssetRoleSelections: result.synthesisDecision.approvedAssetRoleSelections,
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
    },
    componentVariants: result.synthesisDecision.componentChoices.map(
      ({ component, variant, anatomyId }) => ({ component, variant, anatomyId }),
    ),
    homepageComponentSequence: result.synthesisDecision.componentChoices
      .filter(({ pageKey }) => pageKey === homepageProfileSelection.pageKey)
      .map(({ slotId, component, variant }) => ({ slotId, component, variant })),
    selectionSummary: {
      discoveryPosture: variation.drivers.discoveryPosture,
      collectionProfileId: result.compiledDecision.profiles.collection.profileId,
      searchProfileId: result.compiledDecision.profiles.search.profileId,
      collectionArchetypeId: dynamic.collectionArchetypeId,
      searchArchetypeId: dynamic.searchArchetypeId,
      productCardAnatomyIds: result.compiledDecision.productCardAnatomyIds,
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
  return { definition, authority, result, snapshot, aggregate, manifest };
}

type Geometry = Readonly<{
  runtimeContext: "collection" | "search";
  presentationMode: string;
  cardinality: string;
  orientationHeight: number;
  firstCardTop: number | null;
  filterHeight: number;
  grid: Readonly<{ top: number; width: number; height: number }> | null;
  cards: readonly Readonly<{
    anatomy: string;
    width: number;
    height: number;
    actionTop: number | null;
  }>[];
  largestVerticalGap: number;
  productCount: number;
  effectiveFacetCount: number;
  searchHeaderHeight: number;
  searchResultCount: number | null;
  searchQuery: string | null;
  searchStateSummary: boolean;
  campaignAssetRole: string | null;
  horizontalOverflow: boolean;
}>;

async function inspectCommerce(page: Page): Promise<Geometry> {
  return page.locator(".project-preview__storefront").evaluate((root) => {
    const commerce = root.querySelector<HTMLElement>(
      "[data-component='dynamicCollectionCommerce']",
    );
    if (!commerce) throw new Error("Missing dynamic collection/search renderer.");
    const rect = (element: Element | null) => element?.getBoundingClientRect() ?? null;
    const header = commerce.querySelector(":scope > header");
    const filter = commerce.querySelector("[data-layout-region='filters']");
    const products = commerce.querySelector("[data-layout-region='products']");
    const grid = commerce.querySelector("[data-canonical-product-count]");
    const searchStatus = commerce.querySelector<HTMLElement>("[data-search-result-count]");
    const cards = [...commerce.querySelectorAll<HTMLElement>("article[data-card-anatomy]")].map(
      (card) => {
        const bounds = card.getBoundingClientRect();
        const action = card.querySelector("[data-card-region='actions']");
        return {
          anatomy: card.dataset.cardAnatomy ?? "",
          width: Math.round(bounds.width),
          height: Math.round(bounds.height),
          actionTop: action ? Math.round(action.getBoundingClientRect().top) : null,
        };
      },
    );
    const meaningful = [...commerce.children]
      .map((child) => child.getBoundingClientRect())
      .filter(({ height }) => height > 0)
      .sort((left, right) => left.top - right.top);
    const gaps = meaningful
      .slice(1)
      .map((bounds, index) => Math.max(0, Math.round(bounds.top - meaningful[index].bottom)));
    const gridBounds = rect(grid);
    const firstCard = commerce.querySelector("article[data-card-anatomy]");
    const searchHeader = products?.firstElementChild ?? null;
    return {
      runtimeContext:
        commerce.dataset.searchContext === "transient-canonical-results" ? "search" : "collection",
      presentationMode: commerce.dataset.presentationMode ?? "",
      cardinality: commerce.dataset.catalogueCardinality ?? "",
      orientationHeight: Math.round(rect(header)?.height ?? 0),
      firstCardTop: firstCard
        ? Math.round(firstCard.getBoundingClientRect().top + window.scrollY)
        : null,
      filterHeight: Math.round(rect(filter)?.height ?? 0),
      grid: gridBounds
        ? {
            top: Math.round(gridBounds.top + window.scrollY),
            width: Math.round(gridBounds.width),
            height: Math.round(gridBounds.height),
          }
        : null,
      cards,
      largestVerticalGap: gaps.length ? Math.max(...gaps) : 0,
      productCount: Number(grid?.getAttribute("data-canonical-product-count") ?? 0),
      effectiveFacetCount: Number(filter?.getAttribute("data-eligible-filter-count") ?? 0),
      searchHeaderHeight: Math.round(rect(searchHeader)?.height ?? 0),
      searchResultCount: searchStatus
        ? Number(searchStatus.getAttribute("data-search-result-count"))
        : null,
      searchQuery: searchStatus?.getAttribute("data-search-query") ?? null,
      searchStateSummary: Boolean(commerce.querySelector("[data-search-state-summary='true']")),
      campaignAssetRole:
        commerce
          .querySelector("[data-layout-region='campaign-lead']")
          ?.getAttribute("data-asset-role") ?? null,
      horizontalOverflow: commerce.scrollWidth > commerce.clientWidth + 1,
    };
  });
}

function routeFor(entry: CapturePlanEntry, store: Store): string {
  if (entry.surface === "home") return "/";
  if (entry.surface === "collection") return store.manifest.representativeRoutes.collection;
  if (entry.query === "multiple") return "/search?q=Lumoava&sort=price-ascending";
  if (entry.query === "one") return "/search?q=Kohinoor";
  return "/search?q=zzzz-no-result";
}

test.describe.configure({ timeout: 1_800_000 });

test("retains twenty-one collection, search and product-card quality captures", async ({
  browser,
  browserName,
}, testInfo: TestInfo) => {
  test.skip(browserName !== "chromium", "P10B-18B-03 retains one deterministic Chromium run.");
  expect(capturePlan).toHaveLength(21);
  const authorities = new Map(
    createP10b18aShapeAuthorities([...new Set(cases.map(({ shapeId }) => shapeId))]).map(
      (authority) => [authority.id, authority],
    ),
  );
  const stores = cases.map((definition) => compileCase(definition, authorities));
  expect(
    Object.fromEntries(
      stores.map(({ definition, manifest }) => [
        definition.key,
        [manifest.profiles.collection, manifest.profiles.search],
      ]),
    ),
  ).toEqual({
    "editorial-low": ["collection-editorial-discovery", "collection-dense-search"],
    "editorial-rich": ["collection-editorial-discovery", "collection-dense-search"],
    comparison: ["collection-catalogue-comparison", "collection-catalogue-comparison"],
    campaign: ["collection-campaign-led-discovery", "collection-dense-search"],
    dense: ["collection-dense-search", "collection-dense-search"],
    "minimal-dense": ["collection-dense-search", "collection-dense-search"],
  });

  const context = await browser.newContext({ baseURL: p10b18aOrigin() });
  const page = await context.newPage();
  const ledger = await installP10B18AOfflineAuthority(page);
  const captures: Array<
    P10B18AEvidenceEntry &
      Readonly<{ storeKey: CaseKey; query?: CapturePlanEntry["query"]; geometry: Geometry }>
  > = [];
  const storage: Array<Readonly<{ storeKey: CaseKey; persisted: string; reloaded: string }>> = [];
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
        );
        if (!persisted) throw new Error(`${store.definition.key} lacks its persisted draft.`);
        expect(canonicalStorefrontContentFingerprint(persisted)).toBe(
          store.manifest.candidateSnapshotFingerprint,
        );
        for (const entry of capturePlan.filter(
          ({ storeKey }) => storeKey === store.definition.key,
        )) {
          const profileOrArchetype =
            entry.surface === "home"
              ? store.manifest.profiles.homepage
              : entry.surface === "search"
                ? store.manifest.archetypes.search
                : store.manifest.archetypes.collection;
          const captureStore = entry.query
            ? { ...store.manifest, caseId: `${store.manifest.caseId}-${entry.query}` }
            : store.manifest;
          const base = await captureP10B18AEvidence({
            page,
            store: captureStore,
            surface: entry.surface,
            route: routeFor(entry, store),
            width: entry.width,
            profileOrArchetype,
          });
          const geometry = entry.surface === "home" ? null : await inspectCommerce(page);
          if (geometry) {
            expect(geometry.horizontalOverflow).toBe(false);
            expect(geometry.largestVerticalGap).toBeLessThanOrEqual(180);
            expect(geometry.cards.every(({ width, height }) => width > 0 && height > 0)).toBe(true);
            if (entry.surface === "collection") {
              expect(geometry.runtimeContext).toBe("collection");
              expect(geometry.orientationHeight).toBeLessThanOrEqual(600);
              expect(geometry.firstCardTop).toBeLessThanOrEqual(1_300);
              expect(geometry.filterHeight).toBeLessThanOrEqual(70);
              expect(geometry.productCount).toBe(
                store.manifest.representativeContext.collectionProductCount,
              );
              expect(geometry.firstCardTop).not.toBeNull();
              if (geometry.productCount === 1 && entry.width === 1440) {
                expect(geometry.grid?.width).toBeLessThanOrEqual(500);
                expect(geometry.filterHeight).toBe(0);
              }
            } else {
              expect(geometry.runtimeContext).toBe("search");
              expect(geometry.orientationHeight).toBe(0);
              expect(geometry.firstCardTop ?? 0).toBeLessThanOrEqual(500);
              expect(geometry.searchStateSummary).toBe(true);
              if (entry.query === "multiple") {
                expect(geometry.searchResultCount).toBeGreaterThan(1);
                expect(geometry.searchQuery).toBe("Lumoava");
                if (store.definition.key === "dense" && entry.width === 1440) {
                  expect(geometry.cards.every(({ width }) => width >= 800)).toBe(true);
                }
              } else if (entry.query === "one") {
                expect(geometry.searchResultCount).toBe(1);
                expect(geometry.cards).toHaveLength(1);
                expect(geometry.grid?.width).toBeLessThanOrEqual(500);
              } else {
                expect(geometry.searchResultCount).toBe(0);
                expect(geometry.cards).toHaveLength(0);
                expect(geometry.grid).toBeNull();
              }
            }
          }
          captures.push({
            ...base,
            storeKey: store.definition.key,
            ...(entry.query ? { query: entry.query } : {}),
            geometry: geometry ?? {
              runtimeContext: "collection",
              presentationMode: "homepage-card-witness",
              cardinality: "n/a",
              orientationHeight: 0,
              firstCardTop: null,
              filterHeight: 0,
              grid: null,
              cards: [],
              largestVerticalGap: 0,
              productCount: base.productCardCount,
              effectiveFacetCount: 0,
              searchHeaderHeight: 0,
              searchResultCount: null,
              searchQuery: null,
              searchStateSummary: false,
              campaignAssetRole: null,
              horizontalOverflow: false,
            },
          });
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
        );
        if (!reloadedDraft) throw new Error(`${store.definition.key} lacks its reloaded draft.`);
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

  expect(captures).toHaveLength(21);
  expect(storage.every(({ persisted, reloaded }) => persisted === reloaded)).toBe(true);
  const anatomyWitnesses = new Set(
    captures.flatMap(({ renderedComponentVariants, geometry }) => [
      ...geometry.cards.map(({ anatomy }) => anatomy),
      ...renderedComponentVariants.flatMap((value) =>
        ["standard", "editorial", "compact", "imageFirst", "horizontal"].filter((anatomy) =>
          value.endsWith(`:${anatomy}`),
        ),
      ),
    ]),
  );
  expect([...anatomyWitnesses].sort()).toEqual([
    "compact",
    "editorial",
    "horizontal",
    "imageFirst",
    "standard",
  ]);
  const campaignCaptures = captures.filter(
    ({ storeKey, surface }) => storeKey === "campaign" && surface === "collection",
  );
  expect(campaignCaptures).toHaveLength(2);
  expect(
    campaignCaptures.every(({ geometry }) => geometry.campaignAssetRole === "editorialImage"),
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
    "p10b-18b-03-collection-search-product-card-quality-manifest.json",
  );
  await writeFile(
    manifestPath,
    `${JSON.stringify(
      {
        contractVersion: "p10b-18b-03-collection-search-card-browser-evidence-v1",
        runId: p10b18aEvidenceRunId(),
        captureCount: captures.length,
        capturePlan,
        stores: stores.map(({ definition, manifest }) => ({
          key: definition.key,
          shapeId: manifest.shapeId,
          directionId: manifest.directionId,
          frame: manifest.frame,
          profiles: manifest.profiles,
          archetypes: manifest.archetypes,
          selectionSummary: manifest.selectionSummary,
          collectionProductCount: manifest.representativeContext.collectionProductCount,
          normalizedAuthorityTopologyFingerprint: manifest.normalizedAuthorityTopologyFingerprint,
          commerceFingerprint: manifest.commerceFingerprintAfter,
          mediaFingerprint: manifest.mediaFingerprintAfter,
        })),
        storage,
        captures,
        requestLedger: ledger,
      },
      null,
      2,
    )}\n`,
    "utf8",
  );
  await testInfo.attach("p10b-18b-03-collection-search-card-browser-manifest", {
    path: manifestPath,
    contentType: "application/json",
  });
});
