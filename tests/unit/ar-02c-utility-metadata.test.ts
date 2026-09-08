import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { listCommercialUtilityProfiles } from "@/application/storefront-templates/commercial-utility-profiles";
import { materializeExecutablePageBlueprint } from "@/application/storefront-templates/profile-materializer";
import { veskifyComponentCapabilityManifest } from "@/components/registry/capability-manifest";
import {
  commerceUtilityContentSchema as runtimeContentSchema,
  commerceUtilityDefinition,
  commerceUtilityPropsSchema as runtimePropsSchema,
} from "@/components/registry/commerce-utility";
import {
  commerceUtilityContentSchema,
  commerceUtilityMetadata,
  commerceUtilityPropsSchema,
} from "@/components/registry/commerce-utility-metadata";
import { supportedSectionManifest } from "@/components/registry/supported-vocabulary";
import { adaptV1ComponentDefinitionToV2 } from "@/components/registry/v2-compatibility";
import { veskifyComponentDefinitionsV2 } from "@/components/registry/v2-registry";
import { sectionInstanceSchema } from "@/domain/storefront";
import { resolveRuntimeImportClosure } from "../helpers/ar-02-runtime-import-closure";

const hash = (value: unknown) =>
  createHash("sha256")
    .update(`${JSON.stringify(value, null, 2)}\n`)
    .digest("hex");

describe("AR-02C commerce utility metadata", () => {
  it("shares the exact schemas and ordered arrays with its runtime and vocabulary consumers", () => {
    const { contentSchema, propsSchema, ...metadata } = commerceUtilityMetadata;
    expect(commerceUtilityDefinition.contentSchema).toBe(commerceUtilityContentSchema);
    expect(commerceUtilityDefinition.propsSchema).toBe(commerceUtilityPropsSchema);
    expect(runtimeContentSchema).toBe(commerceUtilityContentSchema);
    expect(runtimePropsSchema).toBe(commerceUtilityPropsSchema);
    expect(commerceUtilityDefinition.allowedPageTypes).toBe(
      commerceUtilityMetadata.allowedPageTypes,
    );
    expect(commerceUtilityDefinition.variants).toBe(commerceUtilityMetadata.variants);
    expect(supportedSectionManifest.commerceUtility.allowedPageTypes).toBe(
      commerceUtilityMetadata.allowedPageTypes,
    );
    expect(supportedSectionManifest.commerceUtility.variants).toBe(
      commerceUtilityMetadata.variants,
    );
    expect(
      hash({
        ...metadata,
        contentSchema: z.toJSONSchema(contentSchema),
        propsSchema: z.toJSONSchema(propsSchema),
      }),
    ).toBe("0b04625b14e4d4209679b7938bfc6834d4a64969bc1ef24665852a07079a4329");
  });

  it("preserves complete baseline values across all existing canonical consumers", () => {
    const adapted = adaptV1ComponentDefinitionToV2(commerceUtilityDefinition);
    const registered = veskifyComponentDefinitionsV2.find(({ type }) => type === "commerceUtility");
    const profiles = listCommercialUtilityProfiles().map((pagePlan) => ({
      pagePlan,
      materialization: materializeExecutablePageBlueprint({
        pagePlan,
        componentDefinitions: veskifyComponentDefinitionsV2,
        availableBindingCategories: ["navigation"],
      }),
    }));

    expect(hash(adapted)).toBe("b80898bedc8ee0ad5071cf2bb934a924ca52a92ee5127b77f9c10c0d958f2433");
    expect(hash(registered)).toBe(
      "b80898bedc8ee0ad5071cf2bb934a924ca52a92ee5127b77f9c10c0d958f2433",
    );
    expect(hash(supportedSectionManifest)).toBe(
      "bf28a516b817e53976d9f9d9db0960ea20d58376b7495e76f92a405860dd0e4d",
    );
    expect(hash(veskifyComponentCapabilityManifest.manifest)).toBe(
      "84124f1ff34dc30eaa71582a485a62dffcaa72af50adf94f3134a80a6bbef361",
    );
    expect(profiles).toHaveLength(6);
    expect(hash(profiles)).toBe("d80446280346a91e83dac470dd6d4cd46614040e9b8f339aeb41d5e439d1202d");
  });

  it("retains strict schema failures, defaults, and immutable metadata inputs", () => {
    expect(() => commerceUtilityContentSchema.parse({ heading: { en: "Only English" } })).toThrow();
    expect(() =>
      commerceUtilityContentSchema.parse({
        heading: { en: "Storefront status", fi: "Kaupan tila", sv: "Butiken" },
        body: { en: "Review", fi: "Tarkista" },
      }),
    ).toThrow();
    expect(() =>
      commerceUtilityContentSchema.parse({
        heading: { en: "Storefront status", fi: "Kaupan tila" },
        body: { en: "Review", fi: "Tarkista" },
        unsupported: true,
      }),
    ).toThrow();
    expect(() => commerceUtilityPropsSchema.parse({ summaryPlacement: "center" })).toThrow();
    expect(() =>
      commerceUtilityPropsSchema.parse({ summaryPlacement: "aside", unsupported: true }),
    ).toThrow();
    expect(commerceUtilityPropsSchema.parse({})).toEqual({ summaryPlacement: "aside" });
    const before = JSON.stringify(commerceUtilityMetadata);
    commerceUtilityDefinition.contentSchema.parse(commerceUtilityMetadata.defaultContent);
    commerceUtilityDefinition.propsSchema.parse(commerceUtilityMetadata.defaultProps);
    const section = sectionInstanceSchema.parse({
      id: "utility",
      component: "commerceUtility",
      variant: "cart",
      visible: true,
      content: commerceUtilityMetadata.defaultContent,
      props: commerceUtilityMetadata.defaultProps,
    });
    expect(() =>
      commerceUtilityDefinition.validate(
        sectionInstanceSchema.parse({ ...section, component: "unknown" }),
        "cart",
      ),
    ).toThrow();
    expect(() =>
      commerceUtilityDefinition.validate(
        sectionInstanceSchema.parse({ ...section, variant: "unknown" }),
        "cart",
      ),
    ).toThrow();
    expect(() => commerceUtilityDefinition.validate(section, "home")).toThrow();
    expect(JSON.stringify(commerceUtilityMetadata)).toBe(before);
  });

  it.each([
    "src/components/registry/commerce-utility-metadata.ts",
    "src/components/registry/supported-vocabulary.ts",
  ])("has a complete renderer-free runtime closure for %s", (entry) => {
    const closure = resolveRuntimeImportClosure(entry);
    const forbidden =
      /(?:^src\/components\/(?:storefront\/|registry\/(?:index|registry|legacy-registry|v2-registry|contract|v2-compatibility|commerce-utility)\.(?:ts|tsx)$)|^src\/integrations\/puck\/|^src\/(?:app|features)\/|(?:^|\/)(?:react|react-dom)(?:\/|$)|acceptance|\.css$)/iu;

    expect(closure.runtimePaths).not.toEqual([]);
    expect(closure.runtimePaths.filter((path) => forbidden.test(path))).toEqual([]);
    expect(closure.externalRuntimeImports.map(({ specifier }) => specifier)).toEqual(["zod"]);
  });
});
