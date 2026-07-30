import {
  registeredTokenRefinementPlanSchema,
  type RegisteredTokenRefinementPlan,
} from "@/application/storefront-design-system";
import {
  dynamicCollectionCommerceDefaultContent,
  dynamicCollectionCommerceDefaultProps,
  dynamicCollectionCommerceDefaultStyleOverrides,
} from "@/components/registry/dynamic-collection-commerce";
import {
  dynamicProductDetailDefaultContent,
  dynamicProductDetailDefaultProps,
  dynamicProductDetailDefaultStyleOverrides,
} from "@/components/registry/dynamic-product-detail";
import {
  createComponentRegistryV2,
  type ComponentDefinitionV2,
  type ComponentInstanceV2,
  type PresentationBinding,
} from "@/domain/component-platform";
import { canonicalLocaleOrder } from "@/domain/shared";
import {
  canonicalValueFingerprint,
  canonicalValueString,
  type PageType,
} from "@/domain/storefront";
import {
  wholeStorefrontGenerationPlanSchema,
  wholeStorefrontPlanningInputSchema,
  type WholeStorefrontGenerationPlan,
  type WholeStorefrontGenerationPlanErrorCode,
  type WholeStorefrontGenerationTarget,
  type WholeStorefrontPlanningInput,
  WholeStorefrontGenerationPlanError,
} from "./contract";
import { selectStorefrontDesignDirection } from "@/application/storefront-design-system";
import { getComponentDefinition } from "@/components/registry";
import {
  dynamicCollectionCommerceBridgeContentSchema,
  dynamicProductDetailBridgeContentSchema,
} from "@/components/registry/dynamic-commerce-bridge";

const FAMILY_REQUIREMENTS = {
  homepage: [
    "hero",
    "featured-collections",
    "featured-products",
    "collection-navigation",
    "promotion",
    "trust-supporting-information",
  ],
  "collection-template": [
    "collection-header",
    "product-grid",
    "filters",
    "sorting",
    "child-collection-navigation",
  ],
  "product-template": [
    "dynamic-product-detail",
    "canonical-option-presentation",
    "specifications",
    "related-products",
    "trust-supporting-information",
  ],
  other: [],
} as const;

/**
 * The canonical planner contract for legacy sections replaced by the typed
 * commerce shells. Audit consumers must keep this separate from coordinated
 * design-direction component selections.
 */
export const dynamicCollectionReplacementComponentTypes = [
  "collectionHeader",
  "filterBar",
  "productGrid",
  "dynamicCollectionCommerce",
] as const;

export const dynamicProductReplacementComponentTypes = [
  "productGallery",
  "productInfo",
  "productOptions",
  "dynamicProductDetail",
] as const;

type ActiveComponentTarget = {
  pageId: string;
  pageType: PageType;
  pageRole: WholeStorefrontGenerationPlan["pagePlans"][number]["role"];
  componentId: string;
  componentType: string;
  definition: ComponentDefinitionV2;
  instance: ComponentInstanceV2;
};

type ExistingCollectionBinding = {
  collection: WholeStorefrontPlanningInput["catalogue"]["collections"][number];
  productIds: string[];
};

type ExistingProductBinding = {
  productId: string;
  relatedProductIds: string[];
};

function invalid(code: WholeStorefrontGenerationPlanErrorCode, message: string): never {
  throw new WholeStorefrontGenerationPlanError(code, message);
}

function parsePlanningInput(inputValue: unknown): WholeStorefrontPlanningInput {
  const parsed = wholeStorefrontPlanningInputSchema.safeParse(inputValue);
  if (parsed.success) return parsed.data;
  const briefIssue = parsed.error.issues.find((issue) => issue.path[0] === "brief");
  if (briefIssue) {
    invalid(
      "stale-brief",
      "The approved Storefront Design Brief is stale and must be reviewed again.",
    );
  }
  throw parsed.error;
}

function roleForPage(type: WholeStorefrontPlanningInput["draft"]["pages"][number]["type"]) {
  if (type === "home") return "homepage" as const;
  if (type === "collection") return "collection-template" as const;
  if (type === "product") return "product-template" as const;
  return "other" as const;
}

function fingerprint(value: unknown, prefix: string): string {
  return `${prefix}-${canonicalValueFingerprint(value)}`;
}

function normalizedDefinitions(input: WholeStorefrontPlanningInput) {
  return [...input.componentDefinitions]
    .map((definition) => structuredClone(definition))
    .sort((left, right) => left.type.localeCompare(right.type));
}

function requireInputPreconditions(input: WholeStorefrontPlanningInput) {
  const { brief, project, draft, catalogue, approvedAssetContext } = input;
  if (brief.status !== "approved" || brief.approval.status !== "approved") {
    invalid(
      "no-approved-brief",
      "Approve the current Storefront Design Brief before planning a storefront.",
    );
  }
  if (
    brief.approvedEvidenceFingerprint === null ||
    brief.approvedEvidenceFingerprint !== brief.evidenceFingerprint ||
    brief.canonicalCommerceProjectionRef === null
  ) {
    invalid(
      "stale-brief",
      "The approved Storefront Design Brief is stale and must be reviewed again.",
    );
  }
  if (project.id !== draft.projectId || project.id.trim().length === 0) {
    invalid(
      "missing-canonical-project-target",
      "The current storefront project target is unavailable.",
    );
  }
  if (
    draft.catalogueRef !== catalogue.id ||
    brief.canonicalCommerceProjectionRef !== catalogue.id
  ) {
    invalid(
      "missing-canonical-commerce-projection",
      "The approved brief and storefront must use the same canonical commerce projection.",
    );
  }
  const briefLocales = canonicalLocaleOrder(brief.languagePlan.selectedLanguages);
  const projectLocales = canonicalLocaleOrder(project.enabledLocales);
  if (
    brief.languagePlan.primaryLanguage === null ||
    briefLocales.length === 0 ||
    briefLocales.some((locale) => !projectLocales.includes(locale)) ||
    !briefLocales.includes(brief.languagePlan.primaryLanguage)
  ) {
    invalid(
      "missing-required-locale",
      "The approved language plan is not available for this project.",
    );
  }
  if (approvedAssetContext !== null) {
    if (
      approvedAssetContext.briefId !== brief.id ||
      approvedAssetContext.briefRevision !== brief.revision ||
      approvedAssetContext.approvedEvidenceFingerprint !== brief.approvedEvidenceFingerprint ||
      approvedAssetContext.assetReviewFingerprint !== brief.assetReviewFingerprint
    ) {
      invalid("stale-approved-asset", "The approved source-asset context is stale for this brief.");
    }
  }
}

export function createWholeStorefrontGenerationTarget(
  inputValue: unknown,
): WholeStorefrontGenerationTarget {
  const input = parsePlanningInput(inputValue);
  requireInputPreconditions(input);
  const definitions = normalizedDefinitions(input);
  try {
    createComponentRegistryV2(definitions);
  } catch (error) {
    invalid(
      "invalid-component-contract",
      error instanceof Error ? error.message : "The component registry is invalid.",
    );
  }
  const pages = [...input.draft.pages]
    .sort((left, right) => left.id.localeCompare(right.id))
    .map((page) => ({
      id: page.id,
      role: roleForPage(page.type),
      type: page.type,
      sections: [...page.sections]
        .sort((left, right) => left.id.localeCompare(right.id))
        .map((section) => ({
          id: section.id,
          component: section.component,
          variant: section.variant,
          visible: section.visible,
        })),
    }));
  for (const role of ["homepage", "collection-template", "product-template"] as const) {
    if (pages.filter((page) => page.role === role).length > 1) {
      invalid("unsupported-page-family", `Only one ${role} page may be planned at a time.`);
    }
  }
  const activeDraftFingerprint = fingerprint(input.draft, "draft");
  const registryFingerprint = fingerprint(definitions, "component-registry");
  const recipeFingerprint = input.recipeContext.fingerprint;
  const brandSystemFingerprint = fingerprint(input.draft.brandSystem, "brand-system");
  const canonicalCommerceFingerprint = fingerprint(input.catalogue, "canonical-commerce");
  const targetWithoutFingerprint = {
    projectId: input.project.id,
    projectRevision: input.project.revision,
    draftSnapshotId: input.draft.id,
    draftRevision: input.draft.revision,
    activeDraftFingerprint,
    supportedLocales: canonicalLocaleOrder(input.project.enabledLocales),
    pages,
    navigation: (["primary", "footer"] as const).flatMap((area) =>
      input.draft.navigation[area]
        .map((item) => ({
          id: item.id,
          area,
          target:
            item.target.type === "page"
              ? { type: "page" as const, pageId: item.target.pageId }
              : { type: "external" as const },
        }))
        .sort((left, right) => left.id.localeCompare(right.id)),
    ),
    productIds: input.catalogue.products.map((product) => product.id).sort(),
    collections: input.catalogue.collections
      .map((collection) => ({ id: collection.id, productIds: [...collection.productIds].sort() }))
      .sort((left, right) => left.id.localeCompare(right.id)),
    componentDefinitions: definitions.map((definition) => ({
      type: definition.type,
      version: definition.version,
    })),
    registryFingerprint,
    recipeFingerprint,
    brandSystemFingerprint,
    canonicalCommerceFingerprint,
    approvedAssetContextFingerprint: input.approvedAssetContext?.fingerprint ?? null,
  };
  return {
    ...targetWithoutFingerprint,
    fingerprint: fingerprint(targetWithoutFingerprint, "whole-storefront-target"),
  };
}

function retainedComponent(
  section: WholeStorefrontPlanningInput["draft"]["pages"][number]["sections"][number],
  definitions: ReturnType<typeof normalizedDefinitions>,
): ComponentInstanceV2 {
  const definition = definitions.find((candidate) => candidate.type === section.component);
  if (!definition) {
    invalid(
      "unknown-component",
      `The current storefront uses an unregistered component: ${section.component}.`,
    );
  }
  const base = {
    id: section.id,
    component: section.component,
    componentVersion: definition.version,
    variant: section.variant,
    props: structuredClone(section.props) as ComponentInstanceV2["props"],
    styleOverrides: {},
    assetAssignments: [],
  };
  if (section.component === "dynamicCollectionCommerce") {
    const { collectionId, productIds, canonicalRevision, ...content } =
      dynamicCollectionCommerceBridgeContentSchema.parse(section.content);
    return {
      ...base,
      content,
      styleOverrides: structuredClone(dynamicCollectionCommerceDefaultStyleOverrides),
      bindings: [
        {
          slotId: "primaryCollection",
          source: "collection",
          collectionId,
          revision: canonicalRevision,
        },
        {
          slotId: "collectionProducts",
          source: "productList",
          productIds,
          revision: canonicalRevision,
        },
      ],
    };
  }
  if (section.component === "dynamicProductDetail") {
    const { productId, relatedProductIds, canonicalRevision, ...content } =
      dynamicProductDetailBridgeContentSchema.parse(section.content);
    return {
      ...base,
      content,
      styleOverrides: structuredClone(dynamicProductDetailDefaultStyleOverrides),
      bindings: [
        {
          slotId: "primaryProduct",
          source: "product",
          productId,
          revision: canonicalRevision,
        },
        ...(relatedProductIds.length > 0
          ? [
              {
                slotId: "relatedProducts",
                source: "productList" as const,
                productIds: relatedProductIds,
                revision: canonicalRevision,
              },
            ]
          : []),
      ],
    };
  }
  return {
    ...base,
    content: structuredClone(section.content) as ComponentInstanceV2["content"],
    bindings: [],
  };
}

function definitionFor(
  definitions: ReturnType<typeof normalizedDefinitions>,
  componentType: string,
): ComponentDefinitionV2 {
  const definition = definitions.find((candidate) => candidate.type === componentType);
  if (!definition) {
    invalid("unknown-component", `The component registry does not include ${componentType}.`);
  }
  return definition;
}

function assertCoordinatedDirectionCapabilities(
  direction: WholeStorefrontPlanningInput["recipeContext"]["designSystem"]["directions"][number],
  designSystem: WholeStorefrontPlanningInput["recipeContext"]["designSystem"],
  definitions: ReturnType<typeof normalizedDefinitions>,
) {
  const recipes = [
    [direction.homepageRecipeId, "home", designSystem.homepageRecipes],
    [direction.collectionRecipeId, "collection", designSystem.collectionRecipes],
    [direction.productRecipeId, "product", designSystem.productRecipes],
  ] as const;
  recipes.forEach(([recipeId, pageType, availableRecipes]) => {
    const recipe = availableRecipes.find((candidate) => candidate.id === recipeId);
    if (!recipe || recipe.pageType !== pageType) {
      invalid(
        "unsupported-page-family",
        "The selected design direction references an unavailable registered page recipe.",
      );
    }
    recipe.sections.forEach((section) => {
      const definition = definitionFor(definitions, section.component);
      if (
        !definition.supportedPageTypes.includes(pageType) ||
        !definition.variants.some((variant) => variant.id === section.variant)
      ) {
        invalid(
          "invalid-component-contract",
          "The selected design direction references an unavailable or incompatible registered component.",
        );
      }
    });
  });
  const homepage = designSystem.homepageRecipes.find(
    (recipe) => recipe.id === direction.homepageRecipeId,
  );
  const collection = designSystem.collectionRecipes.find(
    (recipe) => recipe.id === direction.collectionRecipeId,
  );
  const product = designSystem.productRecipes.find(
    (recipe) => recipe.id === direction.productRecipeId,
  );
  const expectedSelections = [
    ["header", homepage],
    ["hero", homepage],
    ["collectionDiscovery", homepage],
    ["productCard", homepage],
    ["storytelling", homepage],
    ["campaign", homepage],
    ["trust", homepage],
    ["footer", homepage],
    ["collectionCommerce", collection],
    ["productDetail", product],
  ] as const;
  expectedSelections.forEach(([selectionName, recipe]) => {
    const selection = direction.componentSelections[selectionName];
    if (
      !recipe?.sections.some(
        (section) =>
          section.component === selection.component && section.variant === selection.variant,
      )
    ) {
      invalid(
        "invalid-component-contract",
        "The selected coordinated component choices do not match their registered recipes.",
      );
    }
  });
  const family = designSystem.productCardFamilies.find(
    (candidate) => candidate.id === direction.productCardFamilyId,
  );
  if (!family || family.registryVariant !== direction.collectionPresentation.cardVariant) {
    invalid(
      "invalid-component-contract",
      "The selected product-card family is incompatible with the collection presentation.",
    );
  }
}

function generatedId(prefix: string, identity: unknown): string {
  return `${prefix}_${canonicalValueFingerprint(identity).replaceAll("_", "-").slice(-24)}`;
}

function generatedComponentId(
  pageId: string,
  componentType: string,
  usedIds: ReadonlySet<string>,
): string {
  const kind = componentType === "dynamicCollectionCommerce" ? "collection" : "product";
  const baseId = `component_${kind}`;
  for (let attempt = 1; attempt <= 100; attempt += 1) {
    const candidate = generatedId(baseId, { pageId, componentType, attempt });
    if (!usedIds.has(candidate)) return candidate;
  }
  invalid(
    "unsupported-page-family",
    "A unique canonical component ID could not be created safely.",
  );
}

function requiredHomepageRecipeComponents(input: {
  planningInput: WholeStorefrontPlanningInput;
  page: WholeStorefrontPlanningInput["draft"]["pages"][number];
  definitions: ReturnType<typeof normalizedDefinitions>;
  registry: ReturnType<typeof createComponentRegistryV2>;
  usedComponentIds: Set<string>;
  recipeId: string;
}): WholeStorefrontGenerationPlan["pagePlans"][number]["components"] {
  const { planningInput, page, definitions, registry, usedComponentIds, recipeId } = input;
  if (page.type !== "home") return [];
  const recipe = planningInput.recipeContext.designSystem.homepageRecipes.find(
    (candidate) => candidate.id === recipeId,
  );
  if (!recipe) {
    invalid("unsupported-page-family", "The selected homepage recipe is unavailable.");
  }
  const existingComponents = new Set(page.sections.map((section) => section.component));
  return recipe.sections.flatMap((recipeSection) => {
    if (!recipeSection.required || existingComponents.has(recipeSection.component)) return [];
    if (recipeSection.component !== "brandStory") {
      invalid(
        "missing-required-recipe-content",
        `Add approved content for the required ${recipeSection.component} homepage section.`,
      );
    }
    const approvedAsset = planningInput.approvedAssetContext?.assets.find((asset) =>
      recipeSection.acceptedAssetRoles.includes(asset.role),
    );
    if (!approvedAsset) {
      invalid(
        "missing-required-recipe-asset",
        "Approve an editorial image before using the selected brand-story homepage recipe.",
      );
    }
    const description = planningInput.brief.businessIdentity.shortDescription.trim();
    if (description.length === 0) {
      invalid(
        "missing-required-recipe-content",
        "Add an approved business description before using the selected brand-story homepage recipe.",
      );
    }
    const definition = definitionFor(definitions, recipeSection.component);
    const legacyDefinition = getComponentDefinition(recipeSection.component);
    const componentId = generatedComponentId(page.id, recipeSection.component, usedComponentIds);
    usedComponentIds.add(componentId);
    const instance: ComponentInstanceV2 = {
      id: componentId,
      component: recipeSection.component,
      componentVersion: definition.version,
      variant: recipeSection.variant,
      content: {
        eyebrow: {
          en: planningInput.brief.businessIdentity.businessName,
          fi: planningInput.brief.businessIdentity.businessName,
        },
        heading: {
          en: planningInput.brief.businessIdentity.businessName,
          fi: planningInput.brief.businessIdentity.businessName,
        },
        body: { en: description, fi: description },
        approvedAssetId: approvedAsset.assetId,
        facts: [],
      },
      props: structuredClone(legacyDefinition.defaultProps) as ComponentInstanceV2["props"],
      styleOverrides: {},
      bindings: [],
      assetAssignments: [
        {
          slotId: "brandStoryMedia",
          assetId: approvedAsset.assetId,
          role: approvedAsset.role,
        },
      ],
    };
    try {
      registry.validateInstance(instance);
    } catch (error) {
      invalid(
        "invalid-component-contract",
        error instanceof Error ? error.message : "The required brand-story component is invalid.",
      );
    }
    return [{ disposition: "added" as const, instance, replacesComponentIds: [] }];
  });
}

function generatedPageId(baseId: string, usedIds: ReadonlySet<string>): string {
  if (!usedIds.has(baseId)) return baseId;
  const normalizedUsedIds = [...usedIds].sort();
  for (let attempt = 1; attempt <= 100; attempt += 1) {
    const candidate = generatedId(baseId, { baseId, normalizedUsedIds, attempt });
    if (!usedIds.has(candidate)) return candidate;
  }
  invalid("unsupported-page-family", "A unique canonical page ID could not be created safely.");
}

function stringsFromProtectedContent(content: Record<string, unknown>, field: string): string[] {
  const value = content[field];
  if (typeof value === "string") return [value];
  if (
    Array.isArray(value) &&
    value.length > 0 &&
    value.every((item): item is string => typeof item === "string")
  ) {
    return [...value];
  }
  return [];
}

function protectedValuesFor(
  page: WholeStorefrontPlanningInput["draft"]["pages"][number],
  definitions: ReturnType<typeof normalizedDefinitions>,
  field: string,
): string[][] {
  return page.sections.flatMap((section) => {
    const definition = definitionFor(definitions, section.component);
    if (!definition.protectedFields.readOnlyPaths.includes(field)) return [];
    const values = stringsFromProtectedContent(section.content, field);
    return values.length === 0 ? [] : [values];
  });
}

function oneProtectedValue(values: readonly string[][], label: string): string {
  const uniqueValues = [...new Set(values.flat())];
  const value = uniqueValues[0];
  if (uniqueValues.length !== 1 || value === undefined) {
    invalid(
      "unknown-commerce-binding",
      `The existing ${label} binding is missing, conflicting or ambiguous.`,
    );
  }
  return value;
}

function oneProtectedList(values: readonly string[][], label: string): string[] {
  const value = values[0];
  if (values.length !== 1 || value === undefined) {
    invalid(
      "unknown-commerce-binding",
      `The existing ${label} binding is missing, conflicting or ambiguous.`,
    );
  }
  return [...value];
}

function existingCollectionBinding(
  page: WholeStorefrontPlanningInput["draft"]["pages"][number],
  input: WholeStorefrontPlanningInput,
  definitions: ReturnType<typeof normalizedDefinitions>,
): ExistingCollectionBinding {
  const dynamicSections = page.sections.filter(
    (section) => section.component === "dynamicCollectionCommerce",
  );
  if (dynamicSections.length > 1) {
    invalid("unknown-commerce-binding", "The dynamic collection binding is ambiguous.");
  }
  if (dynamicSections[0]) {
    const content = dynamicCollectionCommerceBridgeContentSchema.parse(dynamicSections[0].content);
    const collection = input.catalogue.collections.find((item) => item.id === content.collectionId);
    if (
      !collection ||
      canonicalValueString(content.productIds) !== canonicalValueString(collection.productIds)
    ) {
      invalid(
        "unknown-commerce-binding",
        "The dynamic collection binding conflicts with canonical collection membership.",
      );
    }
    return { collection, productIds: [...content.productIds] };
  }
  const collectionId = oneProtectedValue(
    protectedValuesFor(page, definitions, "collectionId"),
    "collection",
  );
  const collection = input.catalogue.collections.find((item) => item.id === collectionId);
  if (!collection) {
    invalid(
      "unknown-commerce-binding",
      "The existing collection binding is not in Vesko commerce.",
    );
  }
  const productIds = oneProtectedList(
    protectedValuesFor(page, definitions, "productIds"),
    "collection product list",
  );
  if (canonicalValueString(productIds) !== canonicalValueString(collection.productIds)) {
    invalid(
      "unknown-commerce-binding",
      "The existing collection product list conflicts with canonical collection membership.",
    );
  }
  return { collection, productIds };
}

function existingProductBinding(
  page: WholeStorefrontPlanningInput["draft"]["pages"][number],
  definitions: ReturnType<typeof normalizedDefinitions>,
): ExistingProductBinding {
  const dynamicSections = page.sections.filter(
    (section) => section.component === "dynamicProductDetail",
  );
  if (dynamicSections.length > 1) {
    invalid("unknown-commerce-binding", "The dynamic product binding is ambiguous.");
  }
  if (dynamicSections[0]) {
    const content = dynamicProductDetailBridgeContentSchema.parse(dynamicSections[0].content);
    return {
      productId: content.productId,
      relatedProductIds: [...content.relatedProductIds],
    };
  }
  const productId = oneProtectedValue(
    protectedValuesFor(page, definitions, "productId"),
    "product",
  );
  const relatedLists = protectedValuesFor(page, definitions, "productIds");
  if (relatedLists.length > 1) {
    invalid(
      "unknown-commerce-binding",
      "The existing related-product binding is conflicting or ambiguous.",
    );
  }
  return { productId, relatedProductIds: relatedLists[0] ? [...relatedLists[0]] : [] };
}

function validateComponentPageType(definition: ComponentDefinitionV2, pageType: PageType): boolean {
  return definition.supportedPageTypes.includes(pageType);
}

function dynamicCollectionComponent(
  pageId: string,
  collection: WholeStorefrontPlanningInput["catalogue"]["collections"][number],
  revision: string,
  definition: ComponentDefinitionV2,
  usedComponentIds: Set<string>,
  presentation: WholeStorefrontGenerationPlan["designSystemSelection"]["collectionPresentation"],
  replacementId?: string,
): ComponentInstanceV2 {
  const id = replacementId ?? generatedComponentId(pageId, definition.type, usedComponentIds);
  usedComponentIds.add(id);
  return {
    id,
    component: "dynamicCollectionCommerce",
    componentVersion: definition.version,
    variant: presentation.variant,
    content: structuredClone(dynamicCollectionCommerceDefaultContent),
    props: {
      ...structuredClone(dynamicCollectionCommerceDefaultProps),
      gridDensity: presentation.gridDensity,
      cardVariant: presentation.cardVariant,
      filterLayout: presentation.filterLayout,
    },
    styleOverrides: structuredClone(dynamicCollectionCommerceDefaultStyleOverrides),
    bindings: [
      { slotId: "primaryCollection", source: "collection", collectionId: collection.id, revision },
      {
        slotId: "collectionProducts",
        source: "productList",
        productIds: [...collection.productIds],
        revision,
      },
    ],
    assetAssignments: [],
  };
}

function dynamicProductComponent(
  pageId: string,
  productId: string,
  relatedProductIds: string[],
  revision: string,
  definition: ComponentDefinitionV2,
  usedComponentIds: Set<string>,
  presentation: WholeStorefrontGenerationPlan["designSystemSelection"]["productPresentation"],
  replacementId?: string,
): ComponentInstanceV2 {
  const id = replacementId ?? generatedComponentId(pageId, definition.type, usedComponentIds);
  usedComponentIds.add(id);
  return {
    id,
    component: "dynamicProductDetail",
    componentVersion: definition.version,
    variant: presentation.variant,
    content: structuredClone(dynamicProductDetailDefaultContent),
    props: {
      ...structuredClone(dynamicProductDetailDefaultProps),
      galleryLayout: presentation.galleryLayout,
      optionDensity: presentation.optionDensity,
      attributeLayout: presentation.attributeLayout,
      mediaTreatment: presentation.mediaTreatment,
    },
    styleOverrides: structuredClone(dynamicProductDetailDefaultStyleOverrides),
    bindings: [
      { slotId: "primaryProduct", source: "product", productId, revision },
      ...(relatedProductIds.length > 0
        ? [
            {
              slotId: "relatedProducts",
              source: "productList" as const,
              productIds: relatedProductIds,
              revision,
            },
          ]
        : []),
    ],
    assetAssignments: [],
  };
}

function assertBindingsResolve(
  bindings: readonly PresentationBinding[],
  target: WholeStorefrontGenerationTarget,
) {
  const products = new Set(target.productIds);
  const collections = new Set(target.collections.map((collection) => collection.id));
  bindings.forEach((binding) => {
    if (binding.source === "product" && !products.has(binding.productId)) {
      invalid(
        "unknown-commerce-binding",
        "A planned product binding does not resolve in Vesko commerce.",
      );
    }
    if (binding.source === "productList" && binding.productIds.some((id) => !products.has(id))) {
      invalid(
        "unknown-commerce-binding",
        "A planned product list contains an unknown Vesko product.",
      );
    }
    if (binding.source === "collection" && !collections.has(binding.collectionId)) {
      invalid(
        "unknown-commerce-binding",
        "A planned collection binding does not resolve in Vesko commerce.",
      );
    }
    if (
      binding.source === "collectionList" &&
      binding.collectionIds.some((id) => !collections.has(id))
    ) {
      invalid(
        "unknown-commerce-binding",
        "A planned collection list contains an unknown Vesko collection.",
      );
    }
  });
}

function validateAssetPlacements(
  input: WholeStorefrontPlanningInput,
  activeTargets: readonly ActiveComponentTarget[],
) {
  const placements = [...input.requiredAssetPlacements].sort(
    (left, right) =>
      left.pageId.localeCompare(right.pageId) ||
      left.componentId.localeCompare(right.componentId) ||
      left.assetSlotId.localeCompare(right.assetSlotId) ||
      left.assetId.localeCompare(right.assetId),
  );
  if (placements.length === 0) return placements;
  if (input.approvedAssetContext === null) {
    invalid("missing-required-asset-placement", "Required approved source assets are unavailable.");
  }
  const assets = new Map(input.approvedAssetContext.assets.map((asset) => [asset.assetId, asset]));
  const targets = new Map<string, ActiveComponentTarget>();
  activeTargets.forEach((target) => {
    const targetKey = `${target.pageId}:${target.componentId}`;
    if (targets.has(targetKey)) {
      invalid(
        "provider-invented-target",
        "The planned storefront contains duplicate component IDs.",
      );
    }
    targets.set(targetKey, target);
  });
  const placementIdentities = new Set<string>();
  const slotCounts = new Map<string, number>();
  placements.forEach((placement) => {
    const asset = assets.get(placement.assetId);
    if (
      !asset ||
      asset.revision !== placement.assetRevision ||
      asset.materialFingerprint !== placement.materialFingerprint ||
      asset.sourceReferenceId !== placement.sourceReferenceId
    ) {
      invalid(
        "stale-approved-asset",
        "A planned source asset is no longer approved for this storefront.",
      );
    }
    if (placement.role !== asset.role) {
      invalid(
        "asset-role-slot-incompatible",
        "The approved source asset role does not match this placement.",
      );
    }
    if (placement.role === "productMainImage" || placement.role === "productAlternativeImage") {
      invalid(
        "asset-role-slot-incompatible",
        "Public source assets cannot replace canonical Vesko product media.",
      );
    }
    const target = targets.get(`${placement.pageId}:${placement.componentId}`);
    if (!target || target.componentType !== placement.componentType) {
      invalid(
        "provider-invented-target",
        "An approved asset placement targets an unavailable component.",
      );
    }
    const slot = target.definition.assetSlots.find(
      (candidate) => candidate.id === placement.assetSlotId,
    );
    if (!slot || !slot.acceptedRoles.includes(placement.role)) {
      invalid(
        "asset-role-slot-incompatible",
        "The approved source asset is not compatible with this component slot.",
      );
    }
    const placementIdentity = `${placement.pageId}:${placement.componentId}:${placement.assetSlotId}:${placement.assetId}`;
    if (placementIdentities.has(placementIdentity)) {
      invalid(
        "asset-role-slot-incompatible",
        "The same approved asset cannot be placed in the same component slot more than once.",
      );
    }
    placementIdentities.add(placementIdentity);
    const slotKey = `${placement.pageId}:${placement.componentId}:${placement.assetSlotId}`;
    const count = (slotCounts.get(slotKey) ?? 0) + 1;
    if (slot.maxItems !== undefined && count > slot.maxItems) {
      invalid(
        "asset-role-slot-incompatible",
        "The approved asset placements exceed this component slot's maximum items.",
      );
    }
    slotCounts.set(slotKey, count);
  });
  return placements;
}

export function createWholeStorefrontGenerationPlan(
  inputValue: unknown,
  options: {
    directionId?: WholeStorefrontGenerationPlan["designSystemSelection"]["directionId"];
    tokenRefinementPlan?: RegisteredTokenRefinementPlan | null;
  } = {},
): WholeStorefrontGenerationPlan {
  const input = parsePlanningInput(inputValue);
  const tokenRefinementPlan =
    options.tokenRefinementPlan === undefined || options.tokenRefinementPlan === null
      ? null
      : registeredTokenRefinementPlanSchema.parse(options.tokenRefinementPlan);
  const tokenOnly = tokenRefinementPlan !== null;
  const target = createWholeStorefrontGenerationTarget(input);
  const definitions = normalizedDefinitions(input);
  const registry = createComponentRegistryV2(definitions);
  const commerceRevision = target.canonicalCommerceFingerprint;
  const templateCollection = input.catalogue.collections[0];
  const templateProduct = input.catalogue.products[0];
  if (!templateCollection || !templateProduct) {
    invalid(
      "missing-canonical-commerce-projection",
      "A storefront plan needs canonical products and collections.",
    );
  }
  const brandDirection = input.brief.approvedBrandDirection;
  if (brandDirection === null) {
    invalid(
      "no-approved-brief",
      "The approved Storefront Design Brief has no approved brand direction.",
    );
  }
  const selectedDirectionId =
    options.directionId ?? selectStorefrontDesignDirection(brandDirection);
  const selectedDirection = input.recipeContext.designSystem.directions.find(
    (direction) => direction.id === selectedDirectionId,
  );
  if (!selectedDirection) {
    invalid(
      "unsupported-page-family",
      "The approved design direction is unavailable in the active design system.",
    );
  }
  if (!tokenOnly) {
    assertCoordinatedDirectionCapabilities(
      selectedDirection,
      input.recipeContext.designSystem,
      definitions,
    );
  }
  const designSystemSelection = structuredClone({
    directionVersion: selectedDirection.version,
    directionId: selectedDirection.id,
    homepageRecipeId: selectedDirection.homepageRecipeId,
    collectionRecipeId: selectedDirection.collectionRecipeId,
    productRecipeId: selectedDirection.productRecipeId,
    typographyDirectionId: selectedDirection.typographyDirectionId,
    imageTreatmentId: selectedDirection.imageTreatmentId,
    productCardFamilyId: selectedDirection.productCardFamilyId,
    spacingDensity: selectedDirection.spacingDensity,
    cornerTreatment: selectedDirection.cornerTreatment,
    surfaceDepth: selectedDirection.surfaceDepth,
    componentSelections: selectedDirection.componentSelections,
    collectionPresentation: selectedDirection.collectionPresentation,
    productPresentation: selectedDirection.productPresentation,
  });
  const collectionComponentDefinition = definitionFor(definitions, "dynamicCollectionCommerce");
  const productComponentDefinition = definitionFor(definitions, "dynamicProductDetail");
  const usedComponentIds = new Set(
    input.draft.pages.flatMap((page) => page.sections.map((section) => section.id)),
  );

  const pagePlans: WholeStorefrontGenerationPlan["pagePlans"] = target.pages.map((targetPage) => {
    const page = input.draft.pages.find((candidate) => candidate.id === targetPage.id);
    if (!page) {
      invalid(
        "missing-canonical-project-target",
        "A planned storefront page is no longer available.",
      );
    }
    const collectionBinding =
      targetPage.role === "collection-template"
        ? existingCollectionBinding(page, input, definitions)
        : null;
    const productBinding =
      targetPage.role === "product-template" ? existingProductBinding(page, definitions) : null;
    const retained = page.sections
      .map((section) => {
        const instance = retainedComponent(section, definitions);
        const definition = definitionFor(definitions, instance.component);
        try {
          registry.validateInstance(instance);
        } catch (error) {
          invalid(
            "invalid-component-contract",
            error instanceof Error ? error.message : "A retained component is no longer valid.",
          );
        }
        return {
          instance,
          compatible: validateComponentPageType(definition, page.type),
        };
      })
      .sort((left, right) => left.instance.id.localeCompare(right.instance.id));
    const components: Array<
      WholeStorefrontGenerationPlan["pagePlans"][number]["components"][number]
    > = retained.map(({ instance, compatible }) => ({
      disposition: compatible ? ("retained" as const) : ("fallback-retained" as const),
      componentId: instance.id,
      component: instance.component,
      componentVersion: instance.componentVersion,
      variant: instance.variant,
      preservesExistingContent: true as const,
    }));
    if (!tokenOnly && targetPage.role === "collection-template") {
      if (collectionBinding === null) {
        invalid("unknown-commerce-binding", "The existing collection binding is unavailable.");
      }
      if (!validateComponentPageType(collectionComponentDefinition, page.type)) {
        invalid(
          "invalid-component-contract",
          "The registered dynamic collection component does not support collection pages.",
        );
      }
      const instance = dynamicCollectionComponent(
        page.id,
        collectionBinding.collection,
        commerceRevision,
        collectionComponentDefinition,
        usedComponentIds,
        designSystemSelection.collectionPresentation,
        page.sections.find((section) => section.component === "dynamicCollectionCommerce")?.id,
      );
      try {
        registry.validateInstance(instance);
      } catch (error) {
        invalid(
          "invalid-component-contract",
          error instanceof Error ? error.message : "The collection plan is invalid.",
        );
      }
      components.push({
        disposition: "replacement",
        instance,
        replacesComponentIds: page.sections
          .filter((section) =>
            dynamicCollectionReplacementComponentTypes.includes(
              section.component as (typeof dynamicCollectionReplacementComponentTypes)[number],
            ),
          )
          .map((section) => section.id)
          .sort(),
      });
    }
    if (!tokenOnly && targetPage.role === "product-template") {
      if (productBinding === null) {
        invalid("unknown-commerce-binding", "The existing product binding is unavailable.");
      }
      if (!validateComponentPageType(productComponentDefinition, page.type)) {
        invalid(
          "invalid-component-contract",
          "The registered dynamic product component does not support product pages.",
        );
      }
      const instance = dynamicProductComponent(
        page.id,
        productBinding.productId,
        productBinding.relatedProductIds,
        commerceRevision,
        productComponentDefinition,
        usedComponentIds,
        designSystemSelection.productPresentation,
        page.sections.find((section) => section.component === "dynamicProductDetail")?.id,
      );
      try {
        registry.validateInstance(instance);
      } catch (error) {
        invalid(
          "invalid-component-contract",
          error instanceof Error ? error.message : "The product plan is invalid.",
        );
      }
      components.push({
        disposition: "replacement",
        instance,
        replacesComponentIds: page.sections
          .filter((section) =>
            dynamicProductReplacementComponentTypes.includes(
              section.component as (typeof dynamicProductReplacementComponentTypes)[number],
            ),
          )
          .map((section) => section.id)
          .sort(),
      });
    }
    if (!tokenOnly && targetPage.role === "homepage") {
      components.push(
        ...requiredHomepageRecipeComponents({
          planningInput: input,
          page,
          definitions,
          registry,
          usedComponentIds,
          recipeId: designSystemSelection.homepageRecipeId,
        }),
      );
    }
    return {
      pageId: page.id,
      role: targetPage.role,
      disposition: "retained" as const,
      familyRequirements: [...FAMILY_REQUIREMENTS[targetPage.role]],
      components: components.sort((left, right) => {
        const leftId = "instance" in left ? left.instance.id : left.componentId;
        const rightId = "instance" in right ? right.instance.id : right.componentId;
        return leftId.localeCompare(rightId);
      }),
      compatibilityNotes: page.sections
        .filter((section) => {
          const definition = definitionFor(definitions, section.component);
          return !validateComponentPageType(definition, page.type);
        })
        .map(
          (section) =>
            `Existing section ${section.id} is retained as compatibility content and requires merchant review.`,
        ),
    };
  });

  const plannedRoles = new Set(pagePlans.map((page) => page.role));
  const plannedPageIds = new Set(pagePlans.map((page) => page.pageId));
  if (
    !tokenOnly &&
    input.brief.pagePlan.pageTypes.includes("collection") &&
    !plannedRoles.has("collection-template")
  ) {
    const pageId = generatedPageId("page_collection_template", plannedPageIds);
    plannedPageIds.add(pageId);
    if (!validateComponentPageType(collectionComponentDefinition, "collection")) {
      invalid(
        "invalid-component-contract",
        "The registered dynamic collection component does not support collection pages.",
      );
    }
    const instance = dynamicCollectionComponent(
      pageId,
      templateCollection,
      commerceRevision,
      collectionComponentDefinition,
      usedComponentIds,
      designSystemSelection.collectionPresentation,
    );
    try {
      registry.validateInstance(instance);
    } catch (error) {
      invalid(
        "invalid-component-contract",
        error instanceof Error ? error.message : "The new collection page plan is invalid.",
      );
    }
    pagePlans.push({
      pageId,
      role: "collection-template",
      disposition: "created",
      familyRequirements: [...FAMILY_REQUIREMENTS["collection-template"]],
      components: [{ disposition: "added", instance, replacesComponentIds: [] }],
      compatibilityNotes: [],
    });
    plannedRoles.add("collection-template");
  }
  if (
    !tokenOnly &&
    input.brief.pagePlan.pageTypes.includes("product") &&
    !plannedRoles.has("product-template")
  ) {
    const pageId = generatedPageId("page_product_template", plannedPageIds);
    plannedPageIds.add(pageId);
    if (!validateComponentPageType(productComponentDefinition, "product")) {
      invalid(
        "invalid-component-contract",
        "The registered dynamic product component does not support product pages.",
      );
    }
    const instance = dynamicProductComponent(
      pageId,
      templateProduct.id,
      input.catalogue.products.slice(1, 5).map((product) => product.id),
      commerceRevision,
      productComponentDefinition,
      usedComponentIds,
      designSystemSelection.productPresentation,
    );
    try {
      registry.validateInstance(instance);
    } catch (error) {
      invalid(
        "invalid-component-contract",
        error instanceof Error ? error.message : "The new product page plan is invalid.",
      );
    }
    pagePlans.push({
      pageId,
      role: "product-template",
      disposition: "created",
      familyRequirements: [...FAMILY_REQUIREMENTS["product-template"]],
      components: [{ disposition: "added", instance, replacesComponentIds: [] }],
      compatibilityNotes: [],
    });
  }
  pagePlans.sort((left, right) => left.pageId.localeCompare(right.pageId));

  const activeTargets: ActiveComponentTarget[] = pagePlans.flatMap((pagePlan) => {
    const targetPage = target.pages.find((page) => page.id === pagePlan.pageId);
    const pageType: PageType =
      targetPage?.type ?? (pagePlan.role === "collection-template" ? "collection" : "product");
    const replacementIds = new Set(
      pagePlan.components.flatMap((component) =>
        "instance" in component ? component.replacesComponentIds : [],
      ),
    );
    return pagePlan.components.flatMap((component) => {
      if ("instance" in component) {
        const definition = definitionFor(definitions, component.instance.component);
        if (!validateComponentPageType(definition, pageType)) {
          invalid(
            "invalid-component-contract",
            `Component ${component.instance.component} is not supported on this page type.`,
          );
        }
        return [
          {
            pageId: pagePlan.pageId,
            pageType,
            pageRole: pagePlan.role,
            componentId: component.instance.id,
            componentType: component.instance.component,
            definition,
            instance: component.instance,
          },
        ];
      }
      if (
        component.disposition === "fallback-retained" ||
        replacementIds.has(component.componentId)
      ) {
        return [];
      }
      const sourcePage = input.draft.pages.find((page) => page.id === pagePlan.pageId);
      const sourceSection = sourcePage?.sections.find(
        (section) => section.id === component.componentId,
      );
      if (!sourceSection) {
        invalid("provider-invented-target", "A retained component target is unavailable.");
      }
      const instance = retainedComponent(sourceSection, definitions);
      const definition = definitionFor(definitions, instance.component);
      if (!validateComponentPageType(definition, pageType)) {
        invalid(
          "invalid-component-contract",
          `Component ${instance.component} is not supported on this page type.`,
        );
      }
      return [
        {
          pageId: pagePlan.pageId,
          pageType,
          pageRole: pagePlan.role,
          componentId: instance.id,
          componentType: instance.component,
          definition,
          instance,
        },
      ];
    });
  });
  const activeIds = new Set<string>();
  activeTargets.forEach((target) => {
    if (activeIds.has(target.componentId)) {
      invalid(
        "provider-invented-target",
        "The planned storefront contains duplicate component IDs.",
      );
    }
    activeIds.add(target.componentId);
  });
  const canonicalCommerceBindings = activeTargets
    .flatMap((component) => component.instance.bindings)
    .sort((left, right) => canonicalValueString(left).localeCompare(canonicalValueString(right)));
  assertBindingsResolve(canonicalCommerceBindings, target);
  const approvedAssetPlacements = tokenOnly ? [] : validateAssetPlacements(input, activeTargets);
  const sharedDesignDirection = {
    brandSystemFingerprint: target.brandSystemFingerprint,
    preferredBrandColours: [...brandDirection.preferredBrandColours].sort(),
    typographyDirection: brandDirection.typographyDirection,
    visualStyleDirection: brandDirection.visualStyleDirection,
    imageryDirection: brandDirection.imageryDirection,
    toneKeywords: [...brandDirection.toneKeywords].sort(),
    consistencyRules: tokenOnly
      ? [
          "Apply only the validated colour, typography, and spacing tokens.",
          "Preserve page recipes, section order, component identities, and component variants.",
          "Preserve approved imagery, canonical bindings, navigation, content, and commerce truth.",
        ]
      : [
          "Use the shared BrandSystem for colours, typography, spacing, radius and surfaces.",
          "Use one shared header, navigation, footer, button hierarchy and heading hierarchy.",
          "Use the approved language plan and shared trust messaging across page families.",
        ],
  };
  const allComponents = pagePlans.flatMap((page) => page.components);
  const sharedChrome = {
    headerComponentIds: allComponents
      .filter((component) =>
        "instance" in component
          ? component.instance.component === "header"
          : component.component === "header",
      )
      .map((component) => ("instance" in component ? component.instance.id : component.componentId))
      .sort(),
    footerComponentIds: allComponents
      .filter((component) =>
        "instance" in component
          ? component.instance.component === "footer"
          : component.component === "footer",
      )
      .map((component) => ("instance" in component ? component.instance.id : component.componentId))
      .sort(),
    navigationItemIds: target.navigation.map((item) => item.id).sort(),
    buttonHierarchy: "shared-brand-system" as const,
    headingHierarchy: "shared-brand-system" as const,
  };
  const warnings = input.brief.unresolvedItems
    .map((message, index) => ({
      code: `brief-unresolved-${index + 1}`,
      message,
      severity: "warning" as const,
    }))
    .sort((left, right) => left.code.localeCompare(right.code));
  const retainedCompatibilityItems = allComponents.flatMap((component) => {
    if ("instance" in component || component.disposition !== "fallback-retained") return [];
    return [
      {
        code: `component-compatibility-${canonicalValueFingerprint(component.componentId).slice(-16)}`,
        message: `Existing component ${component.componentId} is retained for compatibility and needs merchant review before use.`,
        severity: "required-review" as const,
      },
    ];
  });
  const requiredMerchantReviewItems = [
    ...input.brief.materialUnresolvedBlockers.map((message, index) => ({
      code: `brief-blocker-${index + 1}`,
      message,
      severity: "required-review" as const,
    })),
    ...retainedCompatibilityItems,
  ].sort((left, right) => left.code.localeCompare(right.code));
  const navigationChanges = target.navigation.map((item) => ({
    navigationItemId: item.id,
    disposition: "retained" as const,
  }));
  const reviewSummary = {
    sharedDesignSystemChanges: sharedDesignDirection.consistencyRules,
    pages: pagePlans.map((page) => ({ pageId: page.pageId, disposition: page.disposition })),
    components: allComponents
      .map((component) => ({
        componentId: "instance" in component ? component.instance.id : component.componentId,
        component: "instance" in component ? component.instance.component : component.component,
        disposition: component.disposition,
      }))
      .sort((left, right) => left.componentId.localeCompare(right.componentId)),
    canonicalBindings: canonicalCommerceBindings,
    approvedAssetPlacements,
    protectedFactsPreserved: [
      "Canonical product identity, SKU, price, availability, variants and product media remain read-only.",
      "Canonical collection membership remains read-only.",
      "The plan does not mutate the draft, history, published snapshot or catalogue.",
    ],
    warnings,
    requiredMerchantReviewItems,
  };
  const planWithoutFingerprint = {
    schemaVersion: 1 as const,
    id: `plan_${canonicalValueFingerprint({ target: target.fingerprint, brief: input.brief.fingerprint }).slice(0, 48)}`,
    requestFingerprint: fingerprint(
      {
        target: target.fingerprint,
        briefId: input.brief.id,
        briefRevision: input.brief.revision,
        briefFingerprint: input.brief.fingerprint,
        evidenceFingerprint: input.brief.approvedEvidenceFingerprint,
        approvedAssetContextFingerprint: input.approvedAssetContext?.fingerprint ?? null,
        recipeContextFingerprint: input.recipeContext.fingerprint,
        requiredAssetPlacements: approvedAssetPlacements,
        requestClass: tokenOnly
          ? ("tokenOnlyRefinement" as const)
          : ("coordinatedStructuralDirection" as const),
        tokenRefinementPlan,
      },
      "whole-storefront-request",
    ),
    target,
    briefId: input.brief.id,
    briefRevision: input.brief.revision,
    evidenceFingerprint: input.brief.approvedEvidenceFingerprint,
    approvedAssetContextFingerprint: input.approvedAssetContext?.fingerprint ?? null,
    componentRegistryFingerprint: target.registryFingerprint,
    recipeContextFingerprint: input.recipeContext.fingerprint,
    languagePlan: {
      primaryLanguage: input.brief.languagePlan.primaryLanguage,
      selectedLanguages: canonicalLocaleOrder(input.brief.languagePlan.selectedLanguages),
      missingTranslationPolicy: "explicit-generation-or-merchant-review" as const,
    },
    requestClass: tokenOnly
      ? ("tokenOnlyRefinement" as const)
      : ("coordinatedStructuralDirection" as const),
    tokenRefinementPlan,
    designSystemSelection,
    sharedDesignDirection,
    sharedChrome,
    pagePlans,
    canonicalCommerceBindings,
    approvedAssetPlacements,
    navigationChanges,
    warnings,
    requiredMerchantReviewItems,
    reviewSummary,
  };
  return wholeStorefrontGenerationPlanSchema.parse({
    ...planWithoutFingerprint,
    fingerprint: fingerprint(planWithoutFingerprint, "whole-storefront-plan"),
  });
}

export function validateWholeStorefrontGenerationPlan(
  inputValue: unknown,
  planValue: unknown,
): WholeStorefrontGenerationPlan {
  const plan = wholeStorefrontGenerationPlanSchema.parse(planValue);
  const expected = createWholeStorefrontGenerationPlan(inputValue, {
    directionId: plan.designSystemSelection.directionId,
    tokenRefinementPlan: plan.tokenRefinementPlan,
  });
  if (canonicalValueString(plan) !== canonicalValueString(expected)) {
    invalid(
      "provider-invented-target",
      "The returned storefront plan does not match the approved structured planning request.",
    );
  }
  return plan;
}

export async function acceptWholeStorefrontPlanningResult(
  inputValue: unknown,
  result: Promise<unknown>,
  currentInput: () => unknown,
  tokenRefinementPlan: RegisteredTokenRefinementPlan | null = null,
): Promise<WholeStorefrontGenerationPlan> {
  const expected = createWholeStorefrontGenerationPlan(inputValue, {
    tokenRefinementPlan,
  });
  const received = await result;
  const current = createWholeStorefrontGenerationPlan(await currentInput(), {
    tokenRefinementPlan,
  });
  if (current.requestFingerprint !== expected.requestFingerprint) {
    invalid("stale-result", "The storefront changed while its generation plan was being prepared.");
  }
  return validateWholeStorefrontGenerationPlan(inputValue, received);
}
