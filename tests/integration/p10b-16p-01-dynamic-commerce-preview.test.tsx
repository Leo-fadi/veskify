import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { CollectionPreviewClient } from "@/app/projects/[projectId]/collections/[collectionSlug]/collection-preview-client";
import { ProductPreviewClient } from "@/app/projects/[projectId]/products/[productSlug]/product-preview-client";
import { ProjectPreviewClient } from "@/app/projects/[projectId]/project-preview-client";
import { aurumNordicSeed } from "@/data/seed";
import type { LocalizedText } from "@/domain/shared";
import type { ProjectAggregate, ProjectRepository } from "@/services/storage";
import { p10b16p01DynamicCommerceAggregate } from "../fixtures/p10b-16p-01-dynamic-commerce";

function repository(value: ProjectAggregate): ProjectRepository {
  return {
    list: vi.fn(),
    get: vi.fn(() => Promise.resolve(value)),
    create: vi.fn(),
    saveDraft: vi.fn(),
    publish: vi.fn(),
    restore: vi.fn(),
  };
}

function english(value: LocalizedText): string {
  return value.en ?? Object.values(value)[0] ?? "";
}

describe("P10B-16P-01 dynamic-commerce preview and published routes", () => {
  it("resolves multiple exact product URLs through one persisted PDP archetype", async () => {
    const aggregate = p10b16p01DynamicCommerceAggregate();
    const snapshot = aggregate.snapshots.find(
      ({ id }) => id === aggregate.project.draftSnapshotId,
    )!;
    const routes = snapshot.dynamicCommercePresentation!.routeInventory.filter(
      (route) => route.kind === "product",
    );
    expect(snapshot.pages.some(({ type }) => type === "product")).toBe(false);
    expect(
      new Set(
        snapshot.dynamicCommercePresentation!.productTypeMappings.map(
          ({ archetypeId }) => archetypeId,
        ),
      ).size,
    ).toBe(1);

    for (const route of routes.slice(0, 2)) {
      if (route.kind !== "product") throw new Error("Expected a product route fixture.");
      const product = aggregate.catalogue.products.find(({ id }) => id === route.productId)!;
      const view = render(
        <ProductPreviewClient
          productId={aggregate.project.id}
          productSlug={route.route.replace("/products/", "")}
          repositoryFactory={() => repository(aggregate)}
        />,
      );

      expect(
        await screen.findByRole("heading", { level: 1, name: english(product.title) }),
      ).toBeVisible();
      expect(document.querySelector('[data-component="dynamicProductDetail"]')).toHaveAttribute(
        "data-render-target",
        "preview",
      );
      view.unmount();
    }
  });

  it("preserves the historical home announcement without exposing inventory-only search", async () => {
    const aggregate = p10b16p01DynamicCommerceAggregate();
    const snapshot = aggregate.snapshots.find(
      ({ id }) => id === aggregate.project.draftSnapshotId,
    )!;
    delete snapshot.sharedFrame;
    const home = snapshot.pages.find(({ type }) => type === "home")!;
    const historicalHome = aurumNordicSeed.draftSnapshot.pages.find(({ type }) => type === "home")!;
    const historicalChrome = historicalHome.sections.filter(({ component }) =>
      ["announcementBar", "header", "footer"].includes(component),
    );
    const historicalFooter = historicalChrome.find(({ component }) => component === "footer")!;
    home.sections = [
      ...structuredClone(historicalChrome.filter(({ component }) => component !== "footer")),
      ...home.sections,
      structuredClone(historicalFooter),
    ];
    const route = snapshot.dynamicCommercePresentation!.routeInventory.find(
      (candidate) => candidate.kind === "product",
    );
    if (!route || route.kind !== "product") throw new Error("Expected a product route fixture.");

    render(
      <ProductPreviewClient
        productId={aggregate.project.id}
        productSlug={route.route.replace("/products/", "")}
        repositoryFactory={() => repository(aggregate)}
      />,
    );

    expect(
      await screen.findByRole("complementary", { name: "Store announcement" }),
    ).toHaveTextContent("Complimentary delivery in Finland");
    expect(screen.queryByRole("button", { name: "Search (demo)" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Search" })).not.toBeInTheDocument();
    expect(document.querySelectorAll(".project-preview__storefront > header")).toHaveLength(1);
    expect(document.querySelectorAll(".project-preview__storefront > footer")).toHaveLength(1);
  });

  it("resolves an exact collection URL and route-inventory navigation without route pages", async () => {
    const aggregate = p10b16p01DynamicCommerceAggregate();
    const snapshot = aggregate.snapshots.find(
      ({ id }) => id === aggregate.project.draftSnapshotId,
    )!;
    const route = snapshot.dynamicCommercePresentation!.routeInventory.find(
      (candidate) => candidate.kind === "collection",
    );
    if (!route || route.kind !== "collection")
      throw new Error("Expected a collection route fixture.");
    const collection = aggregate.catalogue.collections.find(({ id }) => id === route.collectionId)!;
    const ringsNavigation = snapshot.navigation.primary.find(
      (item) => english(item.label) === "Rings",
    );
    if (!ringsNavigation || ringsNavigation.target.type !== "dynamic-commerce-route") {
      throw new Error("Expected Rings to use a dynamic-commerce route target.");
    }
    const ringsRouteId = ringsNavigation.target.routeId;
    const ringsRoute = snapshot.dynamicCommercePresentation!.routeInventory.find(
      ({ id }) => id === ringsRouteId,
    );
    if (!ringsRoute) throw new Error("Expected the Rings navigation route inventory entry.");
    expect(snapshot.pages.some(({ type }) => type === "collection")).toBe(false);

    render(
      <CollectionPreviewClient
        collectionSlug={route.route.replace("/collections/", "")}
        projectId={aggregate.project.id}
        repositoryFactory={() => repository(aggregate)}
      />,
    );

    expect(
      await screen.findByRole("heading", { level: 1, name: english(collection.title) }),
    ).toBeVisible();
    expect(
      within(screen.getByRole("navigation", { name: "Primary navigation" })).getByRole("link", {
        name: "Rings",
      }),
    ).toHaveAttribute("href", `/projects/${aggregate.project.id}${ringsRoute.route}`);
  });

  it("keeps an authoritative collection route reachable when the current catalogue slug changes", async () => {
    const aggregate = p10b16p01DynamicCommerceAggregate();
    const snapshot = aggregate.snapshots.find(
      ({ id }) => id === aggregate.project.draftSnapshotId,
    )!;
    const route = snapshot.dynamicCommercePresentation!.routeInventory.find(
      (candidate) => candidate.kind === "collection",
    );
    if (!route || route.kind !== "collection") {
      throw new Error("Expected a collection route fixture.");
    }
    const collection = aggregate.catalogue.collections.find(({ id }) => id === route.collectionId);
    if (!collection) throw new Error("Expected the routed canonical collection.");
    collection.slug = "renamed-in-current-catalogue";

    render(
      <CollectionPreviewClient
        collectionSlug={route.route.replace("/collections/", "")}
        projectId={aggregate.project.id}
        repositoryFactory={() => repository(aggregate)}
      />,
    );

    expect(
      await screen.findByRole("heading", { level: 1, name: english(collection.title) }),
    ).toBeVisible();
    expect(screen.queryByRole("heading", { name: "Collection not found" })).not.toBeInTheDocument();
  });

  it("uses the same resolver for generic live-session preview paths", async () => {
    const aggregate = p10b16p01DynamicCommerceAggregate();
    const snapshot = aggregate.snapshots.find(
      ({ id }) => id === aggregate.project.draftSnapshotId,
    )!;
    const route = snapshot.dynamicCommercePresentation!.routeInventory.find(
      (candidate) => candidate.kind === "product",
    );
    if (!route || route.kind !== "product") throw new Error("Expected a product route fixture.");
    const product = aggregate.catalogue.products.find(({ id }) => id === route.productId)!;

    render(
      <ProjectPreviewClient
        initialAggregate={aggregate}
        pageSlug={route.route}
        projectId={aggregate.project.id}
      />,
    );

    expect(await screen.findByRole("heading", { name: english(product.title) })).toBeVisible();
    expect(screen.queryByRole("heading", { name: "Page unavailable" })).not.toBeInTheDocument();
  });

  it("resolves the immutable published snapshot and rejects absent dynamic routes", async () => {
    const aggregate = p10b16p01DynamicCommerceAggregate();
    const draft = aggregate.snapshots.find(({ id }) => id === aggregate.project.draftSnapshotId)!;
    const published = structuredClone(draft);
    published.id = aggregate.project.publishedSnapshotId!;
    aggregate.snapshots = [published];
    const route = published.dynamicCommercePresentation!.routeInventory.find(
      (candidate) => candidate.kind === "product",
    );
    if (!route || route.kind !== "product") throw new Error("Expected a product route fixture.");

    const view = render(
      <ProductPreviewClient
        productId={aggregate.project.id}
        productSlug={route.route.replace("/products/", "")}
        repositoryFactory={() => repository(aggregate)}
        snapshotKind="published"
      />,
    );
    const product = aggregate.catalogue.products.find(({ id }) => id === route.productId)!;
    expect(
      await screen.findByRole("heading", { level: 1, name: english(product.title) }),
    ).toBeVisible();
    expect(screen.getByText("Published storefront")).toBeVisible();
    expect(document.querySelector('[data-component="dynamicProductDetail"]')).toHaveAttribute(
      "data-render-target",
      "published",
    );
    view.unmount();

    render(
      <ProductPreviewClient
        productId={aggregate.project.id}
        productSlug="not-in-the-authoritative-inventory"
        repositoryFactory={() => repository(aggregate)}
        snapshotKind="published"
      />,
    );
    expect(await screen.findByRole("heading", { name: "Product page unavailable" })).toBeVisible();
  });
});
