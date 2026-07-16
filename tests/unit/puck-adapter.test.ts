import { describe, expect, it } from "vitest";
import {
  designVocabularyVariants,
  getComponentDefinition,
  veskifyComponentRegistry,
} from "@/components/registry";
import { aurumNordicSeed } from "@/data/seed";
import {
  editorPropsToSection,
  generateVeskifyPuckConfig,
  initialPuckData,
  pageToPuckData,
  safePuckPreviewContext,
  sectionToPuckProps,
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
    expect(Object.keys(veskifyPuckConfig.components.hero?.fields ?? {})).toEqual([
      "variant",
      ...Object.keys(veskifyComponentRegistry.hero.editorFields),
    ]);
  });

  it("derives variant selectors, defaults insertions, and preserves canonical variants", () => {
    const definition = getComponentDefinition("announcementBar");
    const config = generateVeskifyPuckConfig(undefined, "home");
    expect(config.components.announcementBar?.fields?.variant).toMatchObject({
      type: "select",
      options: definition.variants.map((variant) => ({ label: variant, value: variant })),
    });
    expect(toPuckDefaults(definition).variant).toBe(definition.defaultVariant);

    const canonical = {
      id: "section_canonical_announcement",
      component: "announcementBar",
      variant: "bold",
      visible: true,
      content: definition.defaultContent,
      props: definition.defaultProps,
    };
    const editorProps = sectionToPuckProps(definition, canonical);
    expect(editorProps.variant).toBe("bold");
    expect(editorPropsToSection(definition, editorProps, "home").variant).toBe("bold");
    expect(() =>
      editorPropsToSection(definition, { ...editorProps, variant: "unsupported" }, "home"),
    ).toThrow(/Unsupported announcementBar variant/);
  });

  it("exposes every vocabulary variant only on an allowed page-scoped Puck surface", () => {
    for (const [component, variants] of Object.entries(designVocabularyVariants)) {
      const definition = getComponentDefinition(component);
      const pageType = definition.allowedPageTypes[0];
      const config = generateVeskifyPuckConfig(undefined, pageType);
      expect(config.components[component]?.fields?.variant).toMatchObject({
        type: "select",
        options: variants.map((variant) => ({ label: variant, value: variant })),
      });
      const disallowedPage = (["home", "collection", "product"] as const).find(
        (candidate) => !definition.allowedPageTypes.includes(candidate),
      );
      if (disallowedPage) {
        expect(generateVeskifyPuckConfig(undefined, disallowedPage).components).not.toHaveProperty(
          component,
        );
      }
    }
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

  it("maps canonical pages without exposing protected product fields", () => {
    const page = aurumNordicSeed.draftSnapshot.pages.find((item) => item.type === "product")!;
    const data = pageToPuckData(page, safePuckPreviewContext);
    expect(data.content.map((item) => item.type)).toEqual(
      page.sections.map((section) => section.component),
    );
    const productInfo = data.content.find((item) => item.type === "productInfo")!;
    expect(productInfo.props).toEqual(
      expect.objectContaining({
        variant: page.sections.find((section) => section.component === "productInfo")!.variant,
      }),
    );
    expect(productInfo.props).not.toHaveProperty("price");
    expect(productInfo.props).not.toHaveProperty("sku");
    expect(productInfo.props).not.toHaveProperty("stockStatus");
    expect(productInfo.props).not.toHaveProperty("images");
    expect(productInfo.props).toEqual(
      expect.objectContaining({
        __veskifyContent: page.sections.find((section) => section.component === "productInfo")!
          .content,
      }),
    );
  });
});
