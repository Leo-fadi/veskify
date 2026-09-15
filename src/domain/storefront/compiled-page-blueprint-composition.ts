import { z } from "zod";

import { idSchema } from "@/domain/shared/schemas";

import { canonicalValueFingerprint } from "./canonical-storefront";

export const COMPILED_PAGE_BLUEPRINT_COMPOSITION_VERSION = "1.0.0" as const;
const boundedId = z
  .string()
  .min(1)
  .max(160)
  .regex(/^[A-Za-z0-9][A-Za-z0-9_-]*$/u);
const blueprintId = z
  .string()
  .max(80)
  .regex(/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/u);
const fingerprint = z
  .string()
  .min(1)
  .max(256)
  .regex(/^[a-z0-9][a-z0-9_-]*$/u);
const relationshipKey = z
  .string()
  .min(1)
  .max(320)
  .regex(/^[a-z0-9][a-z0-9_>:-]*$/u);
const breakpoint = z.enum(["mobile", "tablet", "desktop", "wide"]);
const viewport = z.union([z.literal(375), z.literal(768), z.literal(1024), z.literal(1440)]);
const unit = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("section"), sectionId: idSchema }).strict(),
  z
    .object({
      kind: z.literal("presentation"),
      slotId: z
        .string()
        .max(160)
        .regex(/^[a-z][A-Za-z0-9]*(?:[._-][a-z][A-Za-z0-9]*)*$/u),
    })
    .strict(),
  z
    .object({
      kind: z.literal("anatomy"),
      parent: z.discriminatedUnion("kind", [
        z.object({ kind: z.literal("section"), sectionId: idSchema }).strict(),
        z
          .object({
            kind: z.literal("presentation"),
            slotId: z
              .string()
              .max(160)
              .regex(/^[a-z][A-Za-z0-9]*(?:[._-][a-z][A-Za-z0-9]*)*$/u),
          })
          .strict(),
      ]),
      anatomySlotId: boundedId,
    })
    .strict(),
]);

const materialSchema = z
  .object({
    compositionVersion: z.literal(COMPILED_PAGE_BLUEPRINT_COMPOSITION_VERSION),
    owner: z
      .object({
        kind: z.enum(["static-page", "collection-search-archetype", "product-detail-archetype"]),
        id: idSchema,
      })
      .strict(),
    blueprint: z
      .object({
        contractVersion: z.literal("2.0.0"),
        blueprintId,
        blueprintVersion: z
          .string()
          .max(64)
          .regex(/^1\.(?:0|[1-9][0-9]*)\.(?:0|[1-9][0-9]*)$/u),
        candidateFingerprint: fingerprint,
      })
      .strict(),
    support: z
      .object({
        id: boundedId,
        version: z
          .string()
          .max(64)
          .regex(/^(?:0|[1-9][0-9]*)\.(?:0|[1-9][0-9]*)\.(?:0|[1-9][0-9]*)$/u),
        implementationFingerprint: fingerprint,
      })
      .strict(),
    bindingFingerprint: fingerprint,
    orderAlternativeId: boundedId,
    regionAssignments: z
      .array(
        z
          .object({
            regionId: boundedId,
            realizationId: boundedId,
            units: z.array(unit).max(32),
          })
          .strict(),
      )
      .max(32),
    relationshipRealizations: z
      .array(z.object({ relationshipKey, realizationId: boundedId }).strict())
      .max(192),
    breakpoints: z
      .array(
        z
          .object({
            breakpoint,
            viewport,
            orderAlternativeId: boundedId,
            ruleFingerprint: fingerprint,
            relationshipRealizations: z
              .array(z.object({ relationshipKey, realizationId: boundedId }).strict())
              .max(192),
          })
          .strict(),
      )
      .length(4),
    omissions: z
      .array(z.object({ regionId: boundedId, evidenceFingerprint: fingerprint }).strict())
      .max(32),
  })
  .strict();

export type CompiledPageBlueprintCompositionMaterialV1 = z.infer<typeof materialSchema>;
export type CompositionReadonly<T> = T extends object
  ? { readonly [K in keyof T]: CompositionReadonly<T[K]> }
  : T;
export type CompiledPageBlueprintCompositionV1 = CompositionReadonly<
  CompiledPageBlueprintCompositionMaterialV1 & { compositionFingerprint: string }
>;

const compare = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);
function canonicalMaterial(
  material: CompiledPageBlueprintCompositionMaterialV1,
): CompiledPageBlueprintCompositionMaterialV1 {
  const relationships = (
    entries: CompiledPageBlueprintCompositionMaterialV1["relationshipRealizations"],
  ) => [...entries].sort((a, b) => compare(a.relationshipKey, b.relationshipKey));
  return {
    ...material,
    regionAssignments: [...material.regionAssignments].sort((a, b) =>
      compare(a.regionId, b.regionId),
    ),
    relationshipRealizations: relationships(material.relationshipRealizations),
    omissions: [...material.omissions].sort((a, b) => compare(a.regionId, b.regionId)),
    breakpoints: [...material.breakpoints]
      .sort((a, b) => a.viewport - b.viewport)
      .map((entry) => ({
        ...entry,
        relationshipRealizations: relationships(entry.relationshipRealizations),
      })),
  };
}

function freeze<T>(value: T, seen = new WeakSet<object>()): T {
  if (!value || typeof value !== "object" || seen.has(value)) return value;
  seen.add(value);
  Object.values(value as Record<string, unknown>).forEach((entry) => freeze(entry, seen));
  return Object.freeze(value);
}
export function compiledPageBlueprintCompositionFingerprint(
  material: CompiledPageBlueprintCompositionMaterialV1,
): string {
  return `compiled-page-blueprint-composition-${canonicalValueFingerprint(canonicalMaterial(material))}`;
}
export const compiledPageBlueprintCompositionV1Schema = materialSchema
  .extend({ compositionFingerprint: fingerprint })
  .strict()
  .superRefine((value, context) => {
    const unique = (keys: readonly string[], path: (string | number)[]) => {
      if (new Set(keys).size !== keys.length)
        context.addIssue({ code: "custom", path, message: "Duplicate composition reference." });
    };
    unique(
      value.regionAssignments.map((entry) => entry.regionId),
      ["regionAssignments"],
    );
    unique(
      value.omissions.map((entry) => entry.regionId),
      ["omissions"],
    );
    unique(
      value.relationshipRealizations.map((entry) => entry.relationshipKey),
      ["relationshipRealizations"],
    );
    unique(
      value.breakpoints.map((entry) => entry.breakpoint),
      ["breakpoints"],
    );
    value.breakpoints.forEach((entry, index) => {
      unique(
        entry.relationshipRealizations.map((relation) => relation.relationshipKey),
        ["breakpoints", index, "relationshipRealizations"],
      );
      const widths = { mobile: 375, tablet: 768, desktop: 1024, wide: 1440 };
      if (widths[entry.breakpoint] !== entry.viewport)
        context.addIssue({
          code: "custom",
          path: ["breakpoints", index, "viewport"],
          message: "Invalid breakpoint/viewport pair.",
        });
    });
    const { compositionFingerprint, ...material } = value;
    if (compositionFingerprint !== compiledPageBlueprintCompositionFingerprint(material))
      context.addIssue({
        code: "custom",
        path: ["compositionFingerprint"],
        message: "Compiled composition fingerprint does not match canonical material.",
      });
  })
  .transform(({ compositionFingerprint, ...material }) =>
    freeze({ ...canonicalMaterial(material), compositionFingerprint }),
  );
export function parseCompiledPageBlueprintCompositionV1(
  input: unknown,
): CompiledPageBlueprintCompositionV1 {
  return compiledPageBlueprintCompositionV1Schema.parse(input);
}
export function createCompiledPageBlueprintCompositionV1(
  material: unknown,
): CompiledPageBlueprintCompositionV1 {
  const parsed = canonicalMaterial(materialSchema.parse(material));
  return compiledPageBlueprintCompositionV1Schema.parse({
    ...parsed,
    compositionFingerprint: compiledPageBlueprintCompositionFingerprint(parsed),
  });
}
