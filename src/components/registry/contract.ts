import type { ReactNode } from "react";
import type { z } from "zod";
import type { CatalogueDisplayModel } from "@/domain/catalogue";
import type { Locale } from "@/domain/shared";
import type {
  NavigationModel,
  PageFactEvidenceReference,
  PageModel,
  PageType,
  SectionInstance,
  SharedFrameModel,
} from "@/domain/storefront";
import type { HomepageNavigationIntent } from "@/components/storefront/homepage-commerce";
import type { BrandSystem } from "@/domain/design-system";
import type { CommerceUtilityIntent, CommerceUtilityRuntimeState } from "@/domain/commerce-utility";

export type StorefrontRenderContext = {
  activeLocale: Locale;
  primaryLocale: Locale;
  enabledLocales: readonly Locale[];
  onLocaleChange?: (locale: Locale) => void;
  catalogue: CatalogueDisplayModel;
  navigation: NavigationModel;
  sharedFrame?: SharedFrameModel;
  pages: readonly PageModel[];
  brandSystem: BrandSystem;
  pagePaths: Readonly<Record<string, string>>;
  homePath?: string;
  renderTarget?: "editor" | "preview" | "published";
  /** Current, externally resolved proof authority. Snapshot content never establishes approval. */
  evidenceReferences?: readonly PageFactEvidenceReference[];
  /** Read-only operational state from a commerce/runtime adapter; never snapshot-persisted. */
  commerceUtilityRuntime?: CommerceUtilityRuntimeState;
  /** Present only when the adapter has declared the rendered utility action executable. */
  onCommerceUtilityIntent?: (intent: CommerceUtilityIntent) => void;
};

/** Resolves only canonical snapshot navigation and commerce identities to routes. */
export function resolveStorefrontNavigationPath(
  context: StorefrontRenderContext,
  intent: HomepageNavigationIntent,
): string | undefined {
  if (intent.type === "navigateToApprovedAction") {
    const item = [...context.navigation.primary, ...context.navigation.footer].find(
      (candidate) => candidate.id === intent.navigationId,
    );
    if (!item) return undefined;
    return item.target.type === "external"
      ? item.target.url
      : context.pagePaths[item.target.pageId];
  }
  const requiredComponent =
    intent.type === "navigateToProduct"
      ? ["productInfo", "dynamicProductDetail"]
      : ["collectionHeader", "dynamicCollectionCommerce"];
  const bindingId = intent.type === "navigateToProduct" ? intent.productId : intent.collectionId;
  const page = context.pages.find((candidate) =>
    candidate.sections.some(
      (section) =>
        requiredComponent.includes(section.component) &&
        (section.content.productId === bindingId || section.content.collectionId === bindingId),
    ),
  );
  return page ? context.pagePaths[page.id] : undefined;
}

export type EditorFieldMetadata = {
  source: "content" | "props";
  control: "text" | "textarea" | "select";
  label: string;
  localized?: boolean;
  options?: ReadonlyArray<{ label: string; value: string | number | boolean }>;
  valueType?: "string" | "stringList" | "boolean";
};

export type ProtectedFieldMetadata = {
  readOnlyPaths: readonly string[];
};

export type ComponentRenderInput<TContent, TProps, TVariant extends string> = {
  sectionId: string;
  variant: TVariant;
  content: TContent;
  props: TProps;
  approvedAssetPlacements: NonNullable<SectionInstance["approvedAssetPlacements"]>;
  approvedAssetPresentations: NonNullable<SectionInstance["approvedAssetPresentations"]>;
  context: StorefrontRenderContext;
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
  validate: (
    section: SectionInstance,
    pageType?: PageType,
    context?: StorefrontRenderContext,
  ) => SectionInstance;
  render: (
    section: SectionInstance,
    context: StorefrontRenderContext,
    pageType?: PageType,
  ) => ReactNode;
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
  validateContext?: (
    input: ComponentRenderInput<
      z.output<TContentSchema>,
      z.output<TPropsSchema>,
      TVariants[number]
    >,
  ) => void;
  renderer: (
    input: ComponentRenderInput<
      z.output<TContentSchema>,
      z.output<TPropsSchema>,
      TVariants[number]
    >,
  ) => ReactNode;
};

export function defineComponent<
  TContentSchema extends z.ZodType,
  TPropsSchema extends z.ZodType,
  TVariants extends readonly [string, ...string[]],
>(input: DefinitionInput<TContentSchema, TPropsSchema, TVariants>): ComponentDefinition {
  const defaultContent = input.contentSchema.parse(input.defaultContent) as Record<string, unknown>;
  const defaultProps = input.propsSchema.parse(input.defaultProps) as Record<string, unknown>;

  function parse(section: SectionInstance, pageType?: PageType, context?: StorefrontRenderContext) {
    if (section.component !== input.type) {
      throw new Error(`Expected component ${input.type}, received ${section.component}.`);
    }
    if (!input.variants.includes(section.variant)) {
      throw new Error(`Unsupported ${input.type} variant: ${section.variant}.`);
    }
    if (pageType !== undefined && !input.allowedPageTypes.includes(pageType)) {
      throw new Error(`Component ${input.type} is not allowed on ${pageType} pages.`);
    }

    const parsed = {
      sectionId: section.id,
      content: input.contentSchema.parse(section.content),
      props: input.propsSchema.parse(section.props),
      variant: section.variant as TVariants[number],
      approvedAssetPlacements: structuredClone(section.approvedAssetPlacements ?? []),
      approvedAssetPresentations: structuredClone(section.approvedAssetPresentations ?? []),
      context: context as StorefrontRenderContext,
    };
    if (context) input.validateContext?.(parsed);
    return parsed;
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
    validate(section, pageType, context) {
      parse(section, pageType, context);
      return section;
    },
    render(section, context, pageType) {
      return input.renderer(parse(section, pageType, context));
    },
  };
}
