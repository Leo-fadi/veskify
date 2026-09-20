import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  createStorefrontPagePaths,
  createStorefrontRenderContext,
  validateRegisteredSnapshot,
} from "@/components/registry";
import { renderStorefrontPage } from "@/components/storefront/storefront-page";
import { pageToPuckData, puckDataToPage } from "@/integrations/puck/config";
import {
  storefrontSnapshotSchema,
  dynamicCommercePresentationAuthoritySchema,
} from "@/domain/storefront";
import { CanonicalStorefrontHistory } from "@/application/ai-storefront/composite-history";
import { InMemoryProjectRepository } from "@/services/storage/in-memory-project-repository";
import {
  compileStorefrontPublication,
  createCurrentPublishCompilerInput,
} from "@/application/publishing";
import {
  createBoundedStorefrontSynthesisDecision,
  executeBoundedStorefrontSynthesis,
} from "@/application/bounded-storefront-synthesis";
import {
  validateWholeStorefrontProposal,
  WholeStorefrontProposalAcceptanceCoordinator,
} from "@/application/whole-storefront-proposal-lifecycle";
import { createP10B14PremiumEditorialFixture } from "@/data/demo/p10b-14-premium-editorial";
import { ar05bFixture, ar05bStructuralDynamic } from "../helpers/ar-05b-composition-fixtures";
import { resolveRuntimeImportClosure } from "../helpers/ar-02-runtime-import-closure";
import { readRetainedSource } from "../helpers/ar-02-retained-source-transition";

describe("AR-05B actual inactive consumer boundaries", () => {
  it("rejects unknown dynamic versions and nested composition even when labeled legacy", () => {
    const f = ar05bFixture();
    const { dynamic } = ar05bStructuralDynamic();
    for (const presentation of [
      { ...dynamic, contractVersion: "1.0.0" },
      { ...f.base.dynamicCommercePresentation!, contractVersion: "9.0.0" },
    ])
      expect(() =>
        createStorefrontPagePaths({
          snapshot: { ...f.base, dynamicCommercePresentation: presentation } as never,
        }),
      ).toThrow(/Composition-version/);
    const literal = structuredClone(f.base);
    literal.pages[0].title.en = "composition";
    expect(createStorefrontPagePaths({ snapshot: literal })).toEqual(
      createStorefrontPagePaths({ snapshot: f.base }),
    );
  });
  it.each(["static", "dynamic"] as const)(
    "rejects unsupported %s snapshots at legacy roots before projection",
    (kind) => {
      const f = ar05bFixture();
      const value = kind === "static" ? f.create() : ar05bStructuralDynamic().snapshot;
      const contextInput = {
        activeLocale: "en" as const,
        primaryLocale: "en" as const,
        catalogue: f.aggregate.catalogue,
        snapshot: f.base,
      };
      expect(storefrontSnapshotSchema.parse(f.base)).toEqual(f.base);
      expect(
        dynamicCommercePresentationAuthoritySchema.parse(f.base.dynamicCommercePresentation),
      ).toEqual(f.base.dynamicCommercePresentation);
      expect(createStorefrontPagePaths({ snapshot: f.base })).toBeDefined();
      expect(createStorefrontRenderContext(contextInput)).toBeDefined();
      expect(validateRegisteredSnapshot(f.base, f.aggregate.catalogue)).toBeDefined();
      expect(() => storefrontSnapshotSchema.parse(value)).toThrow();
      expect(() => createStorefrontPagePaths({ snapshot: value as never })).toThrow();
      expect(() =>
        createStorefrontRenderContext({ ...contextInput, snapshot: value as never }),
      ).toThrow();
      expect(() => validateRegisteredSnapshot(value, f.aggregate.catalogue)).toThrow();
      // Even a partial caller omitting the root marker cannot project an unsupported nested value.
      const { compositionExtensionVersion: _marker, ...partial } = value;
      void _marker;
      expect(() => createStorefrontPagePaths({ snapshot: partial as never })).toThrow();
    },
  );
  it("rejects composed pages at rendering and both real Puck entrypoints before flattening", () => {
    const f = ar05bFixture();
    const value = f.create();
    const page = value.pages.find((p) => "composition" in p)!;
    const legacy = f.base.pages.find((p) => p.id === page.id)!;
    const context = createStorefrontRenderContext({
      activeLocale: "en",
      primaryLocale: "en",
      catalogue: f.aggregate.catalogue,
      snapshot: f.base,
    });
    expect(renderStorefrontPage(legacy, context)).toBeDefined();
    const data = pageToPuckData(legacy, context);
    expect(puckDataToPage(data, legacy, context)).toEqual(legacy);
    const before = JSON.stringify([value, data]);
    expect(() => renderStorefrontPage(page, context)).toThrow();
    expect(() => pageToPuckData(page, context)).toThrow();
    expect(() => puckDataToPage(data, page, context)).toThrow();
    expect(JSON.stringify([value, data])).toBe(before);
  });
  it.each(["static", "dynamic"] as const)(
    "leaves repository and history unchanged after rejecting %s composition",
    async (kind) => {
      const f = ar05bFixture();
      const value = kind === "static" ? f.create() : ar05bStructuralDynamic().snapshot;
      const repository = new InMemoryProjectRepository([f.aggregate]);
      const before = await repository.get(f.base.projectId);
      const history = new CanonicalStorefrontHistory();
      history.initialize(f.base);
      const prior = history.current();
      expect(() => history.initialize(value)).toThrow();
      expect(history.current()).toEqual(prior);
      await expect(
        repository.saveDraft(f.base.projectId, value as never, f.request.expectedBase),
      ).rejects.toThrow();
      expect(await repository.get(f.base.projectId)).toEqual(before);
      const successor = { ...f.base, ...f.request.successor };
      await repository.saveDraft(f.base.projectId, successor, f.request.expectedBase);
      expect((await repository.get(f.base.projectId)).project.draftSnapshotId).toBe(successor.id);
      history.initialize(successor);
      expect(history.current()).toBeDefined();
    },
  );
  it("rejects new versions at the actual publication compiler with no publication calls", () => {
    const f = ar05bFixture();
    const input = createCurrentPublishCompilerInput({
      aggregate: f.aggregate,
      snapshot: f.base,
      sourceAuthority: { kind: "manual" },
    });
    expect(compileStorefrontPublication(input)).toBeDefined();
    for (const snapshot of [f.create(), ar05bStructuralDynamic().snapshot]) {
      const changed = { ...input, snapshot };
      const before = JSON.stringify(changed);
      expect(() => compileStorefrontPublication(changed)).toThrow();
      expect(JSON.stringify(changed)).toBe(before);
    }
  });
  it("rejects composed pages in the actual proposal acceptance boundary before accepting state", () => {
    const source = createP10B14PremiumEditorialFixture();
    const input = {
      planningInput: source.fixture.planningInput,
      siteMapDecision: source.siteMapDecision,
      approvedEvidenceReferences: source.approvedEvidenceReferences,
      request: { intent: "editorial-led" as const, deterministicSeed: "ar05b-boundary" },
    };
    const decision = createBoundedStorefrontSynthesisDecision(input);
    const result = executeBoundedStorefrontSynthesis({
      ...input,
      decision,
      pageEvidenceAuthority: source.pageEvidenceAuthority,
      contentFactAuthority: source.contentFactAuthority,
      approvedAssetPresentations: source.fixture.assetPresentations,
    });
    const { plan, planningInput, proposal } = result.materialization;
    const currentInput = { plan, planningInput };
    expect(validateWholeStorefrontProposal(proposal, currentInput)).toEqual(proposal);
    expect(
      new WholeStorefrontProposalAcceptanceCoordinator({
        proposal,
        currentInput: () => currentInput,
      }).accept().state,
    ).toBe("accepted");
    const page = ar05bFixture()
      .create()
      .pages.find((p) => "composition" in p)!;
    const changed = {
      ...proposal,
      proposedStorefront: {
        ...proposal.proposedStorefront,
        pages: proposal.proposedStorefront.pages.map((p, i) =>
          i === 0 ? { ...p, composition: "composition" in page ? page.composition : undefined } : p,
        ),
      },
    };
    const before = JSON.stringify([proposal, currentInput, changed]);
    expect(() => validateWholeStorefrontProposal(changed, currentInput)).toThrow();
    expect(
      () =>
        new WholeStorefrontProposalAcceptanceCoordinator({
          proposal: changed,
          currentInput: () => currentInput,
        }),
    ).toThrow();
    expect(JSON.stringify([proposal, currentInput, changed])).toBe(before);
  });
  it("keeps explicit codecs and binder renderer-free and unreachable from active product consumers", () => {
    const entries = [
      "src/domain/storefront/storefront-composition-version.ts",
      "src/domain/storefront/dynamic-commerce-composition-version.ts",
      "src/application/storefront-templates/bind-storefront-composition.ts",
    ];
    const forbidden =
      /(?:\.tsx$|\.css$|^src\/(?:app|features|integrations|services|data)\/|^tests\/|^src\/components\/storefront\/|^src\/components\/registry\/(?:index|registry|contract|legacy-registry)\.|(?:^|\/)(?:react|react-dom|next|@puckeditor)(?:\/|$))/u;
    for (const entry of entries) {
      const closure = resolveRuntimeImportClosure(entry);
      expect(closure.runtimePaths.length).toBeGreaterThan(1);
      expect(closure.runtimePaths.filter((p) => forbidden.test(p))).toEqual([]);
      if (entry.startsWith("src/domain/"))
        expect(
          closure.runtimePaths.filter((p) => /^src\/(?:application|components)\//u.test(p)),
        ).toEqual([]);
    }
    const files = execFileSync(
      "git",
      ["ls-files", "--cached", "--others", "--exclude-standard", "src"],
      { encoding: "utf8" },
    )
      .trim()
      .split("\n");
    const ar06aConsumers = new Set([
      "src/components/storefront/composed-storefront-page.tsx",
      "src/data/demo/ar-06a-composed-template.ts",
    ]);
    for (const file of new Set(files)) {
      if (
        entries.includes(file) ||
        ar06aConsumers.has(file) ||
        file === "src/domain/storefront/canonical-storefront.ts"
      )
        continue;
      expect(readFileSync(file, "utf8")).not.toMatch(
        /(?:from\s*|import\s*\()["'][^"']*(?:storefront-composition-version|dynamic-commerce-composition-version|bind-storefront-composition)["']/u,
      );
    }
    expect(readFileSync("src/domain/storefront/canonical-storefront.ts", "utf8")).toMatch(
      /import type[\s\S]*from "\.\/storefront-composition-version"/u,
    );
  });
});

type TransitionDocument = { schemaVersion: string; transitions: Array<Record<string, string>> };
const recordsPath = "tests/fixtures/ar-02-retained-source-transitions.v1.json";
const transitions = [
  {
    path: "src/domain/storefront/storefront.ts",
    archive: "tests/fixtures/ar-05b/storefront.pre-ar-05b.ts.txt",
    pin: "ef5c167114b2f94f66a9f13bb181db9fe1f03d06f2ff4b7c141795c0739d9d99",
  },
  {
    path: "src/domain/storefront/canonical-storefront.ts",
    archive: "tests/fixtures/ar-05b/canonical-storefront.pre-ar-05b.ts.txt",
    pin: "d47e26eb93d935f83e604a357e6a43edd39e00deabcbf3b1df131eea50b5e6bb",
  },
];
describe("AR-05B exact historical transitions", () => {
  it.each(transitions)(
    "retains original bytes and rejects missing/wrong pins for $path",
    (entry) => {
      const read = (pin?: string) =>
        readRetainedSource({
          repositoryRoot: process.cwd(),
          recordsPath,
          sourcePath: entry.path,
          expectedHistoricalSha256: pin,
        });
      const bytes = read(entry.pin);
      expect(createHash("sha256").update(bytes).digest("hex")).toBe(entry.pin);
      expect(bytes).toEqual(readFileSync(entry.archive));
      expect(() => read()).toThrow(/historical pin/);
      expect(() => read("0".repeat(64))).toThrow(/historical pin/);
    },
  );
  it.each(["source", "archive", "missing", "duplicate", "foreign", "escape"])(
    "rejects altered %s with unchanged historical expectations",
    (kind) => {
      const root = mkdtempSync(join(tmpdir(), "ar05b-transition-"));
      const entry = transitions[0];
      try {
        for (const path of [recordsPath, entry.path, entry.archive]) {
          mkdirSync(dirname(join(root, path)), { recursive: true });
          cpSync(path, join(root, path), { dereference: false });
        }
        const document = JSON.parse(
          readFileSync(join(root, recordsPath), "utf8"),
        ) as TransitionDocument;
        const row = document.transitions.find((r) => r.path === entry.path)!;
        if (kind === "source" || kind === "archive")
          writeFileSync(join(root, kind === "source" ? entry.path : entry.archive), "altered");
        if (kind === "missing")
          document.transitions = document.transitions.filter((r) => r.path !== entry.path);
        if (kind === "duplicate") document.transitions.push(row);
        if (kind === "foreign") row.taskId = "AR-02M";
        if (kind === "escape") row.archivePath = "../escape.ts";
        writeFileSync(join(root, recordsPath), JSON.stringify(document));
        expect(() =>
          readRetainedSource({
            repositoryRoot: root,
            recordsPath,
            sourcePath: entry.path,
            expectedHistoricalSha256: entry.pin,
          }),
        ).toThrow();
      } finally {
        rmSync(root, { recursive: true, force: true });
      }
    },
  );
  it("preserves every accepted G/H/M record, source inventory and aggregate authority", () => {
    // Pins derived from exact base 1d880f1efc9ff2f2eb735b5638a9a7058dd9f3fc.
    // CI's shallow checkout need not contain that historical Git object.
    const current = JSON.parse(readFileSync(recordsPath, "utf8")) as TransitionDocument;
    const retained = current.transitions.filter((r) => r.taskId !== "AR-05B");
    expect(retained).toHaveLength(7);
    expect(createHash("sha256").update(JSON.stringify(retained)).digest("hex")).toBe(
      "f4bd0b0ff40ba6796f86fb41f3fbafef4caf2050f4a56d0a506c558b5e70237f",
    );
    const historicalFiles = {
      "tests/fixtures/p10b-19a-10a-retained-matrix-inventory.v1.json":
        "2324cf405e12f4b06cbb288eac8d90dc759fc0eb87a39ba206eef784f3b0f4ab",
      "tests/helpers/p10b-19a-10a-retained-matrix-inventory.ts":
        "01d8f531a70f622938ea67a0863b33c48b158e99fbdc8f26277ffa8bfd2ac182",
      "tests/helpers/p10b-19a-10c-architecture-closure.ts":
        "a0c9658d65d080812fcb1e8afd7554a45336e9acae763854637ee33dd99f01ae",
    };
    for (const [path, expected] of Object.entries(historicalFiles))
      expect(createHash("sha256").update(readFileSync(path)).digest("hex")).toBe(expected);
  });
});
