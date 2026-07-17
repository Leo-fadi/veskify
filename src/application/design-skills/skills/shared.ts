import { designOperationSchema, type DesignOperation } from "@/application/design-operations";
import { getComponentDefinition } from "@/components/registry";
import type { BrandSystem } from "@/domain/design-system";
import type { PageModel, SectionInstance } from "@/domain/storefront";
import type { DesignOperationType, DesignSkillDefinition } from "../contract";

export const protectedDesignPaths = [
  "catalogue.products.*.id",
  "catalogue.products.*.sku",
  "catalogue.products.*.price",
  "catalogue.products.*.stockStatus",
  "catalogue.products.*.images",
  "payment.configuration",
  "shipping.configuration",
  "tax.configuration",
  "orders.*",
  "inventory.*",
  "checkout.operationalBehaviour",
] as const;

export const requiredValidationRules: DesignSkillDefinition["validationRules"] = [
  "structuredOperationsOnly",
  "declaredOperationsOnly",
  "declaredComponentsOnly",
  "protectedPathsPreserved",
  "requestedScopePreserved",
  "noExecutableContent",
  "canonicalPageValid",
];

export const operationArraySchema = designOperationSchema.array();

type StyleDirection = {
  variants: Readonly<Record<string, string>>;
  background: (section: SectionInstance, index: number) => "background" | "surface";
  typography: "serif" | "sans" | "strong";
  density: "compact" | "standard" | "spacious";
  shape: "square" | "soft" | "rounded";
};

function operationForProperty(
  sectionId: string,
  type: DesignOperationType,
  property: string,
  value: string,
): DesignOperation {
  return { type, sectionId, [property]: value } as DesignOperation;
}

export function createStyleOperations(page: PageModel, direction: StyleDirection) {
  const operations: DesignOperation[] = [];
  page.sections.forEach((section, index) => {
    const definition = getComponentDefinition(section.component);
    const variant = direction.variants[section.component];
    if (variant && variant !== section.variant && definition.variants.includes(variant)) {
      operations.push({ type: "CHANGE_SECTION_VARIANT", sectionId: section.id, variant });
    }
    for (const [type, property, value] of [
      ["CHANGE_BACKGROUND", "background", direction.background(section, index)],
      ["CHANGE_TYPOGRAPHY", "typography", direction.typography],
      ["CHANGE_DENSITY", "density", direction.density],
      ["CHANGE_SHAPE", "shape", direction.shape],
    ] as const) {
      if (definition.editorFields[property] && section.props[property] !== value) {
        operations.push(operationForProperty(section.id, type, property, value));
      }
    }
  });
  return operations;
}

export function luxuryTypography(brand: BrandSystem) {
  return brand.typography.headingFont === "georgia" ||
    brand.typography.headingFont === "system-serif"
    ? ("serif" as const)
    : ("strong" as const);
}

export function luxuryShape(brand: BrandSystem) {
  if (brand.shape.radius === "square") return "square" as const;
  if (brand.shape.radius === "subtle") return "soft" as const;
  return "rounded" as const;
}

export function minimalShape(brand: BrandSystem) {
  return brand.shape.radius === "square" || brand.shape.radius === "subtle"
    ? ("square" as const)
    : ("soft" as const);
}

export function nextSectionId(page: PageModel, base: string) {
  if (!page.sections.some((section) => section.id === base)) return base;
  let suffix = 2;
  while (page.sections.some((section) => section.id === `${base}_${suffix}`)) suffix += 1;
  return `${base}_${suffix}`;
}
