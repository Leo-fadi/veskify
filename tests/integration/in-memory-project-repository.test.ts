import { expect, it } from "vitest";
import { aurumNordicSeed } from "@/data/seed";
import { createAurumNordicProjectRepository, InMemoryProjectRepository } from "@/services/storage";
import { runProjectRepositoryContract } from "./project-repository.contract";

runProjectRepositoryContract("InMemoryProjectRepository", () =>
  createAurumNordicProjectRepository(),
);

it("preserves unknown seeded snapshots while pruning only managed drafts", async () => {
  const unknownLegacy = structuredClone(aurumNordicSeed.draftSnapshot);
  unknownLegacy.id = "snapshot_unknown_legacy";
  unknownLegacy.createdAt = "2025-01-01T00:00:00.000Z";
  const repository = new InMemoryProjectRepository([
    {
      project: structuredClone(aurumNordicSeed.project),
      catalogue: structuredClone(aurumNordicSeed.catalogue),
      snapshots: [
        structuredClone(aurumNordicSeed.publishedSnapshot),
        structuredClone(aurumNordicSeed.draftSnapshot),
        unknownLegacy,
      ],
    },
  ]);

  for (let index = 1; index <= 25; index += 1) {
    const current = await repository.get(aurumNordicSeed.project.id);
    const currentDraft = current.snapshots.find(
      (snapshot) => snapshot.id === current.project.draftSnapshotId,
    )!;
    const candidate = structuredClone(currentDraft);
    candidate.id = `snapshot_managed_with_legacy_${index}`;
    candidate.createdAt = new Date(Date.parse(currentDraft.createdAt) + 1_000).toISOString();
    await repository.saveDraft(aurumNordicSeed.project.id, candidate, {
      id: currentDraft.id,
      revision: currentDraft.revision,
    });
  }

  const after = await repository.get(aurumNordicSeed.project.id);
  expect(after.snapshots).toHaveLength(20);
  expect(after.snapshots.map(({ id }) => id)).toContain(unknownLegacy.id);
  expect(after.snapshots.map(({ id }) => id)).toContain(aurumNordicSeed.publishedSnapshot.id);
});
