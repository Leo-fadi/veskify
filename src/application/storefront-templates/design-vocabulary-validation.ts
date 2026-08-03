import {
  boundedParametersById,
  narrativeFlowRulesById,
  narrativeRolesById,
  resolveBoundedParameterInheritance,
  transitionIntentSchema,
  type ParameterInheritanceLayer,
} from "@/domain/component-platform";
import type { ComponentDefinitionV2 } from "@/domain/component-platform";
import type { PageType } from "@/domain/storefront";
import type { StorefrontTemplatePagePlan } from "./contract";

export const designVocabularyValidationCodes = [
  "UNKNOWN_NARRATIVE_ROLE",
  "UNKNOWN_TRANSITION_INTENT",
  "UNKNOWN_FLOW_RULE",
  "UNSUPPORTED_FLOW_RULE_PAGE_TYPE",
  "UNSUPPORTED_COMPONENT_ROLE",
  "UNSUPPORTED_ROLE_VISUAL_WEIGHT",
  "PROHIBITED_ADJACENCY",
  "INVALID_OPENING_ROLE",
  "INVALID_CLOSING_ROLE",
  "EXCESSIVE_REPEATED_ROLE",
  "EXCESSIVE_REPEATED_COMPONENT_FAMILY",
  "INVALID_VISUAL_WEIGHT_SEQUENCE",
  "INVALID_BOUNDED_PARAMETER_VALUE",
  "CONTRADICTORY_NUMERIC_RANGE",
  "INCOMPATIBLE_PARAMETER_COMBINATION",
  "ILLEGAL_INHERITANCE_BROADENING",
  "PROHIBITED_INSTANCE_OVERRIDE",
  "PAGE_BLUEPRINT_COMPONENT_INCOMPATIBLE",
  "COMMERCE_SENSITIVE_PLACEMENT",
] as const;

export type DesignVocabularyValidationCode = (typeof designVocabularyValidationCodes)[number];

export type DesignVocabularyValidationIssue = Readonly<{
  code: DesignVocabularyValidationCode;
  message: string;
  sectionId?: string;
  parameterId?: string;
}>;

export type NarrativeCompositionSection = Readonly<{
  id: string;
  component: string;
  variant: string;
  narrativeRole: string;
  visualWeight: string;
  transitionIntent?: string;
  parameters?: Readonly<Record<string, string | number>>;
  parameterInheritance?: Readonly<Record<string, readonly ParameterInheritanceLayer[]>>;
}>;

export type ValidateNarrativeCompositionInput = Readonly<{
  pageType: PageType;
  blueprintProfileId: string;
  pageBlueprint: StorefrontTemplatePagePlan;
  components: readonly ComponentDefinitionV2[];
  sections: readonly NarrativeCompositionSection[];
}>;

export type NarrativeCompositionValidationResult = Readonly<{
  valid: boolean;
  issues: readonly DesignVocabularyValidationIssue[];
}>;

function issue(
  code: DesignVocabularyValidationCode,
  message: string,
  sectionId?: string,
  parameterId?: string,
): DesignVocabularyValidationIssue {
  return Object.freeze({ code, message, sectionId, parameterId });
}

function isKnownVisualWeight(value: string): value is "light" | "medium" | "heavy" | "dominant" {
  return ["light", "medium", "heavy", "dominant"].includes(value);
}

function countBy<T>(values: readonly T[], valueFor: (value: T) => string): Map<string, number> {
  const result = new Map<string, number>();
  values.forEach((value) => {
    const key = valueFor(value);
    result.set(key, (result.get(key) ?? 0) + 1);
  });
  return result;
}

function pageBlueprintAllowsRole(pageBlueprint: StorefrontTemplatePagePlan, role: string) {
  return pageBlueprint.pageBlueprint.allowedNarrativeRoles.includes(
    role as (typeof pageBlueprint.pageBlueprint.allowedNarrativeRoles)[number],
  );
}

function componentFor(
  definitions: ReadonlyMap<string, ComponentDefinitionV2>,
  section: NarrativeCompositionSection,
) {
  return definitions.get(section.component);
}

function validateSectionCompatibility(
  input: ValidateNarrativeCompositionInput,
  definitions: ReadonlyMap<string, ComponentDefinitionV2>,
  issues: DesignVocabularyValidationIssue[],
) {
  input.sections.forEach((section) => {
    const role = narrativeRolesById.get(section.narrativeRole as never);
    if (!role) {
      issues.push(
        issue(
          "UNKNOWN_NARRATIVE_ROLE",
          `Narrative role ${section.narrativeRole} is not registered.`,
          section.id,
        ),
      );
      return;
    }
    if (!isKnownVisualWeight(section.visualWeight)) {
      issues.push(
        issue(
          "INVALID_VISUAL_WEIGHT_SEQUENCE",
          `Visual weight ${section.visualWeight} is not registered.`,
          section.id,
        ),
      );
    } else if (!role.visualWeights.includes(section.visualWeight)) {
      issues.push(
        issue(
          "UNSUPPORTED_ROLE_VISUAL_WEIGHT",
          `${role.id} does not allow ${section.visualWeight} visual weight.`,
          section.id,
        ),
      );
    }
    if (!role.allowedPageTypes.includes(input.pageType)) {
      issues.push(
        issue(
          "UNSUPPORTED_COMPONENT_ROLE",
          `${role.id} is not allowed on ${input.pageType} pages.`,
          section.id,
        ),
      );
    }
    if (!pageBlueprintAllowsRole(input.pageBlueprint, role.id)) {
      issues.push(
        issue(
          "PAGE_BLUEPRINT_COMPONENT_INCOMPATIBLE",
          `The PageBlueprint does not allow the ${role.id} narrative role.`,
          section.id,
        ),
      );
    }
    const component = componentFor(definitions, section);
    if (!component || !component.supportedPageTypes.includes(input.pageType)) {
      issues.push(
        issue(
          "PAGE_BLUEPRINT_COMPONENT_INCOMPATIBLE",
          `Component ${section.component} is not registered for ${input.pageType}.`,
          section.id,
        ),
      );
      return;
    }
    if (!component.variants.some((variant) => variant.id === section.variant)) {
      issues.push(
        issue(
          "PAGE_BLUEPRINT_COMPONENT_INCOMPATIBLE",
          `Variant ${section.variant} is not registered for ${section.component}.`,
          section.id,
        ),
      );
    }
    const compatibility = component.designCompatibility;
    if (!compatibility.allowedNarrativeRoles.includes(role.id)) {
      issues.push(
        issue(
          "UNSUPPORTED_COMPONENT_ROLE",
          `${section.component} is not compatible with ${role.id}.`,
          section.id,
        ),
      );
    }
    if (
      isKnownVisualWeight(section.visualWeight) &&
      !compatibility.allowedVisualWeights.includes(section.visualWeight)
    ) {
      issues.push(
        issue(
          "UNSUPPORTED_COMPONENT_ROLE",
          `${section.component} is not compatible with ${section.visualWeight} visual weight.`,
          section.id,
        ),
      );
    }
    if (
      compatibility.blueprintProfilePolicy === "listed" &&
      !compatibility.compatibleBlueprintProfileIds.includes(input.blueprintProfileId)
    ) {
      issues.push(
        issue(
          "PAGE_BLUEPRINT_COMPONENT_INCOMPATIBLE",
          `${section.component} is not compatible with PageBlueprint ${input.blueprintProfileId}.`,
          section.id,
        ),
      );
    }
    if (section.transitionIntent !== undefined) {
      const parsedIntent = transitionIntentSchema.safeParse(section.transitionIntent);
      if (!parsedIntent.success) {
        issues.push(
          issue(
            "UNKNOWN_TRANSITION_INTENT",
            `Transition intent ${section.transitionIntent} is not registered.`,
            section.id,
          ),
        );
      } else if (!compatibility.allowedTransitionIntents.includes(parsedIntent.data)) {
        issues.push(
          issue(
            "UNSUPPORTED_COMPONENT_ROLE",
            `${section.component} is not compatible with ${parsedIntent.data} transitions.`,
            section.id,
          ),
        );
      }
    }
    const parameters = section.parameters ?? {};
    const activeParameterIds = Object.keys(parameters);
    activeParameterIds.forEach((parameterId) => {
      const definition = boundedParametersById.get(parameterId);
      if (!definition) {
        issues.push(
          issue(
            "INVALID_BOUNDED_PARAMETER_VALUE",
            `Bounded parameter ${parameterId} is not registered.`,
            section.id,
            parameterId,
          ),
        );
        return;
      }
      if (!compatibility.boundedParameterIds.includes(parameterId)) {
        issues.push(
          issue(
            "PAGE_BLUEPRINT_COMPONENT_INCOMPATIBLE",
            `${section.component} does not allow bounded parameter ${parameterId}.`,
            section.id,
            parameterId,
          ),
        );
      }
      if (!definition.compatibleComponentFamilies.includes(component.family)) {
        issues.push(
          issue(
            "PAGE_BLUEPRINT_COMPONENT_INCOMPATIBLE",
            `${parameterId} is not compatible with component family ${component.family}.`,
            section.id,
            parameterId,
          ),
        );
      }
      const inherited = resolveBoundedParameterInheritance(parameterId, [
        ...(input.pageBlueprint.pageBlueprint.boundedParameterConstraints.some(
          (constraint) => constraint.parameterId === parameterId,
        )
          ? [
              {
                level: "pageBlueprint" as const,
                constraint: input.pageBlueprint.pageBlueprint.boundedParameterConstraints.find(
                  (constraint) => constraint.parameterId === parameterId,
                ),
              },
            ]
          : []),
        ...(section.parameterInheritance?.[parameterId] ?? []),
        { level: "instance", value: parameters[parameterId] },
      ]);
      inherited.issues.forEach((inheritanceIssue) => {
        issues.push(
          issue(
            inheritanceIssue.code === "ILLEGAL_INHERITANCE_BROADENING"
              ? "ILLEGAL_INHERITANCE_BROADENING"
              : inheritanceIssue.code === "PROHIBITED_INSTANCE_OVERRIDE"
                ? "PROHIBITED_INSTANCE_OVERRIDE"
                : inheritanceIssue.code === "CONTRADICTORY_NUMERIC_RANGE"
                  ? "CONTRADICTORY_NUMERIC_RANGE"
                  : "INVALID_BOUNDED_PARAMETER_VALUE",
            inheritanceIssue.message,
            section.id,
            parameterId,
          ),
        );
      });
      definition.incompatibleWith.forEach((other) => {
        if (activeParameterIds.includes(other)) {
          issues.push(
            issue(
              "INCOMPATIBLE_PARAMETER_COMBINATION",
              `${parameterId} cannot be combined with ${other}.`,
              section.id,
              parameterId,
            ),
          );
        }
      });
    });
  });
}

function validateCardinality(
  input: ValidateNarrativeCompositionInput,
  definitions: ReadonlyMap<string, ComponentDefinitionV2>,
  issues: DesignVocabularyValidationIssue[],
) {
  const roleCounts = countBy(input.sections, (section) => section.narrativeRole);
  roleCounts.forEach((count, role) => {
    if (count > input.pageBlueprint.pageBlueprint.maxRepeatedRole) {
      issues.push(
        issue(
          "EXCESSIVE_REPEATED_ROLE",
          `${role} occurs ${count} times; the PageBlueprint permits ${input.pageBlueprint.pageBlueprint.maxRepeatedRole}.`,
        ),
      );
    }
    const definition = narrativeRolesById.get(role as never);
    if (definition && count > definition.maxOccurrences) {
      issues.push(
        issue(
          "EXCESSIVE_REPEATED_ROLE",
          `${role} exceeds its registered maximum occurrence count.`,
        ),
      );
    }
  });
  input.pageBlueprint.pageBlueprint.requiredNarrativeRoles.forEach((role) => {
    if ((roleCounts.get(role) ?? 0) === 0) {
      issues.push(
        issue("PAGE_BLUEPRINT_COMPONENT_INCOMPATIBLE", `The PageBlueprint requires ${role}.`),
      );
    }
  });
  const familyCounts = countBy(
    input.sections,
    (section) => componentFor(definitions, section)?.family ?? "unknown",
  );
  familyCounts.forEach((count, family) => {
    if (count > input.pageBlueprint.pageBlueprint.maxRepeatedComponentFamily) {
      issues.push(
        issue(
          "EXCESSIVE_REPEATED_COMPONENT_FAMILY",
          `${family} occurs ${count} times; the PageBlueprint permits ${input.pageBlueprint.pageBlueprint.maxRepeatedComponentFamily}.`,
        ),
      );
    }
  });
}

function validateFlowRules(
  input: ValidateNarrativeCompositionInput,
  issues: DesignVocabularyValidationIssue[],
) {
  const sections = input.sections;
  const firstRole = sections[0]?.narrativeRole;
  const lastRole = sections.at(-1)?.narrativeRole;
  input.pageBlueprint.pageBlueprint.flowRuleIds.forEach((ruleId) => {
    const rule = narrativeFlowRulesById.get(ruleId);
    if (!rule) {
      issues.push(
        issue("UNKNOWN_FLOW_RULE", `The PageBlueprint references unknown flow rule ${ruleId}.`),
      );
      return;
    }
    if (!rule.pageTypes.includes(input.pageType)) {
      issues.push(
        issue(
          "UNSUPPORTED_FLOW_RULE_PAGE_TYPE",
          `Flow rule ${ruleId} is not registered for ${input.pageType} pages.`,
        ),
      );
      return;
    }
    if (rule.type === "openingRole" && firstRole !== rule.fromRole) {
      issues.push(issue("INVALID_OPENING_ROLE", rule.message, sections[0]?.id));
      return;
    }
    if (rule.type === "closingRole" && lastRole !== rule.fromRole) {
      issues.push(issue("INVALID_CLOSING_ROLE", rule.message, sections.at(-1)?.id));
      return;
    }
    if (rule.type === "prohibitedAdjacency") {
      sections.slice(0, -1).forEach((section, index) => {
        if (
          section.narrativeRole === rule.fromRole &&
          sections[index + 1]?.narrativeRole === rule.toRole
        ) {
          issues.push(issue("PROHIBITED_ADJACENCY", rule.message, section.id));
        }
      });
      return;
    }
    if (rule.type === "requiredAdjacency") {
      sections.forEach((section, index) => {
        if (
          section.narrativeRole === rule.fromRole &&
          sections[index + 1]?.narrativeRole !== rule.toRole
        ) {
          issues.push(issue("PROHIBITED_ADJACENCY", rule.message, section.id));
        } else if (
          section.narrativeRole === rule.fromRole &&
          rule.transitionIntents.length > 0 &&
          !rule.transitionIntents.includes(section.transitionIntent as never)
        ) {
          issues.push(issue("PROHIBITED_ADJACENCY", rule.message, section.id));
        }
      });
      return;
    }
    if (rule.type === "commercePlacement") {
      sections.forEach((section, index) => {
        if (section.narrativeRole !== rule.toRole) return;
        if (sections[index - 1]?.narrativeRole !== rule.fromRole) {
          issues.push(issue("COMMERCE_SENSITIVE_PLACEMENT", rule.message, section.id));
        }
      });
      return;
    }
    if (rule.type === "roleOrder") {
      const fromIndex = sections.reduce<number>(
        (latest, section, index) => (section.narrativeRole === rule.fromRole ? index : latest),
        -1,
      );
      const toIndex = sections.findIndex((section) => section.narrativeRole === rule.toRole);
      if (fromIndex === -1 || toIndex === -1 || fromIndex > toIndex) {
        issues.push(issue("PROHIBITED_ADJACENCY", rule.message));
      }
      return;
    }
    if (rule.type === "visualWeightTransition") {
      sections.slice(0, -1).forEach((section, index) => {
        const next = sections[index + 1];
        if (
          !next ||
          !isKnownVisualWeight(section.visualWeight) ||
          !isKnownVisualWeight(next.visualWeight)
        )
          return;
        const allowed = rule.allowedVisualWeightTransitions.some(
          ([from, to]) => from === section.visualWeight && to === next.visualWeight,
        );
        if (!allowed) {
          issues.push(issue("INVALID_VISUAL_WEIGHT_SEQUENCE", rule.message, section.id));
        }
      });
    }
  });
}

export function validateNarrativeComposition(
  input: ValidateNarrativeCompositionInput,
): NarrativeCompositionValidationResult {
  const issues: DesignVocabularyValidationIssue[] = [];
  const definitions = new Map(input.components.map((definition) => [definition.type, definition]));
  validateSectionCompatibility(input, definitions, issues);
  validateCardinality(input, definitions, issues);
  validateFlowRules(input, issues);
  return Object.freeze({ valid: issues.length === 0, issues: Object.freeze(issues) });
}
