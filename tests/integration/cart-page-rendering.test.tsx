import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { createStorefrontRenderContext } from "@/components/registry";
import { cartPageDefinition, cartPagePropsSchema } from "@/components/registry/cart";
import {
  benefitIconsContentSchema,
  benefitIconsDefinition,
  benefitIconsPropsSchema,
} from "@/components/registry/homepage";
import { aurumNordicSeed } from "@/data/seed";
import type { SectionInstance } from "@/domain/storefront";

const context = (activeLocale: "en" | "fi" = "en") =>
  createStorefrontRenderContext({
    activeLocale,
    primaryLocale: "en",
    catalogue: aurumNordicSeed.catalogue,
    snapshot: aurumNordicSeed.draftSnapshot,
  });

const cartSection = (
  lineItems?: Array<{ productId: string; quantity: number }>,
): SectionInstance => ({
  id: "section_cart_page",
  component: "cartPage",
  variant: "split",
  visible: true,
  content: {
    ...structuredClone(cartPageDefinition.defaultContent),
    ...(lineItems !== undefined ? { lineItems } : {}),
  },
  props: cartPagePropsSchema.parse(cartPageDefinition.defaultProps),
});

const benefitSection: SectionInstance = {
  id: "section_cart_benefits",
  component: "benefitIcons",
  variant: "threeColumn",
  visible: true,
  content: benefitIconsContentSchema.parse(benefitIconsDefinition.defaultContent),
  props: benefitIconsPropsSchema.parse(benefitIconsDefinition.defaultProps),
};

const hasEuroAmount = (expected: string) => (value: string) =>
  value.replace(/[\s,€]/g, "") === expected;

function renderCart(activeLocale: "en" | "fi" = "en", section = cartSection()) {
  const renderContext = context(activeLocale);
  return render(
    <>
      {cartPageDefinition.render(section, renderContext, "cart")}
      {benefitIconsDefinition.render(benefitSection, renderContext, "cart")}
    </>,
  );
}

describe("P1-04 cart page rendering", () => {
  it("renders the split cart with catalogue products, protected totals and benefits", () => {
    const { container } = renderCart();

    expect(screen.getByRole("heading", { level: 1, name: "Your cart" })).toBeVisible();
    expect(screen.getByRole("heading", { name: "Aurora Ring 585" })).toBeVisible();
    expect(screen.getByRole("heading", { name: "Lumi Halo Ring" })).toBeVisible();
    expect(screen.getByRole("heading", { name: "Order summary" })).toBeVisible();
    expect(container.querySelector("[class*='split']")).toBeVisible();
    expect(screen.getAllByText(hasEuroAmount("1290"))).not.toHaveLength(0);
    expect(screen.getAllByText(hasEuroAmount("1890"))).not.toHaveLength(0);
    expect(screen.getAllByText(hasEuroAmount("5070"))).toHaveLength(2);
    expect(container.querySelectorAll("[data-read-only-price='true']")).toHaveLength(6);
    expect(screen.getByRole("region", { name: "Why shop with Aurum Nordic" })).toBeVisible();
    expect(screen.getByRole("heading", { name: "Complimentary delivery" })).toBeVisible();
  });

  it("keeps quantity, removal and checkout controls presentation-only", async () => {
    const user = userEvent.setup();
    renderCart();
    const auroraGroup = screen.getByRole("group", { name: "Quantity: Aurora Ring 585" });

    expect(within(auroraGroup).getByText("1")).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Increase: Aurora Ring 585" }));
    await user.click(screen.getByRole("button", { name: "Remove Aurora Ring 585" }));
    await user.click(screen.getByRole("button", { name: "Continue to checkout" }));

    expect(within(auroraGroup).getByText("1")).toBeVisible();
    expect(screen.getByRole("heading", { name: "Aurora Ring 585" })).toBeVisible();
    expect(screen.getAllByText(hasEuroAmount("5070"))).toHaveLength(2);
    expect(screen.getByText(/Design preview only/)).toBeVisible();
  });

  it("renders Finnish labels and catalogue content", () => {
    renderCart("fi");

    expect(screen.getByRole("heading", { level: 1, name: "Ostoskorisi" })).toBeVisible();
    expect(screen.getByRole("heading", { name: "Aurora-sormus 585" })).toBeVisible();
    expect(screen.getByRole("heading", { name: "Lumi Halo -sormus" })).toBeVisible();
    expect(screen.getByRole("group", { name: "Määrä: Aurora-sormus 585" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Jatka kassalle" })).toBeVisible();
    expect(screen.getByRole("region", { name: "Miksi valita Aurum Nordic" })).toBeVisible();
  });

  it("renders a useful bilingual empty-cart presentation", () => {
    const empty = cartSection([]);
    const { rerender } = renderCart("en", empty);
    expect(screen.getByRole("heading", { name: "Your cart is empty" })).toBeVisible();
    expect(screen.queryByRole("button", { name: "Continue to checkout" })).not.toBeInTheDocument();

    const FinnishContext = context("fi");
    rerender(<>{cartPageDefinition.render(empty, FinnishContext, "cart")}</>);
    expect(screen.getByRole("heading", { name: "Ostoskorisi on tyhjä" })).toBeVisible();
  });
});
