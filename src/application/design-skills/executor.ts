import {
  applyDesignOperation,
  type DesignOperation,
  type DesignProposal,
  type InMemoryDesignProposalStore,
} from "@/application/design-operations";
import { validateRegisteredPage } from "@/components/registry";
import { brandSystemSchema } from "@/domain/design-system";
import { localeSchema, localizedTextSchema } from "@/domain/shared";
import { pageModelSchema } from "@/domain/storefront";
import {
  campaignContextSchema,
  designPlanSchema,
  designSkillExecutionResultSchema,
  hasMeaningfulCampaignContext,
  type DesignPlan,
  type DesignSkillExecutionContext,
  type DesignSkillExecutionResult,
} from "./contract";
import { designSkillRegistry } from "./default-registry";
import { designPlanIdFor, type DesignPlannerInput } from "./planner";
import type { DesignSkillRegistry } from "./registry";

function deepFreeze<T>(value: T): T {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    Object.values(value as Record<string, unknown>).forEach((child) => deepFreeze(child));
  }
  return value;
}

function assertPlanIntegrity(plan: DesignPlan) {
  const identity = {
    normalizedIntent: plan.normalizedIntent,
    locale: plan.locale,
    requestedScope: plan.requestedScope,
    selectedSkills: plan.selectedSkills,
    affectedPageIds: plan.affectedPageIds,
    affectedSectionIds: plan.affectedSectionIds,
    plannedOperationCategories: plan.plannedOperationCategories,
    explanation: plan.explanation,
    assumptions: plan.assumptions,
    requiredClarifications: plan.requiredClarifications,
  };
  if (designPlanIdFor(identity) !== plan.id) {
    throw new Error("The design plan identity is invalid.");
  }
}

function assertOperationScope(
  operation: DesignOperation,
  targetSectionIds: readonly string[],
  skillScope: string,
) {
  if (skillScope !== "section" && skillScope !== "page") {
    throw new Error(`Unsupported executable skill scope: ${skillScope}.`);
  }
  if ("sectionId" in operation && !targetSectionIds.includes(operation.sectionId)) {
    throw new Error(`Skill operation escaped its planned section scope: ${operation.sectionId}.`);
  }
  if (
    operation.type === "REORDER_SECTIONS" &&
    operation.sectionIds.some((sectionId) => !targetSectionIds.includes(sectionId))
  ) {
    throw new Error("Skill reorder escaped its planned section scope.");
  }
}

function immutableSkillContext(
  input: DesignPlannerInput,
  page: DesignSkillExecutionContext["page"],
  selectedSectionId: string | undefined,
  requestedScope: NonNullable<DesignPlan["requestedScope"]>,
): Readonly<DesignSkillExecutionContext> {
  return deepFreeze({
    activeLocale: localeSchema.parse(input.activeLocale),
    page: pageModelSchema.parse(structuredClone(page)),
    pageType: input.pageType,
    brandSystem: brandSystemSchema.parse(structuredClone(input.brandSystem)),
    displayContext: structuredClone(input.displayContext),
    selectedSectionId,
    campaign: hasMeaningfulCampaignContext(input.campaign)
      ? campaignContextSchema.parse(structuredClone(input.campaign))
      : undefined,
    requestedScope,
  });
}

function failureResult(
  originalPage: DesignSkillExecutionResult["originalPage"],
  plan: DesignPlan,
  operations: DesignOperation[],
  error: unknown,
): DesignSkillExecutionResult {
  const message = error instanceof Error ? error.message : "Unknown design skill failure.";
  return designSkillExecutionResultSchema.parse({
    originalPage: structuredClone(originalPage),
    proposedPage: structuredClone(originalPage),
    selectedSkills: plan.selectedSkills,
    operations,
    summary: {
      en: "The proposed design changes could not be validated, so the page was left unchanged.",
      fi: "Ehdotettuja muutoksia ei voitu validoida, joten sivu säilyi ennallaan.",
    },
    validation: { valid: false, errors: [message] },
    failureReason: {
      en: "The design plan failed safely and no change was applied.",
      fi: "Suunnitelma epäonnistui turvallisesti eikä muutoksia tehty.",
    },
  });
}

export function executeDesignPlan(
  planInput: DesignPlan,
  input: DesignPlannerInput,
  registry: DesignSkillRegistry = designSkillRegistry,
): DesignSkillExecutionResult {
  const plan = designPlanSchema.parse(structuredClone(planInput));
  const originalInputJson = JSON.stringify(input.page);
  const originalContextJson = JSON.stringify(input.displayContext);
  const original = pageModelSchema.parse(structuredClone(input.page));
  const operations: DesignOperation[] = [];

  try {
    assertPlanIntegrity(plan);
    if (!plan.validation.valid || !plan.requestedScope) {
      throw new Error(plan.validation.errors[0] ?? "The design plan is not valid for execution.");
    }
    if (plan.affectedPageIds.length !== 1 || plan.affectedPageIds[0] !== original.id) {
      throw new Error("Design plans may modify only the supplied active page.");
    }
    validateRegisteredPage(original, input.displayContext);
    let proposed = structuredClone(original);
    const summaries = [];

    for (const selected of plan.selectedSkills) {
      const definition = registry.get(selected.id);
      if (definition.version !== selected.version || definition.scope !== selected.scope) {
        throw new Error(`Skill contract changed after planning: ${selected.id}.`);
      }
      const selectedSectionId =
        definition.scope === "section" ? selected.targetSectionIds[0] : undefined;
      const context = immutableSkillContext(
        input,
        proposed,
        selectedSectionId,
        plan.requestedScope,
      );
      const skillOperations = registry.execute(selected.id, context);
      for (const operation of skillOperations) {
        assertOperationScope(operation, selected.targetSectionIds, definition.scope);
        if (!plan.plannedOperationCategories.includes(operation.type)) {
          throw new Error(`Operation ${operation.type} was not included in the approved plan.`);
        }
        proposed = applyDesignOperation(proposed, operation, input.displayContext);
        operations.push(operation);
      }
      summaries.push(
        localizedTextSchema.parse(
          definition.summarize({
            activeLocale: input.activeLocale,
            page: proposed,
            operationCount: skillOperations.length,
            selectedSectionId,
          }),
        ),
      );
    }

    const validated = validateRegisteredPage(proposed, input.displayContext);
    if (JSON.stringify(input.page) !== originalInputJson) {
      throw new Error("Skill execution mutated the input page.");
    }
    if (JSON.stringify(input.displayContext) !== originalContextJson) {
      throw new Error("Skill execution mutated protected catalogue or display context.");
    }
    const summary =
      summaries.length > 0
        ? {
            en: summaries.map((item) => item.en ?? item.fi).join(" "),
            fi: summaries.map((item) => item.fi ?? item.en).join(" "),
          }
        : {
            en: "No design changes are proposed; the original page remains unchanged.",
            fi: "Muutoksia ei ehdoteta, joten alkuperäinen sivu säilyy ennallaan.",
          };
    return designSkillExecutionResultSchema.parse({
      originalPage: structuredClone(original),
      proposedPage: structuredClone(validated),
      selectedSkills: plan.selectedSkills,
      operations,
      summary,
      validation: { valid: true, errors: [] },
      failureReason: null,
    });
  } catch (error) {
    return failureResult(original, plan, operations, error);
  }
}

export function createProposalFromDesignPlan(
  executionInput: DesignSkillExecutionResult,
  context: DesignPlannerInput["displayContext"],
  store: InMemoryDesignProposalStore,
  identity?: string,
): DesignProposal {
  const execution = designSkillExecutionResultSchema.parse(structuredClone(executionInput));
  if (!execution.validation.valid || execution.failureReason) {
    throw new Error("Only a successful validated skill execution can become a proposal.");
  }
  return store.create({
    originalPage: execution.originalPage,
    operations: execution.operations,
    context,
    summary: execution.summary,
    identity,
  });
}
