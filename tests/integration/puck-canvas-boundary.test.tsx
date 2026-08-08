import { useState } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { createStorefrontRenderContext } from "@/components/registry";
import { aurumNordicSeed } from "@/data/seed";
import type { Locale } from "@/domain/shared";
import { VeskifyPuckCanvas } from "@/integrations/puck/veskify-puck-editor";

vi.mock("@puckeditor/core", () => ({
  Puck: ({
    config,
    data,
    onChange,
    ui,
  }: {
    config: {
      root: {
        render: (props: { children: React.ReactNode }) => React.ReactNode;
      };
    };
    data: { content: Array<{ type: string; props: Record<string, unknown> }> };
    onChange?: (data: unknown) => void;
    ui?: { leftSideBarVisible?: boolean };
  }) => {
    const [initialData] = useState(data);
    return (
      <div
        data-content-ids={initialData.content.map((item) => item.props.id).join(",")}
        data-left-sidebar-visible={String(ui?.leftSideBarVisible)}
        data-testid="puck-iframe-document"
      >
        {config.root.render({ children: <div>Canonical storefront sections</div> })}
        <button
          onClick={() =>
            onChange?.({
              ...initialData,
              content: [
                ...initialData.content,
                { type: "productInfo", props: { id: "section_cross_page_tamper" } },
              ],
            })
          }
          type="button"
        >
          Emit tampered Puck payload
        </button>
      </div>
    );
  },
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
      <VeskifyPuckCanvas
        brandSystem={customBrand}
        context={context("en")}
        onPageChange={() => undefined}
        onValidationError={() => undefined}
        page={homepage}
        resetKey={0}
      />,
    );
    const canvasRoot = () =>
      screen
        .getByTestId("puck-iframe-document")
        .querySelector<HTMLElement>("[data-veskify-canvas-root]")!;

    expect(canvasRoot()).toHaveAttribute("lang", "en");
    expect(screen.getByTestId("puck-iframe-document")).toHaveAttribute(
      "data-left-sidebar-visible",
      "false",
    );
    expect(canvasRoot().style.getPropertyValue("--brand-color-primary")).toBe("#123456");
    expect(canvasRoot().style.getPropertyValue("--brand-color-background")).toBe("#F0E1D2");
    expect(canvasRoot().style.getPropertyValue("--brand-font-heading")).toContain("Georgia");
    expect(canvasRoot().style.getPropertyValue("--brand-font-body")).toContain("system-ui");
    expect(canvasRoot().style.getPropertyValue("--brand-spacing-density")).toBe("0.85");
    expect(canvasRoot().style.getPropertyValue("--brand-density-global")).toBe("0.86");

    view.rerender(
      <VeskifyPuckCanvas
        brandSystem={customBrand}
        context={context("fi")}
        onPageChange={() => undefined}
        onValidationError={() => undefined}
        page={homepage}
        resetKey={0}
      />,
    );
    expect(canvasRoot()).toHaveAttribute("lang", "fi");
    expect(canvasRoot().style.getPropertyValue("--brand-color-primary")).toBe("#123456");

    view.rerender(
      <VeskifyPuckCanvas
        brandSystem={customBrand}
        context={context("fi")}
        onPageChange={() => undefined}
        onValidationError={() => undefined}
        page={collection}
        resetKey={0}
      />,
    );
    expect(canvasRoot()).toHaveAttribute("lang", "fi");
    expect(canvasRoot().style.getPropertyValue("--brand-color-primary")).toBe("#123456");

    view.rerender(
      <VeskifyPuckCanvas
        brandSystem={customBrand}
        context={context("en")}
        onPageChange={() => undefined}
        onValidationError={() => undefined}
        page={collection}
        resetKey={0}
      />,
    );
    expect(canvasRoot()).toHaveAttribute("lang", "en");
    expect(canvasRoot().style.getPropertyValue("--brand-color-primary")).toBe("#123456");
  });

  it("rejects invalid onChange data and retains the last valid canvas", () => {
    const onPageChange = vi.fn();
    const onValidationError = vi.fn();
    render(
      <VeskifyPuckCanvas
        brandSystem={customBrand}
        context={context("en")}
        onPageChange={onPageChange}
        onValidationError={onValidationError}
        page={homepage}
        resetKey={0}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Emit tampered Puck payload" }));
    expect(onPageChange).not.toHaveBeenCalled();
    expect(onValidationError).toHaveBeenCalledWith(expect.stringContaining("last valid design"));
    expect(screen.getByText("Canonical storefront sections")).toBeVisible();
  });

  it("remounts Puck for the latest proposal identity and renders its complete canonical page", () => {
    const firstProposal = structuredClone(homepage);
    firstProposal.sections = firstProposal.sections.filter(
      (section) => section.component !== "newsletter",
    );
    const latestProposal = structuredClone(firstProposal);
    const campaign = structuredClone(
      homepage.sections.find((section) => section.component === "campaignBanner")!,
    );
    campaign.id = "section_latest_proposal_campaign";
    latestProposal.sections.splice(-1, 0, campaign);

    const view = render(
      <VeskifyPuckCanvas
        brandSystem={customBrand}
        context={context("en")}
        onPageChange={() => undefined}
        onValidationError={() => undefined}
        page={firstProposal}
        readOnly
        resetKey={0}
        sessionKey="proposal_first"
      />,
    );
    const canvas = () => screen.getByTestId("puck-iframe-document");
    expect(canvas()).not.toHaveAttribute("data-content-ids", expect.stringContaining(campaign.id));

    view.rerender(
      <VeskifyPuckCanvas
        brandSystem={customBrand}
        context={context("en")}
        onPageChange={() => undefined}
        onValidationError={() => undefined}
        page={latestProposal}
        readOnly
        resetKey={0}
        sessionKey="proposal_latest"
      />,
    );

    expect(canvas()).toHaveAttribute("data-content-ids", expect.stringContaining(campaign.id));
  });
});
