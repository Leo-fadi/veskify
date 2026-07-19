import { z } from "zod";
import { designOperationSchema } from "@/application/design-operations";
import { localeSchema, localizedTextSchema } from "@/domain/shared";
import { brandSystemSchema } from "@/domain/design-system";
import { pageModelSchema, type PageModel } from "@/domain/storefront";
import type { DesignSkillScope } from "@/application/design-skills";
import type { StorefrontRenderContext } from "@/components/registry";

export const aiProviderTargetSchema = z
  .object({ pageId: z.string().min(1), sectionId: z.string().min(1).optional() })
  .strict();

export const untrustedImportedContentSchema = z
  .object({ source: z.string().min(1).max(120), content: z.string().max(20_000) })
  .strict();

export const aiOperationRequestSchema = z
  .object({
    projectId: z.string().min(1),
    draftSnapshotId: z.string().min(1),
    draftRevision: z.number().int().nonnegative(),
    target: aiProviderTargetSchema,
    instruction: z.string().trim().min(1).max(2_000),
    allowedComponentTypes: z.array(z.string().min(1)).min(1),
    allowedOperationTypes: z.array(z.string().min(1)).min(1),
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
  .strict();

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
export type AiProviderResponse = z.infer<typeof aiProviderResponseSchema>;
export type AiProviderDiagnostic = z.infer<typeof aiProviderDiagnosticSchema>;

export interface AIProvider {
  proposeChange(request: AiOperationRequest): Promise<unknown>;
}

export type ValidatedAiProposal = AiProviderResponse & { proposedPage: PageModel };
