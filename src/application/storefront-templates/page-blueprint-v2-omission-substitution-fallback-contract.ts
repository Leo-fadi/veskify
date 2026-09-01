import { z } from "zod";

import {
  MAX_PAGE_BLUEPRINT_V2_FAILURE_EVIDENCE,
  MAX_PAGE_BLUEPRINT_V2_REGIONS,
  canonicalizePageBlueprintV2StructuralContract,
  pageBlueprintV2RecordVersionSchema,
  pageBlueprintV2RegionIdSchema,
  pageBlueprintV2StableIdSchema,
  type PageBlueprintV2StructuralContract,
} from "./page-blueprint-v2-contract";
import {
  canonicalizePageBlueprintV2AssetRoleCompatibilityContract,
  type PageBlueprintV2AssetRoleCompatibilityContractV1,
} from "./page-blueprint-v2-asset-role-contract";
import {
  canonicalizePageBlueprintV2ResponsiveRuleContract,
  type PageBlueprintV2ResponsiveRuleContractV1,
} from "./page-blueprint-v2-responsive-rule-contract";

export const PAGE_BLUEPRINT_V2_OMISSION_SUBSTITUTION_FALLBACK_CONTRACT_SCHEMA_VERSION =
  "1.0.0" as const;

export const MAX_PAGE_BLUEPRINT_V2_SUBSTITUTION_CANDIDATES = 8;

const compareCodeUnits = (left: string, right: string): number =>
  left < right ? -1 : left > right ? 1 : 0;

function uniqueSorted(values: Iterable<string>): readonly string[] {
  return Object.freeze([...new Set(values)].sort(compareCodeUnits));
}

function duplicateValues(values: readonly string[]): readonly string[] {
  const counts = new Map<string, number>();
  for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1);
  return uniqueSorted([...counts].filter(([, count]) => count > 1).map(([value]) => value));
}

function boundedEvidence(values: Iterable<string>): string {
  const ordered = uniqueSorted(values);
  const visible = ordered.slice(0, MAX_PAGE_BLUEPRINT_V2_FAILURE_EVIDENCE);
  const omitted = ordered.length - visible.length;
  return `${visible.join(", ")}${omitted > 0 ? ` (+${omitted} more)` : ""}`;
}

export const pageBlueprintV2SubstitutionCandidateReferenceSchema = z
  .object({
    blueprintId: pageBlueprintV2StableIdSchema,
    blueprintVersion: pageBlueprintV2RecordVersionSchema,
  })
  .strict()
  .readonly();

export type PageBlueprintV2SubstitutionCandidateReference = z.infer<
  typeof pageBlueprintV2SubstitutionCandidateReferenceSchema
>;

export const pageBlueprintV2FallbackTriggerSchema = z.literal(
  "required-asset-role-cardinality-unsatisfied",
);

export type PageBlueprintV2FallbackTrigger = z.infer<typeof pageBlueprintV2FallbackTriggerSchema>;

export const pageBlueprintV2TerminalResolutionValues = Object.freeze([
  "omit-region",
  "fail-closed",
] as const);

export const pageBlueprintV2TerminalResolutionSchema = z.enum(
  pageBlueprintV2TerminalResolutionValues,
);

export type PageBlueprintV2TerminalResolution = z.infer<
  typeof pageBlueprintV2TerminalResolutionSchema
>;

export const pageBlueprintV2RegionFallbackRuleSchema = z
  .object({
    regionId: pageBlueprintV2RegionIdSchema,
    trigger: pageBlueprintV2FallbackTriggerSchema,
    terminalResolution: pageBlueprintV2TerminalResolutionSchema,
  })
  .strict()
  .readonly();

export type PageBlueprintV2RegionFallbackRule = z.infer<
  typeof pageBlueprintV2RegionFallbackRuleSchema
>;

const pageBlueprintV2OmissionSubstitutionFallbackContractV1ShapeSchema = z
  .object({
    contractSchemaVersion: z.literal(
      PAGE_BLUEPRINT_V2_OMISSION_SUBSTITUTION_FALLBACK_CONTRACT_SCHEMA_VERSION,
    ),
    blueprintId: pageBlueprintV2StableIdSchema,
    blueprintVersion: pageBlueprintV2RecordVersionSchema,
    blueprintSubstitutionCandidates: z
      .array(pageBlueprintV2SubstitutionCandidateReferenceSchema)
      .max(MAX_PAGE_BLUEPRINT_V2_SUBSTITUTION_CANDIDATES)
      .readonly(),
    regionFallbackRules: z
      .array(pageBlueprintV2RegionFallbackRuleSchema)
      .max(MAX_PAGE_BLUEPRINT_V2_REGIONS)
      .readonly(),
  })
  .strict();

type ParsedOmissionSubstitutionFallbackContract = z.infer<
  typeof pageBlueprintV2OmissionSubstitutionFallbackContractV1ShapeSchema
>;

function addStandaloneIntegrityIssues(
  contract: ParsedOmissionSubstitutionFallbackContract,
  context: z.RefinementCtx,
): void {
  const duplicateRegionIds = duplicateValues(
    contract.regionFallbackRules.map(({ regionId }) => regionId),
  );
  if (duplicateRegionIds.length > 0) {
    context.addIssue({
      code: "custom",
      path: ["regionFallbackRules"],
      message: `Duplicate fallback region IDs: ${boundedEvidence(duplicateRegionIds)}.`,
    });
  }

  const duplicateCandidateIds = duplicateValues(
    contract.blueprintSubstitutionCandidates.map(({ blueprintId }) => blueprintId),
  );
  if (duplicateCandidateIds.length > 0) {
    context.addIssue({
      code: "custom",
      path: ["blueprintSubstitutionCandidates"],
      message: `Duplicate substitution target blueprint IDs: ${boundedEvidence(duplicateCandidateIds)}.`,
    });
  }

  contract.blueprintSubstitutionCandidates.forEach((candidate, index) => {
    if (candidate.blueprintId === contract.blueprintId) {
      context.addIssue({
        code: "custom",
        path: ["blueprintSubstitutionCandidates", index, "blueprintId"],
        message: "A substitution candidate cannot reference its source blueprint ID.",
      });
    }
  });
}

export const pageBlueprintV2OmissionSubstitutionFallbackContractV1Schema =
  pageBlueprintV2OmissionSubstitutionFallbackContractV1ShapeSchema
    .superRefine(addStandaloneIntegrityIssues)
    .readonly();

export type PageBlueprintV2OmissionSubstitutionFallbackContractV1 = z.infer<
  typeof pageBlueprintV2OmissionSubstitutionFallbackContractV1Schema
>;

function defaultRegionOrder(
  structural: PageBlueprintV2StructuralContract,
): ReadonlyMap<string, number> {
  const defaultAlternative = structural.orderAlternatives.find(
    (alternative) => alternative.id === structural.defaultOrderAlternativeId,
  );
  if (!defaultAlternative) {
    throw new Error("Validated PageBlueprint v2 authority is missing its default order.");
  }
  return new Map(defaultAlternative.regionIds.map((regionId, position) => [regionId, position]));
}

function requiredAssetRoleRegionIds(
  assetRole: PageBlueprintV2AssetRoleCompatibilityContractV1,
): readonly string[] {
  return Object.freeze(
    assetRole.regionAssetRequirements
      .filter(({ roleRequirements }) =>
        roleRequirements.some(({ requirement }) => requirement === "required"),
      )
      .map(({ regionId }) => regionId),
  );
}

function createBoundFallbackSchema(
  structural: PageBlueprintV2StructuralContract,
  assetRole: PageBlueprintV2AssetRoleCompatibilityContractV1,
  responsive: PageBlueprintV2ResponsiveRuleContractV1,
) {
  const structuralRegionById = new Map(structural.regions.map((region) => [region.id, region]));
  const requiredRegionIds = requiredAssetRoleRegionIds(assetRole);
  const requiredRegionIdSet = new Set(requiredRegionIds);

  return pageBlueprintV2OmissionSubstitutionFallbackContractV1ShapeSchema
    .superRefine(addStandaloneIntegrityIssues)
    .superRefine((contract, context) => {
      if (
        contract.blueprintId !== structural.id ||
        contract.blueprintId !== assetRole.blueprintId ||
        contract.blueprintId !== responsive.blueprintId
      ) {
        context.addIssue({
          code: "custom",
          path: ["blueprintId"],
          message: "Fallback blueprint ID must match A-03, A-04 and A-05 authority.",
        });
      }
      if (
        contract.blueprintVersion !== structural.version ||
        contract.blueprintVersion !== assetRole.blueprintVersion ||
        contract.blueprintVersion !== responsive.blueprintVersion
      ) {
        context.addIssue({
          code: "custom",
          path: ["blueprintVersion"],
          message: "Fallback blueprint version must match A-03, A-04 and A-05 authority.",
        });
      }

      const declaredRegionIds = contract.regionFallbackRules.map(({ regionId }) => regionId);
      const unknownRegionIds = declaredRegionIds.filter(
        (regionId) => !structuralRegionById.has(regionId),
      );
      const extraRegionIds = declaredRegionIds.filter(
        (regionId) => structuralRegionById.has(regionId) && !requiredRegionIdSet.has(regionId),
      );
      const declaredRegionIdSet = new Set(declaredRegionIds);
      const missingRegionIds = requiredRegionIds.filter(
        (regionId) => !declaredRegionIdSet.has(regionId),
      );

      if (unknownRegionIds.length > 0) {
        context.addIssue({
          code: "custom",
          path: ["regionFallbackRules"],
          message: `Fallback rules reference unknown structural regions: ${boundedEvidence(unknownRegionIds)}.`,
        });
      }
      if (extraRegionIds.length > 0) {
        context.addIssue({
          code: "custom",
          path: ["regionFallbackRules"],
          message: `Fallback rules reference regions without required asset roles: ${boundedEvidence(extraRegionIds)}.`,
        });
      }
      if (missingRegionIds.length > 0) {
        context.addIssue({
          code: "custom",
          path: ["regionFallbackRules"],
          message: `Fallback rules are incomplete; missing regions: ${boundedEvidence(missingRegionIds)}.`,
        });
      }

      contract.regionFallbackRules.forEach((rule, index) => {
        if (
          rule.terminalResolution === "omit-region" &&
          structuralRegionById.get(rule.regionId)?.requirement !== "optional"
        ) {
          context.addIssue({
            code: "custom",
            path: ["regionFallbackRules", index, "terminalResolution"],
            message: "Only a structurally optional region can terminate with omit-region.",
          });
        }
      });

      if (requiredRegionIds.length === 0 && contract.blueprintSubstitutionCandidates.length > 0) {
        context.addIssue({
          code: "custom",
          path: ["blueprintSubstitutionCandidates"],
          message: "Substitution candidates require at least one triggerable region.",
        });
      }
    })
    .readonly();
}

function auditMaximumSimultaneousOmission(
  structural: PageBlueprintV2StructuralContract,
  fallback: PageBlueprintV2OmissionSubstitutionFallbackContractV1,
): void {
  const omittedRegionIds = new Set(
    fallback.regionFallbackRules
      .filter(({ terminalResolution }) => terminalResolution === "omit-region")
      .map(({ regionId }) => regionId),
  );
  if (omittedRegionIds.size === 0) return;

  canonicalizePageBlueprintV2StructuralContract({
    id: structural.id,
    version: structural.version,
    pageFamilyId: structural.pageFamilyId,
    regions: structural.regions.filter(({ id }) => !omittedRegionIds.has(id)),
    relationships: structural.relationships.filter(
      ({ sourceRegionId, targetRegionId }) =>
        !omittedRegionIds.has(sourceRegionId) && !omittedRegionIds.has(targetRegionId),
    ),
    orderAlternatives: structural.orderAlternatives.map((alternative) => ({
      id: alternative.id,
      regionIds: alternative.regionIds.filter((regionId) => !omittedRegionIds.has(regionId)),
    })),
    defaultOrderAlternativeId: structural.defaultOrderAlternativeId,
  });
}

export function canonicalizePageBlueprintV2OmissionSubstitutionFallbackContract(
  structuralInput: unknown,
  assetRoleInput: unknown,
  responsiveInput: unknown,
  fallbackInput: unknown,
): PageBlueprintV2OmissionSubstitutionFallbackContractV1 {
  const structural = canonicalizePageBlueprintV2StructuralContract(structuralInput);
  const assetRole = canonicalizePageBlueprintV2AssetRoleCompatibilityContract(
    structural,
    assetRoleInput,
  );
  const responsive = canonicalizePageBlueprintV2ResponsiveRuleContract(structural, responsiveInput);
  const parsed = createBoundFallbackSchema(structural, assetRole, responsive).parse(fallbackInput);
  const defaultPositions = defaultRegionOrder(structural);

  auditMaximumSimultaneousOmission(structural, parsed);

  const canonical = pageBlueprintV2OmissionSubstitutionFallbackContractV1Schema.parse({
    contractSchemaVersion: parsed.contractSchemaVersion,
    blueprintId: parsed.blueprintId,
    blueprintVersion: parsed.blueprintVersion,
    blueprintSubstitutionCandidates: parsed.blueprintSubstitutionCandidates,
    regionFallbackRules: [...parsed.regionFallbackRules].sort(
      (left, right) =>
        (defaultPositions.get(left.regionId) ?? Number.POSITIVE_INFINITY) -
        (defaultPositions.get(right.regionId) ?? Number.POSITIVE_INFINITY),
    ),
  });

  return canonical;
}
