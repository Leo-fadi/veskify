import { createHash } from "node:crypto";
import { existsSync, lstatSync, readFileSync, realpathSync } from "node:fs";
import path from "node:path";
import { z } from "zod";

const paths = [
  "src/application/storefront-templates/commercial-utility-profiles.ts",
  "src/application/bounded-storefront-synthesis/direction-contract.ts",
  "tests/helpers/p10b-19a-10a-retained-matrix-inventory.ts",
  "src/application/bounded-storefront-synthesis/contract.ts",
  "src/application/bounded-storefront-synthesis/direction-registry.ts",
  "src/application/bounded-storefront-synthesis/compatible-direction-selections.ts",
  "src/application/prompted-storefront-design-compiler/semantic-compatibility-resolution.ts",
  "src/domain/storefront/storefront.ts",
  "src/domain/storefront/canonical-storefront.ts",
  "tests/unit/p10b-19a-10a-retained-matrix-inventory.test.ts",
  "tests/helpers/p10b-19a-10c-architecture-closure.ts",
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
  {
    taskId: "AR-02M",
    path: paths[3],
    baseCommit: "0743d63b706a61501eab366752540503ad367044",
    originalSha256: "39dc68a8484c6c9ce70dfb271ed5c25261dba31aa0b2801741bf439bb1d71784",
    archivePath: "tests/fixtures/ar-02m/synthesis-contract.pre-ar-02m.ts.txt",
    successorSha256: "79f8521e808fe48d42ff085f2c1d3e847a460ee981560383be4c41b1e69d2f85",
  },
  {
    taskId: "AR-02M",
    path: paths[4],
    baseCommit: "0743d63b706a61501eab366752540503ad367044",
    originalSha256: "89bc33413448fadb73a56385c4e9cd1b12ca6b23e1022eb0e5cbf4e6c0605ca1",
    archivePath: "tests/fixtures/ar-02m/direction-registry.pre-ar-02m.ts.txt",
    successorSha256: "71df379d776efa940334356987ed6b8a9c72d9c8f2f8f26c15ce66f51be092d4",
  },
  {
    taskId: "AR-02M",
    path: paths[5],
    baseCommit: "0743d63b706a61501eab366752540503ad367044",
    originalSha256: "ff2af5f1cee5458e633e476cfc8bf2ffbbeb3e8ed6b451cb46f9219614db96dc",
    archivePath: "tests/fixtures/ar-02m/compatible-direction-selections.pre-ar-02m.ts.txt",
    successorSha256: "dafd8210fb868797d7ba8ae48b948b5f816e68627bff0d47433d9cb764dbdcbe",
  },
  {
    taskId: "AR-02M",
    path: paths[6],
    baseCommit: "0743d63b706a61501eab366752540503ad367044",
    originalSha256: "0defde83c5531069f5c1091c5918220b702e1869469f0000822deec70e7530bb",
    archivePath: "tests/fixtures/ar-02m/semantic-compatibility-resolution.pre-ar-02m.ts.txt",
    successorSha256: "22efb180825d76f39de79661bd7be4e6642cc857ca0073bf0a0def01383b6383",
  },
  {
    taskId: "AR-05B",
    path: paths[7],
    baseCommit: "1d880f1efc9ff2f2eb735b5638a9a7058dd9f3fc",
    originalSha256: "ef5c167114b2f94f66a9f13bb181db9fe1f03d06f2ff4b7c141795c0739d9d99",
    archivePath: "tests/fixtures/ar-05b/storefront.pre-ar-05b.ts.txt",
    successorSha256: "6a8d8a58d1aa019429062bda07003d52f604c12a4d2412aae45ad87edaa80e9b",
  },
  {
    taskId: "AR-05B",
    path: paths[8],
    baseCommit: "1d880f1efc9ff2f2eb735b5638a9a7058dd9f3fc",
    originalSha256: "d47e26eb93d935f83e604a357e6a43edd39e00deabcbf3b1df131eea50b5e6bb",
    archivePath: "tests/fixtures/ar-05b/canonical-storefront.pre-ar-05b.ts.txt",
    successorSha256: "931b95cf7acadbef42b5032fa5c2918c027ac7557ca92f40fb0c3520b7b14959",
  },
  {
    taskId: "AR-06A",
    path: paths[9],
    baseCommit: "a4f4ea0bee14b12cefaa8ff65cd31d7891675f02",
    originalSha256: "14ee717cb1b6c682ae2c8013c0544b66d6aef6e1aa1a300eeb9e43c92785b50a",
    archivePath:
      "tests/fixtures/ar-06a/p10b-19a-10a-retained-matrix-inventory.test.pre-ar-06a.ts.txt",
    successorSha256: "bbf6cdc66276cb5ed5d04a6f443d08a78e68837140ae65e1a8a3078925e0f9ff",
  },
  {
    taskId: "AR-06A",
    path: paths[10],
    baseCommit: "a4f4ea0bee14b12cefaa8ff65cd31d7891675f02",
    originalSha256: "a0c9658d65d080812fcb1e8afd7554a45336e9acae763854637ee33dd99f01ae",
    archivePath: "tests/fixtures/ar-06a/p10b-19a-10c-architecture-closure.pre-ar-06a.ts.txt",
    successorSha256: "17b006ac8a607f262762992cfad150e42a73412acb83240ba2ee5326956aaea9",
  },
] as const;
const recordSchema = z
  .object({
    taskId: z.enum(["AR-02G", "AR-02H", "AR-02M", "AR-05B", "AR-06A"]),
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
      (value.taskId === "AR-02H" && value.path !== paths[1]) ||
      (value.taskId === "AR-02M" &&
        value.path !== paths[3] &&
        value.path !== paths[4] &&
        value.path !== paths[5] &&
        value.path !== paths[6]) ||
      (value.taskId === "AR-05B" && value.path !== paths[7] && value.path !== paths[8]) ||
      (value.taskId === "AR-06A" && value.path !== paths[9] && value.path !== paths[10])
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
