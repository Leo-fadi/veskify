import { describe, expect, it } from "vitest";
import { initialPuckData, validatePuckDraftPayload, veskifyPuckConfig } from "@/integrations/puck/config";

describe("Veskify Puck adapter", () => {
  it("exposes only the approved AurumHero component in the minimal proof config", () => {
    expect(Object.keys(veskifyPuckConfig.components)).toEqual(["AurumHero"]);
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
