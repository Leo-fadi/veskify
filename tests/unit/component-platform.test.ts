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
    contentSchema: {
      type: "object",
      properties: {
        heading: {
          type: "object",
          properties: {
            en: { type: "string", minLength: 1 },
            fi: { type: "string", minLength: 1 },
          },
          additionalProperties: false,
          anyOf: [{ required: ["en"] }, { required: ["fi"] }],
        },
        supportingCopy: {
          type: "object",
          properties: {
            en: { type: "string", minLength: 1 },
            fi: { type: "string", minLength: 1 },
          },
          additionalProperties: false,
          anyOf: [{ required: ["en"] }, { required: ["fi"] }],
        },
      },
      required: ["heading"],
      additionalProperties: false,
    },
    propsSchema: {
      type: "object",
      properties: { selectorStyle: { type: "string", enum: ["swatch", "buttons"] } },
      required: ["selectorStyle"],
      additionalProperties: false,
    },
    styleOverridesSchema: {
      type: "object",
      properties: { density: { type: "string", enum: ["compact", "standard"] } },
      required: [],
      additionalProperties: false,
    },
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
      {
        path: "styleOverrides.density",
        label: localized("Density"),
        source: "styleOverrides",
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
    {
      ...optionGroup("karat", "Karat", ["14k", "18k"]),
      dependsOn: [
        {
          groupId: "metal_colour",
          valueIds: ["metal_colour_yellowgold", "metal_colour_whitegold"],
        },
      ],
    },
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
      textEntryConstraints: {
        maxLength: 20,
        minLength: 2,
        characterPolicy: "lettersNumbersAndSpaces",
        placeholder: localized("Initials or short message"),
      },
      helpText: localized("Optional engraving, up to the canonical configured limit."),
    },
  ],
  selectedValues: [
    { groupId: "ring_size", valueId: "ring_size_16", complete: true },
    { groupId: "metal_colour", valueId: "metal_colour_yellowgold", complete: true },
    { groupId: "engraving", enteredText: "Leo 2026", complete: true },
  ],
  unavailableCombinations: [
    {
      selections: [
        { groupId: "metal_colour", valueId: "metal_colour_whitegold" },
        { groupId: "karat", valueId: "karat_14k" },
      ],
      reason: localized("This metal and karat combination is not available."),
    },
  ],
  relatedProductIds: ["product_ring_wedding"],
  revision: "catalogue-rev-2",
};

const watchesCollection = {
  collectionId: "collection_watches",
  title: localized("Watches"),
  description: localized("Canonical watch collection."),
  assets: [{ assetId: "asset_collection_watches", role: "hero" as const }],
  productIds: ["product_watch"],
  filters: [],
  sorting: [{ id: "featured", label: localized("Featured"), default: true }],
  emptyState: { title: localized("No watches") },
  revision: "collection-rev-1",
};

function assetMetadata(
  assetId: string,
  role: "productMainImage" | "editorialImage",
  approvalStatus: "pending" | "approved" | "rejected" = "approved",
) {
  return {
    assetId,
    role,
    alt: localized(`${role} alt`),
    decorative: false,
    provenance: {
      kind: "merchantProvided" as const,
      sourceId: `source_${assetId}`,
    },
    approvalStatus,
    usageRights: "merchantOwned" as const,
    responsiveCrops: [],
    revision: "asset-rev-1",
  };
}

function projectionContext() {
  return {
    products: [watchProduct, ringProduct],
    collections: [watchesCollection],
    assets: [assetMetadata("asset_watch_main", "productMainImage")],
    navigation: [{ navigationId: "navigation_main", revision: "navigation-rev-1" }],
    projectBrandContexts: [
      {
        projectId: "project_aurum",
        brandSystemRefs: ["brand_aurum"],
        revision: "brand-rev-1",
      },
    ],
    localizedContents: [
      { contentId: "content_shipping", locales: ["en", "fi"] as const, revision: "copy-rev-1" },
    ],
    productListRevision: "product-list-rev-1",
    collectionListRevision: "collection-list-rev-1",
  };
}

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
    content: {
      heading: localized("Product details"),
      supportingCopy: localized("Chosen details stay editable."),
    },
    props: { selectorStyle: "swatch" },
    styleOverrides: {},
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

  it("enforces required content and rejects unknown props through serializable schemas", () => {
    const registry = createComponentRegistryV2([genericProductComponent()]);

    expect(() =>
      registry.validateInstance(
        validInstance({ content: { supportingCopy: localized("Missing heading") } }),
      ),
    ).toThrow(/Invalid component content/i);
    expect(() =>
      registry.validateInstance(
        validInstance({ props: { selectorStyle: "swatch", arbitraryCss: "display: none" } }),
      ),
    ).toThrow(/Invalid component props/i);
  });

  it("rejects selected values that do not resolve inside their canonical option group", () => {
    const invalid = structuredClone(watchProduct);
    invalid.selectedValues[0] = {
      groupId: "colour",
      valueId: "colour_blue",
      complete: true,
    };

    expect(() => productPresentationContextSchema.parse(invalid)).toThrow(
      /Selected value must resolve within its canonical option group/i,
    );
  });

  it("blocks leading, internal and trailing protected-path wildcards per segment", () => {
    expect(() =>
      validateComponentDefinitionV2(
        genericProductComponent({
          protectedFields: { readOnlyPaths: ["*.density"] },
        }),
      ),
    ).toThrow(/Protected commerce fields cannot be declared editable/i);
    expect(() =>
      validateComponentDefinitionV2(
        genericProductComponent({
          protectedFields: { readOnlyPaths: ["styleOverrides.*"] },
        }),
      ),
    ).toThrow(/Protected commerce fields cannot be declared editable/i);
    expect(() =>
      validateComponentDefinitionV2(
        genericProductComponent({
          styleOverridesSchema: {
            type: "object",
            properties: {
              catalogue: {
                type: "object",
                properties: {
                  products: {
                    type: "object",
                    properties: {
                      default: {
                        type: "object",
                        properties: { price: { type: "string" } },
                        required: ["price"],
                        additionalProperties: false,
                      },
                    },
                    required: ["default"],
                    additionalProperties: false,
                  },
                },
                required: ["products"],
                additionalProperties: false,
              },
            },
            required: ["catalogue"],
            additionalProperties: false,
          },
          editablePresentationFields: [
            {
              path: "catalogue.products.default.price",
              label: localized("Price"),
              source: "styleOverrides",
              control: "text",
              localized: false,
            },
          ],
          protectedFields: { readOnlyPaths: ["catalogue.products.*.price"] },
        }),
      ),
    ).toThrow(/Protected commerce fields cannot be declared editable/i);
  });

  it("requires unique editor, preview and published renderer targets", () => {
    expect(() =>
      validateComponentDefinitionV2(
        genericProductComponent({
          renderer: {
            adapterId: "veskifyCommerceRenderer",
            exportName: "DynamicProductSummary",
            supportedTargets: ["editor", "preview"],
          },
        }),
      ),
    ).toThrow();
    expect(() =>
      validateComponentDefinitionV2(
        genericProductComponent({
          renderer: {
            adapterId: "veskifyCommerceRenderer",
            exportName: "DynamicProductSummary",
            supportedTargets: ["editor", "editor", "published"],
          },
        }),
      ),
    ).toThrow(/Renderer targets must be unique/i);
  });

  it("requires complete deterministic migrations for every migration policy", () => {
    expect(() =>
      validateComponentDefinitionV2(
        genericProductComponent({
          migration: {
            policy: "migrationRequired",
            previousVersions: [{ major: 1, minor: 0, patch: 0 }],
            migrations: [],
          },
        }),
      ),
    ).toThrow(/Every previous version requires one deterministic migration/i);
    expect(() =>
      validateComponentDefinitionV2(
        genericProductComponent({
          migration: {
            policy: "stable",
            previousVersions: [{ major: 1, minor: 0, patch: 0 }],
            migrations: [],
          },
        }),
      ),
    ).toThrow(/Stable components cannot declare previous versions/i);
    expect(() =>
      validateComponentDefinitionV2(
        genericProductComponent({
          migration: {
            policy: "manualReplacement",
            previousVersions: [{ major: 1, minor: 0, patch: 0 }],
            migrations: [
              {
                fromVersion: { major: 1, minor: 0, patch: 0 },
                toVersion: componentVersion,
                strategy: "identity",
              },
            ],
          },
        }),
      ),
    ).toThrow(/manualReplacement policy requires manual replacement steps/i);
  });

  it("validates declared style overrides and rejects undeclared overrides", () => {
    const registry = createComponentRegistryV2([genericProductComponent()]);

    expect(
      registry.validateInstance(validInstance({ styleOverrides: { density: "compact" } }))
        .styleOverrides,
    ).toEqual({ density: "compact" });
    expect(() =>
      registry.validateInstance(validInstance({ styleOverrides: { arbitraryCss: "color: red" } })),
    ).toThrow(/Invalid component styleOverrides/i);
  });

  it("keeps productList and collectionList bindings canonical and read-only", () => {
    const definition = genericProductComponent({
      commerceBindingSlots: [
        {
          id: "productResults",
          title: localized("Products"),
          acceptedSourceTypes: ["productList"],
          required: true,
          revisionRequired: true,
          emptyState: "message",
        },
        {
          id: "collectionResults",
          title: localized("Collections"),
          acceptedSourceTypes: ["collectionList"],
          required: true,
          revisionRequired: true,
          emptyState: "message",
        },
      ],
    });
    const registry = createComponentRegistryV2([definition]);
    const listInstance = validInstance({
      bindings: [
        {
          slotId: "productResults",
          source: "productList",
          productIds: ["product_watch", "product_ring"],
          revision: "product-list-rev-1",
        },
        {
          slotId: "collectionResults",
          source: "collectionList",
          collectionIds: ["collection_watches"],
          revision: "collection-list-rev-1",
        },
      ],
    });

    expect(
      registry.validateInstanceConformance(listInstance, projectionContext()).bindings,
    ).toHaveLength(2);
    expect(() =>
      registry.validateInstance({
        ...listInstance,
        bindings: [
          {
            slotId: "productResults",
            source: "productList",
            productIds: ["product_watch"],
            products: [{ productId: "product_watch", price: 1 }],
            revision: "product-list-rev-1",
          },
        ],
      }),
    ).toThrow();
  });

  it("validates engraving length, character policy and dedicated entered-text state", () => {
    expect(productPresentationContextSchema.parse(ringProduct).selectedValues).toContainEqual({
      groupId: "engraving",
      enteredText: "Leo 2026",
      complete: true,
    });

    const tooLong = structuredClone(ringProduct);
    tooLong.selectedValues[2] = {
      groupId: "engraving",
      enteredText: "This engraving is far too long",
      complete: true,
    };
    expect(() => productPresentationContextSchema.parse(tooLong)).toThrow(/maximum length/i);

    const invalidCharacters = structuredClone(ringProduct);
    invalidCharacters.selectedValues[2] = {
      groupId: "engraving",
      enteredText: "Leo 💍",
      complete: true,
    };
    expect(() => productPresentationContextSchema.parse(invalidCharacters)).toThrow(
      /character policy/i,
    );
  });

  it("rejects invalid dependency references, values, self-dependencies and cycles", () => {
    const unknownGroup = structuredClone(ringProduct);
    unknownGroup.optionGroups[2].dependsOn = [{ groupId: "unknown_group" }];
    expect(() => productPresentationContextSchema.parse(unknownGroup)).toThrow(
      /dependencies must reference an existing group/i,
    );

    const unknownValue = structuredClone(ringProduct);
    unknownValue.optionGroups[2].dependsOn = [
      { groupId: "metal_colour", valueIds: ["metal_colour_platinum"] },
    ];
    expect(() => productPresentationContextSchema.parse(unknownValue)).toThrow(
      /Dependency values must resolve/i,
    );

    const cycle = structuredClone(ringProduct);
    cycle.optionGroups[0].dependsOn = [{ groupId: "karat" }];
    cycle.optionGroups[2].dependsOn = [{ groupId: "ring_size" }];
    expect(() => productPresentationContextSchema.parse(cycle)).toThrow(/dependency cycles/i);
  });

  it("rejects unavailable combinations with unknown group or value references", () => {
    const unknownGroup = structuredClone(ringProduct);
    unknownGroup.unavailableCombinations[0].selections[0] = {
      groupId: "unknown_group",
      valueId: "unknown_value",
    };
    expect(() => productPresentationContextSchema.parse(unknownGroup)).toThrow(
      /Unavailable combinations must reference canonical enumerated values/i,
    );

    const unknownValue = structuredClone(ringProduct);
    unknownValue.unavailableCombinations[0].selections[0].valueId = "metal_colour_platinum";
    expect(() => productPresentationContextSchema.parse(unknownValue)).toThrow(
      /Unavailable combinations must reference canonical enumerated values/i,
    );
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

  it("resolves binding IDs and required revisions against the supplied projection", () => {
    const registry = createComponentRegistryV2([genericProductComponent()]);

    expect(
      registry.validateInstanceConformance(validInstance(), projectionContext()).bindings[0],
    ).toEqual(expect.objectContaining({ productId: "product_watch" }));
    expect(() =>
      registry.validateInstanceConformance(
        validInstance({
          bindings: [
            {
              slotId: "primaryProduct",
              source: "product",
              productId: "product_missing",
              revision: "catalogue-rev-1",
            },
          ],
        }),
        projectionContext(),
      ),
    ).toThrow(/Unknown product binding target/i);
    expect(() =>
      registry.validateInstanceConformance(
        validInstance({
          bindings: [
            {
              slotId: "primaryProduct",
              source: "product",
              productId: "product_watch",
              revision: "stale-revision",
            },
          ],
        }),
        projectionContext(),
      ),
    ).toThrow(/revision must match/i);
  });

  it("rejects missing product-list and collection-list targets during conformance", () => {
    const definition = genericProductComponent({
      commerceBindingSlots: [
        {
          id: "productResults",
          title: localized("Products"),
          acceptedSourceTypes: ["productList"],
          required: true,
          revisionRequired: true,
          emptyState: "message",
        },
        {
          id: "collectionResults",
          title: localized("Collections"),
          acceptedSourceTypes: ["collectionList"],
          required: true,
          revisionRequired: true,
          emptyState: "message",
        },
      ],
    });
    const registry = createComponentRegistryV2([definition]);
    const baseBindings = [
      {
        slotId: "productResults",
        source: "productList",
        productIds: ["product_missing"],
        revision: "product-list-rev-1",
      },
      {
        slotId: "collectionResults",
        source: "collectionList",
        collectionIds: ["collection_watches"],
        revision: "collection-list-rev-1",
      },
    ];

    expect(() =>
      registry.validateInstanceConformance(
        validInstance({ bindings: baseBindings }),
        projectionContext(),
      ),
    ).toThrow(/Unknown product list binding target/i);
    expect(() =>
      registry.validateInstanceConformance(
        validInstance({
          bindings: [
            { ...baseBindings[0], productIds: ["product_watch"] },
            { ...baseBindings[1], collectionIds: ["collection_missing"] },
          ],
        }),
        projectionContext(),
      ),
    ).toThrow(/Unknown collection list binding target/i);
  });

  it("resolves asset assignments against approved metadata with matching roles", () => {
    const registry = createComponentRegistryV2([genericProductComponent()]);
    const assigned = validInstance({
      assetAssignments: [
        {
          slotId: "editorialMedia",
          assetId: "asset_watch_main",
          role: "productMainImage",
        },
      ],
    });

    expect(
      registry.validateInstanceConformance(assigned, projectionContext()).assetAssignments,
    ).toHaveLength(1);
    expect(() =>
      registry.validateInstanceConformance(
        validInstance({
          assetAssignments: [
            {
              slotId: "editorialMedia",
              assetId: "asset_missing",
              role: "productMainImage",
            },
          ],
        }),
        projectionContext(),
      ),
    ).toThrow(/missing from inventory/i);

    const unapprovedProjection = projectionContext();
    unapprovedProjection.assets = [
      assetMetadata("asset_watch_main", "productMainImage", "pending"),
    ];
    expect(() => registry.validateInstanceConformance(assigned, unapprovedProjection)).toThrow(
      /not approved/i,
    );

    const wrongRoleProjection = projectionContext();
    wrongRoleProjection.assets = [assetMetadata("asset_watch_main", "editorialImage")];
    expect(() => registry.validateInstanceConformance(assigned, wrongRoleProjection)).toThrow(
      /role does not match metadata/i,
    );
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
        approvalStatus: "approved",
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
