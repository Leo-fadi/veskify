import type { ComponentConfig, Config, Data, Field } from "@puckeditor/core";
import type { ReactNode } from "react";
import { z } from "zod";
import {
  getComponentDefinition,
  veskifyComponentRegistry,
  type ComponentDefinition,
  type EditorFieldMetadata,
  createStorefrontRenderContext,
  type StorefrontRenderContext,
} from "@/components/registry";
import { aurumNordicSeed } from "@/data/seed";
import { brandSystemToCssVariables, type BrandSystem } from "@/domain/design-system";
import { idSchema, localeSchema, resolveLocalizedText, type Locale } from "@/domain/shared";
import type { PageModel, PageType, SectionInstance } from "@/domain/storefront";

type PuckEditorProps = Record<string, unknown>;

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

export function toPuckDefaults(definition: ComponentDefinition): PuckEditorProps {
  const defaultLocale = "en";
  return Object.fromEntries(
    Object.entries(definition.editorFields).map(([fieldName, metadata]) => {
      const source =
        metadata.source === "content" ? definition.defaultContent : definition.defaultProps;
      const value = source[fieldName];
      return [
        fieldName,
        metadata.localized
          ? getLocalizedDefault(value, defaultLocale)
          : metadata.valueType === "boolean"
            ? value
            : String(value),
      ];
    }),
  );
}

export function editorPropsToSection(
  definition: ComponentDefinition,
  editorProps: Record<string, unknown>,
  pageType?: PageType,
  context?: StorefrontRenderContext,
): SectionInstance {
  const activeLocale = localeSchema.parse(editorProps.activeLocale ?? "en");
  const content: Record<string, unknown> = structuredClone(
    editorProps.__veskifyContent ?? definition.defaultContent,
  ) as Record<string, unknown>;
  const props: Record<string, unknown> = structuredClone(
    editorProps.__veskifyProps ?? definition.defaultProps,
  ) as Record<string, unknown>;

  for (const [fieldName, metadata] of Object.entries(definition.editorFields)) {
    const value = editorProps[fieldName];
    const target = metadata.source === "content" ? content : props;
    target[fieldName] = metadata.localized
      ? {
          ...(typeof target[fieldName] === "object" ? target[fieldName] : {}),
          [activeLocale]: value,
        }
      : metadata.valueType === "stringList" && typeof value === "string"
        ? value
            .split(",")
            .map((item) => item.trim())
            .filter(Boolean)
        : value;
  }

  const section = {
    id: idSchema.parse(editorProps.id ?? `${definition.type}_puck_item`),
    component: definition.type,
    variant:
      typeof editorProps.__veskifyVariant === "string"
        ? editorProps.__veskifyVariant
        : definition.defaultVariant,
    visible:
      typeof editorProps.__veskifyVisible === "boolean" ? editorProps.__veskifyVisible : true,
    content,
    props,
    ...(typeof editorProps.__veskifyStyleOverrides === "object" &&
    editorProps.__veskifyStyleOverrides !== null
      ? { styleOverrides: structuredClone(editorProps.__veskifyStyleOverrides) }
      : {}),
  };
  if (pageType) definition.validate(section, pageType, context);
  return section;
}

function componentToPuckConfig(
  definition: ComponentDefinition,
  context: StorefrontRenderContext,
  pageType: PageType,
): ComponentConfig<PuckEditorProps> {
  return {
    label: definition.label,
    fields: Object.fromEntries(
      Object.entries(definition.editorFields).map(([name, metadata]) => [
        name,
        toPuckField(metadata),
      ]),
    ),
    defaultProps: toPuckDefaults(definition),
    render: (editorProps) => {
      const section = editorPropsToSection(definition, editorProps, pageType, context);
      return section.visible ? <>{definition.render(section, context, pageType)}</> : <></>;
    },
  };
}

const previewSnapshot = aurumNordicSeed.draftSnapshot;
export const safePuckPreviewContext = createStorefrontRenderContext({
  activeLocale: "en",
  primaryLocale: "en",
  catalogue: aurumNordicSeed.catalogue,
  snapshot: previewSnapshot,
});

export function generateVeskifyPuckConfig(
  context: StorefrontRenderContext = safePuckPreviewContext,
  pageType: PageType = "home",
  brandSystem: BrandSystem = aurumNordicSeed.draftSnapshot.brandSystem,
): Config {
  return {
    components: Object.fromEntries(
      Object.values(veskifyComponentRegistry)
        .filter((definition) => definition.allowedPageTypes.includes(pageType))
        .map((definition) => [
          definition.type,
          componentToPuckConfig(definition, context, pageType),
        ]),
    ),
    root: {
      render: ({ children }: { children: ReactNode }) => (
        <div
          data-veskify-canvas-root="true"
          lang={context.activeLocale}
          style={brandSystemToCssVariables(brandSystem)}
        >
          {children}
        </div>
      ),
    },
  } as Config;
}

export const veskifyPuckConfig = generateVeskifyPuckConfig();

export function pageToPuckData(page: PageModel, context: StorefrontRenderContext): Data {
  const activeLocale = context.activeLocale;
  return {
    content: page.sections.map((section) => {
      const definition = getComponentDefinition(section.component);
      definition.validate(section, page.type, context);
      const editableProps = Object.fromEntries(
        Object.entries(definition.editorFields).map(([fieldName, metadata]) => {
          const source = metadata.source === "content" ? section.content : section.props;
          const value = source[fieldName];
          return [
            fieldName,
            metadata.localized && typeof value === "object" && value !== null
              ? resolveLocalizedText(value, activeLocale, context.primaryLocale)
              : value,
          ];
        }),
      );
      return {
        type: definition.type,
        props: {
          id: section.id,
          activeLocale,
          ...editableProps,
          __veskifyContent: structuredClone(section.content),
          __veskifyProps: structuredClone(section.props),
          __veskifyVariant: section.variant,
          __veskifyVisible: section.visible,
          ...(section.styleOverrides
            ? { __veskifyStyleOverrides: structuredClone(section.styleOverrides) }
            : {}),
        },
      };
    }),
    root: {
      props: {
        title: resolveLocalizedText(page.title, activeLocale, context.primaryLocale),
      },
    },
  };
}

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

export function validatePuckDraftPayload(
  data: Data,
  context: StorefrontRenderContext = safePuckPreviewContext,
  pageType: PageType = "home",
): ValidatedPuckData {
  const parsed = veskifyPuckDataSchema.parse(data);
  const items = [...parsed.content, ...Object.values(parsed.zones ?? {}).flat()];

  items.forEach((item) => {
    const definition = getComponentDefinition(item.type);
    editorPropsToSection(definition, item.props, pageType, context);
  });

  return parsed;
}
