import { describe, expect, it } from "vitest";
import { getComponentDefinition, veskifyComponentRegistry } from "@/components/registry";
import {
  editorPropsToSection,
  initialPuckData,
  toPuckDefaults,
  validatePuckDraftPayload,
  veskifyPuckConfig,
} from "@/integrations/puck/config";

describe("Veskify Puck adapter", () => {
  it("derives all approved homepage components from the Veskify registry", () => {
    expect(Object.keys(veskifyPuckConfig.components)).toEqual(
      Object.keys(veskifyComponentRegistry),
    );
    expect(veskifyPuckConfig.components.hero?.label).toBe("Aurum hero");
    expect(Object.keys(veskifyPuckConfig.components)).toHaveLength(17);
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
});
