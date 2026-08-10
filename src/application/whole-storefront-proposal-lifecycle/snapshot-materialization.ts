import {
  createWholeStorefrontGenerationTarget,
  resolveApprovedBrandStoryMedia,
  wholeStorefrontPlanningInputSchema,
  type ApprovedAssetPresentation,
  type WholeStorefrontPlanningInput,
} from "@/application/whole-storefront-generation-plan";
import { createComponentRegistryV2 } from "@/domain/component-platform";
import {
  approvedAssetPresentationSchema,
  canonicalValueString,
  storefrontSnapshotSchema,
  type ApprovedAssetPlacementOperation,
  type PageModel,
  type SectionInstance,
  type StorefrontSnapshot,
} from "@/domain/storefront";
import {
  wholeStorefrontRuntimeStateSchema,
  type WholeStorefrontRuntimeComponent,
  type WholeStorefrontRuntimeState,
} from "./contract";

export class WholeStorefrontSnapshotMaterializationError extends Error {
  constructor(options?: ErrorOptions) {
    super("The accepted whole-storefront result cannot be materialized canonically.", options);
    this.name = "WholeStorefrontSnapshotMaterializationError";
  }
}

function invalid(cause?: unknown): never {
  throw new WholeStorefrontSnapshotMaterializationError(
    cause === undefined ? undefined : { cause },
  );
}

export function projectWholeStorefrontRuntimeSection(
  componentInput: WholeStorefrontRuntimeComponent,
  planningInput: WholeStorefrontPlanningInput,
  approvedAssetPresentations: readonly ApprovedAssetPresentation[],
  approvedAssetPlacements: readonly ApprovedAssetPlacementOperation[],
): SectionInstance {
  try {
    const { visible, ...instance } = componentInput;
    const component = resolveApprovedBrandStoryMedia(
      instance,
      planningInput.approvedAssetContext,
      approvedAssetPresentations,
    );
    const placements = approvedAssetPlacements
      .filter(
        (placement) =>
          placement.componentId === component.id && placement.componentType === component.component,
      )
      .map((placement) => structuredClone(placement));
    const compactAssignments = new Map(
      component.assetAssignments.map((assignment) => [
        `${assignment.slotId}:${assignment.assetId}`,
        assignment,
      ]),
    );
    placements.forEach((placement) => {
      const assignment = compactAssignments.get(`${placement.assetSlotId}:${placement.assetId}`);
      if (
        !assignment ||
        assignment.assetId !== placement.assetId ||
        assignment.role !== placement.role
      ) {
        invalid();
      }
    });
    const presentations = placements.flatMap((placement) => {
      const presentation = approvedAssetPresentations.find(
        (candidate) =>
          candidate.assetId === placement.assetId &&
          candidate.role === placement.role &&
          candidate.revision === placement.assetRevision &&
          candidate.materialFingerprint === placement.materialFingerprint,
      );
      return presentation
        ? [approvedAssetPresentationSchema.parse(structuredClone(presentation))]
        : [];
    });
    const base = {
      id: component.id,
      component: component.component,
      variant: component.variant,
      visible,
      props: structuredClone(component.props),
      approvedAssetPlacements: placements,
      approvedAssetPresentations: presentations,
    };
    if (component.component === "dynamicCollectionCommerce") {
      const collection = component.bindings.find((binding) => binding.source === "collection");
      const products = component.bindings.find((binding) => binding.source === "productList");
      if (!collection || !products || collection.revision !== products.revision) invalid();
      return {
        ...base,
        content: {
          ...structuredClone(component.content),
          collectionId: collection.collectionId,
          productIds: [...products.productIds],
          canonicalRevision: collection.revision,
        },
      };
    }
    if (component.component === "dynamicProductDetail") {
      const product = component.bindings.find((binding) => binding.source === "product");
      const related = component.bindings.find((binding) => binding.source === "productList");
      if (!product) invalid();
      return {
        ...base,
        content: {
          ...structuredClone(component.content),
          productId: product.productId,
          relatedProductIds: related ? [...related.productIds] : [],
          canonicalRevision: product.revision,
        },
      };
    }
    if (component.component === "homepageFeaturedProducts") {
      const products = component.bindings.find(
        (
          binding,
        ): binding is Extract<(typeof component.bindings)[number], { source: "productList" }> =>
          binding.source === "productList" && binding.slotId === "products",
      );
      if (!products) invalid();
      return {
        ...base,
        content: {
          ...structuredClone(component.content),
          productIds: [...products.productIds],
        },
      };
    }
    return { ...base, content: structuredClone(component.content) };
  } catch (error) {
    if (error instanceof WholeStorefrontSnapshotMaterializationError) throw error;
    return invalid(error);
  }
}

export function projectWholeStorefrontRuntimePage(
  currentPage: PageModel,
  components: readonly WholeStorefrontRuntimeComponent[],
  planningInput: WholeStorefrontPlanningInput,
  approvedAssetPresentations: readonly ApprovedAssetPresentation[],
  approvedAssetPlacements: readonly ApprovedAssetPlacementOperation[],
): PageModel {
  return {
    ...structuredClone(currentPage),
    sections: components.map((component) =>
      projectWholeStorefrontRuntimeSection(
        component,
        planningInput,
        approvedAssetPresentations,
        approvedAssetPlacements.filter((placement) => placement.pageId === currentPage.id),
      ),
    ),
  };
}

function expectedPageRole(page: PageModel): WholeStorefrontRuntimeState["pages"][number]["role"] {
  if (page.pageFamily?.familyId === "search-results") return "other";
  if (page.type === "home") return "homepage";
  if (page.type === "collection") return "collection-template";
  if (page.type === "product") return "product-template";
  return "other";
}

/**
 * Canonical whole-storefront proposal-result to StorefrontSnapshot materialization.
 * It reuses the same runtime component projection used by the server proposal envelope.
 */
export function materializeWholeStorefrontRuntimeSnapshot(input: {
  runtime: unknown;
  planningInput: unknown;
  approvedAssetPresentations?: readonly ApprovedAssetPresentation[];
}): StorefrontSnapshot {
  try {
    const runtime = wholeStorefrontRuntimeStateSchema.parse(structuredClone(input.runtime));
    const planningInput = wholeStorefrontPlanningInputSchema.parse(
      structuredClone(input.planningInput),
    );
    const base = storefrontSnapshotSchema.parse(structuredClone(planningInput.draft));
    const presentations = (input.approvedAssetPresentations ?? []).map((presentation) =>
      approvedAssetPresentationSchema.parse(structuredClone(presentation)),
    );
    const target = createWholeStorefrontGenerationTarget(planningInput);
    const registry = createComponentRegistryV2(planningInput.componentDefinitions);
    if (
      runtime.projectId !== planningInput.project.id ||
      runtime.projectId !== base.projectId ||
      runtime.projectRevision !== planningInput.project.revision ||
      runtime.draftSnapshotId !== base.id ||
      runtime.draftRevision !== base.revision ||
      runtime.draftFingerprint !== target.activeDraftFingerprint ||
      runtime.componentRegistryFingerprint !== target.registryFingerprint ||
      runtime.canonicalCommerceFingerprint !== target.canonicalCommerceFingerprint ||
      runtime.approvedAssetContextFingerprint !== target.approvedAssetContextFingerprint
    ) {
      invalid();
    }
    runtime.pages.forEach((page) =>
      page.components.forEach((component) => {
        const { visible, ...instance } = component;
        void visible;
        registry.validateInstance(instance);
      }),
    );
    const runtimePages = new Map(runtime.pages.map((page) => [page.pageId, page]));
    if (
      runtimePages.size !== base.pages.length ||
      base.pages.some((page) => {
        const runtimePage = runtimePages.get(page.id);
        return (
          !runtimePage ||
          runtimePage.type !== page.type ||
          runtimePage.role !== expectedPageRole(page)
        );
      })
    ) {
      invalid();
    }
    const materialized = storefrontSnapshotSchema.parse({
      ...structuredClone(base),
      brandSystem: structuredClone(runtime.brandSystem),
      navigation: structuredClone(runtime.navigation),
      pages: base.pages.map((page) => {
        const runtimePage = runtimePages.get(page.id);
        if (!runtimePage) return invalid();
        return projectWholeStorefrontRuntimePage(
          page,
          runtimePage.components,
          planningInput,
          presentations,
          runtime.approvedAssetPlacements,
        );
      }),
    });
    const sortPlacements = (placements: readonly ApprovedAssetPlacementOperation[]) =>
      [...placements].sort((left, right) =>
        canonicalValueString(left).localeCompare(canonicalValueString(right)),
      );
    const materializedPlacements = sortPlacements(
      materialized.pages.flatMap((page) =>
        page.sections.flatMap((section) => section.approvedAssetPlacements ?? []),
      ),
    );
    if (
      canonicalValueString(materializedPlacements) !==
      canonicalValueString(sortPlacements(runtime.approvedAssetPlacements))
    ) {
      invalid();
    }
    return materialized;
  } catch (error) {
    if (error instanceof WholeStorefrontSnapshotMaterializationError) throw error;
    return invalid(error);
  }
}
