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
import { exactBrandPalettePlanSchema } from "./brand-palette";
import { registeredTokenRefinementPlanSchema } from "./token-refinement";
import {
  approvedAssetPlacementOperationSchema,
  approvedGenerationAssetContextSchema,
  type ApprovedAssetPlacementOperation,
} from "./approved-asset-context";

export const storefrontGenerationCapabilitySchema = z.enum([
  "approvedColorTypographyDirection",
  "registeredWholeStorefrontDirection",
]);
export type StorefrontGenerationCapability = z.infer<typeof storefrontGenerationCapabilitySchema>;
export const storefrontStyleDirectionSchema = z.enum([
  "warmPremium",
  "minimalNordic",
  "exactBrandPalette",
  "registeredWholeStorefront",
]);
export const storefrontAssetReferenceCapabilitySchema = z.enum([
  "structuredApprovedAssets",
  "none",
]);

export interface StorefrontAIProvider {
  readonly id: string;
  readonly assetReferenceCapability?: z.infer<typeof storefrontAssetReferenceCapabilitySchema>;
  readonly generationCapabilities?: readonly StorefrontGenerationCapability[];
  proposeStorefront(request: AiStorefrontProviderRequest): Promise<unknown>;
}

export function storefrontProviderSupportsCapability(
  provider: StorefrontAIProvider,
  capability: StorefrontGenerationCapability,
): boolean {
  return provider.generationCapabilities?.includes(capability) === true;
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
    affectedPageIds: z.array(idSchema).min(1),
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
    requestedScope: z.enum(["storefront", "page"]),
    capability: storefrontGenerationCapabilitySchema,
    canonicalTokenRefinementPlan: registeredTokenRefinementPlanSchema.optional(),
    providerId: z.string().min(1).max(120),
    provider: storefrontProviderSchema,
    correlationRequestId: idSchema.optional(),
    importedContent: z.array(untrustedImportedContentSchema).default([]),
    approvedAssetContext: approvedGenerationAssetContextSchema.nullable().optional(),
    assetPlacementOperations: z.array(approvedAssetPlacementOperationSchema).optional(),
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
    if (command.requestedScope === "page") {
      if (command.affectedPageIds.length !== 1) {
        context.addIssue({
          code: "custom",
          path: ["affectedPageIds"],
          message: "A page-scoped storefront request must affect exactly one page.",
        });
      }
      const page = knownPages.get(command.affectedPageIds[0] ?? "");
      if (!page || page.type !== "home") {
        context.addIssue({
          code: "custom",
          path: ["affectedPageIds"],
          message: "The supported page-scoped storefront request must target the homepage.",
        });
      }
      if (command.designSystemTarget !== null) {
        context.addIssue({
          code: "custom",
          path: ["designSystemTarget"],
          message: "A homepage-only request cannot silently change the shared storefront frame.",
        });
      }
    }
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
    if (command.canonicalTokenRefinementPlan !== undefined) {
      if (command.requestedScope !== "storefront" || command.designSystemTarget === null) {
        context.addIssue({
          code: "custom",
          path: ["canonicalTokenRefinementPlan"],
          message: "A canonical token refinement requires storefront design-system authority.",
        });
      }
      if (
        command.capability === "approvedColorTypographyDirection" &&
        command.canonicalTokenRefinementPlan.spacing !== null
      ) {
        context.addIssue({
          code: "custom",
          path: ["canonicalTokenRefinementPlan", "spacing"],
          message: "Approved colour and typography authority cannot change spacing.",
        });
      }
    }
    if (command.provider.id !== command.providerId) {
      context.addIssue({
        code: "custom",
        path: ["providerId"],
        message: "The provider identity must match the supplied provider.",
      });
    }
    if (
      (command.approvedAssetContext === null || command.approvedAssetContext === undefined) &&
      (command.assetPlacementOperations?.length ?? 0) > 0
    ) {
      context.addIssue({
        code: "custom",
        path: ["assetPlacementOperations"],
        message: "Source-asset placements require an approved asset generation context.",
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
    requestedScope: z.enum(["storefront", "page"]),
    affectedPageIds: z.array(idSchema).min(1),
    sectionTargets: z.array(storefrontPlanSectionTargetSchema),
    designSystemTarget: z
      .object({ kind: z.literal("storefrontDesignSystem"), projectId: idSchema })
      .strict()
      .nullable(),
    brandPalettePlan: exactBrandPalettePlanSchema.nullable(),
    tokenRefinementPlan: registeredTokenRefinementPlanSchema.nullable(),
    explanation: localizedTextSchema,
    validation: proposalValidationResultSchema,
  })
  .strict()
  .superRefine((plan, context) => {
    if (
      plan.requestedScope === "page" &&
      (plan.direction !== "registeredWholeStorefront" ||
        plan.affectedPageIds.length !== 1 ||
        plan.designSystemTarget !== null)
    ) {
      context.addIssue({
        code: "custom",
        path: ["requestedScope"],
        message:
          "Homepage-only composition requires one registered direction, one homepage, and no shared design-system target.",
      });
    }
    if (plan.tokenRefinementPlan !== null) {
      if (
        plan.direction !== "registeredWholeStorefront" ||
        plan.brandPalettePlan !== null ||
        plan.designSystemTarget === null ||
        plan.sectionTargets.length > 0
      ) {
        context.addIssue({
          code: "custom",
          path: ["tokenRefinementPlan"],
          message:
            "Registered token refinements require one global target and no structural section operations.",
        });
      }
    } else if (plan.direction === "exactBrandPalette") {
      if (plan.brandPalettePlan === null) {
        context.addIssue({
          code: "custom",
          path: ["brandPalettePlan"],
          message: "Exact brand-palette plans require canonical colour values.",
        });
      }
      if (plan.designSystemTarget === null || plan.sectionTargets.length > 0) {
        context.addIssue({
          code: "custom",
          path: ["sectionTargets"],
          message: "Exact brand palettes require one global target and no section operations.",
        });
      }
    } else {
      if (plan.brandPalettePlan !== null) {
        context.addIssue({
          code: "custom",
          path: ["brandPalettePlan"],
          message: "Preset storefront directions cannot carry an exact palette plan.",
        });
      }
      if (plan.sectionTargets.length === 0) {
        context.addIssue({
          code: "custom",
          path: ["sectionTargets"],
          message: "Preset storefront directions require approved section targets.",
        });
      }
    }
  });

export const storefrontAffectedSectionContextSchema = z
  .object({ pageId: idSchema, section: sectionInstanceSchema })
  .strict();
export const storefrontComponentContractSchema = z
  .object({
    componentType: z.string().min(1).max(80),
    variants: z.array(z.string().min(1).max(80)).min(1),
    approvedStyleFields: z
      .array(z.enum(["variant", "background", "typography", "density", "shape"]))
      .min(1),
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
    affectedPages: z.array(pageModelSchema).min(1),
    affectedSections: z.array(storefrontAffectedSectionContextSchema),
    componentContracts: z.array(storefrontComponentContractSchema),
    designSystemContext: z
      .object({
        colors: brandSystemSchema.shape.colors,
        typography: brandSystemSchema.shape.typography,
      })
      .strict()
      .nullable(),
    brandPalettePlan: exactBrandPalettePlanSchema.nullable(),
    tokenRefinementPlan: registeredTokenRefinementPlanSchema.nullable(),
    permissionGrants: z.array(aiOperationPermissionGrantSchema).min(1),
    storefrontBaselineFingerprint: z.string().startsWith("storefront-baseline-"),
    targetFingerprint: z.string().startsWith("storefront-target-"),
    permissionFingerprint: z.string().startsWith("storefront-permissions-"),
    activeLocale: localeSchema,
    enabledLocales: z.array(localeSchema).min(1).max(2),
    protectedPaths: z.array(z.string().min(1)).min(1),
    untrustedImportedContent: z.array(labelledUntrustedContentSchema),
    assetReferenceCapability: storefrontAssetReferenceCapabilitySchema,
    approvedAssetContext: approvedGenerationAssetContextSchema.nullable(),
    assetPlacementOperations: z.array(approvedAssetPlacementOperationSchema),
    assetContextFingerprint: z.string().trim().min(1).nullable(),
    responseContract: z.literal("ai-storefront-proposal/v1"),
  })
  .strict()
  .superRefine((request, context) => {
    if (
      (request.approvedAssetContext === null &&
        (request.assetContextFingerprint !== null ||
          request.assetPlacementOperations.length > 0)) ||
      (request.approvedAssetContext !== null &&
        request.assetContextFingerprint !== request.approvedAssetContext.fingerprint)
    ) {
      context.addIssue({
        code: "custom",
        path: ["approvedAssetContext"],
        message: "Approved source-asset context and its fingerprint must match exactly.",
      });
    }
    if (request.assetReferenceCapability === "none" && request.approvedAssetContext !== null) {
      context.addIssue({
        code: "custom",
        path: ["assetReferenceCapability"],
        message: "Providers without asset-reference capability cannot receive source assets.",
      });
    }
    if (request.tokenRefinementPlan !== null) {
      const expectedOperationTypes =
        request.capability === "registeredWholeStorefrontDirection"
          ? (["APPLY_REGISTERED_BRAND_SYSTEM"] as const)
          : ([
              ...(request.tokenRefinementPlan.palette === null
                ? []
                : (["APPLY_APPROVED_BRAND_COLOURS"] as const)),
              ...(request.tokenRefinementPlan.typography === null
                ? []
                : (["APPLY_APPROVED_BRAND_TYPOGRAPHY"] as const)),
            ] as const);
      const tokenGrant = request.permissionGrants[0];
      if (
        request.brandPalettePlan !== null ||
        request.target.designSystemTarget === null ||
        request.affectedSections.length > 0 ||
        request.componentContracts.length > 0 ||
        request.permissionGrants.length !== 1 ||
        tokenGrant?.target.kind !== "storefrontDesignSystem" ||
        JSON.stringify(tokenGrant.operationTypes) !== JSON.stringify(expectedOperationTypes) ||
        (request.capability === "approvedColorTypographyDirection" &&
          (request.tokenRefinementPlan.spacing !== null || expectedOperationTypes.length === 0))
      ) {
        context.addIssue({
          code: "custom",
          path: ["tokenRefinementPlan"],
          message:
            "Token refinements may grant only their canonical global design-system operations.",
        });
      }
    } else if (request.brandPalettePlan === null) {
      if (request.affectedSections.length === 0 || request.componentContracts.length === 0) {
        context.addIssue({
          code: "custom",
          path: ["affectedSections"],
          message: "Preset storefront requests require approved section contracts.",
        });
      }
    } else {
      const paletteGrants = request.permissionGrants.filter(
        (grant) =>
          grant.target.kind === "storefrontDesignSystem" &&
          grant.operationTypes.length === 1 &&
          grant.operationTypes[0] === "APPLY_APPROVED_BRAND_COLOURS",
      );
      if (
        request.target.designSystemTarget === null ||
        request.affectedSections.length > 0 ||
        request.componentContracts.length > 0 ||
        request.permissionGrants.length !== 1 ||
        paletteGrants.length !== 1
      ) {
        context.addIssue({
          code: "custom",
          path: ["brandPalettePlan"],
          message: "Exact palette requests may grant only one global brand-colour operation.",
        });
      }
    }
  });

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
        authoritativePlanningFingerprint: z.string().trim().min(1).optional(),
        wholeStorefrontProposalFingerprint: z.string().trim().min(1).optional(),
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
  "assetCapabilityUnavailable",
  "permissionDenied",
  "authenticationUnavailable",
  "projectMismatch",
  "tenantMismatch",
  "internalFailure",
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
export type StorefrontAssetReferenceCapability = z.infer<
  typeof storefrontAssetReferenceCapabilitySchema
>;
export type PlannedApprovedAssetPlacementOperation = ApprovedAssetPlacementOperation;

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
  assetContextFingerprint?: string | null;
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
