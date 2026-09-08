import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { aurumNordicSeed } from "@/data/seed";
import {
  aurumHeroContentSchema as runtimeAurumHeroContentSchema,
  aurumHeroDefinition,
  aurumHeroPropsSchema as runtimeAurumHeroPropsSchema,
} from "@/components/registry/aurum-hero";
import {
  aurumHeroContentSchema,
  aurumHeroMetadata,
  aurumHeroMetadataDefinitions,
  aurumHeroPropsSchema,
} from "@/components/registry/aurum-hero-metadata";
import * as homepage from "@/components/registry/homepage";
import * as metadata from "@/components/registry/homepage-metadata";
import {
  createStorefrontRenderContext,
  validateRegisteredPage,
} from "@/components/registry/registry";
import { adaptV1ComponentDefinitionToV2 } from "@/components/registry/v2-compatibility";
import { resolveRuntimeImportClosure } from "../helpers/ar-02-runtime-import-closure";
import {
  observeLegacyMetadata,
  type ObservedLegacyDefinition,
} from "../helpers/ar-02-legacy-metadata-observation";

const hash = (value: unknown) =>
  createHash("sha256")
    .update(`${JSON.stringify(value, null, 2)}\n`)
    .digest("hex");
// Projected from /Users/leo/veskify-batch-runs/BATCH-03/AR-02D/observation/
// baseline-observation.json at base 03418ba678099b8a14c6733e009affb2c70f620b,
// SHA-256 e18ebcb9e7f131e86e9ebe4dc9d1b52c67db97f2f60e8db6817b2d11eb3d47dd.
const context = (activeLocale: "en" | "fi") =>
  createStorefrontRenderContext({
    activeLocale,
    primaryLocale: "en",
    catalogue: aurumNordicSeed.catalogue,
    snapshot: aurumNordicSeed.draftSnapshot,
  });
const entries = Object.entries(homepage.homepageDefinitions).map(([exportName, definition]) => ({
  group: "homepage",
  exportName,
  definition,
  publicSchemaExportMapping: {
    content: `${definition.type}ContentSchema`,
    props: `${definition.type}PropsSchema`,
  },
})) satisfies readonly ObservedLegacyDefinition[];
const definitions = [
  ...entries,
  {
    group: "hero",
    exportName: "aurumHeroDefinition",
    definition: aurumHeroDefinition,
    publicSchemaExportMapping: { content: "aurumHeroContentSchema", props: "aurumHeroPropsSchema" },
  },
] as const;
const schemas = {
  announcementBar: [metadata.announcementBarContentSchema, metadata.announcementBarPropsSchema],
  header: [metadata.headerContentSchema, metadata.headerPropsSchema],
  featuredCategories: [
    metadata.featuredCategoriesContentSchema,
    metadata.featuredCategoriesPropsSchema,
  ],
  productGrid: [metadata.productGridContentSchema, metadata.productGridPropsSchema],
  campaignBanner: [metadata.campaignBannerContentSchema, metadata.campaignBannerPropsSchema],
  brandStory: [metadata.brandStoryContentSchema, metadata.brandStoryPropsSchema],
  benefitIcons: [metadata.benefitIconsContentSchema, metadata.benefitIconsPropsSchema],
  newsletter: [metadata.newsletterContentSchema, metadata.newsletterPropsSchema],
  footer: [metadata.footerContentSchema, metadata.footerPropsSchema],
  hero: [aurumHeroContentSchema, aurumHeroPropsSchema],
} as const;
const error = (action: () => unknown) => {
  try {
    action();
    return { threw: false };
  } catch (reason) {
    return { threw: true, message: reason instanceof Error ? reason.message : String(reason) };
  }
};

describe("AR-02D homepage and hero metadata", () => {
  it("shares original schema identities and parses raw metadata defaults through the runtime factory", () => {
    const pairs = [
      [
        homepage.announcementBarDefinition,
        metadata.announcementBarMetadata,
        homepage.announcementBarContentSchema,
        metadata.announcementBarContentSchema,
        homepage.announcementBarPropsSchema,
        metadata.announcementBarPropsSchema,
      ],
      [
        homepage.headerDefinition,
        metadata.headerMetadata,
        homepage.headerContentSchema,
        metadata.headerContentSchema,
        homepage.headerPropsSchema,
        metadata.headerPropsSchema,
      ],
      [
        homepage.featuredCategoriesDefinition,
        metadata.featuredCategoriesMetadata,
        homepage.featuredCategoriesContentSchema,
        metadata.featuredCategoriesContentSchema,
        homepage.featuredCategoriesPropsSchema,
        metadata.featuredCategoriesPropsSchema,
      ],
      [
        homepage.productGridDefinition,
        metadata.productGridMetadata,
        homepage.productGridContentSchema,
        metadata.productGridContentSchema,
        homepage.productGridPropsSchema,
        metadata.productGridPropsSchema,
      ],
      [
        homepage.campaignBannerDefinition,
        metadata.campaignBannerMetadata,
        homepage.campaignBannerContentSchema,
        metadata.campaignBannerContentSchema,
        homepage.campaignBannerPropsSchema,
        metadata.campaignBannerPropsSchema,
      ],
      [
        homepage.brandStoryDefinition,
        metadata.brandStoryMetadata,
        homepage.brandStoryContentSchema,
        metadata.brandStoryContentSchema,
        homepage.brandStoryPropsSchema,
        metadata.brandStoryPropsSchema,
      ],
      [
        homepage.benefitIconsDefinition,
        metadata.benefitIconsMetadata,
        homepage.benefitIconsContentSchema,
        metadata.benefitIconsContentSchema,
        homepage.benefitIconsPropsSchema,
        metadata.benefitIconsPropsSchema,
      ],
      [
        homepage.newsletterDefinition,
        metadata.newsletterMetadata,
        homepage.newsletterContentSchema,
        metadata.newsletterContentSchema,
        homepage.newsletterPropsSchema,
        metadata.newsletterPropsSchema,
      ],
      [
        homepage.footerDefinition,
        metadata.footerMetadata,
        homepage.footerContentSchema,
        metadata.footerContentSchema,
        homepage.footerPropsSchema,
        metadata.footerPropsSchema,
      ],
      [
        aurumHeroDefinition,
        aurumHeroMetadata,
        runtimeAurumHeroContentSchema,
        aurumHeroContentSchema,
        runtimeAurumHeroPropsSchema,
        aurumHeroPropsSchema,
      ],
    ] as const;
    for (const [
      definition,
      input,
      runtimeContent,
      metadataContent,
      runtimeProps,
      metadataProps,
    ] of pairs) {
      expect(runtimeContent).toBe(metadataContent);
      expect(runtimeProps).toBe(metadataProps);
      expect(definition.contentSchema).toBe(metadataContent);
      expect(definition.propsSchema).toBe(metadataProps);
      expect(definition.defaultContent).toEqual(metadataContent.parse(input.defaultContent));
      expect(definition.defaultProps).toEqual(metadataProps.parse(input.defaultProps));
    }
    expect(Object.values(metadata.homepageMetadataDefinitions)).toEqual([
      metadata.announcementBarMetadata,
      metadata.headerMetadata,
      metadata.featuredCategoriesMetadata,
      metadata.productGridMetadata,
      metadata.campaignBannerMetadata,
      metadata.brandStoryMetadata,
      metadata.benefitIconsMetadata,
      metadata.newsletterMetadata,
      metadata.footerMetadata,
    ]);
    expect(aurumHeroMetadataDefinitions.hero).toBe(aurumHeroMetadata);
  });

  it("preserves adaptation, metadata, and every original variant render", () => {
    const observed = observeLegacyMetadata({ definitions, schemas, context });
    expect(hash(observed.definitions)).toBe(
      "4af367ab709ea1457b0d0e5328e97aa957fd5c170e95e71d816164d6318cb2fd",
    );
    expect(
      hash(definitions.map(({ definition }) => adaptV1ComponentDefinitionToV2(definition))),
    ).toBe("9ec37c334390d1569678b44e6a44b5be53b3d669f7e00ce166d2d8c64cd324f7");
    expect(observed.renderings).toHaveLength(80);
    expect(hash(observed.renderings)).toBe(
      "555bfb40a641959e2bdef1320d2afb14722a3bcabe0888712a0d18a0f183bd51",
    );
  });

  it("retains strict schema and runtime validation failures", () => {
    const page = aurumNordicSeed.draftSnapshot.pages.find((item) => item.type === "home")!;
    const product = structuredClone(
      page.sections.find((item) => item.component === "productGrid")!,
    );
    const collection = structuredClone(
      page.sections.find((item) => item.component === "featuredCategories")!,
    );
    product.content.productIds = ["product_aurora_ring_585", "product_aurora_ring_585"];
    collection.content.collectionIds = ["collection_missing"];
    expect(
      error(() => validateRegisteredPage({ ...page, sections: [product] }, context("en"))),
    ).toMatchObject({ threw: true });
    expect(
      error(() => validateRegisteredPage({ ...page, sections: [collection] }, context("en"))),
    ).toMatchObject({ threw: true });
    expect(() =>
      metadata.campaignBannerContentSchema.parse({
        ...metadata.campaignBannerMetadata.defaultContent,
        cta: { ...metadata.campaignBannerMetadata.defaultContent.cta, href: "javascript:alert(1)" },
      }),
    ).toThrow();
    expect(() =>
      metadata.brandStoryContentSchema.parse({
        ...metadata.brandStoryMetadata.defaultContent,
        media: undefined,
        approvedAssetId: undefined,
      }),
    ).toThrow(/Brand story requires/);
    expect(() =>
      aurumHeroContentSchema.parse({
        ...aurumHeroMetadata.defaultContent,
        media: {
          ...aurumHeroMetadata.defaultContent.media,
          url: "https://unsafe.example/image.jpg",
        },
      }),
    ).toThrow(/controlled local/);
    expect(() =>
      aurumHeroDefinition.validate(
        {
          id: "hero",
          component: "hero",
          variant: "editorial",
          visible: true,
          content: aurumHeroDefinition.defaultContent,
          props: aurumHeroDefinition.defaultProps,
        },
        "product",
        context("en"),
      ),
    ).toThrow(/not allowed/);
  });

  it.each([
    "src/components/registry/homepage-metadata.ts",
    "src/components/registry/aurum-hero-metadata.ts",
  ])("has a renderer-free runtime closure for %s", (entry) => {
    const closure = resolveRuntimeImportClosure(entry);
    const forbidden =
      /(?:^src\/components\/(?:storefront\/|registry\/.*\.tsx$)|^src\/components\/registry\/(?:index|registry|legacy-registry|v2-registry|contract|homepage|aurum-hero)\.(?:ts|tsx)$|^src\/integrations\/puck\/|^src\/(?:app|features)\/|(?:^|\/)(?:react|react-dom)(?:\/|$)|acceptance|\.css$)/iu;
    expect(closure.runtimePaths).not.toEqual([]);
    expect(closure.runtimePaths.filter((path) => forbidden.test(path))).toEqual([]);
    expect(closure.externalRuntimeImports.map(({ specifier }) => specifier)).toEqual(["zod"]);
  });
});
