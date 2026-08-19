import type { ProductDisplayModel } from "@/domain/catalogue";

export type DynamicCommerceProductMatchContext = Readonly<{
  optionStructure: "simple" | "configurable";
  optionGroupCount: number;
  configurationComplexity: "simple" | "light" | "moderate" | "complex";
  mediaAvailability: "none" | "single" | "multiple";
  mediaCount: number;
  mediaDepth: "sparse" | "standard" | "rich";
  highConsideration: boolean;
  decisionSupport: "standard" | "high-consideration";
}>;

/** Pure aggregate matching context; it does not resolve or materialize an archetype. */
export function createDynamicCommerceProductMatchContext(
  product: ProductDisplayModel,
  highConsideration?: boolean,
): DynamicCommerceProductMatchContext {
  const canonicalOptionGroupCount = product.orderOptions?.length ?? 0;
  const optionStructure =
    canonicalOptionGroupCount > 0 || product.variants.length > 1 ? "configurable" : "simple";
  const configurationComplexity =
    optionStructure === "simple"
      ? "simple"
      : canonicalOptionGroupCount <= 1
        ? "light"
        : canonicalOptionGroupCount <= 3
          ? "moderate"
          : "complex";
  const mediaCount = product.images.length;
  const mediaDepth = mediaCount <= 1 ? "sparse" : mediaCount === 2 ? "standard" : "rich";
  const requiresHighConsideration = highConsideration ?? configurationComplexity === "complex";
  return {
    optionStructure,
    optionGroupCount: Math.max(
      canonicalOptionGroupCount,
      optionStructure === "configurable" ? 1 : 0,
    ),
    configurationComplexity,
    mediaAvailability: mediaCount === 0 ? "none" : mediaCount === 1 ? "single" : "multiple",
    mediaCount,
    mediaDepth,
    highConsideration: requiresHighConsideration,
    decisionSupport: requiresHighConsideration ? "high-consideration" : "standard",
  };
}
