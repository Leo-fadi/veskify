import { createHash } from "node:crypto";
import { existsSync, lstatSync, readFileSync, realpathSync } from "node:fs";
import path from "node:path";
import { z } from "zod";

const paths = [
  "src/application/storefront-templates/commercial-utility-profiles.ts",
  "src/application/bounded-storefront-synthesis/direction-contract.ts",
  "tests/helpers/p10b-19a-10a-retained-matrix-inventory.ts",
] as const;
const authorities = [
  {
    taskId: "AR-02G",
    path: paths[0],
    baseCommit: "9bdc045042ec8b1be27b971f5651a02edaf98468",
    originalSha256: "cacb58d5debc5b00367b68df6b503335082d7a37549742d967116388b525d3f0",
    archivePath: "tests/fixtures/ar-02g/commercial-utility-profiles.pre-ar-02g.ts.txt",
    successorSha256: "f363ed045cb0c974efa0eb8aa497037ff143a36cc125bf63c200a49d95af462c",
  },
  {
    taskId: "AR-02G",
    path: paths[2],
    baseCommit: "9bdc045042ec8b1be27b971f5651a02edaf98468",
    originalSha256: "b100d6e3bff1c7cb3e25c83d886b991a7e95e9a231b1d6c0a98d0dc59c940073",
    archivePath: "tests/fixtures/ar-02g/p10b-19a-10a-retained-matrix-inventory.pre-ar-02g.ts.txt",
    successorSha256: "01d8f531a70f622938ea67a0863b33c48b158e99fbdc8f26277ffa8bfd2ac182",
  },
  {
    taskId: "AR-02H",
    path: paths[1],
    baseCommit: "49d7f666d825b236eb042d21c1f7b5146979eebb",
    originalSha256: "f62ab54f221d084a0f593d2a090feca7ba9ddce4f9d23dcf8688960f4d8d1b28",
    archivePath: "tests/fixtures/ar-02h/direction-contract.pre-ar-02h.ts.txt",
    successorSha256: "f38de9d89c4b5793ba8ad77e4c9e490bb4dc309699da559f23c02a926ece0509",
  },
] as const;
const recordSchema = z
  .object({
    taskId: z.enum(["AR-02G", "AR-02H"]),
    path: z.enum(paths),
    baseCommit: z.string().regex(/^[a-f0-9]{40}$/u),
    originalSha256: z.string().regex(/^[a-f0-9]{64}$/u),
    archivePath: z.string().min(1),
    successorSha256: z.string().regex(/^[a-f0-9]{64}$/u),
  })
  .strict()
  .superRefine((value, context) => {
    if (
      (value.taskId === "AR-02G" && value.path !== paths[0] && value.path !== paths[2]) ||
      (value.taskId === "AR-02H" && value.path !== paths[1])
    )
      context.addIssue({ code: "custom", message: "Transition task and path do not match." });
  });
const documentSchema = z
  .object({ schemaVersion: z.literal("1.0.0"), transitions: z.array(recordSchema) })
  .strict();
type Record = z.infer<typeof recordSchema>;

const hash = (bytes: Buffer) => createHash("sha256").update(bytes).digest("hex");
function regular(root: string, relative: string, label: string): string {
  const absolute = path.resolve(root, relative);
  if (
    path.isAbsolute(relative) ||
    path.posix.normalize(relative) !== relative ||
    !absolute.startsWith(`${root}${path.sep}`) ||
    !existsSync(absolute) ||
    !lstatSync(absolute).isFile() ||
    lstatSync(absolute).isSymbolicLink() ||
    realpathSync(absolute) !== absolute
  )
    throw new Error(`${label} is not a regular repository-relative file: ${relative}.`);
  return absolute;
}

export function readRetainedSource(
  input: Readonly<{
    repositoryRoot: string;
    recordsPath: string;
    sourcePath: string;
    expectedHistoricalSha256?: string;
  }>,
): Buffer {
  const recordFile = regular(input.repositoryRoot, input.recordsPath, "Transition record");
  const document = documentSchema.parse(JSON.parse(readFileSync(recordFile, "utf8")));
  const records = document.transitions as readonly Record[];
  if (new Set(records.map((record) => record.path)).size !== records.length)
    throw new Error("Transition records have duplicate paths.");
  // Reject every malformed or not-yet-approved transition, including unused records.
  for (const record of records) {
    const authority = authorities.find((candidate) => candidate.path === record.path);
    if (
      !authority ||
      record.taskId !== authority.taskId ||
      record.baseCommit !== authority.baseCommit ||
      record.originalSha256 !== authority.originalSha256 ||
      record.archivePath !== authority.archivePath ||
      record.successorSha256 !== authority.successorSha256
    )
      throw new Error(`Transition record does not match retained authority: ${record.path}.`);
  }
  const source = regular(input.repositoryRoot, input.sourcePath, "Protected authority");
  const record = records.find((candidate) => candidate.path === input.sourcePath);
  const current = readFileSync(source);
  if (!record) {
    if (input.expectedHistoricalSha256 && hash(current) !== input.expectedHistoricalSha256)
      throw new Error(
        `Protected source hash mismatch: ${input.sourcePath}; expected ${input.expectedHistoricalSha256}; actual ${hash(current)}.`,
      );
    return current;
  }
  const authority = authorities.find((candidate) => candidate.path === record.path)!;
  if (input.expectedHistoricalSha256 !== authority.originalSha256)
    throw new Error(`Transition historical pin mismatch: ${record.path}.`);
  if (hash(current) !== record.successorSha256)
    throw new Error(`Transition successor hash mismatch: ${record.path}.`);
  const archive = readFileSync(
    regular(input.repositoryRoot, record.archivePath, "Transition archive"),
  );
  if (hash(archive) !== authority.originalSha256)
    throw new Error(`Transition archive hash mismatch: ${record.path}.`);
  return archive;
}
