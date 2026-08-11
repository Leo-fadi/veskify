import { describe, expect, it } from "vitest";
import { executeCoordinatedDirection } from "@/application/bounded-storefront-synthesis";
import {
  P10B16L_CATALOGUE_ID,
  P10B16L_CORE_PAGE_COUNT,
  P10B16L_DYNAMIC_ROUTE_COUNT,
  P10B16L_MAX_COLLECTION_SEARCH_ARCHETYPE_COUNT,
  P10B16L_MAX_PRODUCT_DETAIL_ARCHETYPE_COUNT,
  P10B16L_PROJECT_ID,
  P10B16L_STATIC_DESIGN_PAGE_COUNT,
  createP10B16LRawKarvonenAcceptanceFixture,
} from "@/data/demo/p10b-16l-live-provider-acceptance";
import { karvonenSeed } from "@/data/seed/karvonen";
import { canonicalProductTypePresentationId } from "@/domain/product-card";
import { idSchema } from "@/domain/shared";
import { canonicalValueString } from "@/domain/storefront";

describe("P10B-16L raw Karvonen acceptance fixture", () => {
  it("starts from one unstyled empty home page without promoted editorial assets", () => {
    const fixture = createP10B16LRawKarvonenAcceptanceFixture();

    expect(fixture.aggregate.project.id).toBe(P10B16L_PROJECT_ID);
    expect(fixture.planningInput.catalogue.id).toBe(P10B16L_CATALOGUE_ID);
    expect(fixture.rawDraft.pages).toHaveLength(1);
    expect(fixture.rawDraft.pages[0]).toMatchObject({
      type: "home",
      slug: "/",
      sections: [],
    });
    expect(fixture.rawDraft.pages[0]?.pageFamily).toBeUndefined();
    expect(fixture.rawDraft.sharedFrame).toBeUndefined();
    expect(fixture.rawDraft.brandSystem.designDna).toBeUndefined();
    expect(fixture.rawDraft.brandSystem.visualSystem).toBeUndefined();
    expect(fixture.rawDraft.navigation).toEqual({ primary: [], footer: [] });
    expect(fixture.planningInput.approvedAssetContext).toBeNull();
    expect(fixture.planningInput.requiredAssetPlacements).toEqual([]);
    expect(fixture.approvedAssetPresentations).toEqual([]);
  });

  it("adds only neutral canonical source-frame prerequisites to the execution input", () => {
    const fixture = createP10B16LRawKarvonenAcceptanceFixture();
    const rawPage = fixture.planningInput.draft.pages[0];
    const executionPage = fixture.executionPlanningInput.draft.pages[0];
    const { sections: rawSections, ...rawPageAuthority } = rawPage;
    const { sections: executionSections, ...executionPageAuthority } = executionPage;

    expect(rawSections).toEqual([]);
    expect(executionPageAuthority).toEqual(rawPageAuthority);
    expect(executionSections.map(({ component }) => component)).toEqual(["header", "footer"]);
    expect(fixture.executionPlanningInput.draft.sharedFrame).toBeUndefined();
    expect(fixture.executionPlanningInput.draft.brandSystem.designDna).toBeUndefined();
    expect(fixture.executionPlanningInput.draft.pages[0]?.pageFamily).toBeUndefined();
    expect(fixture.executionPlanningInput.catalogue).toEqual(fixture.planningInput.catalogue);
    expect(fixture.executionPlanningInput.brief).toEqual(fixture.planningInput.brief);
  });

  it("preserves every canonical Karvonen product, collection and media fact", () => {
    const fixture = createP10B16LRawKarvonenAcceptanceFixture();
    const { id: fixtureCatalogueId, ...fixtureCommerce } = fixture.planningInput.catalogue;
    const { id: seedCatalogueId, ...seedCommerce } = karvonenSeed.catalogue;

    expect(fixtureCatalogueId).toBe(P10B16L_CATALOGUE_ID);
    expect(seedCatalogueId).toBe("catalogue_karvonen");
    expect(fixtureCommerce).toEqual(seedCommerce);
    for (const product of fixture.planningInput.catalogue.products) {
      const presentationId = canonicalProductTypePresentationId(product.productType);
      expect(() => idSchema.parse(presentationId)).not.toThrow();
      expect(presentationId).not.toBe(product.productType);
    }
  });

  it("requires the evidence-backed About page in the complete 28-page site", () => {
    const fixture = createP10B16LRawKarvonenAcceptanceFixture();
    const requiredPages = fixture.siteMapDecision.pages.filter(({ required }) => required);
    const optionalPages = fixture.siteMapDecision.pages.filter(({ required }) => !required);

    expect(requiredPages).toHaveLength(P10B16L_CORE_PAGE_COUNT);
    expect(optionalPages).toHaveLength(0);
    expect(requiredPages.find(({ familyId }) => familyId === "about")).toMatchObject({
      familyId: "about",
      profile: { id: "content-about-story", version: "1.0.0" },
    });
    expect(
      requiredPages.find(({ familyId }) => familyId === "about")?.evidenceReferences,
    ).toHaveLength(1);
    expect(requiredPages.filter(({ familyId }) => familyId === "collection")).toHaveLength(
      karvonenSeed.catalogue.collections.length,
    );
    expect(requiredPages.filter(({ familyId }) => familyId === "product-detail")).toHaveLength(
      karvonenSeed.catalogue.products.length,
    );
    expect(fixture.aboutFactDocument.payload).toMatchObject({ familyId: "about" });
  });

  it("can synthesize a complete governed storefront without mutating the raw authority", () => {
    const fixture = createP10B16LRawKarvonenAcceptanceFixture();
    const rawBefore = canonicalValueString(fixture.rawDraft);
    const commerceBefore = canonicalValueString(fixture.planningInput.catalogue);
    const outcome = executeCoordinatedDirection({
      planningInput: fixture.executionPlanningInput,
      siteMapDecision: fixture.siteMapDecision,
      approvedEvidenceReferences: fixture.approvedEvidenceReferences,
      pageEvidenceAuthority: fixture.pageEvidenceAuthority,
      contentFactAuthority: fixture.contentFactAuthority,
      approvedAssetPresentations: fixture.approvedAssetPresentations,
      directionRequest: {
        directionId: "minimal-commerce",
        deterministicSeed: "p10b16l-raw-karvonen-fixture-v1",
      },
    });

    expect(outcome.synthesis.materialization.snapshot.pages).toHaveLength(
      P10B16L_STATIC_DESIGN_PAGE_COUNT,
    );
    expect(
      outcome.synthesis.materialization.snapshot.dynamicCommercePresentation?.routeInventory,
    ).toHaveLength(P10B16L_DYNAMIC_ROUTE_COUNT);
    expect(
      outcome.synthesis.materialization.snapshot.dynamicCommercePresentation
        ?.collectionSearchArchetypes.length,
    ).toBeLessThanOrEqual(P10B16L_MAX_COLLECTION_SEARCH_ARCHETYPE_COUNT);
    expect(
      outcome.synthesis.materialization.snapshot.dynamicCommercePresentation
        ?.productDetailArchetypes.length,
    ).toBeLessThanOrEqual(P10B16L_MAX_PRODUCT_DETAIL_ARCHETYPE_COUNT);
    expect(
      outcome.synthesis.materialization.snapshot.pages.length +
        outcome.synthesis.materialization.snapshot.dynamicCommercePresentation!.routeInventory
          .length,
    ).toBe(P10B16L_CORE_PAGE_COUNT);
    expect(outcome.synthesis.materialization.snapshot.sharedFrame).toBeDefined();
    expect(outcome.synthesis.materialization.snapshot.brandSystem.designDna).toBeDefined();
    expect(outcome.synthesis.materialization.snapshot.sharedFrame?.profileId).toBe(
      outcome.decision.sharedFrame.profileId,
    );
    expect(canonicalValueString(fixture.rawDraft)).toBe(rawBefore);
    expect(canonicalValueString(fixture.planningInput.catalogue)).toBe(commerceBefore);
  });
});
