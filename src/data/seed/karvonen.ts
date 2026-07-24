import { z } from "zod";
import { validateRegisteredSnapshot } from "@/components/registry";
import {
  catalogueDisplayModelSchema,
  protectedProductPaths,
  type CatalogueDisplayModel,
} from "@/domain/catalogue";
import { brandSystemSchema } from "@/domain/design-system";
import { projectSchema } from "@/domain/project";
import { storefrontSnapshotSchema } from "@/domain/storefront";
import { KARVONEN_PROJECT_ID } from "./identifiers";
import type { Project } from "@/domain/project";
import type { StorefrontSnapshot } from "@/domain/storefront";

const fi = (value: string) => ({ fi: value });
const localized = (en: string, fi: string) => ({ en, fi });
const price = (amount: number) => ({ amount, currency: "EUR" as const });
const image = (id: string, path: string, alt: string) => ({
  id,
  url: `/seed-assets/karvonen/catalogue/${path}`,
  alt: fi(alt),
  decorative: false,
});

const variant = (
  id: string,
  label: string,
  attributes: Record<string, string | number | string[]>,
  amount: number,
) => ({ id, label: fi(label), attributes, price: price(amount) });

const selection = (id: string, label: string, values: string[]) => ({
  id,
  type: "selection" as const,
  label: fi(label),
  required: false,
  values: values.map(fi),
});

const products = [
  {
    id: "product_karvonen_01",
    sku: "BV012s",
    title: fi("Guldviva Myrskyluodon Maija sormus"),
    description: fi(
      "Säädettävä hopeasormus, jonka aaltoileva muoto on saanut inspiraationsa meriajokkaasta.",
    ),
    price: price(129),
    brand: "Guldviva",
    category: "Hopeasormukset",
    availabilityLabel: fi("Vaihtelee mallin mukaan"),
    images: [
      image("asset_karvonen_01_main", "product-01/main.jpg", "Guldviva Myrskyluodon Maija -sormus"),
      image(
        "asset_karvonen_01_alt_01",
        "product-01/alt-01.jpg",
        "Guldviva-sormuksen yksityiskohta",
      ),
      image("asset_karvonen_01_alt_02", "product-01/alt-02.jpg", "Guldviva-sormus"),
    ],
    productType: "Hopeasormukset",
    attributes: { material: "hopea", colour: "hopea", sizeRange: "15,5–17; 17–18,5; 18,5–21" },
    variants: [
      variant(
        "variant_karvonen_01_01",
        "Koko 15,5–17",
        { size: "15,5–17", availability: "Varastossa" },
        129,
      ),
      variant(
        "variant_karvonen_01_02",
        "Koko 17–18,5",
        { size: "17–18,5", availability: "Tilapäisesti loppunut" },
        129,
      ),
      variant(
        "variant_karvonen_01_03",
        "Koko 18,5–21",
        { size: "18,5–21", availability: "Varastossa" },
        129,
      ),
    ],
  },
  {
    id: "product_karvonen_02",
    sku: "L64248510000",
    title: fi("Lumoava Yölento, korvakorut"),
    description: fi("Näyttävät kullatusta hopeasta valmistetut korvakorut, koko 18 × 59 mm."),
    price: price(329),
    brand: "Lumoava",
    category: "Hopeakorvakorut",
    images: [image("asset_karvonen_02_main", "product-02/main.jpg", "Lumoava Yölento -korvakorut")],
    productType: "Hopeakorvakorut",
    attributes: { material: "kullattu hopea", colour: "kulta", size: "18 × 59 mm" },
    variants: [],
  },
  {
    id: "product_karvonen_03",
    title: fi("Kohinoor Bellis timanttiriipus"),
    description: fi(
      "18K valkokultainen riipus, jossa on 12 timanttia sinisen 5 mm akvamariinin ympärillä; ketju sisältyy hintaan.",
    ),
    price: price(1799),
    brand: "Kohinoor",
    category: "Naisten kultakaulakorut",
    images: [
      image("asset_karvonen_03_main", "product-03/main.jpg", "Kohinoor Bellis -timanttiriipus"),
    ],
    productType: "Naisten kultakaulakorut",
    attributes: {
      material: "18K valkokulta",
      colour: "valkokulta / sininen",
      stone: "Akvamariini 5 mm; timantit 4×0,02 + 8×0,01 H SI",
    },
    variants: [],
  },
  {
    id: "product_karvonen_04",
    title: fi("Lumoava Säde, kalvosinnapit"),
    description: fi(
      "Hopeiset 22 × 10 mm kalvosinnapit, joissa valon ja pinnan muotoilu muodostaa sädemäisen peilauksen.",
    ),
    price: price(199.2),
    compareAtPrice: price(249),
    brand: "Lumoava",
    category: "Kalvosinnapit",
    images: [image("asset_karvonen_04_main", "product-04/main.jpg", "Lumoava Säde -kalvosinnapit")],
    productType: "Kalvosinnapit",
    attributes: { material: "hopea", colour: "hopea", size: "22 × 10 mm" },
    variants: [],
  },
  {
    id: "product_karvonen_05",
    title: fi("Lupaus korvakorut, koukku"),
    description: fi(
      "Kotimaiset koukkukorvakorut 100-prosenttisesti kierrätetystä 925-hopeasta; koko 3 × 12 mm.",
    ),
    price: price(189),
    category: "Hopeakorvakorut",
    images: [
      image("asset_karvonen_05_main", "product-05/main.jpg", "Lupaus-korvakorut"),
      image(
        "asset_karvonen_05_alt_01",
        "product-05/alt-01.jpg",
        "Lupaus-korvakorujen yksityiskohta",
      ),
      image("asset_karvonen_05_alt_02", "product-05/alt-02.jpg", "Lupaus-korvakorut"),
    ],
    productType: "Hopeakorvakorut",
    attributes: { material: "kierrätetty 925 hopea", colour: "hopea", size: "3 × 12 mm" },
    variants: [],
  },
  {
    id: "product_karvonen_06",
    title: fi("Festive Feeniks Lux Oval timanttisormus"),
    description: fi(
      "Luontoaiheinen Feeniks-malliston ovaalitimanttisormus, jossa keskikiveä täydentää köynnösmäinen sivukivikoristelu.",
    ),
    price: price(2680),
    brand: "Festive",
    category: "Timanttisormukset",
    availabilityLabel: fi("Not captured — verify live"),
    images: [
      image(
        "asset_karvonen_06_main",
        "product-06/main.jpg",
        "Festive Feeniks Lux Oval -timanttisormus",
      ),
      image(
        "asset_karvonen_06_alt_01",
        "product-06/alt-01.jpg",
        "Festive Feeniks -sormuksen yksityiskohta",
      ),
    ],
    productType: "Timanttisormukset",
    attributes: {
      material: "Kulta; exact Karvonen metal variants require verification",
      colour:
        "Valkokulta / keltakulta / punakulta options reported by Festive; verify Karvonen options",
      stone:
        "Ovaalihiottu timantti with smaller side diamonds; exact Karvonen carat/quality selection requires verification",
    },
    variants: [],
    orderOptions: [
      selection("option_karvonen_06_metal", "Metalli / karaatit", ["14K", "18K"]),
      selection("option_karvonen_06_quality", "Timanttilaatu", [
        "Luonnontimantti",
        "Laboratoriotimantti",
      ]),
    ],
  },
  {
    id: "product_karvonen_07",
    title: fi("Festive Aura timanttisormus"),
    description: fi(
      "Festive-brändin timanttisormus. Tarkka mallinimi, timanttipaino, materiaali ja hinta tulee kopioida Karvosen tuotesivulta.",
    ),
    priceUnavailableReason: fi("Hinta ei ole saatavilla toimitetussa tuoteluettelossa."),
    brand: "Festive",
    category: "Timanttisormukset",
    images: [
      image("asset_karvonen_07_main", "product-07/main.jpg", "Festive Aura -timanttisormus"),
      image(
        "asset_karvonen_07_alt_01",
        "product-07/alt-01.jpg",
        "Festive Aura -sormuksen yksityiskohta",
      ),
    ],
    productType: "Timanttisormukset",
    attributes: { stone: "Timantti; exact specifications not captured" },
    variants: [],
  },
  {
    id: "product_karvonen_08",
    sku: "701-008",
    title: fi("Festive Pihka timanttisormus"),
    description: fi(
      "Havupuiden kuoresta ja pihkasta inspiraationsa saanut leveä monikivinen timanttisormus.",
    ),
    price: price(2290),
    brand: "Festive",
    category: "Timanttisormukset",
    availabilityLabel: fi("Valmistetaan/tilataan valitussa koossa; verify exact Karvonen wording"),
    images: [
      image("asset_karvonen_08_main", "product-08/main.jpg", "Festive Pihka -timanttisormus"),
      image(
        "asset_karvonen_08_alt_01",
        "product-08/alt-01.jpg",
        "Festive Pihka -sormuksen yksityiskohta",
      ),
    ],
    productType: "Timanttisormukset",
    attributes: {
      material: "Kulta; reference configuration includes 14K/18K",
      colour: "Exact Karvonen metal-colour configuration requires verification",
      stone: "6 timanttia, yhteispaino noin 0,08 ct; natural or laboratory-diamond configurations",
    },
    variants: [],
    orderOptions: [
      selection("option_karvonen_08_metal", "Metalli / karaatit", ["14K", "18K"]),
      selection("option_karvonen_08_quality", "Timanttilaatu", [
        "Luonnontimantti",
        "Laboratoriotimantti",
      ]),
    ],
  },
  {
    id: "product_karvonen_09",
    sku: "700-005",
    title: fi("Festive Pihka Siro timanttisormus"),
    description: fi(
      "Pihka-malliston sirompi monikivinen timanttisormus, jonka muotoilu on saanut inspiraationsa havupuiden kuoresta ja pihkasta.",
    ),
    price: price(1690),
    brand: "Festive",
    category: "Timanttisormukset",
    availabilityLabel: fi("Valmistetaan/tilataan valitussa koossa; verify exact Karvonen wording"),
    images: [
      image("asset_karvonen_09_main", "product-09/main.jpg", "Festive Pihka Siro -timanttisormus"),
      image(
        "asset_karvonen_09_alt_01",
        "product-09/alt-01.jpg",
        "Festive Pihka Siro -sormuksen yksityiskohta",
      ),
    ],
    productType: "Timanttisormukset",
    attributes: {
      material: "Kulta; reference configuration includes 14K/18K",
      colour: "Exact Karvonen metal-colour configuration requires verification",
      stone: "3 timanttia, yhteispaino noin 0,05 ct; natural or laboratory-diamond configurations",
    },
    variants: [],
    orderOptions: [
      selection("option_karvonen_09_metal", "Metalli / karaatit", ["14K", "18K"]),
      selection("option_karvonen_09_quality", "Timanttilaatu", [
        "Luonnontimantti",
        "Laboratoriotimantti",
      ]),
    ],
  },
  {
    id: "product_karvonen_10",
    sku: "724400000",
    title: fi("Lumoava Eden kultasormus"),
    description: fi("Kotimaisen Lumoavan naisellinen ja näyttävä Eden-malliston kultasormus."),
    price: price(2024),
    brand: "Lumoava",
    category: "Kultasormukset",
    availabilityLabel: fi("Tilaustuote / tilattavissa; verify exact Karvonen wording"),
    images: [image("asset_karvonen_10_main", "product-10/main.jpg", "Lumoava Eden -kultasormus")],
    productType: "Kultasormukset",
    attributes: { material: "Keltakulta", colour: "Kulta" },
    variants: [],
  },
] as const;

const collections = [
  {
    id: "collection_karvonen_myrskyluodon-maija",
    slug: "myrskyluodon-maija",
    title: fi("Myrskyluodon Maija"),
    description: fi("Myrskyluodon Maija -malliston korut."),
    productIds: ["product_karvonen_01"],
  },
  {
    id: "collection_karvonen_yolento",
    slug: "yolento",
    title: fi("Yölento"),
    description: fi("Yölento-malliston korut."),
    productIds: ["product_karvonen_02"],
  },
  {
    id: "collection_karvonen_bellis",
    slug: "bellis",
    title: fi("Bellis"),
    description: fi("Bellis-malliston korut."),
    productIds: ["product_karvonen_03"],
  },
  {
    id: "collection_karvonen_sade",
    slug: "sade",
    title: fi("Säde"),
    description: fi("Säde-malliston korut."),
    productIds: ["product_karvonen_04"],
  },
  {
    id: "collection_karvonen_lupaus-korut",
    slug: "lupaus-korut",
    title: fi("Lupaus-korut"),
    description: fi("Lupaus-malliston korut."),
    productIds: ["product_karvonen_05"],
  },
  {
    id: "collection_karvonen_feeniks",
    slug: "feeniks",
    title: fi("Feeniks"),
    description: fi("Feeniks-malliston korut."),
    productIds: ["product_karvonen_06"],
  },
  {
    id: "collection_karvonen_aura",
    slug: "aura",
    title: fi("Aura"),
    description: fi("Aura-malliston korut."),
    productIds: ["product_karvonen_07"],
  },
  {
    id: "collection_karvonen_pihka",
    slug: "pihka",
    title: fi("Pihka"),
    description: fi("Pihka-malliston korut."),
    productIds: ["product_karvonen_08", "product_karvonen_09"],
  },
  {
    id: "collection_karvonen_eden",
    slug: "eden",
    title: fi("Eden"),
    description: fi("Eden-malliston korut."),
    productIds: ["product_karvonen_10"],
  },
] as const;

export const karvonenBrandSystem = brandSystemSchema.parse({
  colors: {
    primary: "#1E1E1C",
    secondary: "#5F625C",
    accent: "#8A6A45",
    background: "#FAF9F6",
    surface: "#FFFFFF",
    text: "#1E1E1C",
    mutedText: "#5F625C",
    border: "#D7D2C8",
  },
  typography: {
    headingFont: "georgia",
    bodyFont: "inter",
    baseSize: 16,
    scaleRatio: 1.2,
    headingWeight: 600,
    bodyWeight: 400,
  },
  shape: { radius: "subtle" },
  spacing: { density: "balanced" },
  imagery: { style: "editorial" },
  visualSystem: {
    preset: "premiumEditorial",
    contentWidth: "wide",
    surface: "layered",
    divider: "subtle",
    buttonHierarchy: "balanced",
    imageTreatment: "editorial",
    theme: "light",
  },
  voice: {
    formality: "balanced",
    detail: "concise",
    positioning: "premium",
    warmth: "neutral",
    energy: "balanced",
  },
});

const homePage = {
  id: "page_karvonen_home",
  type: "home" as const,
  slug: "/",
  title: localized("Karvonen", "Karvonen"),
  seo: {
    title: localized("Karvonen jewellery", "Karvosen korut"),
    metaDescription: localized("Karvonen jewellery selection.", "Karvosen koruvalikoima."),
  },
  sections: [
    {
      id: "section_karvonen_home_header",
      component: "header",
      variant: "editorial",
      visible: true,
      content: { brandName: "Karvonen" },
      props: { showSearch: true, showCart: true },
    },
    {
      id: "section_karvonen_home_hero",
      component: "hero",
      variant: "fullBleed",
      visible: true,
      content: {
        eyebrow: localized("Karvonen", "Karvonen"),
        title: localized("Jewellery", "Korut"),
        body: localized(
          "Explore the Karvonen jewellery selection.",
          "Tutustu Karvosen koruvalikoimaan.",
        ),
        cta: {
          label: localized("View the collection", "Tutustu mallistoon"),
          href: "/collections/myrskyluodon-maija",
        },
        media: {
          id: "asset_karvonen_home_hero",
          url: "/seed-assets/karvonen/storefront/hero-desktop.jpg",
          alt: localized("Karvonen jewellery", "Karvosen koruja"),
          decorative: false,
        },
      },
      props: { mediaPosition: "right" },
    },
    {
      id: "section_karvonen_home_categories",
      component: "featuredCategories",
      variant: "editorialCards",
      visible: true,
      content: {
        heading: localized("Collections", "Mallistoja"),
        collectionIds: ["collection_karvonen_myrskyluodon-maija", "collection_karvonen_pihka"],
      },
      props: { cardAspect: "portrait" },
    },
    {
      id: "section_karvonen_home_products",
      component: "productGrid",
      variant: "editorial",
      visible: true,
      content: {
        heading: localized("Karvonen selection", "Karvosen valikoima"),
        productIds: [
          "product_karvonen_01",
          "product_karvonen_02",
          "product_karvonen_03",
          "product_karvonen_04",
        ],
      },
      props: { columns: "four" },
    },
    {
      id: "section_karvonen_home_footer",
      component: "footer",
      variant: "dark",
      visible: true,
      content: {
        brandName: "Karvonen",
        contact: localized("Karvonen · Finland", "Karvonen · Suomi"),
        policyLabel: localized(
          "Delivery · Returns · Privacy",
          "Toimitus · Palautukset · Tietosuoja",
        ),
        copyright: localized("© 2026 Karvonen demo", "© 2026 Karvonen -demo"),
      },
      props: { showPolicies: true },
    },
  ],
};

const collectionPage = {
  id: "page_karvonen_collection_myrskyluodon_maija",
  type: "collection" as const,
  slug: "/collections/myrskyluodon-maija",
  title: localized("Myrskyluodon Maija", "Myrskyluodon Maija"),
  seo: {
    title: localized("Myrskyluodon Maija | Karvonen", "Myrskyluodon Maija | Karvonen"),
    metaDescription: localized(
      "Myrskyluodon Maija collection by Karvonen.",
      "Karvosen Myrskyluodon Maija -mallisto.",
    ),
  },
  sections: [
    {
      id: "section_karvonen_collection_header",
      component: "header",
      variant: "compact",
      visible: true,
      content: { brandName: "Karvonen" },
      props: { showSearch: true, showCart: true },
    },
    {
      id: "section_karvonen_collection_intro",
      component: "collectionHeader",
      variant: "editorial",
      visible: true,
      content: { collectionId: "collection_karvonen_myrskyluodon-maija" },
      props: { mediaPosition: "right" },
    },
    {
      id: "section_karvonen_collection_filters",
      component: "filterBar",
      variant: "horizontal",
      visible: true,
      content: { filters: ["material", "price", "availability"] },
      props: { demoOnly: true },
    },
    {
      id: "section_karvonen_collection_products",
      component: "productGrid",
      variant: "editorial",
      visible: true,
      content: {
        heading: localized("Myrskyluodon Maija", "Myrskyluodon Maija"),
        productIds: ["product_karvonen_01"],
      },
      props: { columns: "two" },
    },
    {
      id: "section_karvonen_collection_footer",
      component: "footer",
      variant: "dark",
      visible: true,
      content: {
        brandName: "Karvonen",
        contact: localized("Karvonen · Finland", "Karvonen · Suomi"),
        policyLabel: localized(
          "Delivery · Returns · Privacy",
          "Toimitus · Palautukset · Tietosuoja",
        ),
        copyright: localized("© 2026 Karvonen demo", "© 2026 Karvonen -demo"),
      },
      props: { showPolicies: true },
    },
  ],
};

const productPage = {
  id: "page_karvonen_product_guldviva_myrskyluodon_maija",
  type: "product" as const,
  slug: "/products/guldviva-myrskyluodon-maija-sormus",
  title: localized("Guldviva Myrskyluodon Maija ring", "Guldviva Myrskyluodon Maija sormus"),
  seo: {
    title: localized(
      "Guldviva Myrskyluodon Maija ring | Karvonen",
      "Guldviva Myrskyluodon Maija sormus | Karvonen",
    ),
    metaDescription: localized(
      "Guldviva Myrskyluodon Maija ring from Karvonen.",
      "Guldviva Myrskyluodon Maija -sormus Karvoselta.",
    ),
  },
  sections: [
    {
      id: "section_karvonen_product_header",
      component: "header",
      variant: "transparent",
      visible: true,
      content: { brandName: "Karvonen" },
      props: { showSearch: true, showCart: true },
    },
    {
      id: "section_karvonen_product_gallery",
      component: "productGallery",
      variant: "thumbnails",
      visible: true,
      content: { productId: "product_karvonen_01" },
      props: { thumbnailPosition: "bottom" },
    },
    {
      id: "section_karvonen_product_info",
      component: "productInfo",
      variant: "premium",
      visible: true,
      content: { productId: "product_karvonen_01" },
      props: { showRating: true },
    },
    {
      id: "section_karvonen_product_options",
      component: "productOptions",
      variant: "buttons",
      visible: true,
      content: { productId: "product_karvonen_01" },
      props: { demoOnly: true },
    },
    {
      id: "section_karvonen_product_related",
      component: "relatedProducts",
      variant: "grid",
      visible: true,
      content: {
        heading: localized("You may also like", "Saatat myös pitää"),
        productIds: ["product_karvonen_02", "product_karvonen_04"],
      },
      props: {},
    },
    {
      id: "section_karvonen_product_footer",
      component: "footer",
      variant: "dark",
      visible: true,
      content: {
        brandName: "Karvonen",
        contact: localized("Karvonen · Finland", "Karvonen · Suomi"),
        policyLabel: localized(
          "Delivery · Returns · Privacy",
          "Toimitus · Palautukset · Tietosuoja",
        ),
        copyright: localized("© 2026 Karvonen demo", "© 2026 Karvonen -demo"),
      },
      props: { showPolicies: true },
    },
  ],
};

const navigation = {
  primary: [
    {
      id: "nav_karvonen_home",
      label: localized("Home", "Etusivu"),
      target: { type: "page" as const, pageId: "page_karvonen_home" },
    },
    {
      id: "nav_karvonen_myrskyluodon_maija",
      label: localized("Myrskyluodon Maija", "Myrskyluodon Maija"),
      target: {
        type: "page" as const,
        pageId: "page_karvonen_collection_myrskyluodon_maija",
      },
    },
  ],
  footer: [
    {
      id: "nav_karvonen_guldviva_myrskyluodon_maija",
      label: localized("Guldviva Myrskyluodon Maija ring", "Guldviva Myrskyluodon Maija sormus"),
      target: {
        type: "page" as const,
        pageId: "page_karvonen_product_guldviva_myrskyluodon_maija",
      },
    },
  ],
};

function makeSnapshot(
  id: string,
  revision: number,
  createdBy: "system" | "user",
): StorefrontSnapshot {
  return {
    id,
    projectId: KARVONEN_PROJECT_ID,
    revision,
    brandSystem: structuredClone(karvonenBrandSystem),
    navigation: structuredClone(navigation),
    pages: structuredClone([homePage, collectionPage, productPage]),
    catalogueRef: "catalogue_karvonen",
    createdAt: "2026-07-21T09:00:00+03:00",
    createdBy,
  };
}

const seedBundleSchema = z
  .object({
    project: projectSchema,
    catalogue: catalogueDisplayModelSchema,
    publishedSnapshot: storefrontSnapshotSchema,
    draftSnapshot: storefrontSnapshotSchema,
    protectedProductPaths: z.tuple([z.literal("price"), z.literal("stockStatus")]),
  })
  .strict();

function deepFreeze<T>(value: T): Readonly<T> {
  if (typeof value === "object" && value !== null && !Object.isFrozen(value)) {
    Object.freeze(value);
    Object.values(value).forEach(deepFreeze);
  }
  return value;
}

const parsedSeed = seedBundleSchema.parse({
  project: {
    id: KARVONEN_PROJECT_ID,
    name: "Karvonen",
    mode: "salesDemo",
    industry: "jewellery",
    primaryLocale: "fi",
    enabledLocales: ["fi", "en"],
    businessProfile: {
      name: "Karvonen",
      description: "Karvosen korujen demo-katalogi.",
      audience: "Korujen ostajat.",
      market: "Finland",
      sourceReferences: [],
    },
    publishedSnapshotId: "snapshot_karvonen_published",
    draftSnapshotId: "snapshot_karvonen_draft",
    revision: 1,
    createdAt: "2026-07-21T09:00:00+03:00",
    updatedAt: "2026-07-21T09:00:00+03:00",
  },
  catalogue: { id: "catalogue_karvonen", products, collections },
  publishedSnapshot: makeSnapshot("snapshot_karvonen_published", 1, "system"),
  draftSnapshot: makeSnapshot("snapshot_karvonen_draft", 2, "user"),
  protectedProductPaths,
});

validateRegisteredSnapshot(parsedSeed.publishedSnapshot, parsedSeed.catalogue, "fi", "fi");
validateRegisteredSnapshot(parsedSeed.draftSnapshot, parsedSeed.catalogue, "fi", "fi");

export type KarvonenSeed = {
  project: Project;
  catalogue: CatalogueDisplayModel;
  publishedSnapshot: StorefrontSnapshot;
  draftSnapshot: StorefrontSnapshot;
  protectedProductPaths: typeof protectedProductPaths;
};

export const karvonenSeed = deepFreeze(parsedSeed) as Readonly<KarvonenSeed>;
