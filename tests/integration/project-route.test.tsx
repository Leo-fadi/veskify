import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ProjectPreviewClient } from "@/app/projects/[projectId]/project-preview-client";
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

function repositoryWithGet(get: ProjectRepository["get"]): {
  repository: ProjectRepository;
  get: ReturnType<typeof vi.fn<ProjectRepository["get"]>>;
} {
  const getMock = vi.fn(get);
  return {
    get: getMock,
    repository: {
      list: vi.fn(),
      get: getMock,
      saveDraft: vi.fn(),
      publish: vi.fn(),
      restore: vi.fn(),
    },
  };
}

function renderRoute(repository: ProjectRepository, snapshotKind: "draft" | "published" = "draft") {
  return render(
    <ProjectPreviewClient
      projectId={aurumNordicSeed.project.id}
      repositoryFactory={() => repository}
      snapshotKind={snapshotKind}
    />,
  );
}

describe("seed project route", () => {
  it("shows a loading state while the repository is pending", () => {
    const { repository } = repositoryWithGet(() => new Promise<ProjectAggregate>(() => undefined));
    renderRoute(repository);
    expect(screen.getByRole("heading", { name: "Loading your storefront" })).toBeVisible();
  });

  it("loads through the repository and renders the registered English hero", async () => {
    const { repository, get } = repositoryWithGet(() => Promise.resolve(aggregate()));
    renderRoute(repository);

    expect(await screen.findByRole("heading", { name: "Made for northern light" })).toBeVisible();
    expect(get).toHaveBeenCalledWith(aurumNordicSeed.project.id);
    expect(screen.getByRole("heading", { name: "Aurum Nordic" })).toBeVisible();
    expect(screen.getByText("Draft preview")).toBeVisible();
    expect(screen.getByText("Current locale: EN")).toBeVisible();
    expect(screen.getByLabelText("Draft storefront")).toBeVisible();
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
  });

  it("keeps published storefront navigation on the immutable published snapshot", async () => {
    const value = aggregate();
    value.snapshots = value.snapshots.filter(
      (snapshot) => snapshot.id !== value.project.draftSnapshotId,
    );
    const { repository } = repositoryWithGet(() => Promise.resolve(value));
    renderRoute(repository, "published");

    expect(await screen.findByRole("heading", { name: "Made for northern light" })).toBeVisible();
    expect(screen.getByText("Published storefront")).toBeVisible();
    expect(screen.queryByText("Draft preview")).not.toBeInTheDocument();
    const primaryNavigation = screen.getByRole("navigation", { name: "Primary navigation" });
    expect(within(primaryNavigation).getByRole("link", { name: "Home" })).toHaveAttribute(
      "href",
      "/projects/project_aurum_nordic/published",
    );
    expect(within(primaryNavigation).getByRole("link", { name: "Rings" })).toHaveAttribute(
      "href",
      "/projects/project_aurum_nordic/published/collections/rings",
    );
    expect(screen.getByRole("link", { name: "Aurora Ring" })).toHaveAttribute(
      "href",
      "/projects/project_aurum_nordic/published/products/aurora-ring-585",
    );
  });

  it("switches the registered composition to Finnish", async () => {
    const { repository } = repositoryWithGet(() => Promise.resolve(aggregate()));
    renderRoute(repository);
    await screen.findByRole("heading", { name: "Made for northern light" });

    fireEvent.click(screen.getByRole("radio", { name: "Suomi" }));
    expect(screen.getByRole("heading", { name: "Tehty pohjoiseen valoon" })).toBeVisible();
    expect(screen.getByText("Current locale: FI")).toBeVisible();
  });

  it("falls back to the primary locale when Finnish content is missing", async () => {
    const value = aggregate();
    const draft = value.snapshots.find((snapshot) => snapshot.id === value.project.draftSnapshotId);
    const hero = draft?.pages
      .find((page) => page.type === "home")
      ?.sections.find((section) => section.component === "hero");
    if (hero) hero.content.title = { en: "Primary locale title" };
    const { repository } = repositoryWithGet(() => Promise.resolve(value));
    renderRoute(repository);
    await screen.findByRole("heading", { name: "Primary locale title" });

    fireEvent.click(screen.getByRole("radio", { name: "Suomi" }));
    expect(screen.getByRole("heading", { name: "Primary locale title" })).toBeVisible();
  });

  it("shows a merchant-readable project-not-found state", async () => {
    const { repository } = repositoryWithGet(() =>
      Promise.reject(new ProjectNotFoundError("project_missing")),
    );
    renderRoute(repository);
    expect(await screen.findByRole("heading", { name: "Project not found" })).toBeVisible();
    expect(screen.queryByText(/indexeddb/i)).not.toBeInTheDocument();
  });

  it("shows a missing draft state with retry", async () => {
    const value = aggregate();
    value.snapshots = value.snapshots.filter(
      (snapshot) => snapshot.id !== value.project.draftSnapshotId,
    );
    const { repository, get } = repositoryWithGet(() => Promise.resolve(value));
    renderRoute(repository);
    expect(await screen.findByRole("heading", { name: "Draft unavailable" })).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    await waitFor(() => expect(get).toHaveBeenCalledTimes(2));
  });

  it("shows a missing homepage state", async () => {
    const value = aggregate();
    const draft = value.snapshots.find((snapshot) => snapshot.id === value.project.draftSnapshotId);
    if (draft) draft.pages = draft.pages.filter((page) => page.type !== "home");
    const { repository } = repositoryWithGet(() => Promise.resolve(value));
    renderRoute(repository);
    expect(await screen.findByRole("heading", { name: "Homepage unavailable" })).toBeVisible();
  });

  it("shows a generic storage failure without technical details", async () => {
    const { repository } = repositoryWithGet(() =>
      Promise.reject(new Error("IDB transaction stack detail")),
    );
    renderRoute(repository);
    expect(
      await screen.findByRole("heading", { name: "Storefront could not be loaded" }),
    ).toBeVisible();
    expect(screen.queryByText(/transaction stack detail/i)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Try again" })).toBeVisible();
  });

  it("rejects invalid composition before registry rendering", async () => {
    const value = aggregate();
    const draft = value.snapshots.find((snapshot) => snapshot.id === value.project.draftSnapshotId);
    const hero = draft?.pages.find((page) => page.type === "home")?.sections[0];
    if (hero) hero.component = "unknownComponent";
    const { repository } = repositoryWithGet(() => Promise.resolve(value));
    renderRoute(repository);
    expect(
      await screen.findByRole("heading", { name: "Storefront could not be displayed" }),
    ).toBeVisible();
  });

  it("contains no editor or Puck chrome in the successful read-only route", async () => {
    const { repository } = repositoryWithGet(() => Promise.resolve(aggregate()));
    renderRoute(repository);
    await screen.findByRole("heading", { name: "Made for northern light" });

    expect(screen.queryByText(/puck/i)).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /save|publish|delete|edit/i }),
    ).not.toBeInTheDocument();
    expect(screen.queryByText(/property panel|selection/i)).not.toBeInTheDocument();
  });
});
