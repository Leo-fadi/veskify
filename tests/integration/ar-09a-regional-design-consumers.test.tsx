import { render, waitFor } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  createBoundedStorefrontSynthesisDecision,
  executeBoundedStorefrontSynthesis,
} from "@/application/bounded-storefront-synthesis";
import { listCompatibleCoordinatedDirectionSelectionNarrowings } from "@/application/bounded-storefront-synthesis/compatible-direction-selections";
import { createStorefrontRenderContext } from "@/components/registry";
import { renderStorefrontPage } from "@/components/storefront/storefront-page";
import { createP10B14PremiumEditorialFixture } from "@/data/demo/p10b-14-premium-editorial";
import { brandSystemToCssVariables, projectDesignDna } from "@/domain/design-system";
import { resolveDynamicCommerceRoutePage } from "@/application/dynamic-commerce-routes/authority";
import {
  StorefrontCollectionCommerceRoute,
  StorefrontProductCommerceRoute,
} from "@/components/storefront/storefront-commerce-route";
import { createCatalogueStorefrontCommerceRouteAdapter } from "@/integrations/storefront-commerce-routes/catalogue-adapter";

describe("AR-09A registered regional consumers", () => {
  it("renders canonical regional density variables for home, collection, and PDP", async () => {
    const source = createP10B14PremiumEditorialFixture();
    const common = {
      planningInput: source.fixture.planningInput,
      siteMapDecision: source.siteMapDecision,
      approvedEvidenceReferences: source.approvedEvidenceReferences,
    };
    const [narrowing] = listCompatibleCoordinatedDirectionSelectionNarrowings(common);
    if (!narrowing) throw new Error("Expected a compatible selection.");
    const { authorityId, authorityVersion, authorityFingerprint, selectionId, ...exact } =
      narrowing;
    void [authorityId, authorityVersion, authorityFingerprint, selectionId];
    const request = { intent: "editorial-led" as const, deterministicSeed: "ar09a-consumers" };
    const exactSelection = {
      ...exact,
      expressiveVisualPreferences: {
        version: "2.0.0" as const,
        regionalDensity: {
          navigation: "compact" as const,
          content: "spacious" as const,
          commerce: "balanced" as const,
        },
      },
    };
    const decision = createBoundedStorefrontSynthesisDecision({
      ...common,
      request,
      exactSelection,
    });
    const result = executeBoundedStorefrontSynthesis({
      ...common,
      request,
      exactSelection,
      decision,
      pageEvidenceAuthority: source.pageEvidenceAuthority,
      contentFactAuthority: source.contentFactAuthority,
      approvedAssetPresentations: source.fixture.assetPresentations,
    });
    expect(
      projectDesignDna(result.materialization.snapshot.brandSystem.designDna).cssVariables,
    ).toMatchObject({
      "--brand-density-navigation": "0.86",
      "--brand-density-content": "1.16",
      "--brand-density-commerce": "1",
    });
    for (const [path, variable] of [
      [
        "src/components/storefront/commercial-storefront-frame.module.css",
        "--brand-density-navigation",
      ],
      ["src/components/storefront/homepage-commerce.module.css", "--brand-density-content"],
      [
        "src/components/storefront/dynamic-collection-commerce.module.css",
        "--brand-density-commerce",
      ],
      ["src/components/storefront/dynamic-product-detail.module.css", "--brand-density-commerce"],
    ] as const) {
      expect(readFileSync(path, "utf8")).toContain(`var(${variable},`);
    }
    const snapshot = result.materialization.snapshot;
    const catalogue = result.materialization.planningInput.catalogue;
    const aggregate = {
      ...source.fixture.aggregate,
      catalogue: structuredClone(catalogue),
      snapshots: source.fixture.aggregate.snapshots.map((candidate) =>
        candidate.id === source.fixture.aggregate.project.draftSnapshotId
          ? structuredClone(snapshot)
          : structuredClone(candidate),
      ),
    };
    const context = createStorefrontRenderContext({
      activeLocale: "en",
      primaryLocale: "en",
      enabledLocales: aggregate.project.enabledLocales,
      catalogue,
      snapshot,
      evidenceReferences: source.approvedEvidenceReferences,
      contentSupportFactDocuments: snapshot.contentSupportFactDocuments,
      renderTarget: "preview",
    });
    const home = snapshot.pages.find(({ type }) => type === "home");
    const collectionRoute = snapshot.dynamicCommercePresentation?.routeInventory.find(
      ({ kind }) => kind === "collection",
    );
    const productRoute = snapshot.dynamicCommercePresentation?.routeInventory.find(
      ({ kind }) => kind === "product",
    );
    if (!home || collectionRoute?.kind !== "collection" || productRoute?.kind !== "product")
      throw new Error("Missing required real surface.");
    const collectionPage = resolveDynamicCommerceRoutePage({
      snapshot,
      catalogue,
      routeId: collectionRoute.id,
    }).page;
    const productPage = resolveDynamicCommerceRoutePage({
      snapshot,
      catalogue,
      routeId: productRoute.id,
    }).page;
    const collection = catalogue.collections.find(({ id }) => id === collectionRoute.collectionId);
    const product = catalogue.products.find(({ id }) => id === productRoute.productId);
    if (!collection || !product) throw new Error("Missing canonical commerce binding.");
    const adapter = createCatalogueStorefrontCommerceRouteAdapter();
    const collectionPresentation = adapter.collection({
      aggregate,
      snapshot,
      page: collectionPage,
      collection,
    });
    const productPresentation = adapter.product({
      aggregate,
      snapshot,
      page: productPage,
      product,
    });
    if (!collectionPresentation || !productPresentation)
      throw new Error("Missing registered route presentation.");
    expect(
      collectionPage.sections.some(({ component }) => component === "dynamicCollectionCommerce"),
    ).toBe(true);
    expect(productPage.sections.some(({ component }) => component === "dynamicProductDetail")).toBe(
      true,
    );
    const surfaces = [
      ["home", renderStorefrontPage(home, context)],
      [
        "collection",
        <StorefrontCollectionCommerceRoute
          key="collection"
          activeLocale="en"
          primaryLocale="en"
          context={context}
          page={collectionPage}
          presentation={collectionPresentation}
          target="preview"
          onFilterIntent={() => undefined}
          onNavigateCollection={() => undefined}
          onNavigateProduct={() => undefined}
          onSortIntent={() => undefined}
        />,
      ],
      [
        "product",
        <StorefrontProductCommerceRoute
          key="product"
          activeLocale="en"
          primaryLocale="en"
          context={context}
          page={productPage}
          presentation={productPresentation}
          target="preview"
          onPrimaryAction={() => undefined}
        />,
      ],
    ] as const;
    for (const [surface, node] of surfaces) {
      // Same canonical style projection used by the existing project preview clients.
      const mounted = render(
        <div style={brandSystemToCssVariables(snapshot.brandSystem)}>{node}</div>,
      );
      // PDP resolution is asynchronous: inspect the actual ready registered component,
      // not the server-rendered loading shell.
      await waitFor(() =>
        expect(mounted.container.querySelector('[data-render-target="preview"]')).not.toBeNull(),
      );
      const markup = mounted.container.innerHTML;
      const style = (mounted.container.firstElementChild as HTMLElement).style;
      expect(style.getPropertyValue("--brand-density-navigation"), surface).toBe("0.86");
      expect(style.getPropertyValue("--brand-density-content"), surface).toBe("1.16");
      expect(style.getPropertyValue("--brand-density-commerce"), surface).toBe("1");
      expect(markup, surface).toContain("<main");
      expect(markup, surface).toContain("<header");
      expect(markup, surface).toContain('data-render-target="preview"');
      if (surface === "collection")
        expect(markup).toContain('data-component="dynamicCollectionCommerce"');
      if (surface === "product") expect(markup).toContain('data-component="dynamicProductDetail"');
      mounted.unmount();
    }
    for (const relative of [
      "project-preview-client.tsx",
      "collections/[collectionSlug]/collection-preview-client.tsx",
      "products/[productSlug]/product-preview-client.tsx",
    ]) {
      expect(readFileSync(`src/app/projects/[projectId]/${relative}`, "utf8")).toContain(
        "brandSystemToCssVariables(state.draft.brandSystem)",
      );
    }
  });
});
