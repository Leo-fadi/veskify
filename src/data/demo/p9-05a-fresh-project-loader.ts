import { ProjectAlreadyExistsError, type ProjectRepository } from "@/services/storage";
import { createP905aFreshMerchantFixture } from "./p9-05a-fresh-store-generation";

export const P9_05A_FRESH_EDITOR_ROUTE = "/projects/project_lumo_fresh/editor";

/**
 * Persists the exact P9-05A aggregate through the normal project repository.
 * Existing IDs are deliberately refused; a demo reset must be explicit outside
 * this loader so no merchant draft can be overwritten accidentally.
 */
export async function loadP905aFreshProject(repository: ProjectRepository) {
  const fixture = createP905aFreshMerchantFixture("warmApproachable");
  try {
    const aggregate = await repository.create(fixture.aggregate);
    return {
      status: "created" as const,
      projectId: aggregate.project.id,
      editorRoute: P9_05A_FRESH_EDITOR_ROUTE,
      aggregate,
      brief: fixture.brief,
      approvedAssetContext: fixture.assetContext,
      approvedAssetPresentations: fixture.assetPresentations,
    };
  } catch (error) {
    if (error instanceof ProjectAlreadyExistsError) {
      return {
        status: "already-exists" as const,
        projectId: fixture.aggregate.project.id,
        editorRoute: P9_05A_FRESH_EDITOR_ROUTE,
      };
    }
    throw error;
  }
}
