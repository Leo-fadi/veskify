import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import { listExecutablePageBlueprintProfiles } from "@/application/storefront-templates";
import {
  createLiveRendererConformanceReport,
  veskifyComponentCapabilityManifest,
  veskifyComponentRegistry,
  createStorefrontRenderContext,
  renderRegisteredSection,
} from "@/components/registry";
import { aurumNordicSeed } from "@/data/seed";
import { approvedAssetPlacementOperationSchema as legacyApprovedAssetPlacementOperationSchema } from "@/application/ai-storefront-generation/approved-asset-context";
import {
  approvedAssetPlacementOperationSchema,
  canonicalValueFingerprint,
  pageModelSchema,
  sectionInstanceSchema,
} from "@/domain/storefront";
import { pageToPuckData, puckDataToPage } from "@/integrations/puck/config";

const closedCapabilities = [
  "homepageHero",
  "homepageFeaturedCollections",
  "homepageFeaturedProducts",
  "homepageCollectionNavigation",
  "homepagePromotion",
  "homepageTrust",
] as const;

const approvedHeroPlacement = {
  type: "PLACE_APPROVED_SOURCE_ASSET" as const,
  pageId: "page_transport_home",
  componentId: "section_transport_hero",
  componentType: "homepageHero",
  assetSlotId: "heroMedia",
  assetId: "asset_transport_hero",
  role: "heroDesktop" as const,
  assetRevision: "revision-1",
  materialFingerprint: "material-transport-hero",
  sourceReferenceId: "source_transport",
  required: true,
};

function homepageProductBridgeSection(overrides: Record<string, unknown> = {}) {
  const source = aurumNordicSeed.draftSnapshot.pages
    .find((page) => page.type === "home")!
    .sections.find((section) => section.component === "productGrid")!;
  const definition = veskifyComponentRegistry.homepageFeaturedProducts;
  return {
    id: source.id,
    component: "homepageFeaturedProducts",
    variant: definition.defaultVariant,
    visible: true,
    content: {
      ...structuredClone(definition.defaultContent),
      productIds: structuredClone(source.content.productIds),
    },
    props: structuredClone(definition.defaultProps),
    ...overrides,
  };
}

function bridgeContext(renderTarget: "preview" | "published") {
  return createStorefrontRenderContext({
    activeLocale: "en",
    primaryLocale: "en",
    catalogue: aurumNordicSeed.catalogue,
    snapshot: aurumNordicSeed.draftSnapshot,
    renderTarget,
  });
}

function renderedAssetIds(renderTarget: "preview" | "published") {
  const rendered = render(
    renderRegisteredSection(homepageProductBridgeSection(), bridgeContext(renderTarget), "home"),
  );
  const assetIds = Array.from(rendered.container.querySelectorAll("[data-asset-id]")).map((node) =>
    node.getAttribute("data-asset-id"),
  );
  rendered.unmount();
  return assetIds;
}

describe("P10A-04C commercial capability gap closure", () => {
  it("uses one relocated approved-placement schema authority with unchanged parsing", () => {
    expect(legacyApprovedAssetPlacementOperationSchema).toBe(approvedAssetPlacementOperationSchema);
    expect(legacyApprovedAssetPlacementOperationSchema.parse(approvedHeroPlacement)).toEqual(
      approvedAssetPlacementOperationSchema.parse(approvedHeroPlacement),
    );
  });

  it("normalizes legacy sections and rejects placements outside their page or component", () => {
    expect(
      sectionInstanceSchema.parse({
        id: "section_legacy",
        component: "hero",
        variant: "split",
        visible: true,
        content: {},
        props: {},
      }).approvedAssetPlacements,
    ).toEqual([]);
    expect(() =>
      pageModelSchema.parse({
        id: approvedHeroPlacement.pageId,
        type: "home",
        slug: "/",
        title: { en: "Transport", fi: "Siirto" },
        seo: { title: { en: "Transport", fi: "Siirto" }, metaDescription: { en: "x", fi: "x" } },
        sections: [
          {
            id: approvedHeroPlacement.componentId,
            component: approvedHeroPlacement.componentType,
            variant: "fullBleed",
            visible: true,
            content: homepageCommerceContent("homepageHero"),
            props: homepageCommerceProps("homepageHero"),
            approvedAssetPlacements: [{ ...approvedHeroPlacement, pageId: "page_other" }],
          },
        ],
      }),
    ).toThrow(/containing page/);
  });

  it("preserves the full placement record through Puck and includes it in canonical fingerprints", () => {
    const sourcePage = aurumNordicSeed.draftSnapshot.pages.find((page) => page.type === "home")!;
    const sourceHero = sourcePage.sections.find((section) => section.component === "hero")!;
    const placement = {
      ...approvedHeroPlacement,
      pageId: sourcePage.id,
      componentId: sourceHero.id,
      componentType: "hero",
    };
    const page = {
      ...structuredClone(sourcePage),
      sections: sourcePage.sections.map((section) =>
        section.id === sourceHero.id
          ? { ...structuredClone(section), approvedAssetPlacements: [placement] }
          : section,
      ),
    };
    const context = createStorefrontRenderContext({
      activeLocale: "en",
      primaryLocale: "en",
      catalogue: aurumNordicSeed.catalogue,
      snapshot: { ...aurumNordicSeed.draftSnapshot, pages: [page] },
    });
    const roundTripped = puckDataToPage(pageToPuckData(page, context), page, context);
    expect(
      roundTripped.sections.find((section) => section.id === sourceHero.id)
        ?.approvedAssetPlacements,
    ).toEqual([placement]);
    expect(canonicalValueFingerprint(page)).not.toBe(
      canonicalValueFingerprint({ ...page, sections: sourcePage.sections }),
    );
  });

  it("derives product media only from the persisted product subset in preview and published rendering", () => {
    const productIds = homepageProductBridgeSection().content.productIds;
    if (
      !Array.isArray(productIds) ||
      productIds.some((productId) => typeof productId !== "string")
    ) {
      throw new Error("The fixture homepage product list must contain canonical product IDs.");
    }
    const selectedProductIds = productIds;
    const expectedAssetIds = selectedProductIds.map((productId) => {
      const product = aurumNordicSeed.catalogue.products.find((item) => item.id === productId);
      const firstImage = product?.images[0];
      if (!firstImage) {
        throw new Error(
          "The fixture homepage product list must resolve to canonical product media.",
        );
      }
      return firstImage.id;
    });

    expect(renderedAssetIds("preview")).toEqual(expectedAssetIds);
    expect(renderedAssetIds("published")).toEqual(expectedAssetIds);
    expect(expectedAssetIds).not.toContain("asset_lumi_ring");
  });

  it("derives one linear homepage commerce projection without canonical product rescans", () => {
    const context = bridgeContext("preview");
    const products = context.catalogue.products as typeof context.catalogue.products & {
      find: typeof context.catalogue.products.find;
    };
    const canonicalIterator = products[Symbol.iterator].bind(products);
    let productIterations = 0;
    Object.defineProperty(products, Symbol.iterator, {
      configurable: true,
      value: () => {
        productIterations += 1;
        return canonicalIterator();
      },
    });
    Object.defineProperty(products, "find", {
      configurable: true,
      value: () => {
        throw new Error("Homepage projection must use its derived product index.");
      },
    });

    const rendered = render(
      renderRegisteredSection(homepageProductBridgeSection(), context, "home"),
    );

    expect(rendered.container.querySelectorAll("[data-asset-id]").length).toBeGreaterThan(0);
    expect(productIterations).toBe(1);
  });

  it("fails closed when an approved source placement targets commerce-owned product media", () => {
    const source = aurumNordicSeed.draftSnapshot.pages
      .find((page) => page.type === "home")!
      .sections.find((section) => section.component === "productGrid")!;
    expect(() =>
      renderRegisteredSection(
        homepageProductBridgeSection({
          approvedAssetPlacements: [
            {
              ...approvedHeroPlacement,
              pageId: "page_home",
              componentId: source.id,
              componentType: "homepageFeaturedProducts",
              assetSlotId: "productMedia",
            },
          ],
        }),
        bridgeContext("preview"),
        "home",
      ),
    ).toThrow(/commerce-owned homepage product media/i);
  });
  it("registers every verified gap through the snapshot/Puck bridge and generated manifest", () => {
    for (const componentType of closedCapabilities) {
      expect(veskifyComponentRegistry[componentType]).toBeDefined();
      const entry = veskifyComponentCapabilityManifest.getByComponentType(componentType);
      expect(entry?.renderer.supportedTargets).toEqual(["editor", "preview", "published"]);
      expect(entry?.fingerprint).toMatch(/^component-capability-/);
    }
  });

  it("selects each closed capability from a deterministic executable home profile", () => {
    const selected = listExecutablePageBlueprintProfiles()
      .filter((plan) => plan.pageType === "home")
      .flatMap((plan) => plan.profile?.componentSelections.map((selection) => selection.component));
    expect(selected).toEqual(expect.arrayContaining([...closedCapabilities]));
    expect(
      new Set(selected.filter((component) => closedCapabilities.includes(component as never))),
    ).toEqual(new Set(closedCapabilities));
  });

  it("closes only commercial gaps without hiding the independently reported defects", () => {
    const report = createLiveRendererConformanceReport();
    expect(report.commercialGaps).toEqual([]);
    expect(report.blockingDefects).toHaveLength(16);
    expect(report.metadataGaps).toHaveLength(29);
    expect(report.deliberateFutureCapabilities).toHaveLength(7);
  });

  it("renders every bridged profile capability through the registered editor/preview boundary", () => {
    const context = createStorefrontRenderContext({
      activeLocale: "en",
      primaryLocale: "en",
      catalogue: aurumNordicSeed.catalogue,
      snapshot: aurumNordicSeed.draftSnapshot,
    });
    for (const componentType of closedCapabilities) {
      const definition = veskifyComponentRegistry[componentType];
      expect(() =>
        render(
          renderRegisteredSection(
            {
              id: `section_${componentType.replaceAll(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`)}`,
              component: componentType,
              variant: definition.defaultVariant,
              visible: true,
              content: definition.defaultContent,
              props: definition.defaultProps,
            },
            context,
            "home",
          ),
        ),
      ).not.toThrow();
    }
  });
});

function homepageCommerceContent(component: (typeof closedCapabilities)[number]) {
  return structuredClone(veskifyComponentRegistry[component].defaultContent);
}

function homepageCommerceProps(component: (typeof closedCapabilities)[number]) {
  return structuredClone(veskifyComponentRegistry[component].defaultProps);
}
