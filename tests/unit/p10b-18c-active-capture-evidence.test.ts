import { createHash } from "node:crypto";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  P10B18CActiveCaptureEvidence,
  P10B18CCaptureEventAttribution,
  type P10B18CCaptureIdentity,
  type P10B18CCaptureIdentityInput,
  type P10B18CCaptureResumeExpectation,
} from "../helpers/p10b-18c-active-capture-evidence";
import { canonicalP10BEvidenceFilename } from "../helpers/p10b-evidence-filename";

const expectedUrl = "http://localhost:3141/projects/project-case-a?locale=en";
const identityInput: P10B18CCaptureIdentityInput = {
  caseId: "case-a",
  semanticStratum: "modern-comparison",
  surfacePageType: "home",
  expectedRoute: "/",
  expectedUrl,
  viewport: { width: 375, height: 900 },
  locale: "en",
  renderer: "saved-draft-preview",
  runtimeMode: "p04-integrated-mock",
  selectedSnapshotFingerprint: "snapshot-fingerprint-a",
  normalizedTopologyFingerprint: "topology-fingerprint-a",
  logicalFilename: "capture-a.png",
};

const noEvents = {
  pageErrors: [] as const,
  consoleErrors: [] as const,
  requestFailures: [] as const,
  failedResponseStatuses: [] as const,
};

let directory = "";
let evidence: P10B18CActiveCaptureEvidence;

async function json(path: string): Promise<unknown> {
  return JSON.parse(await readFile(path, "utf8")) as unknown;
}

function anyStringMatcher(): unknown {
  const matcher: unknown = expect.any(String);
  return matcher;
}

async function transitionToCaptureStarted(identity: P10B18CCaptureIdentity): Promise<void> {
  for (const state of [
    "navigation-started",
    "response-received",
    "storefront-ready",
    "capture-started",
  ] as const) {
    await evidence.transitionCapture(identity, {
      state,
      expectedUrl,
      actualUrl: expectedUrl,
      httpStatus: state === "navigation-started" ? null : 200,
    });
  }
}

function failureInput(identity: P10B18CCaptureIdentity) {
  return {
    identity,
    expectedUrl,
    actualUrl: expectedUrl,
    actualCapturePath: null,
    httpStatus: 200,
    documentTitle: "Storefront failure",
    errorBoundaryHeading: "This page couldn’t load",
    errorBoundaryBody: "This page couldn’t load Reload to try again, or go back.",
    captureEvents: noEvents,
    setupEvents: noEvents,
    screenshotPath: "failure-a.png",
    error: "Runtime boundary rendered",
  };
}

beforeEach(async () => {
  directory = await mkdtemp(resolve(tmpdir(), "p10b-18c-active-capture-"));
  evidence = new P10B18CActiveCaptureEvidence(directory);
});

afterEach(async () => {
  await rm(directory, { recursive: true, force: true });
});

describe("P10B-18C active capture evidence", () => {
  it("normalizes the exact long first-capture logical filename deterministically", () => {
    const logical =
      "canonical-product-media-rich-presentation-asset-poor--modern-catalogue-dense-moderntechnical-canonical-product-media-rich-presentation-asset-poor-home-375px.png";
    const expected =
      "canonical-product-media-rich-presentation-asset-poor-modern-catalogue-dense-moderntechnical-canonical-product-media-rich-presentation-ass-62cdb427a9d2.png";
    expect(canonicalP10BEvidenceFilename(logical)).toBe(expected);
    expect(canonicalP10BEvidenceFilename(logical)).toBe(expected);
  });

  it("persists logical, canonical, and expected-path identity before navigation", async () => {
    const identity = await evidence.planCapture(identityInput);
    expect(await json(evidence.activeCapturePath())).toMatchObject({
      activeCapture: {
        lifecycle: {
          currentStage: "planned",
          reachedStages: [{ state: "planned", timestamp: anyStringMatcher() }],
        },
        identity: {
          sequenceIndex: 1,
          logicalFilename: "capture-a.png",
          canonicalFilename: "capture-a.png",
          expectedPath: "capture-a.png",
        },
      },
    });
    expect(identity.sequenceIndex).toBe(1);
  });

  it("uses the same canonical filename for writer and manifest completion", async () => {
    const identity = await evidence.planCapture(identityInput);
    await transitionToCaptureStarted(identity);
    await writeFile(resolve(directory, identity.expectedPath), "capture-image");
    await evidence.completeCapture(identity, {
      filename: identity.canonicalFilename,
      manifestAuthority: "persisted",
    });
    expect(await json(evidence.captureProgressPath())).toMatchObject({
      completedCaptureCount: 1,
      entries: [
        {
          identity: { canonicalFilename: "capture-a.png", expectedPath: "capture-a.png" },
          manifestEntry: { filename: "capture-a.png", manifestAuthority: "persisted" },
        },
      ],
    });
  });

  it("completes the exact first capture only after screenshot and manifest durability", async () => {
    const identity = await evidence.planCapture(identityInput);
    await transitionToCaptureStarted(identity);
    await writeFile(resolve(directory, identity.expectedPath), "capture-image");
    await evidence.completeCapture(identity, { filename: identity.canonicalFilename });
    expect(await json(evidence.activeCapturePath())).toMatchObject({
      activeCapture: null,
      lastCompletedCapture: {
        identity: { identityFingerprint: identity.identityFingerprint, sequenceIndex: 1 },
        lifecycle: {
          currentStage: "capture-complete",
          reachedStages: [
            { state: "planned", timestamp: anyStringMatcher() },
            { state: "navigation-started", timestamp: anyStringMatcher() },
            { state: "response-received", timestamp: anyStringMatcher() },
            { state: "storefront-ready", timestamp: anyStringMatcher() },
            { state: "capture-started", timestamp: anyStringMatcher() },
            { state: "capture-complete", timestamp: anyStringMatcher() },
          ],
        },
        persistence: {
          actualPath: "capture-a.png",
          screenshotWrittenAt: anyStringMatcher(),
          manifestPersistedAt: anyStringMatcher(),
        },
      },
    });
  });

  it("retains screenshot-written facts when manifest persistence fails", async () => {
    const identity = await evidence.planCapture(identityInput);
    await transitionToCaptureStarted(identity);
    await writeFile(resolve(directory, identity.expectedPath), "capture-image");
    await mkdir(evidence.captureProgressPath());
    await expect(
      evidence.completeCapture(identity, { filename: identity.canonicalFilename }),
    ).rejects.toThrow();
    await evidence.persistFailureEvidence({
      ...failureInput(identity),
      actualCapturePath: identity.canonicalFilename,
      error: "Manifest persistence failed",
    });
    expect(await json(evidence.failurePath(identity))).toMatchObject({
      lifecycle: {
        currentStage: "capture-started",
        navigationReached: true,
        storefrontRenderingReached: true,
        screenshotWritingBegan: true,
        screenshotWritingCompleted: true,
        manifestPersistenceCompleted: false,
      },
      actualCapturePath: "capture-a.png",
    });
  });

  it("fails closed when the writer returns a genuinely different path", async () => {
    const identity = await evidence.planCapture(identityInput);
    await transitionToCaptureStarted(identity);
    await writeFile(resolve(directory, "different.png"), "capture-image");
    await expect(evidence.completeCapture(identity, { filename: "different.png" })).rejects.toThrow(
      "filename does not match",
    );
  });

  it("keeps setup aborts retained and outside capture-one blocking evidence", async () => {
    const identity = await evidence.planCapture(identityInput);
    await transitionToCaptureStarted(identity);
    const setupEvents = {
      ...noEvents,
      requestFailures: [
        {
          eventSequence: 3,
          method: "GET",
          url: "http://localhost:3141/projects/setup",
          failure: "net::ERR_ABORTED",
          duringExpectedNavigation: false,
        },
      ],
    };
    await evidence.persistSetupEventLedger(identity, setupEvents, 7);
    await evidence.persistFailureEvidence({ ...failureInput(identity), setupEvents });
    expect(await json(evidence.setupEventLedgerPath())).toMatchObject({
      entries: [
        { captureSequenceIndex: 1, events: { requestFailures: [{ pathname: "/projects/setup" }] } },
      ],
    });
    expect(await json(evidence.failurePath(identity))).toMatchObject({
      setupEventLedger: { requestFailures: [{ pathname: "/projects/setup" }] },
      captureEventLedger: { requestFailures: [], blockingRuntimeFailures: [] },
    });
  });

  it("does not leak previous or following request events into an active interval", () => {
    const attribution = new P10B18CCaptureEventAttribution();
    const previousRequest = {};
    attribution.requestStarted(previousRequest);
    expect(attribution.beginCapture()).toBe(1);
    const activeRequest = {};
    attribution.requestStarted(activeRequest);
    expect(attribution.eventScope(previousRequest).scope).toBe("setup");
    expect(attribution.eventScope(activeRequest).scope).toBe("capture");
    attribution.finishCapture();
    const followingRequest = {};
    attribution.requestStarted(followingRequest);
    expect(attribution.eventScope(followingRequest).scope).toBe("setup");
  });

  it("reports navigation and rendering ready after capture-started", async () => {
    const identity = await evidence.planCapture(identityInput);
    await transitionToCaptureStarted(identity);
    await evidence.persistFailureEvidence(failureInput(identity));
    expect(await json(evidence.failurePath(identity))).toMatchObject({
      lifecycle: {
        currentStage: "capture-started",
        navigationReached: true,
        storefrontRenderingReached: true,
        screenshotWritingBegan: true,
      },
      blockingRuntimeFailures: [],
    });
  });

  it("links visible error-boundary text and screenshot to the active identity", async () => {
    const identity = await evidence.planCapture(identityInput);
    await evidence.transitionCapture(identity, {
      state: "navigation-started",
      expectedUrl,
      actualUrl: "about:blank",
      httpStatus: null,
    });
    await evidence.persistFailureEvidence(failureInput(identity));
    expect(await json(evidence.failurePath(identity))).toMatchObject({
      activeCaptureIdentity: { identityFingerprint: identity.identityFingerprint },
      errorBoundaryHeading: "This page couldn’t load",
      screenshotPath: "failure-a.png",
    });
  });

  it("retains the exact failed identity and never advances to another store", async () => {
    const active = await evidence.planCapture(identityInput);
    await expect(
      evidence.planCapture({
        ...identityInput,
        caseId: "case-b",
        logicalFilename: "capture-b.png",
      }),
    ).rejects.toThrow("is still active");
    const wrongIdentity: P10B18CCaptureIdentity = {
      ...active,
      caseId: "case-b",
      identityFingerprint: "p10b18c-active-wrong-identity",
    };
    await expect(evidence.persistFailureEvidence(failureInput(wrongIdentity))).rejects.toThrow(
      "does not match the active capture identity",
    );
  });

  it("redacts sensitive values from identity and scoped event evidence", async () => {
    const secret = "abcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdef";
    const identity = await evidence.planCapture({
      ...identityInput,
      expectedUrl: `${expectedUrl}&token=${secret}`,
    });
    await evidence.transitionCapture(identity, {
      state: "navigation-started",
      expectedUrl,
      actualUrl: expectedUrl,
      httpStatus: null,
    });
    await evidence.persistFailureEvidence({
      ...failureInput(identity),
      captureEvents: {
        ...noEvents,
        pageErrors: [{ eventSequence: 1, message: `token=${secret}` }],
      },
      error: `authorization=${secret}`,
    });
    const serialized = await readFile(evidence.failurePath(identity), "utf8");
    expect(serialized).not.toContain(secret);
    expect(serialized).toContain("<redacted>");
  });

  it("audits durable captures before clearing the failed identity and resuming", async () => {
    const manifestEntries: Array<Readonly<Record<string, unknown>>> = [];
    const expectations: P10B18CCaptureResumeExpectation[] = [];
    for (const suffix of ["a", "b"] as const) {
      const input = {
        ...identityInput,
        caseId: `case-${suffix}`,
        logicalFilename: `capture-${suffix}.png`,
      };
      const identity = await evidence.planCapture(input);
      await transitionToCaptureStarted(identity);
      const screenshot = Buffer.from(`capture-image-${suffix}`);
      await writeFile(resolve(directory, identity.expectedPath), screenshot);
      const manifestEntry = {
        filename: identity.canonicalFilename,
        screenshotSha256: createHash("sha256").update(screenshot).digest("hex"),
        caseId: input.caseId,
        surface: input.surfacePageType,
        route: input.expectedRoute,
        viewport: input.viewport.width,
        locale: input.locale,
        renderer: input.renderer,
        snapshotFingerprint: input.selectedSnapshotFingerprint,
        consumedAuthorityFingerprint: `authority-${suffix}`,
        normalizedTopologyFingerprint: input.normalizedTopologyFingerprint,
      };
      await evidence.completeCapture(identity, manifestEntry, {
        blockingRuntimeFailures: [],
        nonDeferredBlockingRuntimeFailures: [],
        pageErrors: [],
        consoleErrors: [],
        failedResponseStatuses: [],
      });
      manifestEntries.push(manifestEntry);
      expectations.push({
        identity: input,
        canonicalFilename: identity.canonicalFilename,
        consumedAuthorityFingerprint: `authority-${suffix}`,
      });
    }
    const failedInput = {
      ...identityInput,
      caseId: "case-c",
      logicalFilename: "capture-c.png",
    };
    const failedIdentity = await evidence.planCapture(failedInput);
    await transitionToCaptureStarted(failedIdentity);
    await writeFile(resolve(directory, failedIdentity.expectedPath), "failed-capture");
    const durableProgress = await readFile(evidence.captureProgressPath(), "utf8");
    await rm(evidence.captureProgressPath());
    await mkdir(evidence.captureProgressPath());
    await expect(
      evidence.completeCapture(failedIdentity, { filename: failedIdentity.canonicalFilename }),
    ).rejects.toThrow();
    await rm(evidence.captureProgressPath(), { recursive: true });
    await writeFile(evidence.captureProgressPath(), durableProgress, "utf8");
    await writeFile(resolve(directory, "failure-a.png"), "failed-capture");
    await evidence.persistFailureEvidence({
      ...failureInput(failedIdentity),
      actualCapturePath: failedIdentity.canonicalFilename,
    });

    const audit = await evidence.auditAndPrepareResume({
      expectedCompletedCaptureCount: 2,
      expectedEntries: expectations,
      expectedNextEntry: {
        identity: failedInput,
        canonicalFilename: failedIdentity.canonicalFilename,
        consumedAuthorityFingerprint: "authority-c",
      },
    });
    expect(audit.completedCaptureCount).toBe(2);
    expect(audit.manifestEntries).toEqual(manifestEntries);
    expect(await json(audit.auditPath)).toMatchObject({
      verdict: "pass",
      completedCaptureCount: 2,
      nextCaptureSequenceIndex: 3,
      auditedEntries: [
        { sequenceIndex: 1, lifecycleProof: "persisted-capture-complete-lifecycle" },
        { sequenceIndex: 2, lifecycleProof: "persisted-capture-complete-lifecycle" },
      ],
    });
    expect(await json(evidence.activeCapturePath())).toMatchObject({
      activeCapture: null,
      resume: { completedCaptureCount: 2, nextCaptureSequenceIndex: 3 },
    });
    expect((await evidence.planCapture(failedInput)).sequenceIndex).toBe(3);
  });

  it("fails resume integrity without clearing the failed identity when a screenshot hash differs", async () => {
    const identity = await evidence.planCapture(identityInput);
    await transitionToCaptureStarted(identity);
    const screenshot = Buffer.from("capture-image");
    await writeFile(resolve(directory, identity.expectedPath), screenshot);
    await evidence.completeCapture(
      identity,
      {
        filename: identity.canonicalFilename,
        screenshotSha256: createHash("sha256").update(screenshot).digest("hex"),
        caseId: identityInput.caseId,
        surface: identityInput.surfacePageType,
        route: identityInput.expectedRoute,
        viewport: identityInput.viewport.width,
        locale: identityInput.locale,
        renderer: identityInput.renderer,
        snapshotFingerprint: identityInput.selectedSnapshotFingerprint,
        consumedAuthorityFingerprint: "authority-a",
        normalizedTopologyFingerprint: identityInput.normalizedTopologyFingerprint,
      },
      {
        blockingRuntimeFailures: [],
        nonDeferredBlockingRuntimeFailures: [],
        pageErrors: [],
        consoleErrors: [],
        failedResponseStatuses: [],
      },
    );
    await writeFile(resolve(directory, identity.expectedPath), "tampered-image");
    const failedInput = { ...identityInput, caseId: "case-b", logicalFilename: "capture-b.png" };
    const failedIdentity = await evidence.planCapture(failedInput);
    await transitionToCaptureStarted(failedIdentity);
    await writeFile(resolve(directory, "failure-a.png"), "failed-capture");
    await evidence.persistFailureEvidence(failureInput(failedIdentity));

    await expect(
      evidence.auditAndPrepareResume({
        expectedCompletedCaptureCount: 1,
        expectedEntries: [
          {
            identity: identityInput,
            canonicalFilename: identity.canonicalFilename,
            consumedAuthorityFingerprint: "authority-a",
          },
        ],
        expectedNextEntry: {
          identity: failedInput,
          canonicalFilename: failedIdentity.canonicalFilename,
          consumedAuthorityFingerprint: "authority-b",
        },
      }),
    ).rejects.toThrow("screenshotSha256");
    expect(await json(evidence.activeCapturePath())).toMatchObject({
      activeCapture: { identity: { identityFingerprint: failedIdentity.identityFingerprint } },
    });
  });
});
