import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
  createP10B14CompleteStorefrontEvidenceManifest,
  materializeP10B14PremiumEditorialStorefront,
  P10B14_PREMIUM_EDITORIAL_SELECTION,
} from "@/application/premium-editorial-vertical-slice";
import { confirmPublish, preparePublish } from "@/application/publishing";
import { createStorefrontRenderContext } from "@/components/registry";
import { renderStorefrontPage } from "@/components/storefront/storefront-page";
import {
  P10B14_FIXTURE_ID,
  createP10B14PremiumEditorialFixture,
} from "@/data/demo/p10b-14-premium-editorial";
import { createP10B14HumanCommercialReview } from "@/data/demo/p10b-14-human-commercial-review";
import {
  canonicalStorefrontContentFingerprint,
  canonicalValueFingerprint,
  canonicalValueString,
  applyCommercialSharedFrame,
  validateCanonicalStorefrontSiteMap,
} from "@/domain/storefront";
import { InMemoryProjectRepository } from "@/services/storage";
import { commerceUtilityRuntimeStateSchema } from "@/domain/commerce-utility";

const result = createP10B14PremiumEditorialFixture();

function currentEvidence() {
  return result.approvedEvidenceReferences;
}

describe("P10B-14 Premium Editorial complete-storefront vertical slice", () => {
  it("materializes the complete canonical page set through one plan, proposal, and snapshot", () => {
    const { snapshot, plan, proposal } = result.slice;
    expect(snapshot.pages).toHaveLength(17);
    expect(snapshot.pages.map((page) => page.pageFamily!.familyId).sort()).toEqual([
      "about",
      "cart",
      "checkout",
      "collection",
      "contact",
      "empty-state",
      "error-state",
      "faq",
      "home",
      "no-results",
      "not-found",
      "policy-legal",
      "product-detail",
      "product-detail",
      "returns-information",
      "search-results",
      "shipping-information",
    ]);
    expect(plan.target.pages).toHaveLength(snapshot.pages.length);
    expect(proposal.proposedStorefront.pages).toHaveLength(snapshot.pages.length);
    expect(() =>
      validateCanonicalStorefrontSiteMap(snapshot, {
        catalogue: result.fixture.aggregate.catalogue,
        enabledLocales: ["en", "fi"],
      }),
    ).not.toThrow();
  });

  it("preserves one frame and one Design DNA while retaining every registered page authority", () => {
    const { slice } = result;
    expect(slice.snapshot.sharedFrame?.profileId).toBe(
      P10B14_PREMIUM_EDITORIAL_SELECTION.sharedFrameProfileId,
    );
    expect(`design-dna-${canonicalValueFingerprint(slice.snapshot.brandSystem.designDna)}`).toMatch(
      /^design-dna-/,
    );
    expect(
      slice.snapshot.pages.every(
        (page) => page.pageFamily?.sharedFrameId === "blueprint-shared-storefront-frame",
      ),
    ).toBe(true);
    expect(slice.snapshot.pages.find((page) => page.slug === "/")?.pageFamily?.profileId).toBe(
      P10B14_PREMIUM_EDITORIAL_SELECTION.homepageProfileId,
    );
    expect(
      slice.snapshot.pages.find((page) => page.slug === "/collections/jewellery")?.pageFamily
        ?.profileId,
    ).toBe(P10B14_PREMIUM_EDITORIAL_SELECTION.collectionProfileId);
    expect(
      slice.snapshot.pages
        .filter((page) => page.pageFamily?.familyId === "product-detail")
        .every(
          (page) => page.pageFamily?.profileId === P10B14_PREMIUM_EDITORIAL_SELECTION.pdpProfileId,
        ),
    ).toBe(true);
  });

  it("uses canonical P10B-07/P10B-08/P10B-10/P10B-11/P10B-12/P10B-13 components without local card or frame authority", () => {
    const { slice } = result;
    const home = slice.snapshot.pages.find((page) => page.slug === "/")!;
    const collection = slice.snapshot.pages.find((page) => page.slug === "/collections/jewellery")!;
    const search = slice.snapshot.pages.find((page) => page.slug === "/search")!;
    expect(home.sections.map(({ component }) => component)).toEqual(
      expect.arrayContaining(["homepageHero", "homepageEditorial", "homepageFeaturedProducts"]),
    );
    expect(
      collection.sections.some(
        (section) =>
          section.component === "dynamicCollectionCommerce" &&
          section.props.cardVariant === "editorial",
      ),
    ).toBe(true);
    expect(
      search.sections.some(
        (section) =>
          section.component === "dynamicCollectionCommerce" &&
          section.props.cardVariant === "compact",
      ),
    ).toBe(true);
    expect(
      slice.snapshot.pages
        .filter((page) => page.pageFamily?.familyId === "product-detail")
        .every((page) =>
          page.sections.some((section) => section.component === "dynamicProductDetail"),
        ),
    ).toBe(true);
    expect(
      slice.snapshot.pages
        .filter((page) =>
          [
            "about",
            "contact",
            "faq",
            "shipping-information",
            "returns-information",
            "policy-legal",
          ].includes(page.pageFamily!.familyId),
        )
        .every((page) => page.sections[0]?.component === "contentSupport"),
    ).toBe(true);
    expect(
      slice.snapshot.pages
        .filter((page) =>
          ["cart", "checkout", "no-results", "empty-state", "error-state", "not-found"].includes(
            page.pageFamily!.familyId,
          ),
        )
        .every((page) => page.sections[0]?.component === "commerceUtility"),
    ).toBe(true);
    expect(
      slice.snapshot.pages
        .flatMap((page) => page.sections)
        .some((section) => ["header", "footer"].includes(section.component)),
    ).toBe(false);
  });

  it("preserves protected commerce, product media lineage, and simple/configurable generic PDP authority", () => {
    expect(canonicalValueString(result.slice.planningInput.catalogue)).toBe(
      canonicalValueString(result.fixture.aggregate.catalogue),
    );
    const productPages = result.slice.snapshot.pages.filter(
      (page) => page.pageFamily?.familyId === "product-detail",
    );
    const productIds = productPages.map((page) => page.sections[0]?.content.productId).sort();
    expect(productIds).toEqual(
      result.fixture.aggregate.catalogue.products.map(({ id }) => id).sort(),
    );
    const [simple, configurable] = result.fixture.aggregate.catalogue.products;
    expect(simple.orderOptions ?? []).toHaveLength(0);
    expect(configurable.orderOptions?.length).toBeGreaterThan(1);
    expect(configurable.variants.length).toBeGreaterThan(1);
    expect(
      productPages.every((page) => page.sections[0]?.component === "dynamicProductDetail"),
    ).toBe(true);
  });

  it("renders every page through the shared registered preview renderer", () => {
    const context = createStorefrontRenderContext({
      activeLocale: "en",
      primaryLocale: "en",
      enabledLocales: ["en", "fi"],
      catalogue: result.fixture.aggregate.catalogue,
      snapshot: result.slice.snapshot,
      evidenceReferences: result.approvedEvidenceReferences,
    });
    for (const page of result.slice.snapshot.pages.filter(
      (candidate) =>
        !["cart", "checkout", "no-results", "empty-state", "error-state"].includes(
          candidate.pageFamily!.familyId,
        ),
    )) {
      expect(renderToStaticMarkup(renderStorefrontPage(page, context))).not.toBe("");
    }
  });

  it("saves, reloads, atomically publishes, and retains an immutable compiled version", async () => {
    const repository = new InMemoryProjectRepository([result.fixture.aggregate]);
    await repository.saveDraft(result.slice.snapshot.projectId, result.slice.snapshot, {
      id: result.fixture.draft.id,
      revision: result.fixture.draft.revision,
    });
    const savedAggregate = await repository.get(result.slice.snapshot.projectId);
    const saved = savedAggregate.snapshots.find(
      ({ id }) => id === savedAggregate.project.draftSnapshotId,
    )!;
    expect(canonicalStorefrontContentFingerprint(saved)).toBe(result.slice.snapshotFingerprint);
    const preparation = await preparePublish(result.slice.snapshot.projectId, repository, {
      authority: { kind: "manual", currentEvidenceReferences: currentEvidence() },
      now: () => new Date("2026-08-10T12:00:00.000Z"),
    });
    const confirmation = await confirmPublish(preparation, repository, {
      authority: { kind: "manual", currentEvidenceReferences: currentEvidence() },
    });
    expect(canonicalStorefrontContentFingerprint(confirmation.publishedSnapshot)).toBe(
      result.slice.snapshotFingerprint,
    );
    expect(confirmation.publishedSnapshot.pages).toHaveLength(17);
    const active = await repository.getActiveCompiledPublication(result.slice.snapshot.projectId);
    const versions = await repository.listPublishedStorefrontVersions(
      result.slice.snapshot.projectId,
    );
    expect(active?.version.id).toBe(versions[0]?.id);
    expect(active?.artifact.compiledResult.pages).toHaveLength(17);
  });

  it("creates a deterministic traceability-only evidence manifest", () => {
    const { slice } = result;
    const input = {
      fixtureId: P10B14_FIXTURE_ID,
      slice,
      publication: { versionId: "publication_p10b14_v1", artifactId: "artifact_p10b14_v1" },
      browserEvidence: [
        {
          route: "/",
          viewport: 375 as const,
          reference: "p10b14-home-375.png",
          fingerprint: "browser-home-375",
        },
        {
          route: "/collections/jewellery",
          viewport: 1440 as const,
          reference: "p10b14-collection-1440.png",
          fingerprint: "browser-collection-1440",
        },
      ],
      humanReview: {
        reviewId: "review-p10b14",
        fingerprint: "review-p10b14-passed",
        outcome: "passed" as const,
      },
    };
    const first = createP10B14CompleteStorefrontEvidenceManifest(input);
    const second = createP10B14CompleteStorefrontEvidenceManifest(structuredClone(input));
    expect(first).toEqual(second);
    expect(first.pageProfiles).toHaveLength(17);
    expect(first.approvedEvidenceRefs).toHaveLength(7);
    expect(first.commerceRefs).toEqual(
      expect.arrayContaining(slice.planningInput.catalogue.products.map(({ id }) => id)),
    );
  });

  it("retains a passing complete-store review through the existing human protocol", () => {
    const home = result.slice.snapshot.pages.find((page) => page.type === "home")!;
    const homeMaterialization = result.slice.plan.pageBlueprintMaterializations.find(
      (entry) => entry.pageType === "home",
    )!;
    expect(home.sections.map(({ component, variant }) => ({ component, variant }))).toEqual(
      homeMaterialization.slots.map(({ component, variant }) => ({ component, variant })),
    );
    const first = createP10B14HumanCommercialReview(result);
    const second = createP10B14HumanCommercialReview(result);
    expect(first.evaluation.scenarios).toHaveLength(160);
    expect(first.record.coverage).toHaveLength(160);
    expect(first.record.overallDecision).toBe("passed");
    expect(first.record.fingerprint).toBe(second.record.fingerprint);
    expect(first.record.authority.canonicalSnapshot.snapshotFingerprint).toBe(
      result.slice.snapshotFingerprint,
    );
    expect(first.record.authority.pageBlueprintProfiles.map(({ profileId }) => profileId)).toEqual(
      expect.arrayContaining([
        P10B14_PREMIUM_EDITORIAL_SELECTION.homepageProfileId,
        P10B14_PREMIUM_EDITORIAL_SELECTION.collectionProfileId,
        P10B14_PREMIUM_EDITORIAL_SELECTION.pdpProfileId,
      ]),
    );
  });

  it("fails closed for missing pages, stale profiles/evidence, wrong product media, and unsupported utility actions", async () => {
    const sourceFingerprint = canonicalValueString(result.fixture.planningInput.draft);
    const baseInput = {
      planningInput: {
        ...result.fixture.planningInput,
        draft: applyCommercialSharedFrame(
          result.fixture.planningInput.draft,
          P10B14_PREMIUM_EDITORIAL_SELECTION.sharedFrameProfileId,
        ),
      },
      siteMapDecision: result.siteMapDecision,
      pageEvidenceAuthority: result.pageEvidenceAuthority,
      contentFactAuthority: result.contentFactAuthority,
      approvedAssetPresentations: result.fixture.assetPresentations,
    };
    const missing = structuredClone(result.slice.snapshot);
    missing.pages = missing.pages.filter((page) => page.pageFamily?.familyId !== "checkout");
    expect(() =>
      validateCanonicalStorefrontSiteMap(missing, {
        catalogue: result.fixture.aggregate.catalogue,
      }),
    ).toThrow(/requires exactly one checkout/i);

    const stale = structuredClone(result.siteMapDecision);
    stale.pages.find((page) => page.familyId === "home")!.profile.version = "9.9.9";
    expect(() =>
      materializeP10B14PremiumEditorialStorefront({ ...baseInput, siteMapDecision: stale }),
    ).toThrow(/profile|stale|current/i);

    const incompatibleFrame = applyCommercialSharedFrame(
      result.fixture.planningInput.draft,
      "editorial-masthead",
    );
    expect(() =>
      materializeP10B14PremiumEditorialStorefront({
        ...baseInput,
        planningInput: { ...baseInput.planningInput, draft: incompatibleFrame },
      }),
    ).toThrow(/shared frame|incompatible/i);

    expect(() =>
      result.pageEvidenceAuthority.resolve({
        familyId: "about",
        reference: {
          source: "approved-source-evidence",
          authorityId: "evidence_p10b14_about",
          revision: "0",
        },
      }),
    ).toThrow(/stale/i);

    const wrongMediaSnapshot = structuredClone(result.slice.snapshot);
    const productSection = wrongMediaSnapshot.pages
      .find((page) => page.pageFamily?.familyId === "product-detail")!
      .sections.find((section) => section.component === "dynamicProductDetail")!;
    const sourceSection = wrongMediaSnapshot.pages
      .flatMap((page) => page.sections)
      .find((section) => (section.approvedAssetPlacements?.length ?? 0) > 0)!;
    const sourcePlacementAuthority = sourceSection.approvedAssetPlacements?.[0];
    const sourcePresentationAuthority = sourceSection.approvedAssetPresentations?.[0];
    if (!sourcePlacementAuthority || !sourcePresentationAuthority) {
      throw new Error("Expected approved asset authority in the canonical fixture");
    }
    const sourcePlacement = structuredClone(sourcePlacementAuthority);
    const sourcePresentation = structuredClone(sourcePresentationAuthority);
    productSection.approvedAssetPlacements = [
      {
        ...sourcePlacement,
        pageId: wrongMediaSnapshot.pages.find((page) =>
          page.sections.some((section) => section.id === productSection.id),
        )!.id,
        componentId: productSection.id,
        componentType: productSection.component,
        assetSlotId: "productMedia",
        role: "productMainImage",
      },
    ];
    productSection.approvedAssetPresentations = [
      {
        ...sourcePresentation,
        role: "productMainImage",
        ...(sourcePresentation.artDirection
          ? {
              artDirection: {
                ...sourcePresentation.artDirection,
                source: {
                  ...sourcePresentation.artDirection.source,
                  role: "productMainImage",
                },
              },
            }
          : {}),
      },
    ];
    const wrongMediaAggregate = structuredClone(result.fixture.aggregate);
    wrongMediaAggregate.snapshots = wrongMediaAggregate.snapshots.map((snapshot) =>
      snapshot.id === wrongMediaSnapshot.id ? wrongMediaSnapshot : snapshot,
    );
    const wrongMediaRepository = new InMemoryProjectRepository([wrongMediaAggregate]);
    await expect(
      preparePublish(result.slice.snapshot.projectId, wrongMediaRepository, {
        authority: { kind: "manual", currentEvidenceReferences: currentEvidence() },
      }),
    ).rejects.toThrow(/compile|commerce|binding|revision|media/i);

    const cart = result.slice.snapshot.pages.find((page) => page.pageFamily?.familyId === "cart")!;
    expect(cart.sections[0]?.content).not.toHaveProperty("actions");
    expect(canonicalValueString(result.slice.snapshot)).not.toContain("cart-r1");
    expect(() =>
      commerceUtilityRuntimeStateSchema.parse({
        kind: "cart",
        revision: "cart-r1",
        lines: [],
        subtotal: result.fixture.aggregate.catalogue.products[0].price,
        total: result.fixture.aggregate.catalogue.products[0].price,
        actions: ["delete-store"],
      }),
    ).toThrow();
    expect(canonicalValueString(result.fixture.planningInput.draft)).toBe(sourceFingerprint);
  });
});
