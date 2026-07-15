import { describe, expect, it } from "vitest";
import {
  IndexedDbProjectRepository,
  ProjectNotFoundError,
  RepositoryValidationError,
  RevisionConflictError,
  SnapshotNotFoundError,
  SnapshotProjectMismatchError,
} from "@/services/storage";

describe("storage repository errors", () => {
  it("exposes stable typed error codes", () => {
    expect(new ProjectNotFoundError("project_missing").code).toBe("PROJECT_NOT_FOUND");
    expect(new SnapshotNotFoundError("project_one", "snapshot_missing").code).toBe(
      "SNAPSHOT_NOT_FOUND",
    );
    expect(new RevisionConflictError("project_one", 1, 2).code).toBe("REVISION_CONFLICT");
    expect(new SnapshotProjectMismatchError("project_one", "project_two").code).toBe(
      "SNAPSHOT_PROJECT_MISMATCH",
    );
    expect(new RepositoryValidationError("Invalid repository input.").code).toBe(
      "REPOSITORY_VALIDATION_FAILED",
    );
  });

  it("constructs the browser adapter without touching IndexedDB", () => {
    expect(
      () => new IndexedDbProjectRepository({ databaseName: "lazy-browser-adapter-test" }),
    ).not.toThrow();
  });
});
