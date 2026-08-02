import {
  createWholeStorefrontGenerationPlan,
  createWholeStorefrontGenerationTarget,
  validateWholeStorefrontGenerationPlan,
} from "@/application/whole-storefront-generation-plan";
import {
  wholeStorefrontGenerationPlanSchema,
  wholeStorefrontPlanningInputSchema,
} from "@/application/whole-storefront-generation-plan/contract";
import {
  applyRegisteredTokenRefinement,
  orderSectionsForRecipe,
  registeredBrandSystemForDirection,
} from "@/application/storefront-design-system";
import {
  storefrontStyleDesignSystems,
  storefrontStyleDirectionForRegisteredDirection,
} from "@/application/design-skills";
import { getComponentDefinition } from "@/components/registry";
import {
  componentInstanceV2Schema,
  createComponentRegistryV2,
  type ComponentInstanceV2,
} from "@/domain/component-platform";
import { canonicalValueFingerprint, canonicalValueString } from "@/domain/storefront";
import {
  dynamicCollectionCommerceBridgeContentSchema,
  dynamicProductDetailBridgeContentSchema,
} from "@/components/registry/dynamic-commerce-bridge";
import { dynamicCollectionCommerceDefaultStyleOverrides } from "@/components/registry/dynamic-collection-commerce";
import { dynamicProductDetailDefaultStyleOverrides } from "@/components/registry/dynamic-product-detail";
import {
  wholeStorefrontProposalCompilationInputSchema,
  wholeStorefrontProposalSchema,
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

function parse(input: unknown): WholeStorefrontProposalCompilationInput {
  const result = wholeStorefrontProposalCompilationInputSchema.safeParse(input);
  if (!result.success) {
    return invalid(
      "invalid-plan",
      "The whole-storefront proposal request is incomplete or invalid.",
    );
  }
  return result.data;
}

function parseCurrent(input: unknown): WholeStorefrontProposalCompilationInput {
  const candidate = input as { plan?: unknown; planningInput?: unknown };
  const plan = wholeStorefrontGenerationPlanSchema.safeParse(candidate?.plan);
  const planningInput = wholeStorefrontPlanningInputSchema.safeParse(candidate?.planningInput);
  if (plan.success && planningInput.success)
    return { plan: plan.data, planningInput: planningInput.data };
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
    return createWholeStorefrontGenerationPlan(input.planningInput, {
      directionId: input.plan.designSystemSelection.directionId,
      tokenRefinementPlan: input.plan.tokenRefinementPlan,
    });
  } catch (error) {
    if (error instanceof WholeStorefrontProposalError) throw error;
    return invalid(
      "stale-plan",
      "The active whole-storefront planning inputs are no longer valid.",
    );
  }
}

function sourceComponent(
  page: WholeStorefrontProposalCompilationInput["planningInput"]["draft"]["pages"][number],
  section: WholeStorefrontProposalCompilationInput["planningInput"]["draft"]["pages"][number]["sections"][number],
  plan: ReturnType<typeof validateCurrentPlan>,
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
  if (Object.keys(section.styleOverrides ?? {}).length > 0) {
    return invalid(
      "incomplete-required-operation-compilation",
      "The validated plan does not contain a supported V2 operation for existing section style overrides.",
    );
  }
  let content = structuredClone(section.content);
  let bindings: ComponentInstanceV2["bindings"] = [];
  let styleOverrides: ComponentInstanceV2["styleOverrides"] = {};
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
      assetAssignments: [],
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
      const components = page.sections.map((section) => sourceComponent(page, section, plan));
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
        role: roleForPageType(page.type),
        type: page.type,
        components,
      };
    })
    .sort((left, right) => left.pageId.localeCompare(right.pageId));
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
    pages,
    approvedAssetPlacements: [],
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
  pageRole: WholeStorefrontRuntimePage["role"],
): WholeStorefrontRuntimeComponent {
  if (plan.tokenRefinementPlan !== null) return component;
  const selections = plan.designSystemSelection.componentSelections;
  const selection =
    component.component === "header" || component.component === "footer"
      ? Object.values(selections).find((candidate) => candidate.component === component.component)
      : pageRole === "homepage"
        ? [
            selections.hero,
            selections.collectionDiscovery,
            selections.productCard,
            selections.storytelling,
            selections.campaign,
            selections.trust,
          ].find((candidate) => candidate.component === component.component)
        : pageRole === "collection-template"
          ? [selections.collectionCommerce].find(
              (candidate) => candidate.component === component.component,
            )
          : pageRole === "product-template"
            ? [selections.productDetail].find(
                (candidate) => candidate.component === component.component,
              )
            : undefined;
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

function registeredRecipeForPage(
  plan: ReturnType<typeof validateCurrentPlan>,
  pageRole: WholeStorefrontRuntimePage["role"],
  designSystem: WholeStorefrontProposalCompilationInput["planningInput"]["recipeContext"]["designSystem"],
) {
  if (plan.tokenRefinementPlan !== null || pageRole === "other") return undefined;
  const recipeId =
    pageRole === "homepage"
      ? plan.designSystemSelection.homepageRecipeId
      : pageRole === "collection-template"
        ? plan.designSystemSelection.collectionRecipeId
        : plan.designSystemSelection.productRecipeId;
  const recipes =
    pageRole === "homepage"
      ? designSystem.homepageRecipes
      : pageRole === "collection-template"
        ? designSystem.collectionRecipes
        : designSystem.productRecipes;
  const recipe = recipes.find((candidate) => candidate.id === recipeId);
  if (!recipe) invalid("invalid-plan", "The selected registered page recipe is unavailable.");
  return recipe;
}

function plannedPage(
  original: WholeStorefrontRuntimeState,
  plan: ReturnType<typeof validateCurrentPlan>,
  pagePlan: ReturnType<typeof validateCurrentPlan>["pagePlans"][number],
  designSystem: WholeStorefrontProposalCompilationInput["planningInput"]["recipeContext"]["designSystem"],
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
      "instance" in component ? [] : [[component.componentId, component] as const],
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
            replacementByTarget.has(component.id) &&
            !components.some((candidate) => candidate.id === component.id),
        )
        .map((component) => component.id)
    : [];
  const coordinatedComponents = components.map((component) =>
    coordinatedRuntimeComponent(component, plan, pagePlan.role),
  );
  const registeredRecipe = registeredRecipeForPage(plan, pagePlan.role, designSystem);
  const orderedComponents = registeredRecipe
    ? orderSectionsForRecipe(coordinatedComponents, registeredRecipe)
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
  const page = state.pages.find((candidate) => candidate.pageId === placement.pageId);
  const component = page?.components.find((candidate) => candidate.id === placement.componentId);
  if (!component || component.component !== placement.componentType) {
    invalid(
      "asset-placement-target-mismatch",
      "An approved source asset targets a component that is not present in the proposed storefront.",
    );
  }
  if (
    component.assetAssignments.some(
      (assignment) =>
        assignment.slotId === placement.assetSlotId && assignment.assetId === placement.assetId,
    )
  ) {
    invalid("duplicate-operation-identity", "An approved source asset placement is duplicated.");
  }
  component.assetAssignments.push({
    slotId: placement.assetSlotId,
    assetId: placement.assetId,
    role: placement.role,
  });
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
        const compiled = source ? coordinatedRuntimeComponent(source, plan, page.role) : undefined;
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
    sharedDesignSystemChanges: [...plan.reviewSummary.sharedDesignSystemChanges],
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
        )
      : applyRegisteredTokenRefinement(original.brandSystem, plan.tokenRefinementPlan);
  add(
    plan.tokenRefinementPlan === null
      ? {
          type: "APPLY_REGISTERED_BRAND_SYSTEM",
          directionId: plan.designSystemSelection.directionId,
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
  plan.pagePlans
    .slice()
    .sort((left, right) => left.pageId.localeCompare(right.pageId))
    .forEach((pagePlan) => {
      const planned = plannedPage(
        original,
        plan,
        pagePlan,
        input.planningInput.recipeContext.designSystem,
      );
      add({ type: "APPLY_PAGE_COMPONENTS", ...planned });
    });
  plan.approvedAssetPlacements
    .slice()
    .sort((left, right) => canonicalValueString(left).localeCompare(canonicalValueString(right)))
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

export function validateWholeStorefrontProposal(
  proposalInput: unknown,
  currentInputValue: unknown,
): WholeStorefrontProposal {
  const proposalResult = wholeStorefrontProposalSchema.safeParse(proposalInput);
  if (!proposalResult.success) {
    return invalid("invalid-plan", "The whole-storefront proposal is incomplete or invalid.");
  }
  const proposal = proposalResult.data;
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
