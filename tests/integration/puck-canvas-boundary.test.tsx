import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { createStorefrontRenderContext } from "@/components/registry";
import { aurumNordicSeed } from "@/data/seed";
import type { Locale } from "@/domain/shared";
import { VeskifyPuckCanvas } from "@/integrations/puck/veskify-puck-editor";

vi.mock("@puckeditor/core", () => ({
  Puck: ({
    config,
  }: {
    config: {
      root: {
        render: (props: { children: React.ReactNode }) => React.ReactNode;
      };
    };
  }) => (
    <div data-testid="puck-iframe-document">
      {config.root.render({ children: <div>Canonical storefront sections</div> })}
    </div>
  ),
  Render: () => null,
}));

const customBrand = structuredClone(aurumNordicSeed.draftSnapshot.brandSystem);
customBrand.colors.primary = "#123456";
customBrand.colors.background = "#F0E1D2";
customBrand.typography.headingFont = "system-serif";
customBrand.typography.bodyFont = "system-sans";
customBrand.spacing.density = "compact";

const context = (activeLocale: Locale) =>
  createStorefrontRenderContext({
    activeLocale,
    primaryLocale: "en",
    catalogue: aurumNordicSeed.catalogue,
    snapshot: aurumNordicSeed.draftSnapshot,
    pagePathPrefix: "/projects/project_aurum_nordic",
  });

const homepage = aurumNordicSeed.draftSnapshot.pages.find((page) => page.type === "home")!;
const collection = aurumNordicSeed.draftSnapshot.pages.find((page) => page.type === "collection")!;

describe("Puck iframe storefront boundary", () => {
  it("keeps draft brand variables and active language inside the canvas root", () => {
    const view = render(
      <VeskifyPuckCanvas brandSystem={customBrand} context={context("en")} page={homepage} />,
    );
    const canvasRoot = () =>
      screen
        .getByTestId("puck-iframe-document")
        .querySelector<HTMLElement>("[data-veskify-canvas-root]")!;

    expect(canvasRoot()).toHaveAttribute("lang", "en");
    expect(canvasRoot().style.getPropertyValue("--brand-color-primary")).toBe("#123456");
    expect(canvasRoot().style.getPropertyValue("--brand-color-background")).toBe("#F0E1D2");
    expect(canvasRoot().style.getPropertyValue("--brand-font-heading")).toContain("Georgia");
    expect(canvasRoot().style.getPropertyValue("--brand-font-body")).toContain("system-ui");
    expect(canvasRoot().style.getPropertyValue("--brand-spacing-density")).toBe("0.85");

    view.rerender(
      <VeskifyPuckCanvas brandSystem={customBrand} context={context("fi")} page={homepage} />,
    );
    expect(canvasRoot()).toHaveAttribute("lang", "fi");
    expect(canvasRoot().style.getPropertyValue("--brand-color-primary")).toBe("#123456");

    view.rerender(
      <VeskifyPuckCanvas brandSystem={customBrand} context={context("fi")} page={collection} />,
    );
    expect(canvasRoot()).toHaveAttribute("lang", "fi");
    expect(canvasRoot().style.getPropertyValue("--brand-color-primary")).toBe("#123456");

    view.rerender(
      <VeskifyPuckCanvas brandSystem={customBrand} context={context("en")} page={collection} />,
    );
    expect(canvasRoot()).toHaveAttribute("lang", "en");
    expect(canvasRoot().style.getPropertyValue("--brand-color-primary")).toBe("#123456");
  });
});
