import { describe, expect, it, vi } from "vitest";
import {
  createP10bLiveSynthesisIntentPreflightAuthority,
  listExecutableCoordinatedDirectionIntents,
  p10bLiveSynthesisExecutableResultFingerprint,
  validateP10bLiveSynthesisIntentProviderResult,
  type CoordinatedStorefrontDirectionId,
} from "@/application/bounded-storefront-synthesis";
import {
  P10B16L_CORE_PAGE_COUNT,
  P10B16L_DYNAMIC_ROUTE_COUNT,
  P10B16L_MAX_COLLECTION_SEARCH_ARCHETYPE_COUNT,
  P10B16L_MAX_PRODUCT_DETAIL_ARCHETYPE_COUNT,
  P10B16L_STATIC_DESIGN_PAGE_COUNT,
  createP10B16LRawKarvonenAcceptanceFixture,
} from "@/data/demo/p10b-16l-live-provider-acceptance";
import { canonicalValueString } from "@/domain/storefront";

const directionIds = ["premium-editorial", "modern-technical", "minimal-commerce"] as const;

type LiveRequest = Readonly<{
  fixture: ReturnType<typeof createP10B16LRawKarvonenAcceptanceFixture>;
  authority: ReturnType<typeof createP10bLiveSynthesisIntentPreflightAuthority>;
  request: ReturnType<typeof createP10bLiveSynthesisIntentPreflightAuthority>["request"];
}>;
const liveRequestCache = new Map<string, LiveRequest>();

function liveRequest(
  requestedDirectionId: CoordinatedStorefrontDirectionId | null,
  overrideSiteMap = false,
  inspectAuthority?: (
    fixture: ReturnType<typeof createP10B16LRawKarvonenAcceptanceFixture>,
  ) => void,
) {
  const cacheKey = requestedDirectionId ?? "general";
  const cached = !overrideSiteMap ? liveRequestCache.get(cacheKey) : undefined;
  if (cached) return cached;
  const fixture = createP10B16LRawKarvonenAcceptanceFixture();
  inspectAuthority?.(fixture);
  const siteMapDecision = structuredClone(fixture.siteMapDecision);
  if (overrideSiteMap) {
    const about = siteMapDecision.pages.find(({ familyId }) => familyId === "about");
    if (!about) throw new Error("The raw fixture is missing its evidence-backed About page.");
    about.profile.id = "content-profile-unavailable";
  }
  const catalogue = fixture.planningInput.catalogue;
  const authority = createP10bLiveSynthesisIntentPreflightAuthority({
    merchantInstruction: "Create a complete storefront from current registered authority.",
    requestedDirectionId,
    merchantContext: {
      businessName: "Karvonen",
      shortDescription: "A Finnish jewellery merchant with approved evidence.",
      industry: "jewellery",
      targetCustomer: "Customers choosing lasting Finnish jewellery.",
      primaryMarket: "Finland",
      enabledLocales: fixture.planningInput.project.enabledLocales,
    },
    catalogueCharacteristics: {
      productCount: catalogue.products.length,
      collectionCount: catalogue.collections.length,
      configurableProductCount: catalogue.products.filter(
        ({ orderOptions }) => (orderOptions?.length ?? 0) > 0,
      ).length,
      optionGroupCount: catalogue.products.reduce(
        (count, { orderOptions }) => count + (orderOptions?.length ?? 0),
        0,
      ),
      productsWithMultipleMedia: catalogue.products.filter(({ images }) => images.length > 1)
        .length,
      productsWithoutPrice: catalogue.products.filter(({ price }) => price === undefined).length,
      canonicalCommerceFingerprint: "p10b16l-executable-commerce",
    },
    evidenceRichness: {
      approvedBriefRevision: fixture.planningInput.brief.revision,
      approvedFactFamilies: ["about"],
      approvedFactCount: fixture.approvedEvidenceReferences.length,
    },
    approvedAssetPosture: {
      approvedAssetCount: 0,
      approvedRoles: [],
      editorialMediaAvailable: false,
    },
    currentAuthorityFingerprint: "p10b16l-executable-current-authority",
    executionAuthority: {
      planningInput: fixture.executionPlanningInput,
      siteMapDecision,
      approvedEvidenceReferences: fixture.approvedEvidenceReferences,
      pageEvidenceAuthority: fixture.pageEvidenceAuthority,
      contentFactAuthority: fixture.contentFactAuthority,
      approvedAssetPresentations: fixture.approvedAssetPresentations,
    },
  });
  const created = {
    fixture,
    authority,
    request: authority.request,
  };
  if (!overrideSiteMap) liveRequestCache.set(cacheKey, created);
  return created;
}

describe("P10B-16L executable live-intent compatibility", () => {
  it("advertises only exact executable options for all named directions and the general run", () => {
    const expectedCounts = {
      "premium-editorial": 1,
      "modern-technical": 1,
      "minimal-commerce": 1,
    } as const;
    for (const directionId of directionIds) {
      const { request } = liveRequest(directionId);
      expect(request.contractVersion).toBe("2.0.0");
      expect(request.executableIntents).toHaveLength(expectedCounts[directionId]);
      expect(request.executableIntents.every((option) => option.directionId === directionId)).toBe(
        true,
      );
    }

    const { request: general } = liveRequest(null);
    const namedInventory = directionIds.flatMap(
      (directionId) => liveRequest(directionId).request.executableIntents,
    );
    expect(general.executableIntents).toHaveLength(3);
    expect(general.executableIntents).toEqual(namedInventory);
    expect(new Set(general.executableIntents.map(({ directionId }) => directionId))).toEqual(
      new Set(directionIds),
    );
    expect(JSON.stringify(general)).not.toMatch(
      /homepageProfileId|sharedFrameProfileId|componentSelections|sectionTree|productIds|priceValues|mediaIds/,
    );
  }, 60_000);

  it("retains the complete raw-fixture executable audit behind the bounded provider inventory", () => {
    const expectedCounts = {
      "premium-editorial": 1,
      "modern-technical": 1,
      "minimal-commerce": 1,
    } as const;
    for (const directionId of directionIds) {
      const { fixture } = liveRequest(directionId);
      const audited = listExecutableCoordinatedDirectionIntents({
        planningInput: fixture.executionPlanningInput,
        siteMapDecision: fixture.siteMapDecision,
        approvedEvidenceReferences: fixture.approvedEvidenceReferences,
        pageEvidenceAuthority: fixture.pageEvidenceAuthority,
        contentFactAuthority: fixture.contentFactAuthority,
        approvedAssetPresentations: fixture.approvedAssetPresentations,
        directionId,
        currentAuthorityFingerprint: "p10b16l-complete-executable-audit",
      });
      expect(audited).toHaveLength(expectedCounts[directionId]);
      expect(
        new Set(audited.map(({ result }) => result.diversity.structuralFingerprint)).size,
      ).toBe(audited.length);
      expect(
        audited.every(({ result }) => {
          const snapshot = result.synthesis.materialization.snapshot;
          return (
            snapshot.pages.length === P10B16L_STATIC_DESIGN_PAGE_COUNT &&
            snapshot.dynamicCommercePresentation?.routeInventory.length ===
              P10B16L_DYNAMIC_ROUTE_COUNT &&
            snapshot.pages.length + snapshot.dynamicCommercePresentation.routeInventory.length ===
              P10B16L_CORE_PAGE_COUNT
          );
        }),
      ).toBe(true);
    }
  }, 120_000);

  it("executes every advertised option exactly and preserves its complete bounded tuple", () => {
    for (const directionId of directionIds) {
      const { authority, fixture, request } = liveRequest(directionId);
      const rawBefore = canonicalValueString(fixture.rawDraft);
      const commerceBefore = canonicalValueString(fixture.planningInput.catalogue);
      const structuralFingerprints = new Set<string>();
      const deterministicSeeds = new Set<string>();

      for (const option of request.executableIntents) {
        const validated = validateP10bLiveSynthesisIntentProviderResult(request, {
          requestFingerprint: request.requestFingerprint,
          executableIntentId: option.intentId,
          executableIntentFingerprint: option.executableIntentFingerprint,
        });
        expect(validated.directionRequest.characteristics).toEqual(option.characteristics);
        const result = authority.resolveExecutableResult(option.executableIntentFingerprint);
        if (result === null) throw new Error("The executable preflight result was not retained.");
        expect(p10bLiveSynthesisExecutableResultFingerprint(result)).toBe(
          option.expectedExecutionFingerprint,
        );
        expect(result.synthesis.materialization.snapshot.pages).toHaveLength(
          P10B16L_STATIC_DESIGN_PAGE_COUNT,
        );
        expect(
          result.synthesis.materialization.snapshot.dynamicCommercePresentation?.routeInventory,
        ).toHaveLength(P10B16L_DYNAMIC_ROUTE_COUNT);
        const routeAuthority =
          result.synthesis.materialization.snapshot.dynamicCommercePresentation;
        expect(routeAuthority?.collectionSearchArchetypes.length).toBeGreaterThan(0);
        expect(routeAuthority?.collectionSearchArchetypes.length).toBeLessThanOrEqual(
          P10B16L_MAX_COLLECTION_SEARCH_ARCHETYPE_COUNT,
        );
        expect(routeAuthority?.productDetailArchetypes.length).toBeGreaterThan(1);
        expect(routeAuthority?.productDetailArchetypes.length).toBeLessThanOrEqual(
          P10B16L_MAX_PRODUCT_DETAIL_ARCHETYPE_COUNT,
        );
        expect(
          routeAuthority?.collectionRouteMappings.every(({ archetypeId }) =>
            routeAuthority.collectionSearchArchetypes.some(({ id }) => id === archetypeId),
          ),
        ).toBe(true);
        expect(
          routeAuthority?.productTypeMappings.every(({ archetypeId }) =>
            routeAuthority.productDetailArchetypes.some(({ id }) => id === archetypeId),
          ),
        ).toBe(true);
        deterministicSeeds.add(validated.directionRequest.deterministicSeed);
        structuralFingerprints.add(result.diversity.structuralFingerprint);
      }

      expect(deterministicSeeds.size).toBe(request.executableIntents.length);
      expect(structuralFingerprints.size).toBe(request.executableIntents.length);
      expect(canonicalValueString(fixture.rawDraft)).toBe(rawBefore);
      expect(canonicalValueString(fixture.planningInput.catalogue)).toBe(commerceBefore);
    }
  }, 60_000);

  it("fails without provider invocation or raw-state mutation when authority has no executable intent", () => {
    const selectIntent = vi.fn();
    let rawBefore = "";
    let aggregateBefore = "";
    let failedAuthority: ReturnType<typeof createP10B16LRawKarvonenAcceptanceFixture> | undefined;
    expect(() => {
      const { request } = liveRequest("premium-editorial", true, (fixture) => {
        failedAuthority = fixture;
        rawBefore = canonicalValueString(fixture.rawDraft);
        aggregateBefore = canonicalValueString(fixture.aggregate);
      });
      selectIntent(request);
    }).toThrow(expect.objectContaining({ code: "no-executable-compatible-intent" }));
    expect(selectIntent).not.toHaveBeenCalled();
    expect(failedAuthority).toBeDefined();
    expect(canonicalValueString(failedAuthority?.rawDraft)).toBe(rawBefore);
    expect(canonicalValueString(failedAuthority?.aggregate)).toBe(aggregateBefore);
    expect(failedAuthority?.rawDraft.pages).toHaveLength(1);
    expect(failedAuthority?.rawDraft.pages[0]?.sections).toEqual([]);
  });
});
