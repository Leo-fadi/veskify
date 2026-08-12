import {
  registeredTokenRefinementPlanSchema,
  type RegisteredTokenRefinementPlan,
} from "@/application/storefront-design-system";
import {
  getExecutablePageBlueprintProfile,
  getCommercialCollectionSearchProfile,
  getCommercialHomepageProfile,
  getCommercialPdpProfile,
  getTemplateById,
  getTemplatePagePlan,
} from "@/application/storefront-templates/registry";
import {
  materializeExecutablePageBlueprint,
  type ExecutablePageBlueprintMaterialization,
} from "@/application/storefront-templates/profile-materializer";
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
  componentInstanceV2Schema,
  createComponentRegistryV2,
  projectBoundedParametersToComponentRuntime,
  type ComponentDefinitionV2,
  type ComponentInstanceV2,
  type PresentationBinding,
} from "@/domain/component-platform";
import {
  dynamicCommerceDesignSelectionSchema,
  materializeCurrentDynamicCommercePresentationAuthority,
  validateDynamicCommerceDesignSelection,
  type DynamicCommerceDesignSelection,
} from "@/application/dynamic-commerce-routes";
import { canonicalLocaleOrder } from "@/domain/shared";
import {
  canonicalValueFingerprint,
  canonicalValueString,
  type PageType,
} from "@/domain/storefront";
import {
  wholeStorefrontGenerationPlanSchema,
  wholeStorefrontApprovedAssetRoleSelectionsSchema,
  wholeStorefrontPageBlueprintSelectionOverridesSchema,
  wholeStorefrontPlanningInputSchema,
  type WholeStorefrontGenerationPlan,
  type WholeStorefrontGenerationPlanErrorCode,
  type WholeStorefrontGenerationTarget,
  type WholeStorefrontPlanningInput,
  type WholeStorefrontApprovedAssetRoleSelection,
  type WholeStorefrontPageBlueprintSelectionOverride,
  WholeStorefrontGenerationPlanError,
} from "./contract";
import { selectStorefrontDesignDirection } from "@/application/storefront-design-system";
import { getComponentDefinition } from "@/components/registry";
import {
  dynamicCollectionCommerceBridgeContentSchema,
  dynamicProductDetailBridgeContentSchema,
} from "@/components/registry/dynamic-commerce-bridge";
import {
  homepageCommerceBridgeComponentNames,
  homepageCommerceBridgeDefaults,
  type HomepageCommerceBridgeComponent,
} from "@/components/registry/homepage-commerce-bridge";
import { veskifyComponentCapabilityManifest } from "@/components/registry/capability-manifest";
import {
  contentSupportContentSchema,
  contentSupportStyleOverridesSchema,
} from "@/components/registry/content-support";
import { resolveCommercialSharedFrameProfile } from "@/domain/storefront/commercial-shared-frame";
import {
  commercialHomepageProfileIdSchema,
  commercialPdpProfileIdSchema,
  commercialCollectionSearchProfileIdSchema,
  resolveCommercialHomepageEvidenceAvailability,
  resolveCommercialHomepageProfileSlots,
  resolveCommercialHomepageSlotItemCardinality,
  type CommercialCollectionSearchProfileAuthority,
  type CommercialCollectionSearchProfileId,
  type CommercialHomepageProfileId,
  type CommercialPdpProfileId,
} from "@/application/storefront-templates";
import type { CommercialProductDetailProfileAuthority } from "@/application/storefront-templates/contract";

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

function roleForPage(page: WholeStorefrontPlanningInput["draft"]["pages"][number]) {
  if (page.pageFamily?.familyId === "search-results") return "other" as const;
  if (page.type === "home") return "homepage" as const;
  if (page.type === "collection") return "collection-template" as const;
  if (page.type === "product") return "product-template" as const;
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
      role: roleForPage(page),
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
  if (pages.filter((page) => page.role === "homepage").length > 1) {
    invalid("unsupported-page-family", "Only one homepage may be planned at a time.");
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
  input: WholeStorefrontPlanningInput,
  revision: string,
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
  if (section.component === "contentSupport") {
    const content = contentSupportContentSchema.parse(section.content);
    const document = input.draft.contentSupportFactDocuments.find(
      (candidate) => candidate.id === content.factDocumentId,
    );
    const locale = input.brief.languagePlan.primaryLanguage;
    if (!document || !locale) {
      invalid(
        "invalid-component-contract",
        "Retained content/support presentation requires its exact approved fact document.",
      );
    }
    return {
      ...base,
      content,
      styleOverrides: contentSupportStyleOverridesSchema.parse({
        surface: section.styleOverrides?.surface ?? "default",
      }),
      bindings: [
        {
          slotId: "supportFacts",
          source: "localizedContent",
          contentId: document.id,
          locale,
          fallbackLocale: locale,
          revision: document.fingerprint,
        },
      ],
    };
  }
  const homepageBridgeComponent = homepageCommerceBridgeComponentNames.find(
    (component): component is HomepageCommerceBridgeComponent => component === section.component,
  );
  if (homepageBridgeComponent) {
    return {
      ...base,
      content: structuredClone(section.content) as ComponentInstanceV2["content"],
      styleOverrides: { surface: "plain" },
      bindings: homepageBindings(homepageBridgeComponent, input, revision, section),
    };
  }
  if (section.component === "brandStory") {
    const approvedAssetId = section.content.approvedAssetId;
    const approvedAsset =
      typeof approvedAssetId === "string"
        ? input.approvedAssetContext?.assets.find((asset) => asset.assetId === approvedAssetId)
        : undefined;
    return {
      ...base,
      content: structuredClone(section.content) as ComponentInstanceV2["content"],
      bindings: [],
      assetAssignments: approvedAsset
        ? [
            {
              slotId: "brandStoryMedia",
              assetId: approvedAsset.assetId,
              role: approvedAsset.role,
            },
          ]
        : [],
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
  if (!family || family.anatomyId !== direction.collectionPresentation.cardVariant) {
    invalid(
      "invalid-component-contract",
      "The selected product-card family is incompatible with the collection presentation.",
    );
  }
}

function generatedId(prefix: string, identity: unknown): string {
  return `${prefix}_${canonicalValueFingerprint(identity).replaceAll("_", "-").slice(-24)}`;
}

function templateForDirection(
  directionId: WholeStorefrontGenerationPlan["designSystemSelection"]["directionId"],
) {
  return {
    premiumEditorial: "template_brand_led_editorial",
    modernTechnical: "template_catalogue_forward_commerce",
    warmApproachable: "template_balanced_commerce",
  }[directionId];
}

function resolvedWholeStorefrontBindingCategories(
  input: WholeStorefrontPlanningInput,
  pageType: "home" | "collection" | "product",
) {
  if (pageType === "home") {
    return ["navigation", "projectBrandContext", "collectionList", "productList"] as const;
  }
  if (pageType === "collection") {
    return input.catalogue.collections.length > 0 && input.catalogue.products.length > 0
      ? (["collection", "productList"] as const)
      : ([] as const);
  }
  return input.catalogue.products.length > 0 ? (["product"] as const) : ([] as const);
}

function materializeDirectionPageBlueprints(
  input: WholeStorefrontPlanningInput,
  directionId: WholeStorefrontGenerationPlan["designSystemSelection"]["directionId"],
  homepageProfileId?: CommercialHomepageProfileId,
  pdpProfileId?: CommercialPdpProfileId,
  collectionProfileId?: CommercialCollectionSearchProfileId,
  pageBlueprintSelectionOverrides: readonly WholeStorefrontPageBlueprintSelectionOverride[] = [],
) {
  const templateId = templateForDirection(directionId);
  const contextTemplate = input.recipeContext.templates.find(
    (template) => template.id === templateId,
  );
  const registeredTemplate = getTemplateById(templateId);
  if (
    !contextTemplate ||
    !registeredTemplate ||
    canonicalValueString(contextTemplate) !== canonicalValueString(registeredTemplate)
  ) {
    invalid(
      "unsupported-page-family",
      "The selected direction does not match the live registered PageBlueprint template.",
    );
  }
  return (["home", "collection", "product"] as const).map((pageType) => {
    const pagePlan =
      pageType === "home" && homepageProfileId
        ? getCommercialHomepageProfile(homepageProfileId)
        : pageType === "product" && pdpProfileId
          ? getCommercialPdpProfile(pdpProfileId)
          : pageType === "collection" && collectionProfileId
            ? getCommercialCollectionSearchProfile(collectionProfileId)
            : getTemplatePagePlan(templateId, pageType);
    if (!pagePlan) {
      invalid(
        "unsupported-page-family",
        `The selected direction has no ${pageType} PageBlueprint.`,
      );
    }
    try {
      const selectionOverride = pageBlueprintSelectionOverrides.find(
        (entry) => entry.pageType === pageType,
      );
      if (selectionOverride && selectionOverride.profileId !== pagePlan.profile?.id) {
        invalid(
          "unsupported-page-family",
          `The selected ${pageType} PageBlueprint override does not target the active profile.`,
        );
      }
      return materializeExecutablePageBlueprint({
        pagePlan,
        componentDefinitions: input.componentDefinitions,
        availableBindingCategories: resolvedWholeStorefrontBindingCategories(input, pageType),
        ...(selectionOverride ? { slotSelectionOverrides: selectionOverride.slotSelections } : {}),
      });
    } catch (cause) {
      invalid(
        "unsupported-page-family",
        `The selected ${pageType} PageBlueprint cannot be materialized from the live registry: ${cause instanceof Error ? cause.message : "unknown failure"}`,
      );
    }
  });
}

function executableHomepageAssetSlot(
  component: string,
): "heroMedia" | "promotionMedia" | "storyMedia" | "collectionMedia" | "brandStoryMedia" | null {
  if (component === "homepageHero") return "heroMedia";
  if (component === "homepagePromotion") return "promotionMedia";
  if (component === "homepageEditorial") return "storyMedia";
  if (component === "homepageFeaturedCollections" || component === "homepageCollectionNavigation") {
    return "collectionMedia";
  }
  if (component === "brandStory") return "brandStoryMedia";
  return null;
}

function validateApprovedAssetRoleSelections(input: {
  planningInput: WholeStorefrontPlanningInput;
  materializations: readonly ExecutablePageBlueprintMaterialization[];
  definitions: readonly ComponentDefinitionV2[];
  selections: readonly WholeStorefrontApprovedAssetRoleSelection[];
}): readonly WholeStorefrontApprovedAssetRoleSelection[] {
  const { planningInput, materializations, definitions, selections } = input;
  if (selections.length === 0) return [];
  const assetContext = planningInput.approvedAssetContext;
  if (!assetContext) {
    invalid(
      "missing-required-recipe-asset",
      "Exact approved asset-role selections require current approved asset authority.",
    );
  }
  const homepage = materializations.find(({ pageType }) => pageType === "home");
  if (!homepage) {
    invalid("unsupported-page-family", "Exact approved asset-role selections require a homepage.");
  }
  const supportedComponents = new Set<string>([
    ...homepageCommerceBridgeComponentNames,
    "brandStory",
  ]);
  return selections.map((selection) => {
    if (
      selection.authorityFingerprint !== assetContext.fingerprint ||
      selection.profileId !== homepage.profileId
    ) {
      invalid(
        "stale-approved-asset",
        "An exact approved asset-role selection does not target current homepage and asset authority.",
      );
    }
    const slot = homepage.slots.find(({ slotId }) => slotId === selection.slotId);
    if (
      !slot ||
      slot.component !== selection.component ||
      !supportedComponents.has(selection.component)
    ) {
      invalid(
        "provider-invented-target",
        "An exact approved asset-role selection targets an unsupported PageBlueprint slot.",
      );
    }
    const definition = definitions.find(({ type }) => type === selection.component);
    const assetSlot = definition?.assetSlots.find(({ id }) => id === selection.assetSlotId);
    const executableAssetSlotId = executableHomepageAssetSlot(selection.component);
    const anatomyVariant = definition?.commercialAnatomy?.variants.find(
      ({ variantId }) => variantId === slot.variant,
    );
    if (
      !definition ||
      executableAssetSlotId !== selection.assetSlotId ||
      !assetSlot ||
      !assetSlot.acceptedRoles.includes(selection.role) ||
      !anatomyVariant?.structure.assetPlacements.some(
        ({ slotId }) => slotId === selection.assetSlotId,
      ) ||
      (selection.component === "brandStory" && selection.role !== "editorialImage") ||
      selection.role === "productMainImage" ||
      selection.role === "productAlternativeImage"
    ) {
      invalid(
        "asset-role-slot-incompatible",
        "An exact approved asset role is not executable by the selected component variant anatomy.",
      );
    }
    const asset = assetContext.assets.find(({ assetId }) => assetId === selection.assetId);
    if (
      !asset ||
      asset.role !== selection.role ||
      asset.revision !== selection.assetRevision ||
      asset.materialFingerprint !== selection.materialFingerprint
    ) {
      invalid(
        "stale-approved-asset",
        "An exact selected asset no longer matches current approved asset authority.",
      );
    }
    return structuredClone(selection);
  });
}

function assertCommercialHomepageSelection(
  input: WholeStorefrontPlanningInput,
  profileId: CommercialHomepageProfileId,
  selection: WholeStorefrontGenerationPlan["designSystemSelection"],
) {
  const pagePlan = getCommercialHomepageProfile(profileId);
  const authority = pagePlan?.profile?.commercialHomepage;
  if (!pagePlan || !authority) {
    invalid("unsupported-page-family", `Commercial homepage profile ${profileId} is unavailable.`);
  }
  if (!input.draft.sharedFrame) {
    invalid(
      "unsupported-page-family",
      "Commercial homepage generation requires canonical snapshot-level shared-frame authority.",
    );
  }
  const frame = resolveCommercialSharedFrameProfile(input.draft.sharedFrame);
  if (!authority.compatibleSharedFrameProfileIds.includes(frame.id)) {
    invalid(
      "unsupported-page-family",
      `Commercial homepage profile ${profileId} is incompatible with shared frame ${frame.id}.`,
    );
  }
  const imagePosture = {
    premiumEditorial: "editorial",
    modernTechnical: "contained",
    warmApproachable: "editorial",
  }[selection.directionId] as "contained" | "editorial" | "immersive";
  if (
    !authority.designDnaNarrowing.spacingDensity.includes(selection.spacingDensity) ||
    !authority.designDnaNarrowing.surfaceDepth.includes(selection.surfaceDepth) ||
    !authority.designDnaNarrowing.imagePosture.includes(imagePosture)
  ) {
    invalid(
      "unsupported-page-family",
      `Commercial homepage profile ${profileId} cannot broaden the selected Design DNA.`,
    );
  }
  for (const slot of pagePlan.slots) {
    if (
      ["homepageHero", "homepageEditorial", "homepagePromotion", "homepageProof"].includes(
        slot.sectionType,
      )
    ) {
      const manifest = veskifyComponentCapabilityManifest.getByComponentType(slot.sectionType);
      const variant = manifest?.variants.find((entry) => entry.id === slot.defaultVariant);
      if (
        !manifest?.commercialAnatomy ||
        !variant ||
        variant.structuralClassification !== "meaningfulStructuralVariant"
      ) {
        invalid(
          "invalid-component-contract",
          `Commercial homepage profile ${profileId} requires current meaningful ${slot.sectionType}/${slot.defaultVariant} authority.`,
        );
      }
    }
  }
  return authority;
}

function assertCommercialPdpSelection(
  input: WholeStorefrontPlanningInput,
  profileId: CommercialPdpProfileId,
  selection: WholeStorefrontGenerationPlan["designSystemSelection"],
) {
  const pagePlan = getCommercialPdpProfile(profileId);
  const authority = pagePlan?.profile?.commercialProductDetail;
  if (!pagePlan || !authority) {
    invalid("unsupported-page-family", `Commercial PDP profile ${profileId} is unavailable.`);
  }
  assertCommercialProfileFrameAndDna(input, profileId, authority, selection, "PDP");
  const manifest = veskifyComponentCapabilityManifest.getByComponentType("dynamicProductDetail");
  const variant = manifest?.variants.find(
    (entry) => entry.id === authority.dynamicProductDetailVariant,
  );
  if (variant?.structuralClassification !== "meaningfulStructuralVariant") {
    invalid(
      "invalid-component-contract",
      `Commercial PDP profile ${profileId} requires current meaningful dynamicProductDetail/${authority.dynamicProductDetailVariant} authority.`,
    );
  }
  return authority;
}

function assertCommercialCollectionSearchSelection(
  input: WholeStorefrontPlanningInput,
  profileId: CommercialCollectionSearchProfileId,
  selection: WholeStorefrontGenerationPlan["designSystemSelection"],
) {
  const pagePlan = getCommercialCollectionSearchProfile(profileId);
  const authority = pagePlan?.profile?.commercialCollectionSearch;
  const slot = pagePlan?.slots[0];
  if (!pagePlan || !authority || !slot) {
    invalid(
      "unsupported-page-family",
      `Commercial collection/search profile ${profileId} is unavailable.`,
    );
  }
  assertCommercialProfileFrameAndDna(input, profileId, authority, selection, "collection/search");
  const manifest = veskifyComponentCapabilityManifest.getByComponentType(slot.sectionType);
  const variant = manifest?.variants.find((entry) => entry.id === slot.defaultVariant);
  if (
    !manifest?.commercialAnatomy ||
    !variant ||
    variant.structuralClassification !== "meaningfulStructuralVariant"
  ) {
    invalid(
      "invalid-component-contract",
      `Commercial collection/search profile ${profileId} requires current meaningful ${slot.sectionType}/${slot.defaultVariant} authority.`,
    );
  }
  if (
    authority.campaignEvidencePolicy === "approved-editorial-media-required" &&
    !input.approvedAssetContext?.assets.some((asset) => asset.role === "editorialImage")
  ) {
    invalid(
      "missing-required-recipe-asset",
      `Commercial collection/search profile ${profileId} requires approved editorial campaign media.`,
    );
  }
  return authority;
}

function assertCommercialProfileFrameAndDna(
  input: WholeStorefrontPlanningInput,
  profileId: string,
  authority: {
    compatibleSharedFrameProfileIds: readonly string[];
    designDnaNarrowing: {
      spacingDensity: readonly string[];
      surfaceDepth: readonly string[];
      imagePosture: readonly string[];
    };
  },
  selection: WholeStorefrontGenerationPlan["designSystemSelection"],
  family: string,
) {
  if (!input.draft.sharedFrame) {
    invalid(
      "unsupported-page-family",
      `Commercial ${family} generation requires canonical snapshot-level shared-frame authority.`,
    );
  }
  const frame = resolveCommercialSharedFrameProfile(input.draft.sharedFrame);
  if (!authority.compatibleSharedFrameProfileIds.includes(frame.id)) {
    invalid(
      "unsupported-page-family",
      `Commercial ${family} profile ${profileId} is incompatible with shared frame ${frame.id}.`,
    );
  }
  const imagePosture = {
    premiumEditorial: "editorial",
    modernTechnical: "contained",
    warmApproachable: "editorial",
  }[selection.directionId];
  if (
    !authority.designDnaNarrowing.spacingDensity.includes(selection.spacingDensity) ||
    !authority.designDnaNarrowing.surfaceDepth.includes(selection.surfaceDepth) ||
    !authority.designDnaNarrowing.imagePosture.includes(imagePosture)
  ) {
    invalid(
      "unsupported-page-family",
      `Commercial ${family} profile ${profileId} cannot broaden the selected Design DNA.`,
    );
  }
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

const legacyHomepageComponentForBridge: Readonly<
  Record<HomepageCommerceBridgeComponent, readonly string[]>
> = {
  homepageHero: ["hero"],
  homepageFeaturedCollections: ["featuredCategories"],
  homepageFeaturedProducts: ["productGrid"],
  homepageCollectionNavigation: ["featuredCategories"],
  homepagePromotion: ["brandStory", "campaignBanner"],
  homepageTrust: ["benefitIcons"],
  homepageEditorial: ["brandStory", "imageText"],
  homepageProof: [],
};

function homepageBindings(
  component: HomepageCommerceBridgeComponent,
  input: WholeStorefrontPlanningInput,
  revision: string,
  source?: WholeStorefrontPlanningInput["draft"]["pages"][number]["sections"][number],
  assetAssignments: readonly ComponentInstanceV2["assetAssignments"][number][] = [],
  allowSourceAssetFallback = true,
  itemCardinality?: Readonly<{ minimum: number; maximum: number }>,
): ComponentInstanceV2["bindings"] {
  const sourceCollectionIds = Array.isArray(source?.content.collectionIds)
    ? source.content.collectionIds.filter(
        (id): id is string =>
          typeof id === "string" &&
          input.catalogue.collections.some((collection) => collection.id === id),
      )
    : [];
  const sourceProductIds = Array.isArray(source?.content.productIds)
    ? source.content.productIds.filter(
        (id): id is string =>
          typeof id === "string" && input.catalogue.products.some((product) => product.id === id),
      )
    : [];
  const actionHref = objectValue(source?.content.cta)?.href;
  const actionNavigationItem =
    typeof actionHref === "string"
      ? [...input.draft.navigation.primary, ...input.draft.navigation.footer].find((item) => {
          if (item.target.type !== "page") return false;
          const pageId = item.target.pageId;
          return input.draft.pages.find((page) => page.id === pageId)?.slug === actionHref;
        })
      : undefined;
  const bindings: ComponentInstanceV2["bindings"] = [
    {
      slotId: "presentationContext",
      source: "projectBrandContext",
      projectId: input.project.id,
      revision,
    },
    ...(component === "homepageFeaturedCollections" || component === "homepageCollectionNavigation"
      ? [
          {
            slotId: "collections",
            source: "collectionList" as const,
            collectionIds: boundedHomepageItems(
              sourceCollectionIds,
              input.catalogue.collections.map((collection) => collection.id),
              itemCardinality,
            ),
            revision,
          },
        ]
      : []),
    ...(component === "homepageFeaturedProducts"
      ? [
          {
            slotId: "products",
            source: "productList" as const,
            productIds: boundedHomepageItems(
              sourceProductIds,
              input.catalogue.products.map((product) => product.id),
              itemCardinality,
            ),
            revision,
          },
        ]
      : []),
    ...(["homepageHero", "homepagePromotion", "homepageTrust", "homepageEditorial"].includes(
      component,
    ) && actionNavigationItem
      ? [
          {
            slotId:
              component === "homepageHero"
                ? "primaryAction"
                : component === "homepagePromotion"
                  ? "promotionAction"
                  : component === "homepageTrust"
                    ? "supportAction"
                    : "editorialAction",
            source: "navigation" as const,
            navigationId: actionNavigationItem.id,
            revision,
          },
        ]
      : []),
  ];
  const sourceAssetId = objectValue(source?.content.media)?.id ?? source?.content.approvedAssetId;
  const assignedAssetIds = assetAssignments.map((assignment) => assignment.assetId);
  const assetIds =
    assignedAssetIds.length > 0
      ? assignedAssetIds
      : allowSourceAssetFallback && typeof sourceAssetId === "string"
        ? [sourceAssetId]
        : [];
  const bindingSlots =
    component === "homepageHero"
      ? ["heroAsset"]
      : component === "homepagePromotion"
        ? ["promotionAsset"]
        : component === "homepageEditorial"
          ? ["storyPrimaryAsset", "storySecondaryAsset", "storyTertiaryAsset"]
          : [];
  assetIds.slice(0, bindingSlots.length).forEach((assetId, index) => {
    const approved = input.approvedAssetContext?.assets.find((asset) => asset.assetId === assetId);
    if (!approved) return;
    bindings.push({
      slotId: bindingSlots[index],
      source: "asset",
      assetId,
      revision: approved.revision,
    });
  });
  return bindings;
}

function objectValue(value: unknown): Record<string, unknown> | undefined {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? Object.fromEntries(Object.entries(value))
    : undefined;
}

function boundedHomepageItems<T>(
  preservedItems: readonly T[],
  canonicalFallbackItems: readonly T[],
  cardinality?: Readonly<{ minimum: number; maximum: number }>,
): T[] {
  const items =
    preservedItems.length > 0 &&
    (cardinality === undefined || preservedItems.length >= cardinality.minimum)
      ? preservedItems
      : canonicalFallbackItems;
  return cardinality === undefined ? [...items] : items.slice(0, cardinality.maximum);
}

function mappedHomepageBridgePresentation(
  component: HomepageCommerceBridgeComponent,
  source: WholeStorefrontPlanningInput["draft"]["pages"][number]["sections"][number] | undefined,
  planningInput: WholeStorefrontPlanningInput,
  productCardAnatomyId: WholeStorefrontGenerationPlan["designSystemSelection"]["collectionPresentation"]["cardVariant"],
  exactAssetSelection?: WholeStorefrontApprovedAssetRoleSelection,
) {
  const defaults = homepageCommerceBridgeDefaults[component];
  const content: Record<string, unknown> = structuredClone(defaults.content);
  const props: Record<string, unknown> = structuredClone(defaults.props);
  if (source?.component === component && component !== "homepageProof") {
    Object.assign(content, structuredClone(source.content));
    Object.assign(props, structuredClone(source.props));
  } else if (source) {
    if (component === "homepageHero") {
      content.heading = source.content.title ?? content.heading;
      if (source.content.body !== undefined) content.supportingCopy = source.content.body;
      const cta = objectValue(source.content.cta);
      if (cta?.label !== undefined) content.primaryActionLabel = cta.label;
      if (source.props.mediaPosition !== undefined) {
        props.mediaPosition = source.props.mediaPosition;
      }
    } else if (
      component === "homepageFeaturedCollections" ||
      component === "homepageCollectionNavigation" ||
      component === "homepageFeaturedProducts"
    ) {
      if (source.content.heading !== undefined) content.heading = source.content.heading;
      if (component === "homepageFeaturedProducts") {
        props.cardVariant = productCardAnatomyId;
        const columns = { two: 2, three: 3, four: 4 }[String(source.props.columns)];
        if (columns !== undefined) props.columns = columns;
      }
    } else if (component === "homepagePromotion") {
      if (source.content.heading !== undefined) content.heading = source.content.heading;
      if (source.content.body !== undefined) content.description = source.content.body;
      const cta = objectValue(source.content.cta);
      if (cta?.label !== undefined) content.actionLabel = cta.label;
      const mediaPosition = source.props.mediaPosition ?? source.props.imagePosition;
      if (mediaPosition !== undefined) props.mediaPosition = mediaPosition;
    } else if (component === "homepageTrust" && Array.isArray(source.content.benefits)) {
      const items = source.content.benefits.flatMap((benefit, index) => {
        const value = objectValue(benefit);
        const icon = value?.icon;
        if (!value || value.title === undefined || value.text === undefined) return [];
        return [
          {
            id: `benefit_${index + 1}`,
            kind: icon === "delivery" ? "delivery" : icon === "care" ? "service" : "storeSupport",
            title: value.title,
            description: value.text,
          },
        ];
      });
      if (items.length > 0) content.items = items;
    } else if (component === "homepageEditorial") {
      content.eyebrow = source.content.eyebrow ?? content.eyebrow;
      content.heading = source.content.heading ?? content.heading;
      content.body = source.content.body ?? source.content.description ?? content.body;
      const cta = objectValue(source.content.cta);
      if (cta?.label !== undefined) content.actionLabel = cta.label;
    }
  }

  if (component === "homepageProof") {
    const description = planningInput.brief.businessIdentity.shortDescription.trim();
    const sourceLocale = planningInput.brief.languagePlan.primaryLanguage ?? "en";
    content.heading = { [sourceLocale]: planningInput.brief.businessIdentity.businessName };
    content.items =
      description && planningInput.brief.approval.actorId
        ? [
            {
              id: "approved_brand_fact",
              kind: "brandFact",
              statement: { [sourceLocale]: description },
              evidence: {
                source: "merchant-approved",
                authorityId: planningInput.brief.id,
                revision: String(planningInput.brief.revision),
                status: "approved",
                approvalAuthorityId: planningInput.brief.approval.actorId,
                approvalFingerprint: planningInput.brief.approvedEvidenceFingerprint,
              },
            },
          ]
        : [];
  }

  const preferredAssetId =
    objectValue(source?.content.media)?.id ?? source?.content.approvedAssetId;
  const acceptedRoles =
    component === "homepageHero"
      ? ["heroDesktop", "heroMobile", "editorialImage"]
      : component === "homepagePromotion"
        ? ["editorialImage", "heroDesktop", "heroMobile"]
        : component === "homepageEditorial"
          ? ["editorialImage", "heroDesktop", "heroMobile"]
          : component === "homepageFeaturedCollections" ||
              component === "homepageCollectionNavigation"
            ? ["collectionImage", "editorialImage"]
            : [];
  const assetSlotId = executableHomepageAssetSlot(component);
  if (!assetSlotId) {
    if (exactAssetSelection) {
      invalid(
        "provider-invented-target",
        `Component ${component} cannot consume an exact approved asset-role selection.`,
      );
    }
    return { content, props, assetAssignments: [] };
  }
  const currentApprovedAssets = planningInput.approvedAssetContext?.assets ?? [];
  const exactlySelectedAsset = exactAssetSelection
    ? currentApprovedAssets.find(
        (asset) =>
          asset.assetId === exactAssetSelection.assetId &&
          asset.role === exactAssetSelection.role &&
          asset.revision === exactAssetSelection.assetRevision &&
          asset.materialFingerprint === exactAssetSelection.materialFingerprint,
      )
    : undefined;
  if (exactAssetSelection && !exactlySelectedAsset) {
    invalid("stale-approved-asset", "The exact selected homepage asset is no longer approved.");
  }
  const preservedPlacements =
    component === "homepageEditorial" && source?.component === "homepageEditorial"
      ? (source.approvedAssetPlacements ?? []).filter(
          (placement) => placement.assetSlotId === assetSlotId,
        )
      : [];
  const approvedAssets = exactlySelectedAsset
    ? [exactlySelectedAsset]
    : preservedPlacements.length > 0
      ? preservedPlacements.map((placement) => {
          const current = currentApprovedAssets.find(
            (asset) =>
              asset.assetId === placement.assetId &&
              asset.role === placement.role &&
              asset.revision === placement.assetRevision &&
              asset.materialFingerprint === placement.materialFingerprint &&
              asset.sourceReferenceId === placement.sourceReferenceId,
          );
          if (!current) {
            invalid(
              "stale-approved-asset",
              `Existing editorial asset placement ${placement.assetId} is stale or no longer approved.`,
            );
          }
          return current;
        })
      : currentApprovedAssets
          .filter(
            (asset) =>
              acceptedRoles.includes(asset.role) &&
              (preferredAssetId === undefined || asset.assetId === preferredAssetId),
          )
          .slice(0, component === "homepageEditorial" ? 3 : 1);
  return {
    content,
    props,
    assetAssignments: approvedAssets.map((asset) => ({
      slotId: assetSlotId,
      assetId: asset.assetId,
      role: asset.role,
    })),
  };
}

function mappedBrandStoryPresentation(
  planningInput: WholeStorefrontPlanningInput,
  exactAssetSelection?: WholeStorefrontApprovedAssetRoleSelection,
) {
  const approvedAsset = planningInput.approvedAssetContext?.assets.find((asset) =>
    exactAssetSelection
      ? asset.assetId === exactAssetSelection.assetId &&
        asset.role === exactAssetSelection.role &&
        asset.revision === exactAssetSelection.assetRevision &&
        asset.materialFingerprint === exactAssetSelection.materialFingerprint
      : asset.role === "editorialImage",
  );
  if (!approvedAsset) {
    invalid(
      "missing-required-recipe-asset",
      "Approve an editorial image before using the selected brand-story homepage profile.",
    );
  }
  const description = planningInput.brief.businessIdentity.shortDescription.trim();
  if (description.length === 0) {
    invalid(
      "missing-required-recipe-content",
      "Add an approved business description before using the selected brand-story homepage profile.",
    );
  }
  const businessName = planningInput.brief.businessIdentity.businessName;
  const sourceLocale = planningInput.brief.languagePlan.primaryLanguage ?? "en";
  return {
    content: {
      eyebrow: { [sourceLocale]: businessName },
      heading: { [sourceLocale]: businessName },
      body: { [sourceLocale]: description },
      approvedAssetId: approvedAsset.assetId,
      facts: [],
    },
    props: structuredClone(getComponentDefinition("brandStory").defaultProps),
    assetAssignments: [
      {
        slotId: "brandStoryMedia",
        assetId: approvedAsset.assetId,
        role: approvedAsset.role,
      },
    ],
  };
}

function authoritativeHomepageProfileComponents(input: {
  planningInput: WholeStorefrontPlanningInput;
  page: WholeStorefrontPlanningInput["draft"]["pages"][number];
  definitions: ReturnType<typeof normalizedDefinitions>;
  registry: ReturnType<typeof createComponentRegistryV2>;
  usedComponentIds: Set<string>;
  materialization: ExecutablePageBlueprintMaterialization;
  revision: string;
  productCardAnatomyId: WholeStorefrontGenerationPlan["designSystemSelection"]["collectionPresentation"]["cardVariant"];
  selectionOverride?: WholeStorefrontPageBlueprintSelectionOverride;
  approvedAssetRoleSelections: readonly WholeStorefrontApprovedAssetRoleSelection[];
}): WholeStorefrontGenerationPlan["pagePlans"][number]["components"] {
  const {
    planningInput,
    page,
    definitions,
    registry,
    usedComponentIds,
    materialization,
    revision,
    productCardAnatomyId,
    selectionOverride,
    approvedAssetRoleSelections,
  } = input;
  if (page.type !== "home") return [];
  const pagePlan = getExecutablePageBlueprintProfile(materialization.profileId);
  if (!pagePlan) {
    invalid("unsupported-page-family", "The authoritative homepage profile is unavailable.");
  }
  let includedCommercialSlots: ReadonlySet<string> | undefined;
  if (materialization.commercialHomepage) {
    try {
      const homepageEvidence = resolveCommercialHomepageEvidenceAvailability({
        canonicalProductCount: planningInput.catalogue.products.length,
        canonicalCollectionCount: planningInput.catalogue.collections.length,
        merchantDescription: planningInput.brief.businessIdentity.shortDescription,
        briefApprovalStatus: planningInput.brief.approval.status,
        approvedEvidenceFingerprint: planningInput.brief.approvedEvidenceFingerprint,
      });
      const resolved = resolveCommercialHomepageProfileSlots(materialization.profileId, {
        ...homepageEvidence,
        approvedMediaSlotIds: materialization.slots.flatMap((slot) => {
          const acceptedRoles = new Set(
            definitionFor(definitions, slot.component).assetSlots.flatMap(
              (assetSlot) => assetSlot.acceptedRoles,
            ),
          );
          return planningInput.approvedAssetContext?.assets.some((asset) =>
            acceptedRoles.has(asset.role),
          )
            ? [slot.slotId]
            : [];
        }),
      });
      includedCommercialSlots = new Set(resolved.includedSlotIds);
    } catch (cause) {
      invalid(
        "missing-required-recipe-content",
        cause instanceof Error
          ? cause.message
          : "The commercial homepage profile lacks required approved authority.",
      );
    }
  }
  const consumedSourceIds = new Set<string>();
  const managedSourceIds = new Set(
    page.sections
      .filter((section) =>
        homepageCommerceBridgeComponentNames.some((component) => component === section.component),
      )
      .map((section) => section.id),
  );
  const consumedAssetSelectionTargets = new Set<string>();
  const selectionTarget = (selection: WholeStorefrontApprovedAssetRoleSelection) =>
    `${selection.profileId}:${selection.slotId}:${selection.component}:${selection.assetSlotId}`;
  const selectedComponents: WholeStorefrontGenerationPlan["pagePlans"][number]["components"] =
    materialization.slots.flatMap((slot) => {
      const definition = definitionFor(definitions, slot.component);
      const legacyDefinition = getComponentDefinition(slot.component);
      if (
        (slot.component === "header" || slot.component === "footer") &&
        (planningInput.draft.sharedFrame !== undefined ||
          page.sections.some((section) => section.component === slot.component))
      ) {
        return [];
      }
      const bridgeComponent = homepageCommerceBridgeComponentNames.find(
        (component): component is HomepageCommerceBridgeComponent => component === slot.component,
      );
      const replacementSource = bridgeComponent
        ? page.sections.find(
            (section) =>
              !consumedSourceIds.has(section.id) &&
              (section.component === slot.component ||
                legacyHomepageComponentForBridge[bridgeComponent].includes(section.component)),
          )
        : undefined;
      const profileSlot = pagePlan.slots.find((candidate) => candidate.id === slot.slotId);
      if (!profileSlot) {
        invalid(
          "unsupported-page-family",
          `The authoritative homepage profile is missing slot ${slot.slotId}.`,
        );
      }
      if (includedCommercialSlots && !includedCommercialSlots.has(slot.slotId)) return [];
      if (!replacementSource && !profileSlot.required) {
        if (profileSlot.omitWhen === "when-not-requested") return [];
        if (
          profileSlot.omitWhen === "when-evidence-is-unavailable" &&
          planningInput.brief.businessIdentity.shortDescription.trim().length === 0
        ) {
          return [];
        }
        if (
          profileSlot.omitWhen === "when-imagery-is-unavailable" &&
          !planningInput.approvedAssetContext?.assets.some(
            (asset) => asset.role === "editorialImage",
          )
        ) {
          return [];
        }
      }
      if (replacementSource) consumedSourceIds.add(replacementSource.id);
      const exactAssetSelection = approvedAssetRoleSelections.find(
        (selection) =>
          selection.profileId === materialization.profileId &&
          selection.slotId === slot.slotId &&
          selection.component === slot.component,
      );
      if (exactAssetSelection) {
        consumedAssetSelectionTargets.add(selectionTarget(exactAssetSelection));
      }
      const componentId =
        replacementSource?.id ?? generatedComponentId(page.id, slot.component, usedComponentIds);
      usedComponentIds.add(componentId);
      const mappedPresentation = bridgeComponent
        ? mappedHomepageBridgePresentation(
            bridgeComponent,
            replacementSource,
            planningInput,
            productCardAnatomyId,
            exactAssetSelection,
          )
        : slot.component === "brandStory"
          ? mappedBrandStoryPresentation(planningInput, exactAssetSelection)
          : {
              content: legacyDefinition.defaultContent,
              props: legacyDefinition.defaultProps,
              assetAssignments: [],
            };
      const mappedAssetAssignments =
        (bridgeComponent === "homepageEditorial" && slot.variant === "continuationCta") ||
        (bridgeComponent === "homepageHero" && slot.variant === "restrained")
          ? []
          : mappedPresentation.assetAssignments;
      const mappedProps: Record<string, unknown> = Object.fromEntries(
        Object.entries(mappedPresentation.props),
      );
      const mappedContent: Record<string, unknown> = Object.fromEntries(
        Object.entries(mappedPresentation.content),
      );
      const parameterProjection = projectBoundedParametersToComponentRuntime(
        slot.component,
        selectionOverride?.slotSelections.find(({ slotId }) => slotId === slot.slotId)
          ?.boundedParameters ?? {},
      );
      if (!parameterProjection) {
        invalid(
          "invalid-component-contract",
          `The selected bounded parameters for ${slot.component} have no current renderer projection.`,
        );
      }
      Object.assign(mappedProps, parameterProjection.props);
      if (bridgeComponent === "homepageHero" && slot.variant === "campaignMerchandising") {
        const locale = planningInput.brief.languagePlan.primaryLanguage ?? "en";
        mappedContent.eyebrow = {
          [locale]: planningInput.brief.businessIdentity.businessName,
        };
      }
      if (bridgeComponent === "homepageEditorial" && slot.variant === "craftProcess") {
        const locale = planningInput.brief.languagePlan.primaryLanguage ?? "en";
        mappedContent.steps = [
          {
            id: "approved_process_context",
            title: { [locale]: planningInput.brief.businessIdentity.businessName },
            description: {
              [locale]: planningInput.brief.businessIdentity.shortDescription.trim(),
            },
          },
        ];
      }
      if (
        bridgeComponent === "homepageHero" &&
        (slot.variant === "fullBleedOverlay" || slot.variant === "fullBleed")
      ) {
        mappedProps.mediaPosition = "background";
      }
      const itemCardinality = materialization.commercialHomepage
        ? slot.component === "homepageFeaturedProducts"
          ? resolveCommercialHomepageSlotItemCardinality(
              materialization.profileId,
              slot.slotId,
              "products",
              planningInput.catalogue.products.length,
            )
          : slot.component === "homepageFeaturedCollections" ||
              slot.component === "homepageCollectionNavigation"
            ? resolveCommercialHomepageSlotItemCardinality(
                materialization.profileId,
                slot.slotId,
                "collections",
                planningInput.catalogue.collections.length,
              )
            : undefined
        : undefined;
      const instance = componentInstanceV2Schema.parse({
        id: componentId,
        component: slot.component,
        componentVersion: definition.version,
        variant: slot.variant,
        content: mappedContent,
        props: mappedProps,
        styleOverrides: {
          ...(bridgeComponent ? { surface: "plain" } : {}),
          ...parameterProjection.styleOverrides,
        },
        bindings: bridgeComponent
          ? homepageBindings(
              bridgeComponent,
              planningInput,
              revision,
              replacementSource,
              mappedAssetAssignments,
              !(
                (bridgeComponent === "homepageEditorial" && slot.variant === "continuationCta") ||
                (bridgeComponent === "homepageHero" && slot.variant === "restrained")
              ),
              itemCardinality,
            )
          : [],
        assetAssignments: mappedAssetAssignments,
      });
      try {
        registry.validateInstance(instance);
      } catch (error) {
        invalid(
          "invalid-component-contract",
          error instanceof Error
            ? error.message
            : `The authoritative ${slot.component} profile component is invalid.`,
        );
      }
      return [
        {
          disposition: replacementSource ? ("replacement" as const) : ("added" as const),
          instance,
          replacesComponentIds: replacementSource ? [replacementSource.id] : [],
          pageBlueprintSlotId: slot.slotId,
        },
      ];
    });
  const unconsumedSelection = approvedAssetRoleSelections.find(
    (selection) => !consumedAssetSelectionTargets.has(selectionTarget(selection)),
  );
  if (unconsumedSelection) {
    invalid(
      "provider-invented-target",
      `Exact approved asset selection for ${unconsumedSelection.slotId} was not materialized.`,
    );
  }
  const removedComponents: WholeStorefrontGenerationPlan["pagePlans"][number]["components"] =
    // Profile-managed bridge sections that are not selected by the new executable
    // materialization must not remain as accidental page-body authority.
    [...managedSourceIds]
      .filter((id) => !consumedSourceIds.has(id))
      .map((componentId) => {
        const section = page.sections.find((candidate) => candidate.id === componentId)!;
        return {
          disposition: "removed" as const,
          componentId,
          component: section.component,
          componentVersion: definitionFor(definitions, section.component).version,
          variant: section.variant,
        };
      });
  return [...selectedComponents, ...removedComponents];
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
  commercialProfile?: Readonly<{
    authority: CommercialCollectionSearchProfileAuthority;
    variant: string;
    approvedAssetContext: WholeStorefrontPlanningInput["approvedAssetContext"];
  }>,
  replacementId?: string,
): ComponentInstanceV2 {
  const id = replacementId ?? generatedComponentId(pageId, definition.type, usedComponentIds);
  usedComponentIds.add(id);
  const campaignAsset =
    commercialProfile?.authority.campaignEvidencePolicy === "approved-editorial-media-required"
      ? commercialProfile.approvedAssetContext?.assets.find(
          (asset) => asset.role === "editorialImage",
        )
      : undefined;
  if (
    commercialProfile?.authority.campaignEvidencePolicy === "approved-editorial-media-required" &&
    !campaignAsset
  ) {
    invalid(
      "missing-required-recipe-asset",
      "Campaign-led collection discovery requires approved editorial media.",
    );
  }
  return {
    id,
    component: "dynamicCollectionCommerce",
    componentVersion: definition.version,
    variant: commercialProfile?.variant ?? presentation.variant,
    content: structuredClone(dynamicCollectionCommerceDefaultContent),
    props: {
      ...structuredClone(dynamicCollectionCommerceDefaultProps),
      gridDensity: commercialProfile?.authority.gridDensity ?? presentation.gridDensity,
      cardVariant: commercialProfile?.authority.productCardAnatomyId ?? presentation.cardVariant,
      filterLayout: commercialProfile?.authority.filterLayout ?? presentation.filterLayout,
      showChildCollections:
        commercialProfile?.authority.childCollectionTreatment === "omit"
          ? false
          : dynamicCollectionCommerceDefaultProps.showChildCollections,
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
    assetAssignments: campaignAsset
      ? [
          {
            slotId: "collectionCommerceMedia",
            assetId: campaignAsset.assetId,
            role: campaignAsset.role,
          },
        ]
      : [],
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
  commercialPdp?: CommercialProductDetailProfileAuthority,
  exactVariant?: string,
): ComponentInstanceV2 {
  const id = replacementId ?? generatedComponentId(pageId, definition.type, usedComponentIds);
  usedComponentIds.add(id);
  return {
    id,
    component: "dynamicProductDetail",
    componentVersion: definition.version,
    variant: exactVariant ?? commercialPdp?.dynamicProductDetailVariant ?? presentation.variant,
    content: structuredClone(dynamicProductDetailDefaultContent),
    props: {
      ...structuredClone(dynamicProductDetailDefaultProps),
      galleryLayout:
        commercialPdp?.dynamicProductDetailProps.galleryLayout ?? presentation.galleryLayout,
      optionDensity:
        commercialPdp?.dynamicProductDetailProps.optionDensity ?? presentation.optionDensity,
      attributeLayout:
        commercialPdp?.dynamicProductDetailProps.attributeLayout ?? presentation.attributeLayout,
      showDescription:
        commercialPdp?.dynamicProductDetailProps.showDescription ??
        dynamicProductDetailDefaultProps.showDescription,
      showSku:
        commercialPdp?.dynamicProductDetailProps.showSku ??
        dynamicProductDetailDefaultProps.showSku,
      stickyMobileAction:
        commercialPdp?.dynamicProductDetailProps.stickyMobileAction ??
        dynamicProductDetailDefaultProps.stickyMobileAction,
      mediaTreatment:
        commercialPdp?.dynamicProductDetailProps.mediaTreatment ?? presentation.mediaTreatment,
      relatedCardVariant:
        commercialPdp?.relatedProductCardAnatomyId ??
        (presentation.variant === "compact"
          ? "horizontal"
          : presentation.variant === "editorial" || presentation.variant === "editorialSplit"
            ? "editorial"
            : presentation.variant === "galleryDominant"
              ? "imageFirst"
              : "standard"),
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
  const explicitIdentities = new Set<string>();
  input.requiredAssetPlacements.forEach((placement) => {
    const identity = `${placement.pageId}:${placement.componentId}:${placement.assetSlotId}:${placement.assetId}`;
    if (explicitIdentities.has(identity)) {
      invalid(
        "asset-role-slot-incompatible",
        "The same approved asset cannot be placed in the same component slot more than once.",
      );
    }
    explicitIdentities.add(identity);
  });
  const explicit = new Map(
    input.requiredAssetPlacements.map((placement) => [
      `${placement.pageId}:${placement.componentId}:${placement.assetSlotId}:${placement.assetId}`,
      placement,
    ]),
  );
  const approvedAssets = new Map(
    (input.approvedAssetContext?.assets ?? []).map((asset) => [asset.assetId, asset]),
  );
  activeTargets.forEach((target) => {
    target.instance.assetAssignments.forEach((assignment) => {
      const asset = approvedAssets.get(assignment.assetId);
      if (!asset) return;
      const identity = `${target.pageId}:${target.componentId}:${assignment.slotId}:${assignment.assetId}`;
      if (explicit.has(identity)) return;
      const slot = target.definition.assetSlots.find(
        (candidate) => candidate.id === assignment.slotId,
      );
      if (!slot) return;
      explicit.set(identity, {
        type: "PLACE_APPROVED_SOURCE_ASSET",
        pageId: target.pageId,
        componentId: target.componentId,
        componentType: target.componentType,
        assetSlotId: assignment.slotId,
        assetId: assignment.assetId,
        role: assignment.role,
        assetRevision: asset.revision,
        materialFingerprint: asset.materialFingerprint,
        sourceReferenceId: asset.sourceReferenceId,
        sourceProvenanceKind:
          asset.provenance.location === "merchant-upload"
            ? ("merchantProvided" as const)
            : ("sourceDiscovered" as const),
        required: slot.required,
      });
    });
  });
  const placements = [...explicit.values()].sort(
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
      asset.sourceReferenceId !== placement.sourceReferenceId ||
      (placement.sourceProvenanceKind !== undefined &&
        placement.sourceProvenanceKind !==
          (asset.provenance.location === "merchant-upload"
            ? "merchantProvided"
            : "sourceDiscovered"))
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
    if (
      target.componentType === "homepageFeaturedProducts" &&
      placement.assetSlotId === "productMedia"
    ) {
      invalid(
        "asset-role-slot-incompatible",
        "Approved source assets cannot target commerce-owned homepage product media.",
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

export type WholeStorefrontGenerationPlanOptions = Readonly<{
  directionId?: WholeStorefrontGenerationPlan["designSystemSelection"]["directionId"];
  homepageProfileId?: CommercialHomepageProfileId;
  pdpProfileId?: CommercialPdpProfileId;
  collectionProfileId?: CommercialCollectionSearchProfileId;
  designSystemNarrowing?: Readonly<{
    spacingDensity: "compact" | "standard" | "spacious";
    surfaceDepth: "flat" | "subtle" | "layered";
  }>;
  tokenRefinementPlan?: RegisteredTokenRefinementPlan | null;
  pageBlueprintSelectionOverrides?: readonly WholeStorefrontPageBlueprintSelectionOverride[];
  approvedAssetRoleSelections?: readonly WholeStorefrontApprovedAssetRoleSelection[];
  dynamicCommerceSelection?: DynamicCommerceDesignSelection | null;
}>;

export function createWholeStorefrontGenerationPlan(
  inputValue: unknown,
  options: WholeStorefrontGenerationPlanOptions = {},
): WholeStorefrontGenerationPlan {
  const input = parsePlanningInput(inputValue);
  const pageBlueprintSelectionOverrides = [
    ...wholeStorefrontPageBlueprintSelectionOverridesSchema.parse(
      options.pageBlueprintSelectionOverrides ?? [],
    ),
  ]
    .sort((left, right) => left.pageType.localeCompare(right.pageType))
    .map((entry) => ({
      ...structuredClone(entry),
      slotSelections: [...entry.slotSelections].sort((left, right) =>
        left.slotId.localeCompare(right.slotId),
      ),
    }));
  const requestedApprovedAssetRoleSelections = [
    ...wholeStorefrontApprovedAssetRoleSelectionsSchema.parse(
      options.approvedAssetRoleSelections ?? [],
    ),
  ].sort(
    (left, right) =>
      left.profileId.localeCompare(right.profileId) ||
      left.slotId.localeCompare(right.slotId) ||
      left.component.localeCompare(right.component) ||
      left.assetSlotId.localeCompare(right.assetSlotId),
  );
  const tokenRefinementPlan =
    options.tokenRefinementPlan === undefined || options.tokenRefinementPlan === null
      ? null
      : registeredTokenRefinementPlanSchema.parse(options.tokenRefinementPlan);
  const tokenOnly = tokenRefinementPlan !== null;
  const dynamicCommerceSelection =
    options.dynamicCommerceSelection === undefined || options.dynamicCommerceSelection === null
      ? null
      : dynamicCommerceDesignSelectionSchema.parse(
          validateDynamicCommerceDesignSelection(
            input.draft,
            input.catalogue,
            options.dynamicCommerceSelection,
            input.draft.dynamicCommercePresentation ??
              materializeCurrentDynamicCommercePresentationAuthority(input.draft, input.catalogue),
          ),
        );
  if (
    tokenOnly &&
    (pageBlueprintSelectionOverrides.length > 0 ||
      requestedApprovedAssetRoleSelections.length > 0 ||
      dynamicCommerceSelection)
  ) {
    invalid(
      "invalid-component-contract",
      "Token-only refinement cannot carry structural PageBlueprint or dynamic-commerce selections.",
    );
  }
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
    spacingDensity:
      options.designSystemNarrowing?.spacingDensity ?? selectedDirection.spacingDensity,
    cornerTreatment: selectedDirection.cornerTreatment,
    surfaceDepth: options.designSystemNarrowing?.surfaceDepth ?? selectedDirection.surfaceDepth,
    componentSelections: selectedDirection.componentSelections,
    collectionPresentation: selectedDirection.collectionPresentation,
    productPresentation: selectedDirection.productPresentation,
  });
  const commercialHomepageAuthority = options.homepageProfileId
    ? assertCommercialHomepageSelection(input, options.homepageProfileId, designSystemSelection)
    : undefined;
  const commercialPdpAuthority = options.pdpProfileId
    ? assertCommercialPdpSelection(input, options.pdpProfileId, designSystemSelection)
    : undefined;
  const commercialCollectionSearchAuthority = options.collectionProfileId
    ? assertCommercialCollectionSearchSelection(
        input,
        options.collectionProfileId,
        designSystemSelection,
      )
    : undefined;
  const pageBlueprintMaterializations = materializeDirectionPageBlueprints(
    input,
    designSystemSelection.directionId,
    options.homepageProfileId,
    options.pdpProfileId,
    options.collectionProfileId,
    pageBlueprintSelectionOverrides,
  );
  const approvedAssetRoleSelections = validateApprovedAssetRoleSelections({
    planningInput: input,
    materializations: pageBlueprintMaterializations,
    definitions,
    selections: requestedApprovedAssetRoleSelections,
  });
  const commercialCollectionProfileVariant = pageBlueprintMaterializations
    .find(({ pageType }) => pageType === "collection")
    ?.slots.find(({ component }) => component === "dynamicCollectionCommerce")?.variant;
  const commercialPdpProfileVariant = pageBlueprintMaterializations
    .find(({ pageType }) => pageType === "product")
    ?.slots.find(({ component }) => component === "dynamicProductDetail")?.variant;
  if (commercialCollectionSearchAuthority && !commercialCollectionProfileVariant) {
    invalid(
      "unsupported-page-family",
      "Commercial collection/search profile is missing its registered component slot.",
    );
  }
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
        const instance = retainedComponent(section, definitions, input, commerceRevision);
        const definition = definitionFor(definitions, instance.component);
        try {
          registry.validateInstance(instance);
        } catch (error) {
          invalid(
            "invalid-component-contract",
            error instanceof Error
              ? `Retained ${instance.component}: ${error.message}`
              : "A retained component is no longer valid.",
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
        commercialCollectionSearchAuthority && commercialCollectionProfileVariant
          ? {
              authority: commercialCollectionSearchAuthority,
              variant: commercialCollectionProfileVariant,
              approvedAssetContext: input.approvedAssetContext,
            }
          : undefined,
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
        commercialPdpAuthority,
        commercialPdpProfileVariant,
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
      const homepageMaterialization = pageBlueprintMaterializations.find(
        (entry) => entry.pageType === "home",
      );
      if (!homepageMaterialization) {
        invalid(
          "unsupported-page-family",
          "The selected direction has no authoritative homepage PageBlueprint materialization.",
        );
      }
      components.push(
        ...authoritativeHomepageProfileComponents({
          planningInput: input,
          page,
          definitions,
          registry,
          usedComponentIds,
          materialization: homepageMaterialization,
          revision: commerceRevision,
          productCardAnatomyId:
            commercialHomepageAuthority?.productCardAnatomyId ??
            designSystemSelection.collectionPresentation.cardVariant,
          selectionOverride: pageBlueprintSelectionOverrides.find(
            ({ pageType }) => pageType === "home",
          ),
          approvedAssetRoleSelections,
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
      commercialCollectionSearchAuthority && commercialCollectionProfileVariant
        ? {
            authority: commercialCollectionSearchAuthority,
            variant: commercialCollectionProfileVariant,
            approvedAssetContext: input.approvedAssetContext,
          }
        : undefined,
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
      undefined,
      commercialPdpAuthority,
      commercialPdpProfileVariant,
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
        component.disposition === "removed" ||
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
      const instance = retainedComponent(sourceSection, definitions, input, commerceRevision);
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
        // Only caller-supplied requirements belong to the provider request identity.
        // The full, direction-specific placement projection remains fingerprinted by
        // the resulting plan below; including it here would make a valid selected
        // direction appear to answer a different request.
        requiredAssetPlacements: [...input.requiredAssetPlacements].sort(
          (left, right) =>
            left.pageId.localeCompare(right.pageId) ||
            left.componentId.localeCompare(right.componentId) ||
            left.assetSlotId.localeCompare(right.assetSlotId) ||
            left.assetId.localeCompare(right.assetId),
        ),
        requestClass: tokenOnly
          ? ("tokenOnlyRefinement" as const)
          : ("coordinatedStructuralDirection" as const),
        tokenRefinementPlan,
        homepageProfileId: options.homepageProfileId ?? null,
        pdpProfileId: options.pdpProfileId ?? null,
        collectionProfileId: options.collectionProfileId ?? null,
        pageBlueprintSelectionOverrides,
        approvedAssetRoleSelections,
        dynamicCommerceSelection,
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
    pageBlueprintMaterializations,
    pageBlueprintSelectionOverrides,
    approvedAssetRoleSelections,
    dynamicCommerceSelection,
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
  const homepageMaterialization = plan.pageBlueprintMaterializations.find(
    (entry) => entry.pageType === "home",
  );
  const productMaterialization = plan.pageBlueprintMaterializations.find(
    (entry) => entry.pageType === "product",
  );
  const collectionMaterialization = plan.pageBlueprintMaterializations.find(
    (entry) => entry.pageType === "collection",
  );
  const expected = createWholeStorefrontGenerationPlan(inputValue, {
    directionId: plan.designSystemSelection.directionId,
    designSystemNarrowing: {
      spacingDensity: plan.designSystemSelection.spacingDensity,
      surfaceDepth: plan.designSystemSelection.surfaceDepth,
    },
    ...(homepageMaterialization?.commercialHomepage
      ? {
          homepageProfileId: commercialHomepageProfileIdSchema.parse(
            homepageMaterialization.profileId,
          ),
        }
      : {}),
    ...(productMaterialization?.commercialProductDetail
      ? {
          pdpProfileId: commercialPdpProfileIdSchema.parse(productMaterialization.profileId),
        }
      : {}),
    ...(collectionMaterialization?.commercialCollectionSearch
      ? {
          collectionProfileId: commercialCollectionSearchProfileIdSchema.parse(
            collectionMaterialization.profileId,
          ),
        }
      : {}),
    tokenRefinementPlan: plan.tokenRefinementPlan,
    pageBlueprintSelectionOverrides: plan.pageBlueprintSelectionOverrides,
    approvedAssetRoleSelections: plan.approvedAssetRoleSelections,
    dynamicCommerceSelection: plan.dynamicCommerceSelection,
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
  directionId?: WholeStorefrontGenerationPlan["designSystemSelection"]["directionId"],
): Promise<WholeStorefrontGenerationPlan> {
  const options = directionId === undefined ? { tokenRefinementPlan } : { directionId };
  const expected = createWholeStorefrontGenerationPlan(inputValue, options);
  const received = await result;
  const current = createWholeStorefrontGenerationPlan(await currentInput(), options);
  if (current.requestFingerprint !== expected.requestFingerprint) {
    invalid("stale-result", "The storefront changed while its generation plan was being prepared.");
  }
  const validated = validateWholeStorefrontGenerationPlan(inputValue, received);
  if (directionId !== undefined && validated.fingerprint !== expected.fingerprint) {
    invalid(
      "provider-invented-target",
      "The returned storefront direction does not match the governed planning authority.",
    );
  }
  return validated;
}
