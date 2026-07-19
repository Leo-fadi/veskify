import { aiOperationRequestSchema, type AiOperationRequest } from "@/application/ai-provider";
import {
  createDesignPlan,
  designSkillRegistry,
  type DesignPlannerInput,
} from "@/application/design-skills";
import { getComponentDefinition } from "@/components/registry";
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

  const sectionId = plan.requestedScope === "section" ? selectedSectionId : undefined;
  if (plan.requestedScope === "section" && sectionId === undefined) {
    throw new AiProposalRequestBuildError(
      "unsupported-request",
      "Select the storefront section you want to change.",
    );
  }

  return aiOperationRequestSchema.parse({
    projectId: command.projectId,
    draftSnapshotId: command.draftSnapshotId,
    draftRevision: command.draftRevision,
    target: { pageId: command.page.id, ...(sectionId ? { sectionId } : {}) },
    instruction: command.merchantInstruction,
    allowedComponentTypes,
    allowedOperationTypes,
    locale: command.activeLocale,
    locales: command.enabledLocales,
    page: command.page,
    brandSystem: command.brandSystem,
    displayContext: command.displayContext,
    scope: plan.requestedScope,
    importedContent: command.importedContent,
  });
}
