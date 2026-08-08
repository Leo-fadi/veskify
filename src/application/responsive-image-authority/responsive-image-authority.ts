import type { DesignDna } from "@/domain/design-system";
import { resolveBrandSystemDesignDna, type BrandSystem } from "@/domain/design-system";
import {
  createResponsiveImageAuthority,
  rectContains,
  responsiveImageAuthoritySchema,
  responsiveImageBreakpointSchema,
  responsiveImageBreakpoints,
  type ResponsiveImageAuthority,
  type ResponsiveImageBreakpoint,
  type ResponsiveImageTreatment,
} from "@/domain/asset-presentation";
import { formatComponentVersion, type ComponentDefinitionV2 } from "@/domain/component-platform";
import type {
  ApprovedAssetPlacementOperation,
  ApprovedAssetPresentation,
} from "@/domain/storefront";
import type { ProductPresentationContext } from "@/domain/component-platform";
import { canonicalValueFingerprint } from "@/domain/storefront";

export function createCanonicalProductMediaResponsiveAuthority(
  input: Readonly<{
    component: ComponentDefinitionV2;
    variant: string;
    brandSystem: BrandSystem;
    productId: string;
    media: ProductPresentationContext["media"][number];
    revision: string;
    assetSlotId: string;
  }>,
) {
  if (input.media.role === "editorial") {
    throw new ResponsiveImageAuthorityError(
      "editorial-product-replacement",
      "Editorial media cannot replace canonical product media.",
    );
  }
  const anatomy = input.component.commercialAnatomy;
  const placement = anatomy?.variants
    .find(({ variantId }) => variantId === input.variant)
    ?.structure?.assetPlacements.find(({ slotId }) => slotId === input.assetSlotId);
  if (!anatomy || !placement) {
    throw new ResponsiveImageAuthorityError(
      "wrong-anatomy",
      "Canonical product media requires registered component anatomy placement.",
    );
  }
  const role = input.media.role === "main" ? "productMainImage" : "productAlternativeImage";
  const dna = resolveBrandSystemDesignDna(input.brandSystem);
  const materialFingerprint = `product-media-${canonicalValueFingerprint({
    assetId: input.media.assetId,
    productId: input.productId,
    revision: input.revision,
    role,
  })}`;
  return createResponsiveImageAuthority({
    contractVersion: "1.0.0",
    source: {
      assetId: input.media.assetId,
      role,
      revision: input.revision,
      materialFingerprint,
      provenanceKind: "canonicalProductMedia",
      sourceOwnerId: input.productId,
    },
    placement: {
      componentType: input.component.type,
      componentVersion: formatComponentVersion(input.component.version),
      variant: input.variant,
      anatomyContractVersion: anatomy.contractVersion,
      anatomyIdentity: anatomy.identity,
      anatomyVersion: formatComponentVersion(anatomy.version),
      anatomyRegion: placement.region,
      assetSlotId: input.assetSlotId,
      required: false,
    },
    safeArea: { x: 0, y: 0, width: 1, height: 1 },
    sourceTreatment: {
      ratio: dna.media.ratio,
      crop: { mode: "contain" },
      focalPoint: { x: 0.5, y: 0.5 },
      overlay: "none",
    },
    responsiveTreatments: responsiveImageBreakpoints.map((breakpoint) => ({
      breakpoint,
      treatment: {
        ratio: dna.media.ratio,
        crop: { mode: "contain" as const },
        focalPoint: { x: 0.5, y: 0.5 },
        overlay: "none" as const,
      },
    })),
    derivatives: [],
  });
}

export const responsiveImageAuthorityErrorCodes = [
  "unknown-authority",
  "stale-authority",
  "unapproved-derivative",
  "wrong-source",
  "wrong-role",
  "wrong-slot",
  "wrong-anatomy",
  "invalid-geometry",
  "invalid-ratio",
  "invalid-overlay",
  "invalid-breakpoint",
  "dna-broadening",
  "wrong-product",
  "editorial-product-replacement",
  "required-image-unresolved",
] as const;

export type ResponsiveImageAuthorityErrorCode = (typeof responsiveImageAuthorityErrorCodes)[number];

export class ResponsiveImageAuthorityError extends Error {
  constructor(
    readonly code: ResponsiveImageAuthorityErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "ResponsiveImageAuthorityError";
  }
}

const cropAllowance: Readonly<Record<DesignDna["media"]["crop"], readonly string[]>> = {
  contain: ["natural", "contain"],
  cover: ["natural", "contain", "cover"],
  editorial: ["natural", "contain", "cover", "editorial"],
};
const overlayAllowance: Readonly<Record<DesignDna["media"]["overlay"], readonly string[]>> = {
  none: ["none"],
  subtle: ["none", "subtle"],
  contrast: ["none", "subtle", "contrast"],
  gradient: ["none", "subtle", "gradient"],
};

function sameLineage(
  left: ResponsiveImageAuthority["source"],
  right: ResponsiveImageAuthority["source"],
) {
  return (
    left.assetId === right.assetId &&
    left.role === right.role &&
    left.revision === right.revision &&
    left.materialFingerprint === right.materialFingerprint &&
    left.provenanceKind === right.provenanceKind &&
    left.sourceOwnerId === right.sourceOwnerId
  );
}

function assertTreatment(
  treatment: ResponsiveImageTreatment,
  authority: ResponsiveImageAuthority,
  dna: DesignDna,
) {
  if (!cropAllowance[dna.media.crop].includes(treatment.crop.mode)) {
    throw new ResponsiveImageAuthorityError(
      "dna-broadening",
      "Image crop broadens the Design DNA media posture.",
    );
  }
  if (!overlayAllowance[dna.media.overlay].includes(treatment.overlay)) {
    throw new ResponsiveImageAuthorityError(
      "invalid-overlay",
      "Image overlay broadens the Design DNA overlay authority.",
    );
  }
  if (treatment.ratio !== "natural" && dna.media.ratio !== treatment.ratio) {
    throw new ResponsiveImageAuthorityError(
      "invalid-ratio",
      "Image ratio is outside the Design DNA default.",
    );
  }
  if (
    authority.safeArea &&
    treatment.crop.rect &&
    !rectContains(treatment.crop.rect, authority.safeArea)
  ) {
    throw new ResponsiveImageAuthorityError(
      "invalid-geometry",
      "The approved crop does not contain the source safe area.",
    );
  }
  if (
    authority.safeArea &&
    (treatment.crop.mode === "cover" ||
      (treatment.crop.mode === "editorial" && treatment.crop.rect === undefined))
  ) {
    throw new ResponsiveImageAuthorityError(
      "invalid-geometry",
      "Safe-area authority requires contain/natural treatment or an explicit containing editorial crop.",
    );
  }
}

export function validateResponsiveImageAuthority({
  authority: input,
  component,
  dna,
  expectedProductId,
}: {
  authority: unknown;
  component: ComponentDefinitionV2;
  dna: DesignDna;
  expectedProductId?: string;
}): ResponsiveImageAuthority {
  const parsed = responsiveImageAuthoritySchema.safeParse(input);
  if (!parsed.success) {
    const issues = parsed.error.issues;
    const code: ResponsiveImageAuthorityErrorCode = issues.some(
      (issue) => issue.path.includes("source") || issue.message.toLowerCase().includes("lineage"),
    )
      ? "wrong-source"
      : issues.some((issue) => issue.path.includes("fingerprint"))
        ? "stale-authority"
        : issues.some((issue) => issue.path.includes("breakpoint"))
          ? "invalid-breakpoint"
          : issues.some((issue) => issue.path.includes("ratio"))
            ? "invalid-ratio"
            : issues.some((issue) => issue.path.includes("overlay"))
              ? "invalid-overlay"
              : "invalid-geometry";
    throw new ResponsiveImageAuthorityError(
      code,
      issues[0]?.message ?? "Responsive image authority is invalid.",
    );
  }
  const authority = parsed.data;
  if (authority.placement.componentType !== component.type) {
    throw new ResponsiveImageAuthorityError(
      "unknown-authority",
      "Image component authority does not match the registered component.",
    );
  }
  if (authority.placement.componentVersion !== formatComponentVersion(component.version)) {
    throw new ResponsiveImageAuthorityError(
      "stale-authority",
      "Image component authority is stale.",
    );
  }
  if (!component.variants.some(({ id }) => id === authority.placement.variant)) {
    throw new ResponsiveImageAuthorityError(
      "unknown-authority",
      "Image variant is not registered.",
    );
  }
  const anatomy = component.commercialAnatomy;
  const anatomyVersion = anatomy ? formatComponentVersion(anatomy.version) : undefined;
  if (
    !anatomy ||
    authority.placement.anatomyContractVersion !== anatomy.contractVersion ||
    authority.placement.anatomyIdentity !== anatomy.identity ||
    authority.placement.anatomyVersion !== anatomyVersion ||
    !anatomy.regions.some(({ id }) => id === authority.placement.anatomyRegion)
  ) {
    throw new ResponsiveImageAuthorityError(
      "wrong-anatomy",
      "Image anatomy authority is missing, unknown, or stale.",
    );
  }
  const slot = component.assetSlots.find(({ id }) => id === authority.placement.assetSlotId);
  const requirement = anatomy.compatibility.assetRequirements.find(
    ({ slotId }) => slotId === authority.placement.assetSlotId,
  );
  const variant = anatomy.variants.find(
    ({ variantId }) => variantId === authority.placement.variant,
  );
  const placement = variant?.structure?.assetPlacements.find(
    ({ slotId }) => slotId === authority.placement.assetSlotId,
  );
  if (
    !slot ||
    !requirement ||
    !placement ||
    placement.region !== authority.placement.anatomyRegion
  ) {
    throw new ResponsiveImageAuthorityError(
      "wrong-slot",
      "Image slot is outside registered anatomy authority.",
    );
  }
  if (
    slot.required !== authority.placement.required ||
    requirement.required !== authority.placement.required ||
    !slot.acceptedRoles.includes(authority.source.role) ||
    !requirement.acceptedRoles.includes(authority.source.role)
  ) {
    throw new ResponsiveImageAuthorityError(
      "wrong-role",
      "Image role or cardinality does not match the registered slot.",
    );
  }
  if (expectedProductId !== undefined) {
    if (
      authority.source.provenanceKind !== "canonicalProductMedia" ||
      authority.source.sourceOwnerId !== expectedProductId
    ) {
      throw new ResponsiveImageAuthorityError(
        "wrong-product",
        "Product media must retain exact canonical product ownership.",
      );
    }
    if (
      authority.source.role !== "productMainImage" &&
      authority.source.role !== "productAlternativeImage"
    ) {
      throw new ResponsiveImageAuthorityError(
        "editorial-product-replacement",
        "Editorial media cannot replace canonical product media.",
      );
    }
    const treatments = [
      authority.sourceTreatment,
      ...authority.responsiveTreatments.map(({ treatment }) => treatment),
      ...authority.derivatives.map(({ transform }) => transform),
    ];
    if (treatments.some(({ crop }) => crop.mode === "editorial")) {
      throw new ResponsiveImageAuthorityError(
        "editorial-product-replacement",
        "Editorial crop geometry is not permitted for product media.",
      );
    }
  }
  assertTreatment(authority.sourceTreatment, authority, dna);
  authority.responsiveTreatments.forEach(({ treatment }) =>
    assertTreatment(treatment, authority, dna),
  );
  authority.derivatives.forEach((derivative) => {
    if (derivative.approvalStatus !== "approved") {
      throw new ResponsiveImageAuthorityError(
        "unapproved-derivative",
        "Only approved derivatives may be selected.",
      );
    }
    if (!sameLineage(derivative.source, authority.source)) {
      throw new ResponsiveImageAuthorityError(
        "wrong-source",
        "Derivative source lineage is invalid.",
      );
    }
    assertTreatment(derivative.transform, authority, dna);
  });
  return authority;
}

const fallbackOrder: Readonly<
  Record<ResponsiveImageBreakpoint, readonly ResponsiveImageBreakpoint[]>
> = {
  mobile: ["mobile", "tablet", "desktop", "wide"],
  tablet: ["tablet", "mobile", "desktop", "wide"],
  desktop: ["desktop", "tablet", "wide", "mobile"],
  wide: ["wide", "desktop", "tablet", "mobile"],
};

export type ResolvedResponsiveImage = Readonly<{
  requestedBreakpoint: ResponsiveImageBreakpoint;
  selectedBreakpoint: ResponsiveImageBreakpoint | "source";
  treatment: ResponsiveImageTreatment;
  derivativeId?: string;
  fingerprint: string;
}>;

export function resolveResponsiveImage(
  authority: ResponsiveImageAuthority,
  breakpointInput: unknown,
): ResolvedResponsiveImage {
  const parsedBreakpoint = responsiveImageBreakpointSchema.safeParse(breakpointInput);
  if (!parsedBreakpoint.success) {
    throw new ResponsiveImageAuthorityError(
      "invalid-breakpoint",
      "Responsive image breakpoint is not registered.",
    );
  }
  const breakpoint = parsedBreakpoint.data;
  for (const candidate of fallbackOrder[breakpoint]) {
    const treatment = authority.responsiveTreatments.find(
      (item) => item.breakpoint === candidate,
    )?.treatment;
    if (!treatment) continue;
    const derivative = authority.derivatives.find(
      (item) => item.approvalStatus === "approved" && item.breakpoint === candidate,
    );
    return {
      requestedBreakpoint: breakpoint,
      selectedBreakpoint: candidate,
      treatment,
      ...(derivative ? { derivativeId: derivative.derivativeId } : {}),
      fingerprint: authority.fingerprint,
    };
  }
  return {
    requestedBreakpoint: breakpoint,
    selectedBreakpoint: "source",
    treatment: authority.sourceTreatment,
    fingerprint: authority.fingerprint,
  };
}

export function resolveResponsiveImageOrOmit(
  authority: ResponsiveImageAuthority | undefined,
  breakpoint: unknown,
  required: boolean,
): ResolvedResponsiveImage | undefined {
  if (authority) return resolveResponsiveImage(authority, breakpoint);
  if (!required) return undefined;
  throw new ResponsiveImageAuthorityError(
    "required-image-unresolved",
    "A required responsive image has no valid source authority.",
  );
}

export function migrateApprovedPresentationArtDirection({
  presentation,
  placement,
  component,
  dna,
  provenanceKind,
  variant = component.defaultVariant,
}: {
  presentation: ApprovedAssetPresentation;
  placement: ApprovedAssetPlacementOperation;
  component: ComponentDefinitionV2;
  dna: DesignDna;
  variant?: string;
  provenanceKind: ResponsiveImageAuthority["source"]["provenanceKind"];
}): ApprovedAssetPresentation {
  if (presentation.artDirection) return presentation;
  const anatomy = component.commercialAnatomy;
  const anatomyVariant = anatomy?.variants.find(({ variantId }) => variantId === variant);
  const anatomyPlacement = anatomyVariant?.structure?.assetPlacements.find(
    ({ slotId }) => slotId === placement.assetSlotId,
  );
  if (!anatomy || !anatomyPlacement) return presentation;
  const sourceTreatment: ResponsiveImageTreatment = {
    ratio: dna.media.ratio,
    crop: { mode: dna.media.crop },
    focalPoint: { x: 0.5, y: 0.5 },
    overlay: dna.media.overlay,
  };
  return {
    ...presentation,
    artDirection: createResponsiveImageAuthority({
      contractVersion: "1.0.0",
      source: {
        assetId: presentation.assetId,
        role: presentation.role,
        revision: presentation.revision,
        materialFingerprint: presentation.materialFingerprint,
        provenanceKind,
        sourceOwnerId: placement.sourceReferenceId,
      },
      placement: {
        componentType: component.type,
        componentVersion: formatComponentVersion(component.version),
        variant,
        anatomyContractVersion: anatomy.contractVersion,
        anatomyIdentity: anatomy.identity,
        anatomyVersion: formatComponentVersion(anatomy.version),
        anatomyRegion: anatomyPlacement.region,
        assetSlotId: placement.assetSlotId,
        required: placement.required,
      },
      sourceTreatment,
      responsiveTreatments: responsiveImageBreakpoints.map((breakpoint) => ({
        breakpoint,
        treatment: sourceTreatment,
      })),
      derivatives: [],
    }),
  };
}
