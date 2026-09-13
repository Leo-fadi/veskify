// @vitest-environment node

import { createHash } from "node:crypto";
import {
  cpSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { readRetainedSource } from "../helpers/ar-02-retained-source-transition";

const root = process.cwd();
const recordsPath = "tests/fixtures/ar-02-retained-source-transitions.v1.json";
const transitions = [
  {
    path: "src/application/bounded-storefront-synthesis/contract.ts",
    archivePath: "tests/fixtures/ar-02m/synthesis-contract.pre-ar-02m.ts.txt",
    originalSha256: "39dc68a8484c6c9ce70dfb271ed5c25261dba31aa0b2801741bf439bb1d71784",
  },
  {
    path: "src/application/bounded-storefront-synthesis/direction-registry.ts",
    archivePath: "tests/fixtures/ar-02m/direction-registry.pre-ar-02m.ts.txt",
    originalSha256: "89bc33413448fadb73a56385c4e9cd1b12ca6b23e1022eb0e5cbf4e6c0605ca1",
  },
  {
    path: "src/application/bounded-storefront-synthesis/compatible-direction-selections.ts",
    archivePath: "tests/fixtures/ar-02m/compatible-direction-selections.pre-ar-02m.ts.txt",
    originalSha256: "ff2af5f1cee5458e633e476cfc8bf2ffbbeb3e8ed6b451cb46f9219614db96dc",
  },
  {
    path: "src/application/prompted-storefront-design-compiler/semantic-compatibility-resolution.ts",
    archivePath: "tests/fixtures/ar-02m/semantic-compatibility-resolution.pre-ar-02m.ts.txt",
    originalSha256: "0defde83c5531069f5c1091c5918220b702e1869469f0000822deec70e7530bb",
  },
] as const;

function records() {
  return JSON.parse(readFileSync(join(root, recordsPath), "utf8")) as {
    schemaVersion: string;
    transitions: Array<Record<string, string>>;
  };
}

function copyFile(targetRoot: string, path: string) {
  const target = join(targetRoot, path);
  mkdirSync(dirname(target), { recursive: true });
  cpSync(join(root, path), target, { dereference: false });
}

function temporary(document = records()) {
  const target = mkdtempSync(join(tmpdir(), "ar-02m-retained-source-"));
  copyFile(target, recordsPath);
  for (const transition of transitions) {
    copyFile(target, transition.path);
    copyFile(target, transition.archivePath);
  }
  writeFileSync(join(target, recordsPath), JSON.stringify(document));
  return target;
}

function read(
  target: string,
  transition: (typeof transitions)[number],
  pin: string = transition.originalSha256,
) {
  return readRetainedSource({
    repositoryRoot: target,
    recordsPath,
    sourcePath: transition.path,
    expectedHistoricalSha256: pin,
  });
}

describe("AR-02M retained coordinated metadata transitions", () => {
  it.each(transitions)(
    "returns byte-exact $path only for its fixed historical pin",
    (transition) => {
      const target = temporary();
      try {
        const archived = read(target, transition);
        expect(createHash("sha256").update(archived).digest("hex")).toBe(transition.originalSha256);
        expect(archived).toEqual(readFileSync(join(root, transition.archivePath)));
        expect(() => read(target, transition, "0".repeat(64))).toThrow(/historical pin mismatch/i);
        expect(() =>
          readRetainedSource({ repositoryRoot: target, recordsPath, sourcePath: transition.path }),
        ).toThrow(/historical pin mismatch/i);
      } finally {
        rmSync(target, { recursive: true, force: true });
      }
    },
  );

  it.each(transitions)("rejects changed successor and archive bytes for $path", (transition) => {
    const target = temporary();
    try {
      writeFileSync(join(target, transition.path), "changed successor");
      expect(() => read(target, transition)).toThrow(/successor hash mismatch/i);
      copyFile(target, transition.path);
      writeFileSync(join(target, transition.archivePath), "changed archive");
      expect(() => read(target, transition)).toThrow(/archive hash mismatch/i);
    } finally {
      rmSync(target, { recursive: true, force: true });
    }
  });

  it.each([
    ["wrong task", (entry: Record<string, string>) => ({ ...entry, taskId: "AR-02H" })],
    ["wrong base", (entry: Record<string, string>) => ({ ...entry, baseCommit: "0".repeat(40) })],
    ["wrong path", (entry: Record<string, string>) => ({ ...entry, path: "src/unapproved.ts" })],
    [
      "wrong archive",
      (entry: Record<string, string>) => ({ ...entry, archivePath: "../escape.ts" }),
    ],
    [
      "wrong historical hash",
      (entry: Record<string, string>) => ({ ...entry, originalSha256: "0".repeat(64) }),
    ],
    [
      "wrong successor hash",
      (entry: Record<string, string>) => ({ ...entry, successorSha256: "0".repeat(64) }),
    ],
  ] as const)(
    "rejects a %s record for every transition, including unused rows",
    (_label, change) => {
      for (const transition of transitions) {
        const document = records();
        document.transitions = document.transitions.map((entry) =>
          entry.path === transition.path ? change(entry) : entry,
        );
        const target = temporary(document);
        try {
          expect(() => read(target, transitions[0])).toThrow();
        } finally {
          rmSync(target, { recursive: true, force: true });
        }
      }
    },
  );

  it("rejects duplicate records and an untransitioned protected source change", () => {
    const document = records();
    document.transitions.push({
      ...document.transitions.find(({ path }) => path === transitions[0].path)!,
    });
    const duplicate = temporary(document);
    try {
      expect(() => read(duplicate, transitions[0])).toThrow(/duplicate/i);
    } finally {
      rmSync(duplicate, { recursive: true, force: true });
    }
    const target = temporary();
    try {
      const unrelated = "src/application/bounded-storefront-synthesis/untransitioned.ts";
      const path = resolve(target, unrelated);
      mkdirSync(dirname(path), { recursive: true });
      writeFileSync(path, "original");
      expect(
        readRetainedSource({
          repositoryRoot: target,
          recordsPath,
          sourcePath: unrelated,
          expectedHistoricalSha256: createHash("sha256").update("original").digest("hex"),
        }).toString(),
      ).toBe("original");
      writeFileSync(path, "changed");
      expect(() =>
        readRetainedSource({
          repositoryRoot: target,
          recordsPath,
          sourcePath: unrelated,
          expectedHistoricalSha256: createHash("sha256").update("original").digest("hex"),
        }),
      ).toThrow(/Protected source hash mismatch/i);
    } finally {
      rmSync(target, { recursive: true, force: true });
    }
  });
  it.each(transitions)("rejects unsafe files for $path", (transition) => {
    for (const relative of [transition.path, transition.archivePath, recordsPath]) {
      const target = temporary();
      try {
        const file = join(target, relative);
        rmSync(file);
        mkdirSync(file);
        expect(() => read(target, transition)).toThrow(/regular repository-relative/i);
        rmSync(file, { recursive: true });
        symlinkSync(join(root, relative), file);
        expect(() => read(target, transition)).toThrow(/regular repository-relative/i);
      } finally {
        rmSync(target, { recursive: true, force: true });
      }
    }
    for (const sourcePath of [resolve(root, transition.path), "../outside.ts"]) {
      expect(() =>
        readRetainedSource({
          repositoryRoot: root,
          recordsPath,
          sourcePath,
          expectedHistoricalSha256: transition.originalSha256,
        }),
      ).toThrow(/regular repository-relative/i);
    }
  });
});
