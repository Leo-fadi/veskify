import { validateRegisteredSnapshot } from "@/components/registry";
import {
  validateGuidedStorefrontGenerationPlan,
  type GuidedStorefrontGenerationPlan,
} from "@/application/guided-storefront-generation";
import {
  createStorefrontGenerationReview,
  validateStorefrontGenerationReview,
  type StorefrontGenerationReview,
} from "@/application/storefront-generation-review";
import { deepFreeze } from "@/application/storefront-templates/contract";
import { catalogueDisplayModelSchema, type CatalogueDisplayModel } from "@/domain/catalogue";
import {
  createStorefrontDesignBriefFingerprint,
  storefrontDesignBriefSchema,
  type StorefrontDesignBrief,
  type StorefrontIndustry,
} from "@/domain/design-brief";
import { projectSchema, type Project } from "@/domain/project";
import { idSchema } from "@/domain/shared";
import {
  canonicalStorefrontContentEqual,
  canonicalValueString,
  storefrontSnapshotSchema,
  type StorefrontSnapshot,
} from "@/domain/storefront";
import type { ProjectAggregate } from "@/services/storage";
import { validateProjectAggregate } from "@/services/storage/repository-validation";
import { InitialProjectAggregateError, type InitialProjectAggregateInput } from "./contract";

const requiredPageTypes = ["home", "collection", "product"] as const;

function invalidInput(message: string, cause?: unknown): never {
  throw new InitialProjectAggregateError("invalid-input", message, cause);
}

function creationNotAllowed(message: string): never {
  throw new InitialProjectAggregateError("project-creation-not-allowed", message);
}

function inconsistentSource(message: string, cause?: unknown): never {
  throw new InitialProjectAggregateError("inconsistent-generation-source", message, cause);
}

function invalidAggregate(message: string, cause?: unknown): never {
  throw new InitialProjectAggregateError("invalid-project-aggregate", message, cause);
}

function validatePlan(input: unknown): GuidedStorefrontGenerationPlan {
  try {
    return validateGuidedStorefrontGenerationPlan(input);
  } catch (cause) {
    return invalidInput("The guided storefront generation plan is invalid.", cause);
  }
}

function validateReview(input: unknown): StorefrontGenerationReview {
  try {
    return validateStorefrontGenerationReview(input);
  } catch (cause) {
    return invalidInput("The storefront generation review is invalid.", cause);
  }
}

function validateBrief(input: unknown): StorefrontDesignBrief {
  try {
    return storefrontDesignBriefSchema.parse(input);
  } catch (cause) {
    return invalidInput("The storefront design brief is invalid.", cause);
  }
}

function validateCatalogue(input: unknown): CatalogueDisplayModel {
  try {
    return catalogueDisplayModelSchema.parse(input);
  } catch (cause) {
    return invalidAggregate("The supplied catalogue is invalid.", cause);
  }
}

function validateScalarInputs(mode: unknown, publishedSnapshotId: unknown): Project["mode"] {
  try {
    idSchema.parse(publishedSnapshotId);
    return projectSchema.shape.mode.parse(mode);
  } catch (cause) {
    return invalidInput("The explicit project mode or published snapshot ID is invalid.", cause);
  }
}

function assertCreationAllowed(
  plan: GuidedStorefrontGenerationPlan,
  review: StorefrontGenerationReview,
): asserts plan is GuidedStorefrontGenerationPlan & { generatedSnapshot: StorefrontSnapshot } {
  if (
    (plan.status !== "ready" && plan.status !== "ready-with-warnings") ||
    plan.generatedSnapshot === null
  ) {
    creationNotAllowed("The guided generation result is not ready for project creation.");
  }
  if (
    (review.status !== "ready" && review.status !== "ready-with-warnings") ||
    !review.canCreateProject ||
    review.blockers.length > 0
  ) {
    creationNotAllowed("The approved review does not allow project creation.");
  }

  const materializationStages = plan.stageDiagnostics.filter(
    ({ stage }) => stage === "storefront-materialization",
  );
  const reviewMaterializationStages = review.stageStatuses.filter(
    ({ stage }) => stage === "storefront-materialization",
  );
  if (
    materializationStages.length !== 1 ||
    materializationStages[0].status !== "executed" ||
    reviewMaterializationStages.length !== 1 ||
    reviewMaterializationStages[0].status !== "executed" ||
    plan.initialStorefrontGenerationPlan === null
  ) {
    creationNotAllowed("Storefront materialization must be complete before project creation.");
  }

  if (!requiredPageTypes.every((type) => review.pageSummaries.some((page) => page.type === type))) {
    creationNotAllowed("The approved review must contain the required storefront pages.");
  }
}

function assertExactReviewProjection(
  plan: GuidedStorefrontGenerationPlan,
  review: StorefrontGenerationReview,
  brief: StorefrontDesignBrief,
): void {
  let canonicalReview: StorefrontGenerationReview;
  try {
    canonicalReview = createStorefrontGenerationReview(plan, brief);
  } catch (cause) {
    inconsistentSource(
      "The generation plan and brief cannot produce the canonical storefront review.",
      cause,
    );
  }
  if (canonicalValueString(review) !== canonicalValueString(canonicalReview)) {
    inconsistentSource(
      "The submitted storefront review is not the exact review for this generation result.",
    );
  }
}

function assertSourceConsistency(
  plan: GuidedStorefrontGenerationPlan & { generatedSnapshot: StorefrontSnapshot },
  brief: StorefrontDesignBrief,
  catalogue: CatalogueDisplayModel,
): void {
  const snapshot = plan.generatedSnapshot;
  const fullBriefFingerprint = createStorefrontDesignBriefFingerprint(brief);
  const materialization = plan.initialStorefrontGenerationPlan;

  if (brief.id !== plan.briefId || fullBriefFingerprint !== plan.briefFingerprint) {
    inconsistentSource("The brief and generation plan do not share the same source.");
  }
  if (
    snapshot.id !== plan.snapshotId ||
    catalogue.id !== plan.catalogueRef ||
    snapshot.projectId !== plan.projectId ||
    snapshot.catalogueRef !== catalogue.id ||
    snapshot.createdAt !== plan.createdAt
  ) {
    inconsistentSource("The generated project, snapshot or catalogue identities do not match.");
  }
  if (
    snapshot.revision !== 0 ||
    snapshot.createdBy !== "agent" ||
    canonicalValueString(snapshot.brandSystem) !==
      canonicalValueString(plan.brandFoundationPlan.brandSystem)
  ) {
    inconsistentSource("The generated snapshot does not preserve its approved brand baseline.");
  }
  if (
    materialization === null ||
    materialization.templateSelectionPlanId !== plan.templateSelectionPlan?.id ||
    materialization.snapshotId !== snapshot.id
  ) {
    inconsistentSource("The generation result does not preserve the exact approved stage plans.");
  }
}

function projectIndustry(industry: StorefrontIndustry | null): Project["industry"] {
  if (industry === null) invalidInput("The design brief must contain a supported industry.");
  if (industry === "jewellery" || industry === "watches") return "jewellery";
  if (industry === "fashion") return "fashion";
  return "generic";
}

function projectFrom(
  plan: GuidedStorefrontGenerationPlan,
  brief: StorefrontDesignBrief,
  mode: Project["mode"],
  publishedSnapshotId: string,
): Project {
  const primaryLocale = brief.languagePlan.primaryLanguage;
  if (primaryLocale === null || brief.languagePlan.selectedLanguages.length === 0) {
    invalidInput("The design brief must contain complete storefront language choices.");
  }
  try {
    return projectSchema.parse({
      id: plan.projectId,
      name: brief.businessIdentity.businessName,
      mode,
      industry: projectIndustry(brief.businessIdentity.industry),
      primaryLocale,
      enabledLocales: [...brief.languagePlan.selectedLanguages],
      businessProfile: {
        name: brief.businessIdentity.businessName,
        description: brief.businessIdentity.shortDescription,
        audience: brief.businessIdentity.targetCustomer,
        market: brief.businessIdentity.primaryMarket,
        sourceReferences: brief.creationContext.existingStorefrontUrl
          ? [brief.creationContext.existingStorefrontUrl]
          : [],
      },
      publishedSnapshotId,
      draftSnapshotId: plan.snapshotId,
      revision: 0,
      createdAt: plan.createdAt,
      updatedAt: plan.createdAt,
    });
  } catch (cause) {
    return invalidAggregate("The deterministic project mapping is invalid.", cause);
  }
}

function validateSnapshotForCatalogue(
  input: unknown,
  catalogue: CatalogueDisplayModel,
  primaryLocale: Project["primaryLocale"],
): StorefrontSnapshot {
  try {
    const snapshot = storefrontSnapshotSchema.parse(input);
    return validateRegisteredSnapshot(snapshot, catalogue, primaryLocale, primaryLocale);
  } catch (cause) {
    return invalidAggregate(
      "The generated storefront is invalid for the supplied catalogue and component registry.",
      cause,
    );
  }
}

export function createInitialProjectAggregate(
  input: InitialProjectAggregateInput,
): ProjectAggregate {
  if (!input || typeof input !== "object") invalidInput("Factory input is required.");
  const plan = validatePlan(input.guidedGenerationPlan);
  const review = validateReview(input.review);
  const brief = validateBrief(input.brief);
  const catalogue = validateCatalogue(input.catalogue);
  const mode = validateScalarInputs(input.mode, input.publishedSnapshotId);

  assertExactReviewProjection(plan, review, brief);
  assertCreationAllowed(plan, review);
  assertSourceConsistency(plan, brief, catalogue);
  if (input.publishedSnapshotId === plan.snapshotId) {
    inconsistentSource("The initial published baseline and active draft need distinct IDs.");
  }

  const project = projectFrom(plan, brief, mode, input.publishedSnapshotId);
  const generatedDraft = validateSnapshotForCatalogue(
    structuredClone(plan.generatedSnapshot),
    catalogue,
    project.primaryLocale,
  );
  const publishedBaseline = validateSnapshotForCatalogue(
    {
      ...structuredClone(generatedDraft),
      id: input.publishedSnapshotId,
      revision: 0,
      createdAt: plan.createdAt,
      createdBy: "system",
    },
    catalogue,
    project.primaryLocale,
  );
  if (!canonicalStorefrontContentEqual(publishedBaseline, generatedDraft)) {
    invalidAggregate("The initial published baseline must match the generated draft.");
  }

  try {
    const aggregate = validateProjectAggregate({
      project,
      catalogue,
      snapshots: [publishedBaseline, generatedDraft],
    });
    return deepFreeze(structuredClone(aggregate));
  } catch (cause) {
    if (cause instanceof InitialProjectAggregateError) throw cause;
    return invalidAggregate("The initial project aggregate is invalid.", cause);
  }
}
