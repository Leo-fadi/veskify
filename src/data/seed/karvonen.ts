import { z } from "zod";
import { validateRegisteredSnapshot } from "@/components/registry";
import {
  catalogueDisplayModelSchema,
  protectedProductPaths,
  type CatalogueDisplayModel,
} from "@/domain/catalogue";
import { projectSchema } from "@/domain/project";
import { storefrontSnapshotSchema } from "@/domain/storefront";
import { aurumNordicSeed } from "./aurum-nordic";
import { KARVONEN_PROJECT_ID } from "./identifiers";
import type { Project } from "@/domain/project";
import type { StorefrontSnapshot } from "@/domain/storefront";

const fi = (value: string) => ({ fi: value });
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

const referenceMap = new Map<string, string>([
  ...aurumNordicSeed.catalogue.products.map(
    (product, index) => [product.id, products[index]?.id ?? ""] as const,
  ),
  ["collection_rings", "collection_karvonen_myrskyluodon-maija"],
  ["collection_everyday", "collection_karvonen_pihka"],
  ["/seed-assets/aurora-ring.svg", "/seed-assets/karvonen/storefront/hero-desktop.jpg"],
  [
    "/seed-assets/lumi-halo-ring.svg",
    "/seed-assets/karvonen/storefront/collection-diamond-rings.jpg",
  ],
  [
    "/seed-assets/aava-necklace.svg",
    "/seed-assets/karvonen/storefront/collection-jewellery-or-wedding-rings.jpg",
  ],
]);

function replaceReferences(value: unknown): unknown {
  if (typeof value === "string")
    return referenceMap.get(value) ?? value.replaceAll("Aurum Nordic", "Karvonen");
  if (Array.isArray(value)) return value.map(replaceReferences);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, entry]) => [key, replaceReferences(entry)]),
    );
  }
  return value;
}

function makeSnapshot(id: string, revision: number, createdBy: "system" | "user") {
  const source = replaceReferences(aurumNordicSeed.draftSnapshot) as StorefrontSnapshot;
  return {
    ...source,
    id,
    projectId: KARVONEN_PROJECT_ID,
    catalogueRef: "catalogue_karvonen",
    revision,
    createdBy,
    pages: source.pages.map((page) => {
      if (page.id === "page_home") {
        return {
          ...page,
          title: fi("Karvonen"),
          seo: { title: fi("Karvonen"), metaDescription: fi("Karvosen korut") },
        };
      }
      if (page.id === "page_collection_rings") {
        return {
          ...page,
          slug: "/collections/myrskyluodon-maija",
          title: fi("Myrskyluodon Maija"),
        };
      }
      return {
        ...page,
        slug: "/products/guldviva-myrskyluodon-maija-sormus",
        title: products[0].title,
      };
    }),
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
