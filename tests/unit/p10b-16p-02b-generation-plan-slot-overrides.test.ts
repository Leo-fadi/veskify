import { describe, expect, it } from "vitest";
import {
  createWholeStorefrontGenerationPlan,
  validateWholeStorefrontGenerationPlan,
} from "@/application/whole-storefront-generation-plan";
import { compileWholeStorefrontProposal } from "@/application/whole-storefront-proposal-lifecycle";
import { materializeWholeStorefrontRuntimeSnapshot } from "@/application/whole-storefront-proposal-lifecycle/snapshot-materialization";
import { getCommercialHomepageProfile } from "@/application/storefront-templates";
import { createP905aFreshMerchantFixture } from "@/data/demo/p9-05a-fresh-store-generation";
import { applyCommercialSharedFrame } from "@/domain/storefront";

function planningInput() {
  const fixture = createP905aFreshMerchantFixture("premiumEditorial");
  const profile = getCommercialHomepageProfile("homepage-editorial-storytelling");
  const frameProfileId = profile?.profile?.commercialHomepage?.defaultSharedFrameProfileId;
  if (!frameProfileId) throw new Error("Missing commercial homepage fixture authority.");
  return {
    ...fixture.planningInput,
    draft: applyCommercialSharedFrame(fixture.planningInput.draft, frameProfileId),
  };
}

const exactHeroSelection = [
  {
    pageType: "home" as const,
    profileId: "homepage-editorial-storytelling",
    slotSelections: [
      {
        slotId: "curated-products",
        component: "homepageFeaturedProducts",
        variant: "editorial",
        boundedParameters: { columnCount: 3 },
      },
      {
        slotId: "hero",
        component: "homepageHero",
        variant: "fullBleedOverlay",
        boundedParameters: { mediaPlacement: "background" },
      },
    ],
  },
] as const;

describe("P10B-16P-02B whole-storefront PageBlueprint selection authority", () => {
  it("carries an exact registered variant through deterministic plan replay and proposal compilation", () => {
    const input = planningInput();
    const plan = createWholeStorefrontGenerationPlan(input, {
      directionId: "premiumEditorial",
      homepageProfileId: "homepage-editorial-storytelling",
      pageBlueprintSelectionOverrides: exactHeroSelection,
    });

    expect(plan.pageBlueprintSelectionOverrides).toEqual(exactHeroSelection);
    expect(
      plan.pageBlueprintMaterializations
        .find(({ pageType }) => pageType === "home")
        ?.slots.find(({ slotId }) => slotId === "hero"),
    ).toMatchObject({
      component: "homepageHero",
      variant: "fullBleedOverlay",
      boundedParameters: { mediaPlacement: "background" },
    });
    const plannedHomepage = plan.pagePlans.find(({ role }) => role === "homepage");
    expect(
      plannedHomepage?.components.find(
        (component) => "instance" in component && component.pageBlueprintSlotId === "hero",
      ),
    ).toMatchObject({
      instance: {
        component: "homepageHero",
        variant: "fullBleedOverlay",
        props: { mediaPosition: "background" },
      },
    });
    expect(
      plannedHomepage?.components.find(
        (component) =>
          "instance" in component && component.pageBlueprintSlotId === "curated-products",
      ),
    ).toMatchObject({
      instance: { component: "homepageFeaturedProducts", props: { columns: 3 } },
    });

    expect(validateWholeStorefrontGenerationPlan(input, plan)).toEqual(plan);
    const proposal = compileWholeStorefrontProposal({ plan, planningInput: input });
    const proposedHomepage = proposal.proposedStorefront.pages.find(
      ({ role }) => role === "homepage",
    );
    expect(
      proposedHomepage?.components.find(({ component }) => component === "homepageHero"),
    ).toMatchObject({
      variant: "fullBleedOverlay",
      props: { mediaPosition: "background" },
    });
    expect(
      proposedHomepage?.components.find(
        ({ component }) => component === "homepageFeaturedProducts",
      ),
    ).toMatchObject({ props: { columns: 3 } });

    const snapshot = materializeWholeStorefrontRuntimeSnapshot({
      runtime: proposal.proposedStorefront,
      planningInput: input,
    });
    const snapshotHomepage = snapshot.pages.find(({ type }) => type === "home");
    expect(
      snapshotHomepage?.sections.find(({ component }) => component === "homepageHero"),
    ).toMatchObject({
      variant: "fullBleedOverlay",
      props: { mediaPosition: "background" },
    });
    expect(
      snapshotHomepage?.sections.find(({ component }) => component === "homepageFeaturedProducts"),
    ).toMatchObject({ props: { columns: 3 } });
  });

  it("changes request authority deterministically and fails closed for a mismatched profile", () => {
    const input = planningInput();
    const baseline = createWholeStorefrontGenerationPlan(input, {
      directionId: "premiumEditorial",
      homepageProfileId: "homepage-editorial-storytelling",
    });
    const selected = createWholeStorefrontGenerationPlan(input, {
      directionId: "premiumEditorial",
      homepageProfileId: "homepage-editorial-storytelling",
      pageBlueprintSelectionOverrides: exactHeroSelection,
    });
    const repeated = createWholeStorefrontGenerationPlan(input, {
      directionId: "premiumEditorial",
      homepageProfileId: "homepage-editorial-storytelling",
      pageBlueprintSelectionOverrides: exactHeroSelection,
    });

    expect(selected).toEqual(repeated);
    expect(selected.requestFingerprint).not.toBe(baseline.requestFingerprint);
    expect(selected.fingerprint).not.toBe(baseline.fingerprint);
    expect(() =>
      createWholeStorefrontGenerationPlan(input, {
        directionId: "premiumEditorial",
        homepageProfileId: "homepage-editorial-storytelling",
        pageBlueprintSelectionOverrides: [
          {
            ...exactHeroSelection[0],
            profileId: "homepage-campaign-led",
          },
        ],
      }),
    ).toThrow(/active profile/i);
  });

  it("projects exact composite collection and PDP variants into their canonical runtime owners", () => {
    const input = planningInput();
    const plan = createWholeStorefrontGenerationPlan(input, {
      directionId: "premiumEditorial",
      homepageProfileId: "homepage-editorial-storytelling",
      collectionProfileId: "collection-editorial-discovery",
      pdpProfileId: "pdp-high-consideration",
      pageBlueprintSelectionOverrides: [
        {
          pageType: "collection",
          profileId: "collection-editorial-discovery",
          slotSelections: [
            {
              slotId: "collection-commerce",
              component: "dynamicCollectionCommerce",
              variant: "catalogueComparison",
            },
          ],
        },
        {
          pageType: "product",
          profileId: "pdp-high-consideration",
          slotSelections: [
            {
              slotId: "dynamic-product-detail",
              component: "dynamicProductDetail",
              variant: "galleryDominant",
            },
          ],
        },
      ],
    });

    const collection = plan.pagePlans
      .find(({ role }) => role === "collection-template")
      ?.components.find(
        (component) =>
          "instance" in component && component.instance.component === "dynamicCollectionCommerce",
      );
    const product = plan.pagePlans
      .find(({ role }) => role === "product-template")
      ?.components.find(
        (component) =>
          "instance" in component && component.instance.component === "dynamicProductDetail",
      );
    expect(collection).toMatchObject({ instance: { variant: "catalogueComparison" } });
    expect(product).toMatchObject({ instance: { variant: "galleryDominant" } });
    expect(() => compileWholeStorefrontProposal({ plan, planningInput: input })).not.toThrow();
  });

  it("keeps different collection-discovery anatomies valid when their presentation labels match", () => {
    const fixture = createP905aFreshMerchantFixture("modernTechnical");
    const initialInput = {
      ...structuredClone(fixture.planningInput),
      catalogue: {
        ...structuredClone(fixture.planningInput.catalogue),
        collections: structuredClone(fixture.planningInput.catalogue.collections.slice(0, 1)),
      },
      draft: applyCommercialSharedFrame(fixture.planningInput.draft, "compact-technical"),
    };
    const initialPlan = createWholeStorefrontGenerationPlan(initialInput, {
      directionId: "modernTechnical",
      homepageProfileId: "homepage-collection-gateway",
    });
    const initialProposal = compileWholeStorefrontProposal({
      plan: initialPlan,
      planningInput: initialInput,
    });
    const editedDraft = materializeWholeStorefrontRuntimeSnapshot({
      runtime: initialProposal.proposedStorefront,
      planningInput: initialInput,
    });
    const homepage = editedDraft.pages.find(({ type }) => type === "home");
    if (!homepage) throw new Error("Missing homepage.");
    const featuredCollections = homepage.sections.find(
      ({ component }) => component === "homepageFeaturedCollections",
    );
    const collectionNavigation = homepage.sections.find(
      ({ component }) => component === "homepageCollectionNavigation",
    );
    if (!featuredCollections || !collectionNavigation) {
      throw new Error("Missing collection-discovery sections.");
    }
    featuredCollections.props = { ...featuredCollections.props, cardPresentation: "compact" };
    collectionNavigation.props = { ...collectionNavigation.props, presentation: "compact" };

    expect(() =>
      createWholeStorefrontGenerationPlan(
        { ...initialInput, draft: editedDraft },
        {
          directionId: "modernTechnical",
          homepageProfileId: "homepage-collection-gateway",
        },
      ),
    ).not.toThrow();
  });
});
