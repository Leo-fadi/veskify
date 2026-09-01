import { z } from "zod";

export const STRUCTURAL_STOREFRONT_CROSS_PAGE_RELATIONSHIP_CONTRACT_SCHEMA_VERSION =
  "1.0.0" as const;

export const structuralStorefrontPageFamilyIds = Object.freeze([
  "home",
  "collection",
  "search",
  "product-detail",
  "content-support",
  "utility",
] as const);

export const structuralStorefrontPageFamilyIdSchema = z.enum(structuralStorefrontPageFamilyIds);

export type StructuralStorefrontPageFamilyId = z.infer<
  typeof structuralStorefrontPageFamilyIdSchema
>;

const structuralStorefrontPageFamilyIdSet = new Set<string>(structuralStorefrontPageFamilyIds);

export function isStructuralStorefrontPageFamilyId(
  value: unknown,
): value is StructuralStorefrontPageFamilyId {
  return typeof value === "string" && structuralStorefrontPageFamilyIdSet.has(value);
}

export const structuralStorefrontCrossPageRelationshipKinds = Object.freeze([
  "frame-continuity",
  "navigation-continuity",
  "hierarchy-continuity",
  "recurring-anchor",
  "merchandising-continuity",
  "commerce-transition",
  "state-anatomy-boundary",
] as const);

export const structuralStorefrontCrossPageRelationshipKindSchema = z.enum(
  structuralStorefrontCrossPageRelationshipKinds,
);

export type StructuralStorefrontCrossPageRelationshipKind = z.infer<
  typeof structuralStorefrontCrossPageRelationshipKindSchema
>;

const structuralStorefrontCrossPageRelationshipKindSet = new Set<string>(
  structuralStorefrontCrossPageRelationshipKinds,
);

export function isStructuralStorefrontCrossPageRelationshipKind(
  value: unknown,
): value is StructuralStorefrontCrossPageRelationshipKind {
  return typeof value === "string" && structuralStorefrontCrossPageRelationshipKindSet.has(value);
}

export const structuralStorefrontCrossPageRelationshipV1Schema = z
  .object({
    sourcePageFamilyId: structuralStorefrontPageFamilyIdSchema,
    relationshipKind: structuralStorefrontCrossPageRelationshipKindSchema,
    targetPageFamilyId: structuralStorefrontPageFamilyIdSchema,
  })
  .strict()
  .superRefine((relationship, context) => {
    if (relationship.sourcePageFamilyId === relationship.targetPageFamilyId) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Cross-page relationships must connect distinct page families.",
        path: ["targetPageFamilyId"],
      });
    }
  })
  .readonly();

export type StructuralStorefrontCrossPageRelationshipV1 = z.infer<
  typeof structuralStorefrontCrossPageRelationshipV1Schema
>;

export type StructuralStorefrontCrossPageRelationshipKey =
  `${StructuralStorefrontPageFamilyId}->${StructuralStorefrontCrossPageRelationshipKind}->${StructuralStorefrontPageFamilyId}`;

export function createStructuralStorefrontCrossPageRelationshipKey(
  relationship: StructuralStorefrontCrossPageRelationshipV1,
): StructuralStorefrontCrossPageRelationshipKey {
  return `${relationship.sourcePageFamilyId}->${relationship.relationshipKind}->${relationship.targetPageFamilyId}`;
}

const structuralStorefrontPageFamilyOrder: Readonly<
  Record<StructuralStorefrontPageFamilyId, number>
> = Object.freeze({
  home: 0,
  collection: 1,
  search: 2,
  "product-detail": 3,
  "content-support": 4,
  utility: 5,
});

const structuralStorefrontCrossPageRelationshipKindOrder: Readonly<
  Record<StructuralStorefrontCrossPageRelationshipKind, number>
> = Object.freeze({
  "frame-continuity": 0,
  "navigation-continuity": 1,
  "hierarchy-continuity": 2,
  "recurring-anchor": 3,
  "merchandising-continuity": 4,
  "commerce-transition": 5,
  "state-anatomy-boundary": 6,
});

function compareStructuralStorefrontCrossPageRelationships(
  left: StructuralStorefrontCrossPageRelationshipV1,
  right: StructuralStorefrontCrossPageRelationshipV1,
): number {
  const sourceDifference =
    structuralStorefrontPageFamilyOrder[left.sourcePageFamilyId] -
    structuralStorefrontPageFamilyOrder[right.sourcePageFamilyId];
  if (sourceDifference !== 0) {
    return sourceDifference;
  }

  const kindDifference =
    structuralStorefrontCrossPageRelationshipKindOrder[left.relationshipKind] -
    structuralStorefrontCrossPageRelationshipKindOrder[right.relationshipKind];
  if (kindDifference !== 0) {
    return kindDifference;
  }

  return (
    structuralStorefrontPageFamilyOrder[left.targetPageFamilyId] -
    structuralStorefrontPageFamilyOrder[right.targetPageFamilyId]
  );
}

export const MAX_DUPLICATE_CROSS_PAGE_RELATIONSHIP_EVIDENCE = 8;

export class DuplicateStructuralStorefrontCrossPageRelationshipError extends Error {
  readonly duplicateKeys: readonly StructuralStorefrontCrossPageRelationshipKey[];
  readonly duplicateKeyCount: number;
  readonly duplicateOccurrenceCount: number;

  constructor(input: {
    duplicateKeys: readonly StructuralStorefrontCrossPageRelationshipKey[];
    duplicateKeyCount: number;
    duplicateOccurrenceCount: number;
  }) {
    const omittedCount = input.duplicateKeyCount - input.duplicateKeys.length;
    super(
      `Duplicate cross-page relationship keys: ${input.duplicateKeys.join(", ")}${
        omittedCount > 0 ? ` (+${omittedCount} more)` : ""
      }.`,
    );
    this.name = "DuplicateStructuralStorefrontCrossPageRelationshipError";
    this.duplicateKeys = Object.freeze([...input.duplicateKeys]);
    this.duplicateKeyCount = input.duplicateKeyCount;
    this.duplicateOccurrenceCount = input.duplicateOccurrenceCount;
  }
}

export function canonicalizeStructuralStorefrontCrossPageRelationships(
  input: readonly unknown[],
): readonly StructuralStorefrontCrossPageRelationshipV1[] {
  const parsedRelationships = input.map((relationship) =>
    structuralStorefrontCrossPageRelationshipV1Schema.parse(relationship),
  );
  const relationshipCounts = new Map<
    StructuralStorefrontCrossPageRelationshipKey,
    {
      readonly relationship: StructuralStorefrontCrossPageRelationshipV1;
      count: number;
    }
  >();

  for (const relationship of parsedRelationships) {
    const key = createStructuralStorefrontCrossPageRelationshipKey(relationship);
    const existing = relationshipCounts.get(key);
    if (existing === undefined) {
      relationshipCounts.set(key, { relationship, count: 1 });
    } else {
      existing.count += 1;
    }
  }

  const duplicates = [...relationshipCounts.entries()]
    .filter(([, evidence]) => evidence.count > 1)
    .sort((left, right) =>
      compareStructuralStorefrontCrossPageRelationships(
        left[1].relationship,
        right[1].relationship,
      ),
    );

  if (duplicates.length > 0) {
    throw new DuplicateStructuralStorefrontCrossPageRelationshipError({
      duplicateKeys: duplicates
        .slice(0, MAX_DUPLICATE_CROSS_PAGE_RELATIONSHIP_EVIDENCE)
        .map(([key]) => key),
      duplicateKeyCount: duplicates.length,
      duplicateOccurrenceCount: duplicates.reduce(
        (count, [, evidence]) => count + evidence.count - 1,
        0,
      ),
    });
  }

  return Object.freeze(
    [...parsedRelationships].sort(compareStructuralStorefrontCrossPageRelationships),
  );
}
