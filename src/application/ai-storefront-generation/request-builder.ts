import {
  canonicalizeAiStorefrontPermissionGrants,
  canonicalizeAiStorefrontTarget,
  createAiStorefrontPermissionFingerprint,
  createAiStorefrontBaselineFingerprint,
  createAiStorefrontTargetFingerprint,
  type AiStorefrontContext,
} from "@/application/ai-storefront";
import type { AiOperationPermissionGrant } from "@/application/ai-provider";
import { designSkillRegistry, protectedDesignPaths } from "@/application/design-skills";
import { getComponentDefinition } from "@/components/registry";
import { veskifyComponentDefinitionsV2 } from "@/components/registry/v2-registry";
import { canonicalLocaleOrder } from "@/domain/shared";
import { canonicalValueFingerprint, canonicalValueString } from "@/domain/storefront";
import {
  aiStorefrontGenerationCommandSchema,
  aiStorefrontProviderRequestSchema,
  storefrontProviderSupportsCapability,
  type AiStorefrontGenerationCommand,
  type AiStorefrontProviderRequest,
} from "./contract";
import { validateApprovedAssetPlacementOperations } from "./approved-asset-context";
import {
  AiStorefrontPlanError,
  classifyRegisteredWholeStorefrontDirectionRequest,
  createAiStorefrontGenerationPlan,
  normalizeStorefrontInstruction,
} from "./planner";
import { planRegisteredTokenRefinement } from "./token-refinement";

export class AiStorefrontRequestBuildError extends Error {
  constructor(
    readonly code:
      | "invalid-command"
      | "unsupported-request"
      | "ambiguous-request"
      | "target-mismatch"
      | "asset-capability-unavailable",
    message: string,
  ) {
    super(message);
    this.name = "AiStorefrontRequestBuildError";
  }
}

export function parseAiStorefrontGenerationCommand(input: unknown): AiStorefrontGenerationCommand {
  const result = aiStorefrontGenerationCommandSchema.safeParse(input);
  if (!result.success) {
    throw new AiStorefrontRequestBuildError(
      "invalid-command",
      "The storefront generation command is incomplete or invalid.",
    );
  }
  return {
    ...result.data,
    storefront: structuredClone(result.data.storefront),
    affectedPageIds: [...result.data.affectedPageIds].sort((left, right) =>
      left.localeCompare(right),
    ),
    affectedSectionTargets: [...result.data.affectedSectionTargets].sort(
      (left, right) =>
        left.pageId.localeCompare(right.pageId) || left.sectionId.localeCompare(right.sectionId),
    ),
    enabledLocales: canonicalLocaleOrder(result.data.enabledLocales),
    ...(result.data.correlationRequestId === undefined
      ? {}
      : { correlationRequestId: result.data.correlationRequestId }),
    importedContent: structuredClone(result.data.importedContent),
    approvedAssetContext:
      result.data.approvedAssetContext === undefined || result.data.approvedAssetContext === null
        ? null
        : structuredClone(result.data.approvedAssetContext),
    assetPlacementOperations: [...(result.data.assetPlacementOperations ?? [])].sort(
      (left, right) =>
        left.pageId.localeCompare(right.pageId) ||
        left.componentType.localeCompare(right.componentType) ||
        left.assetSlotId.localeCompare(right.assetSlotId) ||
        left.assetId.localeCompare(right.assetId),
    ),
  };
}

function storefrontContext(command: AiStorefrontGenerationCommand): AiStorefrontContext {
  return {
    projectId: command.projectId,
    draftSnapshotId: command.draftSnapshotId,
    draftRevision: command.draftRevision,
    enabledLocales: command.enabledLocales,
    activeLocale: command.activeLocale,
    storefront: structuredClone(command.storefront),
  };
}

export function buildAiStorefrontProviderRequest(
  commandInput: unknown,
  requestSequence: number,
): AiStorefrontProviderRequest {
  const command = parseAiStorefrontGenerationCommand(commandInput);
  const providerAssetCapability = command.provider.assetReferenceCapability ?? "none";
  let approvedAssetContext = command.approvedAssetContext ?? null;
  let assetPlacementOperations = command.assetPlacementOperations ?? [];
  let plan;
  try {
    plan = createAiStorefrontGenerationPlan(command);
  } catch (error) {
    if (error instanceof AiStorefrontPlanError) {
      throw new AiStorefrontRequestBuildError(
        error.code === "target-mismatch"
          ? "target-mismatch"
          : error.code === "ambiguous-request"
            ? "ambiguous-request"
            : "unsupported-request",
        error.message,
      );
    }
    throw error;
  }
  const target = canonicalizeAiStorefrontTarget({
    scope: plan.requestedScope,
    projectId: command.projectId,
    draftSnapshotId: command.draftSnapshotId,
    draftRevision: command.draftRevision,
    affectedPageIds: plan.affectedPageIds,
    affectedSectionTargets: plan.sectionTargets.map(({ pageId, sectionId }) => ({
      pageId,
      sectionId,
    })),
    designSystemTarget: plan.designSystemTarget,
    enabledLocales: command.enabledLocales,
    activeLocale: command.activeLocale,
  });
  if (approvedAssetContext !== null) {
    try {
      assetPlacementOperations = validateApprovedAssetPlacementOperations({
        context: approvedAssetContext,
        operations: assetPlacementOperations,
        componentDefinitions: veskifyComponentDefinitionsV2,
        target: {
          affectedPageIds: target.affectedPageIds,
          pages: command.storefront.pages.map((page) => ({
            id: page.id,
            sections: page.sections.map((section) => ({
              id: section.id,
              component: section.component,
              visible: section.visible,
            })),
          })),
        },
      });
    } catch (error) {
      if (error instanceof Error) {
        throw new AiStorefrontRequestBuildError("unsupported-request", error.message);
      }
      throw error;
    }
    if (providerAssetCapability === "none") {
      if (assetPlacementOperations.some((operation) => operation.required)) {
        throw new AiStorefrontRequestBuildError(
          "asset-capability-unavailable",
          "This storefront design assistant cannot use required approved source assets.",
        );
      }
      approvedAssetContext = null;
      assetPlacementOperations = [];
    }
  }
  const skill = designSkillRegistry.get(plan.skillId);
  const grants: AiOperationPermissionGrant[] = plan.sectionTargets.map((sectionTarget) => ({
    skillId: skill.id,
    skillVersion: skill.version,
    skillScope: skill.scope,
    operationTypes: sectionTarget.operationTypes,
    target: {
      kind: "existingSection" as const,
      pageId: sectionTarget.pageId,
      sectionId: sectionTarget.sectionId,
      componentType: sectionTarget.componentType,
    },
  }));
  if (
    (target.designSystemTarget !== null || plan.direction === "registeredWholeStorefront") &&
    plan.brandPalettePlan === null &&
    plan.tokenRefinementPlan === null
  ) {
    target.affectedPageIds.forEach((pageId) => {
      grants.push({
        skillId: skill.id,
        skillVersion: skill.version,
        skillScope: skill.scope,
        operationTypes: ["APPLY_REGISTERED_PAGE_SECTIONS", "REORDER_SECTIONS"],
        target: { kind: "page", pageId },
      });
    });
  }
  if (target.designSystemTarget !== null) {
    grants.push({
      skillId: skill.id,
      skillVersion: skill.version,
      skillScope: skill.scope,
      operationTypes:
        plan.brandPalettePlan !== null
          ? ["APPLY_APPROVED_BRAND_COLOURS"]
          : plan.tokenRefinementPlan !== null &&
              command.capability === "approvedColorTypographyDirection"
            ? [
                ...(plan.tokenRefinementPlan.palette === null
                  ? []
                  : (["APPLY_APPROVED_BRAND_COLOURS"] as const)),
                ...(plan.tokenRefinementPlan.typography === null
                  ? []
                  : (["APPLY_APPROVED_BRAND_TYPOGRAPHY"] as const)),
              ]
            : plan.direction === "registeredWholeStorefront"
              ? ["APPLY_REGISTERED_BRAND_SYSTEM"]
              : ["APPLY_APPROVED_BRAND_COLOURS", "APPLY_APPROVED_BRAND_TYPOGRAPHY"],
      target: target.designSystemTarget,
    });
  }
  const context = storefrontContext(command);
  const permissionGrants = canonicalizeAiStorefrontPermissionGrants(grants, target, context);
  const targetFingerprint = createAiStorefrontTargetFingerprint(context, target);
  const permissionFingerprint = createAiStorefrontPermissionFingerprint(
    permissionGrants,
    target,
    context,
  );
  const storefrontBaselineFingerprint = createAiStorefrontBaselineFingerprint(context);
  const pagesById = new Map(command.storefront.pages.map((page) => [page.id, page]));
  const affectedPages = target.affectedPageIds.map((pageId) =>
    structuredClone(pagesById.get(pageId)!),
  );
  const affectedSections = plan.sectionTargets.map((targetSection) => ({
    pageId: targetSection.pageId,
    section: structuredClone(
      pagesById
        .get(targetSection.pageId)!
        .sections.find((section) => section.id === targetSection.sectionId)!,
    ),
  }));
  const componentContracts = [
    ...new Set(plan.sectionTargets.map((sectionTarget) => sectionTarget.componentType)),
  ]
    .sort((left, right) => left.localeCompare(right))
    .map((componentType) => {
      const definition = getComponentDefinition(componentType);
      const operationTypes = plan.sectionTargets
        .filter((targetSection) => targetSection.componentType === componentType)
        .flatMap((targetSection) => targetSection.operationTypes);
      return {
        componentType,
        variants: [...definition.variants],
        approvedStyleFields: [
          ...(operationTypes.includes("CHANGE_SECTION_VARIANT") ? (["variant"] as const) : []),
          ...(operationTypes.includes("CHANGE_BACKGROUND") ? (["background"] as const) : []),
          ...(operationTypes.includes("CHANGE_TYPOGRAPHY") ? (["typography"] as const) : []),
          ...(operationTypes.includes("CHANGE_DENSITY") ? (["density"] as const) : []),
          ...(operationTypes.includes("CHANGE_SHAPE") ? (["shape"] as const) : []),
        ],
      };
    });
  const requestId =
    command.correlationRequestId ??
    `storefront_request_${canonicalValueFingerprint({
      requestSequence,
      providerId: command.providerId,
      normalizedInstruction: plan.normalizedInstruction,
      storefrontBaselineFingerprint,
      targetFingerprint,
      permissionFingerprint,
      importedContent: command.importedContent,
      assetContextFingerprint: approvedAssetContext?.fingerprint ?? null,
      assetPlacementOperations,
    }).slice(-8)}`;
  return aiStorefrontProviderRequestSchema.parse({
    requestId,
    requestSequence,
    providerId: command.providerId,
    capability: command.capability,
    instruction: command.merchantInstruction,
    target,
    storefront: structuredClone(command.storefront),
    affectedPages,
    affectedSections,
    componentContracts,
    designSystemContext:
      target.designSystemTarget === null
        ? null
        : {
            colors: structuredClone(command.storefront.brandSystem.colors),
            typography: structuredClone(command.storefront.brandSystem.typography),
          },
    brandPalettePlan: plan.brandPalettePlan,
    tokenRefinementPlan: plan.tokenRefinementPlan,
    permissionGrants,
    storefrontBaselineFingerprint,
    targetFingerprint,
    permissionFingerprint,
    activeLocale: command.activeLocale,
    enabledLocales: command.enabledLocales,
    protectedPaths: [...protectedDesignPaths],
    untrustedImportedContent: command.importedContent.map((item) => ({
      ...item,
      trust: "untrusted" as const,
    })),
    assetReferenceCapability: providerAssetCapability,
    approvedAssetContext,
    assetPlacementOperations,
    assetContextFingerprint: approvedAssetContext?.fingerprint ?? null,
    responseContract: "ai-storefront-proposal/v1",
  });
}

export type AiStorefrontCapabilitySelectionInput = Omit<
  AiStorefrontGenerationCommand,
  "capability" | "canonicalTokenRefinementPlan"
>;

export function buildAiStorefrontProviderRequestForSupportedCapability(
  commandInput: AiStorefrontCapabilitySelectionInput,
  requestSequence: number,
): {
  command: AiStorefrontGenerationCommand;
  request: AiStorefrontProviderRequest;
} {
  const supportsRegistered = storefrontProviderSupportsCapability(
    commandInput.provider,
    "registeredWholeStorefrontDirection",
  );
  const supportsDesignSystem = storefrontProviderSupportsCapability(
    commandInput.provider,
    "approvedColorTypographyDirection",
  );
  if (!supportsRegistered && supportsDesignSystem) {
    let tokenRefinementPlan;
    try {
      tokenRefinementPlan = planRegisteredTokenRefinement(
        commandInput.merchantInstruction,
        commandInput.storefront.brandSystem,
      );
    } catch (error) {
      throw new AiStorefrontRequestBuildError(
        "unsupported-request",
        error instanceof Error ? error.message : "The storefront request is unsupported.",
      );
    }
    if (
      tokenRefinementPlan !== null &&
      tokenRefinementPlan.spacing === null &&
      (tokenRefinementPlan.palette !== null || tokenRefinementPlan.typography !== null)
    ) {
      const selectedCommand = {
        ...commandInput,
        capability: "approvedColorTypographyDirection" as const,
        canonicalTokenRefinementPlan: tokenRefinementPlan,
      } satisfies AiStorefrontGenerationCommand;
      return {
        command: selectedCommand,
        request: buildAiStorefrontProviderRequest(selectedCommand, requestSequence),
      };
    }
  }
  if (supportsRegistered) {
    let registeredClassification;
    try {
      registeredClassification = classifyRegisteredWholeStorefrontDirectionRequest(
        commandInput.merchantInstruction,
        commandInput.storefront.brandSystem,
      );
    } catch (error) {
      throw new AiStorefrontRequestBuildError(
        "unsupported-request",
        error instanceof Error ? error.message : "The storefront request is unsupported.",
      );
    }
    if (registeredClassification.kind === "token-refinement") {
      const designSystemOnly =
        registeredClassification.plan.spacing === null &&
        (registeredClassification.plan.palette !== null ||
          registeredClassification.plan.typography !== null);
      if (designSystemOnly && !supportsDesignSystem) {
        throw new AiStorefrontRequestBuildError(
          "unsupported-request",
          "This storefront design provider does not support approved colour and typography changes.",
        );
      }
      const selectedCommand = {
        ...commandInput,
        capability: designSystemOnly
          ? ("approvedColorTypographyDirection" as const)
          : ("registeredWholeStorefrontDirection" as const),
        canonicalTokenRefinementPlan: registeredClassification.plan,
      } satisfies AiStorefrontGenerationCommand;
      return {
        command: selectedCommand,
        request: buildAiStorefrontProviderRequest(selectedCommand, requestSequence),
      };
    }
    if (
      registeredClassification.kind === "selected" ||
      registeredClassification.kind === "structural"
    ) {
      const registeredCommand = {
        ...commandInput,
        capability: "registeredWholeStorefrontDirection" as const,
      } satisfies AiStorefrontGenerationCommand;
      return {
        command: registeredCommand,
        request: buildAiStorefrontProviderRequest(registeredCommand, requestSequence),
      };
    }
    if (registeredClassification.kind === "ambiguous") {
      throw new AiStorefrontRequestBuildError(
        "ambiguous-request",
        "Choose one whole-storefront structural direction or one design-system-only change.",
      );
    }
    if (registeredClassification.kind === "mixed") {
      throw new AiStorefrontRequestBuildError(
        "ambiguous-request",
        "Submit the structural redesign and global colour or typography change separately.",
      );
    }
    if (registeredClassification.kind === "protected-commerce") {
      throw new AiStorefrontRequestBuildError(
        "unsupported-request",
        "Protected commerce data cannot be changed by a storefront design proposal.",
      );
    }
  }

  if (!supportsDesignSystem) {
    throw new AiStorefrontRequestBuildError(
      "unsupported-request",
      "This storefront design provider does not support approved colour and typography changes.",
    );
  }

  const legacyCommand = {
    ...commandInput,
    capability: "approvedColorTypographyDirection" as const,
  } satisfies AiStorefrontGenerationCommand;
  return {
    command: legacyCommand,
    request: buildAiStorefrontProviderRequest(legacyCommand, requestSequence),
  };
}

export function aiStorefrontPendingRequestKey(request: AiStorefrontProviderRequest): string {
  const identity: Partial<AiStorefrontProviderRequest> = {
    ...request,
    instruction: normalizeStorefrontInstruction(request.instruction),
  };
  delete identity.requestId;
  delete identity.requestSequence;
  return canonicalValueString(identity);
}
