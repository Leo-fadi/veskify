import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const panelSource = readFileSync(
  resolve(process.cwd(), "src/components/onboarding/storefront-generation-review-panel.tsx"),
  "utf8",
);

describe("storefront generation review panel boundary", () => {
  it("consumes only the canonical review contract and stays presentation-only", () => {
    expect(panelSource).toContain("@/application/storefront-generation-review/contract");
    expect(panelSource).not.toMatch(
      /from ["']@\/application\/storefront-generation-review["']|from ["']@\/application\/storefront-generation-review\/projection["']|guided-storefront-generation|brand-foundation|storefront-templates|materialization|ProjectRepository|IndexedDB|@puckeditor|integrations\/puck/,
    );
  });
});
