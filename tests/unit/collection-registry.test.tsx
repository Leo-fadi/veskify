import { describe, expect, it } from "vitest";
import {
  collectionHeaderDefinition,
  collectionHeaderContentSchema,
  collectionHeaderPropsSchema,
  createStorefrontRenderContext,
  filterBarContentSchema,
  filterBarDefinition,
  filterBarPropsSchema,
} from "@/components/registry";
import { aurumNordicSeed } from "@/data/seed";
import { generateVeskifyPuckConfig } from "@/integrations/puck/config";

const context = createStorefrontRenderContext({
  activeLocale: "en",
  primaryLocale: "en",
  catalogue: aurumNordicSeed.catalogue,
  snapshot: aurumNordicSeed.draftSnapshot,
});

const collectionHeader = {
  id: "section_test_collection_header",
  component: "collectionHeader",
  variant: "editorial",
  visible: true,
  content: { collectionId: "collection_rings" },
  props: { mediaPosition: "right" },
};

const filterBar = {
  id: "section_test_filter_bar",
  component: "filterBar",
  variant: "horizontal",
  visible: true,
  content: { filters: ["material", "metalColour", "price", "availability", "stoneShape"] },
  props: { demoOnly: true },
};

describe("collection registry definitions", () => {
  it("uses strict schemas and validated defaults", () => {
    expect(collectionHeaderContentSchema.parse(collectionHeaderDefinition.defaultContent)).toEqual({
      collectionId: "collection_rings",
    });
    expect(collectionHeaderPropsSchema.parse(collectionHeaderDefinition.defaultProps)).toEqual({
      mediaPosition: "right",
    });
    expect(filterBarContentSchema.parse(filterBarDefinition.defaultContent).filters).toHaveLength(
      5,
    );
    expect(filterBarPropsSchema.parse(filterBarDefinition.defaultProps)).toEqual({
      demoOnly: true,
    });
    expect(() =>
      collectionHeaderContentSchema.parse({ collectionId: "collection_rings", title: "duplicate" }),
    ).toThrow();
    expect(() =>
      filterBarContentSchema.parse({ filters: ["material"], arbitrary: true }),
    ).toThrow();
  });

  it("accepts only supported variants and collection pages", () => {
    expect(collectionHeaderDefinition.validate(collectionHeader, "collection", context)).toBe(
      collectionHeader,
    );
    expect(filterBarDefinition.validate(filterBar, "collection", context)).toBe(filterBar);
    expect(() =>
      collectionHeaderDefinition.validate(
        { ...collectionHeader, variant: "split" },
        "collection",
        context,
      ),
    ).toThrow(/Unsupported/);
    expect(() => filterBarDefinition.validate(filterBar, "home", context)).toThrow(/not allowed/);
  });

  it("rejects unknown collection references and filter tokens", () => {
    expect(() =>
      collectionHeaderDefinition.validate(
        { ...collectionHeader, content: { collectionId: "collection_missing" } },
        "collection",
        context,
      ),
    ).toThrow(/Unknown collection reference/);
    expect(() =>
      filterBarDefinition.validate(
        { ...filterBar, content: { filters: ["brand"] } },
        "collection",
        context,
      ),
    ).toThrow();
  });

  it("protects canonical and commerce data and remains Puck-config derived", () => {
    expect(collectionHeaderDefinition.protectedFields.readOnlyPaths).toContain("collectionId");
    expect(filterBarDefinition.protectedFields.readOnlyPaths).toContain(
      "catalogue.products.*.price",
    );
    const config = generateVeskifyPuckConfig(undefined, "collection");
    expect(config.components).toHaveProperty("collectionHeader");
    expect(config.components).toHaveProperty("filterBar");
  });
});
