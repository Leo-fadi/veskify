import { z } from "zod";
import { designOperationSchema } from "@/application/design-operations";
import { localeSchema, localizedTextSchema } from "@/domain/shared";
import { brandSystemSchema } from "@/domain/design-system";
import { pageModelSchema, type PageModel } from "@/domain/storefront";
import {
  designOperationTypeSchema,
  designSkillScopeSchema,
  type DesignSkillScope,
} from "@/application/design-skills";
import type { StorefrontRenderContext } from "@/components/registry";

export const aiProviderTargetSchema = z
  .object({ pageId: z.string().min(1), sectionId: z.string().min(1).optional() })
  .strict();

export const untrustedImportedContentSchema = z
  .object({ source: z.string().min(1).max(120), content: z.string().max(20_000) })
  .strict();

export const aiOperationPermissionTargetSchema = z.discriminatedUnion("kind", [
  z
    .object({
      kind: z.literal("existingSection"),
      pageId: z.string().min(1),
      sectionId: z.string().min(1),
      componentType: z.string().min(1),
    })
    .strict(),
  z
    .object({
      kind: z.literal("introducedSection"),
      pageId: z.string().min(1),
      sectionId: z.string().min(1),
      componentType: z.string().min(1),
    })
    .strict(),
  z.object({ kind: z.literal("page"), pageId: z.string().min(1) }).strict(),
  z.object({ kind: z.literal("storefrontDesignSystem"), projectId: z.string().min(1) }).strict(),
]);

export const aiOperationPermissionGrantSchema = z
  .object({
    skillId: z.string().min(1),
    skillVersion: z.string().regex(/^\d+\.\d+\.\d+$/),
    skillScope: designSkillScopeSchema,
    operationTypes: z.array(designOperationTypeSchema).min(1),
    target: aiOperationPermissionTargetSchema,
  })
  .strict();

export const aiOperationRequestSchema = z
  .object({
    projectId: z.string().min(1),
    draftSnapshotId: z.string().min(1),
    draftRevision: z.number().int().nonnegative(),
    target: aiProviderTargetSchema,
    instruction: z.string().trim().min(1).max(2_000),
    allowedComponentTypes: z.array(z.string().min(1)).min(1),
    allowedOperationTypes: z.array(designOperationTypeSchema).min(1),
    permissionGrants: z.array(aiOperationPermissionGrantSchema).min(1),
    locale: localeSchema,
    locales: z.array(localeSchema).min(1),
    page: pageModelSchema,
    brandSystem: brandSystemSchema,
    displayContext: z.custom<StorefrontRenderContext>(),
    scope: z.enum([
      "section",
      "page",
      "storefront",
      "brand",
      "cataloguePresentation",
    ] satisfies DesignSkillScope[]),
    importedContent: z.array(untrustedImportedContentSchema).default([]),
  })
  .strict()
  .superRefine((request, context) => {
    if (!request.locales.includes(request.locale)) {
      context.addIssue({
        code: "custom",
        path: ["locale"],
        message: "The active locale must be one of the enabled storefront locales.",
      });
    }
    if (request.scope === "section" && request.target.sectionId === undefined) {
      context.addIssue({
        code: "custom",
        path: ["target", "sectionId"],
        message: "Section-scoped requests require a selected section.",
      });
    }
    request.permissionGrants.forEach((grant, index) => {
      const grantPath = ["permissionGrants", index] as const;
      const grantTarget = grant.target;
      if (grantTarget.kind === "storefrontDesignSystem") {
        context.addIssue({
          code: "custom",
          path: [...grantPath, "target"],
          message: "Single-page provider requests cannot use storefront-level grants.",
        });
        return;
      }
      if (grantTarget.pageId !== request.page.id) {
        context.addIssue({
          code: "custom",
          path: [...grantPath, "target", "pageId"],
          message: "Permission grants must target the canonical request page.",
        });
      }
      for (const operationType of grant.operationTypes) {
        if (!request.allowedOperationTypes.includes(operationType)) {
          context.addIssue({
            code: "custom",
            path: [...grantPath, "operationTypes"],
            message: "Permission grants cannot widen the request operation allow-list.",
          });
        }
      }
      if (grantTarget.kind !== "page") {
        if (!request.allowedComponentTypes.includes(grantTarget.componentType)) {
          context.addIssue({
            code: "custom",
            path: [...grantPath, "target", "componentType"],
            message: "Permission grants cannot widen the request component allow-list.",
          });
        }
        const existing = request.page.sections.find(
          (section) => section.id === grantTarget.sectionId,
        );
        if (
          grantTarget.kind === "existingSection" &&
          (existing === undefined || existing.component !== grantTarget.componentType)
        ) {
          context.addIssue({
            code: "custom",
            path: [...grantPath, "target"],
            message: "Existing-section grants must match the canonical page section.",
          });
        }
        if (grantTarget.kind === "introducedSection" && existing !== undefined) {
          context.addIssue({
            code: "custom",
            path: [...grantPath, "target", "sectionId"],
            message: "Introduced-section grants require a new section identity.",
          });
        }
        if (request.scope === "section" && grantTarget.sectionId !== request.target.sectionId) {
          context.addIssue({
            code: "custom",
            path: [...grantPath, "target", "sectionId"],
            message: "Section-scoped grants must match the selected request section.",
          });
        }
      }
    });
  });

export const aiProviderDiagnosticSchema = z
  .object({
    code: z.string().min(1),
    severity: z.enum(["info", "warning", "error"]),
    message: z.string().min(1),
  })
  .strict();

export const aiProviderResponseSchema = z
  .object({
    providerRequestId: z.string().min(1),
    providerId: z.string().min(1),
    operations: z.array(designOperationSchema),
    diagnostics: z.array(aiProviderDiagnosticSchema),
    explanation: localizedTextSchema.optional(),
    metadata: z
      .object({
        operationCount: z.number().int().nonnegative(),
        durationMs: z.number().nonnegative(),
        validation: z.enum(["valid", "invalid"]),
      })
      .strict(),
  })
  .strict();

export type AiOperationRequest = z.infer<typeof aiOperationRequestSchema>;
export type AiOperationPermissionTarget = z.infer<typeof aiOperationPermissionTargetSchema>;
export type AiOperationPermissionGrant = z.infer<typeof aiOperationPermissionGrantSchema>;
export type AiProviderResponse = z.infer<typeof aiProviderResponseSchema>;
export type AiProviderDiagnostic = z.infer<typeof aiProviderDiagnosticSchema>;

export type AiProviderRequestOptions = Readonly<{
  signal?: AbortSignal;
}>;

export interface AIProvider {
  proposeChange(request: AiOperationRequest, options?: AiProviderRequestOptions): Promise<unknown>;
}

export type ValidatedAiProposal = AiProviderResponse & { proposedPage: PageModel };
