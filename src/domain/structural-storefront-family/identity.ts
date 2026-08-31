import { z } from "zod";

export const STRUCTURAL_STOREFRONT_FAMILY_CONTRACT_SCHEMA_VERSION = "1.0.0" as const;
export const STRUCTURAL_STOREFRONT_FAMILY_INITIAL_RECORD_VERSION = "1.0.0" as const;
export const STRUCTURAL_STOREFRONT_FAMILY_SUPPORTED_MAJOR_VERSION = 1 as const;

export const structuralStorefrontFamilyIds = Object.freeze([
  "editorial-offset",
  "campaign-modular",
  "product-first-commerce",
  "technical-comparison",
  "warm-narrative",
  "restrained-gallery",
] as const);

export const structuralStorefrontFamilyIdSchema = z.enum(structuralStorefrontFamilyIds);
export type StructuralStorefrontFamilyId = z.infer<typeof structuralStorefrontFamilyIdSchema>;

const structuralStorefrontFamilyIdSet = new Set<string>(structuralStorefrontFamilyIds);

export function isStructuralStorefrontFamilyId(
  value: unknown,
): value is StructuralStorefrontFamilyId {
  return typeof value === "string" && structuralStorefrontFamilyIdSet.has(value);
}

const canonicalSupportedFamilyVersionPattern = /^1\.(?:0|[1-9][0-9]*)\.(?:0|[1-9][0-9]*)$/;

export const structuralStorefrontFamilyVersionSchema = z
  .string()
  .max(64)
  .regex(
    canonicalSupportedFamilyVersionPattern,
    "Use a canonical major.minor.patch Structural Storefront Family version with supported major 1.",
  );
export type StructuralStorefrontFamilyVersion = z.infer<
  typeof structuralStorefrontFamilyVersionSchema
>;

export const structuralStorefrontFamilyIdentityV1Schema = z
  .object({
    familyId: structuralStorefrontFamilyIdSchema,
    familyVersion: structuralStorefrontFamilyVersionSchema,
  })
  .strict()
  .readonly();
export type StructuralStorefrontFamilyIdentityV1 = z.infer<
  typeof structuralStorefrontFamilyIdentityV1Schema
>;

export type StructuralStorefrontFamilyIdentityKey =
  `${StructuralStorefrontFamilyId}@${StructuralStorefrontFamilyVersion}`;

export function structuralStorefrontFamilyIdentityKey(
  input: unknown,
): StructuralStorefrontFamilyIdentityKey {
  const identity = structuralStorefrontFamilyIdentityV1Schema.parse(input);
  return `${identity.familyId}@${identity.familyVersion}`;
}

export class DuplicateStructuralStorefrontFamilyIdentityError extends Error {
  readonly code = "duplicate-structural-storefront-family-identity" as const;

  constructor(
    readonly duplicateIdentityKeys: readonly StructuralStorefrontFamilyIdentityKey[],
    readonly duplicateIdentityCount: number,
  ) {
    const omittedCount = duplicateIdentityCount - duplicateIdentityKeys.length;
    super(
      `Duplicate Structural Storefront Family identities: ${duplicateIdentityKeys.join(", ")}${
        omittedCount > 0 ? ` (+${omittedCount} more)` : ""
      }.`,
    );
    this.name = "DuplicateStructuralStorefrontFamilyIdentityError";
  }
}

export function assertUniqueStructuralStorefrontFamilyIdentities(
  inputs: readonly unknown[],
): readonly StructuralStorefrontFamilyIdentityV1[] {
  const identities = inputs.map((input) => structuralStorefrontFamilyIdentityV1Schema.parse(input));
  const counts = new Map<StructuralStorefrontFamilyIdentityKey, number>();

  for (const identity of identities) {
    const key = structuralStorefrontFamilyIdentityKey(identity);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  const duplicateKeys = [...counts.entries()]
    .filter(([, count]) => count > 1)
    .map(([key]) => key)
    .sort();

  if (duplicateKeys.length > 0) {
    throw new DuplicateStructuralStorefrontFamilyIdentityError(
      Object.freeze(duplicateKeys.slice(0, 8)),
      duplicateKeys.length,
    );
  }

  return Object.freeze(identities);
}
