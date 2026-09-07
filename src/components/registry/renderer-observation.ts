import type { ReactNode } from "react";
import { dynamicCollectionCommerceComponentByTarget } from "@/components/storefront/dynamic-collection-commerce";
import { dynamicProductDetailComponentByTarget } from "@/components/storefront/dynamic-product-detail";
import { homepageCommerceComponentByTarget } from "@/components/storefront/homepage-commerce";
import type {
  RendererRegistration,
  RendererTarget,
  RendererVariantCapability,
} from "./renderer-conformance";
import { contentSupportComponentByTarget } from "./content-support-bridge";
import { veskifyComponentRegistry } from "./registry";
import { veskifyComponentDefinitionsV2 } from "./v2-registry";

const rendererTargets: readonly RendererTarget[] = ["editor", "preview", "published"];
type RendererCallable = (input: never) => ReactNode;

function freeze<T>(value: T): T {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    Object.values(value as Record<string, unknown>).forEach((entry) => freeze(entry));
  }
  return value;
}

function capabilitiesFor(
  variants: readonly string[],
  targets: readonly RendererTarget[],
): readonly RendererVariantCapability[] {
  return targets.map((target) => ({ target, supportedVariants: variants }));
}

function registrationFromTargetMap(
  adapterId: string,
  componentType: string | undefined,
  targets: Readonly<Record<RendererTarget, RendererCallable>>,
  variants: readonly string[],
  supportedTargets: readonly RendererTarget[] = rendererTargets,
  exportName?: string,
): RendererRegistration {
  const exportNames = [...new Set(Object.values(targets).map((renderer) => renderer.name))];
  return {
    adapterId,
    ...(componentType === undefined ? {} : { componentType }),
    exportName: exportName ?? exportNames.join("|"),
    supportedTargets: supportedTargets.filter((target) => typeof targets[target] === "function"),
    variantCapabilities: capabilitiesFor(variants, supportedTargets),
  };
}

/** Reads renderer registrations from their actual runtime maps without another inventory. */
export function collectLiveRendererRegistrations(): readonly RendererRegistration[] {
  const variantsByComponentType = new Map(
    veskifyComponentDefinitionsV2.map((definition) => [
      definition.type,
      definition.variants.map((variant) => variant.id),
    ]),
  );
  const variantsFor = (componentType: string) => {
    const variants = variantsByComponentType.get(componentType);
    if (!variants) throw new Error(`Missing renderer variant evidence for ${componentType}.`);
    return variants;
  };
  const legacyRegistrations: RendererRegistration[] = Object.entries(veskifyComponentRegistry)
    .filter(
      ([componentType, definition]) =>
        typeof definition.render === "function" &&
        ![
          "homepageHero",
          "homepageFeaturedCollections",
          "homepageFeaturedProducts",
          "homepageCollectionNavigation",
          "homepagePromotion",
          "homepageTrust",
          "contentSupport",
        ].includes(componentType),
    )
    .map(([componentType]) => {
      const targets: readonly RendererTarget[] =
        componentType === "dynamicCollectionCommerce" || componentType === "dynamicProductDetail"
          ? ["editor"]
          : rendererTargets;
      return {
        adapterId: "veskifyV1Registry",
        componentType,
        exportName: componentType,
        ownership: componentType === "dynamicCollectionCommerce" ? "fallback" : "primary",
        supportedTargets: targets,
        variantCapabilities: capabilitiesFor(variantsFor(componentType), targets),
      };
    });
  return freeze([
    ...legacyRegistrations,
    ...Object.entries(homepageCommerceComponentByTarget).map(([componentType, targets]) =>
      registrationFromTargetMap(
        "veskifyHomepageRenderer",
        componentType,
        targets,
        variantsFor(componentType),
      ),
    ),
    registrationFromTargetMap(
      "veskifyContentSupportRenderer",
      "contentSupport",
      contentSupportComponentByTarget as unknown as Readonly<
        Record<RendererTarget, RendererCallable>
      >,
      variantsFor("contentSupport"),
      rendererTargets,
      "ContentSupportSection",
    ),
    registrationFromTargetMap(
      "veskifyCommerceRenderer",
      "dynamicCollectionCommerce",
      dynamicCollectionCommerceComponentByTarget,
      variantsFor("dynamicCollectionCommerce"),
    ),
    registrationFromTargetMap(
      "veskifyCommerceRenderer",
      "dynamicProductDetail",
      dynamicProductDetailComponentByTarget,
      variantsFor("dynamicProductDetail"),
      ["preview", "published"],
    ),
  ]);
}
