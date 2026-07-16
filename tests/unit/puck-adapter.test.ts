import { describe, expect, it } from "vitest";
import { veskifyComponentRegistry } from "@/components/registry";
import {
  initialPuckData,
  validatePuckDraftPayload,
  veskifyPuckConfig,
} from "@/integrations/puck/config";

describe("Veskify Puck adapter", () => {
  it("exposes only the approved AurumHero component in the minimal proof config", () => {
    expect(Object.keys(veskifyPuckConfig.components)).toEqual(
      Object.keys(veskifyComponentRegistry),
    );
    expect(veskifyPuckConfig.components.hero?.label).toBe("Aurum hero");
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
});
