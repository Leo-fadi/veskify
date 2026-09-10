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

requireText("docs/VESKIFY_DEVELOPMENT_DELIVERY_TRACKER.md", "AR-23 depends on AR-01");
// Mask examples without changing line positions used by the bounded section selectors.
const policyLines = (document) => {
  let fence;
  let excludedLevel;
  return document.split("\n").map((line) => {
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
            if (cells.length !== 2 || !/^(?:AR-\d{2}|A-10C?|P10B-19A(?:-10C?)?)$/u.test(cells[0]))
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
    "## AR-00 replacement-roadmap projection (effective on adoption/merge)",
    "| Package | Task  | Outcome                                                 | Dependencies                      |",
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
const sourcePaths = new Set(policySources.map(([path]) => path));
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
statusExpectation.set("AR-02", "Partial");
statusExpectation.set("AR-02A", "Baseline");
statusExpectation.set("AR-02B", "Baseline");
statusExpectation.set("AR-02C", "Baseline");
statusExpectation.set("AR-02D", "Baseline");
statusExpectation.set("AR-02E", "Baseline");
statusExpectation.set("AR-02F", "Baseline");
statusExpectation.set("AR-02G", "Baseline");
statusExpectation.set("AR-02H", "Baseline");
statusExpectation.set("AR-03", "Partial");
statusExpectation.set("AR-03A", "Baseline");
statusExpectation.set("AR-03B", "Baseline");
statusExpectation.set("AR-03C", "Baseline");
statusExpectation.set("AR-03D", "Baseline");
const statusRecords = [];
const dependencyRecords = [];
const activeAmendmentRecords = [];
for (const [path, block] of allCurrentAuthorities) {
  const addStatus = (subject, status, qualifier = "") => {
    const normalizedQualifier = qualifier.trim();
    statusRecords.push({ path, subject, status, qualifier: normalizedQualifier });
  };
  for (const [, subject, status, qualifier] of block.matchAll(
    /(?<!when )\b(AR-\d{2}[A-Z]?|A-10(?:C)?|P[A-Z0-9]+(?:-[A-Z0-9]+)+) is (?!a\b|the\b|eligible\b|not\b)([A-Za-z]+)\b([^.;]*)/giu,
  )) {
    addStatus(subject, status, qualifier);
  }
  for (const [, subject, status, qualifier] of block.matchAll(
    /\b(AR-\d{2}[A-Z]?|A-10(?:C)?|P[A-Z0-9]+(?:-[A-Z0-9]+)+) is not ([A-Za-z]+)\b([^.;]*)/giu,
  )) {
    if (status.toLowerCase() !== "serialized") addStatus(subject, `not ${status}`, qualifier);
  }
  for (const [, subject, status, qualifier] of block.matchAll(
    /\b(AR-\d{2}[A-Z]?|A-10(?:C)?|P[A-Z0-9]+(?:-[A-Z0-9]+)+) current status authority:\s*([A-Za-z]+)\b([^.;]*)/giu,
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
  const permittedQualifier = ["AR-00", "AR-01"].includes(record.subject)
    ? /^closed$/iu
    : record.subject === "AR-02"
      ? /^$/u
      : record.subject === "AR-03"
        ? /^$/u
        : record.subject === "AR-02A"
          ? /^closed(?: upon (?:explicit )?owner acceptance\/merge)?$/iu
          : record.subject === "AR-02B"
            ? /^closed(?: upon (?:explicit )?owner acceptance\/merge)?$/iu
            : record.subject === "AR-02C"
              ? /^closed(?: upon (?:explicit )?owner acceptance\/merge)?$/iu
              : record.subject === "AR-02D"
                ? /^closed(?: upon (?:explicit )?owner acceptance\/merge)?$/iu
                : ["AR-02E", "AR-02F", "AR-02G", "AR-02H"].includes(record.subject)
                  ? /^closed(?: upon (?:explicit )?owner acceptance\/merge)?$/iu
                  : ["AR-03A", "AR-03B", "AR-03C", "AR-03D"].includes(record.subject)
                    ? /^closed(?: upon (?:explicit )?owner acceptance\/merge)?$/iu
                    : record.subject === "AR-23"
                      ? /^unstarted$/iu
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
      /(AR-\d{2}[A-Z]?) is (?:(?!AR-\d{2}[A-Z]?)[^.]){0,80}?(?:(?:sole|exact) next (?:reset )?(?:task|selected child)|selected successor)/giu,
    ),
  ].map(([, id]) => id);
for (const [path, block] of allCurrentAuthorities) {
  const declaredNext = nextTaskIds(block);
  if (
    declaredNext.some((id) => id !== "AR-03E") ||
    (declaredNext.length > 0 &&
      (declaredNext.length !== 1 ||
        !block.includes(
          "AR-03E is the exact next selected child after AR-03D merges and safe synchronization.",
        )))
  ) {
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
if (
  !trackerCurrent?.includes("AR-00 current status authority: Baseline / closed.") ||
  !trackerCurrent.includes("AR-01 is Baseline / closed.") ||
  !trackerCurrent.includes("AR-02A is Baseline / closed.") ||
  !trackerCurrent.includes("AR-02B is Baseline / closed.") ||
  !trackerCurrent.includes("AR-02C is Baseline / closed.") ||
  !trackerCurrent.includes("AR-02D is Baseline / closed.") ||
  !trackerCurrent.includes("AR-02E is Baseline / closed.") ||
  !trackerCurrent.includes("AR-02F is Baseline / closed.") ||
  !trackerCurrent.includes("AR-02G is Baseline / closed.") ||
  !trackerCurrent.includes("AR-02H is Baseline / closed") ||
  !trackerCurrent.includes("AR-02 is Partial;") ||
  !trackerCurrent.includes("AR-03 is Partial;") ||
  !trackerCurrent.includes("AR-03A is Baseline / closed.") ||
  !trackerCurrent.includes("AR-03B is Baseline / closed.") ||
  !trackerCurrent.includes(
    "AR-03C is Baseline / closed. AR-03D is Baseline / closed upon explicit owner acceptance/merge.",
  ) ||
  !trackerCurrent.includes("BATCH-05 is complete.") ||
  !trackerCurrent.includes(
    "AR-03E is the exact next selected child after AR-03D merges and safe synchronization.",
  ) ||
  !trackerCurrent.includes("BATCH-03 is complete") ||
  !trackerCurrent.includes("BATCH-04 is complete.") ||
  !trackerCurrent.includes("BATCH-06 selects no third task.") ||
  JSON.stringify(nextTaskIds(trackerCurrent)) !== JSON.stringify(["AR-03E"])
) {
  throw new Error(
    "tracker: AR-00/AR-01/AR-02A/AR-02B/AR-02C/AR-02D/AR-02E/AR-03/AR-03A statuses, AR-03D conditional closure and bounded AR-03E successor are required",
  );
}
if (
  dependencyRecords.filter(
    (record) => record.path.endsWith("DELIVERY_TRACKER.md") && record.subject === "AR-23",
  ).length !== 1 ||
  !trackerCurrent.includes("not serialized behind visual work")
) {
  throw new Error("tracker: AR-23 must depend only on AR-01 without visual serialization");
}
const roadmapCurrent = currentAuthorities.find(([path]) =>
  path.endsWith("DEVELOPMENT_ROADMAP.md"),
)?.[1];
if (
  !roadmapCurrent?.includes(
    "AR-00 is Baseline / closed. AR-01 is Baseline / closed. AR-02A is Baseline / closed. AR-02B is Baseline / closed. AR-02C is Baseline / closed. AR-02D is Baseline / closed. AR-02E is Baseline / closed. AR-02F is Baseline / closed. AR-02G is Baseline / closed. AR-02H is Baseline / closed. AR-02 is Partial; remaining consumer and PageBlueprint materializer isolation remains. AR-03 is Partial; runtime validation/projection/resolution and authoring are isolated; migration and expand/fold isolation remain. AR-03A is Baseline / closed. AR-03B is Baseline / closed. AR-03C is Baseline / closed. AR-03D is Baseline / closed upon explicit owner acceptance/merge. AR-23 is eligible after AR-01 and is not serialized behind visual work. AR-23 remains unstarted. BATCH-03 is complete. BATCH-04 is complete. BATCH-05 is complete. BATCH-06 continues with AR-03E after AR-03D merges and safe synchronization. AR-03E is the exact next selected child after AR-03D merges and safe synchronization. BATCH-06 selects no third task.",
  )
) {
  throw new Error("roadmap: current scheduling declaration is required");
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
  const expected = expectedDependencies.get(record.subject);
  const expectedSet = normalizedDependencies(expected).toSorted();
  const declaredSet = record.dependencies.toSorted();
  const duplicate = new Set(record.dependencies).size !== record.dependencies.length;
  if (
    !expected ||
    record.residue ||
    duplicate ||
    declaredSet.length !== expectedSet.length ||
    declaredSet.some((dependency, index) => dependency !== expectedSet[index])
  ) {
    throw new Error(
      `${record.path}: contradictory current dependency declaration for ${record.subject}`,
    );
  }
  if (
    record.subject === "AR-23" &&
    !/(?:not serialized behind visual work|numeric order does not serialize it behind visual packages)/u.test(
      record.rawDependencies,
    )
  )
    throw new Error(`${record.path}: current AR-23 declaration lacks non-serialization`);
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
process.stdout.write(
  `AR-00 architecture-reset adoption checks passed (31 outcomes, 4 deferred families, ${policySources.length} current-policy surfaces, historical identities retained)\n`,
);
