// @vitest-environment node
import { createHash } from "node:crypto";
import {
  mkdtempSync,
  mkdirSync,
  readFileSync,
  realpathSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import * as synthesisExports from "@/application/bounded-storefront-synthesis";
import * as templateExports from "@/application/storefront-templates";
import * as designExports from "@/application/storefront-design-system";
import { storefrontDesignDirectionIdSchema } from "@/application/storefront-design-system/contract";
import { commercialHomepageProfileIdSchema } from "@/application/storefront-templates/commercial-homepage-profiles";
import { commercialCollectionSearchProfileIdSchema } from "@/application/storefront-templates/commercial-collection-search-profiles";
import { commercialPdpProfileIdSchema } from "@/application/storefront-templates/commercial-pdp-profiles";
import {
  COORDINATED_STOREFRONT_DIRECTION_AUTHORITY_VERSION,
  coordinatedStorefrontDirectionIdSchema,
  coordinatedStorefrontDirectionPackageSchema,
  coordinatedDirectionCharacteristicsSchema,
} from "@/application/bounded-storefront-synthesis/direction-contract";
import { deriveSemanticCapabilityIndex } from "@/application/prompted-storefront-design-compiler";
import { createPromptedStorefrontDesignRequestV2 } from "@/application/prompted-storefront-design-intent/request";
import {
  createSemanticStorefrontDesignRequestV1,
  expectedSemanticStorefrontDesignRequestFingerprint,
  semanticStorefrontCurrentAuthorityFingerprint,
} from "@/application/prompted-storefront-design-intent/semantic-request";
import { validateSemanticStorefrontDesignRequestV1 } from "@/application/prompted-storefront-design-intent/semantic-validation";
import { createP10B16P03RawKarvonenStudioFixture } from "@/data/demo/p10b-16p-03-studio-prompt-generation";
import { readRetainedSource } from "../helpers/ar-02-retained-source-transition";
import {
  resolveRuntimeImportClosure,
  resolveInstalledZodEsmClosure,
} from "../helpers/ar-02-runtime-import-closure";
const hash = (value: string) => createHash("sha256").update(value).digest("hex");
const recordsPath = "tests/fixtures/ar-02-retained-source-transitions.v1.json";
const sourcePath = "src/application/bounded-storefront-synthesis/direction-contract.ts";
const archivePath = "tests/fixtures/ar-02h/direction-contract.pre-ar-02h.ts.txt";
const originalSha256 = "f62ab54f221d084a0f593d2a090feca7ba9ddce4f9d23dcf8688960f4d8d1b28";
const forbidden =
  /(?:\.(?:tsx|jsx|css)$|(?:^|\/)(?:react|react-dom|next|@puckeditor)(?:\/|$)|^src\/(?:app|features|integrations\/puck)\/|^src\/components\/registry\/(?:index|registry|legacy-registry)\.(?:ts|tsx)$|^src\/application\/storefront-templates\/materializer\.ts$|^src\/application\/bounded-storefront-synthesis\/(?!direction-contract\.ts$)|^src\/application\/(?:prompted-storefront-design-compiler|publishing|accepted-snapshot-publishing)\/|acceptance)/iu;
const deepFrozen = (value: unknown): boolean =>
  value === null ||
  typeof value !== "object" ||
  (Object.isFrozen(value) && Object.values(value).every(deepFrozen));
function actualRecord() {
  return JSON.parse(readFileSync(join(process.cwd(), recordsPath), "utf8")) as Record<
    string,
    unknown
  >;
}

function temporary(record: unknown = actualRecord()) {
  const root = realpathSync(mkdtempSync(join(tmpdir(), "ar-02-retained-source-")));
  mkdirSync(join(root, "src/application/bounded-storefront-synthesis"), { recursive: true });
  mkdirSync(join(root, "tests/fixtures/ar-02h"), { recursive: true });
  writeFileSync(join(root, sourcePath), readFileSync(join(process.cwd(), sourcePath)));
  writeFileSync(join(root, archivePath), readFileSync(join(process.cwd(), archivePath)));
  writeFileSync(join(root, recordsPath), JSON.stringify(record));
  return root;
}

describe("AR-02H semantic request boundary", () => {
  it("resolves every required runtime root without rendering or full-store execution", () => {
    for (const entry of [
      sourcePath,
      ...["semantic-request", "capability-projection", "request"].map(
        (name) => `src/application/prompted-storefront-design-intent/${name}.ts`,
      ),
    ]) {
      const closure = resolveRuntimeImportClosure(entry);
      expect(closure.runtimePaths.length).toBeGreaterThan(1);
      expect(closure.runtimePaths.filter((path) => forbidden.test(path))).toEqual([]);
      expect(closure.externalRuntimeImports.map(({ specifier }) => specifier)).toEqual(["zod"]);
    }
    const zod = resolveInstalledZodEsmClosure();
    expect(zod.runtimePaths.filter((path) => forbidden.test(path))).toEqual([]);
    expect(zod.externalRuntimeImports).toEqual([]);
  });
  it("rejects reintroducing either broad runtime barrel", () => {
    const root = realpathSync(mkdtempSync(join(tmpdir(), "ar-02b-runtime-")));
    try {
      for (const barrel of ["bounded-storefront-synthesis", "storefront-templates"]) {
        const entry = join(root, "entry.ts");
        writeFileSync(entry, `export * from "@/application/${barrel}";`);
        expect(() => {
          const closure = resolveRuntimeImportClosure(entry);
          if (closure.runtimePaths.some((path) => forbidden.test(path)))
            throw new Error("Forbidden runtime edge");
        }).toThrow(/(?:Forbidden runtime edge|Unresolved runtime import.*\.css)/);
      }
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
  it("preserves original export and nested schema object identities", () => {
    expect(synthesisExports.coordinatedStorefrontDirectionIdSchema).toBe(
      coordinatedStorefrontDirectionIdSchema,
    );
    expect(templateExports.commercialHomepageProfileIdSchema).toBe(
      commercialHomepageProfileIdSchema,
    );
    expect(templateExports.commercialCollectionSearchProfileIdSchema).toBe(
      commercialCollectionSearchProfileIdSchema,
    );
    expect(templateExports.commercialPdpProfileIdSchema).toBe(commercialPdpProfileIdSchema);
    expect(designExports.storefrontDesignDirectionIdSchema).toBe(storefrontDesignDirectionIdSchema);
    const constraints = coordinatedStorefrontDirectionPackageSchema.shape.constraints.shape;
    expect(constraints.designSystemDirectionIds.element).toBe(storefrontDesignDirectionIdSchema);
    expect(constraints.homepageProfileIds.element).toBe(commercialHomepageProfileIdSchema);
    expect(constraints.collectionProfileIds.element).toBe(
      commercialCollectionSearchProfileIdSchema,
    );
    expect(constraints.searchProfileIds.element).toBe(commercialCollectionSearchProfileIdSchema);
    expect(constraints.pdpProfileIds.element).toBe(commercialPdpProfileIdSchema);
    expect(coordinatedDirectionCharacteristicsSchema.shape.homepageProfileId.unwrap()).toBe(
      commercialHomepageProfileIdSchema,
    );
    expect(coordinatedDirectionCharacteristicsSchema.shape.collectionProfileId.unwrap()).toBe(
      commercialCollectionSearchProfileIdSchema,
    );
    expect(coordinatedDirectionCharacteristicsSchema.shape.pdpProfileId.unwrap()).toBe(
      commercialPdpProfileIdSchema,
    );
    expect(COORDINATED_STOREFRONT_DIRECTION_AUTHORITY_VERSION).toBe("1.1.0");
    expect(coordinatedStorefrontDirectionIdSchema.options).toEqual([
      "premium-editorial",
      "modern-technical",
      "minimal-commerce",
    ]);
  });
  it("keeps trusted hints, request fingerprints, rejection and input immutability", () => {
    const fixture = createP10B16P03RawKarvonenStudioFixture();
    const fixtureBefore = JSON.stringify(fixture);
    const authority = createPromptedStorefrontDesignRequestV2({
      merchantPrompt:
        "Create a refined premium jewellery storefront with strong editorial storytelling, elegant product discovery, sophisticated configurable-product pages, generous visual breathing room and restrained luxury hierarchy.",
      project: fixture.aggregate.project,
      draft: fixture.planningInput.draft,
      catalogue: fixture.planningInput.catalogue,
      approvedBrief: fixture.brief,
      approvedAssetContext: fixture.planningInput.approvedAssetContext,
    });
    const index = deriveSemanticCapabilityIndex({
      authority: {
        planningInput: fixture.planningInput,
        siteMapDecision: fixture.siteMapDecision,
        approvedEvidenceReferences: fixture.approvedEvidenceReferences,
      },
      currentAuthorityFingerprint: semanticStorefrontCurrentAuthorityFingerprint(
        authority.request.currentAuthority,
      ),
    });
    const options = {
      semanticAuthorityFingerprint: index.semanticAuthorityFingerprint,
      semanticInfluenceAuthority: index.semanticInfluenceAuthority,
    };
    const before = JSON.stringify({ authority, options });
    const request = createSemanticStorefrontDesignRequestV1(authority, options);
    expect(request.trustedExactHints).toEqual({ directionPackageId: null, frameFamilyId: null });
    expect(deepFrozen(request)).toBe(true);
    for (const directionPackageId of coordinatedStorefrontDirectionIdSchema.options) {
      const hints = { directionPackageId, frameFamilyId: "editorial-masthead" };
      const current = createSemanticStorefrontDesignRequestV1(authority, {
        ...options,
        trustedExactHints: hints,
      });
      expect(current.trustedExactHints).toEqual(hints);
      expect(current.requestFingerprint).toBe(
        expectedSemanticStorefrontDesignRequestFingerprint(current),
      );
      expect(validateSemanticStorefrontDesignRequestV1(current)).toEqual(current);
      expect(deepFrozen(current)).toBe(true);
    }
    for (const field of ["directionPackageId", "frameFamilyId"]) {
      const hints = { directionPackageId: null, frameFamilyId: null };
      Reflect.set(hints, field, "unknown");
      const invalidBefore = JSON.stringify(hints);
      expect(() =>
        createSemanticStorefrontDesignRequestV1(authority, {
          ...options,
          trustedExactHints: hints,
        }),
      ).toThrow(/invalid-request/);
      expect(JSON.stringify(hints)).toBe(invalidBefore);
    }
    const stale = structuredClone(authority);
    Reflect.set(stale.capabilityAuthority.projection, "fingerprint", "stale");
    const staleBefore = JSON.stringify(stale);
    expect(() => createSemanticStorefrontDesignRequestV1(stale, options)).toThrow(
      /stale-authority/,
    );
    expect(JSON.stringify(stale)).toBe(staleBefore);
    expect(() => validateSemanticStorefrontDesignRequestV1({})).toThrow(/invalid-request/);
    expect(() =>
      validateSemanticStorefrontDesignRequestV1({ ...request, contractVersion: "unknown" }),
    ).toThrow(/invalid-request/);
    expect(() =>
      validateSemanticStorefrontDesignRequestV1({ ...request, requestFingerprint: "stale" }),
    ).toThrow(/request-fingerprint-mismatch/);
    expect(JSON.stringify({ authority, options })).toBe(before);
    expect(JSON.stringify(fixture)).toBe(fixtureBefore);
  }, 120000);
  it("fails closed for successor, archive, record, path, and symlink corruption", () => {
    const base = actualRecord();
    const transition = (base.transitions as Array<Record<string, unknown>>)[2];
    const cases: Array<readonly [string, unknown]> = [
      [
        "wrong successor",
        { ...base, transitions: [{ ...transition, successorSha256: "0".repeat(64) }] },
      ],
      [
        "wrong archive pin",
        { ...base, transitions: [{ ...transition, originalSha256: "0".repeat(64) }] },
      ],
      ["unknown path", { ...base, transitions: [{ ...transition, path: "src/unknown.ts" }] }],
      ["duplicate", { ...base, transitions: [transition, transition] }],
      ["wrong owner", { ...base, transitions: [{ ...transition, taskId: "AR-02G" }] }],
      ["wrong base", { ...base, transitions: [{ ...transition, baseCommit: "0".repeat(40) }] }],
      [
        "unused malformed record",
        {
          ...base,
          transitions: [
            transition,
            {
              ...transition,
              taskId: "AR-02G",
              path: "src/application/bounded-storefront-synthesis/direction-contract.ts",
            },
          ],
        },
      ],
      ["escape", { ...base, transitions: [{ ...transition, archivePath: "../escape.txt" }] }],
      ["malformed", { schemaVersion: "1.0.0", transitions: [{ taskId: "AR-02G" }] }],
    ];
    cases.forEach(([label, document]) => {
      const root = temporary(document);
      try {
        expect(() =>
          readRetainedSource({
            repositoryRoot: root,
            recordsPath,
            sourcePath,
            expectedHistoricalSha256: originalSha256,
          }),
        ).toThrow();
      } finally {
        rmSync(root, { recursive: true, force: true });
      }
      expect(label).toBeTruthy();
    });
    const root = temporary();
    try {
      rmSync(join(root, archivePath));
      expect(() =>
        readRetainedSource({
          repositoryRoot: root,
          recordsPath,
          sourcePath,
          expectedHistoricalSha256: originalSha256,
        }),
      ).toThrow();
      writeFileSync(join(root, archivePath), "changed archive");
      expect(() =>
        readRetainedSource({
          repositoryRoot: root,
          recordsPath,
          sourcePath,
          expectedHistoricalSha256: originalSha256,
        }),
      ).toThrow();
      rmSync(join(root, archivePath));
      symlinkSync(join(root, sourcePath), join(root, archivePath));
      expect(() =>
        readRetainedSource({
          repositoryRoot: root,
          recordsPath,
          sourcePath,
          expectedHistoricalSha256: originalSha256,
        }),
      ).toThrow(/regular repository-relative file/i);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("returns archived bytes only after validating the fixed current successor pin", () => {
    const root = temporary();
    try {
      expect(
        readRetainedSource({
          repositoryRoot: root,
          recordsPath,
          sourcePath,
          expectedHistoricalSha256: originalSha256,
        }).toString(),
      ).toBe(readFileSync(join(process.cwd(), archivePath), "utf8"));
      expect(() => readRetainedSource({ repositoryRoot: root, recordsPath, sourcePath })).toThrow(
        /historical pin mismatch/i,
      );
      expect(() =>
        readRetainedSource({
          repositoryRoot: root,
          recordsPath,
          sourcePath,
          expectedHistoricalSha256: "0".repeat(64),
        }),
      ).toThrow(/historical pin mismatch/i);
      writeFileSync(join(root, sourcePath), "changed source");
      expect(() =>
        readRetainedSource({
          repositoryRoot: root,
          recordsPath,
          sourcePath,
          expectedHistoricalSha256: originalSha256,
        }),
      ).toThrow(/successor hash mismatch/i);
      const unrelatedPath = "src/application/bounded-storefront-synthesis/unrelated.ts";
      const originalUnrelated = "original unrelated source";
      writeFileSync(join(root, unrelatedPath), originalUnrelated);
      const input = {
        repositoryRoot: root,
        recordsPath,
        sourcePath: unrelatedPath,
        expectedHistoricalSha256: hash(originalUnrelated),
      };
      expect(readRetainedSource(input).toString()).toBe(originalUnrelated);
      writeFileSync(join(root, unrelatedPath), "changed unrelated source");
      expect(() =>
        readRetainedSource({
          repositoryRoot: root,
          recordsPath,
          sourcePath: unrelatedPath,
          expectedHistoricalSha256: hash(originalUnrelated),
        }),
      ).toThrow(/Protected source hash mismatch/i);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
