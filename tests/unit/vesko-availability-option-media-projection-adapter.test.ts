import { describe, expect, it } from "vitest";

import {
  applyProductOptionIntent,
  initializeProductOptionEngine,
} from "@/application/product-presentation";
import { VeskoIntegrationError } from "@/application/vesko-integration";
import { aurumNordicSeed, karvonenSeed } from "@/data/seed";
import {
  createAvailabilityOptionMediaProjectionProvider,
  createAvailabilityOptionMediaResolver,
  createStandaloneAvailabilityOptionMediaProjectionAdapter,
  projectAvailabilityOptionMediaToProductPresentation,
  standaloneAvailabilityOptionMediaIdentity,
  type AvailabilityOptionMediaTransportProjection,
} from "@/integrations/vesko-availability-options-media/availability-option-media-projection-adapter";

const context = {
  tenantId: "tenant_demo",
  storeId: "store_demo",
  storefrontProjectId: "project_demo",
  productId: "product_ring",
  expectedRevision: "projection-revision-7",
};

function canonicalProjection(): AvailabilityOptionMediaTransportProjection {
  return {
    tenantId: context.tenantId,
    storeId: context.storeId,
    storefrontProjectId: context.storefrontProjectId,
    catalogueId: "catalogue_demo",
    catalogueRevision: "catalogue-revision-4",
    productId: context.productId,
    revision: context.expectedRevision,
    supportedLocales: ["en", "fi"],
    productAvailabilityId: "availability_product_ring",
    availability: [
      {
        availabilityId: "availability_variant_yellow",
        scope: "variant",
        variantId: "variant_yellow_16",
        status: "inStock",
        purchasable: true,
        stockDisplay: "show",
        expectedAvailabilityMessage: { en: "In stock", fi: "Varastossa" },
        revision: "availability-revision-2",
      },
      {
        availabilityId: "availability_product_ring",
        scope: "product",
        status: "inStock",
        purchasable: true,
        stockDisplay: "show",
        expectedAvailabilityMessage: { en: "Choose options", fi: "Valitse vaihtoehdot" },
        revision: "availability-revision-2",
      },
      {
        availabilityId: "availability_variant_white",
        scope: "variant",
        variantId: "variant_white_16",
        status: "lowStock",
        purchasable: true,
        stockDisplay: "limited",
        expectedAvailabilityMessage: { en: "Low stock", fi: "Vähän varastossa" },
        revision: "availability-revision-2",
      },
    ],
    attributes: [
      {
        attributeId: "attribute_width",
        label: { en: "Width", fi: "Leveys" },
        value: 2.2,
        displayOrder: 20,
        unit: { en: "mm", fi: "mm" },
        presentationRole: "technical",
      },
      {
        attributeId: "attribute_material",
        label: { en: "Material", fi: "Materiaali" },
        value: { en: "Gold", fi: "Kulta" },
        displayOrder: 10,
        presentationRole: "highlight",
      },
    ],
    optionGroups: [
      {
        id: "option_metal",
        label: { en: "Metal", fi: "Metalli" },
        source: "variantDimension",
        required: true,
        presentation: "swatch",
        values: [
          {
            id: "value_white",
            label: { en: "White gold", fi: "Valkokulta" },
            value: "white",
            swatch: { color: "#E8E8E8" },
            disabled: false,
            metadata: {},
          },
          {
            id: "value_yellow",
            label: { en: "Yellow gold", fi: "Keltakulta" },
            value: "yellow",
            swatch: { color: "#D4AF37" },
            disabled: false,
            metadata: {},
          },
        ],
        dependsOn: [],
      },
      {
        id: "option_size",
        label: { en: "Size", fi: "Koko" },
        source: "variantDimension",
        required: true,
        presentation: "buttonGroup",
        values: [
          {
            id: "value_size_16",
            label: { en: "16", fi: "16" },
            value: "16",
            disabled: false,
            metadata: {},
          },
        ],
        dependsOn: [{ groupId: "option_metal" }],
      },
      {
        id: "option_engraving",
        label: { en: "Engraving", fi: "Kaiverrus" },
        source: "orderOption",
        required: false,
        presentation: "textInput",
        values: [],
        dependsOn: [],
        textEntryConstraints: {
          minLength: 0,
          maxLength: 20,
          characterPolicy: "unicodeText",
        },
      },
    ],
    variants: [
      {
        variantId: "variant_white_16",
        sku: "RING-WHITE-16",
        optionValueIds: ["value_white", "value_size_16"],
        availabilityId: "availability_variant_white",
        price: { amount: 1390, currency: "EUR" },
        mediaIds: ["media_ring_white"],
        purchasable: true,
        revision: "variant-revision-3",
      },
      {
        variantId: "variant_yellow_16",
        sku: "RING-YELLOW-16",
        optionValueIds: ["value_yellow", "value_size_16"],
        availabilityId: "availability_variant_yellow",
        price: { amount: 1290, currency: "EUR" },
        mediaIds: ["media_ring_yellow"],
        purchasable: true,
        revision: "variant-revision-3",
      },
    ],
    media: [
      {
        assetId: "media_ring_main",
        productId: context.productId,
        role: "main",
        alt: { en: "Ring", fi: "Sormus" },
        decorative: false,
        revision: "media-revision-5",
      },
      {
        assetId: "media_ring_white",
        productId: context.productId,
        role: "variant",
        alt: { en: "White-gold ring", fi: "Valkokultainen sormus" },
        variantIds: ["variant_white_16"],
        decorative: false,
        revision: "media-revision-5",
      },
      {
        assetId: "media_ring_yellow",
        productId: context.productId,
        role: "variant",
        alt: { en: "Yellow-gold ring", fi: "Keltakultainen sormus" },
        variantIds: ["variant_yellow_16"],
        decorative: false,
        revision: "media-revision-5",
      },
      {
        assetId: "media_ring_editorial",
        productId: context.productId,
        role: "editorial",
        alt: { en: "Ring editorial", fi: "Sormuksen tunnelmakuva" },
        decorative: false,
        revision: "media-revision-5",
      },
    ],
  };
}

function provider(raw: unknown = canonicalProjection()) {
  return createAvailabilityOptionMediaProjectionProvider({
    transport: { load: () => raw },
  });
}

describe("P9-04 availability, options, variants and media projection adapter", () => {
  it("maps the complete read-only projection and preserves semantic source order", async () => {
    const source = canonicalProjection();
    const before = structuredClone(source);
    const loaded = await provider(source).load(context);

    expect(source).toEqual(before);
    expect(loaded.attributes.map((attribute) => attribute.attributeId)).toEqual([
      "attribute_width",
      "attribute_material",
    ]);
    expect(loaded.optionGroups.map((group) => group.id)).toEqual([
      "option_metal",
      "option_size",
      "option_engraving",
    ]);
    expect(loaded.optionGroups[0]?.values.map((value) => value.id)).toEqual([
      "value_white",
      "value_yellow",
    ]);
    expect(loaded.media.map((media) => media.assetId)).toEqual([
      "media_ring_main",
      "media_ring_white",
      "media_ring_yellow",
      "media_ring_editorial",
    ]);
    expect(loaded.variants.map((variant) => variant.variantId)).toEqual([
      "variant_white_16",
      "variant_yellow_16",
    ]);
    expect(loaded.fingerprint).toMatch(/^sha256:[a-f0-9]{64}$/);
    expect(Object.isFrozen(loaded)).toBe(true);
  });

  it("returns typed failures for broken option and dependency references", async () => {
    const brokenOption = canonicalProjection();
    brokenOption.variants[0].optionValueIds[0] = "value_missing";
    await expect(provider(brokenOption).load(context)).rejects.toMatchObject({
      code: "brokenOptionReference",
    });

    const brokenDependency = canonicalProjection();
    brokenDependency.optionGroups[1].dependsOn = [{ groupId: "option_missing" }];
    await expect(provider(brokenDependency).load(context)).rejects.toMatchObject({
      code: "brokenDependency",
    });
  });

  it("rejects option dependency cycles with a typed failure", async () => {
    const cycle = canonicalProjection();
    cycle.optionGroups[0].dependsOn = [{ groupId: "option_size" }];

    await expect(provider(cycle).load(context)).rejects.toMatchObject({
      code: "dependencyCycle",
    });
  });

  it("rejects duplicate variant combinations", async () => {
    const duplicate = canonicalProjection();
    duplicate.availability.push({
      ...duplicate.availability[0],
      availabilityId: "availability_variant_duplicate",
      variantId: "variant_duplicate_16",
    });
    duplicate.variants.push({
      ...duplicate.variants[0],
      variantId: "variant_duplicate_16",
      availabilityId: "availability_variant_duplicate",
      mediaIds: [],
    });

    await expect(provider(duplicate).load(context)).rejects.toMatchObject({
      code: "duplicateVariantCombination",
    });
  });

  it("rejects wrong-product and inconsistent variant media associations", async () => {
    const wrongProduct = canonicalProjection();
    wrongProduct.media[1].productId = "product_other";
    await expect(provider(wrongProduct).load(context)).rejects.toMatchObject({
      code: "brokenMediaReference",
    });

    const inconsistent = canonicalProjection();
    inconsistent.variants[0].mediaIds = ["media_ring_yellow"];
    await expect(provider(inconsistent).load(context)).rejects.toMatchObject({
      code: "brokenMediaReference",
    });
  });

  it("rejects stale, mixed-identity and unsupported-locale projections", async () => {
    await expect(
      provider().load({ ...context, expectedRevision: "projection-revision-older" }),
    ).rejects.toMatchObject({ code: "staleCatalogueProjection" });

    const mixed = canonicalProjection();
    mixed.storefrontProjectId = "project_other";
    await expect(provider(mixed).load(context)).rejects.toMatchObject({
      code: "projectMismatch",
    });

    const unsupported = structuredClone(canonicalProjection());
    Object.assign(unsupported.optionGroups[0].label, { sv: "Metall" });
    await expect(provider(unsupported).load(context)).rejects.toMatchObject({
      code: "unsupportedLocale",
    });
  });

  it("wraps transport and malformed-response failures without exposing raw errors", async () => {
    const unavailable = createAvailabilityOptionMediaProjectionProvider({
      transport: {
        load() {
          throw new Error("secret backend payload");
        },
      },
    });
    await expect(unavailable.load(context)).rejects.toEqual(
      new VeskoIntegrationError("availabilityUnavailable"),
    );
    await expect(provider({ tenantId: context.tenantId }).load(context)).rejects.toMatchObject({
      code: "malformedIntegrationResponse",
    });
  });

  it("keeps Aurum and Karvonen standalone projections deterministic and source-read-only", async () => {
    const aurumBefore = structuredClone(aurumNordicSeed.catalogue);
    const karvonenBefore = structuredClone(karvonenSeed.catalogue);
    const aurumProduct = aurumNordicSeed.catalogue.products.find(
      (product) => product.id === "product_aava_necklace_925",
    )!;
    const karvonenProduct = karvonenSeed.catalogue.products[0];
    const aurumAdapter = createStandaloneAvailabilityOptionMediaProjectionAdapter(
      aurumNordicSeed.catalogue,
    );
    const karvonenAdapter = createStandaloneAvailabilityOptionMediaProjectionAdapter(
      karvonenSeed.catalogue,
    );
    const aurumIdentity = standaloneAvailabilityOptionMediaIdentity(aurumNordicSeed.catalogue);
    const karvonenIdentity = standaloneAvailabilityOptionMediaIdentity(karvonenSeed.catalogue);

    const aurum = await aurumAdapter.load({ ...aurumIdentity, productId: aurumProduct.id });
    const aurumAgain = await aurumAdapter.load({ ...aurumIdentity, productId: aurumProduct.id });
    const karvonen = await karvonenAdapter.load({
      ...karvonenIdentity,
      productId: karvonenProduct.id,
    });

    expect(aurum.fingerprint).toBe(aurumAgain.fingerprint);
    expect(aurum.optionGroups[0]?.source).toBe("variantDimension");
    expect(aurum.variants.map((variant) => variant.variantId)).toEqual([
      "variant_aava_45",
      "variant_aava_50",
    ]);
    expect(karvonen.optionGroups.map((group) => group.label.fi)).toContain("Size");
    expect(karvonen.optionGroups.map((group) => group.label.fi)).not.toContain("Availability");
    expect(aurumNordicSeed.catalogue).toEqual(aurumBefore);
    expect(karvonenSeed.catalogue).toEqual(karvonenBefore);
  });

  it("feeds canonical option resolution and PDP presentation with variant-driven media", async () => {
    const projection = await provider().load(context);
    const product = {
      productId: context.productId,
      slug: "ring",
      title: { en: "Ring", fi: "Sormus" },
      productTypeId: "ring",
      sku: "RING-BASE",
      price: { amount: 1290, currency: "EUR" as const },
    };
    const pdp = projectAvailabilityOptionMediaToProductPresentation(projection, product);
    const resolver = createAvailabilityOptionMediaResolver(projection, product);
    const initialized = await initializeProductOptionEngine(pdp, resolver);
    if (!initialized.ok) throw new Error(initialized.error.message);
    const metal = await applyProductOptionIntent({
      context: pdp,
      previousResult: initialized.result,
      intent: {
        type: "selectEnumeratedValue",
        groupId: "option_metal",
        valueId: "value_white",
      },
      resolver,
    });
    if (!metal.ok) throw new Error(metal.error.message);
    const resolved = await applyProductOptionIntent({
      context: pdp,
      previousResult: metal.result,
      intent: {
        type: "selectEnumeratedValue",
        groupId: "option_size",
        valueId: "value_size_16",
      },
      resolver,
    });
    if (!resolved.ok) throw new Error(resolved.error.message);

    expect(resolved.result.resolvedConfiguration).toEqual({
      kind: "variant",
      variantId: "variant_white_16",
    });
    expect(resolved.result.displayedAvailability?.en).toBe("Low stock");
    expect(resolved.result.selectedMediaReferences.map((media) => media.assetId)).toEqual([
      "media_ring_white",
    ]);
    expect(pdp.optionGroups[2]?.textEntryConstraints?.maxLength).toBe(20);
  });
});
