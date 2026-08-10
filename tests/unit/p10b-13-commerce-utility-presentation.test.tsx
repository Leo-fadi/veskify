import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import {
  getCommercialUtilityProfile,
  listCommercialUtilityProfiles,
  materializeCommerceUtilityPage,
  materializeExecutablePageBlueprint,
  type CommercialUtilityProfileId,
  validateCommercialUtilityProfileLibrary,
} from "@/application/storefront-templates";
import { createP905aFreshMerchantFixture } from "@/data/demo/p9-05a-fresh-store-generation";
import {
  createStorefrontRenderContext,
  veskifyComponentDefinitionsV2,
} from "@/components/registry";
import { renderStorefrontPage } from "@/components/storefront/storefront-page";
import {
  applyCommercialSharedFrame,
  PAGE_FAMILY_AUTHORITY_VERSION,
  type PageModel,
} from "@/domain/storefront";
import type { CommerceUtilityRuntimeState } from "@/domain/commerce-utility";

const familyFor = (state: string) =>
  state === "cart"
    ? "cart"
    : state === "checkout"
      ? "checkout"
      : state === "no-results"
        ? "no-results"
        : state === "empty"
          ? "empty-state"
          : state === "error"
            ? "error-state"
            : "not-found";

function pageFor(profileId: CommercialUtilityProfileId): PageModel {
  const profile = getCommercialUtilityProfile(profileId)!;
  const state = profile.profile!.commercialUtility!.state;
  const familyId = familyFor(state);
  return materializeCommerceUtilityPage(
    {
      id: `page_${profileId.replaceAll("-", "_")}`,
      type: profile.pageType,
      slug:
        familyId === "cart"
          ? "/cart"
          : familyId === "checkout"
            ? "/checkout"
            : familyId === "no-results"
              ? "/states/no-results"
              : familyId === "empty-state"
                ? "/states/empty"
                : familyId === "error-state"
                  ? "/states/error"
                  : "/404",
      title: { en: "Utility", fi: "Apu" },
      seo: { title: { en: "Utility", fi: "Apu" }, metaDescription: { en: "Utility", fi: "Apu" } },
      sections: [],
      pageFamily: {
        familyId,
        familyVersion: PAGE_FAMILY_AUTHORITY_VERSION,
        profileId,
        profileVersion: "1.0.0",
        localeCoverage: ["en", "fi"],
        sharedFrameId: "blueprint-shared-storefront-frame",
        sharedFrameVersion: "1.0.0",
        commerceContext: { kind: "none" },
        commerceOperationAuthority: "presentation-only",
        navigationAreas: [],
        evidenceReferences: [],
      },
    },
    profileId,
  );
}

describe("P10B-13 commerce utility presentation", () => {
  it("registers deterministic PageBlueprint utility profiles with exact state boundaries", () => {
    const profiles = listCommercialUtilityProfiles();
    expect(profiles).toHaveLength(6);
    expect(new Set(profiles.map((profile) => profile.profile!.commercialUtility!.state)).size).toBe(
      6,
    );
    profiles.forEach((profile) => {
      const materialization = materializeExecutablePageBlueprint({
        pagePlan: profile,
        componentDefinitions: veskifyComponentDefinitionsV2,
        availableBindingCategories: ["navigation"],
      });
      expect(materialization.commercialUtility?.structuralFingerprint).toMatch(
        /^commerce-utility-profile-/,
      );
      expect(materialization.slots).toHaveLength(1);
    });
    expect(() => validateCommercialUtilityProfileLibrary([...profiles, profiles[0]])).toThrow(
      /unique/i,
    );
    const malformed = structuredClone(profiles[0]);
    Reflect.set(malformed.profile!.commercialUtility!, "requiredRuntimeCapabilities", [
      "continue-checkot",
    ]);
    expect(() => validateCommercialUtilityProfileLibrary([malformed])).toThrow();
  });

  it("renders cart facts from a read-only runtime projection and never persists cart contents", () => {
    const fixture = createP905aFreshMerchantFixture("modernTechnical");
    const product = fixture.aggregate.catalogue.products[0];
    const price = product.price;
    if (!price) throw new Error("Expected canonical fixture product price.");
    const cartPage = pageFor("commerce-utility-cart");
    const snapshot = applyCommercialSharedFrame(
      { ...fixture.planningInput.draft, pages: [...fixture.planningInput.draft.pages, cartPage] },
      "commerce-utility",
    );
    const runtime: CommerceUtilityRuntimeState = {
      kind: "cart",
      revision: "cart-r1",
      lines: [
        {
          lineId: "line_1",
          productId: product.id,
          quantity: 1,
          minimumQuantity: 1,
          unitPrice: product.price,
          linePrice: product.price,
        },
      ],
      subtotal: product.price,
      total: product.price,
      actions: ["change-quantity", "remove-line", "continue-checkout"],
    };
    const action = vi.fn();
    const context = createStorefrontRenderContext({
      activeLocale: "en",
      primaryLocale: "en",
      enabledLocales: ["en", "fi"],
      catalogue: fixture.aggregate.catalogue,
      snapshot,
      commerceUtilityRuntime: runtime,
      onCommerceUtilityIntent: action,
    });
    render(<>{renderStorefrontPage(cartPage, context)}</>);
    expect(screen.getByRole("heading", { name: "Cart" })).toBeVisible();
    expect(screen.getByRole("heading", { name: product.title.en })).toBeVisible();
    expect(
      screen.getAllByText(
        new Intl.NumberFormat("en-FI", {
          style: "currency",
          currency: price.currency,
          maximumFractionDigits: 2,
        }).format(price.amount),
      ).length,
    ).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole("button", { name: "Remove" }));
    expect(action).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "remove-line",
        lineId: "line_1",
        runtimeRevision: "cart-r1",
      }),
    );
    expect(JSON.stringify(snapshot)).not.toContain("line_1");
    expect(JSON.stringify(snapshot)).not.toContain("cart-r1");
  });

  it("keeps no-results, error, and not-found semantically distinct and fails closed for mismatched state", () => {
    const fixture = createP905aFreshMerchantFixture("modernTechnical");
    const noResults = pageFor("commerce-utility-no-results");
    const snapshot = applyCommercialSharedFrame(
      { ...fixture.planningInput.draft, pages: [...fixture.planningInput.draft.pages, noResults] },
      "commerce-utility",
    );
    const context = createStorefrontRenderContext({
      activeLocale: "en",
      primaryLocale: "en",
      enabledLocales: ["en", "fi"],
      catalogue: fixture.aggregate.catalogue,
      snapshot,
      commerceUtilityRuntime: {
        kind: "no-results",
        revision: "search-r1",
        query: "missing",
        activeFilters: [],
        actions: [],
      },
    });
    render(<>{renderStorefrontPage(noResults, context)}</>);
    expect(screen.getByRole("heading", { name: "No results" })).toBeVisible();
    const errorPage = pageFor("commerce-utility-error");
    expect(() => renderStorefrontPage(errorPage, context)).toThrow(
      /matching canonical runtime state/i,
    );
  });

  it("fails closed rather than omitting an unresolved canonical cart line", () => {
    const fixture = createP905aFreshMerchantFixture("modernTechnical");
    const cartPage = pageFor("commerce-utility-cart");
    const snapshot = applyCommercialSharedFrame(
      { ...fixture.planningInput.draft, pages: [...fixture.planningInput.draft.pages, cartPage] },
      "commerce-utility",
    );
    const context = createStorefrontRenderContext({
      activeLocale: "en",
      primaryLocale: "en",
      enabledLocales: ["en", "fi"],
      catalogue: fixture.aggregate.catalogue,
      snapshot,
      commerceUtilityRuntime: {
        kind: "cart",
        revision: "cart-unknown-product-r1",
        lines: [
          {
            lineId: "line_unknown",
            productId: "product_unknown",
            quantity: 1,
            minimumQuantity: 1,
          },
        ],
        actions: ["remove-line", "continue-checkout"],
      },
      onCommerceUtilityIntent: vi.fn(),
    });
    render(<>{renderStorefrontPage(cartPage, context)}</>);
    const unavailable = screen.getByRole("status");
    expect(within(unavailable).getByText("Cart information is unavailable.")).toBeVisible();
    expect(within(unavailable).queryByRole("button")).not.toBeInTheDocument();
  });

  it("keeps the cart route meaningful while its transient runtime state is unavailable or loading", () => {
    const fixture = createP905aFreshMerchantFixture("modernTechnical");
    const cartPage = pageFor("commerce-utility-cart");
    const snapshot = applyCommercialSharedFrame(
      { ...fixture.planningInput.draft, pages: [...fixture.planningInput.draft.pages, cartPage] },
      "commerce-utility",
    );
    const unavailable = createStorefrontRenderContext({
      activeLocale: "en",
      primaryLocale: "en",
      enabledLocales: ["en", "fi"],
      catalogue: fixture.aggregate.catalogue,
      snapshot,
    });
    const first = render(<>{renderStorefrontPage(cartPage, unavailable)}</>);
    expect(screen.getByText("Cart information is unavailable.")).toBeVisible();
    first.unmount();

    const loading = createStorefrontRenderContext({
      activeLocale: "en",
      primaryLocale: "en",
      enabledLocales: ["en", "fi"],
      catalogue: fixture.aggregate.catalogue,
      snapshot,
      commerceUtilityRuntime: {
        kind: "loading",
        revision: "cart-loading-r1",
        message: { en: "Retrieving your current cart.", fi: "Haetaan ostoskoriasi." },
        actions: [],
      },
    });
    render(<>{renderStorefrontPage(cartPage, loading)}</>);
    expect(screen.getByRole("heading", { name: "Loading" })).toBeVisible();
    expect(screen.getByText("Retrieving your current cart.")).toBeVisible();
  });
});
