import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { createDynamicProductDetailController } from "@/application/product-presentation";
import { IntegratedDynamicProductDetail } from "@/components/storefront/integrated-dynamic-product-detail";
import type { ProductPrimaryActionIntentCallback } from "@/components/storefront/dynamic-product-detail";
import type { ProductPresentationContext } from "@/domain/component-platform";
import type {
  CanonicalProductConfigurationInput,
  CanonicalProductConfigurationResolver,
} from "@/domain/product-presentation";
import {
  canonicalProductResolver,
  dynamicPdpRendererFixture,
  localized,
  ringProductFixture,
  unavailablePriceProductFixture,
  watchProductFixture,
  zeroOptionProductFixture,
} from "../fixtures/dynamic-pdp-product-fixtures";

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

function renderIntegrated(
  product: ProductPresentationContext,
  options: {
    resolver?: CanonicalProductConfigurationResolver;
  } = {},
) {
  const renderer = dynamicPdpRendererFixture(product);
  const onPrimaryAction = vi.fn<ProductPrimaryActionIntentCallback>();
  render(
    <IntegratedDynamicProductDetail
      activeLocale="en"
      instance={renderer.instance}
      onPrimaryAction={onPrimaryAction}
      primaryLocale="en"
      productContext={product}
      projection={renderer.projection}
      resolveAssetUrl={(assetId) => `/seed-assets/${assetId}.svg`}
      resolver={options.resolver ?? canonicalProductResolver}
      target="preview"
    />,
  );
  return { onPrimaryAction };
}

async function waitForProduct(title: string) {
  await screen.findByRole("heading", { level: 1, name: title });
}

const personalizedProductFixture: ProductPresentationContext = {
  ...structuredClone(zeroOptionProductFixture),
  productId: "product_personalized_gift",
  sku: "GIFT-PERSONALIZED",
  title: localized("Personalized gift"),
  optionGroups: [
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
  revision: "personalized-gift-revision-1",
};

const personalizedProductResult = {
  resolvedConfiguration: { kind: "baseProduct" as const },
  purchasable: true,
  price: { amount: 100, currency: "EUR" },
  availability: localized("Available"),
  mediaAssetIds: ["asset_gift_card"],
};

describe("P6-03 dynamic PDP option integration", () => {
  it("does not expose a primary action before the initial canonical result is available", async () => {
    const initial = deferred<unknown>();
    renderIntegrated(watchProductFixture, { resolver: { resolve: () => initial.promise } });
    expect(screen.getByRole("status")).toHaveTextContent("Updating product options…");
    expect(screen.getByRole("status")).toHaveAttribute("aria-busy", "true");
    expect(screen.getByRole("status").className).toContain("resolutionShell");
    expect(screen.queryByRole("button", { name: "Add to cart" })).toBeNull();

    initial.resolve({ purchasable: false });
    await act(async () => initial.promise);
    await waitForProduct("Nordic field watch");
    expect(screen.getByRole("button", { name: "Add to cart" })).toBeDisabled();
  });

  it("awaits watch resolution, exposes pending controls and renders canonical selection state", async () => {
    const selection = deferred<unknown>();
    const resolver: CanonicalProductConfigurationResolver = {
      resolve(input) {
        if (input.selectedValues.length === 0) return { purchasable: false };
        return selection.promise;
      },
    };
    renderIntegrated(watchProductFixture, { resolver });
    await waitForProduct("Nordic field watch");
    expect(screen.getByText("€399")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Add to cart" })).toBeDisabled();

    await userEvent.click(screen.getByRole("button", { name: "black" }));
    expect(screen.getByText("Updating product options…")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "black" })).toBeDisabled();

    await act(async () => {
      selection.resolve({
        resolvedConfiguration: { kind: "variant", variantId: "variant_watch_black" },
        purchasable: true,
        price: { amount: 359, currency: "EUR" },
        availability: localized("Low stock"),
        mediaAssetIds: ["asset_watch_black"],
      });
      await selection.promise;
    });

    expect(screen.getByRole("button", { name: "black" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByText(/359/)).toBeInTheDocument();
    expect(screen.queryByText("€399")).not.toBeInTheDocument();
    expect(screen.getByText("Low stock")).toBeInTheDocument();
    expect(document.querySelector('[data-asset-id="asset_watch_black"]')).not.toBeNull();
    expect(screen.getByRole("button", { name: "Add to cart" })).toBeEnabled();
  });

  it("emits one canonical primary-action intent and never mutates protected product truth", async () => {
    const original = structuredClone(watchProductFixture);
    const { onPrimaryAction } = renderIntegrated(watchProductFixture);
    await waitForProduct("Nordic field watch");
    await userEvent.click(screen.getByRole("button", { name: "silver" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Add to cart" })).toBeEnabled());
    await userEvent.click(screen.getByRole("button", { name: "Add to cart" }));

    expect(onPrimaryAction).toHaveBeenCalledTimes(1);
    expect(onPrimaryAction).toHaveBeenCalledWith({
      type: "activatePrimaryProductAction",
      action: "addToCart",
      productId: "product_watch",
      catalogueRevision: "watch-revision-1",
      resolvedConfiguration: { kind: "variant", variantId: "variant_watch_silver" },
      selectedValues: [{ groupId: "colour", valueId: "colour_silver" }],
      textEntries: [],
    });
    expect(watchProductFixture).toEqual(original);
  });

  it("resolves the complex ring in dependency order and carries validated engraving", async () => {
    const { onPrimaryAction } = renderIntegrated(ringProductFixture);
    await waitForProduct("Aurora ring");
    const addButton = screen.getByRole("button", { name: "Add to cart" });
    expect(addButton).toBeDisabled();
    expect(screen.getByRole("button", { name: "18" })).toBeDisabled();

    await userEvent.click(screen.getByRole("button", { name: "16" }));
    await userEvent.click(screen.getByRole("button", { name: "yellow" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "18" })).toBeEnabled());
    await userEvent.click(screen.getByRole("button", { name: "18" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "diamond" })).toBeEnabled());
    await userEvent.click(screen.getByRole("button", { name: "diamond" }));
    await waitFor(() => expect(screen.getByRole("radio", { name: "vs" })).toBeEnabled());
    await userEvent.click(screen.getByRole("radio", { name: "vs" }));
    await waitFor(() => expect(addButton).toBeEnabled());

    fireEvent.change(screen.getByRole("textbox", { name: /Engraving/ }), {
      target: { value: "Leo 26" },
    });
    await waitFor(() =>
      expect(screen.getByRole("textbox", { name: /Engraving/ })).toHaveValue("Leo 26"),
    );
    expect(screen.getByText(/1,590|1590/)).toBeInTheDocument();
    expect(screen.getByText(/1,690|1690/)).toBeInTheDocument();
    expect(screen.getByText("Made to order in two weeks")).toBeInTheDocument();

    await userEvent.click(addButton);
    expect(onPrimaryAction).toHaveBeenCalledWith(
      expect.objectContaining({
        productId: "product_ring",
        resolvedConfiguration: {
          kind: "configuration",
          configurationId: "ring_configuration_1",
        },
        textEntries: [{ groupId: "engraving", value: "Leo 26" }],
      }),
    );
  });

  it("keeps unavailable combinations disabled and emits no resolver selection", async () => {
    const resolve = vi.fn((input: CanonicalProductConfigurationInput) =>
      canonicalProductResolver.resolve(input),
    );
    const resolver: CanonicalProductConfigurationResolver = { resolve };
    renderIntegrated(ringProductFixture, { resolver });
    await waitForProduct("Aurora ring");
    await userEvent.click(screen.getByRole("button", { name: "white" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "14" })).toBeDisabled());
    const callsBefore = resolve.mock.calls.length;
    fireEvent.click(screen.getByRole("button", { name: "14" }));
    expect(resolve).toHaveBeenCalledTimes(callsBefore);
    expect(screen.getByText("Unavailable with the current selection.")).toBeInTheDocument();
  });

  it("keeps rapid text drafts enabled and ignores older async text results", async () => {
    const pending = new Map<string, ReturnType<typeof deferred<unknown>>>();
    const resolver: CanonicalProductConfigurationResolver = {
      resolve(input) {
        const textValue = input.textEntries[0]?.value;
        if (!textValue) return personalizedProductResult;
        const result = deferred<unknown>();
        pending.set(textValue, result);
        return result.promise;
      },
    };
    renderIntegrated(personalizedProductFixture, { resolver });
    await waitForProduct("Personalized gift");
    const engraving = screen.getByRole("textbox", { name: /Engraving/ });

    fireEvent.change(engraving, { target: { value: "L" } });
    expect(engraving).toBeEnabled();
    expect(engraving).toHaveValue("L");
    fireEvent.change(engraving, { target: { value: "Leo" } });
    expect(engraving).toBeEnabled();
    expect(engraving).toHaveValue("Leo");

    pending.get("Leo")!.resolve(personalizedProductResult);
    await act(async () => pending.get("Leo")!.promise);
    pending.get("L")!.resolve(personalizedProductResult);
    await act(async () => pending.get("L")!.promise);
    expect(engraving).toHaveValue("Leo");
    expect(screen.getByRole("button", { name: "Add to cart" })).toBeEnabled();
  });

  it("preserves invalid text as a visible draft while disabling purchase after failure", async () => {
    const { onPrimaryAction } = renderIntegrated(personalizedProductFixture, {
      resolver: { resolve: () => personalizedProductResult },
    });
    await waitForProduct("Personalized gift");
    const engraving = screen.getByRole("textbox", { name: /Engraving/ });
    fireEvent.change(engraving, { target: { value: "Leo" } });
    await waitFor(() => expect(engraving).toHaveValue("Leo"));
    await waitFor(() => expect(screen.queryByText("Updating product options…")).toBeNull());
    fireEvent.change(engraving, { target: { value: "Leo💍" } });
    await screen.findByText("Check the text option and try again.");

    expect(engraving).toHaveValue("Leo💍");
    const action = screen.getByRole("button", { name: "Add to cart" });
    expect(action).toBeDisabled();
    await userEvent.click(action);
    expect(onPrimaryAction).not.toHaveBeenCalled();
  });

  it("keeps local and canonical text state aligned after clear and reset", async () => {
    const { onPrimaryAction } = renderIntegrated(personalizedProductFixture, {
      resolver: { resolve: () => personalizedProductResult },
    });
    await waitForProduct("Personalized gift");
    const engraving = screen.getByRole("textbox", { name: /Engraving/ });
    fireEvent.change(engraving, { target: { value: "Leo" } });
    await waitFor(() => expect(engraving).toHaveValue("Leo"));
    await waitFor(() => expect(screen.queryByText("Updating product options…")).toBeNull());

    fireEvent.change(engraving, { target: { value: "" } });
    await waitFor(() => expect(engraving).toHaveValue(""));
    await waitFor(() => expect(screen.queryByText("Updating product options…")).toBeNull());
    await userEvent.click(screen.getByRole("button", { name: "Add to cart" }));
    expect(onPrimaryAction).toHaveBeenLastCalledWith(expect.objectContaining({ textEntries: [] }));

    fireEvent.change(engraving, { target: { value: "Gift 26" } });
    await waitFor(() => expect(engraving).toHaveValue("Gift 26"));
    await waitFor(() => expect(screen.queryByText("Updating product options…")).toBeNull());
    await userEvent.click(screen.getByRole("button", { name: "Reset options" }));
    await waitFor(() => expect(engraving).toHaveValue(""));
    await waitFor(() => expect(screen.queryByText("Updating product options…")).toBeNull());
    await userEvent.click(screen.getByRole("button", { name: "Add to cart" }));
    expect(onPrimaryAction).toHaveBeenLastCalledWith(expect.objectContaining({ textEntries: [] }));
  });

  it("renders unavailable-price and zero-option products from canonical resolution", async () => {
    const first = renderIntegrated(unavailablePriceProductFixture);
    await waitForProduct("Gift card");
    expect(screen.getByText("Price available after consultation")).toBeInTheDocument();
    expect(screen.getByText("Contact the store")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Add to cart" })).toBeDisabled();
    first.onPrimaryAction.mockClear();

    cleanup();
    const second = renderIntegrated(zeroOptionProductFixture);
    await waitForProduct("Gift card");
    expect(screen.queryByRole("heading", { name: "Choose product options" })).toBeNull();
    expect(screen.getByLabelText("Price")).toHaveTextContent("100");
    const action = screen.getByRole("button", { name: "Add to cart" });
    expect(action).toBeEnabled();
    await userEvent.click(action);
    expect(second.onPrimaryAction).toHaveBeenCalledWith(
      expect.objectContaining({
        productId: "product_gift_card",
        resolvedConfiguration: { kind: "baseProduct" },
        selectedValues: [],
      }),
    );
  });

  it("ignores a stale slower resolver result after a newer selection wins", async () => {
    const pending = new Map<string, ReturnType<typeof deferred<unknown>>>();
    const resolver: CanonicalProductConfigurationResolver = {
      resolve(input) {
        const valueId = input.selectedValues[0]?.valueId;
        if (!valueId) return { purchasable: false };
        const result = deferred<unknown>();
        pending.set(valueId, result);
        return result.promise;
      },
    };
    const controller = createDynamicProductDetailController({
      context: watchProductFixture,
      resolver,
    });
    await controller.initialize();
    const silverRequest = controller.selectOption("colour", "colour_silver");
    const blackRequest = controller.selectOption("colour", "colour_black");
    pending.get("colour_black")!.resolve({
      resolvedConfiguration: { kind: "variant", variantId: "variant_watch_black" },
      purchasable: true,
      price: { amount: 359, currency: "EUR" },
      mediaAssetIds: ["asset_watch_black"],
    });
    expect((await blackRequest).kind).toBe("applied");
    pending.get("colour_silver")!.resolve({
      resolvedConfiguration: { kind: "variant", variantId: "variant_watch_silver" },
      purchasable: true,
      price: { amount: 349, currency: "EUR" },
      mediaAssetIds: ["asset_watch_silver"],
    });
    expect((await silverRequest).kind).toBe("stale");
    expect(controller.getSnapshot().result?.selectedValues).toEqual([
      { groupId: "colour", valueId: "colour_black" },
    ]);
    expect(controller.getSnapshot().result?.resolvedConfiguration).toEqual({
      kind: "variant",
      variantId: "variant_watch_black",
    });
  });

  it("preserves the latest valid result after resolver rejection and invalid resolver output", async () => {
    let failureMode: "none" | "reject" | "invalid" = "none";
    const resolver: CanonicalProductConfigurationResolver = {
      async resolve(input) {
        await Promise.resolve();
        if (failureMode === "reject") throw new Error("offline");
        if (failureMode === "invalid") return { purchasable: true };
        return canonicalProductResolver.resolve(input);
      },
    };
    const controller = createDynamicProductDetailController({
      context: watchProductFixture,
      resolver,
    });
    await controller.initialize();
    await controller.selectOption("colour", "colour_silver");
    const valid = controller.getSnapshot().result;

    failureMode = "reject";
    const rejected = await controller.selectOption("colour", "colour_black");
    expect(rejected.kind).toBe("failed");
    expect(rejected.snapshot.error?.code).toBe("RESOLVER_FAILURE");
    expect(controller.getSnapshot().result).toBe(valid);

    failureMode = "invalid";
    const invalid = await controller.selectOption("colour", "colour_black");
    expect(invalid.snapshot.error?.code).toBe("INVALID_RESOLVER_RESULT");
    expect(controller.getSnapshot().result).toBe(valid);
  });

  it("keeps preserved product truth visible but disables purchase after a failed change", async () => {
    let blackAttempt = deferred<unknown>();
    const resolver: CanonicalProductConfigurationResolver = {
      resolve(input) {
        const colour = input.selectedValues.find((selection) => selection.groupId === "colour");
        if (!colour) return { purchasable: false };
        if (colour.valueId === "colour_black") return blackAttempt.promise;
        return {
          resolvedConfiguration: { kind: "variant", variantId: "variant_watch_silver" },
          purchasable: true,
          price: { amount: 349, currency: "EUR" },
          availability: localized("In stock"),
          mediaAssetIds: ["asset_watch_silver"],
        };
      },
    };
    const { onPrimaryAction } = renderIntegrated(watchProductFixture, { resolver });
    await waitForProduct("Nordic field watch");
    await userEvent.click(screen.getByRole("button", { name: "silver" }));
    const action = screen.getByRole("button", { name: "Add to cart" });
    await waitFor(() => expect(action).toBeEnabled());

    await userEvent.click(screen.getByRole("button", { name: "black" }));
    expect(action).toBeDisabled();
    await act(async () => {
      blackAttempt.reject(new Error("resolver offline"));
      await blackAttempt.promise.catch(() => undefined);
    });

    await screen.findByText(
      "Product options are temporarily unavailable. Your previous selection is unchanged.",
    );
    expect(action).toBeDisabled();
    expect(screen.getByRole("button", { name: "silver" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByText("In stock")).toBeInTheDocument();
    expect(document.querySelector("figure[data-asset-id]")).toHaveAttribute(
      "data-asset-id",
      "asset_watch_silver",
    );
    await userEvent.click(action);
    expect(onPrimaryAction).not.toHaveBeenCalled();

    blackAttempt = deferred<unknown>();
    await userEvent.click(screen.getByRole("button", { name: "black" }));
    blackAttempt.resolve({
      resolvedConfiguration: { kind: "variant", variantId: "variant_watch_black" },
      purchasable: true,
      price: { amount: 359, currency: "EUR" },
      availability: localized("Low stock"),
      mediaAssetIds: ["asset_watch_black"],
    });
    await act(async () => blackAttempt.promise);
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "black" })).toHaveAttribute("aria-pressed", "true"),
    );
    expect(screen.queryByText(/temporarily unavailable/)).toBeNull();
    expect(action).toBeEnabled();
  });

  it("keeps the action disabled when a failure preserves a non-purchasable result", async () => {
    const resolver: CanonicalProductConfigurationResolver = {
      resolve(input) {
        if (input.selectedValues.length === 0) return { purchasable: false };
        throw new Error("resolver offline");
      },
    };
    renderIntegrated(watchProductFixture, { resolver });
    await waitForProduct("Nordic field watch");
    await userEvent.click(screen.getByRole("button", { name: "black" }));
    await screen.findByText(
      "Product options are temporarily unavailable. Your previous selection is unchanged.",
    );
    expect(screen.getByRole("button", { name: "Add to cart" })).toBeDisabled();
  });

  it("supports typed clear and reset intents while unknown IDs fail safely", async () => {
    const optionalContext = structuredClone(watchProductFixture);
    optionalContext.optionGroups[0].required = false;
    const controller = createDynamicProductDetailController({
      context: optionalContext,
      resolver: canonicalProductResolver,
    });
    await controller.initialize();
    await controller.selectOption("colour", "colour_silver");
    expect((await controller.clearOption("colour")).snapshot.result?.selectedValues).toEqual([]);
    await controller.selectOption("colour", "colour_black");
    expect((await controller.reset()).snapshot.result?.selectedValues).toEqual([]);
    const previous = controller.getSnapshot().result;
    const unknownGroup = await controller.selectOption("movement", "automatic");
    expect(unknownGroup.snapshot.error?.code).toBe("UNKNOWN_GROUP");
    expect(controller.getSnapshot().result).toBe(previous);
    const unknownValue = await controller.selectOption("colour", "colour_blue");
    expect(unknownValue.snapshot.error?.code).toBe("UNKNOWN_VALUE");
    expect(controller.getSnapshot().result).toBe(previous);
  });

  it("remains product-type independent and keeps provider/UI/storage imports out of the controller", async () => {
    const contexts = [watchProductFixture, ringProductFixture, zeroOptionProductFixture];
    for (const context of contexts) {
      const controller = createDynamicProductDetailController({
        context,
        resolver: canonicalProductResolver,
      });
      const initialized = await controller.initialize();
      expect(initialized.kind).toBe("applied");
      expect(initialized.snapshot.result?.productId).toBe(context.productId);
    }

    const source = readFileSync(
      join(
        process.cwd(),
        "src/application/product-presentation/dynamic-product-detail-controller.ts",
      ),
      "utf8",
    );
    expect(source).not.toMatch(/react|@puckeditor|provider|indexeddb|storage/i);
  });
});
