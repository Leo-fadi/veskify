// @vitest-environment node

import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  aiStorefrontProviderResponseSchema,
  buildAiStorefrontProviderRequestForSupportedCapability,
  type AiStorefrontCapabilitySelectionInput,
  type AiStorefrontProviderRequest,
} from "@/application/ai-storefront-generation";
import { StorefrontProposalAcceptanceCoordinator } from "@/application/ai-storefront";
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
import { canonicalValueFingerprint } from "@/domain/storefront";

type Seed = typeof aurumNordicSeed | typeof karvonenSeed;

async function planningInput(
  seed: Seed = aurumNordicSeed,
  direction?: {
    visualStyleDirection: "minimal" | "editorial" | "natural";
    typographyDirection: "sans-led" | "serif-led" | "soft";
    imageryDirection: "studio" | "editorial" | "product-focused" | "lifestyle";
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

function requestFor(
  seed: Seed,
  merchantInstruction = "Apply a warm premium style across the storefront.",
): AiStorefrontProviderRequest {
  const snapshot = seed.draftSnapshot;
  const command = {
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
    merchantInstruction,
    activeLocale: seed.project.primaryLocale,
    enabledLocales: seed.project.enabledLocales,
    requestedScope: "storefront",
    providerId: "server-whole-storefront-planning",
    provider: {
      id: "server-whole-storefront-planning",
      assetReferenceCapability: "structuredApprovedAssets",
      generationCapabilities: [
        "approvedColorTypographyDirection",
        "registeredWholeStorefrontDirection",
      ] as const,
      proposeStorefront: () => Promise.reject(new Error("Server-only provider boundary")),
    },
    importedContent: [],
  } satisfies AiStorefrontCapabilitySelectionInput;
  return buildAiStorefrontProviderRequestForSupportedCapability(command, 1).request;
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
      const headerIndex = recipe.sections.findIndex((section) => section.component === "header");
      expect(headerIndex).toBeGreaterThanOrEqual(0);
      expect(
        recipe.sections
          .slice(0, headerIndex)
          .every((section) => section.component === "announcementBar"),
      ).toBe(true);
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

  it("compiles every registered direction into its responsive collection, card and PDP families", async () => {
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
    const warm = createWholeStorefrontGenerationPlan(
      await planningInput(aurumNordicSeed, {
        visualStyleDirection: "natural",
        typographyDirection: "soft",
        imageryDirection: "lifestyle",
        toneKeywords: ["warm"],
      }),
    );
    expect(premium.designSystemSelection).not.toEqual(technical.designSystemSelection);
    expect(premium.designSystemSelection.productCardFamilyId).toBe("premiumJewellery");
    expect(technical.designSystemSelection.productCardFamilyId).toBe("compactCommerce");
    expect(warm.designSystemSelection).toMatchObject({
      directionId: "warmApproachable",
      productCardFamilyId: "minimalProduct",
      collectionPresentation: { variant: "editorial" },
      productPresentation: { variant: "balanced" },
    });
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
    expect(generated(warm, "dynamicCollectionCommerce")).toMatchObject({
      instance: { variant: "editorial", props: { cardVariant: "standard" } },
    });
    expect(technical.canonicalCommerceBindings).toEqual(premium.canonicalCommerceBindings);
    expect(warm.canonicalCommerceBindings).toEqual(premium.canonicalCommerceBindings);
  });

  it("materializes a missing required recipe section only from approved content and assets", async () => {
    const missingAsset = await planningInput(aurumNordicSeed, {
      visualStyleDirection: "natural",
      typographyDirection: "soft",
      imageryDirection: "lifestyle",
      toneKeywords: ["warm"],
    });
    const home = missingAsset.draft.pages.find((page) => page.type === "home")!;
    home.sections = home.sections.filter((section) => section.component !== "brandStory");
    expect(() => createWholeStorefrontGenerationPlan(missingAsset)).toThrow(
      /approve an editorial image/i,
    );

    const valid = structuredClone(missingAsset);
    const warmRecipe = valid.recipeContext.designSystem.homepageRecipes.find(
      (recipe) => recipe.id === "homeWarmStory",
    )!;
    const story = warmRecipe.sections.find((section) => section.component === "brandStory")!;
    story.acceptedAssetRoles = ["logo"];
    const designSystemMaterial: Partial<typeof valid.recipeContext.designSystem> = structuredClone(
      valid.recipeContext.designSystem,
    );
    delete designSystemMaterial.fingerprint;
    valid.recipeContext.designSystem.fingerprint = `storefront-design-system-${canonicalValueFingerprint(designSystemMaterial)}`;
    valid.recipeContext.fingerprint = `storefront-recipes-${canonicalValueFingerprint({
      templates: [...valid.recipeContext.templates].sort((left, right) =>
        left.id.localeCompare(right.id),
      ),
      designSystem: valid.recipeContext.designSystem,
    })}`;
    const plan = createWholeStorefrontGenerationPlan(valid);
    const generatedStory = plan.pagePlans
      .find((page) => page.role === "homepage")!
      .components.find(
        (component) => "instance" in component && component.instance.component === "brandStory",
      );
    expect(generatedStory).toMatchObject({
      disposition: "added",
      instance: {
        variant: "editorial",
        content: {
          heading: { en: aurumNordicSeed.project.name, fi: aurumNordicSeed.project.name },
          facts: [],
        },
      },
    });
  });

  it("returns an atomic registered composition with dynamic commerce through the runtime authority", async () => {
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
    const body = (await response.json()) as { proposal: unknown };
    expect(response.status, JSON.stringify(body)).toBe(200);
    const envelope = aiStorefrontProviderResponseSchema.parse(body.proposal);
    expect(
      envelope.proposal.operations.some(
        ({ operation }) => operation.type === "APPLY_REGISTERED_PAGE_SECTIONS",
      ),
    ).toBe(true);
    const proposedSections = envelope.proposal.proposedStorefront.pages.flatMap(
      (page) => page.sections,
    );
    expect(proposedSections).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ component: "hero", variant: "fullBleed" }),
      ]),
    );
    const dynamicCollection = proposedSections.find(
      (section) => section.component === "dynamicCollectionCommerce",
    )!;
    const dynamicProduct = proposedSections.find(
      (section) => section.component === "dynamicProductDetail",
    )!;
    expect(typeof dynamicCollection.content.collectionId).toBe("string");
    expect(Array.isArray(dynamicCollection.content.productIds)).toBe(true);
    expect(typeof dynamicCollection.content.canonicalRevision).toBe("string");
    expect(typeof dynamicProduct.content.productId).toBe("string");
    expect(typeof dynamicProduct.content.canonicalRevision).toBe("string");
    const dynamicContent = proposedSections
      .filter((section) =>
        ["dynamicCollectionCommerce", "dynamicProductDetail"].includes(section.component),
      )
      .map((section) => section.content);
    expect(JSON.stringify(dynamicContent)).not.toMatch(
      /"(?:price|sku|availability|stock|variants|media)":/i,
    );
    const coordinator = new StorefrontProposalAcceptanceCoordinator({
      proposal: envelope.proposal,
      activeDraft: structuredClone(karvonenSeed.draftSnapshot),
      storedDraft: structuredClone(karvonenSeed.draftSnapshot),
      publishedSnapshot: structuredClone(karvonenSeed.publishedSnapshot),
      catalogue: structuredClone(karvonenSeed.catalogue),
      enabledLocales: karvonenSeed.project.enabledLocales,
      activeLocale: karvonenSeed.project.primaryLocale,
      primaryLocale: karvonenSeed.project.primaryLocale,
    });
    const accepted = coordinator.accept();
    expect(accepted.state).toBe("accepted");
    expect(coordinator.undo()).toEqual(karvonenSeed.draftSnapshot);
    expect(coordinator.redo()).toEqual(accepted.activeDraft);
  });

  it("rejects an incompatible request direction and accepts the matching brief direction", async () => {
    const instruction = "Use a minimal Nordic colour and typography direction throughout the site.";
    const incompatibleHandler = createWholeStorefrontPlanningRouteHandler({
      authority: createStandaloneServerWholeStorefrontPlanningAuthority(),
      selectProvider: createDeterministicWholeStorefrontPlanningProvider,
    });
    const incompatible = await incompatibleHandler(
      new Request("http://localhost/api/ai/whole-storefront-proposals", {
        method: "POST",
        body: JSON.stringify(requestFor(aurumNordicSeed, instruction)),
      }),
    );
    const baseSource = createStandaloneAuthoritativeWholeStorefrontPlanningContextSource();
    const compatibleHandler = createWholeStorefrontPlanningRouteHandler({
      authority: createStandaloneServerWholeStorefrontPlanningAuthority({
        contextSource: {
          async load(input) {
            const context = structuredClone(await baseSource.load(input));
            Object.assign(context.brief.approvedBrandDirection!, {
              visualStyleDirection: "minimal",
              typographyDirection: "sans-led",
              imageryDirection: "product-focused",
              toneKeywords: ["minimal", "technical"],
            });
            return context;
          },
        },
      }),
      selectProvider: createDeterministicWholeStorefrontPlanningProvider,
    });
    const compatible = await compatibleHandler(
      new Request("http://localhost/api/ai/whole-storefront-proposals", {
        method: "POST",
        body: JSON.stringify(requestFor(aurumNordicSeed, instruction)),
      }),
    );
    const compatibleBody = (await compatible.json()) as { proposal: unknown };
    const compatibleEnvelope = aiStorefrontProviderResponseSchema.parse(compatibleBody.proposal);
    expect(incompatible.status).toBe(400);
    expect(compatible.status).toBe(200);
    expect(compatibleEnvelope.proposal.proposedStorefront.brandSystem.typography.headingFont).toBe(
      "inter",
    );
    expect(compatibleEnvelope.proposal.proposedStorefront.brandSystem.typography.bodyFont).toBe(
      "system-sans",
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
      definition.variants.forEach((variant) => {
        expect(variant.title.en).toBeTruthy();
        expect(variant.title.fi).toBeTruthy();
        if (/[A-Z]/u.test(variant.id)) {
          expect(variant.title.en).not.toBe(variant.id);
          expect(variant.title.fi).not.toBe(variant.id);
        }
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
