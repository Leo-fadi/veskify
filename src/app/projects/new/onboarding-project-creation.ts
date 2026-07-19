import type { ApprovedStorefrontProjectInput } from "@/application/approved-storefront-project";
import { generateGuidedStorefront } from "@/application/guided-storefront-generation";
import { createStorefrontGenerationReview } from "@/application/storefront-generation-review";
import { aurumNordicSeed } from "@/data/seed";
import type { OnboardingSession } from "@/domain/onboarding";

export type PreparedOnboardingProject = Omit<ApprovedStorefrontProjectInput, "repository">;

function stableHash(value: string): string {
  let hash = 0x811c9dc5;
  for (const character of value) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

/**
 * Projects the persisted onboarding session through the existing deterministic generation and
 * review boundaries. This function is intentionally side-effect free: entering or restoring O-09
 * never writes a Project.
 */
export function prepareOnboardingProject(session: OnboardingSession): PreparedOnboardingProject {
  const identity = stableHash(session.id);
  const projectId = `project_onboarding_${identity}`;
  const catalogue = structuredClone(aurumNordicSeed.catalogue);
  catalogue.id = `catalogue_onboarding_${identity}`;

  const guidedGenerationPlan = generateGuidedStorefront({
    brief: session.designBrief,
    projectId,
    snapshotId: `snapshot_onboarding_${identity}_draft`,
    catalogueRef: catalogue.id,
    createdAt: session.updatedAt,
  });
  const review = createStorefrontGenerationReview(guidedGenerationPlan, session.designBrief);

  return Object.freeze({
    guidedGenerationPlan,
    review,
    brief: session.designBrief,
    catalogue,
    mode: "merchant" as const,
    publishedSnapshotId: `snapshot_onboarding_${identity}_published`,
  });
}
