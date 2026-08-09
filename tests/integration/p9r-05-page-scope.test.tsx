import { render } from "@testing-library/react";

import { describe, expect, it } from "vitest";
import {
  hasExplicitStorefrontSectionIntent,
  resolveStorefrontGenerationScope,
  StorefrontGenerationScopeError,
} from "@/application/ai-storefront-generation";
import { createStorefrontRenderContext } from "@/components/registry";
import { renderStorefrontPage } from "@/components/storefront/storefront-page";
import { canonicalValueString } from "@/domain/storefront";
import {
  createP905aAcceptanceCoordinator,
  generateP905aHomepageOnlyScenarioFromBaseline,
} from "../helpers/p9-05a-generation-harness";

const homepageOnlyRequest =
  "Redesign only the homepage as a bold modern technical landing page. Replace the current composition with a materially different layout: compact header, asymmetric hero, featured products near the top, structured collection discovery, specification-style brand story, three-column trust section, and compact footer. Change section order, component variants, density, surfaces, and hierarchy—not just colours or typography. Preserve all products, prices, stock, media bindings, routes, and approved assets. Do not change the collection page or product page.";

describe("P9R-05 homepage-only composition scope", () => {
  it("routes the explicit homepage-only request without silently widening its authority", () => {
    const generatedPages = [
      { id: "page_home", type: "home" as const },
      { id: "page_collection", type: "collection" as const },
      { id: "page_product", type: "product" as const },
    ];

    expect(resolveStorefrontGenerationScope(homepageOnlyRequest, generatedPages)).toEqual({
      kind: "homepage",
      affectedPageIds: ["page_home"],
      includesSharedFrame: false,
    });
    expect(
      resolveStorefrontGenerationScope(
        "Uudista vain etusivu moderniksi tekniseksi.",
        generatedPages,
      ),
    ).toEqual({
      kind: "homepage",
      affectedPageIds: ["page_home"],
      includesSharedFrame: false,
    });
    expect(() =>
      resolveStorefrontGenerationScope(
        "Redesign only the homepage and product page.",
        generatedPages,
      ),
    ).toThrow(StorefrontGenerationScopeError);
    expect(() =>
      resolveStorefrontGenerationScope("Uudista vain tuotesivu.", generatedPages),
    ).toThrow(StorefrontGenerationScopeError);
    expect(
      resolveStorefrontGenerationScope(
        "Create a modern technical storefront with compact comparison.",
        generatedPages,
      ),
    ).toMatchObject({ kind: "storefront", includesSharedFrame: true });
  });

  it.each([
    "Make only the homepage hero modern technical.",
    "Tee vain etusivun hero-osio moderniksi tekniseksi.",
  ])("keeps explicit homepage section intent outside page-wide authority for %s", (request) => {
    const generatedPages = [
      { id: "page_home", type: "home" as const },
      { id: "page_collection", type: "collection" as const },
      { id: "page_product", type: "product" as const },
    ];

    expect(hasExplicitStorefrontSectionIntent(request)).toBe(true);
    expect(() => resolveStorefrontGenerationScope(request, generatedPages)).toThrow(
      StorefrontGenerationScopeError,
    );
    expect(
      hasExplicitStorefrontSectionIntent(
        "Redesign only the homepage as a modern technical landing page.",
      ),
    ).toBe(false);
    expect(hasExplicitStorefrontSectionIntent(homepageOnlyRequest)).toBe(false);
  });

  it("generates, renders, reviews, accepts, undoes, and redoes a material homepage-only proposal", async () => {
    const generated = await generateP905aHomepageOnlyScenarioFromBaseline(
      "warmApproachable",
      homepageOnlyRequest,
    );
    const baseline = generated.fixture.draft;
    const home = baseline.pages.find((page) => page.type === "home")!;
    const collection = baseline.pages.find((page) => page.type === "collection")!;
    const product = baseline.pages.find((page) => page.type === "product")!;

    expect(generated.request.target).toMatchObject({
      scope: "page",
      affectedPageIds: [home.id],
      designSystemTarget: null,
    });
    expect(generated.proposal.operations).toHaveLength(1);
    expect(generated.proposal.operations[0]).toMatchObject({
      target: { kind: "page", pageId: home.id },
      operation: { type: "APPLY_REGISTERED_PAGE_SECTIONS" },
    });
    expect(generated.proposal.proposedStorefront.brandSystem).toEqual(baseline.brandSystem);

    const coordinator = createP905aAcceptanceCoordinator(generated);
    const accepted = coordinator.accept();
    expect(accepted.state).toBe("accepted");
    if (accepted.state !== "accepted") {
      throw new Error("P9R-05 homepage proposal was not accepted.");
    }
    const homepage = accepted.activeDraft.pages.find((page) => page.type === "home")!;
    const homepageProfile = generated.plan.pageBlueprintMaterializations.find(
      (materialization) => materialization.pageType === "home",
    );
    if (!homepageProfile) throw new Error("Missing authoritative homepage profile.");
    expect(homepage.sections.map((section) => `${section.component}:${section.variant}`)).toEqual(
      homepageProfile.slots
        .filter((slot) => homepage.sections.some((section) => section.component === slot.component))
        .map((slot) => `${slot.component}:${slot.variant}`),
    );
    expect(homepage.sections.map((section) => section.id)).not.toEqual(
      home.sections.map((section) => section.id),
    );
    const order = homepage.sections.map((section) => section.component);
    expect(order.indexOf("homepageFeaturedProducts")).toBeLessThan(
      order.indexOf("homepageCollectionNavigation"),
    );
    expect(order.indexOf("brandStory")).toBeLessThan(order.indexOf("footer"));
    expect(homepage.sections.some((section) => section.component === "benefitIcons")).toBe(false);
    expect(JSON.stringify(generated.proposal.proposedStorefront)).not.toMatch(
      /complimentary delivery|materials? (?:chosen )?to last|durability|guarantee/i,
    );

    const rendered = render(
      <>
        {renderStorefrontPage(
          homepage,
          createStorefrontRenderContext({
            activeLocale: "en",
            primaryLocale: "en",
            catalogue: generated.fixture.aggregate.catalogue,
            snapshot: accepted.activeDraft,
          }),
        )}
      </>,
    );
    expect(
      rendered.container.querySelector(".store-header.store-variant--compact nav"),
    ).toBeTruthy();
    expect(rendered.container.querySelector('[data-component="homepageHero"]')).toBeTruthy();
    expect(
      rendered.container.querySelector('[data-component="homepageFeaturedProducts"]'),
    ).toBeTruthy();
    expect(
      rendered.container.querySelector(
        '[data-component="homepageEditorial"][data-variant="continuationCta"]',
      ),
    ).toBeTruthy();
    expect(rendered.container.querySelector('[data-component="homepageTrust"]')).toBeTruthy();
    expect(rendered.container.querySelector(".store-footer.store-variant--compact")).toBeTruthy();
    expect(accepted.activeDraft.brandSystem).toEqual(baseline.brandSystem);
    expect(
      canonicalValueString(accepted.activeDraft.pages.find((page) => page.type === "collection")),
    ).toBe(canonicalValueString(collection));
    expect(
      canonicalValueString(accepted.activeDraft.pages.find((page) => page.type === "product")),
    ).toBe(canonicalValueString(product));
    expect(coordinator.undo()).toEqual(baseline);
    expect(coordinator.redo()).toEqual(accepted.activeDraft);
  });
});
