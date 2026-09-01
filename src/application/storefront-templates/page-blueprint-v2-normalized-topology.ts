import { z } from "zod";
import {
  narrativeRoleSchema,
  visualWeightSchema,
} from "@/domain/component-platform/design-vocabulary";
import { canonicalValueFingerprint } from "@/domain/storefront/canonical-storefront";
import { structuralStorefrontPageFamilyIdSchema } from "@/domain/structural-storefront-family";
import {
  MAX_PAGE_BLUEPRINT_V2_ORDER_ALTERNATIVES,
  MAX_PAGE_BLUEPRINT_V2_REGIONS,
  MAX_PAGE_BLUEPRINT_V2_RELATIONSHIPS,
  canonicalizePageBlueprintV2StructuralContract,
  createPageBlueprintV2RegionRelationshipKey,
  pageBlueprintV2RegionCardinalitySchema,
  pageBlueprintV2RegionRelationshipKindSchema,
  pageBlueprintV2RegionRelationshipKinds,
  pageBlueprintV2RegionRequirementSchema,
  type PageBlueprintV2RegionRelationshipKind,
} from "./page-blueprint-v2-contract";
import { parsePageBlueprintV2CandidateAuthority } from "./page-blueprint-v2-candidate-authority";
import {
  canonicalizePageBlueprintV2ResponsiveRuleContract,
  pageBlueprintV2ResponsiveBreakpointAuthority,
  pageBlueprintV2ResponsiveRegionProportionModeSchema,
  pageBlueprintV2ResponsiveRelationshipTransformationModeSchema,
  type PageBlueprintV2ResponsiveBreakpointId,
} from "./page-blueprint-v2-responsive-rule-contract";
export const PAGE_BLUEPRINT_V2_NORMALIZED_TOPOLOGY_SCHEMA_VERSION = "1.0.0" as const;
type TopologyRegionId = `r${number}`;
const topologyRegionIdSchema = z
  .string()
  .regex(/^r(?:0|[1-9][0-9]*)$/u) as z.ZodType<TopologyRegionId>;
const topologyOrderSchema = z
  .array(topologyRegionIdSchema)
  .min(1)
  .max(MAX_PAGE_BLUEPRINT_V2_REGIONS)
  .readonly();
const normalizedRegionSchema = z
  .object({
    topologyRegionId: topologyRegionIdSchema,
    role: narrativeRoleSchema,
    requirement: pageBlueprintV2RegionRequirementSchema,
    cardinality: pageBlueprintV2RegionCardinalitySchema,
    visualWeight: visualWeightSchema,
  })
  .strict()
  .readonly();
const normalizedRelationshipSchema = z
  .object({
    sourceTopologyRegionId: topologyRegionIdSchema,
    relationshipKind: pageBlueprintV2RegionRelationshipKindSchema,
    targetTopologyRegionId: topologyRegionIdSchema,
  })
  .strict()
  .readonly();
const normalizedOrderAlternativesSchema = z
  .object({
    defaultOrder: topologyOrderSchema,
    alternativeOrders: z
      .array(topologyOrderSchema)
      .max(MAX_PAGE_BLUEPRINT_V2_ORDER_ALTERNATIVES - 1)
      .readonly(),
  })
  .strict()
  .readonly();
const breakpointIds = pageBlueprintV2ResponsiveBreakpointAuthority.map(
  ({ breakpoint }) => breakpoint,
) as [
  PageBlueprintV2ResponsiveBreakpointId,
  PageBlueprintV2ResponsiveBreakpointId,
  PageBlueprintV2ResponsiveBreakpointId,
  PageBlueprintV2ResponsiveBreakpointId,
];
const normalizedResponsiveBreakpointSchema = z
  .object({
    breakpoint: z.enum(breakpointIds),
    viewport: z.union([z.literal(375), z.literal(768), z.literal(1024), z.literal(1440)]),
    selectedReadingOrder: topologyOrderSchema,
    regionProportionRules: z
      .array(
        z
          .object({
            topologyRegionId: topologyRegionIdSchema,
            proportionMode: pageBlueprintV2ResponsiveRegionProportionModeSchema,
          })
          .strict()
          .readonly(),
      )
      .min(1)
      .max(MAX_PAGE_BLUEPRINT_V2_REGIONS)
      .readonly(),
    relationshipTransformations: z
      .array(
        z
          .object({
            normalizedRelationshipKey: z.string().min(1).max(256),
            transformation: pageBlueprintV2ResponsiveRelationshipTransformationModeSchema,
          })
          .strict()
          .readonly(),
      )
      .max(MAX_PAGE_BLUEPRINT_V2_RELATIONSHIPS)
      .readonly(),
  })
  .strict()
  .readonly();
export const pageBlueprintV2NormalizedTopologyFingerprintSchema = z
  .string()
  .regex(/^page-blueprint-v2-normalized-topology-v1_(?:0|[1-9][0-9]*)_[a-f0-9]{64}$/u);
const rawNormalizedTopologySchema = z
  .object({
    topologySchemaVersion: z.literal(PAGE_BLUEPRINT_V2_NORMALIZED_TOPOLOGY_SCHEMA_VERSION),
    pageFamilyId: structuralStorefrontPageFamilyIdSchema,
    regions: z.array(normalizedRegionSchema).min(1).max(MAX_PAGE_BLUEPRINT_V2_REGIONS).readonly(),
    relationships: z
      .array(normalizedRelationshipSchema)
      .max(MAX_PAGE_BLUEPRINT_V2_RELATIONSHIPS)
      .readonly(),
    orderAlternatives: normalizedOrderAlternativesSchema,
    responsiveBreakpoints: z
      .array(normalizedResponsiveBreakpointSchema)
      .length(pageBlueprintV2ResponsiveBreakpointAuthority.length)
      .readonly(),
    topologyFingerprint: pageBlueprintV2NormalizedTopologyFingerprintSchema,
  })
  .strict();
type ParsedTopology = z.infer<typeof rawNormalizedTopologySchema>;
type NormalizedRelationship = ParsedTopology["relationships"][number];
const relationshipKindOrder = new Map<PageBlueprintV2RegionRelationshipKind, number>(
  pageBlueprintV2RegionRelationshipKinds.map((kind, index) => [kind, index]),
);
const ordinal = (regionId: TopologyRegionId): number => Number(regionId.slice(1));
const compareRegionIds = (left: TopologyRegionId, right: TopologyRegionId): number =>
  ordinal(left) - ordinal(right);
const relationshipKey = (relationship: NormalizedRelationship): string =>
  `${relationship.sourceTopologyRegionId}->${relationship.relationshipKind}->${relationship.targetTopologyRegionId}`;
const orderKey = (order: readonly TopologyRegionId[]): string => order.join(",");
function compareRelationships(left: NormalizedRelationship, right: NormalizedRelationship): number {
  return (
    compareRegionIds(left.sourceTopologyRegionId, right.sourceTopologyRegionId) ||
    (relationshipKindOrder.get(left.relationshipKind) ?? Infinity) -
      (relationshipKindOrder.get(right.relationshipKind) ?? Infinity) ||
    compareRegionIds(left.targetTopologyRegionId, right.targetTopologyRegionId)
  );
}
function compareOrders(left: readonly TopologyRegionId[], right: readonly TopologyRegionId[]) {
  for (let index = 0; index < Math.min(left.length, right.length); index += 1) {
    const difference = compareRegionIds(left[index], right[index]);
    if (difference !== 0) return difference;
  }
  return left.length - right.length;
}
function issue(context: z.RefinementCtx, path: (string | number)[], message: string): void {
  context.addIssue({ code: z.ZodIssueCode.custom, path, message });
}
function required<Value>(value: Value | undefined): Value {
  if (value === undefined) throw new Error("Validated PageBlueprint topology is incomplete.");
  return value;
}
function validateCanonicalOrder(topology: ParsedTopology, context: z.RefinementCtx): void {
  const regionIds = topology.regions.map(({ topologyRegionId }) => topologyRegionId);
  regionIds.forEach((regionId, index) => {
    if (regionId !== `r${index}`)
      issue(context, ["regions", index], "Topology region IDs must be contiguous from r0.");
  });
  topology.relationships.forEach((relationship, index) => {
    if (
      relationship.relationshipKind === "pairs-with" &&
      compareRegionIds(relationship.sourceTopologyRegionId, relationship.targetTopologyRegionId) >=
        0
    )
      issue(context, ["relationships", index], "pairs-with endpoints must use token order.");
    if (index > 0 && compareRelationships(topology.relationships[index - 1], relationship) >= 0)
      issue(context, ["relationships", index], "Relationships must use canonical topology order.");
  });
  if (orderKey(topology.orderAlternatives.defaultOrder) !== orderKey(regionIds))
    issue(context, ["orderAlternatives", "defaultOrder"], "Default order must be r0..rN.");
  const seenOrders = new Set([orderKey(topology.orderAlternatives.defaultOrder)]);
  topology.orderAlternatives.alternativeOrders.forEach((order, index, alternatives) => {
    if (seenOrders.has(orderKey(order)))
      issue(context, ["orderAlternatives", "alternativeOrders", index], "Orders must be unique.");
    seenOrders.add(orderKey(order));
    if (index > 0 && compareOrders(alternatives[index - 1], order) >= 0)
      issue(
        context,
        ["orderAlternatives", "alternativeOrders", index],
        "Orders are not canonical.",
      );
  });
  const relationshipPositions = new Map(
    topology.relationships.map((relationship, index) => [relationshipKey(relationship), index]),
  );
  topology.responsiveBreakpoints.forEach((breakpoint, index) => {
    const expected = pageBlueprintV2ResponsiveBreakpointAuthority[index];
    if (breakpoint.breakpoint !== expected.breakpoint || breakpoint.viewport !== expected.viewport)
      issue(context, ["responsiveBreakpoints", index], "Breakpoints are not canonical.");
    breakpoint.regionProportionRules.forEach((rule, ruleIndex, rules) => {
      if (
        ruleIndex > 0 &&
        compareRegionIds(rules[ruleIndex - 1].topologyRegionId, rule.topologyRegionId) >= 0
      )
        issue(
          context,
          ["responsiveBreakpoints", index, "regionProportionRules", ruleIndex],
          "Region rules are not canonical.",
        );
    });
    breakpoint.relationshipTransformations.forEach((rule, ruleIndex, rules) => {
      const position = relationshipPositions.get(rule.normalizedRelationshipKey);
      const prior =
        ruleIndex === 0
          ? -1
          : relationshipPositions.get(rules[ruleIndex - 1].normalizedRelationshipKey);
      if (position === undefined)
        issue(
          context,
          ["responsiveBreakpoints", index, "relationshipTransformations", ruleIndex],
          "Relationship rule references an unknown normalized relationship key.",
        );
      else if (prior !== undefined && position <= prior)
        issue(
          context,
          ["responsiveBreakpoints", index, "relationshipTransformations", ruleIndex],
          "Relationship rules are not canonical.",
        );
    });
  });
}
function validateSourceAuthority(topology: ParsedTopology, context: z.RefinementCtx): void {
  const alternatives = [
    { id: "default-order", regionIds: topology.orderAlternatives.defaultOrder },
    ...topology.orderAlternatives.alternativeOrders.map((regionIds, index) => ({
      id: `alternative-order-${index + 1}`,
      regionIds,
    })),
  ];
  let structural;
  try {
    structural = canonicalizePageBlueprintV2StructuralContract({
      id: "normalized-topology",
      version: "1.0.0",
      pageFamilyId: topology.pageFamilyId,
      regions: topology.regions.map(({ topologyRegionId: id, ...region }) => ({ id, ...region })),
      relationships: topology.relationships.map(
        ({
          sourceTopologyRegionId: sourceRegionId,
          targetTopologyRegionId: targetRegionId,
          ...rest
        }) => ({ sourceRegionId, targetRegionId, ...rest }),
      ),
      orderAlternatives: alternatives,
      defaultOrderAlternativeId: "default-order",
    });
  } catch (error) {
    issue(context, [], error instanceof Error ? error.message : "Invalid structural topology.");
    return;
  }
  const alternativeIds = new Map(
    alternatives.map(({ id, regionIds }) => [orderKey(regionIds), id]),
  );
  const sourceRelationshipKeys = new Map(
    topology.relationships.map((relationship) => [
      relationshipKey(relationship),
      createPageBlueprintV2RegionRelationshipKey({
        sourceRegionId: relationship.sourceTopologyRegionId,
        relationshipKind: relationship.relationshipKind,
        targetRegionId: relationship.targetTopologyRegionId,
      }),
    ]),
  );
  try {
    canonicalizePageBlueprintV2ResponsiveRuleContract(structural, {
      contractSchemaVersion: "1.0.0",
      blueprintId: structural.id,
      blueprintVersion: structural.version,
      breakpointRules: topology.responsiveBreakpoints.map((breakpoint) => ({
        breakpoint: breakpoint.breakpoint,
        viewport: breakpoint.viewport,
        orderAlternativeId:
          alternativeIds.get(orderKey(breakpoint.selectedReadingOrder)) ?? "unknown-order",
        regionProportionRules: breakpoint.regionProportionRules.map(
          ({ topologyRegionId: regionId, proportionMode }) => ({ regionId, proportionMode }),
        ),
        relationshipTransformations: breakpoint.relationshipTransformations.map(
          ({ normalizedRelationshipKey, transformation }) => ({
            relationshipKey: required(sourceRelationshipKeys.get(normalizedRelationshipKey)),
            transformation,
          }),
        ),
      })),
    });
  } catch (error) {
    issue(
      context,
      ["responsiveBreakpoints"],
      error instanceof Error ? error.message : "Invalid responsive topology.",
    );
  }
}
const normalizedTopologySchema = rawNormalizedTopologySchema
  .superRefine((topology, context) => {
    validateCanonicalOrder(topology, context);
    validateSourceAuthority(topology, context);
  })
  .readonly();
export type PageBlueprintV2NormalizedTopologyV1 = z.infer<typeof normalizedTopologySchema>;
function deepFreeze<Value>(value: Value, seen = new WeakSet<object>()): Value {
  if (value === null || typeof value !== "object" || seen.has(value)) return value;
  seen.add(value);
  Object.values(value as Record<string, unknown>).forEach((child) => deepFreeze(child, seen));
  return Object.freeze(value);
}
function createFingerprint(
  material: Omit<PageBlueprintV2NormalizedTopologyV1, "topologyFingerprint">,
) {
  return pageBlueprintV2NormalizedTopologyFingerprintSchema.parse(
    `page-blueprint-v2-normalized-topology-${canonicalValueFingerprint(material)}`,
  );
}
export function parsePageBlueprintV2NormalizedTopology(
  input: unknown,
): PageBlueprintV2NormalizedTopologyV1 {
  const parsed = normalizedTopologySchema.parse(input);
  const { topologyFingerprint, ...material } = parsed;
  if (topologyFingerprint !== createFingerprint(material)) {
    throw new z.ZodError([
      {
        code: z.ZodIssueCode.custom,
        path: ["topologyFingerprint"],
        message: "PageBlueprint v2 normalized topology fingerprint is stale.",
      },
    ]);
  }
  return deepFreeze(parsed);
}
export function derivePageBlueprintV2NormalizedTopology(
  input: unknown,
): PageBlueprintV2NormalizedTopologyV1 {
  const candidate = parsePageBlueprintV2CandidateAuthority(input);
  const structural = candidate.structural;
  const defaultOrder = required(
    structural.orderAlternatives.find(({ id }) => id === structural.defaultOrderAlternativeId),
  );
  const tokenBySourceId = new Map(
    defaultOrder.regionIds.map((regionId, index) => [regionId, `r${index}`] as const),
  );
  const tokenFor = (regionId: string): TopologyRegionId => required(tokenBySourceId.get(regionId));
  const sourceRegionById = new Map(structural.regions.map((region) => [region.id, region]));
  const regions = defaultOrder.regionIds.map((sourceId, index) => {
    const source = required(sourceRegionById.get(sourceId));
    const topologyRegionId: TopologyRegionId = `r${index}`;
    return {
      topologyRegionId,
      role: source.role,
      requirement: source.requirement,
      cardinality: source.cardinality,
      visualWeight: source.visualWeight,
    };
  });
  const relationshipBySourceKey = new Map<string, NormalizedRelationship>();
  structural.relationships.forEach((source) => {
    let sourceTopologyRegionId = tokenFor(source.sourceRegionId);
    let targetTopologyRegionId = tokenFor(source.targetRegionId);
    if (
      source.relationshipKind === "pairs-with" &&
      compareRegionIds(sourceTopologyRegionId, targetTopologyRegionId) > 0
    )
      [sourceTopologyRegionId, targetTopologyRegionId] = [
        targetTopologyRegionId,
        sourceTopologyRegionId,
      ];
    relationshipBySourceKey.set(createPageBlueprintV2RegionRelationshipKey(source), {
      sourceTopologyRegionId,
      relationshipKind: source.relationshipKind,
      targetTopologyRegionId,
    });
  });
  const relationships = [...relationshipBySourceKey.values()].sort(compareRelationships);
  const orderByAlternativeId = new Map(
    structural.orderAlternatives.map(({ id, regionIds }) => [id, regionIds.map(tokenFor)]),
  );
  const normalizedDefaultOrder = required(
    orderByAlternativeId.get(structural.defaultOrderAlternativeId),
  );
  const alternativeOrders = [
    ...new Map(
      structural.orderAlternatives
        .map(({ id }) => orderByAlternativeId.get(id))
        .filter(
          (order): order is TopologyRegionId[] =>
            order !== undefined && orderKey(order) !== orderKey(normalizedDefaultOrder),
        )
        .map((order) => [orderKey(order), order]),
    ).values(),
  ].sort(compareOrders);
  const relationshipPositions = new Map(
    relationships.map((relationship, index) => [relationshipKey(relationship), index]),
  );
  const responsiveBreakpoints = candidate.responsiveRules.breakpointRules.map((rule) => {
    const selectedReadingOrder = required(orderByAlternativeId.get(rule.orderAlternativeId));
    return {
      breakpoint: rule.breakpoint,
      viewport: rule.viewport,
      selectedReadingOrder,
      regionProportionRules: rule.regionProportionRules
        .map(({ regionId, proportionMode }) => ({
          topologyRegionId: tokenFor(regionId),
          proportionMode,
        }))
        .sort((left, right) => compareRegionIds(left.topologyRegionId, right.topologyRegionId)),
      relationshipTransformations: rule.relationshipTransformations
        .map(({ relationshipKey: sourceKey, transformation }) => {
          const relationship = required(relationshipBySourceKey.get(sourceKey));
          return { normalizedRelationshipKey: relationshipKey(relationship), transformation };
        })
        .sort(
          (left, right) =>
            (relationshipPositions.get(left.normalizedRelationshipKey) ?? Infinity) -
            (relationshipPositions.get(right.normalizedRelationshipKey) ?? Infinity),
        ),
    };
  });
  const material = {
    topologySchemaVersion: PAGE_BLUEPRINT_V2_NORMALIZED_TOPOLOGY_SCHEMA_VERSION,
    pageFamilyId: structural.pageFamilyId,
    regions,
    relationships,
    orderAlternatives: { defaultOrder: normalizedDefaultOrder, alternativeOrders },
    responsiveBreakpoints,
  } satisfies Omit<PageBlueprintV2NormalizedTopologyV1, "topologyFingerprint">;
  return parsePageBlueprintV2NormalizedTopology({
    ...material,
    topologyFingerprint: createFingerprint(material),
  });
}
