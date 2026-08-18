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
  type P10B18AWidth,
} from "./p10b-18a-browser-evidence";

type CaseDefinition = Readonly<{
  key:
    | "premium-rich-primary"
    | "premium-rich-alternate"
    | "modern-medium-primary"
    | "modern-medium-alternate"
    | "minimal-medium-primary"
    | "minimal-medium-alternate"
    | "sparse-gateway";
  shapeId:
    "aurum-approved-presentation-image-rich" | "medium-mixed-jewellery" | "image-evidence-poor";
  variationId: (typeof p10b18aSemanticVariations)[number]["id"];
}>;

const cases = [
  {
    key: "premium-rich-primary",
    shapeId: "aurum-approved-presentation-image-rich",
    variationId: "premium-story-image",
  },
  {
    key: "premium-rich-alternate",
    shapeId: "aurum-approved-presentation-image-rich",
    variationId: "premium-conversion-led",
  },
  {
    key: "modern-medium-primary",
    shapeId: "medium-mixed-jewellery",
    variationId: "technical-catalogue-dense",
  },
  {
    key: "modern-medium-alternate",
    shapeId: "medium-mixed-jewellery",
    variationId: "technical-conversion-contained",
  },
  {
    key: "minimal-medium-primary",
    shapeId: "medium-mixed-jewellery",
    variationId: "minimal-product-first",
  },
  {
    key: "minimal-medium-alternate",
    shapeId: "medium-mixed-jewellery",
    variationId: "minimal-story-airy",
  },
  {
    key: "sparse-gateway",
    shapeId: "image-evidence-poor",
    variationId: "technical-conversion-contained",
  },
] as const satisfies readonly CaseDefinition[];

const capturePlan = [
  ...([375, 768, 1024, 1440] as const).map((width) => ({
    storeKey: "premium-rich-primary" as const,
    width,
  })),
  ...([375, 1440] as const).map((width) => ({
    storeKey: "premium-rich-alternate" as const,
    width,
  })),
  ...([375, 1440] as const).map((width) => ({
    storeKey: "modern-medium-primary" as const,
    width,
  })),
  { storeKey: "modern-medium-alternate" as const, width: 1440 as const },
  ...([375, 1440] as const).map((width) => ({
    storeKey: "minimal-medium-primary" as const,
    width,
  })),
  { storeKey: "minimal-medium-alternate" as const, width: 1440 as const },
  ...([375, 1440] as const).map((width) => ({
    storeKey: "sparse-gateway" as const,
    width,
  })),
] satisfies readonly Readonly<{ storeKey: CaseDefinition["key"]; width: P10B18AWidth }>[];

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
    designConceptSummary: `${authority.id}:${variation.id}:p10b-18b-02`,
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
  if (!homepageProfileSelection) throw new Error(`${definition.key} lacks a homepage selection.`);
  const collectionRoute = authority.representativeRoutes.collection;
  const productRoute =
    authority.representativeRoutes.highConsiderationProduct ??
    authority.representativeRoutes.configurableProduct ??
    authority.representativeRoutes.simpleProduct;
  if (!collectionRoute || !productRoute) throw new Error(`${definition.key} lacks routes.`);
  const collection = authority.catalogue.collections[0];
  const product = authority.catalogue.products[0];
  if (!collection || !product) throw new Error(`${definition.key} lacks canonical commerce.`);
  const runtimeAuthority: P10B18ARuntimeAuthority =
    authority.fixtureAuthority === "p10b16p04j-aurum-approved"
      ? "p04-integrated-mock"
      : "p03-standalone";
  const manifest: P10B18AStoreManifestEntry = {
    caseId: `p10b18b02-${definition.key}`,
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
      storyCatalogueBalance: variation.drivers.storyCatalogueBalance,
      homepageProfileId: result.compiledDecision.profiles.homepage.profileId,
      transitionIntents: result.synthesisDecision.componentChoices
        .filter(({ pageKey }) => pageKey === homepageProfileSelection.pageKey)
        .map(({ transitionIntent }) => transitionIntent),
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

type HomepageGeometry = Readonly<{
  documentHeight: number;
  viewportHeight: number;
  firstActionOrDiscoveryTop: number | null;
  maximumGap: number;
  placeholders: readonly string[];
  sections: readonly Readonly<{
    component: string;
    variant: string;
    top: number;
    height: number;
    meaningfulNodeCount: number;
    internalHorizontalOverflow: boolean;
    catalogueScale: string | null;
    regions: readonly string[];
    labels: readonly string[];
  }>[];
}>;

async function inspectHomepage(page: Page): Promise<HomepageGeometry> {
  return page.locator(".project-preview__storefront").evaluate((root) => {
    const visible = (element: Element) => (element as HTMLElement).getClientRects().length > 0;
    const nodes = [...root.querySelectorAll<HTMLElement>("main [data-component^='homepage']")];
    const sections = nodes.map((node) => {
      const rect = node.getBoundingClientRect();
      const labels = [...node.querySelectorAll<HTMLElement>("button, h1, h2, h3")]
        .filter(visible)
        .map((element) => element.textContent?.trim() ?? "")
        .filter(Boolean);
      return {
        component: node.dataset.component ?? "",
        variant: node.dataset.variant ?? "",
        top: Math.round(rect.top + window.scrollY),
        height: Math.round(rect.height),
        meaningfulNodeCount: node.querySelectorAll("h1,h2,h3,p,button,article,li,img").length,
        internalHorizontalOverflow: node.scrollWidth > node.clientWidth + 1,
        catalogueScale: node.dataset.catalogueScale ?? null,
        regions: [...node.querySelectorAll<HTMLElement>("[data-region]")]
          .map((element) => element.dataset.region ?? "")
          .filter(Boolean),
        labels,
      };
    });
    const gaps = sections.slice(1).map((section, index) => {
      const previous = sections[index];
      return Math.max(0, section.top - (previous.top + previous.height));
    });
    const firstActionOrDiscovery = root.querySelector<HTMLElement>(
      "main [data-component='homepageHero'] button, main [data-component='homepageFeaturedProducts'] button, main [data-component='homepageFeaturedCollections'] button, main [data-component='homepageCollectionNavigation'] button",
    );
    const placeholders = [...root.querySelectorAll<HTMLElement>("main [class*='placeholder']")]
      .filter(visible)
      .map((element) => element.textContent?.trim() ?? element.className)
      .filter(Boolean);
    return {
      documentHeight: document.documentElement.scrollHeight,
      viewportHeight: window.innerHeight,
      firstActionOrDiscoveryTop: firstActionOrDiscovery
        ? Math.round(firstActionOrDiscovery.getBoundingClientRect().top + window.scrollY)
        : null,
      maximumGap: gaps.length ? Math.max(...gaps) : 0,
      placeholders,
      sections,
    };
  });
}

test.describe.configure({ timeout: 1_800_000 });

test("retains fourteen cross-direction homepage quality captures", async ({
  browser,
  browserName,
}, testInfo: TestInfo) => {
  test.skip(browserName !== "chromium", "P10B-18B-02 retains one deterministic Chromium run.");
  expect(capturePlan).toHaveLength(14);
  const authorities = new Map(
    createP10b18aShapeAuthorities([...new Set(cases.map(({ shapeId }) => shapeId))]).map(
      (authority) => [authority.id, authority],
    ),
  );
  const stores = cases.map((definition) => compileCase(definition, authorities));
  const profileByKey = Object.fromEntries(
    stores.map(({ definition, manifest }) => [definition.key, manifest.profiles.homepage]),
  );
  expect(profileByKey).toEqual({
    "premium-rich-primary": "homepage-campaign-led",
    "premium-rich-alternate": "homepage-high-consideration",
    "modern-medium-primary": "homepage-commerce-led-discovery",
    "modern-medium-alternate": "homepage-collection-gateway",
    "minimal-medium-primary": "homepage-minimal-brand-commerce",
    "minimal-medium-alternate": "homepage-editorial-storytelling",
    "sparse-gateway": "homepage-collection-gateway",
  });
  for (const keys of [
    ["premium-rich-primary", "premium-rich-alternate"],
    ["modern-medium-primary", "modern-medium-alternate"],
    ["minimal-medium-primary", "minimal-medium-alternate"],
  ] as const) {
    const [primary, alternate] = keys.map((key) =>
      stores.find(({ definition }) => definition.key === key)!,
    );
    expect(primary.manifest.directionId).toBe(alternate.manifest.directionId);
    expect(primary.manifest.normalizedAuthorityTopologyFingerprint).not.toBe(
      alternate.manifest.normalizedAuthorityTopologyFingerprint,
    );
  }

  const context = await browser.newContext({ baseURL: p10b18aOrigin() });
  const page = await context.newPage();
  const ledger = await installP10B18AOfflineAuthority(page);
  const captures: Array<
    P10B18AEvidenceEntry & Readonly<{ storeKey: string; geometry: HomepageGeometry }>
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
        );
        if (!persisted) throw new Error(`${store.definition.key} lacks its persisted draft.`);
        expect(canonicalStorefrontContentFingerprint(persisted)).toBe(
          store.manifest.candidateSnapshotFingerprint,
        );
        for (const entry of capturePlan.filter(
          ({ storeKey }) => storeKey === store.definition.key,
        )) {
          const base = await captureP10B18AEvidence({
            page,
            store: store.manifest,
            surface: "home",
            route: "/",
            width: entry.width,
            profileOrArchetype: store.manifest.profiles.homepage,
          });
          const geometry = await inspectHomepage(page);
          expect(
            geometry.sections.map(({ component, variant }) => ({ component, variant })),
          ).toEqual(
            store.manifest.homepageComponentSequence.map(({ component, variant }) => ({
              component,
              variant,
            })),
          );
          expect(geometry.sections.length).toBeGreaterThanOrEqual(4);
          expect(
            geometry.sections.every(({ meaningfulNodeCount }) => meaningfulNodeCount > 0),
          ).toBe(true);
          expect(
            geometry.sections.every(
              ({ internalHorizontalOverflow }) => !internalHorizontalOverflow,
            ),
          ).toBe(true);
          expect(geometry.maximumGap).toBeLessThanOrEqual(geometry.viewportHeight);
          expect(geometry.firstActionOrDiscoveryTop).not.toBeNull();
          expect(geometry.firstActionOrDiscoveryTop!).toBeLessThanOrEqual(
            geometry.viewportHeight * 1.5,
          );
          expect(geometry.placeholders).toEqual([]);
          captures.push({ ...base, storeKey: store.definition.key, geometry });
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

  expect(captures).toHaveLength(14);
  expect(storage.every(({ persisted, reloaded }) => persisted === reloaded)).toBe(true);
  const sparse = captures.filter(({ storeKey }) => storeKey === "sparse-gateway");
  expect(sparse).toHaveLength(2);
  for (const capture of sparse) {
    const collectionSections = capture.geometry.sections.filter(({ component }) =>
      ["homepageFeaturedCollections", "homepageCollectionNavigation"].includes(component),
    );
    expect(collectionSections.map(({ component }) => component)).toEqual([
      "homepageFeaturedCollections",
      "homepageCollectionNavigation",
    ]);
    expect(collectionSections[0].regions).toContain("collection-grid");
    expect(collectionSections[1].regions).toContain("collection-navigation-grid");
  }
  for (const capture of captures) {
    for (const section of capture.geometry.sections) {
      if (section.variant === "serviceAssurance") {
        expect(section.regions).toEqual(expect.arrayContaining(["service", "proof"]));
      }
      if (section.variant === "craftProcess") expect(section.regions).toContain("process");
      if (section.variant === "continuationCta") expect(section.regions).not.toContain("media");
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

  const directory = p10b18aEvidenceDirectory();
  await mkdir(directory, { recursive: true });
  const manifestPath = resolve(
    directory,
    "p10b-18b-02-homepage-editorial-campaign-quality-manifest.json",
  );
  await writeFile(
    manifestPath,
    `${JSON.stringify(
      {
        contractVersion: "p10b-18b-02-homepage-quality-browser-evidence-v1",
        runId: p10b18aEvidenceRunId(),
        captureCount: captures.length,
        capturePlan,
        stores: stores.map(({ definition, manifest }) => ({
          key: definition.key,
          shapeId: manifest.shapeId,
          directionId: manifest.directionId,
          frame: manifest.frame,
          homepageProfileId: manifest.profiles.homepage,
          normalizedAuthorityTopologyFingerprint: manifest.normalizedAuthorityTopologyFingerprint,
          selectionSummary: manifest.selectionSummary,
          homepageComponentSequence: manifest.homepageComponentSequence,
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
  await testInfo.attach("p10b-18b-02-homepage-quality-browser-manifest", {
    path: manifestPath,
    contentType: "application/json",
  });
});
