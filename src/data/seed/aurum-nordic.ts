import { z } from "zod";
import { validateRegisteredSnapshot } from "@/components/registry";
import {
  catalogueDisplayModelSchema,
  protectedProductPaths,
  type CatalogueDisplayModel,
} from "@/domain/catalogue";
import { aurumNordicBrandSystem } from "@/domain/design-system";
import { projectSchema, type Project } from "@/domain/project";
import { storefrontSnapshotSchema, type StorefrontSnapshot } from "@/domain/storefront";
import { AURUM_NORDIC_PROJECT_ID } from "./identifiers";

const enFi = (en: string, fi: string) => ({ en, fi });
const optionValues = (...values: Array<[string, string]>) => values.map(([en, fi]) => enFi(en, fi));

export const aurumNordicBusinessProfile = {
  name: "Aurum Nordic",
  description:
    "A fictional Helsinki jewellery house pairing Nordic restraint with warm, lasting materials.",
  audience: "Design-conscious customers looking for meaningful jewellery and dependable watches.",
  market: "Finland",
  sourceReferences: [],
};

const products = [
  {
    id: "product_aurora_ring_585",
    sku: "RING-AUR-585",
    title: enFi("Aurora Ring 585", "Aurora-sormus 585"),
    description: enFi(
      "A slender yellow-gold diamond ring with a soft comfort profile.",
      "Siro keltakultainen timanttisormus pehmeällä comfort-profiililla.",
    ),
    price: { amount: 1290, currency: "EUR" as const },
    stockStatus: "inStock" as const,
    images: [
      {
        id: "asset_aurora_ring",
        url: "/seed-assets/aurora-ring.svg",
        alt: enFi("Aurora yellow-gold diamond ring", "Aurora-keltakultainen timanttisormus"),
        decorative: false,
      },
    ],
    productType: "ring",
    attributes: {
      material: "gold",
      fineness: "585",
      karat: "14K",
      metalColour: "yellow",
      stoneType: "diamond",
      stoneShape: "round",
      stoneColour: "colourless",
      stoneSetting: "prong",
      ringSizes: ["15", "16", "17", "18", "19", "20", "21"],
      ringWidthMm: 2.2,
      ringProfile: "comfort",
      engraving: "available",
      audience: "unisex",
      styleTags: ["minimal", "timeless", "bridal"],
    },
    variants: [],
    orderOptions: [
      {
        id: "option_aurora_size",
        type: "selection" as const,
        label: enFi("Ring size", "Sormuskoko"),
        required: true,
        values: optionValues(
          ...[15, 16, 17, 18, 19, 20, 21].map(
            (size) => [String(size), String(size)] as [string, string],
          ),
        ),
      },
      {
        id: "option_aurora_engraving",
        type: "text" as const,
        label: enFi("Engraving", "Kaiverrus"),
        required: false,
        maxLength: 20,
      },
    ],
    seo: {
      title: enFi("Aurora Ring 585 | Aurum Nordic", "Aurora-sormus 585 | Aurum Nordic"),
      metaDescription: enFi(
        "Yellow-gold diamond ring in sizes 15–21.",
        "Keltakultainen timanttisormus koossa 15–21.",
      ),
    },
  },
  {
    id: "product_lumi_halo_ring",
    sku: "RING-LUM-HALO",
    title: enFi("Lumi Halo Ring", "Lumi Halo -sormus"),
    description: enFi(
      "A white-gold halo ring centred on a brilliant round diamond.",
      "Valkokultainen halosormus, jonka keskellä säihkyy pyöreä timantti.",
    ),
    price: { amount: 1890, currency: "EUR" as const },
    stockStatus: "lowStock" as const,
    images: [
      {
        id: "asset_lumi_ring",
        url: "/seed-assets/lumi-halo-ring.svg",
        alt: enFi("Lumi white-gold halo ring", "Lumi-valkokultainen halosormus"),
        decorative: false,
      },
    ],
    productType: "ring",
    attributes: {
      material: "gold",
      fineness: "585",
      karat: "14K",
      metalColour: "white",
      stoneType: "diamond",
      stoneShape: "round",
      stoneColour: "colourless",
      stoneClarity: "SI placeholder",
      stoneSetting: "halo",
      ringSizes: ["15", "16", "17", "18", "19", "20"],
      ringWidthMm: 2.5,
      audience: "women",
      styleTags: ["halo", "brilliant", "celebration"],
    },
    variants: [],
    orderOptions: [
      {
        id: "option_lumi_size",
        type: "selection" as const,
        label: enFi("Ring size", "Sormuskoko"),
        required: true,
        values: optionValues(
          ...[15, 16, 17, 18, 19, 20].map(
            (size) => [String(size), String(size)] as [string, string],
          ),
        ),
      },
    ],
    seo: {
      title: enFi("Lumi Halo Ring | Aurum Nordic", "Lumi Halo -sormus | Aurum Nordic"),
      metaDescription: enFi("White-gold halo diamond ring.", "Valkokultainen halo-timanttisormus."),
    },
  },
  {
    id: "product_aava_necklace_925",
    sku: "NECK-AAVA-925",
    title: enFi("Aava Silver Necklace", "Aava-hopeakaulakoru"),
    description: enFi(
      "A calm sterling-silver pendant with two chain lengths.",
      "Rauhallinen sterlinghopeariipus kahdella ketjupituudella.",
    ),
    price: { amount: 149, currency: "EUR" as const },
    stockStatus: "inStock" as const,
    images: [
      {
        id: "asset_aava_necklace",
        url: "/seed-assets/aava-necklace.svg",
        alt: enFi("Aava sterling-silver necklace", "Aava-sterlinghopeakaulakoru"),
        decorative: false,
      },
    ],
    productType: "necklace",
    attributes: {
      material: "silver",
      fineness: "925",
      metalColour: "white",
      chainLengthsCm: ["45", "50"],
      audience: "unisex",
      styleTags: ["minimal", "everyday", "Nordic"],
    },
    variants: [
      { id: "variant_aava_45", label: enFi("45 cm", "45 cm"), attributes: { chainLengthCm: 45 } },
      { id: "variant_aava_50", label: enFi("50 cm", "50 cm"), attributes: { chainLengthCm: 50 } },
    ],
    seo: {
      title: enFi("Aava Silver Necklace | Aurum Nordic", "Aava-hopeakaulakoru | Aurum Nordic"),
      metaDescription: enFi(
        "Sterling-silver necklace in 45 and 50 cm.",
        "Sterlinghopeakaulakoru 45 ja 50 cm pituisena.",
      ),
    },
  },
  {
    id: "product_sisu_automatic_watch",
    sku: "WATCH-SISU-AUTO",
    title: enFi("Sisu Automatic Watch", "Sisu-automaattikello"),
    description: enFi(
      "A restrained steel automatic watch built for everyday resilience.",
      "Hillitty teräksinen automaattikello jokapäiväiseen käyttöön.",
    ),
    price: { amount: 690, currency: "EUR" as const },
    stockStatus: "inStock" as const,
    images: [
      {
        id: "asset_sisu_watch",
        url: "/seed-assets/sisu-watch.svg",
        alt: enFi("Sisu steel automatic watch", "Sisu-teräsautomaattikello"),
        decorative: false,
      },
    ],
    productType: "watch",
    attributes: {
      material: "steel",
      metalColour: "silver",
      watchBrand: "Aurum Nordic",
      watchModel: "Sisu Automatic",
      caseSizeMm: 40,
      strapMaterial: "steel",
      movement: "automatic",
      waterResistance: "10 ATM",
      audience: "unisex",
      styleTags: ["sport", "minimal", "everyday"],
    },
    variants: [],
    seo: {
      title: enFi("Sisu Automatic Watch | Aurum Nordic", "Sisu-automaattikello | Aurum Nordic"),
      metaDescription: enFi(
        "40 mm steel automatic watch with 10 ATM resistance.",
        "40 mm teräksinen automaattikello 10 ATM vesitiiviydellä.",
      ),
    },
  },
  {
    id: "product_kajo_earrings_585",
    sku: "EAR-KAJO-585",
    title: enFi("Kajo Rose Earrings", "Kajo-rosekultakorvakorut"),
    description: enFi(
      "Rose-gold earrings with bright zirconia details, sold as a pair.",
      "Rosekultaiset korvakorut kirkkailla zirkonioilla, myydään parina.",
    ),
    price: { amount: 490, currency: "EUR" as const },
    stockStatus: "lowStock" as const,
    images: [
      {
        id: "asset_kajo_earrings",
        url: "/seed-assets/kajo-earrings.svg",
        alt: enFi("Pair of Kajo rose-gold earrings", "Kajo-rosekultakorvakorupari"),
        decorative: false,
      },
    ],
    productType: "earrings",
    attributes: {
      material: "gold",
      fineness: "585",
      karat: "14K",
      metalColour: "rose",
      stoneType: "zirconia",
      stoneShape: "round",
      stoneColour: "colourless",
      stoneSetting: "bezel",
      soldAs: "pair",
      audience: "women",
      styleTags: ["warm", "gift", "evening"],
    },
    variants: [],
    seo: {
      title: enFi("Kajo Rose Earrings | Aurum Nordic", "Kajo-rosekultakorvakorut | Aurum Nordic"),
      metaDescription: enFi(
        "Rose-gold 585 zirconia earrings.",
        "Rosekultaiset 585-zirkoniakorvakorut.",
      ),
    },
  },
  {
    id: "product_meri_bracelet_925",
    sku: "BRAC-MERI-925",
    title: enFi("Meri Bracelet", "Meri-rannekoru"),
    description: enFi(
      "A fluid sterling-silver bracelet in three considered lengths.",
      "Sulavalinjainen sterlinghopearannekoru kolmessa pituudessa.",
    ),
    price: { amount: 179, currency: "EUR" as const },
    stockStatus: "inStock" as const,
    images: [
      {
        id: "asset_meri_bracelet",
        url: "/seed-assets/meri-bracelet.svg",
        alt: enFi("Meri sterling-silver bracelet", "Meri-sterlinghopearannekoru"),
        decorative: false,
      },
    ],
    productType: "bracelet",
    attributes: {
      material: "silver",
      fineness: "925",
      metalColour: "white",
      braceletLengthsCm: ["17", "19", "21"],
      audience: "unisex",
      styleTags: ["fluid", "minimal", "everyday"],
    },
    variants: [
      {
        id: "variant_meri_17",
        label: enFi("17 cm", "17 cm"),
        attributes: { braceletLengthCm: 17 },
      },
      {
        id: "variant_meri_19",
        label: enFi("19 cm", "19 cm"),
        attributes: { braceletLengthCm: 19 },
      },
      {
        id: "variant_meri_21",
        label: enFi("21 cm", "21 cm"),
        attributes: { braceletLengthCm: 21 },
      },
    ],
    seo: {
      title: enFi("Meri Bracelet | Aurum Nordic", "Meri-rannekoru | Aurum Nordic"),
      metaDescription: enFi(
        "Sterling-silver bracelet in 17, 19 and 21 cm.",
        "Sterlinghopearannekoru 17, 19 ja 21 cm pituisena.",
      ),
    },
  },
];

const collections = [
  {
    id: "collection_rings",
    slug: "rings",
    title: enFi("Rings", "Sormukset"),
    description: enFi(
      "Gold rings for lasting moments.",
      "Kultasormuksia elämän tärkeisiin hetkiin.",
    ),
    productIds: ["product_aurora_ring_585", "product_lumi_halo_ring"],
  },
  {
    id: "collection_everyday",
    slug: "everyday-icons",
    title: enFi("Everyday icons", "Arjen ikonit"),
    description: enFi(
      "Quietly distinctive pieces for every day.",
      "Hillityn tunnistettavia koruja jokaiseen päivään.",
    ),
    productIds: [
      "product_aava_necklace_925",
      "product_sisu_automatic_watch",
      "product_kajo_earrings_585",
      "product_meri_bracelet_925",
    ],
  },
];

const homePage = {
  id: "page_home",
  type: "home" as const,
  slug: "/",
  title: enFi("Home", "Etusivu"),
  seo: {
    title: enFi("Aurum Nordic jewellery", "Aurum Nordic -korut"),
    metaDescription: enFi(
      "Nordic jewellery and watches with lasting character.",
      "Pohjoismaisia koruja ja kelloja, joissa on kestävää luonnetta.",
    ),
  },
  sections: [
    {
      id: "section_home_hero",
      component: "hero",
      variant: "editorial",
      visible: true,
      content: {
        eyebrow: enFi("Aurum Nordic · Helsinki", "Aurum Nordic · Helsinki"),
        title: enFi("Made for northern light", "Tehty pohjoiseen valoon"),
        body: enFi(
          "Jewellery and watches shaped by Nordic clarity and warm materials.",
          "Pohjoismaisen selkeitä koruja ja kelloja lämpimistä materiaaleista.",
        ),
      },
      props: { activeLocale: "en", primaryLocale: "en" },
    },
  ],
};

const collectionPage = {
  id: "page_collection_rings",
  type: "collection" as const,
  slug: "/collections/rings",
  title: enFi("Rings", "Sormukset"),
  seo: {
    title: enFi("Rings | Aurum Nordic", "Sormukset | Aurum Nordic"),
    metaDescription: enFi(
      "Aurum Nordic gold and diamond rings.",
      "Aurum Nordicin kulta- ja timanttisormukset.",
    ),
  },
  sections: [],
};

const productPage = {
  id: "page_product_aurora",
  type: "product" as const,
  slug: "/products/aurora-ring-585",
  title: enFi("Aurora Ring 585", "Aurora-sormus 585"),
  seo: {
    title: enFi("Aurora Ring 585 | Aurum Nordic", "Aurora-sormus 585 | Aurum Nordic"),
    metaDescription: enFi(
      "Yellow-gold diamond ring in sizes 15–21.",
      "Keltakultainen timanttisormus koossa 15–21.",
    ),
  },
  sections: [],
};

const navigation = {
  primary: [
    {
      id: "nav_home",
      label: enFi("Home", "Etusivu"),
      target: { type: "page" as const, pageId: "page_home" },
    },
    {
      id: "nav_rings",
      label: enFi("Rings", "Sormukset"),
      target: { type: "page" as const, pageId: "page_collection_rings" },
    },
  ],
  footer: [
    {
      id: "nav_aurora",
      label: enFi("Aurora Ring", "Aurora-sormus"),
      target: { type: "page" as const, pageId: "page_product_aurora" },
    },
  ],
};

const makeSnapshot = (id: string, revision: number, createdBy: "system" | "user") => ({
  id,
  projectId: AURUM_NORDIC_PROJECT_ID,
  revision,
  brandSystem: aurumNordicBrandSystem,
  navigation,
  pages: [homePage, collectionPage, productPage],
  catalogueRef: "catalogue_aurum_nordic",
  createdAt: "2026-07-15T09:00:00+03:00",
  createdBy,
});

const seedBundleSchema = z
  .object({
    project: projectSchema,
    catalogue: catalogueDisplayModelSchema,
    publishedSnapshot: storefrontSnapshotSchema,
    draftSnapshot: storefrontSnapshotSchema,
    protectedProductPaths: z.tuple([z.literal("price"), z.literal("stockStatus")]),
  })
  .strict()
  .superRefine((seed, context) => {
    if (seed.project.publishedSnapshotId !== seed.publishedSnapshot.id) {
      context.addIssue({
        code: "custom",
        message: "Published snapshot reference must resolve.",
        path: ["project", "publishedSnapshotId"],
      });
    }
    if (seed.project.draftSnapshotId !== seed.draftSnapshot.id) {
      context.addIssue({
        code: "custom",
        message: "Draft snapshot reference must resolve.",
        path: ["project", "draftSnapshotId"],
      });
    }
    for (const [name, snapshot] of [
      ["publishedSnapshot", seed.publishedSnapshot],
      ["draftSnapshot", seed.draftSnapshot],
    ] as const) {
      if (snapshot.projectId !== seed.project.id || snapshot.catalogueRef !== seed.catalogue.id) {
        context.addIssue({
          code: "custom",
          message: "Snapshot project and catalogue references must resolve.",
          path: [name],
        });
      }
    }
  });

function deepFreeze<T>(value: T): Readonly<T> {
  if (typeof value === "object" && value !== null && !Object.isFrozen(value)) {
    Object.freeze(value);
    Object.values(value).forEach(deepFreeze);
  }
  return value;
}

const parsedSeed = seedBundleSchema.parse({
  project: {
    id: AURUM_NORDIC_PROJECT_ID,
    name: "Aurum Nordic",
    mode: "salesDemo",
    industry: "jewellery",
    primaryLocale: "en",
    enabledLocales: ["en", "fi"],
    businessProfile: aurumNordicBusinessProfile,
    publishedSnapshotId: "snapshot_aurum_published",
    draftSnapshotId: "snapshot_aurum_draft",
    revision: 2,
    createdAt: "2026-07-15T09:00:00+03:00",
    updatedAt: "2026-07-15T09:05:00+03:00",
  },
  catalogue: { id: "catalogue_aurum_nordic", products, collections },
  publishedSnapshot: makeSnapshot("snapshot_aurum_published", 1, "system"),
  draftSnapshot: makeSnapshot("snapshot_aurum_draft", 2, "user"),
  protectedProductPaths,
});

validateRegisteredSnapshot(parsedSeed.publishedSnapshot);
validateRegisteredSnapshot(parsedSeed.draftSnapshot);

export type AurumNordicSeed = {
  project: Project;
  catalogue: CatalogueDisplayModel;
  publishedSnapshot: StorefrontSnapshot;
  draftSnapshot: StorefrontSnapshot;
  protectedProductPaths: typeof protectedProductPaths;
};

export const aurumNordicSeed = deepFreeze(parsedSeed) as Readonly<AurumNordicSeed>;
