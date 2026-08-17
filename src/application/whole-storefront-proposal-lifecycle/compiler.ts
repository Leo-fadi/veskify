import {
  createWholeStorefrontGenerationPlan,
  createWholeStorefrontGenerationTarget,
  validateWholeStorefrontGenerationPlan,
} from "@/application/whole-storefront-generation-plan/planner";
import {
  materializeCurrentDynamicCommercePresentationAuthority,
  materializeDynamicCommerceDesignSelectionAuthority,
  materializeDynamicCommerceDesignSelectionFromAuthority,
  resolveDynamicCommerceRoutePage,
} from "@/application/dynamic-commerce-routes";
import {
  wholeStorefrontGenerationPlanSchema,
  wholeStorefrontPlanningInputSchema,
  type WholeStorefrontPlanningInput,
} from "@/application/whole-storefront-generation-plan/contract";
import {
  applyRegisteredTokenRefinement,
  registeredBrandSystemForDirection,
} from "@/application/storefront-design-system";
import {
  commercialHomepageProfileIdSchema,
  commercialPdpProfileIdSchema,
  commercialCollectionSearchProfileIdSchema,
} from "@/application/storefront-templates";
import {
  storefrontStyleDesignSystems,
  storefrontStyleDirectionForRegisteredDirection,
} from "@/application/design-skills/skills/apply-storefront-style";
import { getComponentDefinition } from "@/components/registry";
import {
  componentInstanceV2Schema,
  createComponentRegistryV2,
  type CollectionPresentationContext,
  type ComponentProjectionContext,
  type StorefrontAssetMetadata,
  type ComponentInstanceV2,
} from "@/domain/component-platform";
import {
  canonicalValueFingerprint,
  canonicalValueString,
  pageFactEvidenceReferenceSchema,
  type PageFactEvidenceReference,
} from "@/domain/storefront";
import { canonicalProductTypePresentationId } from "@/domain/product-card";
import {
  dynamicCollectionCommerceBridgeContentSchema,
  dynamicProductDetailBridgeContentSchema,
} from "@/components/registry/dynamic-commerce-bridge";
import { dynamicCollectionCommerceDefaultStyleOverrides } from "@/components/registry/dynamic-collection-commerce";
import { dynamicProductDetailDefaultStyleOverrides } from "@/components/registry/dynamic-product-detail";
import {
  homepageCommerceBridgeComponentNames,
  type HomepageCommerceBridgeComponent,
} from "@/components/registry/homepage-commerce-bridge";
import {
  contentSupportContentSchema,
  contentSupportStyleOverridesSchema,
} from "@/components/registry/content-support";
import {
  wholeStorefrontProposalCompilationInputSchema,
  coordinatedInitialGenerationProposalCompilationInputSchema,
  coordinatedFollowUpProposalCompilationInputSchema,
  coordinatedPageAuthorityFingerprint,
  coordinatedProtectedStateFingerprint,
  wholeStorefrontProposalSchema,
  type CoordinatedFollowUpProposalCompilationInput,
  type WholeStorefrontProposal,
  type WholeStorefrontProposalCompilationInput,
  type WholeStorefrontProposalErrorCode,
  type WholeStorefrontProposalOperationEnvelope,
  type WholeStorefrontProposalReviewSummary,
  type WholeStorefrontRuntimeComponent,
  type WholeStorefrontRuntimePage,
  type WholeStorefrontRuntimeState,
  WholeStorefrontProposalError,
} from "./contract";

function invalid(code: WholeStorefrontProposalErrorCode, message: string): never {
  throw new WholeStorefrontProposalError(code, message);
}

function roleForPageType(
  type: WholeStorefrontRuntimePage["type"],
): WholeStorefrontRuntimePage["role"] {
  if (type === "home") return "homepage";
  if (type === "collection") return "collection-template";
  if (type === "product") return "product-template";
  return "other";
}

function roleForPage(
  page: WholeStorefrontProposalCompilationInput["planningInput"]["draft"]["pages"][number],
): WholeStorefrontRuntimePage["role"] {
  return page.pageFamily?.familyId === "search-results" ? "other" : roleForPageType(page.type);
}

function parse(input: unknown): WholeStorefrontProposalCompilationInput {
  const result = wholeStorefrontProposalCompilationInputSchema.safeParse(input);
  if (result.success) return result.data;
  const coordinated = coordinatedInitialGenerationProposalCompilationInputSchema.safeParse(input);
  if (coordinated.success) {
    return { plan: coordinated.data.plan.plan, planningInput: coordinated.data.planningInput };
  }
  return invalid("invalid-plan", "The whole-storefront proposal request is incomplete or invalid.");
}

function parseFollowUp(input: unknown): CoordinatedFollowUpProposalCompilationInput | null {
  const candidate = input as { plan?: { kind?: unknown } } | null;
  const kind = candidate?.plan?.kind;
  if (kind === undefined || kind === "initialGeneration") return null;
  if (kind !== "governedFollowUp") {
    return invalid(
      "unsupported-coordinated-plan-kind",
      "The coordinated whole-storefront plan kind is not supported.",
    );
  }
  const result = coordinatedFollowUpProposalCompilationInputSchema.safeParse(input);
  if (result.success) return result.data;
  const messages = result.error.issues.map((issue) => issue.message);
  if (messages.some((message) => message.includes("declare each page exactly once"))) {
    return invalid(
      "duplicate-page-authority",
      "A coordinated follow-up plan cannot declare the same page more than once.",
    );
  }
  if (
    messages.some(
      (message) =>
        message.includes("match one current target page") ||
        message.includes("remain owned by its declared page"),
    )
  ) {
    return invalid(
      "undeclared-page-operation",
      "A coordinated follow-up operation must belong to one declared current page.",
    );
  }
  if (
    messages.some(
      (message) =>
        message.includes("only once") || message.includes("at most one shared BrandSystem"),
    )
  ) {
    return invalid(
      "conflicting-coordinated-operation",
      "A coordinated follow-up plan contains conflicting operations.",
    );
  }
  return invalid(
    "invalid-coordinated-plan",
    "The coordinated whole-storefront plan is incomplete or invalid.",
  );
}

function parseCurrentFollowUp(input: unknown): CoordinatedFollowUpProposalCompilationInput | null {
  const candidate = input as { plan?: { kind?: unknown }; planningInput?: unknown } | null;
  if (candidate?.plan?.kind === undefined || candidate.plan.kind === "initialGeneration")
    return null;
  if (candidate.plan.kind !== "governedFollowUp") {
    return invalid(
      "unsupported-coordinated-plan-kind",
      "The coordinated whole-storefront plan kind is not supported.",
    );
  }
  const plan = coordinatedFollowUpProposalCompilationInputSchema.shape.plan.safeParse(
    candidate.plan,
  );
  const planningInput = wholeStorefrontPlanningInputSchema.safeParse(candidate.planningInput);
  if (!plan.success || !planningInput.success) {
    return invalid(
      "invalid-coordinated-plan",
      "The current coordinated whole-storefront inputs are incomplete or invalid.",
    );
  }
  return { plan: plan.data, planningInput: planningInput.data };
}

function parseCurrent(input: unknown): WholeStorefrontProposalCompilationInput {
  const candidate = input as { plan?: unknown; planningInput?: unknown };
  const plan = wholeStorefrontGenerationPlanSchema.safeParse(candidate?.plan);
  const planningInput = wholeStorefrontPlanningInputSchema.safeParse(candidate?.planningInput);
  if (plan.success && planningInput.success) {
    return { plan: plan.data, planningInput: planningInput.data };
  }
  const coordinated = coordinatedInitialGenerationProposalCompilationInputSchema.safeParse(input);
  if (coordinated.success) {
    return { plan: coordinated.data.plan.plan, planningInput: coordinated.data.planningInput };
  }
  return invalid(
    "invalid-plan",
    "The current whole-storefront proposal inputs are incomplete or invalid.",
  );
}

function validateCurrentPlan(input: WholeStorefrontProposalCompilationInput) {
  const expected = createPlanFromInputs(input);
  try {
    const plan = validateWholeStorefrontGenerationPlan(input.planningInput, input.plan);
    if (canonicalValueString(expected) !== canonicalValueString(plan)) {
      invalid("stale-plan", "The whole-storefront plan no longer matches the active inputs.");
    }
    return plan;
  } catch (error) {
    if (error instanceof WholeStorefrontProposalError) throw error;
    return invalid("stale-plan", "The whole-storefront plan is stale or no longer valid.");
  }
}

function createPlanFromInputs(input: WholeStorefrontProposalCompilationInput) {
  try {
    const homepageMaterialization = input.plan.pageBlueprintMaterializations.find(
      (entry) => entry.pageType === "home",
    );
    const productMaterialization = input.plan.pageBlueprintMaterializations.find(
      (entry) => entry.pageType === "product",
    );
    const collectionMaterialization = input.plan.pageBlueprintMaterializations.find(
      (entry) => entry.pageType === "collection",
    );
    return createWholeStorefrontGenerationPlan(input.planningInput, {
      directionId: input.plan.designSystemSelection.directionId,
      designSystemNarrowing: {
        spacingDensity: input.plan.designSystemSelection.spacingDensity,
        surfaceDepth: input.plan.designSystemSelection.surfaceDepth,
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
      tokenRefinementPlan: input.plan.tokenRefinementPlan,
      pageBlueprintSelectionOverrides: input.plan.pageBlueprintSelectionOverrides,
      approvedAssetRoleSelections: input.plan.approvedAssetRoleSelections,
      dynamicCommerceSelection: input.plan.dynamicCommerceSelection,
    });
  } catch (error) {
    if (error instanceof WholeStorefrontProposalError) throw error;
    return invalid(
      "stale-plan",
      "The active whole-storefront planning inputs are no longer valid.",
    );
  }
}

function sourceApprovedAssetAuthority(
  page: WholeStorefrontProposalCompilationInput["planningInput"]["draft"]["pages"][number],
  section: WholeStorefrontProposalCompilationInput["planningInput"]["draft"]["pages"][number]["sections"][number],
  planningInput: WholeStorefrontPlanningInput,
) {
  const placements = (section.approvedAssetPlacements ?? []).map((placement) =>
    structuredClone(placement),
  );
  const presentations = section.approvedAssetPresentations ?? [];
  const approvedAssets = new Map(
    (planningInput.approvedAssetContext?.assets ?? []).map((asset) => [asset.assetId, asset]),
  );
  const assignmentKeys = new Set<string>();
  const assignments = placements.map((placement) => {
    const approved = approvedAssets.get(placement.assetId);
    const presentation = presentations.find(
      (candidate) =>
        candidate.assetId === placement.assetId &&
        candidate.asset.id === placement.assetId &&
        candidate.role === placement.role &&
        candidate.revision === placement.assetRevision &&
        candidate.materialFingerprint === placement.materialFingerprint,
    );
    if (
      placement.pageId !== page.id ||
      placement.componentId !== section.id ||
      placement.componentType !== section.component ||
      !approved ||
      approved.role !== placement.role ||
      approved.revision !== placement.assetRevision ||
      approved.materialFingerprint !== placement.materialFingerprint ||
      approved.sourceReferenceId !== placement.sourceReferenceId ||
      !presentation
    ) {
      invalid(
        "asset-placement-target-mismatch",
        "A retained approved source asset no longer matches the current page, component, presentation or approval authority.",
      );
    }
    const assignment = {
      slotId: placement.assetSlotId,
      assetId: placement.assetId,
      role: placement.role,
    };
    const key = canonicalValueString(assignment);
    if (assignmentKeys.has(key)) {
      invalid(
        "duplicate-operation-identity",
        "A retained approved source asset assignment is duplicated.",
      );
    }
    assignmentKeys.add(key);
    return assignment;
  });
  return { assignments, placements };
}

function sourceComponent(
  page: WholeStorefrontProposalCompilationInput["planningInput"]["draft"]["pages"][number],
  section: WholeStorefrontProposalCompilationInput["planningInput"]["draft"]["pages"][number]["sections"][number],
  plan: ReturnType<typeof validateCurrentPlan>,
  planningInput: WholeStorefrontPlanningInput,
): WholeStorefrontRuntimeComponent {
  const expected = plan.pagePlans
    .find((candidate) => candidate.pageId === page.id)
    ?.components.find(
      (
        component,
      ): component is Extract<
        (typeof plan.pagePlans)[number]["components"][number],
        { componentId: string }
      > => "componentId" in component && component.componentId === section.id,
    );
  if (!expected) {
    return invalid(
      "invalid-page-component-target",
      "A retained source component is missing from the validated whole-storefront plan.",
    );
  }
  if (
    Object.keys(section.styleOverrides ?? {}).length > 0 &&
    section.component !== "contentSupport"
  ) {
    return invalid(
      "incomplete-required-operation-compilation",
      "The validated plan does not contain a supported V2 operation for existing section style overrides.",
    );
  }
  let content = structuredClone(section.content);
  let bindings: ComponentInstanceV2["bindings"] = [];
  let styleOverrides: ComponentInstanceV2["styleOverrides"] = {};
  const assetAuthority = sourceApprovedAssetAuthority(page, section, planningInput);
  const homepageBridgeComponent = homepageCommerceBridgeComponentNames.find(
    (component): component is HomepageCommerceBridgeComponent => component === section.component,
  );
  if (section.component === "dynamicCollectionCommerce") {
    const { collectionId, productIds, canonicalRevision, ...presentationContent } =
      dynamicCollectionCommerceBridgeContentSchema.parse(content);
    content = presentationContent;
    styleOverrides = structuredClone(dynamicCollectionCommerceDefaultStyleOverrides);
    bindings = [
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
    ];
  } else if (section.component === "dynamicProductDetail") {
    const { productId, relatedProductIds, canonicalRevision, ...presentationContent } =
      dynamicProductDetailBridgeContentSchema.parse(content);
    content = presentationContent;
    styleOverrides = structuredClone(dynamicProductDetailDefaultStyleOverrides);
    bindings = [
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
    ];
  } else if (homepageBridgeComponent) {
    const revision = plan.target.canonicalCommerceFingerprint;
    styleOverrides = { surface: "plain" };
    bindings = [
      {
        slotId: "presentationContext",
        source: "projectBrandContext",
        projectId: plan.target.projectId,
        revision,
      },
      ...(homepageBridgeComponent === "homepageFeaturedCollections" ||
      homepageBridgeComponent === "homepageCollectionNavigation"
        ? [
            {
              slotId: "collections",
              source: "collectionList" as const,
              collectionIds: plan.target.collections.map((collection) => collection.id),
              revision,
            },
          ]
        : []),
      ...(homepageBridgeComponent === "homepageFeaturedProducts"
        ? [
            {
              slotId: "products",
              source: "productList" as const,
              productIds: [...plan.target.productIds],
              revision,
            },
          ]
        : []),
    ];
  } else if (section.component === "contentSupport") {
    const parsedContent = contentSupportContentSchema.parse(content);
    const document = planningInput.draft.contentSupportFactDocuments.find(
      (candidate) => candidate.id === parsedContent.factDocumentId,
    );
    const locale = planningInput.brief.languagePlan.primaryLanguage;
    if (!document || !locale) {
      return invalid(
        "invalid-page-component-target",
        "Content/support proposal projection requires its current approved fact document.",
      );
    }
    content = parsedContent;
    styleOverrides = contentSupportStyleOverridesSchema.parse({
      surface: section.styleOverrides?.surface ?? "default",
    });
    bindings = [
      {
        slotId: "supportFacts",
        source: "localizedContent",
        contentId: document.id,
        locale,
        fallbackLocale: locale,
        revision: document.fingerprint,
      },
    ];
  }
  return {
    ...componentInstanceV2Schema.parse({
      id: section.id,
      component: section.component,
      componentVersion: expected.componentVersion,
      variant: section.variant,
      content,
      props: structuredClone(section.props),
      styleOverrides,
      bindings,
      assetAssignments: assetAuthority.assignments,
    }),
    visible: section.visible,
  };
}

function createOriginalState(
  input: WholeStorefrontProposalCompilationInput,
  plan: ReturnType<typeof validateCurrentPlan>,
): WholeStorefrontRuntimeState {
  const registry = createComponentRegistryV2(input.planningInput.componentDefinitions);
  const pages = input.planningInput.draft.pages
    .map((page) => {
      const components = page.sections.map((section) =>
        sourceComponent(page, section, plan, input.planningInput),
      );
      components.forEach((component) => {
        try {
          const { visible, ...instance } = component;
          if (visible !== true && visible !== false) {
            invalid(
              "invalid-page-component-target",
              "Whole-storefront runtime components must declare merchant visibility explicitly.",
            );
          }
          registry.validateInstance(instance);
        } catch (error) {
          invalid(
            "invalid-page-component-target",
            error instanceof Error
              ? error.message
              : "A retained component no longer satisfies the active registry.",
          );
        }
      });
      return {
        pageId: page.id,
        role: roleForPage(page),
        type: page.type,
        components,
      };
    })
    .sort((left, right) => left.pageId.localeCompare(right.pageId));
  const staticApprovedAssetPlacements = input.planningInput.draft.pages.flatMap((page) =>
    page.sections.flatMap(
      (section) => sourceApprovedAssetAuthority(page, section, input.planningInput).placements,
    ),
  );
  const dynamicCommercePresentation =
    input.planningInput.draft.dynamicCommercePresentation ??
    (plan.dynamicCommerceSelection
      ? materializeCurrentDynamicCommercePresentationAuthority(
          input.planningInput.draft,
          input.planningInput.catalogue,
        )
      : null);
  const dynamicCommerceSnapshot = dynamicCommercePresentation
    ? {
        ...input.planningInput.draft,
        dynamicCommercePresentation,
      }
    : input.planningInput.draft;
  const dynamicApprovedAssetPlacements =
    dynamicCommercePresentation?.routeInventory.flatMap((route) =>
      route.kind === "search"
        ? []
        : resolveDynamicCommerceRoutePage({
            snapshot: dynamicCommerceSnapshot,
            catalogue: input.planningInput.catalogue,
            routeId: route.id,
            projection: "runtime",
          }).page.sections.flatMap((section) => section.approvedAssetPlacements ?? []),
    ) ?? [];
  const approvedAssetPlacements = [
    ...staticApprovedAssetPlacements,
    ...dynamicApprovedAssetPlacements,
  ].sort((left, right) => canonicalValueString(left).localeCompare(canonicalValueString(right)));
  if (
    new Set(approvedAssetPlacements.map((placement) => canonicalValueString(placement))).size !==
    approvedAssetPlacements.length
  ) {
    invalid(
      "duplicate-operation-identity",
      "The current storefront contains a duplicated approved asset placement.",
    );
  }
  return {
    projectId: input.planningInput.project.id,
    projectRevision: input.planningInput.project.revision,
    draftSnapshotId: input.planningInput.draft.id,
    draftRevision: input.planningInput.draft.revision,
    draftFingerprint: plan.target.activeDraftFingerprint,
    componentRegistryFingerprint: plan.componentRegistryFingerprint,
    canonicalCommerceFingerprint: plan.target.canonicalCommerceFingerprint,
    approvedAssetContextFingerprint: input.planningInput.approvedAssetContext?.fingerprint ?? null,
    brandSystem: structuredClone(input.planningInput.draft.brandSystem),
    navigation: structuredClone(input.planningInput.draft.navigation),
    dynamicCommercePresentation: structuredClone(dynamicCommercePresentation),
    pages,
    approvedAssetPlacements,
  };
}

function pageTypeForRole(
  role: WholeStorefrontRuntimePage["role"],
): WholeStorefrontRuntimePage["type"] {
  if (role === "homepage") return "home";
  if (role === "collection-template") return "collection";
  if (role === "product-template") return "product";
  return "content";
}

function coordinatedRuntimeComponent(
  component: WholeStorefrontRuntimeComponent,
  plan: ReturnType<typeof validateCurrentPlan>,
  pagePlan: ReturnType<typeof validateCurrentPlan>["pagePlans"][number],
): WholeStorefrontRuntimeComponent {
  if (plan.tokenRefinementPlan !== null) return component;
  const materialization = executableMaterializationForPage(plan, pagePlan.role);
  const planned = pagePlan.components.find(
    (candidate) => "instance" in candidate && candidate.instance.id === component.id,
  );
  const plannedSlotId = planned && "instance" in planned ? planned.pageBlueprintSlotId : undefined;
  const selection =
    component.component === "header" || component.component === "footer"
      ? undefined
      : plannedSlotId
        ? materialization?.slots.find((slot) => slot.slotId === plannedSlotId)
        : materialization?.slots.find((slot) => slot.component === component.component);
  return selection ? { ...component, variant: selection.variant } : component;
}

function materializeRegisteredPresentation(
  components: readonly WholeStorefrontRuntimeComponent[],
  plan: ReturnType<typeof validateCurrentPlan>,
): WholeStorefrontRuntimeComponent[] {
  if (plan.tokenRefinementPlan !== null) {
    return components.map((component) => structuredClone(component));
  }
  const style =
    storefrontStyleDesignSystems[
      storefrontStyleDirectionForRegisteredDirection(plan.designSystemSelection.directionId)
    ];
  return components.map((component, index) => {
    const definition = getComponentDefinition(component.component);
    return {
      ...component,
      props: {
        ...component.props,
        ...(definition.editorFields.density
          ? { density: plan.designSystemSelection.spacingDensity }
          : {}),
        ...(definition.editorFields.shape
          ? { shape: plan.designSystemSelection.cornerTreatment }
          : {}),
        ...(definition.editorFields.background
          ? { background: index % 2 === 0 ? "background" : "surface" }
          : {}),
        ...(definition.editorFields.typography ? { typography: style.sectionTypography } : {}),
      },
    };
  });
}

function executableMaterializationForPage(
  plan: ReturnType<typeof validateCurrentPlan>,
  pageRole: WholeStorefrontRuntimePage["role"],
) {
  if (plan.tokenRefinementPlan !== null || pageRole === "other") return undefined;
  const pageType =
    pageRole === "homepage"
      ? "home"
      : pageRole === "collection-template"
        ? "collection"
        : "product";
  const materialization = plan.pageBlueprintMaterializations.find(
    (entry) => entry.pageType === pageType,
  );
  if (!materialization) {
    invalid(
      "invalid-plan",
      "The validated plan is missing the canonical executable PageBlueprint materialization.",
    );
  }
  return materialization;
}

function orderRuntimeComponentsForMaterialization(
  components: readonly WholeStorefrontRuntimeComponent[],
  materialization: NonNullable<ReturnType<typeof executableMaterializationForPage>>,
  pagePlan: ReturnType<typeof validateCurrentPlan>["pagePlans"][number],
): WholeStorefrontRuntimeComponent[] {
  const slotIndexes = new Map<string, number[]>();
  materialization.slots.forEach((slot, index) => {
    const indexes = slotIndexes.get(slot.component) ?? [];
    indexes.push(index);
    slotIndexes.set(slot.component, indexes);
  });
  const compositeSlotComponents = {
    dynamicCollectionCommerce: ["collectionHeader", "filterBar", "productGrid"],
    dynamicProductDetail: ["productGallery", "productInfo", "productOptions"],
  } as const;
  Object.entries(compositeSlotComponents).forEach(([component, representedSlots]) => {
    const indexes = representedSlots.flatMap((slot) => slotIndexes.get(slot) ?? []);
    if (indexes.length > 0) slotIndexes.set(component, indexes);
  });
  const footerSlotIndex = materialization.slots.findIndex((slot) => slot.component === "footer");
  const consumed = new Map<string, number>();
  const boundSlotByComponentId = new Map(
    pagePlan.components.flatMap((component) =>
      "instance" in component && component.pageBlueprintSlotId
        ? [[component.instance.id, component.pageBlueprintSlotId] as const]
        : [],
    ),
  );
  return components
    .map((component, originalIndex) => {
      const index = consumed.get(component.component) ?? 0;
      consumed.set(component.component, index + 1);
      const boundSlotId = boundSlotByComponentId.get(component.id);
      const slotIndex = boundSlotId
        ? materialization.slots.findIndex((slot) => slot.slotId === boundSlotId)
        : slotIndexes.get(component.component)?.[index];
      const isCompositeCommerceComponent = component.component in compositeSlotComponents;
      return {
        component:
          slotIndex === undefined || isCompositeCommerceComponent
            ? component
            : { ...component, variant: materialization.slots[slotIndex].variant },
        position:
          slotIndex ??
          (footerSlotIndex < 0
            ? materialization.slots.length + originalIndex
            : footerSlotIndex - 1 + (originalIndex + 1) / (components.length + 1)),
        originalIndex,
      };
    })
    .sort(
      (left, right) => left.position - right.position || left.originalIndex - right.originalIndex,
    )
    .map(({ component }) => component);
}

function plannedPage(
  original: WholeStorefrontRuntimeState,
  plan: ReturnType<typeof validateCurrentPlan>,
  pagePlan: ReturnType<typeof validateCurrentPlan>["pagePlans"][number],
): { page: WholeStorefrontRuntimePage; removedComponentIds: string[] } {
  const originalPage = original.pages.find((page) => page.pageId === pagePlan.pageId);
  if (pagePlan.disposition !== "created" && !originalPage) {
    invalid(
      "invalid-page-component-target",
      "A retained planned page is missing from the active draft.",
    );
  }
  const sourceById = new Map(
    originalPage?.components.map((component) => [component.id, component]),
  );
  const retainedById = new Map(
    pagePlan.components.flatMap((component) =>
      "instance" in component || component.disposition === "removed"
        ? []
        : [[component.componentId, component] as const],
    ),
  );
  const removedById = new Set(
    pagePlan.components.flatMap((component) =>
      "instance" in component || component.disposition !== "removed" ? [] : [component.componentId],
    ),
  );
  const replacements = pagePlan.components.filter(
    (
      component,
    ): component is Extract<
      (typeof pagePlan.components)[number],
      { instance: ComponentInstanceV2 }
    > => "instance" in component && component.disposition === "replacement",
  );
  const replacementByTarget = new Map<string, (typeof replacements)[number]>();
  replacements.forEach((replacement) => {
    replacement.replacesComponentIds.forEach((componentId) => {
      if (replacementByTarget.has(componentId) || !sourceById.has(componentId)) {
        invalid(
          "invalid-page-component-target",
          "Replacement components must target one available component identity exactly once.",
        );
      }
      replacementByTarget.set(componentId, replacement);
    });
  });
  const replacementVisibility = (replacement: (typeof replacements)[number]) => {
    const targets = replacement.replacesComponentIds.map((componentId) =>
      sourceById.get(componentId)!,
    );
    const visible = targets[0]?.visible;
    if (visible === undefined || targets.some((target) => target.visible !== visible)) {
      invalid(
        "incomplete-required-operation-compilation",
        "A replacement must preserve one unambiguous merchant visibility state.",
      );
    }
    return visible;
  };
  const componentFromInstance = (instance: ComponentInstanceV2, visible: boolean) => ({
    ...structuredClone(instance),
    visible,
  });
  const components: WholeStorefrontRuntimeComponent[] = [];
  const insertedReplacements = new Set<string>();
  if (originalPage) {
    for (const source of originalPage.components) {
      if (removedById.has(source.id)) continue;
      const replacement = replacementByTarget.get(source.id);
      if (replacement) {
        if (!insertedReplacements.has(replacement.instance.id)) {
          components.push(
            componentFromInstance(replacement.instance, replacementVisibility(replacement)),
          );
          insertedReplacements.add(replacement.instance.id);
        }
        continue;
      }
      const retained = retainedById.get(source.id);
      if (!retained) {
        invalid(
          "incomplete-required-operation-compilation",
          "Every existing component must be retained or replaced by the validated plan.",
        );
      }
      if (
        source.component !== retained.component ||
        canonicalValueString(source.componentVersion) !==
          canonicalValueString(retained.componentVersion) ||
        source.variant !== retained.variant
      ) {
        invalid(
          "stale-plan",
          "A retained component no longer matches the component identity recorded by the plan.",
        );
      }
      components.push(structuredClone(source));
    }
  }
  const additions = pagePlan.components.flatMap((component) =>
    "instance" in component && component.disposition === "added"
      ? [componentFromInstance(component.instance, true)]
      : [],
  );
  if (originalPage) {
    const footerIndex = components.findIndex((component) => component.component === "footer");
    components.splice(footerIndex < 0 ? components.length : footerIndex, 0, ...additions);
  } else {
    pagePlan.components.forEach((component) => {
      if (!("instance" in component)) {
        invalid(
          "incomplete-required-operation-compilation",
          "New pages may only contain explicit validated component instances.",
        );
      }
      if (component.replacesComponentIds.length > 0) {
        invalid(
          "invalid-page-component-target",
          "New pages cannot replace components that do not exist.",
        );
      }
      components.push(componentFromInstance(component.instance, true));
    });
  }
  const removedComponentIds = originalPage
    ? originalPage.components
        .filter(
          (component) =>
            (replacementByTarget.has(component.id) || removedById.has(component.id)) &&
            !components.some((candidate) => candidate.id === component.id),
        )
        .map((component) => component.id)
    : [];
  const coordinatedComponents = components.map((component) =>
    coordinatedRuntimeComponent(component, plan, pagePlan),
  );
  const materialization = executableMaterializationForPage(plan, pagePlan.role);
  const orderedComponents = materialization
    ? orderRuntimeComponentsForMaterialization(coordinatedComponents, materialization, pagePlan)
    : coordinatedComponents;
  const page = {
    pageId: pagePlan.pageId,
    role: pagePlan.role,
    type: originalPage?.type ?? pageTypeForRole(pagePlan.role),
    components: materializeRegisteredPresentation(orderedComponents, plan),
  } satisfies WholeStorefrontRuntimePage;
  return { page, removedComponentIds };
}

function withPlacement(
  state: WholeStorefrontRuntimeState,
  placement: WholeStorefrontRuntimeState["approvedAssetPlacements"][number],
) {
  if (placement.placementContext === "sharedFrame") {
    if (placement.componentType !== "header" || placement.assetSlotId !== "brandLogo") {
      invalid(
        "asset-placement-target-mismatch",
        "A shared-frame approved source asset must target the registered header logo slot.",
      );
    }
    if (
      state.approvedAssetPlacements.some(
        (candidate) =>
          candidate.placementContext === "sharedFrame" &&
          candidate.componentId === placement.componentId &&
          candidate.assetSlotId === placement.assetSlotId,
      )
    ) {
      invalid("duplicate-operation-identity", "A shared-frame asset placement is duplicated.");
    }
    state.approvedAssetPlacements.push(structuredClone(placement));
    return;
  }
  const page = state.pages.find((candidate) => candidate.pageId === placement.pageId);
  const component = page?.components.find((candidate) => candidate.id === placement.componentId);
  if (!component || component.component !== placement.componentType) {
    invalid(
      "asset-placement-target-mismatch",
      "An approved source asset targets a component that is not present in the proposed storefront.",
    );
  }
  const existing = component.assetAssignments.find(
    (assignment) =>
      assignment.slotId === placement.assetSlotId && assignment.assetId === placement.assetId,
  );
  if (existing && existing.role !== placement.role) {
    invalid(
      "duplicate-operation-identity",
      "An approved source asset placement conflicts with its component assignment.",
    );
  }
  if (!existing) {
    component.assetAssignments.push({
      slotId: placement.assetSlotId,
      assetId: placement.assetId,
      role: placement.role,
    });
  }
  if (
    state.approvedAssetPlacements.some(
      (candidate) =>
        candidate.pageId === placement.pageId &&
        candidate.componentId === placement.componentId &&
        candidate.assetSlotId === placement.assetSlotId &&
        candidate.assetId === placement.assetId,
    )
  ) {
    invalid("duplicate-operation-identity", "An approved source asset placement is duplicated.");
  }
  state.approvedAssetPlacements.push(structuredClone(placement));
}

function operationIdentity(operation: WholeStorefrontProposalOperationEnvelope["operation"]) {
  return `whole-storefront-operation-${canonicalValueFingerprint(operation)}`;
}

export function replayWholeStorefrontProposalOperations(
  originalInput: WholeStorefrontRuntimeState,
  operationsInput: readonly WholeStorefrontProposalOperationEnvelope[],
): WholeStorefrontRuntimeState {
  const state = structuredClone(originalInput);
  const identities = new Set<string>();
  operationsInput.forEach((envelope, index) => {
    if (envelope.order !== index) {
      invalid(
        "duplicate-operation-identity",
        "Whole-storefront operations must have contiguous ordering.",
      );
    }
    if (
      identities.has(envelope.identity) ||
      envelope.identity !== operationIdentity(envelope.operation)
    ) {
      invalid(
        "duplicate-operation-identity",
        "Whole-storefront operation identities must be unique and canonical.",
      );
    }
    identities.add(envelope.identity);
    const operation = envelope.operation;
    switch (operation.type) {
      case "RETAIN_BRAND_SYSTEM":
        if (
          canonicalValueString(state.brandSystem) !== canonicalValueString(operation.brandSystem)
        ) {
          invalid(
            "protected-commerce-mutation",
            "The plan cannot replace the active BrandSystem without an explicit supported operation.",
          );
        }
        break;
      case "APPLY_REGISTERED_BRAND_SYSTEM":
        state.brandSystem = structuredClone(operation.brandSystem);
        break;
      case "RETAIN_NAVIGATION":
        if (canonicalValueString(state.navigation) !== canonicalValueString(operation.navigation)) {
          invalid(
            "unsupported-plan-operation",
            "The plan cannot change navigation without an explicit supported operation.",
          );
        }
        break;
      case "APPLY_DYNAMIC_COMMERCE_PRESENTATION": {
        const current = state.dynamicCommercePresentation;
        const expected = current
          ? materializeDynamicCommerceDesignSelectionFromAuthority(current, operation.selection)
          : null;
        if (
          !current ||
          current.authorityFingerprint !== operation.sourceAuthorityFingerprint ||
          !expected ||
          canonicalValueString(operation.presentation) !== canonicalValueString(expected)
        ) {
          invalid(
            "stale-plan",
            "Dynamic-commerce presentation operation does not advance the exact current authority.",
          );
        }
        state.dynamicCommercePresentation = structuredClone(operation.presentation);
        break;
      }
      case "APPLY_PAGE_COMPONENTS": {
        if (!("page" in operation)) {
          invalid("unsupported-plan-operation", "The whole-storefront page operation is invalid.");
        }
        const index = state.pages.findIndex((page) => page.pageId === operation.page.pageId);
        const previous = index < 0 ? undefined : state.pages[index];
        const removed = new Set(operation.removedComponentIds);
        if (
          removed.size !== operation.removedComponentIds.length ||
          [...removed].some(
            (componentId) =>
              !previous?.components.some((component) => component.id === componentId),
          ) ||
          operation.page.components.some((component) => removed.has(component.id))
        ) {
          invalid(
            "invalid-page-component-target",
            "Page component operations must describe only existing removed component identities.",
          );
        }
        if (index < 0) state.pages.push(structuredClone(operation.page));
        else state.pages[index] = structuredClone(operation.page);
        break;
      }
      case "PLACE_APPROVED_SOURCE_ASSET":
        withPlacement(state, operation);
        break;
    }
  });
  state.pages.sort((left, right) => left.pageId.localeCompare(right.pageId));
  state.approvedAssetPlacements.sort((left, right) =>
    canonicalValueString(left).localeCompare(canonicalValueString(right)),
  );
  return state;
}

function reviewSummary(
  plan: ReturnType<typeof validateCurrentPlan>,
  original: WholeStorefrontRuntimeState,
  proposed: WholeStorefrontRuntimeState,
): WholeStorefrontProposalReviewSummary {
  type ReviewComponent = WholeStorefrontProposalReviewSummary["components"][number];
  const visibleComponentIds = (page: WholeStorefrontRuntimePage | undefined) =>
    page?.components.filter((component) => component.visible).map((component) => component.id) ??
    [];
  const sequenceChanged = (originalIds: readonly string[], proposedIds: readonly string[]) =>
    originalIds.length !== proposedIds.length ||
    originalIds.some((componentId, index) => componentId !== proposedIds[index]);
  const movedHomepageComponentIds = new Map<string, Set<string>>(
    plan.pagePlans
      .filter((page) => page.role === "homepage")
      .flatMap((page) => {
        const originalPage = original.pages.find((candidate) => candidate.pageId === page.pageId);
        const proposedPage = proposed.pages.find((candidate) => candidate.pageId === page.pageId);
        const originalIds = visibleComponentIds(originalPage);
        const proposedIds = visibleComponentIds(proposedPage);
        if (!sequenceChanged(originalIds, proposedIds)) return [];
        const originalIndexes = new Map(
          originalIds.map((componentId, index) => [componentId, index]),
        );
        const moved = proposedIds.filter(
          (componentId, index) =>
            originalIndexes.get(componentId) !== undefined &&
            originalIndexes.get(componentId) !== index,
        );
        return [[page.pageId, new Set(moved)] as const];
      }),
  );
  const components = plan.pagePlans
    .flatMap((page) => {
      const replaced = new Set(
        page.components.flatMap((component) =>
          "instance" in component ? component.replacesComponentIds : [],
        ),
      );
      const planned: ReviewComponent[] = page.components.flatMap((component): ReviewComponent[] => {
        if ("instance" in component) {
          return [
            {
              componentId: component.instance.id,
              component: component.instance.component,
              status:
                component.disposition === "replacement"
                  ? ("replaced" as const)
                  : ("added" as const),
            },
          ];
        }
        if (replaced.has(component.componentId)) return [];
        const source = original.pages
          .find((candidate) => candidate.pageId === page.pageId)
          ?.components.find((candidate) => candidate.id === component.componentId);
        const compiled = source ? coordinatedRuntimeComponent(source, plan, page) : undefined;
        if (source && compiled && source.variant !== compiled.variant) {
          return [
            {
              componentId: component.componentId,
              component: component.component,
              pageId: page.pageId,
              pageRole: page.role,
              previousVariant: source.variant,
              resultingVariant: compiled.variant,
              description:
                "Updates this storefront component to the selected coordinated design direction.",
              status: "modified" as const,
            },
          ];
        }
        return [
          {
            componentId: component.componentId,
            component: component.component,
            pageId: page.pageId,
            pageRole: page.role,
            status:
              component.disposition === "fallback-retained"
                ? ("fallback-retained" as const)
                : ("retained" as const),
          },
        ];
      });
      const sourcePage = original.pages.find((candidate) => candidate.pageId === page.pageId);
      const removed: ReviewComponent[] = [...replaced].map((componentId) => {
        const component = sourcePage?.components.find((candidate) => candidate.id === componentId);
        if (!component) {
          invalid(
            "invalid-page-component-target",
            "A replacement references an unknown active component.",
          );
        }
        return { componentId, component: component.component, status: "removed" as const };
      });
      return [...planned, ...removed];
    })
    .map((component) => {
      const moved =
        component.pageRole === "homepage" &&
        component.pageId !== undefined &&
        movedHomepageComponentIds.get(component.pageId)?.has(component.componentId);
      if (!moved) return component;
      return {
        ...component,
        status: "modified" as const,
        description: "Moves this section within the updated homepage order.",
      };
    })
    .sort((left, right) => left.componentId.localeCompare(right.componentId));
  return {
    sharedDesignSystemChanges: [
      ...plan.reviewSummary.sharedDesignSystemChanges,
      ...(plan.dynamicCommerceSelection
        ? ["Updates registered collection, search and product-detail presentation authority."]
        : []),
    ],
    pages: plan.pagePlans
      .map((page) => ({
        pageId: page.pageId,
        status:
          page.disposition === "created"
            ? ("created" as const)
            : page.components.some((component) => "instance" in component) ||
                sequenceChanged(
                  visibleComponentIds(
                    original.pages.find((candidate) => candidate.pageId === page.pageId),
                  ),
                  visibleComponentIds(
                    proposed.pages.find((candidate) => candidate.pageId === page.pageId),
                  ),
                )
              ? ("changed" as const)
              : ("retained" as const),
      }))
      .sort((left, right) => left.pageId.localeCompare(right.pageId)),
    components,
    navigationChanges: plan.navigationChanges
      .map((item) => ({ navigationItemId: item.navigationItemId, status: "retained" as const }))
      .sort((left, right) => left.navigationItemId.localeCompare(right.navigationItemId)),
    visibilityChanges: [],
    canonicalBindings: structuredClone(plan.canonicalCommerceBindings),
    approvedAssetPlacements: structuredClone(plan.approvedAssetPlacements),
    protectedFactsPreserved: [...plan.reviewSummary.protectedFactsPreserved],
    warnings: structuredClone(plan.warnings),
    requiredMerchantReviewItems: structuredClone(plan.requiredMerchantReviewItems),
  };
}

/** Builds merchant review details from the actual governed follow-up projection. */
function coordinatedFollowUpReviewSummary(
  baseline: ReturnType<typeof validateCurrentPlan>,
  original: WholeStorefrontRuntimeState,
  proposed: WholeStorefrontRuntimeState,
  explanation: string,
): WholeStorefrontProposalReviewSummary {
  const componentChanges: WholeStorefrontProposalReviewSummary["components"] = [];
  const visibilityChanges: WholeStorefrontProposalReviewSummary["visibilityChanges"] = [];
  const pages = proposed.pages
    .map((page) => {
      const source = original.pages.find((candidate) => candidate.pageId === page.pageId);
      const sourceComponents = new Map(
        source?.components.map((component) => [component.id, component]),
      );
      const proposedIds = new Set(page.components.map((component) => component.id));
      for (const component of page.components) {
        const previous = sourceComponents.get(component.id);
        if (!previous) {
          componentChanges.push({
            componentId: component.id,
            component: component.component,
            pageId: page.pageId,
            pageRole: page.role,
            status: "added",
          });
          continue;
        }
        if (previous.visible !== component.visible) {
          visibilityChanges.push({
            componentId: component.id,
            previousVisible: previous.visible,
            visible: component.visible,
          });
        }
        if (canonicalValueString(previous) !== canonicalValueString(component)) {
          componentChanges.push({
            componentId: component.id,
            component: component.component,
            pageId: page.pageId,
            pageRole: page.role,
            ...(previous.variant === component.variant
              ? {}
              : { previousVariant: previous.variant, resultingVariant: component.variant }),
            description: "Updates this component through the validated coordinated proposal.",
            status: "modified",
          });
        }
      }
      for (const previous of source?.components ?? []) {
        if (proposedIds.has(previous.id)) continue;
        componentChanges.push({
          componentId: previous.id,
          component: previous.component,
          pageId: page.pageId,
          pageRole: page.role,
          status: "removed",
        });
      }
      return {
        pageId: page.pageId,
        status:
          source !== undefined && canonicalValueString(source) === canonicalValueString(page)
            ? ("retained" as const)
            : ("changed" as const),
      };
    })
    .sort((left, right) => left.pageId.localeCompare(right.pageId));
  return {
    sharedDesignSystemChanges:
      canonicalValueString(original.brandSystem) === canonicalValueString(proposed.brandSystem)
        ? []
        : ["Applies the validated registered BrandSystem across shared storefront presentation."],
    pages,
    components: componentChanges.sort((left, right) =>
      left.componentId.localeCompare(right.componentId),
    ),
    navigationChanges: [...original.navigation.primary, ...original.navigation.footer]
      .map((item) => ({ navigationItemId: item.id, status: "retained" as const }))
      .sort((left, right) => left.navigationItemId.localeCompare(right.navigationItemId)),
    visibilityChanges: visibilityChanges.sort((left, right) =>
      left.componentId.localeCompare(right.componentId),
    ),
    canonicalBindings: structuredClone(baseline.canonicalCommerceBindings),
    approvedAssetPlacements: structuredClone(proposed.approvedAssetPlacements),
    protectedFactsPreserved: [...baseline.reviewSummary.protectedFactsPreserved],
    warnings: structuredClone(baseline.warnings),
    requiredMerchantReviewItems: [
      ...structuredClone(baseline.requiredMerchantReviewItems),
      { code: "governed-follow-up-plan", message: explanation, severity: "required-review" },
    ],
  };
}

export function createWholeStorefrontRuntimeState(
  inputValue: unknown,
): WholeStorefrontRuntimeState {
  const input = parse(inputValue);
  const plan = validateCurrentPlan(input);
  const target = createWholeStorefrontGenerationTarget(input.planningInput);
  if (
    target.fingerprint !== plan.target.fingerprint ||
    target.registryFingerprint !== plan.componentRegistryFingerprint
  ) {
    invalid("stale-plan", "The whole-storefront plan target is no longer current.");
  }
  return createOriginalState(input, plan);
}

export function compileWholeStorefrontProposal(inputValue: unknown): WholeStorefrontProposal {
  const followUp = parseFollowUp(inputValue);
  if (followUp) return compileCoordinatedFollowUpProposal(followUp);
  const input = parse(inputValue);
  const plan = validateCurrentPlan(input);
  const original = createOriginalState(input, plan);
  const operations: WholeStorefrontProposalOperationEnvelope[] = [];
  const add = (operation: WholeStorefrontProposalOperationEnvelope["operation"]) => {
    operations.push({
      order: operations.length,
      identity: operationIdentity(operation),
      operation,
    });
  };
  const selectedBrandSystem =
    plan.tokenRefinementPlan === null
      ? registeredBrandSystemForDirection(
          original.brandSystem,
          input.planningInput.recipeContext.designSystem,
          plan.designSystemSelection.directionId,
          {
            spacingDensity: plan.designSystemSelection.spacingDensity,
            surfaceDepth: plan.designSystemSelection.surfaceDepth,
          },
        )
      : applyRegisteredTokenRefinement(original.brandSystem, plan.tokenRefinementPlan);
  add(
    plan.tokenRefinementPlan === null
      ? {
          type: "APPLY_REGISTERED_BRAND_SYSTEM",
          directionId: plan.designSystemSelection.directionId,
          designSystemNarrowing: {
            spacingDensity: plan.designSystemSelection.spacingDensity,
            surfaceDepth: plan.designSystemSelection.surfaceDepth,
          },
          brandSystem: selectedBrandSystem,
        }
      : {
          type: "APPLY_REGISTERED_BRAND_SYSTEM",
          refinementId: "validatedTokenRefinement",
          tokenRefinementPlan: structuredClone(plan.tokenRefinementPlan),
          brandSystem: selectedBrandSystem,
        },
  );
  add({ type: "RETAIN_NAVIGATION", navigation: structuredClone(original.navigation) });
  let selectedDynamicCommercePresentation: WholeStorefrontRuntimeState["dynamicCommercePresentation"] =
    null;
  if (plan.dynamicCommerceSelection) {
    const selected = materializeDynamicCommerceDesignSelectionAuthority(
      input.planningInput.draft,
      input.planningInput.catalogue,
      plan.dynamicCommerceSelection,
      original.dynamicCommercePresentation ?? undefined,
    );
    if (!original.dynamicCommercePresentation) {
      invalid(
        "incomplete-required-operation-compilation",
        "The exact dynamic-commerce selection did not produce canonical presentation authority.",
      );
    }
    selectedDynamicCommercePresentation = structuredClone(selected);
    add({
      type: "APPLY_DYNAMIC_COMMERCE_PRESENTATION",
      sourceAuthorityFingerprint: original.dynamicCommercePresentation.authorityFingerprint,
      selection: structuredClone(plan.dynamicCommerceSelection),
      presentation: structuredClone(selected),
    });
  }
  plan.pagePlans
    .slice()
    .sort((left, right) => left.pageId.localeCompare(right.pageId))
    .forEach((pagePlan) => {
      let planned = plannedPage(original, plan, pagePlan);
      const exactDynamicPresentation = selectedDynamicCommercePresentation ?? undefined;
      const selectedRoute = exactDynamicPresentation?.routeInventory.find(
        ({ id }) => id === pagePlan.pageId,
      );
      if (selectedRoute && selectedRoute.kind !== "search") {
        const originalPage = original.pages.find(({ pageId }) => pageId === pagePlan.pageId);
        const sourcePage = input.planningInput.draft.pages.find(({ id }) => id === pagePlan.pageId);
        const selectedRoutePage = resolveDynamicCommerceRoutePage({
          snapshot: {
            ...structuredClone(input.planningInput.draft),
            dynamicCommercePresentation: structuredClone(exactDynamicPresentation),
          },
          catalogue: input.planningInput.catalogue,
          routeId: selectedRoute.id,
          projection: "runtime",
        }).page;
        const selectedSection = selectedRoutePage.sections[0];
        const originalRuntimeComponent = originalPage?.components.find(
          ({ component }) => component === selectedSection?.component,
        );
        if (
          !originalPage ||
          !sourcePage ||
          !selectedSection ||
          !originalRuntimeComponent ||
          originalPage.components.length !== 1 ||
          selectedRoutePage.sections.length !== 1
        ) {
          invalid(
            "invalid-page-component-target",
            "A selected dynamic-commerce route must replace one exact current composite component.",
          );
        }
        const exactSection = {
          ...structuredClone(selectedSection),
          id: originalRuntimeComponent.id,
          approvedAssetPlacements: (selectedSection.approvedAssetPlacements ?? []).map(
            (placement) => ({
              ...structuredClone(placement),
              componentId: originalRuntimeComponent.id,
            }),
          ),
        };
        const exactPage = {
          ...structuredClone(sourcePage),
          sections: [exactSection],
        };
        const exactComponent = sourceComponent(exactPage, exactSection, plan, input.planningInput);
        planned = {
          page: {
            pageId: originalPage.pageId,
            role: originalPage.role,
            type: originalPage.type,
            components: materializeRegisteredPresentation([exactComponent], plan),
          },
          removedComponentIds: originalPage.components
            .filter(({ id }) => id !== originalRuntimeComponent.id)
            .map(({ id }) => id),
        };
      }
      add({ type: "APPLY_PAGE_COMPONENTS", ...planned });
    });
  plan.approvedAssetPlacements
    .slice()
    .sort((left, right) => canonicalValueString(left).localeCompare(canonicalValueString(right)))
    .filter(
      (placement) =>
        !original.approvedAssetPlacements.some(
          (current) => canonicalValueString(current) === canonicalValueString(placement),
        ),
    )
    .forEach((placement) => add(structuredClone(placement)));
  const proposed = replayWholeStorefrontProposalOperations(original, operations);
  const proposalWithoutId = {
    planId: plan.id,
    projectId: plan.target.projectId,
    draftSnapshotId: plan.target.draftSnapshotId,
    draftRevision: plan.target.draftRevision,
    preconditions: {
      planFingerprint: plan.fingerprint,
      briefRevision: plan.briefRevision,
      evidenceFingerprint: plan.evidenceFingerprint,
      assetContextFingerprint: plan.approvedAssetContextFingerprint,
      projectRevision: plan.target.projectRevision,
      draftFingerprint: plan.target.activeDraftFingerprint,
      componentRegistryFingerprint: plan.componentRegistryFingerprint,
      canonicalCommerceFingerprint: plan.target.canonicalCommerceFingerprint,
    },
    originalStorefront: original,
    proposedStorefront: proposed,
    operations,
    reviewSummary: reviewSummary(plan, original, proposed),
    status: "pending" as const,
  };
  const id = `whole_storefront_proposal_${canonicalValueFingerprint(proposalWithoutId).slice(-8)}`;
  return wholeStorefrontProposalSchema.parse({ id, ...proposalWithoutId });
}

function compileCoordinatedFollowUpProposal(
  input: CoordinatedFollowUpProposalCompilationInput,
): WholeStorefrontProposal {
  const baselineInput = {
    plan: input.plan.baselineGenerationPlan,
    planningInput: input.planningInput,
  } satisfies WholeStorefrontProposalCompilationInput;
  const baseline = validateCurrentPlan(baselineInput);
  if (
    canonicalValueString(input.plan.target) !== canonicalValueString(baseline.target) ||
    input.plan.componentRegistryFingerprint !== baseline.componentRegistryFingerprint ||
    input.plan.commerceFingerprint !== baseline.target.canonicalCommerceFingerprint ||
    input.plan.approvedAssetFingerprint !==
      (input.planningInput.approvedAssetContext?.fingerprint ?? null)
  ) {
    invalid("stale-plan", "The coordinated follow-up plan no longer matches current authority.");
  }
  for (const change of input.plan.pageChanges) {
    const materialization = baseline.pageBlueprintMaterializations.find(
      (candidate) => candidate.pageType === change.pageType,
    );
    if (
      !materialization ||
      materialization.profileId !== change.profileId ||
      materialization.fingerprint !== change.profileFingerprint ||
      change.slotAuthorities.some(
        (authority) => !materialization.slots.some((slot) => slot.slotId === authority.slotId),
      )
    ) {
      invalid(
        "stale-page-authority",
        "The coordinated page profile or slot authority is stale or does not belong to its page.",
      );
    }
  }
  const original = createOriginalState(baselineInput, baseline);
  if (input.plan.protectedStateFingerprint !== coordinatedProtectedStateFingerprint(original)) {
    invalid(
      "stale-plan",
      "The coordinated follow-up plan no longer matches the protected storefront authority.",
    );
  }
  for (const change of input.plan.pageChanges) {
    const originalPage = original.pages.find((page) => page.pageId === change.pageId);
    const sourcePage = input.planningInput.draft.pages.find((page) => page.id === change.pageId);
    if (
      !originalPage ||
      !sourcePage ||
      originalPage.type !== change.pageType ||
      sourcePage.type !== change.pageType ||
      originalPage.role !== roleForPage(sourcePage) ||
      coordinatedPageAuthorityFingerprint(originalPage) !== change.pageAuthorityFingerprint
    ) {
      invalid(
        "stale-page-authority",
        "The coordinated page changed after its follow-up authority was assembled.",
      );
    }
  }
  const operations: WholeStorefrontProposalOperationEnvelope[] = [];
  const add = (operation: WholeStorefrontProposalOperationEnvelope["operation"]) => {
    operations.push({
      order: operations.length,
      identity: operationIdentity(operation),
      operation,
    });
  };
  input.plan.sharedOperations.forEach((operation) => add(structuredClone(operation)));
  validateRegisteredBrandSystemOperations(original, input);
  if (!operations.some(({ operation }) => operation.type === "RETAIN_NAVIGATION")) {
    add({ type: "RETAIN_NAVIGATION", navigation: structuredClone(original.navigation) });
  }
  input.plan.pageChanges
    .slice()
    .sort((left, right) => left.pageId.localeCompare(right.pageId))
    .forEach((change) => change.operations.forEach((operation) => add(structuredClone(operation))));
  const proposed = replayWholeStorefrontProposalOperations(original, operations);
  validateCoordinatedFollowUpProjection(original, proposed, input);
  const proposedReviewSummary = coordinatedFollowUpReviewSummary(
    baseline,
    original,
    proposed,
    input.plan.explanation,
  );
  const proposalWithoutId = {
    planId: input.plan.id,
    projectId: input.plan.target.projectId,
    draftSnapshotId: input.plan.target.draftSnapshotId,
    draftRevision: input.plan.target.draftRevision,
    preconditions: {
      planFingerprint: input.plan.fingerprint,
      briefRevision: input.planningInput.brief.revision,
      evidenceFingerprint: input.planningInput.brief.evidenceFingerprint,
      assetContextFingerprint: input.plan.approvedAssetFingerprint,
      projectRevision: input.plan.target.projectRevision,
      draftFingerprint: input.plan.target.activeDraftFingerprint,
      componentRegistryFingerprint: input.plan.componentRegistryFingerprint,
      canonicalCommerceFingerprint: input.plan.commerceFingerprint,
      manifestVersion: input.plan.manifest.version,
      manifestFingerprint: input.plan.manifest.fingerprint,
      packageRegistryVersion: input.plan.packageRegistry.version,
      packageRegistryFingerprint: input.plan.packageRegistry.fingerprint,
    },
    originalStorefront: original,
    proposedStorefront: proposed,
    operations,
    reviewSummary: proposedReviewSummary,
    status: "pending" as const,
  };
  const id = `whole_storefront_proposal_${canonicalValueFingerprint(proposalWithoutId).slice(-8)}`;
  return wholeStorefrontProposalSchema.parse({ id, ...proposalWithoutId });
}

function validateCoordinatedFollowUpProjection(
  original: WholeStorefrontRuntimeState,
  proposed: WholeStorefrontRuntimeState,
  input: CoordinatedFollowUpProposalCompilationInput,
) {
  if (
    original.projectId !== proposed.projectId ||
    original.projectRevision !== proposed.projectRevision ||
    original.draftSnapshotId !== proposed.draftSnapshotId ||
    original.draftRevision !== proposed.draftRevision ||
    original.draftFingerprint !== proposed.draftFingerprint ||
    original.canonicalCommerceFingerprint !== proposed.canonicalCommerceFingerprint ||
    canonicalValueString(original.dynamicCommercePresentation) !==
      canonicalValueString(proposed.dynamicCommercePresentation) ||
    canonicalValueString(original.navigation) !== canonicalValueString(proposed.navigation)
  ) {
    invalid(
      "protected-commerce-mutation",
      "A governed follow-up cannot mutate protected storefront authority.",
    );
  }
  const changesByPageId = new Map(input.plan.pageChanges.map((change) => [change.pageId, change]));
  const allowedPages = new Set(changesByPageId.keys());
  for (const page of proposed.pages) {
    const source = original.pages.find((candidate) => candidate.pageId === page.pageId);
    if (!source || source.type !== page.type || source.role !== page.role) {
      invalid(
        "invalid-page-component-target",
        "A governed follow-up cannot create or replace page authority.",
      );
    }
    if (
      !allowedPages.has(page.pageId) &&
      canonicalValueString(page) !== canonicalValueString(source)
    ) {
      invalid(
        "invalid-page-component-target",
        "A governed follow-up cannot change an undeclared page.",
      );
    }
    const sourceComponents = new Map(
      source.components.map((component) => [component.id, component]),
    );
    const change = changesByPageId.get(page.pageId);
    const authorizedComponentIds = new Set(
      change?.slotAuthorities.flatMap((authority) => authority.componentIds) ?? [],
    );
    const proposedComponents = new Map(
      page.components.map((component) => [component.id, component]),
    );
    const changedComponentIds = new Set<string>();
    for (const sourceComponent of source.components) {
      const component = proposedComponents.get(sourceComponent.id);
      if (!component || canonicalValueString(component) !== canonicalValueString(sourceComponent)) {
        changedComponentIds.add(sourceComponent.id);
      }
    }
    for (const component of page.components) {
      if (!sourceComponents.has(component.id)) changedComponentIds.add(component.id);
    }
    if (
      change !== undefined &&
      [...changedComponentIds].some((componentId) => !authorizedComponentIds.has(componentId))
    ) {
      invalid(
        "undeclared-page-operation",
        "A governed page operation may change only component identities bound to its declared blueprint slots.",
      );
    }
    for (const component of page.components) {
      const sourceComponent = sourceComponents.get(component.id);
      if (!sourceComponent) continue;
      if (
        component.component !== sourceComponent.component ||
        canonicalValueString(component.componentVersion) !==
          canonicalValueString(sourceComponent.componentVersion) ||
        canonicalValueString(component.bindings) !== canonicalValueString(sourceComponent.bindings)
      ) {
        invalid(
          "protected-commerce-mutation",
          "A governed follow-up cannot replace a retained component identity, canonical bindings or assets.",
        );
      }
      for (const assignment of sourceComponent.assetAssignments) {
        if (
          !component.assetAssignments.some(
            (candidate) =>
              candidate.slotId === assignment.slotId &&
              candidate.assetId === assignment.assetId &&
              candidate.role === assignment.role,
          )
        ) {
          invalid(
            "protected-commerce-mutation",
            "A governed follow-up cannot remove an existing approved asset assignment.",
          );
        }
      }
    }
  }
  const approvedAssets = new Map(
    (input.planningInput.approvedAssetContext?.assets ?? []).map((asset) => [asset.assetId, asset]),
  );
  const registry = createComponentRegistryV2(input.planningInput.componentDefinitions);
  const projection = componentProjectionForCoordinatedFollowUp(input, proposed);
  for (const page of proposed.pages) {
    for (const component of page.components) {
      try {
        const { visible: _visible, ...instance } = component;
        void _visible;
        registry.validateInstanceConformance(instance, projection);
      } catch (error) {
        invalid(
          "invalid-page-component-target",
          error instanceof Error
            ? error.message
            : "A governed follow-up component is not valid for the current registry.",
        );
      }
    }
  }
  for (const placement of proposed.approvedAssetPlacements) {
    const asset = approvedAssets.get(placement.assetId);
    if (!asset || asset.role !== placement.role) {
      invalid(
        "asset-placement-target-mismatch",
        "A governed follow-up may place only an approved asset with its registered role.",
      );
    }
  }
  for (const page of proposed.pages) {
    for (const component of page.components) {
      for (const assignment of component.assetAssignments) {
        const originalAssignment = original.pages
          .find((candidate) => candidate.pageId === page.pageId)
          ?.components.find((candidate) => candidate.id === component.id)
          ?.assetAssignments.find(
            (candidate) =>
              candidate.slotId === assignment.slotId &&
              candidate.assetId === assignment.assetId &&
              candidate.role === assignment.role,
          );
        const recordedPlacement = proposed.approvedAssetPlacements.some(
          (placement) =>
            placement.pageId === page.pageId &&
            placement.componentId === component.id &&
            placement.componentType === component.component &&
            placement.assetSlotId === assignment.slotId &&
            placement.assetId === assignment.assetId &&
            placement.role === assignment.role,
        );
        if (!originalAssignment && !recordedPlacement) {
          invalid(
            "asset-placement-target-mismatch",
            "A governed follow-up asset assignment must use one recorded approved placement.",
          );
        }
      }
    }
  }
}

function validateRegisteredBrandSystemOperations(
  original: WholeStorefrontRuntimeState,
  input: CoordinatedFollowUpProposalCompilationInput,
) {
  for (const operation of input.plan.sharedOperations) {
    if (operation.type !== "APPLY_REGISTERED_BRAND_SYSTEM") continue;
    if (operation.directionId !== undefined) {
      if (
        input.plan.registeredDirectionId !== undefined &&
        input.plan.registeredDirectionId !== operation.directionId
      ) {
        invalid(
          "invalid-coordinated-plan",
          "A governed BrandSystem operation must use the plan's registered direction.",
        );
      }
      const expected = registeredBrandSystemForDirection(
        original.brandSystem,
        input.planningInput.recipeContext.designSystem,
        operation.directionId,
        operation.designSystemNarrowing,
      );
      if (canonicalValueString(operation.brandSystem) !== canonicalValueString(expected)) {
        invalid(
          "invalid-coordinated-plan",
          "A governed BrandSystem operation must exactly match the registered direction projection.",
        );
      }
      continue;
    }
    const expected = applyRegisteredTokenRefinement(
      original.brandSystem,
      operation.tokenRefinementPlan!,
    );
    if (canonicalValueString(operation.brandSystem) !== canonicalValueString(expected)) {
      invalid(
        "invalid-coordinated-plan",
        "A governed BrandSystem operation must exactly match its validated token refinement.",
      );
    }
  }
}

export function projectWholeStorefrontEvidenceReferences(
  planningInput: WholeStorefrontPlanningInput,
): PageFactEvidenceReference[] {
  return planningInput.brief.businessIdentity.shortDescription.trim() &&
    planningInput.brief.approval.actorId
    ? [
        pageFactEvidenceReferenceSchema.parse({
          source: "merchant-approved",
          authorityId: planningInput.brief.id,
          revision: String(planningInput.brief.revision),
          status: "approved",
          approvalAuthorityId: planningInput.brief.approval.actorId,
          approvalFingerprint: planningInput.brief.approvedEvidenceFingerprint,
        }),
      ]
    : [];
}

function componentProjectionForCoordinatedFollowUp(
  input: CoordinatedFollowUpProposalCompilationInput,
  proposed: WholeStorefrontRuntimeState,
): ComponentProjectionContext {
  const revision = input.plan.commerceFingerprint;
  const products = input.planningInput.catalogue.products.map((product) => ({
    productId: product.id,
    productTypeId: canonicalProductTypePresentationId(product.productType),
    sku: product.sku ?? product.id,
    title: product.title,
    ...(product.description === undefined ? {} : { description: product.description }),
    ...(product.price === undefined
      ? {
          priceUnavailableReason: product.priceUnavailableReason ?? {
            en: "Price unavailable",
            fi: "Hinta ei saatavilla",
          },
        }
      : { price: product.price }),
    ...(product.compareAtPrice === undefined ? {} : { compareAtPrice: product.compareAtPrice }),
    availability:
      product.availabilityLabel ??
      (product.stockStatus === "inStock"
        ? { en: "In stock", fi: "Varastossa" }
        : product.stockStatus === "lowStock"
          ? { en: "Limited availability", fi: "Rajoitettu saatavuus" }
          : product.stockStatus === "outOfStock"
            ? { en: "Currently unavailable", fi: "Ei saatavilla" }
            : { en: "Availability unavailable", fi: "Saatavuus ei saatavilla" }),
    media: product.images.map((image) => ({
      assetId: image.id,
      role: "main" as const,
      ...(image.alt === undefined ? {} : { alt: image.alt }),
    })),
    attributeGroups: [],
    optionGroups: [],
    selectedValues: [],
    unavailableCombinations: [],
    relatedProductIds: [],
    revision,
  }));
  const collectionPlacements = proposed.approvedAssetPlacements.filter(
    (placement) => placement.assetSlotId === "collectionMedia",
  );
  const collections = input.planningInput.catalogue.collections.map((collection, index) => {
    const assets: CollectionPresentationContext["assets"] =
      index < collectionPlacements.length
        ? [
            {
              assetId: collectionPlacements[index].assetId,
              role: collectionPlacements[index].role === "editorialImage" ? "editorial" : "card",
            },
          ]
        : [];
    return {
      collectionId: collection.id,
      title: collection.title,
      ...(collection.description === undefined ? {} : { description: collection.description }),
      assets,
      productIds: collection.productIds,
      filters: [],
      sorting: [],
      emptyState: { title: { en: "No products", fi: "Ei tuotteita" } },
      revision,
    };
  });
  const assetsById = new Map<string, StorefrontAssetMetadata>();
  for (const product of input.planningInput.catalogue.products) {
    for (const image of product.images) {
      assetsById.set(image.id, {
        assetId: image.id,
        role: "productMainImage",
        ...(image.alt === undefined ? { decorative: true } : { alt: image.alt, decorative: false }),
        provenance: { kind: "canonicalProductMedia", sourceId: product.id },
        approvalStatus: "approved",
        usageRights: "merchantOwned",
        responsiveCrops: [],
        revision,
      });
    }
  }
  for (const asset of input.planningInput.approvedAssetContext?.assets ?? []) {
    if (assetsById.has(asset.assetId)) continue;
    assetsById.set(asset.assetId, {
      assetId: asset.assetId,
      role: asset.role,
      ...(asset.alt === null ? {} : { alt: asset.alt }),
      decorative: asset.presentation.decorative,
      provenance: {
        kind:
          asset.provenance.location === "merchant-upload" ? "merchantProvided" : "sourceDiscovered",
        sourceId: asset.sourceReferenceId,
      },
      approvalStatus: "approved",
      usageRights: asset.provenance.location === "merchant-upload" ? "merchantOwned" : "unknown",
      responsiveCrops: asset.presentation.responsiveCrops,
      revision: asset.revision,
    });
  }
  return {
    products,
    collections,
    assets: [...assetsById.values()],
    navigation: [
      ...input.planningInput.draft.navigation.primary,
      ...input.planningInput.draft.navigation.footer,
    ].map((item) => ({ navigationId: item.id, revision })),
    projectBrandContexts: [
      { projectId: input.planningInput.project.id, brandSystemRefs: [], revision },
    ],
    localizedContents: [],
    evidenceReferences: projectWholeStorefrontEvidenceReferences(input.planningInput),
    productListRevision: revision,
    collectionListRevision: revision,
  };
}

export function validateWholeStorefrontProposal(
  proposalInput: unknown,
  currentInputValue: unknown,
): WholeStorefrontProposal {
  const proposalResult = wholeStorefrontProposalSchema.safeParse(proposalInput);
  if (!proposalResult.success) {
    return invalid("invalid-plan", "The whole-storefront proposal is incomplete or invalid.");
  }
  const proposal = proposalResult.data;
  const followUp = parseCurrentFollowUp(currentInputValue);
  if (followUp) {
    if (proposal.preconditions.projectRevision !== followUp.planningInput.project.revision) {
      invalid("stale-project", "The project changed after the coordinated proposal was prepared.");
    }
    if (
      proposal.preconditions.draftFingerprint !== followUp.plan.target.activeDraftFingerprint ||
      proposal.draftRevision !== followUp.planningInput.draft.revision
    ) {
      invalid(
        "stale-draft",
        "The active draft changed after the coordinated proposal was prepared.",
      );
    }
    if (
      proposal.preconditions.componentRegistryFingerprint !==
        followUp.plan.componentRegistryFingerprint ||
      proposal.preconditions.canonicalCommerceFingerprint !== followUp.plan.commerceFingerprint ||
      proposal.preconditions.assetContextFingerprint !== followUp.plan.approvedAssetFingerprint ||
      proposal.preconditions.planFingerprint !== followUp.plan.fingerprint ||
      proposal.preconditions.manifestVersion !== followUp.plan.manifest.version ||
      proposal.preconditions.manifestFingerprint !== followUp.plan.manifest.fingerprint ||
      proposal.preconditions.packageRegistryVersion !== followUp.plan.packageRegistry.version ||
      proposal.preconditions.packageRegistryFingerprint !==
        followUp.plan.packageRegistry.fingerprint
    ) {
      invalid("stale-plan", "The coordinated proposal authority is stale.");
    }
    const expected = compileCoordinatedFollowUpProposal(followUp);
    if (
      canonicalValueString({ ...proposal, status: "pending" }) !== canonicalValueString(expected)
    ) {
      invalid(
        "incomplete-required-operation-compilation",
        "The coordinated proposal does not represent the complete validated plan.",
      );
    }
    return proposal;
  }
  const current = parseCurrent(currentInputValue);
  const preconditions = proposal.preconditions;
  if (preconditions.projectRevision !== current.planningInput.project.revision) {
    invalid(
      "stale-project",
      "The project changed after the whole-storefront proposal was prepared.",
    );
  }
  if (
    preconditions.draftFingerprint !==
    `draft-${canonicalValueFingerprint(current.planningInput.draft)}`
  ) {
    invalid(
      "stale-draft",
      "The active draft changed after the whole-storefront proposal was prepared.",
    );
  }
  if (
    preconditions.componentRegistryFingerprint !==
    `component-registry-${canonicalValueFingerprint(
      [...current.planningInput.componentDefinitions]
        .map((definition) => structuredClone(definition))
        .sort((left, right) => left.type.localeCompare(right.type)),
    )}`
  ) {
    invalid("stale-registry", "The component registry changed after the proposal was prepared.");
  }
  if (
    preconditions.canonicalCommerceFingerprint !==
    `canonical-commerce-${canonicalValueFingerprint(current.planningInput.catalogue)}`
  ) {
    invalid(
      "stale-commerce",
      "The canonical commerce projection changed after the proposal was prepared.",
    );
  }
  if (
    preconditions.assetContextFingerprint !==
    (current.planningInput.approvedAssetContext?.fingerprint ?? null)
  ) {
    invalid(
      "stale-approved-asset-context",
      "The approved asset context changed after the proposal was prepared.",
    );
  }
  const plan = createPlanFromInputs(current);
  if (preconditions.planFingerprint !== plan.fingerprint) {
    invalid("stale-plan", "The whole-storefront proposal was prepared from a different plan.");
  }
  const currentState = createOriginalState(current, plan);
  if (canonicalValueString(proposal.originalStorefront) !== canonicalValueString(currentState)) {
    invalid(
      "stale-draft",
      "The proposal original storefront no longer matches the active storefront.",
    );
  }
  const expected = compileWholeStorefrontProposal({ plan, planningInput: current.planningInput });
  if (canonicalValueString({ ...proposal, status: "pending" }) !== canonicalValueString(expected)) {
    invalid(
      "incomplete-required-operation-compilation",
      "The whole-storefront proposal does not represent the complete validated plan.",
    );
  }
  const replayed = replayWholeStorefrontProposalOperations(currentState, proposal.operations);
  if (canonicalValueString(replayed) !== canonicalValueString(proposal.proposedStorefront)) {
    invalid(
      "proposal-projection-mismatch",
      "The whole-storefront proposal is not reproducible from its operations.",
    );
  }
  return proposal;
}
