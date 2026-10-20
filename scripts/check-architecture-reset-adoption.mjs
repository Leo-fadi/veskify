import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { posix, resolve } from "node:path";

const root = resolve(process.argv[2] ?? ".");
const read = (path) => {
  if (!existsSync(resolve(root, path))) throw new Error(`missing required policy source: ${path}`);
  return readFileSync(resolve(root, path), "utf8");
};
const requireText = (path, value) => {
  if (!read(path).includes(value)) throw new Error(`${path}: missing ${value}`);
};

const roadmap = read("docs/VESKIFY_DEVELOPMENT_ROADMAP.md");
const tracker = read("docs/VESKIFY_DEVELOPMENT_DELIVERY_TRACKER.md");
const readme = read("README.md");
const sdd = read("docs/VESKIFY_SDD.md");
const guide = read("docs/DEVELOPMENT_GUIDE.md");
const audit = read("docs/VESKIFY_CURRENT_STATE_TRUTH_AUDIT.md");
const ledger = read("docs/VESKIFY_CAPABILITY_EVIDENCE_LEDGER.md");
const addendum = read("docs/spec-addenda/AR-00_TEMPLATE_SCOPED_ARCHITECTURE.md");
const disposition = read("docs/AR_00_SOURCE_DISPOSITION_AND_ACCEPTANCE.md");
const sha256 = (path) => createHash("sha256").update(read(path)).digest("hex");

// AR-00B amends slice eligibility, not the original parent specifications or safety gates.
for (const [path, clauses] of [
  [
    "docs/spec-addenda/AR-00_TEMPLATE_SCOPED_ARCHITECTURE.md",
    [
      "An inspectable genuine output, owner-accepted visual quality, and production readiness are separate outcomes.",
      "AR-08 remains a required foundational completion gate, but it is not a blanket prerequisite",
    ],
  ],
  [
    "docs/VESKIFY_DEVELOPMENT_ROADMAP.md",
    [
      "### Early-slice eligibility crosswalk",
      "same running server process and same authorized P04 request context",
      "Plan one baseline request and zero automatic retries",
      "BATCH-17 granted zero calls",
      "AR-06D is Baseline / closed. Its accepted PR #263 head is 496664011c0b7553233ee160b70e2d89fc795eb2, merged as 970b6cd00a7df90cd7b2ff1008916e8c602127d0. One real model call and one official input-count request have executed.",
      "The owner accepts the honest technical baseline; visual quality remains below target. This is not commercial-quality acceptance or production approval. BATCH-18 delivery is complete.",
    ],
  ],
  [
    "docs/DEVELOPMENT_GUIDE.md",
    [
      "Silence is not acceptance.",
      "A technical diagnostic may finish with rejected visual quality",
    ],
  ],
]) {
  for (const clause of clauses) requireText(path, clause);
}
// VQ-01 permits sequential technical delivery, never inferred quality acceptance.
for (const [path, clause] of [
  ["AGENTS.md", "Tests, schemas, child PRs and navigation density do not complete VQ-01."],
  ["docs/DEVELOPMENT_GUIDE.md", "Final phase completion requires the owner's actual visual"],
  ["docs/VESKIFY_SDD.md", "### 10.21B BATCH-20 / VQ-01 generated-storefront quality phase"],
  [
    "docs/spec-addenda/AR-00_TEMPLATE_SCOPED_ARCHITECTURE.md",
    "## 18.2 BATCH-20 / VQ-01 product-quality phase",
  ],
])
  requireText(path, clause);
const phasePackages = roadmap
  .split("### Active implementation:")[1]
  ?.split("### Accepted predecessor:")[0];
if (
  JSON.stringify(
    [...(phasePackages ?? "").matchAll(/^\| (VQ[1-6])\s*\|/gmu)].map(([, id]) => id),
  ) !== JSON.stringify(["VQ1", "VQ2", "VQ3", "VQ4", "VQ5", "VQ6"])
)
  throw new Error("VQ-01: all six complete product-outcome packages are required");

const earlySliceRows = roadmap
  .split("### Early-slice eligibility crosswalk")[1]
  ?.split("### Active implementation:")[0];
const earlyOwners = [...(earlySliceRows ?? "").matchAll(/^\| (AR-\d{2})\s*\|/gmu)].map(
  ([, task]) => task,
);
if (
  JSON.stringify(earlyOwners) !==
  JSON.stringify([
    "AR-06",
    "AR-07",
    "AR-09",
    "AR-10",
    "AR-11",
    "AR-12",
    "AR-13",
    "AR-14",
    "AR-15",
    "AR-18",
    "AR-19",
    "AR-21",
    "AR-22",
  ])
)
  throw new Error("AR-00B: exact early-slice owner crosswalk is required");

requireText("docs/VESKIFY_DEVELOPMENT_DELIVERY_TRACKER.md", "AR-23 depends on AR-01");
// Retained pre-AR schedules must be historical at their point of use, including tables.
for (const [path, document] of [
  ["docs/VESKIFY_DEVELOPMENT_ROADMAP.md", roadmap],
  ["docs/VESKIFY_DEVELOPMENT_DELIVERY_TRACKER.md", tracker],
]) {
  const blocks = document.split(/\n\s*\n/u);
  for (const [index, block] of blocks.entries()) {
    if (!block.includes("P10B-19B-01") || !/exact[ -]next/iu.test(block)) continue;
    if (
      block.startsWith(
        "Historical scheduling projection (pre-AR; superseded, not current eligibility):",
      )
    )
      continue;
    if (
      block.startsWith("- ") &&
      blocks[index - 1] ===
        "Historical scheduling projection (pre-AR; superseded, not current eligibility):"
    )
      continue;
    if (
      block.startsWith("|") &&
      !block
        .split("\n")
        .some((line) => line.includes("P10B-19B-01") && /exact[ -]next/iu.test(line))
    )
      continue;
    throw new Error(
      `${path}: competing pre-AR next-task projection must be historical at its use site`,
    );
  }
}
const ar06cRows = tracker.split("\n").filter((line) => /^\| AR-06C\s*\|/u.test(line));
if (
  ar06cRows.length !== 1 ||
  !ar06cRows[0].includes(
    "**Baseline / closed; accepted PR #261, merge `de0faeba0d40bd36ac83f25d533a3428f83501cc`**",
  )
) {
  throw new Error("tracker: AR-06C child row must record its accepted closure");
}
// Mask examples without changing line positions used by the bounded section selectors.
const policyLines = (document) => {
  let fence;
  let excludedLevel;
  let retainedHistory = false;
  return document.split("\n").map((line) => {
    if (line === "<!-- CR00 retained-history begin -->") {
      if (retainedHistory) throw new Error("nested retained-history boundary");
      retainedHistory = true; return "";
    }
    if (line === "<!-- CR00 retained-history end -->") {
      if (!retainedHistory) throw new Error("unmatched retained-history boundary");
      retainedHistory = false; excludedLevel = undefined; return "";
    }
    if (retainedHistory) return "";
    const delimiter = line.match(/^\s*(`{3,}|~{3,})/u)?.[1];
    if (delimiter) {
      if (!fence) fence = delimiter;
      else if (delimiter[0] === fence[0] && delimiter.length >= fence.length) fence = undefined;
      return "";
    }
    if (fence) return "";
    const heading = line.match(/^(#{1,6})\s+(.+)$/u);
    if (heading) {
      const level = heading[1].length;
      if (excludedLevel && level <= excludedLevel) excludedLevel = undefined;
      if (/^(?:\d+\.\s*)?(?:historical\b|(?:quoted\s+)?examples?\b)/iu.test(heading[2]))
        excludedLevel ??= level;
    }
    return excludedLevel || /^\s*(?:>\s*)?Historical evidence:/iu.test(line) ? "" : line;
  });
};
const normalizeCurrentAuthority = (value) =>
  value
    // Keep exact authority filenames; quoted prose examples remain excluded.
    .replace(/`([^`\n]*)`/gu, (_, code) =>
      /^(?:docs\/)?VESKIFY_(?:SDD|DEVELOPMENT_ROADMAP|DEVELOPMENT_DELIVERY_TRACKER)\.md$/u.test(
        code,
      )
        ? code
        : "",
    )
    .replace(/^>\s?/gmu, "")
    .replace(/\*\*/gu, "")
    // The current-policy table form has two named columns, not arbitrary prose.
    .replace(
      /^\|\s*Task\s*\|\s*(Status|Dependencies)\s*\|\s*\n\|[ :|-]+\|\s*\n((?:\|[^\n]+\|[ \t]*(?:\n|$))+)/gimu,
      (_, field, rows) =>
        rows
          .split("\n")
          .filter(Boolean)
          .map((row) => {
            const cells = row
              .split("|")
              .slice(1, -1)
              .map((cell) => cell.trim());
            if (cells.length !== 2 || !/^(?:(?:AR|CR)-\d{2}|A-10C?|P10B-19A(?:-10C?)?)$/u.test(cells[0]))
              throw new Error("current policy: invalid Task table row");
            return `${cells[0]} ${field.toLowerCase() === "status" ? "is" : "depends on"} ${cells[1].replace(/\.$/u, "")}.`;
          })
          .join("\n"),
    )
    .replace(/\s+/gu, " ")
    .trim();
const currentBlock = (path, document, title, currentHeading, closingMarker) => {
  const lines = document.split("\n");
  if (lines[0] !== title) throw new Error(`${path}: current authority must begin with its title`);
  if (currentHeading) {
    const openingLine = lines.indexOf(currentHeading);
    const closingLine = lines.findIndex(
      (line, index) => index > openingLine && line === closingMarker,
    );
    if (openingLine === -1 || closingLine === -1) {
      throw new Error(`${path}: current authority boundary is missing`);
    }
    return normalizeCurrentAuthority(lines.slice(openingLine, closingLine).join("\n"));
  }
  const closingLine = lines.findIndex((line, index) => index > 1 && line && !line.startsWith(">"));
  return normalizeCurrentAuthority(
    lines.slice(0, closingLine === -1 ? lines.length : closingLine).join("\n"),
  );
};
// One catalogue drives primary sections and later explicit current-policy declarations.
// README/audit/ledger are bounded projections, never alternative order/status authorities.
const policySources = [
  ["README.md", readme, "# Veskify"],
  [
    "docs/VESKIFY_DEVELOPMENT_DELIVERY_TRACKER.md",
    tracker,
    "# Veskify Development Delivery Tracker",
  ],
  [
    "docs/VESKIFY_DEVELOPMENT_ROADMAP.md",
    roadmap,
    "# Veskify Development Roadmap",
    "## CR-00 current corrective order (proposed; owner adoption/merge pending)",
    "<!-- CR00 current-order end -->",
  ],
  ["docs/VESKIFY_SDD.md", sdd, "# Veskify Software Design Document v1.3.0"],
  ["docs/DEVELOPMENT_GUIDE.md", guide, "# Veskify Development Guide"],
  ["docs/VESKIFY_CURRENT_STATE_TRUTH_AUDIT.md", audit, "# Veskify Current-State Truth Audit"],
  ["docs/VESKIFY_CAPABILITY_EVIDENCE_LEDGER.md", ledger, "# Veskify Capability Evidence Ledger"],
  [
    "docs/spec-addenda/AR-00_TEMPLATE_SCOPED_ARCHITECTURE.md",
    addendum,
    "## AR-00 — Template-scoped architecture and replacement-roadmap addendum",
    "all",
  ],
  ["AGENTS.md", read("AGENTS.md"), "# Veskify Codex Constitution", "sections"],
  [
    "docs/AGENT_TEAM_WORKFLOW.md",
    read("docs/AGENT_TEAM_WORKFLOW.md"),
    "# Local Codex team workflow",
    "all",
  ],
];
const sourcePaths = new Set([...policySources.map(([path]) => path), "docs/CR_00_REQUIREMENT_DISPOSITION.md"]);
const links = (owner, text) =>
  [...text.matchAll(/\[[^\]]+\]\(([^)]+\.md)\)/gu)].map(([, target]) =>
    posix.normalize(posix.join(posix.dirname(owner), target)),
  );
const sddNotice = currentBlock(
  "docs/VESKIFY_SDD.md",
  sdd,
  "# Veskify Software Design Document v1.3.0",
);
const incorporated = links("docs/VESKIFY_SDD.md", sddNotice);
const requiredAddendum = "docs/spec-addenda/AR-00_TEMPLATE_SCOPED_ARCHITECTURE.md";
if (
  !incorporated.includes(requiredAddendum) ||
  !sddNotice.includes("is incorporated into this SDD")
)
  throw new Error("SDD: missing required incorporated policy source");
const deliveryReferences = ["Delivery plan", "Delivery status"].flatMap((label) => {
  const row = sdd.split("\n").find((line) => new RegExp(`^\\| ${label}\\s+\\|`, "u").test(line));
  const targets = links("docs/VESKIFY_SDD.md", row ?? "");
  if (targets.length !== 1) throw new Error(`SDD: missing required ${label} policy source`);
  return targets;
});
for (const path of [...incorporated, ...deliveryReferences]) {
  if (!sourcePaths.has(path)) throw new Error(`SDD: unscanned required policy source: ${path}`);
}
if (
  deliveryReferences[0] !== "docs/VESKIFY_DEVELOPMENT_ROADMAP.md" ||
  deliveryReferences[1] !== "docs/VESKIFY_DEVELOPMENT_DELIVERY_TRACKER.md"
)
  throw new Error("SDD: delivery authority allocation changed");
const addendumDelivery = addendum
  .split("## 5. Delivery gates and retirement\n")[1]
  ?.split("\n## ")[0];
if (
  !addendumDelivery ||
  JSON.stringify(links(requiredAddendum, addendumDelivery)) !==
    JSON.stringify(deliveryReferences) ||
  !addendumDelivery.includes("is the delivery-order authority") ||
  !addendumDelivery.includes("alone owns task status")
)
  throw new Error("addendum: required delivery authority references changed");
requireText(
  "docs/AR_00_SOURCE_DISPOSITION_AND_ACCEPTANCE.md",
  "The SDD is authoritative; the roadmap owns order and the tracker owns status.",
);

const section = (path, lines, heading) => {
  const start = lines.indexOf(heading);
  if (start < 0) throw new Error(`${path}: current authority boundary is missing: ${heading}`);
  const level = heading.match(/^#+/u)[0].length;
  const end = lines.findIndex(
    (line, index) => index > start && new RegExp(`^#{1,${level}} `, "u").test(line),
  );
  return lines.slice(start, end < 0 ? lines.length : end).join("\n");
};
const currentAuthorities = policySources.map(([path, document, title, heading, closing]) => {
  const lines = policyLines(document);
  if (lines[0] !== title) throw new Error(`${path}: current authority must begin with its title`);
  const content =
    heading === "all"
      ? lines
          .filter((line) => !line.startsWith(">") && !/^#{1,6}\s+current policy\s*$/iu.test(line))
          .join("\n")
      : heading === "sections"
        ? ["## 1. Source of truth", "### 8.0 AR-00 adopted architecture policy"]
            .map((name) => section(path, lines, name))
            .join("\n")
        : currentBlock(path, lines.join("\n"), title, heading, closing);
  // The following old micro-task map is explicitly superseded historical planning.
  const protocol =
    path === "docs/DEVELOPMENT_GUIDE.md"
      ? section(path, lines, "## 4. Branch and PR strategy").split(
          "### P10B-19A planned micro-pull-request map",
        )[0]
      : "";
  return [path, normalizeCurrentAuthority(`${content}\n${protocol}`)];
});
const currentPolicyBlocks = (path, document) => {
  const lines = policyLines(document);
  return lines.flatMap((line, openingLine) => {
    if (!/^#{1,6}\s+current policy\s*$/iu.test(line)) return [];
    const closingLine = lines.findIndex(
      (candidate, index) => index > openingLine && /^#{1,6}\s/iu.test(candidate),
    );
    return [
      [
        path,
        normalizeCurrentAuthority(
          lines
            .slice(openingLine + 1, closingLine === -1 ? lines.length : closingLine)
            .filter((candidate) => !candidate.startsWith(">"))
            .join("\n"),
        ),
      ],
    ];
  });
};
const quotedCurrentPolicyBlocks = (path, document) =>
  [...document.matchAll(/^>\s*\*\*current policy\s*:\*\*\s*([^\n]*(?:\n>[^\n]*)*)/gimu)].map(
    ([, block]) => [path, normalizeCurrentAuthority(block)],
  );
const explicitCurrentAuthorities = policySources.flatMap(([path, document, , heading]) => [
  ...(heading === "all" ? [] : currentPolicyBlocks(path, document)),
  ...quotedCurrentPolicyBlocks(path, policyLines(document).join("\n")),
]);
const allCurrentAuthorities = [...currentAuthorities, ...explicitCurrentAuthorities];
// Ownership is an invariant on the SAME current-policy surfaces as task status
// and dependencies, not a special case checked only in the SDD/addendum.
// This covers the repository's declared forms: owns, is/remains the authority,
// and is owned by. It is deliberately not a general prose contradiction parser.
const ownershipRecords = [];
const ownershipReference = (value) => {
  const basename = posix.basename(value.split(/[?#]/u)[0]);
  return {
    "VESKIFY_DEVELOPMENT_ROADMAP.md": "roadmap",
    "VESKIFY_DEVELOPMENT_DELIVERY_TRACKER.md": "tracker",
    "VESKIFY_SDD.md": "sdd",
  }[basename];
};
const ownershipSubject = String.raw`(?:roadmap|tracker|sdd|addendum|readme|guide|audit|ledger|unknown-policy-owner)`;
const ownershipConcern = String.raw`(?:(?:current[ -])?(?:task[ -])?status|(?:(?:delivery|dependency)[ -])?order)`;
const ownershipPatterns = [
  {
    expression: new RegExp(
      String.raw`\b(${ownershipSubject})\s+(?:alone\s+)?owns\s+(?:the\s+)?(${ownershipConcern})\b`,
      "giu",
    ),
    reversed: false,
  },
  {
    expression: new RegExp(
      String.raw`\b(${ownershipSubject})\s+(?:is|remains)\s+(?:the\s+)?(?:sole\s+|current\s+)?(${ownershipConcern})\s+authority\b`,
      "giu",
    ),
    reversed: false,
  },
  {
    expression: new RegExp(
      String.raw`\b(${ownershipConcern})\s+is\s+owned\s+(?:only\s+)?by\s+(?:the\s+)?(?:delivery\s+)?(${ownershipSubject})\b`,
      "giu",
    ),
    reversed: true,
  },
];
for (const [path, block] of allCurrentAuthorities) {
  const text = block
    .replace(/\[([^\]]+)\]\(([^)]+)\)/gu, (_, label, target) => {
      const reference = ownershipReference(target);
      // The linked destination, not a potentially misleading label, is the owner.
      if (reference) return reference;
      return /^(?:development |delivery )?(?:roadmap|tracker)$/iu.test(label)
        ? "unknown-policy-owner"
        : label;
    })
    .replace(
      /\b(?:docs\/)?VESKIFY_(?:SDD|DEVELOPMENT_ROADMAP|DEVELOPMENT_DELIVERY_TRACKER)\.md\b/gu,
      (reference) => ownershipReference(reference),
    );
  for (const { expression, reversed } of ownershipPatterns) {
    for (const [, first, second] of text.matchAll(expression)) {
      const owner = (reversed ? second : first).toLowerCase();
      const concern = /status$/iu.test(reversed ? first : second) ? "status" : "order";
      const expectedOwner = concern === "status" ? "tracker" : "roadmap";
      if (owner !== expectedOwner) {
        throw new Error(`${path}: contradictory current ownership for ${concern}: ${owner}`);
      }
      ownershipRecords.push({ path, concern });
    }
  }
}
// Existing primary notices must not disappear into unrecognised/removed wording.
// Additional declarations on ANY scanned surface are checked by the loop above.
const requiredOwnership = [
  ["README.md", ["order", "status"]],
  ["docs/VESKIFY_DEVELOPMENT_DELIVERY_TRACKER.md", ["order", "status"]],
  ["docs/DEVELOPMENT_GUIDE.md", ["order", "status"]],
  ["docs/VESKIFY_CAPABILITY_EVIDENCE_LEDGER.md", ["status"]],
  [requiredAddendum, ["order", "status"]],
  ["AGENTS.md", ["order", "status"]],
];
for (const [path, concerns] of requiredOwnership) {
  for (const concern of concerns) {
    if (!ownershipRecords.some((record) => record.path === path && record.concern === concern)) {
      throw new Error(`${path}: missing required current ownership for ${concern}`);
    }
  }
}
// The tracker's document-control table is also an existing ownership projection.
const trackerOrderRows = tracker
  .split("\n")
  .filter((line) => /^\| Delivery order\s+\|/u.test(line));
if (
  trackerOrderRows.length !== 1 ||
  JSON.stringify(links("docs/VESKIFY_DEVELOPMENT_DELIVERY_TRACKER.md", trackerOrderRows[0])) !==
    JSON.stringify(["docs/VESKIFY_DEVELOPMENT_ROADMAP.md"])
) {
  throw new Error("tracker: delivery-order authority reference changed");
}
const statusExpectation = new Map([
  ["AR-00", "Baseline"],
  ["AR-01", "Baseline"],
  ["A-10", "Baseline"],
  ["A-10C", "Baseline"],
  ["P10B-19A-10", "Baseline"],
  ["P10B-19A-10C", "Baseline"],
  ["P10B-19A", "Baseline"],
]);
for (let number = 2; number <= 30; number += 1) {
  statusExpectation.set(`AR-${String(number).padStart(2, "0")}`, "Planned");
}
statusExpectation.set("AR-02", "Baseline");
statusExpectation.set("AR-02A", "Baseline");
statusExpectation.set("AR-02B", "Baseline");
statusExpectation.set("AR-02C", "Baseline");
statusExpectation.set("AR-02D", "Baseline");
statusExpectation.set("AR-02E", "Baseline");
statusExpectation.set("AR-02F", "Baseline");
statusExpectation.set("AR-02G", "Baseline");
statusExpectation.set("AR-02H", "Baseline");
statusExpectation.set("AR-02I", "Baseline");
statusExpectation.set("AR-02J", "Baseline");
statusExpectation.set("AR-02K", "Baseline");
statusExpectation.set("AR-02L", "Baseline");
statusExpectation.set("AR-02M", "Baseline");
statusExpectation.set("AR-03", "Baseline");
statusExpectation.set("AR-03A", "Baseline");
statusExpectation.set("AR-03B", "Baseline");
statusExpectation.set("AR-03C", "Baseline");
statusExpectation.set("AR-03D", "Baseline");
statusExpectation.set("AR-03E", "Baseline");
statusExpectation.set("AR-04", "Baseline");
statusExpectation.set("AR-05", "Baseline");
statusExpectation.set("AR-05A", "Baseline");
statusExpectation.set("AR-05B", "Baseline");
statusExpectation.set("AR-06", "Partial");
statusExpectation.set("AR-06A", "Baseline");
statusExpectation.set("AR-06B", "Baseline");
statusExpectation.set("AR-06C", "Baseline");
statusExpectation.set("AR-06D", "Baseline");
statusExpectation.set("AR-10A", "Baseline");
statusExpectation.set("AR-09A", "Baseline");
statusExpectation.set("AR-10B", "Paused");
statusExpectation.set("CR-00", "Prepared");
for (let n = 1; n <= 19; n += 1) statusExpectation.set(`CR-${String(n).padStart(2, "0")}`, "Planned");
statusExpectation.set("AR-00B", "Baseline");
const statusRecords = [];
const dependencyRecords = [];
const activeAmendmentRecords = [];
for (const [path, block] of allCurrentAuthorities) {
  const addStatus = (subject, status, qualifier = "") => {
    const normalizedQualifier = qualifier.trim();
    statusRecords.push({ path, subject, status, qualifier: normalizedQualifier });
  };
  for (const [, subject, status, qualifier] of block.matchAll(
    /(?<!when )\b((?:AR|CR)-\d{2}[A-Z]?|A-10(?:C)?|P[A-Z0-9]+(?:-[A-Z0-9]+)+) is (?!a\b|the\b|eligible\b|not\b)([A-Za-z]+)\b([^.;]*)/giu,
  )) {
    addStatus(subject, status, qualifier);
  }
  for (const [, subject, status, qualifier] of block.matchAll(
    /\b((?:AR|CR)-\d{2}[A-Z]?|A-10(?:C)?|P[A-Z0-9]+(?:-[A-Z0-9]+)+) is not ([A-Za-z]+)\b([^.;]*)/giu,
  )) {
    if (status.toLowerCase() !== "serialized") addStatus(subject, `not ${status}`, qualifier);
  }
  for (const [, subject, status, qualifier] of block.matchAll(
    /\b((?:AR|CR)-\d{2}[A-Z]?|A-10(?:C)?|P[A-Z0-9]+(?:-[A-Z0-9]+)+) current status authority:\s*([A-Za-z]+)\b([^.;]*)/giu,
  )) {
    addStatus(subject, status, qualifier);
  }
  for (const [, left, right, status, qualifier] of block.matchAll(
    /\b(P[A-Z0-9]+(?:-[A-Z0-9]+)+) and (P[A-Z0-9]+(?:-[A-Z0-9]+)+) are ([A-Za-z]+)\b([^.;]*)/gu,
  )) {
    addStatus(left, status, qualifier);
    addStatus(right, status, qualifier);
  }
  const addDependencies = (subject, rawDependencies) => {
    const dependencySet = rawDependencies.replace(
      /\s+and is (?:not serialized behind visual work|eligible alongside later eligible work; numeric order does not serialize it behind visual packages)$/iu,
      "",
    );
    const dependencies = [...dependencySet.matchAll(/\bAR-\d{2}\b/gu)].map(([id]) => id);
    const residue = dependencySet.replace(/\bAR-\d{2}\b|and|,|\s/giu, "");
    dependencyRecords.push({ path, subject, dependencies, residue, rawDependencies });
  };
  for (const [, subject, rawDependencies] of block.matchAll(
    /\b(AR-\d{2}) depends (?:only )?on ([^.]+)\./gu,
  )) {
    addDependencies(subject, rawDependencies);
  }
  for (const [, subject, rawDependencies] of block.matchAll(
    /\b(AR-\d{2}) is eligible after ([^.]+)\./gu,
  )) {
    addDependencies(subject, rawDependencies);
  }
  for (const [, subject] of block.matchAll(/\b(AR-\d{2}[A-Z]?) is the active amendment\b/giu)) {
    activeAmendmentRecords.push({ path, subject });
  }
}
for (const record of statusRecords) {
  const expected = statusExpectation.get(record.subject);
  const normalizedQualifier = record.qualifier.replace(/^[—:/\s]+/u, "").trim();
  const permittedQualifier = record.subject.startsWith("CR-")
    ? /^(?:adoption\/owner merge pending|separate launch required)?$/iu
    : record.subject === "AR-10B" ? /^$/u
    : ["AR-00", "AR-01"].includes(record.subject)
    ? /^closed$/iu
    : ["AR-02", "AR-02M"].includes(record.subject)
      ? /^closed$/iu
      : record.subject === "AR-03"
        ? /^closed(?: upon (?:explicit )?owner acceptance\/merge)?$/iu
        : record.subject === "AR-02A"
          ? /^closed(?: upon (?:explicit )?owner acceptance\/merge)?$/iu
          : record.subject === "AR-02B"
            ? /^closed(?: upon (?:explicit )?owner acceptance\/merge)?$/iu
            : record.subject === "AR-02C"
              ? /^closed(?: upon (?:explicit )?owner acceptance\/merge)?$/iu
              : record.subject === "AR-02D"
                ? /^closed(?: upon (?:explicit )?owner acceptance\/merge)?$/iu
                : [
                      "AR-02E",
                      "AR-02F",
                      "AR-02G",
                      "AR-02H",
                      "AR-02I",
                      "AR-02J",
                      "AR-02K",
                      "AR-02L",
                    ].includes(record.subject)
                  ? /^closed(?: upon (?:explicit )?owner acceptance\/merge)?$/iu
                  : ["AR-03A", "AR-03B", "AR-03C", "AR-03D", "AR-03E"].includes(record.subject)
                    ? /^closed(?: upon (?:explicit )?owner acceptance\/merge)?$/iu
                    : record.subject === "AR-23"
                      ? /^unstarted$/iu
                      : record.subject === "AR-04"
                        ? /^closed$/iu
                        : record.subject === "AR-06A"
                          ? /^closed$/iu
                          : record.subject === "AR-06B"
                            ? /^closed$/iu
                            : record.subject === "AR-06C"
                              ? /^closed$/iu
                              : record.subject === "AR-06D"
                                ? /^closed$/iu
                                : record.subject === "AR-10A"
                                  ? /^closed$/iu
                                  : record.subject === "AR-09A"
                                    ? /^closed$/iu
                                    : record.subject === "AR-00B"
                                      ? /^closed$/iu
                                      : ["AR-05", "AR-05B"].includes(record.subject)
                                        ? /^closed$/iu
                                        : record.subject === "AR-05A"
                                          ? /^closed$/iu
                                          : /^AR-\d{2}$/u.test(record.subject)
                                            ? /^$/u
                                            : /^(?:closed)?$/iu;
  if (
    expected?.toLowerCase() !== record.status.toLowerCase() ||
    !permittedQualifier.test(normalizedQualifier)
  ) {
    throw new Error(`${record.path}: contradictory current status for ${record.subject}`);
  }
}
for (const [path] of allCurrentAuthorities) {
  const records = statusRecords.filter((record) => record.path === path);
  for (const subject of new Set(records.map((record) => record.subject))) {
    if (records.filter((record) => record.subject === subject).length !== 1) {
      throw new Error(`${path}: duplicate current status declaration for ${subject}`);
    }
  }
}
for (const [path] of allCurrentAuthorities) {
  const records = dependencyRecords.filter((record) => record.path === path);
  for (const subject of new Set(records.map((record) => record.subject))) {
    if (records.filter((record) => record.subject === subject).length !== 1) {
      throw new Error(`${path}: duplicate current dependency declaration for ${subject}`);
    }
  }
}
const nextTaskIds = (block) =>
  [
    ...block.matchAll(
      /(AR-\d{2}[A-Z]?) is (?:(?!AR-\d{2}[A-Z]?)[^.]){0,80}?(?:(?:sole|exact) next (?:reset )?(?:task|selected child)|exact selected next child|selected successor)/giu,
    ),
  ].map(([, id]) => id);
for (const [path, block] of allCurrentAuthorities) {
  const declaredNext = nextTaskIds(block);
  if (declaredNext.length > 0) {
    throw new Error(`${path}: current authority assigns ${declaredNext[0]} as next`);
  }
}
if (activeAmendmentRecords.length > 0) {
  const record = activeAmendmentRecords[0];
  throw new Error(`${record.path}: contradictory current schedule for ${record.subject}`);
}
const trackerCurrent = currentAuthorities.find(([path]) =>
  path.endsWith("DELIVERY_TRACKER.md"),
)?.[1];
// CR-00 replaces forward scheduling, not accepted historical outcomes.
for (const clause of [
  "CR-00 is Prepared — adoption/owner merge pending",
  "CR-01 and CR-02 are Planned — separate launch required",
  "CR-03 through CR-19 are Planned",
  "AR-02, AR-03, AR-04 and AR-05 are Baseline / closed",
  "Accepted AR-06A/B/C/D and AR-09A children are closed at their recorded merges",
  "BATCH-20 / VQ-01 is PAUSED", "AR-10B is Paused", "AR-09A is Baseline / closed",
  "AR-06 is Partial",
  "no CR task is complete or launched by this adoption",
]) if (!trackerCurrent?.includes(clause)) throw new Error(`tracker: missing current CR-00 boundary: ${clause}`);
const roadmapCurrent = currentAuthorities.find(([path]) => path.endsWith("DEVELOPMENT_ROADMAP.md"))?.[1];
// Guard the actual operative gate clauses, not only their labels or nonempty cells.
for (const clause of [
  "does not start a task",
  "G0 foundation choice at CR-02",
  "G1 owner direction for configured templates at CR-05",
  "G2 real AI authoring at CR-06–08",
  "G3 owner acceptance of the complete internal product at CR-14",
  "G4 host/pilot proof at CR-19",
]) {
  if (!roadmapCurrent?.includes(clause))
    throw new Error(`roadmap: missing current corrective gate: ${clause}`);
}
const taskSections = new Map(
  roadmap
    .split(/^### /mu)
    .slice(1)
    .map((section) => {
      const [heading, ...body] = section.split("\n");
      return [heading.match(/^(AR-\d{2}) —/u)?.[1], body.join("\n")];
    })
    .filter(([id]) => id),
);
const detailedTaskMatches = [...roadmap.matchAll(/^### (AR-\d{2}) —/gmu)];
const dependencyRowMatches = [
  ...roadmap.matchAll(/^\| P\d\s+\|\s+(AR-\d{2})\s+\|.*?\|\s+(.*?)\s+\|$/gmu),
];
const dependencyRows = new Map(
  dependencyRowMatches.map(([, id, dependencies]) => [id, dependencies]),
);
const expectedDependencies = new Map([
  ["AR-00", "—"],
  ["AR-01", "AR-00"],
  ["AR-02", "AR-01"],
  ["AR-03", "AR-01"],
  ["AR-04", "AR-02, AR-03"],
  ["AR-05", "AR-02, AR-03"],
  ["AR-06", "AR-05"],
  ["AR-07", "AR-04, AR-06"],
  ["AR-08", "AR-07"],
  ["AR-09", "AR-08"],
  ["AR-10", "AR-09"],
  ["AR-11", "AR-10"],
  ["AR-12", "AR-10"],
  ["AR-13", "AR-11, AR-12"],
  ["AR-14", "AR-13"],
  ["AR-15", "AR-14"],
  ["AR-16", "AR-07"],
  ["AR-17", "AR-16, AR-23"],
  ["AR-18", "AR-09, AR-16"],
  ["AR-19", "AR-13, AR-16, AR-18"],
  ["AR-20", "AR-19, AR-15"],
  ["AR-21", "AR-15, AR-19"],
  ["AR-22", "AR-15, AR-20, AR-21"],
  ["AR-23", "AR-01"],
  ["AR-24", "AR-07, AR-23"],
  ["AR-25", "AR-17, AR-19, AR-24"],
  ["AR-26", "AR-25"],
  ["AR-27", "AR-25"],
  ["AR-28", "AR-17, AR-20, AR-22, AR-26, AR-27"],
  ["AR-29", "AR-04, AR-20, AR-22"],
  ["AR-30", "AR-28, AR-29"],
]);
const normalizedDependencies = (value) => (value === "—" ? [] : value.split(", "));
for (const record of dependencyRecords) {
  throw new Error(`${record.path}: contradictory current dependency declaration for ${record.subject}; AR dependency records are historical`);
}
if (
  dependencyRowMatches.length !== 31 ||
  dependencyRows.size !== 31 ||
  detailedTaskMatches.length !== 31 ||
  taskSections.size !== 31
) {
  throw new Error("roadmap: duplicate or incomplete task record");
}
for (let number = 0; number <= 30; number += 1) {
  const id = `AR-${String(number).padStart(2, "0")}`;
  const section = taskSections.get(id);
  if (!section) throw new Error(`roadmap: missing detailed ${id} section`);
  for (const field of [
    "**Outcome:**",
    "**Changes:**",
    "**Acceptance:**",
    "**Non-goals:**",
    "**Rollback / failure behavior:**",
  ]) {
    if (!section.includes(field)) throw new Error(`roadmap: ${id} missing ${field}`);
  }
  if (dependencyRows.get(id) !== expectedDependencies.get(id))
    throw new Error(`roadmap: ${id} dependency mismatch`);
  const detailedDependencies = [...section.matchAll(/\*\*Dependencies:\*\* ([^.]+)\./gu)].map(
    ([, dependencies]) => dependencies,
  );
  if (
    detailedDependencies.length !== 1 ||
    detailedDependencies[0] !== expectedDependencies.get(id)
  ) {
    throw new Error(`roadmap: ${id} detailed dependency mismatch`);
  }
}
if (dependencyRows.get("AR-23") !== "AR-01")
  throw new Error("roadmap: AR-23 must depend only on AR-01");
for (const family of [
  "campaign-modular",
  "technical-comparison",
  "warm-narrative",
  "restrained-gallery",
]) {
  if (!disposition.includes(family) || !roadmap.includes(family)) {
    throw new Error(`deferred family missing: ${family}`);
  }
}
for (const identifier of [
  "5292792dae97273411702eeaf468575172c0cf46b026103216423de29eaf47fd",
  "757c0febf40da2e893f99795dc12bbf1e5bf933fe55b326cab512f80f35d67b1",
  "P10B-19A-10C is **Baseline**",
  "P10B-19A-10 and P10B-19A are **Baseline / closed**",
]) {
  if (!disposition.includes(identifier))
    throw new Error(`historical identity missing: ${identifier}`);
}
if (
  sha256("docs/P10B_19_STRUCTURAL_DESIGN_INTELLIGENCE_ARCHITECTURE.md") !==
  "5292792dae97273411702eeaf468575172c0cf46b026103216423de29eaf47fd"
)
  throw new Error("P19 architecture bytes changed");
if (
  sha256("tests/fixtures/p10b-19a-10c-architecture-closure-manifest.v1.json") !==
  "757c0febf40da2e893f99795dc12bbf1e5bf933fe55b326cab512f80f35d67b1"
)
  throw new Error("closure fixture bytes changed");
for (let number = 1; number <= 36; number += 1) {
  if (!disposition.includes(`#### I${String(number).padStart(2, "0")}`))
    throw new Error(`disposition: missing I${String(number).padStart(2, "0")}`);
}
if (
  !addendum.includes("StorefrontSnapshot remains the sole canonical editable storefront aggregate")
) {
  throw new Error("addendum: competing canonical-state protection missing");
}
for (const path of [
  "docs/VESKIFY_SDD.md",
  "docs/VESKIFY_DEVELOPMENT_ROADMAP.md",
  "docs/VESKIFY_DEVELOPMENT_DELIVERY_TRACKER.md",
  "docs/spec-addenda/AR-00_TEMPLATE_SCOPED_ARCHITECTURE.md",
  "docs/AR_00_SOURCE_DISPOSITION_AND_ACCEPTANCE.md",
]) {
  if (!existsSync(resolve(root, path))) throw new Error(`missing required file: ${path}`);
}
const correctiveDependencies = [
  "—", "CR-00", "CR-01; separate service/spend access", "CR-02", "CR-03", "CR-03, CR-04",
  "CR-05; exact paid authority", "CR-06", "CR-06, CR-07", "CR-05, CR-08", "CR-07, CR-08, CR-09",
  "CR-10", "CR-07, CR-09, CR-10", "CR-10, CR-12", "CR-11, CR-12, CR-13", "CR-14",
  "CR-02; separate host access", "CR-14, CR-16", "CR-13, CR-17", "CR-14, CR-18",
];
const correctiveRows = [...roadmap.matchAll(/^\| (CR-\d{2}) \| ([^|]+) \| ([^|]+) \| ([^|]+) \|$/gmu)];
if (correctiveRows.length !== 20) throw new Error("corrective roadmap: duplicate or missing task row");
for (const [index, [, id, outcome, dependencies, failure]] of correctiveRows.entries()) {
  if (id !== `CR-${String(index).padStart(2, "0")}` || dependencies.trim() !== correctiveDependencies[index] || !outcome.trim() || !failure.trim())
    throw new Error(`corrective roadmap: ${id} exact dependency/outcome mismatch`);
  if (id === "CR-14" && (
    outcome.trim() !== "Owner internal-product acceptance on independent evidence" ||
    failure.trim() !== "No owner acceptance leaves product incomplete."
  )) throw new Error("corrective roadmap: CR-14 owner acceptance/failure routing changed");
}
for (const [path, block] of allCurrentAuthorities) {
  if (/BATCH-20(?: \/ VQ-01)? is (?:active|resumed)/iu.test(block)) throw new Error(`${path}: superseded BATCH-20 activation`);
  const records = [...block.matchAll(/\b(CR-\d{2}) depends (?:only )?on ([^.]+)\./gu)];
  const seen = new Set();
  for (const [, id, raw] of records) {
    const n = Number(id.slice(3));
    if (seen.has(id)) throw new Error(`${path}: duplicate current dependency declaration for ${id}`);
    seen.add(id);
    if (!correctiveDependencies[n] || raw.replace(/ and /gu, ", ") !== correctiveDependencies[n].split(";")[0])
      throw new Error(`${path}: contradictory current dependency declaration for ${id}`);
  }
}
const requirementRows = [...sdd.matchAll(/^\| \*\*(?:FR|NFR|AC)-1\d\d\*\* \|.*$/gmu)].map(([row]) => row);
if (requirementRows.length !== 72 || createHash("sha256").update(requirementRows.join("\n")).digest("hex") !== "098f629a42c6d67a2b26ef2f1b173143617e5188cee3a2162af80c2a5e66a019")
  throw new Error("CR-00: original 72 requirement definitions changed");
const crDisposition = read("docs/CR_00_REQUIREMENT_DISPOSITION.md");
const mapped = [...crDisposition.matchAll(/^\| ((?:FR|NFR|AC)-1\d\d) \|/gmu)].map(([, id]) => id);
const originalIds = requirementRows.map((row) => row.match(/\*\*((?:FR|NFR|AC)-1\d\d)\*\*/u)[1]);
if (JSON.stringify(mapped) !== JSON.stringify(originalIds)) throw new Error("CR-00: missing/duplicate requirement disposition");
for (const [prefix, count, expression] of [["T",24,/^\| (T\d{2}) \|/gmu],["F",10,/^\| (F\d{2}) —/gmu]]) {
  const ids=[...crDisposition.matchAll(expression)].map(([,id])=>id);
  if (JSON.stringify(ids)!==JSON.stringify(Array.from({length:count},(_,i)=>`${prefix}${String(i+1).padStart(2,"0")}`)))
    throw new Error(`CR-00: incomplete/duplicate ${prefix} crosswalk`);
}
for (const [path, document] of policySources) {
  const begins = (document.match(/<!-- CR00 retained-history begin -->/gu) ?? []).length;
  const ends = (document.match(/<!-- CR00 retained-history end -->/gu) ?? []).length;
  if (begins !== ends) throw new Error(`${path}: unclosed historical boundary`);
}
process.stdout.write(
  `AR-00 architecture-reset adoption checks passed (31 outcomes retained, 20 corrective tasks, 72 unchanged definitions, T01–T24/F01–F10, ${policySources.length} current-policy surfaces, historical identities retained)\n`,
);
