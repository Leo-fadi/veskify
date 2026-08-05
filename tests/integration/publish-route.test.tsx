import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { PublishClient } from "@/app/projects/[projectId]/publish/publish-client";
import {
  AuthoritativeMerchantPublishClientError,
  type MerchantPublishGatewayClient,
} from "@/app/projects/[projectId]/publish/authoritative-publish-client";
import { confirmPublish, preparePublish } from "@/application/publishing";
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

function gatewayFor(source: ProjectRepository): MerchantPublishGatewayClient {
  const preparations = new Map<string, Awaited<ReturnType<typeof preparePublish>>>();
  return {
    prepare: vi.fn(
      async ({
        projectId: requestedProjectId,
      }: Parameters<MerchantPublishGatewayClient["prepare"]>[0]) => {
        const preparation = await preparePublish(requestedProjectId, source);
        preparations.set(preparation.preparationId, preparation);
        return preparation;
      },
    ),
    confirm: vi.fn(
      async ({ preparationId }: Parameters<MerchantPublishGatewayClient["confirm"]>[0]) => {
        const preparation = preparations.get(preparationId);
        if (!preparation)
          throw new AuthoritativeMerchantPublishClientError("missing-preparation", 409);
        const result = await confirmPublish(preparation, source);
        return { projectRevision: result.aggregate.project.revision };
      },
    ),
  };
}

function route(
  value: ProjectRepository,
  gateway: MerchantPublishGatewayClient = gatewayFor(value),
) {
  return render(
    <PublishClient
      projectId={projectId}
      publishGateway={gateway}
      repositoryFactory={() => value}
    />,
  );
}

function forward(
  inner: ProjectRepository,
  overrides: Partial<ProjectRepository> = {},
): ProjectRepository {
  return {
    list: () => inner.list(),
    get: (id) => inner.get(id),
    create: (aggregate) => inner.create(aggregate),
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
    expect(screen.getByRole("link", { name: "Version history" })).toHaveAttribute(
      "href",
      `/projects/${projectId}/history`,
    );
    expect(publish).not.toHaveBeenCalled();
  });

  it("reviews only saved draft content without writing", async () => {
    const source = repository();
    await saveDraftTitle(source, "Saved only draft");
    const before = await source.get(projectId);
    const browserPublish = vi.fn();
    const reader = forward(source, { publish: browserPublish });
    const gateway = gatewayFor(source);
    route(reader, gateway);

    fireEvent.click(await screen.findByRole("button", { name: "Review publish" }));

    expect(await screen.findByText("Saved only draft")).toBeVisible();
    expect(screen.getByRole("heading", { name: "Confirm publication" })).toBeVisible();
    expect(gateway.prepare).toHaveBeenCalledTimes(1);
    expect(browserPublish).not.toHaveBeenCalled();
    expect(await source.get(projectId)).toEqual(before);
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
    const source = repository();
    await saveDraftTitle(source, "Exact prepared draft");
    const before = await source.get(projectId);
    const browserPublish = vi.fn();
    const gateway = gatewayFor(source);
    route(forward(source, { publish: browserPublish }), gateway);
    fireEvent.click(await screen.findByRole("button", { name: "Review publish" }));
    await screen.findByRole("heading", { name: "Confirm publication" });
    fireEvent.click(screen.getByRole("button", { name: "Publish storefront" }));

    expect(
      await screen.findByRole("heading", { name: "Storefront published successfully" }),
    ).toBeVisible();
    expect(gateway.confirm).toHaveBeenCalledTimes(1);
    expect(browserPublish).not.toHaveBeenCalled();
    const after = await source.get(projectId);
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
    expect(screen.getByRole("link", { name: "Version history" })).toHaveAttribute(
      "href",
      `/projects/${projectId}/history`,
    );
  });

  it("does not publish and links back to the editor when confirmation is cancelled", async () => {
    const value = repository();
    await saveDraftTitle(value, "Cancelled review");
    const publish = vi.spyOn(value, "publish");
    route(value);
    fireEvent.click(await screen.findByRole("button", { name: "Review publish" }));
    await screen.findByRole("heading", { name: "Confirm publication" });
    expect(screen.getByRole("link", { name: "Cancel and return to editor" })).toHaveAttribute(
      "href",
      `/projects/${projectId}/editor`,
    );

    expect(publish).not.toHaveBeenCalled();
  });

  it("blocks a stale confirmation and lets the merchant review the latest saved draft", async () => {
    const source = repository();
    await saveDraftTitle(source, "Initial review");
    let staleOnce = true;
    const baseGateway = gatewayFor(source);
    const gateway: MerchantPublishGatewayClient = {
      ...baseGateway,
      confirm: vi.fn(async (input: Parameters<MerchantPublishGatewayClient["confirm"]>[0]) => {
        if (staleOnce) {
          staleOnce = false;
          const current = await source.get(input.projectId);
          const currentDraft = current.snapshots.find(
            (snapshot) => snapshot.id === current.project.draftSnapshotId,
          )!;
          const newer = structuredClone(currentDraft);
          newer.id = "snapshot_publish_route_newer_saved_draft";
          newer.createdAt = new Date(Date.parse(newer.createdAt) + 1_000).toISOString();
          newer.pages[0].title.en = "Newer saved draft";
          await source.saveDraft(input.projectId, newer, {
            id: currentDraft.id,
            revision: currentDraft.revision,
          });
        }
        throw new AuthoritativeMerchantPublishClientError("savedDraftMismatch", 409);
      }),
    };
    route(forward(source, { publish: vi.fn() }), gateway);
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
    const source = repository();
    await saveDraftTitle(source, "Pending publication");
    const baseGateway = gatewayFor(source);
    let resolveConfirmation: ((value: { projectRevision: number }) => void) | undefined;
    const gateway: MerchantPublishGatewayClient = {
      ...baseGateway,
      confirm: vi.fn(
        () =>
          new Promise<{ projectRevision: number }>((resolve) => {
            resolveConfirmation = resolve;
          }),
      ),
    };
    route(forward(source, { publish: vi.fn() }), gateway);
    fireEvent.click(await screen.findByRole("button", { name: "Review publish" }));
    await screen.findByRole("heading", { name: "Confirm publication" });
    const publishButton = screen.getByRole("button", { name: "Publish storefront" });
    fireEvent.click(publishButton);
    fireEvent.click(publishButton);

    await waitFor(() => expect(gateway.confirm).toHaveBeenCalledTimes(1));
    expect(screen.getByRole("button", { name: "Publishing storefront…" })).toBeDisabled();
    resolveConfirmation?.({ projectRevision: 3 });
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
    const preparationFailure: MerchantPublishGatewayClient = {
      prepare: vi.fn(() =>
        Promise.reject(new AuthoritativeMerchantPublishClientError("invalid-request", 400)),
      ),
      confirm: vi.fn(),
    };
    const first = route(repository(), preparationFailure);
    fireEvent.click(await screen.findByRole("button", { name: "Review publish" }));
    expect(await screen.findByText(/could not be reviewed for publishing/i)).toBeVisible();
    expect(screen.queryByText(/preparation stack detail/i)).not.toBeInTheDocument();
    first.unmount();

    const value = repository();
    await saveDraftTitle(value, "Publish failure");
    const failingGateway: MerchantPublishGatewayClient = {
      ...gatewayFor(value),
      confirm: vi.fn(() =>
        Promise.reject(new AuthoritativeMerchantPublishClientError("savedDraftMismatch", 409)),
      ),
    };
    route(forward(value, { publish: vi.fn() }), failingGateway);
    fireEvent.click(await screen.findByRole("button", { name: "Review publish" }));
    await screen.findByRole("heading", { name: "Confirm publication" });
    fireEvent.click(screen.getByRole("button", { name: "Publish storefront" }));
    expect(await screen.findByText(/changed after your review/i)).toBeVisible();
    expect(screen.queryByText(/publish stack detail/i)).not.toBeInTheDocument();
  });
});
