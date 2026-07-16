import { describe, expect, it } from "vitest";
import { createStorefrontRenderContext, getComponentDefinition } from "@/components/registry";
import { aurumNordicSeed } from "@/data/seed";
import type { Locale } from "@/domain/shared";
import type { PageModel } from "@/domain/storefront";
import { pageToPuckData, puckDataToPage, toPuckDefaults } from "@/integrations/puck/config";

const page = (type: PageModel["type"]) =>
  structuredClone(aurumNordicSeed.draftSnapshot.pages.find((item) => item.type === type)!);
const context = (activeLocale: Locale = "en") =>
  createStorefrontRenderContext({
    activeLocale,
    primaryLocale: "en",
    catalogue: aurumNordicSeed.catalogue,
    snapshot: aurumNordicSeed.draftSnapshot,
  });
const dataFor = (value: PageModel, locale: Locale = "en") =>
  structuredClone(pageToPuckData(value, context(locale)));
const item = (data: ReturnType<typeof dataFor>, type: string) =>
  data.content.find((entry) => entry.type === type)!;
const itemProps = (data: ReturnType<typeof dataFor>, type: string): Record<string, unknown> => {
  const value: unknown = item(data, type).props;
  return value as Record<string, unknown>;
};
const insertedItem = (type: string, id: string) => {
  const definition = getComponentDefinition(type);
  return {
    type,
    props: {
      id,
      variant: definition.defaultVariant,
      ...toPuckDefaults(definition),
    },
  };
};

describe("P2-03 canonical Puck editing adapter", () => {
  it("applies an approved localized field only to the active locale", () => {
    const original = page("home");
    const data = dataFor(original, "fi");
    itemProps(data, "hero").title = "Muokattu otsikko";
    const proposed = puckDataToPage(data, original, context("fi"));
    const originalHero = original.sections.find((section) => section.component === "hero")!;
    const proposedHero = proposed.sections.find((section) => section.component === "hero")!;
    expect(proposedHero.content.title).toEqual({
      ...(originalHero.content.title as Record<string, unknown>),
      fi: "Muokattu otsikko",
    });
    expect(originalHero.content.title).not.toEqual(proposedHero.content.title);
  });

  it("inserts a page-compatible optional section from registered defaults", () => {
    const original = page("home");
    const data = dataFor(original);
    data.content.splice(
      data.content.length - 1,
      0,
      insertedItem("campaignBanner", "section_inserted_campaign"),
    );
    const proposed = puckDataToPage(data, original, context());
    expect(proposed.sections.at(-2)).toMatchObject({
      id: "section_inserted_campaign",
      component: "campaignBanner",
      variant: "split",
    });
  });

  it("rejects insertion of a component from another page type", () => {
    const original = page("home");
    const data = dataFor(original);
    data.content.splice(
      data.content.length - 1,
      0,
      insertedItem("productInfo", "section_cross_page_product"),
    );
    expect(() => puckDataToPage(data, original, context())).toThrow(/not allowed on home/);
  });

  it("reorders and removes optional sections while retaining required regions", () => {
    const original = page("home");
    const reorderedData = dataFor(original);
    const firstOptional = reorderedData.content[2];
    reorderedData.content[2] = reorderedData.content[3];
    reorderedData.content[3] = firstOptional;
    const reordered = puckDataToPage(reorderedData, original, context());
    expect(reordered.sections.slice(2, 4).map((section) => section.id)).toEqual([
      original.sections[3].id,
      original.sections[2].id,
    ]);

    const removalData = dataFor(original);
    const campaignIndex = removalData.content.findIndex((entry) => entry.type === "campaignBanner");
    removalData.content.splice(campaignIndex, 1);
    const removed = puckDataToPage(removalData, original, context());
    expect(removed.sections).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ component: "campaignBanner" })]),
    );
  });

  it("protects required header and footer from removal, duplication and unsafe movement", () => {
    const original = page("home");
    for (const component of ["header", "footer"]) {
      const removed = dataFor(original);
      removed.content = removed.content.filter((entry) => entry.type !== component);
      expect(() => puckDataToPage(removed, original, context())).toThrow(/required/);

      const duplicated = dataFor(original);
      duplicated.content.splice(
        duplicated.content.length - 1,
        0,
        insertedItem(component, `section_duplicate_${component}`),
      );
      expect(() => puckDataToPage(duplicated, original, context())).toThrow();
    }

    const moved = dataFor(original);
    const footer = moved.content.pop()!;
    moved.content.splice(2, 0, footer);
    expect(() => puckDataToPage(moved, original, context())).toThrow(/protected region/);
  });

  it("accepts registered variants and rejects malformed variant or props", () => {
    const original = page("home");
    const valid = dataFor(original);
    itemProps(valid, "hero").variant = "editorial";
    expect(
      puckDataToPage(valid, original, context()).sections.find(
        (section) => section.component === "hero",
      )?.variant,
    ).toBe("editorial");

    const invalidVariant = dataFor(original);
    itemProps(invalidVariant, "hero").variant = "arbitraryHtml";
    expect(() => puckDataToPage(invalidVariant, original, context())).toThrow(/Unsupported/);

    const invalidProps = dataFor(original);
    itemProps(invalidProps, "hero").title = { executable: "<script>" };
    expect(() => puckDataToPage(invalidProps, original, context())).toThrow();
  });

  it("rejects protected product identity and catalogue-media tampering", () => {
    const original = page("product");
    for (const mutation of [
      (props: Record<string, unknown>) => {
        const content = structuredClone(props.__veskifyContent) as Record<string, unknown>;
        content.productId = "product_lumi_halo_ring";
        props.__veskifyContent = content;
      },
      (props: Record<string, unknown>) => {
        props.price = { amount: 1, currency: "EUR" };
      },
    ]) {
      const data = dataFor(original);
      mutation(itemProps(data, "productInfo"));
      expect(() => puckDataToPage(data, original, context())).toThrow(/Protected|not editable/);
    }
  });
});
