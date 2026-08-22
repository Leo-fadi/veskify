import { existsSync, statfsSync } from "node:fs";
import { dirname, resolve } from "node:path";

export const P10B18C_STAGE_B_MINIMUM_AVAILABLE_BYTES = 20 * 1024 ** 3;
export const P10B18C_DELTA_STAGE_B_MINIMUM_AVAILABLE_BYTES = 4 * 1024 ** 3;
export const P10B18C_DELTA_STAGE_B_HEADROOM_BYTES = 1024 ** 3;

export const P10B18C_STANDALONE_BUILD_ROOT_ENV = "P10B18C_STANDALONE_BUILD_ROOT" as const;
export const P10B18C_INTEGRATED_P04_BUILD_ROOT_ENV = "P10B18C_INTEGRATED_P04_BUILD_ROOT" as const;

export const P10B18C_STAGE_B_STORAGE_AUTHORITY = "p10b-18c-stage-b-acceptance-harness" as const;

export type P10B18CStageBStorageRootIdentity =
  "evidence-root" | "standalone-build-root" | "integrated-p04-build-root";

export interface P10B18CStageBStorageRoot {
  identity: P10B18CStageBStorageRootIdentity;
  path: string;
}

export interface P10B18CStageBFilesystemProbeResult {
  filesystemPath: string;
  availableBytes: number;
}

export type P10B18CStageBFilesystemProbe = (
  requestedPath: string,
) => P10B18CStageBFilesystemProbeResult;

export interface P10B18CStageBStorageEvidenceEntry {
  identity: P10B18CStageBStorageRootIdentity;
  requestedPath: string;
  filesystemPath: string;
  availableBytes: number;
  requiredBytes: number;
  sufficient: boolean;
}

export interface P10B18CStageBStoragePreflightEvidence {
  authority: typeof P10B18C_STAGE_B_STORAGE_AUTHORITY;
  phase: "full-stage-b-prebuild" | "delta-stage-b-precapture";
  requiredBytes: number;
  entries: P10B18CStageBStorageEvidenceEntry[];
  passed: boolean;
}

export interface P10B18CStageBStoragePreflightOptions {
  roots: P10B18CStageBStorageRoot[];
  requiredBytes?: number;
  probe?: P10B18CStageBFilesystemProbe;
  phase?: P10B18CStageBStoragePreflightEvidence["phase"];
}

export interface P10B18CDeltaStageBStorageRequirement {
  changedCaptureCount: number;
  largestBaselineCaptureBytes: number;
  estimatedDeltaBytes: number;
  modeledRequiredBytes: number;
  requiredDeltaFreeBytes: number;
}

function nearestExistingPath(requestedPath: string): string {
  let candidate = resolve(requestedPath);

  while (!existsSync(candidate)) {
    const parent = dirname(candidate);
    if (parent === candidate) {
      throw new Error(
        `P10B-18C Stage B storage root has no existing filesystem ancestor: ${requestedPath}`,
      );
    }
    candidate = parent;
  }

  return candidate;
}

export const probeP10B18CStageBFilesystem: P10B18CStageBFilesystemProbe = (requestedPath) => {
  const filesystemPath = nearestExistingPath(requestedPath);
  const statistics = statfsSync(filesystemPath);

  return {
    filesystemPath,
    availableBytes: Math.floor(statistics.bavail * statistics.bsize),
  };
};

function assertAvailableBytes(value: number, label: string): void {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new Error(
      `P10B-18C Stage B storage preflight received invalid ${label}: ${String(value)}`,
    );
  }
}

export function calculateP10B18CDeltaStageBStorageRequirement(
  input: Readonly<{
    changedCaptureCount: number;
    largestBaselineCaptureBytes: number;
  }>,
): P10B18CDeltaStageBStorageRequirement {
  assertAvailableBytes(input.changedCaptureCount, "changed capture count");
  assertAvailableBytes(input.largestBaselineCaptureBytes, "largest baseline capture byte count");
  const estimatedDeltaBytes = input.changedCaptureCount * input.largestBaselineCaptureBytes;
  const modeledRequiredBytes = estimatedDeltaBytes * 2 + P10B18C_DELTA_STAGE_B_HEADROOM_BYTES;
  assertAvailableBytes(estimatedDeltaBytes, "estimated delta byte count");
  assertAvailableBytes(modeledRequiredBytes, "modeled delta byte count");
  return {
    ...input,
    estimatedDeltaBytes,
    modeledRequiredBytes,
    requiredDeltaFreeBytes: Math.max(
      P10B18C_DELTA_STAGE_B_MINIMUM_AVAILABLE_BYTES,
      modeledRequiredBytes,
    ),
  };
}

export function classifyP10B18CStageBStorageMode(
  input: Readonly<{
    baselineManifestPath?: string;
    baselineHumanReviewPath?: string;
  }>,
): "full" | "delta" {
  if (
    (input.baselineManifestPath === undefined) !==
    (input.baselineHumanReviewPath === undefined)
  ) {
    throw new Error("P10B-18C delta Stage B requires both baseline manifest and review paths.");
  }
  return input.baselineManifestPath === undefined ? "full" : "delta";
}

export function p10b18cStageBStorageRootsFromEnvironment(
  evidenceRoot: string,
  environment: Readonly<Record<string, string | undefined>> = process.env,
): P10B18CStageBStorageRoot[] {
  const standaloneBuildRoot = environment[P10B18C_STANDALONE_BUILD_ROOT_ENV];
  const integratedBuildRoot = environment[P10B18C_INTEGRATED_P04_BUILD_ROOT_ENV];
  if (!standaloneBuildRoot || !integratedBuildRoot) {
    throw new Error("P10B-18C Stage B build-root identity is unavailable.");
  }
  return [
    { identity: "evidence-root", path: evidenceRoot },
    { identity: "standalone-build-root", path: standaloneBuildRoot },
    { identity: "integrated-p04-build-root", path: integratedBuildRoot },
  ];
}

export function evaluateP10B18CStageBFreeSpace(
  options: P10B18CStageBStoragePreflightOptions,
): P10B18CStageBStoragePreflightEvidence {
  const requiredBytes = options.requiredBytes ?? P10B18C_STAGE_B_MINIMUM_AVAILABLE_BYTES;
  const probe = options.probe ?? probeP10B18CStageBFilesystem;

  assertAvailableBytes(requiredBytes, "required byte count");

  const entries = options.roots.map((root) => {
    const result = probe(root.path);
    assertAvailableBytes(result.availableBytes, `available byte count for ${root.identity}`);

    return {
      identity: root.identity,
      requestedPath: resolve(root.path),
      filesystemPath: resolve(result.filesystemPath),
      availableBytes: result.availableBytes,
      requiredBytes,
      sufficient: result.availableBytes >= requiredBytes,
    } satisfies P10B18CStageBStorageEvidenceEntry;
  });

  return {
    authority: P10B18C_STAGE_B_STORAGE_AUTHORITY,
    phase: options.phase ?? "full-stage-b-prebuild",
    requiredBytes,
    entries,
    passed: entries.length > 0 && entries.every((entry) => entry.sufficient),
  };
}

export class P10B18CStageBFreeSpacePreflightError extends Error {
  readonly code = "P10B18C_STAGE_B_INSUFFICIENT_STORAGE";

  constructor(readonly evidence: P10B18CStageBStoragePreflightEvidence) {
    const failures = evidence.entries
      .filter((entry) => !entry.sufficient)
      .map(
        (entry) =>
          `${entry.identity}: filesystem=${entry.filesystemPath}, requested=${entry.requestedPath}, availableBytes=${entry.availableBytes}, requiredBytes=${entry.requiredBytes}`,
      )
      .join("; ");

    const boundary =
      evidence.phase === "delta-stage-b-precapture"
        ? "before delta capture"
        : "before build, server startup, or capture";
    super(
      `P10B-18C Stage B free-space preflight failed ${boundary}: ${failures || "no storage roots were provided"}`,
    );
    this.name = "P10B18CStageBFreeSpacePreflightError";
  }
}

export function assertP10B18CStageBFreeSpace(
  options: P10B18CStageBStoragePreflightOptions,
): P10B18CStageBStoragePreflightEvidence {
  const evidence = evaluateP10B18CStageBFreeSpace(options);
  if (!evidence.passed) {
    throw new P10B18CStageBFreeSpacePreflightError(evidence);
  }
  return evidence;
}

export function runP10B18CStageBAfterFreeSpacePreflight<T>(
  options: P10B18CStageBStoragePreflightOptions,
  beginStageB: (evidence: P10B18CStageBStoragePreflightEvidence) => T,
): T {
  const evidence = assertP10B18CStageBFreeSpace(options);
  return beginStageB(evidence);
}
