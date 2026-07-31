import {
  storefrontDesignSystemV1,
  type StorefrontDesignDirectionId,
} from "@/application/storefront-design-system";
import { veskifyComponentDefinitionsV2 } from "@/components/registry/v2-registry";
import {
  canonicalStorefrontContentFingerprint,
  canonicalValueFingerprint,
  type PageModel,
  type StorefrontSnapshot,
} from "@/domain/storefront";
import type { WholeStorefrontGenerationPlan } from "@/application/whole-storefront-generation-plan";

export const P9R_04_MODERN_TECHNICAL_REQUEST =
  "Redesign the entire storefront in a modern technical direction. Create a substantially different coordinated composition across the homepage, collection page and product-detail page. Use compact spacing, crisp surfaces, commerce-focused collection cards, structured product discovery, a specification-led product-detail page, and a coordinated shared header and footer. Preserve all catalogue data, product identities, prices, stock, options, media bindings and approved assets.";

export const P9R_04_VIEWPORTS = [375, 768, 1024, 1440] as const;
export const P9R_04_LOCALES = ["en", "fi"] as const;

type CorePageType = "home" | "collection" | "product";

export type P9r04StructuralProjection = Readonly<{
  sharedFrame: Readonly<{
    announcement: string | null;
    header: string;
    footer: string;
    primaryNavigation: readonly string[];
    footerNavigation: readonly string[];
    surface: Readonly<{
      background: string;
      surface: string;
      border: string;
      depth: string;
    }>;
  }>;
  homepage: Readonly<{
    recipeId: string;
    sectionIds: readonly string[];
    sectionOrder: readonly string[];
    hero: string;
    featuredProducts: string;
    featuredCollections: string;
    campaignOrStory: readonly string[];
    trust: string | null;
  }>;
  collection: Readonly<{
    recipeId: string;
    sectionIds: readonly string[];
    header: string;
    commerce: Readonly<{
      variant: string;
      filterLayout: string;
      gridDensity: string;
      cardVariant: string;
      collectionId: string;
      productIds: readonly string[];
    }>;
  }>;
  product: Readonly<{
    recipeId: string;
    sectionIds: readonly string[];
    header: string;
    commerce: Readonly<{
      variant: string;
      galleryLayout: string;
      mediaTreatment: string;
      optionDensity: string;
      attributeLayout: string;
      productId: string;
      relatedProductIds: readonly string[];
    }>;
  }>;
  designSystem: Readonly<{
    typography: Readonly<{ headingFont: string; bodyFont: string }>;
    spacingDensity: string;
    cornerTreatment: string;
    surfaceDepth: string;
    imageTreatment: string;
    tokens: Readonly<{
      primary: string;
      background: string;
      surface: string;
      border: string;
    }>;
  }>;
}>;

export type P9r04StructuralComparison = Readonly<{
  before: P9r04StructuralProjection;
  after: P9r04StructuralProjection;
  changed: Readonly<{
    sharedFrame: readonly string[];
    homepage: readonly string[];
    collection: readonly string[];
    product: readonly string[];
    designSystem: readonly string[];
  }>;
}>;

function requiredPage(snapshot: StorefrontSnapshot, type: CorePageType): PageModel {
  const page = snapshot.pages.find((candidate) => candidate.type === type);
  if (!page) throw new Error(`P9R-04 requires a ${type} page.`);
  return page;
}

function requiredSection(page: PageModel, component: string) {
  const section = page.sections.find((candidate) => candidate.component === component);
  if (!section) throw new Error(`P9R-04 requires ${component} on ${page.type}.`);
  return section;
}

function stringProp(value: Record<string, unknown>, key: string): string {
  const item = value[key];
  if (typeof item !== "string" || item.length === 0) {
    throw new Error(`P9R-04 requires a string ${key} property.`);
  }
  return item;
}

function stringArrayProp(value: Record<string, unknown>, key: string): readonly string[] {
  const item = value[key];
  if (!Array.isArray(item)) {
    throw new Error(`P9R-04 requires a string-array ${key} property.`);
  }
  const values = item.filter((entry): entry is string => typeof entry === "string");
  if (values.length !== item.length) {
    throw new Error(`P9R-04 requires a string-array ${key} property.`);
  }
  return values;
}

function recipeIdFor(page: PageModel): string {
  const recipes =
    page.type === "home"
      ? storefrontDesignSystemV1.homepageRecipes
      : page.type === "collection"
        ? storefrontDesignSystemV1.collectionRecipes
        : storefrontDesignSystemV1.productRecipes;
  const actual = page.sections.map((section) => `${section.component}:${section.variant}`);
  const matches = recipes.filter((recipe) => {
    const required = recipe.sections
      .filter((section) => section.required)
      .map((section) => `${section.component}:${section.variant}`);
    return required.every((selection) => actual.includes(selection));
  });
  return matches.length === 1
    ? (matches[0]?.id ?? `uncoordinated-${page.type}-baseline`)
    : `uncoordinated-${page.type}-baseline`;
}

function componentSelection(page: PageModel, component: string): string {
  const section = requiredSection(page, component);
  return `${section.component}:${section.variant}`;
}

function sectionIds(page: PageModel) {
  return page.sections.map((section) => section.id);
}

function changedKeys<T extends Record<string, unknown>>(before: T, after: T): string[] {
  return Object.keys(before).filter(
    (key) => canonicalValueFingerprint(before[key]) !== canonicalValueFingerprint(after[key]),
  );
}

/**
 * Derives comparison evidence from the persisted StorefrontSnapshot. It deliberately
 * excludes proposal identity, fingerprints, and serialized size so an implementation
 * must change real page selections to satisfy the gate.
 */
export function projectP9r04Storefront(snapshot: StorefrontSnapshot): P9r04StructuralProjection {
  const homepage = requiredPage(snapshot, "home");
  const collection = requiredPage(snapshot, "collection");
  const product = requiredPage(snapshot, "product");
  const homeHeader = requiredSection(homepage, "header");
  const homeFooter = requiredSection(homepage, "footer");
  const collectionCommerce = collection.sections.find(
    (section) => section.component === "dynamicCollectionCommerce",
  );
  const collectionHeader = collection.sections.find(
    (section) => section.component === "collectionHeader",
  );
  const collectionFilter = collection.sections.find((section) => section.component === "filterBar");
  const collectionGrid = collection.sections.find((section) => section.component === "productGrid");
  const productDetail = product.sections.find(
    (section) => section.component === "dynamicProductDetail",
  );
  const productGallery = product.sections.find((section) => section.component === "productGallery");
  const productInfo = product.sections.find((section) => section.component === "productInfo");
  const productOptions = product.sections.find((section) => section.component === "productOptions");
  if (!collectionCommerce && (!collectionHeader || !collectionFilter || !collectionGrid)) {
    throw new Error("P9R-04 requires a registered collection composition.");
  }
  if (!productDetail && (!productGallery || !productInfo || !productOptions)) {
    throw new Error("P9R-04 requires a registered product composition.");
  }
  const announcement = homepage.sections.find((section) => section.component === "announcementBar");
  const hero = requiredSection(homepage, "hero");
  const productGrid = requiredSection(homepage, "productGrid");
  const discovery = requiredSection(homepage, "featuredCategories");
  const brandStory = homepage.sections.find((section) => section.component === "brandStory");
  const campaign = homepage.sections.find((section) => section.component === "campaignBanner");
  const trust = homepage.sections.find((section) => section.component === "benefitIcons");

  return {
    sharedFrame: {
      announcement: announcement ? componentSelection(homepage, "announcementBar") : null,
      header: `${homeHeader.component}:${homeHeader.variant}`,
      footer: `${homeFooter.component}:${homeFooter.variant}`,
      primaryNavigation: snapshot.navigation.primary.map((item) => item.id),
      footerNavigation: snapshot.navigation.footer.map((item) => item.id),
      surface: {
        background: snapshot.brandSystem.colors.background,
        surface: snapshot.brandSystem.colors.surface,
        border: snapshot.brandSystem.colors.border,
        depth:
          snapshot.brandSystem.visualSystem?.surfaceDepth ??
          snapshot.brandSystem.visualSystem?.surface ??
          "unconfigured",
      },
    },
    homepage: {
      recipeId: recipeIdFor(homepage),
      sectionIds: sectionIds(homepage),
      sectionOrder: homepage.sections.map((section) => `${section.component}:${section.variant}`),
      hero: `${hero.component}:${hero.variant}`,
      featuredProducts: `${productGrid.component}:${productGrid.variant}`,
      featuredCollections: `${discovery.component}:${discovery.variant}`,
      campaignOrStory: [brandStory, campaign]
        .filter((section): section is NonNullable<typeof section> => section !== undefined)
        .map((section) => `${section.component}:${section.variant}`),
      trust: trust ? `${trust.component}:${trust.variant}` : null,
    },
    collection: {
      recipeId: recipeIdFor(collection),
      sectionIds: sectionIds(collection),
      header: componentSelection(collection, "header"),
      commerce: collectionCommerce
        ? {
            variant: collectionCommerce.variant,
            filterLayout: stringProp(collectionCommerce.props, "filterLayout"),
            gridDensity: stringProp(collectionCommerce.props, "gridDensity"),
            cardVariant: stringProp(collectionCommerce.props, "cardVariant"),
            collectionId: stringProp(collectionCommerce.content, "collectionId"),
            productIds: stringArrayProp(collectionCommerce.content, "productIds"),
          }
        : {
            variant: `legacy:${collectionHeader!.variant}`,
            filterLayout: `legacy:${collectionFilter!.variant}`,
            gridDensity: `legacy:${stringProp(collectionGrid!.props, "columns")}`,
            cardVariant: `legacy:${collectionGrid!.variant}`,
            collectionId: stringProp(collectionHeader!.content, "collectionId"),
            productIds: stringArrayProp(collectionGrid!.content, "productIds"),
          },
    },
    product: {
      recipeId: recipeIdFor(product),
      sectionIds: sectionIds(product),
      header: componentSelection(product, "header"),
      commerce: productDetail
        ? {
            variant: productDetail.variant,
            galleryLayout: stringProp(productDetail.props, "galleryLayout"),
            mediaTreatment: stringProp(productDetail.props, "mediaTreatment"),
            optionDensity: stringProp(productDetail.props, "optionDensity"),
            attributeLayout: stringProp(productDetail.props, "attributeLayout"),
            productId: stringProp(productDetail.content, "productId"),
            relatedProductIds: stringArrayProp(productDetail.content, "relatedProductIds"),
          }
        : {
            variant: `legacy:${productGallery!.variant}`,
            galleryLayout: `legacy:${productGallery!.variant}`,
            mediaTreatment: `legacy:${productGallery!.variant}`,
            optionDensity: `legacy:${productOptions!.variant}`,
            attributeLayout: `legacy:${productInfo!.variant}`,
            productId: stringProp(productGallery!.content, "productId"),
            relatedProductIds: [],
          },
    },
    designSystem: {
      typography: {
        headingFont: snapshot.brandSystem.typography.headingFont,
        bodyFont: snapshot.brandSystem.typography.bodyFont,
      },
      spacingDensity: snapshot.brandSystem.spacing.density,
      cornerTreatment: snapshot.brandSystem.shape.radius,
      surfaceDepth:
        snapshot.brandSystem.visualSystem?.surfaceDepth ??
        snapshot.brandSystem.visualSystem?.surface ??
        "unconfigured",
      imageTreatment:
        snapshot.brandSystem.visualSystem?.imageTreatment ?? snapshot.brandSystem.imagery.style,
      tokens: {
        primary: snapshot.brandSystem.colors.primary,
        background: snapshot.brandSystem.colors.background,
        surface: snapshot.brandSystem.colors.surface,
        border: snapshot.brandSystem.colors.border,
      },
    },
  };
}

export function compareP9r04Storefronts(
  baseline: StorefrontSnapshot,
  generated: StorefrontSnapshot,
): P9r04StructuralComparison {
  const before = projectP9r04Storefront(baseline);
  const after = projectP9r04Storefront(generated);
  return {
    before,
    after,
    changed: {
      sharedFrame: changedKeys(before.sharedFrame, after.sharedFrame),
      homepage: changedKeys(before.homepage, after.homepage),
      collection: changedKeys(before.collection, after.collection),
      product: changedKeys(before.product, after.product),
      designSystem: changedKeys(before.designSystem, after.designSystem),
    },
  };
}

export function assertP9r04MaterialStructuralDifference(
  comparison: P9r04StructuralComparison,
): P9r04StructuralComparison {
  for (const surface of ["sharedFrame", "homepage", "collection", "product"] as const) {
    if (comparison.changed[surface].length === 0) {
      throw new Error(`P9R-04 requires a material ${surface} change.`);
    }
  }
  if (comparison.changed.designSystem.length < 2) {
    throw new Error("P9R-04 requires at least two persisted design-system changes.");
  }
  return comparison;
}

function matchingDirection(plan: WholeStorefrontGenerationPlan): StorefrontDesignDirectionId {
  return plan.designSystemSelection.directionId;
}

/**
 * Verifies claimed structural capabilities at each live authority boundary.
 * The final renderer requirement is checked by callers using the registered
 * rendered page; this helper covers registry through accepted snapshot.
 */
export function p9r04CapabilityPathEvidence({
  plan,
  compiled,
  accepted,
}: {
  plan: WholeStorefrontGenerationPlan;
  compiled: {
    proposedStorefront: {
      pages: readonly {
        pageId: string;
        components: readonly { component: string; variant: string }[];
      }[];
    };
  };
  accepted: StorefrontSnapshot;
}) {
  const direction = matchingDirection(plan);
  const required = [
    plan.designSystemSelection.componentSelections.header,
    plan.designSystemSelection.componentSelections.hero,
    plan.designSystemSelection.componentSelections.productCard,
    plan.designSystemSelection.componentSelections.collectionCommerce,
    plan.designSystemSelection.componentSelections.productDetail,
    plan.designSystemSelection.componentSelections.footer,
  ];
  return required.map((selection) => {
    const registry = veskifyComponentDefinitionsV2.find(
      (definition) => definition.type === selection.component,
    );
    if (!registry) {
      throw new Error(
        `P9R-04 component ${selection.component} is missing from ComponentDefinitionV2.`,
      );
    }
    if (!registry.variants.some((variant) => variant.id === selection.variant)) {
      throw new Error(
        `P9R-04 selection ${selection.component}:${selection.variant} is unregistered.`,
      );
    }
    const planned = Object.values(plan.designSystemSelection.componentSelections).some(
      (candidate) =>
        candidate.component === selection.component && candidate.variant === selection.variant,
    );
    const compiledPresent = compiled.proposedStorefront.pages.some((page) =>
      page.components.some(
        (component) =>
          component.component === selection.component && component.variant === selection.variant,
      ),
    );
    const stored = accepted.pages.some((page) =>
      page.sections.some(
        (section) =>
          section.component === selection.component && section.variant === selection.variant,
      ),
    );
    return {
      direction,
      component: selection.component,
      variant: selection.variant,
      registered: true,
      plannerVisible: planned,
      compilerPreserved: compiledPresent,
      snapshotStored: stored,
    };
  });
}

export function p9r04SnapshotFingerprint(snapshot: StorefrontSnapshot) {
  return canonicalValueFingerprint(snapshot);
}

export function p9r04ContentFingerprint(snapshot: StorefrontSnapshot) {
  return canonicalStorefrontContentFingerprint(snapshot);
}
