import { z } from "zod";
import {
  aiOperationPermissionGrantSchema,
  untrustedImportedContentSchema,
} from "@/application/ai-provider";
import {
  aiStorefrontProjectionSchema,
  aiStorefrontProposalSchema,
  aiStorefrontTargetSchema,
} from "@/application/ai-storefront";
import { proposalValidationResultSchema } from "@/application/design-operations";
import { designOperationTypeSchema } from "@/application/design-skills";
import { brandSystemSchema } from "@/domain/design-system";
import { idSchema, localeSchema, localizedTextSchema } from "@/domain/shared";
import { pageModelSchema, sectionInstanceSchema } from "@/domain/storefront";

export const storefrontGenerationCapabilitySchema = z.literal("approvedColorTypographyDirection");
export const storefrontStyleDirectionSchema = z.enum(["warmPremium", "minimalNordic"]);

export interface StorefrontAIProvider {
  readonly id: string;
  proposeStorefront(request: AiStorefrontProviderRequest): Promise<unknown>;
}

const storefrontProviderSchema = z.custom<StorefrontAIProvider>(
  (value) =>
    typeof value === "object" &&
    value !== null &&
    "id" in value &&
    typeof value.id === "string" &&
    "proposeStorefront" in value &&
    typeof value.proposeStorefront === "function",
  "A valid storefront AI provider is required.",
);

export const aiStorefrontGenerationCommandSchema = z
  .object({
    projectId: idSchema,
    draftSnapshotId: idSchema,
    draftRevision: z.number().int().nonnegative(),
    storefront: aiStorefrontProjectionSchema,
    affectedPageIds: z.array(idSchema).min(2),
    affectedSectionTargets: z
      .array(z.object({ pageId: idSchema, sectionId: idSchema }).strict())
      .default([]),
    designSystemTarget: z
      .object({ kind: z.literal("storefrontDesignSystem"), projectId: idSchema })
      .strict()
      .nullable(),
    merchantInstruction: z.string().trim().min(1).max(2_000),
    activeLocale: localeSchema,
    enabledLocales: z.array(localeSchema).min(1).max(2),
    requestedScope: z.literal("storefront"),
    capability: storefrontGenerationCapabilitySchema,
    providerId: z.string().min(1).max(120),
    provider: storefrontProviderSchema,
    importedContent: z.array(untrustedImportedContentSchema).default([]),
  })
  .strict()
  .superRefine((command, context) => {
    if (!command.enabledLocales.includes(command.activeLocale)) {
      context.addIssue({
        code: "custom",
        path: ["activeLocale"],
        message: "The active locale must be enabled for the storefront.",
      });
    }
    if (new Set(command.enabledLocales).size !== command.enabledLocales.length) {
      context.addIssue({
        code: "custom",
        path: ["enabledLocales"],
        message: "Enabled storefront locales must be unique.",
      });
    }
    if (new Set(command.affectedPageIds).size !== command.affectedPageIds.length) {
      context.addIssue({
        code: "custom",
        path: ["affectedPageIds"],
        message: "Affected storefront page IDs must be unique.",
      });
    }
    const knownPages = new Map(command.storefront.pages.map((page) => [page.id, page]));
    command.affectedPageIds.forEach((pageId, index) => {
      if (!knownPages.has(pageId)) {
        context.addIssue({
          code: "custom",
          path: ["affectedPageIds", index],
          message: "Affected pages must exist in the canonical storefront projection.",
        });
      }
    });
    const affectedPageIds = new Set(command.affectedPageIds);
    const sectionIds = new Set<string>();
    command.affectedSectionTargets.forEach((target, index) => {
      if (!affectedPageIds.has(target.pageId)) {
        context.addIssue({
          code: "custom",
          path: ["affectedSectionTargets", index, "pageId"],
          message: "Affected sections must belong to an affected page.",
        });
      }
      const page = knownPages.get(target.pageId);
      if (!page?.sections.some((section) => section.id === target.sectionId)) {
        context.addIssue({
          code: "custom",
          path: ["affectedSectionTargets", index, "sectionId"],
          message: "Affected sections must exist on their declared page.",
        });
      }
      if (sectionIds.has(target.sectionId)) {
        context.addIssue({
          code: "custom",
          path: ["affectedSectionTargets", index, "sectionId"],
          message: "Affected section IDs must be unique across the storefront command.",
        });
      }
      sectionIds.add(target.sectionId);
    });
    if (
      command.designSystemTarget !== null &&
      command.designSystemTarget.projectId !== command.projectId
    ) {
      context.addIssue({
        code: "custom",
        path: ["designSystemTarget", "projectId"],
        message: "The design-system target must use the command project identity.",
      });
    }
    if (command.provider.id !== command.providerId) {
      context.addIssue({
        code: "custom",
        path: ["providerId"],
        message: "The provider identity must match the supplied provider.",
      });
    }
  });

export const storefrontPlanSectionTargetSchema = z
  .object({
    pageId: idSchema,
    sectionId: idSchema,
    componentType: z.string().min(1).max(80),
    operationTypes: z.array(designOperationTypeSchema).min(1),
  })
  .strict();

export const aiStorefrontGenerationPlanSchema = z
  .object({
    id: z.string().regex(/^storefront_plan_[a-f0-9]{8}$/),
    normalizedInstruction: z.string().min(1),
    direction: storefrontStyleDirectionSchema,
    skillId: z.string().min(1),
    skillVersion: z.string().regex(/^\d+\.\d+\.\d+$/),
    requestedScope: z.literal("storefront"),
    affectedPageIds: z.array(idSchema).min(2),
    sectionTargets: z.array(storefrontPlanSectionTargetSchema).min(1),
    designSystemTarget: z
      .object({ kind: z.literal("storefrontDesignSystem"), projectId: idSchema })
      .strict()
      .nullable(),
    explanation: localizedTextSchema,
    validation: proposalValidationResultSchema,
  })
  .strict();

export const storefrontAffectedSectionContextSchema = z
  .object({ pageId: idSchema, section: sectionInstanceSchema })
  .strict();
export const storefrontComponentContractSchema = z
  .object({
    componentType: z.string().min(1).max(80),
    variants: z.array(z.string().min(1).max(80)).min(1),
    approvedStyleFields: z.array(z.enum(["background", "typography"])).min(1),
  })
  .strict();
export const labelledUntrustedContentSchema = untrustedImportedContentSchema.extend({
  trust: z.literal("untrusted"),
});

export const aiStorefrontProviderRequestSchema = z
  .object({
    requestId: idSchema,
    requestSequence: z.number().int().positive(),
    providerId: z.string().min(1).max(120),
    capability: storefrontGenerationCapabilitySchema,
    instruction: z.string().trim().min(1).max(2_000),
    target: aiStorefrontTargetSchema,
    storefront: aiStorefrontProjectionSchema,
    affectedPages: z.array(pageModelSchema).min(2),
    affectedSections: z.array(storefrontAffectedSectionContextSchema).min(1),
    componentContracts: z.array(storefrontComponentContractSchema).min(1),
    designSystemContext: z
      .object({
        colors: brandSystemSchema.shape.colors,
        typography: brandSystemSchema.shape.typography,
      })
      .strict()
      .nullable(),
    permissionGrants: z.array(aiOperationPermissionGrantSchema).min(1),
    targetFingerprint: z.string().startsWith("storefront-target-"),
    permissionFingerprint: z.string().startsWith("storefront-permissions-"),
    activeLocale: localeSchema,
    enabledLocales: z.array(localeSchema).min(1).max(2),
    protectedPaths: z.array(z.string().min(1)).min(1),
    untrustedImportedContent: z.array(labelledUntrustedContentSchema),
    responseContract: z.literal("ai-storefront-proposal/v1"),
  })
  .strict();

export const aiStorefrontProviderResponseSchema = z
  .object({
    providerRequestId: idSchema,
    providerId: z.string().min(1).max(120),
    proposal: aiStorefrontProposalSchema,
    metadata: z
      .object({
        operationCount: z.number().int().nonnegative(),
        durationMs: z.number().nonnegative(),
        validation: z.enum(["valid", "invalid"]),
      })
      .strict(),
  })
  .strict();

export const aiStorefrontGenerationStateSchema = z.enum([
  "idle",
  "generating",
  "ready",
  "failed",
  "stale",
  "superseded",
]);
export const aiStorefrontGenerationFailureCodeSchema = z.enum([
  "invalidCommand",
  "unsupportedRequest",
  "providerUnavailable",
  "validationFailed",
  "staleDraft",
  "staleTarget",
  "superseded",
]);
export const aiStorefrontGenerationFailureSchema = z
  .object({
    code: aiStorefrontGenerationFailureCodeSchema,
    message: localizedTextSchema,
    retryable: z.boolean(),
  })
  .strict();

export type AiStorefrontGenerationCommand = z.infer<typeof aiStorefrontGenerationCommandSchema>;
export type AiStorefrontGenerationPlan = z.infer<typeof aiStorefrontGenerationPlanSchema>;
export type AiStorefrontProviderRequest = z.infer<typeof aiStorefrontProviderRequestSchema>;
export type AiStorefrontProviderResponse = z.infer<typeof aiStorefrontProviderResponseSchema>;
export type AiStorefrontGenerationFailure = z.infer<typeof aiStorefrontGenerationFailureSchema>;
export type AiStorefrontGenerationState = z.infer<typeof aiStorefrontGenerationStateSchema>;

export type AiStorefrontGenerationEvent = Readonly<{
  name:
    | "storefront_prompt_submitted"
    | "storefront_proposal_generated"
    | "storefront_generation_failed"
    | "storefront_generation_stale"
    | "storefront_generation_superseded";
  projectId: string;
  requestId?: string;
  requestSequence?: number;
  providerId?: string;
  targetFingerprint?: string;
  affectedPageCount?: number;
  operationCount?: number;
  durationMs?: number;
  validation?: "valid" | "invalid";
  failureCode?: AiStorefrontGenerationFailure["code"];
}>;

export interface AiStorefrontGenerationAnalytics {
  record(event: AiStorefrontGenerationEvent): void;
}

export type AiStorefrontGenerationIdentity = Readonly<{
  context: {
    projectId: string;
    draftSnapshotId: string;
    draftRevision: number;
    enabledLocales: readonly ("en" | "fi")[];
    activeLocale: "en" | "fi";
    storefront: z.infer<typeof aiStorefrontProjectionSchema>;
  };
  target: z.infer<typeof aiStorefrontTargetSchema>;
}>;

export type AiStorefrontGenerationResult =
  | Readonly<{
      state: "ready";
      proposal: z.infer<typeof aiStorefrontProposalSchema>;
      failure: null;
    }>
  | Readonly<{
      state: "failed" | "stale" | "superseded";
      proposal: null;
      failure: AiStorefrontGenerationFailure;
    }>;
