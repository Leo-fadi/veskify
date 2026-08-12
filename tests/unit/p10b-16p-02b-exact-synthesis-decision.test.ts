import { describe, expect, it } from "vitest";
import {
  BOUNDED_STOREFRONT_SYNTHESIS_CONTRACT_VERSION,
  boundedStorefrontSynthesisDecisionSchema,
  createBoundedStorefrontSynthesisDecision,
  executeBoundedStorefrontSynthesis,
  validateBoundedStorefrontSynthesisDecision,
  type BoundedStorefrontSynthesisError,
} from "@/application/bounded-storefront-synthesis";
import { type DynamicCommerceDesignSelection } from "@/application/dynamic-commerce-routes";
import { createP10B14PremiumEditorialFixture } from "@/data/demo/p10b-14-premium-editorial";
import { canonicalValueFingerprint, canonicalValueString } from "@/domain/storefront";

function exactInput() {
  const source = createP10B14PremiumEditorialFixture();
  const draft = {
    ...structuredClone(source.fixture.planningInput.draft),
    dynamicCommercePresentation: structuredClone(source.slice.snapshot.dynamicCommercePresentation),
  };
  const authority = draft.dynamicCommercePresentation;
  if (!authority) throw new Error("Missing current dynamic-commerce test authority.");
  const collection = authority.collectionSearchArchetypes.find(({ supportedContexts }) =>
    supportedContexts.includes("collection"),
  );
  const search = authority.collectionSearchArchetypes.find(({ supportedContexts }) =>
    supportedContexts.includes("search"),
  );
  if (!collection || !search) throw new Error("Missing current collection/search archetypes.");
  const product = authority.productDetailArchetypes.find(
    ({ id }) => id !== authority.fallbacks.productDetailArchetypeId,
  );
  if (!product) throw new Error("Missing current product archetype.");
  const productTypeMappings = Object.fromEntries(
    [...authority.productTypeMappings]
      .reverse()
      .map(({ productTypeId, archetypeId }) => [productTypeId, archetypeId]),
  );
  const dynamicCommerceSelection: DynamicCommerceDesignSelection = {
    authorityFingerprint: authority.authorityFingerprint,
    collectionArchetypeId: collection.id,
    searchArchetypeId: search.id,
    standardSimpleArchetypeId: product.id,
    configurableArchetypeId: product.id,
    galleryLedArchetypeId: product.id,
    highConsiderationArchetypeId: product.id,
    genericFallbackArchetypeId: authority.fallbacks.productDetailArchetypeId,
    productTypeMappings,
  };
  const pageBlueprintSelectionOverrides = [
    {
      pageType: "home" as const,
      profileId: "homepage-editorial-storytelling",
      slotSelections: [
        {
          slotId: "hero",
          component: "homepageHero",
          variant: "fullBleedOverlay",
          boundedParameters: { mediaPlacement: "background" },
        },
      ],
    },
  ];
  return {
    source,
    authority,
    input: {
      planningInput: { ...source.fixture.planningInput, draft },
      siteMapDecision: source.siteMapDecision,
      approvedEvidenceReferences: source.approvedEvidenceReferences,
      request: { intent: "editorial-led" as const, deterministicSeed: "exact-p02b" },
      pageBlueprintSelectionOverrides,
      dynamicCommerceSelection,
    },
  };
}

function errorCode(action: () => unknown) {
  try {
    action();
  } catch (error) {
    return (error as BoundedStorefrontSynthesisError).code;
  }
  return undefined;
}

describe("P10B-16P-02B exact extended synthesis decision", () => {
  it("fingerprints, replays, and canonically materializes exact execution selections", () => {
    const { source, authority, input } = exactInput();
    const draftBefore = canonicalValueString(input.planningInput.draft);
    const first = createBoundedStorefrontSynthesisDecision(input);
    const second = createBoundedStorefrontSynthesisDecision({
      ...input,
      dynamicCommerceSelection: {
        ...input.dynamicCommerceSelection,
        productTypeMappings: Object.fromEntries(
          Object.entries(input.dynamicCommerceSelection.productTypeMappings).reverse(),
        ),
      },
    });

    expect(first).toEqual(second);
    expect(first.contractVersion).toBe(BOUNDED_STOREFRONT_SYNTHESIS_CONTRACT_VERSION);
    expect(first.pageBlueprintSelectionOverrides).toEqual(input.pageBlueprintSelectionOverrides);
    expect(first.dynamicCommerceSelection).toEqual({
      ...input.dynamicCommerceSelection,
      productTypeMappings: Object.fromEntries(
        Object.entries(input.dynamicCommerceSelection.productTypeMappings).sort(([left], [right]) =>
          left.localeCompare(right),
        ),
      ),
    });
    expect(first.exactSelectionAuthority.pageBlueprintSelectionFingerprint).toMatch(
      /^bounded-page-blueprint-selections-/,
    );
    expect(first.exactSelectionAuthority.dynamicCommerceAuthorityFingerprint).toBe(
      authority.authorityFingerprint,
    );
    expect(first.exactSelectionAuthority.dynamicCommerceSelectionFingerprint).toMatch(
      /^bounded-dynamic-commerce-selection-/,
    );
    expect(first.componentChoices).toContainEqual(
      expect.objectContaining({
        slotId: "hero",
        component: "homepageHero",
        variant: "fullBleedOverlay",
      }),
    );
    expect(validateBoundedStorefrontSynthesisDecision(first, input)).toEqual(first);
    expect(canonicalValueString(input.planningInput.draft)).toBe(draftBefore);

    const result = executeBoundedStorefrontSynthesis({
      ...input,
      decision: first,
      pageEvidenceAuthority: source.pageEvidenceAuthority,
      contentFactAuthority: source.contentFactAuthority,
      approvedAssetPresentations: source.fixture.assetPresentations,
    });
    const homepage = result.materialization.snapshot.pages.find(({ type }) => type === "home");
    expect(homepage?.sections.find(({ component }) => component === "homepageHero")).toMatchObject({
      variant: "fullBleedOverlay",
      props: { mediaPosition: "background" },
    });
    expect(
      result.materialization.snapshot.dynamicCommercePresentation?.collectionRouteMappings.every(
        ({ archetypeId }) => archetypeId === input.dynamicCommerceSelection.collectionArchetypeId,
      ),
    ).toBe(true);
    expect(result.materialization.snapshot.dynamicCommercePresentation?.searchArchetypeId).toBe(
      input.dynamicCommerceSelection.searchArchetypeId,
    );
    expect(
      Object.fromEntries(
        result.materialization.snapshot.dynamicCommercePresentation?.productTypeMappings.map(
          ({ productTypeId, archetypeId }) => [productTypeId, archetypeId],
        ) ?? [],
      ),
    ).toEqual(first.dynamicCommerceSelection?.productTypeMappings);
  });

  it("fails closed for mismatched profile, stale dynamic authority, or replay without selections", () => {
    const { input } = exactInput();
    const decision = createBoundedStorefrontSynthesisDecision(input);
    const tamperedAuthority = {
      ...decision,
      exactSelectionAuthority: {
        ...decision.exactSelectionAuthority,
        dynamicCommerceAuthorityFingerprint: "tampered-authority",
      },
    };
    const { synthesisFingerprint: _fingerprint, ...tamperedMaterial } = tamperedAuthority;
    void _fingerprint;
    expect(
      boundedStorefrontSynthesisDecisionSchema.safeParse({
        ...tamperedAuthority,
        synthesisFingerprint: `bounded-storefront-synthesis-${canonicalValueFingerprint(
          tamperedMaterial,
        )}`,
      }).success,
    ).toBe(false);
    expect(
      errorCode(() =>
        createBoundedStorefrontSynthesisDecision({
          ...input,
          pageBlueprintSelectionOverrides: [
            {
              ...input.pageBlueprintSelectionOverrides[0],
              profileId: "homepage-campaign-led",
            },
          ],
        }),
      ),
    ).toBe("invalid-bounded-override");
    expect(
      errorCode(() =>
        createBoundedStorefrontSynthesisDecision({
          ...input,
          dynamicCommerceSelection: {
            ...input.dynamicCommerceSelection,
            authorityFingerprint: "stale-dynamic-authority",
          },
        }),
      ),
    ).toBe("stale-authority");
    expect(
      errorCode(() =>
        createBoundedStorefrontSynthesisDecision({
          ...input,
          dynamicCommerceSelection: {
            ...input.dynamicCommerceSelection,
            productTypeMappings: {},
          },
        }),
      ),
    ).toBe("invalid-bounded-override");
    expect(
      errorCode(() =>
        validateBoundedStorefrontSynthesisDecision(decision, {
          planningInput: input.planningInput,
          siteMapDecision: input.siteMapDecision,
          approvedEvidenceReferences: input.approvedEvidenceReferences,
          request: input.request,
        }),
      ),
    ).toBe("stale-authority");
  });
});
