import type { ComponentConfig, Config, Data, Field } from "@puckeditor/core";
import type { ReactNode } from "react";
import { z } from "zod";
import {
  getComponentDefinition,
  validateRegisteredPage,
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

function variantPuckField(definition: ComponentDefinition): Field {
  return {
    type: "select",
    label: "Layout variant",
    options: definition.variants.map((variant) => ({ label: variant, value: variant })),
  };
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
  return {
    variant: definition.defaultVariant,
    ...Object.fromEntries(
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
    ),
  };
}

export function sectionToPuckProps(
  definition: ComponentDefinition,
  section: SectionInstance,
  activeLocale: Locale = "en",
): PuckEditorProps {
  definition.validate(section);
  return {
    id: section.id,
    variant: section.variant,
    activeLocale,
    ...Object.fromEntries(
      Object.entries(definition.editorFields).map(([fieldName, metadata]) => {
        const source = metadata.source === "content" ? section.content : section.props;
        const value = source[fieldName];
        return [
          fieldName,
          metadata.localized
            ? getLocalizedDefault(value, activeLocale)
            : metadata.valueType === "stringList" && Array.isArray(value)
              ? value.join(", ")
              : value,
        ];
      }),
    ),
  };
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
    if (value === undefined) continue;
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
    variant: z
      .string()
      .parse(editorProps.variant ?? editorProps.__veskifyVariant ?? definition.defaultVariant),
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
  const fields: Record<string, Field> = { variant: variantPuckField(definition) };
  for (const [name, metadata] of Object.entries(definition.editorFields)) {
    fields[name] = toPuckField(metadata);
  }
  return {
    label: definition.label,
    fields,
    defaultProps: toPuckDefaults(definition),
    permissions: {
      delete: !["header", "footer"].includes(definition.type),
      duplicate: false,
      insert: !["header", "footer"].includes(definition.type),
    },
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
      const editableProps = sectionToPuckProps(definition, section, activeLocale);
      return {
        type: definition.type,
        props: {
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

const sameValue = (left: unknown, right: unknown) => JSON.stringify(left) === JSON.stringify(right);

const protectedPayloadKeys = [
  "__veskifyContent",
  "__veskifyProps",
  "__veskifyVariant",
  "__veskifyVisible",
  "__veskifyStyleOverrides",
] as const;

function assertProtectedPayload(editorProps: Record<string, unknown>, original: SectionInstance) {
  const expected: Record<(typeof protectedPayloadKeys)[number], unknown> = {
    __veskifyContent: original.content,
    __veskifyProps: original.props,
    __veskifyVariant: original.variant,
    __veskifyVisible: original.visible,
    __veskifyStyleOverrides: original.styleOverrides,
  };
  for (const key of protectedPayloadKeys) {
    if (!sameValue(editorProps[key], expected[key])) {
      throw new Error("Protected storefront data cannot be changed in the visual editor.");
    }
  }
}

function assertAllowedEditorProps(
  definition: ComponentDefinition,
  editorProps: Record<string, unknown>,
) {
  const allowed = new Set([
    "id",
    "activeLocale",
    "variant",
    ...Object.keys(definition.editorFields),
    ...protectedPayloadKeys,
  ]);
  if (Object.keys(editorProps).some((key) => !allowed.has(key))) {
    throw new Error("That property is not editable in the visual editor.");
  }
}

function assertRequiredComposition(originalPage: PageModel, proposedPage: PageModel) {
  for (const component of ["header", "footer"] as const) {
    const originalSections = originalPage.sections.filter(
      (section) => section.component === component,
    );
    const proposedSections = proposedPage.sections.filter(
      (section) => section.component === component,
    );
    if (originalSections.length !== 1 || proposedSections.length !== 1) {
      throw new Error(`The required ${component} must remain on this page exactly once.`);
    }
    if (proposedSections[0].id !== originalSections[0].id) {
      throw new Error(`The required ${component} cannot be replaced.`);
    }
    const proposedIndex = proposedPage.sections.findIndex(
      (section) => section.id === proposedSections[0].id,
    );
    if (
      (component === "header" &&
        proposedPage.sections
          .slice(0, proposedIndex)
          .some((section) => section.component !== "announcementBar")) ||
      (component === "footer" && proposedIndex !== proposedPage.sections.length - 1)
    ) {
      throw new Error(`The required ${component} must remain in its protected region.`);
    }
  }
}

export function puckDataToPage(
  data: Data,
  originalPage: PageModel,
  context: StorefrontRenderContext,
): PageModel {
  const parsed = veskifyPuckDataSchema.parse(data);
  if (Object.values(parsed.zones ?? {}).some((items) => items.length > 0)) {
    throw new Error("Nested canvas zones are not supported for storefront pages.");
  }
  const originals = new Map(originalPage.sections.map((section) => [section.id, section]));
  const sections = parsed.content.map((item) => {
    const definition = getComponentDefinition(item.type);
    const itemId = idSchema.parse(item.props.id);
    const original = originals.get(itemId);
    assertAllowedEditorProps(definition, item.props);
    if (original) {
      if (original.component !== item.type) {
        throw new Error("A section type cannot be replaced through hidden editor data.");
      }
      assertProtectedPayload(item.props, original);
    } else if (protectedPayloadKeys.some((key) => item.props[key] !== undefined)) {
      throw new Error("Inserted sections cannot provide protected storefront data.");
    }
    const trustedProps = {
      ...item.props,
      activeLocale: context.activeLocale,
      __veskifyContent: original?.content ?? definition.defaultContent,
      __veskifyProps: original?.props ?? definition.defaultProps,
      __veskifyVariant: item.props.variant ?? original?.variant ?? definition.defaultVariant,
      __veskifyVisible: original?.visible ?? true,
      ...(original?.styleOverrides
        ? { __veskifyStyleOverrides: original.styleOverrides }
        : { __veskifyStyleOverrides: undefined }),
    };
    return editorPropsToSection(definition, trustedProps, originalPage.type, context);
  });
  const proposed = {
    ...structuredClone(originalPage),
    sections,
  };
  assertRequiredComposition(originalPage, proposed);
  return validateRegisteredPage(proposed, context);
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
