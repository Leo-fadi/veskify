import { readFileSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();

function source(path: string) {
  return readFileSync(join(root, path), "utf8");
}

function filesBelow(path: string): string[] {
  const absolute = join(root, path);
  return readdirSync(absolute, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile() && /\.(?:ts|tsx)$/u.test(entry.name))
    .map((entry) => relative(root, join(entry.parentPath, entry.name)));
}

describe("P10B-16P-06 search architecture boundaries", () => {
  it("keeps the provider-neutral search contract independent from UI, storage, and providers", () => {
    const application = filesBelow("src/application/storefront-search")
      .map((path) => source(path))
      .join("\n");
    expect(application).not.toMatch(/@\/integrations|next\/|@puckeditor|services\/storage/u);
    expect(application).not.toMatch(/openai|vesko|provider/iu);

    const adapter = source("src/integrations/storefront-search/standalone-catalogue-adapter.ts");
    expect(adapter).toContain('from "@/domain/catalogue"');
    expect(adapter).not.toMatch(/openai|@puckeditor|next\/|publishing/u);
  });

  it("reuses one collection/search component and leaves query state outside storefront domain", () => {
    const storefrontSources = [
      ...filesBelow("src/components"),
      ...filesBelow("src/domain/storefront"),
    ].map((path) => ({ path, value: source(path) }));
    expect(storefrontSources.filter(({ value }) => /dynamicSearchCommerce/u.test(value))).toEqual(
      [],
    );
    expect(
      storefrontSources.filter(({ path }) => path.endsWith("dynamic-collection-commerce.tsx")),
    ).toHaveLength(1);

    const persistedStorefront = filesBelow("src/domain/storefront")
      .map((path) => source(path))
      .join("\n");
    expect(persistedStorefront).not.toMatch(
      /StorefrontSearchRequestV1|StorefrontSearchResultPageV1|normalizedQuery|resultProductIds/u,
    );
  });
});
