// @vitest-environment node

import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import type * as NodeFs from "node:fs";
import { resolve } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { readRetainedSource } from "../helpers/ar-02-retained-source-transition";
import {
  createClosureCandidate,
  createClosureManifest,
  createProductOwnerDecision,
  exactProductOwnerDecisionText,
  verifyFrozenPredecessorBytes,
  type ClosureManifest,
} from "../helpers/p10b-19a-10c-architecture-closure";

// Virtual read faults exercise the real readers without changing checkout or evidence bytes.
const faults = vi.hoisted(() => ({
  bytes: new Map<string, string>(),
  missing: new Set<string>(),
  links: new Set<string>(),
}));
vi.mock("node:fs", async (original) => {
  const actual = await original<typeof NodeFs>();
  return {
    ...actual,
    readFileSync: (...args: Parameters<typeof actual.readFileSync>) => {
      const value = faults.bytes.get(String(args[0]));
      if (value === undefined) return actual.readFileSync(...args);
      const encoding = typeof args[1] === "string" ? args[1] : args[1]?.encoding;
      return encoding ? Buffer.from(value).toString(encoding) : Buffer.from(value);
    },
    existsSync: (file: Parameters<typeof actual.existsSync>[0]) =>
      !faults.missing.has(String(file)) && actual.existsSync(file),
    lstatSync: (...args: Parameters<typeof actual.lstatSync>) =>
      faults.links.has(String(args[0]))
        ? { ...actual.lstatSync(...args), isFile: () => true, isSymbolicLink: () => true }
        : actual.lstatSync(...args),
  };
});

const root = process.cwd();
const helper = "tests/helpers/p10b-19a-10a-retained-matrix-inventory.ts";
const archive = "tests/fixtures/ar-02g/p10b-19a-10a-retained-matrix-inventory.pre-ar-02g.ts.txt";
const recordPath = "tests/fixtures/ar-02-retained-source-transitions.v1.json";
const historical = "b100d6e3bff1c7cb3e25c83d886b991a7e95e9a231b1d6c0a98d0dc59c940073";
const closureText = readFileSync(
  resolve(root, "tests/fixtures/p10b-19a-10c-architecture-closure-manifest.v1.json"),
  "utf8",
);
const recordText = readFileSync(resolve(root, recordPath), "utf8");
const readHelper = (expectedHistoricalSha256 = historical) =>
  readRetainedSource({
    repositoryRoot: root,
    recordsPath: recordPath,
    sourcePath: helper,
    expectedHistoricalSha256,
  });
afterEach(() => {
  faults.bytes.clear();
  faults.missing.clear();
  faults.links.clear();
});

describe("AR-02G historical closure transition", () => {
  it("preserves all eleven historical identities and reconstructs the exact accepted closure", () => {
    const accepted = JSON.parse(closureText) as ClosureManifest;
    expect(createHash("sha256").update(closureText).digest("hex")).toBe(
      "757c0febf40da2e893f99795dc12bbf1e5bf933fe55b326cab512f80f35d67b1",
    );
    expect(createHash("sha256").update(readHelper()).digest("hex")).toBe(historical);
    expect(verifyFrozenPredecessorBytes()).toEqual({
      fileCount: 11,
      pathSetFingerprint: accepted.predecessorAuthority.frozenPathSetFingerprint,
      byteManifestFingerprint: accepted.predecessorAuthority.frozenByteManifestFingerprint,
    });
    const candidate = createClosureCandidate();
    expect(
      createClosureManifest(
        candidate,
        createProductOwnerDecision(candidate, exactProductOwnerDecisionText),
      ),
    ).toEqual(accepted);
  });

  it.each(["changed helper", "missing archive", "tampered archive", "symlink archive"])(
    "rejects %s through the actual predecessor path",
    (fault) => {
      if (fault === "changed helper") faults.bytes.set(resolve(root, helper), "changed helper");
      if (fault === "missing archive") faults.missing.add(resolve(root, archive));
      if (fault === "tampered archive") faults.bytes.set(resolve(root, archive), "changed archive");
      if (fault === "symlink archive") faults.links.add(resolve(root, archive));
      expect(verifyFrozenPredecessorBytes).toThrow(
        /successor hash|regular repository-relative|archive hash/,
      );
    },
  );

  it.each(["successor", "unknown", "duplicate", "escape"])(
    "rejects a %s record through the actual predecessor path",
    (fault) => {
      const records = JSON.parse(recordText) as { transitions: Array<Record<string, string>> };
      const entry = records.transitions.find(({ path }) => path === helper)!;
      if (fault === "successor") entry.successorSha256 = "0".repeat(64);
      if (fault === "unknown") entry.path = "tests/helpers/unapproved.ts";
      if (fault === "duplicate") records.transitions.push({ ...entry });
      if (fault === "escape") entry.archivePath = "../outside.ts.txt";
      faults.bytes.set(resolve(root, recordPath), JSON.stringify(records));
      expect(verifyFrozenPredecessorBytes).toThrow();
    },
  );

  it("rejects a wrong caller historical pin and record symlink", () => {
    expect(() => readHelper("0".repeat(64))).toThrow(/historical pin mismatch/);
    faults.links.add(resolve(root, recordPath));
    expect(verifyFrozenPredecessorBytes).toThrow(/regular repository-relative/);
  });

  it("retains the direct raw check for an unrelated frozen predecessor", () => {
    const unrelated = "tests/fixtures/p10b-19a-10b1-positive-cross-authority-integration.v1.json";
    faults.bytes.set(resolve(root, unrelated), "changed predecessor");
    expect(verifyFrozenPredecessorBytes).toThrow(
      `Repository authority hash is stale: ${unrelated}`,
    );
  });

  it("still executes the current A-10A validation after predecessor verification", () => {
    const protectedSource = "src/application/storefront-templates/contract.ts";
    faults.bytes.set(resolve(root, protectedSource), "changed protected product authority");
    expect(verifyFrozenPredecessorBytes).not.toThrow();
    expect(createClosureCandidate).toThrow(`Protected source hash mismatch: ${protectedSource}`);
  });
});
