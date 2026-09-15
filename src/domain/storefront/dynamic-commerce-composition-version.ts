import { z } from "zod";
import { canonicalValueFingerprint } from "./canonical-storefront";
import {
  authorityMaterialShape,
  dynamicCommerceCollectionSearchArchetypeSchema,
  dynamicCommerceProductDetailArchetypeSchema,
  dynamicCommercePresentationAuthoritySchema,
  normalizeAuthorityMaterial,
  refineAuthorityMaterial,
} from "./dynamic-commerce-route";
import {
  compiledPageBlueprintCompositionV1Schema,
  type CompiledPageBlueprintCompositionV1,
} from "./compiled-page-blueprint-composition";

export const DYNAMIC_COMMERCE_COMPOSITION_VERSION = "2.0.0" as const;
export const compareCompositionStorageIds = (a: string, b: string): number =>
  a < b ? -1 : a > b ? 1 : 0;

/** Structural ownership/storage checks; executable support remains application authority. */
export function refineComposedOwner(
  owner: { id: string; composition: CompiledPageBlueprintCompositionV1 },
  kind: CompiledPageBlueprintCompositionV1["owner"]["kind"],
  storageIds: readonly string[],
  context: z.RefinementCtx,
): void {
  if (owner.composition.owner.kind !== kind || owner.composition.owner.id !== owner.id)
    context.addIssue({
      code: "custom",
      path: ["composition", "owner"],
      message: "Composition must belong to its containing owner.",
    });
  if (
    storageIds.some(
      (id, index) => index > 0 && compareCompositionStorageIds(storageIds[index - 1], id) >= 0,
    )
  )
    context.addIssue({
      code: "custom",
      message: "Composed storage must use unique code-unit ID order.",
    });
}

export const composedCollectionSearchArchetypeV2Schema =
  dynamicCommerceCollectionSearchArchetypeSchema
    .safeExtend({ composition: compiledPageBlueprintCompositionV1Schema })
    .superRefine((owner, context) =>
      refineComposedOwner(
        owner,
        "collection-search-archetype",
        owner.componentPresentations.map(({ slotId }) => slotId),
        context,
      ),
    );
export const composedProductDetailArchetypeV2Schema = dynamicCommerceProductDetailArchetypeSchema
  .safeExtend({ composition: compiledPageBlueprintCompositionV1Schema })
  .superRefine((owner, context) =>
    refineComposedOwner(
      owner,
      "product-detail-archetype",
      owner.componentPresentations.map(({ slotId }) => slotId),
      context,
    ),
  );

const materialObject = z
  .object({
    ...authorityMaterialShape,
    contractVersion: z.literal(DYNAMIC_COMMERCE_COMPOSITION_VERSION),
    collectionSearchArchetypes: z
      .array(
        z.union([
          dynamicCommerceCollectionSearchArchetypeSchema,
          composedCollectionSearchArchetypeV2Schema,
        ]),
      )
      .min(1),
    productDetailArchetypes: z
      .array(
        z.union([
          dynamicCommerceProductDetailArchetypeSchema,
          composedProductDetailArchetypeV2Schema,
        ]),
      )
      .min(1),
  })
  .strict();

export const dynamicCommercePresentationAuthorityV2MaterialSchema = materialObject
  .superRefine(refineAuthorityMaterial)
  .superRefine((authority, context) => {
    if (
      ![...authority.collectionSearchArchetypes, ...authority.productDetailArchetypes].some(
        (owner) => "composition" in owner,
      )
    )
      context.addIssue({
        code: "custom",
        message: "Dynamic commerce v2 requires a composed archetype.",
      });
  })
  .transform(normalizeAuthorityMaterial);

const fingerprint = (
  material: z.output<typeof dynamicCommercePresentationAuthorityV2MaterialSchema>,
) => `dynamic-commerce-presentation-v2-${canonicalValueFingerprint(material)}`;

export const dynamicCommercePresentationAuthorityV2Schema = materialObject
  .extend({ authorityFingerprint: z.string().min(1).max(240) })
  .superRefine((authority, context) => {
    const { authorityFingerprint, ...material } = authority;
    const parsed = dynamicCommercePresentationAuthorityV2MaterialSchema.safeParse(material);
    if (!parsed.success) {
      parsed.error.issues.forEach((issue) =>
        context.addIssue({ code: "custom", path: issue.path, message: issue.message }),
      );
    } else if (authorityFingerprint !== fingerprint(parsed.data)) {
      context.addIssue({
        code: "custom",
        path: ["authorityFingerprint"],
        message: "Dynamic commerce v2 fingerprint is stale.",
      });
    }
  })
  .transform(({ authorityFingerprint, ...material }) => ({
    ...dynamicCommercePresentationAuthorityV2MaterialSchema.parse(material),
    authorityFingerprint,
  }));

export type DynamicCommercePresentationAuthorityV2 = z.output<
  typeof dynamicCommercePresentationAuthorityV2Schema
>;

/** Explicit construction may canonicalize cloned composed storage; reads never do. */
export function createDynamicCommercePresentationAuthorityV2(
  input: z.input<typeof dynamicCommercePresentationAuthorityV2MaterialSchema>,
): DynamicCommercePresentationAuthorityV2 {
  const copy = structuredClone(input);
  for (const owner of [...copy.collectionSearchArchetypes, ...copy.productDetailArchetypes])
    if ("composition" in owner)
      owner.componentPresentations.sort((a, b) => compareCompositionStorageIds(a.slotId, b.slotId));
  const material = dynamicCommercePresentationAuthorityV2MaterialSchema.parse(copy);
  return dynamicCommercePresentationAuthorityV2Schema.parse({
    ...material,
    authorityFingerprint: fingerprint(material),
  });
}

export function parseDynamicCommercePresentationVersion(input: unknown) {
  if (!input || typeof input !== "object" || !("contractVersion" in input))
    throw new Error("Dynamic commerce contract version is required.");
  if (input.contractVersion === "1.0.0")
    return dynamicCommercePresentationAuthoritySchema.parse(input);
  if (input.contractVersion === DYNAMIC_COMMERCE_COMPOSITION_VERSION)
    return dynamicCommercePresentationAuthorityV2Schema.parse(input);
  throw new Error("Unsupported dynamic commerce contract version.");
}
