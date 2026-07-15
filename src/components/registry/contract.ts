import type { ReactNode } from "react";
import type { z } from "zod";
import type { PageType, SectionInstance } from "@/domain/storefront";

export type EditorFieldMetadata = {
  source: "content" | "props";
  control: "text" | "textarea" | "select";
  label: string;
  localized?: boolean;
  options?: ReadonlyArray<{ label: string; value: string }>;
};

export type ProtectedFieldMetadata = {
  readOnlyPaths: readonly string[];
};

export type ComponentRenderInput<TContent, TProps, TVariant extends string> = {
  variant: TVariant;
  content: TContent;
  props: TProps;
};

export type ComponentDefinition = {
  type: string;
  label: string;
  allowedPageTypes: readonly PageType[];
  variants: readonly string[];
  defaultVariant: string;
  contentSchema: z.ZodType;
  propsSchema: z.ZodType;
  defaultContent: Readonly<Record<string, unknown>>;
  defaultProps: Readonly<Record<string, unknown>>;
  editorFields: Readonly<Record<string, EditorFieldMetadata>>;
  protectedFields: ProtectedFieldMetadata;
  validate: (section: SectionInstance, pageType?: PageType) => SectionInstance;
  render: (section: SectionInstance, pageType?: PageType) => ReactNode;
};

type DefinitionInput<
  TContentSchema extends z.ZodType,
  TPropsSchema extends z.ZodType,
  TVariants extends readonly [string, ...string[]],
> = {
  type: string;
  label: string;
  allowedPageTypes: readonly PageType[];
  variants: TVariants;
  defaultVariant: TVariants[number];
  contentSchema: TContentSchema;
  propsSchema: TPropsSchema;
  defaultContent: z.input<TContentSchema> & Record<string, unknown>;
  defaultProps: z.input<TPropsSchema> & Record<string, unknown>;
  editorFields: Readonly<Record<string, EditorFieldMetadata>>;
  protectedFields: ProtectedFieldMetadata;
  renderer: (input: ComponentRenderInput<z.output<TContentSchema>, z.output<TPropsSchema>, TVariants[number]>) => ReactNode;
};

export function defineComponent<
  TContentSchema extends z.ZodType,
  TPropsSchema extends z.ZodType,
  TVariants extends readonly [string, ...string[]],
>(input: DefinitionInput<TContentSchema, TPropsSchema, TVariants>): ComponentDefinition {
  const defaultContent = input.contentSchema.parse(input.defaultContent) as Record<string, unknown>;
  const defaultProps = input.propsSchema.parse(input.defaultProps) as Record<string, unknown>;

  function parse(section: SectionInstance, pageType?: PageType) {
    if (section.component !== input.type) {
      throw new Error(`Expected component ${input.type}, received ${section.component}.`);
    }
    if (!input.variants.includes(section.variant)) {
      throw new Error(`Unsupported ${input.type} variant: ${section.variant}.`);
    }
    if (pageType !== undefined && !input.allowedPageTypes.includes(pageType)) {
      throw new Error(`Component ${input.type} is not allowed on ${pageType} pages.`);
    }

    return {
      content: input.contentSchema.parse(section.content),
      props: input.propsSchema.parse(section.props),
      variant: section.variant as TVariants[number],
    };
  }

  return {
    type: input.type,
    label: input.label,
    allowedPageTypes: input.allowedPageTypes,
    variants: input.variants,
    defaultVariant: input.defaultVariant,
    contentSchema: input.contentSchema,
    propsSchema: input.propsSchema,
    defaultContent,
    defaultProps,
    editorFields: input.editorFields,
    protectedFields: input.protectedFields,
    validate(section, pageType) {
      parse(section, pageType);
      return section;
    },
    render(section, pageType) {
      return input.renderer(parse(section, pageType));
    },
  };
}
