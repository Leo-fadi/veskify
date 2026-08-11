import type { ProductDisplayModel } from "@/domain/catalogue";

export type DynamicCommerceProductMatchContext = Readonly<{
  optionStructure: "simple" | "configurable";
  optionGroupCount: number;
  mediaAvailability: "none" | "single" | "multiple";
  highConsideration: boolean;
}>;

/** Pure aggregate matching context; it does not resolve or materialize an archetype. */
export function createDynamicCommerceProductMatchContext(
  product: ProductDisplayModel,
  highConsideration?: boolean,
): DynamicCommerceProductMatchContext {
  const canonicalOptionGroupCount = product.orderOptions?.length ?? 0;
  const optionStructure =
    canonicalOptionGroupCount > 0 || product.variants.length > 1 ? "configurable" : "simple";
  return {
    optionStructure,
    optionGroupCount: Math.max(
      canonicalOptionGroupCount,
      optionStructure === "configurable" ? 1 : 0,
    ),
    mediaAvailability:
      product.images.length === 0 ? "none" : product.images.length === 1 ? "single" : "multiple",
    highConsideration: highConsideration ?? canonicalOptionGroupCount >= 4,
  };
}
