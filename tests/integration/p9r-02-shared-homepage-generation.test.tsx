import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import {
  createWholeStorefrontRecipeContext,
  createWholeStorefrontGenerationPlan,
  type WholeStorefrontGenerationPlan,
  type WholeStorefrontPlanningInput,
} from "@/application/whole-storefront-generation-plan";
import { compileWholeStorefrontProposal } from "@/application/whole-storefront-proposal-lifecycle";
import { storefrontDesignSystemV1 } from "@/application/storefront-design-system";
import { createStorefrontRenderContext } from "@/components/registry";
import { veskifyComponentDefinitionsV2 } from "@/components/registry/v2-registry";
import { renderStorefrontPage } from "@/components/storefront/storefront-page";
import { aurumNordicSeed } from "@/data/seed";
import type { CatalogueDisplayModel } from "@/domain/catalogue";
import type { PageModel, StorefrontSnapshot } from "@/domain/storefront";
import { createStandaloneAuthoritativeWholeStorefrontPlanningContextSource } from "@/integrations/ai/whole-storefront-runtime-authority";
import { createStorefrontProposalReview } from "@/app/projects/[projectId]/editor/storefront-proposal-review";
import {
  createP905aAcceptanceCoordinator,
  generateP905aScenario,
  saveAndResolveP905aPreview,
} from "../helpers/p9-05a-generation-harness";

const directions = ["premiumEditorial", "modernTechnical"] as const;

function homepage(snapshot: Pick<StorefrontSnapshot, "pages">) {
  const page = snapshot.pages.find((candidate) => candidate.type === "home");
  if (!page) throw new Error("Missing homepage.");
  return page;
}

function componentOrder(snapshot: Pick<StorefrontSnapshot, "pages">) {
  return homepage(snapshot).sections.map((section) => section.component);
}

function retainedHomepageContent(snapshot: Pick<StorefrontSnapshot, "pages">) {
  const page = homepage(snapshot);
  const section = (component: string) => page.sections.find((item) => item.component === component);
  return {
    heroMedia: section("hero")?.content.media,
    collectionIds: section("featuredCategories")?.content.collectionIds,
    productIds: section("productGrid")?.content.productIds,
  };
}

function renderHomepage(snapshot: StorefrontSnapshot, catalogue: CatalogueDisplayModel) {
  return renderPage(homepage(snapshot), snapshot, catalogue);
}

function renderPage(
  page: PageModel,
  snapshot: StorefrontSnapshot,
  catalogue: CatalogueDisplayModel,
) {
  return render(
    <>
      {renderStorefrontPage(
        page,
        createStorefrontRenderContext({
          activeLocale: "fi",
          primaryLocale: "fi",
          catalogue,
          snapshot,
        }),
      )}
    </>,
  );
}

function runtimeHomepage(
  snapshot: StorefrontSnapshot,
  components: readonly {
    id: string;
    component: string;
    variant: string;
    visible: boolean;
    content: Record<string, unknown>;
    props: Record<string, unknown>;
    styleOverrides: Record<string, unknown>;
  }[],
): PageModel {
  return {
    ...homepage(snapshot),
    sections: components.map((component) => ({
      id: component.id,
      component: component.component,
      variant: component.variant,
      visible: component.visible,
      content: component.content,
      props: component.props,
      styleOverrides: component.styleOverrides,
    })),
  };
}

async function compiledAurumHomepage(directionId: (typeof directions)[number]) {
  const context = await createStandaloneAuthoritativeWholeStorefrontPlanningContextSource().load({
    projectId: aurumNordicSeed.project.id,
    catalogueId: aurumNordicSeed.catalogue.id,
    enabledLocales: aurumNordicSeed.project.enabledLocales,
    requestedLocale: aurumNordicSeed.project.primaryLocale,
  });
  const planningInput: WholeStorefrontPlanningInput = {
    brief: context.brief,
    project: {
      id: aurumNordicSeed.project.id,
      revision: aurumNordicSeed.project.revision,
      enabledLocales: aurumNordicSeed.project.enabledLocales,
    },
    draft: aurumNordicSeed.draftSnapshot,
    catalogue: aurumNordicSeed.catalogue,
    componentDefinitions: context.componentDefinitions.map((definition) =>
      structuredClone(definition),
    ),
    recipeContext: createWholeStorefrontRecipeContext(),
    approvedAssetContext: context.approvedAssetContext,
    requiredAssetPlacements: [],
  };
  const plan = createWholeStorefrontGenerationPlan(planningInput, { directionId });
  const proposal = compileWholeStorefrontProposal({ plan, planningInput });
  const page = proposal.proposedStorefront.pages.find((candidate) => candidate.role === "homepage");
  if (!page) throw new Error("Missing compiled homepage.");
  return { plan, page };
}

function selectedHomepageVariants(plan: WholeStorefrontGenerationPlan) {
  const selections = plan.designSystemSelection.componentSelections;
  return [
    selections.header,
    selections.hero,
    selections.collectionDiscovery,
    selections.productCard,
    selections.storytelling,
    selections.campaign,
    selections.trust,
    selections.footer,
  ];
}

describe("P9R-02 shared-frame and homepage generation", () => {
  it("keeps every curated shared-frame and homepage recipe variant registered", () => {
    const definitions = new Map(
      veskifyComponentDefinitionsV2.map((definition) => [definition.type, definition]),
    );

    directions.forEach((directionId) => {
      const direction = storefrontDesignSystemV1.directions.find(
        (candidate) => candidate.id === directionId,
      );
      const recipe = storefrontDesignSystemV1.homepageRecipes.find(
        (candidate) => candidate.id === direction?.homepageRecipeId,
      );
      if (!direction || !recipe) throw new Error("Missing curated homepage direction.");

      expect(recipe.sections.map((section) => section.component)).toEqual(
        expect.arrayContaining([
          "announcementBar",
          "header",
          "hero",
          "featuredCategories",
          "productGrid",
          "brandStory",
          "campaignBanner",
          "benefitIcons",
          "footer",
        ]),
      );
      recipe.sections.forEach((section) => {
        const definition = definitions.get(section.component);
        expect(definition?.variants.map((variant) => variant.id)).toContain(section.variant);
      });
      expect(
        Object.values(direction.componentSelections).map((selection) => selection.component),
      ).toEqual(
        expect.arrayContaining([
          "header",
          "hero",
          "featuredCategories",
          "productGrid",
          "brandStory",
          "campaignBanner",
          "benefitIcons",
          "footer",
        ]),
      );
    });
  });

  it("preserves the selected recipe from the plan through compiler, snapshot, saved preview, and renderer", async () => {
    const premium = await generateP905aScenario("premiumEditorial");
    const modern = await generateP905aScenario("modernTechnical");
    const scenarios = { premiumEditorial: premium, modernTechnical: modern };
    const expectedOrders = {
      premiumEditorial: ["header", "hero", "featuredCategories", "productGrid", "footer"],
      modernTechnical: [
        "header",
        "hero",
        "productGrid",
        "featuredCategories",
        "brandStory",
        "benefitIcons",
        "footer",
      ],
    } as const;

    for (const directionId of directions) {
      const generated = scenarios[directionId];
      const accepted = createP905aAcceptanceCoordinator(generated).accept();
      if (accepted.state !== "accepted") throw new Error("The generated proposal did not accept.");

      const compiledHome = generated.compiledProposal.proposedStorefront.pages.find(
        (page) => page.role === "homepage",
      );
      expect(generated.plan.designSystemSelection.directionId).toBe(directionId);
      expect(compiledHome?.components.map((component) => component.component)).toEqual(
        expectedOrders[directionId],
      );
      expect(componentOrder(generated.proposal.proposedStorefront)).toEqual(
        expectedOrders[directionId],
      );
      expect(componentOrder(accepted.activeDraft)).toEqual(expectedOrders[directionId]);
      expect(retainedHomepageContent(accepted.activeDraft)).toEqual(
        retainedHomepageContent(generated.fixture.draft),
      );
      expect(accepted.activeDraft.navigation).toEqual(generated.fixture.draft.navigation);
    }

    const merchantReview = createStorefrontProposalReview(modern.proposal, "en", "fi");
    const finnishMerchantReview = createStorefrontProposalReview(modern.proposal, "fi", "fi");
    expect(
      merchantReview.pages
        .find((page) => page.title === "Homepage")
        ?.items.some((item) => /section order updated/i.test(item.summary)),
    ).toBe(true);
    expect(
      finnishMerchantReview.pages
        .find((page) => page.title === "Etusivu")
        ?.items.some((item) => /osiojärjestys päivittyy/i.test(item.summary)),
    ).toBe(true);

    const saved = await saveAndResolveP905aPreview({
      generated: modern,
      accepted: createP905aAcceptanceCoordinator(modern).accept().activeDraft,
    });
    expect(componentOrder(saved.preview)).toEqual(expectedOrders.modernTechnical);

    const premiumRender = renderHomepage(
      createP905aAcceptanceCoordinator(premium).accept().activeDraft,
      premium.fixture.aggregate.catalogue,
    );
    expect(
      premiumRender.container.querySelector(".store-header.store-variant--transparent nav"),
    ).toBeTruthy();
    expect(
      premiumRender.container.querySelector(".store-hero.store-variant--fullBleed"),
    ).toBeTruthy();
    expect(
      premiumRender.container.querySelector(".store-footer.store-variant--editorial"),
    ).toBeTruthy();

    const modernRender = renderHomepage(saved.preview, modern.fixture.aggregate.catalogue);
    expect(
      modernRender.container.querySelector(".store-header.store-variant--compact nav"),
    ).toBeTruthy();
    expect(
      modernRender.container.querySelector(".store-hero.store-variant--asymmetric"),
    ).toBeTruthy();
    expect(
      modernRender.container.querySelector(".store-section.store-variant--compact .product-grid"),
    ).toBeTruthy();
    expect(
      modernRender.container.querySelector(".store-footer.store-variant--compact"),
    ).toBeTruthy();
    expect(componentOrder(saved.preview)).not.toEqual(
      componentOrder(createP905aAcceptanceCoordinator(premium).accept().activeDraft),
    );
  }, 30_000);

  it("renders every selected shared-frame and homepage variant without changing bindings or approved assets", async () => {
    const [premium, modern] = await Promise.all(
      directions.map((directionId) => compiledAurumHomepage(directionId)),
    );
    const original = homepage(aurumNordicSeed.draftSnapshot);

    for (const generated of [premium, modern]) {
      const variants = new Map(
        generated.page.components.map((component) => [component.component, component.variant]),
      );
      selectedHomepageVariants(generated.plan).forEach((selection) => {
        expect(variants.get(selection.component)).toBe(selection.variant);
      });
      generated.page.components.forEach((component) => {
        const source = original.sections.find((section) => section.id === component.id);
        if (!source) return;
        expect({ content: component.content, props: component.props }).toEqual({
          content: source.content,
          props: source.props,
        });
      });
    }

    const premiumRender = renderPage(
      runtimeHomepage(aurumNordicSeed.draftSnapshot, premium.page.components),
      aurumNordicSeed.draftSnapshot,
      aurumNordicSeed.catalogue,
    );
    expect(
      premiumRender.container.querySelector(".store-variant--imageLed.brand-story"),
    ).toBeTruthy();
    expect(
      premiumRender.container.querySelector(".campaign-banner.store-variant--imageOverlay"),
    ).toBeTruthy();
    expect(premiumRender.container.querySelector(".benefits.store-variant--minimal")).toBeTruthy();

    const modernRender = renderPage(
      runtimeHomepage(aurumNordicSeed.draftSnapshot, modern.page.components),
      aurumNordicSeed.draftSnapshot,
      aurumNordicSeed.catalogue,
    );
    expect(
      modernRender.container.querySelector(".brand-story.store-variant--minimal"),
    ).toBeTruthy();
    expect(
      modernRender.container.querySelector(".campaign-banner.store-variant--minimal"),
    ).toBeTruthy();
    expect(
      modernRender.container.querySelector(".benefits.store-variant--threeColumn"),
    ).toBeTruthy();
  });
});
