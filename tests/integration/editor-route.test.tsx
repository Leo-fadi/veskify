/* eslint-disable @typescript-eslint/unbound-method */
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ProjectEditorClient } from "@/app/projects/[projectId]/editor/project-editor-client";
import { aurumNordicSeed } from "@/data/seed";
import {
  InMemoryProjectRepository,
  ProjectNotFoundError,
  RepositoryValidationError,
  type ProjectAggregate,
  type ProjectRepository,
} from "@/services/storage";

vi.mock("@/integrations/puck/veskify-puck-editor", () => ({
  VeskifyPuckCanvas: ({
    page,
    context,
    brandSystem,
    onPageChange,
    onValidationError,
    readOnly,
  }: {
    page: {
      id: string;
      type: string;
      title: Record<string, string | undefined>;
      sections: Array<{ id: string; component: string }>;
    };
    context: { activeLocale: string };
    brandSystem: { colors: { primary: string } };
    onPageChange: (page: unknown) => void;
    onValidationError: (message: string) => void;
    readOnly?: boolean;
  }) => (
    <section
      aria-label={readOnly ? "Proposal preview canvas" : "Visual editor canvas"}
      data-primary={brandSystem.colors.primary}
      lang={context.activeLocale}
    >
      Canvas: {page.type} / {context.activeLocale}
      {readOnly ? <span>Locked proposal</span> : null}
      {readOnly ? (
        <button
          onClick={() =>
            onPageChange({
              ...page,
              title: { ...page.title, [context.activeLocale]: "Newer canonical edit" },
            })
          }
          type="button"
        >
          Simulate newer canonical edit
        </button>
      ) : null}
      <button
        onClick={() =>
          onPageChange({
            ...page,
            title: {
              ...page.title,
              [context.activeLocale]:
                page.title[context.activeLocale] === `Edited ${page.type}`
                  ? `Edited again ${page.type}`
                  : `Edited ${page.type}`,
            },
          })
        }
        type="button"
      >
        Edit current page
      </button>
      <button onClick={() => onPageChange({ ...page, id: "!" })} type="button">
        Emit invalid canonical page
      </button>
      <button
        onClick={() =>
          onPageChange({
            ...page,
            sections: page.sections.map((section, index) =>
              index === 0 ? { ...section, id: "section_home_announcement" } : section,
            ),
          })
        }
        type="button"
      >
        Create cross-page duplicate
      </button>
      <button
        onClick={() => onValidationError("That change could not be applied safely.")}
        type="button"
      >
        Emit invalid change
      </button>
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

const statefulRepository = () => new InMemoryProjectRepository([aggregate()]);

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
    expect(screen.getByRole("button", { name: "Save draft" })).toBeDisabled();
    expect(screen.queryByRole("button", { name: /publish/i })).not.toBeInTheDocument();
  });

  it("shows navigation, draft status and the selected preview link", async () => {
    route(repository(() => Promise.resolve(aggregate())));
    await screen.findByText("Aurum Nordic");
    expect(screen.getByRole("navigation", { name: "Editor navigation" })).toBeVisible();
    expect(screen.getByLabelText("Draft status")).toHaveTextContent("No unsaved changes");
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

  it("keeps session dirty state separate from stored draft differences", async () => {
    const value = aggregate();
    const publishedBefore = structuredClone(value.snapshots[0]);
    const draft = value.snapshots.find((item) => item.id === value.project.draftSnapshotId)!;
    draft.pages.find((item) => item.type === "home")!.title.en = "Edited homepage";
    route(repository(() => Promise.resolve(value)));
    expect(await screen.findByLabelText("Draft status")).toHaveTextContent("No unsaved changes");
    expect(screen.getByLabelText("Draft status")).toHaveTextContent(
      "stored draft differs from the published storefront",
    );
    expect(value.snapshots[0]).toEqual(publishedBefore);
  });

  it("tracks canonical in-memory changes without repository writes", async () => {
    const repo = repository(() => Promise.resolve(aggregate()));
    route(repo);
    await screen.findByText("Canvas: home / en");
    expect(screen.getByLabelText("Draft status")).toHaveTextContent("No unsaved changes");
    fireEvent.click(screen.getByRole("button", { name: "Edit current page" }));
    expect(screen.getByRole("heading", { name: "Edited home" })).toBeVisible();
    expect(screen.getByLabelText("Draft status")).toHaveTextContent("Unsaved changes");
    expect(repo.saveDraft).not.toHaveBeenCalled();
    expect(repo.publish).not.toHaveBeenCalled();
  });

  it("confirms discard and restores the originally loaded page", async () => {
    const confirm = vi.spyOn(window, "confirm");
    route(repository(() => Promise.resolve(aggregate())));
    await screen.findByText("Canvas: home / en");
    fireEvent.click(screen.getByRole("button", { name: "Edit current page" }));
    confirm.mockReturnValueOnce(false);
    fireEvent.click(screen.getByRole("button", { name: "Discard changes" }));
    expect(screen.getByRole("heading", { name: "Edited home" })).toBeVisible();
    confirm.mockReturnValueOnce(true);
    fireEvent.click(screen.getByRole("button", { name: "Discard changes" }));
    expect(screen.getByRole("heading", { name: "Home" })).toBeVisible();
    expect(screen.getByLabelText("Draft status")).toHaveTextContent("No unsaved changes");
    expect(confirm).toHaveBeenCalledTimes(2);
    confirm.mockRestore();
  });

  it("warns before page switches and isolates each page's session edits", async () => {
    const confirm = vi.spyOn(window, "confirm");
    route(repository(() => Promise.resolve(aggregate())));
    await screen.findByText("Canvas: home / en");
    fireEvent.click(screen.getByRole("button", { name: "Edit current page" }));
    confirm.mockReturnValueOnce(false);
    fireEvent.change(screen.getByLabelText("Storefront page"), {
      target: { value: "page_collection_rings" },
    });
    expect(screen.getByText("Canvas: home / en")).toBeVisible();
    confirm.mockReturnValueOnce(true);
    fireEvent.change(screen.getByLabelText("Storefront page"), {
      target: { value: "page_collection_rings" },
    });
    expect(screen.getByText("Canvas: collection / en")).toBeVisible();
    expect(screen.getByLabelText("Draft status")).toHaveTextContent("Unsaved changes");
    fireEvent.change(screen.getByLabelText("Storefront page"), {
      target: { value: "page_home" },
    });
    expect(screen.getByRole("heading", { name: "Edited home" })).toBeVisible();
    expect(screen.getByLabelText("Draft status")).toHaveTextContent("Unsaved changes");
    confirm.mockRestore();
  });

  it("announces invalid changes while retaining the last valid page", async () => {
    route(repository(() => Promise.resolve(aggregate())));
    await screen.findByText("Canvas: home / en");
    fireEvent.click(screen.getByRole("button", { name: "Emit invalid change" }));
    expect(screen.getByRole("alert")).toHaveTextContent("could not be applied safely");
    expect(screen.getByRole("heading", { name: "Home" })).toBeVisible();
    expect(screen.getByLabelText("Draft status")).toHaveTextContent("No unsaved changes");
  });

  it("edits only the active Finnish locale in session state", async () => {
    route(repository(() => Promise.resolve(aggregate())));
    await screen.findByText("Canvas: home / en");
    fireEvent.click(screen.getByRole("radio", { name: "Suomi" }));
    fireEvent.click(screen.getByRole("button", { name: "Edit current page" }));
    expect(screen.getByRole("heading", { name: "Edited home" })).toBeVisible();
    fireEvent.click(screen.getByRole("radio", { name: "English" }));
    expect(screen.getByRole("heading", { name: "Home" })).toBeVisible();
    expect(screen.getByLabelText("Draft status")).toHaveTextContent("Unsaved changes");
  });

  it("previews a supported luxury proposal without mutating the active page", async () => {
    const repo = repository(() => Promise.resolve(aggregate()));
    route(repo);
    await screen.findByText("Canvas: home / en");
    fireEvent.click(screen.getByRole("button", { name: "Make the homepage feel more luxurious." }));
    fireEvent.click(screen.getByRole("button", { name: "Show proposal" }));
    expect(await screen.findByLabelText("Design proposal")).toBeVisible();
    expect(screen.getByLabelText("Proposal preview canvas")).toHaveTextContent("Locked proposal");
    expect(screen.getByText(/current page is unchanged/i)).toBeVisible();
    expect(screen.getByLabelText("Draft status")).toHaveTextContent("No unsaved changes");
    expect(repo.saveDraft).not.toHaveBeenCalled();
    expect(repo.publish).not.toHaveBeenCalled();
    expect(repo.restore).not.toHaveBeenCalled();
  });

  it("closes a proposal when its edited base is discarded and cannot restore discarded edits", async () => {
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(true);
    const repo = repository(() => Promise.resolve(aggregate()));
    route(repo);
    await screen.findByText("Canvas: home / en");
    fireEvent.click(screen.getByRole("button", { name: "Edit current page" }));
    expect(screen.getByRole("heading", { name: "Edited home" })).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Make the homepage feel more luxurious." }));
    fireEvent.click(screen.getByRole("button", { name: "Show proposal" }));
    await screen.findByLabelText("Design proposal");

    fireEvent.click(screen.getByRole("button", { name: "Discard changes" }));

    expect(screen.queryByLabelText("Design proposal")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Proposal preview canvas")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Accept proposal" })).not.toBeInTheDocument();
    expect(screen.getByLabelText("Visual editor canvas")).toBeVisible();
    expect(screen.getByRole("heading", { name: "Home" })).toBeVisible();
    expect(screen.getByLabelText("Draft status")).toHaveTextContent("No unsaved changes");
    expect(screen.getByText(/proposal was closed because the page changed/i)).toHaveAttribute(
      "role",
      "status",
    );
    expect(repo.saveDraft).not.toHaveBeenCalled();
    expect(repo.publish).not.toHaveBeenCalled();
    confirm.mockRestore();
  });

  it("invalidates a proposal after a newer canonical mutation and preserves that newer page", async () => {
    const repo = repository(() => Promise.resolve(aggregate()));
    route(repo);
    await screen.findByText("Canvas: home / en");
    fireEvent.click(screen.getByRole("button", { name: "Make the layout more minimal." }));
    fireEvent.click(screen.getByRole("button", { name: "Show proposal" }));
    await screen.findByLabelText("Design proposal");

    fireEvent.click(screen.getByRole("button", { name: "Simulate newer canonical edit" }));

    expect(screen.queryByLabelText("Design proposal")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Accept proposal" })).not.toBeInTheDocument();
    expect(screen.getByLabelText("Visual editor canvas")).toBeVisible();
    expect(screen.getByRole("heading", { name: "Newer canonical edit" })).toBeVisible();
    expect(screen.getByText(/create a new proposal to review the latest design/i)).toBeVisible();
    expect(repo.saveDraft).not.toHaveBeenCalled();
    expect(repo.publish).not.toHaveBeenCalled();
  });

  it("closes a homepage proposal on page switch and does not restore it on return", async () => {
    route(repository(() => Promise.resolve(aggregate())));
    await screen.findByText("Canvas: home / en");
    fireEvent.click(screen.getByRole("button", { name: "Make the homepage feel more luxurious." }));
    fireEvent.click(screen.getByRole("button", { name: "Show proposal" }));
    await screen.findByLabelText("Design proposal");

    fireEvent.change(screen.getByLabelText("Storefront page"), {
      target: { value: "page_collection_rings" },
    });
    expect(screen.getByText("Canvas: collection / en")).toBeVisible();
    expect(screen.queryByLabelText("Design proposal")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Proposal preview canvas")).not.toBeInTheDocument();
    expect(screen.getByText(/proposal was closed because you opened another page/i)).toBeVisible();

    fireEvent.change(screen.getByLabelText("Storefront page"), {
      target: { value: "page_home" },
    });
    expect(screen.getByText("Canvas: home / en")).toBeVisible();
    expect(screen.queryByLabelText("Design proposal")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Accept proposal" })).not.toBeInTheDocument();
    expect(screen.getByLabelText("Draft status")).toHaveTextContent("No unsaved changes");
  });

  it("keeps a canonically valid proposal open when only the locale changes", async () => {
    route(repository(() => Promise.resolve(aggregate())));
    await screen.findByText("Canvas: home / en");
    fireEvent.click(screen.getByRole("button", { name: "Add a campaign section." }));
    fireEvent.click(screen.getByRole("button", { name: "Show proposal" }));
    await screen.findByLabelText("Design proposal");

    fireEvent.click(screen.getByRole("radio", { name: "Suomi" }));

    expect(screen.getByLabelText("Design proposal")).toBeVisible();
    expect(screen.getByLabelText("Proposal preview canvas")).toHaveAttribute("lang", "fi");
    expect(screen.getByRole("heading", { name: /uusi kampanjaosio/i })).toBeVisible();
    expect(screen.getByRole("button", { name: "Accept proposal" })).toBeVisible();
  });

  it("accepts a campaign proposal into only the in-memory homepage", async () => {
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(true);
    const repo = repository(() => Promise.resolve(aggregate()));
    route(repo);
    await screen.findByText("Canvas: home / en");
    fireEvent.click(screen.getByRole("button", { name: "Add a campaign section." }));
    fireEvent.click(screen.getByRole("button", { name: "Show proposal" }));
    await screen.findByLabelText("Design proposal");
    fireEvent.click(screen.getByRole("button", { name: "Accept proposal" }));
    expect(screen.getByText(/homepage now has unsaved changes/i)).toBeVisible();
    expect(screen.getByLabelText("Draft status")).toHaveTextContent("Unsaved changes");
    expect(screen.getByLabelText("Visual editor canvas")).toBeVisible();
    expect(repo.saveDraft).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText("Storefront page"), {
      target: { value: "page_collection_rings" },
    });
    expect(screen.getByText("Canvas: collection / en")).toBeVisible();
    expect(screen.getByLabelText("Draft status")).toHaveTextContent("Unsaved changes");
    confirm.mockRestore();
  });

  it("rejects a proposal and preserves the exact current page", async () => {
    route(repository(() => Promise.resolve(aggregate())));
    await screen.findByText("Canvas: home / en");
    fireEvent.click(screen.getByRole("button", { name: "Make the layout more minimal." }));
    fireEvent.click(screen.getByRole("button", { name: "Show proposal" }));
    await screen.findByLabelText("Design proposal");
    fireEvent.click(screen.getByRole("button", { name: "Reject proposal" }));
    expect(screen.getByText(/remains exactly as it was/i)).toBeVisible();
    expect(screen.getByLabelText("Draft status")).toHaveTextContent("No unsaved changes");
    expect(screen.getByRole("heading", { name: "Home" })).toBeVisible();
  });

  it("shows unsupported and invalid requests without changing the page", async () => {
    route(repository(() => Promise.resolve(aggregate())));
    await screen.findByText("Canvas: home / en");
    fireEvent.change(screen.getByLabelText("Your request"), { target: { value: "Add fireworks" } });
    fireEvent.click(screen.getByRole("button", { name: "Show proposal" }));
    expect(await screen.findByText(/not available in this demo/i)).toBeVisible();
    expect(screen.getByLabelText("Draft status")).toHaveTextContent("No unsaved changes");

    fireEvent.change(screen.getByLabelText("Storefront page"), {
      target: { value: "page_collection_rings" },
    });
    fireEvent.change(screen.getByLabelText("Your request"), {
      target: { value: "Make the homepage feel more luxurious." },
    });
    fireEvent.click(screen.getByRole("button", { name: "Show proposal" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      /only be previewed on the homepage/i,
    );
    expect(screen.getByLabelText("Draft status")).toHaveTextContent("No unsaved changes");
  });

  it("switches proposal summary and ordered changes between English and Finnish", async () => {
    route(repository(() => Promise.resolve(aggregate())));
    await screen.findByText("Canvas: home / en");
    fireEvent.click(screen.getByRole("button", { name: "Add a campaign section." }));
    fireEvent.click(screen.getByRole("button", { name: "Show proposal" }));
    expect(await screen.findByRole("heading", { name: /new campaign section/i })).toBeVisible();
    expect(screen.getByText("Add a campaign section", { exact: true })).toBeVisible();
    fireEvent.click(screen.getByRole("radio", { name: "Suomi" }));
    expect(screen.getByRole("heading", { name: /uusi kampanjaosio/i })).toBeVisible();
    expect(screen.getByText("Lisää kampanjaosio", { exact: true })).toBeVisible();
  });

  it("saves a valid manual edit, clears dirty state and preserves locale and published state", async () => {
    const value = statefulRepository();
    const before = await value.get(aurumNordicSeed.project.id);
    route(value);
    await screen.findByText("Canvas: home / en");
    fireEvent.click(screen.getByRole("radio", { name: "Suomi" }));
    fireEvent.click(screen.getByRole("button", { name: "Edit current page" }));
    const save = screen.getByRole("button", { name: "Save draft" });
    expect(save).toBeEnabled();
    fireEvent.click(save);

    expect(await screen.findByText("Draft saved successfully.")).toHaveAttribute("role", "status");
    expect(screen.getByLabelText("Draft status")).toHaveTextContent("No unsaved changes");
    expect(screen.getByRole("radio", { name: "Suomi" })).toBeChecked();
    expect(screen.getByText("Canvas: home / fi")).toBeVisible();
    const after = await value.get(aurumNordicSeed.project.id);
    expect(after.project.publishedSnapshotId).toBe(before.project.publishedSnapshotId);
    expect(
      after.snapshots.find((snapshot) => snapshot.id === before.project.publishedSnapshotId),
    ).toEqual(
      before.snapshots.find((snapshot) => snapshot.id === before.project.publishedSnapshotId),
    );
  });

  it("saves multiple session pages and preserves the untouched product page", async () => {
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(true);
    const value = statefulRepository();
    const before = await value.get(aurumNordicSeed.project.id);
    const untouchedProduct = structuredClone(
      before.snapshots
        .find((snapshot) => snapshot.id === before.project.draftSnapshotId)!
        .pages.find((page) => page.type === "product"),
    );
    route(value);
    await screen.findByText("Canvas: home / en");
    fireEvent.click(screen.getByRole("button", { name: "Edit current page" }));
    fireEvent.change(screen.getByLabelText("Storefront page"), {
      target: { value: "page_collection_rings" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Edit current page" }));
    fireEvent.click(screen.getByRole("button", { name: "Save draft" }));
    await screen.findByText("Draft saved successfully.");

    const after = await value.get(aurumNordicSeed.project.id);
    const saved = after.snapshots.find(
      (snapshot) => snapshot.id === after.project.draftSnapshotId,
    )!;
    expect(saved.pages.find((page) => page.type === "home")?.title.en).toBe("Edited home");
    expect(saved.pages.find((page) => page.type === "collection")?.title.en).toBe(
      "Edited collection",
    );
    expect(saved.pages.find((page) => page.type === "product")).toEqual(untouchedProduct);
    confirm.mockRestore();
  });

  it("persists an accepted proposal through the same canonical save path", async () => {
    const value = statefulRepository();
    route(value);
    await screen.findByText("Canvas: home / en");
    fireEvent.click(screen.getByRole("button", { name: "Add a campaign section." }));
    fireEvent.click(screen.getByRole("button", { name: "Show proposal" }));
    await screen.findByLabelText("Design proposal");
    expect(screen.getByRole("button", { name: "Save draft" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Accept proposal" }));
    fireEvent.click(screen.getByRole("button", { name: "Save draft" }));
    await screen.findByText("Draft saved successfully.");

    const after = await value.get(aurumNordicSeed.project.id);
    const saved = after.snapshots.find(
      (snapshot) => snapshot.id === after.project.draftSnapshotId,
    )!;
    expect(saved.pages.find((page) => page.type === "home")?.sections).toHaveLength(11);
  });

  it("treats edits after save as new work and discards to the latest saved baseline", async () => {
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(true);
    const value = statefulRepository();
    route(value);
    await screen.findByText("Canvas: home / en");
    fireEvent.click(screen.getByRole("button", { name: "Edit current page" }));
    fireEvent.click(screen.getByRole("button", { name: "Save draft" }));
    await screen.findByText("Draft saved successfully.");
    fireEvent.click(screen.getByRole("button", { name: "Edit current page" }));
    expect(screen.getByRole("heading", { name: "Edited again home" })).toBeVisible();
    expect(screen.getByLabelText("Draft status")).toHaveTextContent("Unsaved changes");
    fireEvent.click(screen.getByRole("button", { name: "Discard changes" }));
    expect(screen.getByRole("heading", { name: "Edited home" })).toBeVisible();
    expect(screen.getByLabelText("Draft status")).toHaveTextContent("No unsaved changes");
    confirm.mockRestore();
  });

  it("blocks saving invalid page and complete-snapshot states", async () => {
    route(statefulRepository());
    await screen.findByText("Canvas: home / en");
    fireEvent.click(screen.getByRole("button", { name: "Emit invalid canonical page" }));
    expect(screen.getByRole("button", { name: "Save draft" })).toBeDisabled();
    expect(screen.getByText(/page change is not valid yet/i)).toHaveAttribute("role", "alert");

    fireEvent.change(screen.getByLabelText("Storefront page"), {
      target: { value: "page_collection_rings" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Create cross-page duplicate" }));
    expect(screen.getByLabelText("Draft status")).toHaveTextContent("Unsaved changes");
    expect(screen.getByRole("button", { name: "Save draft" })).toBeDisabled();
    expect(
      screen.getByText(/changes need attention before this draft can be saved/i),
    ).toHaveAttribute("role", "alert");
  });

  it("keeps dirty work after storage and stale failures and allows a successful retry", async () => {
    const inner = statefulRepository();
    let failSave = true;
    const value: ProjectRepository = {
      list: () => inner.list(),
      get: (id) => inner.get(id),
      saveDraft: (id, snapshot, expected) =>
        failSave
          ? Promise.reject(new Error("storage unavailable"))
          : inner.saveDraft(id, snapshot, expected),
      publish: (id, revision) => inner.publish(id, revision),
      restore: (id, snapshotId) => inner.restore(id, snapshotId),
    };
    route(value);
    await screen.findByText("Canvas: home / en");
    fireEvent.click(screen.getByRole("button", { name: "Edit current page" }));
    fireEvent.click(screen.getByRole("button", { name: "Save draft" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/could not be saved/i);
    expect(screen.getByLabelText("Draft status")).toHaveTextContent("Unsaved changes");
    expect(screen.getByRole("heading", { name: "Edited home" })).toBeVisible();
    failSave = false;
    fireEvent.click(screen.getByRole("button", { name: "Save draft" }));
    await screen.findByText("Draft saved successfully.");
    expect(screen.getByLabelText("Draft status")).toHaveTextContent("No unsaved changes");
  });

  it("refuses a stale save while keeping the editor work dirty", async () => {
    const value = statefulRepository();
    route(value);
    await screen.findByText("Canvas: home / en");
    fireEvent.click(screen.getByRole("button", { name: "Edit current page" }));
    const newer = structuredClone(aurumNordicSeed.draftSnapshot);
    newer.id = "snapshot_external_newer";
    newer.pages[0].title.en = "External newer home";
    await value.saveDraft(aurumNordicSeed.project.id, newer);
    fireEvent.click(screen.getByRole("button", { name: "Save draft" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/newer draft was saved elsewhere/i);
    expect(screen.getByLabelText("Draft status")).toHaveTextContent("Unsaved changes");
    expect(screen.getByRole("heading", { name: "Edited home" })).toBeVisible();
    const after = await value.get(aurumNordicSeed.project.id);
    expect(after.project.draftSnapshotId).toBe(newer.id);
  });

  it("announces saving and disables save during generation and persistence", async () => {
    const inner = statefulRepository();
    let releaseSave!: () => void;
    const gate = new Promise<void>((resolve) => {
      releaseSave = resolve;
    });
    const value: ProjectRepository = {
      list: () => inner.list(),
      get: (id) => inner.get(id),
      saveDraft: async (id, snapshot, expected) => {
        await gate;
        return inner.saveDraft(id, snapshot, expected);
      },
      publish: (id, revision) => inner.publish(id, revision),
      restore: (id, snapshotId) => inner.restore(id, snapshotId),
    };
    route(value);
    await screen.findByText("Canvas: home / en");
    fireEvent.click(screen.getByRole("button", { name: "Edit current page" }));
    fireEvent.click(screen.getByRole("button", { name: "Make the homepage feel more luxurious." }));
    fireEvent.click(screen.getByRole("button", { name: "Show proposal" }));
    expect(screen.getByRole("button", { name: /save draft/i })).toBeDisabled();
    await screen.findByLabelText("Design proposal");
    fireEvent.click(screen.getByRole("button", { name: "Reject proposal" }));
    fireEvent.click(screen.getByRole("button", { name: "Save draft" }));
    expect(await screen.findByText("Saving your draft…")).toHaveAttribute("role", "status");
    expect(screen.getByRole("button", { name: "Saving draft…" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Edit current page" }));
    releaseSave();
    await screen.findByText("Draft saved successfully.");
    expect(screen.getByRole("heading", { name: "Edited again home" })).toBeVisible();
    expect(screen.getByLabelText("Draft status")).toHaveTextContent("Unsaved changes");
  });
});
