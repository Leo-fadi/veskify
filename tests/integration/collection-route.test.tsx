import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { CollectionPreviewClient } from "@/app/projects/[projectId]/collections/[collectionSlug]/collection-preview-client";
import { aurumNordicSeed } from "@/data/seed";
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
  return { list: vi.fn(), get: vi.fn(get), saveDraft: vi.fn(), publish: vi.fn(), restore: vi.fn() };
}

function route(
  repo: ProjectRepository,
  slug = "rings",
  snapshotKind: "draft" | "published" = "draft",
) {
  return render(
    <CollectionPreviewClient
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
