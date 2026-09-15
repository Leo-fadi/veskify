import { z } from "zod";
import {
  pageModelSchema,
  storefrontSnapshotObjectSchema,
  storefrontSnapshotSchema,
  refineStorefrontSnapshot,
} from "./storefront";
import { dynamicCommercePresentationAuthoritySchema } from "./dynamic-commerce-route";
import { compiledPageBlueprintCompositionV1Schema } from "./compiled-page-blueprint-composition";
import {
  dynamicCommercePresentationAuthorityV2Schema,
  refineComposedOwner,
} from "./dynamic-commerce-composition-version";

export const STOREFRONT_COMPOSITION_EXTENSION_VERSION = "1.0.0" as const;
export const composedPageModelV1Schema = pageModelSchema
  .safeExtend({ composition: compiledPageBlueprintCompositionV1Schema })
  .superRefine((owner, context) =>
    refineComposedOwner(
      owner,
      "static-page",
      owner.sections.map(({ id }) => id),
      context,
    ),
  );
export type ComposedPageModelV1 = z.output<typeof composedPageModelV1Schema>;

/** Structural parsing does not establish executable composition authority. */
export const composedStorefrontSnapshotV1Schema = storefrontSnapshotObjectSchema
  .extend({
    compositionExtensionVersion: z.literal(STOREFRONT_COMPOSITION_EXTENSION_VERSION),
    pages: z.array(z.union([pageModelSchema, composedPageModelV1Schema])).min(1),
    dynamicCommercePresentation: z
      .union([
        dynamicCommercePresentationAuthoritySchema,
        dynamicCommercePresentationAuthorityV2Schema,
      ])
      .optional(),
  })
  .superRefine(refineStorefrontSnapshot)
  .superRefine((snapshot, context) => {
    if (
      !snapshot.pages.some((page) => "composition" in page) &&
      snapshot.dynamicCommercePresentation?.contractVersion !== "2.0.0"
    )
      context.addIssue({ code: "custom", message: "Composed snapshot requires a composed owner." });
  });
export type ComposedStorefrontSnapshotV1 = z.output<typeof composedStorefrontSnapshotV1Schema>;

export function parseStorefrontSnapshotVersion(input: unknown) {
  return input !== null &&
    typeof input === "object" &&
    Object.hasOwn(input, "compositionExtensionVersion")
    ? composedStorefrontSnapshotV1Schema.parse(input)
    : storefrontSnapshotSchema.parse(input);
}
