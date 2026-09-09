import { createHash } from "node:crypto";
import { canonicalValueFingerprint } from "@/domain/storefront";
import { describe, expect, it } from "vitest";
import { homepageCommerceDefinitions } from "@/components/registry/homepage-commerce";
import { contentSupportDefinition } from "@/components/registry/content-support";
import { dynamicCollectionCommerceDefinition } from "@/components/registry/dynamic-collection-commerce";
import { dynamicProductDetailDefinition } from "@/components/registry/dynamic-product-detail";
import { veskifyLegacyComponentRegistry } from "@/components/registry/legacy-registry";
import { veskifyComponentDefinitionsV2 } from "@/components/registry/v2-registry";
import { adaptV1ComponentRegistryToV2 } from "@/components/registry/v2-compatibility";
import { resolveRuntimeImportClosure } from "../helpers/ar-02-runtime-import-closure";

const hash = (value: unknown) =>
  createHash("sha256")
    .update(`${JSON.stringify(value, null, 2)}\n`)
    .digest("hex");

describe("AR-02F V2 metadata adaptation", () => {
  it("preserves the exact legacy-adapted prefix and native suffix", () => {
    const oldPrefix = adaptV1ComponentRegistryToV2(
      Object.fromEntries(
        Object.entries(veskifyLegacyComponentRegistry).filter(
          ([type]) =>
            type !== "dynamicCollectionCommerce" &&
            type !== "dynamicProductDetail" &&
            !homepageCommerceDefinitions.some((definition) => definition.type === type),
        ),
      ),
    );
    expect(veskifyComponentDefinitionsV2.slice(0, oldPrefix.length)).toEqual(oldPrefix);
    expect(
      canonicalValueFingerprint(veskifyComponentDefinitionsV2.slice(0, oldPrefix.length)),
    ).toBe(canonicalValueFingerprint(oldPrefix));
    // SHA-256 of JSON.stringify(oldAdapted, null, 2) + newline from the pre-edit
    // baseline at d9647c84523c6b26d10cf025dcfccbed541c3c7d (complete baseline SHA:
    // 1bd4a769de736691c1a8bd06e7d471926126f9cb9f3bba3db8b44434d66f4fe6).
    expect(hash(oldPrefix)).toBe(
      "65fe99f3361cd635245a9f18c7c018cbc9c6667ff5f2814977c5ab26355a1bd3",
    );
    expect(new Set(veskifyComponentDefinitionsV2.map((definition) => definition.type)).size).toBe(
      29,
    );
    const suffix = [
      dynamicCollectionCommerceDefinition,
      dynamicProductDetailDefinition,
      ...homepageCommerceDefinitions,
      contentSupportDefinition,
    ];
    const expectedTypes = [...oldPrefix, ...suffix].map((definition) => definition.type);
    expect(veskifyComponentDefinitionsV2.map((definition) => definition.type)).toEqual(
      expectedTypes,
    );
    expect(new Set(expectedTypes).size).toBe(expectedTypes.length);
    expect(
      oldPrefix.some((definition) => suffix.some((native) => native.type === definition.type)),
    ).toBe(false);
    suffix.forEach((definition, index) =>
      expect(veskifyComponentDefinitionsV2[oldPrefix.length + index]).toBe(definition),
    );
  });

  it("has a renderer-free complete V2 runtime closure", () => {
    const closure = resolveRuntimeImportClosure("src/components/registry/v2-registry.ts");
    const forbidden =
      /(?:legacy-registry|\.[jt]sx$|\.css$|(?:^|\/)(?:react|react-dom)(?:\/|$)|puck|acceptance|^src\/(?:app|features)\/|^src\/components\/registry\/(?:index|registry)\.ts$)/iu;
    expect(closure.runtimePaths.filter((path) => forbidden.test(path))).toEqual([]);
    expect(closure.externalRuntimeImports.map(({ specifier }) => specifier)).toEqual(["zod"]);
  });
});
