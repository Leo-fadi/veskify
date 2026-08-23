// @vitest-environment node

import { beforeAll, describe, expect, it, vi } from "vitest";
import { canonicalValueFingerprint } from "@/domain/storefront";
import {
  P10B18C_STAGE_B_FINAL_SYNTHETIC_MERCHANT_TRUTH_FAILURE,
  P10B18C_STAGE_B_SYNTHETIC_FIXTURE_HUMAN_FAILURE,
} from "../fixtures/p10b-18c-neutral-synthetic-truth-correction";
import { createP10b18aShapeAuthorities } from "../helpers/p10b-18a-commercial-authority";
import {
  assertP10b18cFixtureCustomerTruth,
  createP10b18cShapeAuthorities,
  type P10b18cShapeAuthority,
} from "../helpers/p10b-18c-synthetic-fixture-truth";
import {
  compileP10b18cCase,
  materializeP10b18cCase,
  p10b18cSemanticStrata,
  type P10b18cMaterializedCase,
} from "../helpers/p10b-18c-commercial-quality";

const affectedShapeIds = ["mixed-jewellery-watch", "neutral-true-high-consideration"] as const;

const exactCaseIds = [
  "mixed-jewellery-watch--premium-campaign-image-led",
  "mixed-jewellery-watch--premium-editorial-alternative",
  "neutral-true-high-consideration--minimal-product-first",
  "neutral-true-high-consideration--modern-balanced-utility",
] as const;

const neutralCaseIds = [
  "neutral-true-high-consideration--minimal-product-first",
  "neutral-true-high-consideration--modern-balanced-utility",
] as const;
const neutralCustomerCategoryTerm = /(?:jewel|koru|demo|catalog|katalog)/i;

let cachedAffectedAuthorities: readonly P10b18cShapeAuthority[] | undefined;

function affectedAuthorities(): readonly P10b18cShapeAuthority[] {
  cachedAffectedAuthorities ??= createP10b18cShapeAuthorities(affectedShapeIds);
  return cachedAffectedAuthorities;
}

function optionShape(product: P10b18cShapeAuthority["catalogue"]["products"][number]) {
  return {
    orderOptions: (product.orderOptions ?? []).map((group) => ({
      id: group.id,
      type: group.type,
      required: group.required,
      maxLength: group.maxLength,
      valueCount: group.values?.length ?? 0,
    })),
    variants: product.variants.map((variant) => ({
      id: variant.id,
      price: variant.price,
      attributeCount: Object.keys(variant.attributes).length,
    })),
  };
}

function malformedAuthority(
  authority: P10b18cShapeAuthority,
  mutate: (catalogue: Record<string, unknown>) => Record<string, unknown>,
) {
  const catalogue = mutate(structuredClone(authority.catalogue));
  if (authority.fixtureTruthMetadata === null) throw new Error("Missing fixture truth metadata.");
  return {
    shapeId: authority.id,
    catalogue,
    siteMapDecision: authority.siteMapDecision,
    metadata: authority.fixtureTruthMetadata,
    internalDiagnostics: authority.fixtureTruthMetadata.internalDiagnostics,
  };
}

function localizedCustomerValues(value: unknown): string[] {
  if (value === null || typeof value !== "object") return [];
  if (Array.isArray(value)) return value.flatMap(localizedCustomerValues);
  const record = Object.fromEntries(Object.entries(value));
  if (
    ("en" in record || "fi" in record) &&
    Object.entries(record).every(
      ([key, entry]) => /^[a-z]{2}(?:-[A-Z]{2})?$/.test(key) && typeof entry === "string",
    )
  ) {
    return Object.values(record).filter((entry): entry is string => typeof entry === "string");
  }
  return Object.values(record).flatMap(localizedCustomerValues);
}

function neutralCustomerValues(authority: P10b18cShapeAuthority): string[] {
  const project = authority.aggregate.project;
  const brief = authority.compatibilityInput.planningInput.brief.businessIdentity;
  return [
    project.name,
    project.industry,
    project.businessProfile.name,
    project.businessProfile.description,
    project.businessProfile.audience,
    project.businessProfile.market,
    ...[
      brief.businessName,
      brief.shortDescription,
      brief.industry,
      brief.targetCustomer,
      brief.primaryMarket,
    ].filter((value): value is string => typeof value === "string"),
    ...localizedCustomerValues(authority.catalogue),
    ...localizedCustomerValues(authority.siteMapDecision),
    ...localizedCustomerValues(authority.compatibilityInput.planningInput.draft),
  ];
}

describe("P10B-18C bounded neutral-synthetic fixture customer truth", () => {
  it("preserves the failed 280-capture human review as typed first-run evidence", () => {
    expect(P10B18C_STAGE_B_SYNTHETIC_FIXTURE_HUMAN_FAILURE).toMatchObject({
      classification: "P10B-18C Stage B human FAIL — synthetic fixture customer-truth defects",
      captureCount: 280,
      contactSheetCount: 37,
      affectedFinnishCaptureCount: 26,
      affectedCaseIds: exactCaseIds,
    });
    expect(P10B18C_STAGE_B_FINAL_SYNTHETIC_MERCHANT_TRUTH_FAILURE).toMatchObject({
      classification: "P10B-18C Stage B human FAIL — stale synthetic merchant/catalogue identity",
      captureCount: 280,
      affectedCaptureCount: 4,
      affectedCaseIds: neutralCaseIds,
      affectedCaptureSequenceIndexes: [95, 98, 101, 104],
    });
  });

  it("derives corrected authority without mutating frozen P10B-18A authority", () => {
    const frozenBefore = createP10b18aShapeAuthorities(affectedShapeIds);
    const frozenFingerprintBefore = canonicalValueFingerprint(frozenBefore);
    const corrected = affectedAuthorities();
    const frozenAfter = createP10b18aShapeAuthorities(affectedShapeIds);

    expect(canonicalValueFingerprint(frozenAfter)).toBe(frozenFingerprintBefore);
    corrected.forEach((authority) => {
      const source = frozenBefore.find(({ id }) => id === authority.id);
      expect(source).toBeDefined();
      expect(authority.fixtureTruthRevision.revisionId).toBe(
        authority.id === "neutral-true-high-consideration"
          ? "p10b-18c-neutral-synthetic-customer-truth-r2"
          : "p10b-18c-neutral-synthetic-customer-truth-r1",
      );
      expect(authority.fixtureTruthRevision.sourceCatalogueFingerprint).toBe(
        source?.catalogueFingerprint,
      );
      expect(authority.fixtureTruthRevision.correctedCatalogueFingerprint).not.toBe(
        source?.catalogueFingerprint,
      );
      expect(authority.catalogue.products.map(({ id }) => id)).toEqual(
        source?.catalogue.products.map(({ id }) => id),
      );
      expect(
        authority.catalogue.collections.map(({ id, productIds }) => ({ id, productIds })),
      ).toEqual(source?.catalogue.collections.map(({ id, productIds }) => ({ id, productIds })));
      authority.catalogue.products.forEach((product, productIndex) => {
        const sourceProduct = source?.catalogue.products[productIndex];
        expect(sourceProduct).toBeDefined();
        expect(product.price).toEqual(sourceProduct?.price);
        expect(product.stockStatus).toEqual(sourceProduct?.stockStatus);
        expect(product.images).toHaveLength(sourceProduct?.images.length ?? -1);
        expect(optionShape(product)).toEqual(
          sourceProduct === undefined ? [] : optionShape(sourceProduct),
        );
      });
      if (authority.id === "mixed-jewellery-watch") {
        const variantKeys = authority.catalogue.products[0]?.variants.flatMap(({ attributes }) =>
          Object.keys(attributes),
        );
        expect(variantKeys).toEqual(["ringSize", "ringSize", "ringSize"]);
        expect(variantKeys).not.toContain("koko");
        expect(variantKeys).not.toContain("saatavuus");
        expect(variantKeys).not.toContain("Size");
        expect(variantKeys).not.toContain("size");
        expect(variantKeys).not.toContain("Availability");
        expect(variantKeys).not.toContain("availability");
      }
    });
  }, 120_000);

  it("accepts complete EN/FI customer truth and excludes internal diagnostics", () => {
    affectedAuthorities().forEach((authority) => {
      const metadata = authority.fixtureTruthMetadata;
      expect(metadata).not.toBeNull();
      if (metadata === null) return;
      expect(() =>
        assertP10b18cFixtureCustomerTruth({
          shapeId: authority.id,
          catalogue: authority.catalogue,
          siteMapDecision: authority.siteMapDecision,
          metadata,
          project: authority.aggregate.project,
          draft: authority.compatibilityInput.planningInput.draft,
          approvedBriefBusinessIdentity:
            authority.compatibilityInput.planningInput.brief.businessIdentity,
          internalDiagnostics: {
            audit: "test fixture deterministic verification configuration class",
          },
        }),
      ).not.toThrow();
    });
  });

  it("removes legacy jewellery and internal terminology from neutral customer authority", () => {
    const authority = affectedAuthorities().find(
      ({ id }) => id === "neutral-true-high-consideration",
    );
    if (authority === undefined) throw new Error("Missing corrected neutral authority.");
    const customerValues = neutralCustomerValues(authority);
    expect(customerValues).not.toContain("Karvosen korujen demo-katalogi.");
    customerValues.forEach((value) => {
      expect(value).not.toMatch(neutralCustomerCategoryTerm);
      expect(value).not.toMatch(
        /\b(?:audit|test|fixture|deterministic|verification|internal|synthetic)\b/i,
      );
    });
    expect(authority.id).toBe("neutral-true-high-consideration");
    expect(authority.aggregate.project.id).toBe(
      createP10b18aShapeAuthorities(["neutral-true-high-consideration"])[0]?.aggregate.project.id,
    );
    expect(authority.fixtureTruthMetadata?.internalDiagnostics).toMatchObject({
      correctionClass: "test-only fixture customer-truth revision",
    });
  });

  it("fails closed with the exact path and locale for a missing Finnish value", () => {
    const authority = affectedAuthorities()[0];
    if (authority === undefined) throw new Error("Missing corrected authority.");
    const input = malformedAuthority(authority, (catalogue) => {
      const products = catalogue.products as Record<string, unknown>[];
      products[0] = {
        ...products[0],
        title: { en: "Sculpted ring" },
      };
      return catalogue;
    });
    expect(() => assertP10b18cFixtureCustomerTruth(input)).toThrowError(
      expect.objectContaining({
        path: "catalogue.products.0.title",
        locale: "fi",
        reason: "missing-enabled-locale",
      }),
    );
  });

  it("rejects an English-only Finnish fallback and rendered internal prose", () => {
    const authority = affectedAuthorities()[0];
    if (authority === undefined) throw new Error("Missing corrected authority.");
    const englishFallback = malformedAuthority(authority, (catalogue) => {
      const products = catalogue.products as Record<string, unknown>[];
      products[0] = {
        ...products[0],
        title: { en: "Size", fi: "Size" },
      };
      return catalogue;
    });
    expect(() => assertP10b18cFixtureCustomerTruth(englishFallback)).toThrowError(
      expect.objectContaining({
        path: "catalogue.products.0.title",
        locale: "fi",
        reason: "english-fallback-customer-locale",
      }),
    );

    const internalCopy = malformedAuthority(authority, (catalogue) => {
      const products = catalogue.products as Record<string, unknown>[];
      products[0] = {
        ...products[0],
        description: { en: "Audit fixture copy", fi: "Tarkistettava kuvaus" },
      };
      return catalogue;
    });
    expect(() => assertP10b18cFixtureCustomerTruth(internalCopy)).toThrowError(
      expect.objectContaining({
        path: "catalogue.products.0.description",
        locale: "en",
        reason: "customer-internal-terminology",
      }),
    );
  });

  it("rejects product, option and media truth mismatches", () => {
    const authority = affectedAuthorities().find(
      ({ id }) => id === "neutral-true-high-consideration",
    );
    if (authority === undefined) throw new Error("Missing corrected authority.");
    const wrongProductType = malformedAuthority(authority, (catalogue) => {
      const products = catalogue.products as Record<string, unknown>[];
      products[0] = { ...products[0], productType: "ring" };
      return catalogue;
    });
    expect(() => assertP10b18cFixtureCustomerTruth(wrongProductType)).toThrowError(
      expect.objectContaining({ reason: "product-truth-mismatch" }),
    );

    const missingOption = malformedAuthority(authority, (catalogue) => {
      const products = catalogue.products as Record<string, unknown>[];
      const options = products[0]?.orderOptions as unknown[];
      products[0] = { ...products[0], orderOptions: options.slice(1) };
      return catalogue;
    });
    expect(() => assertP10b18cFixtureCustomerTruth(missingOption)).toThrowError(
      expect.objectContaining({ reason: "option-truth-mismatch" }),
    );

    const wrongMedia = malformedAuthority(authority, (catalogue) => {
      const products = catalogue.products as Record<string, unknown>[];
      const images = products[0]?.images as Record<string, unknown>[];
      products[0] = {
        ...products[0],
        images: images.map((image) => ({ ...image, url: "/seed-assets/aurora-ring.svg" })),
      };
      return catalogue;
    });
    expect(() => assertP10b18cFixtureCustomerTruth(wrongMedia)).toThrowError(
      expect.objectContaining({ reason: "media-truth-mismatch" }),
    );
  });

  it("fails before materialization when jewellery copy is reintroduced into the neutral draft", () => {
    const authority = affectedAuthorities().find(
      ({ id }) => id === "neutral-true-high-consideration",
    );
    const metadata = authority?.fixtureTruthMetadata;
    if (authority === undefined || metadata === null || metadata === undefined) {
      throw new Error("Missing corrected neutral authority.");
    }
    const draft = structuredClone(authority.compatibilityInput.planningInput.draft);
    const home = draft.pages.find(({ type }) => type === "home");
    if (home === undefined) throw new Error("Missing neutral home page.");
    home.seo.metaDescription.fi = "Karvosen korujen demo-katalogi.";
    const draftPathMatcher: unknown = expect.stringContaining("draft.pages");
    expect(() =>
      assertP10b18cFixtureCustomerTruth({
        shapeId: authority.id,
        catalogue: authority.catalogue,
        siteMapDecision: authority.siteMapDecision,
        metadata,
        project: authority.aggregate.project,
        draft,
        approvedBriefBusinessIdentity:
          authority.compatibilityInput.planningInput.brief.businessIdentity,
      }),
    ).toThrowError(
      expect.objectContaining({
        path: draftPathMatcher,
        locale: "fi",
        reason: "customer-category-mismatch",
      }),
    );
  });
});

describe("P10B-18C exact corrected fixture witnesses", () => {
  let witnesses: readonly P10b18cMaterializedCase[];

  beforeAll(() => {
    const authorities = affectedAuthorities();
    witnesses = exactCaseIds.map((caseId) => {
      const [shapeId, stratumId] = caseId.split("--");
      const authority = authorities.find(({ id }) => id === shapeId);
      const stratum = p10b18cSemanticStrata.find(({ id }) => id === stratumId);
      if (authority === undefined || stratum === undefined) {
        throw new Error(`Missing exact P10B-18C authority for ${caseId}.`);
      }
      return materializeP10b18cCase(compileP10b18cCase(authority, stratum));
    });
  }, 300_000);

  it("compiles and materializes all four original strata with protected truth intact", () => {
    for (const caseId of exactCaseIds) {
      const witness = witnesses.find((candidate) => candidate.compiled.caseId === caseId);
      expect(witness, caseId).toBeDefined();
      if (witness === undefined) continue;
      expect(witness.completeness.promisedButUnrenderedCount).toBe(0);
      expect(witness.completeness.missingAssetCount).toBe(0);
      expect(witness.completeness.localeComplete).toBe(true);
      expect(witness.fingerprints.commerceAfter).toBe(witness.fingerprints.commerceBefore);
      expect(witness.fingerprints.mediaAfter).toBe(witness.fingerprints.mediaBefore);
      expect(JSON.stringify(witness.snapshot)).not.toMatch(/demo[- ]catalog/i);
      expect(witness.aggregate.catalogue.collections).toEqual(
        witness.compiled.authority.catalogue.collections,
      );
      expect(witness.aggregate.catalogue.products).toEqual(
        witness.compiled.authority.catalogue.products,
      );
    }
  });

  it("keeps both neutral strata commercially coherent in EN and FI without external calls", () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    try {
      for (const caseId of neutralCaseIds) {
        const witness = witnesses.find((candidate) => candidate.compiled.caseId === caseId);
        expect(witness, caseId).toBeDefined();
        if (witness === undefined) continue;
        const customerValues = [
          ...localizedCustomerValues(witness.snapshot),
          ...localizedCustomerValues(witness.aggregate.catalogue),
        ];
        expect(customerValues.some((value) => /work desk/i.test(value))).toBe(true);
        expect(customerValues.some((value) => /työpöytä/i.test(value))).toBe(true);
        customerValues.forEach((value) => expect(value).not.toMatch(neutralCustomerCategoryTerm));
        expect(witness.compiled.stratum.id).toBe(caseId.split("--")[1]);
      }
      expect(fetchSpy).not.toHaveBeenCalled();
    } finally {
      fetchSpy.mockRestore();
    }
  });
});
