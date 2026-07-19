import {
  aiOperationRequestSchema,
  type AiOperationPermissionGrant,
  type AiOperationRequest,
} from "@/application/ai-provider";
import {
  createDesignPlan,
  designSkillRegistry,
  type DesignPlan,
  type DesignPlannerInput,
} from "@/application/design-skills";
import { getComponentDefinition } from "@/components/registry";
import type { PageModel } from "@/domain/storefront";
import { aiProposalGenerationCommandSchema, type AiProposalGenerationCommand } from "./contract";

export class AiProposalRequestBuildError extends Error {
  constructor(
    readonly code: "invalid-command" | "target-mismatch" | "unsupported-request",
    message: string,
  ) {
    super(message);
    this.name = "AiProposalRequestBuildError";
  }
}

export function parseAiProposalGenerationCommand(input: unknown): AiProposalGenerationCommand {
  const result = aiProposalGenerationCommandSchema.safeParse(input);
  if (!result.success) {
    throw new AiProposalRequestBuildError(
      "invalid-command",
      "The storefront proposal request is incomplete or invalid.",
    );
  }
  return result.data;
}

export function resolvePlannerSectionTarget(
  plan: DesignPlan,
  page: PageModel,
  explicitSectionId?: string,
): string | undefined {
  if (plan.requestedScope !== "section") return undefined;
  const plannerTargets = [
    ...new Set(plan.selectedSkills.flatMap((skill) => skill.targetSectionIds)),
  ];
  if (explicitSectionId !== undefined && !plannerTargets.includes(explicitSectionId)) {
    throw new AiProposalRequestBuildError(
      "target-mismatch",
      "The selected section is outside the planner-authorized target.",
    );
  }
  const resolved =
    explicitSectionId ?? (plannerTargets.length === 1 ? plannerTargets[0] : undefined);
  if (resolved === undefined) {
    throw new AiProposalRequestBuildError(
      "unsupported-request",
      plannerTargets.length > 1
        ? "The storefront request has multiple possible section targets. Select one section."
        : "Select the storefront section you want to change.",
    );
  }
  if (!page.sections.some((section) => section.id === resolved)) {
    throw new AiProposalRequestBuildError(
      "target-mismatch",
      "The planner-authorized section no longer exists on the current page.",
    );
  }
  return resolved;
}

function permissionGrants(
  plan: DesignPlan,
  page: PageModel,
  resolvedSectionId?: string,
): AiOperationPermissionGrant[] {
  return plan.selectedSkills.flatMap((selected) => {
    const definition = designSkillRegistry.get(selected.id);
    const targetSectionIds =
      plan.requestedScope === "section"
        ? selected.targetSectionIds.filter((sectionId) => sectionId === resolvedSectionId)
        : selected.targetSectionIds;
    return targetSectionIds.map((sectionId) => {
      const existing = page.sections.find((section) => section.id === sectionId);
      if (existing) {
        if (
          !definition.allowedComponentTypes.some((component) => component === existing.component)
        ) {
          throw new AiProposalRequestBuildError(
            "unsupported-request",
            "The planner target is incompatible with the selected design skill.",
          );
        }
        return {
          skillId: definition.id,
          skillVersion: definition.version,
          skillScope: definition.scope,
          operationTypes: [...definition.allowedOperationTypes],
          target: {
            kind: "existingSection" as const,
            pageId: page.id,
            sectionId,
            componentType: existing.component,
          },
        };
      }
      if (definition.allowedComponentTypes.length !== 1) {
        throw new AiProposalRequestBuildError(
          "unsupported-request",
          "The planner did not resolve one approved component for the new section target.",
        );
      }
      return {
        skillId: definition.id,
        skillVersion: definition.version,
        skillScope: definition.scope,
        operationTypes: [...definition.allowedOperationTypes],
        target: {
          kind: "introducedSection" as const,
          pageId: page.id,
          sectionId,
          componentType: definition.allowedComponentTypes[0],
        },
      };
    });
  });
}

export function buildAiOperationRequest(commandInput: unknown): AiOperationRequest {
  const command = parseAiProposalGenerationCommand(commandInput);
  if (command.page.id !== command.target.pageId) {
    throw new AiProposalRequestBuildError(
      "target-mismatch",
      "The selected page no longer matches the current storefront page.",
    );
  }
  const selectedSectionId =
    command.target.type === "section" ? command.target.sectionId : undefined;
  if (
    selectedSectionId !== undefined &&
    !command.page.sections.some((section) => section.id === selectedSectionId)
  ) {
    throw new AiProposalRequestBuildError(
      "target-mismatch",
      "The selected section no longer exists on the current storefront page.",
    );
  }

  const plannerInput: DesignPlannerInput = {
    merchantRequest: command.merchantInstruction,
    activeLocale: command.activeLocale,
    page: command.page,
    pageType: command.page.type,
    brandSystem: command.brandSystem,
    displayContext: command.displayContext,
    selectedSectionId,
  };
  const plan = createDesignPlan(plannerInput);
  if (!plan.validation.valid || plan.requestedScope === null || plan.selectedSkills.length === 0) {
    throw new AiProposalRequestBuildError(
      "unsupported-request",
      "That storefront change is not supported yet. Try a more specific design request.",
    );
  }
  if (plan.requestedScope !== "page" && plan.requestedScope !== "section") {
    throw new AiProposalRequestBuildError(
      "unsupported-request",
      "That change is outside the supported page and section design scope.",
    );
  }

  const definitions = plan.selectedSkills.map(({ id }) => designSkillRegistry.get(id));
  const allowedOperationTypes = [
    ...new Set(definitions.flatMap((definition) => definition.allowedOperationTypes)),
  ];
  const allowedComponentTypes = [
    ...new Set(definitions.flatMap((definition) => definition.allowedComponentTypes)),
  ];
  allowedComponentTypes.forEach((component) => getComponentDefinition(component));

  const sectionId = resolvePlannerSectionTarget(plan, command.page, selectedSectionId);
  const grants = permissionGrants(plan, command.page, sectionId);

  return aiOperationRequestSchema.parse({
    projectId: command.projectId,
    draftSnapshotId: command.draftSnapshotId,
    draftRevision: command.draftRevision,
    target: { pageId: command.page.id, ...(sectionId ? { sectionId } : {}) },
    instruction: command.merchantInstruction,
    allowedComponentTypes,
    allowedOperationTypes,
    permissionGrants: grants,
    locale: command.activeLocale,
    locales: command.enabledLocales,
    page: command.page,
    brandSystem: command.brandSystem,
    displayContext: command.displayContext,
    scope: plan.requestedScope,
    importedContent: command.importedContent,
  });
}
