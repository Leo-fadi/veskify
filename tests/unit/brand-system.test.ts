import { describe, expect, it } from "vitest";
import {
  aurumNordicBrandSystem,
  brandSystemSchema,
  brandSystemToCssVariables,
  fontTokenSchema,
} from "@/domain/design-system";

describe("BrandSystem schema", () => {
  it("accepts the Aurum Nordic demo brand and emits CSS variables", () => {
    const brand = brandSystemSchema.parse(aurumNordicBrandSystem);
    const variables = brandSystemToCssVariables(brand);

    expect(variables["--brand-color-primary"]).toBe("#8A5A2B");
    expect(variables["--brand-font-heading"]).toContain("Georgia");
    expect(variables["--brand-radius"]).toBe("0.75rem");
  });

  it("rejects unapproved fonts, invalid colours and unsupported token values", () => {
    expect(() => fontTokenSchema.parse("comic-sans")).toThrow();
    expect(() =>
      brandSystemSchema.parse({
        ...aurumNordicBrandSystem,
        colors: { ...aurumNordicBrandSystem.colors, primary: "gold" },
      }),
    ).toThrow();
    expect(() =>
      brandSystemSchema.parse({
        ...aurumNordicBrandSystem,
        spacing: { density: "huge" },
      }),
    ).toThrow();
  });

  it("rejects typography outside controlled scale limits", () => {
    expect(() =>
      brandSystemSchema.parse({
        ...aurumNordicBrandSystem,
        typography: { ...aurumNordicBrandSystem.typography, baseSize: 28 },
      }),
    ).toThrow();
  });
});
