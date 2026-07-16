import { describe, expect, it } from "vitest";
import { getComponentDefinition, veskifyComponentRegistry } from "@/components/registry";
import {
  editorPropsToSection,
  generateVeskifyPuckConfig,
  initialPuckData,
  toPuckDefaults,
  validatePuckDraftPayload,
  veskifyPuckConfig,
} from "@/integrations/puck/config";

describe("Veskify Puck adapter", () => {
  it("derives a page-scoped homepage config from the registry", () => {
    const expected = Object.values(veskifyComponentRegistry)
      .filter((definition) => definition.allowedPageTypes.includes("home"))
      .map((definition) => definition.type);
    expect(Object.keys(veskifyPuckConfig.components)).toEqual(expected);
    expect(veskifyPuckConfig.components.hero?.label).toBe("Aurum hero");
    expect(veskifyPuckConfig.components).not.toHaveProperty("productGallery");
    expect(veskifyPuckConfig.components).not.toHaveProperty("collectionHeader");
    expect(Object.keys(veskifyPuckConfig.components.hero?.fields ?? {})).toEqual(
      Object.keys(veskifyComponentRegistry.hero.editorFields),
    );
  });

  it("validates the initial Puck data for draft handoff", () => {
    expect(validatePuckDraftPayload(initialPuckData).content).toHaveLength(1);
  });

  it("rejects unknown Puck component output before draft handoff", () => {
    expect(() =>
      validatePuckDraftPayload({
        content: [{ type: "UnsafeEmbed", props: { html: "<script>alert(1)</script>" } }],
        root: { props: {} },
      }),
    ).toThrow();
  });

  it("preserves boolean product defaults for Puck insertion", () => {
    const definition = getComponentDefinition("productInfo");
    expect(toPuckDefaults(definition).showRating).toBe(true);
    const inserted = editorPropsToSection(definition, {
      id: "section_inserted_product_info",
      showRating: true,
    });
    expect(inserted.props.showRating).toBe(true);
    expect(typeof inserted.props.showRating).toBe("boolean");
  });

  it("preserves edited boolean values and rejects boolean strings", () => {
    const definition = getComponentDefinition("productInfo");
    const edited = editorPropsToSection(definition, {
      id: "section_edited_product_info",
      showRating: false,
    });
    expect(edited.props.showRating).toBe(false);
    expect(() =>
      definition.validate(
        editorPropsToSection(definition, {
          id: "section_invalid_product_info",
          showRating: "false",
        }),
      ),
    ).toThrow();
  });

  it("scopes product components to product Puck surfaces", () => {
    const productConfig = generateVeskifyPuckConfig(undefined, "product");
    const collectionConfig = generateVeskifyPuckConfig(undefined, "collection");
    expect(productConfig.components).toHaveProperty("productGallery");
    expect(collectionConfig.components).not.toHaveProperty("productGallery");
    expect(collectionConfig.components).toHaveProperty("collectionHeader");
    expect(productConfig.components).not.toHaveProperty("collectionHeader");
    expect(productConfig.components).not.toHaveProperty("announcementBar");
  });

  it("rejects cross-page Puck payloads and accepts canonical product placement", () => {
    const productGallery = getComponentDefinition("productGallery");
    const galleryItem = {
      type: "productGallery",
      props: { id: "section_puck_product_gallery", ...toPuckDefaults(productGallery) },
    };
    const galleryPayload = { content: [galleryItem], root: { props: {} } };
    expect(() => validatePuckDraftPayload(galleryPayload, undefined, "home")).toThrow(
      /not allowed on home/,
    );
    expect(() => validatePuckDraftPayload(galleryPayload, undefined, "collection")).toThrow(
      /not allowed on collection/,
    );
    expect(validatePuckDraftPayload(galleryPayload, undefined, "product").content).toHaveLength(1);

    const announcement = getComponentDefinition("announcementBar");
    expect(() =>
      validatePuckDraftPayload(
        {
          content: [
            {
              type: "announcementBar",
              props: { id: "section_puck_announcement", ...toPuckDefaults(announcement) },
            },
          ],
          root: { props: {} },
        },
        undefined,
        "product",
      ),
    ).toThrow(/not allowed on product/);

    const collectionHeader = getComponentDefinition("collectionHeader");
    const collectionPayload = {
      content: [
        {
          type: "collectionHeader",
          props: { id: "section_puck_collection_header", ...toPuckDefaults(collectionHeader) },
        },
      ],
      root: { props: {} },
    };
    expect(() => validatePuckDraftPayload(collectionPayload, undefined, "home")).toThrow(
      /not allowed on home/,
    );
    expect(() => validatePuckDraftPayload(collectionPayload, undefined, "product")).toThrow(
      /not allowed on product/,
    );
    expect(
      validatePuckDraftPayload(collectionPayload, undefined, "collection").content,
    ).toHaveLength(1);
  });
});
