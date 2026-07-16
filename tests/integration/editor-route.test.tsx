/* eslint-disable @typescript-eslint/unbound-method */
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ProjectEditorClient } from "@/app/projects/[projectId]/editor/project-editor-client";
import { aurumNordicSeed } from "@/data/seed";
import {
  ProjectNotFoundError,
  RepositoryValidationError,
  type ProjectAggregate,
  type ProjectRepository,
} from "@/services/storage";

vi.mock("@/integrations/puck/veskify-puck-editor", () => ({
  VeskifyPuckCanvas: ({
    page,
    context,
  }: {
    page: { type: string };
    context: { activeLocale: string };
  }) => (
    <section aria-label="Visual editor canvas">
      Canvas: {page.type} / {context.activeLocale}
    </section>
  ),
}));

const aggregate = (): ProjectAggregate => ({
  project: structuredClone(aurumNordicSeed.project),
  catalogue: structuredClone(aurumNordicSeed.catalogue),
  snapshots: [
    structuredClone(aurumNordicSeed.publishedSnapshot),
    structuredClone(aurumNordicSeed.draftSnapshot),
  ],
});

function repository(get: ProjectRepository["get"]): ProjectRepository {
  return {
    list: vi.fn(),
    get: vi.fn(get),
    saveDraft: vi.fn(),
    publish: vi.fn(),
    restore: vi.fn(),
  };
}

const route = (value: ProjectRepository) =>
  render(<ProjectEditorClient projectId="project_aurum_nordic" repositoryFactory={() => value} />);

describe("P2-01 project editor route", () => {
  it("loads the canonical draft without writing storage", async () => {
    const value = repository(() => Promise.resolve(aggregate()));
    route(value);
    expect(screen.getByRole("heading", { name: "Loading visual editor" })).toBeVisible();
    expect(await screen.findByText("Aurum Nordic")).toBeVisible();
    expect(value.get).toHaveBeenCalledWith("project_aurum_nordic");
    expect(value.saveDraft).not.toHaveBeenCalled();
    expect(value.publish).not.toHaveBeenCalled();
    expect(value.restore).not.toHaveBeenCalled();
    expect(screen.queryByRole("button", { name: /save|publish/i })).not.toBeInTheDocument();
  });

  it("shows navigation, draft status and the selected preview link", async () => {
    route(repository(() => Promise.resolve(aggregate())));
    await screen.findByText("Aurum Nordic");
    expect(screen.getByRole("navigation", { name: "Editor navigation" })).toBeVisible();
    expect(screen.getByLabelText("Draft status")).toHaveTextContent("Draft is up to date");
    expect(screen.getByRole("link", { name: "View selected page" })).toHaveAttribute(
      "href",
      "/projects/project_aurum_nordic",
    );
    expect(screen.getByText("Canvas: home / en")).toBeVisible();
  });

  it("switches page and project-scoped preview links", async () => {
    route(repository(() => Promise.resolve(aggregate())));
    const switcher = await screen.findByLabelText("Storefront page");
    expect(screen.getAllByRole("option").map((option) => option.textContent)).toEqual([
      "Homepage",
      "Rings",
      "Aurora Ring 585",
    ]);
    fireEvent.change(switcher, { target: { value: "page_collection_rings" } });
    expect(screen.getByText("Canvas: collection / en")).toBeVisible();
    expect(screen.getByRole("link", { name: "View selected page" })).toHaveAttribute(
      "href",
      "/projects/project_aurum_nordic/collections/rings",
    );
    fireEvent.change(switcher, { target: { value: "page_product_aurora" } });
    expect(screen.getByText("Canvas: product / en")).toBeVisible();
    expect(screen.getByRole("link", { name: "View selected page" })).toHaveAttribute(
      "href",
      "/projects/project_aurum_nordic/products/aurora-ring-585",
    );
  });

  it("switches the shell and canvas to Finnish", async () => {
    route(repository(() => Promise.resolve(aggregate())));
    await screen.findByText("Canvas: home / en");
    fireEvent.click(screen.getByRole("radio", { name: "Suomi" }));
    expect(screen.getByText("Canvas: home / fi")).toBeVisible();
    fireEvent.change(screen.getByLabelText("Storefront page"), {
      target: { value: "page_collection_rings" },
    });
    expect(screen.getByRole("heading", { name: "Sormukset" })).toBeVisible();
    expect(screen.getByRole("option", { name: "Sormukset" })).toBeVisible();
  });

  it.each([
    [
      "missing project",
      () => Promise.reject(new ProjectNotFoundError("missing")),
      "Project not found",
    ],
    [
      "validation error",
      () => Promise.reject(new RepositoryValidationError("technical detail")),
      "Editor could not display this draft",
    ],
    [
      "storage error",
      () => Promise.reject(new Error("IndexedDB transaction detail")),
      "Editor could not load the project",
    ],
  ])("shows a safe %s state", async (_name, get, heading) => {
    route(repository(get));
    expect(await screen.findByRole("heading", { name: heading })).toBeVisible();
    expect(screen.queryByText(/technical detail|transaction detail/i)).not.toBeInTheDocument();
  });

  it("handles a missing draft and retries without repository writes", async () => {
    const value = aggregate();
    value.snapshots = value.snapshots.filter(
      (snapshot) => snapshot.id !== value.project.draftSnapshotId,
    );
    const repo = repository(() => Promise.resolve(value));
    route(repo);
    expect(await screen.findByRole("heading", { name: "Draft unavailable" })).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    await waitFor(() => expect(repo.get).toHaveBeenCalledTimes(2));
    expect(repo.saveDraft).not.toHaveBeenCalled();
  });

  it("rejects cross-page canonical sections before opening Puck", async () => {
    const value = aggregate();
    const draft = value.snapshots.find((item) => item.id === value.project.draftSnapshotId)!;
    draft.pages.find((item) => item.type === "collection")!.sections[1].component = "productInfo";
    route(repository(() => Promise.resolve(value)));
    expect(
      await screen.findByRole("heading", { name: "Editor could not display this draft" }),
    ).toBeVisible();
    expect(screen.queryByLabelText("Visual editor canvas")).not.toBeInTheDocument();
  });

  it("marks draft differences without mutating the published snapshot", async () => {
    const value = aggregate();
    const publishedBefore = structuredClone(value.snapshots[0]);
    const draft = value.snapshots.find((item) => item.id === value.project.draftSnapshotId)!;
    draft.pages.find((item) => item.type === "home")!.title.en = "Edited homepage";
    route(repository(() => Promise.resolve(value)));
    expect(await screen.findByLabelText("Draft status")).toHaveTextContent("Unpublished changes");
    expect(value.snapshots[0]).toEqual(publishedBefore);
  });
});
