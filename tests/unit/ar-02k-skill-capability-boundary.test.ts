import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import ts from "typescript";
import {
  resolveInstalledZodEsmClosure,
  resolveRuntimeImportClosure,
} from "../helpers/ar-02-runtime-import-closure";
import { observeCapabilityBoundaries } from "../helpers/ar-02k-capability-observation";
import * as core from "@/application/design-skills/capability-knowledge-core";
import * as facade from "@/application/design-skills/capability-knowledge";
import * as publicSkills from "@/application/design-skills";
import * as packages from "@/application/design-skills/governed-skill-packages";
import { designSkillRegistry } from "@/application/design-skills/default-registry";
import { createDesignSkillRegistry } from "@/application/design-skills/registry";
import { storefrontDesignDirectionIdSchema } from "@/application/storefront-design-system/contract";

const roots = [
  "src/application/design-skills/capability-knowledge-core.ts",
  "src/application/design-skills/governed-skill-packages.ts",
  "src/application/design-skills/commercial-design-grammar.ts",
];
const forbidden =
  /(?:\.tsx$|\.css$|^src\/(?:app|features|integrations\/puck)\/|^src\/components\/storefront\/|^src\/components\/registry\/(?:index|registry|contract|legacy-registry|renderer-observation|live-renderer-conformance|renderer-conformance)\.|^src\/application\/design-operations\/(?:operations|proposals|index)\.|^src\/application\/design-skills\/(?:index|capability-knowledge|default-registry|registry|executor|planner)\.|^src\/application\/design-skills\/skills\/|^src\/application\/(?:whole-storefront-proposal-lifecycle|publishing|storefront-draft-persistence)\/|^src\/application\/bounded-storefront-synthesis\/(?:synthesizer|index)\.|^src\/application\/whole-storefront-generation-plan\/(?:index|complete-storefront-materializer)\.|^src\/application\/storefront-templates\/(?:index|materializer)\.|(?:^|\/)(?:react|react-dom|next|@puckeditor)(?:\/|$))/u;

function runtimeOwners(file: string) {
  const source = ts.createSourceFile(
    file,
    readFileSync(file, "utf8"),
    ts.ScriptTarget.Latest,
    true,
  );
  return Object.fromEntries(
    source.statements.flatMap((statement) => {
      if (
        !ts.isImportDeclaration(statement) ||
        !statement.importClause ||
        statement.importClause.isTypeOnly
      )
        return [];
      const bindings = statement.importClause.namedBindings;
      if (!bindings || !ts.isNamedImports(bindings)) return [];
      return bindings.elements
        .filter((element) => !element.isTypeOnly)
        .map((element) => [
          element.name.text,
          (statement.moduleSpecifier as ts.StringLiteral).text,
        ]);
    }),
  );
}

describe("AR-02K actual skill capability and grammar consumers", () => {
  it.each(roots)("resolves the complete renderer-free runtime closure of %s", (root) => {
    const closure = resolveRuntimeImportClosure(root);
    expect(closure.runtimePaths.length).toBeGreaterThan(1);
    expect(closure.runtimePaths.filter((path) => forbidden.test(path))).toEqual([]);
    expect(closure.externalRuntimeImports.map((entry) => entry.specifier)).toEqual(["zod"]);
  });

  it("resolves installed Zod ESM without hiding external runtime edges", () => {
    const closure = resolveInstalledZodEsmClosure();
    expect(closure.runtimePaths.length).toBeGreaterThan(1);
    expect(closure.runtimePaths.filter((path) => forbidden.test(path))).toEqual([]);
  });

  it("connects the actual package and grammar imports to their strict current owners", () => {
    expect(runtimeOwners(roots[0]).veskifyComponentCapabilityManifest).toBe(
      "@/components/registry/capability-manifest",
    );
    const governed = runtimeOwners(roots[1]);
    expect(governed.skillCapabilityKnowledge).toBe("./capability-knowledge-core");
    expect(governed.SkillCapabilityKnowledgeError).toBe("./capability-knowledge-core");
    expect(governed.storefrontDesignDirectionIdSchema).toBe(
      "@/application/storefront-design-system/contract",
    );
    const grammar = runtimeOwners(roots[2]);
    expect(grammar.veskifyComponentCapabilityManifest).toBe(
      "@/components/registry/capability-manifest",
    );
    expect(grammar.getExecutablePageBlueprintProfile).toBe(
      "@/application/storefront-templates/registry",
    );
    expect(grammar.runtimeComponentForPageBlueprintComponent).toBe(
      "@/application/storefront-templates/profile-materializer",
    );
  });

  it("preserves every public facade export and shared singleton, error and schema identity", () => {
    expect(Object.keys(facade).sort()).toEqual(
      [
        "SkillCapabilityKnowledgeError",
        "createSkillCapabilityKnowledgeConsumer",
        "listCurrentDesignSkillInventory",
        "skillCapabilityKnowledge",
        "skillCapabilityKnowledgeErrorCodes",
      ].sort(),
    );
    for (const key of [
      "SkillCapabilityKnowledgeError",
      "createSkillCapabilityKnowledgeConsumer",
      "skillCapabilityKnowledge",
      "skillCapabilityKnowledgeErrorCodes",
    ] as const) {
      expect(facade[key]).toBe(core[key]);
      expect(publicSkills[key]).toBe(core[key]);
    }
    expect(publicSkills.listCurrentDesignSkillInventory).toBe(
      facade.listCurrentDesignSkillInventory,
    );
    expect(publicSkills.governedSkillPackageDescriptorSchema).toBe(
      packages.governedSkillPackageDescriptorSchema,
    );
    expect(packages.governedInitialGenerationAuthoritySchema.shape.registeredDirectionId).toBe(
      storefrontDesignDirectionIdSchema,
    );
    expect(packages.governedSkillPackageAliasSchema.shape.directionId.unwrap()).toBe(
      storefrontDesignDirectionIdSchema,
    );
    expect(publicSkills).not.toHaveProperty("projectCurrentDesignSkillInventory");
  });

  it("retains actual default inventory execution and honest mixed facade reachability", () => {
    expect(
      runtimeOwners("src/application/design-skills/capability-knowledge.ts").designSkillRegistry,
    ).toBe("./default-registry");
    expect(
      runtimeOwners("src/application/design-skills/default-registry.ts").DesignSkillRegistry,
    ).toBe("./registry");
    expect(runtimeOwners("src/application/design-skills/registry.ts").getComponentDefinition).toBe(
      "@/components/registry",
    );
    const list = vi.spyOn(designSkillRegistry, "list");
    try {
      const actual = facade.listCurrentDesignSkillInventory();
      expect(list).toHaveBeenCalledTimes(1);
      expect(actual).toEqual(core.projectCurrentDesignSkillInventory(designSkillRegistry));
      expect(actual).toHaveLength(8);
      expect(Object.isFrozen(actual)).toBe(true);
      expect(Object.isFrozen(actual[0].allowedComponentTypes)).toBe(true);
      expect(Reflect.set(actual[0], "id", "changed")).toBe(false);
    } finally {
      list.mockRestore();
    }
  });

  it("uses the supplied registry without reading the default inventory", () => {
    const definitions = designSkillRegistry.list().slice(0, 3).reverse();
    const custom = createDesignSkillRegistry(definitions);
    const empty = createDesignSkillRegistry([]);
    const defaultList = vi.spyOn(designSkillRegistry, "list");
    const customList = vi.spyOn(custom, "list");
    try {
      expect(facade.listCurrentDesignSkillInventory(empty)).toEqual([]);
      const result = facade.listCurrentDesignSkillInventory(custom);
      expect(customList).toHaveBeenCalledTimes(1);
      expect(defaultList).not.toHaveBeenCalled();
      expect(result.map((entry) => entry.id)).toEqual(
        definitions.map((entry) => entry.id).sort((a, b) => a.localeCompare(b)),
      );
      expect(result).toEqual(core.projectCurrentDesignSkillInventory(custom));
      expect(custom.list().map((entry) => entry.id)).toEqual(definitions.map((entry) => entry.id));
    } finally {
      defaultList.mockRestore();
      customList.mockRestore();
    }
  });

  it("preserves the actual governed registry's default and injected capability consumer", () => {
    const reference = core.skillCapabilityKnowledge.getManifestReference();
    expect(packages.governedSkillPackageRegistry.capabilityManifestReference()).toBe(reference);
    const getManifestReference = vi.fn(() => reference);
    const registry = packages.createGovernedSkillPackageRegistry({
      capabilityKnowledge: { ...core.skillCapabilityKnowledge, getManifestReference },
    });
    expect(registry.capabilityManifestReference()).toBe(reference);
    expect(getManifestReference).toHaveBeenCalledTimes(1);
    expect(registry.fingerprint).toBe(packages.governedSkillPackageRegistry.fingerprint);
    expect(registry.list()).toEqual(packages.governedSkillPackageRegistry.list());
  });

  it("matches all 8,870 retained actual-base observations without regenerating a golden", () => {
    const observed = observeCapabilityBoundaries();
    expect(Object.keys(observed)).toHaveLength(8870);
    expect(createHash("sha256").update(JSON.stringify(observed)).digest("hex")).toBe(
      "3f6727bb8c1b9de991476726feb620ebb69c892fcd4eb620c37968d4d18ced31",
    );
  });
});
