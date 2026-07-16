import type { ComponentConfig, Config, Data, Field } from "@puckeditor/core";
import { z } from "zod";
import {
  getComponentDefinition,
  veskifyComponentRegistry,
  type ComponentDefinition,
  type EditorFieldMetadata,
} from "@/components/registry";
import { idSchema, localeSchema, type Locale } from "@/domain/shared";
import type { SectionInstance } from "@/domain/storefront";

type PuckEditorProps = Record<string, string>;

function toPuckField(metadata: EditorFieldMetadata): Field {
  if (metadata.control === "select") {
    return {
      type: "select",
      label: metadata.label,
      options: metadata.options?.map((option) => ({ ...option })) ?? [],
    };
  }
  return { type: metadata.control, label: metadata.label };
}

function getLocalizedDefault(value: unknown, locale: Locale): string {
  if (typeof value !== "object" || value === null) return "";
  const localized = value as Record<string, unknown>;
  const activeValue = localized[locale];
  if (typeof activeValue === "string") return activeValue;
  return Object.values(localized).find((item): item is string => typeof item === "string") ?? "";
}

function toPuckDefaults(definition: ComponentDefinition): PuckEditorProps {
  const defaultLocale = localeSchema.parse(definition.defaultProps.activeLocale);
  return Object.fromEntries(
    Object.entries(definition.editorFields).map(([fieldName, metadata]) => {
      const source =
        metadata.source === "content" ? definition.defaultContent : definition.defaultProps;
      const value = source[fieldName];
      return [
        fieldName,
        metadata.localized ? getLocalizedDefault(value, defaultLocale) : String(value),
      ];
    }),
  );
}

function editorPropsToSection(
  definition: ComponentDefinition,
  editorProps: Record<string, unknown>,
): SectionInstance {
  const activeLocale = localeSchema.parse(editorProps.activeLocale);
  const content: Record<string, unknown> = {};
  const props: Record<string, unknown> = {};

  for (const [fieldName, metadata] of Object.entries(definition.editorFields)) {
    const value = editorProps[fieldName];
    const target = metadata.source === "content" ? content : props;
    target[fieldName] = metadata.localized ? { [activeLocale]: value } : value;
  }

  return {
    id: idSchema.parse(editorProps.id ?? `${definition.type}_puck_item`),
    component: definition.type,
    variant: definition.defaultVariant,
    visible: true,
    content,
    props,
  };
}

function componentToPuckConfig(definition: ComponentDefinition): ComponentConfig<PuckEditorProps> {
  return {
    label: definition.label,
    fields: Object.fromEntries(
      Object.entries(definition.editorFields).map(([name, metadata]) => [
        name,
        toPuckField(metadata),
      ]),
    ),
    defaultProps: toPuckDefaults(definition),
    render: (editorProps) => (
      <>{definition.render(editorPropsToSection(definition, editorProps))}</>
    ),
  };
}

export function generateVeskifyPuckConfig(): Config {
  return {
    components: Object.fromEntries(
      Object.values(veskifyComponentRegistry).map((definition) => [
        definition.type,
        componentToPuckConfig(definition),
      ]),
    ),
  } as Config;
}

export const veskifyPuckConfig = generateVeskifyPuckConfig();

const aurumHeroDefaults = toPuckDefaults(getComponentDefinition("hero"));

export const initialPuckData = {
  content: [
    {
      type: "hero",
      props: {
        id: "aurum_hero_demo",
        ...aurumHeroDefaults,
        body: "This is a minimal Puck integration proof. It is not publishing or persisting data yet.",
      },
    },
  ],
  root: { props: { title: "Aurum Nordic Puck proof" } },
} satisfies Data;

const puckItemSchema = z
  .object({
    type: z.string().min(1),
    props: z.record(z.string(), z.unknown()),
  })
  .strict();

export const veskifyPuckDataSchema = z
  .object({
    content: z.array(puckItemSchema),
    root: z.object({ props: z.record(z.string(), z.unknown()).optional() }).optional(),
    zones: z.record(z.string(), z.array(puckItemSchema)).optional(),
  })
  .strict();

export type ValidatedPuckData = z.infer<typeof veskifyPuckDataSchema>;

export function validatePuckDraftPayload(data: Data): ValidatedPuckData {
  const parsed = veskifyPuckDataSchema.parse(data);
  const items = [...parsed.content, ...Object.values(parsed.zones ?? {}).flat()];

  items.forEach((item) => {
    const definition = getComponentDefinition(item.type);
    definition.validate(editorPropsToSection(definition, item.props));
  });

  return parsed;
}
