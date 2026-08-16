import type { ComponentCommercialAnatomy } from "@/domain/component-platform";
import { canonicalValueFingerprint } from "@/domain/storefront";

export type ResponsiveExecutionAuthority = Readonly<{
  contractVersion: "responsive-execution-v1";
  anatomyIdentity: string;
  variantId: string;
  transformationIds: readonly string[];
  transformationModes: readonly string[];
  mobile: readonly string[];
  tablet: readonly string[];
  desktop: readonly string[];
  wide: readonly string[];
  fingerprint: string;
}>;

/**
 * Derives renderer-facing responsive execution from the registered component
 * anatomy. This is a transient projection, not another breakpoint or variant
 * registry.
 */
export function resolveResponsiveExecutionAuthority(
  anatomy: ComponentCommercialAnatomy,
  variantId: string,
): ResponsiveExecutionAuthority {
  const variant = anatomy.variants.find((candidate) => candidate.variantId === variantId);
  if (!variant) {
    throw new Error(`Responsive execution requires registered variant ${variantId}.`);
  }
  const transformations = variant.structure.responsiveTransformationIds.map((id) => {
    const transformation = anatomy.responsiveTransformations.find(
      (candidate) => candidate.id === id,
    );
    if (!transformation) {
      throw new Error(`Responsive execution requires registered transformation ${id}.`);
    }
    return transformation;
  });
  const base = {
    contractVersion: "responsive-execution-v1" as const,
    anatomyIdentity: anatomy.identity,
    variantId,
    transformationIds: transformations.map(({ id }) => id),
    transformationModes: [...new Set(transformations.map(({ mode }) => mode))],
    mobile: transformations.flatMap(({ id, breakpoints }) =>
      breakpoints.includes("mobile") ? [id] : [],
    ),
    tablet: transformations.flatMap(({ id, breakpoints }) =>
      breakpoints.includes("tablet") ? [id] : [],
    ),
    desktop: transformations.flatMap(({ id, breakpoints }) =>
      breakpoints.includes("desktop") ? [id] : [],
    ),
    wide: transformations.flatMap(({ id, breakpoints }) =>
      breakpoints.includes("wide") ? [id] : [],
    ),
  };
  return Object.freeze({
    ...base,
    fingerprint: `responsive-execution-v1_${canonicalValueFingerprint(base)}`,
  });
}

export function responsiveExecutionDataAttributes(authority: ResponsiveExecutionAuthority) {
  return {
    "data-responsive-execution": authority.contractVersion,
    "data-responsive-execution-fingerprint": authority.fingerprint,
    "data-responsive-transformations": authority.transformationIds.join(" "),
    "data-responsive-mobile": authority.mobile.join(" "),
    "data-responsive-tablet": authority.tablet.join(" "),
    "data-responsive-desktop": authority.desktop.join(" "),
    "data-responsive-wide": authority.wide.join(" "),
  } as const;
}
