import { describe, expect, it } from "vitest";
import { createApprovedStorefrontProject } from "@/application/approved-storefront-project";
import type { ApprovedStorefrontProjectError } from "@/application/approved-storefront-project";
import { createInitialProjectAggregate } from "@/application/initial-project-aggregate";
import { InMemoryProjectRepository } from "@/services/storage";
import type { ProjectAggregate } from "@/services/storage";
import { initialAggregateFixture } from "../helpers/initial-project-aggregate";

class CountingRepository extends InMemoryProjectRepository {
  createCalls = 0;
  lastAggregate?: ProjectAggregate;

  override async create(input: ProjectAggregate): Promise<ProjectAggregate> {
    this.createCalls += 1;
    this.lastAggregate = structuredClone(input);
    return super.create(input);
  }
}

class FailingRepository extends InMemoryProjectRepository {
  override async create(): Promise<ProjectAggregate> {
    await Promise.resolve();
    throw new Error("storage unavailable");
  }
}

function expectError(
  promise: Promise<unknown>,
  code: ApprovedStorefrontProjectError["code"],
): Promise<void> {
  return expect(promise).rejects.toMatchObject({
    name: "ApprovedStorefrontProjectError",
    code,
  });
}

describe("createApprovedStorefrontProject", () => {
  it("creates one exact, initially unpublished aggregate and returns its IDs", async () => {
    const input = initialAggregateFixture({ suffix: "approved" });
    const expected = createInitialProjectAggregate(input);
    const repository = new CountingRepository([]);

    const result = await createApprovedStorefrontProject({ ...input, repository });
    const persisted = await repository.get(expected.project.id);

    expect(repository.createCalls).toBe(1);
    expect(repository.lastAggregate).toEqual(expected);
    expect(persisted).toEqual(expected);
    expect(persisted.project.revision).toBe(0);
    expect(result).toEqual({
      projectId: expected.project.id,
      editorRoute: `/projects/${expected.project.id}/editor`,
      draftSnapshotId: expected.project.draftSnapshotId,
      publishedSnapshotId: expected.project.publishedSnapshotId,
    });
    expect(Object.isFrozen(result)).toBe(true);
  });

  it("rejects a modified or stale review before repository.create", async () => {
    const input = initialAggregateFixture({ suffix: "stale-review" });
    const review = structuredClone(input.review);
    review.summary.en = "A stale merchant review";
    const repository = new CountingRepository([]);

    await expectError(
      createApprovedStorefrontProject({ ...input, review, repository }),
      "inconsistent-generation-review",
    );
    expect(repository.createCalls).toBe(0);
    await expect(repository.list()).resolves.toEqual([]);
  });

  it("rejects an exact review that is not ready before persistence", async () => {
    const input = initialAggregateFixture({ suffix: "not-ready", catalogueContext: null });
    const repository = new CountingRepository([]);

    await expectError(
      createApprovedStorefrontProject({ ...input, repository }),
      "review-not-ready",
    );
    expect(repository.createCalls).toBe(0);
    await expect(repository.list()).resolves.toEqual([]);
  });

  it("maps factory and repository failures to stable application errors", async () => {
    const input = initialAggregateFixture({ suffix: "factory-error" });
    await expectError(
      createApprovedStorefrontProject({
        ...input,
        publishedSnapshotId: input.guidedGenerationPlan.snapshotId,
        repository: new CountingRepository([]),
      }),
      "inconsistent-generation-review",
    );
    await expectError(
      createApprovedStorefrontProject({ ...input, repository: new FailingRepository([]) }),
      "repository-failure",
    );
  });

  it("maps project, catalogue and snapshot identity conflicts without overwriting", async () => {
    const firstInput = initialAggregateFixture({ suffix: "conflict-a" });
    const repository = new CountingRepository([]);
    await createApprovedStorefrontProject({ ...firstInput, repository });
    const before = await repository.get(firstInput.guidedGenerationPlan.projectId);

    await expectError(
      createApprovedStorefrontProject({ ...firstInput, repository }),
      "project-identity-conflict",
    );

    const catalogueInput = initialAggregateFixture({
      suffix: "conflict-b",
      catalogueId: firstInput.catalogue.id,
    });
    await expectError(
      createApprovedStorefrontProject({ ...catalogueInput, repository }),
      "catalogue-identity-conflict",
    );

    const snapshotInput = initialAggregateFixture({ suffix: "conflict-c" });
    await expectError(
      createApprovedStorefrontProject({
        ...snapshotInput,
        publishedSnapshotId: firstInput.publishedSnapshotId,
        repository,
      }),
      "snapshot-identity-conflict",
    );

    expect(repository.createCalls).toBe(4);
    expect(await repository.get(firstInput.guidedGenerationPlan.projectId)).toEqual(before);
    await expect(repository.list()).resolves.toHaveLength(1);
  });

  it("does not mutate supplied inputs and returns no repository state", async () => {
    const input = initialAggregateFixture({ suffix: "detached" });
    const before = structuredClone(input);
    const repository = new CountingRepository([]);
    const result = await createApprovedStorefrontProject({ ...input, repository });

    expect(input).toEqual(before);
    expect(result).not.toBe(repository.lastAggregate);
    expect(Object.keys(result)).toEqual([
      "projectId",
      "editorRoute",
      "draftSnapshotId",
      "publishedSnapshotId",
    ]);
  });
});
