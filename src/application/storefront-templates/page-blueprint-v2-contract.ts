import { z } from "zod";
import {
  narrativeRoleSchema,
  visualWeightSchema,
} from "@/domain/component-platform/design-vocabulary";
import {
  structuralStorefrontPageFamilyIdSchema,
  type StructuralStorefrontPageFamilyId,
} from "@/domain/structural-storefront-family/cross-page-relationships";

export const PAGE_BLUEPRINT_V2_CONTRACT_SCHEMA_VERSION = "2.0.0" as const;
export const PAGE_BLUEPRINT_V2_INITIAL_RECORD_VERSION = "1.0.0" as const;
export const PAGE_BLUEPRINT_V2_SUPPORTED_RECORD_MAJOR_VERSION = 1 as const;

export const MAX_PAGE_BLUEPRINT_V2_ID_LENGTH = 80;
export const MAX_PAGE_BLUEPRINT_V2_REGIONS = 32;
export const MAX_PAGE_BLUEPRINT_V2_RELATIONSHIPS = 192;
export const MAX_PAGE_BLUEPRINT_V2_ORDER_ALTERNATIVES = 16;
export const MAX_PAGE_BLUEPRINT_V2_REGION_CARDINALITY = 32;
export const MAX_PAGE_BLUEPRINT_V2_FAILURE_EVIDENCE = 8;

const compareCodeUnits = (left: string, right: string): number =>
  left < right ? -1 : left > right ? 1 : 0;

const boundedEvidence = (values: Iterable<string>): readonly string[] =>
  Object.freeze(
    [...new Set(values)].sort(compareCodeUnits).slice(0, MAX_PAGE_BLUEPRINT_V2_FAILURE_EVIDENCE),
  );

const evidenceMessage = (label: string, allValues: Iterable<string>): string => {
  const values = [...new Set(allValues)].sort(compareCodeUnits);
  const visible = values.slice(0, MAX_PAGE_BLUEPRINT_V2_FAILURE_EVIDENCE);
  const omitted = values.length - visible.length;
  return `${label}: ${visible.join(", ")}${omitted > 0 ? ` (+${omitted} more)` : ""}.`;
};

export const pageBlueprintV2StableIdSchema = z
  .string()
  .min(1)
  .max(MAX_PAGE_BLUEPRINT_V2_ID_LENGTH)
  .regex(
    /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/,
    "Use a lowercase kebab-case stable identifier without normalization.",
  );

export const pageBlueprintV2RegionIdSchema = pageBlueprintV2StableIdSchema;

export const pageBlueprintV2RecordVersionSchema = z
  .string()
  .max(64)
  .regex(
    /^1\.(?:0|[1-9][0-9]*)\.(?:0|[1-9][0-9]*)$/,
    "PageBlueprint v2 record versions must be canonical major.minor.patch with supported major 1.",
  );

export const pageBlueprintV2RegionRequirementSchema = z.enum(["required", "optional"]);

export const pageBlueprintV2RegionCardinalitySchema = z
  .object({
    minimum: z.number().int().nonnegative().max(MAX_PAGE_BLUEPRINT_V2_REGION_CARDINALITY),
    ideal: z.number().int().nonnegative().max(MAX_PAGE_BLUEPRINT_V2_REGION_CARDINALITY),
    maximum: z.number().int().positive().max(MAX_PAGE_BLUEPRINT_V2_REGION_CARDINALITY),
  })
  .strict()
  .superRefine((cardinality, context) => {
    if (cardinality.minimum > cardinality.ideal) {
      context.addIssue({
        code: "custom",
        path: ["ideal"],
        message: "Region ideal cardinality cannot be lower than its minimum.",
      });
    }
    if (cardinality.ideal > cardinality.maximum) {
      context.addIssue({
        code: "custom",
        path: ["maximum"],
        message: "Region maximum cardinality cannot be lower than its ideal.",
      });
    }
  })
  .readonly();

export const pageBlueprintV2RegionSchema = z
  .object({
    id: pageBlueprintV2RegionIdSchema,
    role: narrativeRoleSchema,
    requirement: pageBlueprintV2RegionRequirementSchema,
    cardinality: pageBlueprintV2RegionCardinalitySchema,
    visualWeight: visualWeightSchema,
  })
  .strict()
  .superRefine((region, context) => {
    if (region.requirement === "required" && region.cardinality.minimum < 1) {
      context.addIssue({
        code: "custom",
        path: ["cardinality", "minimum"],
        message: "A required region must have minimum cardinality of at least one.",
      });
    }
    if (region.requirement === "optional" && region.cardinality.minimum !== 0) {
      context.addIssue({
        code: "custom",
        path: ["cardinality", "minimum"],
        message: "An optional region must have minimum cardinality zero.",
      });
    }
  })
  .readonly();

export type PageBlueprintV2Region = z.infer<typeof pageBlueprintV2RegionSchema>;

type NarrativeRole = z.infer<typeof narrativeRoleSchema>;

export const pageBlueprintV2MinimumRequiredRolesByPageFamily: Readonly<
  Record<StructuralStorefrontPageFamilyId, readonly NarrativeRole[]>
> = Object.freeze({
  home: Object.freeze(["orientation", "primary-discovery"] as const),
  collection: Object.freeze(["orientation", "primary-discovery"] as const),
  search: Object.freeze(["orientation", "primary-discovery"] as const),
  "product-detail": Object.freeze(["product-focus", "conversion"] as const),
  "content-support": Object.freeze(["orientation"] as const),
  utility: Object.freeze(["orientation"] as const),
});

export const pageBlueprintV2RegionRelationshipKinds = Object.freeze([
  "precedes",
  "pairs-with",
  "offsets",
  "contains",
  "spans",
  "anchors",
] as const);

export const pageBlueprintV2RegionRelationshipKindSchema = z.enum(
  pageBlueprintV2RegionRelationshipKinds,
);

export type PageBlueprintV2RegionRelationshipKind = z.infer<
  typeof pageBlueprintV2RegionRelationshipKindSchema
>;

export const pageBlueprintV2RegionRelationshipSchema = z
  .object({
    sourceRegionId: pageBlueprintV2RegionIdSchema,
    relationshipKind: pageBlueprintV2RegionRelationshipKindSchema,
    targetRegionId: pageBlueprintV2RegionIdSchema,
  })
  .strict()
  .superRefine((relationship, context) => {
    if (relationship.sourceRegionId === relationship.targetRegionId) {
      context.addIssue({
        code: "custom",
        path: ["targetRegionId"],
        message: "A region relationship must connect distinct regions.",
      });
    }
  })
  .readonly();

export type PageBlueprintV2RegionRelationship = z.infer<
  typeof pageBlueprintV2RegionRelationshipSchema
>;

export type PageBlueprintV2RegionRelationshipKey = string;

export function createPageBlueprintV2RegionRelationshipKey(
  relationship: PageBlueprintV2RegionRelationship,
): PageBlueprintV2RegionRelationshipKey {
  if (relationship.relationshipKind !== "pairs-with") {
    return `${relationship.sourceRegionId}->${relationship.relationshipKind}->${relationship.targetRegionId}`;
  }
  const [first, second] = [relationship.sourceRegionId, relationship.targetRegionId].sort(
    compareCodeUnits,
  );
  return `${first}->pairs-with->${second}`;
}

export const pageBlueprintV2OrderAlternativeSchema = z
  .object({
    id: pageBlueprintV2StableIdSchema,
    regionIds: z
      .array(pageBlueprintV2RegionIdSchema)
      .min(1)
      .max(MAX_PAGE_BLUEPRINT_V2_REGIONS)
      .readonly(),
  })
  .strict()
  .readonly();

export type PageBlueprintV2OrderAlternative = z.infer<typeof pageBlueprintV2OrderAlternativeSchema>;

const relationshipKindOrder: Readonly<Record<PageBlueprintV2RegionRelationshipKind, number>> =
  Object.freeze({
    precedes: 0,
    "pairs-with": 1,
    offsets: 2,
    contains: 3,
    spans: 4,
    anchors: 5,
  });

type DirectedEdge = Readonly<{ source: string; target: string }>;

function hasDirectedCycle(regionIds: readonly string[], edges: readonly DirectedEdge[]): boolean {
  const adjacency = new Map(regionIds.map((regionId) => [regionId, new Set<string>()]));
  const indegree = new Map(regionIds.map((regionId) => [regionId, 0]));
  for (const edge of edges) {
    const targets = adjacency.get(edge.source);
    if (!targets || !indegree.has(edge.target) || targets.has(edge.target)) continue;
    targets.add(edge.target);
    indegree.set(edge.target, (indegree.get(edge.target) ?? 0) + 1);
  }

  const ready = regionIds.filter((regionId) => indegree.get(regionId) === 0).sort(compareCodeUnits);
  let visited = 0;
  while (ready.length > 0) {
    const regionId = ready.shift();
    if (regionId === undefined) break;
    visited += 1;
    const targets = [...(adjacency.get(regionId) ?? [])].sort(compareCodeUnits);
    for (const target of targets) {
      const remaining = (indegree.get(target) ?? 0) - 1;
      indegree.set(target, remaining);
      if (remaining === 0) {
        ready.push(target);
        ready.sort(compareCodeUnits);
      }
    }
  }
  return visited !== regionIds.length;
}

function addGraphIssues(
  blueprint: Readonly<{
    regions: readonly PageBlueprintV2Region[];
    relationships: readonly PageBlueprintV2RegionRelationship[];
  }>,
  context: z.RefinementCtx,
): void {
  const regionIds = blueprint.regions.map((region) => region.id);
  const knownRegionIds = new Set(regionIds);
  const unknownEndpointKeys = blueprint.relationships
    .filter(
      (relationship) =>
        !knownRegionIds.has(relationship.sourceRegionId) ||
        !knownRegionIds.has(relationship.targetRegionId),
    )
    .map(createPageBlueprintV2RegionRelationshipKey);
  if (unknownEndpointKeys.length > 0) {
    context.addIssue({
      code: "custom",
      path: ["relationships"],
      message: evidenceMessage("Relationships reference unknown regions", unknownEndpointKeys),
    });
  }

  const relationshipCounts = new Map<string, number>();
  for (const relationship of blueprint.relationships) {
    const key = createPageBlueprintV2RegionRelationshipKey(relationship);
    relationshipCounts.set(key, (relationshipCounts.get(key) ?? 0) + 1);
  }
  const duplicateKeys = [...relationshipCounts]
    .filter(([, count]) => count > 1)
    .map(([key]) => key);
  if (duplicateKeys.length > 0) {
    context.addIssue({
      code: "custom",
      path: ["relationships"],
      message: evidenceMessage("Duplicate region relationship identities", duplicateKeys),
    });
  }

  if (unknownEndpointKeys.length > 0 || duplicateKeys.length > 0) return;

  const precedenceEdges = blueprint.relationships
    .filter((relationship) => relationship.relationshipKind === "precedes")
    .map((relationship) => ({
      source: relationship.sourceRegionId,
      target: relationship.targetRegionId,
    }));
  const containmentEdges = blueprint.relationships
    .filter((relationship) => relationship.relationshipKind === "contains")
    .map((relationship) => ({
      source: relationship.sourceRegionId,
      target: relationship.targetRegionId,
    }));

  if (hasDirectedCycle(regionIds, precedenceEdges)) {
    context.addIssue({
      code: "custom",
      path: ["relationships"],
      message: "Region precedes relationships must be acyclic.",
    });
  }
  if (hasDirectedCycle(regionIds, containmentEdges)) {
    context.addIssue({
      code: "custom",
      path: ["relationships"],
      message: "Region contains relationships must be acyclic.",
    });
  }

  const parentsByTarget = new Map<string, Set<string>>();
  for (const edge of containmentEdges) {
    const parents = parentsByTarget.get(edge.target) ?? new Set<string>();
    parents.add(edge.source);
    parentsByTarget.set(edge.target, parents);
  }
  const multipleParentTargets = boundedEvidence(
    [...parentsByTarget].filter(([, parents]) => parents.size > 1).map(([target]) => target),
  );
  if (multipleParentTargets.length > 0) {
    context.addIssue({
      code: "custom",
      path: ["relationships"],
      message: evidenceMessage(
        "Regions have multiple direct contains parents",
        multipleParentTargets,
      ),
    });
  }

  if (hasDirectedCycle(regionIds, [...precedenceEdges, ...containmentEdges])) {
    context.addIssue({
      code: "custom",
      path: ["relationships"],
      message: "Combined precedes and parent-before-child constraints must be acyclic.",
    });
  }
}

const pageBlueprintV2StructuralContractBaseSchema = z
  .object({
    id: pageBlueprintV2StableIdSchema,
    version: pageBlueprintV2RecordVersionSchema,
    pageFamilyId: structuralStorefrontPageFamilyIdSchema,
    regions: z
      .array(pageBlueprintV2RegionSchema)
      .min(1)
      .max(MAX_PAGE_BLUEPRINT_V2_REGIONS)
      .readonly(),
    relationships: z
      .array(pageBlueprintV2RegionRelationshipSchema)
      .max(MAX_PAGE_BLUEPRINT_V2_RELATIONSHIPS)
      .readonly(),
    orderAlternatives: z
      .array(pageBlueprintV2OrderAlternativeSchema)
      .min(1)
      .max(MAX_PAGE_BLUEPRINT_V2_ORDER_ALTERNATIVES)
      .readonly(),
    defaultOrderAlternativeId: pageBlueprintV2StableIdSchema,
  })
  .strict()
  .superRefine((blueprint, context) => {
    const regionIds = blueprint.regions.map((region) => region.id);
    const duplicateRegionIds = boundedEvidence(
      regionIds.filter((regionId, index) => regionIds.indexOf(regionId) !== index),
    );
    if (duplicateRegionIds.length > 0) {
      context.addIssue({
        code: "custom",
        path: ["regions"],
        message: evidenceMessage("Duplicate region IDs", duplicateRegionIds),
      });
    }
    if (!blueprint.regions.some((region) => region.requirement === "required")) {
      context.addIssue({
        code: "custom",
        path: ["regions"],
        message: "A PageBlueprint v2 structural record requires at least one required region.",
      });
    }

    const requiredRoles = new Set(
      blueprint.regions
        .filter((region) => region.requirement === "required")
        .map((region) => region.role),
    );
    const missingMinimumRoles = pageBlueprintV2MinimumRequiredRolesByPageFamily[
      blueprint.pageFamilyId
    ].filter((role) => !requiredRoles.has(role));
    if (missingMinimumRoles.length > 0) {
      context.addIssue({
        code: "custom",
        path: ["regions"],
        message: evidenceMessage(
          `Missing required ${blueprint.pageFamilyId} region roles`,
          missingMinimumRoles,
        ),
      });
    }

    addGraphIssues(blueprint, context);

    const alternativeIds = blueprint.orderAlternatives.map((alternative) => alternative.id);
    const duplicateAlternativeIds = boundedEvidence(
      alternativeIds.filter(
        (alternativeId, index) => alternativeIds.indexOf(alternativeId) !== index,
      ),
    );
    if (duplicateAlternativeIds.length > 0) {
      context.addIssue({
        code: "custom",
        path: ["orderAlternatives"],
        message: evidenceMessage("Duplicate order-alternative IDs", duplicateAlternativeIds),
      });
    }
    if (!alternativeIds.includes(blueprint.defaultOrderAlternativeId)) {
      context.addIssue({
        code: "custom",
        path: ["defaultOrderAlternativeId"],
        message: "The default order-alternative ID must identify one declared alternative.",
      });
    }

    const knownRegionIds = new Set(regionIds);
    const orderingRelationships = blueprint.relationships.filter((relationship) =>
      ["precedes", "contains"].includes(relationship.relationshipKind),
    );
    blueprint.orderAlternatives.forEach((alternative, alternativeIndex) => {
      const alternativeRegionIds = alternative.regionIds;
      const duplicates = boundedEvidence(
        alternativeRegionIds.filter(
          (regionId, index) => alternativeRegionIds.indexOf(regionId) !== index,
        ),
      );
      const unknown = boundedEvidence(
        alternativeRegionIds.filter((regionId) => !knownRegionIds.has(regionId)),
      );
      const alternativeRegionSet = new Set(alternativeRegionIds);
      const missing = boundedEvidence(
        regionIds.filter((regionId) => !alternativeRegionSet.has(regionId)),
      );
      if (duplicates.length > 0) {
        context.addIssue({
          code: "custom",
          path: ["orderAlternatives", alternativeIndex, "regionIds"],
          message: evidenceMessage("Duplicate regions in order alternative", duplicates),
        });
      }
      if (unknown.length > 0) {
        context.addIssue({
          code: "custom",
          path: ["orderAlternatives", alternativeIndex, "regionIds"],
          message: evidenceMessage("Unknown regions in order alternative", unknown),
        });
      }
      if (missing.length > 0 || alternativeRegionIds.length !== regionIds.length) {
        context.addIssue({
          code: "custom",
          path: ["orderAlternatives", alternativeIndex, "regionIds"],
          message:
            missing.length > 0
              ? evidenceMessage("Missing regions in order alternative", missing)
              : "Every order alternative must contain every region exactly once.",
        });
      }
      if (duplicates.length > 0 || unknown.length > 0 || missing.length > 0) return;

      const positions = new Map(
        alternativeRegionIds.map((regionId, position) => [regionId, position]),
      );
      const violations = orderingRelationships
        .filter(
          (relationship) =>
            (positions.get(relationship.sourceRegionId) ?? Number.POSITIVE_INFINITY) >=
            (positions.get(relationship.targetRegionId) ?? Number.NEGATIVE_INFINITY),
        )
        .map(createPageBlueprintV2RegionRelationshipKey);
      if (violations.length > 0) {
        context.addIssue({
          code: "custom",
          path: ["orderAlternatives", alternativeIndex, "regionIds"],
          message: evidenceMessage(
            "Order alternative violates accessible reading-order constraints",
            violations,
          ),
        });
      }
    });
  })
  .readonly();

export const pageBlueprintV2StructuralContractSchema = pageBlueprintV2StructuralContractBaseSchema;

export type PageBlueprintV2StructuralContract = z.infer<
  typeof pageBlueprintV2StructuralContractSchema
>;

function normalizeSymmetricRelationship(
  relationship: PageBlueprintV2RegionRelationship,
  defaultPositions: ReadonlyMap<string, number>,
): PageBlueprintV2RegionRelationship {
  if (
    relationship.relationshipKind !== "pairs-with" ||
    (defaultPositions.get(relationship.sourceRegionId) ?? Number.POSITIVE_INFINITY) <
      (defaultPositions.get(relationship.targetRegionId) ?? Number.POSITIVE_INFINITY)
  ) {
    return relationship;
  }
  return pageBlueprintV2RegionRelationshipSchema.parse({
    sourceRegionId: relationship.targetRegionId,
    relationshipKind: relationship.relationshipKind,
    targetRegionId: relationship.sourceRegionId,
  });
}

export function canonicalizePageBlueprintV2StructuralContract(
  input: unknown,
): PageBlueprintV2StructuralContract {
  const parsed = pageBlueprintV2StructuralContractSchema.parse(input);
  const defaultAlternative = parsed.orderAlternatives.find(
    (alternative) => alternative.id === parsed.defaultOrderAlternativeId,
  );
  if (!defaultAlternative) {
    throw new Error("Validated PageBlueprint v2 authority is missing its default order.");
  }
  const defaultPositions = new Map(
    defaultAlternative.regionIds.map((regionId, position) => [regionId, position]),
  );
  const regions = [...parsed.regions].sort(
    (left, right) =>
      (defaultPositions.get(left.id) ?? Number.POSITIVE_INFINITY) -
      (defaultPositions.get(right.id) ?? Number.POSITIVE_INFINITY),
  );
  const relationships = parsed.relationships
    .map((relationship) => normalizeSymmetricRelationship(relationship, defaultPositions))
    .sort((left, right) => {
      const sourceDifference =
        (defaultPositions.get(left.sourceRegionId) ?? Number.POSITIVE_INFINITY) -
        (defaultPositions.get(right.sourceRegionId) ?? Number.POSITIVE_INFINITY);
      if (sourceDifference !== 0) return sourceDifference;
      const kindDifference =
        relationshipKindOrder[left.relationshipKind] -
        relationshipKindOrder[right.relationshipKind];
      if (kindDifference !== 0) return kindDifference;
      return (
        (defaultPositions.get(left.targetRegionId) ?? Number.POSITIVE_INFINITY) -
        (defaultPositions.get(right.targetRegionId) ?? Number.POSITIVE_INFINITY)
      );
    });
  const orderAlternatives = [...parsed.orderAlternatives].sort((left, right) => {
    if (left.id === parsed.defaultOrderAlternativeId) return -1;
    if (right.id === parsed.defaultOrderAlternativeId) return 1;
    return compareCodeUnits(left.id, right.id);
  });

  return pageBlueprintV2StructuralContractSchema.parse({
    id: parsed.id,
    version: parsed.version,
    pageFamilyId: parsed.pageFamilyId,
    regions,
    relationships,
    orderAlternatives,
    defaultOrderAlternativeId: parsed.defaultOrderAlternativeId,
  });
}
