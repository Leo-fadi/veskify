import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { CollectionPreviewClient } from "@/app/projects/[projectId]/collections/[collectionSlug]/collection-preview-client";
import { aurumNordicSeed } from "@/data/seed";
import {
  createCatalogueStorefrontCommerceRouteAdapter,
  type StorefrontCommerceRouteAdapter,
} from "@/integrations/storefront-commerce-routes";
import {
  ProjectNotFoundError,
  type ProjectAggregate,
  type ProjectRepository,
} from "@/services/storage";

function aggregate(): ProjectAggregate {
  return {
    project: structuredClone(aurumNordicSeed.project),
    catalogue: structuredClone(aurumNordicSeed.catalogue),
    snapshots: [
      structuredClone(aurumNordicSeed.publishedSnapshot),
      structuredClone(aurumNordicSeed.draftSnapshot),
    ],
  };
}

function repository(get: ProjectRepository["get"]): ProjectRepository {
  return {
    list: vi.fn(),
    get: vi.fn(get),
    create: vi.fn(),
    saveDraft: vi.fn(),
    publish: vi.fn(),
    restore: vi.fn(),
  };
}

function route(
  repo: ProjectRepository,
  slug = "rings",
  snapshotKind: "draft" | "published" = "draft",
  commerceAdapter?: StorefrontCommerceRouteAdapter,
) {
  return render(
    <CollectionPreviewClient
      commerceAdapter={commerceAdapter}
      projectId={aurumNordicSeed.project.id}
      collectionSlug={slug}
      repositoryFactory={() => repo}
      snapshotKind={snapshotKind}
    />,
  );
}

describe("collection route", () => {
  it("shows loading then the repository-loaded collection and locale switch", async () => {
    const get = vi.fn(() => Promise.resolve(aggregate()));
    const repo = repository(get);
    route(repo);
    expect(screen.getByRole("heading", { name: "Loading the collection" })).toBeVisible();
    expect(await screen.findByRole("heading", { level: 1, name: "Rings" })).toBeVisible();
    expect(get).toHaveBeenCalledWith(aurumNordicSeed.project.id);
    expect(screen.getByText("Draft preview")).toBeVisible();
    const primaryNavigation = screen.getByRole("navigation", { name: "Primary navigation" });
    expect(within(primaryNavigation).getByRole("link", { name: "Home" })).toHaveAttribute(
      "href",
      "/projects/project_aurum_nordic",
    );
    const brandLinks = screen.getAllByRole("link", { name: /^Aurum Nordic$/ });
    expect(brandLinks).toHaveLength(2);
    for (const brandLink of brandLinks) {
      expect(brandLink).toHaveAttribute("href", "/projects/project_aurum_nordic");
    }
    expect(within(primaryNavigation).getByRole("link", { name: "Rings" })).toHaveAttribute(
      "href",
      "/projects/project_aurum_nordic/collections/rings",
    );
    expect(screen.getByRole("link", { name: "Aurora Ring" })).toHaveAttribute(
      "href",
      "/projects/project_aurum_nordic/products/aurora-ring-585",
    );
    fireEvent.click(screen.getByRole("radio", { name: "Suomi" }));
    expect(screen.getByRole("heading", { level: 1, name: "Sormukset" })).toBeVisible();
  });

  it("uses only the published snapshot and published routes in published mode", async () => {
    const value = aggregate();
    value.snapshots = value.snapshots.filter(
      (snapshot) => snapshot.id !== value.project.draftSnapshotId,
    );
    route(
      repository(() => Promise.resolve(value)),
      "rings",
      "published",
    );

    expect(await screen.findByRole("heading", { level: 1, name: "Rings" })).toBeVisible();
    expect(screen.getByText("Published storefront")).toBeVisible();
    expect(screen.queryByText("Draft preview")).not.toBeInTheDocument();
    const primaryNavigation = screen.getByRole("navigation", { name: "Primary navigation" });
    expect(within(primaryNavigation).getByRole("link", { name: "Home" })).toHaveAttribute(
      "href",
      "/projects/project_aurum_nordic/published",
    );
    expect(screen.getByRole("link", { name: "Aurora Ring" })).toHaveAttribute(
      "href",
      "/projects/project_aurum_nordic/published/products/aurora-ring-585",
    );
  });

  it("keeps a stored legacy collection URL authoritative after the canonical slug changes", async () => {
    const value = aggregate();
    const draft = value.snapshots.find((snapshot) => snapshot.id === value.project.draftSnapshotId);
    const storedPage = draft?.pages.find(
      (page) => page.type === "collection" && page.slug === "/collections/rings",
    );
    const primaryCollectionId = storedPage?.sections.find(
      ({ component }) => component === "collectionHeader",
    )?.content.collectionId;
    const collection = value.catalogue.collections.find(({ id }) => id === primaryCollectionId);
    if (!draft || !storedPage || !collection) {
      throw new Error("The legacy collection route fixture is incomplete.");
    }
    const expectedProductIds = [...collection.productIds];
    const canonicalAdapter = createCatalogueStorefrontCommerceRouteAdapter();
    const collectionProjection = vi.fn(canonicalAdapter.collection);
    const commerceAdapter: StorefrontCommerceRouteAdapter = {
      ...canonicalAdapter,
      collection: collectionProjection,
    };
    collection.slug = "renamed-rings";

    const retainedRoute = route(
      repository(() => Promise.resolve(value)),
      "rings",
      "draft",
      commerceAdapter,
    );
    expect(await screen.findByRole("heading", { level: 1, name: "Rings" })).toBeVisible();
    expect(screen.queryByRole("heading", { name: "Collection not found" })).not.toBeInTheDocument();
    expect(
      [...retainedRoute.container.querySelectorAll("[data-product-id]")].map((element) =>
        element.getAttribute("data-product-id"),
      ),
    ).toEqual(expectedProductIds);
    const draftProjectionInput = collectionProjection.mock.lastCall?.[0];
    expect(draftProjectionInput?.collection.id).toBe(primaryCollectionId);
    expect(draftProjectionInput?.collection.productIds).toEqual(expectedProductIds);
    expect(draftProjectionInput?.page.slug).toBe("/collections/rings");
    expect(
      within(screen.getByRole("navigation", { name: "Primary navigation" })).getByRole("link", {
        name: "Rings",
      }),
    ).toHaveAttribute("href", "/projects/project_aurum_nordic/collections/rings");
    retainedRoute.unmount();

    collectionProjection.mockClear();
    const publishedRoute = route(
      repository(() => Promise.resolve(value)),
      "rings",
      "published",
      commerceAdapter,
    );
    expect(await screen.findByRole("heading", { level: 1, name: "Rings" })).toBeVisible();
    expect(screen.getByText("Published storefront")).toBeVisible();
    expect(
      [...publishedRoute.container.querySelectorAll("[data-product-id]")].map((element) =>
        element.getAttribute("data-product-id"),
      ),
    ).toEqual(expectedProductIds);
    const publishedProjectionInput = collectionProjection.mock.lastCall?.[0];
    expect(publishedProjectionInput?.collection.id).toBe(primaryCollectionId);
    expect(publishedProjectionInput?.collection.productIds).toEqual(expectedProductIds);
    expect(publishedProjectionInput?.page.slug).toBe("/collections/rings");
    expect(
      within(screen.getByRole("navigation", { name: "Primary navigation" })).getByRole("link", {
        name: "Rings",
      }),
    ).toHaveAttribute("href", "/projects/project_aurum_nordic/published/collections/rings");
    publishedRoute.unmount();

    route(
      repository(() => Promise.resolve(value)),
      "renamed-rings",
    );
    expect(
      await screen.findByRole("heading", { name: "Collection page unavailable" }),
    ).toBeVisible();
    expect(draft.dynamicCommercePresentation).toBeUndefined();
    expect(
      value.snapshots.some((snapshot) =>
        snapshot.pages.some(({ slug }) => slug === "/collections/renamed-rings"),
      ),
    ).toBe(false);
  });

  it.each([
    [
      "project",
      repository(() => Promise.reject(new ProjectNotFoundError("missing"))),
      "rings",
      "Project not found",
    ],
    [
      "collection",
      repository(() => Promise.resolve(aggregate())),
      "missing",
      "Collection not found",
    ],
  ])("shows the %s not-found state", async (_name, repo, slug, heading) => {
    route(repo, slug);
    expect(await screen.findByRole("heading", { name: heading })).toBeVisible();
  });

  it("shows missing draft and retries", async () => {
    const value = aggregate();
    value.snapshots = value.snapshots.filter(
      (snapshot) => snapshot.id !== value.project.draftSnapshotId,
    );
    const get = vi.fn(() => Promise.resolve(value));
    const repo = repository(get);
    route(repo);
    expect(await screen.findByRole("heading", { name: "Draft unavailable" })).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    await waitFor(() => expect(get).toHaveBeenCalledTimes(2));
  });

  it("shows a missing collection page", async () => {
    const value = aggregate();
    const draft = value.snapshots.find(
      (snapshot) => snapshot.id === value.project.draftSnapshotId,
    )!;
    draft.pages = draft.pages.filter((page) => page.type !== "collection");
    route(repository(() => Promise.resolve(value)));
    expect(
      await screen.findByRole("heading", { name: "Collection page unavailable" }),
    ).toBeVisible();
  });

  it("shows safe storage and validation failures", async () => {
    const { unmount } = route(repository(() => Promise.reject(new Error("IndexedDB stack"))));
    expect(
      await screen.findByRole("heading", { name: "Collection could not be loaded" }),
    ).toBeVisible();
    expect(screen.queryByText(/indexeddb/i)).not.toBeInTheDocument();
    unmount();
    const value = aggregate();
    const page = value.snapshots
      .find((snapshot) => snapshot.id === value.project.draftSnapshotId)!
      .pages.find((item) => item.type === "collection")!;
    page.sections[1].content = { collectionId: "collection_unknown" };
    route(repository(() => Promise.resolve(value)));
    expect(
      await screen.findByRole("heading", { name: "Collection could not be displayed" }),
    ).toBeVisible();
  });

  it("contains no editor or Puck chrome", async () => {
    route(repository(() => Promise.resolve(aggregate())));
    await screen.findByRole("heading", { level: 1, name: "Rings" });
    expect(screen.queryByText(/puck/i)).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /save|publish|delete|edit/i }),
    ).not.toBeInTheDocument();
  });
});
