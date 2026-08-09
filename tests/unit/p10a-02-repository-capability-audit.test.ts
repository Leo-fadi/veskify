import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { veskifyComponentDefinitionsV2 } from "@/components/registry";
import {
  p10a02ComponentCapabilityAudit,
  p10a02CapabilityStatuses,
  p10a02RendererTargets,
} from "../fixtures/p10a-02-repository-capability-audit";

function capabilityMatrixStatuses(): string[] {
  const documentation = readFileSync(
    resolve(process.cwd(), "docs/P10A_02_REPOSITORY_CAPABILITY_AUDIT.md"),
    "utf8",
  );
  const matrix = documentation.match(/\| Capability\s+\|[\s\S]*?\n\n## 4\./)?.[0];
  if (!matrix) throw new Error("P10A-02 capability matrix is missing.");
  return matrix
    .split("\n")
    .filter((line) => line.startsWith("|") && !/^\|\s*-/.test(line))
    .slice(1)
    .map((line) => {
      const cells = line
        .split("|")
        .slice(1, -1)
        .map((cell) => cell.trim());
      if (cells.length !== 9) throw new Error("P10A-02 capability matrix has an invalid row.");
      return cells[7];
    });
}

describe("P10A-02 repository capability audit", () => {
  it("keeps every legacy renderer registration represented in the canonical V2 registry", () => {
    expect(p10a02ComponentCapabilityAudit.v1RegisteredComponentTypes).toHaveLength(27);
    expect(p10a02ComponentCapabilityAudit.v1TypesMissingV2Definition).toEqual([]);
    expect(p10a02ComponentCapabilityAudit.rendererTypesMissingV2Definition).toEqual([]);
  });

  it("keeps every V2 component type connected to either the legacy bridge or an all-surface renderer", () => {
    expect(p10a02ComponentCapabilityAudit.v2RegisteredComponentTypes).toHaveLength(27);
    expect(p10a02ComponentCapabilityAudit.v2RegisteredVariantCount).toBe(100);
    expect(p10a02ComponentCapabilityAudit.componentFamilyCounts).toEqual({
      content: 18,
      commerce: 4,
      marketing: 2,
      navigation: 1,
      service: 2,
    });
    expect(p10a02ComponentCapabilityAudit.v2TypesMissingRegisteredRenderer).toEqual([]);
    expect(p10a02ComponentCapabilityAudit.v2TypesWithoutLegacyRegistryBridge).toEqual([]);
  });

  it("rejects duplicate family/variant identities and missing page-family compatibility", () => {
    const types = veskifyComponentDefinitionsV2.map((definition) => definition.type);
    expect(new Set(types).size).toBe(types.length);

    veskifyComponentDefinitionsV2.forEach((definition) => {
      const variants = definition.variants.map((variant) => variant.id);
      expect(new Set(variants).size, definition.type).toBe(variants.length);
      expect(definition.renderer.supportedTargets).toEqual(p10a02RendererTargets);
    });

    expect(p10a02ComponentCapabilityAudit.pageFamilyComponentCounts).toEqual({
      home: 18,
      collection: 8,
      product: 9,
    });
  });

  it("requires exactly one mandated status on every capability-matrix row", () => {
    const statuses = capabilityMatrixStatuses();
    expect(statuses).toHaveLength(12);
    statuses.forEach((status) => expect(p10a02CapabilityStatuses).toContain(status));
  });
});
