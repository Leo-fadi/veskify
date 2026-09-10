import {
  GENERIC_PDP_ARCHETYPE_ID,
  collectionArchetypeId,
  productArchetypeId,
  type LegacyDynamicPresentationEntry,
  collectionPresentation,
  productPresentation,
  createCollectionArchetype,
  createProductArchetype,
} from "./archetype-presentation";
import { migrateP10B18B03PresentationAuthority } from "./presentation-compatibility";
import {
  type DynamicCommerceMigrationDecision,
  type DynamicCommerceMigrationResult,
  DynamicCommerceMigrationError,
} from "./migration-contract";
import { projectSectionStyleOverrides } from "./presentation-style";
import { failDynamicCommerceRouteAuthority as fail } from "./route-errors";
import { z } from "zod";
import {
  getCommercialCollectionSearchProfile,
  listCommercialCollectionSearchProfiles,
} from "@/application/storefront-templates/commercial-collection-search-profiles";
import {
  getCommercialPdpProfile,
  listCommercialPdpProfiles,
} from "@/application/storefront-templates/commercial-pdp-profiles";
import {
  resolveCollectionContextArchetype,
  selectProductComplexityRule,
  type DynamicCommerceCollectionMatchContext,
} from "./route-selection";
import {
  dynamicCollectionCommerceBridgeContentSchema,
  dynamicCollectionCommercePropsSchema,
  dynamicProductDetailBridgeContentSchema,
  dynamicProductDetailPropsSchema,
} from "@/components/registry";
import {
  catalogueDisplayModelSchema,
  type CatalogueDisplayModel,
  type CollectionDisplayModel,
} from "@/domain/catalogue";
import { canonicalProductTypePresentationId } from "@/domain/product-card";
import { idSchema } from "@/domain/shared";
import {
  DYNAMIC_COMMERCE_PRESENTATION_CONTRACT_VERSION,
  canonicalValueFingerprint,
  canonicalValueString,
  createDynamicCommercePresentationAuthority,
  dynamicCommercePresentationAuthoritySchema,
  dynamicCommerceRouteInventoryEntrySchema,
  isDynamicCommerceArchetypeCompatibleWithSharedFrame,
  storefrontSnapshotSchema,
  type DynamicCommerceCollectionSearchArchetype,
  type DynamicCommerceCollectionContextRule,
  type DynamicCommercePresentationAuthority,
  type DynamicCommerceProductComplexityRule,
  type DynamicCommerceRouteInventoryEntry,
  type DynamicCommerceProductDetailArchetype,
  type PageModel,
  type SectionInstance,
  type StorefrontSnapshot,
} from "@/domain/storefront";
import {
  assertCurrentArchetype,
  validateCurrentDynamicCommercePresentationAuthority,
  exactAuthority,
} from "./current-authority";
import {
  type ResolvedDynamicCommerceRoutePage,
  resolveDynamicCommerceRoutePage,
} from "./route-resolution";
export { validateCurrentDynamicCommercePresentationAuthority } from "./current-authority";
export {
  dynamicCommerceRouteSectionId,
  type DynamicCommerceSearchRuntimeBinding,
} from "./route-projection";
export {
  type ResolvedDynamicCommerceRoutePage,
  type DynamicCommerceRuntimeBindingPolicy,
  resolveDynamicCommerceRuntimeBindingPolicy,
  resolveDynamicCommerceRoutePage,
  dynamicCommerceRouteForProduct,
  dynamicCommerceRouteForCollection,
} from "./route-resolution";

export {
  DynamicCommerceMigrationError,
  type DynamicCommerceMigrationDecision,
  type DynamicCommerceMigrationResult,
} from "./migration-contract";
export {
  dynamicCommerceRouteAuthorityErrorCodes,
  DynamicCommerceRouteAuthorityError,
  type DynamicCommerceRouteAuthorityErrorCode,
} from "./route-errors";
export {
  resolveCollectionContextArchetype,
  resolveProductComplexityArchetype,
  type DynamicCommerceCollectionMatchContext,
} from "./route-selection";
export {
  createDynamicCommerceProductMatchContext,
  type DynamicCommerceProductMatchContext,
} from "./product-match-context";

export const dynamicCommerceDesignSelectionSchema = z
  .object({
    authorityFingerprint: z.string().trim().min(1).max(240),
    collectionArchetypeId: idSchema,
    searchArchetypeId: idSchema,
    standardSimpleArchetypeId: idSchema,
    configurableArchetypeId: idSchema,
    galleryLedArchetypeId: idSchema,
    highConsiderationArchetypeId: idSchema,
    genericFallbackArchetypeId: idSchema,
    productTypeMappings: z.record(idSchema, idSchema),
  })
  .strict();

export type DynamicCommerceDesignSelection = Readonly<{
  authorityFingerprint: string;
  collectionArchetypeId: string;
  searchArchetypeId: string;
  standardSimpleArchetypeId: string;
  configurableArchetypeId: string;
  galleryLedArchetypeId: string;
  highConsiderationArchetypeId: string;
  genericFallbackArchetypeId: string;
  productTypeMappings: Readonly<Record<string, string>>;
}>;

export type DynamicCommerceDesignSelectionErrorCode =
  | "missing-authority"
  | "invalid-selection"
  | "unknown-archetype"
  | "incompatible-context"
  | "stale-authority"
  | "stale-commerce-authority"
  | "stale-product-type-authority";

export class DynamicCommerceDesignSelectionError extends Error {
  constructor(
    readonly code: DynamicCommerceDesignSelectionErrorCode,
    message: string,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = "DynamicCommerceDesignSelectionError";
  }
}

export function registeredDynamicCommerceCollectionArchetypeId(profileId: string): string {
  const archetypeId = collectionArchetypeId(profileId);
  if (!archetypeId) {
    return fail("stale-profile", `Collection profile ${profileId} has no archetype ID.`);
  }
  return archetypeId;
}

function sectionFingerprint(profileId: string, section: SectionInstance): string {
  if (section.component === "dynamicCollectionCommerce") {
    return canonicalValueString(collectionPresentation(profileId, section));
  }
  if (section.component === "dynamicProductDetail") {
    return canonicalValueString(productPresentation(profileId, section));
  }
  return canonicalValueString(section);
}

function legacyDynamicSection(page: PageModel): SectionInstance | undefined {
  return page.sections.find(({ component }) =>
    ["dynamicCollectionCommerce", "dynamicProductDetail"].includes(component),
  );
}

function isLegacyDynamicPage(page: PageModel): boolean {
  return (
    page.pageFamily?.familyId === "collection" ||
    page.pageFamily?.familyId === "search-results" ||
    page.pageFamily?.familyId === "product-detail" ||
    legacyDynamicSection(page) !== undefined
  );
}

function productTypeMappings(
  catalogue: CatalogueDisplayModel,
  rules: readonly DynamicCommerceProductComplexityRule[],
) {
  const byType = new Map<
    string,
    Readonly<{
      productTypeId: string;
      archetypeId: string;
      ruleId: string;
      priority: number;
      productId: string;
    }>
  >();
  catalogue.products.forEach((product) => {
    const productTypeId = canonicalProductTypePresentationId(product.productType);
    const selected = selectProductComplexityRule({ product, rules });
    const candidate = {
      productTypeId,
      archetypeId: selected.archetypeId,
      ruleId: selected.id,
      priority: selected.priority,
      productId: product.id,
    };
    const current = byType.get(productTypeId);
    if (
      !current ||
      candidate.priority > current.priority ||
      (candidate.priority === current.priority &&
        candidate.productId.localeCompare(current.productId) < 0)
    ) {
      byType.set(productTypeId, candidate);
    }
  });
  return [...byType.values()]
    .sort((left, right) => left.productTypeId.localeCompare(right.productTypeId))
    .map(({ productTypeId, archetypeId }) => ({ productTypeId, archetypeId }));
}

function collectionPageDepth(snapshot: StorefrontSnapshot, page: PageModel): number {
  const pages = new Map(snapshot.pages.map((candidate) => [candidate.id, candidate]));
  const visited = new Set([page.id]);
  let depth = 0;
  let parentId = page.pageFamily?.parentPageId;
  while (parentId) {
    if (visited.has(parentId)) {
      return fail("invalid-presentation", "Collection route parent authority is cyclic.");
    }
    visited.add(parentId);
    depth += 1;
    parentId = pages.get(parentId)?.pageFamily?.parentPageId;
  }
  return depth;
}

function collectionMatchContext(
  snapshot: StorefrontSnapshot,
  page: PageModel,
  collection: CollectionDisplayModel,
): DynamicCommerceCollectionMatchContext {
  const profile = getCommercialCollectionSearchProfile(page.pageFamily?.profileId ?? "")?.profile
    ?.commercialCollectionSearch;
  return {
    depth: collectionPageDepth(snapshot, page),
    productCount: collection.productIds.length,
    // The canonical collection projection currently carries no child relation.
    // Never infer one from collection order or naming.
    childCollections: false,
    campaignEvidence: (page.pageFamily?.evidenceReferences.length ?? 0) > 0,
    merchandisingDensity: profile?.designDnaNarrowing.spacingDensity[0] ?? "standard",
  };
}

function createCollectionContextRules(
  collectionArchetypeIds: ReadonlySet<string>,
  collectionFallbackId: string,
): DynamicCommerceCollectionContextRule[] {
  return [
    {
      id: "collection_rule_campaign",
      priority: 90,
      match: {
        childCollections: "any",
        campaignEvidence: "present",
        merchandisingDensity: "spacious",
      },
      archetypeId: collectionArchetypeIds.has("archetype_collection_campaign")
        ? "archetype_collection_campaign"
        : collectionFallbackId,
    },
    {
      id: "collection_rule_children",
      priority: 80,
      match: {
        childCollections: "present",
        campaignEvidence: "any",
        merchandisingDensity: "any",
      },
      archetypeId: collectionArchetypeIds.has("archetype_collection_editorial")
        ? "archetype_collection_editorial"
        : collectionFallbackId,
    },
    {
      id: "collection_rule_dense",
      priority: 70,
      match: {
        productCount: { minimum: 12, maximum: 100_000 },
        childCollections: "any",
        campaignEvidence: "any",
        merchandisingDensity: "compact",
      },
      archetypeId: collectionArchetypeIds.has("archetype_collection_comparison")
        ? "archetype_collection_comparison"
        : collectionFallbackId,
    },
    {
      id: "collection_rule_default",
      priority: 0,
      match: {
        childCollections: "any",
        campaignEvidence: "any",
        merchandisingDensity: "any",
      },
      archetypeId: collectionFallbackId,
    },
  ];
}

function createProductComplexityRules(
  productArchetypeIds: ReadonlySet<string>,
): DynamicCommerceProductComplexityRule[] {
  return [
    {
      id: "product_rule_considered",
      priority: 100,
      match: {
        optionStructure: "configurable",
        optionGroupCount: { minimum: 1, maximum: 100 },
        configurationComplexity: "any",
        mediaAvailability: "any",
        mediaDepth: "any",
        highConsideration: "required",
      },
      archetypeId: productArchetypeIds.has("archetype_pdp_high_consideration")
        ? "archetype_pdp_high_consideration"
        : GENERIC_PDP_ARCHETYPE_ID,
    },
    {
      id: "product_rule_options",
      priority: 90,
      match: {
        optionStructure: "configurable",
        optionGroupCount: { minimum: 1, maximum: 100 },
        configurationComplexity: "complex",
        mediaAvailability: "any",
        mediaDepth: "any",
        highConsideration: "any",
      },
      archetypeId: productArchetypeIds.has("archetype_pdp_high_consideration")
        ? "archetype_pdp_high_consideration"
        : GENERIC_PDP_ARCHETYPE_ID,
    },
    {
      id: "product_rule_configurable",
      priority: 80,
      match: {
        optionStructure: "configurable",
        optionGroupCount: { minimum: 1, maximum: 100 },
        configurationComplexity: "any",
        mediaAvailability: "any",
        mediaDepth: "any",
        highConsideration: "any",
      },
      archetypeId: productArchetypeIds.has("archetype_pdp_configurable")
        ? "archetype_pdp_configurable"
        : GENERIC_PDP_ARCHETYPE_ID,
    },
    {
      id: "product_rule_gallery",
      priority: 85,
      match: {
        optionStructure: "any",
        optionGroupCount: { minimum: 0, maximum: 3 },
        configurationComplexity: "any",
        mediaAvailability: "multiple",
        mediaCount: { minimum: 3, maximum: 100 },
        mediaDepth: "rich",
        highConsideration: "excluded",
      },
      archetypeId: productArchetypeIds.has("archetype_pdp_gallery")
        ? "archetype_pdp_gallery"
        : GENERIC_PDP_ARCHETYPE_ID,
    },
    {
      id: "product_rule_simple",
      priority: 0,
      match: {
        optionStructure: "simple",
        configurationComplexity: "simple",
        mediaAvailability: "any",
        mediaDepth: "any",
        highConsideration: "excluded",
      },
      archetypeId: productArchetypeIds.has("archetype_pdp_standard")
        ? "archetype_pdp_standard"
        : GENERIC_PDP_ARCHETYPE_ID,
    },
  ];
}

function legacyMigrationPreflight(input: {
  catalogue: CatalogueDisplayModel;
  dynamicPages: readonly PageModel[];
}): DynamicCommerceMigrationDecision[] {
  const decisions: DynamicCommerceMigrationDecision[] = [];
  const knownCollectionIds = new Set(input.catalogue.collections.map(({ id }) => id));
  const knownProductIds = new Set(input.catalogue.products.map(({ id }) => id));

  for (const page of input.dynamicPages) {
    const section = legacyDynamicSection(page);
    if (!section || page.sections.length !== 1) continue;
    if (!section.visible) {
      decisions.push({
        code: "unsupported-legacy-layout",
        routeIds: [page.id],
        message:
          "A required legacy dynamic-commerce composite cannot be migrated as a hidden archetype.",
      });
    }

    const familyId = page.pageFamily?.familyId;
    const profileId = page.pageFamily?.profileId;
    const commerceContext = page.pageFamily?.commerceContext;
    if (!profileId) {
      decisions.push({
        code: "missing-profile-identity",
        routeIds: [page.id],
        message: "A legacy dynamic-commerce route has no PageBlueprint profile identity.",
      });
    }

    const expected =
      familyId === "product-detail"
        ? ({ component: "dynamicProductDetail", pageType: "product", context: "product" } as const)
        : familyId === "collection"
          ? ({
              component: "dynamicCollectionCommerce",
              pageType: "collection",
              context: "collection",
            } as const)
          : familyId === "search-results"
            ? ({
                component: "dynamicCollectionCommerce",
                pageType: "collection",
                context: "search",
              } as const)
            : undefined;

    if (
      !expected ||
      section.component !== expected.component ||
      page.type !== expected.pageType ||
      commerceContext?.kind !== expected.context
    ) {
      decisions.push({
        code: "route-family-component-mismatch",
        routeIds: [page.id],
        message:
          "A legacy dynamic-commerce route family, commerce context, page type, and composite component do not agree.",
      });
      continue;
    }

    const plan =
      expected.context === "product"
        ? getCommercialPdpProfile(profileId ?? "")
        : getCommercialCollectionSearchProfile(profileId ?? "");
    if (
      profileId &&
      (!plan?.profile ||
        plan.profile.version !== page.pageFamily?.profileVersion ||
        !plan.profile.componentSelections.some(
          (selection) =>
            selection.component === expected.component &&
            selection.variants.includes(section.variant),
        ))
    ) {
      decisions.push({
        code: plan?.profile ? "route-family-component-mismatch" : "unknown-profile",
        routeIds: [page.id],
        message: plan?.profile
          ? "A legacy dynamic-commerce route does not match its exact registered profile component and variant."
          : "A legacy dynamic-commerce route references an unknown PageBlueprint profile.",
      });
    }

    if (expected.context === "product" && commerceContext.kind === "product") {
      if (typeof section.content.productId !== "string") {
        decisions.push({
          code: "missing-catalogue-identity",
          routeIds: [page.id],
          message: "A legacy product component has no canonical product identity.",
        });
      }
      const content = dynamicProductDetailBridgeContentSchema.safeParse(section.content);
      const props = dynamicProductDetailPropsSchema.safeParse(section.props);
      if (!content.success || !props.success) {
        decisions.push({
          code: "invalid-legacy-schema",
          routeIds: [page.id],
          message: "A legacy product route does not satisfy its registered component schema.",
        });
      } else {
        const productAuthority = getCommercialPdpProfile(profileId ?? "")?.profile
          ?.commercialProductDetail;
        if (
          productAuthority &&
          props.data.relatedCardVariant !== productAuthority.relatedProductCardAnatomyId
        ) {
          decisions.push({
            code: "conflicting-legacy-presentation",
            routeIds: [page.id],
            message:
              "A legacy product route has product-card anatomy that conflicts with its exact registered profile.",
          });
        }
        if (content.data.productId !== commerceContext.productId) {
          decisions.push({
            code: "missing-catalogue-identity",
            routeIds: [page.id],
            message:
              "A legacy product route has conflicting canonical product identities in its route and component binding.",
          });
        }
        const referencedProductIds = [content.data.productId, ...content.data.relatedProductIds];
        if (
          !knownProductIds.has(commerceContext.productId) ||
          referencedProductIds.some((productId) => !knownProductIds.has(productId))
        ) {
          decisions.push({
            code: "unknown-commerce-identity",
            routeIds: [page.id],
            message:
              "A legacy product route references a product absent from the current catalogue.",
          });
        }
      }
      if (
        !dynamicCommerceRouteInventoryEntrySchema.safeParse({
          id: page.id,
          kind: "product",
          route: page.slug,
          productId: commerceContext.productId,
        }).success
      ) {
        decisions.push({
          code: "invalid-route-namespace",
          routeIds: [page.id],
          message: "A legacy product route must use the /products/<slug> namespace.",
        });
      }
      continue;
    }

    if (typeof section.content.collectionId !== "string") {
      decisions.push({
        code: "missing-catalogue-identity",
        routeIds: [page.id],
        message: "A legacy collection/search component has no canonical collection identity.",
      });
    }
    const content = dynamicCollectionCommerceBridgeContentSchema.safeParse(section.content);
    const props = dynamicCollectionCommercePropsSchema.safeParse(section.props);
    if (!content.success || !props.success) {
      decisions.push({
        code: "invalid-legacy-schema",
        routeIds: [page.id],
        message:
          "A legacy collection/search route does not satisfy its registered component schema.",
      });
    } else {
      const collectionAuthority = getCommercialCollectionSearchProfile(profileId ?? "")?.profile
        ?.commercialCollectionSearch;
      if (
        collectionAuthority &&
        props.data.cardVariant !== collectionAuthority.productCardAnatomyId
      ) {
        decisions.push({
          code: "conflicting-legacy-presentation",
          routeIds: [page.id],
          message:
            "A legacy collection route has product-card anatomy that conflicts with its exact registered profile.",
        });
      }
      if (
        commerceContext.kind === "collection" &&
        content.data.collectionId !== commerceContext.collectionId
      ) {
        decisions.push({
          code: "missing-catalogue-identity",
          routeIds: [page.id],
          message:
            "A legacy collection route has conflicting canonical collection identities in its route and component binding.",
        });
      }
      if (
        !knownCollectionIds.has(content.data.collectionId) ||
        content.data.productIds.some((productId) => !knownProductIds.has(productId)) ||
        (commerceContext.kind === "collection" &&
          !knownCollectionIds.has(commerceContext.collectionId))
      ) {
        decisions.push({
          code: "unknown-commerce-identity",
          routeIds: [page.id],
          message:
            "A legacy collection/search route references commerce absent from the current catalogue.",
        });
      }
    }
    const routeInput =
      commerceContext.kind === "collection"
        ? {
            id: page.id,
            kind: "collection" as const,
            route: page.slug,
            collectionId: commerceContext.collectionId,
          }
        : { id: page.id, kind: "search" as const, route: page.slug };
    if (!dynamicCommerceRouteInventoryEntrySchema.safeParse(routeInput).success) {
      decisions.push({
        code: "invalid-route-namespace",
        routeIds: [page.id],
        message:
          commerceContext.kind === "collection"
            ? "A legacy collection route must use the /collections/<slug> namespace."
            : "The legacy search route must be exactly /search.",
      });
    }
  }

  return decisions;
}

function buildAuthority(input: {
  snapshot: StorefrontSnapshot;
  catalogue: CatalogueDisplayModel;
  dynamicPages: readonly PageModel[];
}): DynamicCommercePresentationAuthority | DynamicCommerceMigrationDecision[] {
  const decisions: DynamicCommerceMigrationDecision[] = [];
  const pageSections = new Map<string, SectionInstance>();
  input.dynamicPages.forEach((page) => {
    const section = legacyDynamicSection(page);
    if (!section || page.sections.length !== 1) {
      decisions.push({
        code: "unsupported-legacy-layout",
        routeIds: [page.id],
        message: "A legacy commerce route is not one registered composite presentation.",
      });
      return;
    }
    pageSections.set(page.id, section);
  });
  if (decisions.length) return decisions;

  decisions.push(
    ...legacyMigrationPreflight({
      catalogue: input.catalogue,
      dynamicPages: input.dynamicPages,
    }),
  );
  if (decisions.length) return decisions;

  const byProfile = new Map<string, LegacyDynamicPresentationEntry[]>();
  input.dynamicPages.forEach((page) => {
    const profileId = page.pageFamily?.profileId;
    const section = pageSections.get(page.id);
    if (!profileId || !section) return;
    const values = byProfile.get(profileId) ?? [];
    values.push({ page, section });
    byProfile.set(profileId, values);
  });
  for (const [profileId, entries] of byProfile) {
    const fingerprints = new Set(
      entries.map(({ section }) => sectionFingerprint(profileId, section)),
    );
    if (fingerprints.size > 1) {
      decisions.push({
        code: "conflicting-legacy-presentation",
        routeIds: entries.map(({ page }) => page.id),
        message: `Legacy routes using ${profileId} have materially different presentation choices.`,
      });
    }
  }

  const productProfilesByType = new Map<string, Set<string>>();
  input.dynamicPages.forEach((page) => {
    const commerceContext = page.pageFamily?.commerceContext;
    if (commerceContext?.kind !== "product") return;
    const product = input.catalogue.products.find(({ id }) => id === commerceContext.productId);
    const profileId = page.pageFamily?.profileId;
    if (!product || !profileId) return;
    const typeId = canonicalProductTypePresentationId(product.productType);
    const profiles = productProfilesByType.get(typeId) ?? new Set<string>();
    profiles.add(profileId);
    productProfilesByType.set(typeId, profiles);
  });
  for (const [typeId, profiles] of productProfilesByType) {
    if (profiles.size > 1) {
      decisions.push({
        code: "conflicting-product-type-mapping",
        routeIds: input.dynamicPages
          .filter((page) => {
            const commerceContext = page.pageFamily?.commerceContext;
            if (commerceContext?.kind !== "product") return false;
            const product = input.catalogue.products.find(
              ({ id }) => id === commerceContext.productId,
            );
            return product && canonicalProductTypePresentationId(product.productType) === typeId;
          })
          .map(({ id }) => id),
        message: "One product type has incompatible legacy PDP profile choices.",
      });
    }
  }
  if (decisions.length) return decisions;

  const frameProfileId = input.snapshot.sharedFrame?.profileId;
  const registeredCollectionPlans = listCommercialCollectionSearchProfiles().filter(
    ({ profile }) => profile?.commercialCollectionSearch,
  );
  const compatibleCollectionPlans = registeredCollectionPlans.filter(
    ({ profile }) =>
      profile?.commercialCollectionSearch &&
      (!frameProfileId ||
        new Set<string>(profile.commercialCollectionSearch.compatibleSharedFrameProfileIds).has(
          frameProfileId,
        )),
  );
  const compatibleProductPlans = listCommercialPdpProfiles().filter(
    ({ profile }) =>
      profile?.commercialProductDetail &&
      (!frameProfileId ||
        new Set<string>(profile.commercialProductDetail.compatibleSharedFrameProfileIds).has(
          frameProfileId,
        )),
  );
  const compatibleProfileIds = new Set([
    ...compatibleCollectionPlans.map(({ profile }) => profile!.id),
    ...compatibleProductPlans.map(({ profile }) => profile!.id),
  ]);
  const incompatibleLegacyRoutes = input.dynamicPages.filter(
    ({ pageFamily }) => pageFamily?.profileId && !compatibleProfileIds.has(pageFamily.profileId),
  );
  if (incompatibleLegacyRoutes.length) {
    return [
      {
        code: "conflicting-legacy-presentation",
        routeIds: incompatibleLegacyRoutes.map(({ id }) => id),
        message: "A legacy dynamic-commerce profile is incompatible with the current shared frame.",
      },
    ];
  }
  if (
    !registeredCollectionPlans.length ||
    !compatibleCollectionPlans.length ||
    !compatibleProductPlans.length
  ) {
    return [
      {
        code: "conflicting-legacy-presentation",
        routeIds: input.dynamicPages.map(({ id }) => id),
        message: "The current shared frame has no compatible dynamic-commerce archetypes.",
      },
    ];
  }
  const legacySearchProfileId = input.dynamicPages.find(
    ({ pageFamily }) => pageFamily?.familyId === "search-results",
  )?.pageFamily?.profileId;
  const searchPlan =
    compatibleCollectionPlans.find(({ profile }) => profile?.id === legacySearchProfileId) ??
    compatibleCollectionPlans.find(({ profile }) => profile?.id === "collection-dense-search") ??
    compatibleCollectionPlans[0];
  const searchProfileId = searchPlan.profile!.id;
  const collectionSearchArchetypes = registeredCollectionPlans.map((plan) => {
    const profileId = plan.profile!.id;
    return createCollectionArchetype(
      profileId,
      byProfile.get(profileId),
      ["collection-catalogue-comparison", "collection-dense-search"].includes(profileId),
    );
  });
  const genericProductPlan =
    compatibleProductPlans.find(({ profile }) => profile?.id === "pdp-standard-commerce") ??
    compatibleProductPlans.find(({ profile }) => byProfile.has(profile!.id)) ??
    compatibleProductPlans[0];
  const productDetailArchetypes = [
    ...compatibleProductPlans.map((plan) => {
      const profileId = plan.profile!.id;
      return createProductArchetype(profileId, byProfile.get(profileId));
    }),
    createProductArchetype(genericProductPlan.profile!.id, undefined, true),
  ];

  const routeInventory: DynamicCommerceRouteInventoryEntry[] = input.dynamicPages.map((page) => {
    const context = page.pageFamily?.commerceContext;
    if (context?.kind === "collection") {
      return {
        id: page.id,
        kind: "collection",
        route: page.slug,
        collectionId: context.collectionId,
      };
    }
    if (context?.kind === "product") {
      const section = pageSections.get(page.id);
      const content = dynamicProductDetailBridgeContentSchema.parse(section?.content);
      return {
        id: page.id,
        kind: "product",
        route: page.slug,
        productId: context.productId,
        relatedProductIds: [...content.relatedProductIds],
      };
    }
    if (context?.kind === "search" || page.slug === "/search") {
      return { id: page.id, kind: "search", route: "/search" };
    }
    throw new DynamicCommerceMigrationError([
      {
        code: "missing-route-identity",
        routeIds: [page.id],
        message: "A legacy dynamic route has no canonical commerce identity.",
      },
    ]);
  });
  if (!routeInventory.some(({ kind }) => kind === "search")) {
    routeInventory.push({ id: "dynamic_search_route", kind: "search", route: "/search" });
  }

  const collectionArchetypeIds = new Set(collectionSearchArchetypes.map(({ id }) => id));
  const compatibleCollectionArchetypeIds = new Set(
    compatibleCollectionPlans.map(({ profile }) => collectionArchetypeId(profile!.id)),
  );
  const collectionFallbackId =
    collectionArchetypeId(
      compatibleCollectionPlans.find(({ profile }) => byProfile.has(profile!.id))?.profile?.id ??
        compatibleCollectionPlans[0].profile!.id,
    ) || collectionSearchArchetypes[0].id;
  const collectionContextRules = createCollectionContextRules(
    compatibleCollectionArchetypeIds,
    collectionFallbackId,
  );
  const collectionRouteMappings = routeInventory.flatMap((route) => {
    if (route.kind !== "collection") return [];
    const page = input.dynamicPages.find(({ id }) => id === route.id);
    const profileArchetype = page?.pageFamily?.profileId
      ? collectionArchetypeId(page.pageFamily.profileId)
      : "";
    const collection = input.catalogue.collections.find(({ id }) => id === route.collectionId);
    if (!page || !collection) return [];
    const contextualArchetypeId = resolveCollectionContextArchetype({
      context: collectionMatchContext(input.snapshot, page, collection),
      rules: collectionContextRules,
    });
    if (profileArchetype && collectionArchetypeIds.has(profileArchetype)) {
      return [{ routeId: route.id, archetypeId: profileArchetype }];
    }
    return [
      {
        routeId: route.id,
        archetypeId: contextualArchetypeId,
      },
    ];
  });

  const productArchetypeIds = new Set(productDetailArchetypes.map(({ id }) => id));
  const productComplexityRules = createProductComplexityRules(productArchetypeIds);
  const legacyProductMappings = new Map<string, { archetypeId: string }>();
  input.dynamicPages.forEach((page) => {
    const commerceContext = page.pageFamily?.commerceContext;
    if (commerceContext?.kind !== "product") return;
    const product = input.catalogue.products.find(({ id }) => id === commerceContext.productId);
    const archetypeId = productArchetypeId(page.pageFamily?.profileId ?? "");
    if (product && archetypeId) {
      legacyProductMappings.set(canonicalProductTypePresentationId(product.productType), {
        archetypeId,
      });
    }
  });
  const mappedByComplexity = productTypeMappings(input.catalogue, productComplexityRules);
  const mappings = mappedByComplexity.map((mapping) => ({
    productTypeId: mapping.productTypeId,
    archetypeId: (() => {
      const selected =
        legacyProductMappings.get(mapping.productTypeId)?.archetypeId ?? mapping.archetypeId;
      return productArchetypeIds.has(selected) ? selected : GENERIC_PDP_ARCHETYPE_ID;
    })(),
  }));

  const material = {
    contractVersion: DYNAMIC_COMMERCE_PRESENTATION_CONTRACT_VERSION,
    authorityId: `dynamic_commerce_${canonicalValueFingerprint({
      projectId: input.snapshot.projectId,
      snapshotId: input.snapshot.id,
    }).slice(-24)}`,
    authorityRevision: 1,
    routeInventory,
    collectionSearchArchetypes,
    productDetailArchetypes,
    collectionRouteMappings,
    collectionContextRules,
    productTypeMappings: mappings,
    productComplexityRules,
    searchArchetypeId: collectionArchetypeId(searchProfileId),
    fallbacks: {
      collectionArchetypeId: collectionFallbackId,
      searchArchetypeId: collectionArchetypeId(searchProfileId),
      productDetailArchetypeId: GENERIC_PDP_ARCHETYPE_ID,
    },
  };
  return createDynamicCommercePresentationAuthority(material);
}

export function migrateLegacyDynamicCommerceRoutes(
  snapshotInput: StorefrontSnapshot,
  catalogue: CatalogueDisplayModel,
): DynamicCommerceMigrationResult {
  const snapshotCandidate = structuredClone(snapshotInput);
  const snapshotResult = storefrontSnapshotSchema.safeParse(snapshotCandidate);
  if (!snapshotResult.success) {
    return {
      status: "requires-decision",
      snapshot: snapshotCandidate,
      decisions: [
        {
          code: "invalid-legacy-schema",
          routeIds: [],
          message: "The legacy snapshot does not satisfy the canonical storefront schema.",
        },
      ],
    };
  }
  const snapshot = snapshotResult.data;
  const catalogueResult = catalogueDisplayModelSchema.safeParse(structuredClone(catalogue));
  if (!catalogueResult.success) {
    return {
      status: "requires-decision",
      snapshot,
      decisions: [
        {
          code: "invalid-legacy-schema",
          routeIds: [],
          message: "The current catalogue does not satisfy the canonical commerce schema.",
        },
      ],
    };
  }
  const currentCatalogue = catalogueResult.data;
  if (snapshot.catalogueRef !== currentCatalogue.id) {
    return {
      status: "requires-decision",
      snapshot,
      decisions: [
        {
          code: "missing-catalogue-identity",
          routeIds: [],
          message:
            "The legacy snapshot catalogue reference does not match the supplied canonical catalogue.",
        },
      ],
    };
  }
  if (snapshot.dynamicCommercePresentation) {
    const storedAuthority = dynamicCommercePresentationAuthoritySchema.parse(
      snapshot.dynamicCommercePresentation,
    );
    const migration = migrateP10B18B03PresentationAuthority(storedAuthority);
    if (!migration.migrated) return { status: "current", snapshot, authority: storedAuthority };
    const migrated = storefrontSnapshotSchema.parse({
      ...structuredClone(snapshot),
      dynamicCommercePresentation: migration.authority,
    });
    return {
      status: "migrated",
      snapshot: migrated,
      authority: migration.authority,
      migratedRouteCount: 0,
    };
  }
  const dynamicPages = snapshot.pages.filter(isLegacyDynamicPage);
  if (dynamicPages.length === 0) {
    return {
      status: "requires-decision",
      snapshot,
      decisions: [
        {
          code: "missing-route-identity",
          routeIds: [],
          message: "The legacy snapshot has no concrete dynamic-commerce route inventory.",
        },
      ],
    };
  }
  const removedIds = new Set(dynamicPages.map(({ id }) => id));
  const dynamicParentPages = snapshot.pages.filter(
    (page) =>
      !removedIds.has(page.id) &&
      page.pageFamily?.parentPageId &&
      removedIds.has(page.pageFamily.parentPageId),
  );
  if (dynamicParentPages.length) {
    return {
      status: "requires-decision",
      snapshot,
      decisions: [
        {
          code: "dynamic-parent-reference",
          routeIds: dynamicParentPages.map(({ id }) => id),
          message: "A static page depends on a concrete commerce page as its parent.",
        },
      ],
    };
  }
  let authority: DynamicCommercePresentationAuthority | DynamicCommerceMigrationDecision[];
  try {
    authority = buildAuthority({ snapshot, catalogue: currentCatalogue, dynamicPages });
  } catch (cause) {
    if (cause instanceof DynamicCommerceMigrationError) {
      return { status: "requires-decision", snapshot, decisions: cause.decisions };
    }
    return {
      status: "requires-decision",
      snapshot,
      decisions: [
        {
          code: "invalid-legacy-schema",
          routeIds: dynamicPages.map(({ id }) => id),
          message:
            "Legacy dynamic-commerce presentation cannot be projected through current registered schemas.",
        },
      ],
    };
  }
  if (Array.isArray(authority)) {
    return { status: "requires-decision", snapshot, decisions: authority };
  }
  const routeIds = new Set(authority.routeInventory.map(({ id }) => id));
  const migratedResult = storefrontSnapshotSchema.safeParse({
    ...structuredClone(snapshot),
    pages: snapshot.pages.filter(({ id }) => !removedIds.has(id)),
    navigation: Object.fromEntries(
      Object.entries(snapshot.navigation).map(([area, items]) => [
        area,
        items.map((item) =>
          item.target.type === "page" && routeIds.has(item.target.pageId)
            ? {
                ...item,
                target: { type: "dynamic-commerce-route" as const, routeId: item.target.pageId },
              }
            : structuredClone(item),
        ),
      ]),
    ),
    dynamicCommercePresentation: authority,
  });
  if (!migratedResult.success) {
    return {
      status: "requires-decision",
      snapshot,
      decisions: [
        {
          code: "invalid-legacy-schema",
          routeIds: dynamicPages.map(({ id }) => id),
          message:
            "The migrated dynamic-commerce authority does not satisfy the canonical storefront schema.",
        },
      ],
    };
  }
  const migrated = migratedResult.data;
  return {
    status: "migrated",
    snapshot: migrated,
    authority,
    migratedRouteCount: dynamicPages.length,
  };
}

export function requireMigratedDynamicCommerceSnapshot(
  snapshot: StorefrontSnapshot,
  catalogue: CatalogueDisplayModel,
): StorefrontSnapshot {
  const result = migrateLegacyDynamicCommerceRoutes(snapshot, catalogue);
  if (result.status === "requires-decision")
    throw new DynamicCommerceMigrationError(result.decisions);
  return result.snapshot;
}

/**
 * Resolves the canonical current aggregate authority from either an already
 * migrated snapshot or its exact legacy route inventory without rewriting the
 * StorefrontSnapshot page graph.
 */
export function materializeCurrentDynamicCommercePresentationAuthority(
  snapshotInput: StorefrontSnapshot,
  catalogueInput: CatalogueDisplayModel,
): DynamicCommercePresentationAuthority {
  const snapshot = storefrontSnapshotSchema.parse(structuredClone(snapshotInput));
  const catalogue = catalogueDisplayModelSchema.parse(structuredClone(catalogueInput));
  if (snapshot.catalogueRef !== catalogue.id) {
    throw new DynamicCommerceMigrationError([
      {
        code: "missing-catalogue-identity",
        routeIds: [],
        message: "The snapshot and canonical catalogue identities do not match.",
      },
    ]);
  }
  if (snapshot.dynamicCommercePresentation) {
    const authority = dynamicCommercePresentationAuthoritySchema.parse(
      structuredClone(snapshot.dynamicCommercePresentation),
    );
    return migrateP10B18B03PresentationAuthority(authority).authority;
  }
  const dynamicPages = snapshot.pages.filter(isLegacyDynamicPage);
  const authority = buildAuthority({ snapshot, catalogue, dynamicPages });
  if (Array.isArray(authority)) throw new DynamicCommerceMigrationError(authority);
  return structuredClone(authority);
}

type ValidatedDynamicCommerceDesignSelection = Readonly<{
  snapshot: StorefrontSnapshot;
  selection: DynamicCommerceDesignSelection;
  authority: DynamicCommercePresentationAuthority;
  collectionArchetype: DynamicCommerceCollectionSearchArchetype;
  searchArchetype: DynamicCommerceCollectionSearchArchetype;
  productTypeMappings: readonly Readonly<{ productTypeId: string; archetypeId: string }>[];
}>;

function selectedPdpRoleArchetypes(
  authority: DynamicCommercePresentationAuthority,
  selection: DynamicCommerceDesignSelection,
): readonly DynamicCommerceProductDetailArchetype[] {
  const knownRoleIds = [
    selection.standardSimpleArchetypeId,
    selection.configurableArchetypeId,
    selection.galleryLedArchetypeId,
    selection.highConsiderationArchetypeId,
  ];
  const selected = knownRoleIds.map((archetypeId) =>
    authority.productDetailArchetypes.find(({ id }) => id === archetypeId),
  );
  if (
    selected.some((archetype) => !archetype) ||
    knownRoleIds.some((archetypeId) => archetypeId === authority.fallbacks.productDetailArchetypeId)
  ) {
    throw new DynamicCommerceDesignSelectionError(
      "unknown-archetype",
      "Each known PDP intent role must select an exact current non-fallback archetype.",
    );
  }
  if (
    selection.genericFallbackArchetypeId !== authority.fallbacks.productDetailArchetypeId ||
    selection.genericFallbackArchetypeId !== GENERIC_PDP_ARCHETYPE_ID ||
    !authority.productDetailArchetypes.some(({ id }) => id === selection.genericFallbackArchetypeId)
  ) {
    throw new DynamicCommerceDesignSelectionError(
      "unknown-archetype",
      "Unknown product types require the exact registered generic PDP fallback.",
    );
  }
  return selected as readonly DynamicCommerceProductDetailArchetype[];
}

const PDP_ROLE_SELECTION_BY_COMPLEXITY_RULE_ID = {
  product_rule_considered: "highConsiderationArchetypeId",
  product_rule_options: "highConsiderationArchetypeId",
  product_rule_configurable: "configurableArchetypeId",
  product_rule_gallery: "galleryLedArchetypeId",
  product_rule_simple: "standardSimpleArchetypeId",
} as const satisfies Readonly<
  Record<
    string,
    | "standardSimpleArchetypeId"
    | "configurableArchetypeId"
    | "galleryLedArchetypeId"
    | "highConsiderationArchetypeId"
  >
>;

function materializeSelectedPdpComplexityRules(
  authority: DynamicCommercePresentationAuthority,
  selection: DynamicCommerceDesignSelection,
): DynamicCommerceProductComplexityRule[] {
  const expectedRuleIds = Object.keys(PDP_ROLE_SELECTION_BY_COMPLEXITY_RULE_ID);
  const currentRuleIds = authority.productComplexityRules.map(({ id }) => id);
  if (
    currentRuleIds.length !== expectedRuleIds.length ||
    expectedRuleIds.some((ruleId) => !currentRuleIds.includes(ruleId))
  ) {
    throw new DynamicCommerceDesignSelectionError(
      "stale-authority",
      "Dynamic-commerce PDP role selection requires the exact current product-complexity rule authority.",
    );
  }
  return authority.productComplexityRules.map((rule) => {
    const selectionKey =
      PDP_ROLE_SELECTION_BY_COMPLEXITY_RULE_ID[
        rule.id as keyof typeof PDP_ROLE_SELECTION_BY_COMPLEXITY_RULE_ID
      ];
    if (!selectionKey) {
      throw new DynamicCommerceDesignSelectionError(
        "stale-authority",
        "Dynamic-commerce PDP role selection encountered an unknown product-complexity rule.",
      );
    }
    return { ...structuredClone(rule), archetypeId: selection[selectionKey] };
  });
}

function validatedDynamicCommerceDesignSelection(
  snapshotInput: StorefrontSnapshot,
  catalogueInput: CatalogueDisplayModel,
  selectionInput: DynamicCommerceDesignSelection,
  authorityInput?: DynamicCommercePresentationAuthority,
): ValidatedDynamicCommerceDesignSelection {
  const parsedSelection = dynamicCommerceDesignSelectionSchema.safeParse(selectionInput);
  if (!parsedSelection.success) {
    throw new DynamicCommerceDesignSelectionError(
      "invalid-selection",
      "Dynamic-commerce design selection does not satisfy its strict contract.",
      { cause: parsedSelection.error },
    );
  }
  const selection = parsedSelection.data;
  const snapshot = storefrontSnapshotSchema.parse(structuredClone(snapshotInput));
  const catalogue = catalogueDisplayModelSchema.parse(structuredClone(catalogueInput));
  if (snapshot.catalogueRef !== catalogue.id) {
    throw new DynamicCommerceDesignSelectionError(
      "stale-product-type-authority",
      "Dynamic-commerce selection does not target the snapshot's current catalogue.",
    );
  }
  if (!snapshot.dynamicCommercePresentation && !authorityInput) {
    throw new DynamicCommerceDesignSelectionError(
      "missing-authority",
      "Dynamic-commerce selection requires canonical migrated presentation authority.",
    );
  }
  const authority = dynamicCommercePresentationAuthoritySchema.parse(
    structuredClone(authorityInput ?? snapshot.dynamicCommercePresentation),
  );
  if (selection.authorityFingerprint !== authority.authorityFingerprint) {
    throw new DynamicCommerceDesignSelectionError(
      "stale-authority",
      "Dynamic-commerce selection does not target the exact current presentation authority.",
    );
  }
  const currentProductIds = new Set(catalogue.products.map(({ id }) => id));
  const currentCollectionIds = new Set(catalogue.collections.map(({ id }) => id));
  const staleRoute = authority.routeInventory.find((route) => {
    if (route.kind === "collection") return !currentCollectionIds.has(route.collectionId);
    if (route.kind !== "product") return false;
    return (
      !currentProductIds.has(route.productId) ||
      (route.relatedProductIds ?? []).some((productId) => !currentProductIds.has(productId))
    );
  });
  if (staleRoute) {
    throw new DynamicCommerceDesignSelectionError(
      "stale-commerce-authority",
      "Dynamic-commerce route inventory does not resolve through the supplied canonical catalogue.",
    );
  }
  const collectionArchetype = authority.collectionSearchArchetypes.find(
    ({ id }) => id === selection.collectionArchetypeId,
  );
  if (!collectionArchetype) {
    throw new DynamicCommerceDesignSelectionError(
      "unknown-archetype",
      "The selected collection archetype is absent from current authority.",
    );
  }
  if (!collectionArchetype.supportedContexts.includes("collection")) {
    throw new DynamicCommerceDesignSelectionError(
      "incompatible-context",
      "The selected collection archetype is not collection-compatible.",
    );
  }
  const searchArchetype = authority.collectionSearchArchetypes.find(
    ({ id }) => id === selection.searchArchetypeId,
  );
  if (!searchArchetype) {
    throw new DynamicCommerceDesignSelectionError(
      "unknown-archetype",
      "The selected search archetype is absent from current authority.",
    );
  }
  if (!searchArchetype.supportedContexts.includes("search")) {
    throw new DynamicCommerceDesignSelectionError(
      "incompatible-context",
      "The selected search archetype is not search-compatible.",
    );
  }
  assertCurrentArchetype(snapshot, collectionArchetype);
  assertCurrentArchetype(snapshot, searchArchetype);
  selectedPdpRoleArchetypes(authority, selection).forEach((archetype) =>
    assertCurrentArchetype(snapshot, archetype),
  );
  materializeSelectedPdpComplexityRules(authority, selection);

  const currentProductTypeIds = [
    ...new Set(
      catalogue.products.map(({ productType }) => canonicalProductTypePresentationId(productType)),
    ),
  ].sort();
  const selectedProductTypeIds = Object.keys(selection.productTypeMappings).sort();
  if (
    canonicalValueString(currentProductTypeIds) !== canonicalValueString(selectedProductTypeIds)
  ) {
    throw new DynamicCommerceDesignSelectionError(
      "stale-product-type-authority",
      "Product-type design mappings must exactly cover current canonical product types.",
    );
  }
  const productTypeMappings = currentProductTypeIds.map((productTypeId) => {
    const archetypeId = selection.productTypeMappings[productTypeId];
    const archetype = authority.productDetailArchetypes.find(({ id }) => id === archetypeId);
    if (!archetype || archetype.id === authority.fallbacks.productDetailArchetypeId) {
      throw new DynamicCommerceDesignSelectionError(
        "unknown-archetype",
        "A known product type must select an exact non-fallback current PDP archetype.",
      );
    }
    assertCurrentArchetype(snapshot, archetype);
    return { productTypeId, archetypeId };
  });
  const genericFallback = authority.productDetailArchetypes.find(
    ({ id }) => id === authority.fallbacks.productDetailArchetypeId,
  );
  if (
    !genericFallback ||
    genericFallback.id !== GENERIC_PDP_ARCHETYPE_ID ||
    genericFallback.id !== selection.genericFallbackArchetypeId
  ) {
    throw new DynamicCommerceDesignSelectionError(
      "unknown-archetype",
      "Unknown product types require the registered generic PDP fallback.",
    );
  }
  assertCurrentArchetype(snapshot, genericFallback);

  return {
    snapshot,
    selection: dynamicCommerceDesignSelectionSchema.parse({
      ...selection,
      productTypeMappings: Object.fromEntries(
        productTypeMappings.map(({ productTypeId, archetypeId }) => [productTypeId, archetypeId]),
      ),
    }),
    authority,
    collectionArchetype,
    searchArchetype,
    productTypeMappings: productTypeMappings.map((mapping) => ({ ...mapping })),
  };
}

/**
 * Proves that one exact selection is executable against current aggregate and
 * catalogue authority without constructing a candidate StorefrontSnapshot.
 */
export function validateDynamicCommerceDesignSelection(
  snapshotInput: StorefrontSnapshot,
  catalogueInput: CatalogueDisplayModel,
  selectionInput: DynamicCommerceDesignSelection,
  authorityInput?: DynamicCommercePresentationAuthority,
): DynamicCommerceDesignSelection {
  return structuredClone(
    validatedDynamicCommerceDesignSelection(
      snapshotInput,
      catalogueInput,
      selectionInput,
      authorityInput,
    ).selection,
  );
}

/**
 * Replays one already-bound selection against its exact source aggregate. It
 * is intentionally independent of the page graph and catalogue so proposal
 * acceptance can verify every mutable presentation field deterministically.
 */
export function materializeDynamicCommerceDesignSelectionFromAuthority(
  authorityInput: DynamicCommercePresentationAuthority,
  selectionInput: DynamicCommerceDesignSelection,
): DynamicCommercePresentationAuthority {
  const authority = dynamicCommercePresentationAuthoritySchema.parse(
    structuredClone(authorityInput),
  );
  const selection = dynamicCommerceDesignSelectionSchema.parse(structuredClone(selectionInput));
  if (selection.authorityFingerprint !== authority.authorityFingerprint) {
    throw new DynamicCommerceDesignSelectionError(
      "stale-authority",
      "Dynamic-commerce selection does not target the exact source presentation authority.",
    );
  }
  const collectionArchetype = authority.collectionSearchArchetypes.find(
    ({ id, supportedContexts }) =>
      id === selection.collectionArchetypeId && supportedContexts.includes("collection"),
  );
  const searchArchetype = authority.collectionSearchArchetypes.find(
    ({ id, supportedContexts }) =>
      id === selection.searchArchetypeId && supportedContexts.includes("search"),
  );
  if (!collectionArchetype || !searchArchetype) {
    throw new DynamicCommerceDesignSelectionError(
      "incompatible-context",
      "Dynamic-commerce selection references an unavailable collection or search archetype.",
    );
  }
  selectedPdpRoleArchetypes(authority, selection);
  const productComplexityRules = materializeSelectedPdpComplexityRules(authority, selection);
  const currentProductTypeIds = authority.productTypeMappings
    .map(({ productTypeId }) => productTypeId)
    .sort();
  const selectedProductTypeIds = Object.keys(selection.productTypeMappings).sort();
  if (
    canonicalValueString(currentProductTypeIds) !== canonicalValueString(selectedProductTypeIds)
  ) {
    throw new DynamicCommerceDesignSelectionError(
      "stale-product-type-authority",
      "Dynamic-commerce selection does not exactly cover source product-type authority.",
    );
  }
  const productTypeMappings = currentProductTypeIds.map((productTypeId) => {
    const archetypeId = selection.productTypeMappings[productTypeId];
    const archetype = authority.productDetailArchetypes.find(({ id }) => id === archetypeId);
    if (!archetype || archetypeId === authority.fallbacks.productDetailArchetypeId) {
      throw new DynamicCommerceDesignSelectionError(
        "unknown-archetype",
        "Known product types must select current non-fallback PDP archetypes.",
      );
    }
    return { productTypeId, archetypeId };
  });
  if (
    authority.fallbacks.productDetailArchetypeId !== GENERIC_PDP_ARCHETYPE_ID ||
    !authority.productDetailArchetypes.some(({ id }) => id === GENERIC_PDP_ARCHETYPE_ID)
  ) {
    throw new DynamicCommerceDesignSelectionError(
      "unknown-archetype",
      "Dynamic-commerce authority has no registered generic PDP fallback.",
    );
  }
  const { authorityFingerprint: _authorityFingerprint, ...currentMaterial } = authority;
  const nextAuthority = createDynamicCommercePresentationAuthority({
    ...structuredClone(currentMaterial),
    authorityRevision: authority.authorityRevision + 1,
    collectionRouteMappings: authority.collectionRouteMappings.map(({ routeId }) => ({
      routeId,
      archetypeId: collectionArchetype.id,
    })),
    collectionContextRules: authority.collectionContextRules.map((rule) => ({
      ...structuredClone(rule),
      archetypeId: collectionArchetype.id,
    })),
    productTypeMappings,
    productComplexityRules,
    searchArchetypeId: searchArchetype.id,
    fallbacks: {
      collectionArchetypeId: collectionArchetype.id,
      searchArchetypeId: searchArchetype.id,
      productDetailArchetypeId: GENERIC_PDP_ARCHETYPE_ID,
    },
  });
  void _authorityFingerprint;
  return nextAuthority;
}

/**
 * Materializes only the next aggregate presentation authority. This is the
 * proposal compiler boundary: it does not construct a candidate storefront.
 */
export function materializeDynamicCommerceDesignSelectionAuthority(
  snapshotInput: StorefrontSnapshot,
  catalogueInput: CatalogueDisplayModel,
  selectionInput: DynamicCommerceDesignSelection,
  authorityInput?: DynamicCommercePresentationAuthority,
): DynamicCommercePresentationAuthority {
  const validated = validatedDynamicCommerceDesignSelection(
    snapshotInput,
    catalogueInput,
    selectionInput,
    authorityInput,
  );
  return materializeDynamicCommerceDesignSelectionFromAuthority(
    validated.authority,
    validated.selection,
  );
}

/**
 * Applies one deterministic design selection to the canonical aggregate-level
 * dynamic-commerce presentation authority. Route inventory and protected
 * commerce remain untouched; no per-route design state is introduced.
 */
export function applyDynamicCommerceDesignSelection(
  snapshotInput: StorefrontSnapshot,
  catalogueInput: CatalogueDisplayModel,
  selectionInput: DynamicCommerceDesignSelection,
): StorefrontSnapshot {
  const snapshot = storefrontSnapshotSchema.parse(structuredClone(snapshotInput));
  const nextAuthority = materializeDynamicCommerceDesignSelectionAuthority(
    snapshot,
    catalogueInput,
    selectionInput,
  );
  const result = storefrontSnapshotSchema.parse({
    ...structuredClone(snapshot),
    dynamicCommercePresentation: nextAuthority,
  });
  validateCurrentDynamicCommercePresentationAuthority(result);
  return result;
}

export type DynamicCommerceEditorProjection = ResolvedDynamicCommerceRoutePage &
  Readonly<{ representativeRouteId: string }>;

export function projectDynamicCommerceArchetypePages(
  snapshot: StorefrontSnapshot,
  catalogue: CatalogueDisplayModel,
  representativeRouteIds: Readonly<Record<string, string>> = {},
): DynamicCommerceEditorProjection[] {
  const authority = exactAuthority(snapshot);
  const projections: DynamicCommerceEditorProjection[] = [];
  for (const archetype of authority.collectionSearchArchetypes) {
    if (
      snapshot.sharedFrame &&
      !isDynamicCommerceArchetypeCompatibleWithSharedFrame(
        archetype,
        snapshot.sharedFrame.profileId,
      )
    ) {
      continue;
    }
    const mapped = authority.collectionRouteMappings.find(
      ({ archetypeId }) => archetypeId === archetype.id,
    );
    const fallbackRoute = authority.routeInventory.find(({ kind }) => kind === "collection");
    const requested = authority.routeInventory.find(
      ({ id, kind }) => id === representativeRouteIds[archetype.id] && kind === "collection",
    );
    const routeId = requested?.id ?? mapped?.routeId ?? fallbackRoute?.id;
    if (!routeId) continue;
    const resolved = resolveDynamicCommerceRoutePage({
      snapshot,
      catalogue,
      routeId,
      archetypeId: archetype.id,
      projection: "editor",
    });
    projections.push({ ...resolved, representativeRouteId: routeId });
  }
  for (const archetype of authority.productDetailArchetypes) {
    const mappedType = authority.productTypeMappings.find(
      ({ archetypeId }) => archetypeId === archetype.id,
    );
    const mappedProduct = mappedType
      ? catalogue.products.find(
          (product) =>
            canonicalProductTypePresentationId(product.productType) === mappedType.productTypeId,
        )
      : undefined;
    const fallbackRoute = authority.routeInventory.find(
      (route) =>
        route.kind === "product" && (!mappedProduct || route.productId === mappedProduct.id),
    );
    const requested = authority.routeInventory.find(
      ({ id, kind }) => id === representativeRouteIds[archetype.id] && kind === "product",
    );
    const routeId = requested?.id ?? fallbackRoute?.id;
    if (!routeId) continue;
    const resolved = resolveDynamicCommerceRoutePage({
      snapshot,
      catalogue,
      routeId,
      archetypeId: archetype.id,
      projection: "editor",
    });
    projections.push({ ...resolved, representativeRouteId: routeId });
  }
  return projections;
}

export function applyDynamicCommerceArchetypePage(
  snapshotInput: StorefrontSnapshot,
  page: PageModel,
): StorefrontSnapshot {
  const snapshot = storefrontSnapshotSchema.parse(structuredClone(snapshotInput));
  const authority = exactAuthority(snapshot);
  const collectionIndex = authority.collectionSearchArchetypes.findIndex(
    ({ id }) => id === page.id,
  );
  const productIndex = authority.productDetailArchetypes.findIndex(({ id }) => id === page.id);
  if (collectionIndex < 0 && productIndex < 0) return snapshot;
  if (page.sections.length !== 1)
    return fail("invalid-presentation", "An archetype must retain one composite section.");
  const section = page.sections[0];
  const current =
    collectionIndex >= 0
      ? authority.collectionSearchArchetypes[collectionIndex]
      : authority.productDetailArchetypes[productIndex];
  const presentation =
    current.family === "collection-search"
      ? collectionPresentation(current.profile.profileId, section)
      : productPresentation(current.profile.profileId, section);
  const currentPresentation = current.componentPresentations[0];
  const presentationWithRetainedAssets = {
    ...presentation,
    approvedAssetSelections: (currentPresentation?.approvedAssetSelections ?? []).map((selection) =>
      structuredClone(selection),
    ),
  };
  const canonicalPresentation =
    currentPresentation &&
    canonicalValueString(projectSectionStyleOverrides(currentPresentation.styleOverrides)) ===
      canonicalValueString(
        projectSectionStyleOverrides(presentationWithRetainedAssets.styleOverrides),
      )
      ? {
          ...presentationWithRetainedAssets,
          styleOverrides: structuredClone(currentPresentation.styleOverrides),
        }
      : presentationWithRetainedAssets;
  if (
    canonicalValueString(current.componentPresentations) ===
    canonicalValueString([canonicalPresentation])
  ) {
    return snapshot;
  }
  const nextArchetype = {
    ...structuredClone(current),
    componentPresentations: [canonicalPresentation],
  } as typeof current;
  const nextAuthorityWithoutFingerprint = {
    ...structuredClone(authority),
    authorityRevision: authority.authorityRevision + 1,
    collectionSearchArchetypes:
      collectionIndex >= 0
        ? authority.collectionSearchArchetypes.map((entry, index) =>
            index === collectionIndex
              ? (nextArchetype as DynamicCommerceCollectionSearchArchetype)
              : entry,
          )
        : authority.collectionSearchArchetypes,
    productDetailArchetypes:
      productIndex >= 0
        ? authority.productDetailArchetypes.map((entry, index) =>
            index === productIndex
              ? (nextArchetype as DynamicCommerceProductDetailArchetype)
              : entry,
          )
        : authority.productDetailArchetypes,
  };
  const { authorityFingerprint: _authorityFingerprint, ...material } =
    nextAuthorityWithoutFingerprint;
  void _authorityFingerprint;
  const dynamicCommercePresentation = createDynamicCommercePresentationAuthority(material);
  return storefrontSnapshotSchema.parse({ ...snapshot, dynamicCommercePresentation });
}

export function expandDynamicCommerceRoutePages(
  snapshotInput: StorefrontSnapshot,
  catalogue: CatalogueDisplayModel,
): StorefrontSnapshot {
  const snapshot = storefrontSnapshotSchema.parse(structuredClone(snapshotInput));
  const authority = exactAuthority(snapshot);
  const pages = [
    ...snapshot.pages.map((page) => structuredClone(page)),
    ...authority.routeInventory
      .filter(({ kind }) => kind !== "search")
      .map(({ id }) => resolveDynamicCommerceRoutePage({ snapshot, catalogue, routeId: id }).page),
  ];
  const navigation = Object.fromEntries(
    Object.entries(snapshot.navigation).map(([area, items]) => [
      area,
      items.flatMap((item) => {
        const target = item.target;
        if (target.type !== "dynamic-commerce-route") return [structuredClone(item)];
        const route = authority.routeInventory.find(({ id }) => id === target.routeId);
        return route?.kind === "search"
          ? []
          : [{ ...item, target: { type: "page" as const, pageId: target.routeId } }];
      }),
    ]),
  );
  const { dynamicCommercePresentation: _authority, ...legacy } = snapshot;
  void _authority;
  return storefrontSnapshotSchema.parse({ ...legacy, pages, navigation });
}
