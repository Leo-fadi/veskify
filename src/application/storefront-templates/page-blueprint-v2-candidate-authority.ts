import { z } from "zod";

import { canonicalValueFingerprint } from "@/domain/storefront/canonical-storefront";
import {
  canonicalizePageBlueprintV2StructuralContract,
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
import {
  canonicalizePageBlueprintV2OmissionSubstitutionFallbackContract,
  pageBlueprintV2SubstitutionCandidateReferenceSchema,
  type PageBlueprintV2OmissionSubstitutionFallbackContractV1,
  type PageBlueprintV2SubstitutionCandidateReference,
} from "./page-blueprint-v2-omission-substitution-fallback-contract";

export const PAGE_BLUEPRINT_V2_CANDIDATE_SCHEMA_VERSION = "1.0.0" as const;

export const pageBlueprintV2CandidateReferenceSchema =
  pageBlueprintV2SubstitutionCandidateReferenceSchema;

export type PageBlueprintV2CandidateReference = PageBlueprintV2SubstitutionCandidateReference;

export function createPageBlueprintV2CandidateReferenceIdentityKey(
  reference: PageBlueprintV2CandidateReference,
): string {
  const parsed = pageBlueprintV2CandidateReferenceSchema.parse(reference);
  return `${parsed.blueprintId}@${parsed.blueprintVersion}`;
}

type PageBlueprintV2CandidateCompositionV1 = Readonly<{
  candidateSchemaVersion: typeof PAGE_BLUEPRINT_V2_CANDIDATE_SCHEMA_VERSION;
  structural: PageBlueprintV2StructuralContract;
  assetRoleCompatibility: PageBlueprintV2AssetRoleCompatibilityContractV1;
  responsiveRules: PageBlueprintV2ResponsiveRuleContractV1;
  omissionSubstitutionFallback: PageBlueprintV2OmissionSubstitutionFallbackContractV1;
}>;

export type PageBlueprintV2CandidateAuthorityV1 = Readonly<
  PageBlueprintV2CandidateCompositionV1 & {
    candidateFingerprint: string;
  }
>;

const pageBlueprintV2CandidateCompositionInputSchema = z
  .object({
    candidateSchemaVersion: z.literal(PAGE_BLUEPRINT_V2_CANDIDATE_SCHEMA_VERSION),
    structural: z.unknown(),
    assetRoleCompatibility: z.unknown(),
    responsiveRules: z.unknown(),
    omissionSubstitutionFallback: z.unknown(),
  })
  .strict();

const pageBlueprintV2CandidateFingerprintSchema = z
  .string()
  .regex(/^page-blueprint-v2-candidate-v1_(?:0|[1-9][0-9]*)_[a-f0-9]{64}$/);

const pageBlueprintV2CandidateAuthorityInputSchema = pageBlueprintV2CandidateCompositionInputSchema
  .extend({ candidateFingerprint: pageBlueprintV2CandidateFingerprintSchema })
  .strict();

type ParsedPageBlueprintV2CandidateCompositionInput = z.infer<
  typeof pageBlueprintV2CandidateCompositionInputSchema
>;

function deepFreeze<T>(value: T, seen = new WeakSet<object>()): T {
  if (!value || typeof value !== "object") return value;
  const objectValue = value as object;
  if (seen.has(objectValue)) return value;
  seen.add(objectValue);
  Object.values(value as Record<string, unknown>).forEach((entry) => deepFreeze(entry, seen));
  Object.freeze(objectValue);
  return value;
}

function canonicalizeCandidateComposition(
  input: ParsedPageBlueprintV2CandidateCompositionInput,
): PageBlueprintV2CandidateCompositionV1 {
  const structural = canonicalizePageBlueprintV2StructuralContract(input.structural);
  const assetRoleCompatibility = canonicalizePageBlueprintV2AssetRoleCompatibilityContract(
    structural,
    input.assetRoleCompatibility,
  );
  const responsiveRules = canonicalizePageBlueprintV2ResponsiveRuleContract(
    structural,
    input.responsiveRules,
  );
  const omissionSubstitutionFallback =
    canonicalizePageBlueprintV2OmissionSubstitutionFallbackContract(
      structural,
      assetRoleCompatibility,
      responsiveRules,
      input.omissionSubstitutionFallback,
    );

  return {
    candidateSchemaVersion: input.candidateSchemaVersion,
    structural,
    assetRoleCompatibility,
    responsiveRules,
    omissionSubstitutionFallback,
  };
}

function createCandidateFingerprint(material: PageBlueprintV2CandidateCompositionV1): string {
  return `page-blueprint-v2-candidate-${canonicalValueFingerprint(material)}`;
}

function createCanonicalCandidateAuthority(
  material: PageBlueprintV2CandidateCompositionV1,
): PageBlueprintV2CandidateAuthorityV1 {
  return deepFreeze({
    ...material,
    candidateFingerprint: createCandidateFingerprint(material),
  });
}

function addCanonicalizationIssues(context: z.RefinementCtx, error: unknown): void {
  if (error instanceof z.ZodError) {
    error.issues.forEach((issue) => {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: issue.path,
        message: issue.message,
      });
    });
    return;
  }

  context.addIssue({
    code: z.ZodIssueCode.custom,
    message:
      error instanceof Error
        ? error.message
        : "PageBlueprint v2 candidate canonicalization failed.",
  });
}

export const pageBlueprintV2CandidateAuthorityV1Schema =
  pageBlueprintV2CandidateAuthorityInputSchema.transform((input, context) => {
    let material: PageBlueprintV2CandidateCompositionV1;
    try {
      material = canonicalizeCandidateComposition(input);
    } catch (error) {
      addCanonicalizationIssues(context, error);
      return z.NEVER;
    }

    const expectedFingerprint = createCandidateFingerprint(material);
    if (input.candidateFingerprint !== expectedFingerprint) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["candidateFingerprint"],
        message: "PageBlueprint v2 candidate fingerprint does not match canonical content.",
      });
      return z.NEVER;
    }

    return deepFreeze({
      ...material,
      candidateFingerprint: input.candidateFingerprint,
    });
  });

export function createPageBlueprintV2CandidateAuthority(
  input: unknown,
): PageBlueprintV2CandidateAuthorityV1 {
  const parsed = pageBlueprintV2CandidateCompositionInputSchema.parse(input);
  return createCanonicalCandidateAuthority(canonicalizeCandidateComposition(parsed));
}

export function parsePageBlueprintV2CandidateAuthority(
  input: unknown,
): PageBlueprintV2CandidateAuthorityV1 {
  return pageBlueprintV2CandidateAuthorityV1Schema.parse(input);
}

export function createPageBlueprintV2CandidateAuthorityIdentityKey(
  authority: Pick<PageBlueprintV2CandidateAuthorityV1, "structural">,
): string {
  return createPageBlueprintV2CandidateReferenceIdentityKey({
    blueprintId: authority.structural.id,
    blueprintVersion: authority.structural.version,
  });
}
