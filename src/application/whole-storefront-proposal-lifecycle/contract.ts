import { z } from "zod";
import {
  approvedAssetPlacementOperationSchema,
} from "@/application/ai-storefront-generation";
import {
  wholeStorefrontGenerationPlanSchema,
  wholeStorefrontPlanningInputSchema,
  wholeStorefrontReviewSummarySchema,
} from "@/application/whole-storefront-generation-plan";
import { componentInstanceV2Schema } from "@/domain/component-platform";
import { brandSystemSchema } from "@/domain/design-system";
import { idSchema } from "@/domain/shared";
import { navigationModelSchema, pageTypeSchema } from "@/domain/storefront";

const fingerprintSchema = z.string().trim().min(1).max(240);

export const wholeStorefrontRuntimePageSchema = z
  .object({
    pageId: idSchema,
    role: z.enum(["homepage", "collection-template", "product-template", "other"]),
    type: pageTypeSchema,
    components: z.array(componentInstanceV2Schema),
  })
  .strict()
  .superRefine((page, context) => {
    const componentIds = page.components.map((component) => component.id);
    if (new Set(componentIds).size !== componentIds.length) {
      context.addIssue({
        code: "custom",
        path: ["components"],
        message: "Whole-storefront runtime pages must use unique component identities.",
      });
    }
  });

export const wholeStorefrontRuntimeStateSchema = z
  .object({
    projectId: idSchema,
    projectRevision: z.number().int().nonnegative(),
    draftSnapshotId: idSchema,
    draftRevision: z.number().int().nonnegative(),
    draftFingerprint: fingerprintSchema,
    componentRegistryFingerprint: fingerprintSchema,
    canonicalCommerceFingerprint: fingerprintSchema,
    approvedAssetContextFingerprint: fingerprintSchema.nullable(),
    brandSystem: brandSystemSchema,
    navigation: navigationModelSchema,
    pages: z.array(wholeStorefrontRuntimePageSchema).min(1),
    approvedAssetPlacements: z.array(approvedAssetPlacementOperationSchema),
  })
  .strict()
  .superRefine((state, context) => {
    const pageIds = state.pages.map((page) => page.pageId);
    if (new Set(pageIds).size !== pageIds.length) {
      context.addIssue({
        code: "custom",
        path: ["pages"],
        message: "Whole-storefront runtime state must use unique page identities.",
      });
    }
  });

export const wholeStorefrontProposalOperationSchema = z.discriminatedUnion("type", [
  z
    .object({
      type: z.literal("RETAIN_BRAND_SYSTEM"),
      brandSystem: brandSystemSchema,
    })
    .strict(),
  z
    .object({
      type: z.literal("RETAIN_NAVIGATION"),
      navigation: navigationModelSchema,
    })
    .strict(),
  z
    .object({
      type: z.literal("APPLY_PAGE_COMPONENTS"),
      page: wholeStorefrontRuntimePageSchema,
      removedComponentIds: z.array(idSchema),
    })
    .strict(),
  approvedAssetPlacementOperationSchema,
]);

export const wholeStorefrontProposalOperationEnvelopeSchema = z
  .object({
    order: z.number().int().nonnegative(),
    identity: z.string().trim().min(1).max(240),
    operation: wholeStorefrontProposalOperationSchema,
  })
  .strict();

export const wholeStorefrontProposalPreconditionsSchema = z
  .object({
    planFingerprint: fingerprintSchema,
    briefRevision: z.number().int().positive(),
    evidenceFingerprint: fingerprintSchema,
    assetContextFingerprint: fingerprintSchema.nullable(),
    projectRevision: z.number().int().nonnegative(),
    draftFingerprint: fingerprintSchema,
    componentRegistryFingerprint: fingerprintSchema,
    canonicalCommerceFingerprint: fingerprintSchema,
  })
  .strict();

export const wholeStorefrontProposalReviewSummarySchema = z
  .object({
    sharedDesignSystemChanges: z.array(z.string().trim().min(1).max(240)),
    pages: z.array(
      z
        .object({
          pageId: idSchema,
          status: z.enum(["created", "retained", "changed", "removed"]),
        })
        .strict(),
    ),
    components: z.array(
      z
        .object({
          componentId: idSchema,
          component: z.string().trim().min(1).max(80),
          status: z.enum(["added", "retained", "replaced", "removed", "fallback-retained"]),
        })
        .strict(),
    ),
    navigationChanges: z.array(
      z
        .object({ navigationItemId: idSchema, status: z.enum(["retained", "changed"]) })
        .strict(),
    ),
    canonicalBindings: wholeStorefrontReviewSummarySchema.shape.canonicalBindings,
    approvedAssetPlacements: z.array(approvedAssetPlacementOperationSchema),
    protectedFactsPreserved: z.array(z.string().trim().min(1).max(240)).min(1),
    warnings: wholeStorefrontReviewSummarySchema.shape.warnings,
    requiredMerchantReviewItems: wholeStorefrontReviewSummarySchema.shape.requiredMerchantReviewItems,
  })
  .strict();

export const wholeStorefrontProposalSchema = z
  .object({
    id: z.string().regex(/^whole_storefront_proposal_[a-f0-9]{8}$/),
    planId: idSchema,
    projectId: idSchema,
    draftSnapshotId: idSchema,
    draftRevision: z.number().int().nonnegative(),
    preconditions: wholeStorefrontProposalPreconditionsSchema,
    originalStorefront: wholeStorefrontRuntimeStateSchema,
    proposedStorefront: wholeStorefrontRuntimeStateSchema,
    operations: z.array(wholeStorefrontProposalOperationEnvelopeSchema).min(1),
    reviewSummary: wholeStorefrontProposalReviewSummarySchema,
    status: z.enum(["pending", "accepted", "rejected"]),
  })
  .strict();

export const wholeStorefrontProposalCompilationInputSchema = z
  .object({
    plan: wholeStorefrontGenerationPlanSchema,
    planningInput: wholeStorefrontPlanningInputSchema,
  })
  .strict()
  .superRefine((input, context) => {
    if (input.plan.target.projectId !== input.planningInput.project.id) {
      context.addIssue({
        code: "custom",
        path: ["plan", "target", "projectId"],
        message: "The whole-storefront plan must belong to the active project.",
      });
    }
    if (input.plan.target.draftSnapshotId !== input.planningInput.draft.id) {
      context.addIssue({
        code: "custom",
        path: ["plan", "target", "draftSnapshotId"],
        message: "The whole-storefront plan must use the active draft snapshot.",
      });
    }
    if (input.plan.target.draftRevision !== input.planningInput.draft.revision) {
      context.addIssue({
        code: "custom",
        path: ["plan", "target", "draftRevision"],
        message: "The whole-storefront plan must use the active draft revision.",
      });
    }
  });

export type WholeStorefrontRuntimePage = z.infer<typeof wholeStorefrontRuntimePageSchema>;
export type WholeStorefrontRuntimeState = z.infer<typeof wholeStorefrontRuntimeStateSchema>;
export type WholeStorefrontProposalOperation = z.infer<typeof wholeStorefrontProposalOperationSchema>;
export type WholeStorefrontProposalOperationEnvelope = z.infer<
  typeof wholeStorefrontProposalOperationEnvelopeSchema
>;
export type WholeStorefrontProposalPreconditions = z.infer<
  typeof wholeStorefrontProposalPreconditionsSchema
>;
export type WholeStorefrontProposalReviewSummary = z.infer<
  typeof wholeStorefrontProposalReviewSummarySchema
>;
export type WholeStorefrontProposal = z.infer<typeof wholeStorefrontProposalSchema>;
export type WholeStorefrontProposalCompilationInput = z.infer<
  typeof wholeStorefrontProposalCompilationInputSchema
>;

export type WholeStorefrontProposalErrorCode =
  | "invalid-plan"
  | "stale-plan"
  | "stale-project"
  | "stale-draft"
  | "stale-registry"
  | "stale-commerce"
  | "stale-approved-asset-context"
  | "unsupported-plan-operation"
  | "incomplete-required-operation-compilation"
  | "invalid-page-component-target"
  | "protected-commerce-mutation"
  | "asset-placement-target-mismatch"
  | "duplicate-operation-identity"
  | "proposal-projection-mismatch"
  | "acceptance-transaction-failed";

export class WholeStorefrontProposalError extends Error {
  constructor(
    readonly code: WholeStorefrontProposalErrorCode,
    message: string,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = "WholeStorefrontProposalError";
  }
}

export const wholeStorefrontProposalLifecycleStateSchema = z.enum([
  "ready",
  "accepted",
  "rejected",
  "closed",
  "stale",
  "failed",
]);

export type WholeStorefrontProposalLifecycleState = z.infer<
  typeof wholeStorefrontProposalLifecycleStateSchema
>;
