import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("P10B-18C helper typed commerce authority", () => {
  it("uses canonical availability and discriminated route branches", () => {
    const source = readFileSync(
      resolve(process.cwd(), "tests/helpers/p10b-18c-commercial-quality.ts"),
      "utf8",
    );
    const collectionGuard = source.indexOf('collectionResolution.route.kind !== "collection"');
    const productGuard = source.indexOf('productResolution.route.kind !== "product"');
    const collectionId = source.indexOf("const { collectionId } = collectionResolution.route;");
    const productId = source.indexOf("const { productId } = productResolution.route;");

    expect(source).toContain("stockStatus: product.stockStatus");
    expect(source).not.toContain("availability: product.availability");
    expect(collectionGuard).toBeGreaterThanOrEqual(0);
    expect(productGuard).toBeGreaterThanOrEqual(0);
    expect(collectionId).toBeGreaterThan(collectionGuard);
    expect(productId).toBeGreaterThan(productGuard);
    expect(source).toContain("({ id }) => id === collectionId");
    expect(source).toContain("({ id }) => id === productId");
  });
});
