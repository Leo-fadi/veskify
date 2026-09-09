import { renderToStaticMarkup } from "react-dom/server";
import { z } from "zod";
import type { ComponentDefinition, StorefrontRenderContext } from "@/components/registry/contract";

export type ObservedLegacyDefinition = Readonly<{
  group: string;
  exportName: string;
  definition: ComponentDefinition;
  publicSchemaExportMapping: Readonly<{ content: string; props: string }>;
}>;

type SchemaPair = readonly [z.ZodType, z.ZodType];

function section(definition: ComponentDefinition, variant: string) {
  return {
    id: `baseline_${definition.type}_${variant}`,
    component: definition.type,
    variant,
    visible: true,
    content: definition.defaultContent,
    props: definition.defaultProps,
  };
}

/** Runtime-only projection shared with the pre-edit repeatable observation. */
export function observeLegacyMetadata({
  definitions,
  schemas,
  context,
}: Readonly<{
  definitions: readonly ObservedLegacyDefinition[];
  schemas: Readonly<Record<string, SchemaPair>>;
  context: (locale: "en" | "fi") => StorefrontRenderContext;
}>) {
  return {
    definitions: definitions.map(
      ({ group, exportName, definition, publicSchemaExportMapping }) => ({
        group,
        exportName,
        type: definition.type,
        label: definition.label,
        allowedPageTypes: definition.allowedPageTypes,
        variants: definition.variants,
        defaultVariant: definition.defaultVariant,
        editorFields: definition.editorFields,
        protectedFields: definition.protectedFields,
        parsedDefaults: { content: definition.defaultContent, props: definition.defaultProps },
        schemas: {
          content: z.toJSONSchema(schemas[definition.type][0]),
          props: z.toJSONSchema(schemas[definition.type][1]),
        },
        publicSchemaExportMapping,
      }),
    ),
    renderings: definitions.flatMap(({ definition }) =>
      (["en", "fi"] as const).flatMap((locale) =>
        definition.variants.map((variant) => ({
          type: definition.type,
          variant,
          locale,
          html: renderToStaticMarkup(
            definition.render(section(definition, variant), context(locale), "home"),
          ),
        })),
      ),
    ),
  };
}
