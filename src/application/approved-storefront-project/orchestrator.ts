import {
  createInitialProjectAggregate,
  InitialProjectAggregateError,
  type InitialProjectAggregateInput,
} from "@/application/initial-project-aggregate";
import {
  createStorefrontGenerationReview,
  validateStorefrontGenerationReview,
  type StorefrontGenerationReview,
} from "@/application/storefront-generation-review";
import {
  validateGuidedStorefrontGenerationPlan,
  type GuidedStorefrontGenerationPlan,
} from "@/application/guided-storefront-generation";
import { catalogueDisplayModelSchema, type CatalogueDisplayModel } from "@/domain/catalogue";
import { storefrontDesignBriefSchema, type StorefrontDesignBrief } from "@/domain/design-brief";
import { projectSchema, type Project } from "@/domain/project";
import { canonicalValueString } from "@/domain/storefront";
import { idSchema } from "@/domain/shared";
import {
  CatalogueAlreadyExistsError,
  ProjectAlreadyExistsError,
  RepositoryValidationError,
  SnapshotAlreadyExistsError,
  type ProjectAggregate,
} from "@/services/storage";
import {
  ApprovedStorefrontProjectError,
  type ApprovedStorefrontProjectInput,
  type ApprovedStorefrontProjectResult,
} from "./contract";

function fail(
  code: ConstructorParameters<typeof ApprovedStorefrontProjectError>[0],
  message: string,
  cause?: unknown,
): never {
  throw new ApprovedStorefrontProjectError(code, message, cause);
}

function isRepository(value: unknown): value is ApprovedStorefrontProjectInput["repository"] {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as { create?: unknown }).create === "function"
  );
}

function validatePlan(input: unknown): GuidedStorefrontGenerationPlan {
  try {
    return validateGuidedStorefrontGenerationPlan(input);
  } catch (cause) {
    return fail("invalid-input", "The guided storefront generation plan is invalid.", cause);
  }
}

function validateReview(input: unknown): StorefrontGenerationReview {
  try {
    return validateStorefrontGenerationReview(input);
  } catch (cause) {
    return fail("invalid-input", "The storefront generation review is invalid.", cause);
  }
}

function validateBrief(input: unknown): StorefrontDesignBrief {
  try {
    return storefrontDesignBriefSchema.parse(input);
  } catch (cause) {
    return fail("invalid-input", "The storefront design brief is invalid.", cause);
  }
}

function validateCatalogue(input: unknown): CatalogueDisplayModel {
  try {
    return catalogueDisplayModelSchema.parse(input);
  } catch (cause) {
    return fail("invalid-input", "The supplied catalogue is invalid.", cause);
  }
}

function validateScalars(mode: unknown, publishedSnapshotId: unknown): Project["mode"] {
  try {
    idSchema.parse(publishedSnapshotId);
    return projectSchema.shape.mode.parse(mode);
  } catch (cause) {
    return fail("invalid-input", "The project mode or published snapshot ID is invalid.", cause);
  }
}

function assertCanonicalReview(
  plan: GuidedStorefrontGenerationPlan,
  brief: StorefrontDesignBrief,
  submitted: StorefrontGenerationReview,
): void {
  let canonical: StorefrontGenerationReview;
  try {
    canonical = createStorefrontGenerationReview(plan, brief);
  } catch (cause) {
    fail(
      "inconsistent-generation-review",
      "The generation result cannot produce the canonical storefront review.",
      cause,
    );
  }
  if (canonicalValueString(canonical) !== canonicalValueString(submitted)) {
    fail(
      "inconsistent-generation-review",
      "The submitted storefront review does not match the canonical review projection.",
    );
  }
}

function mapFactoryError(error: unknown): never {
  if (error instanceof ApprovedStorefrontProjectError) throw error;
  if (error instanceof InitialProjectAggregateError) {
    switch (error.code) {
      case "invalid-input":
        return fail("invalid-input", error.message, error);
      case "project-creation-not-allowed":
        return fail("review-not-ready", error.message, error);
      case "inconsistent-generation-source":
        return fail("inconsistent-generation-review", error.message, error);
      case "invalid-project-aggregate":
        return fail("aggregate-construction-failed", error.message, error);
    }
  }
  return fail(
    "aggregate-construction-failed",
    "The initial project aggregate could not be constructed.",
    error,
  );
}

function mapRepositoryError(error: unknown): never {
  if (error instanceof ProjectAlreadyExistsError) {
    return fail("project-identity-conflict", error.message, error);
  }
  if (error instanceof CatalogueAlreadyExistsError) {
    return fail("catalogue-identity-conflict", error.message, error);
  }
  if (error instanceof SnapshotAlreadyExistsError) {
    return fail("snapshot-identity-conflict", error.message, error);
  }
  if (error instanceof RepositoryValidationError) {
    return fail("repository-failure", error.message, error);
  }
  return fail("repository-failure", "The project repository could not create the project.", error);
}

export async function createApprovedStorefrontProject(
  input: ApprovedStorefrontProjectInput,
): Promise<ApprovedStorefrontProjectResult> {
  if (!input || typeof input !== "object") {
    return fail("invalid-input", "Approved storefront project input is required.");
  }
  if (!isRepository(input.repository)) {
    return fail("invalid-input", "A ProjectRepository with a create operation is required.");
  }

  const plan = validatePlan(input.guidedGenerationPlan);
  const review = validateReview(input.review);
  const brief = validateBrief(input.brief);
  const catalogue = validateCatalogue(input.catalogue);
  const mode = validateScalars(input.mode, input.publishedSnapshotId);

  assertCanonicalReview(plan, brief, review);
  if (!review.canCreateProject) {
    return fail("review-not-ready", "The approved review does not allow project creation.");
  }

  let aggregate: ProjectAggregate;
  try {
    const factoryInput: InitialProjectAggregateInput = {
      guidedGenerationPlan: plan,
      review,
      brief,
      catalogue,
      mode,
      publishedSnapshotId: input.publishedSnapshotId,
    };
    aggregate = createInitialProjectAggregate(factoryInput);
  } catch (error) {
    return mapFactoryError(error);
  }

  let created: ProjectAggregate;
  try {
    created = await input.repository.create(aggregate);
  } catch (error) {
    return mapRepositoryError(error);
  }

  return Object.freeze({
    projectId: created.project.id,
    draftSnapshotId: created.project.draftSnapshotId,
    publishedSnapshotId: created.project.publishedSnapshotId,
  });
}
