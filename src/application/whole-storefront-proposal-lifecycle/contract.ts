import { z } from "zod";
import { registeredTokenRefinementPlanSchema } from "@/application/storefront-design-system/token-refinement";
import {
  wholeStorefrontGenerationPlanSchema,
  wholeStorefrontPlanningInputSchema,
  wholeStorefrontReviewSummarySchema,
  wholeStorefrontTargetSchema,
} from "@/application/whole-storefront-generation-plan/contract";
import { componentInstanceV2Schema } from "@/domain/component-platform";
import { brandSystemSchema } from "@/domain/design-system";
import { idSchema, localeSchema } from "@/domain/shared";
import {
  approvedAssetPlacementOperationSchema,
  canonicalValueFingerprint,
  navigationModelSchema,
  pageTypeSchema,
} from "@/domain/storefront";

const fingerprintSchema = z.string().trim().min(1).max(240);

export const wholeStorefrontRuntimePageSchema = z
  .object({
    pageId: idSchema,
    role: z.enum(["homepage", "collection-template", "product-template", "other"]),
    type: pageTypeSchema,
    components: z.array(
      componentInstanceV2Schema.extend({
        visible: z.boolean(),
      }),
    ),
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
    const componentIds = state.pages.flatMap((page) =>
      page.components.map((component) => component.id),
    );
    if (new Set(componentIds).size !== componentIds.length) {
      context.addIssue({
        code: "custom",
        path: ["pages"],
        message: "Whole-storefront runtime state must use globally unique component identities.",
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
      type: z.literal("APPLY_REGISTERED_BRAND_SYSTEM"),
      directionId: z.enum(["premiumEditorial", "modernTechnical", "warmApproachable"]).optional(),
      refinementId: z.literal("validatedTokenRefinement").optional(),
      tokenRefinementPlan: registeredTokenRefinementPlanSchema.optional(),
      brandSystem: brandSystemSchema,
    })
    .strict()
    .superRefine((operation, context) => {
      if ((operation.directionId === undefined) === (operation.refinementId === undefined)) {
        context.addIssue({
          code: "custom",
          path: ["directionId"],
          message:
            "A registered BrandSystem operation must identify one direction or validated token refinement.",
        });
      }
      if (
        (operation.refinementId === "validatedTokenRefinement") !==
        (operation.tokenRefinementPlan !== undefined)
      ) {
        context.addIssue({
          code: "custom",
          path: ["tokenRefinementPlan"],
          message:
            "Only a validated token-refinement operation may include its canonical token plan.",
        });
      }
    }),
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

/**
 * A governed follow-up plan is deliberately expressed in the existing
 * whole-storefront operation vocabulary. It is a common input to the existing
 * compiler, not a second proposal or acceptance model.
 */
export const coordinatedFollowUpPageChangeSchema = z
  .object({
    pageId: idSchema,
    pageType: pageTypeSchema,
    profileId: z.string().trim().min(1).max(160),
    profileFingerprint: fingerprintSchema,
    pageAuthorityFingerprint: fingerprintSchema,
    slotAuthorities: z
      .array(
        z
          .object({
            slotId: z.string().trim().min(1).max(160),
            componentIds: z.array(idSchema).min(1),
          })
          .strict(),
      )
      .min(1),
    operations: z.array(wholeStorefrontProposalOperationSchema).min(1),
  })
  .strict()
  .superRefine((change, context) => {
    const slotIds = change.slotAuthorities.map((authority) => authority.slotId);
    if (new Set(slotIds).size !== slotIds.length) {
      context.addIssue({
        code: "custom",
        path: ["slotAuthorities"],
        message: "Slot authorities must be unique.",
      });
    }
    const componentIds = change.slotAuthorities.flatMap((authority) => authority.componentIds);
    if (new Set(componentIds).size !== componentIds.length) {
      context.addIssue({
        code: "custom",
        path: ["slotAuthorities"],
        message: "A component identity may have only one declared slot authority.",
      });
    }
    for (const operation of change.operations) {
      if (operation.type === "APPLY_PAGE_COMPONENTS" && operation.page.pageId !== change.pageId) {
        context.addIssue({
          code: "custom",
          path: ["operations"],
          message: "A page operation must remain owned by its declared page.",
        });
      }
      if (operation.type === "PLACE_APPROVED_SOURCE_ASSET" && operation.pageId !== change.pageId) {
        context.addIssue({
          code: "custom",
          path: ["operations"],
          message: "An approved asset placement must remain owned by its declared page.",
        });
      }
      if (
        operation.type !== "APPLY_PAGE_COMPONENTS" &&
        operation.type !== "PLACE_APPROVED_SOURCE_ASSET"
      ) {
        context.addIssue({
          code: "custom",
          path: ["operations"],
          message: "Page-scoped changes may contain only page or approved-asset operations.",
        });
      }
    }
    if (
      change.operations.filter((operation) => operation.type === "APPLY_PAGE_COMPONENTS").length > 1
    ) {
      context.addIssue({
        code: "custom",
        path: ["operations"],
        message: "A page-scoped change may materialize its page components only once.",
      });
    }
  });

export const coordinatedFollowUpPlanSchema = z
  .object({
    kind: z.literal("governedFollowUp"),
    version: z.literal(1),
    id: idSchema,
    fingerprint: fingerprintSchema,
    target: wholeStorefrontTargetSchema,
    requestIdentity: z.string().trim().min(1).max(240),
    locale: localeSchema,
    manifest: z
      .object({ version: z.string().trim().min(1), fingerprint: fingerprintSchema })
      .strict(),
    packageRegistry: z
      .object({ version: z.string().trim().min(1), fingerprint: fingerprintSchema })
      .strict(),
    componentRegistryFingerprint: fingerprintSchema,
    commerceFingerprint: fingerprintSchema,
    approvedAssetFingerprint: fingerprintSchema.nullable(),
    protectedStateFingerprint: fingerprintSchema,
    registeredDirectionId: z
      .enum(["premiumEditorial", "modernTechnical", "warmApproachable"])
      .optional(),
    baselineGenerationPlan: wholeStorefrontGenerationPlanSchema,
    sharedOperations: z.array(wholeStorefrontProposalOperationSchema),
    pageChanges: z.array(coordinatedFollowUpPageChangeSchema),
    explanation: z.string().trim().min(1).max(240),
  })
  .strict()
  .superRefine((plan, context) => {
    const pageIds = plan.pageChanges.map((change) => change.pageId);
    if (new Set(pageIds).size !== pageIds.length) {
      context.addIssue({
        code: "custom",
        path: ["pageChanges"],
        message: "Coordinated follow-up plans must declare each page exactly once.",
      });
    }
    const targetPages = new Map(plan.target.pages.map((page) => [page.id, page]));
    for (const change of plan.pageChanges) {
      const targetPage = targetPages.get(change.pageId);
      if (!targetPage || targetPage.type !== change.pageType) {
        context.addIssue({
          code: "custom",
          path: ["pageChanges"],
          message: "Each coordinated page change must match one current target page.",
        });
      }
    }
    for (const operation of plan.sharedOperations) {
      if (
        operation.type === "APPLY_PAGE_COMPONENTS" ||
        operation.type === "PLACE_APPROVED_SOURCE_ASSET"
      ) {
        context.addIssue({
          code: "custom",
          path: ["sharedOperations"],
          message: "Page and approved-asset operations require explicit page ownership.",
        });
      }
    }
    if (
      plan.sharedOperations.filter(
        (operation) =>
          operation.type === "RETAIN_BRAND_SYSTEM" ||
          operation.type === "APPLY_REGISTERED_BRAND_SYSTEM",
      ).length > 1
    ) {
      context.addIssue({
        code: "custom",
        path: ["sharedOperations"],
        message: "A coordinated plan may contain at most one shared BrandSystem operation.",
      });
    }
    if (
      plan.pageChanges.length === 0 &&
      !plan.sharedOperations.some((operation) => operation.type === "APPLY_REGISTERED_BRAND_SYSTEM")
    ) {
      context.addIssue({
        code: "custom",
        path: ["sharedOperations"],
        message: "A shared-only coordinated plan must apply one registered BrandSystem operation.",
      });
    }
    if (
      plan.sharedOperations.filter((operation) => operation.type === "RETAIN_NAVIGATION").length > 1
    ) {
      context.addIssue({
        code: "custom",
        path: ["sharedOperations"],
        message: "A coordinated plan may retain navigation only once.",
      });
    }
    const { fingerprint: _fingerprint, ...identity } = plan;
    void _fingerprint;
    if (plan.fingerprint !== `coordinated-follow-up-${canonicalValueFingerprint(identity)}`) {
      context.addIssue({
        code: "custom",
        path: ["fingerprint"],
        message: "The coordinated follow-up plan fingerprint is stale.",
      });
    }
  });

export function coordinatedFollowUpPlanFingerprint(
  input: Omit<z.infer<typeof coordinatedFollowUpPlanSchema>, "fingerprint">,
) {
  return `coordinated-follow-up-${canonicalValueFingerprint(input)}`;
}

/**
 * Page authority includes the current editable page projection. It prevents a
 * future governed package from applying a valid profile to a page that has
 * changed since its plan was assembled.
 */
export function coordinatedPageAuthorityFingerprint(page: WholeStorefrontRuntimePage) {
  return `coordinated-page-${canonicalValueFingerprint(page)}`;
}

/**
 * This deliberately excludes editable presentation fields. It binds a plan to
 * the canonical project/draft, navigation, commerce and approved-asset
 * authority without giving a skill a mutable commerce projection.
 */
export function coordinatedProtectedStateFingerprint(state: WholeStorefrontRuntimeState) {
  return `coordinated-protected-${canonicalValueFingerprint({
    projectId: state.projectId,
    projectRevision: state.projectRevision,
    draftSnapshotId: state.draftSnapshotId,
    draftRevision: state.draftRevision,
    draftFingerprint: state.draftFingerprint,
    canonicalCommerceFingerprint: state.canonicalCommerceFingerprint,
    approvedAssetContextFingerprint: state.approvedAssetContextFingerprint,
    navigation: state.navigation,
    pages: state.pages.map((page) => ({
      pageId: page.pageId,
      type: page.type,
      components: page.components.map((component) => ({
        id: component.id,
        component: component.component,
        componentVersion: component.componentVersion,
        bindings: component.bindings,
      })),
    })),
  })}`;
}

export const coordinatedInitialGenerationPlanSchema = z
  .object({ kind: z.literal("initialGeneration"), plan: wholeStorefrontGenerationPlanSchema })
  .strict();

export const coordinatedStorefrontPlanSchema = z.discriminatedUnion("kind", [
  coordinatedInitialGenerationPlanSchema,
  coordinatedFollowUpPlanSchema,
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
    manifestVersion: z.string().trim().min(1).max(120).optional(),
    manifestFingerprint: fingerprintSchema.optional(),
    packageRegistryVersion: z.string().trim().min(1).max(120).optional(),
    packageRegistryFingerprint: fingerprintSchema.optional(),
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
          pageId: idSchema.optional(),
          pageRole: z
            .enum(["homepage", "collection-template", "product-template", "other"])
            .optional(),
          previousVariant: z.string().trim().min(1).max(80).optional(),
          resultingVariant: z.string().trim().min(1).max(80).optional(),
          description: z.string().trim().min(1).max(240).optional(),
          status: z.enum([
            "added",
            "retained",
            "modified",
            "replaced",
            "removed",
            "fallback-retained",
          ]),
        })
        .strict(),
    ),
    navigationChanges: z.array(
      z.object({ navigationItemId: idSchema, status: z.enum(["retained", "changed"]) }).strict(),
    ),
    visibilityChanges: z.array(
      z
        .object({
          componentId: idSchema,
          previousVisible: z.boolean(),
          visible: z.boolean(),
        })
        .strict(),
    ),
    canonicalBindings: wholeStorefrontReviewSummarySchema.shape.canonicalBindings,
    approvedAssetPlacements: z.array(approvedAssetPlacementOperationSchema),
    protectedFactsPreserved: z.array(z.string().trim().min(1).max(240)).min(1),
    warnings: wholeStorefrontReviewSummarySchema.shape.warnings,
    requiredMerchantReviewItems:
      wholeStorefrontReviewSummarySchema.shape.requiredMerchantReviewItems,
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

export const coordinatedFollowUpProposalCompilationInputSchema = z
  .object({
    plan: coordinatedFollowUpPlanSchema,
    planningInput: wholeStorefrontPlanningInputSchema,
  })
  .strict()
  .superRefine((input, context) => {
    if (input.plan.target.projectId !== input.planningInput.project.id) {
      context.addIssue({
        code: "custom",
        path: ["plan", "target", "projectId"],
        message: "The coordinated plan must belong to the active project.",
      });
    }
    if (input.plan.target.draftSnapshotId !== input.planningInput.draft.id) {
      context.addIssue({
        code: "custom",
        path: ["plan", "target", "draftSnapshotId"],
        message: "The coordinated plan must use the active draft snapshot.",
      });
    }
    if (input.plan.target.draftRevision !== input.planningInput.draft.revision) {
      context.addIssue({
        code: "custom",
        path: ["plan", "target", "draftRevision"],
        message: "The coordinated plan must use the active draft revision.",
      });
    }
  });

export const coordinatedInitialGenerationProposalCompilationInputSchema = z
  .object({
    plan: coordinatedInitialGenerationPlanSchema,
    planningInput: wholeStorefrontPlanningInputSchema,
  })
  .strict()
  .superRefine((input, context) => {
    if (input.plan.plan.target.projectId !== input.planningInput.project.id) {
      context.addIssue({
        code: "custom",
        path: ["plan", "plan", "target", "projectId"],
        message: "The coordinated initial-generation plan must belong to the active project.",
      });
    }
    if (input.plan.plan.target.draftSnapshotId !== input.planningInput.draft.id) {
      context.addIssue({
        code: "custom",
        path: ["plan", "plan", "target", "draftSnapshotId"],
        message: "The coordinated initial-generation plan must use the active draft snapshot.",
      });
    }
    if (input.plan.plan.target.draftRevision !== input.planningInput.draft.revision) {
      context.addIssue({
        code: "custom",
        path: ["plan", "plan", "target", "draftRevision"],
        message: "The coordinated initial-generation plan must use the active draft revision.",
      });
    }
  });

export type WholeStorefrontRuntimePage = z.infer<typeof wholeStorefrontRuntimePageSchema>;
export type WholeStorefrontRuntimeComponent = WholeStorefrontRuntimePage["components"][number];
export type WholeStorefrontRuntimeState = z.infer<typeof wholeStorefrontRuntimeStateSchema>;
export type WholeStorefrontProposalOperation = z.infer<
  typeof wholeStorefrontProposalOperationSchema
>;
export type CoordinatedFollowUpPageChange = z.infer<typeof coordinatedFollowUpPageChangeSchema>;
export type CoordinatedFollowUpPlan = z.infer<typeof coordinatedFollowUpPlanSchema>;
export type CoordinatedStorefrontPlan = z.infer<typeof coordinatedStorefrontPlanSchema>;
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
export type CoordinatedFollowUpProposalCompilationInput = z.infer<
  typeof coordinatedFollowUpProposalCompilationInputSchema
>;
export type CoordinatedInitialGenerationProposalCompilationInput = z.infer<
  typeof coordinatedInitialGenerationProposalCompilationInputSchema
>;
export type WholeStorefrontProposalAuthorityInput =
  | WholeStorefrontProposalCompilationInput
  | CoordinatedInitialGenerationProposalCompilationInput
  | CoordinatedFollowUpProposalCompilationInput;

export type WholeStorefrontProposalErrorCode =
  | "invalid-plan"
  | "invalid-coordinated-plan"
  | "duplicate-page-authority"
  | "undeclared-page-operation"
  | "stale-page-authority"
  | "conflicting-coordinated-operation"
  | "unsupported-coordinated-plan-kind"
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
