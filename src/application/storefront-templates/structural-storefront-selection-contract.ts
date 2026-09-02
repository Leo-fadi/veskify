import { z } from "zod";

import { canonicalValueFingerprint, canonicalValueString } from "@/domain/storefront";
import {
  canonicalizeStructuralStorefrontCrossPageRelationships,
  structuralStorefrontCrossPageRelationshipV1Schema,
  structuralStorefrontFamilyIdSchema,
  structuralStorefrontFamilyIds,
  structuralStorefrontFamilyIdentityKey,
  structuralStorefrontFamilyVersionSchema,
  structuralStorefrontPageFamilyIdSchema,
  structuralStorefrontPageFamilyIds,
  type StructuralStorefrontFamilyId,
  type StructuralStorefrontPageFamilyId,
} from "@/domain/structural-storefront-family";
import {
  pageBlueprintV2RecordVersionSchema,
  pageBlueprintV2RegionIdSchema,
  pageBlueprintV2StableIdSchema,
} from "./page-blueprint-v2-contract";
import { pageBlueprintV2NormalizedTopologyFingerprintSchema } from "./page-blueprint-v2-normalized-topology";
import {
  pageBlueprintV2CandidateCompatibilityStatusSchema,
  structuralStorefrontCandidateCompatibilityEvaluationFingerprintSchema,
  structuralStorefrontFamilyCandidateCompatibilityStatusSchema,
} from "./structural-storefront-candidate-compatibility-evaluation";
import { structuralStorefrontFamilyNormalizedTopologyFingerprintSchema } from "./structural-storefront-family-normalized-topology";

export const STRUCTURAL_STOREFRONT_DETERMINISTIC_SELECTION_REQUEST_SCHEMA_VERSION =
  "1.0.0" as const;
export const STRUCTURAL_STOREFRONT_DETERMINISTIC_SELECTION_POLICY_VERSION = "1.0.0" as const;
export const STRUCTURAL_STOREFRONT_SELECTED_COMPLETE_TOPOLOGY_SCHEMA_VERSION = "1.0.0" as const;
export const STRUCTURAL_STOREFRONT_DETERMINISTIC_SELECTION_RECEIPT_SCHEMA_VERSION =
  "1.0.0" as const;
export const MAX_STRUCTURAL_STOREFRONT_SELECTION_COMBINATION_EVALUATIONS = 4_096 as const;
export const structuralStorefrontFamilyCompatibilityPrecedence = Object.freeze([
  "directly-compatible",
  "conditionally-compatible",
] as const);
export const structuralStorefrontPageBlueprintCompatibilityPrecedence = Object.freeze([
  "directly-compatible",
  "substitution-compatible",
  "omission-compatible",
] as const);

const compareCodeUnits = (left: string, right: string) =>
  left < right ? -1 : left > right ? 1 : 0;
const familyOrder = new Map<StructuralStorefrontFamilyId, number>(
  structuralStorefrontFamilyIds.map((familyId, index) => [familyId, index]),
);
const pageFamilyOrder = new Map<StructuralStorefrontPageFamilyId, number>(
  structuralStorefrontPageFamilyIds.map((pageFamilyId, index) => [pageFamilyId, index]),
);

function deepFreeze<Value>(value: Value, seen = new WeakSet<object>()): Value {
  if (value === null || typeof value !== "object" || seen.has(value)) return value;
  seen.add(value);
  Object.values(value as Record<string, unknown>).forEach((child) => deepFreeze(child, seen));
  return Object.freeze(value);
}

function issue(context: z.RefinementCtx, path: (string | number)[], message: string): void {
  context.addIssue({ code: z.ZodIssueCode.custom, path, message });
}

function assertUnique(
  values: readonly string[],
  context: z.RefinementCtx,
  path: (string | number)[],
): void {
  if (new Set(values).size !== values.length) issue(context, path, "Values must be unique.");
}

const exactCandidateIdentityKeySchema = z
  .string()
  .max(145)
  .superRefine((value, context) => {
    const separator = value.lastIndexOf("@");
    const blueprintId = value.slice(0, separator);
    const blueprintVersion = value.slice(separator + 1);
    if (
      separator < 1 ||
      !pageBlueprintV2StableIdSchema.safeParse(blueprintId).success ||
      !pageBlueprintV2RecordVersionSchema.safeParse(blueprintVersion).success ||
      `${blueprintId}@${blueprintVersion}` !== value
    ) {
      issue(context, [], "PageBlueprint candidate identity is invalid.");
    }
  });
const pageCandidateFingerprintSchema = z
  .string()
  .regex(/^page-blueprint-v2-candidate-v1_(?:0|[1-9][0-9]*)_[a-f0-9]{64}$/u);
const familyCandidateFingerprintSchema = z
  .string()
  .regex(/^structural-storefront-family-candidate-v1_(?:0|[1-9][0-9]*)_[a-f0-9]{64}$/u);
const requestFingerprintSchema = z
  .string()
  .regex(
    /^structural-storefront-deterministic-selection-request-v1_(?:0|[1-9][0-9]*)_[a-f0-9]{64}$/u,
  );
export const structuralStorefrontSelectedCompleteTopologyFingerprintSchema = z
  .string()
  .regex(/^structural-storefront-selected-complete-topology-v1_(?:0|[1-9][0-9]*)_[a-f0-9]{64}$/u);
export const structuralStorefrontDeterministicSelectionFingerprintSchema = z
  .string()
  .regex(/^structural-storefront-deterministic-selection-v1_(?:0|[1-9][0-9]*)_[a-f0-9]{64}$/u);

const selectionCaseIdSchema = z
  .string()
  .min(1)
  .max(128)
  .regex(/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/u)
  .refine((value) => !/\b[0-9]{4}-[0-9]{2}-[0-9]{2}\b/u.test(value), "Dates are forbidden.")
  .refine(
    (value) => !/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/u.test(value),
    "UUIDs are forbidden.",
  );

function familyIdentity(value: string) {
  const separator = value.lastIndexOf("@");
  return {
    familyId: structuralStorefrontFamilyIdSchema.parse(value.slice(0, separator)),
    familyVersion: structuralStorefrontFamilyVersionSchema.parse(value.slice(separator + 1)),
  };
}

const exactFamilyCandidateIdentityKeySchema = z
  .string()
  .max(160)
  .superRefine((value, context) => {
    try {
      if (structuralStorefrontFamilyIdentityKey(familyIdentity(value)) !== value) {
        issue(context, [], "Family candidate identity is not canonical.");
      }
    } catch {
      issue(context, [], "Family candidate identity is invalid.");
    }
  });

function compareVersions(left: string, right: string): number {
  const leftParts = left.split(".").map(BigInt);
  const rightParts = right.split(".").map(BigInt);
  for (let index = 0; index < leftParts.length; index += 1) {
    if (leftParts[index] < rightParts[index]) return -1;
    if (leftParts[index] > rightParts[index]) return 1;
  }
  return 0;
}

function compareFamilyIdentities(left: string, right: string): number {
  const leftIdentity = familyIdentity(left);
  const rightIdentity = familyIdentity(right);
  const familyDifference =
    (familyOrder.get(leftIdentity.familyId) ?? structuralStorefrontFamilyIds.length) -
    (familyOrder.get(rightIdentity.familyId) ?? structuralStorefrontFamilyIds.length);
  return (
    familyDifference ||
    compareVersions(leftIdentity.familyVersion, rightIdentity.familyVersion) ||
    compareCodeUnits(left, right)
  );
}

const requestMaterialShape = {
  requestSchemaVersion: z.literal(
    STRUCTURAL_STOREFRONT_DETERMINISTIC_SELECTION_REQUEST_SCHEMA_VERSION,
  ),
  selectionPolicyVersion: z.literal(STRUCTURAL_STOREFRONT_DETERMINISTIC_SELECTION_POLICY_VERSION),
  selectionCaseId: selectionCaseIdSchema,
  compatibilityEvaluationFingerprint:
    structuralStorefrontCandidateCompatibilityEvaluationFingerprintSchema,
  eligibleFamilyIds: z
    .array(structuralStorefrontFamilyIdSchema)
    .min(1)
    .max(structuralStorefrontFamilyIds.length)
    .readonly(),
  excludedFamilyCandidateIdentityKeys: z
    .array(exactFamilyCandidateIdentityKeySchema)
    .max(24)
    .readonly(),
  excludedFamilyTopologyFingerprints: z
    .array(structuralStorefrontFamilyNormalizedTopologyFingerprintSchema)
    .max(24)
    .readonly(),
  excludedCompleteStoreTopologyFingerprints: z
    .array(structuralStorefrontSelectedCompleteTopologyFingerprintSchema)
    .max(MAX_STRUCTURAL_STOREFRONT_SELECTION_COMBINATION_EVALUATIONS)
    .readonly(),
} as const;

const requestMaterialSchema = z
  .object(requestMaterialShape)
  .strict()
  .superRefine((value, context) => {
    assertUnique(value.eligibleFamilyIds, context, ["eligibleFamilyIds"]);
    assertUnique(value.excludedFamilyCandidateIdentityKeys, context, [
      "excludedFamilyCandidateIdentityKeys",
    ]);
    assertUnique(value.excludedFamilyTopologyFingerprints, context, [
      "excludedFamilyTopologyFingerprints",
    ]);
    assertUnique(value.excludedCompleteStoreTopologyFingerprints, context, [
      "excludedCompleteStoreTopologyFingerprints",
    ]);
  });

type RequestMaterial = z.infer<typeof requestMaterialSchema>;

function canonicalRequestMaterial(value: RequestMaterial): RequestMaterial {
  return requestMaterialSchema.parse({
    ...value,
    eligibleFamilyIds: [...value.eligibleFamilyIds].sort(
      (left, right) => (familyOrder.get(left) ?? 0) - (familyOrder.get(right) ?? 0),
    ),
    excludedFamilyCandidateIdentityKeys: [...value.excludedFamilyCandidateIdentityKeys].sort(
      compareFamilyIdentities,
    ),
    excludedFamilyTopologyFingerprints: [...value.excludedFamilyTopologyFingerprints].sort(
      compareCodeUnits,
    ),
    excludedCompleteStoreTopologyFingerprints: [
      ...value.excludedCompleteStoreTopologyFingerprints,
    ].sort(compareCodeUnits),
  });
}

function createRequestFromMaterial(value: RequestMaterial) {
  const material = canonicalRequestMaterial(value);
  return deepFreeze({
    ...material,
    requestFingerprint: `structural-storefront-deterministic-selection-request-${canonicalValueFingerprint(material)}`,
  });
}

const suppliedRequestSchema = z
  .object({ ...requestMaterialShape, requestFingerprint: requestFingerprintSchema })
  .strict();

export type StructuralStorefrontDeterministicSelectionRequestV1 = Readonly<
  RequestMaterial & { requestFingerprint: z.infer<typeof requestFingerprintSchema> }
>;

export const structuralStorefrontDeterministicSelectionRequestV1Schema =
  suppliedRequestSchema.transform(
    (value, context): StructuralStorefrontDeterministicSelectionRequestV1 => {
      const { requestFingerprint: _requestFingerprint, ...suppliedMaterial } = value;
      const parsedMaterial = requestMaterialSchema.safeParse(suppliedMaterial);
      if (!parsedMaterial.success) {
        parsedMaterial.error.issues.forEach((entry) =>
          issue(
            context,
            entry.path.filter(
              (segment): segment is string | number =>
                typeof segment === "string" || typeof segment === "number",
            ),
            entry.message,
          ),
        );
        return z.NEVER;
      }
      const expected = createRequestFromMaterial(parsedMaterial.data);
      if (
        _requestFingerprint !== expected.requestFingerprint ||
        canonicalValueString(value) !== canonicalValueString(expected)
      ) {
        issue(context, [], "Selection request is stale or noncanonical.");
        return z.NEVER;
      }
      return expected;
    },
  );

function assertEvaluationFingerprint(expected: unknown, actual: string): void {
  const parsed =
    structuralStorefrontCandidateCompatibilityEvaluationFingerprintSchema.parse(expected);
  if (parsed !== actual) {
    throw new z.ZodError([
      {
        code: z.ZodIssueCode.custom,
        path: ["compatibilityEvaluationFingerprint"],
        message: "Selection request does not bind the expected compatibility evaluation.",
      },
    ]);
  }
}

export function createStructuralStorefrontDeterministicSelectionRequest(
  expectedCompatibilityEvaluationFingerprint: unknown,
  input: unknown,
): StructuralStorefrontDeterministicSelectionRequestV1 {
  const material = requestMaterialSchema.parse(input);
  assertEvaluationFingerprint(
    expectedCompatibilityEvaluationFingerprint,
    material.compatibilityEvaluationFingerprint,
  );
  return createRequestFromMaterial(material);
}

export function parseStructuralStorefrontDeterministicSelectionRequest(
  expectedCompatibilityEvaluationFingerprint: unknown,
  input: unknown,
): StructuralStorefrontDeterministicSelectionRequestV1 {
  const request = structuralStorefrontDeterministicSelectionRequestV1Schema.parse(input);
  assertEvaluationFingerprint(
    expectedCompatibilityEvaluationFingerprint,
    request.compatibilityEvaluationFingerprint,
  );
  return request;
}

const topologyRegionIdSchema = z.string().regex(/^r(?:0|[1-9][0-9]*)$/u);
const selectedPageFamilyTopologySchema = z
  .object({
    pageFamilyId: structuralStorefrontPageFamilyIdSchema,
    effectivePageBlueprintTopologyFingerprint: pageBlueprintV2NormalizedTopologyFingerprintSchema,
    omittedTopologyRegionIds: z.array(topologyRegionIdSchema).max(32).readonly(),
  })
  .strict()
  .superRefine((value, context) => {
    assertUnique(value.omittedTopologyRegionIds, context, ["omittedTopologyRegionIds"]);
  })
  .readonly();

const topologyMaterialShape = {
  topologySchemaVersion: z.literal(STRUCTURAL_STOREFRONT_SELECTED_COMPLETE_TOPOLOGY_SCHEMA_VERSION),
  pageFamilyTopologies: z
    .array(selectedPageFamilyTopologySchema)
    .length(structuralStorefrontPageFamilyIds.length)
    .readonly(),
  crossPageRelationships: z
    .array(structuralStorefrontCrossPageRelationshipV1Schema)
    .min(1)
    .readonly(),
} as const;
const topologyMaterialSchema = z
  .object(topologyMaterialShape)
  .strict()
  .superRefine((value, context) => {
    assertUnique(
      value.pageFamilyTopologies.map(({ pageFamilyId }) => pageFamilyId),
      context,
      ["pageFamilyTopologies"],
    );
  });
type TopologyMaterial = z.infer<typeof topologyMaterialSchema>;

function canonicalTopologyMaterial(value: TopologyMaterial): TopologyMaterial {
  return topologyMaterialSchema.parse({
    ...value,
    pageFamilyTopologies: [...value.pageFamilyTopologies]
      .sort(
        (left, right) =>
          (pageFamilyOrder.get(left.pageFamilyId) ?? 0) -
          (pageFamilyOrder.get(right.pageFamilyId) ?? 0),
      )
      .map((entry) => ({
        ...entry,
        omittedTopologyRegionIds: [...entry.omittedTopologyRegionIds].sort(
          (left, right) => Number(left.slice(1)) - Number(right.slice(1)),
        ),
      })),
    crossPageRelationships: canonicalizeStructuralStorefrontCrossPageRelationships(
      value.crossPageRelationships,
    ),
  });
}

export type StructuralStorefrontSelectedCompleteTopologyV1 = Readonly<
  TopologyMaterial & {
    topologyFingerprint: z.infer<
      typeof structuralStorefrontSelectedCompleteTopologyFingerprintSchema
    >;
  }
>;

export function createStructuralStorefrontSelectedCompleteTopology(
  input: unknown,
): StructuralStorefrontSelectedCompleteTopologyV1 {
  const material = canonicalTopologyMaterial(topologyMaterialSchema.parse(input));
  return deepFreeze({
    ...material,
    topologyFingerprint: `structural-storefront-selected-complete-topology-${canonicalValueFingerprint(material)}`,
  });
}

const suppliedTopologySchema = z
  .object({
    ...topologyMaterialShape,
    topologyFingerprint: structuralStorefrontSelectedCompleteTopologyFingerprintSchema,
  })
  .strict();

export const structuralStorefrontSelectedCompleteTopologyV1Schema =
  suppliedTopologySchema.transform(
    (value, context): StructuralStorefrontSelectedCompleteTopologyV1 => {
      const { topologyFingerprint: _topologyFingerprint, ...suppliedMaterial } = value;
      const expected = createStructuralStorefrontSelectedCompleteTopology(suppliedMaterial);
      if (
        _topologyFingerprint !== expected.topologyFingerprint ||
        canonicalValueString(value) !== canonicalValueString(expected)
      ) {
        issue(context, [], "Selected complete-store topology is stale or noncanonical.");
        return z.NEVER;
      }
      return expected;
    },
  );

export const structuralStorefrontSelectionResolutionModeSchema = z.enum([
  "direct",
  "substitution",
  "omission",
]);
const terminalCompatibilityStatusSchema = z.enum(["directly-compatible", "omission-compatible"]);
const selectablePageCompatibilityStatusSchema =
  pageBlueprintV2CandidateCompatibilityStatusSchema.exclude(["incompatible"]);

const selectedPageFamilyCandidateV1Schema = z
  .object({
    pageFamilyId: structuralStorefrontPageFamilyIdSchema,
    sourceCandidateIdentityKey: exactCandidateIdentityKeySchema,
    sourceExactCandidateFingerprint: pageCandidateFingerprintSchema,
    sourceNormalizedTopologyFingerprint: pageBlueprintV2NormalizedTopologyFingerprintSchema,
    sourceCompatibilityStatus: selectablePageCompatibilityStatusSchema,
    resolutionMode: structuralStorefrontSelectionResolutionModeSchema,
    substitutionPathCandidateIdentityKeys: z
      .array(exactCandidateIdentityKeySchema)
      .max(96)
      .readonly(),
    effectiveCandidateIdentityKey: exactCandidateIdentityKeySchema,
    effectiveExactCandidateFingerprint: pageCandidateFingerprintSchema,
    effectiveNormalizedTopologyFingerprint: pageBlueprintV2NormalizedTopologyFingerprintSchema,
    terminalCompatibilityStatus: terminalCompatibilityStatusSchema,
    omittedRegionIds: z.array(pageBlueprintV2RegionIdSchema).max(32).readonly(),
  })
  .strict()
  .superRefine((value, context) => {
    assertUnique(value.substitutionPathCandidateIdentityKeys, context, [
      "substitutionPathCandidateIdentityKeys",
    ]);
    assertUnique(value.omittedRegionIds, context, ["omittedRegionIds"]);
    const sameCandidate =
      value.sourceCandidateIdentityKey === value.effectiveCandidateIdentityKey &&
      value.sourceExactCandidateFingerprint === value.effectiveExactCandidateFingerprint &&
      value.sourceNormalizedTopologyFingerprint === value.effectiveNormalizedTopologyFingerprint;
    const path = value.substitutionPathCandidateIdentityKeys;
    const terminalOmission = value.terminalCompatibilityStatus === "omission-compatible";
    const valid =
      (value.resolutionMode === "direct" &&
        value.sourceCompatibilityStatus === "directly-compatible" &&
        path.length === 0 &&
        sameCandidate &&
        !terminalOmission &&
        value.omittedRegionIds.length === 0) ||
      (value.resolutionMode === "omission" &&
        value.sourceCompatibilityStatus === "omission-compatible" &&
        path.length === 0 &&
        sameCandidate &&
        terminalOmission &&
        value.omittedRegionIds.length > 0) ||
      (value.resolutionMode === "substitution" &&
        value.sourceCompatibilityStatus === "substitution-compatible" &&
        path.length > 0 &&
        path.at(-1) === value.effectiveCandidateIdentityKey &&
        (terminalOmission
          ? value.omittedRegionIds.length > 0
          : value.omittedRegionIds.length === 0));
    if (!valid) issue(context, [], "Selected page-family resolution fields contradict each other.");
  })
  .readonly();

export type StructuralStorefrontSelectedPageFamilyCandidateV1 = z.infer<
  typeof selectedPageFamilyCandidateV1Schema
>;
export const structuralStorefrontPageFamilyDecisionV1Schema = selectedPageFamilyCandidateV1Schema;

const selectedFamilyCandidateSchema = z
  .object({
    candidateIdentityKey: exactFamilyCandidateIdentityKeySchema,
    familyId: structuralStorefrontFamilyIdSchema,
    familyVersion: structuralStorefrontFamilyVersionSchema,
    exactCandidateFingerprint: familyCandidateFingerprintSchema,
    normalizedTopologyFingerprint: structuralStorefrontFamilyNormalizedTopologyFingerprintSchema,
    compatibilityStatus: structuralStorefrontFamilyCandidateCompatibilityStatusSchema.exclude([
      "incompatible",
    ]),
  })
  .strict()
  .superRefine((value, context) => {
    if (
      structuralStorefrontFamilyIdentityKey({
        familyId: value.familyId,
        familyVersion: value.familyVersion,
      }) !== value.candidateIdentityKey
    ) {
      issue(context, ["candidateIdentityKey"], "Selected family identity does not match.");
    }
  })
  .readonly();

const receiptMaterialShape = {
  receiptSchemaVersion: z.literal(
    STRUCTURAL_STOREFRONT_DETERMINISTIC_SELECTION_RECEIPT_SCHEMA_VERSION,
  ),
  selectionPolicyVersion: z.literal(STRUCTURAL_STOREFRONT_DETERMINISTIC_SELECTION_POLICY_VERSION),
  selectionRequestFingerprint: requestFingerprintSchema,
  compatibilityEvaluationFingerprint:
    structuralStorefrontCandidateCompatibilityEvaluationFingerprintSchema,
  selectedFamilyCandidate: selectedFamilyCandidateSchema,
  pageFamilySelections: z
    .array(selectedPageFamilyCandidateV1Schema)
    .length(structuralStorefrontPageFamilyIds.length)
    .readonly(),
  selectedCompleteStoreTopology: structuralStorefrontSelectedCompleteTopologyV1Schema,
} as const;
const receiptMaterialSchema = z
  .object(receiptMaterialShape)
  .strict()
  .superRefine((value, context) => {
    const topologyPageFamilies = value.selectedCompleteStoreTopology.pageFamilyTopologies.map(
      ({ pageFamilyId }) => pageFamilyId,
    );
    const selectedPageFamilies = value.pageFamilySelections.map(({ pageFamilyId }) => pageFamilyId);
    assertUnique(selectedPageFamilies, context, ["pageFamilySelections"]);
    assertUnique(topologyPageFamilies, context, [
      "selectedCompleteStoreTopology",
      "pageFamilyTopologies",
    ]);
    for (const selection of value.pageFamilySelections) {
      const topology = value.selectedCompleteStoreTopology.pageFamilyTopologies.find(
        ({ pageFamilyId }) => pageFamilyId === selection.pageFamilyId,
      );
      if (
        !topology ||
        topology.effectivePageBlueprintTopologyFingerprint !==
          selection.effectiveNormalizedTopologyFingerprint ||
        topology.omittedTopologyRegionIds.length !== selection.omittedRegionIds.length
      ) {
        issue(context, ["selectedCompleteStoreTopology"], "Selected topology contradicts pages.");
      }
    }
  });
type ReceiptMaterial = z.infer<typeof receiptMaterialSchema>;

function canonicalReceiptMaterial(value: ReceiptMaterial): ReceiptMaterial {
  return receiptMaterialSchema.parse({
    ...value,
    pageFamilySelections: [...value.pageFamilySelections].sort(
      (left, right) =>
        (pageFamilyOrder.get(left.pageFamilyId) ?? 0) -
        (pageFamilyOrder.get(right.pageFamilyId) ?? 0),
    ),
  });
}

export type StructuralStorefrontDeterministicSelectionReceiptV1 = Readonly<
  ReceiptMaterial & {
    selectionFingerprint: z.infer<
      typeof structuralStorefrontDeterministicSelectionFingerprintSchema
    >;
  }
>;

export function createStructuralStorefrontDeterministicSelectionReceipt(
  input: unknown,
): StructuralStorefrontDeterministicSelectionReceiptV1 {
  const material = canonicalReceiptMaterial(receiptMaterialSchema.parse(input));
  return deepFreeze({
    ...material,
    selectionFingerprint: `structural-storefront-deterministic-selection-${canonicalValueFingerprint(material)}`,
  });
}

const suppliedReceiptSchema = z
  .object({
    ...receiptMaterialShape,
    selectionFingerprint: structuralStorefrontDeterministicSelectionFingerprintSchema,
  })
  .strict();

export const structuralStorefrontDeterministicSelectionReceiptV1Schema =
  suppliedReceiptSchema.transform(
    (value, context): StructuralStorefrontDeterministicSelectionReceiptV1 => {
      const { selectionFingerprint: _selectionFingerprint, ...suppliedMaterial } = value;
      const expected = createStructuralStorefrontDeterministicSelectionReceipt(suppliedMaterial);
      if (
        _selectionFingerprint !== expected.selectionFingerprint ||
        canonicalValueString(value) !== canonicalValueString(expected)
      ) {
        issue(context, [], "Selection receipt is stale or noncanonical.");
        return z.NEVER;
      }
      return expected;
    },
  );

export const structuralStorefrontDeterministicSelectionErrorCodes = Object.freeze([
  "stale-selection-authority",
  "no-eligible-family-candidates",
  "no-compatible-family-candidates",
  "no-compatible-page-family-candidates",
  "invalid-substitution-resolution",
  "selection-combination-budget-exhausted",
  "insufficient-distinct-selection-capacity",
] as const);
export type StructuralStorefrontDeterministicSelectionErrorCode =
  (typeof structuralStorefrontDeterministicSelectionErrorCodes)[number];
export type StructuralStorefrontDeterministicSelectionErrorDetails = Readonly<{
  pageFamilyId?: StructuralStorefrontPageFamilyId;
  candidateIdentityKey?: string;
  evaluatedCombinationCount?: number;
}>;

const selectionErrorMessages: Readonly<
  Record<StructuralStorefrontDeterministicSelectionErrorCode, string>
> = {
  "stale-selection-authority": "Structural storefront selection authority is stale or invalid.",
  "no-eligible-family-candidates": "No family candidate belongs to the trusted eligible set.",
  "no-compatible-family-candidates": "Every eligible family candidate is incompatible.",
  "no-compatible-page-family-candidates":
    "A required page family has no compatible source candidate.",
  "invalid-substitution-resolution": "PageBlueprint substitution authority is contradictory.",
  "selection-combination-budget-exhausted":
    "The bounded complete-store selection evaluation budget is exhausted.",
  "insufficient-distinct-selection-capacity":
    "Every compatible complete-store topology is explicitly excluded.",
};

export class StructuralStorefrontDeterministicSelectionError extends Error {
  constructor(
    readonly code: StructuralStorefrontDeterministicSelectionErrorCode,
    readonly details: StructuralStorefrontDeterministicSelectionErrorDetails = {},
  ) {
    super(selectionErrorMessages[code]);
    this.name = "StructuralStorefrontDeterministicSelectionError";
    deepFreeze(details);
  }
}
