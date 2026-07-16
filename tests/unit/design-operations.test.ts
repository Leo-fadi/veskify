import { describe, expect, it } from "vitest";
import {
  applyDesignOperation,
  applyDesignOperations,
  generateHomepageRedesign,
  type DesignOperation,
} from "@/application/design-operations";
import { createStorefrontRenderContext } from "@/components/registry";
import { aurumNordicSeed } from "@/data/seed";

const homepage = aurumNordicSeed.draftSnapshot.pages.find((page) => page.type === "home")!;
const context = createStorefrontRenderContext({
  activeLocale: "en",
  primaryLocale: "en",
  catalogue: aurumNordicSeed.catalogue,
  snapshot: aurumNordicSeed.draftSnapshot,
});
const section = (component: string) =>
  homepage.sections.find((item) => item.component === component)!;

describe("deterministic Veskify design operations", () => {
  it("changes approved localized section text without mutating the input", () => {
    const before = structuredClone(homepage);
    const result = applyDesignOperation(
      homepage,
      {
        type: "CHANGE_LOCALIZED_SECTION_TEXT",
        sectionId: section("campaignBanner").id,
        field: "heading",
        locale: "fi",
        value: "Pohjoisen ylellisyys",
      },
      context,
    );
    expect(
      result.sections.find((item) => item.component === "campaignBanner")!.content.heading,
    ).toEqual(expect.objectContaining({ fi: "Pohjoisen ylellisyys" }));
    expect(homepage).toEqual(before);
  });

  it("changes every controlled section presentation property", () => {
    const campaignId = section("campaignBanner").id;
    const operations: DesignOperation[] = [
      { type: "CHANGE_SECTION_VARIANT", sectionId: campaignId, variant: "minimal" },
      { type: "CHANGE_BACKGROUND", sectionId: campaignId, background: "surface" },
      { type: "CHANGE_TYPOGRAPHY", sectionId: campaignId, typography: "serif" },
      { type: "CHANGE_DENSITY", sectionId: campaignId, density: "spacious" },
      { type: "CHANGE_SHAPE", sectionId: campaignId, shape: "soft" },
      { type: "CHANGE_ALIGNMENT", sectionId: campaignId, alignment: "center" },
      { type: "CHANGE_CTA_STYLE", sectionId: campaignId, ctaPresentation: "text" },
    ];
    const result = applyDesignOperations(homepage, operations, context);
    const campaign = result.sections.find((item) => item.id === campaignId)!;
    expect(campaign.variant).toBe("minimal");
    expect(campaign.props).toMatchObject({
      background: "surface",
      typography: "serif",
      density: "spacious",
      shape: "soft",
      alignment: "center",
      ctaPresentation: "text",
    });
  });

  it("applies only a complete schema-approved brand colour palette", () => {
    const colors = { ...aurumNordicSeed.draftSnapshot.brandSystem.colors, accent: "#B8860B" };
    const result = applyDesignOperation(
      homepage,
      { type: "APPLY_APPROVED_BRAND_COLOURS", colors },
      context,
    );
    expect(result.themeOverride?.colors).toEqual(colors);
    expect(() =>
      applyDesignOperation(
        homepage,
        {
          type: "APPLY_APPROVED_BRAND_COLOURS",
          colors: { ...colors, accent: "gold" },
        },
        context,
      ),
    ).toThrow();
  });

  it("adds, removes and reorders optional compatible sections", () => {
    const added = applyDesignOperation(
      homepage,
      {
        type: "ADD_APPROVED_SECTION",
        sectionId: "section_home_campaign_second",
        component: "campaignBanner",
        variant: "minimal",
      },
      context,
    );
    expect(added.sections.at(-2)).toEqual(
      expect.objectContaining({ id: "section_home_campaign_second", variant: "minimal" }),
    );
    const removed = applyDesignOperation(
      added,
      { type: "REMOVE_OPTIONAL_SECTION", sectionId: "section_home_campaign_second" },
      context,
    );
    expect(removed).toEqual(homepage);

    const ids = homepage.sections.map((item) => item.id);
    const campaignIndex = ids.indexOf(section("campaignBanner").id);
    const storyIndex = ids.indexOf(section("brandStory").id);
    [ids[campaignIndex], ids[storyIndex]] = [ids[storyIndex], ids[campaignIndex]];
    const reordered = applyDesignOperation(
      homepage,
      { type: "REORDER_SECTIONS", sectionIds: ids },
      context,
    );
    expect(reordered.sections.map((item) => item.id)).toEqual(ids);
  });

  it("rejects invalid commands, variants, tokens and PageType placement", () => {
    expect(() =>
      applyDesignOperation(
        homepage,
        {
          type: "ADD_APPROVED_SECTION",
          sectionId: "section_unknown",
          component: "unsafeEmbed",
        },
        context,
      ),
    ).toThrow(/Unknown storefront component/);
    expect(() =>
      applyDesignOperation(
        homepage,
        {
          type: "CHANGE_SECTION_VARIANT",
          sectionId: section("campaignBanner").id,
          variant: "freeform",
        },
        context,
      ),
    ).toThrow(/Unsupported/);
    expect(() =>
      applyDesignOperation(
        homepage,
        {
          type: "CHANGE_BACKGROUND",
          sectionId: section("campaignBanner").id,
          background: "neon",
        },
        context,
      ),
    ).toThrow();
    expect(() =>
      applyDesignOperation(
        homepage,
        {
          type: "ADD_APPROVED_SECTION",
          sectionId: "section_collection_header_on_home",
          component: "collectionHeader",
        },
        context,
      ),
    ).toThrow(/not allowed on home/);
  });

  it("preserves required global composition", () => {
    expect(() =>
      applyDesignOperation(
        homepage,
        { type: "REMOVE_OPTIONAL_SECTION", sectionId: section("header").id },
        context,
      ),
    ).toThrow(/required header/);
    const ids = homepage.sections.map((item) => item.id);
    const footer = ids.pop()!;
    ids.splice(2, 0, footer);
    expect(() =>
      applyDesignOperation(homepage, { type: "REORDER_SECTIONS", sectionIds: ids }, context),
    ).toThrow(/footer must remain/);
  });

  it("cannot edit or invent protected catalogue commerce data", () => {
    const originalGrid = structuredClone(section("productGrid"));
    const result = applyDesignOperation(
      homepage,
      {
        type: "CHANGE_BACKGROUND",
        sectionId: originalGrid.id,
        background: "primary",
      },
      context,
    );
    const changedGrid = result.sections.find((item) => item.id === originalGrid.id)!;
    expect(changedGrid.content).toEqual(originalGrid.content);
    expect(changedGrid.content.productIds).toEqual(originalGrid.content.productIds);
    expect(() =>
      applyDesignOperation(
        homepage,
        {
          type: "CHANGE_LOCALIZED_SECTION_TEXT",
          sectionId: originalGrid.id,
          field: "productIds",
          locale: "en",
          value: "product_fake",
        },
        context,
      ),
    ).toThrow(/not approved localized/);
  });

  it("generates deterministic complete homepage redesign operations", () => {
    const withoutCampaign = applyDesignOperation(
      homepage,
      { type: "REMOVE_OPTIONAL_SECTION", sectionId: section("campaignBanner").id },
      context,
    );
    const intent = {
      direction: "luxury" as const,
      includeCampaign: true,
      campaignSectionId: "section_home_campaign_luxury",
    };
    const first = generateHomepageRedesign(withoutCampaign, intent, context);
    const second = generateHomepageRedesign(withoutCampaign, intent, context);
    expect(first).toEqual(second);
    expect(first.operations).toContainEqual(
      expect.objectContaining({
        type: "ADD_APPROVED_SECTION",
        component: "campaignBanner",
        variant: "imageOverlay",
      }),
    );
    expect(first.page.sections.some((item) => item.id === "section_home_campaign_luxury")).toBe(
      true,
    );
    expect(first.page.sections.find((item) => item.component === "header")!.variant).toBe(
      "transparent",
    );
  });
});
