import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  EXPECTED_REQUIREMENT_IDS,
  extractAuthoritativeRequirementDefinitions,
  extractRequirementIds,
  hasStaleActiveP10AStatusClaim,
  isAffirmativeMerchantEditorP10AClaim,
} from "./documentation-validation-helpers.mjs";
import { renderInlineMarkdownForCheck } from "./markdown-docx-export.mjs";

const linkFixture =
  "Plain **bold**, *italic* and `code`; [external](https://example.com/docs), [relative](../docs/ROADMAP.md), [external again](https://example.com/docs).";
const firstLinkRender = renderInlineMarkdownForCheck(linkFixture);
const secondLinkRender = renderInlineMarkdownForCheck(linkFixture);

assert.deepEqual(secondLinkRender, firstLinkRender, "hyperlink output must be deterministic");
assert.deepEqual(firstLinkRender.relationships, [
  { id: "rIdHyperlink1", target: "https://example.com/docs" },
  { id: "rIdHyperlink2", target: "../docs/ROADMAP.md" },
]);
assert.equal((firstLinkRender.xml.match(/r:id="rIdHyperlink1"/g) ?? []).length, 2);
assert.equal((firstLinkRender.xml.match(/r:id="rIdHyperlink2"/g) ?? []).length, 1);
assert.match(firstLinkRender.relationshipsXml, /Target="https:\/\/example\.com\/docs"/);
assert.match(firstLinkRender.relationshipsXml, /Target="\.\.\/docs\/ROADMAP\.md"/);
assert.match(firstLinkRender.xml, />Plain <\/w:t>/);
assert.match(firstLinkRender.xml, /<w:b\/>/);
assert.match(firstLinkRender.xml, /<w:i\/>/);
assert.match(firstLinkRender.xml, /Consolas/);

const unsafeLinkRender = renderInlineMarkdownForCheck("[unsafe](javascript:payload)");
assert.equal(unsafeLinkRender.relationships.length, 0);
assert.doesNotMatch(unsafeLinkRender.xml, /<w:hyperlink/);
assert.match(unsafeLinkRender.xml, /unsafe \(javascript:payload\)/);

assert.equal(
  isAffirmativeMerchantEditorP10AClaim("The merchant editor is a P10A closure requirement."),
  true,
);
assert.equal(
  isAffirmativeMerchantEditorP10AClaim("Merchant editor wiring belongs to P10A closure."),
  true,
);
assert.equal(
  isAffirmativeMerchantEditorP10AClaim("P10A must wire merchant editor controls before closing."),
  true,
);
assert.equal(
  isAffirmativeMerchantEditorP10AClaim("The merchant editor is not a P10A closure requirement."),
  false,
);
assert.equal(
  isAffirmativeMerchantEditorP10AClaim("Merchant-facing editor wiring belongs to P10C."),
  false,
);
assert.equal(
  isAffirmativeMerchantEditorP10AClaim(
    "P10A internal governed execution does not require merchant UI wiring.",
  ),
  false,
);

assert.equal(hasStaleActiveP10AStatusClaim("P10A is not closed."), true);
assert.equal(
  hasStaleActiveP10AStatusClaim("P10A is substantially\nimplemented but not closed."),
  true,
);
assert.equal(hasStaleActiveP10AStatusClaim("P10A is Baseline / closed."), false);
assert.equal(
  hasStaleActiveP10AStatusClaim(
    "Historical record: P10A is substantially implemented but not closed.",
  ),
  false,
);
assert.equal(hasStaleActiveP10AStatusClaim("P10A was previously not closed."), false);
assert.equal(
  hasStaleActiveP10AStatusClaim("Historical records exist, but P10A is not closed."),
  true,
);

const rangeFixture = "FR-119–122; NFR-101 through NFR-103; AC-105-107; AC-138.";
assert.deepEqual([...extractRequirementIds(rangeFixture)].sort(), [
  "AC-105",
  "AC-106",
  "AC-107",
  "AC-138",
  "FR-119",
  "FR-120",
  "FR-121",
  "FR-122",
  "NFR-101",
  "NFR-102",
  "NFR-103",
]);

const definitionFixture =
  "| **FR-101** | Functional | Meaning | Owner | Retained unchanged | Authority |\n" +
  "| **FR-101** | Functional | Duplicate | Owner | Retained unchanged | Authority |";
assert.equal(extractAuthoritativeRequirementDefinitions(definitionFixture).get("FR-101"), 2);
assert.deepEqual(
  Object.values(EXPECTED_REQUIREMENT_IDS).map((identifiers) => identifiers.length),
  [24, 10, 38],
);

process.stdout.write(
  "Documentation tooling self-check passed (hyperlinks, deterministic relationships, requirement ranges/duplicates, P10A/P10C negation, and stale-status whitespace fixtures).\n",
);

// Test-side catalogue is independent from the guard's selectors/parser. These are
// documentary controls, also invoked by the existing Vitest entrypoint in CI.
const policyRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const policySurfaces = [
  ["README.md", "# Veskify\n"],
  ["docs/VESKIFY_SDD.md", "# Veskify Software Design Document v1.3.0\n"],
  ["docs/VESKIFY_DEVELOPMENT_ROADMAP.md", "## CR-00 current corrective order (proposed; owner adoption/merge pending)\n"],
  ["docs/VESKIFY_DEVELOPMENT_DELIVERY_TRACKER.md", "# Veskify Development Delivery Tracker\n"],
  ["docs/DEVELOPMENT_GUIDE.md", "## 4. Branch and PR strategy\n"],
  ["docs/VESKIFY_CURRENT_STATE_TRUTH_AUDIT.md", "# Veskify Current-State Truth Audit\n"],
  ["docs/VESKIFY_CAPABILITY_EVIDENCE_LEDGER.md", "# Veskify Capability Evidence Ledger\n"],
  ["docs/spec-addenda/AR-00_TEMPLATE_SCOPED_ARCHITECTURE.md", "## 5. Delivery gates and retirement\n"],
  ["AGENTS.md", "### 8.0 AR-00 adopted architecture policy\n"],
  ["docs/AGENT_TEAM_WORKFLOW.md", "## Assign and deliver\n"],
];
const selectedSurface = process.argv[2];
if (selectedSurface !== undefined && !policySurfaces.some(([path]) => path === selectedSurface))
  throw new Error("unknown documentary test surface");
const policyFixture = mkdtempSync(join(tmpdir(), "ar-00-policy-"));
const policyInputs = [...policySurfaces.map(([path]) => path),
  "docs/AR_00_SOURCE_DISPOSITION_AND_ACCEPTANCE.md", "docs/P10B_19_STRUCTURAL_DESIGN_INTELLIGENCE_ARCHITECTURE.md",
  "tests/fixtures/p10b-19a-10c-architecture-closure-manifest.v1.json", "docs/CR_00_REQUIREMENT_DISPOSITION.md"];
const originals = new Map();
for (const path of policyInputs) {
  const destination = join(policyFixture, path);
  mkdirSync(dirname(destination), { recursive: true }); cpSync(join(policyRoot, path), destination);
  originals.set(path, readFileSync(destination, "utf8"));
}
const policyCoverage = [];
const policyCheck = (source, mutation, expected, text) => {
  if (text !== undefined) {
    assert.notEqual(text, originals.get(source), `mutation did not apply: ${source}: ${mutation}`);
    writeFileSync(join(policyFixture, source), text);
  }
  try {
    const result = spawnSync(process.execPath, [join(policyRoot, "scripts/check-architecture-reset-adoption.mjs"), policyFixture], { encoding: "utf8" });
    assert.equal(result.error, undefined);
    const diagnostic = result.stderr.match(/^Error: (.+)$/mu)?.[1] ?? result.stdout.trim();
    policyCoverage.push({ source, mutation, expected, actual: result.status, diagnostic });
    assert.equal(result.status, expected, `${source}: ${mutation}: ${diagnostic}`);
    if (expected === 1) assert.match(result.stderr, /Error:/u);
  } finally {
    if (text !== undefined) writeFileSync(join(policyFixture, source), originals.get(source));
  }
};
const invalidDeclarations = [
  "AR-00 is pending adoption/merge.", "AR-00 is Active — pending adoption/merge.",
  "AR-01 is Planned — sole next task after AR-00 adoption/merge.", "AR-02 is Active — implementation started.",
  "AR-06 is Baseline / closed.", "AR-09A is In progress under BATCH-20 / VQ-01.", "AR-10B is Baseline / closed.",
  "CR-01 is Active.", "CR-02 is Baseline / closed.", "CR-20 is Planned.",
  "The roadmap owns status.", "The tracker owns delivery order.", "The roadmap remains the sole status authority.",
  "The tracker is the delivery-order authority.", "Status is owned only by the delivery roadmap.",
  "Dependency order is owned only by the tracker.",
  "The [roadmap](VESKIFY_DEVELOPMENT_ROADMAP.md) owns status.",
  "The [tracker](VESKIFY_DEVELOPMENT_DELIVERY_TRACKER.md) owns dependency order.",
  "| Task | Status |\n| --- | --- |\n| AR-02 | Active — implementation started |",
  "| Task | Dependencies |\n| --- | --- |\n| AR-23 | AR-01, AR-15 |",
  "AR-23 depends on AR-15.", "AR-23 depends on AR-01 and AR-15.",
  "CR-16 depends on CR-15.", "P10B-19A-10 is Planned and unexecuted.",
  "P10B-19A-10 is not Baseline / closed.", "AR-02 current status authority: Active — implementation started.",
  "AR-03A is the active amendment.", "AR-08 is the exact next task.", "AR-30 is the selected successor.",
  "BATCH-20 / VQ-01 is active.", "CR-03 is Planned. CR-03 is Planned.",
  "CR-16 depends on CR-02. CR-16 depends on CR-02.",
];
try {
  policyCheck("all", "unchanged complete proposal", 0);
  for (const [source, anchor] of policySurfaces.filter(([path]) => selectedSurface === undefined || path === selectedSurface)) {
    const original = originals.get(source);
    assert.ok(original.includes(anchor), `missing test-side policy anchor ${source}`);
    for (const declaration of invalidDeclarations) {
      for (const form of ["primary section", "current heading", "current quote"]) {
        const text = form === "primary section"
          ? original.replace(anchor, `${anchor}\n${declaration.split("\n").map(line => `${anchor.startsWith("# ") ? "> " : ""}${line}`).join("\n")}\n`)
          : `${original}\n\n${form === "current heading" ? `## CURRENT POLICY\n\n${declaration}` : `> **CURRENT POLICY:**\n${declaration.split("\n").map(line => `> ${line}`).join("\n")}`}\n`;
        policyCheck(source, `${form}: ${declaration}`, 1, text);
      }
    }
    for (const [name, addition] of [
      ["historical heading", "## Historical evidence\n\nAR-01 is Active — implementation started."],
      ["historical line", "Historical evidence: AR-01 is Active — implementation started."],
      ["fenced example", "```text\n## CURRENT POLICY\nAR-01 is Active — implementation started.\n```"],
      ["example heading", "## Examples\n\nAR-01 is Active — implementation started."],
      ["ordinary quoted example", "> Quoted example: AR-01 is Active — implementation started."],
    ]) policyCheck(source, name, 0, `${original}\n\n${addition}\n`);
    const path = join(policyFixture, source); rmSync(path);
    try { policyCheck(source, "missing required source", 1); } finally { writeFileSync(path, original); }
  }
  const mutate = (source, name, before, after) => policyCheck(source, name, 1, originals.get(source).replace(before, after));
  const roadmap = "docs/VESKIFY_DEVELOPMENT_ROADMAP.md";
  const tracker = "docs/VESKIFY_DEVELOPMENT_DELIVERY_TRACKER.md";
  for (const [source, name, before, after] of [
    [roadmap, "historical dependency mismatch", "**Package:** P8 — Host integration. **Dependencies:** AR-01.", "**Package:** P8 — Host integration. **Dependencies:** AR-15."],
    [roadmap, "duplicate detailed dependency", "**Dependencies:** AR-01.", "**Dependencies:** AR-01. **Dependencies:** AR-01."],
    [roadmap, "duplicate detailed heading", "### AR-23 —", "### AR-23 —\n### AR-23 —"],
    [roadmap, "omitted early-slice owner", /^\| AR-18\s*\|[^\n]+$/mu, ""],
    [roadmap, "omitted historical VQ package", /^\| VQ4\s*\|[^\n]+$/mu, ""],
    [roadmap, "corrective dependency mismatch", "CR-14, CR-16", "CR-14, CR-15"],
    [roadmap, "missing corrective task", /^\| CR-12 \|[^\n]+$/mu, ""],
    [roadmap, "duplicate corrective task", /^\| CR-12 \|[^\n]+$/mu, "$&\n$&"],
    [tracker, "unpaused phase", "BATCH-20 / VQ-01 is **PAUSED**", "BATCH-20 / VQ-01 is **active**"],
    [tracker, "overclaimed AR10B", "AR-10B is Paused", "AR-10B is Baseline / closed"],
    ["docs/VESKIFY_SDD.md", "original definition change", "| **FR-101** |", "| **FR-199** |"],
    ["docs/CR_00_REQUIREMENT_DISPOSITION.md", "omitted requirement", /^\| FR-101 \|[^\n]+$/mu, ""],
    ["docs/CR_00_REQUIREMENT_DISPOSITION.md", "duplicate requirement", /^\| FR-101 \|[^\n]+$/mu, "$&\n$&"],
    ["docs/CR_00_REQUIREMENT_DISPOSITION.md", "omitted retained T gate", /^\| T24 \|[^\n]+$/mu, ""],
    ["docs/CR_00_REQUIREMENT_DISPOSITION.md", "omitted finding", /^\| F10 —[^\n]+$/mu, ""],
    ["docs/VESKIFY_SDD.md", "missing incorporated source", "is incorporated into this SDD", "was mentioned elsewhere"],
    ["docs/VESKIFY_SDD.md", "unscanned policy link", "spec-addenda/AR-00_TEMPLATE_SCOPED_ARCHITECTURE.md", "unknown-policy.md"],
  ]) mutate(source, name, before, after);
  // Mutate the existing grouped declarations and decision text, not only added
  // singular examples. These regressions reproduce independent CR00-F01/F02.
  for (const [name, before, unsafe] of [
    ["actual CR pair", "CR-01 and CR-02 are **Planned — separate launch required**", "CR-01 and CR-02 are **Active — implementation started**"],
    ["actual CR range", "CR-03 through CR-19 are **Planned**", "CR-03 through CR-19 are **Baseline / closed**"],
    ["actual accepted parent group", "AR-02, AR-03, AR-04 and AR-05 are **Baseline / closed**", "AR-02, AR-03, AR-04 and AR-05 are **Planned**"],
    ["actual accepted children", "Accepted AR-06A/B/C/D and AR-09A\n> children are closed at their recorded merges", "Accepted AR-06A/B/C/D and AR-09A\n> children are Planned"],
  ]) {
    mutate(tracker, `${name} changed`, before, unsafe);
    mutate(tracker, `${name} removed`, before, "");
  }
  for (const [name, before, unsafe] of [
    ["G0", "G0 foundation choice at CR-02", "G0 automatic foundation choice at CR-02"],
    ["G1", "G1 owner direction for configured templates at CR-05", "G1 owner direction waived at CR-05"],
    ["G2", "G2 real AI authoring at CR-06–08", "G2 fixture authoring at CR-06–08"],
    ["G3", "G3 owner acceptance of the complete internal product at CR-14", "G3 automatic acceptance of the complete internal product at CR-14"],
    ["G4", "G4 host/pilot proof at CR-19", "G4 fixture-only proof at CR-19"],
  ]) {
    mutate(roadmap, `${name} changed`, before, unsafe);
    mutate(roadmap, `${name} removed`, before, "");
  }
  mutate(roadmap, "CR14 actual outcome waived", "Owner internal-product acceptance on independent evidence", "Automatic acceptance from passing test count");
  mutate(roadmap, "CR14 actual failure routing waived", "No owner acceptance leaves product incomplete.", "Product is complete without owner acceptance.");
  for (const source of ["docs/P10B_19_STRUCTURAL_DESIGN_INTELLIGENCE_ARCHITECTURE.md", "tests/fixtures/p10b-19a-10c-architecture-closure-manifest.v1.json"])
    policyCheck(source, "changed historical bytes", 1, `${originals.get(source)}\n`);
  for (const id of ["AR-00", "AR-01", "AR-02", "AR-03", "AR-04", "AR-05", "AR-06A", "AR-06B", "AR-06C", "AR-06D", "AR-10A"])
    policyCheck(tracker, `closed ${id} regressed`, 1, `${originals.get(tracker)}\n## CURRENT POLICY\n${id} is Planned.\n`);
  policyCheck(tracker, "valid corrective dependency and historical closure alias", 0,
    `${originals.get(tracker)}\n## CURRENT POLICY\nCR-16 depends on CR-02. A-10 is Baseline / closed.\n`);
} finally {
  rmSync(policyFixture, { recursive: true, force: true });
  process.stdout.write(`AR00_POLICY_COVERAGE_MATRIX ${JSON.stringify(policyCoverage)}\n`);
}
process.stdout.write(`Corrective documentation controls passed (${policyCoverage.length} cases; 10 independent test-side policy surfaces).\n`);
