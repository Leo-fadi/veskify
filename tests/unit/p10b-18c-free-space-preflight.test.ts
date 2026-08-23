import { existsSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import {
  calculateP10B18CDeltaStageBStorageRequirement,
  classifyP10B18CStageBStorageMode,
  evaluateP10B18CStageBFreeSpace,
  P10B18C_DELTA_STAGE_B_MINIMUM_AVAILABLE_BYTES,
  P10B18C_STAGE_B_MINIMUM_AVAILABLE_BYTES,
  P10B18C_STAGE_B_STORAGE_AUTHORITY,
  P10B18CStageBFreeSpacePreflightError,
  runP10B18CStageBAfterFreeSpacePreflight,
  type P10B18CStageBFilesystemProbe,
  type P10B18CStageBStorageRoot,
} from "../helpers/p10b-18c-free-space-preflight";

const roots: P10B18CStageBStorageRoot[] = [
  { identity: "evidence-root", path: "/acceptance/evidence" },
  { identity: "standalone-build-root", path: "/acceptance/standalone" },
  { identity: "integrated-p04-build-root", path: "/acceptance/p04" },
];

function probeWithAvailableBytes(availableBytes: number): P10B18CStageBFilesystemProbe {
  return vi.fn((requestedPath: string) => ({
    filesystemPath: `/filesystem${requestedPath}`,
    availableBytes,
  }));
}

describe("P10B-18C Stage B free-space preflight", () => {
  it("passes all acceptance roots when injected filesystem space is sufficient", () => {
    const probe = probeWithAvailableBytes(P10B18C_STAGE_B_MINIMUM_AVAILABLE_BYTES + 1);

    const evidence = evaluateP10B18CStageBFreeSpace({ roots, probe });

    expect(evidence.passed).toBe(true);
    expect(evidence.entries).toHaveLength(3);
    expect(evidence.entries.map((entry) => entry.identity)).toEqual([
      "evidence-root",
      "standalone-build-root",
      "integrated-p04-build-root",
    ]);
    expect(probe).toHaveBeenCalledTimes(3);
  });

  it("fails closed before Stage B begins when any root is insufficient", () => {
    const beginStageB = vi.fn();
    const probe: P10B18CStageBFilesystemProbe = vi.fn((requestedPath: string) => ({
      filesystemPath: `/filesystem${requestedPath}`,
      availableBytes: requestedPath.endsWith("/p04")
        ? P10B18C_STAGE_B_MINIMUM_AVAILABLE_BYTES - 1
        : P10B18C_STAGE_B_MINIMUM_AVAILABLE_BYTES + 1,
    }));

    expect(() => {
      runP10B18CStageBAfterFreeSpacePreflight({ roots, probe }, beginStageB);
    }).toThrow(P10B18CStageBFreeSpacePreflightError);
    expect(beginStageB).not.toHaveBeenCalled();

    try {
      runP10B18CStageBAfterFreeSpacePreflight({ roots, probe }, beginStageB);
    } catch (error) {
      expect(error).toBeInstanceOf(P10B18CStageBFreeSpacePreflightError);
      expect(
        (error as P10B18CStageBFreeSpacePreflightError).evidence.entries.find(
          (entry) => entry.identity === "integrated-p04-build-root",
        ),
      ).toMatchObject({
        availableBytes: P10B18C_STAGE_B_MINIMUM_AVAILABLE_BYTES - 1,
        requiredBytes: P10B18C_STAGE_B_MINIMUM_AVAILABLE_BYTES,
        sufficient: false,
      });
    }
  });

  it("passes deterministically at exactly the documented threshold", () => {
    const probe = probeWithAvailableBytes(P10B18C_STAGE_B_MINIMUM_AVAILABLE_BYTES);

    const first = evaluateP10B18CStageBFreeSpace({ roots, probe });
    const second = evaluateP10B18CStageBFreeSpace({ roots, probe });

    expect(first).toEqual(second);
    expect(first.passed).toBe(true);
    expect(first.entries.every((entry) => entry.sufficient)).toBe(true);
  });

  it("applies the unchanged full-run reserve at the post-build pre-capture boundary", () => {
    const evidence = evaluateP10B18CStageBFreeSpace({
      roots,
      phase: "full-stage-b-precapture",
      probe: probeWithAvailableBytes(P10B18C_STAGE_B_MINIMUM_AVAILABLE_BYTES),
    });

    expect(evidence).toMatchObject({
      phase: "full-stage-b-precapture",
      requiredBytes: P10B18C_STAGE_B_MINIMUM_AVAILABLE_BYTES,
      passed: true,
    });
  });

  it("identifies the gate as acceptance-harness authority only", () => {
    const evidence = evaluateP10B18CStageBFreeSpace({
      roots,
      probe: probeWithAvailableBytes(P10B18C_STAGE_B_MINIMUM_AVAILABLE_BYTES),
    });

    expect(evidence.authority).toBe(P10B18C_STAGE_B_STORAGE_AUTHORITY);
    expect(evidence.authority).toBe("p10b-18c-stage-b-acceptance-harness");
  });

  it("preserves the full-run gate and calculates the bounded delta reserve", () => {
    expect(P10B18C_STAGE_B_MINIMUM_AVAILABLE_BYTES).toBe(20 * 1024 ** 3);
    expect(classifyP10B18CStageBStorageMode({})).toBe("full");
    expect(
      classifyP10B18CStageBStorageMode({
        baselineManifestPath: "/baseline/manifest.json",
        baselineHumanReviewPath: "/baseline/review.json",
      }),
    ).toBe("delta");
    expect(() =>
      classifyP10B18CStageBStorageMode({
        baselineManifestPath: "/baseline/manifest.json",
      }),
    ).toThrow(/requires both baseline manifest and review paths/);

    expect(
      calculateP10B18CDeltaStageBStorageRequirement({
        changedCaptureCount: 12,
        largestBaselineCaptureBytes: 426_056,
      }),
    ).toEqual({
      changedCaptureCount: 12,
      largestBaselineCaptureBytes: 426_056,
      estimatedDeltaBytes: 5_112_672,
      modeledRequiredBytes: 1_083_967_168,
      requiredDeltaFreeBytes: P10B18C_DELTA_STAGE_B_MINIMUM_AVAILABLE_BYTES,
    });
  });

  it("creates no screenshot or manifest when the preflight fails", () => {
    const outputRoot = mkdtempSync(join(tmpdir(), "p10b18c-storage-test-"));
    const screenshot = join(outputRoot, "capture.png");
    const manifest = join(outputRoot, "manifest.json");

    try {
      expect(() =>
        runP10B18CStageBAfterFreeSpacePreflight(
          {
            roots,
            probe: probeWithAvailableBytes(P10B18C_STAGE_B_MINIMUM_AVAILABLE_BYTES - 1),
          },
          () => {
            writeFileSync(screenshot, "not reached");
            writeFileSync(manifest, "not reached");
          },
        ),
      ).toThrow(P10B18CStageBFreeSpacePreflightError);

      expect(existsSync(screenshot)).toBe(false);
      expect(existsSync(manifest)).toBe(false);
    } finally {
      rmSync(outputRoot, { recursive: true, force: true });
    }
  });
});
