import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { PublishClient } from "@/app/projects/[projectId]/publish/publish-client";
import { aurumNordicSeed } from "@/data/seed";
import {
  InMemoryProjectRepository,
  type ProjectAggregate,
  type ProjectRepository,
} from "@/services/storage";

const projectId = aurumNordicSeed.project.id;

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

function repository() {
  return new InMemoryProjectRepository([aggregate()]);
}

async function saveDraftTitle(value: InMemoryProjectRepository, title: string) {
  const current = await value.get(projectId);
  const draft = structuredClone(
    current.snapshots.find((snapshot) => snapshot.id === current.project.draftSnapshotId)!,
  );
  draft.id = `snapshot_publish_route_${title.toLowerCase().replaceAll(" ", "_")}`;
  draft.createdAt = new Date(Date.parse(draft.createdAt) + 1_000).toISOString();
  draft.pages[0].title.en = title;
  await value.saveDraft(projectId, draft, {
    id: current.project.draftSnapshotId,
    revision: draft.revision,
  });
}

function route(value: ProjectRepository) {
  return render(<PublishClient projectId={projectId} repositoryFactory={() => value} />);
}

function forward(
  inner: ProjectRepository,
  overrides: Partial<ProjectRepository> = {},
): ProjectRepository {
  return {
    list: () => inner.list(),
    get: (id) => inner.get(id),
    saveDraft: (id, snapshot, expected) => inner.saveDraft(id, snapshot, expected),
    publish: (id, expectation) => inner.publish(id, expectation),
    restore: (id, snapshotId) => inner.restore(id, snapshotId),
    ...overrides,
  };
}

describe("P2-12 publish confirmation route", () => {
  it("loads without publishing", async () => {
    const get = vi.fn(() => Promise.resolve(aggregate()));
    const publish = vi.fn();
    route(forward(repository(), { get, publish }));

    expect(screen.getByRole("heading", { name: "Loading publishing review" })).toBeVisible();
    expect(await screen.findByRole("heading", { name: "Publish storefront" })).toBeVisible();
    expect(publish).not.toHaveBeenCalled();
  });

  it("reviews only saved draft content without writing", async () => {
    const value = repository();
    await saveDraftTitle(value, "Saved only draft");
    const before = await value.get(projectId);
    const publish = vi.spyOn(value, "publish");
    route(value);

    fireEvent.click(await screen.findByRole("button", { name: "Review publish" }));

    expect(await screen.findByText("Saved only draft")).toBeVisible();
    expect(screen.getByRole("heading", { name: "Confirm publication" })).toBeVisible();
    expect(publish).not.toHaveBeenCalled();
    expect(await value.get(projectId)).toEqual(before);
  });

  it("blocks confirmation when the saved draft has no changes", async () => {
    const value = repository();
    const publish = vi.spyOn(value, "publish");
    route(value);
    fireEvent.click(await screen.findByRole("button", { name: "Review publish" }));

    expect(
      await screen.findByRole("heading", { name: "No saved changes to publish" }),
    ).toBeVisible();
    expect(screen.queryByRole("button", { name: "Publish storefront" })).not.toBeInTheDocument();
    expect(publish).not.toHaveBeenCalled();
  });

  it("publishes the exact reviewed saved draft and exposes success links", async () => {
    const value = repository();
    await saveDraftTitle(value, "Exact prepared draft");
    const before = await value.get(projectId);
    route(value);
    fireEvent.click(await screen.findByRole("button", { name: "Review publish" }));
    await screen.findByRole("heading", { name: "Confirm publication" });
    fireEvent.click(screen.getByRole("button", { name: "Publish storefront" }));

    expect(
      await screen.findByRole("heading", { name: "Storefront published successfully" }),
    ).toBeVisible();
    const after = await value.get(projectId);
    const published = after.snapshots.find(
      (snapshot) => snapshot.id === after.project.publishedSnapshotId,
    )!;
    expect(published.pages[0].title.en).toBe("Exact prepared draft");
    expect(after.project.revision).toBe(before.project.revision + 1);
    expect(
      screen.getByText(`Your storefront is now published as revision ${after.project.revision}.`),
    ).toBeVisible();
    expect(screen.getByRole("link", { name: "View published storefront" })).toHaveAttribute(
      "href",
      `/projects/${projectId}/published`,
    );
  });

  it("does not publish when confirmation is cancelled", async () => {
    const value = repository();
    await saveDraftTitle(value, "Cancelled review");
    const publish = vi.spyOn(value, "publish");
    route(value);
    fireEvent.click(await screen.findByRole("button", { name: "Review publish" }));
    await screen.findByRole("heading", { name: "Confirm publication" });
    fireEvent.click(screen.getByRole("button", { name: "Cancel and return to editor" }));

    expect(screen.getByRole("button", { name: "Review publish" })).toBeVisible();
    expect(publish).not.toHaveBeenCalled();
  });

  it("blocks a stale confirmation and lets the merchant review the latest saved draft", async () => {
    const inner = repository();
    await saveDraftTitle(inner, "Initial review");
    let staleOnce = true;
    const value = forward(inner, {
      publish: async (id, expectation) => {
        if (staleOnce) {
          staleOnce = false;
          const current = await inner.get(id);
          const currentDraft = current.snapshots.find(
            (snapshot) => snapshot.id === current.project.draftSnapshotId,
          )!;
          const newer = structuredClone(currentDraft);
          newer.id = "snapshot_publish_route_newer_saved_draft";
          newer.createdAt = new Date(Date.parse(newer.createdAt) + 1_000).toISOString();
          newer.pages[0].title.en = "Newer saved draft";
          await inner.saveDraft(id, newer, {
            id: currentDraft.id,
            revision: currentDraft.revision,
          });
        }
        return inner.publish(id, expectation);
      },
    });
    route(value);
    fireEvent.click(await screen.findByRole("button", { name: "Review publish" }));
    await screen.findByRole("heading", { name: "Confirm publication" });
    fireEvent.click(screen.getByRole("button", { name: "Publish storefront" }));

    expect(await screen.findByText(/changed after your review/i)).toBeVisible();
    expect(
      screen.queryByRole("heading", { name: "Storefront published successfully" }),
    ).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Review latest draft" }));
    expect(await screen.findByText("Newer saved draft")).toBeVisible();
    expect(screen.getByRole("heading", { name: "Confirm publication" })).toBeVisible();
  });

  it("prevents duplicate confirmation while publication is pending", async () => {
    const inner = repository();
    await saveDraftTitle(inner, "Pending publication");
    let resolvePublish: ((aggregate: ProjectAggregate) => void) | undefined;
    let expectation: Parameters<ProjectRepository["publish"]>[1] | undefined;
    const publish = vi.fn(
      (_id: string, nextExpectation: Parameters<ProjectRepository["publish"]>[1]) =>
        new Promise<ProjectAggregate>((resolve) => {
          expectation = nextExpectation;
          resolvePublish = resolve;
        }),
    );
    const value = forward(inner, { publish });
    route(value);
    fireEvent.click(await screen.findByRole("button", { name: "Review publish" }));
    await screen.findByRole("heading", { name: "Confirm publication" });
    const publishButton = screen.getByRole("button", { name: "Publish storefront" });
    fireEvent.click(publishButton);
    fireEvent.click(publishButton);

    await waitFor(() => expect(publish).toHaveBeenCalledTimes(1));
    expect(screen.getByRole("button", { name: "Publishing storefront…" })).toBeDisabled();
    resolvePublish?.(await inner.publish(projectId, expectation!));
  });

  it("uses Finnish merchant copy and hides repository details in controlled failures", async () => {
    const finnish = aggregate();
    finnish.project.primaryLocale = "fi";
    const first = route(forward(repository(), { get: () => Promise.resolve(finnish) }));
    expect(await screen.findByRole("heading", { name: "Julkaise verkkokauppa" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Tarkista julkaisu" })).toBeVisible();
    first.unmount();

    route(
      forward(repository(), { get: () => Promise.reject(new Error("IndexedDB stack detail")) }),
    );
    expect(await screen.findByRole("heading", { name: "Publishing is unavailable" })).toBeVisible();
    expect(screen.queryByText(/indexeddb stack detail/i)).not.toBeInTheDocument();
  });

  it("presents preparation and publish failures safely without retrying automatically", async () => {
    const get = vi
      .fn<ProjectRepository["get"]>()
      .mockResolvedValueOnce(aggregate())
      .mockRejectedValueOnce(new Error("preparation stack detail"));
    const preparationFailure = forward(repository(), { get });
    const first = route(preparationFailure);
    fireEvent.click(await screen.findByRole("button", { name: "Review publish" }));
    expect(await screen.findByText(/could not be reviewed for publishing/i)).toBeVisible();
    expect(screen.queryByText(/preparation stack detail/i)).not.toBeInTheDocument();
    first.unmount();

    const value = repository();
    await saveDraftTitle(value, "Publish failure");
    route(forward(value, { publish: () => Promise.reject(new Error("publish stack detail")) }));
    fireEvent.click(await screen.findByRole("button", { name: "Review publish" }));
    await screen.findByRole("heading", { name: "Confirm publication" });
    fireEvent.click(screen.getByRole("button", { name: "Publish storefront" }));
    expect(await screen.findByText(/could not be confirmed safely/i)).toBeVisible();
    expect(screen.queryByText(/publish stack detail/i)).not.toBeInTheDocument();
  });
});
