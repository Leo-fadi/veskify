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
import {
  listCommercialUtilityProfiles,
  listExecutablePageBlueprintProfiles,
  validateCommercialUtilityProfileLibrary,
} from "@/application/storefront-templates";
import { commercialUtilityPagePlans } from "@/application/storefront-templates/commercial-utility-profiles";
import { veskifyComponentCapabilityManifest } from "@/components/registry/capability-manifest";
import { veskifyComponentDefinitionsV2 } from "@/components/registry/v2-registry";
import { sharedStorefrontFrameProfile } from "@/application/storefront-templates/registry";
import { readRetainedSource } from "../helpers/ar-02-retained-source-transition";
import { resolveRuntimeImportClosure } from "../helpers/ar-02-runtime-import-closure";

const hash = (value: string) => createHash("sha256").update(value).digest("hex");
const recordsPath = "tests/fixtures/ar-02-retained-source-transitions.v1.json";
const sourcePath = "src/application/storefront-templates/commercial-utility-profiles.ts";
const archivePath = "tests/fixtures/ar-02g/commercial-utility-profiles.pre-ar-02g.ts.txt";
const originalSha256 = "cacb58d5debc5b00367b68df6b503335082d7a37549742d967116388b525d3f0";
const forbidden =
  /(?:\.(?:tsx|jsx|css)$|(?:^|\/)(?:react|react-dom|next|@puckeditor)(?:\/|$)|^src\/(?:app|features|integrations\/puck)\/|^src\/components\/registry\/(?:index|registry|legacy-registry)\.(?:ts|tsx)$|^src\/application\/storefront-templates\/materializer\.ts$|^src\/application\/(?:bounded-storefront-synthesis|publishing|accepted-snapshot-publishing)\/|acceptance)/iu;

function clone<T>(value: T): T {
  return structuredClone(value);
}

function actualRecord() {
  return JSON.parse(readFileSync(join(process.cwd(), recordsPath), "utf8")) as Record<
    string,
    unknown
  >;
}

function temporary(record: unknown = actualRecord()) {
  const root = realpathSync(mkdtempSync(join(tmpdir(), "ar-02-retained-source-")));
  mkdirSync(join(root, "src/application/storefront-templates"), { recursive: true });
  mkdirSync(join(root, "tests/fixtures/ar-02g"), { recursive: true });
  writeFileSync(join(root, sourcePath), readFileSync(join(process.cwd(), sourcePath)));
  writeFileSync(join(root, archivePath), readFileSync(join(process.cwd(), archivePath)));
  writeFileSync(join(root, recordsPath), JSON.stringify(record));
  return root;
}

describe("AR-02G template capability boundary", () => {
  it("keeps all capability consumers renderer-free after moving only the variant authority edge", () => {
    const entries = [
      "src/application/storefront-templates/commercial-utility-profiles.ts",
      "src/application/storefront-templates/registry.ts",
      "src/components/registry/capability-manifest.ts",
      "src/application/storefront-templates/commerce-utility-materializer.ts",
      "src/application/prompted-storefront-design-intent/capability-projection.ts",
      "src/application/prompted-storefront-design-intent/request.ts",
    ];
    entries.forEach((entry) => {
      const closure = resolveRuntimeImportClosure(entry);
      expect(closure.runtimePaths).not.toEqual([]);
      expect(closure.runtimePaths.filter((path) => forbidden.test(path))).toEqual([]);
      expect(closure.externalRuntimeImports.map(({ specifier }) => specifier)).toEqual(["zod"]);
    });
  });

  it("preserves the six frozen utility profiles, generated capability values, and strict failures", () => {
    const before = JSON.stringify(commercialUtilityPagePlans);
    const profiles = listCommercialUtilityProfiles();
    expect(profiles).toHaveLength(6);
    expect(listExecutablePageBlueprintProfiles()).toHaveLength(53);
    expect(veskifyComponentDefinitionsV2).toHaveLength(29);
    expect(veskifyComponentCapabilityManifest.manifest.entries).toHaveLength(29);
    expect(veskifyComponentCapabilityManifest.manifest.profiles).toHaveLength(53);
    expect(
      hash(
        JSON.stringify({
          pagePlans: listExecutablePageBlueprintProfiles(),
          sharedStorefrontFrameProfile,
        }),
      ),
    ).toBe("bb645147d5be601a9d1f46a4c6bfdd18111183aee0c151ddeff22d020b6e5871");
    expect(Object.isFrozen(commercialUtilityPagePlans)).toBe(true);
    expect(validateCommercialUtilityProfileLibrary(profiles)).toHaveLength(6);
    expect(() => validateCommercialUtilityProfileLibrary([...profiles, profiles[0]])).toThrow(
      /unique/i,
    );
    const malformed = clone(profiles[0]);
    Reflect.set(malformed.profile!.commercialUtility!, "requiredRuntimeCapabilities", [
      "continue-checkot",
    ]);
    const directVariant = clone(profiles[0]);
    Reflect.set(directVariant.slots[0], "defaultVariant", "unregistered");
    Reflect.set(directVariant.slots[0], "allowedVariants", [
      ...directVariant.slots[0].allowedVariants,
      "unregistered",
    ]);
    const stale = clone(profiles[0]);
    Reflect.set(stale.profile!.commercialUtility!, "structuralSignature", "stale");
    const badFrame = clone(profiles[0]);
    Reflect.set(badFrame.profile!.commercialUtility!, "compatibleSharedFrameProfileIds", [
      "unknown-frame",
    ]);
    const badTransform = clone(profiles[0]);
    Reflect.set(
      badTransform.profile!.commercialUtility!.responsiveArchitecture[0],
      "transformationIds",
      ["bad"],
    );
    expect(() =>
      validateCommercialUtilityProfileLibrary([directVariant, ...profiles.slice(1)]),
    ).toThrow(/unregistered variant/i);
    expect(() =>
      validateCommercialUtilityProfileLibrary([malformed, ...profiles.slice(1)]),
    ).toThrow();
    expect(() => validateCommercialUtilityProfileLibrary([stale, ...profiles.slice(1)])).toThrow(
      /stale structural authority/i,
    );
    expect(() =>
      validateCommercialUtilityProfileLibrary([badFrame, ...profiles.slice(1)]),
    ).toThrow();
    expect(() =>
      validateCommercialUtilityProfileLibrary([badTransform, ...profiles.slice(1)]),
    ).toThrow(/unsupported/i);
    expect(JSON.stringify(commercialUtilityPagePlans)).toBe(before);
  });

  it("fails closed for successor, archive, record, path, and symlink corruption", () => {
    const base = actualRecord();
    const transition = (base.transitions as Array<Record<string, unknown>>)[0];
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
      ["wrong owner", { ...base, transitions: [{ ...transition, taskId: "AR-02H" }] }],
      ["wrong base", { ...base, transitions: [{ ...transition, baseCommit: "0".repeat(40) }] }],
      [
        "unused malformed record",
        {
          ...base,
          transitions: [
            transition,
            {
              ...transition,
              taskId: "AR-02H",
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
      const unrelatedPath = "src/application/storefront-templates/unrelated.ts";
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
