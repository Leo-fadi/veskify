// @vitest-environment node

import { describe, expect, it } from "vitest";
import {
  createWholeStorefrontGenerationPlan,
  createWholeStorefrontRecipeContext,
} from "@/application/whole-storefront-generation-plan";
import { compileWholeStorefrontProposal } from "@/application/whole-storefront-proposal-lifecycle";
import {
  storefrontDesignSystemV1,
  storefrontDesignSystemV1Schema,
} from "@/application/storefront-design-system";
import {
  createP905aFreshMerchantFixture,
  type P905aDirectionId,
} from "@/data/demo/p9-05a-fresh-store-generation";
import { canonicalValueFingerprint } from "@/domain/storefront";

const directionIds: readonly P905aDirectionId[] = [
  "premiumEditorial",
  "modernTechnical",
  "warmApproachable",
];

function planningInput() {
  return structuredClone(createP905aFreshMerchantFixture("premiumEditorial").planningInput);
}

function refreshRecipeContext(input: ReturnType<typeof planningInput>) {
  const designSystem = input.recipeContext.designSystem;
  const designSystemMaterial = Object.fromEntries(
    Object.entries(designSystem).filter(([key]) => key !== "fingerprint"),
  );
  designSystem.fingerprint = `storefront-design-system-${canonicalValueFingerprint(
    designSystemMaterial,
  )}`;
  input.recipeContext.fingerprint = `storefront-recipes-${canonicalValueFingerprint({
    templates: [...input.recipeContext.templates].sort((left, right) =>
      left.id.localeCompare(right.id),
    ),
    designSystem,
  })}`;
}

function compiledDirection(directionId: P905aDirectionId) {
  const input = planningInput();
  const plan = createWholeStorefrontGenerationPlan(input, { directionId });
  return { plan, proposal: compileWholeStorefrontProposal({ plan, planningInput: input }) };
}

const compiledDirections = new Map(
  directionIds.map((directionId) => [directionId, compiledDirection(directionId)]),
);

function requiredCompiledDirection(directionId: P905aDirectionId) {
  const result = compiledDirections.get(directionId);
  if (!result) throw new Error(`Missing compiled ${directionId} direction.`);
  return result;
}

function component(
  proposal: ReturnType<typeof compiledDirection>["proposal"],
  pageType: "home" | "collection" | "product",
  componentType: string,
) {
  const page = proposal.proposedStorefront.pages.find((candidate) => candidate.type === pageType);
  const result = page?.components.find((candidate) => candidate.component === componentType);
  if (!result) throw new Error(`Missing ${componentType} on ${pageType}.`);
  return result;
}

describe("P9-03F coordinated storefront design directions", () => {
  it("publishes three versioned, recipe-backed directions with registered component selections", () => {
    expect(storefrontDesignSystemV1.directions.map((direction) => direction.id)).toEqual(
      directionIds,
    );
    storefrontDesignSystemV1.directions.forEach((direction) => {
      expect(direction.version).toBe("1.0.0");
      expect(direction.componentSelections).toMatchObject({
        header: { component: "header" },
        hero: { component: "hero" },
        collectionDiscovery: { component: "featuredCategories" },
        productCard: { component: "productGrid" },
        storytelling: { component: "brandStory" },
        campaign: { component: "campaignBanner" },
        trust: { component: "benefitIcons" },
        footer: { component: "footer" },
        collectionCommerce: { component: "dynamicCollectionCommerce" },
        productDetail: { component: "dynamicProductDetail" },
      });
    });
  });

  it("rejects an unknown direction, unknown recipe/component and an incompatible coordinated selection", () => {
    expect(() =>
      createWholeStorefrontGenerationPlan(planningInput(), {
        directionId: "unknownDirection" as P905aDirectionId,
      }),
    ).toThrow(/design direction is unavailable/i);

    const unknownRecipe = planningInput();
    (
      unknownRecipe.recipeContext.designSystem.directions[0] as { homepageRecipeId: string }
    ).homepageRecipeId = "unknownHomepageRecipe";
    refreshRecipeContext(unknownRecipe);
    expect(() => createWholeStorefrontGenerationPlan(unknownRecipe)).toThrow(
      /unknown design-system reference/i,
    );

    const unknownComponent = planningInput();
    (
      unknownComponent.recipeContext.designSystem.directions[0].componentSelections.hero as {
        component: string;
      }
    ).component = "unknownHero";
    refreshRecipeContext(unknownComponent);
    expect(() => createWholeStorefrontGenerationPlan(unknownComponent)).toThrow();

    const incompatibleSelection = planningInput();
    (
      incompatibleSelection.recipeContext.designSystem.directions[0].componentSelections.hero as {
        variant: string;
      }
    ).variant = "editorial";
    refreshRecipeContext(incompatibleSelection);
    expect(() =>
      storefrontDesignSystemV1Schema.parse(incompatibleSelection.recipeContext.designSystem),
    ).toThrow(/coordinated component selection/i);
  });

  it("preserves each coordinated direction through canonical planning and proposal compilation", () => {
    directionIds.forEach((directionId) => {
      const { plan, proposal } = requiredCompiledDirection(directionId);
      expect(plan.designSystemSelection).toMatchObject({
        directionVersion: "1.0.0",
        directionId,
        componentSelections: storefrontDesignSystemV1.directions.find(
          (direction) => direction.id === directionId,
        )!.componentSelections,
      });
      expect(component(proposal, "home", "hero").variant).toBe(
        plan.designSystemSelection.componentSelections.hero.variant,
      );
      expect(component(proposal, "collection", "dynamicCollectionCommerce").variant).toBe(
        plan.designSystemSelection.componentSelections.collectionCommerce.variant,
      );
      expect(component(proposal, "product", "dynamicProductDetail").variant).toBe(
        plan.designSystemSelection.componentSelections.productDetail.variant,
      );
    });
  });

  it("produces exact structural differences beyond colours and typography", () => {
    const signatures = directionIds.map((directionId) => {
      const { plan, proposal } = requiredCompiledDirection(directionId);
      return {
        directionId,
        homepage: proposal.proposedStorefront.pages
          .find((page) => page.type === "home")!
          .components.map((item) => `${item.component}:${item.variant}`),
        collection: component(proposal, "collection", "dynamicCollectionCommerce"),
        product: component(proposal, "product", "dynamicProductDetail"),
        typographyDirectionId: plan.designSystemSelection.typographyDirectionId,
        spacingDensity: plan.designSystemSelection.spacingDensity,
        cornerTreatment: plan.designSystemSelection.cornerTreatment,
        surfaceDepth: plan.designSystemSelection.surfaceDepth,
        imageTreatmentId: plan.designSystemSelection.imageTreatmentId,
        productCardFamilyId: plan.designSystemSelection.productCardFamilyId,
      };
    });
    for (let left = 0; left < signatures.length; left += 1) {
      for (let right = left + 1; right < signatures.length; right += 1) {
        const first = signatures[left];
        const second = signatures[right];
        expect(first.homepage).not.toEqual(second.homepage);
        expect(first.collection).not.toEqual(second.collection);
        expect(first.product).not.toEqual(second.product);
        expect(
          [
            first.spacingDensity !== second.spacingDensity,
            first.cornerTreatment !== second.cornerTreatment,
            first.surfaceDepth !== second.surfaceDepth,
            first.imageTreatmentId !== second.imageTreatmentId,
            first.productCardFamilyId !== second.productCardFamilyId,
          ].filter(Boolean).length,
        ).toBeGreaterThanOrEqual(2);
      }
    }
  });

  it("keeps the recipe context deterministic and does not create a second direction registry", () => {
    expect(createWholeStorefrontRecipeContext().designSystem).toEqual(storefrontDesignSystemV1);
  });
});
