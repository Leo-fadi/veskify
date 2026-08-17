import {
  createWholeStorefrontGenerationTarget,
  resolveApprovedBrandStoryMedia,
  wholeStorefrontPlanningInputSchema,
  type ApprovedAssetPresentation,
  type WholeStorefrontPlanningInput,
} from "@/application/whole-storefront-generation-plan";
import { resolveDynamicCommerceRoutePage } from "@/application/dynamic-commerce-routes";
import { createComponentRegistryV2 } from "@/domain/component-platform";
import {
  approvedAssetPresentationSchema,
  canonicalValueString,
  createDynamicCommercePresentationAuthority,
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

function compactRuntimeDynamicApprovedAssets(
  runtime: WholeStorefrontRuntimeState,
  presentations: readonly ApprovedAssetPresentation[],
): WholeStorefrontRuntimeState["dynamicCommercePresentation"] {
  const authority = runtime.dynamicCommercePresentation;
  if (!authority) return null;
  let changed = false;
  const collectionSearchArchetypes = authority.collectionSearchArchetypes.map((archetype) => {
    const routeIds = authority.collectionRouteMappings
      .filter(({ archetypeId }) => archetypeId === archetype.id)
      .map(({ routeId }) => routeId)
      .sort();
    if (routeIds.length === 0) return structuredClone(archetype);
    const routeAuthorities = routeIds.map((routeId) => {
      const page = runtime.pages.find((candidate) => candidate.pageId === routeId);
      const component = page?.components.find(
        (candidate) => candidate.component === "dynamicCollectionCommerce",
      );
      const placements = runtime.approvedAssetPlacements.filter(
        (placement) =>
          placement.pageId === routeId && placement.componentType === "dynamicCollectionCommerce",
      );
      if (!component) invalid();
      return {
        variant: component.variant,
        visible: component.visible,
        content: structuredClone(component.content),
        props: structuredClone(component.props),
        styleOverrides: structuredClone(component.styleOverrides),
        selections: placements
          .map((placement) => {
            const assignment = component.assetAssignments.find(
              (candidate) =>
                candidate.slotId === placement.assetSlotId &&
                candidate.assetId === placement.assetId &&
                candidate.role === placement.role,
            );
            const presentation = presentations.find(
              (candidate) =>
                candidate.assetId === placement.assetId &&
                candidate.asset.id === placement.assetId &&
                candidate.role === placement.role &&
                candidate.revision === placement.assetRevision &&
                candidate.materialFingerprint === placement.materialFingerprint,
            );
            if (!assignment || !presentation || placement.componentId !== component.id) invalid();
            return {
              assetSlotId: placement.assetSlotId,
              assetId: placement.assetId,
              role: placement.role,
              assetRevision: placement.assetRevision,
              materialFingerprint: placement.materialFingerprint,
              sourceReferenceId: placement.sourceReferenceId,
              ...(placement.sourceProvenanceKind
                ? { sourceProvenanceKind: placement.sourceProvenanceKind }
                : {}),
              ...(placement.placementContext
                ? { placementContext: placement.placementContext }
                : {}),
              ...(placement.placementPurpose
                ? { placementPurpose: placement.placementPurpose }
                : {}),
              ...(placement.reusePolicy ? { reusePolicy: placement.reusePolicy } : {}),
              ...(placement.affinity ? { affinity: placement.affinity } : {}),
              ...(placement.responsiveSourceAssetIds
                ? { responsiveSourceAssetIds: [...placement.responsiveSourceAssetIds] }
                : {}),
              required: placement.required,
              presentation: approvedAssetPresentationSchema.parse(structuredClone(presentation)),
            };
          })
          .sort((left, right) =>
            canonicalValueString(left).localeCompare(canonicalValueString(right)),
          ),
      };
    });
    const reusable = routeAuthorities[0]?.selections ?? [];
    const reusablePresentation = routeAuthorities[0];
    if (
      !reusablePresentation ||
      routeAuthorities.some(
        ({ selections, ...presentation }) =>
          canonicalValueString(presentation) !==
            canonicalValueString({
              variant: reusablePresentation.variant,
              visible: reusablePresentation.visible,
              content: reusablePresentation.content,
              props: reusablePresentation.props,
              styleOverrides: reusablePresentation.styleOverrides,
            }) || canonicalValueString(selections) !== canonicalValueString(reusable),
      )
    ) {
      invalid();
    }
    const componentPresentations = archetype.componentPresentations.map((presentation) => {
      if (presentation.component !== "dynamicCollectionCommerce") {
        return structuredClone(presentation);
      }
      if (
        presentation.variant !== reusablePresentation.variant ||
        presentation.visible !== reusablePresentation.visible ||
        canonicalValueString(presentation.content) !==
          canonicalValueString(reusablePresentation.content) ||
        canonicalValueString(presentation.props) !==
          canonicalValueString(reusablePresentation.props) ||
        canonicalValueString(presentation.styleOverrides ?? {}) !==
          canonicalValueString(reusablePresentation.styleOverrides ?? {}) ||
        canonicalValueString(presentation.approvedAssetSelections ?? []) !==
          canonicalValueString(reusable)
      ) {
        changed = true;
      }
      return {
        ...structuredClone(presentation),
        variant: reusablePresentation.variant,
        visible: reusablePresentation.visible,
        content: structuredClone(reusablePresentation.content),
        props: structuredClone(reusablePresentation.props),
        styleOverrides: structuredClone(reusablePresentation.styleOverrides),
        approvedAssetSelections: structuredClone(reusable),
      };
    });
    return { ...structuredClone(archetype), componentPresentations };
  });
  if (!changed) return structuredClone(authority);
  const { authorityFingerprint: _authorityFingerprint, ...material } = authority;
  void _authorityFingerprint;
  return createDynamicCommercePresentationAuthority({
    ...structuredClone(material),
    authorityRevision: material.authorityRevision + 1,
    collectionSearchArchetypes,
  });
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
    const baseMaterial = structuredClone(base);
    delete baseMaterial.dynamicCommercePresentation;
    const dynamicCommercePresentation = compactRuntimeDynamicApprovedAssets(runtime, presentations);
    const dynamicRouteIds = new Set(
      dynamicCommercePresentation?.routeInventory.map(({ id }) => id) ?? [],
    );
    const navigation = Object.fromEntries(
      Object.entries(runtime.navigation).map(([area, items]) => [
        area,
        items.map((item) =>
          item.target.type === "page" && dynamicRouteIds.has(item.target.pageId)
            ? {
                ...structuredClone(item),
                target: {
                  type: "dynamic-commerce-route" as const,
                  routeId: item.target.pageId,
                },
              }
            : structuredClone(item),
        ),
      ]),
    );
    const sharedFramePlacements = runtime.approvedAssetPlacements.filter(
      ({ placementContext }) => placementContext === "sharedFrame",
    );
    const sharedFramePresentations = sharedFramePlacements.flatMap((placement) => {
      const presentation = presentations.find(
        (candidate) =>
          candidate.assetId === placement.assetId &&
          candidate.role === placement.role &&
          candidate.revision === placement.assetRevision &&
          candidate.materialFingerprint === placement.materialFingerprint,
      );
      return presentation ? [approvedAssetPresentationSchema.parse(presentation)] : [];
    });
    if (
      sharedFramePlacements.length > 0 &&
      (!base.sharedFrame ||
        sharedFramePlacements.some(
          (placement) => placement.componentId !== base.sharedFrame?.header.id,
        ) ||
        sharedFramePresentations.length !== sharedFramePlacements.length)
    ) {
      invalid();
    }
    const materialized = storefrontSnapshotSchema.parse({
      ...baseMaterial,
      brandSystem: structuredClone(runtime.brandSystem),
      navigation,
      ...(base.sharedFrame
        ? {
            sharedFrame: {
              ...structuredClone(base.sharedFrame),
              header: {
                ...structuredClone(base.sharedFrame.header),
                approvedAssetPlacements: structuredClone(sharedFramePlacements),
                approvedAssetPresentations: structuredClone(sharedFramePresentations),
              },
            },
          }
        : {}),
      ...(dynamicCommercePresentation
        ? {
            dynamicCommercePresentation: structuredClone(dynamicCommercePresentation),
          }
        : {}),
      pages: base.pages
        .filter(({ id }) => !dynamicRouteIds.has(id))
        .map((page) => {
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
    const reconstructedDynamicPlacements =
      materialized.dynamicCommercePresentation?.routeInventory.flatMap((route) =>
        route.kind === "search"
          ? []
          : resolveDynamicCommerceRoutePage({
              snapshot: materialized,
              catalogue: planningInput.catalogue,
              routeId: route.id,
              projection: "runtime",
            }).page.sections.flatMap((section) => section.approvedAssetPlacements ?? []),
      ) ?? [];
    const materializedPlacements = sortPlacements([
      ...(materialized.sharedFrame?.header.approvedAssetPlacements ?? []),
      ...materialized.pages.flatMap((page) =>
        page.sections.flatMap((section) => section.approvedAssetPlacements ?? []),
      ),
      ...reconstructedDynamicPlacements,
    ]);
    const runtimePlacements = sortPlacements(
      runtime.approvedAssetPlacements.map((placement) => {
        if (!dynamicRouteIds.has(placement.pageId)) return placement;
        const canonicalPlacement = reconstructedDynamicPlacements.find(
          (candidate) =>
            candidate.pageId === placement.pageId &&
            candidate.componentType === placement.componentType &&
            candidate.assetSlotId === placement.assetSlotId &&
            candidate.assetId === placement.assetId &&
            candidate.role === placement.role &&
            candidate.assetRevision === placement.assetRevision &&
            candidate.materialFingerprint === placement.materialFingerprint &&
            candidate.sourceReferenceId === placement.sourceReferenceId &&
            candidate.sourceProvenanceKind === placement.sourceProvenanceKind &&
            candidate.required === placement.required,
        );
        return canonicalPlacement
          ? { ...structuredClone(placement), componentId: canonicalPlacement.componentId }
          : placement;
      }),
    );
    if (canonicalValueString(materializedPlacements) !== canonicalValueString(runtimePlacements)) {
      invalid();
    }
    return materialized;
  } catch (error) {
    if (error instanceof WholeStorefrontSnapshotMaterializationError) throw error;
    return invalid(error);
  }
}
