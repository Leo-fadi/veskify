import type { GuidedStorefrontGenerationPlan } from "@/application/guided-storefront-generation";
import type { StorefrontGenerationReview } from "@/application/storefront-generation-review";
import type { CatalogueDisplayModel } from "@/domain/catalogue";
import type { StorefrontDesignBrief } from "@/domain/design-brief";
import type { Project } from "@/domain/project";

export type InitialProjectAggregateInput = Readonly<{
  guidedGenerationPlan: GuidedStorefrontGenerationPlan;
  review: StorefrontGenerationReview;
  brief: StorefrontDesignBrief;
  catalogue: CatalogueDisplayModel;
  mode: Project["mode"];
  publishedSnapshotId: string;
}>;

export type InitialProjectAggregateErrorCode =
  | "invalid-input"
  | "project-creation-not-allowed"
  | "inconsistent-generation-source"
  | "invalid-project-aggregate";

export class InitialProjectAggregateError extends Error {
  readonly causeValue: unknown;

  constructor(
    readonly code: InitialProjectAggregateErrorCode,
    message: string,
    cause?: unknown,
  ) {
    super(message);
    this.name = "InitialProjectAggregateError";
    this.causeValue = cause;
  }
}
