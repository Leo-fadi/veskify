import { describe, expect, it } from "vitest";
import { orderSectionsForRecipe } from "@/application/storefront-design-system";

type Section = { id: string; component: string };

const section = (id: string, component: string): Section => ({ id, component });
const identifiers = (sections: readonly Section[]) => sections.map((item) => item.id);

describe("registered recipe section ordering", () => {
  it("orders unique component families into their registered recipe positions", () => {
    const recipe = {
      sections: [
        section("slot-header", "header"),
        section("slot-products", "productGrid"),
        section("slot-story", "brandStory"),
        section("slot-footer", "footer"),
      ],
    };
    const source = [
      section("header", "header"),
      section("story", "brandStory"),
      section("products", "productGrid"),
      section("footer", "footer"),
    ];

    expect(identifiers(orderSectionsForRecipe(source, recipe))).toEqual([
      "header",
      "products",
      "story",
      "footer",
    ]);
  });

  it("keeps an already-correct repeated-family sequence unchanged", () => {
    const recipe = {
      sections: [
        section("slot-header", "header"),
        section("slot-campaign-intro", "campaignBanner"),
        section("slot-products", "productGrid"),
        section("slot-campaign-close", "campaignBanner"),
        section("slot-footer", "footer"),
      ],
    };
    const source = [
      section("header", "header"),
      section("campaign-intro", "campaignBanner"),
      section("products", "productGrid"),
      section("campaign-close", "campaignBanner"),
      section("footer", "footer"),
    ];

    expect(identifiers(orderSectionsForRecipe(source, recipe))).toEqual(identifiers(source));
  });

  it("orders repeated component families by recipe occurrence without collapsing identities", () => {
    const recipe = {
      sections: [
        section("slot-header", "header"),
        section("slot-campaign-intro", "campaignBanner"),
        section("slot-products", "productGrid"),
        section("slot-campaign-close", "campaignBanner"),
        section("slot-footer", "footer"),
      ],
    };
    const source = [
      section("header", "header"),
      section("campaign-intro", "campaignBanner"),
      section("campaign-close", "campaignBanner"),
      section("products", "productGrid"),
      section("footer", "footer"),
    ];

    expect(identifiers(orderSectionsForRecipe(source, recipe))).toEqual([
      "header",
      "campaign-intro",
      "products",
      "campaign-close",
      "footer",
    ]);
  });

  it("keeps excess, missing, and unmatched sections at their stable source positions", () => {
    const recipe = {
      sections: [
        section("slot-header", "header"),
        section("slot-campaign-intro", "campaignBanner"),
        section("slot-products", "productGrid"),
        section("slot-campaign-close", "campaignBanner"),
        section("slot-footer", "footer"),
      ],
    };
    const excess = [
      section("header", "header"),
      section("campaign-intro", "campaignBanner"),
      section("campaign-close", "campaignBanner"),
      section("campaign-extra", "campaignBanner"),
      section("products", "productGrid"),
      section("footer", "footer"),
    ];
    const missingAndUnmatched = [
      section("header", "header"),
      section("notice", "legalNotice"),
      section("campaign-intro", "campaignBanner"),
      section("products", "productGrid"),
      section("footer", "footer"),
    ];

    expect(identifiers(orderSectionsForRecipe(excess, recipe))).toEqual([
      "header",
      "campaign-intro",
      "products",
      "campaign-extra",
      "campaign-close",
      "footer",
    ]);
    expect(identifiers(orderSectionsForRecipe(missingAndUnmatched, recipe))).toEqual(
      identifiers(missingAndUnmatched),
    );
  });
});
