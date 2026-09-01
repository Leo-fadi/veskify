import { z } from "zod";

import {
  MAX_PAGE_BLUEPRINT_V2_FAILURE_EVIDENCE,
  MAX_PAGE_BLUEPRINT_V2_ID_LENGTH,
  MAX_PAGE_BLUEPRINT_V2_REGIONS,
  MAX_PAGE_BLUEPRINT_V2_RELATIONSHIPS,
  canonicalizePageBlueprintV2StructuralContract,
  createPageBlueprintV2RegionRelationshipKey,
  pageBlueprintV2RecordVersionSchema,
  pageBlueprintV2RegionIdSchema,
  pageBlueprintV2RegionRelationshipSchema,
  pageBlueprintV2StableIdSchema,
  type PageBlueprintV2RegionRelationshipKind,
  type PageBlueprintV2StructuralContract,
} from "./page-blueprint-v2-contract";

export const PAGE_BLUEPRINT_V2_RESPONSIVE_RULE_CONTRACT_SCHEMA_VERSION = "1.0.0" as const;

export const pageBlueprintV2ResponsiveBreakpointAuthority = Object.freeze([
  Object.freeze({ breakpoint: "mobile", viewport: 375 }),
  Object.freeze({ breakpoint: "tablet", viewport: 768 }),
  Object.freeze({ breakpoint: "desktop", viewport: 1024 }),
  Object.freeze({ breakpoint: "wide", viewport: 1440 }),
] as const);

export type PageBlueprintV2ResponsiveBreakpointId =
  (typeof pageBlueprintV2ResponsiveBreakpointAuthority)[number]["breakpoint"];

const pageBlueprintV2ResponsiveBreakpointIds = pageBlueprintV2ResponsiveBreakpointAuthority.map(
  ({ breakpoint }) => breakpoint,
) as [
  PageBlueprintV2ResponsiveBreakpointId,
  PageBlueprintV2ResponsiveBreakpointId,
  PageBlueprintV2ResponsiveBreakpointId,
  PageBlueprintV2ResponsiveBreakpointId,
];

const pageBlueprintV2ResponsiveBreakpointIdSchema = z.enum(pageBlueprintV2ResponsiveBreakpointIds);

const pageBlueprintV2ResponsiveViewportSchema = z.union([
  z.literal(375),
  z.literal(768),
  z.literal(1024),
  z.literal(1440),
]);

const viewportByBreakpoint: ReadonlyMap<PageBlueprintV2ResponsiveBreakpointId, number> = new Map(
  pageBlueprintV2ResponsiveBreakpointAuthority.map(({ breakpoint, viewport }) => [
    breakpoint,
    viewport,
  ]),
);

function addBreakpointPairIssue(
  value: Readonly<{ breakpoint: PageBlueprintV2ResponsiveBreakpointId; viewport: number }>,
  context: z.RefinementCtx,
): void {
  if (viewportByBreakpoint.get(value.breakpoint) !== value.viewport) {
    context.addIssue({
      code: "custom",
      path: ["viewport"],
      message: "Responsive breakpoint and viewport must match canonical structural authority.",
    });
  }
}

export const pageBlueprintV2ResponsiveBreakpointSchema = z
  .object({
    breakpoint: pageBlueprintV2ResponsiveBreakpointIdSchema,
    viewport: pageBlueprintV2ResponsiveViewportSchema,
  })
  .strict()
  .superRefine(addBreakpointPairIssue)
  .readonly();

export type PageBlueprintV2ResponsiveBreakpoint = z.infer<
  typeof pageBlueprintV2ResponsiveBreakpointSchema
>;

export const pageBlueprintV2ResponsiveRegionProportionModes = Object.freeze([
  "preserve",
  "compress",
  "expand",
  "full-width",
] as const);

export const pageBlueprintV2ResponsiveRegionProportionModeSchema = z.enum(
  pageBlueprintV2ResponsiveRegionProportionModes,
);

export type PageBlueprintV2ResponsiveRegionProportionMode = z.infer<
  typeof pageBlueprintV2ResponsiveRegionProportionModeSchema
>;

export const pageBlueprintV2ResponsiveRelationshipTransformations = Object.freeze([
  "preserve",
  "stack",
  "remove-offset",
  "flatten",
  "reduce-span",
  "linearize",
] as const);

export const pageBlueprintV2ResponsiveRelationshipTransformationModeSchema = z.enum(
  pageBlueprintV2ResponsiveRelationshipTransformations,
);

export type PageBlueprintV2ResponsiveRelationshipTransformationMode = z.infer<
  typeof pageBlueprintV2ResponsiveRelationshipTransformationModeSchema
>;

export const pageBlueprintV2ResponsiveRelationshipTransformationPolicy = Object.freeze({
  precedes: Object.freeze(["preserve"] as const),
  "pairs-with": Object.freeze(["preserve", "stack"] as const),
  offsets: Object.freeze(["preserve", "remove-offset"] as const),
  contains: Object.freeze(["preserve", "flatten"] as const),
  spans: Object.freeze(["preserve", "reduce-span"] as const),
  anchors: Object.freeze(["preserve", "linearize"] as const),
}) satisfies Readonly<
  Record<
    PageBlueprintV2RegionRelationshipKind,
    readonly PageBlueprintV2ResponsiveRelationshipTransformationMode[]
  >
>;

const compareCodeUnits = (left: string, right: string): number =>
  left < right ? -1 : left > right ? 1 : 0;

function uniqueSorted(values: Iterable<string>): readonly string[] {
  return Object.freeze([...new Set(values)].sort(compareCodeUnits));
}

function boundedEvidence(values: Iterable<string>): string {
  const ordered = uniqueSorted(values);
  const visible = ordered.slice(0, MAX_PAGE_BLUEPRINT_V2_FAILURE_EVIDENCE);
  const omitted = ordered.length - visible.length;
  return `${visible.join(", ")}${omitted > 0 ? ` (+${omitted} more)` : ""}`;
}

function duplicateValues(values: readonly string[]): readonly string[] {
  const counts = new Map<string, number>();
  for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1);
  return uniqueSorted([...counts].filter(([, count]) => count > 1).map(([value]) => value));
}

const MAX_PAGE_BLUEPRINT_V2_RESPONSIVE_RELATIONSHIP_KEY_LENGTH =
  MAX_PAGE_BLUEPRINT_V2_ID_LENGTH * 2 + "->pairs-with->".length;

function parseCanonicalResponsiveRelationshipKey(relationshipKey: string) {
  const segments = relationshipKey.split("->");
  if (segments.length !== 3) return undefined;

  const parsed = pageBlueprintV2RegionRelationshipSchema.safeParse({
    sourceRegionId: segments[0],
    relationshipKind: segments[1],
    targetRegionId: segments[2],
  });
  if (
    !parsed.success ||
    createPageBlueprintV2RegionRelationshipKey(parsed.data) !== relationshipKey
  ) {
    return undefined;
  }
  return parsed.data;
}

export const pageBlueprintV2ResponsiveRelationshipKeySchema = z
  .string()
  .min(1)
  .max(MAX_PAGE_BLUEPRINT_V2_RESPONSIVE_RELATIONSHIP_KEY_LENGTH)
  .superRefine((relationshipKey, context) => {
    if (!parseCanonicalResponsiveRelationshipKey(relationshipKey)) {
      context.addIssue({
        code: "custom",
        message: "Responsive relationship key must be one canonical A-03 relationship key.",
      });
    }
  });

export const pageBlueprintV2ResponsiveRegionProportionRuleSchema = z
  .object({
    regionId: pageBlueprintV2RegionIdSchema,
    proportionMode: pageBlueprintV2ResponsiveRegionProportionModeSchema,
  })
  .strict()
  .readonly();

export type PageBlueprintV2ResponsiveRegionProportionRule = z.infer<
  typeof pageBlueprintV2ResponsiveRegionProportionRuleSchema
>;

export const pageBlueprintV2ResponsiveRelationshipTransformationSchema = z
  .object({
    relationshipKey: pageBlueprintV2ResponsiveRelationshipKeySchema,
    transformation: pageBlueprintV2ResponsiveRelationshipTransformationModeSchema,
  })
  .strict()
  .superRefine((value, context) => {
    const relationship = parseCanonicalResponsiveRelationshipKey(value.relationshipKey);
    if (!relationship) return;
    const allowed: readonly PageBlueprintV2ResponsiveRelationshipTransformationMode[] =
      pageBlueprintV2ResponsiveRelationshipTransformationPolicy[relationship.relationshipKind];
    if (!allowed.includes(value.transformation)) {
      context.addIssue({
        code: "custom",
        path: ["transformation"],
        message: `Responsive transformation is incompatible with ${relationship.relationshipKind} structural authority.`,
      });
    }
  })
  .readonly();

export type PageBlueprintV2ResponsiveRelationshipTransformation = z.infer<
  typeof pageBlueprintV2ResponsiveRelationshipTransformationSchema
>;

export const pageBlueprintV2ResponsiveBreakpointRuleSchema = z
  .object({
    breakpoint: pageBlueprintV2ResponsiveBreakpointIdSchema,
    viewport: pageBlueprintV2ResponsiveViewportSchema,
    orderAlternativeId: pageBlueprintV2StableIdSchema,
    regionProportionRules: z
      .array(pageBlueprintV2ResponsiveRegionProportionRuleSchema)
      .min(1)
      .max(MAX_PAGE_BLUEPRINT_V2_REGIONS)
      .readonly(),
    relationshipTransformations: z
      .array(pageBlueprintV2ResponsiveRelationshipTransformationSchema)
      .max(MAX_PAGE_BLUEPRINT_V2_RELATIONSHIPS)
      .readonly(),
  })
  .strict()
  .superRefine(addBreakpointPairIssue)
  .readonly();

export type PageBlueprintV2ResponsiveBreakpointRule = z.infer<
  typeof pageBlueprintV2ResponsiveBreakpointRuleSchema
>;

const pageBlueprintV2ResponsiveRuleContractV1ShapeSchema = z
  .object({
    contractSchemaVersion: z.literal(PAGE_BLUEPRINT_V2_RESPONSIVE_RULE_CONTRACT_SCHEMA_VERSION),
    blueprintId: pageBlueprintV2StableIdSchema,
    blueprintVersion: pageBlueprintV2RecordVersionSchema,
    breakpointRules: z
      .array(pageBlueprintV2ResponsiveBreakpointRuleSchema)
      .length(pageBlueprintV2ResponsiveBreakpointAuthority.length)
      .readonly(),
  })
  .strict();

type ParsedResponsiveRuleContract = z.infer<
  typeof pageBlueprintV2ResponsiveRuleContractV1ShapeSchema
>;

function addStandaloneCompletenessIssues(
  contract: ParsedResponsiveRuleContract,
  context: z.RefinementCtx,
): void {
  const breakpointDuplicates = duplicateValues(
    contract.breakpointRules.map(({ breakpoint }) => breakpoint),
  );
  if (breakpointDuplicates.length > 0) {
    context.addIssue({
      code: "custom",
      path: ["breakpointRules"],
      message: `Duplicate responsive breakpoints: ${boundedEvidence(breakpointDuplicates)}.`,
    });
  }

  const viewportDuplicates = duplicateValues(
    contract.breakpointRules.map(({ viewport }) => String(viewport)),
  );
  if (viewportDuplicates.length > 0) {
    context.addIssue({
      code: "custom",
      path: ["breakpointRules"],
      message: `Duplicate responsive viewports: ${boundedEvidence(viewportDuplicates)}.`,
    });
  }

  const declaredBreakpoints = new Set(contract.breakpointRules.map(({ breakpoint }) => breakpoint));
  const missingBreakpoints = pageBlueprintV2ResponsiveBreakpointAuthority
    .map(({ breakpoint }) => breakpoint)
    .filter((breakpoint) => !declaredBreakpoints.has(breakpoint));
  if (missingBreakpoints.length > 0) {
    context.addIssue({
      code: "custom",
      path: ["breakpointRules"],
      message: `Missing responsive breakpoints: ${missingBreakpoints.join(", ")}.`,
    });
  }

  contract.breakpointRules.forEach((rule, index) => {
    const duplicateRegionIds = duplicateValues(
      rule.regionProportionRules.map(({ regionId }) => regionId),
    );
    if (duplicateRegionIds.length > 0) {
      context.addIssue({
        code: "custom",
        path: ["breakpointRules", index, "regionProportionRules"],
        message: `Duplicate ${rule.breakpoint} responsive region IDs: ${boundedEvidence(duplicateRegionIds)}.`,
      });
    }

    const duplicateRelationshipKeys = duplicateValues(
      rule.relationshipTransformations.map(({ relationshipKey }) => relationshipKey),
    );
    if (duplicateRelationshipKeys.length > 0) {
      context.addIssue({
        code: "custom",
        path: ["breakpointRules", index, "relationshipTransformations"],
        message: `Duplicate ${rule.breakpoint} responsive relationship keys: ${boundedEvidence(duplicateRelationshipKeys)}.`,
      });
    }
  });
}

export const pageBlueprintV2ResponsiveRuleContractV1Schema =
  pageBlueprintV2ResponsiveRuleContractV1ShapeSchema
    .superRefine(addStandaloneCompletenessIssues)
    .readonly();

export type PageBlueprintV2ResponsiveRuleContractV1 = z.infer<
  typeof pageBlueprintV2ResponsiveRuleContractV1Schema
>;

function addCoverageIssues(
  declaredValues: readonly string[],
  expectedValues: readonly string[],
  label: string,
  path: (string | number)[],
  context: z.RefinementCtx,
): void {
  const declared = new Set(declaredValues);
  const expected = new Set(expectedValues);
  const unknown = declaredValues.filter((value) => !expected.has(value));
  const missing = expectedValues.filter((value) => !declared.has(value));
  if (unknown.length > 0) {
    context.addIssue({
      code: "custom",
      path,
      message: `${label} contain unknown authority: ${boundedEvidence(unknown)}.`,
    });
  }
  if (missing.length > 0) {
    context.addIssue({
      code: "custom",
      path,
      message: `${label} are incomplete; missing: ${boundedEvidence(missing)}.`,
    });
  }
}

function createStructurallyBoundResponsiveSchema(structural: PageBlueprintV2StructuralContract) {
  const alternativesById = new Map(
    structural.orderAlternatives.map((alternative) => [alternative.id, alternative]),
  );
  const structuralRegionIds = structural.regions.map(({ id }) => id);
  const relationshipsByKey = new Map(
    structural.relationships.map((relationship) => [
      createPageBlueprintV2RegionRelationshipKey(relationship),
      relationship,
    ]),
  );
  const structuralRelationshipKeys = structural.relationships.map(
    createPageBlueprintV2RegionRelationshipKey,
  );

  return pageBlueprintV2ResponsiveRuleContractV1ShapeSchema
    .superRefine((contract, context) => {
      addStandaloneCompletenessIssues(contract, context);

      if (contract.blueprintId !== structural.id) {
        context.addIssue({
          code: "custom",
          path: ["blueprintId"],
          message: "Responsive-rule blueprint ID must match structural authority.",
        });
      }
      if (contract.blueprintVersion !== structural.version) {
        context.addIssue({
          code: "custom",
          path: ["blueprintVersion"],
          message: "Responsive-rule blueprint version must match structural authority.",
        });
      }

      contract.breakpointRules.forEach((rule, index) => {
        if (!alternativesById.has(rule.orderAlternativeId)) {
          context.addIssue({
            code: "custom",
            path: ["breakpointRules", index, "orderAlternativeId"],
            message: `${rule.breakpoint} responsive authority references an unknown structural order alternative.`,
          });
        }

        addCoverageIssues(
          rule.regionProportionRules.map(({ regionId }) => regionId),
          structuralRegionIds,
          `${rule.breakpoint} responsive region rules`,
          ["breakpointRules", index, "regionProportionRules"],
          context,
        );
        addCoverageIssues(
          rule.relationshipTransformations.map(({ relationshipKey }) => relationshipKey),
          structuralRelationshipKeys,
          `${rule.breakpoint} responsive relationship transformations`,
          ["breakpointRules", index, "relationshipTransformations"],
          context,
        );

        rule.relationshipTransformations.forEach((transformation, transformationIndex) => {
          const relationship = relationshipsByKey.get(transformation.relationshipKey);
          if (!relationship) return;
          const allowed: readonly PageBlueprintV2ResponsiveRelationshipTransformationMode[] =
            pageBlueprintV2ResponsiveRelationshipTransformationPolicy[
              relationship.relationshipKind
            ];
          if (!allowed.includes(transformation.transformation)) {
            context.addIssue({
              code: "custom",
              path: [
                "breakpointRules",
                index,
                "relationshipTransformations",
                transformationIndex,
                "transformation",
              ],
              message: `Responsive transformation is incompatible with ${relationship.relationshipKind} structural authority.`,
            });
          }
        });
      });
    })
    .readonly();
}

export function canonicalizePageBlueprintV2ResponsiveRuleContract(
  structuralInput: unknown,
  responsiveInput: unknown,
): PageBlueprintV2ResponsiveRuleContractV1 {
  const structural = canonicalizePageBlueprintV2StructuralContract(structuralInput);
  const responsive = pageBlueprintV2ResponsiveRuleContractV1Schema.parse(responsiveInput);
  const bound = createStructurallyBoundResponsiveSchema(structural).parse(responsive);
  const rulesByBreakpoint = new Map(bound.breakpointRules.map((rule) => [rule.breakpoint, rule]));
  const structuralRelationshipPositions = new Map(
    structural.relationships.map((relationship, index) => [
      createPageBlueprintV2RegionRelationshipKey(relationship),
      index,
    ]),
  );

  const breakpointRules = pageBlueprintV2ResponsiveBreakpointAuthority.map(({ breakpoint }) => {
    const rule = rulesByBreakpoint.get(breakpoint);
    if (!rule) throw new Error("Validated responsive authority is missing a breakpoint rule.");
    const alternative = structural.orderAlternatives.find(
      ({ id }) => id === rule.orderAlternativeId,
    );
    if (!alternative) {
      throw new Error(
        "Validated responsive authority is missing its structural order alternative.",
      );
    }
    const regionPositions = new Map(
      alternative.regionIds.map((regionId, index) => [regionId, index]),
    );

    return {
      ...rule,
      regionProportionRules: [...rule.regionProportionRules].sort(
        (left, right) =>
          (regionPositions.get(left.regionId) ?? Number.POSITIVE_INFINITY) -
          (regionPositions.get(right.regionId) ?? Number.POSITIVE_INFINITY),
      ),
      relationshipTransformations: [...rule.relationshipTransformations].sort(
        (left, right) =>
          (structuralRelationshipPositions.get(left.relationshipKey) ?? Number.POSITIVE_INFINITY) -
          (structuralRelationshipPositions.get(right.relationshipKey) ?? Number.POSITIVE_INFINITY),
      ),
    };
  });

  return pageBlueprintV2ResponsiveRuleContractV1Schema.parse({
    contractSchemaVersion: bound.contractSchemaVersion,
    blueprintId: bound.blueprintId,
    blueprintVersion: bound.blueprintVersion,
    breakpointRules,
  });
}
