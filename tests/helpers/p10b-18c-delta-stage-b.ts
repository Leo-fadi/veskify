import { createHash } from "node:crypto";
import { copyFile, mkdir, readFile, readdir, stat, writeFile } from "node:fs/promises";
import { dirname, isAbsolute, join, relative, resolve } from "node:path";
import type { P10B18CCaptureResumeExpectation } from "./p10b-18c-active-capture-evidence";
import {
  assertP10B18CStageBFreeSpace,
  calculateP10B18CDeltaStageBStorageRequirement,
  type P10B18CDeltaStageBStorageRequirement,
  type P10B18CStageBFilesystemProbe,
  type P10B18CStageBStoragePreflightEvidence,
  type P10B18CStageBStorageRoot,
} from "./p10b-18c-free-space-preflight";

export const P10B18C_DELTA_STAGE_B_AUDIT_FILENAME = "p10b-18c-delta-stage-b-integrity-audit.json";

export const P10B18C_RENDERER_AUTHORITY_PATHS = [
  "src",
  "public",
  "next.config.ts",
  "package.json",
  "pnpm-lock.yaml",
  "playwright.p10b-18a.config.ts",
  "playwright.p10b-18c.config.ts",
  "tests/acceptance/p10b-18a-browser-evidence.ts",
  "tests/acceptance/p10b-18c-100-plus-commercial-quality-diversity-gate.spec.ts",
  "tests/helpers/p10b-18c-active-capture-evidence.ts",
  "tests/helpers/p10b-18c-commercial-quality.ts",
  "tests/helpers/p10b-18c-presentation-image-evidence.ts",
  "tests/helpers/p10b-18c-request-ledger.ts",
  "tests/helpers/p10b-evidence-filename.ts",
] as const;

const acceptedReviewVerdicts = new Set(["PASS", "PASS WITH MINOR LIMITATION", "FAIL"]);

type DeltaCapture = Readonly<{
  filename: string;
  screenshotSha256: string;
  caseId: string;
  surface: string;
  route: string;
  viewport: number;
  locale: string;
  renderer: string;
  snapshotFingerprint: string;
  consumedAuthorityFingerprint: string;
  normalizedTopologyFingerprint: string;
}> &
  Readonly<Record<string, unknown>>;

export type P10B18CDeltaStageBResult = Readonly<{
  carriedCapturesByFilename: ReadonlyMap<string, unknown>;
  changedCaseIds: readonly string[];
  carriedCaptureCount: number;
  regeneratedCaptureCount: number;
  storageRequirement: P10B18CDeltaStageBStorageRequirement;
  storageEvidence: P10B18CStageBStoragePreflightEvidence;
  auditPath: string;
  auditFingerprint: string;
}>;

export class P10B18CDeltaStageBError extends Error {
  readonly code = "p10b-18c-delta-stage-b-integrity";

  constructor(readonly reason: string) {
    super(`P10B-18C delta Stage B integrity failed: ${reason}.`);
    this.name = "P10B18CDeltaStageBError";
  }
}

function fail(reason: string): never {
  throw new P10B18CDeltaStageBError(reason);
}

function recordValue(value: unknown): Record<string, unknown> | null {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return null;
  return Object.fromEntries(Object.entries(value));
}

function stringValue(record: Record<string, unknown>, key: string, path: string): string {
  const value = record[key];
  if (typeof value !== "string" || value.length === 0) fail(`${path}.${key} is missing`);
  return value;
}

function numberValue(record: Record<string, unknown>, key: string, path: string): number {
  const value = record[key];
  if (typeof value !== "number" || !Number.isFinite(value)) fail(`${path}.${key} is missing`);
  return value;
}

function captureValue(value: unknown, index: number): DeltaCapture {
  const record = recordValue(value);
  if (record === null) fail(`baseline captures.${index} is malformed`);
  const capture = {
    ...record,
    filename: stringValue(record, "filename", `baseline captures.${index}`),
    screenshotSha256: stringValue(record, "screenshotSha256", `baseline captures.${index}`),
    caseId: stringValue(record, "caseId", `baseline captures.${index}`),
    surface: stringValue(record, "surface", `baseline captures.${index}`),
    route: stringValue(record, "route", `baseline captures.${index}`),
    viewport: numberValue(record, "viewport", `baseline captures.${index}`),
    locale: stringValue(record, "locale", `baseline captures.${index}`),
    renderer: stringValue(record, "renderer", `baseline captures.${index}`),
    snapshotFingerprint: stringValue(record, "snapshotFingerprint", `baseline captures.${index}`),
    consumedAuthorityFingerprint: stringValue(
      record,
      "consumedAuthorityFingerprint",
      `baseline captures.${index}`,
    ),
    normalizedTopologyFingerprint: stringValue(
      record,
      "normalizedTopologyFingerprint",
      `baseline captures.${index}`,
    ),
  };
  if (!/^[a-f0-9]{64}$/.test(capture.screenshotSha256)) {
    fail(`baseline captures.${index}.screenshotSha256 is malformed`);
  }
  return capture;
}

function safeEvidencePath(root: string, filename: string): string {
  const candidate = resolve(root, filename);
  const child = relative(root, candidate);
  if (child.length === 0 || child.startsWith("..") || isAbsolute(child)) {
    fail(`capture filename ${filename} escapes its evidence root`);
  }
  return candidate;
}

function sha256(value: Uint8Array): string {
  return createHash("sha256").update(value).digest("hex");
}

async function rendererAuthorityFiles(path: string): Promise<string[]> {
  const metadata = await stat(path);
  if (metadata.isFile()) return [path];
  if (!metadata.isDirectory()) fail(`renderer authority path ${path} is not a file or directory`);
  const entries = await readdir(path, { withFileTypes: true });
  const files = await Promise.all(
    entries
      .sort((left, right) => left.name.localeCompare(right.name))
      .map((entry) => rendererAuthorityFiles(join(path, entry.name))),
  );
  return files.flat();
}

export async function p10b18cRendererAuthorityFingerprint(
  repositoryRoot = process.cwd(),
  authorityPaths: readonly string[] = P10B18C_RENDERER_AUTHORITY_PATHS,
): Promise<string> {
  const root = resolve(repositoryRoot);
  const files = (
    await Promise.all(authorityPaths.map((path) => rendererAuthorityFiles(resolve(root, path))))
  )
    .flat()
    .sort((left, right) => relative(root, left).localeCompare(relative(root, right)));
  const hash = createHash("sha256");
  for (const file of files) {
    const path = relative(root, file);
    if (path.startsWith("..") || isAbsolute(path))
      fail(`renderer authority path ${file} escapes root`);
    hash.update(path);
    hash.update("\0");
    hash.update(await readFile(file));
    hash.update("\0");
  }
  return `p10b18c-renderer-authority-v1_${hash.digest("hex")}`;
}

function completedReviewCount(review: Record<string, unknown>, expected: number): number {
  const coverage = recordValue(review.reviewCoverage);
  if (coverage !== null) {
    const total = coverage.totalCaptureCount;
    const unchanged = coverage.exactHashBoundPriorVerdictCount;
    const inspected = coverage.directlyInspectedChangedCaptureCount;
    const unreviewed = coverage.unreviewedCaptureCount;
    if (
      typeof total !== "number" ||
      typeof unchanged !== "number" ||
      typeof inspected !== "number" ||
      typeof unreviewed !== "number" ||
      total !== expected ||
      unchanged + inspected !== expected ||
      unreviewed !== 0
    ) {
      fail("baseline human review is not completely hash-bound");
    }
    return total;
  }
  if (review.reviewedCaptureCount !== expected) {
    fail("baseline human review does not cover the complete manifest");
  }
  return expected;
}

function boundReviewVerdicts(
  review: Record<string, unknown>,
  manifestSha256: string,
  captures: readonly DeltaCapture[],
): ReadonlyMap<string, string> {
  if (review.manifestSha256 !== manifestSha256) {
    fail("baseline human review is not bound to the exact manifest digest");
  }
  if (!Array.isArray(review.captureReviews) || review.captureReviews.length !== captures.length) {
    fail("baseline human review lacks complete per-capture bindings");
  }
  const captureByFilename = new Map(captures.map((capture) => [capture.filename, capture]));
  const verdicts = new Map<string, string>();
  review.captureReviews.forEach((value, index) => {
    const record = recordValue(value);
    if (record === null) fail(`baseline human review captureReviews.${index} is malformed`);
    const filename = stringValue(
      record,
      "filename",
      `baseline human review captureReviews.${index}`,
    );
    const screenshotSha256 = stringValue(
      record,
      "screenshotSha256",
      `baseline human review captureReviews.${index}`,
    );
    const verdict = stringValue(record, "verdict", `baseline human review captureReviews.${index}`);
    if (!acceptedReviewVerdicts.has(verdict)) {
      fail(`baseline human review captureReviews.${index}.verdict is unsupported`);
    }
    if (verdicts.has(filename)) fail(`duplicate baseline human review filename ${filename}`);
    const capture = captureByFilename.get(filename);
    if (capture === undefined || capture.screenshotSha256 !== screenshotSha256) {
      fail(`baseline human review binding mismatch for ${filename}`);
    }
    verdicts.set(filename, verdict);
  });
  return verdicts;
}

function assertCaptureIdentity(
  capture: DeltaCapture,
  expected: P10B18CCaptureResumeExpectation,
): void {
  const identity = expected.identity;
  const mismatches = [
    [capture.filename, expected.canonicalFilename, "filename"],
    [capture.caseId, identity.caseId, "caseId"],
    [capture.surface, identity.surfacePageType, "surface"],
    [capture.route, identity.expectedRoute, "route"],
    [capture.viewport, identity.viewport.width, "viewport"],
    [capture.locale, identity.locale, "locale"],
    [capture.renderer, identity.renderer, "renderer"],
  ].filter(([actual, planned]) => actual !== planned);
  if (mismatches.length > 0) {
    fail(
      `${expected.canonicalFilename} changed capture identity at ${mismatches
        .map(([, , field]) => field)
        .join(", ")}`,
    );
  }
}

export async function prepareP10B18CDeltaStageB(
  input: Readonly<{
    baselineManifestPath: string;
    baselineHumanReviewPath: string;
    evidenceDirectory: string;
    capturePlan: readonly P10B18CCaptureResumeExpectation[];
    currentRendererAuthorityFingerprint: string;
    storageRoots: P10B18CStageBStorageRoot[];
    storageProbe?: P10B18CStageBFilesystemProbe;
  }>,
): Promise<P10B18CDeltaStageBResult> {
  const baselineDirectory = dirname(resolve(input.baselineManifestPath));
  const reviewDirectory = dirname(resolve(input.baselineHumanReviewPath));
  const evidenceDirectory = resolve(input.evidenceDirectory);
  if (baselineDirectory !== reviewDirectory) {
    fail("baseline manifest and human review do not share one evidence root");
  }
  if (baselineDirectory === evidenceDirectory) {
    fail("delta evidence must not overwrite the accepted baseline");
  }

  const [manifestBytes, reviewBytes] = await Promise.all([
    readFile(input.baselineManifestPath),
    readFile(input.baselineHumanReviewPath),
  ]);
  const manifest = recordValue(JSON.parse(manifestBytes.toString("utf8")) as unknown);
  const review = recordValue(JSON.parse(reviewBytes.toString("utf8")) as unknown);
  if (manifest === null || review === null) fail("baseline evidence JSON is malformed");
  const captureValues = manifest.captures;
  if (!Array.isArray(captureValues) || captureValues.length !== input.capturePlan.length) {
    fail("baseline manifest capture count does not match the current deterministic plan");
  }
  if (manifest.captureCount !== input.capturePlan.length) {
    fail("baseline manifest declared capture count is stale");
  }
  const baselineRendererAuthorityFingerprint = stringValue(
    manifest,
    "rendererAuthorityFingerprint",
    "baseline manifest",
  );
  if (baselineRendererAuthorityFingerprint !== input.currentRendererAuthorityFingerprint) {
    fail("renderer or capture authority changed; a complete Stage B rerun is required");
  }
  const reviewedCaptureCount = completedReviewCount(review, captureValues.length);
  const baselineCaptures = captureValues.map(captureValue);
  const reviewVerdicts = boundReviewVerdicts(review, sha256(manifestBytes), baselineCaptures);
  const byFilename = new Map<string, DeltaCapture>();
  baselineCaptures.forEach((capture) => {
    if (byFilename.has(capture.filename)) fail(`duplicate baseline filename ${capture.filename}`);
    byFilename.set(capture.filename, capture);
  });

  const changedCaseIds = new Set<string>();
  const planWithBaseline = input.capturePlan.map((expected) => {
    const capture = byFilename.get(expected.canonicalFilename);
    if (capture === undefined) fail(`baseline capture ${expected.canonicalFilename} is missing`);
    assertCaptureIdentity(capture, expected);
    if (
      capture.snapshotFingerprint !== expected.identity.selectedSnapshotFingerprint ||
      capture.consumedAuthorityFingerprint !== expected.consumedAuthorityFingerprint ||
      capture.normalizedTopologyFingerprint !== expected.identity.normalizedTopologyFingerprint
    ) {
      changedCaseIds.add(expected.identity.caseId);
    }
    return { expected, capture };
  });

  const carriedCapturesByFilename = new Map<string, unknown>();
  const copyPlan: Array<Readonly<{ source: string; destination: string }>> = [];
  const entries = [];
  let largestBaselineCaptureBytes = 0;
  for (const { expected, capture } of planWithBaseline) {
    const source = safeEvidencePath(baselineDirectory, capture.filename);
    const image = await readFile(source);
    const actualSha256 = sha256(image);
    if (actualSha256 !== capture.screenshotSha256) {
      fail(`baseline screenshot hash mismatch for ${capture.filename}`);
    }
    largestBaselineCaptureBytes = Math.max(largestBaselineCaptureBytes, image.byteLength);
    const regenerated = changedCaseIds.has(expected.identity.caseId);
    if (regenerated) {
      entries.push({
        filename: capture.filename,
        caseId: capture.caseId,
        disposition: "regenerate-changed-case",
        before: {
          snapshotFingerprint: capture.snapshotFingerprint,
          consumedAuthorityFingerprint: capture.consumedAuthorityFingerprint,
          normalizedTopologyFingerprint: capture.normalizedTopologyFingerprint,
        },
        after: {
          snapshotFingerprint: expected.identity.selectedSnapshotFingerprint,
          consumedAuthorityFingerprint: expected.consumedAuthorityFingerprint,
          normalizedTopologyFingerprint: expected.identity.normalizedTopologyFingerprint,
        },
      });
      continue;
    }
    const destination = safeEvidencePath(evidenceDirectory, capture.filename);
    const humanVerdict = reviewVerdicts.get(capture.filename);
    if (humanVerdict === "FAIL") {
      fail(`baseline capture ${capture.filename} has a blocking human verdict`);
    }
    carriedCapturesByFilename.set(capture.filename, capture);
    copyPlan.push({ source, destination });
    entries.push({
      filename: capture.filename,
      caseId: capture.caseId,
      disposition: "carry-forward-byte-identical",
      screenshotSha256: capture.screenshotSha256,
      snapshotFingerprint: capture.snapshotFingerprint,
      consumedAuthorityFingerprint: capture.consumedAuthorityFingerprint,
      normalizedTopologyFingerprint: capture.normalizedTopologyFingerprint,
      humanVerdict,
    });
  }

  const changedCaseIdList = [...changedCaseIds].sort((left, right) => left.localeCompare(right));
  const regeneratedCaptureCount = entries.filter(
    ({ disposition }) => disposition === "regenerate-changed-case",
  ).length;
  if (regeneratedCaptureCount > input.capturePlan.length * 0.25) {
    fail(
      `${regeneratedCaptureCount} of ${input.capturePlan.length} captures exceed the 25 percent delta limit`,
    );
  }
  const storageRequirement = calculateP10B18CDeltaStageBStorageRequirement({
    changedCaptureCount: regeneratedCaptureCount,
    largestBaselineCaptureBytes,
  });
  const storageEvidence = assertP10B18CStageBFreeSpace({
    roots: input.storageRoots,
    requiredBytes: storageRequirement.requiredDeltaFreeBytes,
    probe: input.storageProbe,
    phase: "delta-stage-b-precapture",
  });
  await mkdir(evidenceDirectory, { recursive: true });
  for (const { source, destination } of copyPlan) {
    await mkdir(dirname(destination), { recursive: true });
    await copyFile(source, destination);
  }
  const audit = {
    contractVersion: "p10b-18c-delta-stage-b-integrity-v1",
    classification: "authority-and-hash-bound delta Stage B",
    baseline: {
      manifestPath: resolve(input.baselineManifestPath),
      manifestSha256: sha256(manifestBytes),
      humanReviewPath: resolve(input.baselineHumanReviewPath),
      humanReviewSha256: sha256(reviewBytes),
      reviewedCaptureCount,
      rendererAuthorityFingerprint: baselineRendererAuthorityFingerprint,
    },
    current: {
      evidenceDirectory,
      rendererAuthorityFingerprint: input.currentRendererAuthorityFingerprint,
      plannedCaptureCount: input.capturePlan.length,
      changedCaseIds: changedCaseIdList,
      carriedCaptureCount: carriedCapturesByFilename.size,
      regeneratedCaptureCount,
      storageRequirement,
      storageEvidence,
    },
    entries,
  };
  const serializedAudit = `${JSON.stringify(audit, null, 2)}\n`;
  const auditPath = resolve(evidenceDirectory, P10B18C_DELTA_STAGE_B_AUDIT_FILENAME);
  await writeFile(auditPath, serializedAudit, "utf8");
  return {
    carriedCapturesByFilename,
    changedCaseIds: changedCaseIdList,
    carriedCaptureCount: carriedCapturesByFilename.size,
    regeneratedCaptureCount,
    storageRequirement,
    storageEvidence,
    auditPath,
    auditFingerprint: `p10b18c-delta-stage-b-v1_${sha256(Buffer.from(serializedAudit, "utf8"))}`,
  };
}
