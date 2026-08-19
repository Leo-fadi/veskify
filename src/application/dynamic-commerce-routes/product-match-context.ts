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

function canonicalVariantDimensionCount(product: ProductDisplayModel): number {
  if (product.variants.length === 0) return 0;
  const keys = Object.keys(product.variants[0].attributes);
  if (keys.length === 0) return 0;
  const valid = product.variants.every((variant) => {
    const variantKeys = Object.keys(variant.attributes);
    return (
      variantKeys.length === keys.length &&
      variantKeys.every((key, index) => key === keys[index]) &&
      keys.every(
        (key) => variant.attributes[key] !== undefined && !Array.isArray(variant.attributes[key]),
      )
    );
  });
  return valid ? keys.length : 0;
}

function canonicalMediaPresentationCount(product: ProductDisplayModel): number {
  const urlByAssetId = new Map(product.images.map(({ id, url }) => [id, url] as const));
  return new Set(product.images.map(({ id }) => urlByAssetId.get(id))).size;
}

/** Pure aggregate matching context; it does not resolve or materialize an archetype. */
export function createDynamicCommerceProductMatchContext(
  product: ProductDisplayModel,
  highConsideration?: boolean,
): DynamicCommerceProductMatchContext {
  const canonicalOptionGroupCount =
    canonicalVariantDimensionCount(product) + (product.orderOptions?.length ?? 0);
  const optionStructure = canonicalOptionGroupCount > 0 ? "configurable" : "simple";
  const configurationComplexity =
    optionStructure === "simple"
      ? "simple"
      : canonicalOptionGroupCount <= 1
        ? "light"
        : canonicalOptionGroupCount <= 3
          ? "moderate"
          : "complex";
  const mediaCount = canonicalMediaPresentationCount(product);
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
