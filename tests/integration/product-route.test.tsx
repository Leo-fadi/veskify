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
  saveDraft: vi.fn(),
  publish: vi.fn(),
  restore: vi.fn(),
});
const route = (repo: ProjectRepository, slug = "aurora-ring-585") =>
  render(
    <ProductPreviewClient
      productId="project_aurum_nordic"
      productSlug={slug}
      repositoryFactory={() => repo}
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
    expect(await screen.findByRole("heading", { name: "Product not found" })).toBeVisible();
    second.unmount();
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
});
