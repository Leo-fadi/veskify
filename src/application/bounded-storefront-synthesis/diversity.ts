import type { DesignDna } from "@/domain/design-system";
import { canonicalValueFingerprint } from "@/domain/storefront";
import type { BoundedStorefrontSynthesisDecision } from "./contract";
import {
  COORDINATED_STOREFRONT_DIVERSITY_CONTRACT_VERSION,
  diversityClassificationSchema,
  storefrontDiversityFingerprintSchema,
  type CoordinatedStorefrontDirectionPackage,
  type DiversityClassification,
  type StorefrontDiversityFingerprint,
} from "./direction-contract";

export type StorefrontDiversityMaterial = Readonly<{
  directionAuthority: Readonly<{
    id: string;
    version: string;
    authorityFingerprint: string;
  }>;
  designDna: DesignDna;
  pageSet: readonly string[];
  pageProfiles: readonly Readonly<{
    pageKey: string;
    familyId: string;
    profileId: string;
    profileVersion: string;
  }>[];
  sharedFrame: Readonly<{
    profileId: string;
    profileVersion: string;
    authorityFingerprint: string;
  }>;
  componentAnatomies: readonly Readonly<{
    pageKey: string;
    slotId: string;
    component: string;
    variant: string;
    anatomyId: string | null;
  }>[];
  boundedParameters: Readonly<Record<string, string | number | boolean>>;
  artDirection: string;
  density: string;
  narrative: Readonly<{ posture: string; roleSequence: readonly string[] }>;
  responsive: Readonly<{ mode: string; breakpoints: readonly number[] }>;
}>;

function fingerprint(label: string, material: unknown): string {
  return `${label}-${canonicalValueFingerprint(material)}`;
}

function structuralDesignDna(designDna: DesignDna) {
  const { colour, ...structural } = designDna;
  void colour;
  return structural;
}

function designScopePageSet(
  decision: BoundedStorefrontSynthesisDecision,
): StorefrontDiversityMaterial["pageSet"] {
  // Concrete collection/product route cardinality is commerce inventory, not
  // design diversity. pageProfileSelections is the canonical synthesis view
  // of static page scopes plus deduplicated dynamic archetype scopes.
  return [
    ...new Set(
      decision.pageProfileSelections.map(({ pageKey, familyId }) => `${familyId}:${pageKey}`),
    ),
  ].sort((left, right) => left.localeCompare(right));
}

export function createStorefrontDiversityFingerprintFromMaterial(
  material: StorefrontDiversityMaterial,
): StorefrontDiversityFingerprint {
  const dimensions = {
    designDna: fingerprint("diversity-dna", structuralDesignDna(material.designDna)),
    pageSet: fingerprint("diversity-page-set", material.pageSet),
    pageProfiles: fingerprint("diversity-page-profiles", material.pageProfiles),
    sharedFrame: fingerprint("diversity-frame", material.sharedFrame),
    componentAnatomies: fingerprint("diversity-components", material.componentAnatomies),
    boundedParameters: fingerprint("diversity-parameters", material.boundedParameters),
    artDirection: fingerprint("diversity-art", material.artDirection),
    density: fingerprint("diversity-density", material.density),
    narrative: fingerprint("diversity-narrative", material.narrative),
    responsive: fingerprint("diversity-responsive", material.responsive),
  };
  const paletteFingerprint = fingerprint("diversity-palette", material.designDna.colour);
  const structuralFingerprint = fingerprint("storefront-structure", dimensions);
  return storefrontDiversityFingerprintSchema.parse({
    version: COORDINATED_STOREFRONT_DIVERSITY_CONTRACT_VERSION,
    exactFingerprint: fingerprint("storefront-diversity", {
      directionAuthority: material.directionAuthority,
      structuralFingerprint,
      paletteFingerprint,
    }),
    structuralFingerprint,
    paletteFingerprint,
    dimensions,
  });
}

export function storefrontDiversityMaterialFromDecision(input: {
  decision: BoundedStorefrontSynthesisDecision;
  designDna: DesignDna;
  direction: CoordinatedStorefrontDirectionPackage;
}): StorefrontDiversityMaterial {
  return {
    directionAuthority: {
      id: input.direction.id,
      version: input.direction.version,
      authorityFingerprint: input.direction.authorityFingerprint,
    },
    designDna: structuredClone(input.designDna),
    pageSet: designScopePageSet(input.decision),
    pageProfiles: input.decision.pageProfileSelections.map(
      ({ pageKey, familyId, profileId, profileVersion }) => ({
        pageKey,
        familyId,
        profileId,
        profileVersion,
      }),
    ),
    sharedFrame: structuredClone(input.decision.sharedFrame),
    componentAnatomies: input.decision.componentChoices.map(
      ({ pageKey, slotId, component, variant, anatomyId }) => ({
        pageKey,
        slotId,
        component,
        variant,
        anatomyId,
      }),
    ),
    boundedParameters: structuredClone(input.decision.boundedParameters),
    artDirection: input.decision.artDirectionPosture,
    density: input.decision.informationDensityPosture,
    narrative: {
      posture: input.decision.narrative.posture,
      roleSequence: [...input.decision.narrative.roleSequence],
    },
    responsive: {
      mode: input.decision.responsivePosture.mode,
      breakpoints: [...input.decision.responsivePosture.breakpoints],
    },
  };
}

export function createStorefrontDiversityFingerprint(input: {
  decision: BoundedStorefrontSynthesisDecision;
  designDna: DesignDna;
  direction: CoordinatedStorefrontDirectionPackage;
}): StorefrontDiversityFingerprint {
  return createStorefrontDiversityFingerprintFromMaterial(
    storefrontDiversityMaterialFromDecision(input),
  );
}

export type StorefrontDiversityComparison = Readonly<{
  classification: DiversityClassification;
  changedDimensions: readonly (keyof StorefrontDiversityFingerprint["dimensions"])[];
}>;

export function compareStorefrontDiversity(
  left: StorefrontDiversityFingerprint,
  right: StorefrontDiversityFingerprint,
): StorefrontDiversityComparison {
  const leftValue = storefrontDiversityFingerprintSchema.parse(left);
  const rightValue = storefrontDiversityFingerprintSchema.parse(right);
  const changedDimensions = (
    Object.keys(leftValue.dimensions) as (keyof StorefrontDiversityFingerprint["dimensions"])[]
  ).filter((key) => leftValue.dimensions[key] !== rightValue.dimensions[key]);
  let classification: DiversityClassification;
  if (leftValue.exactFingerprint === rightValue.exactFingerprint) {
    classification = "exact-duplicate";
  } else if (
    leftValue.structuralFingerprint === rightValue.structuralFingerprint &&
    leftValue.paletteFingerprint !== rightValue.paletteFingerprint
  ) {
    classification = "palette-only";
  } else if (changedDimensions.length === 1 && changedDimensions[0] === "componentAnatomies") {
    classification = "shallow-component-swap";
  } else if (changedDimensions.length <= 2) {
    classification = "near-duplicate";
  } else {
    const changesRenderedArchitecture = changedDimensions.some((dimension) =>
      [
        "designDna",
        "pageSet",
        "pageProfiles",
        "sharedFrame",
        "componentAnatomies",
        "boundedParameters",
      ].includes(dimension),
    );
    classification = changesRenderedArchitecture ? "materially-different" : "near-duplicate";
  }
  return {
    classification: diversityClassificationSchema.parse(classification),
    changedDimensions,
  };
}
