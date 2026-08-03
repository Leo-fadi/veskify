import { veskifyComponentDefinitionsV2, veskifyComponentRegistry } from "@/components/registry";
import { dynamicCollectionCommerceComponentByTarget } from "@/components/storefront/dynamic-collection-commerce";
import { dynamicProductDetailComponentByTarget } from "@/components/storefront/dynamic-product-detail";
import { homepageCommerceComponentByTarget } from "@/components/storefront/homepage-commerce";

export const p10a02RendererTargets = ["editor", "preview", "published"] as const;

export type P10a02RendererTarget = (typeof p10a02RendererTargets)[number];

export type P10a02ComponentCapabilityAudit = Readonly<{
  v1RegisteredComponentTypes: readonly string[];
  v2RegisteredComponentTypes: readonly string[];
  v2RegisteredVariantCount: number;
  v2TypesMissingRegisteredRenderer: readonly string[];
  rendererTypesMissingV2Definition: readonly string[];
  v1TypesMissingV2Definition: readonly string[];
  v2TypesWithoutLegacyRegistryBridge: readonly string[];
  pageFamilyComponentCounts: Readonly<Record<"home" | "collection" | "product", number>>;
}>;

function uniqueSorted(values: readonly string[]): string[] {
  return [...new Set(values)].sort((left, right) => left.localeCompare(right));
}

function rendererTypesForAllTargets(
  values: Readonly<Record<string, Partial<Record<P10a02RendererTarget, unknown>>>>,
): string[] {
  return Object.entries(values)
    .filter(([, targets]) => p10a02RendererTargets.every((target) => targets[target] !== undefined))
    .map(([type]) => type);
}

const v1RegisteredComponentTypes = uniqueSorted(Object.keys(veskifyComponentRegistry));
const v2RegisteredComponentTypes = uniqueSorted(
  veskifyComponentDefinitionsV2.map((definition) => definition.type),
);
const v2TypeSet = new Set(v2RegisteredComponentTypes);
const directRendererTypes = uniqueSorted([
  ...rendererTypesForAllTargets(homepageCommerceComponentByTarget),
  ...(p10a02RendererTargets.every(
    (target) => dynamicCollectionCommerceComponentByTarget[target] !== undefined,
  )
    ? ["dynamicCollectionCommerce"]
    : []),
  ...(p10a02RendererTargets.every(
    (target) => dynamicProductDetailComponentByTarget[target] !== undefined,
  )
    ? ["dynamicProductDetail"]
    : []),
]);
const rendererTypeSet = new Set([...v1RegisteredComponentTypes, ...directRendererTypes]);

export const p10a02ComponentCapabilityAudit: P10a02ComponentCapabilityAudit = Object.freeze({
  v1RegisteredComponentTypes: Object.freeze(v1RegisteredComponentTypes),
  v2RegisteredComponentTypes: Object.freeze(v2RegisteredComponentTypes),
  v2RegisteredVariantCount: veskifyComponentDefinitionsV2.reduce(
    (count, definition) => count + definition.variants.length,
    0,
  ),
  v2TypesMissingRegisteredRenderer: Object.freeze(
    v2RegisteredComponentTypes.filter((type) => !rendererTypeSet.has(type)),
  ),
  rendererTypesMissingV2Definition: Object.freeze(
    [...rendererTypeSet].filter((type) => !v2TypeSet.has(type)).sort(),
  ),
  v1TypesMissingV2Definition: Object.freeze(
    v1RegisteredComponentTypes.filter((type) => !v2TypeSet.has(type)),
  ),
  v2TypesWithoutLegacyRegistryBridge: Object.freeze(
    v2RegisteredComponentTypes.filter(
      (type) => !veskifyComponentRegistry[type as keyof typeof veskifyComponentRegistry],
    ),
  ),
  pageFamilyComponentCounts: Object.freeze({
    home: veskifyComponentDefinitionsV2.filter((definition) =>
      definition.supportedPageTypes.includes("home"),
    ).length,
    collection: veskifyComponentDefinitionsV2.filter((definition) =>
      definition.supportedPageTypes.includes("collection"),
    ).length,
    product: veskifyComponentDefinitionsV2.filter((definition) =>
      definition.supportedPageTypes.includes("product"),
    ).length,
  }),
});
