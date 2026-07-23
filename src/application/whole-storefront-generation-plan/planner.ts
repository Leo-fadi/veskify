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
  type ComponentInstanceV2,
  type PresentationBinding,
} from "@/domain/component-platform";
import { canonicalLocaleOrder } from "@/domain/shared";
import { canonicalValueFingerprint, canonicalValueString } from "@/domain/storefront";
import {
  wholeStorefrontGenerationPlanSchema,
  wholeStorefrontPlanningInputSchema,
  type WholeStorefrontGenerationPlan,
  type WholeStorefrontGenerationPlanErrorCode,
  type WholeStorefrontGenerationTarget,
  type WholeStorefrontPlanningInput,
  WholeStorefrontGenerationPlanError,
} from "./contract";

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
  return {
    id: section.id,
    component: section.component,
    componentVersion: definition.version,
    variant: section.variant,
    content: structuredClone(section.content) as ComponentInstanceV2["content"],
    props: structuredClone(section.props) as ComponentInstanceV2["props"],
    styleOverrides: {},
    bindings: [],
    assetAssignments: [],
  };
}

function dynamicCollectionComponent(
  pageId: string,
  collection: WholeStorefrontPlanningInput["catalogue"]["collections"][number],
  revision: string,
): ComponentInstanceV2 {
  return {
    id: `plan_${pageId}_collection_commerce`,
    component: "dynamicCollectionCommerce",
    componentVersion: { major: 2, minor: 0, patch: 0 },
    variant: "standard",
    content: structuredClone(dynamicCollectionCommerceDefaultContent),
    props: structuredClone(dynamicCollectionCommerceDefaultProps),
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
): ComponentInstanceV2 {
  return {
    id: `plan_${pageId}_product_detail`,
    component: "dynamicProductDetail",
    componentVersion: { major: 2, minor: 0, patch: 0 },
    variant: "balanced",
    content: structuredClone(dynamicProductDetailDefaultContent),
    props: structuredClone(dynamicProductDetailDefaultProps),
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
  planComponents: readonly { pageId: string; instance: ComponentInstanceV2 }[],
  definitions: ReturnType<typeof normalizedDefinitions>,
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
    const component = planComponents.find(
      (candidate) =>
        candidate.pageId === placement.pageId && candidate.instance.id === placement.componentId,
    )?.instance;
    if (!component || component.component !== placement.componentType) {
      invalid(
        "provider-invented-target",
        "An approved asset placement targets an unavailable component.",
      );
    }
    const definition = definitions.find((candidate) => candidate.type === component.component);
    const slot = definition?.assetSlots.find((candidate) => candidate.id === placement.assetSlotId);
    if (!slot || !slot.acceptedRoles.includes(placement.role)) {
      invalid(
        "asset-role-slot-incompatible",
        "The approved source asset is not compatible with this component slot.",
      );
    }
  });
  return placements;
}

export function createWholeStorefrontGenerationPlan(
  inputValue: unknown,
): WholeStorefrontGenerationPlan {
  const input = parsePlanningInput(inputValue);
  const target = createWholeStorefrontGenerationTarget(input);
  const definitions = normalizedDefinitions(input);
  const registry = createComponentRegistryV2(definitions);
  const commerceRevision = target.canonicalCommerceFingerprint;
  const firstCollection = input.catalogue.collections[0];
  const firstProduct = input.catalogue.products[0];
  if (!firstCollection || !firstProduct) {
    invalid(
      "missing-canonical-commerce-projection",
      "A storefront plan needs canonical products and collections.",
    );
  }

  const pagePlans: WholeStorefrontGenerationPlan["pagePlans"] = target.pages.map((targetPage) => {
    const page = input.draft.pages.find((candidate) => candidate.id === targetPage.id)!;
    const retained = page.sections
      .map((section) => retainedComponent(section, definitions))
      .sort((left, right) => left.id.localeCompare(right.id));
    try {
      retained.forEach((instance) => registry.validateInstance(instance));
    } catch (error) {
      invalid(
        "invalid-component-contract",
        error instanceof Error ? error.message : "A retained component is no longer valid.",
      );
    }
    const components: Array<
      WholeStorefrontGenerationPlan["pagePlans"][number]["components"][number]
    > = retained.map((instance) => ({
      disposition: "retained" as const,
      componentId: instance.id,
      component: instance.component,
      componentVersion: instance.componentVersion,
      variant: instance.variant,
      preservesExistingContent: true as const,
    }));
    if (targetPage.role === "collection-template") {
      const instance = dynamicCollectionComponent(page.id, firstCollection, commerceRevision);
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
            ["collectionHeader", "filterBar", "productGrid"].includes(section.component),
          )
          .map((section) => section.id)
          .sort(),
      });
    }
    if (targetPage.role === "product-template") {
      const instance = dynamicProductComponent(
        page.id,
        firstProduct.id,
        input.catalogue.products.slice(1, 5).map((product) => product.id),
        commerceRevision,
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
            ["productGallery", "productInfo", "productOptions"].includes(section.component),
          )
          .map((section) => section.id)
          .sort(),
      });
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
        .filter(
          (section) => !definitions.some((definition) => definition.type === section.component),
        )
        .map((section) => `Retain unsupported existing section ${section.id} without replacement.`),
    };
  });

  const plannedRoles = new Set(pagePlans.map((page) => page.role));
  if (
    input.brief.pagePlan.pageTypes.includes("collection") &&
    !plannedRoles.has("collection-template")
  ) {
    const pageId = "page_collection_template";
    const instance = dynamicCollectionComponent(pageId, firstCollection, commerceRevision);
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
  if (input.brief.pagePlan.pageTypes.includes("product") && !plannedRoles.has("product-template")) {
    const pageId = "page_product_template";
    const instance = dynamicProductComponent(
      pageId,
      firstProduct.id,
      input.catalogue.products.slice(1, 5).map((product) => product.id),
      commerceRevision,
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

  const componentInstances = pagePlans.flatMap((page) =>
    page.components.flatMap((component) =>
      "instance" in component ? [{ pageId: page.pageId, instance: component.instance }] : [],
    ),
  );
  const canonicalCommerceBindings = componentInstances
    .flatMap((component) => component.instance.bindings)
    .sort((left, right) => canonicalValueString(left).localeCompare(canonicalValueString(right)));
  assertBindingsResolve(canonicalCommerceBindings, target);
  const approvedAssetPlacements = validateAssetPlacements(input, componentInstances, definitions);
  const brandDirection = input.brief.approvedBrandDirection;
  if (brandDirection === null) {
    invalid(
      "no-approved-brief",
      "The approved Storefront Design Brief has no approved brand direction.",
    );
  }
  const sharedDesignDirection = {
    brandSystemFingerprint: target.brandSystemFingerprint,
    preferredBrandColours: [...brandDirection.preferredBrandColours].sort(),
    typographyDirection: brandDirection.typographyDirection,
    visualStyleDirection: brandDirection.visualStyleDirection,
    imageryDirection: brandDirection.imageryDirection,
    toneKeywords: [...brandDirection.toneKeywords].sort(),
    consistencyRules: [
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
  const requiredMerchantReviewItems = input.brief.materialUnresolvedBlockers
    .map((message, index) => ({
      code: `brief-blocker-${index + 1}`,
      message,
      severity: "required-review" as const,
    }))
    .sort((left, right) => left.code.localeCompare(right.code));
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
        requiredAssetPlacements: approvedAssetPlacements,
      },
      "whole-storefront-request",
    ),
    target,
    briefId: input.brief.id,
    briefRevision: input.brief.revision,
    evidenceFingerprint: input.brief.approvedEvidenceFingerprint,
    approvedAssetContextFingerprint: input.approvedAssetContext?.fingerprint ?? null,
    componentRegistryFingerprint: target.registryFingerprint,
    languagePlan: {
      primaryLanguage: input.brief.languagePlan.primaryLanguage,
      selectedLanguages: canonicalLocaleOrder(input.brief.languagePlan.selectedLanguages),
      missingTranslationPolicy: "explicit-generation-or-merchant-review" as const,
    },
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
  const expected = createWholeStorefrontGenerationPlan(inputValue);
  const plan = wholeStorefrontGenerationPlanSchema.parse(planValue);
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
): Promise<WholeStorefrontGenerationPlan> {
  const expected = createWholeStorefrontGenerationPlan(inputValue);
  const received = await result;
  const current = createWholeStorefrontGenerationPlan(currentInput());
  if (current.requestFingerprint !== expected.requestFingerprint) {
    invalid("stale-result", "The storefront changed while its generation plan was being prepared.");
  }
  return validateWholeStorefrontGenerationPlan(inputValue, received);
}
