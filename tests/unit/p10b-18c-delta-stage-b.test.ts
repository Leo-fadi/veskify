// @vitest-environment node

import { createHash } from "node:crypto";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import { prepareP10B18CDeltaStageB } from "../helpers/p10b-18c-delta-stage-b";

function stringContainingMatcher(value: string): unknown {
  const matcher: unknown = expect.stringContaining(value);
  return matcher;
}
import type { P10B18CCaptureResumeExpectation } from "../helpers/p10b-18c-active-capture-evidence";
import {
  P10B18C_DELTA_STAGE_B_MINIMUM_AVAILABLE_BYTES,
  type P10B18CStageBFilesystemProbe,
  type P10B18CStageBStorageRoot,
} from "../helpers/p10b-18c-free-space-preflight";

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function expectation(
  caseId: string,
  filename: string,
  snapshotFingerprint: string,
): P10B18CCaptureResumeExpectation {
  return {
    identity: {
      caseId,
      semanticStratum: "minimal-product-first",
      surfacePageType: "home",
      expectedRoute: "/",
      expectedUrl: "http://localhost:3141/projects/project/home?locale=fi",
      viewport: { width: 375, height: 900 },
      locale: "fi",
      renderer: "saved-draft-preview",
      runtimeMode: "p03-standalone",
      selectedSnapshotFingerprint: snapshotFingerprint,
      normalizedTopologyFingerprint: "topology-stable",
      logicalFilename: filename,
    },
    canonicalFilename: filename,
    consumedAuthorityFingerprint: "consumed-stable",
  };
}

function capture(
  caseId: string,
  filename: string,
  screenshot: string,
  snapshotFingerprint: string,
) {
  return {
    filename,
    screenshotSha256: sha256(screenshot),
    caseId,
    shapeId: "neutral-true-high-consideration",
    semanticIntent: "minimal-product-first",
    directionId: "warmApproachable",
    designDnaFingerprint: "dna",
    frame: "centered-minimal",
    profiles: {},
    contentSupportEffectiveAnatomy: null,
    utilityAnatomy: null,
    productCardAnatomy: null,
    assetAuthority: null,
    viewport: 375,
    locale: "fi",
    surface: "home",
    route: "/",
    renderer: "saved-draft-preview",
    snapshotFingerprint,
    consumedAuthorityFingerprint: "consumed-stable",
    normalizedTopologyFingerprint: "topology-stable",
    domFingerprint: "dom",
    geometry: {},
    accessibility: {},
    commerceFingerprint: "commerce",
    mediaFingerprint: "media",
  };
}

let baselineDirectory: string;
let evidenceDirectory: string;
let manifestPath: string;
let reviewPath: string;
let storageRoots: P10B18CStageBStorageRoot[];
let storageProbe: P10B18CStageBFilesystemProbe;

beforeEach(async () => {
  baselineDirectory = await mkdtemp(resolve(tmpdir(), "p10b-18c-delta-baseline-"));
  evidenceDirectory = await mkdtemp(resolve(tmpdir(), "p10b-18c-delta-current-"));
  manifestPath = resolve(baselineDirectory, "manifest.json");
  reviewPath = resolve(baselineDirectory, "review.json");
  storageRoots = [
    { identity: "evidence-root", path: evidenceDirectory },
    { identity: "standalone-build-root", path: baselineDirectory },
    { identity: "integrated-p04-build-root", path: baselineDirectory },
  ];
  storageProbe = (requestedPath) => ({
    filesystemPath: requestedPath,
    availableBytes: P10B18C_DELTA_STAGE_B_MINIMUM_AVAILABLE_BYTES,
  });
});

async function fixture() {
  const unchangedImage = "unchanged-image";
  const changedImage = "changed-image";
  const captures = [
    capture("case-unchanged", "unchanged.png", unchangedImage, "snapshot-unchanged"),
    capture("case-unchanged-2", "unchanged-2.png", unchangedImage, "snapshot-unchanged-2"),
    capture("case-unchanged-3", "unchanged-3.png", unchangedImage, "snapshot-unchanged-3"),
    capture("case-changed", "changed.png", changedImage, "snapshot-before"),
  ];
  await Promise.all([
    writeFile(resolve(baselineDirectory, "unchanged.png"), unchangedImage),
    writeFile(resolve(baselineDirectory, "unchanged-2.png"), unchangedImage),
    writeFile(resolve(baselineDirectory, "unchanged-3.png"), unchangedImage),
    writeFile(resolve(baselineDirectory, "changed.png"), changedImage),
    writeFile(manifestPath, JSON.stringify({ captureCount: 4, captures })),
    writeFile(
      reviewPath,
      JSON.stringify({
        result: "FAIL",
        reviewCoverage: {
          totalCaptureCount: 4,
          exactHashBoundPriorVerdictCount: 3,
          directlyInspectedChangedCaptureCount: 1,
          unreviewedCaptureCount: 0,
        },
      }),
    ),
  ]);
  const capturePlan = [
    expectation("case-unchanged", "unchanged.png", "snapshot-unchanged"),
    expectation("case-unchanged-2", "unchanged-2.png", "snapshot-unchanged-2"),
    expectation("case-unchanged-3", "unchanged-3.png", "snapshot-unchanged-3"),
    expectation("case-changed", "changed.png", "snapshot-after"),
  ];
  return { captures, capturePlan };
}

describe("P10B-18C delta Stage B integrity", () => {
  it("carries only authority-identical hash-bound captures and regenerates whole changed cases", async () => {
    const { capturePlan } = await fixture();
    const result = await prepareP10B18CDeltaStageB({
      baselineManifestPath: manifestPath,
      baselineHumanReviewPath: reviewPath,
      evidenceDirectory,
      capturePlan,
      storageRoots,
      storageProbe,
    });
    expect(result.changedCaseIds).toEqual(["case-changed"]);
    expect(result.carriedCaptureCount).toBe(3);
    expect(result.regeneratedCaptureCount).toBe(1);
    expect(result.carriedCapturesByFilename.has("unchanged.png")).toBe(true);
    expect(result.carriedCapturesByFilename.has("changed.png")).toBe(false);
    expect(result.storageRequirement).toMatchObject({
      changedCaptureCount: 1,
      requiredDeltaFreeBytes: P10B18C_DELTA_STAGE_B_MINIMUM_AVAILABLE_BYTES,
    });
    expect(result.storageEvidence.phase).toBe("delta-stage-b-precapture");
    expect(await readFile(resolve(evidenceDirectory, "unchanged.png"), "utf8")).toBe(
      "unchanged-image",
    );
  });

  it("fails closed when a carried screenshot hash does not match", async () => {
    const { capturePlan } = await fixture();
    await writeFile(resolve(baselineDirectory, "unchanged.png"), "tampered");
    await expect(
      prepareP10B18CDeltaStageB({
        baselineManifestPath: manifestPath,
        baselineHumanReviewPath: reviewPath,
        evidenceDirectory,
        capturePlan,
        storageRoots,
        storageProbe,
      }),
    ).rejects.toMatchObject({
      code: "p10b-18c-delta-stage-b-integrity",
      reason: stringContainingMatcher("hash mismatch"),
    });
  });

  it("fails closed when route or capture identity changes", async () => {
    const { capturePlan } = await fixture();
    const changedIdentity = capturePlan.map((entry, index) =>
      index === 0 ? { ...entry, identity: { ...entry.identity, expectedRoute: "/other" } } : entry,
    );
    await expect(
      prepareP10B18CDeltaStageB({
        baselineManifestPath: manifestPath,
        baselineHumanReviewPath: reviewPath,
        evidenceDirectory,
        capturePlan: changedIdentity,
        storageRoots,
        storageProbe,
      }),
    ).rejects.toMatchObject({ reason: stringContainingMatcher("changed capture identity") });
  });

  it("fails closed when the retained human review is incomplete", async () => {
    const { capturePlan } = await fixture();
    await writeFile(
      reviewPath,
      JSON.stringify({
        result: "FAIL",
        reviewCoverage: {
          totalCaptureCount: 4,
          exactHashBoundPriorVerdictCount: 3,
          directlyInspectedChangedCaptureCount: 0,
          unreviewedCaptureCount: 1,
        },
      }),
    );
    await expect(
      prepareP10B18CDeltaStageB({
        baselineManifestPath: manifestPath,
        baselineHumanReviewPath: reviewPath,
        evidenceDirectory,
        capturePlan,
        storageRoots,
        storageProbe,
      }),
    ).rejects.toMatchObject({ reason: "baseline human review is not completely hash-bound" });
  });

  it("fails before copying retained evidence when the measured delta reserve is unavailable", async () => {
    const { capturePlan } = await fixture();
    await expect(
      prepareP10B18CDeltaStageB({
        baselineManifestPath: manifestPath,
        baselineHumanReviewPath: reviewPath,
        evidenceDirectory,
        capturePlan,
        storageRoots,
        storageProbe: (requestedPath) => ({
          filesystemPath: requestedPath,
          availableBytes: P10B18C_DELTA_STAGE_B_MINIMUM_AVAILABLE_BYTES - 1,
        }),
      }),
    ).rejects.toMatchObject({
      code: "P10B18C_STAGE_B_INSUFFICIENT_STORAGE",
      evidence: {
        phase: "delta-stage-b-precapture",
        requiredBytes: P10B18C_DELTA_STAGE_B_MINIMUM_AVAILABLE_BYTES,
        passed: false,
      },
    });
  });
});
