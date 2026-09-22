import { parsePageBlueprintV2CandidateAuthority } from "@/application/storefront-templates/page-blueprint-v2-candidate-authority";
import {
  createPageBlueprintV2RegionRelationshipKey,
  type PageBlueprintV2RegionRelationship,
} from "@/application/storefront-templates/page-blueprint-v2-contract";
import type {
  PageBlueprintCompositionRealizationRequest,
  PageBlueprintCompositionRealizationSupport,
} from "@/application/storefront-templates/validate-page-blueprint-composition";
import type { CompiledPageBlueprintCompositionV1 } from "@/domain/storefront/compiled-page-blueprint-composition";
import { canonicalValueFingerprint } from "@/domain/storefront/canonical-storefront";

export const composedPageRealizationSupportId = "ar06a-static-layout";
export const composedPageRealizationSupportVersion = "1.0.0";

export type ComposedPageRegionLayout = Readonly<{
  id: string;
  sectionIds: readonly string[];
}>;

export type ComposedPageLayout = Readonly<{
  regions: readonly ComposedPageRegionLayout[];
  pairs: readonly Readonly<{ sourceRegionId: string; targetRegionId: string; offset: boolean }>[];
}>;

const supportMaterial = {
  id: composedPageRealizationSupportId,
  version: composedPageRealizationSupportVersion,
  realizations: {
    region: "section-flow",
    precedes: "precedes-preserve",
    pair: { stacked: "pair-stack", columns: "pair-columns" },
    offset: { none: "offset-none", blockStart: "offset-block-start" },
  },
  breakpoints: [375, 768, 1024, 1440],
  geometry: {
    columnsFrom: 1024,
    offsetToken: "3rem * --brand-spacing-scale",
    equalColumns: true,
    offsetProperty: "padding-block-start",
    gapToken: "--brand-grid-gap",
    gutterToken: "--brand-page-gutter",
    containerToken: "--brand-container-content",
    compactTransforms: ["stack", "remove-offset"],
  },
} as const;

export const composedPageRealizationSupportFingerprint = `ar06a-static-layout-${canonicalValueFingerprint(
  supportMaterial,
)}`;

function relationMatches(
  relation: PageBlueprintV2RegionRelationship,
  realizationId: string,
  transformation: string,
  breakpoint?: "mobile" | "tablet" | "desktop" | "wide",
): boolean {
  if (relation.relationshipKind === "precedes")
    return realizationId === supportMaterial.realizations.precedes && transformation === "preserve";
  if (relation.relationshipKind === "pairs-with")
    return breakpoint === "mobile" || breakpoint === "tablet"
      ? realizationId === supportMaterial.realizations.pair.stacked && transformation === "stack"
      : realizationId === supportMaterial.realizations.pair.columns &&
          transformation === "preserve";
  if (relation.relationshipKind === "offsets")
    return breakpoint === "mobile" || breakpoint === "tablet"
      ? realizationId === supportMaterial.realizations.offset.none &&
          transformation === "remove-offset"
      : realizationId === supportMaterial.realizations.offset.blockStart &&
          transformation === "preserve";
  return false;
}

type Arrangement = Readonly<{
  regionIds: readonly string[];
  pairs: readonly Readonly<{ sourceRegionId: string; targetRegionId: string; offset: boolean }>[];
}>;

/** Validates the entire limited geometry grammar before either support or rendering proceeds. */
export function inspectComposedPageArrangement(candidateInput: unknown): Arrangement {
  const candidate = parsePageBlueprintV2CandidateAuthority(candidateInput);
  const order = candidate.structural.orderAlternatives.find(
    (entry) => entry.id === candidate.structural.defaultOrderAlternativeId,
  );
  if (!order || order.regionIds.length !== candidate.structural.regions.length)
    throw new Error("Composed renderer rejected an incomplete default order.");
  const regionIds = [...order.regionIds];
  if (
    candidate.responsiveRules.breakpointRules.some(
      (rule) =>
        rule.regionProportionRules.some((entry) => entry.proportionMode !== "preserve") ||
        candidate.structural.orderAlternatives
          .find((entry) => entry.id === rule.orderAlternativeId)
          ?.regionIds.join("\u0000") !== regionIds.join("\u0000"),
    )
  )
    throw new Error("Composed renderer rejected divergent responsive order or proportions.");
  const pairs = candidate.structural.relationships.filter(
    (entry) => entry.relationshipKind === "pairs-with",
  );
  const offsets = candidate.structural.relationships.filter(
    (entry) => entry.relationshipKind === "offsets",
  );
  if (
    !candidate.structural.relationships.every((entry) =>
      ["precedes", "pairs-with", "offsets"].includes(entry.relationshipKind),
    )
  )
    throw new Error("Composed renderer rejected an unsupported relationship kind.");
  const pairedRegions = new Set<string>();
  const grouped = pairs.map((pair) => {
    const indices = [
      regionIds.indexOf(pair.sourceRegionId),
      regionIds.indexOf(pair.targetRegionId),
    ].sort((a, b) => a - b);
    const [source, target] = indices;
    if (
      source < 0 ||
      target !== source + 1 ||
      pairedRegions.has(pair.sourceRegionId) ||
      pairedRegions.has(pair.targetRegionId)
    )
      throw new Error("Composed renderer rejected overlapping or non-adjacent pairs.");
    pairedRegions.add(pair.sourceRegionId);
    pairedRegions.add(pair.targetRegionId);
    const sourceRegionId = regionIds[source];
    const targetRegionId = regionIds[target];
    const offset = offsets.filter(
      (entry) => entry.sourceRegionId === sourceRegionId && entry.targetRegionId === targetRegionId,
    );
    if (offset.length > 1) throw new Error("Composed renderer rejected duplicate pair offsets.");
    return Object.freeze({
      sourceRegionId,
      targetRegionId,
      offset: offset.length === 1,
    });
  });
  if (
    offsets.some(
      (entry) =>
        !grouped.some(
          (pair) =>
            pair.offset &&
            pair.sourceRegionId === entry.sourceRegionId &&
            pair.targetRegionId === entry.targetRegionId,
        ),
    )
  )
    throw new Error("Composed renderer rejected an offset outside its pair.");
  return Object.freeze({ regionIds: Object.freeze(regionIds), pairs: Object.freeze(grouped) });
}

/** The executable subset is ordered whole-section regions and disjoint adjacent pairs. */
export function resolveComposedPageRealization(
  request: PageBlueprintCompositionRealizationRequest,
): boolean {
  if (
    request.owner.kind !== "static-page" ||
    !request.candidate.candidateFingerprint ||
    !request.bindingFingerprint ||
    !request.owner.id
  )
    return false;
  let arrangement: Arrangement;
  try {
    arrangement = inspectComposedPageArrangement(request.candidate);
    // This first consumer has no omission realization. Compare the actual
    // capacity projection, not an unrelated asset declaration on the candidate.
    if (
      canonicalValueFingerprint(request.structural) !==
      canonicalValueFingerprint(request.candidate.structural)
    )
      return false;
  } catch {
    return false;
  }
  switch (request.kind) {
    case "region":
      return (
        request.realizationId === supportMaterial.realizations.region &&
        request.units.length > 0 &&
        request.units.every(
          (unit) =>
            unit.visible &&
            unit.key.startsWith("section:") &&
            unit.definition.type === unit.component,
        )
      );
    case "relationship":
      return relationMatches(
        request.relationship,
        request.realizationId,
        request.transformation,
        request.breakpoint,
      );
    case "breakpoint":
      return (
        request.realizationId === request.rule.orderAlternativeId &&
        request.order.id === request.rule.orderAlternativeId &&
        request.order.regionIds.join("\u0000") === arrangement.regionIds.join("\u0000")
      );
  }
}

export const composedPageRealizationSupport: PageBlueprintCompositionRealizationSupport =
  Object.freeze({
    id: composedPageRealizationSupportId,
    version: composedPageRealizationSupportVersion,
    implementationFingerprint: composedPageRealizationSupportFingerprint,
    resolve: resolveComposedPageRealization,
  });

/** Converts already-validated canonical assignments into a render-only layout projection. */
export function deriveComposedPageLayout(input: {
  composition: CompiledPageBlueprintCompositionV1;
  candidate: unknown;
}): ComposedPageLayout {
  if (input.composition.omissions.length > 0)
    throw new Error("Composed renderer rejected omitted regions.");
  const candidate = parsePageBlueprintV2CandidateAuthority(input.candidate);
  const assignments = new Map(
    input.composition.regionAssignments.map((entry) => [entry.regionId, entry]),
  );
  const order = candidate.structural.orderAlternatives.find(
    (entry) => entry.id === input.composition.orderAlternativeId,
  );
  if (!order) throw new Error("Composed renderer rejected an unknown order alternative.");
  const regions = order.regionIds.map((id) => {
    const assignment = assignments.get(id);
    if (!assignment) throw new Error("Composed renderer rejected a missing region assignment.");
    const sectionIds = assignment.units.map((unit) => {
      if (unit.kind !== "section")
        throw new Error("Composed renderer rejected a non-section realization.");
      return unit.sectionId;
    });
    return Object.freeze({ id, sectionIds: Object.freeze(sectionIds) });
  });
  const arrangement = inspectComposedPageArrangement(candidate);
  if (regions.map((region) => region.id).join("\u0000") !== arrangement.regionIds.join("\u0000"))
    throw new Error("Composed renderer rejected inconsistent compiled reading order.");
  return Object.freeze({
    regions: Object.freeze(regions),
    pairs: arrangement.pairs,
  });
}

export function composedRelationshipKey(relation: PageBlueprintV2RegionRelationship): string {
  return createPageBlueprintV2RegionRelationshipKey(relation);
}
