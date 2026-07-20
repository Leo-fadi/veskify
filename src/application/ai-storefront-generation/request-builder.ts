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
import { canonicalLocaleOrder } from "@/domain/shared";
import { canonicalValueFingerprint, canonicalValueString } from "@/domain/storefront";
import {
  aiStorefrontGenerationCommandSchema,
  aiStorefrontProviderRequestSchema,
  type AiStorefrontGenerationCommand,
  type AiStorefrontProviderRequest,
} from "./contract";
import {
  AiStorefrontPlanError,
  createAiStorefrontGenerationPlan,
  normalizeStorefrontInstruction,
} from "./planner";

export class AiStorefrontRequestBuildError extends Error {
  constructor(
    readonly code: "invalid-command" | "unsupported-request" | "target-mismatch",
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
    importedContent: structuredClone(result.data.importedContent),
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
  let plan;
  try {
    plan = createAiStorefrontGenerationPlan(command);
  } catch (error) {
    if (error instanceof AiStorefrontPlanError) {
      throw new AiStorefrontRequestBuildError(
        error.code === "target-mismatch" ? "target-mismatch" : "unsupported-request",
        error.message,
      );
    }
    throw error;
  }
  const target = canonicalizeAiStorefrontTarget({
    scope: "storefront",
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
  if (target.designSystemTarget !== null) {
    grants.push({
      skillId: skill.id,
      skillVersion: skill.version,
      skillScope: skill.scope,
      operationTypes: ["APPLY_APPROVED_BRAND_COLOURS", "APPLY_APPROVED_BRAND_TYPOGRAPHY"],
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
          ...(operationTypes.includes("CHANGE_BACKGROUND") ? (["background"] as const) : []),
          ...(operationTypes.includes("CHANGE_TYPOGRAPHY") ? (["typography"] as const) : []),
        ],
      };
    });
  const requestId = `storefront_request_${canonicalValueFingerprint({
    requestSequence,
    providerId: command.providerId,
    normalizedInstruction: plan.normalizedInstruction,
    storefrontBaselineFingerprint,
    targetFingerprint,
    permissionFingerprint,
    importedContent: command.importedContent,
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
    responseContract: "ai-storefront-proposal/v1",
  });
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
