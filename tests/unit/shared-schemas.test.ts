import { describe, expect, it } from "vitest";
import {
  assetRefSchema,
  idSchema,
  isoDateTimeSchema,
  localizedSeoSchema,
  localizedTextSchema,
  safeExternalUrlSchema,
} from "@/domain/shared";

describe("shared schemas", () => {
  it("accepts canonical ids, ISO datetimes, localized text and SEO", () => {
    expect(idSchema.parse("page_home-1")).toBe("page_home-1");
    expect(isoDateTimeSchema.parse("2026-07-15T12:00:00.000Z")).toBe("2026-07-15T12:00:00.000Z");
    expect(localizedTextSchema.parse({ en: "Fine jewellery", fi: "Korut" })).toEqual({
      en: "Fine jewellery",
      fi: "Korut",
    });
    expect(
      localizedSeoSchema.parse({ title: { en: "Aurum Nordic" }, metaDescription: { fi: "Pohjoista tyyliä" } }),
    ).toBeTruthy();
  });

  it("rejects unsafe ids, empty locale maps, debug locale keys and non-HTTPS external URLs", () => {
    expect(() => idSchema.parse("Bad ID!")).toThrow();
    expect(() => localizedTextSchema.parse({})).toThrow();
    expect(() => localizedTextSchema.parse({ sv: "Hej" })).toThrow();
    expect(() => safeExternalUrlSchema.parse("http://example.com/image.jpg")).toThrow();
  });

  it("requires alt text unless an asset is decorative", () => {
    expect(
      assetRefSchema.parse({ id: "asset_hero", url: "/assets/hero.jpg", alt: { en: "Gold ring" } }),
    ).toMatchObject({ decorative: false });
    expect(assetRefSchema.parse({ id: "asset_bg", url: "/images/bg.png", decorative: true })).toBeTruthy();
    expect(() => assetRefSchema.parse({ id: "asset_missing", url: "/assets/missing.jpg" })).toThrow();
  });
});
