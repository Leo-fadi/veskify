import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { HistoryClient } from "@/app/projects/[projectId]/history/history-client";
import { aurumNordicSeed } from "@/data/seed";
import { canonicalStorefrontContentFingerprint } from "@/domain/storefront";
import { InMemoryProjectRepository, type ProjectAggregate } from "@/services/storage";

const projectId = aurumNordicSeed.project.id;

function aggregate(primaryLocale: "en" | "fi" = "en"): ProjectAggregate {
  return {
    project: { ...structuredClone(aurumNordicSeed.project), primaryLocale },
    catalogue: structuredClone(aurumNordicSeed.catalogue),
    snapshots: [
      structuredClone(aurumNordicSeed.publishedSnapshot),
      structuredClone(aurumNordicSeed.draftSnapshot),
    ],
  };
}

async function publishChangedDraft(repository: InMemoryProjectRepository) {
  const before = await repository.get(projectId);
  const draft = structuredClone(
    before.snapshots.find(({ id }) => id === before.project.draftSnapshotId)!,
  );
  draft.id = "snapshot_history_route_publishable";
  draft.createdAt = new Date(Date.parse(draft.createdAt) + 1_000).toISOString();
  draft.pages[0].title.en = "History metadata draft";
  await repository.saveDraft(projectId, draft, {
    id: before.project.draftSnapshotId,
    revision: draft.revision,
  });
  const saved = await repository.get(projectId);
  const published = saved.snapshots.find(({ id }) => id === saved.project.publishedSnapshotId)!;
  await repository.publish(projectId, {
    projectRevision: saved.project.revision,
    draft: {
      id: draft.id,
      revision: draft.revision,
      contentFingerprint: canonicalStorefrontContentFingerprint(draft),
    },
    published: {
      id: published.id,
      revision: published.revision,
      contentFingerprint: canonicalStorefrontContentFingerprint(published),
    },
  });
}

describe("P2-14 history route", () => {
  it("shows explicit legacy fallback details without inventing history", async () => {
    const repository = new InMemoryProjectRepository([aggregate()]);
    render(<HistoryClient projectId={projectId} repositoryFactory={() => repository} />);

    expect(await screen.findAllByText("Previous version")).toHaveLength(2);
    expect(screen.getAllByText("Details unavailable for this older version.")).toHaveLength(2);
  });

  it("shows persisted publish reasons and summaries in English", async () => {
    const repository = new InMemoryProjectRepository([aggregate()]);
    await publishChangedDraft(repository);
    render(<HistoryClient projectId={projectId} repositoryFactory={() => repository} />);

    expect(await screen.findByText("Storefront published")).toBeVisible();
    expect(screen.getByText("Saved storefront changes were published.")).toBeVisible();
    expect(screen.getByText("Draft synchronized after publishing")).toBeVisible();
  });

  it("shows persisted restore reasons and summaries in Finnish", async () => {
    const repository = new InMemoryProjectRepository([aggregate("fi")]);
    await repository.restore(projectId, aurumNordicSeed.publishedSnapshot.id);
    render(<HistoryClient projectId={projectId} repositoryFactory={() => repository} />);

    expect(await screen.findByText("Palautettu tallennetuksi luonnokseksi")).toBeVisible();
    expect(
      screen.getByText(
        "Verkkokaupan aiempi versio palautettiin uudeksi tallennetuksi luonnokseksi.",
      ),
    ).toBeVisible();
  });
});
