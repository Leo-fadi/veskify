import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const markdownFiles = [
  "README.md",
  "AGENTS.md",
  "docs/VESKIFY_SDD.md",
  "docs/VESKIFY_DEVELOPMENT_ROADMAP.md",
  "docs/DESIGN_AGENT_SKILLS.md",
  "docs/DEVELOPMENT_GUIDE.md",
  "docs/CODEX_TASK_TEMPLATE.md",
  "docs/PHASE_9_EVIDENCE_MATRIX.md",
  "docs/COMMERCIAL_DESIGN_SYSTEM_ROADMAP_SYNCHRONIZATION.md",
  "docs/SDD_V1_2_2_DOCUMENTATION_VALIDATION.md",
  "docs/adr/README.md",
  "docs/adr/ADR-002_CONTROLLED_DESIGN_AGENT.md",
];
const failures = [];

const contents = new Map(
  markdownFiles.map((relativePath) => [
    relativePath,
    readFileSync(join(repositoryRoot, relativePath), "utf8"),
  ]),
);

for (const [relativePath, markdown] of contents) {
  const linkPattern = /\[[^\]]*]\(([^)]+)\)/g;
  for (const match of markdown.matchAll(linkPattern)) {
    const target = match[1].trim().replace(/^<|>$/g, "");
    if (target.startsWith("#") || /^[a-z][a-z0-9+.-]*:/i.test(target) || target.includes("${")) {
      continue;
    }
    const withoutAnchor = target.split("#", 1)[0];
    if (!withoutAnchor) continue;
    const resolved = resolve(
      dirname(join(repositoryRoot, relativePath)),
      decodeURIComponent(withoutAnchor),
    );
    if (!existsSync(resolved)) {
      failures.push(`${relativePath}: missing relative link target ${target}`);
    }
  }
}

const sdd = contents.get("docs/VESKIFY_SDD.md");
const roadmap = contents.get("docs/VESKIFY_DEVELOPMENT_ROADMAP.md");
const evidence = contents.get("docs/PHASE_9_EVIDENCE_MATRIX.md");
const validationRecord = contents.get("docs/SDD_V1_2_2_DOCUMENTATION_VALIDATION.md");

const requiredSddText = [
  "| **Version**                 | 1.2.2",
  "Phase 9 remains active.",
  "`StorefrontSnapshot`",
  "`ComponentDefinitionV2`",
  "`PageBlueprint`",
  "`DataBinding`",
  "`ProductPresentationContext`",
  "`Proposal`",
  "| **AC-129**",
  "| **AC-135**",
  "P10A defines and validates the scopes.",
  "P10C implements and exposes those scopes as working merchant",
  "P10A-04 is generated from `ComponentDefinitionV2`",
  "AC-119 remains solely a Phase 9 gate.",
  "approved Storefront Design Brief-to-runtime handoff",
  "Broad commercial vocabulary expansion occurs after the Phase",
  "authoritative\nStorefront Design Brief creation → merchant review → explicit approval",
  "later unapproved brief mutation supplied generation",
  "registered → planner-selectable → proposal-expressible → compiler-preserved",
  "Global BrandSystem",
  "Commercial visual-quality and protected-commerce gate",
  "4a96a5a5567b83e62306f73f7069e0e09f0c8683",
  "bba2827e63f2027c946138f6c91362f3f989b088",
  "codex/sdd-v1-2-2-commercial-design-vocabulary-recovery",
  "registered, constrained `PageBlueprint` profile",
  "Recipe selection materializes or constrains a canonical `PageBlueprint`",
  "raw CSS, arbitrary class names",
  "executable JavaScript/React or generated code",
  "unrestricted font imports",
  "semantic tokens normally flow downward",
  "approved evidence provenance is preserved",
  "not required to close Phase 9",
  "P10B-07 and P10B-08 implement the coordinated commercial recipes only as registered constrained",
  "P10B-12 visual-quality gate",
  "P10C Storefront Studio Editing Experience v1",
];
for (const required of requiredSddText) {
  if (!sdd.includes(required)) failures.push(`SDD missing required text: ${required}`);
}
if (
  sdd.includes("| **Amendment source commit**    | `8174b1a6d31301b4072622e2e3ef675957479121`") ||
  sdd.includes(
    "| **Amendment branch**           | `codex/sdd-v1.2.1-grounded-storefront-generator`",
  )
) {
  failures.push("SDD incorrectly uses v1.2.1 provenance as the v1.2.2 amendment source");
}

for (const required of [
  "**Repository baseline:** `4a96a5a5567b83e62306f73f7069e0e09f0c8683`",
  "**Branch:** `codex/sdd-v1-2-2-commercial-design-vocabulary-recovery`",
  "**PR:** #132",
  "**Initial delivery commit:** `bba2827e63f2027c946138f6c91362f3f989b088`",
  "**Review-fix delivery commit:** Recorded by PR #132",
]) {
  if (!validationRecord.includes(required)) {
    failures.push(`v1.2.2 validation record is missing provenance text: ${required}`);
  }
}

const p10aOrder = [
  "P10A-01 — Vocabulary freeze",
  "P10A-02 — Repository capability audit",
  "P10A-03 — Executable PageBlueprint contracts",
  "P10A-04 — Generated Component Knowledge Registry",
  "P10A-05 — Separate Skill package contracts",
  "P10A-06 — Scoped instruction-router contracts",
  "P10A-07 — Golden-store quality gates",
  "P10A-08 — Publish compiler",
];
for (const [relativePath, markdown] of [
  ["docs/VESKIFY_SDD.md", sdd],
  ["docs/VESKIFY_DEVELOPMENT_ROADMAP.md", roadmap],
]) {
  let previousTaskIndex = -1;
  for (const task of p10aOrder) {
    const taskNumber = task.slice(0, 8);
    const index = markdown.indexOf(taskNumber, previousTaskIndex + 1);
    if (index < 0) failures.push(`${relativePath}: missing ${taskNumber}`);
    if (index <= previousTaskIndex) failures.push(`${relativePath}: invalid P10A order at ${task}`);
    previousTaskIndex = index;
  }
}

const phaseOrder = [
  "### P9 — Whole-storefront design quality — active",
  "### P10A — Grounded orchestration and publishing closure",
  "### P10B — Commercial Storefront Design System v1",
  "### P10C — Storefront Studio Editing Experience v1",
  "### P10D — Deferred registered advanced media and interactive presentation",
  "### P11 — Stable domains and Vesko reference adapters",
  "### P12 — Production hardening and operations",
];
let previousIndex = -1;
for (const heading of phaseOrder) {
  const index = roadmap.indexOf(heading);
  if (index < 0) failures.push(`Roadmap missing heading: ${heading}`);
  if (index <= previousIndex) failures.push(`Roadmap phase order is invalid at: ${heading}`);
  previousIndex = index;
}

const evidenceHeader = evidence.split("\n").find((line) => line.startsWith("| Requirement / AC"));
const evidenceColumns = evidenceHeader
  ?.split("|")
  .slice(1, -1)
  .map((column) => column.trim());
const requiredEvidenceColumns = [
  "Requirement / AC",
  "Task",
  "PR",
  "Commit",
  "Test evidence",
  "Browser evidence",
  "Screenshot evidence",
  "Provider evidence",
  "Status",
  "Limitation",
];
if (!evidenceColumns || evidenceColumns.join("\n") !== requiredEvidenceColumns.join("\n")) {
  failures.push("Phase 9 evidence matrix is missing the required columns");
}
if (!evidence.includes("Phase 9 remains active")) {
  failures.push("Phase 9 evidence matrix must keep Phase 9 active");
}
for (const required of [
  "4a96a5a5567b83e62306f73f7069e0e09f0c8683",
  "P10A owns AC-129 through AC-135 after Phase 9",
  "AC-136–AC-138 are not required to close Phase 9",
  "P10B-01 through P10B-12",
  "Reproducible from the stated v1.2.2 baseline",
]) {
  if (!evidence.includes(required)) {
    failures.push(
      `Phase 9 evidence matrix is missing v1.2.2 ownership/provenance text: ${required}`,
    );
  }
}
for (const required of [
  "Approved Storefront Design Brief revision used by runtime generation; FR-105",
  "project ID, brief ID, revision/fingerprint",
  "approval actor/action/timestamp",
  "runtime request/proposal correlation",
  "no later unapproved brief",
  "merely validated/unapproved brief",
]) {
  if (!evidence.includes(required)) {
    failures.push(`Phase 9 evidence matrix is missing approved-brief evidence text: ${required}`);
  }
}
if (
  !roadmap.includes("P9-03 — Minimum proof-enabling design capability reachability") ||
  !roadmap.includes(
    "Broad commercial vocabulary scaling belongs to\nP10B after Phase 9 and P10A publishing closure",
  )
) {
  failures.push("Roadmap does not preserve the P9-03/P10A-04 vocabulary boundary");
}

for (const [relativePath, markdown] of contents) {
  if (/\bPhase 9 (?:is|—) complete\b/i.test(markdown)) {
    failures.push(`${relativePath}: incorrectly declares Phase 9 complete`);
  }
}

const sourceHash = createHash("sha256").update(sdd.replace(/\r\n/g, "\n")).digest("hex");
const docxPath = join(repositoryRoot, "docs", "VESKIFY_SDD_v1.2.2.docx");
if (!existsSync(docxPath)) {
  failures.push("Missing docs/VESKIFY_SDD_v1.2.2.docx");
} else {
  try {
    execFileSync(
      process.execPath,
      [join(repositoryRoot, "scripts", "export-sdd-docx.mjs"), "--check"],
      {
        encoding: "utf8",
      },
    );
  } catch {
    failures.push("DOCX content does not match the deterministic Markdown export");
  }

  const customProperties = execFileSync("/usr/bin/unzip", ["-p", docxPath, "docProps/custom.xml"], {
    encoding: "utf8",
  });
  if (!customProperties.includes(sourceHash)) {
    failures.push("DOCX source hash does not match docs/VESKIFY_SDD.md");
  }
}

if (failures.length > 0) {
  process.stderr.write(`${failures.join("\n")}\n`);
  process.exitCode = 1;
} else {
  process.stdout.write(
    `Documentation validation passed (${markdownFiles.length} Markdown files, synchronized DOCX ${sourceHash}).\n`,
  );
}
