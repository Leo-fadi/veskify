// @vitest-environment node

import { describe, expect, it } from "vitest";
import {
  classifyRegisteredWholeStorefrontDirectionRequest,
  planRegisteredTokenRefinement,
} from "@/application/ai-storefront-generation";
import {
  WholeStorefrontProposalAcceptanceCoordinator,
  compileWholeStorefrontProposal,
} from "@/application/whole-storefront-proposal-lifecycle";
import { createWholeStorefrontGenerationPlan } from "@/application/whole-storefront-generation-plan";
import { canonicalValueString } from "@/domain/storefront";
import { createP905aFreshMerchantFixture } from "@/data/demo/p9-05a-fresh-store-generation";
import {
  createP905aAcceptanceCoordinator,
  generateP905aScenarioFromBaseline,
} from "../helpers/p9-05a-generation-harness";

const modernTechnicalRequest =
  "Redesign the entire storefront in a modern technical direction. Create a substantially different coordinated composition across the homepage, collection page and product-detail page. Use compact spacing, crisp surfaces, commerce-focused collection cards, structured product discovery, a specification-led product-detail page, and a coordinated shared header and footer. Preserve all catalogue data, product identities, prices, stock, options, media bindings and approved assets.";

function requiredPage(
  proposal: Awaited<ReturnType<typeof generateP905aScenarioFromBaseline>>["proposal"],
  type: "home" | "collection" | "product",
) {
  const page = proposal.proposedStorefront.pages.find((candidate) => candidate.type === type);
  if (page === undefined) throw new Error(`Missing ${type} page.`);
  return page;
}

describe("P9R-01 whole-storefront AI composition orchestrator", () => {
  it("materializes the exact modern-technical request into one coordinated structural proposal", async () => {
    const generated = await generateP905aScenarioFromBaseline(
      "modernTechnical",
      "warmApproachable",
      modernTechnicalRequest,
    );
    const { plan, proposal } = generated;
    const homepage = requiredPage(proposal, "home");
    const collection = requiredPage(proposal, "collection");
    const product = requiredPage(proposal, "product");
    const baselineHomepage = generated.fixture.draft.pages.find((page) => page.type === "home");
    const baselineCollection = generated.fixture.draft.pages.find(
      (page) => page.type === "collection",
    );
    const baselineProduct = generated.fixture.draft.pages.find((page) => page.type === "product");
    if (!baselineHomepage || !baselineCollection || !baselineProduct) {
      throw new Error("Missing fresh P9-05A core storefront baseline.");
    }

    expect(
      classifyRegisteredWholeStorefrontDirectionRequest(
        modernTechnicalRequest,
        generated.fixture.draft.brandSystem,
      ),
    ).toEqual({ kind: "selected", direction: "modernTechnical" });
    expect(generated.request.instruction).toBe(modernTechnicalRequest);
    expect(generated.request.capability).toBe("registeredWholeStorefrontDirection");
    expect(plan.requestClass).toBe("coordinatedStructuralDirection");
    expect(plan.designSystemSelection).toMatchObject({
      directionId: "modernTechnical",
      homepageRecipeId: "homeModernCommerce",
      collectionRecipeId: "collectionCommerce",
      productRecipeId: "productVariantLed",
      spacingDensity: "compact",
      cornerTreatment: "square",
      surfaceDepth: "flat",
      componentSelections: {
        header: { component: "header", variant: "compact" },
        footer: { component: "footer", variant: "compact" },
        hero: { component: "hero", variant: "asymmetric" },
        productCard: { component: "productGrid", variant: "compact" },
        collectionCommerce: { component: "dynamicCollectionCommerce", variant: "compact" },
        productDetail: { component: "dynamicProductDetail", variant: "compact" },
      },
    });
    expect(plan.sharedChrome.headerComponentIds).toHaveLength(3);
    expect(plan.sharedChrome.footerComponentIds).toHaveLength(3);

    [homepage, collection, product].forEach((page) => {
      expect(page.sections.find((section) => section.component === "header")?.variant).toBe(
        "compact",
      );
      expect(page.sections.find((section) => section.component === "footer")?.variant).toBe(
        "compact",
      );
    });
    expect(homepage.sections.map((section) => section.component)).toEqual([
      "header",
      "hero",
      "productGrid",
      "featuredCategories",
      "footer",
    ]);
    expect(homepage.sections.find((section) => section.component === "hero")?.variant).toBe(
      "asymmetric",
    );
    expect(homepage.sections.find((section) => section.component === "productGrid")?.variant).toBe(
      "compact",
    );
    expect(homepage.sections).not.toEqual(baselineHomepage.sections);
    expect(collection.sections.map((section) => section.component)).toEqual([
      "header",
      "dynamicCollectionCommerce",
      "footer",
    ]);
    expect(collection.sections.find((section) => section.component === "dynamicCollectionCommerce")).toMatchObject({
      variant: "compact",
      props: { gridDensity: "compact", cardVariant: "compact", filterLayout: "sidebar" },
    });
    expect(collection.sections).not.toEqual(baselineCollection.sections);
    expect(product.sections.map((section) => section.component)).toEqual([
      "header",
      "dynamicProductDetail",
      "footer",
    ]);
    expect(product.sections.find((section) => section.component === "dynamicProductDetail")).toMatchObject({
      variant: "compact",
      props: {
        galleryLayout: "thumbnails",
        optionDensity: "compact",
        attributeLayout: "table",
        mediaTreatment: "contained",
      },
    });
    expect(product.sections).not.toEqual(baselineProduct.sections);
  });

  it("keeps token-only refinement non-structural", () => {
    const fixture = createP905aFreshMerchantFixture("warmApproachable");
    const tokenRefinement = planRegisteredTokenRefinement(
      "Use primary forest green, secondary sage, background warm off-white, and Georgia headings with Inter body text. Preserve layouts, sections, products, and images.",
      fixture.planningInput.draft.brandSystem,
    );
    if (tokenRefinement === null) throw new Error("Expected a validated token-only refinement.");
    const plan = createWholeStorefrontGenerationPlan(fixture.planningInput, {
      tokenRefinementPlan: tokenRefinement,
    });
    const proposal = compileWholeStorefrontProposal({ plan, planningInput: fixture.planningInput });

    expect(plan.requestClass).toBe("tokenOnlyRefinement");
    expect(proposal.proposedStorefront.pages).toEqual(proposal.originalStorefront.pages);
    expect(proposal.proposedStorefront.navigation).toEqual(proposal.originalStorefront.navigation);
  });

  it("accepts the coordinated proposal as one reversible transaction without changing commerce", async () => {
    const generated = await generateP905aScenarioFromBaseline(
      "modernTechnical",
      "warmApproachable",
      modernTechnicalRequest,
    );
    const commerceBefore = structuredClone(generated.fixture.aggregate.catalogue);
    const coordinator = createP905aAcceptanceCoordinator(generated);
    const accepted = coordinator.accept();

    expect(accepted.state).toBe("accepted");
    expect(generated.proposal.operations).toHaveLength(4);
    expect(generated.proposal.operations.filter((operation) => operation.operation.type === "APPLY_REGISTERED_PAGE_SECTIONS")).toHaveLength(3);
    expect(coordinator.undo()).toEqual(generated.fixture.draft);
    expect(coordinator.redo()).toEqual(accepted.activeDraft);
    expect(canonicalValueString(generated.fixture.aggregate.catalogue)).toBe(
      canonicalValueString(commerceBefore),
    );
  });
});
