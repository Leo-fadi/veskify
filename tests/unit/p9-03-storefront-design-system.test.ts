// @vitest-environment node

import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  buildAiStorefrontProviderRequest,
  type AiStorefrontGenerationCommand,
} from "@/application/ai-storefront-generation";
import {
  createDeterministicWholeStorefrontPlanningProvider,
  createWholeStorefrontGenerationPlan,
  createWholeStorefrontRecipeContext,
} from "@/application/whole-storefront-generation-plan";
import {
  selectStorefrontDesignDirection,
  storefrontDesignSystemV1,
} from "@/application/storefront-design-system";
import { veskifyComponentDefinitionsV2 } from "@/components/registry/v2-registry";
import { aurumNordicSeed, karvonenSeed } from "@/data/seed";
import { brandSystemToCssVariables } from "@/domain/design-system";
import {
  createStandaloneAuthoritativeWholeStorefrontPlanningContextSource,
  createStandaloneServerWholeStorefrontPlanningAuthority,
} from "@/integrations/ai/whole-storefront-runtime-authority";
import { createWholeStorefrontPlanningRouteHandler } from "@/app/api/ai/whole-storefront-proposals/route";

type Seed = typeof aurumNordicSeed | typeof karvonenSeed;

async function planningInput(
  seed: Seed = aurumNordicSeed,
  direction?: {
    visualStyleDirection: "minimal" | "editorial" | "natural";
    typographyDirection: "sans-led" | "serif-led" | "soft";
    imageryDirection: "studio" | "editorial" | "product-focused";
    toneKeywords: ("elegant" | "modern" | "warm" | "minimal" | "technical")[];
  },
) {
  const source = createStandaloneAuthoritativeWholeStorefrontPlanningContextSource();
  const context = structuredClone(
    await source.load({
      projectId: seed.project.id,
      catalogueId: seed.catalogue.id,
      enabledLocales: seed.project.enabledLocales,
      requestedLocale: seed.project.primaryLocale,
    }),
  );
  if (direction && context.brief.approvedBrandDirection) {
    Object.assign(context.brief.approvedBrandDirection, direction);
  }
  return {
    brief: context.brief,
    project: {
      id: seed.project.id,
      revision: seed.project.revision,
      enabledLocales: seed.project.enabledLocales,
    },
    draft: structuredClone(seed.draftSnapshot),
    catalogue: structuredClone(seed.catalogue),
    componentDefinitions: context.componentDefinitions,
    recipeContext: createWholeStorefrontRecipeContext(),
    approvedAssetContext: context.approvedAssetContext,
    requiredAssetPlacements: [],
  };
}

function requestFor(seed: Seed): ReturnType<typeof buildAiStorefrontProviderRequest> {
  const snapshot = seed.draftSnapshot;
  const command: AiStorefrontGenerationCommand = {
    projectId: seed.project.id,
    draftSnapshotId: snapshot.id,
    draftRevision: snapshot.revision,
    storefront: {
      pageOrder: snapshot.pages.map((page) => page.id),
      pages: structuredClone(snapshot.pages),
      navigation: structuredClone(snapshot.navigation),
      brandSystem: structuredClone(snapshot.brandSystem),
    },
    affectedPageIds: snapshot.pages.map((page) => page.id),
    affectedSectionTargets: [],
    designSystemTarget: { kind: "storefrontDesignSystem", projectId: seed.project.id },
    merchantInstruction: "Apply a warm premium style across the storefront.",
    activeLocale: seed.project.primaryLocale,
    enabledLocales: seed.project.enabledLocales,
    requestedScope: "storefront",
    capability: "approvedColorTypographyDirection",
    providerId: "server-whole-storefront-planning",
    provider: {
      id: "server-whole-storefront-planning",
      assetReferenceCapability: "structuredApprovedAssets",
      proposeStorefront: () => Promise.reject(new Error("Server-only provider boundary")),
    },
    importedContent: [],
  };
  return buildAiStorefrontProviderRequest(command, 1);
}

describe("P9-03 Storefront Design System v1", () => {
  it("publishes stable unique family, recipe, typography and image-treatment IDs", () => {
    const groups = [
      storefrontDesignSystemV1.typographyDirections,
      storefrontDesignSystemV1.imageTreatments,
      storefrontDesignSystemV1.productCardFamilies,
      storefrontDesignSystemV1.homepageRecipes,
      storefrontDesignSystemV1.collectionRecipes,
      storefrontDesignSystemV1.productRecipes,
      storefrontDesignSystemV1.directions,
    ];
    groups.forEach((group) => {
      const ids = group.map((item) => item.id);
      expect(new Set(ids).size).toBe(ids.length);
    });
    expect(storefrontDesignSystemV1.homepageRecipes).toHaveLength(3);
    expect(storefrontDesignSystemV1.productCardFamilies.length).toBeGreaterThanOrEqual(3);
    expect(storefrontDesignSystemV1.fingerprint).toMatch(/^storefront-design-system-/);
  });

  it("keeps semantic recipe order and references only compatible registered variants", () => {
    const definitions = new Map(
      veskifyComponentDefinitionsV2.map((definition) => [definition.type, definition]),
    );
    const recipes = [
      ...storefrontDesignSystemV1.homepageRecipes,
      ...storefrontDesignSystemV1.collectionRecipes,
      ...storefrontDesignSystemV1.productRecipes,
    ];
    recipes.forEach((recipe) => {
      expect(recipe.sections[0]?.component).toBe("header");
      expect(recipe.sections.at(-1)?.component).toBe("footer");
      recipe.sections.forEach((section) => {
        const definition = definitions.get(section.component);
        expect(definition?.supportedPageTypes).toContain(recipe.pageType);
        expect(definition?.variants.map((variant) => variant.id)).toContain(section.variant);
      });
    });
  });

  it("selects materially different registered directions from authoritative brief signals", () => {
    expect(
      selectStorefrontDesignDirection({
        visualStyleDirection: "luxury",
        typographyDirection: "serif-led",
        imageryDirection: "editorial",
        toneKeywords: ["elegant"],
      }),
    ).toBe("premiumEditorial");
    expect(
      selectStorefrontDesignDirection({
        visualStyleDirection: "minimal",
        typographyDirection: "sans-led",
        imageryDirection: "product-focused",
        toneKeywords: ["technical"],
      }),
    ).toBe("modernTechnical");
    expect(
      selectStorefrontDesignDirection({
        visualStyleDirection: "natural",
        typographyDirection: "soft",
        imageryDirection: "lifestyle",
        toneKeywords: ["warm"],
      }),
    ).toBe("warmApproachable");
  });

  it("compiles different brief directions into different collection, card and PDP families", async () => {
    const premium = createWholeStorefrontGenerationPlan(
      await planningInput(aurumNordicSeed, {
        visualStyleDirection: "editorial",
        typographyDirection: "serif-led",
        imageryDirection: "editorial",
        toneKeywords: ["elegant"],
      }),
    );
    const technical = createWholeStorefrontGenerationPlan(
      await planningInput(aurumNordicSeed, {
        visualStyleDirection: "minimal",
        typographyDirection: "sans-led",
        imageryDirection: "product-focused",
        toneKeywords: ["technical"],
      }),
    );
    expect(premium.designSystemSelection).not.toEqual(technical.designSystemSelection);
    expect(premium.designSystemSelection.productCardFamilyId).toBe("premiumJewellery");
    expect(technical.designSystemSelection.productCardFamilyId).toBe("compactCommerce");
    const generated = (plan: typeof premium, component: string) =>
      plan.pagePlans
        .flatMap((page) => page.components)
        .find((entry) => "instance" in entry && entry.instance.component === component);
    expect(generated(premium, "dynamicCollectionCommerce")).toMatchObject({
      instance: { variant: "editorial", props: { cardVariant: "imageFirst" } },
    });
    expect(generated(technical, "dynamicProductDetail")).toMatchObject({
      instance: { variant: "compact", props: { optionDensity: "compact" } },
    });
    expect(technical.canonicalCommerceBindings).toEqual(premium.canonicalCommerceBindings);
  });

  it("returns plan-derived structural proposal operations through the runtime authority", async () => {
    const handler = createWholeStorefrontPlanningRouteHandler({
      authority: createStandaloneServerWholeStorefrontPlanningAuthority(),
      selectProvider: createDeterministicWholeStorefrontPlanningProvider,
    });
    const response = await handler(
      new Request("http://localhost/api/ai/whole-storefront-proposals", {
        method: "POST",
        body: JSON.stringify(requestFor(karvonenSeed)),
      }),
    );
    const body = (await response.json()) as {
      proposal: {
        proposal: {
          operations: {
            operation: { type: string; variant?: string; sectionIds?: string[] };
          }[];
          proposedStorefront: { pages: { sections: { component: string; variant: string }[] }[] };
        };
      };
    };
    expect(response.status, JSON.stringify(body)).toBe(200);
    expect(
      body.proposal.proposal.operations.some(
        ({ operation }) =>
          operation.type === "CHANGE_SECTION_VARIANT" || operation.type === "REORDER_SECTIONS",
      ),
    ).toBe(true);
    expect(
      body.proposal.proposal.proposedStorefront.pages.flatMap((page) => page.sections),
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ component: "hero", variant: "fullBleed" }),
      ]),
    );
  });

  it("keeps product-card commerce fields and all commerce bindings protected", () => {
    storefrontDesignSystemV1.productCardFamilies.forEach((family) => {
      expect(family.requiredCommerceFields).toEqual([
        "productId",
        "title",
        "priceState",
        "availability",
        "canonicalMedia",
        "productRoute",
      ]);
    });
    const commerceDefinitions = veskifyComponentDefinitionsV2.filter(
      (definition) => definition.family === "commerce",
    );
    commerceDefinitions.forEach((definition) => {
      expect(definition.protectedFields.readOnlyPaths.join(" ")).toMatch(/productId|collectionId/);
      expect(
        definition.editablePresentationFields.some((field) =>
          /^(?:bindings|commerce)\./u.test(field.path),
        ),
      ).toBe(false);
    });
  });

  it("provides bilingual merchant labels and no-overflow responsive metadata", () => {
    veskifyComponentDefinitionsV2.forEach((definition) => {
      expect(definition.title.en).toBeTruthy();
      expect(definition.title.fi).toBeTruthy();
      expect(definition.responsiveRules.length).toBeGreaterThan(0);
      expect(definition.responsiveRules.every((rule) => !rule.allowHorizontalOverflow)).toBe(true);
      definition.editablePresentationFields.forEach((field) => {
        expect(field.label.en).toBeTruthy();
        expect(field.label.fi).toBeTruthy();
      });
    });
  });

  it("keeps semantic status roles deterministic and fixture planning isolated", async () => {
    const variables = brandSystemToCssVariables(aurumNordicSeed.draftSnapshot.brandSystem);
    expect(variables).toMatchObject({
      "--brand-color-success": "#237A45",
      "--brand-color-warning": "#9A5B13",
      "--brand-color-unavailable": aurumNordicSeed.draftSnapshot.brandSystem.colors.mutedText,
    });
    const aurum = createWholeStorefrontGenerationPlan(await planningInput(aurumNordicSeed));
    const karvonen = createWholeStorefrontGenerationPlan(await planningInput(karvonenSeed));
    expect(aurum.target.projectId).not.toBe(karvonen.target.projectId);
    expect(aurum.target.activeDraftFingerprint).not.toBe(karvonen.target.activeDraftFingerprint);
    expect(aurum.canonicalCommerceBindings).not.toEqual(karvonen.canonicalCommerceBindings);
  });
});
