// @vitest-environment node

import { describe, expect, it } from "vitest";
import {
  StorefrontProposalAcceptanceCoordinator,
  executeAiStorefrontProposal,
  projectAiStorefrontSnapshot,
} from "@/application/ai-storefront";
import { validateWholeStorefrontProposal } from "@/application/whole-storefront-proposal-lifecycle";
import { createStorefrontProposalReview } from "@/app/projects/[projectId]/editor/storefront-proposal-review";
import { aurumNordicSeed, karvonenSeed } from "@/data/seed";
import {
  canonicalStorefrontContentFingerprint,
  canonicalValueFingerprint,
  canonicalValueString,
  type StorefrontSnapshot,
} from "@/domain/storefront";
import {
  P9_05A_CATALOGUE_ID,
  P9_05A_COMPLEX_PRODUCT_ID,
  P9_05A_PROJECT_ID,
  P9_05A_SIMPLE_PRODUCT_ID,
  assertP905aFixtureIsolation,
  createP905aFreshMerchantFixture,
  p905aDirectionScenarios,
  p905aProtectedCommerceBaseline,
  type P905aDirectionId,
} from "@/data/demo/p9-05a-fresh-store-generation";
import {
  createP905aAcceptanceCoordinator,
  generateP905aScenario,
  p905aScenarioSignature,
  saveAndResolveP905aPreview,
} from "../helpers/p9-05a-generation-harness";

const directionIds: P905aDirectionId[] = [
  "premiumEditorial",
  "modernTechnical",
  "warmApproachable",
];

type Generated = Awaited<ReturnType<typeof generateP905aScenario>>;

const generated = new Map<P905aDirectionId, Generated>();

for (const directionId of directionIds) {
  generated.set(directionId, await generateP905aScenario(directionId));
}

function requiredGenerated(directionId: P905aDirectionId) {
  const value = generated.get(directionId);
  if (!value) throw new Error(`Missing generated ${directionId} scenario.`);
  return value;
}

function acceptedSnapshot(value: Generated) {
  executeAiStorefrontProposal({
    proposal: value.proposal,
    activeDraft: value.fixture.draft,
    catalogue: value.fixture.aggregate.catalogue,
    enabledLocales: value.fixture.aggregate.project.enabledLocales,
    activeLocale: value.fixture.aggregate.project.primaryLocale,
    primaryLocale: value.fixture.aggregate.project.primaryLocale,
  });
  const coordinator = createP905aAcceptanceCoordinator(value);
  const result = coordinator.accept();
  expect(result.failure).toBeNull();
  expect(result.state).toBe("accepted");
  return { coordinator, accepted: result.activeDraft };
}

function corePage(snapshot: StorefrontSnapshot, type: "home" | "collection" | "product") {
  const page = snapshot.pages.find((candidate) => candidate.type === type);
  if (!page) throw new Error(`Missing generated ${type} page.`);
  return page;
}

function presentationAssetIds(snapshot: StorefrontSnapshot) {
  return snapshot.pages.flatMap((page) =>
    page.sections.flatMap((section) => {
      const media =
        section.content.media &&
        typeof section.content.media === "object" &&
        "id" in section.content.media &&
        typeof section.content.media.id === "string"
          ? [section.content.media.id]
          : [];
      const approvedAsset =
        typeof section.content.approvedAssetId === "string"
          ? [section.content.approvedAssetId]
          : [];
      return [...media, ...approvedAsset];
    }),
  );
}

describe("P9-05A fresh-store generation demo foundation", () => {
  it("builds a valid isolated minimal merchant fixture with simple and complex commerce", () => {
    const fixture = createP905aFreshMerchantFixture("premiumEditorial");
    const simple = fixture.aggregate.catalogue.products.find(
      (product) => product.id === P9_05A_SIMPLE_PRODUCT_ID,
    );
    const complex = fixture.aggregate.catalogue.products.find(
      (product) => product.id === P9_05A_COMPLEX_PRODUCT_ID,
    );

    expect(fixture.aggregate.project).toMatchObject({
      id: P9_05A_PROJECT_ID,
      primaryLocale: "fi",
      enabledLocales: ["en", "fi"],
    });
    expect(fixture.aggregate.catalogue.id).toBe(P9_05A_CATALOGUE_ID);
    expect(fixture.brief.status).toBe("approved");
    expect(fixture.assetContext.assets.map((asset) => asset.role)).toEqual([
      "logo",
      "heroDesktop",
      "editorialImage",
      "collectionImage",
    ]);
    expect(simple).toMatchObject({
      sku: "LUMO-STUD-01",
      productType: "earrings",
      stockStatus: "inStock",
      variants: [],
    });
    expect(simple?.orderOptions).toBeUndefined();
    expect(complex).toMatchObject({
      sku: "LUMO-RING-CUSTOM",
      productType: "ring",
      stockStatus: "lowStock",
    });
    expect(complex?.variants).toHaveLength(3);
    expect(complex?.orderOptions).toHaveLength(5);
    expect(fixture.draft.pages.map((page) => page.type)).toEqual(["home", "collection", "product"]);
    expect(
      fixture.draft.pages.flatMap((page) =>
        page.sections.filter((section) =>
          ["dynamicCollectionCommerce", "dynamicProductDetail", "brandStory"].includes(
            section.component,
          ),
        ),
      ),
    ).toEqual([]);

    const isolation = assertP905aFixtureIsolation();
    expect(isolation).toEqual({
      containsAurum: false,
      containsKarvonen: false,
      projectId: P9_05A_PROJECT_ID,
      catalogueId: P9_05A_CATALOGUE_ID,
      snapshotIds: ["snapshot_lumo_fresh_published", "snapshot_lumo_fresh_draft"],
    });
    expect(P9_05A_PROJECT_ID).not.toBe(aurumNordicSeed.project.id);
    expect(P9_05A_PROJECT_ID).not.toBe(karvonenSeed.project.id);
    expect(P9_05A_CATALOGUE_ID).not.toBe(aurumNordicSeed.catalogue.id);
    expect(P9_05A_CATALOGUE_ID).not.toBe(karvonenSeed.catalogue.id);

    const materialAcrossDirections = directionIds.map((directionId) => {
      const value = createP905aFreshMerchantFixture(directionId);
      return {
        catalogue: canonicalValueString(value.aggregate.catalogue),
        assets: canonicalValueString(value.assetContext.assets),
      };
    });
    expect(new Set(materialAcrossDirections.map((value) => value.catalogue)).size).toBe(1);
    expect(new Set(materialAcrossDirections.map((value) => value.assets)).size).toBe(1);
  });

  it("creates deterministic registered plans and replayable proposal envelopes for all directions", () => {
    directionIds.forEach((directionId) => {
      const value = requiredGenerated(directionId);
      const expected = p905aDirectionScenarios[directionId].expected;

      expect(value.plan.designSystemSelection).toMatchObject({
        directionId,
        homepageRecipeId: expected.homepageRecipeId,
        productCardFamilyId: expected.productCardFamilyId,
        collectionPresentation: expected.collectionPresentation,
        productPresentation: expected.productPresentation,
        typographyDirectionId: expected.typographyDirectionId,
        spacingDensity: expected.spacingDensity,
        cornerTreatment: expected.cornerTreatment,
        surfaceDepth: expected.surfaceDepth,
        imageTreatmentId: expected.imageTreatmentId,
      });
      expect(
        validateWholeStorefrontProposal(value.compiledProposal, {
          plan: value.plan,
          planningInput: value.planningInput,
        }),
      ).toEqual(value.compiledProposal);
      expect(value.envelope.metadata).toMatchObject({
        authoritativePlanningFingerprint: value.plan.fingerprint,
        wholeStorefrontProposalFingerprint: canonicalValueFingerprint(value.compiledProposal),
      });
      expect(value.proposal.validation).toEqual({ valid: true, errors: [] });
      expect(value.proposal.status).toBe("pending");
      expect(value.proposal.target.affectedPageIds).toEqual(
        [...value.fixture.draft.pages.map((page) => page.id)].sort(),
      );
      expect(
        value.proposal.operations.filter((entry) => entry.target.kind === "page"),
      ).toHaveLength(3);
    });
  });

  it("proves exact structural differences across homepage, collection, PDP and design groups", () => {
    const signatures = Object.fromEntries(
      directionIds.map((directionId) => {
        const value = requiredGenerated(directionId);
        const { accepted } = acceptedSnapshot(value);
        return [directionId, p905aScenarioSignature({ plan: value.plan, accepted })];
      }),
    ) as Record<P905aDirectionId, ReturnType<typeof p905aScenarioSignature>>;

    directionIds.forEach((directionId) => {
      const expected = p905aDirectionScenarios[directionId].expected;
      expect(signatures[directionId]).toMatchObject({
        directionId,
        homepageRecipeId: expected.homepageRecipeId,
        homepageOrder: expected.homepageOrder,
        heroVariant: expected.heroVariant,
        productCardFamilyId: expected.productCardFamilyId,
        collectionPresentation: expected.collectionPresentation,
        productPresentation: expected.productPresentation,
        typographyDirectionId: expected.typographyDirectionId,
        spacingDensity: expected.spacingDensity,
        cornerTreatment: expected.cornerTreatment,
        surfaceDepth: expected.surfaceDepth,
        imageTreatmentId: expected.imageTreatmentId,
      });
    });

    const pairs: Array<[P905aDirectionId, P905aDirectionId]> = [
      ["premiumEditorial", "modernTechnical"],
      ["premiumEditorial", "warmApproachable"],
      ["modernTechnical", "warmApproachable"],
    ];
    pairs.forEach(([leftId, rightId]) => {
      const left = signatures[leftId];
      const right = signatures[rightId];
      expect(left.homepageOrder).not.toEqual(right.homepageOrder);
      expect(left.collectionPresentation).not.toEqual(right.collectionPresentation);
      expect(left.productPresentation).not.toEqual(right.productPresentation);
      const beyondColourDifferences = [
        left.typographyDirectionId !== right.typographyDirectionId,
        left.spacingDensity !== right.spacingDensity,
        left.cornerTreatment !== right.cornerTreatment,
        left.surfaceDepth !== right.surfaceDepth,
        left.imageTreatmentId !== right.imageTreatmentId,
        left.productCardFamilyId !== right.productCardFamilyId,
      ].filter(Boolean);
      expect(beyondColourDifferences.length).toBeGreaterThanOrEqual(2);
      expect(left.acceptedFingerprint).not.toBe(right.acceptedFingerprint);
    });
  });

  it("generates one coordinated reviewable core storefront using only approved assets and bindings", () => {
    directionIds.forEach((directionId) => {
      const value = requiredGenerated(directionId);
      const review = createStorefrontProposalReview(value.proposal, "fi", "fi");
      const { accepted } = acceptedSnapshot(value);
      const homepage = corePage(accepted, "home");
      const collection = corePage(accepted, "collection");
      const product = corePage(accepted, "product");
      const collectionCommerce = collection.sections.find(
        (section) => section.component === "dynamicCollectionCommerce",
      );
      const productDetail = product.sections.find(
        (section) => section.component === "dynamicProductDetail",
      );

      expect(review.complete).toBe(true);
      expect(review.blockers).toEqual([]);
      expect(review.affectedPageCount).toBe(3);
      expect(homepage.sections.some((section) => section.component === "homepageHero")).toBe(true);
      expect(collectionCommerce?.content).toMatchObject({
        collectionId: "collection_lumo_jewellery",
        productIds: [P9_05A_SIMPLE_PRODUCT_ID, P9_05A_COMPLEX_PRODUCT_ID],
      });
      expect(productDetail?.content).toMatchObject({
        productId: P9_05A_COMPLEX_PRODUCT_ID,
        relatedProductIds: [],
      });
      expect(accepted.navigation).toEqual(value.fixture.draft.navigation);
      expect(value.plan.canonicalCommerceBindings).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            source: "collection",
            collectionId: "collection_lumo_jewellery",
          }),
          expect.objectContaining({
            source: "product",
            productId: P9_05A_COMPLEX_PRODUCT_ID,
          }),
          expect.objectContaining({
            source: "productList",
            productIds: [P9_05A_SIMPLE_PRODUCT_ID, P9_05A_COMPLEX_PRODUCT_ID],
          }),
        ]),
      );

      const approvedAssetIds = new Set(
        value.fixture.assetContext.assets.map((asset) => asset.assetId),
      );
      presentationAssetIds(accepted).forEach((assetId) => {
        expect(approvedAssetIds.has(assetId)).toBe(true);
      });
      const canonicalProductMedia = new Set(
        value.fixture.aggregate.catalogue.products.flatMap((candidate) =>
          candidate.images.map((image) => image.id),
        ),
      );
      expect([...canonicalProductMedia]).toEqual([
        "media_lumo_studs_main",
        "media_lumo_ring_main",
        "media_lumo_ring_detail",
      ]);
      expect(value.proposal.assetPlacementOperations).toEqual(value.plan.approvedAssetPlacements);
      expect(value.proposal.targetFingerprint).toBe(value.request.targetFingerprint);
      expect(value.proposal.permissionFingerprint).toBe(value.request.permissionFingerprint);
    });
  });

  it("preserves exact baseline through review, then accepts, undoes and redoes atomically", () => {
    const value = requiredGenerated("warmApproachable");
    const originalFixture = createP905aFreshMerchantFixture("warmApproachable");
    const commerceBaseline = p905aProtectedCommerceBaseline(value.fixture.aggregate.catalogue);
    const coordinator = createP905aAcceptanceCoordinator(value);
    const ready = coordinator.inspect();

    expect(ready.state).toBe("ready");
    expect(ready.activeDraft).toEqual(value.fixture.draft);
    expect(ready.storedDraft).toEqual(value.fixture.draft);
    expect(ready.publishedSnapshot).toEqual(value.fixture.published);
    expect(coordinator.inspectHistory()).toEqual({ past: [], future: [] });
    expect(value.fixture).toEqual(originalFixture);

    const accepted = coordinator.accept();
    expect(accepted.state).toBe("accepted");
    expect(accepted.activeDraft).not.toEqual(value.fixture.draft);
    expect(projectAiStorefrontSnapshot(accepted.activeDraft)).toEqual(
      value.proposal.proposedStorefront,
    );
    expect(accepted.storedDraft).toEqual(value.fixture.draft);
    expect(accepted.publishedSnapshot).toEqual(value.fixture.published);
    expect(coordinator.inspectHistory().past).toHaveLength(1);
    expect(coordinator.inspectHistory().future).toEqual([]);

    expect(coordinator.undo()).toEqual(value.fixture.draft);
    expect(coordinator.inspectHistory()).toMatchObject({
      past: [],
      future: [expect.objectContaining({ proposalId: value.proposal.id })],
    });
    expect(coordinator.redo()).toEqual(accepted.activeDraft);
    expect(coordinator.inspectHistory()).toMatchObject({
      past: [expect.objectContaining({ proposalId: value.proposal.id })],
      future: [],
    });
    expect(p905aProtectedCommerceBaseline(value.fixture.aggregate.catalogue)).toEqual(
      commerceBaseline,
    );
  });

  it("saves the accepted storefront for draft preview without changing published or commerce truth", async () => {
    const value = requiredGenerated("premiumEditorial");
    const commerceBaseline = p905aProtectedCommerceBaseline(value.fixture.aggregate.catalogue);
    const publishedFingerprint = canonicalStorefrontContentFingerprint(value.fixture.published);
    const { accepted } = acceptedSnapshot(value);
    const result = await saveAndResolveP905aPreview({ generated: value, accepted });

    expect(result.saved.aggregate.project.draftSnapshotId).toBe(
      "snapshot_lumo_saved_premium_editorial",
    );
    expect(result.saved.draft.id).toBe("snapshot_lumo_saved_premium_editorial");
    expect(canonicalStorefrontContentFingerprint(result.saved.draft)).toBe(
      canonicalStorefrontContentFingerprint(accepted),
    );
    expect(result.preview).toEqual(result.saved.draft);
    expect(result.previewPath).toBe(`/projects/${P9_05A_PROJECT_ID}`);
    const published = result.saved.aggregate.snapshots.find(
      (snapshot) => snapshot.id === result.saved.aggregate.project.publishedSnapshotId,
    );
    expect(published).toBeDefined();
    expect(canonicalStorefrontContentFingerprint(published!)).toBe(publishedFingerprint);
    expect(p905aProtectedCommerceBaseline(result.saved.aggregate.catalogue)).toEqual(
      commerceBaseline,
    );
  });

  it("keeps draft, history and published state unchanged for rejected, stale and invalid proposals", () => {
    const value = requiredGenerated("modernTechnical");

    const rejected = createP905aAcceptanceCoordinator(value);
    expect(rejected.reject()).toMatchObject({
      state: "rejected",
      activeDraft: value.fixture.draft,
      publishedSnapshot: value.fixture.published,
    });
    expect(rejected.inspectHistory()).toEqual({ past: [], future: [] });

    const staleDraft = structuredClone(value.fixture.draft);
    staleDraft.pages[0].seo.title.en = "A newer valid storefront title";
    const stale = new StorefrontProposalAcceptanceCoordinator({
      proposal: value.proposal,
      activeDraft: staleDraft,
      storedDraft: value.fixture.draft,
      publishedSnapshot: value.fixture.published,
      catalogue: value.fixture.aggregate.catalogue,
      enabledLocales: value.fixture.aggregate.project.enabledLocales,
      activeLocale: value.fixture.aggregate.project.primaryLocale,
      primaryLocale: value.fixture.aggregate.project.primaryLocale,
    });
    const staleBefore = stale.inspect();
    expect(stale.accept()).toMatchObject({
      state: "stale",
      activeDraft: staleBefore.activeDraft,
      storedDraft: staleBefore.storedDraft,
      publishedSnapshot: staleBefore.publishedSnapshot,
      failure: { code: "stale" },
    });
    expect(stale.inspectHistory()).toEqual({ past: [], future: [] });

    const invalidProposal = structuredClone(value.proposal);
    const pageOperation = invalidProposal.operations.find((entry) => entry.target.kind === "page");
    if (!pageOperation) throw new Error("Missing P9-05A page operation.");
    pageOperation.target = { kind: "page", pageId: "page_lumo_unknown" };
    const invalid = new StorefrontProposalAcceptanceCoordinator({
      proposal: invalidProposal,
      activeDraft: value.fixture.draft,
      storedDraft: value.fixture.draft,
      publishedSnapshot: value.fixture.published,
      catalogue: value.fixture.aggregate.catalogue,
      enabledLocales: value.fixture.aggregate.project.enabledLocales,
      activeLocale: value.fixture.aggregate.project.primaryLocale,
      primaryLocale: value.fixture.aggregate.project.primaryLocale,
    });
    expect(invalid.accept()).toMatchObject({
      state: "failed",
      activeDraft: value.fixture.draft,
      storedDraft: value.fixture.draft,
      publishedSnapshot: value.fixture.published,
      failure: { code: "invalidProposal" },
    });
    expect(invalid.inspectHistory()).toEqual({ past: [], future: [] });
  });

  it("records the current representative-PDP capability boundary instead of inventing pages", () => {
    directionIds.forEach((directionId) => {
      const value = requiredGenerated(directionId);
      const productPlans = value.plan.pagePlans.filter((page) => page.role === "product-template");
      const boundProducts = value.plan.canonicalCommerceBindings.flatMap((binding) =>
        binding.source === "product" ? [binding.productId] : [],
      );

      expect(value.fixture.aggregate.catalogue.products.map((product) => product.id)).toEqual([
        P9_05A_SIMPLE_PRODUCT_ID,
        P9_05A_COMPLEX_PRODUCT_ID,
      ]);
      expect(productPlans).toHaveLength(1);
      expect(boundProducts).toEqual([P9_05A_COMPLEX_PRODUCT_ID]);
    });
  });

  it("contains no operational commerce model or protected fact payload in proposals", () => {
    const protectedKeys = [
      "payments",
      "taxes",
      "shipping",
      "orders",
      "inventory",
      "sku",
      "price",
      "compareAtPrice",
      "stockStatus",
      "variants",
      "orderOptions",
    ];
    directionIds.forEach((directionId) => {
      const value = requiredGenerated(directionId);
      const serialized = JSON.stringify({
        pages: value.proposal.proposedStorefront.pages,
        navigation: value.proposal.proposedStorefront.navigation,
      });
      protectedKeys.forEach((key) => expect(serialized).not.toContain(`"${key}"`));
      expect(
        value.proposal.proposedStorefront.brandSystem.designDna?.typography.roles.price,
      ).toBeDefined();
      expect(Object.keys(value.fixture.aggregate.catalogue).sort()).toEqual([
        "collections",
        "id",
        "products",
      ]);
      expect(p905aProtectedCommerceBaseline(value.fixture.aggregate.catalogue)).toEqual(
        p905aProtectedCommerceBaseline(
          createP905aFreshMerchantFixture(directionId).aggregate.catalogue,
        ),
      );
    });
  });
});
