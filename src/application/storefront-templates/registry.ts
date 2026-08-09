import {
  getSupportedSectionManifest,
  type SupportedSectionType,
} from "@/components/registry/supported-vocabulary";
import {
  homepageCollectionNavigationDefinition,
  homepageFeaturedCollectionsDefinition,
  homepageFeaturedProductsDefinition,
  homepageEditorialDefinition,
  homepageHeroDefinition,
  homepageProofDefinition,
  homepagePromotionDefinition,
  homepageTrustDefinition,
} from "@/components/registry/homepage-commerce";
import { canonicalValueString, type PageType } from "@/domain/storefront";
import {
  cloneTemplateDefinition,
  defaultPageBlueprintCompositionContract,
  deepFreeze,
  pageBlueprintCompositionContractSchema,
  storefrontTemplateDefinitionSchema,
  type ExecutablePageBlueprintProfile,
  type StorefrontTemplateDefinition,
  type StorefrontTemplatePagePlan,
  type StorefrontTemplateSlot,
} from "./contract";
import { pageFamilyBaselinePagePlans } from "./page-family-baselines";
import { commercialHomepagePagePlans } from "./commercial-homepage-profiles";
import { commercialPdpPagePlans } from "./commercial-pdp-profiles";
import { commercialCollectionSearchPagePlans } from "./commercial-collection-search-profiles";
import { commercialUtilityPagePlans } from "./commercial-utility-profiles";

export {
  commercialHomepageProfileIds,
  commercialHomepageProfileIdSchema,
  COMMERCIAL_HOMEPAGE_PROFILE_VERSION,
  getCommercialHomepageProfile,
  listCommercialHomepageProfiles,
  validateCommercialHomepageProfileLibrary,
  resolveCommercialHomepageProfileSlots,
  resolveCommercialHomepageSlotItemCardinality,
  resolveCommercialHomepageSlotItemLimit,
  CommercialHomepageProfileError,
  type CommercialHomepageProfileId,
} from "./commercial-homepage-profiles";
export {
  commercialPdpProfileIds,
  commercialPdpProfileIdSchema,
  COMMERCIAL_PDP_PROFILE_VERSION,
  getCommercialPdpProfile,
  listCommercialPdpProfiles,
  validateCommercialPdpProfileLibrary,
  assertCommercialPdpEvidence,
  CommercialPdpProfileError,
  type CommercialPdpProfileId,
} from "./commercial-pdp-profiles";

export {
  commercialCollectionSearchProfileIds,
  commercialCollectionSearchProfileIdSchema,
  COMMERCIAL_COLLECTION_SEARCH_PROFILE_VERSION,
  getCommercialCollectionSearchProfile,
  listCommercialCollectionSearchProfiles,
  validateCommercialCollectionSearchProfileLibrary,
  CommercialCollectionSearchProfileError,
  type CommercialCollectionSearchProfileId,
} from "./commercial-collection-search-profiles";

export {
  commercialUtilityProfileIds,
  commercialUtilityProfileIdSchema,
  COMMERCIAL_UTILITY_PROFILE_VERSION,
  getCommercialUtilityProfile,
  listCommercialUtilityProfiles,
  validateCommercialUtilityProfileLibrary,
  type CommercialUtilityProfileId,
} from "./commercial-utility-profiles";
export { materializeCommerceUtilityPage } from "./commerce-utility-materializer";

const createdAt = "2026-07-18T00:00:00.000Z";
const allPageTypes = ["home", "collection", "product"] as const;

function registeredVariants(definition: Readonly<{ variants: readonly { id: string }[] }>) {
  return definition.variants.map(({ id }) => id);
}

function slot(
  input: Omit<
    StorefrontTemplateSlot,
    "omitWhen" | "narrativeRole" | "visualWeight" | "boundedParameterConstraints"
  > & {
    omitWhen?: StorefrontTemplateSlot["omitWhen"];
    narrativeRole?: StorefrontTemplateSlot["narrativeRole"];
    visualWeight?: StorefrontTemplateSlot["visualWeight"];
    boundedParameterConstraints?: StorefrontTemplateSlot["boundedParameterConstraints"];
  },
): StorefrontTemplateSlot {
  return {
    omitWhen: "never",
    narrativeRole: narrativeRoleForPurpose(input.purpose),
    visualWeight: visualWeightForSection(input.sectionType),
    boundedParameterConstraints: [],
    ...input,
  };
}

function narrativeRoleForPurpose(
  purpose: StorefrontTemplateSlot["purpose"],
): StorefrontTemplateSlot["narrativeRole"] {
  const roles: Record<StorefrontTemplateSlot["purpose"], StorefrontTemplateSlot["narrativeRole"]> =
    {
      "announcement-or-trust": "trust",
      navigation: "orientation",
      hero: "orientation",
      "featured-categories": "secondary-discovery",
      "featured-products": "primary-discovery",
      "editorial-story": "brand-story",
      "campaign-promotion": "campaign",
      "brand-values": "brand-proof",
      "social-proof": "product-proof",
      newsletter: "continuation",
      footer: "service",
      "collection-introduction": "orientation",
      "filtering-or-merchandising": "secondary-discovery",
      "product-media": "product-focus",
      "product-information": "conversion",
      "product-options": "product-focus",
      "related-products": "continuation",
    };
  return roles[purpose];
}

function visualWeightForSection(sectionType: string): StorefrontTemplateSlot["visualWeight"] {
  if (["hero", "productGallery"].includes(sectionType)) return "dominant";
  if (["productGrid", "collectionHeader", "productInfo", "productOptions"].includes(sectionType)) {
    return "heavy";
  }
  if (["header", "footer", "announcementBar", "newsletter"].includes(sectionType)) return "light";
  return "medium";
}

function profileFor(
  id: string,
  pageType: PageType,
  slots: readonly StorefrontTemplateSlot[],
): ExecutablePageBlueprintProfile {
  const roleCounts = new Map<StorefrontTemplateSlot["narrativeRole"], number>();
  slots.forEach((entry) =>
    roleCounts.set(entry.narrativeRole, (roleCounts.get(entry.narrativeRole) ?? 0) + 1),
  );
  return {
    id,
    version: "1.0.0",
    scope: pageType,
    orderedNarrativeRoles: slots.map((entry) => entry.narrativeRole),
    roleCardinality: [...roleCounts.entries()].map(([role, count]) => ({
      role,
      minimum: slots.filter((entry) => entry.narrativeRole === role && entry.required).length,
      maximum: count,
    })),
    componentSelections: slots.map((entry) => ({
      slotId: entry.id,
      component: entry.sectionType,
      variants: [...entry.allowedVariants],
      defaultVariant: entry.defaultVariant,
    })),
    parameterDefaults: {},
    requiredBindingCategories:
      pageType === "collection"
        ? ["collection", "productList"]
        : pageType === "product"
          ? ["product"]
          : ["navigation", "projectBrandContext", "collectionList", "productList"],
    requiredAssetRoles: [],
    responsiveBreakpoints: ["mobile", "tablet", "desktop", "wide"] as const,
    accessibilityContract: "registered-component-contracts" as const,
  };
}

function pagePlan(
  profileId: string,
  pageType: PageType,
  slots: StorefrontTemplateSlot[],
  pageBlueprint = defaultPageBlueprintCompositionContract,
): StorefrontTemplatePagePlan {
  return {
    pageType,
    slots,
    pageBlueprint: structuredClone(pageBlueprint),
    profile: profileFor(profileId, pageType, slots),
  };
}

function specializedSlots(
  slots: readonly StorefrontTemplateSlot[],
  variants: Readonly<Record<string, string>>,
): StorefrontTemplateSlot[] {
  return slots.map((slot) => {
    const defaultVariant = variants[slot.sectionType];
    if (!defaultVariant) return structuredClone(slot);
    return {
      ...structuredClone(slot),
      allowedVariants: [...new Set([...slot.allowedVariants, defaultVariant])],
      defaultVariant,
    };
  });
}

const homePageBlueprint = pageBlueprintCompositionContractSchema.parse({
  allowedNarrativeRoles: [
    "orientation",
    "primary-discovery",
    "secondary-discovery",
    "brand-story",
    "brand-proof",
    "campaign",
    "trust",
    "continuation",
    "service",
  ],
  requiredNarrativeRoles: ["orientation", "primary-discovery", "service"],
  flowRuleIds: ["discovery-follows-orientation", "no-adjacent-dominant-sections"],
  maxRepeatedRole: 2,
  maxRepeatedComponentFamily: 9,
  boundedParameterConstraints: [],
  responsiveParameterIds: ["responsiveCollapse", "columnCount"],
});

const collectionPageBlueprint = pageBlueprintCompositionContractSchema.parse({
  allowedNarrativeRoles: ["orientation", "primary-discovery", "secondary-discovery", "service"],
  requiredNarrativeRoles: ["orientation", "primary-discovery", "service"],
  flowRuleIds: ["collection-discovery-before-results", "no-adjacent-dominant-sections"],
  maxRepeatedRole: 2,
  maxRepeatedComponentFamily: 5,
  boundedParameterConstraints: [],
  responsiveParameterIds: ["filterPlacement", "responsiveCollapse", "columnCount"],
});

const productPageBlueprint = pageBlueprintCompositionContractSchema.parse({
  allowedNarrativeRoles: [
    "orientation",
    "product-focus",
    "product-proof",
    "brand-story",
    "brand-proof",
    "conversion",
    "continuation",
    "service",
  ],
  requiredNarrativeRoles: ["orientation", "product-focus", "conversion", "service"],
  flowRuleIds: ["pdp-product-focus-before-conversion", "no-adjacent-dominant-sections"],
  maxRepeatedRole: 2,
  maxRepeatedComponentFamily: 8,
  boundedParameterConstraints: [],
  responsiveParameterIds: ["galleryMode", "productInformationPlacement", "responsiveCollapse"],
});

const homeSlots = {
  announcement: slot({
    id: "announcement",
    required: false,
    sectionType: "announcementBar",
    allowedVariants: ["singleLine", "minimal"],
    defaultVariant: "singleLine",
    label: { en: "Announcement", fi: "Ilmoitus" },
    purpose: "announcement-or-trust",
    omitWhen: "when-not-requested",
  }),
  header: slot({
    id: "header",
    required: true,
    sectionType: "header",
    allowedVariants: ["centered", "split", "compact", "transparent", "editorial"],
    defaultVariant: "centered",
    label: { en: "Store navigation", fi: "Kaupan navigaatio" },
    purpose: "navigation",
  }),
  hero: slot({
    id: "hero",
    required: true,
    sectionType: "homepageHero",
    allowedVariants: registeredVariants(homepageHeroDefinition),
    defaultVariant: "editorialSplit",
    label: { en: "Main introduction", fi: "Pääesittely" },
    purpose: "hero",
  }),
  categories: slot({
    id: "featured-categories",
    required: false,
    sectionType: "homepageFeaturedCollections",
    allowedVariants: registeredVariants(homepageFeaturedCollectionsDefinition),
    defaultVariant: "editorialCards",
    label: { en: "Featured categories", fi: "Esitellyt kategoriat" },
    purpose: "featured-categories",
    omitWhen: "when-catalogue-is-empty",
  }),
  products: slot({
    id: "featured-products",
    required: true,
    sectionType: "homepageFeaturedProducts",
    allowedVariants: registeredVariants(homepageFeaturedProductsDefinition),
    defaultVariant: "editorial",
    label: { en: "Featured products", fi: "Esitellyt tuotteet" },
    purpose: "featured-products",
  }),
  story: slot({
    id: "editorial-story",
    required: false,
    sectionType: "homepageEditorial",
    allowedVariants: registeredVariants(homepageEditorialDefinition),
    defaultVariant: "brandStory",
    label: { en: "Brand story", fi: "Bränditarina" },
    purpose: "editorial-story",
    omitWhen: "when-imagery-is-unavailable",
  }),
  proof: slot({
    id: "approved-proof",
    required: false,
    sectionType: "homepageProof",
    allowedVariants: registeredVariants(homepageProofDefinition),
    defaultVariant: "proofGrid",
    label: { en: "Approved proof", fi: "Hyväksytty näyttö" },
    purpose: "brand-values",
    omitWhen: "when-evidence-is-unavailable",
  }),
  values: slot({
    id: "brand-values",
    required: false,
    sectionType: "homepageTrust",
    allowedVariants: registeredVariants(homepageTrustDefinition),
    defaultVariant: "threeColumn",
    label: { en: "Brand values", fi: "Brändin arvot" },
    purpose: "announcement-or-trust",
  }),
  newsletter: slot({
    id: "newsletter",
    required: false,
    sectionType: "newsletter",
    allowedVariants: ["inline", "card"],
    defaultVariant: "inline",
    label: { en: "Newsletter", fi: "Uutiskirje" },
    purpose: "newsletter",
    omitWhen: "when-not-requested",
  }),
  promotion: slot({
    id: "promotion",
    required: false,
    sectionType: "homepagePromotion",
    allowedVariants: registeredVariants(homepagePromotionDefinition),
    defaultVariant: "imageLed",
    label: { en: "Promotional content", fi: "Kampanjasisältö" },
    purpose: "campaign-promotion",
    omitWhen: "when-not-requested",
  }),
  collectionNavigation: slot({
    id: "collection-navigation",
    required: false,
    sectionType: "homepageCollectionNavigation",
    allowedVariants: registeredVariants(homepageCollectionNavigationDefinition),
    defaultVariant: "grid",
    label: { en: "Collection navigation", fi: "Mallistonavigointi" },
    purpose: "featured-categories",
    omitWhen: "when-catalogue-is-empty",
  }),
  footer: slot({
    id: "footer",
    required: true,
    sectionType: "footer",
    allowedVariants: ["columns", "expanded", "editorial", "compact", "dark"],
    defaultVariant: "columns",
    label: { en: "Footer", fi: "Alatunniste" },
    purpose: "footer",
  }),
} as const;

const collectionSlots = {
  header: slot({
    id: "header",
    required: true,
    sectionType: "header",
    allowedVariants: ["centered", "split", "compact", "transparent", "editorial"],
    defaultVariant: "centered",
    label: { en: "Store navigation", fi: "Kaupan navigaatio" },
    purpose: "navigation",
  }),
  introduction: slot({
    id: "collection-introduction",
    required: true,
    sectionType: "collectionHeader",
    allowedVariants: ["editorial"],
    defaultVariant: "editorial",
    label: { en: "Collection introduction", fi: "Kokoelman esittely" },
    purpose: "collection-introduction",
  }),
  filters: slot({
    id: "filters",
    required: false,
    sectionType: "filterBar",
    allowedVariants: ["horizontal"],
    defaultVariant: "horizontal",
    label: { en: "Filters", fi: "Suodattimet" },
    purpose: "filtering-or-merchandising",
    omitWhen: "when-catalogue-is-empty",
  }),
  grid: slot({
    id: "product-grid",
    required: true,
    sectionType: "productGrid",
    allowedVariants: ["standard", "editorial", "compact"],
    defaultVariant: "standard",
    label: { en: "Product grid", fi: "Tuot ruudukko" },
    purpose: "featured-products",
  }),
  footer: homeSlots.footer,
} as const;

const productSlots = {
  header: collectionSlots.header,
  gallery: slot({
    id: "product-media",
    required: true,
    sectionType: "productGallery",
    allowedVariants: ["thumbnails"],
    defaultVariant: "thumbnails",
    label: { en: "Product media", fi: "Tuotteen media" },
    purpose: "product-media",
  }),
  information: slot({
    id: "product-information",
    required: true,
    sectionType: "productInfo",
    allowedVariants: ["premium"],
    defaultVariant: "premium",
    label: { en: "Product information", fi: "Tuotetiedot" },
    purpose: "product-information",
  }),
  options: slot({
    id: "product-options",
    required: false,
    sectionType: "productOptions",
    allowedVariants: ["buttons"],
    defaultVariant: "buttons",
    label: { en: "Product options", fi: "Tuotevalinnat" },
    purpose: "product-options",
    omitWhen: "when-not-requested",
  }),
  values: slot({
    id: "product-benefits",
    required: true,
    sectionType: "benefitIcons",
    allowedVariants: ["fourColumn", "minimal"],
    defaultVariant: "fourColumn",
    label: { en: "Trust and service", fi: "Luottamus ja palvelu" },
    purpose: "brand-values",
  }),
  details: slot({
    id: "product-details",
    required: true,
    sectionType: "imageText",
    allowedVariants: ["imageRight", "imageLeft", "stacked"],
    defaultVariant: "imageRight",
    label: { en: "Product details", fi: "Tuotteen lisätiedot" },
    purpose: "editorial-story",
  }),
  related: slot({
    id: "related-products",
    required: false,
    sectionType: "relatedProducts",
    allowedVariants: ["grid"],
    defaultVariant: "grid",
    label: { en: "Related products", fi: "Aiheeseen liittyvät tuotteet" },
    purpose: "related-products",
    omitWhen: "when-catalogue-is-empty",
  }),
  footer: homeSlots.footer,
} as const;

const template = (
  input: Omit<StorefrontTemplateDefinition, "schemaVersion" | "createdAt">,
): StorefrontTemplateDefinition => ({
  ...input,
  schemaVersion: 1,
  createdAt,
});

export const storefrontTemplateDefinitions: readonly StorefrontTemplateDefinition[] = deepFreeze([
  template({
    id: "template_brand_led_editorial",
    version: "1.0.0",
    name: { en: "Brand-led editorial", fi: "Brändivetoinen toimituksellinen" },
    description: {
      en: "A spacious foundation that gives the brand story and imagery room to lead.",
      fi: "Väljä perusta, jossa bränditarina ja kuvat saavat olla pääosassa.",
    },
    designCharacteristics: {
      en: "Editorial pacing, expressive imagery and clear storytelling.",
      fi: "Toimituksellinen rytmi, näyttävät kuvat ja selkeä tarinankerronta.",
    },
    recommendedUse: {
      en: "Stores where identity, craft and story matter as much as the catalogue.",
      fi: "Kaupoille, joissa identiteetti, käsityö ja tarina ovat yhtä tärkeitä kuin valikoima.",
    },
    category: "brand-led-editorial",
    supportedPageTypes: [...allPageTypes],
    supportedCatalogueContexts: ["existing", "demo", "empty"],
    pagePlans: [
      pagePlan(
        "blueprint-brand-led-home",
        "home",
        specializedSlots(
          [
            homeSlots.announcement,
            homeSlots.header,
            homeSlots.hero,
            homeSlots.categories,
            homeSlots.promotion,
            homeSlots.story,
            homeSlots.products,
            homeSlots.proof,
            homeSlots.values,
            homeSlots.newsletter,
            homeSlots.footer,
          ],
          {
            header: "transparent",
            homepageHero: "fullBleedOverlay",
            homepageFeaturedCollections: "imageLed",
            homepageFeaturedProducts: "editorial",
            homepagePromotion: "imageLed",
            homepageEditorial: "lookbookGallery",
            homepageProof: "quoteSpotlight",
            homepageTrust: "minimal",
            footer: "editorial",
          },
        ),
        homePageBlueprint,
      ),
      pagePlan(
        "blueprint-brand-led-collection",
        "collection",
        specializedSlots(Object.values(collectionSlots), {
          header: "transparent",
          productGrid: "editorial",
          footer: "editorial",
        }),
        collectionPageBlueprint,
      ),
      pagePlan(
        "blueprint-brand-led-product",
        "product",
        specializedSlots(Object.values(productSlots), {
          header: "transparent",
          footer: "editorial",
        }),
        productPageBlueprint,
      ),
    ],
    requiredCapabilities: ["collection-pages-requested", "product-pages-requested"],
    optionalCapabilities: ["catalogue-available", "logo-available", "supporting-imagery-available"],
    status: "implemented",
  }),
  template({
    id: "template_balanced_commerce",
    version: "1.0.0",
    name: { en: "Clean balanced commerce", fi: "Selkeä tasapainoinen kauppa" },
    description: {
      en: "A dependable balance between brand presence, discovery and shopping flow.",
      fi: "Luotettava tasapaino brändin, löytämisen ja ostamisen välillä.",
    },
    designCharacteristics: {
      en: "Calm hierarchy, practical discovery and adaptable section density.",
      fi: "Rauhallinen hierarkia, käytännöllinen löytämispolku ja mukautuva tiheys.",
    },
    recommendedUse: {
      en: "General retail stores that need a confident starting point for everyday commerce.",
      fi: "Yleiskaupoille, jotka tarvitsevat varman lähtökohdan päivittäiseen kaupankäyntiin.",
    },
    category: "balanced-commerce",
    supportedPageTypes: [...allPageTypes],
    supportedCatalogueContexts: ["existing", "demo", "empty"],
    pagePlans: [
      pagePlan(
        "blueprint-balanced-home",
        "home",
        specializedSlots(
          [
            homeSlots.announcement,
            homeSlots.header,
            homeSlots.hero,
            homeSlots.story,
            homeSlots.categories,
            homeSlots.products,
            homeSlots.proof,
            homeSlots.values,
            homeSlots.newsletter,
            homeSlots.footer,
          ],
          {
            header: "centered",
            homepageHero: "editorialSplit",
            homepageFeaturedCollections: "editorialCards",
            homepageFeaturedProducts: "standard",
            homepageEditorial: "brandStory",
            homepageProof: "proofGrid",
            homepageTrust: "cards",
            footer: "columns",
          },
        ),
        homePageBlueprint,
      ),
      pagePlan(
        "blueprint-balanced-collection",
        "collection",
        specializedSlots(Object.values(collectionSlots), {
          header: "centered",
          productGrid: "standard",
          footer: "columns",
        }),
        collectionPageBlueprint,
      ),
      pagePlan(
        "blueprint-balanced-product",
        "product",
        specializedSlots(
          [
            productSlots.header,
            productSlots.gallery,
            productSlots.information,
            productSlots.options,
            productSlots.values,
            productSlots.details,
            productSlots.related,
            productSlots.footer,
          ],
          { header: "centered", footer: "columns" },
        ),
        productPageBlueprint,
      ),
    ],
    requiredCapabilities: ["collection-pages-requested", "product-pages-requested"],
    optionalCapabilities: ["catalogue-available", "logo-available"],
    status: "implemented",
  }),
  template({
    id: "template_catalogue_forward_commerce",
    version: "1.0.0",
    name: { en: "Catalogue-forward commerce", fi: "Valikoimavetoinen kauppa" },
    description: {
      en: "A discovery-first foundation for stores with a broad or frequently changing range.",
      fi: "Löytämiseen keskittyvä perusta laajalle tai usein vaihtuvalla valikoimalle.",
    },
    designCharacteristics: {
      en: "Product discovery, filtering and related recommendations take priority.",
      fi: "Tuotelöytö, suodattaminen ja aiheeseen liittyvät suositukset ovat etusijalla.",
    },
    recommendedUse: {
      en: "Catalogue-rich retailers where shoppers need to compare and browse efficiently.",
      fi: "Valikoimavetoisille kaupoille, joissa tuotteita vertaillaan ja selataan tehokkaasti.",
    },
    category: "catalogue-forward-commerce",
    supportedPageTypes: [...allPageTypes],
    supportedCatalogueContexts: ["existing", "demo", "empty"],
    pagePlans: [
      pagePlan(
        "blueprint-catalogue-forward-home",
        "home",
        specializedSlots(
          [
            homeSlots.announcement,
            homeSlots.header,
            homeSlots.hero,
            homeSlots.products,
            homeSlots.collectionNavigation,
            homeSlots.story,
            homeSlots.proof,
            homeSlots.values,
            homeSlots.newsletter,
            homeSlots.footer,
          ],
          {
            header: "compact",
            homepageHero: "asymmetric",
            homepageFeaturedProducts: "compact",
            homepageCollectionNavigation: "grid",
            homepageEditorial: "continuationCta",
            homepageProof: "serviceAssurance",
            homepageTrust: "threeColumn",
            footer: "compact",
          },
        ),
        homePageBlueprint,
      ),
      pagePlan(
        "blueprint-catalogue-forward-collection",
        "collection",
        specializedSlots(Object.values(collectionSlots), {
          header: "compact",
          productGrid: "compact",
          footer: "compact",
        }),
        collectionPageBlueprint,
      ),
      pagePlan(
        "blueprint-catalogue-forward-product",
        "product",
        specializedSlots(
          [
            productSlots.header,
            productSlots.gallery,
            productSlots.information,
            productSlots.options,
            productSlots.values,
            productSlots.details,
            productSlots.related,
            productSlots.footer,
          ],
          { header: "compact", footer: "compact" },
        ),
        productPageBlueprint,
      ),
    ],
    requiredCapabilities: ["collection-pages-requested", "product-pages-requested"],
    optionalCapabilities: ["catalogue-available", "logo-available", "supporting-imagery-available"],
    status: "implemented",
  }),
]);

function validatePagePlan(
  template: StorefrontTemplateDefinition,
  plan: StorefrontTemplatePagePlan,
): void {
  if (!plan.profile) {
    throw new Error(
      `${template.id}/${plan.pageType} must declare an executable PageBlueprint profile.`,
    );
  }
  const profile = plan.profile;
  const sectionCounts = new Map<string, number>();
  plan.slots.forEach((slotDefinition) => {
    const manifest = getSupportedSectionManifest(slotDefinition.sectionType);
    if (!manifest) throw new Error(`Unsupported section type: ${slotDefinition.sectionType}.`);
    if (!manifest.allowedPageTypes.includes(plan.pageType)) {
      throw new Error(
        `Section ${slotDefinition.sectionType} is not allowed on ${plan.pageType} pages.`,
      );
    }
    if (slotDefinition.allowedVariants.some((variant) => !manifest.variants.includes(variant))) {
      throw new Error(
        `Unsupported variant in ${template.id}/${plan.pageType}/${slotDefinition.id}.`,
      );
    }
    sectionCounts.set(
      slotDefinition.sectionType,
      (sectionCounts.get(slotDefinition.sectionType) ?? 0) + 1,
    );
  });

  for (const protectedSection of ["header", "footer"] as const) {
    if (sectionCounts.get(protectedSection) !== 1) {
      throw new Error(
        `${template.id}/${plan.pageType} must contain exactly one ${protectedSection}.`,
      );
    }
  }
  const indices = new Map(
    plan.slots.map((slotDefinition, index) => [slotDefinition.sectionType, index]),
  );
  const headerIndex = indices.get("header");
  const footerIndex = indices.get("footer");
  if (footerIndex !== plan.slots.length - 1) {
    throw new Error(`${template.id}/${plan.pageType} footer must be last.`);
  }
  if (headerIndex !== 0 && !(plan.pageType === "home" && headerIndex === 1)) {
    throw new Error(`${template.id}/${plan.pageType} header is not in a protected position.`);
  }

  const required = new Set(
    plan.slots
      .filter((slotDefinition) => slotDefinition.required)
      .map((slotDefinition) => slotDefinition.sectionType),
  );
  const requireSection = (sectionType: SupportedSectionType) => {
    if (!required.has(sectionType))
      throw new Error(`${template.id}/${plan.pageType} requires ${sectionType}.`);
  };
  if (plan.pageType === "home") {
    requireSection("homepageHero");
    const heroIndex = indices.get("homepageHero");
    if (heroIndex === undefined)
      throw new Error(`${template.id}/home must contain a homepage hero.`);
    for (const merchandising of [
      "homepageFeaturedCollections",
      "homepageFeaturedProducts",
      "homepageCollectionNavigation",
    ] as const) {
      const merchandisingIndex = indices.get(merchandising);
      if (merchandisingIndex !== undefined && heroIndex > merchandisingIndex) {
        throw new Error(`${template.id}/home hero must precede ${merchandising}.`);
      }
    }
  }
  if (plan.pageType === "collection") {
    requireSection("collectionHeader");
    requireSection("productGrid");
  }
  if (plan.pageType === "product") {
    requireSection("productGallery");
    requireSection("productInfo");
    requireSection("benefitIcons");
    requireSection("imageText");
    const galleryIndex = indices.get("productGallery");
    const informationIndex = indices.get("productInfo");
    const optionsIndex = indices.get("productOptions");
    if (
      galleryIndex === undefined ||
      informationIndex === undefined ||
      galleryIndex > informationIndex
    ) {
      throw new Error(`${template.id}/product requires product media before product information.`);
    }
    if (optionsIndex !== undefined && informationIndex > optionsIndex) {
      throw new Error(
        `${template.id}/product requires product information before product options.`,
      );
    }
  }
  if (profile.scope !== plan.pageType) {
    throw new Error(`${template.id}/${plan.pageType} profile scope does not match the page type.`);
  }
  const profileSlots = profile.componentSelections.map((selection) => selection.slotId);
  if (
    profileSlots.length !== plan.slots.length ||
    profileSlots.some((slotId, index) => slotId !== plan.slots[index]?.id)
  ) {
    throw new Error(
      `${template.id}/${plan.pageType} profile slots do not match canonical slot order.`,
    );
  }
  if (
    canonicalValueString(profile.orderedNarrativeRoles) !==
    canonicalValueString(plan.slots.map((slotDefinition) => slotDefinition.narrativeRole))
  ) {
    throw new Error(
      `${template.id}/${plan.pageType} profile roles do not match canonical slot order.`,
    );
  }
  const expectedRoleCardinality = new Map<
    StorefrontTemplateSlot["narrativeRole"],
    { minimum: number; maximum: number }
  >();
  plan.slots.forEach((entry) => {
    const current = expectedRoleCardinality.get(entry.narrativeRole) ?? { minimum: 0, maximum: 0 };
    expectedRoleCardinality.set(entry.narrativeRole, {
      minimum: current.minimum + (entry.required ? 1 : 0),
      maximum: current.maximum + 1,
    });
  });
  const registeredRoleCardinality = new Map(
    profile.roleCardinality.map((entry) => [entry.role, entry]),
  );
  expectedRoleCardinality.forEach((expected, role) => {
    const registered = registeredRoleCardinality.get(role);
    if (
      !registered ||
      registered.minimum !== expected.minimum ||
      registered.maximum !== expected.maximum
    ) {
      throw new Error(
        `${template.id}/${plan.pageType} profile ${profile.id} has invalid ${role} cardinality.`,
      );
    }
  });
  if (registeredRoleCardinality.size !== expectedRoleCardinality.size) {
    throw new Error(
      `${template.id}/${plan.pageType} profile cardinalities do not match its slots.`,
    );
  }
  plan.slots.forEach((slotDefinition) => {
    const profileSelection = profile.componentSelections.find(
      (selection) => selection.slotId === slotDefinition.id,
    );
    if (
      !profileSelection ||
      profileSelection.component !== slotDefinition.sectionType ||
      profileSelection.defaultVariant !== slotDefinition.defaultVariant ||
      canonicalValueString(profileSelection.variants) !==
        canonicalValueString(slotDefinition.allowedVariants)
    ) {
      throw new Error(
        `${template.id}/${plan.pageType} profile ${profile.id} does not match slot ${slotDefinition.id}.`,
      );
    }
  });
}

export function validateTemplateRegistry(
  entries: readonly unknown[] = storefrontTemplateDefinitions,
): readonly StorefrontTemplateDefinition[] {
  const parsed = entries.map((entry) => storefrontTemplateDefinitionSchema.parse(entry));
  const ids = parsed.map((entry) => entry.id);
  if (new Set(ids).size !== ids.length) throw new Error("Template IDs must be unique.");
  parsed.forEach((templateDefinition) =>
    templateDefinition.pagePlans.forEach((plan) => validatePagePlan(templateDefinition, plan)),
  );
  return deepFreeze(parsed.map(cloneTemplateDefinition));
}

const validatedTemplates = validateTemplateRegistry();
const templatesById = new Map(
  validatedTemplates.map((templateDefinition) => [templateDefinition.id, templateDefinition]),
);

const profilesById = new Map(
  [
    ...validatedTemplates.flatMap((templateDefinition) => templateDefinition.pagePlans),
    ...pageFamilyBaselinePagePlans,
    ...commercialHomepagePagePlans,
    ...commercialPdpPagePlans,
    ...commercialCollectionSearchPagePlans,
    ...commercialUtilityPagePlans,
  ].flatMap((pagePlanDefinition) =>
    pagePlanDefinition.profile
      ? [[pagePlanDefinition.profile.id, pagePlanDefinition] as const]
      : [],
  ),
);

/** Shared chrome is a constrained profile only; it has no page tree or persisted state. */
export const sharedStorefrontFrameProfile = deepFreeze({
  id: "blueprint-shared-storefront-frame",
  version: "1.0.0",
  scope: "shared-frame" as const,
  orderedNarrativeRoles: ["orientation", "service"] as const,
  componentSelections: [
    { slotId: "header", component: "header", variants: ["centered", "split", "compact"] },
    { slotId: "footer", component: "footer", variants: ["columns", "editorial", "compact"] },
  ],
  requiredBindingCategories: ["navigation"] as const,
  responsiveBreakpoints: ["mobile", "tablet", "desktop", "wide"] as const,
  accessibilityContract: "registered-component-contracts" as const,
});

export function listTemplates(): readonly StorefrontTemplateDefinition[] {
  return deepFreeze(validatedTemplates.map(cloneTemplateDefinition));
}

export function getTemplateById(templateId: string): StorefrontTemplateDefinition | undefined {
  const templateDefinition = templatesById.get(templateId);
  return templateDefinition ? cloneTemplateDefinition(templateDefinition) : undefined;
}

export function getTemplatePagePlan(
  templateId: string,
  pageType: PageType,
): StorefrontTemplatePagePlan | undefined {
  const templateDefinition = templatesById.get(templateId);
  const plan = templateDefinition?.pagePlans.find(
    (pagePlanDefinition) => pagePlanDefinition.pageType === pageType,
  );
  return plan ? deepFreeze(structuredClone(plan)) : undefined;
}

export function listExecutablePageBlueprintProfiles(): readonly StorefrontTemplatePagePlan[] {
  return deepFreeze(
    [...profilesById.values()]
      .sort((left, right) => left.profile!.id.localeCompare(right.profile!.id))
      .map((pagePlanDefinition) => structuredClone(pagePlanDefinition)),
  );
}

export function getExecutablePageBlueprintProfile(
  profileId: string,
): StorefrontTemplatePagePlan | undefined {
  const pagePlanDefinition = profilesById.get(profileId);
  return pagePlanDefinition ? deepFreeze(structuredClone(pagePlanDefinition)) : undefined;
}
