import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  EXPECTED_REQUIREMENT_IDS,
  EXPECTED_REQUIREMENT_ID_SET,
  extractAuthoritativeRequirementDefinitions,
  extractRequirementIds,
  hasStaleActiveP10AStatusClaim,
  isAffirmativeMerchantEditorP10AClaim,
} from "./documentation-validation-helpers.mjs";
import { extractMarkdownLinks, isSafeHyperlinkTarget } from "./markdown-docx-export.mjs";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const activeMarkdownFiles = [
  "README.md",
  "AGENTS.md",
  "docs/VESKIFY_SDD.md",
  "docs/VESKIFY_DEVELOPMENT_ROADMAP.md",
  "docs/VESKIFY_DEVELOPMENT_DELIVERY_TRACKER.md",
  "docs/DEVELOPMENT_GUIDE.md",
  "docs/VESKIFY_CURRENT_STATE_TRUTH_AUDIT.md",
  "docs/VESKIFY_CAPABILITY_EVIDENCE_LEDGER.md",
  "docs/P10A_PHASE_CLOSURE.md",
  "docs/P10B_COMMERCIAL_STOREFRONT_GENERATION_ARCHITECTURE.md",
  "docs/P10B_02_PARAMETRIC_BRAND_SYSTEM.md",
  "docs/P10B_03_COMPONENT_ANATOMY_AND_MEANINGFUL_VARIANTS.md",
  "docs/P10B_05_SITE_MAP_AND_PAGE_FAMILY_AUTHORITY.md",
  "docs/VESKO_OPENAPI_CONTRACT_AUDIT.md",
  "docs/VESKO_VESKIFY_INTEGRATION_MATRIX.md",
  "docs/P10B_01_STOREFRONT_DESIGN_SYSTEM_CAPABILITY_AUDIT.md",
  "docs/COMMERCIAL_STOREFRONT_DESIGN_VOCABULARY_SPEC.md",
  "docs/COMMERCIAL_DESIGN_SYSTEM_ROADMAP_SYNCHRONIZATION.md",
  "docs/ADR-001-PUCK_EDITOR_FOUNDATION.md",
  "docs/adr/README.md",
  "docs/adr/ADR-002_CONTROLLED_DESIGN_AGENT.md",
  "docs/adr/ADR-003_URL_FIRST_DISCOVERY_AND_RECONCILIATION.md",
  "docs/adr/ADR-004_DYNAMIC_COMMERCE_BOUND_COMPONENTS.md",
  "docs/archive/README.md",
];
const failures = [];

const readRepositoryFile = (relativePath) =>
  readFileSync(join(repositoryRoot, relativePath), "utf8").replaceAll("\r\n", "\n");

const contents = new Map(
  activeMarkdownFiles.map((relativePath) => [relativePath, readRepositoryFile(relativePath)]),
);

const checkRelativeLinks = (relativePath, markdown) => {
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
};

const collectMarkdownFiles = (relativeDirectory) =>
  readdirSync(join(repositoryRoot, relativeDirectory), { withFileTypes: true })
    .sort((left, right) => left.name.localeCompare(right.name))
    .flatMap((entry) => {
      const relativePath = join(relativeDirectory, entry.name);
      if (entry.isDirectory()) return collectMarkdownFiles(relativePath);
      return entry.isFile() && entry.name.endsWith(".md") ? [relativePath] : [];
    });

for (const [relativePath, markdown] of contents) checkRelativeLinks(relativePath, markdown);

const requireText = (relativePath, required) => {
  const markdown = contents.get(relativePath);
  for (const text of required) {
    if (!markdown.includes(text)) failures.push(`${relativePath}: missing required text: ${text}`);
  }
};

const phaseOrder = [
  "P10A — Grounded orchestration and publishing closure",
  "P10B — Commercial Storefront Generation System v1",
  "P10C — Storefront Studio Editing Experience v1",
  "P10D — Advanced media and registered interactive presentation",
  "P11 — Vesko Integration Readiness and Reference Adapter",
  "P12 — Production hardening and pilot operations",
];

for (const relativePath of [
  "README.md",
  "docs/VESKIFY_SDD.md",
  "docs/VESKIFY_DEVELOPMENT_ROADMAP.md",
]) {
  const markdown = contents.get(relativePath);
  let previousIndex = -1;
  for (const phase of phaseOrder) {
    const index = markdown.indexOf(phase, previousIndex + 1);
    if (index < 0) failures.push(`${relativePath}: missing phase ${phase}`);
    if (index <= previousIndex) failures.push(`${relativePath}: invalid phase order at ${phase}`);
    previousIndex = index;
  }
}

requireText("README.md", [
  "The overall product is **Partial**. Phase 9 is closed by product-owner handoff",
  "P10A grounded\norchestration and publishing is **Baseline / closed**",
  "P10B Commercial Storefront Generation System\nv1 is **Partial / active**",
  "docs/VESKIFY_SDD_v1.3.0.docx",
  "docs/VESKIFY_DEVELOPMENT_DELIVERY_TRACKER_v1.3.0.docx",
  "docs/VESKO_OPENAPI_CONTRACT_AUDIT.md",
  "docs/VESKO_VESKIFY_INTEGRATION_MATRIX.md",
  "No Vesko staging or production evidence\nexists.",
]);

requireText("AGENTS.md", [
  "**Version:** 1.3.0",
  "docs/VESKIFY_SDD_v1.3.0.docx",
  "docs/VESKIFY_DEVELOPMENT_DELIVERY_TRACKER.md",
]);

requireText("docs/VESKIFY_SDD.md", [
  "# Veskify Software Design Document v1.3.0",
  "Phase 9 is closed by product-owner handoff",
  "P10A grounded\norchestration and publishing is **Baseline / closed**",
  "P10B is now **Partial / active**",
  "Merchant-facing wiring is not a\nP10A closure requirement",
  "P10B is the first phase allowed to claim a commercially credible\ngeneration system",
  "The Vesko OpenAPI 3.0 contract has been obtained and audited",
  "Raw Puck payloads",
  "There is no Vesko staging or production evidence",
  "VESKIFY_SDD_v1.3.0.docx",
  "archive/VESKIFY_SDD_v1.2.2.docx",
]);

requireText("docs/VESKIFY_DEVELOPMENT_ROADMAP.md", [
  "**Active development phase:** P10B — Commercial Storefront Generation System v1 (**Partial**)",
  "P10A owns internal governed initial/follow-up execution",
  "1 — Grammar",
  "2 — Parallel foundations",
  "5 — Early complete store",
  "7 — Closure",
  "The minimum pilot editor requires",
  "Full P10C exit requires",
  "P11-00 — Vesko OpenAPI audit",
]);

requireText("docs/VESKIFY_DEVELOPMENT_DELIVERY_TRACKER.md", [
  "## Overall phase checklist",
  "## P10A checklist",
  "## P10B checklist",
  "## P10C checklist",
  "## P11 checklist",
  "| ☑",
  "P11-00",
  "P10A_PHASE_CLOSURE.md",
]);

requireText("docs/P10A_PHASE_CLOSURE.md", [
  "**Status:** Baseline / closed",
  "**Formal exit verdict: Baseline / closed.**",
  "**Next active development phase:** P10B — Commercial Storefront Generation System v1 (**Planned**)",
  "**Provider calls during closure:** zero",
]);

requireText("docs/P10B_COMMERCIAL_STOREFRONT_GENERATION_ARCHITECTURE.md", [
  "**Status:** Binding architecture. P10B-01, P10B-02, P10B-03, and P10B-05 are **Baseline**;\nP10B-04 and P10B-06 through P10B-18 remain **Planned**.",
  "**Phase:** P10B — Commercial Storefront Generation System v1",
  "Veskify owns storefront creation",
  "Vesko owns operational commerce truth",
  "BrandSystem\n  → PageBlueprint profile\n  → component family / meaningful variant\n  → bounded validated instance override",
  "At least four materially distinct complete frame systems",
  "At least six meaningful compositions",
  "at least five meaningful anatomies",
  "Homepage: at least six materially different registered profiles",
  "Collection/search: at least four profiles",
  "PDP: at least four profiles",
  "at least 100 complete bounded storefront configurations",
  "P10B-02 and P10B-03 were delivered in parallel after P10B-01 with disjoint ownership",
]);

const lockedP10BTasks = [
  ["P10B-01", "Commercial design grammar and compatibility vocabulary"],
  ["P10B-02", "Parametric BrandSystem / Design DNA"],
  ["P10B-03", "Component anatomy and meaningful variant contract"],
  ["P10B-04", "Responsive image and art-direction authority"],
  ["P10B-05", "Veskify site-map and page-family authority"],
  ["P10B-06", "Commercial shared-frame families"],
  ["P10B-07", "Hero, editorial, campaign and proof families"],
  ["P10B-08", "Canonical product-card and merchandising family"],
  ["P10B-09", "Commercial homepage profile library"],
  ["P10B-10", "Commercial collection and search profiles"],
  ["P10B-11", "Commercial PDP profile library"],
  ["P10B-12", "Content and support page families"],
  ["P10B-13", "Commerce utility presentation pages"],
  ["P10B-14", "Premium Editorial complete-storefront vertical slice"],
  ["P10B-15", "Bounded storefront synthesis and narrative engine"],
  ["P10B-16", "Coordinated directions and diversity control"],
  ["P10B-17", "Responsive, accessibility and performance closure"],
  ["P10B-18", "Commercial quality and scale gate"],
];

for (const relativePath of [
  "docs/P10B_COMMERCIAL_STOREFRONT_GENERATION_ARCHITECTURE.md",
  "docs/VESKIFY_DEVELOPMENT_ROADMAP.md",
  "docs/VESKIFY_DEVELOPMENT_DELIVERY_TRACKER.md",
]) {
  const markdown = contents.get(relativePath);
  for (const [taskId, title] of lockedP10BTasks) {
    if (!markdown.includes(`${taskId} — ${title}`)) {
      failures.push(`${relativePath}: missing locked task ${taskId} — ${title}`);
    }
  }
}

requireText("docs/DEVELOPMENT_GUIDE.md", [
  "Phase 9 is\nclosed by product-owner handoff, and P10A is **Baseline / closed**",
  "P10B is the active development phase. P10B-01 commercial grammar, P10B-02 parametric\nBrandSystem / Design DNA, P10B-03 component anatomy, and P10B-05 site-map/page-family authority\nare **Baseline**; P10B-04 and P10B-06 through P10B-18 remain **Planned**",
  "Completed P10A capability includes governed initial and follow-up\nexecution",
  "merchant-facing routing, clarification, scope controls,\nand normal-editor execution belong to P10C",
  "P10D remains advanced media, P11 remains Vesko\nintegration readiness, and P12 remains production hardening",
]);

const tracker = contents.get("docs/VESKIFY_DEVELOPMENT_DELIVERY_TRACKER.md");
if ((tracker.match(/☑/g) ?? []).length !== 11) {
  failures.push("Delivery tracker must contain exactly eleven completed checkboxes");
}

const plannedP10bChecklistIds = [...tracker.matchAll(/^\| ☐\s+\| (P10B-\d{2})\s+\|/gm)].map(
  (match) => match[1],
);
const expectedPlannedP10bChecklistIds = lockedP10BTasks
  .map(([taskId]) => taskId)
  .filter((taskId) => !["P10B-01", "P10B-02", "P10B-03", "P10B-05"].includes(taskId));
if (
  !/^\| ☑\s+\| P10B-01\s+\|[^\n]*\| \*\*Baseline\*\*/m.test(tracker) ||
  !/^\| ☑\s+\| P10B-02\s+\|[^\n]*\| \*\*Baseline\*\*/m.test(tracker) ||
  !/^\| ☑\s+\| P10B-03\s+\|[^\n]*\| \*\*Baseline\*\*/m.test(tracker) ||
  !/^\| ☑\s+\| P10B-05\s+\|[^\n]*\| \*\*Baseline\*\*/m.test(tracker) ||
  plannedP10bChecklistIds.length !== expectedPlannedP10bChecklistIds.length ||
  plannedP10bChecklistIds.some((taskId, index) => taskId !== expectedPlannedP10bChecklistIds[index])
) {
  failures.push(
    "Delivery tracker must mark P10B-01, P10B-02, P10B-03, and P10B-05 Baseline and keep P10B-04 and P10B-06 through P10B-18 Planned and unchecked",
  );
}

requireText("docs/P10B_05_SITE_MAP_AND_PAGE_FAMILY_AUTHORITY.md", [
  "**Status:** Baseline",
  "The versioned `1.0.0` registry contains 19 families",
  "does not persist a\nsecond page graph",
  "presentation-only",
  "repository save/reload",
  "Provider calls:** Zero",
]);

for (const relativePath of [
  "README.md",
  "docs/VESKIFY_SDD.md",
  "docs/VESKIFY_DEVELOPMENT_ROADMAP.md",
  "docs/VESKIFY_DEVELOPMENT_DELIVERY_TRACKER.md",
  "docs/DEVELOPMENT_GUIDE.md",
  "docs/P10A_PHASE_CLOSURE.md",
  "docs/P10B_COMMERCIAL_STOREFRONT_GENERATION_ARCHITECTURE.md",
  "docs/adr/ADR-002_CONTROLLED_DESIGN_AGENT.md",
]) {
  if (contents.get(relativePath).includes("P10B — Commercial Storefront Design System v1")) {
    failures.push(`${relativePath}: stale active P10B phase name`);
  }
}
if (
  !/^\| ☑\s+\| P10A\s+\|/m.test(tracker) ||
  !/^\| ☑\s+\| P10A-07C-03R/m.test(tracker) ||
  !/^\| ☑\s+\| P10A-08B-02/m.test(tracker) ||
  !/^\| ☑\s+\| P10A-08C-02B/m.test(tracker) ||
  !/^\| ☑\s+\| P10A-08D-02/m.test(tracker) ||
  !/^\| ☑\s+\| P10A-09/m.test(tracker) ||
  !/^\| ☑\s+\| P11-00/m.test(tracker)
) {
  failures.push(
    "Delivery tracker must mark P10A overall, every listed P10A closure task, and P11-00 as completed Baseline work",
  );
}

const staleActivePatterns = [
  [/((?<!archive\/)VESKIFY_SDD_v1\.2\.2\.docx)/, "top-level v1.2.2 active export"],
  [/Phase 9 remains active/i, "Phase 9 active claim"],
  [/Phase 9 —[^\n]*active/i, "Phase 9 active heading"],
  [/P10B[^\n]*Storefront Studio UX/i, "old P10B Studio ownership"],
  [/Phase 11[^\n]*merchant-operable granular editing/i, "old Phase 11 editing ownership"],
  [/Phase 12[^\n]*stable domains[^\n]*adapters/i, "old Phase 12 adapter ownership"],
  [/OpenAPI (?:contract )?(?:is )?missing/i, "missing OpenAPI claim"],
  [/raw Puck[^\n]*(?:is|as) canonical/i, "raw Puck canonical-persistence claim"],
  [/P10A closure record remains/i, "outstanding P10A closure-record claim"],
  [/P10A controlled acceptance remains blocked/i, "blocked P10A controlled-acceptance claim"],
  [/P10A-08C-02B is Planned/i, "planned compiled-publication closure claim"],
  [/P10A-08D-02 is Planned/i, "planned publication-evidence closure claim"],
];

for (const [relativePath, markdown] of contents) {
  if (relativePath === "docs/archive/README.md") continue;
  const currentClaimText = markdown
    .split("\n")
    .filter((line) => !/Former (?:Phase|later)/.test(line))
    .join("\n");
  if (hasStaleActiveP10AStatusClaim(currentClaimText)) {
    failures.push(`${relativePath}: stale active claim (P10A not-closed claim)`);
  }
  for (const [pattern, label] of staleActivePatterns) {
    if (pattern.test(currentClaimText)) {
      failures.push(`${relativePath}: stale active claim (${label})`);
    }
  }
  for (const line of currentClaimText.split("\n")) {
    if (isAffirmativeMerchantEditorP10AClaim(line)) {
      failures.push(`${relativePath}: stale active claim (merchant editor as P10A closure work)`);
    }
  }
}

const sdd = contents.get("docs/VESKIFY_SDD.md");
const authoritativeDefinitions = extractAuthoritativeRequirementDefinitions(sdd);
const definitionCounts = Object.fromEntries(
  Object.entries(EXPECTED_REQUIREMENT_IDS).map(([type, identifiers]) => [
    type,
    identifiers.filter((identifier) => authoritativeDefinitions.get(identifier) === 1).length,
  ]),
);

for (const identifier of EXPECTED_REQUIREMENT_ID_SET) {
  const count = authoritativeDefinitions.get(identifier) ?? 0;
  if (count !== 1) {
    failures.push(
      `docs/VESKIFY_SDD.md: ${identifier} must have exactly one authoritative definition; found ${count}`,
    );
  }
}
for (const identifier of authoritativeDefinitions.keys()) {
  if (!EXPECTED_REQUIREMENT_ID_SET.has(identifier)) {
    failures.push(`docs/VESKIFY_SDD.md: unexpected authoritative definition ${identifier}`);
  }
}

const allowedTraceabilityStatuses = new Set([
  "Retained unchanged",
  "Clarified",
  "Superseded by named v1.3.0 requirement; traceability alias retained",
  "Historical only",
]);
const traceabilityRows = [
  ...sdd.matchAll(
    /^\|\s+\*\*((?:FR|NFR|AC)-\d+)\*\*\s+\|\s+([^|]+)\|\s+([^|]+)\|\s+([^|]+)\|\s+\*\*([^|]+)\*\*\s+\|\s+([^|]+)\|$/gm,
  ),
];
for (const row of traceabilityRows) {
  const status = row[5].trim();
  if (!allowedTraceabilityStatuses.has(status)) {
    failures.push(`docs/VESKIFY_SDD.md: ${row[1]} has invalid traceability status ${status}`);
  }
}
if (traceabilityRows.length !== EXPECTED_REQUIREMENT_ID_SET.size) {
  failures.push(
    `docs/VESKIFY_SDD.md: expected ${EXPECTED_REQUIREMENT_ID_SET.size} complete traceability rows, found ${traceabilityRows.length}`,
  );
}

const requirementReferenceFiles = ["README.md", "AGENTS.md", ...collectMarkdownFiles("docs")];
const danglingRequirementReferences = [];
for (const relativePath of requirementReferenceFiles) {
  const markdown = readRepositoryFile(relativePath);
  for (const identifier of extractRequirementIds(markdown)) {
    const numericPart = Number.parseInt(identifier.split("-")[1], 10);
    if (numericPart < 101) continue;
    if (!authoritativeDefinitions.has(identifier)) {
      danglingRequirementReferences.push(`${relativePath}:${identifier}`);
    }
  }
}
for (const danglingReference of danglingRequirementReferences) {
  failures.push(`Dangling retained requirement reference ${danglingReference}`);
}

const exportsToValidate = [
  {
    source: "docs/VESKIFY_SDD.md",
    output: "docs/VESKIFY_SDD_v1.3.0.docx",
    script: "scripts/export-sdd-docx.mjs",
    requiredXml: [
      "Veskify Software Design Document",
      "w:footerReference",
      "w:tblHeader",
      '<w:pgSz w:w="12240" w:h="15840"/>',
      '<w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440"',
      '<w:br w:type="page"/>',
      '<w:tblInd w:w="0" w:type="dxa"/>',
      "w:numPr",
      "w:hyperlink",
    ],
  },
  {
    source: "docs/VESKIFY_DEVELOPMENT_DELIVERY_TRACKER.md",
    output: "docs/VESKIFY_DEVELOPMENT_DELIVERY_TRACKER_v1.3.0.docx",
    script: "scripts/export-development-delivery-tracker-docx.mjs",
    requiredXml: [
      "Veskify Development Delivery Tracker",
      'w:pgSz w:w="15840" w:h="12240" w:orient="landscape"',
      '<w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440"',
      "w:footerReference",
      "w:tblHeader",
      '<w:br w:type="page"/>',
      '<w:tblInd w:w="0" w:type="dxa"/>',
      "w:numPr",
      "☑",
      "☐",
      "w:hyperlink",
    ],
  },
];

for (const { source, output, script, requiredXml } of exportsToValidate) {
  const outputPath = join(repositoryRoot, output);
  if (!existsSync(outputPath)) {
    failures.push(`Missing synchronized export ${output}`);
    continue;
  }

  try {
    execFileSync(process.execPath, [join(repositoryRoot, script), "--check"], { encoding: "utf8" });
  } catch {
    failures.push(`${output} does not match its deterministic Markdown export`);
  }

  try {
    execFileSync("/usr/bin/unzip", ["-tqq", outputPath], { encoding: "utf8" });
  } catch {
    failures.push(`${output} is not a structurally valid DOCX archive`);
  }

  const markdown = readRepositoryFile(source);
  const sourceHash = createHash("sha256").update(markdown).digest("hex");
  const customProperties = execFileSync(
    "/usr/bin/unzip",
    ["-p", outputPath, "docProps/custom.xml"],
    { encoding: "utf8" },
  );
  if (!customProperties.includes(sourceHash)) {
    failures.push(`${output}: source hash does not match ${source}`);
  }

  const documentXml = execFileSync("/usr/bin/unzip", ["-p", outputPath, "word/document.xml"], {
    encoding: "utf8",
  });
  for (const required of requiredXml) {
    if (!documentXml.includes(required))
      failures.push(`${output}: missing OOXML marker ${required}`);
  }
  const pageBreakCount = (documentXml.match(/<w:br w:type="page"\/>/g) ?? []).length;
  if (pageBreakCount < 1) {
    failures.push(`${output}: expected an explicit cover page break`);
  }
  if (/<w:t[^>]*>(?:#{1,4}|\*\*|```)/.test(documentXml)) {
    failures.push(`${output}: exposed Markdown syntax in rendered document content`);
  }

  const documentRelationshipsXml = execFileSync(
    "/usr/bin/unzip",
    ["-p", outputPath, "word/_rels/document.xml.rels"],
    { encoding: "utf8" },
  );
  const decodeXmlAttribute = (value) =>
    value
      .replaceAll("&quot;", '"')
      .replaceAll("&apos;", "'")
      .replaceAll("&lt;", "<")
      .replaceAll("&gt;", ">")
      .replaceAll("&amp;", "&");
  const hyperlinkRelationships = [
    ...documentRelationshipsXml.matchAll(
      /<Relationship Id="([^"]+)" Type="http:\/\/schemas\.openxmlformats\.org\/officeDocument\/2006\/relationships\/hyperlink" Target="([^"]+)" TargetMode="External"\/>/g,
    ),
  ].map((match) => ({ id: match[1], target: decodeXmlAttribute(match[2]) }));
  const hyperlinkIds = [...documentXml.matchAll(/<w:hyperlink r:id="([^"]+)"/g)].map(
    (match) => match[1],
  );
  const markdownLinks = extractMarkdownLinks(markdown);
  const safeMarkdownLinks = markdownLinks.filter(({ target }) => isSafeHyperlinkTarget(target));
  const expectedTargets = [...new Set(safeMarkdownLinks.map(({ target }) => target))];
  const actualTargets = hyperlinkRelationships.map(({ target }) => target);
  if (JSON.stringify(actualTargets) !== JSON.stringify(expectedTargets)) {
    failures.push(
      `${output}: hyperlink relationship targets/order do not match Markdown (${actualTargets.join(", ")})`,
    );
  }
  if (hyperlinkIds.length !== safeMarkdownLinks.length) {
    failures.push(
      `${output}: expected ${safeMarkdownLinks.length} hyperlink elements, found ${hyperlinkIds.length}`,
    );
  }
  const relationshipsById = new Map(hyperlinkRelationships.map(({ id, target }) => [id, target]));
  for (const hyperlinkId of hyperlinkIds) {
    if (!relationshipsById.has(hyperlinkId)) {
      failures.push(`${output}: unresolved hyperlink relationship ${hyperlinkId}`);
    }
  }
  for (const { id } of hyperlinkRelationships) {
    if (!hyperlinkIds.includes(id)) failures.push(`${output}: unused hyperlink relationship ${id}`);
  }

  const footerXml = execFileSync("/usr/bin/unzip", ["-p", outputPath, "word/footer1.xml"], {
    encoding: "utf8",
  });
  for (const field of ['w:instr=" PAGE "', 'w:instr=" NUMPAGES "']) {
    if (!footerXml.includes(field)) failures.push(`${output}: missing footer field ${field}`);
  }
}

const archivedSddPath = join(repositoryRoot, "docs", "archive", "VESKIFY_SDD_v1.2.2.docx");
if (!existsSync(archivedSddPath)) {
  failures.push("Missing archived docs/archive/VESKIFY_SDD_v1.2.2.docx");
} else {
  try {
    execFileSync("/usr/bin/unzip", ["-tqq", archivedSddPath], { encoding: "utf8" });
  } catch {
    failures.push("Archived VESKIFY_SDD_v1.2.2.docx is not structurally valid");
  }
  const archivedHash = createHash("sha256").update(readFileSync(archivedSddPath)).digest("hex");
  if (archivedHash !== "27db7de65e0131dcdbba72adc765fe3716acadb2b150736e496789f7c24bbb25") {
    failures.push("Archived VESKIFY_SDD_v1.2.2.docx differs from the preserved historical export");
  }
}

if (failures.length > 0) {
  process.stderr.write(`${failures.join("\n")}\n`);
  process.exitCode = 1;
} else {
  const hashes = exportsToValidate.map(({ source }) =>
    createHash("sha256").update(readRepositoryFile(source)).digest("hex"),
  );
  process.stdout.write(
    `Documentation validation passed (${activeMarkdownFiles.length} active Markdown files; requirements FR ${definitionCounts.functional}, NFR ${definitionCounts.nonFunctional}, AC ${definitionCounts.acceptance}, dangling 0; synchronized SDD ${hashes[0]}; synchronized tracker ${hashes[1]}; archived v1.2.2 preserved).\n`,
  );
}
