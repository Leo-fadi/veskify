import { z } from "zod";
import { aiOperationPermissionGrantSchema } from "@/application/ai-provider";
import type { AiOperationPermissionTarget } from "@/application/ai-provider";
import {
  designOperationSchema,
  proposalValidationResultSchema,
} from "@/application/design-operations";
import { brandSystemSchema } from "@/domain/design-system";
import { idSchema, localeSchema, localizedTextSchema } from "@/domain/shared";
import {
  contentSupportFactDocumentSchema,
  dynamicCommercePresentationAuthoritySchema,
  navigationModelSchema,
  pageModelSchema,
  sharedFrameModelSchema,
} from "@/domain/storefront";
import { approvedAssetPlacementOperationSchema } from "@/application/ai-storefront-generation/approved-asset-context";

export const storefrontDesignSystemTargetSchema = z
  .object({ kind: z.literal("storefrontDesignSystem"), projectId: idSchema })
  .strict();

export const aiStorefrontSectionTargetSchema = z
  .object({ pageId: idSchema, sectionId: idSchema })
  .strict();

export const aiStorefrontTargetSchema = z
  .object({
    scope: z.enum(["storefront", "page"]),
    projectId: idSchema,
    draftSnapshotId: idSchema,
    draftRevision: z.number().int().nonnegative(),
    affectedPageIds: z.array(idSchema).min(1),
    affectedSectionTargets: z.array(aiStorefrontSectionTargetSchema),
    designSystemTarget: storefrontDesignSystemTargetSchema.nullable(),
    enabledLocales: z.array(localeSchema).min(1).max(2),
    activeLocale: localeSchema,
  })
  .strict()
  .superRefine((target, context) => {
    if (
      target.scope === "page" &&
      (target.affectedPageIds.length !== 1 || target.designSystemTarget !== null)
    ) {
      context.addIssue({
        code: "custom",
        path: ["scope"],
        message:
          "Page targets must affect one page and cannot include shared design-system changes.",
      });
    }
    if (new Set(target.affectedPageIds).size !== target.affectedPageIds.length) {
      context.addIssue({
        code: "custom",
        path: ["affectedPageIds"],
        message: "Affected storefront page IDs must be unique.",
      });
    }
    const pageIds = new Set(target.affectedPageIds);
    const sectionKeys = new Set<string>();
    const sectionIds = new Set<string>();
    target.affectedSectionTargets.forEach((sectionTarget, index) => {
      if (!pageIds.has(sectionTarget.pageId)) {
        context.addIssue({
          code: "custom",
          path: ["affectedSectionTargets", index, "pageId"],
          message: "Affected section targets must belong to an affected page.",
        });
      }
      const key = `${sectionTarget.pageId}:${sectionTarget.sectionId}`;
      if (sectionKeys.has(key)) {
        context.addIssue({
          code: "custom",
          path: ["affectedSectionTargets", index],
          message: "Affected section targets must be unique.",
        });
      }
      sectionKeys.add(key);
      if (sectionIds.has(sectionTarget.sectionId)) {
        context.addIssue({
          code: "custom",
          path: ["affectedSectionTargets", index, "sectionId"],
          message: "Affected section IDs must be unique across the storefront target.",
        });
      }
      sectionIds.add(sectionTarget.sectionId);
    });
    if (!target.enabledLocales.includes(target.activeLocale)) {
      context.addIssue({
        code: "custom",
        path: ["activeLocale"],
        message: "The active locale must be one of the enabled storefront locales.",
      });
    }
    if (new Set(target.enabledLocales).size !== target.enabledLocales.length) {
      context.addIssue({
        code: "custom",
        path: ["enabledLocales"],
        message: "Enabled storefront locales must be unique.",
      });
    }
    if (
      target.designSystemTarget !== null &&
      target.designSystemTarget.projectId !== target.projectId
    ) {
      context.addIssue({
        code: "custom",
        path: ["designSystemTarget", "projectId"],
        message: "The storefront design-system target must use the declared project.",
      });
    }
  });

export const aiStorefrontProjectionSchema = z
  .object({
    pageOrder: z.array(idSchema).min(1),
    pages: z.array(pageModelSchema).min(1),
    navigation: navigationModelSchema,
    brandSystem: brandSystemSchema,
    sharedFrame: sharedFrameModelSchema.optional(),
    dynamicCommercePresentation: dynamicCommercePresentationAuthoritySchema.optional(),
    contentSupportFactDocuments: z.array(contentSupportFactDocumentSchema).optional(),
  })
  .strict()
  .superRefine((projection, context) => {
    const pageIds = projection.pages.map((page) => page.id);
    if (new Set(pageIds).size !== pageIds.length) {
      context.addIssue({
        code: "custom",
        path: ["pages"],
        message: "Storefront projections must contain unique page IDs.",
      });
    }
    const sectionLocations = new Map<string, { pageIndex: number; sectionIndex: number }>();
    projection.pages.forEach((page, pageIndex) => {
      page.sections.forEach((section, sectionIndex) => {
        const previous = sectionLocations.get(section.id);
        if (previous) {
          context.addIssue({
            code: "custom",
            path: ["pages", pageIndex, "sections", sectionIndex, "id"],
            message: `Section ID ${section.id} is already used on page ${projection.pages[previous.pageIndex].id}.`,
          });
        } else {
          sectionLocations.set(section.id, { pageIndex, sectionIndex });
        }
      });
    });
    if (
      new Set(projection.pageOrder).size !== projection.pageOrder.length ||
      projection.pageOrder.length !== pageIds.length ||
      projection.pageOrder.some((pageId, index) => pageId !== pageIds[index])
    ) {
      context.addIssue({
        code: "custom",
        path: ["pageOrder"],
        message: "Storefront page order must match the projected pages exactly.",
      });
    }
    const knownPageIds = new Set(pageIds);
    const knownDynamicRouteIds = new Set(
      projection.dynamicCommercePresentation?.routeInventory.map(({ id }) => id) ?? [],
    );
    for (const [area, items] of Object.entries(projection.navigation)) {
      items.forEach((item, index) => {
        if (item.target.type === "page" && !knownPageIds.has(item.target.pageId)) {
          context.addIssue({
            code: "custom",
            path: ["navigation", area, index, "target", "pageId"],
            message: "Navigation targets must resolve to a projected page.",
          });
        }
        if (
          item.target.type === "dynamic-commerce-route" &&
          !knownDynamicRouteIds.has(item.target.routeId)
        ) {
          context.addIssue({
            code: "custom",
            path: ["navigation", area, index, "target", "routeId"],
            message: "Dynamic navigation targets must resolve to the current route inventory.",
          });
        }
      });
    }
  });

export const aiStorefrontContextSchema = z
  .object({
    projectId: idSchema,
    draftSnapshotId: idSchema,
    draftRevision: z.number().int().nonnegative(),
    enabledLocales: z.array(localeSchema).min(1).max(2),
    activeLocale: localeSchema,
    storefront: aiStorefrontProjectionSchema,
  })
  .strict()
  .superRefine((context, refinement) => {
    if (!context.enabledLocales.includes(context.activeLocale)) {
      refinement.addIssue({
        code: "custom",
        path: ["activeLocale"],
        message: "The active locale must be one of the enabled storefront locales.",
      });
    }
    if (new Set(context.enabledLocales).size !== context.enabledLocales.length) {
      refinement.addIssue({
        code: "custom",
        path: ["enabledLocales"],
        message: "Enabled storefront locales must be unique.",
      });
    }
  });

export const aiStorefrontOperationTargetSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("page"), pageId: idSchema }).strict(),
  z.object({ kind: z.literal("section"), pageId: idSchema, sectionId: idSchema }).strict(),
  storefrontDesignSystemTargetSchema,
]);

export const aiStorefrontOperationSchema = z
  .object({
    order: z.number().int().nonnegative(),
    target: aiStorefrontOperationTargetSchema,
    operation: designOperationSchema,
  })
  .strict();

/**
 * Explicit, replayable authority for converging an operation-produced legacy
 * dynamic-commerce page set into the canonical compact route root. It is
 * optional solely for historical proposal compatibility.
 */
export const aiStorefrontDynamicCommerceMigrationSchema = z
  .object({
    kind: z.literal("canonicalDynamicCommerceMigration"),
    contractVersion: z.literal("1.0.0"),
    legacyProjectionFingerprint: z.string().regex(/^v1_\d+_[0-9a-f]{64}$/),
    resultingProjectionFingerprint: z.string().regex(/^v1_\d+_[0-9a-f]{64}$/),
    resultingAuthorityFingerprint: z.string().trim().min(1).max(240),
  })
  .strict();

export const aiStorefrontWholeStorefrontGenerationTargetSchema = z
  .object({
    kind: z.literal("storefront"),
    projectId: idSchema,
    draftSnapshotId: idSchema,
    draftRevision: z.number().int().nonnegative(),
  })
  .strict();

export const aiStorefrontWholeStorefrontGenerationPermissionSchema = z
  .object({
    skillId: z.literal("compilePromptedStorefrontDesignIntentV2"),
    skillVersion: z.literal("2.0.0"),
    skillScope: z.literal("storefront"),
    operationTypes: z.tuple([z.literal("APPLY_CANONICAL_WHOLE_STOREFRONT_GENERATION")]),
    target: aiStorefrontWholeStorefrontGenerationTargetSchema,
  })
  .strict();

/**
 * Server-minted structured operation for one exact whole-storefront generation transition.
 *
 * Normal section/page editing remains operation-replayable. Initial complete-storefront
 * generation is structurally different: it may replace the raw page set, navigation, shared
 * frame, content evidence projection and dynamic-commerce presentation atomically. This
 * operation binds that replacement to the approved P02B proposal, exact compiler lineage, the
 * operation-produced intermediate projection and the exact reviewed canonical result. It is
 * never accepted from a provider or browser request.
 */
export const aiStorefrontWholeStorefrontGenerationSchema = z
  .object({
    kind: z.literal("canonicalWholeStorefrontGeneration"),
    contractVersion: z.literal("1.0.0"),
    order: z.literal(0),
    operationType: z.literal("APPLY_CANONICAL_WHOLE_STOREFRONT_GENERATION"),
    target: aiStorefrontWholeStorefrontGenerationTargetSchema,
    permission: aiStorefrontWholeStorefrontGenerationPermissionSchema,
    requestFingerprint: z.string().trim().min(1).max(240),
    promptFingerprint: z.string().trim().min(1).max(240),
    providerIntentFingerprint: z.string().trim().min(1).max(240),
    sourceProposalFingerprint: z.string().trim().min(1).max(240),
    synthesisFingerprint: z.string().trim().min(1).max(240),
    structuralFingerprint: z.string().trim().min(1).max(240),
    candidateSnapshotFingerprint: z.string().trim().min(1).max(240),
    sourceProjectionFingerprint: z.string().regex(/^v1_\d+_[0-9a-f]{64}$/),
    operationProjectionFingerprint: z.string().regex(/^v1_\d+_[0-9a-f]{64}$/),
    resultingProjectionFingerprint: z.string().regex(/^v1_\d+_[0-9a-f]{64}$/),
    resultingSnapshotFingerprint: z.string().regex(/^v1_\d+_[0-9a-f]{64}$/),
    compiledDecisionFingerprint: z.string().trim().min(1).max(240),
    materializationAuthorityFingerprint: z.string().trim().min(1).max(240),
  })
  .strict();

export const aiStorefrontProposalSchema = z
  .object({
    id: z.string().regex(/^storefront_proposal_[a-f0-9]{8}$/),
    requestId: idSchema,
    projectId: idSchema,
    draftSnapshotId: idSchema,
    draftRevision: z.number().int().nonnegative(),
    target: aiStorefrontTargetSchema,
    originalStorefront: aiStorefrontProjectionSchema,
    proposedStorefront: aiStorefrontProjectionSchema,
    affectedPages: z.array(pageModelSchema).min(1),
    affectedDesignState: brandSystemSchema.partial().nullable(),
    permissionGrants: z.array(aiOperationPermissionGrantSchema),
    targetFingerprint: z.string().startsWith("storefront-target-"),
    permissionFingerprint: z.string().startsWith("storefront-permissions-"),
    operations: z.array(aiStorefrontOperationSchema),
    dynamicCommerceMigration: aiStorefrontDynamicCommerceMigrationSchema.optional(),
    wholeStorefrontGeneration: aiStorefrontWholeStorefrontGenerationSchema.optional(),
    assetPlacementOperations: z.array(approvedAssetPlacementOperationSchema).optional(),
    summary: localizedTextSchema,
    validation: proposalValidationResultSchema,
    status: z.enum(["pending", "accepted", "rejected"]),
  })
  .strict()
  .superRefine((proposal, context) => {
    if (proposal.dynamicCommerceMigration && proposal.wholeStorefrontGeneration) {
      context.addIssue({
        code: "custom",
        path: ["wholeStorefrontGeneration"],
        message: "A storefront proposal cannot declare two structural transitions.",
      });
    }
    if (proposal.wholeStorefrontGeneration) {
      const generation = proposal.wholeStorefrontGeneration;
      if (
        proposal.operations.length !== 0 ||
        proposal.permissionGrants.length !== 0 ||
        proposal.affectedDesignState !== null ||
        (proposal.assetPlacementOperations?.length ?? 0) !== 0
      ) {
        context.addIssue({
          code: "custom",
          path: ["wholeStorefrontGeneration"],
          message:
            "Canonical whole-storefront generation must use only its exact server-minted structural operation authority.",
        });
      }
      if (
        generation.target.projectId !== proposal.projectId ||
        generation.target.draftSnapshotId !== proposal.draftSnapshotId ||
        generation.target.draftRevision !== proposal.draftRevision ||
        generation.permission.target.projectId !== generation.target.projectId ||
        generation.permission.target.draftSnapshotId !== generation.target.draftSnapshotId ||
        generation.permission.target.draftRevision !== generation.target.draftRevision ||
        generation.candidateSnapshotFingerprint !== generation.resultingSnapshotFingerprint
      ) {
        context.addIssue({
          code: "custom",
          path: ["wholeStorefrontGeneration"],
          message:
            "Canonical whole-storefront generation operation, permission, proposal identity and candidate must match exactly.",
        });
      }
    } else if (proposal.operations.length === 0 || proposal.permissionGrants.length === 0) {
      context.addIssue({
        code: "custom",
        path: ["operations"],
        message: "Storefront edit proposals require operations and permission grants.",
      });
    }
  });

export const aiStorefrontReadyProposalSchema = aiStorefrontProposalSchema.superRefine(
  (proposal, context) => {
    if (!proposal.validation.valid) {
      context.addIssue({
        code: "custom",
        path: ["validation", "valid"],
        message: "Ready storefront proposals must have passed validation.",
      });
    }
    if (proposal.validation.errors.length > 0) {
      context.addIssue({
        code: "custom",
        path: ["validation", "errors"],
        message: "Ready storefront proposals cannot retain validation errors.",
      });
    }
  },
);

export type StorefrontDesignSystemTarget = z.infer<typeof storefrontDesignSystemTargetSchema>;
export type AiStorefrontSectionTarget = z.infer<typeof aiStorefrontSectionTargetSchema>;
export type AiStorefrontTarget = z.infer<typeof aiStorefrontTargetSchema>;
export type AiStorefrontProjection = z.infer<typeof aiStorefrontProjectionSchema>;
export type AiStorefrontContext = z.infer<typeof aiStorefrontContextSchema>;
export type AiStorefrontOperationTarget = z.infer<typeof aiStorefrontOperationTargetSchema>;
export type AiStorefrontOperation = z.infer<typeof aiStorefrontOperationSchema>;
export type AiStorefrontDynamicCommerceMigration = z.infer<
  typeof aiStorefrontDynamicCommerceMigrationSchema
>;
export type AiStorefrontWholeStorefrontGeneration = z.infer<
  typeof aiStorefrontWholeStorefrontGenerationSchema
>;
export type AiStorefrontProposal = z.infer<typeof aiStorefrontProposalSchema>;
export type AiStorefrontReadyProposal = z.infer<typeof aiStorefrontReadyProposalSchema>;
export type AiStorefrontPermissionGrant = z.infer<typeof aiOperationPermissionGrantSchema>;
export type AiStorefrontPermissionTarget = AiOperationPermissionTarget;
