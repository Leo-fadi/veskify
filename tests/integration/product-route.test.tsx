import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ProductPreviewClient } from "@/app/projects/[projectId]/products/[productSlug]/product-preview-client";
import { aurumNordicSeed } from "@/data/seed";
import {
  ProjectNotFoundError,
  type ProjectAggregate,
  type ProjectRepository,
} from "@/services/storage";

const aggregate = (): ProjectAggregate => ({
  project: structuredClone(aurumNordicSeed.project),
  catalogue: structuredClone(aurumNordicSeed.catalogue),
  snapshots: [
    structuredClone(aurumNordicSeed.publishedSnapshot),
    structuredClone(aurumNordicSeed.draftSnapshot),
  ],
});
const repository = (get: ProjectRepository["get"]): ProjectRepository => ({
  list: vi.fn(),
  get: vi.fn(get),
  create: vi.fn(),
  saveDraft: vi.fn(),
  publish: vi.fn(),
  restore: vi.fn(),
});
const route = (
  repo: ProjectRepository,
  slug = "aurora-ring-585",
  snapshotKind: "draft" | "published" = "draft",
) =>
  render(
    <ProductPreviewClient
      productId="project_aurum_nordic"
      productSlug={slug}
      repositoryFactory={() => repo}
      snapshotKind={snapshotKind}
    />,
  );

describe("product preview route states", () => {
  it("shows loading then the successful repository-loaded product without editor chrome", async () => {
    route(repository(() => Promise.resolve(aggregate())));
    expect(screen.getByRole("heading", { name: "Loading product preview" })).toBeVisible();
    expect(await screen.findByRole("heading", { level: 1, name: "Aurora Ring 585" })).toBeVisible();
    expect(screen.getByText("Draft preview")).toBeVisible();
    expect(screen.queryByText(/Puck editor|property panel/i)).not.toBeInTheDocument();
  });

  it("uses only the published snapshot and published routes in published mode", async () => {
    const value = aggregate();
    value.snapshots = value.snapshots.filter(
      (snapshot) => snapshot.id !== value.project.draftSnapshotId,
    );
    route(
      repository(() => Promise.resolve(value)),
      "aurora-ring-585",
      "published",
    );

    expect(await screen.findByRole("heading", { level: 1, name: "Aurora Ring 585" })).toBeVisible();
    expect(screen.getByText("Published storefront")).toBeVisible();
    expect(screen.queryByText("Draft preview")).not.toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: "Home" })[0]).toHaveAttribute(
      "href",
      "/projects/project_aurum_nordic/published",
    );
    expect(screen.getByRole("link", { name: "Rings" })).toHaveAttribute(
      "href",
      "/projects/project_aurum_nordic/published/collections/rings",
    );
  });

  it.each([
    [
      "project not found",
      () => Promise.reject(new ProjectNotFoundError("missing")),
      "Project not found",
    ],
    [
      "storage failure",
      () => Promise.reject(new Error("IndexedDB detail")),
      "Storefront could not be loaded",
    ],
  ])("shows %s safely", async (_name, get, heading) => {
    route(repository(get));
    expect(await screen.findByRole("heading", { name: heading })).toBeVisible();
    expect(screen.queryByText(/IndexedDB detail/)).not.toBeInTheDocument();
  });

  it("distinguishes missing draft, product and product page", async () => {
    const missingDraft = aggregate();
    missingDraft.snapshots = [];
    const first = route(repository(() => Promise.resolve(missingDraft)));
    expect(await screen.findByRole("heading", { name: "Draft unavailable" })).toBeVisible();
    first.unmount();
    const second = route(
      repository(() => Promise.resolve(aggregate())),
      "unknown-product",
    );
    expect(await screen.findByRole("heading", { name: "Product page unavailable" })).toBeVisible();
    second.unmount();
    const missingProduct = aggregate();
    missingProduct.snapshots
      .find((item) => item.id === missingProduct.project.draftSnapshotId)!
      .pages.find((item) => item.type === "product")!
      .sections.find((item) => item.component === "productInfo")!.content.productId =
      "product_missing";
    const third = route(repository(() => Promise.resolve(missingProduct)));
    expect(await screen.findByRole("heading", { name: "Product not found" })).toBeVisible();
    third.unmount();
    const missingPage = aggregate();
    missingPage.snapshots.find((item) => item.id === missingPage.project.draftSnapshotId)!.pages =
      missingPage.snapshots[1].pages.filter((item) => item.type !== "product");
    route(repository(() => Promise.resolve(missingPage)));
    expect(await screen.findByRole("heading", { name: "Product page unavailable" })).toBeVisible();
  });

  it("shows validation failure for an invalid product composition", async () => {
    const value = aggregate();
    const page = value.snapshots
      .find((item) => item.id === value.project.draftSnapshotId)!
      .pages.find((item) => item.type === "product")!;
    page.sections[1].component = "unknownComponent";
    route(repository(() => Promise.resolve(value)));
    expect(
      await screen.findByRole("heading", { name: "Product page could not be displayed" }),
    ).toBeVisible();
  });

  it("resolves a Finnish-only product from the canonical reference at a custom stored slug", async () => {
    const value = aggregate();
    value.catalogue.products[0].title = { fi: "Vain suomeksi nimetty sormus" };
    const draft = value.snapshots.find((item) => item.id === value.project.draftSnapshotId)!;
    draft.pages.find((item) => item.type === "product")!.slug = "/products/custom-aurora-page";
    route(
      repository(() => Promise.resolve(value)),
      "custom-aurora-page",
    );
    expect(
      await screen.findByRole("heading", { level: 1, name: "Vain suomeksi nimetty sormus" }),
    ).toBeVisible();
  });

  it("keeps preview navigation scoped to the current project", async () => {
    route(repository(() => Promise.resolve(aggregate())));
    await screen.findByRole("heading", { level: 1, name: "Aurora Ring 585" });
    expect(screen.getAllByRole("link", { name: "Home" })[0]).toHaveAttribute(
      "href",
      "/projects/project_aurum_nordic",
    );
    const brandLinks = screen.getAllByRole("link", { name: /^Aurum Nordic$/ });
    expect(brandLinks).toHaveLength(2);
    for (const brandLink of brandLinks) {
      expect(brandLink).toHaveAttribute("href", "/projects/project_aurum_nordic");
    }
    expect(screen.getByRole("link", { name: "Rings" })).toHaveAttribute(
      "href",
      "/projects/project_aurum_nordic/collections/rings",
    );
    expect(screen.getByRole("link", { name: "Aurora Ring" })).toHaveAttribute(
      "href",
      "/projects/project_aurum_nordic/products/aurora-ring-585",
    );
  });

  it("renders exactly one main landmark", async () => {
    route(repository(() => Promise.resolve(aggregate())));
    await screen.findByRole("heading", { level: 1, name: "Aurora Ring 585" });
    expect(screen.getAllByRole("main")).toHaveLength(1);
    expect(screen.getByRole("main")).not.toHaveAttribute("aria-label", "Draft product storefront");
  });

  it("immediately clears the previous product while route parameters load", async () => {
    let request = 0;
    const repo = repository(() => {
      request += 1;
      return request === 1
        ? Promise.resolve(aggregate())
        : new Promise<ProjectAggregate>(() => undefined);
    });
    const view = route(repo);
    await screen.findByRole("heading", { level: 1, name: "Aurora Ring 585" });

    view.rerender(
      <ProductPreviewClient
        productId="project_next"
        productSlug="next-product"
        repositoryFactory={() => repo}
      />,
    );

    expect(screen.getByRole("heading", { name: "Loading product preview" })).toBeVisible();
    expect(
      screen.queryByRole("heading", { level: 1, name: "Aurora Ring 585" }),
    ).not.toBeInTheDocument();
  });

  it("shows a controlled validation error for inconsistent canonical product references", async () => {
    const value = aggregate();
    const productPage = value.snapshots
      .find((item) => item.id === value.project.draftSnapshotId)!
      .pages.find((item) => item.type === "product")!;
    productPage.sections.find((item) => item.component === "productGallery")!.content.productId =
      "product_lumi_halo_ring";
    route(repository(() => Promise.resolve(value)));
    expect(
      await screen.findByRole("heading", { name: "Product page could not be displayed" }),
    ).toBeVisible();
  });
});
