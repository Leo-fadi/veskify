// @vitest-environment node

import { beforeAll, describe, expect, it } from "vitest";
import {
  classifyRegisteredWholeStorefrontDirectionRequest,
  planRegisteredTokenRefinement,
} from "@/application/ai-storefront-generation";
import { compileWholeStorefrontProposal } from "@/application/whole-storefront-proposal-lifecycle";
import { createWholeStorefrontGenerationPlan } from "@/application/whole-storefront-generation-plan";
import { canonicalValueString } from "@/domain/storefront";
import { createP905aFreshMerchantFixture } from "@/data/demo/p9-05a-fresh-store-generation";
import {
  createP905aAcceptanceCoordinator,
  generateP905aInstructionScenarioFromBaseline,
} from "../helpers/p9-05a-generation-harness";

const modernTechnicalRequest =
  "Redesign the entire storefront in a modern technical direction. Create a substantially different coordinated composition across the homepage, collection page and product-detail page. Use compact spacing, crisp surfaces, commerce-focused collection cards, structured product discovery, a specification-led product-detail page, and a coordinated shared header and footer. Preserve all catalogue data, product identities, prices, stock, options, media bindings and approved assets.";

const warmApproachableRequest =
  "Redesign the entire storefront in a warm approachable direction. Use welcoming category discovery and softer surfaces while preserving catalogue data and approved assets.";

function requiredPage(
  proposal: Awaited<ReturnType<typeof generateP905aInstructionScenarioFromBaseline>>["proposal"],
  type: "home" | "collection" | "product",
) {
  const page = proposal.proposedStorefront.pages.find((candidate) => candidate.type === type);
  if (page === undefined) throw new Error(`Missing ${type} page.`);
  return page;
}

type InstructionScenario = Awaited<ReturnType<typeof generateP905aInstructionScenarioFromBaseline>>;
type InstructionScenarios = Readonly<{
  modern: InstructionScenario;
  warm: InstructionScenario;
}>;

function executablePageProjection(
  pages: Array<{
    pageId?: string;
    id?: string;
    components?: Array<{
      id: string;
      component: string;
      variant: string;
      props: Record<string, unknown>;
    }>;
    sections?: Array<{
      id: string;
      component: string;
      variant: string;
      props: Record<string, unknown>;
    }>;
  }>,
) {
  return pages
    .map((page) => ({
      pageId: page.pageId ?? page.id,
      components: (page.components ?? page.sections ?? []).map((component) => ({
        id: component.id,
        component: component.component,
        variant: component.variant,
        props: component.props,
      })),
    }))
    .sort((left, right) => (left.pageId ?? "").localeCompare(right.pageId ?? ""));
}

// The slowest measured deterministic setup was 11.88s, so this preserves a
// narrow margin while keeping shared generation under Vitest control.
const sharedScenarioSetupTimeoutMs = 15_000;
let instructionScenarios: InstructionScenarios | undefined;

function requiredInstructionScenarios(): InstructionScenarios {
  if (!instructionScenarios) throw new Error("P9R-01 instruction scenarios did not initialize.");
  return instructionScenarios;
}

describe("P9R-01 whole-storefront AI composition orchestrator", () => {
  beforeAll(async () => {
    const modern = await generateP905aInstructionScenarioFromBaseline(
      "warmApproachable",
      modernTechnicalRequest,
    );
    const warm = await generateP905aInstructionScenarioFromBaseline(
      "modernTechnical",
      warmApproachableRequest,
    );
    instructionScenarios = Object.freeze({ modern, warm });
  }, sharedScenarioSetupTimeoutMs);

  it("materializes the exact modern-technical request into one coordinated structural proposal", () => {
    const generated = requiredInstructionScenarios().modern;
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

    expect(generated.request.instruction).toBe(modernTechnicalRequest);
    expect(generated.request.capability).toBe("registeredWholeStorefrontDirection");
    expect(generated.providerRequests).toHaveLength(1);
    expect(generated.providerRequests[0]?.merchantInstruction).toBe(modernTechnicalRequest);
    expect(generated.providerRequests[0]?.merchantInstruction).not.toBe(
      generated.fixture.direction.merchantInstruction,
    );
    expect(generated.providerPlans).toEqual([plan]);
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
      "brandStory",
      "footer",
    ]);
    expect(homepage.sections.find((section) => section.component === "hero")?.variant).toBe(
      "asymmetric",
    );
    expect(homepage.sections.find((section) => section.component === "productGrid")?.variant).toBe(
      "compact",
    );
    expect(homepage.sections.find((section) => section.component === "productGrid")?.props).toEqual(
      expect.objectContaining({
        background: "background",
        density: "compact",
        shape: "square",
        typography: "sans",
      }),
    );
    expect(homepage.sections).not.toEqual(baselineHomepage.sections);
    expect(collection.sections.map((section) => section.component)).toEqual([
      "header",
      "dynamicCollectionCommerce",
      "footer",
    ]);
    expect(
      collection.sections.find((section) => section.component === "dynamicCollectionCommerce"),
    ).toMatchObject({
      variant: "compact",
      props: { gridDensity: "compact", cardVariant: "compact", filterLayout: "sidebar" },
    });
    expect(collection.sections).not.toEqual(baselineCollection.sections);
    expect(product.sections.map((section) => section.component)).toEqual([
      "header",
      "dynamicProductDetail",
      "footer",
    ]);
    expect(
      product.sections.find((section) => section.component === "dynamicProductDetail"),
    ).toMatchObject({
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

  it("uses the compiler execution projection unchanged in the runtime-authority proposal", () => {
    const generated = requiredInstructionScenarios().modern;

    expect(executablePageProjection(generated.proposal.proposedStorefront.pages)).toEqual(
      executablePageProjection(generated.compiledProposal.proposedStorefront.pages),
    );
    expect(generated.proposal.proposedStorefront.brandSystem).toEqual(
      generated.compiledProposal.proposedStorefront.brandSystem,
    );
    expect(generated.proposal.proposedStorefront.navigation).toEqual(
      generated.compiledProposal.proposedStorefront.navigation,
    );
  });

  it("derives the registered direction from each provider-received instruction", async () => {
    const { modern, warm } = requiredInstructionScenarios();
    const repeatedWarm = await generateP905aInstructionScenarioFromBaseline(
      "modernTechnical",
      warmApproachableRequest,
    );

    expect(warm.providerRequests).toEqual([
      expect.objectContaining({ merchantInstruction: warmApproachableRequest }),
    ]);
    expect(repeatedWarm.providerRequests).toEqual([
      expect.objectContaining({ merchantInstruction: warmApproachableRequest }),
    ]);
    expect(warm.plan.designSystemSelection.directionId).toBe("warmApproachable");
    expect(repeatedWarm.plan.fingerprint).toBe(warm.plan.fingerprint);
    expect(modern.plan.designSystemSelection.directionId).toBe("modernTechnical");
    expect(modern.plan.fingerprint).not.toBe(warm.plan.fingerprint);
  });

  it("classifies ambiguous and unsupported instructions through the canonical safe path", () => {
    expect(
      classifyRegisteredWholeStorefrontDirectionRequest("Make it warm premium and minimal Nordic"),
    ).toMatchObject({ kind: "ambiguous" });
    expect(
      classifyRegisteredWholeStorefrontDirectionRequest(
        "Write fresh social copy for the product launch.",
      ),
    ).toMatchObject({ kind: "unsupported" });
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

  it("accepts the coordinated proposal as one reversible transaction without changing commerce", () => {
    const generated = requiredInstructionScenarios().modern;
    const commerceBefore = structuredClone(generated.fixture.aggregate.catalogue);
    const coordinator = createP905aAcceptanceCoordinator({
      ...generated,
      fixture: structuredClone(generated.fixture),
      proposal: structuredClone(generated.proposal),
    });
    const accepted = coordinator.accept();

    expect(accepted.state).toBe("accepted");
    expect(generated.proposal.operations).toHaveLength(4);
    expect(
      generated.proposal.operations.filter(
        (operation) => operation.operation.type === "APPLY_REGISTERED_PAGE_SECTIONS",
      ),
    ).toHaveLength(3);
    expect(coordinator.undo()).toEqual(generated.fixture.draft);
    expect(coordinator.redo()).toEqual(accepted.activeDraft);
    expect(canonicalValueString(generated.fixture.aggregate.catalogue)).toBe(
      canonicalValueString(commerceBefore),
    );
  });
});
