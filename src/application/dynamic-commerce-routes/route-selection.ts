import type { ProductDisplayModel } from "@/domain/catalogue";
import type {
  DynamicCommerceCollectionContextRule,
  DynamicCommerceProductComplexityRule,
} from "@/domain/storefront";
import { createDynamicCommerceProductMatchContext } from "./product-match-context";
import { DynamicCommerceRouteAuthorityError } from "./route-errors";

export type DynamicCommerceCollectionMatchContext = Readonly<{
  depth: number;
  productCount: number;
  childCollections: boolean;
  campaignEvidence: boolean;
  merchandisingDensity: "compact" | "standard" | "spacious";
}>;

function inBoundedRange(value: number, range?: { minimum: number; maximum: number }): boolean {
  return range === undefined || (value >= range.minimum && value <= range.maximum);
}

function requireUniqueHighestPriorityRule<T extends { id: string; priority: number }>(
  family: "collection" | "product",
  rules: readonly T[],
): T {
  if (rules.length === 0) {
    throw new DynamicCommerceRouteAuthorityError(
      "invalid-presentation",
      `No registered ${family} matching rule supports the current canonical context.`,
    );
  }
  const priority = Math.max(...rules.map((rule) => rule.priority));
  const selected = rules.filter((rule) => rule.priority === priority);
  if (selected.length !== 1) {
    throw new DynamicCommerceRouteAuthorityError(
      "invalid-presentation",
      `The current canonical ${family} context matches ambiguous rules at priority ${priority}.`,
    );
  }
  return selected[0];
}

export function selectProductComplexityRule(input: {
  product: ProductDisplayModel;
  rules: readonly DynamicCommerceProductComplexityRule[];
  highConsideration?: boolean;
}): DynamicCommerceProductComplexityRule {
  const context = createDynamicCommerceProductMatchContext(input.product, input.highConsideration);
  const matches = input.rules.filter((rule) => {
    const match = rule.match;
    return (
      (match.optionStructure === "any" || match.optionStructure === context.optionStructure) &&
      inBoundedRange(context.optionGroupCount, match.optionGroupCount) &&
      (match.configurationComplexity === undefined ||
        match.configurationComplexity === "any" ||
        match.configurationComplexity === context.configurationComplexity) &&
      (match.mediaAvailability === "any" ||
        match.mediaAvailability === context.mediaAvailability) &&
      inBoundedRange(context.mediaCount, match.mediaCount) &&
      (match.mediaDepth === undefined ||
        match.mediaDepth === "any" ||
        match.mediaDepth === context.mediaDepth) &&
      (match.highConsideration === "any" ||
        (match.highConsideration === "required" && context.highConsideration) ||
        (match.highConsideration === "excluded" && !context.highConsideration))
    );
  });
  return requireUniqueHighestPriorityRule("product", matches);
}

export function resolveProductComplexityArchetype(input: {
  product: ProductDisplayModel;
  rules: readonly DynamicCommerceProductComplexityRule[];
  highConsideration?: boolean;
}): string {
  return selectProductComplexityRule(input).archetypeId;
}

function selectCollectionContextRule(input: {
  context: DynamicCommerceCollectionMatchContext;
  rules: readonly DynamicCommerceCollectionContextRule[];
}): DynamicCommerceCollectionContextRule {
  const matches = input.rules.filter((rule) => {
    const match = rule.match;
    return (
      inBoundedRange(input.context.depth, match.depth) &&
      inBoundedRange(input.context.productCount, match.productCount) &&
      (match.childCollections === "any" ||
        (match.childCollections === "present" && input.context.childCollections) ||
        (match.childCollections === "absent" && !input.context.childCollections)) &&
      (match.campaignEvidence === "any" ||
        (match.campaignEvidence === "present" && input.context.campaignEvidence) ||
        (match.campaignEvidence === "absent" && !input.context.campaignEvidence)) &&
      (match.merchandisingDensity === "any" ||
        match.merchandisingDensity === input.context.merchandisingDensity)
    );
  });
  return requireUniqueHighestPriorityRule("collection", matches);
}

export function resolveCollectionContextArchetype(input: {
  context: DynamicCommerceCollectionMatchContext;
  rules: readonly DynamicCommerceCollectionContextRule[];
}): string {
  return selectCollectionContextRule(input).archetypeId;
}
