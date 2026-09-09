// @vitest-environment node

import { execFileSync, spawnSync } from "node:child_process";
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterAll, describe, expect, it } from "vitest";

const root = process.cwd();
const checker = join(root, "scripts/check-architecture-reset-adoption.mjs");

const fixture = () => {
  const directory = mkdtempSync(join(tmpdir(), "ar-00-check-"));
  for (const relativePath of [
    "AGENTS.md",
    "docs/AGENT_TEAM_WORKFLOW.md",
    "README.md",
    "docs/VESKIFY_SDD.md",
    "docs/VESKIFY_DEVELOPMENT_ROADMAP.md",
    "docs/VESKIFY_DEVELOPMENT_DELIVERY_TRACKER.md",
    "docs/DEVELOPMENT_GUIDE.md",
    "docs/VESKIFY_CURRENT_STATE_TRUTH_AUDIT.md",
    "docs/VESKIFY_CAPABILITY_EVIDENCE_LEDGER.md",
    "docs/AR_00_SOURCE_DISPOSITION_AND_ACCEPTANCE.md",
    "docs/P10B_19_STRUCTURAL_DESIGN_INTELLIGENCE_ARCHITECTURE.md",
    "docs/spec-addenda/AR-00_TEMPLATE_SCOPED_ARCHITECTURE.md",
    "tests/fixtures/p10b-19a-10c-architecture-closure-manifest.v1.json",
  ]) {
    const destination = join(directory, relativePath);
    mkdirSync(join(destination, ".."), { recursive: true });
    cpSync(join(root, relativePath), destination);
  }
  return directory;
};
const check = (directory: string) =>
  execFileSync(process.execPath, [checker, directory], { encoding: "utf8" });

// Independent test-side catalogue: no import of the guard's source selection or parser.
const policySurfaces = [
  ["README.md", "# Veskify\n"],
  ["docs/VESKIFY_SDD.md", "# Veskify Software Design Document v1.3.0\n"],
  [
    "docs/VESKIFY_DEVELOPMENT_ROADMAP.md",
    "## AR-00 replacement-roadmap projection (effective on adoption/merge)\n",
  ],
  ["docs/VESKIFY_DEVELOPMENT_DELIVERY_TRACKER.md", "# Veskify Development Delivery Tracker\n"],
  ["docs/DEVELOPMENT_GUIDE.md", "## 4. Branch and PR strategy\n"],
  ["docs/VESKIFY_CURRENT_STATE_TRUTH_AUDIT.md", "# Veskify Current-State Truth Audit\n"],
  ["docs/VESKIFY_CAPABILITY_EVIDENCE_LEDGER.md", "# Veskify Capability Evidence Ledger\n"],
  [
    "docs/spec-addenda/AR-00_TEMPLATE_SCOPED_ARCHITECTURE.md",
    "## 5. Delivery gates and retirement\n",
  ],
  ["AGENTS.md", "### 8.0 AR-00 adopted architecture policy\n"],
  ["docs/AGENT_TEAM_WORKFLOW.md", "## Assign and deliver\n"],
] as const;
const declarations = [
  ["obsolete AR-00 pending", "AR-00 is pending adoption/merge.", /contradictory current status/],
  [
    "obsolete AR-00 active",
    "AR-00 is Active — pending adoption/merge.",
    /contradictory current status/,
  ],
  [
    "obsolete AR-01 gate",
    "AR-01 is Planned — sole next task after AR-00 adoption/merge.",
    /contradictory current status/,
  ],
  ["roadmap owns status", "The roadmap owns status.", /contradictory current ownership/],
  ["tracker owns order", "The tracker owns delivery order.", /contradictory current ownership/],
  [
    "roadmap status authority",
    "The roadmap remains the sole status authority.",
    /contradictory current ownership/,
  ],
  [
    "tracker order authority",
    "The tracker is the delivery-order authority.",
    /contradictory current ownership/,
  ],
  [
    "passive status ownership",
    "Status is owned only by the delivery roadmap.",
    /contradictory current ownership/,
  ],
  [
    "passive order ownership",
    "Dependency order is owned only by the tracker.",
    /contradictory current ownership/,
  ],
  [
    "AR-02 activation table",
    "| Task | Status |\n| --- | --- |\n| AR-02 | Active — implementation started |",
    /contradictory current status/,
  ],
  [
    "AR-23 dependency table",
    "| Task | Dependencies |\n| --- | --- |\n| AR-23 | AR-01, AR-15 |",
    /(?:duplicate|contradictory) current dependency/,
  ],
  ["AR-01 activation", "AR-01 is Active — implementation started.", /contradictory current status/],
  ["AR-02 activation", "AR-02 is Active — implementation started.", /contradictory current status/],
  [
    "AR-23 replacement dependency",
    "AR-23 depends on AR-15.",
    /(?:duplicate|contradictory) current dependency/,
  ],
  [
    "AR-23 added dependency",
    "AR-23 depends on AR-01 and AR-15.",
    /(?:duplicate|contradictory) current dependency/,
  ],
  [
    "completed A-10 unexecuted",
    "P10B-19A-10 is Planned and unexecuted.",
    /contradictory current status/,
  ],
] as const;
const coverageMatrix: {
  source: string;
  mutation: string;
  expectedExit: number;
  actualExit: number | null;
  diagnostic: string;
}[] = [];
const matrixCheck = (
  directory: string,
  source: string,
  mutation: string,
  expectedExit: number,
  error?: RegExp,
) => {
  const result = spawnSync(process.execPath, [checker, directory], { encoding: "utf8" });
  coverageMatrix.push({
    source,
    mutation,
    expectedExit,
    actualExit: result.status,
    diagnostic: result.stderr.match(/^Error: (.+)$/mu)?.[1] ?? result.stdout.trim(),
  });
  expect(result.error).toBeUndefined();
  expect(result.status).toBe(expectedExit);
  if (error) expect(result.stderr).toMatch(error);
};

afterAll(() => {
  // Retained command output is the actual source/mutation/expected/actual evidence matrix.
  process.stdout.write(`AR00_POLICY_COVERAGE_MATRIX ${JSON.stringify(coverageMatrix)}\n`);
});

describe("complete bounded current-policy coverage matrix", () => {
  for (const [source, anchor] of policySurfaces) {
    it(`${source}: unchanged valid source`, () => {
      const directory = fixture();
      try {
        matrixCheck(directory, source, "unchanged valid documents", 0);
      } finally {
        rmSync(directory, { recursive: true, force: true });
      }
    });
    for (const [name, declaration, error] of declarations) {
      for (const form of ["primary section", "current heading", "current quote"] as const) {
        it(`${source}: rejects ${name} in ${form}`, () => {
          const directory = fixture();
          const path = join(directory, source);
          try {
            const original = readFileSync(path, "utf8");
            const changed =
              form === "primary section"
                ? original.replace(
                    anchor,
                    `${anchor}\n${declaration
                      .split("\n")
                      .map((line) => `${anchor.startsWith("# ") ? "> " : ""}${line}`)
                      .join("\n")}\n`,
                  )
                : `${original}\n\n${
                    form === "current heading"
                      ? `## CURRENT POLICY\n\n${declaration}`
                      : `> **CURRENT POLICY:**\n${declaration
                          .split("\n")
                          .map((line) => `> ${line}`)
                          .join("\n")}`
                  }\n`;
            expect(changed).not.toBe(original);
            writeFileSync(path, changed);
            matrixCheck(directory, source, `${form}: ${name}`, 1, error);
          } finally {
            rmSync(directory, { recursive: true, force: true });
          }
        });
      }
    }
    for (const [name, addition] of [
      [
        "historical statement",
        "## Historical evidence\n\nAR-01 is Active — implementation started.",
      ],
      [
        "nested historical current heading",
        "## Historical evidence\n\n### CURRENT POLICY\n\nAR-23 depends on AR-01 and AR-15.",
      ],
      [
        "fenced current example",
        "```markdown\n## CURRENT POLICY\nAR-01 is Active — implementation started.\n```",
      ],
      [
        "ordinary quoted example",
        "## CURRENT POLICY\n\n> AR-01 is Active — implementation started.",
      ],
      ["inline code example", "## CURRENT POLICY\n\n`AR-01 is Active — implementation started.`"],
    ]) {
      it(`${source}: accepts ${name}`, () => {
        const directory = fixture();
        const path = join(directory, source);
        try {
          writeFileSync(path, `${readFileSync(path, "utf8")}\n\n${addition}\n`);
          matrixCheck(directory, source, name, 0);
        } finally {
          rmSync(directory, { recursive: true, force: true });
        }
      });
    }
    it(`${source}: rejects an omitted required policy file`, () => {
      const directory = fixture();
      try {
        rmSync(join(directory, source));
        matrixCheck(
          directory,
          source,
          "omitted required source file",
          1,
          /missing required policy source/,
        );
      } finally {
        rmSync(directory, { recursive: true, force: true });
      }
    });
  }

  it.each([
    [
      "missing incorporation",
      "[template-scoped architecture addendum](./spec-addenda/AR-00_TEMPLATE_SCOPED_ARCHITECTURE.md)",
      "template-scoped architecture addendum",
    ],
    [
      "unscanned additional incorporation",
      "> is incorporated into this SDD.",
      "> and [another normative addendum](./spec-addenda/AR-00_UNSCANNED.md)\n> is incorporated into this SDD.",
    ],
    [
      "missing delivery-plan link",
      "[`VESKIFY_DEVELOPMENT_ROADMAP.md`](VESKIFY_DEVELOPMENT_ROADMAP.md)",
      "VESKIFY_DEVELOPMENT_ROADMAP.md",
    ],
    [
      "swapped delivery-status owner",
      "[`VESKIFY_DEVELOPMENT_DELIVERY_TRACKER.md`](VESKIFY_DEVELOPMENT_DELIVERY_TRACKER.md)",
      "[roadmap](VESKIFY_DEVELOPMENT_ROADMAP.md)",
    ],
  ])("cross-checks SDD references: %s", (name, anchor, replacement) => {
    const directory = fixture();
    const source = "docs/VESKIFY_SDD.md";
    const path = join(directory, source);
    try {
      const original = readFileSync(path, "utf8");
      const changed = original.replace(anchor, replacement);
      expect(changed).not.toBe(original);
      writeFileSync(path, changed);
      writeFileSync(
        join(directory, "docs/spec-addenda/AR-00_UNSCANNED.md"),
        "## Normative addition\n\nAR-02 is Active.\n",
      );
      matrixCheck(
        directory,
        source,
        name,
        1,
        /SDD: (?:missing required|unscanned required|delivery authority)/,
      );
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it.each([
    [
      "addendum status wording",
      "AR-00 is Baseline / closed.",
      "AR-00 is active pending adoption and merge.",
    ],
    [
      "addendum depends-only wording",
      "AR-23 depends only on AR-01",
      "AR-23 depends only on AR-01 and AR-15",
    ],
    [
      "addendum authority link",
      "[delivery tracker](../VESKIFY_DEVELOPMENT_DELIVERY_TRACKER.md)",
      "[delivery tracker](../VESKIFY_DEVELOPMENT_ROADMAP.md)",
    ],
  ])("validates existing normative wording: %s", (name, anchor, replacement) => {
    const directory = fixture();
    const source = "docs/spec-addenda/AR-00_TEMPLATE_SCOPED_ARCHITECTURE.md";
    const path = join(directory, source);
    try {
      const original = readFileSync(path, "utf8");
      const changed = original.replace(anchor, replacement);
      expect(changed).not.toBe(original);
      writeFileSync(path, changed);
      matrixCheck(
        directory,
        source,
        name,
        1,
        /(?:contradictory current|delivery authority references)/,
      );
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });
});

// Mutate REAL existing declarations, not just synthetic text appended by this suite.
// This reproduces the verifier's README probe and the same omitted invariant in
// the tracker, guide, ledger, AGENTS, linked declarations and control table.
describe("existing delivery-ownership declarations", () => {
  it.each([
    [
      "README.md",
      "roadmap owns delivery order and the\n> tracker owns status",
      "tracker owns delivery order and the\n> roadmap owns status",
    ],
    [
      "docs/VESKIFY_DEVELOPMENT_DELIVERY_TRACKER.md",
      "This tracker owns current status; the roadmap owns dependency order.",
      "This roadmap owns current status; the tracker owns dependency order.",
    ],
    [
      "docs/DEVELOPMENT_GUIDE.md",
      "The roadmap owns dependency order; the tracker owns status.",
      "The tracker owns dependency order; the roadmap owns status.",
    ],
    [
      "docs/VESKIFY_CAPABILITY_EVIDENCE_LEDGER.md",
      "status is owned only by the delivery tracker.",
      "status is owned only by the delivery roadmap.",
    ],
    [
      "AGENTS.md",
      "The roadmap remains the delivery-order authority and the tracker remains the sole status authority.",
      "The tracker remains the delivery-order authority and the roadmap remains the sole status authority.",
    ],
    [
      "AGENTS.md",
      "`docs/VESKIFY_DEVELOPMENT_DELIVERY_TRACKER.md` is the current task-status authority",
      "`docs/VESKIFY_DEVELOPMENT_ROADMAP.md` is the current task-status authority",
    ],
    [
      "docs/spec-addenda/AR-00_TEMPLATE_SCOPED_ARCHITECTURE.md",
      "[delivery tracker](../VESKIFY_DEVELOPMENT_DELIVERY_TRACKER.md) alone owns task status",
      "[delivery tracker](../VESKIFY_DEVELOPMENT_DELIVERY_TRACKER.md) alone owns delivery order",
    ],
    [
      "README.md",
      "the roadmap owns delivery order and the\n> tracker owns status.",
      "delivery documents are referenced here.",
    ],
  ])("rejects changed existing declaration in %s", (source, before, after) => {
    const directory = fixture();
    const path = join(directory, source);
    try {
      const original = readFileSync(path, "utf8");
      expect(original.split(before)).toHaveLength(2);
      writeFileSync(path, original.replace(before, after));
      matrixCheck(
        directory,
        source,
        `existing ownership: ${before}`,
        1,
        /ownership|delivery authority/,
      );
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it("checks the tracker's existing delivery-order table link", () => {
    const directory = fixture();
    const source = "docs/VESKIFY_DEVELOPMENT_DELIVERY_TRACKER.md";
    const path = join(directory, source);
    try {
      const original = readFileSync(path, "utf8");
      const before = original.split("\n").find((line) => /^\| Delivery order\s+\|/u.test(line))!;
      const after = before.replaceAll(
        "VESKIFY_DEVELOPMENT_ROADMAP.md",
        "VESKIFY_DEVELOPMENT_DELIVERY_TRACKER.md",
      );
      expect(after).not.toBe(before);
      writeFileSync(path, original.replace(before, after));
      matrixCheck(directory, source, "existing delivery-order table", 1, /authority reference/);
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it.each(policySurfaces)("retains valid ownership and historical examples in %s", (source) => {
    const directory = fixture();
    const path = join(directory, source);
    try {
      writeFileSync(
        path,
        `${readFileSync(path, "utf8")}\n\n## CURRENT POLICY\n\nThe roadmap owns delivery order. The tracker owns status.\n\n## Historical evidence\n\nThe tracker owns order.\n\n## Examples\n\nThe roadmap owns status.\n`,
      );
      matrixCheck(directory, source, "valid ownership and historical examples", 0);
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });
});

describe("post-pilot repository state and PR lifecycle", () => {
  it("accepts the intended candidate state without asserting that the PR has merged", () => {
    const directory = fixture();
    try {
      const tracker = readFileSync(
        join(directory, "docs/VESKIFY_DEVELOPMENT_DELIVERY_TRACKER.md"),
        "utf8",
      );
      expect(tracker).toContain("effective upon explicit owner acceptance/merge of AR-02F");
      expect(tracker).toContain(
        "claim that this PR has merged or that owner acceptance has occurred",
      );
      expect(tracker).toContain("**Baseline / closed.** AR-01 is **Baseline / closed.**");
      expect(tracker).toContain("AR-23 depends on AR-01");
      matrixCheck(
        directory,
        "docs/VESKIFY_DEVELOPMENT_DELIVERY_TRACKER.md",
        "intended merged state; PR lifecycle separate",
        0,
      );
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it("rejects the former pending state restored across the current notices", () => {
    const directory = fixture();
    try {
      for (const [source] of policySurfaces) {
        const path = join(directory, source);
        const original = readFileSync(path, "utf8");
        writeFileSync(
          path,
          original
            .replaceAll("AR-00 is Baseline / closed", "AR-00 is Active — pending adoption/merge")
            .replace(
              "**AR-00 current status authority:** **Baseline / closed",
              "**AR-00 current status authority:** **Active — pending adoption/merge",
            ),
        );
      }
      matrixCheck(
        directory,
        "all current notices",
        "obsolete pending state restored atomically",
        1,
        /contradictory current status/,
      );
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });
});

describe("AR-00 architecture-reset adoption guard", () => {
  it("accepts the committed policy projection", () => {
    const directory = fixture();
    try {
      expect(check(directory)).toContain("31 outcomes");
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it("rejects an AR-23 dependency mutation", () => {
    const directory = fixture();
    const path = join(directory, "docs/VESKIFY_DEVELOPMENT_ROADMAP.md");
    try {
      writeFileSync(
        path,
        readFileSync(path, "utf8").replace(
          "| AR-23 | Resolve host/data contract                              | AR-01",
          "| AR-23 | Resolve host/data contract                              | AR-22",
        ),
      );
      expect(() => check(directory)).toThrow(/dependency mismatch/);
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it("rejects a current tracker-status mutation", () => {
    const directory = fixture();
    const path = join(directory, "docs/VESKIFY_DEVELOPMENT_DELIVERY_TRACKER.md");
    try {
      writeFileSync(
        path,
        readFileSync(path, "utf8").replace("Baseline / closed", "Active — pending adoption/merge"),
      );
      expect(() => check(directory)).toThrow(/contradictory current status for AR-00/);
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it("rejects an altered protected architecture byte", () => {
    const directory = fixture();
    const path = join(directory, "docs/P10B_19_STRUCTURAL_DESIGN_INTELLIGENCE_ARCHITECTURE.md");
    try {
      writeFileSync(path, `${readFileSync(path, "utf8")}\n`);
      expect(() => check(directory)).toThrow(/P19 architecture bytes changed/);
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it("rejects an altered protected closure-fixture byte", () => {
    const directory = fixture();
    const path = join(
      directory,
      "tests/fixtures/p10b-19a-10c-architecture-closure-manifest.v1.json",
    );
    try {
      writeFileSync(path, `${readFileSync(path, "utf8")}\n`);
      expect(() => check(directory)).toThrow(/closure fixture bytes changed/);
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it("rejects detailed dependency disagreements and duplicate detailed headings", () => {
    const dependencyDirectory = fixture();
    const dependencyPath = join(dependencyDirectory, "docs/VESKIFY_DEVELOPMENT_ROADMAP.md");
    try {
      const original = readFileSync(dependencyPath, "utf8");
      const changed = original.replace(
        "**Package:** P8 — Host integration. **Dependencies:** AR-01.",
        "**Package:** P8 — Host integration. **Dependencies:** AR-22.",
      );
      expect(changed).not.toBe(original);
      writeFileSync(dependencyPath, changed);
      expect(() => check(dependencyDirectory)).toThrow(/AR-23 detailed dependency mismatch/);
    } finally {
      rmSync(dependencyDirectory, { recursive: true, force: true });
    }

    const duplicateDirectory = fixture();
    const duplicatePath = join(duplicateDirectory, "docs/VESKIFY_DEVELOPMENT_ROADMAP.md");
    try {
      const original = readFileSync(duplicatePath, "utf8");
      const changed = `${original}\n### AR-23 — Duplicate host task\n`;
      expect(changed).not.toBe(original);
      writeFileSync(duplicatePath, changed);
      expect(() => check(duplicateDirectory)).toThrow(/duplicate or incomplete task record/);
    } finally {
      rmSync(duplicateDirectory, { recursive: true, force: true });
    }
  });

  it("rejects the verifier current-closure contradiction", () => {
    const directory = fixture();
    const trackerPath = join(directory, "docs/VESKIFY_DEVELOPMENT_DELIVERY_TRACKER.md");
    try {
      const original = readFileSync(trackerPath, "utf8");
      const changed = `A-10C is Deprecated before execution\n${original}`;
      expect(changed).not.toBe(original);
      writeFileSync(trackerPath, changed);
      expect(() => check(directory)).toThrow(/current authority/);
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it("rejects the verifier AR-23 serialization contradiction", () => {
    const directory = fixture();
    const trackerPath = join(directory, "docs/VESKIFY_DEVELOPMENT_DELIVERY_TRACKER.md");
    try {
      const original = readFileSync(trackerPath, "utf8");
      const changed = original.replace(
        "AR-23 depends on AR-01 and is not serialized behind",
        "AR-23 depends on AR-01 and AR-22 and is serialized behind",
      );
      expect(changed).not.toBe(original);
      writeFileSync(trackerPath, changed);
      expect(() => check(directory)).toThrow(/AR-23/);
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it("rejects the verifier tracker pilot-closure status mutation", () => {
    const directory = fixture();
    const trackerPath = join(directory, "docs/VESKIFY_DEVELOPMENT_DELIVERY_TRACKER.md");
    try {
      const original = readFileSync(trackerPath, "utf8");
      const changed = original.replace(
        "AR-03A is **Baseline / closed.**",
        "AR-03A is **Baseline / blocked.**",
      );
      expect(changed).not.toBe(original);
      writeFileSync(trackerPath, changed);
      expect(() => check(directory)).toThrow(/contradictory current status/);
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it("rejects a current-roadmap scheduling mutation", () => {
    const directory = fixture();
    const roadmapPath = join(directory, "docs/VESKIFY_DEVELOPMENT_ROADMAP.md");
    try {
      const original = readFileSync(roadmapPath, "utf8");
      const changed = original.replace(
        "AR-23 is eligible after AR-01",
        "AR-23 is eligible after AR-22",
      );
      expect(changed).not.toBe(original);
      writeFileSync(roadmapPath, changed);
      expect(() => check(directory)).toThrow(/roadmap: current scheduling declaration/);
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it.each([
    "AR-30 is the exact next selected child after the pilot.",
    "AR-30 is the selected successor after the pilot.",
    "AR-02F is the selected successor after the pilot.",
    "AR-02G is the selected successor after the pilot.",
  ])("rejects any successor after AR-02F: %s", (successor) => {
    const directory = fixture();
    const readmePath = join(directory, "README.md");
    try {
      const original = readFileSync(readmePath, "utf8");
      const changed = original.replace("BATCH-03 has no successor child.", successor);
      expect(changed).not.toBe(original);
      writeFileSync(readmePath, changed);
      expect(() => check(directory)).toThrow(/current authority assigns/);
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it("parses rather than blacklists a different forbidden successor", () => {
    const directory = fixture();
    const trackerPath = join(directory, "docs/VESKIFY_DEVELOPMENT_DELIVERY_TRACKER.md");
    try {
      const original = readFileSync(trackerPath, "utf8");
      const changed = original.replace(
        "BATCH-03 has no successor child.",
        "AR-30 is the exact next selected child after the pilot.",
      );
      expect(changed).not.toBe(original);
      writeFileSync(trackerPath, changed);
      expect(() => check(directory)).toThrow(/AR-30/);
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it.each([
    "AR-01 is Active — implementation started.",
    "AR-02 is Active — implementation started.",
    "AR-23 depends on AR-15.",
    "P10B-19A-10 is Planned and unexecuted.",
  ])("rejects the verdict-02 current tracker declaration: %s", (declaration) => {
    const directory = fixture();
    const trackerPath = join(directory, "docs/VESKIFY_DEVELOPMENT_DELIVERY_TRACKER.md");
    try {
      const original = readFileSync(trackerPath, "utf8");
      const changed = original.replace("> Retained B01", `> ${declaration}\n> Retained B01`);
      expect(changed).not.toBe(original);
      writeFileSync(trackerPath, changed);
      expect(() => check(directory)).toThrow(
        /(?:duplicate|contradictory) current (status|dependency)/,
      );
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it.each(["AR-23 depends on AR-01 and AR-15.", "AR-23 depends on AR-01, AR-15."])(
    "rejects an augmented current AR-23 dependency set: %s",
    (declaration) => {
      const directory = fixture();
      const trackerPath = join(directory, "docs/VESKIFY_DEVELOPMENT_DELIVERY_TRACKER.md");
      try {
        const original = readFileSync(trackerPath, "utf8");
        const changed = original.replace("> Retained B01", `> ${declaration}\n> Retained B01`);
        expect(changed).not.toBe(original);
        writeFileSync(trackerPath, changed);
        expect(() => check(directory)).toThrow(/(?:duplicate|contradictory) current dependency/);
      } finally {
        rmSync(directory, { recursive: true, force: true });
      }
    },
  );

  it("accepts exact current dependency and closure aliases", () => {
    const directory = fixture();
    const trackerPath = join(directory, "docs/VESKIFY_DEVELOPMENT_DELIVERY_TRACKER.md");
    try {
      const original = readFileSync(trackerPath, "utf8");
      const changed = original.replace(
        "> Retained B01",
        "> AR-17 depends on AR-16 and AR-23. A-10 is Baseline / closed. P10B-19A-10C and P10B-19A are Baseline / closed.\n> Retained B01",
      );
      expect(changed).not.toBe(original);
      writeFileSync(trackerPath, changed);
      expect(check(directory)).toContain("31 outcomes");
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it("rejects an explicit current-policy block outside the initial authority block", () => {
    const directory = fixture();
    const roadmapPath = join(directory, "docs/VESKIFY_DEVELOPMENT_ROADMAP.md");
    try {
      const original = readFileSync(roadmapPath, "utf8");
      const changed = original.replace(
        "## AR-00 replacement-roadmap projection (effective on adoption/merge)",
        "> **CURRENT POLICY:** AR-02 is Active — implementation started.\n\n## AR-00 replacement-roadmap projection (effective on adoption/merge)",
      );
      expect(changed).not.toBe(original);
      writeFileSync(roadmapPath, changed);
      expect(() => check(directory)).toThrow(/contradictory current status/);
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it.each([
    "README.md",
    "docs/VESKIFY_DEVELOPMENT_DELIVERY_TRACKER.md",
    "docs/VESKIFY_DEVELOPMENT_ROADMAP.md",
    "docs/VESKIFY_SDD.md",
    "docs/DEVELOPMENT_GUIDE.md",
    "docs/VESKIFY_CURRENT_STATE_TRUTH_AUDIT.md",
    "docs/VESKIFY_CAPABILITY_EVIDENCE_LEDGER.md",
  ])("rejects a contradictory later current declaration in %s", (relativePath) => {
    const directory = fixture();
    const path = join(directory, relativePath);
    try {
      const original = readFileSync(path, "utf8");
      const changed = `${original}\n\n## CURRENT POLICY\n\nAR-02 is Active — implementation started.\n`;
      expect(changed).not.toBe(original);
      writeFileSync(path, changed);
      expect(() => check(directory)).toThrow(/contradictory current status/);
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it.each([
    {
      path: "docs/VESKIFY_DEVELOPMENT_DELIVERY_TRACKER.md",
      anchor: "> Retained B01",
      declaration: "P10B-19A-10 is not Baseline / closed.",
      replacement: "> P10B-19A-10 is not Baseline / closed.\n> Retained B01",
      error: /contradictory current status/,
    },
    {
      path: "docs/VESKIFY_DEVELOPMENT_DELIVERY_TRACKER.md",
      anchor: "> Retained B01",
      declaration: "AR-02 current status authority: Active — implementation started.",
      replacement:
        "> AR-02 current status authority: Active — implementation started.\n> Retained B01",
      error: /contradictory current status/,
    },
    {
      path: "docs/VESKIFY_DEVELOPMENT_ROADMAP.md",
      anchor: "## AR-00 replacement-roadmap projection (effective on adoption/merge)",
      declaration: "AR-23 is eligible after AR-15.",
      replacement:
        "## AR-00 replacement-roadmap projection (effective on adoption/merge)\nAR-23 is eligible after AR-15.",
      error: /(?:duplicate|contradictory) current dependency/,
    },
  ])(
    "rejects a contradictory declared current form: $declaration",
    ({ path, anchor, declaration, replacement, error }) => {
      const directory = fixture();
      const target = join(directory, path);
      try {
        const original = readFileSync(target, "utf8");
        expect(replacement).toContain(declaration);
        const changed = original.replace(anchor, replacement);
        expect(changed).not.toBe(original);
        writeFileSync(target, changed);
        expect(() => check(directory)).toThrow(error);
      } finally {
        rmSync(directory, { recursive: true, force: true });
      }
    },
  );

  it.each(["AR-00", "AR-02", "AR-03A"])(
    "rejects %s as an active amendment after adoption",
    (task) => {
      const directory = fixture();
      const guidePath = join(directory, "docs/DEVELOPMENT_GUIDE.md");
      try {
        const original = readFileSync(guidePath, "utf8");
        expect(original).toContain("AR-00 is Baseline / closed");
        const changed = `${original}\n\n## CURRENT POLICY\n\n${task} is the active amendment.\n`;
        expect(changed).not.toBe(original);
        writeFileSync(guidePath, changed);
        expect(() => check(directory)).toThrow(/contradictory current schedule/);
      } finally {
        rmSync(directory, { recursive: true, force: true });
      }
    },
  );

  it("rejects duplicate current dependencies and detailed dependency declarations", () => {
    const trackerDirectory = fixture();
    const trackerPath = join(trackerDirectory, "docs/VESKIFY_DEVELOPMENT_DELIVERY_TRACKER.md");
    try {
      const original = readFileSync(trackerPath, "utf8");
      const changed = original.replace(
        "> Retained B01",
        "> AR-23 depends on AR-01 and is not serialized behind visual work.\n> Retained B01",
      );
      expect(changed).not.toBe(original);
      writeFileSync(trackerPath, changed);
      expect(() => check(trackerDirectory)).toThrow(/duplicate current dependency/);
    } finally {
      rmSync(trackerDirectory, { recursive: true, force: true });
    }

    const roadmapDirectory = fixture();
    const roadmapPath = join(roadmapDirectory, "docs/VESKIFY_DEVELOPMENT_ROADMAP.md");
    try {
      const original = readFileSync(roadmapPath, "utf8");
      const changed = original.replace(
        "**Package:** P8 — Host integration. **Dependencies:** AR-01.",
        "**Package:** P8 — Host integration. **Dependencies:** AR-01. **Dependencies:** AR-01.",
      );
      expect(changed).not.toBe(original);
      writeFileSync(roadmapPath, changed);
      expect(() => check(roadmapDirectory)).toThrow(/AR-23 detailed dependency mismatch/);
    } finally {
      rmSync(roadmapDirectory, { recursive: true, force: true });
    }
  });

  it("preserves explicitly historical status statements outside the current block", () => {
    const directory = fixture();
    const trackerPath = join(directory, "docs/VESKIFY_DEVELOPMENT_DELIVERY_TRACKER.md");
    try {
      const original = readFileSync(trackerPath, "utf8");
      const changed = original.replace(
        "## Document control",
        "Historical evidence: P10B-19A-10 is Planned and unexecuted.\n\n## Document control",
      );
      expect(changed).not.toBe(original);
      writeFileSync(trackerPath, changed);
      expect(check(directory)).toContain("31 outcomes");
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });
});

describe("AR-02C bounded proposed status transition", () => {
  it.each(["AR-02", "AR-03", "AR-23", "AR-30"])(
    "rejects premature %s closure despite dependency eligibility",
    (task) => {
      const directory = fixture();
      try {
        const path = join(directory, "README.md");
        writeFileSync(
          path,
          `${readFileSync(path, "utf8")}\n## CURRENT POLICY\n\n${task} is Baseline / closed.\n`,
        );
        expect(() => check(directory)).toThrow(/contradictory current status/);
      } finally {
        rmSync(directory, { recursive: true, force: true });
      }
    },
  );
  it("rejects restoring AR-01 Planned as the current accepted projection", () => {
    const directory = fixture();
    try {
      const path = join(directory, "README.md");
      const original = readFileSync(path, "utf8");
      const changed = original.replace(
        "AR-01 is Baseline / closed.",
        "AR-01 is Planned — exact next task, not started.",
      );
      expect(changed).not.toBe(original);
      writeFileSync(path, changed);
      expect(() => check(directory)).toThrow(/contradictory current status/);
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });
});
