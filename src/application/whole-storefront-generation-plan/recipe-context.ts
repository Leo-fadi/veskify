import { storefrontTemplateDefinitions } from "@/application/storefront-templates";
import { canonicalValueFingerprint } from "@/domain/storefront";
import { wholeStorefrontRecipeContextSchema, type WholeStorefrontRecipeContext } from "./contract";

/** Returns the immutable, implemented template registry used as planning recipes. */
export function createWholeStorefrontRecipeContext(): WholeStorefrontRecipeContext {
  const templates = storefrontTemplateDefinitions
    .filter((template) => template.status === "implemented")
    .map((template) => structuredClone(template))
    .sort((left, right) => left.id.localeCompare(right.id));
  return wholeStorefrontRecipeContextSchema.parse({
    templates,
    fingerprint: `storefront-recipes-${canonicalValueFingerprint(templates)}`,
  });
}
