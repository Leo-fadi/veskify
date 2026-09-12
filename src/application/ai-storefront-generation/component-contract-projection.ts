import { getComponentDescription } from "@/components/registry/component-descriptions";
import type { AiStorefrontGenerationPlan } from "./contract";

export function projectStorefrontComponentContracts(
  plan: Pick<AiStorefrontGenerationPlan, "sectionTargets">,
) {
  return [
    // Preserve the complete component set before ordering its descriptions.
    ...new Set(plan.sectionTargets.map((sectionTarget) => sectionTarget.componentType)),
  ]
    .sort((left, right) => left.localeCompare(right))
    .map((componentType) => {
      const definition = getComponentDescription(componentType);
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
}
