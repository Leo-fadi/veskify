import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { existsSync, lstatSync, readFileSync, realpathSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { gunzipSync } from "node:zlib";
import { z } from "zod";

import { canonicalValueFingerprint, canonicalValueString } from "@/domain/storefront";

export const repositoryRoot = path.resolve(fileURLToPath(new URL("../../", import.meta.url)));
// prettier-ignore
export const retainedInventoryPath = path.join(repositoryRoot, "tests/fixtures/p10b-19a-10a-retained-matrix-inventory.v1.json");
const baseCommit = "ffecc5be5d00630f90bf6bcbd17247773b38aeee";
// prettier-ignore
const matrixIds = "candidate-compatibility ci-discovery-integrity client-runtime-isolation cross-page-relationship-contract current-generation-isolation deterministic-candidate-selection exact-candidate-fingerprints inactive-candidate-registry legacy-v1-complete-commercial-matrix legacy-v1-frozen-72-regression legacy-v1-historical-read legacy-v1-preview-render-replay legacy-v1-protected-commerce-media legacy-v1-publication-replay legacy-v1-published-render-replay legacy-v1-replay-alias normalized-topology page-blueprint-v2-asset-role-contract page-blueprint-v2-fallback-contract page-blueprint-v2-responsive-contract page-blueprint-v2-structural-contract preview-published-structural-parity production-v2-inactivity structural-family-identity-lifecycle".split(" ");
// prettier-ignore
const ownerIds = "P10B-18C P10B-19A-01 P10B-19A-02 P10B-19A-03 P10B-19A-04 P10B-19A-05 P10B-19A-06 P10B-19A-07 P10B-19A-08A P10B-19A-08B P10B-19A-08C P10B-19A-09A P10B-19A-09B P10B-19A-09C P10B-19A-10A".split(" ");
// prettier-ignore
const verificationClasses = "boundary compatibility contract deterministic-matrix frozen-regression inactivity integration publication".split(" ");
// prettier-ignore
const inactivityIds = "production-active-structural-families production-capability-contexts production-compatibility-evaluations production-compatibility-profiles production-page-blueprint-candidates production-selectable-structural-families production-selection-receipts production-selection-requests production-structural-family-candidates".split(" ");
// prettier-ignore
const metricKeys = "completeCaseCount successfulCompileCount successfulReplayCount consumedAuthorityLineageCount normalizedMaterialTopologyCount directionLabelFreeTopologyCount repeatedClusterCount repeatedMembershipCount largestRepeatedClusterSize singletonCount completeMatrixCaseSetFingerprint frozenCaseCount frozenNormalizedTopologyCount frozenRepeatedMembershipCount frozenLargestClusterSize frozenSingletonCount frozenMatrixCaseSetFingerprint legacyAliasCount historicalRepresentativeCount previewObservationExpectedCount previewObservationActualCount previewLocaleCount previewSurfaceCount previewRepositoryWriteCount previewSourceMutationCount directCompilationExpectedCount directCompilationActualCount preparationExpectedCount preparationActualCount isolatedConfirmationExpectedCount isolatedConfirmationActualCount publishedObservationExpectedCount publishedObservationActualCount previewPublishedParityExpectedCount previewPublishedParityActualCount migrationCurrentExpectedCount migrationCurrentActualCount externalPublicationCallCount providerCallCount veskoCallCount commerceMutationCount mediaMutationCount a09bBaselineFileSha256 a09bBaselineMaterialSha256 a09cBaselineFileSha256 a09cBaselineMaterialSha256".split(" ");
const safeId = z.string().regex(/^[a-z0-9]+(?:[-.:][a-z0-9]+)*$/u);
const safeValue = z.union([
  z.boolean(),
  z.number().int().nonnegative(),
  z.string().regex(/^[a-z0-9][a-z0-9:@._-]*$/u),
]);
// prettier-ignore
const testPathSchema = z.string().regex(/^tests\/(?:unit|integration)\/[a-z0-9-]+\.(?:test|spec)\.(?:ts|tsx)$/u);
// prettier-ignore
const matrixEntrySchema = z.object({ matrixId: z.enum(matrixIds as [string, ...string[]]), ownerTaskId: z.enum(ownerIds as [string, ...string[]]), verificationClass: z.enum(verificationClasses as [string, ...string[]]), testFiles: z.array(testPathSchema).min(1), exactCommand: z.string().min(1), expectedOutcomes: z.record(safeId, safeValue), protectedAuthorityIds: z.array(safeId) }).strict();
// prettier-ignore
const inactivitySchema = z.object({ assertionId: z.enum(inactivityIds as [string, ...string[]]), expectedCount: z.literal(0), evidenceTestFiles: z.array(testPathSchema).min(1) }).strict();
const metricShape = Object.fromEntries(metricKeys.map((key) => [key, safeValue])) as Record<
  string,
  typeof safeValue
>;
// prettier-ignore
const inventorySchema = z.object({ schemaVersion: z.literal("1.0.0"), authorityKind: z.literal("p10b-19a-retained-matrix-inventory"), baseCommit: z.literal(baseCommit), matrixEntries: z.array(matrixEntrySchema), protectedProductionAuthorities: z.array(z.string().regex(/^[a-z0-9.-]+\|P10B-(?:18C|19A-(?:0[1-9][A-C]?|10A))\|src\/[a-z0-9./-]+\.(?:ts|tsx)\|[a-f0-9]{64}$/u)), productionInactivityAssertions: z.array(inactivitySchema), expectedSemanticMetrics: z.object(metricShape).strict(), inventoryFingerprint: z.string().regex(/^p10b-19a-retained-matrix-inventory-v1_[1-9][0-9]*_[a-f0-9]{64}$/u) }).strict();

export type RetainedInventory = z.infer<typeof inventorySchema>;
// prettier-ignore
export type ProtectedAuthority = Readonly<{ authorityId: string; ownerTaskId: string; path: string; sha256: string }>;
const compare = (left: string, right: string) => (left < right ? -1 : left > right ? 1 : 0);
const sha256 = (value: string | Buffer) => createHash("sha256").update(value).digest("hex");
const exact = (actual: readonly string[], expected: readonly string[], label: string) => {
  if (canonicalValueString(actual) !== canonicalValueString(expected))
    throw new Error(`${label} is incomplete, duplicated or noncanonical.`);
};
function existing(relative: string, label: string): void {
  const absolute = path.resolve(repositoryRoot, relative);
  // prettier-ignore
  if (path.isAbsolute(relative) || path.posix.normalize(relative) !== relative || !absolute.startsWith(`${repositoryRoot}${path.sep}`) || !existsSync(absolute) || !lstatSync(absolute).isFile() || lstatSync(absolute).isSymbolicLink() || realpathSync(absolute) !== absolute) throw new Error(`${label} is not a regular repository-relative file: ${relative}.`);
}
export function protectedAuthorities(inventory: RetainedInventory): readonly ProtectedAuthority[] {
  return inventory.protectedProductionAuthorities.map((encoded) => {
    const [authorityId, ownerTaskId, authorityPath, hash] = encoded.split("|");
    return { authorityId, ownerTaskId, path: authorityPath, sha256: hash };
  });
}
export function retainedInventoryFingerprint(
  value: Omit<RetainedInventory, "inventoryFingerprint"> | RetainedInventory,
): string {
  const { inventoryFingerprint: _ignored, ...material } = value as RetainedInventory;
  void _ignored;
  return `p10b-19a-retained-matrix-inventory-${canonicalValueFingerprint(material)}`;
}
export function verifyProtectedSources(inventory: RetainedInventory): void {
  protectedAuthorities(inventory).forEach(({ path: authorityPath, sha256: expected }) => {
    existing(authorityPath, "Protected authority");
    const actual = sha256(readFileSync(path.join(repositoryRoot, authorityPath)));
    if (actual !== expected)
      throw new Error(
        `Protected source hash mismatch: ${authorityPath}; expected ${expected}; actual ${actual}.`,
      );
  });
}
export function parseRetainedInventory(value: unknown): RetainedInventory {
  const inventory = inventorySchema.parse(value);
  exact(
    inventory.matrixEntries.map(({ matrixId }) => matrixId),
    matrixIds,
    "Matrix IDs",
  );
  // prettier-ignore
  exact([...new Set(inventory.matrixEntries.map(({ ownerTaskId }) => ownerTaskId))].sort(compare), ownerIds, "Owner IDs");
  // prettier-ignore
  exact([...new Set(inventory.matrixEntries.map(({ verificationClass }) => verificationClass))].sort(compare), verificationClasses, "Verification classes");
  inventory.matrixEntries.forEach((entry) => {
    exact(entry.testFiles, [...new Set(entry.testFiles)].sort(compare), `${entry.matrixId} tests`);
    exact(
      Object.keys(entry.expectedOutcomes),
      Object.keys(entry.expectedOutcomes).sort(compare),
      `${entry.matrixId} outcomes`,
    );
    exact(
      entry.protectedAuthorityIds,
      [...new Set(entry.protectedAuthorityIds)].sort(compare),
      `${entry.matrixId} authorities`,
    );
    const tokens = entry.exactCommand.split(" ");
    // prettier-ignore
    if (tokens.join(" ") !== entry.exactCommand || tokens.slice(0, 4).join(" ") !== "pnpm exec vitest run" || tokens.length < 5) throw new Error(`Unsafe matrix command: ${entry.matrixId}.`);
    // prettier-ignore
    exact(entry.testFiles, tokens.slice(4).sort(compare), `${entry.matrixId} command tests`);
    tokens.slice(4).forEach((file) => {
      testPathSchema.parse(file);
      existing(file, "Command test");
    });
    entry.testFiles.forEach((file) => existing(file, "Inventory test"));
  });
  const authorities = protectedAuthorities(inventory);
  if (
    authorities.length !== 76 ||
    authorities.some(({ ownerTaskId }) => !ownerIds.includes(ownerTaskId))
  )
    throw new Error("Protected authority inventory is incomplete or has an invalid owner.");
  // prettier-ignore
  exact(authorities.map(({ path: authorityPath }) => authorityPath), [...new Set(authorities.map(({ path: authorityPath }) => authorityPath))].sort(compare), "Protected paths");
  // prettier-ignore
  exact(authorities.map(({ authorityId }) => authorityId).sort(compare), [...new Set(authorities.map(({ authorityId }) => authorityId))].sort(compare), "Protected IDs");
  const authorityIds = new Set(authorities.map(({ authorityId }) => authorityId));
  inventory.matrixEntries
    .flatMap(({ protectedAuthorityIds }) => protectedAuthorityIds)
    .forEach((id) => {
      if (!authorityIds.has(id)) throw new Error(`Unknown protected authority: ${id}.`);
    });
  exact(
    inventory.productionInactivityAssertions.map(({ assertionId }) => assertionId),
    inactivityIds,
    "Inactivity assertions",
  );
  inventory.productionInactivityAssertions.forEach(({ evidenceTestFiles }) => {
    exact(evidenceTestFiles, [...new Set(evidenceTestFiles)].sort(compare), "Inactivity evidence");
    evidenceTestFiles.forEach((file) => existing(file, "Inactivity test"));
  });
  if (retainedInventoryFingerprint(inventory) !== inventory.inventoryFingerprint)
    throw new Error("Retained inventory fingerprint is stale.");
  verifyProtectedSources(inventory);
  return inventory;
}
export function readRetainedInventory(): RetainedInventory {
  return parseRetainedInventory(JSON.parse(readFileSync(retainedInventoryPath, "utf8")));
}

// Existing A-09 evidence stays byte-owned by its original tests; this reader only verifies it.
// prettier-ignore
type A09b = { baselineRecordCount: number; renderObservationCount: number; representatives: Array<{ directionId: string; aliasId: string; renderObservations: Array<Record<string, unknown>> }>; baselineFileMaterialSha256: string };
// prettier-ignore
type A09c = { recordCounts: Record<string, number>; mutationAndExternalActivity: Record<string, number>; representatives: Array<{ directionId: string; aliasId: string; directCompilationAuthority: { migrationStatus: string }; publishedRendererAuthority: { renderObservations: Array<Record<string, unknown>> } }>; baselineFileMaterialSha256: string };
export function readA09Baselines() {
  // prettier-ignore
  const source = readFileSync(path.join(repositoryRoot, "tests/integration/p10b-19a-09b-historical-v1-render-replay.test.tsx"), "utf8");
  // prettier-ignore
  const block = source.match(/const CHECKED_IN_BASELINE_GZIP_BASE64 = \[([\s\S]*?)\]\.join\(""\);/u)?.[1];
  if (!block) throw new Error("The embedded A-09B baseline is unavailable.");
  // prettier-ignore
  const bytes09b = gunzipSync(Buffer.from([...block.matchAll(/"([A-Za-z0-9+/=]+)"/gu)].map((match) => match[1]).join(""), "base64"));
  const a09b = JSON.parse(bytes09b.toString("utf8")) as A09b;
  // prettier-ignore
  const bytes09c = readFileSync(path.join(repositoryRoot, "tests/fixtures/p10b-19a-09c-publication-replay-baseline.v1.json"));
  const a09c = JSON.parse(bytes09c.toString("utf8")) as A09c;
  const material09b = { ...a09b } as Record<string, unknown>;
  const material09c = { ...a09c } as Record<string, unknown>;
  delete material09b.baselineFileMaterialSha256;
  delete material09c.baselineFileMaterialSha256;
  // prettier-ignore
  return { a09b, a09c, file09b: sha256(bytes09b), material09b: sha256(canonicalValueString(material09b)), file09c: sha256(bytes09c), material09c: sha256(canonicalValueString(material09c)) };
}

export async function currentVitestCoverage(inventory: RetainedInventory) {
  // prettier-ignore
  const result = spawnSync("pnpm", ["exec", "vitest", "list", "--filesOnly", "--json"], { cwd: repositoryRoot, encoding: "utf8" });
  if (result.status !== 0)
    throw new Error(`Vitest discovery failed with status ${result.status ?? "signal"}.`);
  const raw = JSON.parse(result.stdout) as Array<string | { file: string }>;
  // prettier-ignore
  const discovered = raw.map((entry) => path.relative(repositoryRoot, typeof entry === "string" ? entry : entry.file).split(path.sep).join("/")).sort(compare);
  const required = [...new Set(inventory.matrixEntries.flatMap(({ testFiles }) => testFiles))];
  required.forEach((file) => {
    if (discovered.filter((candidate) => candidate === file).length !== 1)
      throw new Error(`Vitest discovery count is not one: ${file}.`);
  });
  const modulePath = pathToFileURL(path.join(repositoryRoot, "scripts/vitest-ci.mjs")).href;
  // prettier-ignore
  const authority = (await import(modulePath)) as { readLockedPlan(): { value: { selectedShardCount: number } }; deriveOfficialShards(files: string[], total: number): string[][] };
  const shards = authority.deriveOfficialShards(
    discovered,
    authority.readLockedPlan().value.selectedShardCount,
  );
  return { discovered, required, shards, union: shards.flat() };
}
