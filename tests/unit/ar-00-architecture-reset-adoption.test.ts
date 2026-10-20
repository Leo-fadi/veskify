// @vitest-environment node
import { execFileSync } from "node:child_process";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// Keep an independent CI catalogue; each case executes its complete mutation slice.
const surfaces = [
  "README.md",
  "docs/VESKIFY_SDD.md",
  "docs/VESKIFY_DEVELOPMENT_ROADMAP.md",
  "docs/VESKIFY_DEVELOPMENT_DELIVERY_TRACKER.md",
  "docs/DEVELOPMENT_GUIDE.md",
  "docs/VESKIFY_CURRENT_STATE_TRUTH_AUDIT.md",
  "docs/VESKIFY_CAPABILITY_EVIDENCE_LEDGER.md",
  "docs/spec-addenda/AR-00_TEMPLATE_SCOPED_ARCHITECTURE.md",
  "AGENTS.md",
  "docs/AGENT_TEAM_WORKFLOW.md",
];
describe("architecture adoption documentary guards", () => {
  it.each(surfaces)(
    "validates current policy and negative controls for %s",
    (surface) => {
      const output = execFileSync(
        process.execPath,
        [join(process.cwd(), "scripts/documentation-tooling-self-check.mjs"), surface],
        {
          encoding: "utf8",
          maxBuffer: 8 * 1024 * 1024,
        },
      );
      expect(output).toContain("Corrective documentation controls passed");
      const line = output
        .split("\n")
        .find((entry) => entry.startsWith("AR00_POLICY_COVERAGE_MATRIX "));
      expect(line).toBeDefined();
      const records = JSON.parse(line!.slice("AR00_POLICY_COVERAGE_MATRIX ".length)) as {
        source: string;
        mutation: string;
        expected: number;
        actual: number;
      }[];
      expect(records.length).toBeGreaterThan(100);
      expect(records.every((record) => record.expected === record.actual)).toBe(true);
      expect(
        records.some(
          (record) => record.source === surface && record.mutation === "missing required source",
        ),
      ).toBe(true);
    },
    60_000,
  );
});
