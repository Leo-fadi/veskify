import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { listExecutablePageBlueprintProfiles } from "@/application/storefront-templates/registry";
import { veskifyComponentCapabilityManifest } from "@/components/registry/capability-manifest";
import { createRendererConformanceReportCore } from "@/components/registry/renderer-conformance-core";
import { createRendererConformanceReport } from "@/components/registry/renderer-conformance";
import { collectLiveRendererRegistrations } from "@/components/registry/renderer-observation";
import { veskifyComponentDefinitionsV2 } from "@/components/registry/v2-registry";
import { veskifyComponentRegistry } from "@/components/registry/registry";
import {
  resolveInstalledZodEsmClosure,
  resolveRuntimeImportClosure,
} from "../helpers/ar-02-runtime-import-closure";

function input() {
  return {
    componentDefinitions: veskifyComponentDefinitionsV2,
    pagePlans: listExecutablePageBlueprintProfiles(),
    manifestAuthority: veskifyComponentCapabilityManifest,
    rendererRegistrations: collectLiveRendererRegistrations(),
  };
}

describe("AR-02B renderer-free conformance core", () => {
  it("preserves the live wrapper report and uses explicit bridge context", () => {
    const liveInput = input();
    const wrapper = createRendererConformanceReport(liveInput);
    const core = createRendererConformanceReportCore(
      liveInput,
      Object.keys(veskifyComponentRegistry),
    );
    const noBridges = createRendererConformanceReportCore(liveInput, []);

    expect(core).toEqual(wrapper);
    expect(core.fingerprint).toBe(wrapper.fingerprint);
    expect(noBridges.commercialGaps.map(({ id }) => id)).toEqual(
      expect.arrayContaining(["unbridged-commercial-capability:hero"]),
    );
  });

  it("retains the materialization catch-to-finding behavior", () => {
    const pagePlans = structuredClone(listExecutablePageBlueprintProfiles());
    const profile = pagePlans[0].profile;
    if (!profile) throw new Error("Expected executable PageBlueprint profile.");
    Reflect.set(profile, "version", "1.0.1");
    const report = createRendererConformanceReportCore(
      { ...input(), pagePlans },
      Object.keys(veskifyComponentRegistry),
    );

    expect(report.blockingDefects.map(({ id }) => id)).toContain(
      `profile-materialization:${profile.id}`,
    );
  });

  it("has a recursively resolved renderer-free runtime closure", () => {
    const closure = resolveRuntimeImportClosure(
      "src/components/registry/renderer-conformance-core.ts",
    );
    const forbidden =
      /(?:^src\/components\/(?:storefront\/|registry\/(?!renderer-conformance-core\.ts$))|^src\/integrations\/puck\/|^src\/(?:app|features)\/|(?:^|\/)(?:react|react-dom)(?:\/|$)|acceptance|\.css$)/iu;

    expect(closure.runtimePaths).not.toEqual([]);
    expect(closure.runtimePaths.filter((path) => forbidden.test(path))).toEqual([]);
    expect(closure.externalRuntimeImports.map(({ specifier }) => specifier)).toEqual(["zod"]);
    expect(closure.runtimePaths.some((path) => path.includes("node_modules/zod/"))).toBe(true);
    const zodEsm = resolveInstalledZodEsmClosure();
    expect(zodEsm.runtimePaths.some((path) => path.includes("node_modules/zod/"))).toBe(true);
    expect(zodEsm.runtimePaths.filter((path) => forbidden.test(path))).toEqual([]);
  });

  it("distinguishes erased bindings and rejects unresolved or computed runtime edges", () => {
    const directory = mkdtempSync(join(tmpdir(), "ar-02b-runtime-"));
    try {
      writeFileSync(join(directory, "leaf.ts"), "export const value = 1;\n");
      writeFileSync(join(directory, "side-effect.ts"), "export const effect = 1;\n");
      writeFileSync(join(directory, "required.ts"), "export const required = 1;\n");
      writeFileSync(join(directory, "dynamic.ts"), "export const dynamic = 1;\n");
      writeFileSync(join(directory, "types.ts"), "export type Value = number;\n");
      writeFileSync(join(directory, "transitive.ts"), 'export { value } from "./leaf";\n');
      writeFileSync(
        join(directory, "entry.ts"),
        [
          'import type { Value } from "./types";',
          'import { type Value as OtherValue } from "./types";',
          'import "./side-effect";',
          'export { type Value } from "./types";',
          'export { value } from "./transitive";',
          'export { value as mixedValue, type Value as MixedType } from "./mixed";',
          'require("./required");',
          'import("./dynamic");',
          "type Local = Value | OtherValue;",
          "void (0 as Local);",
        ].join("\n"),
      );
      writeFileSync(
        join(directory, "mixed.ts"),
        'export { value } from "./leaf"; export type { Value } from "./types";\n',
      );
      const closure = resolveRuntimeImportClosure(join(directory, "entry.ts"));
      expect(closure.runtimePaths).toEqual(
        expect.arrayContaining([
          expect.stringContaining("entry.ts"),
          expect.stringContaining("leaf.ts"),
          expect.stringContaining("required.ts"),
          expect.stringContaining("dynamic.ts"),
        ]),
      );
      expect(closure.runtimePaths).not.toEqual(
        expect.arrayContaining([expect.stringContaining("types.ts")]),
      );

      writeFileSync(join(directory, "unresolved.ts"), 'import "./missing";\n');
      expect(() => resolveRuntimeImportClosure(join(directory, "unresolved.ts"))).toThrow(
        /Unresolved runtime import/u,
      );
      writeFileSync(join(directory, "computed.ts"), "import(name);\n");
      expect(() => resolveRuntimeImportClosure(join(directory, "computed.ts"))).toThrow(
        /Computed runtime import/u,
      );
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });
});
