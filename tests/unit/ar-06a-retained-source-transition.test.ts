import { createHash } from "node:crypto";
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { tmpdir } from "node:os";
import { describe, expect, it } from "vitest";
import { readRetainedSource } from "../helpers/ar-02-retained-source-transition";

const recordsPath = "tests/fixtures/ar-02-retained-source-transitions.v1.json";
type TransitionRecord = { taskId: string; path: string; archivePath: string };
type TransitionDocument = { schemaVersion: string; transitions: TransitionRecord[] };
const rows = [
  {
    path: "tests/unit/p10b-19a-10a-retained-matrix-inventory.test.ts",
    archive: "tests/fixtures/ar-06a/p10b-19a-10a-retained-matrix-inventory.test.pre-ar-06a.ts.txt",
    historical: "14ee717cb1b6c682ae2c8013c0544b66d6aef6e1aa1a300eeb9e43c92785b50a",
    current: "bbf6cdc66276cb5ed5d04a6f443d08a78e68837140ae65e1a8a3078925e0f9ff",
  },
  {
    path: "tests/helpers/p10b-19a-10c-architecture-closure.ts",
    archive: "tests/fixtures/ar-06a/p10b-19a-10c-architecture-closure.pre-ar-06a.ts.txt",
    historical: "a0c9658d65d080812fcb1e8afd7554a45336e9acae763854637ee33dd99f01ae",
    current: "17b006ac8a607f262762992cfad150e42a73412acb83240ba2ee5326956aaea9",
  },
] as const;
const hash = (value: Buffer) => createHash("sha256").update(value).digest("hex");
const read = (root: string, row: (typeof rows)[number], pin: string = row.historical) =>
  readRetainedSource({
    repositoryRoot: root,
    recordsPath,
    sourcePath: row.path,
    expectedHistoricalSha256: pin,
  });
function copy(root: string, row: (typeof rows)[number]) {
  for (const file of [recordsPath, row.path, row.archive]) {
    mkdirSync(dirname(join(root, file)), { recursive: true });
    cpSync(file, join(root, file));
  }
}

describe("AR-06A retained source transitions", () => {
  it.each(rows)("returns the archived historical bytes and pins current $path", (row) => {
    expect(hash(read(process.cwd(), row, row.historical))).toBe(row.historical);
    expect(hash(readFileSync(row.path))).toBe(row.current);
    expect(() =>
      readRetainedSource({
        repositoryRoot: process.cwd(),
        recordsPath,
        sourcePath: row.path,
      }),
    ).toThrow(/historical pin/i);
    expect(() => read(process.cwd(), row, "0".repeat(64))).toThrow(/historical pin/i);
  });
  describe.each(rows)("$path", (row) => {
    it.each(["source", "archive", "missing", "duplicate", "foreign", "path", "escape", "unused"])(
      "rejects %s record/source tampering",
      (kind) => {
        const root = mkdtempSync(join(tmpdir(), "ar06a-transition-"));
        try {
          copy(root, row);
          const document = JSON.parse(
            readFileSync(join(root, recordsPath), "utf8"),
          ) as TransitionDocument;
          const record = document.transitions.find(
            (entry: { path: string }) => entry.path === row.path,
          )!;
          if (kind === "source" || kind === "archive")
            writeFileSync(join(root, kind === "source" ? row.path : row.archive), "altered");
          if (kind === "missing")
            document.transitions = document.transitions.filter(
              (entry: { path: string }) => entry.path !== row.path,
            );
          if (kind === "duplicate") document.transitions.push(record);
          if (kind === "foreign") record.taskId = "AR-05B";
          if (kind === "path") record.path = "tests/helpers/foreign.ts";
          if (kind === "escape") record.archivePath = "../escape.ts";
          if (kind === "unused")
            document.transitions.push({ ...record, path: "tests/helpers/unused.ts" });
          writeFileSync(join(root, recordsPath), JSON.stringify(document));
          expect(() => read(root, row, row.historical)).toThrow();
        } finally {
          rmSync(root, { recursive: true, force: true });
        }
      },
    );
  });
});
