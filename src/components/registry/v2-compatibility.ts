import { z } from "zod";
import type { PageType } from "@/domain/storefront";
import {
  type ComponentDefinitionV2,
  type EditablePresentationField,
  validateComponentDefinitionV2,
} from "@/domain/component-platform";

type V1EditorFieldMetadata = {
  source: "content" | "props";
  control: "text" | "textarea" | "select";
  label: string;
  localized?: boolean;
};

export type InspectableComponentDefinitionV1 = {
  type: string;
  label: string;
  allowedPageTypes: readonly PageType[];
  variants: readonly string[];
  defaultVariant: string;
  contentSchema: z.ZodType;
  propsSchema: z.ZodType;
  editorFields: Readonly<Record<string, V1EditorFieldMetadata>>;
  protectedFields: { readOnlyPaths: readonly string[] };
};

function localizedEnglish(value: string) {
  return { en: value };
}

function serializableObjectContract(schema: z.ZodType) {
  return z.toJSONSchema(schema);
}

function editableFieldFromV1(
  path: string,
  field: V1EditorFieldMetadata,
): EditablePresentationField {
  return {
    path,
    label: localizedEnglish(field.label),
    source: field.source,
    control:
      field.control === "textarea" ? "textarea" : field.control === "select" ? "select" : "text",
    localized: field.localized ?? false,
  };
}

export function adaptV1ComponentDefinitionToV2(
  definition: InspectableComponentDefinitionV1,
): ComponentDefinitionV2 {
  return validateComponentDefinitionV2({
    type: definition.type,
    version: { major: 1, minor: 0, patch: 0 },
    title: localizedEnglish(definition.label),
    merchantDescription: localizedEnglish(`${definition.label} storefront section.`),
    family: "content",
    supportedPageTypes: [...definition.allowedPageTypes],
    variants: definition.variants.map((variant) => ({
      id: variant,
      title: localizedEnglish(variant),
    })),
    defaultVariant: definition.defaultVariant,
    industryTags: [],
    contentSchema: serializableObjectContract(definition.contentSchema),
    propsSchema: serializableObjectContract(definition.propsSchema),
    styleOverridesSchema: {
      type: "object",
      properties: {},
      required: [],
      additionalProperties: false,
    },
    contentSlots: [],
    commerceBindingSlots: [],
    assetSlots: [],
    editablePresentationFields: Object.entries(definition.editorFields).map(([path, field]) =>
      editableFieldFromV1(path, field),
    ),
    protectedFields: { readOnlyPaths: [...definition.protectedFields.readOnlyPaths] },
    responsiveRules: [
      {
        breakpoints: ["mobile", "tablet", "desktop", "wide"],
        allowHorizontalOverflow: false,
        notes: localizedEnglish("Existing V1 registry definition inspected through compatibility."),
      },
    ],
    accessibilityRequirements: {
      keyboard: "Retain the existing registered renderer keyboard behaviour.",
      semantics: "Retain the existing registered renderer semantic structure.",
      labels: "Retain the existing registered renderer labels and alt text rules.",
      focus: "Retain the existing registered renderer focus behaviour.",
    },
    migration: {
      policy: "compatible",
      previousVersions: [],
      migrations: [],
    },
    renderer: {
      adapterId: "veskifyV1Registry",
      exportName: definition.type,
      supportedTargets: ["editor", "preview", "published"],
    },
  });
}

export function adaptV1ComponentRegistryToV2(
  registry: Readonly<Record<string, InspectableComponentDefinitionV1>>,
): ComponentDefinitionV2[] {
  return Object.values(registry).map((definition) => adaptV1ComponentDefinitionToV2(definition));
}
