import { describe, expect, it } from "vitest";
import {
  BOUNDED_STOREFRONT_SYNTHESIS_CONTRACT_VERSION,
  boundedStorefrontSynthesisDecisionSchema,
  BoundedStorefrontSynthesisError,
  createBoundedStorefrontSynthesisDecision,
  executeBoundedStorefrontSynthesis,
  validateBoundedStorefrontSynthesisDecision,
  type BoundedStorefrontSynthesisIntent,
} from "@/application/bounded-storefront-synthesis";
import { confirmPublish, preparePublish } from "@/application/publishing";
import { getExecutablePageBlueprintProfile } from "@/application/storefront-templates";
import { createP10B14PremiumEditorialFixture } from "@/data/demo/p10b-14-premium-editorial";
import { createP10B15BoundedSynthesisFixture } from "@/data/demo/p10b-15-bounded-synthesis";
import {
  canonicalStorefrontContentFingerprint,
  canonicalValueString,
  validateCanonicalStorefrontSiteMap,
} from "@/domain/storefront";
import { InMemoryProjectRepository } from "@/services/storage";

const source = createP10B14PremiumEditorialFixture();
const common = {
  planningInput: source.fixture.planningInput,
  siteMapDecision: source.siteMapDecision,
  approvedEvidenceReferences: source.approvedEvidenceReferences,
};
const representative = createP10B15BoundedSynthesisFixture();

function decision(intent: BoundedStorefrontSynthesisIntent, seed = "matrix") {
  const request = { intent, deterministicSeed: seed } as const;
  return createBoundedStorefrontSynthesisDecision({ ...common, request });
}

function execute(intent: BoundedStorefrontSynthesisIntent, seed = "matrix") {
  const request = { intent, deterministicSeed: seed } as const;
  const selected = createBoundedStorefrontSynthesisDecision({ ...common, request });
  return executeBoundedStorefrontSynthesis({
    ...common,
    request,
    decision: selected,
    pageEvidenceAuthority: source.pageEvidenceAuthority,
    contentFactAuthority: source.contentFactAuthority,
    approvedAssetPresentations: source.fixture.assetPresentations,
  });
}

describe("P10B-15 bounded storefront synthesis contract and selection", () => {
  it("1. versions the synthesis contract", () => {
    expect(decision("editorial-led").contractVersion).toBe(
      BOUNDED_STOREFRONT_SYNTHESIS_CONTRACT_VERSION,
    );
  });

  it("2. produces the same fingerprint and output for identical canonical input", () => {
    const first = execute("editorial-led", "same");
    const second = execute("editorial-led", "same");
    expect(second.decision).toEqual(first.decision);
    expect(second.materialization.snapshotFingerprint).toBe(
      first.materialization.snapshotFingerprint,
    );
  });

  it("3. changes several bounded architectural dimensions when intent changes", () => {
    const editorial = decision("editorial-led");
    const restrained = decision("restrained-minimal");
    expect(restrained.synthesisFingerprint).not.toBe(editorial.synthesisFingerprint);
    expect(restrained.commercialProfiles.homepageProfileId).not.toBe(
      editorial.commercialProfiles.homepageProfileId,
    );
    expect(restrained.commercialProfiles.pdpProfileId).not.toBe(
      editorial.commercialProfiles.pdpProfileId,
    );
    expect(restrained.designDna.directionId).not.toBe(editorial.designDna.directionId);
    expect(restrained.narrative.posture).not.toBe(editorial.narrative.posture);
  });

  it("8. resolves every selected PageBlueprint profile against current authority", () => {
    const selected = decision("commerce-led");
    expect(
      selected.pageProfileSelections.every(
        ({ profileId, profileVersion }) =>
          getExecutablePageBlueprintProfile(profileId)?.profile?.version === profileVersion,
      ),
    ).toBe(true);
  });

  it("9. binds every component choice to the current component capability", () => {
    const selected = decision("editorial-led");
    const definitions = new Map(
      common.planningInput.componentDefinitions.map((definition) => [definition.type, definition]),
    );
    expect(
      selected.componentChoices.every(({ component, variant, capabilityFingerprint }) => {
        const definition = definitions.get(component);
        return (
          definition?.variants.some(({ id }) => id === variant) === true &&
          capabilityFingerprint.startsWith("component-capability-")
        );
      }),
    ).toBe(true);
  });

  it("10. coordinates supported narrative roles across the complete page set", () => {
    const narrative = decision("editorial-led").narrative;
    expect(narrative.roleSequence).toEqual(
      expect.arrayContaining(["orientation", "brand-story", "product-focus", "service"]),
    );
  });

  it("11. bounds consecutive duplicate narrative roles", () => {
    for (const { roles } of decision("editorial-led").narrative.pageContributions) {
      expect(
        roles.some(
          (role, index) => index >= 2 && role === roles[index - 1] && role === roles[index - 2],
        ),
      ).toBe(false);
    }
  });

  it("12. retains discovery and conversion paths", () => {
    expect(decision("commerce-led").narrative).toMatchObject({
      discoveryPath: true,
      conversionPath: true,
    });
  });

  it("13. coherently omits an optional factual page when its evidence is unavailable", () => {
    const siteMapDecision = structuredClone(common.siteMapDecision);
    const returnsPage = siteMapDecision.pages.find(
      ({ familyId }) => familyId === "returns-information",
    )!;
    returnsPage.required = false;
    returnsPage.evidenceReferences[0].revision = "missing";
    const request = { intent: "restrained-minimal", deterministicSeed: "sparse" } as const;
    const selected = createBoundedStorefrontSynthesisDecision({
      ...common,
      siteMapDecision,
      request,
    });
    expect(selected.evidenceComposition.omittedPageKeys).toContain(returnsPage.key);
    expect(selected.siteMap.pageKeys).not.toContain(returnsPage.key);
  });

  it("14. uses rich approved evidence for deeper support/story contributions", () => {
    const selected = decision("editorial-led");
    expect(selected.approvedEvidenceRevisions.length).toBeGreaterThan(1);
    expect(
      selected.narrative.pageContributions.filter(({ roles }) =>
        roles.some((role) => ["brand-story", "education", "service"].includes(role)),
      ).length,
    ).toBeGreaterThan(4);
  });

  it("15. narrows an impossible dense request for a small catalogue", () => {
    const selected = decision("dense-catalogue");
    expect(selected.commercialProfiles.collectionProfileId).not.toBe("collection-dense-search");
    expect(selected.decisions[0]?.code).toBe("dense-request-narrowed");
  });

  it("16. selects registered dense discovery authority for a large catalogue", () => {
    const planningInput = structuredClone(common.planningInput);
    const siteMapDecision = structuredClone(common.siteMapDecision);
    const template = planningInput.catalogue.products[0];
    const extraProducts = Array.from({ length: 7 }, (_, index) => ({
      ...structuredClone(template),
      id: `product_dense_${index + 1}`,
      sku: `DENSE-${index + 1}`,
      images: template.images.map((image, imageIndex) => ({
        ...image,
        id: `asset_dense_${index + 1}_${imageIndex + 1}`,
      })),
      variants: template.variants.map((variant, variantIndex) => ({
        ...variant,
        id: `variant_dense_${index + 1}_${variantIndex + 1}`,
        sku: `DENSE-${index + 1}-${variantIndex + 1}`,
      })),
    }));
    planningInput.catalogue.products.push(...extraProducts);
    planningInput.catalogue.collections[0].productIds.push(...extraProducts.map(({ id }) => id));
    const productPageTemplate = siteMapDecision.pages.find(
      ({ familyId }) => familyId === "product-detail",
    )!;
    siteMapDecision.pages.push(
      ...extraProducts.map((product, index) => ({
        ...structuredClone(productPageTemplate),
        key: `p10b15-dense-product-${index + 1}`,
        route: `/products/dense-${index + 1}`,
        title: { en: `Dense product ${index + 1}`, fi: `Tiivis tuote ${index + 1}` },
        seo: {
          title: { en: `Dense product ${index + 1}`, fi: `Tiivis tuote ${index + 1}` },
          metaDescription: {
            en: `Dense product ${index + 1}.`,
            fi: `Tiivis tuote ${index + 1}.`,
          },
        },
        commerceContext: { kind: "product" as const, productId: product.id },
      })),
    );
    const request = { intent: "dense-catalogue", deterministicSeed: "large" } as const;
    const selected = createBoundedStorefrontSynthesisDecision({
      ...common,
      planningInput,
      siteMapDecision,
      request,
    });
    const result = executeBoundedStorefrontSynthesis({
      ...common,
      planningInput,
      siteMapDecision,
      request,
      decision: selected,
      pageEvidenceAuthority: source.pageEvidenceAuthority,
      contentFactAuthority: source.contentFactAuthority,
      approvedAssetPresentations: source.fixture.assetPresentations,
    });
    const authority = result.materialization.snapshot.dynamicCommercePresentation;
    const discoveryRoutes = authority?.routeInventory.filter(({ kind }) =>
      ["collection", "search"].includes(kind),
    );
    expect(selected.commercialProfiles.collectionProfileId).toBe("collection-dense-search");
    expect(selected.informationDensityPosture).toBe("compact");
    expect(discoveryRoutes).toHaveLength(2);
    expect(new Set(discoveryRoutes?.map(({ id }) => id)).size).toBe(2);
    expect(authority?.collectionSearchArchetypes.length).toBeGreaterThan(0);
    expect(authority?.collectionSearchArchetypes.length).toBeLessThanOrEqual(4);
    expect(
      authority?.collectionSearchArchetypes.find(({ id }) => id === authority.searchArchetypeId)
        ?.profile.profileId,
    ).toBe("collection-dense-search");
    expect(
      authority?.collectionRouteMappings.every(({ archetypeId }) =>
        authority.collectionSearchArchetypes.some(({ id }) => id === archetypeId),
      ),
    ).toBe(true);
  });

  it("17. uses configurable-product complexity to select a considered PDP", () => {
    expect(decision("commerce-led").commercialProfiles.pdpProfileId).toBe("pdp-high-consideration");

    const planningInput = structuredClone(common.planningInput);
    const siteMapDecision = structuredClone(common.siteMapDecision);
    const originalProductId = planningInput.catalogue.products[0].id;
    const longProductId = `product_${"bounded".repeat(10)}`;
    planningInput.catalogue.products[0].id = longProductId;
    for (const collection of planningInput.catalogue.collections) {
      collection.productIds = collection.productIds.map((productId) =>
        productId === originalProductId ? longProductId : productId,
      );
    }
    for (const page of siteMapDecision.pages) {
      if (
        page.commerceContext.kind === "product" &&
        page.commerceContext.productId === originalProductId
      ) {
        page.commerceContext.productId = longProductId;
      }
    }
    const request = { intent: "high-consideration", deterministicSeed: "long-id" } as const;
    const selected = createBoundedStorefrontSynthesisDecision({
      ...common,
      planningInput,
      siteMapDecision,
      request,
    });
    const result = executeBoundedStorefrontSynthesis({
      ...common,
      planningInput,
      siteMapDecision,
      request,
      decision: selected,
      pageEvidenceAuthority: source.pageEvidenceAuthority,
      contentFactAuthority: source.contentFactAuthority,
      approvedAssetPresentations: source.fixture.assetPresentations,
    });
    const authority = result.materialization.snapshot.dynamicCommercePresentation;
    const longProductRoute = authority?.routeInventory.find(
      (route) => route.kind === "product" && route.productId === longProductId,
    );
    const mappedArchetypeId = authority?.productTypeMappings[0]?.archetypeId;
    expect(longProductId.length).toBeGreaterThan(45);
    expect(longProductRoute).toBeDefined();
    expect(mappedArchetypeId).toBe("archetype_pdp_high_consideration");
    expect(
      authority?.productDetailArchetypes.find(({ id }) => id === mappedArchetypeId)?.profile
        .profileId,
    ).toBe("pdp-high-consideration");
    expect(canonicalValueString(authority?.productDetailArchetypes).includes(longProductId)).toBe(
      false,
    );
  });

  it("18. rejects unsupported request vocabulary and impossible campaign narrowing", () => {
    expect(() =>
      createBoundedStorefrontSynthesisDecision({
        ...common,
        request: { intent: "invent-a-storefront", deterministicSeed: "invalid" } as never,
      }),
    ).toThrow(BoundedStorefrontSynthesisError);
    expect(() => decision("campaign-emphasis")).toThrow(BoundedStorefrontSynthesisError);
  });

  it("19. rejects a page set with no common registered frame/profile combination", () => {
    const siteMapDecision = structuredClone(common.siteMapDecision);
    siteMapDecision.pages.find(({ familyId }) => familyId === "about")!.profile.id =
      "content-about-process";
    siteMapDecision.pages.find(({ familyId }) => familyId === "contact")!.profile.id =
      "content-contact-directory";
    const request = { intent: "restrained-minimal", deterministicSeed: "no-frame" } as const;
    expect(() =>
      createBoundedStorefrontSynthesisDecision({ ...common, siteMapDecision, request }),
    ).toThrow(/shared-frame|compatible/i);
  });

  it("20. rejects stale or tampered synthesis authority before materialization", () => {
    const request = { intent: "editorial-led", deterministicSeed: "stale" } as const;
    const selected = createBoundedStorefrontSynthesisDecision({ ...common, request });
    const stale = {
      ...structuredClone(selected),
      currentAuthority: {
        ...selected.currentAuthority,
        componentRegistryFingerprint: "component-registry-stale",
      },
    };
    expect(boundedStorefrontSynthesisDecisionSchema.safeParse(stale).success).toBe(false);
    expect(() => validateBoundedStorefrontSynthesisDecision(stale, { ...common, request })).toThrow(
      BoundedStorefrontSynthesisError,
    );
  });
});

describe("P10B-15 canonical materialization and lifecycle", () => {
  it("4. preserves canonical commerce facts unchanged", () => {
    const result = execute("commerce-led");
    expect(canonicalValueString(result.materialization.planningInput.catalogue)).toBe(
      canonicalValueString(common.planningInput.catalogue),
    );
  });

  it("5. preserves approved evidence authority unchanged", () => {
    const before = canonicalValueString(common.approvedEvidenceReferences);
    execute("editorial-led");
    expect(canonicalValueString(common.approvedEvidenceReferences)).toBe(before);
  });

  it("6. keeps product-media identity in canonical commerce authority", () => {
    const result = execute("restrained-minimal");
    const productArchetypes =
      result.materialization.snapshot.dynamicCommercePresentation?.productDetailArchetypes ?? [];
    expect(
      productArchetypes.every(
        ({ componentPresentations }) =>
          componentPresentations.length === 1 &&
          componentPresentations[0] !== undefined &&
          componentPresentations[0]?.component === "dynamicProductDetail" &&
          !("productId" in componentPresentations[0].content) &&
          !("approvedAssetPlacements" in componentPresentations[0]),
      ),
    ).toBe(true);
    expect(
      result.materialization.planningInput.catalogue.products.map(({ images }) => images),
    ).toEqual(common.planningInput.catalogue.products.map(({ images }) => images));
  });

  it("7. uses one canonical shared frame across every selected page", () => {
    const result = execute("editorial-led");
    expect(result.materialization.snapshot.sharedFrame?.profileId).toBe(
      result.decision.sharedFrame.profileId,
    );
    expect(
      result.materialization.snapshot.pages.every(
        ({ pageFamily }) => pageFamily?.sharedFrameId === "blueprint-shared-storefront-frame",
      ),
    ).toBe(true);
  });

  it("21. saves and reloads the exact synthesized StorefrontSnapshot", async () => {
    const result = execute("restrained-minimal", "save");
    const repository = new InMemoryProjectRepository([source.fixture.aggregate]);
    await repository.saveDraft(
      result.materialization.snapshot.projectId,
      result.materialization.snapshot,
      {
        id: source.fixture.draft.id,
        revision: source.fixture.draft.revision,
      },
    );
    const aggregate = await repository.get(result.materialization.snapshot.projectId);
    const saved = aggregate.snapshots.find(({ id }) => id === aggregate.project.draftSnapshotId)!;
    expect(canonicalStorefrontContentFingerprint(saved)).toBe(
      result.materialization.snapshotFingerprint,
    );
  });

  it("22. preserves the exact synthesized store through deterministic publication", async () => {
    const result = execute("editorial-led", "publish");
    const repository = new InMemoryProjectRepository([source.fixture.aggregate]);
    await repository.saveDraft(
      result.materialization.snapshot.projectId,
      result.materialization.snapshot,
      {
        id: source.fixture.draft.id,
        revision: source.fixture.draft.revision,
      },
    );
    const preparation = await preparePublish(
      result.materialization.snapshot.projectId,
      repository,
      {
        authority: {
          kind: "manual",
          currentEvidenceReferences: common.approvedEvidenceReferences,
        },
        now: () => new Date("2026-08-10T12:00:00.000Z"),
      },
    );
    const published = await confirmPublish(preparation, repository, {
      authority: {
        kind: "manual",
        currentEvidenceReferences: common.approvedEvidenceReferences,
      },
    });
    expect(canonicalStorefrontContentFingerprint(published.publishedSnapshot)).toBe(
      result.materialization.snapshotFingerprint,
    );
    expect(
      (await repository.getActiveCompiledPublication(source.fixture.aggregate.project.id))?.artifact
        .compiledResult.pages,
    ).toHaveLength(13);
    expect(
      (await repository.getActiveCompiledPublication(source.fixture.aggregate.project.id))?.artifact
        .compiledResult.dynamicCommercePresentation?.routeInventory,
    ).toHaveLength(4);
  });

  it("23. materializes several materially different complete canonical outcomes", () => {
    const outcomes = Object.values(representative.outcomes);
    expect(new Set(outcomes.map(({ decision }) => decision.synthesisFingerprint)).size).toBe(3);
    expect(
      new Set(outcomes.map(({ materialization }) => materialization.snapshotFingerprint)).size,
    ).toBe(3);
    expect(
      outcomes.every(({ materialization }) => materialization.snapshot.pages.length === 13),
    ).toBe(true);
    expect(
      outcomes.every(
        ({ materialization }) =>
          materialization.snapshot.dynamicCommercePresentation?.routeInventory.length === 4 &&
          materialization.snapshot.dynamicCommercePresentation.collectionSearchArchetypes.length >
            0 &&
          materialization.snapshot.dynamicCommercePresentation.collectionSearchArchetypes.length <=
            4 &&
          materialization.snapshot.dynamicCommercePresentation.productDetailArchetypes.length > 1 &&
          materialization.snapshot.dynamicCommercePresentation.productDetailArchetypes.length <= 5,
      ),
    ).toBe(true);
  });

  it("24. emits structured authority only, never runtime JSX, HTML, CSS, or scripts", () => {
    const serialized = canonicalValueString(decision("editorial-led"));
    expect(serialized).not.toMatch(
      /<script|<style|className|dangerouslySetInnerHTML|function\s*\(/i,
    );
  });

  it("25. retains compatibility with the P10B-14 canonical complete snapshot", () => {
    expect(() =>
      validateCanonicalStorefrontSiteMap(source.slice.snapshot, {
        catalogue: source.fixture.aggregate.catalogue,
        enabledLocales: source.fixture.aggregate.project.enabledLocales,
      }),
    ).not.toThrow();
    expect(source.slice.snapshot.pages).toHaveLength(13);
    expect(source.slice.snapshot.dynamicCommercePresentation?.routeInventory).toHaveLength(4);
    expect(source.slice.snapshotFingerprint).toBe(
      canonicalStorefrontContentFingerprint(source.slice.snapshot),
    );
  });
});
