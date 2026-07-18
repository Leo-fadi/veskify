import {
  getSupportedSectionManifest,
  type SupportedSectionType,
} from "@/components/registry/supported-vocabulary";
import type { PageType } from "@/domain/storefront";
import {
  cloneTemplateDefinition,
  deepFreeze,
  storefrontTemplateDefinitionSchema,
  type StorefrontTemplateDefinition,
  type StorefrontTemplatePagePlan,
  type StorefrontTemplateSlot,
} from "./contract";

const createdAt = "2026-07-18T00:00:00.000Z";
const allPageTypes = ["home", "collection", "product"] as const;

function slot(
  input: Omit<StorefrontTemplateSlot, "omitWhen"> & {
    omitWhen?: StorefrontTemplateSlot["omitWhen"];
  },
): StorefrontTemplateSlot {
  return { omitWhen: "never", ...input };
}

function pagePlan(pageType: PageType, slots: StorefrontTemplateSlot[]): StorefrontTemplatePagePlan {
  return { pageType, slots };
}

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
    allowedVariants: ["centered", "split", "compact"],
    defaultVariant: "centered",
    label: { en: "Store navigation", fi: "Kaupan navigaatio" },
    purpose: "navigation",
  }),
  hero: slot({
    id: "hero",
    required: true,
    sectionType: "hero",
    allowedVariants: ["editorial"],
    defaultVariant: "editorial",
    label: { en: "Main introduction", fi: "Pääesittely" },
    purpose: "hero",
  }),
  categories: slot({
    id: "featured-categories",
    required: false,
    sectionType: "featuredCategories",
    allowedVariants: ["editorialCards", "grid", "carousel"],
    defaultVariant: "editorialCards",
    label: { en: "Featured categories", fi: "Esitellyt kategoriat" },
    purpose: "featured-categories",
    omitWhen: "when-catalogue-is-empty",
  }),
  products: slot({
    id: "featured-products",
    required: true,
    sectionType: "productGrid",
    allowedVariants: ["editorial", "standard", "compact"],
    defaultVariant: "editorial",
    label: { en: "Featured products", fi: "Esitellyt tuotteet" },
    purpose: "featured-products",
  }),
  story: slot({
    id: "editorial-story",
    required: false,
    sectionType: "brandStory",
    allowedVariants: ["editorial", "minimal"],
    defaultVariant: "editorial",
    label: { en: "Brand story", fi: "Bränditarina" },
    purpose: "editorial-story",
    omitWhen: "when-imagery-is-unavailable",
  }),
  values: slot({
    id: "brand-values",
    required: false,
    sectionType: "benefitIcons",
    allowedVariants: ["threeColumn", "minimal"],
    defaultVariant: "threeColumn",
    label: { en: "Brand values", fi: "Brändin arvot" },
    purpose: "brand-values",
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
  footer: slot({
    id: "footer",
    required: true,
    sectionType: "footer",
    allowedVariants: ["columns", "editorial", "compact"],
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
    allowedVariants: ["centered", "split", "compact"],
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
      pagePlan("home", Object.values(homeSlots)),
      pagePlan("collection", Object.values(collectionSlots)),
      pagePlan("product", Object.values(productSlots)),
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
      pagePlan("home", [
        homeSlots.announcement,
        homeSlots.header,
        homeSlots.hero,
        homeSlots.categories,
        homeSlots.products,
        homeSlots.values,
        homeSlots.newsletter,
        homeSlots.footer,
      ]),
      pagePlan("collection", Object.values(collectionSlots)),
      pagePlan("product", [
        productSlots.header,
        productSlots.gallery,
        productSlots.information,
        productSlots.options,
        productSlots.values,
        productSlots.details,
        productSlots.related,
        productSlots.footer,
      ]),
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
      pagePlan("home", [
        homeSlots.announcement,
        homeSlots.header,
        homeSlots.hero,
        homeSlots.products,
        homeSlots.categories,
        homeSlots.newsletter,
        homeSlots.footer,
      ]),
      pagePlan("collection", Object.values(collectionSlots)),
      pagePlan("product", [
        productSlots.header,
        productSlots.gallery,
        productSlots.information,
        productSlots.options,
        productSlots.values,
        productSlots.details,
        productSlots.related,
        productSlots.footer,
      ]),
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
  const sectionCounts = new Map<string, number>();
  plan.slots.forEach((slotDefinition) => {
    const manifest = getSupportedSectionManifest(slotDefinition.sectionType);
    if (!manifest) throw new Error(`Unsupported section type: ${slotDefinition.sectionType}.`);
    if (!(manifest.allowedPageTypes as readonly PageType[]).includes(plan.pageType)) {
      throw new Error(
        `Section ${slotDefinition.sectionType} is not allowed on ${plan.pageType} pages.`,
      );
    }
    if (
      slotDefinition.allowedVariants.some(
        (variant) => !(manifest.variants as readonly string[]).includes(variant),
      )
    ) {
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
    requireSection("hero");
    const heroIndex = indices.get("hero");
    if (heroIndex === undefined) throw new Error(`${template.id}/home must contain a hero.`);
    for (const merchandising of ["featuredCategories", "productGrid"] as const) {
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
