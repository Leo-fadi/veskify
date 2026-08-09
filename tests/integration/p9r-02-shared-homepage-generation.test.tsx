import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import {
  createWholeStorefrontRecipeContext,
  createWholeStorefrontGenerationPlan,
  type WholeStorefrontGenerationPlan,
  type WholeStorefrontPlanningInput,
} from "@/application/whole-storefront-generation-plan";
import { compileWholeStorefrontProposal } from "@/application/whole-storefront-proposal-lifecycle";
import {
  storefrontStyleDesignSystems,
  storefrontStyleDirectionForRegisteredDirection,
} from "@/application/design-skills";
import {
  registeredBrandSystemForDirection,
  storefrontDesignSystemV1,
} from "@/application/storefront-design-system";
import { createStorefrontRenderContext, getComponentDefinition } from "@/components/registry";
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
    heroHeading: section("homepageHero")?.content.heading ?? section("hero")?.content.title,
    collectionHeading:
      section("homepageFeaturedCollections")?.content.heading ??
      section("homepageCollectionNavigation")?.content.heading ??
      section("featuredCategories")?.content.heading,
    productHeading:
      section("homepageFeaturedProducts")?.content.heading ??
      section("productGrid")?.content.heading,
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
      ...(["plain", "soft", "contrast"].includes(String(component.styleOverrides.surface))
        ? {}
        : { styleOverrides: component.styleOverrides }),
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
  const approvedAssetContextBefore = structuredClone(planningInput.approvedAssetContext);
  const plan = createWholeStorefrontGenerationPlan(planningInput, { directionId });
  const proposal = compileWholeStorefrontProposal({ plan, planningInput });
  const page = proposal.proposedStorefront.pages.find((candidate) => candidate.role === "homepage");
  if (!page) throw new Error("Missing compiled homepage.");
  return { approvedAssetContextBefore, plan, page, planningInput, proposal };
}

function selectedHomepageVariants(plan: WholeStorefrontGenerationPlan) {
  const materialization = plan.pageBlueprintMaterializations.find(
    (entry) => entry.pageType === "home",
  );
  if (!materialization) throw new Error("The plan has no homepage PageBlueprint materialization.");
  return materialization.slots;
}

const compilerOwnedPresentationPropKeys = ["background", "density", "shape", "typography"] as const;

function expectedCompilerOwnedPresentationProps(
  component: { component: string },
  index: number,
  plan: WholeStorefrontGenerationPlan,
) {
  const definition = getComponentDefinition(component.component);
  const style =
    storefrontStyleDesignSystems[
      storefrontStyleDirectionForRegisteredDirection(plan.designSystemSelection.directionId)
    ];
  return {
    ...(definition.editorFields.background
      ? { background: index % 2 === 0 ? "background" : "surface" }
      : {}),
    ...(definition.editorFields.density
      ? { density: plan.designSystemSelection.spacingDensity }
      : {}),
    ...(definition.editorFields.shape ? { shape: plan.designSystemSelection.cornerTreatment } : {}),
    ...(definition.editorFields.typography ? { typography: style.sectionTypography } : {}),
  };
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
    for (const directionId of directions) {
      const generated = scenarios[directionId];
      const accepted = createP905aAcceptanceCoordinator(generated).accept();
      if (accepted.state !== "accepted") throw new Error("The generated proposal did not accept.");

      const compiledHome = generated.compiledProposal.proposedStorefront.pages.find(
        (page) => page.role === "homepage",
      );
      const expectedOrder = selectedHomepageVariants(generated.plan)
        .filter((selection) =>
          compiledHome?.components.some((component) => component.component === selection.component),
        )
        .map((selection) => selection.component);
      expect(generated.plan.designSystemSelection.directionId).toBe(directionId);
      expect(compiledHome?.components.map((component) => component.component)).toEqual(
        expectedOrder,
      );
      expect(componentOrder(generated.proposal.proposedStorefront)).toEqual(expectedOrder);
      expect(componentOrder(accepted.activeDraft)).toEqual(expectedOrder);
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
    expect(componentOrder(saved.preview)).toEqual(
      selectedHomepageVariants(modern.plan)
        .filter((selection) => componentOrder(saved.preview).includes(selection.component))
        .map((selection) => selection.component),
    );

    const premiumRender = renderHomepage(
      createP905aAcceptanceCoordinator(premium).accept().activeDraft,
      premium.fixture.aggregate.catalogue,
    );
    expect(
      premiumRender.container.querySelector(".store-header.store-variant--transparent nav"),
    ).toBeTruthy();
    expect(premiumRender.container.querySelector('[data-component="homepageHero"]')).toBeTruthy();
    expect(
      premiumRender.container.querySelector(".store-footer.store-variant--editorial"),
    ).toBeTruthy();

    const modernRender = renderHomepage(saved.preview, modern.fixture.aggregate.catalogue);
    expect(
      modernRender.container.querySelector(".store-header.store-variant--compact nav"),
    ).toBeTruthy();
    expect(modernRender.container.querySelector('[data-component="homepageHero"]')).toBeTruthy();
    expect(
      modernRender.container.querySelector('[data-component="homepageFeaturedProducts"]'),
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

    for (const generated of [premium, modern]) {
      const originalRuntime = generated.proposal.originalStorefront.pages.find(
        (page) => page.role === "homepage",
      );
      if (!originalRuntime) throw new Error("Missing original runtime homepage.");
      expect(generated.planningInput.approvedAssetContext).toEqual(
        generated.approvedAssetContextBefore,
      );
      expect(generated.proposal.preconditions.assetContextFingerprint).toBe(
        generated.planningInput.approvedAssetContext?.fingerprint ?? null,
      );
      expect(generated.proposal.proposedStorefront.approvedAssetContextFingerprint).toBe(
        generated.proposal.originalStorefront.approvedAssetContextFingerprint,
      );
      expect(generated.proposal.proposedStorefront.approvedAssetPlacements).toEqual(
        generated.plan.approvedAssetPlacements,
      );
      expect(generated.proposal.proposedStorefront.brandSystem).toEqual(
        registeredBrandSystemForDirection(
          generated.proposal.originalStorefront.brandSystem,
          storefrontDesignSystemV1,
          generated.plan.designSystemSelection.directionId,
        ),
      );
      const variants = new Map(
        generated.page.components.map((component) => [component.component, component.variant]),
      );
      selectedHomepageVariants(generated.plan)
        .filter((selection) => variants.has(selection.component))
        .forEach((selection) => {
          expect(variants.get(selection.component)).toBe(selection.variant);
        });
      generated.page.components.forEach((component, index) => {
        const source = originalRuntime.components.find((section) => section.id === component.id);
        if (!source) return;
        if (source.component !== component.component) {
          expect([
            "homepageHero",
            "homepageFeaturedCollections",
            "homepageFeaturedProducts",
            "homepageCollectionNavigation",
            "homepagePromotion",
            "homepageEditorial",
            "homepageProof",
            "homepageTrust",
          ]).toContain(component.component);
          expect(component.bindings).toEqual(
            expect.arrayContaining([expect.objectContaining({ source: "projectBrandContext" })]),
          );
          if (component.component === "homepageHero") {
            expect(component.content.heading).toEqual(source.content.title);
            expect(component.content.supportingCopy).toEqual(source.content.body);
          }
          if (
            component.component === "homepageFeaturedCollections" ||
            component.component === "homepageCollectionNavigation"
          ) {
            expect(component.content.heading).toEqual(source.content.heading);
            expect(component.bindings).toContainEqual(
              expect.objectContaining({
                source: "collectionList",
                collectionIds: source.content.collectionIds,
              }),
            );
          }
          if (component.component === "homepageFeaturedProducts") {
            expect(component.content.heading).toEqual(source.content.heading);
            expect(component.bindings).toContainEqual(
              expect.objectContaining({
                source: "productList",
                productIds: source.content.productIds,
              }),
            );
          }
          component.assetAssignments.forEach((assignment) => {
            expect(
              generated.planningInput.approvedAssetContext?.assets.some(
                (asset) => asset.assetId === assignment.assetId && asset.role === assignment.role,
              ),
            ).toBe(true);
          });
          expect(component.styleOverrides).toEqual({ surface: "plain" });
          return;
        }
        const expectedPresentation = expectedCompilerOwnedPresentationProps(
          component,
          index,
          generated.plan,
        );
        const expectedAssetAssignments = [
          ...source.assetAssignments,
          ...generated.plan.approvedAssetPlacements
            .filter(
              (placement) =>
                placement.pageId === generated.page.pageId &&
                placement.componentId === component.id,
            )
            .map((placement) => ({
              slotId: placement.assetSlotId,
              assetId: placement.assetId,
              role: placement.role,
            })),
        ];

        expect(component.content).toEqual(source.content);
        expect(component.bindings).toEqual(source.bindings);
        expect(component.assetAssignments).toEqual(expectedAssetAssignments);
        expect(component.styleOverrides).toEqual(source.styleOverrides);
        Object.entries(source.props).forEach(([key, value]) => {
          expect(component.props[key]).toEqual(value);
        });
        expect(
          Object.fromEntries(
            compilerOwnedPresentationPropKeys.flatMap((key) =>
              key in component.props ? [[key, component.props[key]]] : [],
            ),
          ),
        ).toEqual(expectedPresentation);
        expect(Object.keys(component.props).sort()).toEqual(
          [...new Set([...Object.keys(source.props), ...Object.keys(expectedPresentation)])].sort(),
        );
        expect(component.props).toEqual({ ...source.props, ...expectedPresentation });
      });
    }

    const premiumRender = renderPage(
      runtimeHomepage(aurumNordicSeed.draftSnapshot, premium.page.components),
      aurumNordicSeed.draftSnapshot,
      aurumNordicSeed.catalogue,
    );
    expect(
      premiumRender.container.querySelector('[data-component="homepagePromotion"]'),
    ).toBeTruthy();
    expect(
      premiumRender.container.querySelector(".campaign-banner.store-variant--imageOverlay"),
    ).toBeNull();
    expect(premiumRender.container.querySelector('[data-component="homepageTrust"]')).toBeTruthy();

    const modernRender = renderPage(
      runtimeHomepage(aurumNordicSeed.draftSnapshot, modern.page.components),
      aurumNordicSeed.draftSnapshot,
      aurumNordicSeed.catalogue,
    );
    expect(
      modernRender.container.querySelector(
        '[data-component="homepageEditorial"][data-variant="continuationCta"]',
      ),
    ).toBeTruthy();
    expect(
      modernRender.container.querySelector(".campaign-banner.store-variant--minimal"),
    ).toBeNull();
    expect(modernRender.container.querySelector('[data-component="homepageTrust"]')).toBeTruthy();
  });
});
