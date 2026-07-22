import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";
import { veskifyComponentRegistry } from "@/components/registry";
import {
  adaptV1ComponentDefinitionToV2,
  adaptV1ComponentRegistryToV2,
} from "@/components/registry/v2-compatibility";
import {
  createComponentRegistryV2,
  productBindingSchema,
  productPresentationContextSchema,
  storefrontAssetMetadataSchema,
  validateComponentDefinitionV2,
  type ComponentDefinitionV2,
  type ProductPresentationContext,
} from "@/domain/component-platform";

const componentVersion = { major: 2, minor: 0, patch: 0 } as const;

function localized(en: string, fi = en) {
  return { en, fi };
}

function genericProductComponent(
  overrides: Partial<ComponentDefinitionV2> = {},
): ComponentDefinitionV2 {
  return {
    type: "dynamicProductSummary",
    version: componentVersion,
    title: localized("Dynamic product summary"),
    merchantDescription: localized("Shows canonical product details with editable presentation."),
    family: "commerce",
    supportedPageTypes: ["product"],
    variants: [
      { id: "compact", title: localized("Compact") },
      { id: "editorial", title: localized("Editorial") },
    ],
    defaultVariant: "compact",
    industryTags: ["watch", "jewellery", "fashion"],
    contentSlots: [
      {
        id: "supportingCopy",
        title: localized("Supporting copy"),
        localized: true,
        required: false,
      },
    ],
    commerceBindingSlots: [
      {
        id: "primaryProduct",
        title: localized("Product"),
        acceptedSourceTypes: ["product"],
        required: true,
        revisionRequired: true,
        emptyState: "message",
      },
    ],
    assetSlots: [
      {
        id: "editorialMedia",
        title: localized("Editorial media"),
        acceptedRoles: ["productMainImage", "productAlternativeImage", "editorialImage"],
        required: false,
        minItems: 0,
        maxItems: 2,
      },
    ],
    editablePresentationFields: [
      {
        path: "content.supportingCopy",
        label: localized("Supporting copy"),
        source: "content",
        control: "textarea",
        localized: true,
      },
      {
        path: "props.selectorStyle",
        label: localized("Option selector style"),
        source: "props",
        control: "select",
        localized: false,
      },
    ],
    protectedFields: {
      readOnlyPaths: [
        "bindings.product.productId",
        "bindings.product.productTypeId",
        "bindings.product.sku",
        "bindings.product.price",
        "bindings.product.compareAtPrice",
        "bindings.product.availability",
        "bindings.product.optionGroups",
      ],
    },
    responsiveRules: [
      {
        breakpoints: ["mobile", "tablet", "desktop", "wide"],
        allowHorizontalOverflow: false,
        maxColumns: 2,
      },
    ],
    accessibilityRequirements: {
      keyboard: "Every selector is reachable and operable by keyboard.",
      semantics: "Product identity, price and option groups use semantic regions.",
      labels: "Every option control exposes localized labels and selected state.",
      focus: "Focus remains visible when moving through option groups.",
      contrast: "Selector and price states inherit validated brand-token contrast.",
    },
    migration: {
      policy: "migrationRequired",
      previousVersions: [{ major: 1, minor: 0, patch: 0 }],
      migrations: [
        {
          fromVersion: { major: 1, minor: 0, patch: 0 },
          toVersion: componentVersion,
          strategy: "registeredFunction",
          migrationId: "dynamicProductSummaryV1ToV2",
          notes: localized("Maps legacy product reference content into a product binding slot."),
        },
      ],
    },
    renderer: {
      adapterId: "veskifyCommerceRenderer",
      exportName: "DynamicProductSummary",
      supportedTargets: ["editor", "preview", "published"],
    },
    ...overrides,
  };
}

const watchProduct: ProductPresentationContext = {
  productId: "product_watch",
  productTypeId: "watch",
  sku: "WATCH-SILVER-001",
  title: localized("Nordic field watch", "Pohjoismainen kenttäkello"),
  description: localized("A compact everyday watch."),
  price: { amount: 349, currency: "EUR", formatted: localized("€349") },
  compareAtPrice: { amount: 399, currency: "EUR", formatted: localized("€399") },
  availability: localized("In stock"),
  media: [{ assetId: "asset_watch_main", role: "main", alt: localized("Silver watch") }],
  attributeGroups: [
    {
      id: "watch_specs",
      title: localized("Technical details"),
      attributes: [{ id: "movement", label: localized("Movement"), value: localized("Automatic") }],
    },
  ],
  optionGroups: [
    {
      id: "colour",
      label: localized("Colour"),
      source: "variantDimension",
      required: true,
      presentation: "swatch",
      values: [
        {
          id: "colour_silver",
          label: localized("Silver"),
          value: "silver",
          swatch: { color: "#d8d8d8" },
          disabled: false,
          metadata: {},
        },
      ],
      selectedValueId: "colour_silver",
      dependsOn: [],
    },
  ],
  selectedValues: [{ groupId: "colour", valueId: "colour_silver", complete: true }],
  unavailableCombinations: [],
  relatedProductIds: ["product_watch_strap"],
  revision: "catalogue-rev-1",
};

const ringProduct: ProductPresentationContext = {
  productId: "product_ring",
  productTypeId: "ring",
  sku: "RING-CONFIGURABLE",
  title: localized("Aurora engagement ring", "Aurora-kihlasormus"),
  price: { amount: 1290, currency: "EUR", formatted: localized("From €1,290") },
  availability: localized("Made to order"),
  media: [{ assetId: "asset_ring_main", role: "main", alt: localized("Gold ring") }],
  attributeGroups: [
    {
      id: "ring_materials",
      title: localized("Materials"),
      attributes: [
        { id: "origin", label: localized("Gold origin"), value: localized("Recycled gold") },
      ],
    },
  ],
  optionGroups: [
    optionGroup("ring_size", "Ring size", ["16", "17", "18"]),
    optionGroup("metal_colour", "Metal colour", ["yellowGold", "whiteGold", "roseGold"]),
    optionGroup("karat", "Karat", ["14k", "18k"]),
    optionGroup("stone", "Stone", ["diamond", "sapphire"]),
    optionGroup("quality", "Quality", ["si", "vs"]),
    {
      id: "engraving",
      label: localized("Engraving"),
      source: "orderOption",
      required: false,
      presentation: "textInput",
      values: [],
      dependsOn: [],
      helpText: localized("Optional engraving, up to the canonical configured limit."),
    },
  ],
  selectedValues: [
    { groupId: "ring_size", valueId: "ring_size_16", complete: true },
    { groupId: "metal_colour", valueId: "metal_colour_yellowgold", complete: true },
  ],
  unavailableCombinations: [
    {
      valueIds: ["metal_colour_whitegold", "karat_14k"],
      reason: localized("This metal and karat combination is not available."),
    },
  ],
  relatedProductIds: ["product_ring_wedding"],
  revision: "catalogue-rev-2",
};

function optionGroup(id: string, label: string, values: string[]) {
  return {
    id,
    label: localized(label),
    source: "variantDimension" as const,
    required: true,
    presentation: "buttonGroup" as const,
    values: values.map((value) => ({
      id: `${id}_${value.toLowerCase()}`,
      label: localized(value),
      value,
      disabled: false,
      metadata: {},
    })),
    selectedValueId: `${id}_${values[0].toLowerCase()}`,
    dependsOn: [],
  };
}

function validInstance(overrides: Record<string, unknown> = {}) {
  return {
    id: "section_dynamic_product_summary",
    component: "dynamicProductSummary",
    componentVersion,
    variant: "compact",
    content: { supportingCopy: localized("Chosen details stay editable.") },
    props: { selectorStyle: "swatch" },
    bindings: [
      {
        slotId: "primaryProduct",
        source: "product",
        productId: "product_watch",
        revision: "catalogue-rev-1",
        locale: "en",
      },
    ],
    assetAssignments: [],
    ...overrides,
  };
}

function sourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory()
      ? sourceFiles(path)
      : /\.[cm]?[jt]sx?$/.test(entry.name)
        ? [path]
        : [];
  });
}

describe("P5-01 ComponentDefinitionV2 and commerce binding platform", () => {
  it("validates a generic product component bound to a watch with one option group", () => {
    const product = productPresentationContextSchema.parse(watchProduct);
    const registry = createComponentRegistryV2([genericProductComponent()]);
    const instance = registry.validateInstance(validInstance());

    expect(product.productTypeId).toBe("watch");
    expect(product.optionGroups.map((group) => group.id)).toEqual(["colour"]);
    expect(instance.bindings).toEqual([
      expect.objectContaining({
        source: "product",
        productId: "product_watch",
        revision: "catalogue-rev-1",
      }),
    ]);
  });

  it("validates the same generic contracts for a ring with multiple option groups", () => {
    const product = productPresentationContextSchema.parse(ringProduct);
    const registry = createComponentRegistryV2([genericProductComponent()]);
    const instance = registry.validateInstance(
      validInstance({
        bindings: [
          {
            slotId: "primaryProduct",
            source: "product",
            productId: "product_ring",
            revision: "catalogue-rev-2",
          },
        ],
      }),
    );

    expect(product.productTypeId).toBe("ring");
    expect(product.optionGroups).toHaveLength(6);
    expect(product.optionGroups.map((group) => group.id)).toEqual([
      "ring_size",
      "metal_colour",
      "karat",
      "stone",
      "quality",
      "engraving",
    ]);
    expect(instance.component).toBe("dynamicProductSummary");
  });

  it("keeps product identity, SKU, price and availability outside editable bindings", () => {
    expect(() =>
      productBindingSchema.parse({
        slotId: "primaryProduct",
        source: "product",
        productId: "product_watch",
        sku: "COPIED-SKU",
        price: { amount: 1, currency: "EUR" },
        availability: { en: "Invented" },
      }),
    ).toThrow();

    expect(() =>
      validateComponentDefinitionV2(
        genericProductComponent({
          editablePresentationFields: [
            {
              path: "bindings.product.price",
              label: localized("Price"),
              source: "props",
              control: "text",
              localized: false,
            },
          ],
        }),
      ),
    ).toThrow(/Protected commerce fields cannot be declared editable/i);
  });

  it("rejects unknown component types and unsupported variants", () => {
    const registry = createComponentRegistryV2([genericProductComponent()]);

    expect(() =>
      registry.validateInstance(validInstance({ component: "unknownCommerceBlock" })),
    ).toThrow(/Unknown ComponentDefinitionV2 type/i);
    expect(() => registry.validateInstance(validInstance({ variant: "immersive" }))).toThrow(
      /Unsupported dynamicProductSummary variant/i,
    );
  });

  it("rejects invalid commerce bindings and undeclared slots", () => {
    const registry = createComponentRegistryV2([genericProductComponent()]);

    expect(() =>
      registry.validateInstance(
        validInstance({
          bindings: [
            {
              slotId: "primaryProduct",
              source: "collection",
              collectionId: "collection_watches",
              revision: "catalogue-rev-1",
            },
          ],
        }),
      ),
    ).toThrow(/does not accept collection/i);

    expect(() =>
      registry.validateInstance(
        validInstance({
          bindings: [
            {
              slotId: "copiedProductTruth",
              source: "product",
              productId: "product_watch",
            },
          ],
        }),
      ),
    ).toThrow(/Invalid commerce binding slot/i);
  });

  it("rejects definitions missing responsive or accessibility requirements", () => {
    expect(() =>
      validateComponentDefinitionV2(genericProductComponent({ responsiveRules: [] })),
    ).toThrow();

    const withoutAccessibility: Partial<ComponentDefinitionV2> = genericProductComponent();
    delete withoutAccessibility.accessibilityRequirements;
    expect(() => validateComponentDefinitionV2(withoutAccessibility)).toThrow();
  });

  it("retains asset roles and provenance for merchant, source, product and generated assets", () => {
    const assets = [
      { role: "logo", kind: "merchantProvided" },
      { role: "heroDesktop", kind: "sourceDiscovered" },
      { role: "productMainImage", kind: "canonicalProductMedia" },
      { role: "editorialImage", kind: "generated" },
      { role: "iconDecorative", kind: "preset", decorative: true },
    ].map((asset, index) =>
      storefrontAssetMetadataSchema.parse({
        assetId: `asset_${index}`,
        role: asset.role,
        alt: asset.decorative ? undefined : localized(`${asset.role} alt`),
        decorative: asset.decorative ?? false,
        provenance: {
          kind: asset.kind,
          sourceId: `source_${index}`,
          sourceUrl:
            asset.kind === "sourceDiscovered" ? "https://example.com/source-image.jpg" : undefined,
          capturedAt: asset.kind === "sourceDiscovered" ? "2026-07-22T09:00:00.000Z" : undefined,
        },
        approved: true,
        usageRights: asset.kind === "generated" ? "generated" : "merchantOwned",
        responsiveCrops: [
          {
            cropId: `crop_${index}`,
            breakpoint: "desktop",
            aspectRatio: "16:9",
            focalPoint: { x: 0.5, y: 0.5 },
          },
        ],
      }),
    );

    expect(assets.map((asset) => [asset.role, asset.provenance.kind])).toEqual([
      ["logo", "merchantProvided"],
      ["heroDesktop", "sourceDiscovered"],
      ["productMainImage", "canonicalProductMedia"],
      ["editorialImage", "generated"],
      ["iconDecorative", "preset"],
    ]);
  });

  it("validates stable component versions and migration contracts", () => {
    const registry = createComponentRegistryV2([genericProductComponent()]);
    const migration = registry.migrationFor("dynamicProductSummary", {
      major: 1,
      minor: 0,
      patch: 0,
    });

    expect(migration?.migrationId).toBe("dynamicProductSummaryV1ToV2");
    expect(() =>
      validateComponentDefinitionV2(
        genericProductComponent({ version: { major: 0, minor: 0, patch: 0 } }),
      ),
    ).toThrow();
  });

  it("adapts existing V1 registry definitions for inspection without migrating renderers", () => {
    const adaptedHero = adaptV1ComponentDefinitionToV2(veskifyComponentRegistry.hero);
    const adaptedRegistry = adaptV1ComponentRegistryToV2(veskifyComponentRegistry);

    expect(adaptedHero.type).toBe("hero");
    expect(adaptedHero.version).toEqual({ major: 1, minor: 0, patch: 0 });
    expect(adaptedHero.renderer).toEqual({
      adapterId: "veskifyV1Registry",
      exportName: "hero",
      supportedTargets: ["editor", "preview", "published"],
    });
    expect(adaptedRegistry.map((definition) => definition.type)).toContain("productInfo");
  });

  it("keeps canonical domain modules independent of React, Puck and provider imports", () => {
    const root = process.cwd();
    const forbidden = [
      /from ["']react["']/,
      /from ["']@puckeditor\/core["']/,
      /from ["']@\/integrations\/puck/,
      /from ["']openai["']/,
      /from ["']@\/integrations\/ai/,
    ];
    const offending = sourceFiles(join(root, "src/domain")).flatMap((path) => {
      const text = readFileSync(path, "utf8");
      return forbidden.some((pattern) => pattern.test(text))
        ? [relative(root, path).split("\\").join("/")]
        : [];
    });

    expect(offending).toEqual([]);
  });
});
