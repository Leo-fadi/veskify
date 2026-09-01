import { z } from "zod";
import { assetRoleSchema, assetRoleValues, type AssetRole } from "@/domain/shared/asset-role";
import {
  MAX_PAGE_BLUEPRINT_V2_FAILURE_EVIDENCE,
  MAX_PAGE_BLUEPRINT_V2_REGIONS,
  canonicalizePageBlueprintV2StructuralContract,
  pageBlueprintV2RecordVersionSchema,
  pageBlueprintV2RegionIdSchema,
  pageBlueprintV2StableIdSchema,
  type PageBlueprintV2StructuralContract,
} from "./page-blueprint-v2-contract";

export const PAGE_BLUEPRINT_V2_ASSET_ROLE_COMPATIBILITY_CONTRACT_SCHEMA_VERSION = "1.0.0" as const;

export const MAX_PAGE_BLUEPRINT_V2_REGION_ASSET_REQUIREMENTS = MAX_PAGE_BLUEPRINT_V2_REGIONS;
export const MAX_PAGE_BLUEPRINT_V2_ASSET_ROLE_REQUIREMENTS_PER_REGION = assetRoleValues.length;
export const MAX_PAGE_BLUEPRINT_V2_ASSET_ROLE_CARDINALITY = 32;

const compareCodeUnits = (left: string, right: string): number =>
  left < right ? -1 : left > right ? 1 : 0;

const assetRoleOrder = new Map<AssetRole, number>(
  assetRoleValues.map((role, index) => [role, index]),
);

const compareAssetRoles = (left: AssetRole, right: AssetRole): number =>
  (assetRoleOrder.get(left) ?? Number.POSITIVE_INFINITY) -
  (assetRoleOrder.get(right) ?? Number.POSITIVE_INFINITY);

function evidenceMessage<Value extends string>(
  label: string,
  values: Iterable<Value>,
  compare: (left: Value, right: Value) => number,
): string {
  const ordered = [...new Set(values)].sort(compare);
  const visible = ordered.slice(0, MAX_PAGE_BLUEPRINT_V2_FAILURE_EVIDENCE);
  const omitted = ordered.length - visible.length;
  return `${label}: ${visible.join(", ")}${omitted > 0 ? ` (+${omitted} more)` : ""}.`;
}

const pageBlueprintV2AssetRoleRequirementKindSchema = z.enum(["required", "optional"]);

const pageBlueprintV2AssetRoleCardinalitySchema = z
  .object({
    minimum: z.number().int().nonnegative().max(MAX_PAGE_BLUEPRINT_V2_ASSET_ROLE_CARDINALITY),
    ideal: z.number().int().nonnegative().max(MAX_PAGE_BLUEPRINT_V2_ASSET_ROLE_CARDINALITY),
    maximum: z.number().int().positive().max(MAX_PAGE_BLUEPRINT_V2_ASSET_ROLE_CARDINALITY),
  })
  .strict()
  .superRefine((cardinality, context) => {
    if (cardinality.minimum > cardinality.ideal) {
      context.addIssue({
        code: "custom",
        path: ["ideal"],
        message: "Asset-role ideal cardinality cannot be lower than its minimum.",
      });
    }
    if (cardinality.ideal > cardinality.maximum) {
      context.addIssue({
        code: "custom",
        path: ["maximum"],
        message: "Asset-role maximum cardinality cannot be lower than its ideal.",
      });
    }
  })
  .readonly();

export const pageBlueprintV2AssetRoleRequirementSchema = z
  .object({
    role: assetRoleSchema,
    requirement: pageBlueprintV2AssetRoleRequirementKindSchema,
    cardinality: pageBlueprintV2AssetRoleCardinalitySchema,
  })
  .strict()
  .superRefine((roleRequirement, context) => {
    if (roleRequirement.requirement === "required" && roleRequirement.cardinality.minimum < 1) {
      context.addIssue({
        code: "custom",
        path: ["cardinality", "minimum"],
        message: "A required asset role must have minimum cardinality of at least one.",
      });
    }
    if (roleRequirement.requirement === "optional" && roleRequirement.cardinality.minimum !== 0) {
      context.addIssue({
        code: "custom",
        path: ["cardinality", "minimum"],
        message: "An optional asset role must have minimum cardinality zero.",
      });
    }
  })
  .readonly();

export type PageBlueprintV2AssetRoleRequirement = z.infer<
  typeof pageBlueprintV2AssetRoleRequirementSchema
>;

const pageBlueprintV2RegionAssetRequirementsShapeSchema = z
  .object({
    regionId: pageBlueprintV2RegionIdSchema,
    roleRequirements: z
      .array(pageBlueprintV2AssetRoleRequirementSchema)
      .min(1)
      .max(MAX_PAGE_BLUEPRINT_V2_ASSET_ROLE_REQUIREMENTS_PER_REGION)
      .readonly(),
  })
  .strict()
  .readonly();

type ParsedRegionAssetRequirements = z.infer<
  typeof pageBlueprintV2RegionAssetRequirementsShapeSchema
>;

function duplicateAssetRoles(
  roleRequirements: readonly PageBlueprintV2AssetRoleRequirement[],
): readonly AssetRole[] {
  const counts = new Map<AssetRole, number>();
  for (const roleRequirement of roleRequirements) {
    counts.set(roleRequirement.role, (counts.get(roleRequirement.role) ?? 0) + 1);
  }
  return Object.freeze(
    [...counts]
      .filter(([, count]) => count > 1)
      .map(([role]) => role)
      .sort(compareAssetRoles),
  );
}

export const pageBlueprintV2RegionAssetRequirementsSchema =
  pageBlueprintV2RegionAssetRequirementsShapeSchema
    .superRefine((regionRequirements, context) => {
      const duplicates = duplicateAssetRoles(regionRequirements.roleRequirements);
      if (duplicates.length > 0) {
        context.addIssue({
          code: "custom",
          path: ["roleRequirements"],
          message: evidenceMessage(
            `Duplicate asset roles in region ${regionRequirements.regionId}`,
            duplicates,
            compareAssetRoles,
          ),
        });
      }
    })
    .readonly();

export type PageBlueprintV2RegionAssetRequirements = z.infer<
  typeof pageBlueprintV2RegionAssetRequirementsSchema
>;

const pageBlueprintV2AssetRoleCompatibilityContractV1ShapeSchema = z
  .object({
    contractSchemaVersion: z.literal(
      PAGE_BLUEPRINT_V2_ASSET_ROLE_COMPATIBILITY_CONTRACT_SCHEMA_VERSION,
    ),
    blueprintId: pageBlueprintV2StableIdSchema,
    blueprintVersion: pageBlueprintV2RecordVersionSchema,
    regionAssetRequirements: z
      .array(pageBlueprintV2RegionAssetRequirementsShapeSchema)
      .max(MAX_PAGE_BLUEPRINT_V2_REGION_ASSET_REQUIREMENTS)
      .readonly(),
  })
  .strict();

type ParsedAssetRoleCompatibilityContract = z.infer<
  typeof pageBlueprintV2AssetRoleCompatibilityContractV1ShapeSchema
>;

type RegionIdComparator = (left: string, right: string) => number;

function duplicateRegionIds(
  regionRequirements: readonly ParsedRegionAssetRequirements[],
  compareRegionIds: RegionIdComparator,
): readonly string[] {
  const counts = new Map<string, number>();
  for (const regionRequirement of regionRequirements) {
    counts.set(regionRequirement.regionId, (counts.get(regionRequirement.regionId) ?? 0) + 1);
  }
  return Object.freeze(
    [...counts]
      .filter(([, count]) => count > 1)
      .map(([regionId]) => regionId)
      .sort(compareRegionIds),
  );
}

function duplicateRoleEvidenceByRegion(
  regionRequirements: readonly ParsedRegionAssetRequirements[],
  compareRegionIds: RegionIdComparator,
): readonly Readonly<{ regionId: string; roles: readonly AssetRole[] }>[] {
  const rolesByRegionId = new Map<string, Set<AssetRole>>();
  for (const regionRequirement of regionRequirements) {
    const duplicates = duplicateAssetRoles(regionRequirement.roleRequirements);
    if (duplicates.length === 0) continue;
    const roles = rolesByRegionId.get(regionRequirement.regionId) ?? new Set<AssetRole>();
    for (const role of duplicates) roles.add(role);
    rolesByRegionId.set(regionRequirement.regionId, roles);
  }
  return Object.freeze(
    [...rolesByRegionId]
      .map(([regionId, roles]) =>
        Object.freeze({ regionId, roles: Object.freeze([...roles].sort(compareAssetRoles)) }),
      )
      .sort((left, right) => compareRegionIds(left.regionId, right.regionId)),
  );
}

function duplicateRoleEvidenceMessage(
  duplicateEvidence: readonly Readonly<{
    regionId: string;
    roles: readonly AssetRole[];
  }>[],
): string {
  const visible = duplicateEvidence.slice(0, MAX_PAGE_BLUEPRINT_V2_FAILURE_EVIDENCE);
  const omitted = duplicateEvidence.length - visible.length;
  return `Duplicate asset roles by region: ${visible
    .map(({ regionId, roles }) => `${regionId}=[${roles.join(", ")}]`)
    .join("; ")}${omitted > 0 ? ` (+${omitted} more regions)` : ""}.`;
}

function addDuplicateIssues(
  contract: ParsedAssetRoleCompatibilityContract,
  context: z.RefinementCtx,
  compareRegionIds: RegionIdComparator,
): void {
  const duplicateRegions = duplicateRegionIds(contract.regionAssetRequirements, compareRegionIds);
  if (duplicateRegions.length > 0) {
    context.addIssue({
      code: "custom",
      path: ["regionAssetRequirements"],
      message: evidenceMessage(
        "Duplicate asset-role compatibility region IDs",
        duplicateRegions,
        compareRegionIds,
      ),
    });
  }

  const duplicateRoles = duplicateRoleEvidenceByRegion(
    contract.regionAssetRequirements,
    compareRegionIds,
  );
  if (duplicateRoles.length > 0) {
    context.addIssue({
      code: "custom",
      path: ["regionAssetRequirements"],
      message: duplicateRoleEvidenceMessage(duplicateRoles),
    });
  }
}

export const pageBlueprintV2AssetRoleCompatibilityContractV1Schema =
  pageBlueprintV2AssetRoleCompatibilityContractV1ShapeSchema
    .superRefine((contract, context) => {
      addDuplicateIssues(contract, context, compareCodeUnits);
    })
    .readonly();

export type PageBlueprintV2AssetRoleCompatibilityContractV1 = z.infer<
  typeof pageBlueprintV2AssetRoleCompatibilityContractV1Schema
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

function createRegionIdComparator(
  defaultPositions: ReadonlyMap<string, number>,
): RegionIdComparator {
  return (left, right) => {
    const leftPosition = defaultPositions.get(left);
    const rightPosition = defaultPositions.get(right);
    if (leftPosition !== undefined && rightPosition !== undefined) {
      return leftPosition - rightPosition;
    }
    if (leftPosition !== undefined) return -1;
    if (rightPosition !== undefined) return 1;
    return compareCodeUnits(left, right);
  };
}

export function canonicalizePageBlueprintV2AssetRoleCompatibilityContract(
  structuralInput: unknown,
  compatibilityInput: unknown,
): PageBlueprintV2AssetRoleCompatibilityContractV1 {
  const structural = canonicalizePageBlueprintV2StructuralContract(structuralInput);
  const defaultPositions = defaultRegionOrder(structural);
  const compareRegionIds = createRegionIdComparator(defaultPositions);
  const knownRegionIds = new Set(structural.regions.map((region) => region.id));

  const boundCompatibilitySchema = pageBlueprintV2AssetRoleCompatibilityContractV1ShapeSchema
    .superRefine((contract, context) => {
      if (contract.blueprintId !== structural.id) {
        context.addIssue({
          code: "custom",
          path: ["blueprintId"],
          message: "Asset-role compatibility blueprint ID must match structural authority.",
        });
      }
      if (contract.blueprintVersion !== structural.version) {
        context.addIssue({
          code: "custom",
          path: ["blueprintVersion"],
          message: "Asset-role compatibility blueprint version must match structural authority.",
        });
      }

      const unknownRegionIds = contract.regionAssetRequirements
        .map((regionRequirements) => regionRequirements.regionId)
        .filter((regionId) => !knownRegionIds.has(regionId));
      if (unknownRegionIds.length > 0) {
        context.addIssue({
          code: "custom",
          path: ["regionAssetRequirements"],
          message: evidenceMessage(
            "Asset-role compatibility references unknown structural regions",
            unknownRegionIds,
            compareRegionIds,
          ),
        });
      }

      addDuplicateIssues(contract, context, compareRegionIds);
    })
    .readonly();

  const parsed = boundCompatibilitySchema.parse(compatibilityInput);
  const regionAssetRequirements = [...parsed.regionAssetRequirements]
    .sort((left, right) => compareRegionIds(left.regionId, right.regionId))
    .map((regionRequirements) => ({
      regionId: regionRequirements.regionId,
      roleRequirements: [...regionRequirements.roleRequirements].sort((left, right) =>
        compareAssetRoles(left.role, right.role),
      ),
    }));

  return pageBlueprintV2AssetRoleCompatibilityContractV1Schema.parse({
    contractSchemaVersion: parsed.contractSchemaVersion,
    blueprintId: parsed.blueprintId,
    blueprintVersion: parsed.blueprintVersion,
    regionAssetRequirements,
  });
}
