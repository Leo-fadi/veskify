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

  it("derives renderer surface and action roles from the canonical BrandSystem", () => {
    const brand = brandSystemSchema.parse({
      ...aurumNordicBrandSystem,
      colors: {
        primary: "#B54708",
        secondary: "#111111",
        accent: "#B54708",
        background: "#FFFFFF",
        surface: "#FFFFFF",
        text: "#111111",
        mutedText: "#111111",
        border: "#111111",
      },
    });

    expect(brandSystemToCssVariables(brand)).toMatchObject({
      "--brand-surface-page": "#FFFFFF",
      "--brand-surface-section": "#FFFFFF",
      "--brand-surface-subtle": "color-mix(in srgb, #FFFFFF 72%, #FFFFFF)",
      "--brand-action-primary": "#B54708",
      "--brand-action-primary-text": "#FFFFFF",
      "--brand-action-disabled-surface": "#FFFFFF",
      "--brand-action-disabled-text": "#111111",
      "--brand-action-disabled-border": "#111111",
      "--brand-highlight": "#B54708",
    });
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
