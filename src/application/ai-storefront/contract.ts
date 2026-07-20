import { z } from "zod";
import { aiOperationPermissionGrantSchema } from "@/application/ai-provider";
import type { AiOperationPermissionTarget } from "@/application/ai-provider";
import {
  designOperationSchema,
  proposalValidationResultSchema,
} from "@/application/design-operations";
import { brandSystemSchema } from "@/domain/design-system";
import { idSchema, localeSchema, localizedTextSchema } from "@/domain/shared";
import { navigationModelSchema, pageModelSchema } from "@/domain/storefront";

export const storefrontDesignSystemTargetSchema = z
  .object({ kind: z.literal("storefrontDesignSystem"), projectId: idSchema })
  .strict();

export const aiStorefrontSectionTargetSchema = z
  .object({ pageId: idSchema, sectionId: idSchema })
  .strict();

export const aiStorefrontTargetSchema = z
  .object({
    scope: z.literal("storefront"),
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
    for (const [area, items] of Object.entries(projection.navigation)) {
      items.forEach((item, index) => {
        if (item.target.type === "page" && !knownPageIds.has(item.target.pageId)) {
          context.addIssue({
            code: "custom",
            path: ["navigation", area, index, "target", "pageId"],
            message: "Navigation targets must resolve to a projected page.",
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
    permissionGrants: z.array(aiOperationPermissionGrantSchema).min(1),
    targetFingerprint: z.string().startsWith("storefront-target-"),
    permissionFingerprint: z.string().startsWith("storefront-permissions-"),
    operations: z.array(aiStorefrontOperationSchema).min(1),
    summary: localizedTextSchema,
    validation: proposalValidationResultSchema,
    status: z.enum(["pending", "accepted", "rejected"]),
  })
  .strict();

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
export type AiStorefrontProposal = z.infer<typeof aiStorefrontProposalSchema>;
export type AiStorefrontReadyProposal = z.infer<typeof aiStorefrontReadyProposalSchema>;
export type AiStorefrontPermissionGrant = z.infer<typeof aiOperationPermissionGrantSchema>;
export type AiStorefrontPermissionTarget = AiOperationPermissionTarget;
