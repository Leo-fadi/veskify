import {
  homepageCommerceBridgeComponentNames,
  homepageCommerceBridgeVariants,
  type HomepageCommerceBridgeComponent,
} from "./homepage-commerce-bridge-metadata";
import { contentSupportVariantSchema } from "./content-support";
import type { ComponentDefinition } from "./contract";

type BridgeDescription = Readonly<
  Pick<ComponentDefinition, "type" | "label" | "editorFields" | "protectedFields"> & {
    variants: readonly [string, ...string[]];
  }
>;

export const dynamicCollectionCommerceBridgeVariants = [
  "standard",
  "editorial",
  "compact",
  "gallery",
  "editorialDiscovery",
  "catalogueComparison",
  "campaignLedDiscovery",
  "denseSearch",
] as const;

export const dynamicCommerceBridgeDescriptions = {
  dynamicCollectionCommerce: {
    type: "dynamicCollectionCommerce",
    label: "Dynamic collection commerce",
    variants: dynamicCollectionCommerceBridgeVariants,
    editorFields: {},
    protectedFields: {
      readOnlyPaths: [
        "collectionId",
        "productIds",
        "canonicalRevision",
        "catalogue.collections",
        "catalogue.products",
      ],
    },
  },
  dynamicProductDetail: {
    type: "dynamicProductDetail",
    label: "Dynamic product detail",
    variants: ["balanced", "editorial", "compact", "galleryDominant", "editorialSplit"] as const,
    editorFields: {},
    protectedFields: {
      readOnlyPaths: ["productId", "relatedProductIds", "canonicalRevision", "catalogue.products"],
    },
  },
} as const satisfies Readonly<Record<string, BridgeDescription>>;

export const contentSupportBridgeComponentNames = ["contentSupport"] as const;
export type ContentSupportBridgeComponent = (typeof contentSupportBridgeComponentNames)[number];

const variants = contentSupportVariantSchema.options;
const firstVariant = variants[0];
if (!firstVariant) throw new Error("Content/support requires registered variants.");

export const contentSupportBridgeVariants = [firstVariant, ...variants.slice(1)] as const;
export const contentSupportBridgeDescription = {
  type: "contentSupport",
  label: "Content and support",
  variants: contentSupportBridgeVariants,
  editorFields: {},
  protectedFields: {
    readOnlyPaths: [
      "content.factDocumentId",
      "bindings.supportFacts",
      "bindings.campaignAction",
      "assets.*.provenance",
    ],
  },
} as const satisfies BridgeDescription;

const homepageBridgeLabels = {
  homepageHero: "Homepage hero",
  homepageFeaturedCollections: "Featured collections",
  homepageFeaturedProducts: "Featured products",
  homepageCollectionNavigation: "Collection navigation",
  homepagePromotion: "Promotional content",
  homepageTrust: "Trust and support",
  homepageEditorial: "Editorial storytelling",
  homepageProof: "Evidence-grounded proof",
} as const satisfies Readonly<Record<HomepageCommerceBridgeComponent, string>>;

export const homepageCommerceBridgeDescriptions = Object.fromEntries(
  homepageCommerceBridgeComponentNames.map(
    (type): readonly [HomepageCommerceBridgeComponent, BridgeDescription] => [
      type,
      {
        type,
        label: homepageBridgeLabels[type],
        variants: homepageCommerceBridgeVariants[type],
        editorFields: {},
        protectedFields: {
          readOnlyPaths: ["catalogue", "navigation", "bindings", "assetAssignments"],
        },
      },
    ],
  ),
) as Readonly<Record<HomepageCommerceBridgeComponent, BridgeDescription>>;
