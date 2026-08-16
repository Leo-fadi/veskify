import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import PublishedCollectionPage from "@/app/projects/[projectId]/published/collections/[collectionSlug]/page";
import PublishedProductPage from "@/app/projects/[projectId]/published/products/[productSlug]/page";
import { CollectionPreviewClient } from "@/app/projects/[projectId]/collections/[collectionSlug]/collection-preview-client";
import { ProjectPreviewClient } from "@/app/projects/[projectId]/project-preview-client";
import { ProductPreviewClient } from "@/app/projects/[projectId]/products/[productSlug]/product-preview-client";
import {
  createCatalogueStorefrontCommerceRouteAdapter,
  type StorefrontCommerceRouteAdapter,
} from "@/integrations/storefront-commerce-routes";
import { aurumNordicSeed } from "@/data/seed";
import type * as StorefrontRegistry from "@/components/registry";
import type * as StorefrontCommerceRoute from "@/components/storefront/storefront-commerce-route";
import type { ProjectAggregate, ProjectRepository } from "@/services/storage";

const renderedContexts = vi.hoisted(() => [] as unknown[]);
const nestedTargets = vi.hoisted(() => ({ collection: [] as string[], product: [] as string[] }));

vi.mock("@/components/registry", async (importOriginal) => {
  const actual = await importOriginal<typeof StorefrontRegistry>();
  return {
    ...actual,
    createStorefrontRenderContext: (
      ...args: Parameters<typeof actual.createStorefrontRenderContext>
    ) => {
      renderedContexts.push(args[0]);
      return actual.createStorefrontRenderContext(...args);
    },
  };
});

vi.mock("@/components/storefront/storefront-commerce-route", async (importOriginal) => {
  const actual = await importOriginal<typeof StorefrontCommerceRoute>();
  return {
    ...actual,
    StorefrontCollectionCommerceRoute: (
      ...args: Parameters<typeof actual.StorefrontCollectionCommerceRoute>
    ) => {
      nestedTargets.collection.push(args[0].target);
      return actual.StorefrontCollectionCommerceRoute(...args);
    },
    StorefrontProductCommerceRoute: (
      ...args: Parameters<typeof actual.StorefrontProductCommerceRoute>
    ) => {
      nestedTargets.product.push(args[0].target);
      return actual.StorefrontProductCommerceRoute(...args);
    },
  };
});

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

function repository(value: ProjectAggregate) {
  const publish = vi.fn();
  const projectRepository: ProjectRepository = {
    list: vi.fn(),
    get: vi.fn(() => Promise.resolve(value)),
    create: vi.fn(),
    saveDraft: vi.fn(),
    publish,
    restore: vi.fn(),
  };
  return { projectRepository, publish };
}

function expectRenderedContext(snapshotId: string, renderTarget: "preview" | "published") {
  const contexts = renderedContexts as Array<{
    snapshot: { id: string };
    renderTarget: "preview" | "published";
  }>;
  expect(contexts.length).toBeGreaterThan(0);
  expect(contexts.every((context) => context.snapshot.id === snapshotId)).toBe(true);
  expect(contexts.every((context) => context.renderTarget === renderTarget)).toBe(true);
}

function expectNestedTarget(kind: "collection" | "product", target: "preview" | "published") {
  expect(nestedTargets[kind].length).toBeGreaterThan(0);
  expect(nestedTargets[kind].every((value) => value === target)).toBe(true);
}

describe("P10A-08D published route render-target closure", () => {
  beforeEach(() => {
    renderedContexts.splice(0);
    nestedTargets.collection.splice(0);
    nestedTargets.product.splice(0);
  });

  it("keeps published homepage snapshot selection and render target independently explicit", async () => {
    const value = aggregate();
    value.snapshots = value.snapshots.filter(
      (snapshot) => snapshot.id !== value.project.draftSnapshotId,
    );
    const repo = repository(value);
    render(
      <ProjectPreviewClient
        projectId={value.project.id}
        repositoryFactory={() => repo.projectRepository}
        snapshotKind="published"
      />,
    );
    await screen.findByRole("heading", { level: 1, name: "Aurum Nordic" });
    expectRenderedContext(value.project.publishedSnapshotId, "published");
    expect(repo.publish).not.toHaveBeenCalled();
  });

  it("uses the published collection snapshot and explicit published target without changing commerce bindings", async () => {
    const value = aggregate();
    const repo = repository(value);
    const baseAdapter = createCatalogueStorefrontCommerceRouteAdapter();
    const collectionCalls: Parameters<StorefrontCommerceRouteAdapter["collection"]>[0][] = [];
    const commerceAdapter: StorefrontCommerceRouteAdapter = {
      ...baseAdapter,
      collection: (input) => {
        collectionCalls.push(input);
        return baseAdapter.collection(input);
      },
    };
    render(
      <CollectionPreviewClient
        collectionSlug="rings"
        commerceAdapter={commerceAdapter}
        projectId={value.project.id}
        renderTarget="published"
        repositoryFactory={() => repo.projectRepository}
        snapshotKind="published"
      />,
    );
    await screen.findByRole("heading", { level: 1, name: "Rings" });
    expectRenderedContext(value.project.publishedSnapshotId, "published");
    expectNestedTarget("collection", "published");
    expect(collectionCalls).toHaveLength(1);
    expect(collectionCalls[0]?.snapshot.id).toBe(value.project.publishedSnapshotId);
    expect(
      collectionCalls[0]?.page.sections.some(
        (section) =>
          "collectionId" in section.content && section.content.collectionId === "collection_rings",
      ),
    ).toBe(true);
    expect(repo.publish).not.toHaveBeenCalled();
  });

  it("uses the published PDP snapshot and explicit published target without changing commerce bindings", async () => {
    const value = aggregate();
    const repo = repository(value);
    const baseAdapter = createCatalogueStorefrontCommerceRouteAdapter();
    const productCalls: Parameters<StorefrontCommerceRouteAdapter["product"]>[0][] = [];
    const commerceAdapter: StorefrontCommerceRouteAdapter = {
      ...baseAdapter,
      product: (input) => {
        productCalls.push(input);
        return baseAdapter.product(input);
      },
    };
    render(
      <ProductPreviewClient
        commerceAdapter={commerceAdapter}
        productId={value.project.id}
        productSlug="aurora-ring-585"
        renderTarget="published"
        repositoryFactory={() => repo.projectRepository}
        snapshotKind="published"
      />,
    );
    await screen.findByRole("heading", { level: 1, name: "Aurora Ring 585" });
    expectRenderedContext(value.project.publishedSnapshotId, "published");
    expectNestedTarget("product", "published");
    expect(productCalls).toHaveLength(1);
    expect(productCalls[0]?.snapshot.id).toBe(value.project.publishedSnapshotId);
    expect(productCalls[0]?.product.id).toBe("product_aurora_ring_585");
    expect(
      productCalls[0]?.page.sections.some(
        (section) =>
          "productId" in section.content && section.content.productId === "product_aurora_ring_585",
      ),
    ).toBe(true);
    expect(repo.publish).not.toHaveBeenCalled();
  });

  it("keeps draft collection and PDP clients in preview mode", async () => {
    const collection = aggregate();
    render(
      <CollectionPreviewClient
        collectionSlug="rings"
        projectId={collection.project.id}
        repositoryFactory={() => repository(collection).projectRepository}
      />,
    );
    await screen.findByRole("heading", { level: 1, name: "Rings" });
    expectRenderedContext(collection.project.draftSnapshotId, "preview");
    expectNestedTarget("collection", "preview");

    renderedContexts.splice(0);
    nestedTargets.collection.splice(0);
    const product = aggregate();
    render(
      <ProductPreviewClient
        productId={product.project.id}
        productSlug="aurora-ring-585"
        repositoryFactory={() => repository(product).projectRepository}
      />,
    );
    await screen.findByRole("heading", { level: 1, name: "Aurora Ring 585" });
    expectRenderedContext(product.project.draftSnapshotId, "preview");
    expectNestedTarget("product", "preview");
  });

  it("propagates an independently supplied collection target without changing published snapshot selection", async () => {
    const value = aggregate();
    render(
      <CollectionPreviewClient
        collectionSlug="rings"
        projectId={value.project.id}
        renderTarget="preview"
        repositoryFactory={() => repository(value).projectRepository}
        snapshotKind="published"
      />,
    );
    await screen.findByRole("heading", { level: 1, name: "Rings" });
    expectRenderedContext(value.project.publishedSnapshotId, "preview");
    expectNestedTarget("collection", "preview");
  });

  it("propagates an independently supplied PDP target without changing published snapshot selection", async () => {
    const value = aggregate();
    render(
      <ProductPreviewClient
        productId={value.project.id}
        productSlug="aurora-ring-585"
        renderTarget="preview"
        repositoryFactory={() => repository(value).projectRepository}
        snapshotKind="published"
      />,
    );
    await screen.findByRole("heading", { level: 1, name: "Aurora Ring 585" });
    expectRenderedContext(value.project.publishedSnapshotId, "preview");
    expectNestedTarget("product", "preview");
  });

  it("derives the published compatibility default once when callers omit renderTarget", async () => {
    const collection = aggregate();
    render(
      <CollectionPreviewClient
        collectionSlug="rings"
        projectId={collection.project.id}
        repositoryFactory={() => repository(collection).projectRepository}
        snapshotKind="published"
      />,
    );
    await screen.findByRole("heading", { level: 1, name: "Rings" });
    expectRenderedContext(collection.project.publishedSnapshotId, "published");
    expectNestedTarget("collection", "published");

    renderedContexts.splice(0);
    nestedTargets.collection.splice(0);
    const product = aggregate();
    render(
      <ProductPreviewClient
        productId={product.project.id}
        productSlug="aurora-ring-585"
        repositoryFactory={() => repository(product).projectRepository}
        snapshotKind="published"
      />,
    );
    await screen.findByRole("heading", { level: 1, name: "Aurora Ring 585" });
    expectRenderedContext(product.project.publishedSnapshotId, "published");
    expectNestedTarget("product", "published");
  });

  it("makes published route wrappers pass the target and exact session authority", async () => {
    const publishedSessionId = "p10a-08d-02-session-authority";
    await expect(
      PublishedCollectionPage({
        params: Promise.resolve({ projectId: "project_lumo_fresh", collectionSlug: "jewellery" }),
        searchParams: Promise.resolve({ "p9-05b-session": publishedSessionId, locale: "fi" }),
      }),
    ).resolves.toMatchObject({
      props: {
        snapshotKind: "published",
        renderTarget: "published",
        publishedSessionId,
        initialLocale: "fi",
      },
    });
    await expect(
      PublishedProductPage({
        params: Promise.resolve({
          projectId: "project_lumo_fresh",
          productSlug: "custom-halo-ring",
        }),
        searchParams: Promise.resolve({ "p9-05b-session": publishedSessionId, locale: "fi" }),
      }),
    ).resolves.toMatchObject({
      props: {
        snapshotKind: "published",
        renderTarget: "published",
        publishedSessionId,
        initialLocale: "fi",
      },
    });
  });
});
