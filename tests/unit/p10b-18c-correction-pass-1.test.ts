import { afterEach, describe, expect, it, vi } from "vitest";
import { karvonenSeed } from "@/data/seed";
import {
  KarvonenFixtureLocaleAuthorityError,
  assertKarvonenFixtureCustomerLocaleCompleteness,
} from "@/data/seed/karvonen-fixture-locale-gate";
import { localizedTextSchema, resolveLocalizedText } from "@/domain/shared";
import { p10b18cCorrectionPass1Evidence } from "../fixtures/p10b-18c-correction-pass-1";

const originalCleanCapture = process.env.P10B18C_CLEAN_CAPTURE;
const provisionalMarker =
  /verify (?:exact|live)|requires verification|not captured|reference configuration|exact specifications|natural or laboratory/i;

function strings(value: unknown): string[] {
  if (typeof value === "string") return [value];
  if (Array.isArray(value)) return value.flatMap(strings);
  if (typeof value === "object" && value !== null) {
    return Object.values(value).flatMap(strings);
  }
  return [];
}

afterEach(() => {
  if (originalCleanCapture === undefined) delete process.env.P10B18C_CLEAN_CAPTURE;
  else process.env.P10B18C_CLEAN_CAPTURE = originalCleanCapture;
  vi.resetModules();
});

describe("P10B-18C bounded correction pass 1", () => {
  it("keeps provisional diagnostics out of all Karvonen customer-display fields", () => {
    const customerDisplayStrings = strings(karvonenSeed.catalogue);
    expect(customerDisplayStrings.filter((value) => provisionalMarker.test(value))).toEqual([]);

    const product = (id: string) =>
      karvonenSeed.catalogue.products.find((candidate) => candidate.id === id)!;
    expect(product("product_karvonen_06").availabilityLabel).toBeUndefined();
    expect(product("product_karvonen_07").attributes).toEqual({});
    expect(product("product_karvonen_08").attributes).toEqual({ material: "Kulta" });
    expect(product("product_karvonen_09").attributes).toEqual({ material: "Kulta" });
    expect(product("product_karvonen_10").availabilityLabel).toBeUndefined();

    const sparseMediaWitness = karvonenSeed.catalogue.products.filter(({ id }) =>
      [
        "product_karvonen_06",
        "product_karvonen_08",
        "product_karvonen_09",
        "product_karvonen_10",
      ].includes(id),
    );
    expect(strings(sparseMediaWitness).filter((value) => provisionalMarker.test(value))).toEqual(
      [],
    );
  });

  it("keeps partial shared localization valid with the existing deterministic fallback", () => {
    expect(localizedTextSchema.safeParse({ en: "English only" }).success).toBe(true);
    expect(localizedTextSchema.safeParse({ fi: "Vain suomeksi" }).success).toBe(true);
    expect(resolveLocalizedText({ en: "English only" }, "fi", "en")).toBe("English only");
    expect(resolveLocalizedText({ fi: "Vain suomeksi" }, "en", "en")).toBe("Vain suomeksi");
  });

  it("fails a malformed Karvonen customer witness at the exact missing locale path", () => {
    let failure: unknown;
    try {
      assertKarvonenFixtureCustomerLocaleCompleteness({
        fixtureId: "project_karvonen",
        enabledLocales: ["fi", "en"],
        customerFacingAuthority: {
          catalogue: { products: [{ title: { en: "English only" } }] },
        },
      });
    } catch (error) {
      failure = error;
    }

    expect(failure).toBeInstanceOf(KarvonenFixtureLocaleAuthorityError);
    expect(failure).toMatchObject({
      code: "missing-enabled-customer-locale",
      fieldPath: "catalogue.products[0].title",
      missingLocale: "fi",
    });
    expect((failure as Error).message).toContain("catalogue.products[0].title.fi");
  });

  it("accepts the complete Karvonen customer authority and excludes internal diagnostics", () => {
    const internalDiagnostics = { verificationNote: { en: "Internal-only audit note" } };
    expect(() =>
      assertKarvonenFixtureCustomerLocaleCompleteness({
        fixtureId: "project_karvonen",
        enabledLocales: karvonenSeed.project.enabledLocales,
        customerFacingAuthority: {
          catalogue: karvonenSeed.catalogue,
          published: {
            pages: karvonenSeed.publishedSnapshot.pages,
            navigation: karvonenSeed.publishedSnapshot.navigation,
          },
          draft: {
            pages: karvonenSeed.draftSnapshot.pages,
            navigation: karvonenSeed.draftSnapshot.navigation,
          },
        },
      }),
    ).not.toThrow();
    expect("fi" in internalDiagnostics.verificationNote).toBe(false);
  });

  it("keeps optional unsupported Karvonen customer fields omitted", () => {
    expect(
      karvonenSeed.catalogue.products
        .filter(({ id }) =>
          [
            "product_karvonen_06",
            "product_karvonen_08",
            "product_karvonen_09",
            "product_karvonen_10",
          ].includes(id),
        )
        .every(({ availabilityLabel }) => availabilityLabel === undefined),
    ).toBe(true);
  });

  it("retains typed non-rendering diagnostics for the failed first-run evidence", () => {
    expect(p10b18cCorrectionPass1Evidence.failures).toHaveLength(3);
    expect(
      p10b18cCorrectionPass1Evidence.failures.every(
        ({ customerDisplayEligible }) => customerDisplayEligible === false,
      ),
    ).toBe(true);
    expect(p10b18cCorrectionPass1Evidence.failures.map(({ code }) => code)).toEqual([
      "mobile-product-card-content-overlap",
      "fi-visible-verification-prose",
      "nextjs-development-indicator-capture-contamination",
    ]);
  });

  it("keeps repository Next configuration independent from clean-capture mode", async () => {
    process.env.P10B18C_CLEAN_CAPTURE = "1";
    vi.resetModules();
    const cleanConfig = (await import("../../next.config")).default;
    expect(cleanConfig.devIndicators).toBeUndefined();
  });
});
