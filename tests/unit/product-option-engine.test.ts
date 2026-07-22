import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";
import {
  applyProductOptionIntent,
  initializeProductOptionEngine,
} from "@/application/product-presentation";
import type { ProductPresentationContext } from "@/domain/component-platform";
import type {
  CanonicalProductConfigurationResolver,
  ProductOptionResolutionOutcome,
  ProductOptionResolutionResult,
} from "@/domain/product-presentation";

function localized(en: string, fi = en) {
  return { en, fi };
}

function enumeratedGroup(
  id: string,
  values: string[],
  options: {
    required?: boolean;
    dependsOn?: Array<{ groupId: string; valueIds?: string[] }>;
    presentation?: "swatch" | "buttonGroup" | "dropdown";
  } = {},
) {
  return {
    id,
    label: localized(id),
    source: "variantDimension" as const,
    required: options.required ?? true,
    presentation: options.presentation ?? ("buttonGroup" as const),
    values: values.map((value) => ({
      id: `${id}_${value}`,
      label: localized(value),
      value,
      disabled: false,
      metadata: {},
    })),
    dependsOn: options.dependsOn ?? [],
  };
}

const watchContext: ProductPresentationContext = {
  productId: "product_watch",
  productTypeId: "watch",
  sku: "WATCH-001",
  title: localized("Field watch"),
  price: { amount: 349, currency: "EUR", formatted: localized("€349") },
  compareAtPrice: { amount: 399, currency: "EUR", formatted: localized("€399") },
  availability: localized("Choose a colour"),
  media: [
    {
      assetId: "asset_watch_silver",
      role: "variant",
      alt: localized("Silver watch"),
      variantIds: ["variant_watch_silver"],
    },
    {
      assetId: "asset_watch_black",
      role: "variant",
      alt: localized("Black watch"),
      variantIds: ["variant_watch_black"],
    },
  ],
  attributeGroups: [],
  optionGroups: [enumeratedGroup("colour", ["silver", "black"], { presentation: "swatch" })],
  selectedValues: [],
  unavailableCombinations: [],
  relatedProductIds: [],
  revision: "watch-revision-1",
};

const ringContext: ProductPresentationContext = {
  productId: "product_ring",
  productTypeId: "ring",
  sku: "RING-CONFIGURABLE",
  title: localized("Aurora ring"),
  price: { amount: 1290, currency: "EUR", formatted: localized("From €1,290") },
  availability: localized("Choose options"),
  media: [
    { assetId: "asset_ring_yellow", role: "variant", alt: localized("Yellow-gold ring") },
    { assetId: "asset_ring_white", role: "variant", alt: localized("White-gold ring") },
  ],
  attributeGroups: [],
  optionGroups: [
    enumeratedGroup("ring_size", ["16", "17"]),
    enumeratedGroup("metal", ["yellow", "white"]),
    enumeratedGroup("karat", ["14", "18"], {
      dependsOn: [{ groupId: "metal" }],
    }),
    enumeratedGroup("stone", ["diamond", "sapphire"], {
      dependsOn: [{ groupId: "karat", valueIds: ["karat_14", "karat_18"] }],
    }),
    enumeratedGroup("quality", ["si", "vs"], {
      dependsOn: [{ groupId: "stone", valueIds: ["stone_diamond", "stone_sapphire"] }],
    }),
    {
      id: "engraving",
      label: localized("Engraving"),
      source: "orderOption",
      required: false,
      presentation: "textInput",
      values: [],
      dependsOn: [],
      textEntryConstraints: {
        minLength: 2,
        maxLength: 12,
        characterPolicy: "lettersNumbersAndSpaces",
        placeholder: localized("Initials"),
      },
    },
  ],
  selectedValues: [],
  unavailableCombinations: [
    {
      selections: [
        { groupId: "metal", valueId: "metal_white" },
        { groupId: "karat", valueId: "karat_14" },
      ],
      reason: localized("White gold is available only in 18 karat."),
    },
  ],
  relatedProductIds: [],
  revision: "ring-revision-1",
};

const zeroOptionContext: ProductPresentationContext = {
  productId: "product_simple",
  productTypeId: "gift_card",
  sku: "GIFT-100",
  title: localized("Gift card"),
  price: { amount: 100, currency: "EUR", formatted: localized("€100") },
  availability: localized("Available"),
  media: [{ assetId: "asset_gift_card", role: "main", alt: localized("Gift card") }],
  attributeGroups: [],
  optionGroups: [],
  selectedValues: [],
  unavailableCombinations: [],
  relatedProductIds: [],
  revision: "simple-revision-1",
};

const canonicalResolver: CanonicalProductConfigurationResolver = {
  resolve(input) {
    expect(Object.isFrozen(input)).toBe(true);
    const values = new Map(
      input.selectedValues.map((selection) => [selection.groupId, selection.valueId]),
    );
    if (input.productId === "product_watch") {
      const colour = values.get("colour");
      if (!colour) return { purchasable: false };
      const black = colour === "colour_black";
      return {
        resolvedConfiguration: {
          kind: "variant",
          variantId: black ? "variant_watch_black" : "variant_watch_silver",
        },
        purchasable: true,
        price: { amount: black ? 359 : 349, currency: "EUR" },
        compareAtPrice: { amount: black ? 419 : 399, currency: "EUR" },
        availability: localized(black ? "Low stock" : "In stock"),
        mediaAssetIds: [black ? "asset_watch_black" : "asset_watch_silver"],
      };
    }
    if (input.productId === "product_ring") {
      const required = ["ring_size", "metal", "karat", "stone", "quality"];
      const complete = required.every((groupId) => values.has(groupId));
      if (!complete) return { purchasable: false };
      const white = values.get("metal") === "metal_white";
      const premium = values.get("karat") === "karat_18";
      return {
        resolvedConfiguration: { kind: "variant", variantId: "variant_ring_selected" },
        purchasable: true,
        price: { amount: premium ? 1590 : 1390, currency: "EUR" },
        availability: localized("Made to order"),
        mediaAssetIds: [white ? "asset_ring_white" : "asset_ring_yellow"],
      };
    }
    return {
      resolvedConfiguration: { kind: "baseProduct" },
      purchasable: true,
      price: { amount: 100, currency: "EUR" },
      availability: localized("Available"),
      mediaAssetIds: ["asset_gift_card"],
    };
  },
};

function success(outcome: ProductOptionResolutionOutcome): ProductOptionResolutionResult {
  if (!outcome.ok) throw new Error(`${outcome.error.code}: ${outcome.error.message}`);
  return outcome.result;
}

function initialize(
  context: ProductPresentationContext = ringContext,
  resolver: CanonicalProductConfigurationResolver = canonicalResolver,
) {
  return success(initializeProductOptionEngine(context, resolver));
}

function apply(
  context: ProductPresentationContext,
  previousResult: ProductOptionResolutionResult,
  intent: unknown,
  resolver: CanonicalProductConfigurationResolver = canonicalResolver,
) {
  return applyProductOptionIntent({ context, previousResult, intent, resolver });
}

function choose(
  context: ProductPresentationContext,
  previous: ProductOptionResolutionResult,
  groupId: string,
  valueId: string,
) {
  return success(apply(context, previous, { type: "selectEnumeratedValue", groupId, valueId }));
}

function completeRing(context: ProductPresentationContext = ringContext) {
  let result = initialize(context);
  result = choose(context, result, "ring_size", "ring_size_16");
  result = choose(context, result, "metal", "metal_yellow");
  result = choose(context, result, "karat", "karat_18");
  result = choose(context, result, "stone", "stone_diamond");
  return choose(context, result, "quality", "quality_vs");
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

describe("P6-01 dynamic product-option resolution engine", () => {
  it("resolves a watch colour selection through the canonical resolver", () => {
    const initial = initialize(watchContext);
    expect(initial.incompleteRequiredGroupIds).toEqual(["colour"]);
    expect(initial.canAddToCart).toBe(false);

    const selected = choose(watchContext, initial, "colour", "colour_silver");
    expect(selected.selectedValues).toEqual([{ groupId: "colour", valueId: "colour_silver" }]);
    expect(selected.resolvedConfiguration).toEqual({
      kind: "variant",
      variantId: "variant_watch_silver",
    });
    expect(selected.canAddToCart).toBe(true);
  });

  it("resolves complex ring selections only in canonical dependency order", () => {
    const initial = initialize();
    const earlyKarat = apply(ringContext, initial, {
      type: "selectEnumeratedValue",
      groupId: "karat",
      valueId: "karat_18",
    });
    expect(earlyKarat).toMatchObject({ ok: false, error: { code: "DEPENDENCY_UNSATISFIED" } });

    const complete = completeRing();
    expect(complete.selectedValues.map((selection) => selection.groupId)).toEqual([
      "ring_size",
      "metal",
      "karat",
      "stone",
      "quality",
    ]);
    expect(complete.incompleteRequiredGroupIds).toEqual([]);
    expect(complete.canAddToCart).toBe(true);
  });

  it("disables values that would complete an unavailable combination", () => {
    let result = initialize();
    result = choose(ringContext, result, "metal", "metal_white");
    expect(result.disabledOptionValues).toContainEqual({
      groupId: "karat",
      valueId: "karat_14",
      reasons: ["unavailableCombination"],
    });

    const rejected = apply(ringContext, result, {
      type: "selectEnumeratedValue",
      groupId: "karat",
      valueId: "karat_14",
    });
    expect(rejected).toMatchObject({ ok: false, error: { code: "OPTION_DISABLED" } });
    expect(rejected.result).toBe(result);
  });

  it("rejects unknown group and value IDs without changing the valid result", () => {
    const previous = initialize(watchContext);
    const unknownGroup = apply(watchContext, previous, {
      type: "selectEnumeratedValue",
      groupId: "movement",
      valueId: "movement_auto",
    });
    expect(unknownGroup).toMatchObject({ ok: false, error: { code: "UNKNOWN_GROUP" } });
    expect(unknownGroup.result).toBe(previous);

    const unknownValue = apply(watchContext, previous, {
      type: "selectEnumeratedValue",
      groupId: "colour",
      valueId: "colour_blue",
    });
    expect(unknownValue).toMatchObject({ ok: false, error: { code: "UNKNOWN_VALUE" } });
    expect(unknownValue.result).toBe(previous);
  });

  it("keeps Add to cart disabled until every required group is complete", () => {
    let result = initialize();
    expect(result.incompleteRequiredGroupIds).toEqual([
      "ring_size",
      "metal",
      "karat",
      "stone",
      "quality",
    ]);
    result = choose(ringContext, result, "ring_size", "ring_size_16");
    result = choose(ringContext, result, "metal", "metal_yellow");
    expect(result.incompleteRequiredGroupIds).toEqual(["karat", "stone", "quality"]);
    expect(result.canAddToCart).toBe(false);
  });

  it("allows optional selections and engraving to remain empty", () => {
    const complete = completeRing();
    expect(complete.textEntryValues).toEqual([]);
    expect(complete.incompleteRequiredGroupIds).not.toContain("engraving");
    expect(complete.canAddToCart).toBe(true);
  });

  it("clears text options and resets all selections through typed intents", () => {
    const complete = completeRing();
    const engraved = success(
      apply(ringContext, complete, {
        type: "enterTextOption",
        groupId: "engraving",
        value: "Leo 26",
      }),
    );
    expect(engraved.textEntryValues).toHaveLength(1);

    const cleared = success(
      apply(ringContext, engraved, { type: "clearTextOption", groupId: "engraving" }),
    );
    expect(cleared.textEntryValues).toEqual([]);
    expect(cleared.canAddToCart).toBe(true);

    const reset = success(apply(ringContext, cleared, { type: "resetSelections" }));
    expect(reset.selectedValues).toEqual([]);
    expect(reset.incompleteRequiredGroupIds).toEqual([
      "ring_size",
      "metal",
      "karat",
      "stone",
      "quality",
    ]);
    expect(reset.canAddToCart).toBe(false);
  });

  it("enforces engraving length and named character constraints", () => {
    const complete = completeRing();
    const partial = success(
      apply(ringContext, complete, {
        type: "enterTextOption",
        groupId: "engraving",
        value: "L",
      }),
    );
    expect(partial.textEntryValues[0]).toMatchObject({ valid: false });
    expect(partial.validationWarnings).toEqual([
      expect.objectContaining({ code: "textEntryIncomplete", groupId: "engraving" }),
    ]);
    expect(partial.canAddToCart).toBe(false);

    for (const invalidValue of ["This is too long", "Leo 💍"]) {
      const rejected = apply(ringContext, complete, {
        type: "enterTextOption",
        groupId: "engraving",
        value: invalidValue,
      });
      expect(rejected).toMatchObject({
        ok: false,
        error: { code: "TEXT_CONSTRAINT_VIOLATION" },
      });
      expect(rejected.result).toBe(complete);
    }
  });

  it("clearing an optional prerequisite removes dependent selections deterministically", () => {
    const context = structuredClone(ringContext);
    const stone = context.optionGroups.find((group) => group.id === "stone");
    const quality = context.optionGroups.find((group) => group.id === "quality");
    if (!stone || !quality) throw new Error("Ring fixture is incomplete.");
    stone.required = false;
    quality.required = false;

    let result = initialize(context);
    result = choose(context, result, "metal", "metal_yellow");
    result = choose(context, result, "karat", "karat_18");
    result = choose(context, result, "stone", "stone_diamond");
    result = choose(context, result, "quality", "quality_vs");
    const cleared = success(
      apply(context, result, { type: "clearOptionalSelection", groupId: "stone" }),
    );

    expect(cleared.selectedValues.map((selection) => selection.groupId)).not.toContain("stone");
    expect(cleared.selectedValues.map((selection) => selection.groupId)).not.toContain("quality");
    expect(cleared.validationWarnings).toContainEqual(
      expect.objectContaining({ code: "dependentSelectionCleared", groupId: "quality" }),
    );
  });

  it("uses canonical configuration price, availability and media presentation", () => {
    const initial = initialize(watchContext);
    const black = choose(watchContext, initial, "colour", "colour_black");

    expect(black.displayedPrice).toEqual({ amount: 359, currency: "EUR" });
    expect(black.displayedCompareAtPrice).toEqual({ amount: 419, currency: "EUR" });
    expect(black.displayedAvailability).toEqual(localized("Low stock"));
    expect(black.selectedMediaReferences.map((media) => media.assetId)).toEqual([
      "asset_watch_black",
    ]);
  });

  it("never mutates canonical product truth while applying intents", () => {
    const original = structuredClone(ringContext);
    const result = completeRing();
    success(
      apply(ringContext, result, {
        type: "enterTextOption",
        groupId: "engraving",
        value: "Leo 26",
      }),
    );

    expect(ringContext).toEqual(original);
    expect(ringContext.price).toEqual(original.price);
    expect(ringContext.sku).toBe(original.sku);
    expect(ringContext.optionGroups).toEqual(original.optionGroups);
    expect(ringContext.media).toEqual(original.media);
  });

  it("resolves zero-option products as purchasable when canonically available", () => {
    const result = initialize(zeroOptionContext);
    expect(result.incompleteRequiredGroupIds).toEqual([]);
    expect(result.resolvedConfiguration).toEqual({ kind: "baseProduct" });
    expect(result.displayedPrice).toEqual({ amount: 100, currency: "EUR" });
    expect(result.canAddToCart).toBe(true);
  });

  it("produces identical immutable results for the same context and intent sequence", () => {
    const run = () => {
      let result = initialize(watchContext);
      result = choose(watchContext, result, "colour", "colour_black");
      return result;
    };
    const first = run();
    const second = run();

    expect(second).toEqual(first);
    expect(Object.isFrozen(first)).toBe(true);
    expect(Object.isFrozen(first.selectedValues)).toBe(true);
    expect(Object.isFrozen(first.selectedMediaReferences[0])).toBe(true);
  });

  it("preserves the previous valid result for malformed intents and resolver failures", () => {
    const previous = initialize(watchContext);
    const malformed = apply(watchContext, previous, { type: "selectEnumeratedValue" });
    expect(malformed).toMatchObject({ ok: false, error: { code: "INVALID_INTENT" } });
    expect(malformed.result).toBe(previous);

    const failingResolver: CanonicalProductConfigurationResolver = {
      resolve() {
        throw new Error("adapter unavailable");
      },
    };
    const failed = applyProductOptionIntent({
      context: watchContext,
      previousResult: previous,
      intent: {
        type: "selectEnumeratedValue",
        groupId: "colour",
        valueId: "colour_silver",
      },
      resolver: failingResolver,
    });
    expect(failed).toMatchObject({ ok: false, error: { code: "RESOLVER_FAILURE" } });
    expect(failed.result).toBe(previous);
  });

  it("rejects cyclic or invalid dependency contexts safely", () => {
    const cyclic = structuredClone(ringContext);
    const metal = cyclic.optionGroups.find((group) => group.id === "metal");
    if (!metal) throw new Error("Ring fixture is incomplete.");
    metal.dependsOn = [{ groupId: "quality" }];

    const outcome = initializeProductOptionEngine(cyclic, canonicalResolver);
    expect(outcome).toMatchObject({ ok: false, error: { code: "INVALID_CONTEXT" }, result: null });
  });

  it("keeps product-presentation domain and application modules free of UI and adapters", () => {
    const root = process.cwd();
    const directories = [
      join(root, "src/domain/product-presentation"),
      join(root, "src/application/product-presentation"),
    ];
    const forbidden = [
      /from ["']react["']/,
      /from ["']@puckeditor\/core["']/,
      /from ["']@\/integrations\/puck/,
      /from ["']@\/integrations\/ai/,
      /from ["']@\/storage/,
      /from ["']@\/infrastructure/,
      /from ["']openai["']/,
    ];
    const offending = directories.flatMap((directory) =>
      sourceFiles(directory).flatMap((path) => {
        const text = readFileSync(path, "utf8");
        return forbidden.some((pattern) => pattern.test(text))
          ? [relative(root, path).split("\\").join("/")]
          : [];
      }),
    );

    expect(offending).toEqual([]);
  });
});
