import { createHash } from "node:crypto";
import { mkdir, readFile, rename, stat, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import type { Page, Request, Response } from "@playwright/test";
import { canonicalValueFingerprint } from "@/domain/storefront";
import { canonicalP10BEvidenceFilename } from "./p10b-evidence-filename";
import {
  classifyP10B18CRequestLedger,
  sanitizeP10B18CRequestFailure,
  type P10B18CFailedRequest,
  type P10B18CFailedRequestMetadata,
  type P10B18CSanitizedRequestFailure,
} from "./p10b-18c-request-ledger";
import {
  P10B18CPresentationImageProbe,
  type P10B18CPresentationImageAuthority,
  type P10B18CPresentationImageEvidence,
} from "./p10b-18c-presentation-image-evidence";

export const p10b18cCaptureLifecycleStates = [
  "planned",
  "navigation-started",
  "response-received",
  "storefront-ready",
  "capture-started",
  "capture-complete",
] as const;
export type P10B18CCaptureLifecycleState = (typeof p10b18cCaptureLifecycleStates)[number];

export type P10B18CCaptureIdentityInput = Readonly<{
  caseId: string;
  semanticStratum: string;
  surfacePageType: string;
  expectedRoute: string;
  expectedUrl: string;
  viewport: Readonly<{ width: number; height: number }>;
  locale: "en" | "fi";
  renderer: string;
  runtimeMode: string;
  selectedSnapshotFingerprint: string;
  normalizedTopologyFingerprint: string;
  logicalFilename: string;
}>;

export type P10B18CCaptureIdentity = P10B18CCaptureIdentityInput &
  Readonly<{
    canonicalFilename: string;
    expectedPath: string;
    sequenceIndex: number;
    identityFingerprint: string;
  }>;

export type P10B18CCaptureResumeExpectation = Readonly<{
  identity: P10B18CCaptureIdentityInput;
  canonicalFilename: string;
  consumedAuthorityFingerprint: string;
}>;

export type P10B18CCaptureResumeAudit = Readonly<{
  completedCaptureCount: number;
  manifestEntries: readonly unknown[];
  auditPath: string;
  evidenceFingerprint: string;
}>;

export type P10B18CCaptureLifecycleTransition = Readonly<{
  state: Exclude<P10B18CCaptureLifecycleState, "planned" | "capture-complete">;
  expectedUrl: string;
  actualUrl: string;
  httpStatus: number | null;
}>;

type P10B18CPersistedCaptureLifecycleTransition = Omit<P10B18CCaptureLifecycleTransition, "state"> &
  Readonly<{ state: Exclude<P10B18CCaptureLifecycleState, "planned"> }>;

type LifecycleEntry = Readonly<{
  state: P10B18CCaptureLifecycleState;
  timestamp: string;
}>;

type CapturePersistence = Readonly<{
  actualPath: string | null;
  screenshotWrittenAt: string | null;
  manifestPersistedAt: string | null;
}>;

type ActiveCaptureRecord = Readonly<{
  identity: P10B18CCaptureIdentity;
  lifecycle: Readonly<{
    currentStage: P10B18CCaptureLifecycleState;
    reachedStages: readonly LifecycleEntry[];
  }>;
  expectedUrl: string;
  actualUrl: string | null;
  httpStatus: number | null;
  eventLedgerBoundarySequence: number | null;
  persistence: CapturePersistence;
}>;

type SequencedMessage = Readonly<{ eventSequence: number; message: string }>;
type SanitizedResponseFailure = Readonly<{
  eventSequence: number;
  status: number;
  origin: string;
  pathname: string;
}>;
type RuntimeEvents = Readonly<{
  pageErrors: readonly SequencedMessage[];
  consoleErrors: readonly SequencedMessage[];
  requestFailures: readonly P10B18CFailedRequest[];
  failedResponseStatuses: readonly SanitizedResponseFailure[];
}>;

const ACTIVE_CAPTURE_FILENAME = "p10b-18c-active-capture.json";
const CAPTURE_PROGRESS_FILENAME = "p10b-18c-capture-progress-manifest.json";
const SETUP_EVENT_LEDGER_FILENAME = "p10b-18c-harness-setup-event-ledger.json";
const RESUME_INTEGRITY_AUDIT_FILENAME = "p10b-18c-capture-resume-integrity-audit.json";
const DURABLE_PROGRESS_COMPLETION_CONTRACT =
  "p10b-18c-durable-progress-entry-after-capture-complete-v1";

function bounded(value: string, maximum = 500): string {
  return value.replace(/\s+/gu, " ").trim().slice(0, maximum);
}

export function sanitizeP10B18CDiagnosticText(value: string): string {
  return bounded(value, 500)
    .replace(/\b[a-f\d]{32,}\b/giu, "<redacted>")
    .replace(/\b(token|secret|authorization|api[-_]?key)\s*[:=]\s*[^\s,;]+/giu, "$1=<redacted>");
}

export function sanitizeP10B18CDiagnosticUrl(value: string): string {
  const url = new URL(value);
  url.hash = "";
  for (const key of [...url.searchParams.keys()]) {
    if (/token|secret|authorization|api[-_]?key/iu.test(key)) {
      url.searchParams.set(key, "<redacted>");
    }
  }
  return url.toString();
}

function sanitizedRequest(request: P10B18CFailedRequest): P10B18CSanitizedRequestFailure {
  return sanitizeP10B18CRequestFailure(request);
}

type RequestStartMetadata = Readonly<{
  eventSequence: number;
  timestamp: string;
  lifecycleStage: P10B18CCaptureLifecycleState;
  duringExpectedNavigation: boolean;
}>;

function redirectChainCount(request: Request): number {
  let count = 0;
  let previous = request.redirectedFrom();
  while (previous) {
    count += 1;
    previous = previous.redirectedFrom();
  }
  return count;
}

function headerEvidence(value: string | undefined, alwaysFingerprint = false) {
  if (value === undefined) return { present: false } as const;
  if (alwaysFingerprint || value.length > 120) {
    return {
      present: true,
      fingerprint: `p10b18c-framework-header-${canonicalValueFingerprint(value)}`,
    } as const;
  }
  return { present: true, value: bounded(value, 120) } as const;
}

function nextUrlEvidence(value: string | undefined, baseUrl: string) {
  if (value === undefined) return { present: false } as const;
  try {
    const url = new URL(value, baseUrl);
    return {
      present: true,
      value: `${url.pathname}${
        [...new Set(url.searchParams.keys())].length > 0
          ? `?query-keys=${[...new Set(url.searchParams.keys())].sort().join(",")}`
          : ""
      }`,
    } as const;
  } catch {
    return headerEvidence(value, true);
  }
}

async function destinationMatchesRenderedLink(page: Page, requestUrl: string): Promise<boolean> {
  return page
    .locator("a[href]")
    .evaluateAll((links, target) => {
      const requested = new URL(target);
      return links.some((link) => {
        const href = link.getAttribute("href");
        if (!href) return false;
        const destination = new URL(href, document.baseURI);
        return (
          destination.origin === requested.origin && destination.pathname === requested.pathname
        );
      });
    }, requestUrl)
    .catch(() => false);
}

async function atomicJson(path: string, value: unknown): Promise<void> {
  await mkdir(resolve(path, ".."), { recursive: true });
  const temporaryPath = `${path}.tmp`;
  await writeFile(temporaryPath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  await rename(temporaryPath, path);
}

async function readJson(path: string): Promise<unknown> {
  try {
    return JSON.parse(await readFile(path, "utf8")) as unknown;
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") return null;
    throw error;
  }
}

function evidenceRecord(value: unknown, path: string): Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`P10B-18C resume integrity failed at ${path}.`);
  }
  return Object.fromEntries(Object.entries(value));
}

function evidenceArray(value: unknown, path: string): readonly unknown[] {
  if (!Array.isArray(value)) throw new Error(`P10B-18C resume integrity failed at ${path}.`);
  return value;
}

function evidenceString(value: unknown, path: string): string {
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`P10B-18C resume integrity failed at ${path}.`);
  }
  return value;
}

function assertEvidenceMatch(path: string, actual: unknown, expected: unknown): void {
  if (canonicalValueFingerprint(actual) !== canonicalValueFingerprint(expected)) {
    throw new Error(`P10B-18C resume integrity mismatch at ${path}.`);
  }
}

function expectedResumeIdentity(
  expectation: P10B18CCaptureResumeExpectation,
  sequenceIndex: number,
): P10B18CCaptureIdentity {
  const expectedPath = expectation.canonicalFilename;
  return {
    ...expectation.identity,
    canonicalFilename: expectation.canonicalFilename,
    expectedPath,
    sequenceIndex,
    identityFingerprint: `p10b18c-active-${canonicalValueFingerprint({
      sequenceIndex,
      ...expectation.identity,
      canonicalFilename: expectation.canonicalFilename,
      expectedPath,
    })}`,
  };
}

function activeRecord(value: unknown): ActiveCaptureRecord | null {
  if (value === null || typeof value !== "object" || !("activeCapture" in value)) return null;
  const active = value.activeCapture;
  if (active === null || typeof active !== "object") return null;
  if (!("identity" in active) || !("lifecycle" in active)) return null;
  return active as ActiveCaptureRecord;
}

function lifecycleIndex(state: P10B18CCaptureLifecycleState): number {
  return p10b18cCaptureLifecycleStates.indexOf(state);
}

export function p10b18cHasReachedLifecycleStage(
  currentStage: P10B18CCaptureLifecycleState,
  requiredStage: P10B18CCaptureLifecycleState,
): boolean {
  return lifecycleIndex(currentStage) >= lifecycleIndex(requiredStage);
}

function emptyRuntimeEvents(): {
  pageErrors: SequencedMessage[];
  consoleErrors: SequencedMessage[];
  requestFailures: P10B18CFailedRequest[];
  failedResponseStatuses: SanitizedResponseFailure[];
} {
  return { pageErrors: [], consoleErrors: [], requestFailures: [], failedResponseStatuses: [] };
}

function sanitizedRuntimeEvents(events: RuntimeEvents) {
  return {
    pageErrors: events.pageErrors.slice(0, 20).map(({ eventSequence, message }) => ({
      eventSequence,
      message: sanitizeP10B18CDiagnosticText(message),
    })),
    consoleErrors: events.consoleErrors.slice(0, 20).map(({ eventSequence, message }) => ({
      eventSequence,
      message: sanitizeP10B18CDiagnosticText(message),
    })),
    requestFailures: events.requestFailures.slice(0, 50).map(sanitizedRequest),
    failedResponseStatuses: events.failedResponseStatuses.slice(0, 50),
  };
}

function lifecycleFacts(record: ActiveCaptureRecord) {
  const currentStage = record.lifecycle.currentStage;
  return {
    currentStage,
    reachedStages: record.lifecycle.reachedStages,
    eventLedgerBoundarySequence: record.eventLedgerBoundarySequence,
    navigationReached: p10b18cHasReachedLifecycleStage(currentStage, "response-received"),
    storefrontRenderingReached: p10b18cHasReachedLifecycleStage(currentStage, "storefront-ready"),
    screenshotWritingBegan: p10b18cHasReachedLifecycleStage(currentStage, "capture-started"),
    screenshotWritingCompleted: record.persistence.screenshotWrittenAt !== null,
    manifestPersistenceCompleted: record.persistence.manifestPersistedAt !== null,
    persistence: record.persistence,
  };
}

function captureEventLedger(
  events: RuntimeEvents,
  record: ActiveCaptureRecord,
  intendedOrigin: string,
  presentationImageEvidence?: readonly P10B18CPresentationImageEvidence[],
  errorBoundaryVisible = false,
  runtimePostcondition?: Readonly<{
    activeExpectedUrlUnchanged: boolean;
    storefrontRootReady: boolean;
  }>,
) {
  const facts = lifecycleFacts(record);
  const requestLedger = classifyP10B18CRequestLedger({
    requests: events.requestFailures,
    postcondition: {
      intendedOrigin,
      readyStateReached: facts.navigationReached,
      renderingReady: facts.storefrontRenderingReached,
      httpStatus: record.httpStatus,
      pageErrors: events.pageErrors.map(({ message }) => message),
      consoleErrors: events.consoleErrors.map(({ message }) => message),
      activeExpectedUrlUnchanged:
        runtimePostcondition?.activeExpectedUrlUnchanged ??
        (record.actualUrl !== null && record.actualUrl === record.expectedUrl),
      storefrontRootReady:
        runtimePostcondition?.storefrontRootReady ?? facts.storefrontRenderingReached,
      errorBoundaryVisible,
      failedResponseCount: events.failedResponseStatuses.length,
      screenshotWritten: record.persistence.screenshotWrittenAt !== null,
      presentationImageCompletion: {
        lifecycleStage: record.lifecycle.currentStage,
        screenshotWritten: record.persistence.screenshotWrittenAt !== null,
        manifestPersisted: record.persistence.manifestPersistedAt !== null,
        storefrontReady: facts.storefrontRenderingReached,
        httpStatus: record.httpStatus,
        pageErrorCount: events.pageErrors.length,
        consoleErrorCount: events.consoleErrors.length,
        failedResponseCount: events.failedResponseStatuses.length,
        errorBoundaryVisible,
      },
    },
    presentationImageEvidence,
  });
  const responseFailures = events.failedResponseStatuses.map(
    ({ status, origin, pathname }) => `http-response:${status}:${origin}${pathname}`,
  );
  return {
    ...sanitizedRuntimeEvents(events),
    expectedRscNavigationAborts: requestLedger.expectedRscNavigationAborts,
    expectedRscNavigationAbortCount: requestLedger.expectedRscNavigationAbortCount,
    expectedNextAppRouterPrefetchAborts: requestLedger.expectedNextAppRouterPrefetchAborts,
    expectedNextAppRouterPrefetchAbortCount: requestLedger.expectedNextAppRouterPrefetchAbortCount,
    pendingNextAppRouterPrefetchAborts: requestLedger.pendingNextAppRouterPrefetchAborts,
    pendingNextAppRouterPrefetchAbortCount: requestLedger.pendingNextAppRouterPrefetchAbortCount,
    expectedSupersededPresentationImageAborts:
      requestLedger.expectedSupersededPresentationImageAborts,
    expectedSupersededPresentationImageAbortCount:
      requestLedger.expectedSupersededPresentationImageAbortCount,
    pendingPresentationImageAborts: requestLedger.pendingPresentationImageAborts,
    pendingPresentationImageAbortCount: requestLedger.pendingPresentationImageAbortCount,
    presentationImageAttributionLeaks: requestLedger.presentationImageAttributionLeaks,
    presentationImageAttributionLeakCount: requestLedger.presentationImageAttributionLeakCount,
    presentationImageEvidence:
      presentationImageEvidence &&
      presentationImageEvidence.some(
        (placement) =>
          placement.retainForDiagnosis ||
          placement.requests.some(({ failureText }) => failureText !== null),
      )
        ? {
            placementCount: presentationImageEvidence.length,
            placements: presentationImageEvidence,
          }
        : null,
    blockingRuntimeFailures: [...requestLedger.blockingRuntimeFailures, ...responseFailures].map(
      sanitizeP10B18CDiagnosticText,
    ),
    nonDeferredBlockingRuntimeFailures: [
      ...requestLedger.nonDeferredBlockingRuntimeFailures,
      ...responseFailures,
      ...(errorBoundaryVisible ? ["error-boundary-visible"] : []),
    ].map(sanitizeP10B18CDiagnosticText),
  };
}

async function visibleErrorBoundary(page: Page): Promise<
  Readonly<{
    heading: string | null;
    body: string | null;
  }>
> {
  const heading = page
    .getByRole("heading", { name: "This page couldn’t load", exact: true })
    .first();
  if (!(await heading.isVisible().catch(() => false))) return { heading: null, body: null };
  const headingText = bounded(await heading.innerText().catch(() => ""), 160);
  const bodyText = bounded(
    await heading
      .locator("xpath=..")
      .innerText()
      .catch(() => headingText),
    500,
  );
  return { heading: headingText || null, body: bodyText || null };
}

export class P10B18CCaptureEventAttribution {
  #nextEventSequence = 1;
  #captureActive = false;
  readonly #captureRequests = new WeakSet<object>();

  beginCapture(): number {
    if (this.#captureActive) throw new Error("P10B-18C capture event interval is already active.");
    this.#captureActive = true;
    return this.#nextEventSequence - 1;
  }

  finishCapture(): void {
    this.#captureActive = false;
  }

  requestStarted(request: object): number {
    const eventSequence = this.#nextEventSequence;
    this.#nextEventSequence += 1;
    if (this.#captureActive) this.#captureRequests.add(request);
    return eventSequence;
  }

  eventScope(request?: object): Readonly<{
    eventSequence: number;
    scope: "capture" | "setup";
  }> {
    const eventSequence = this.#nextEventSequence;
    this.#nextEventSequence += 1;
    return {
      eventSequence,
      scope:
        this.#captureActive && (!request || this.#captureRequests.has(request))
          ? "capture"
          : "setup",
    };
  }
}

export class P10B18CActiveCaptureEvidence {
  readonly #directory: string;
  #nextSequenceIndex = 1;

  constructor(directory: string) {
    this.#directory = directory;
  }

  activeCapturePath(): string {
    return resolve(this.#directory, ACTIVE_CAPTURE_FILENAME);
  }

  captureProgressPath(): string {
    return resolve(this.#directory, CAPTURE_PROGRESS_FILENAME);
  }

  setupEventLedgerPath(): string {
    return resolve(this.#directory, SETUP_EVENT_LEDGER_FILENAME);
  }

  resumeIntegrityAuditPath(): string {
    return resolve(this.#directory, RESUME_INTEGRITY_AUDIT_FILENAME);
  }

  async auditAndPrepareResume(input: {
    expectedCompletedCaptureCount: number;
    expectedEntries: readonly P10B18CCaptureResumeExpectation[];
    expectedNextEntry: P10B18CCaptureResumeExpectation;
  }): Promise<P10B18CCaptureResumeAudit> {
    if (
      input.expectedCompletedCaptureCount <= 0 ||
      input.expectedEntries.length !== input.expectedCompletedCaptureCount
    ) {
      throw new Error("P10B-18C resume integrity requires the exact positive completed count.");
    }
    const progress = evidenceRecord(
      await readJson(this.captureProgressPath()),
      "progress-manifest",
    );
    assertEvidenceMatch(
      "progress-manifest.completedCaptureCount",
      progress.completedCaptureCount,
      input.expectedCompletedCaptureCount,
    );
    assertEvidenceMatch("progress-manifest.pendingEntry", progress.pendingEntry, null);
    const entries = evidenceArray(progress.entries, "progress-manifest.entries");
    assertEvidenceMatch(
      "progress-manifest.entries.length",
      entries.length,
      input.expectedCompletedCaptureCount,
    );

    const auditedEntries: Array<Readonly<Record<string, unknown>>> = [];
    const manifestEntries: unknown[] = [];
    for (let index = 0; index < entries.length; index += 1) {
      const sequenceIndex = index + 1;
      const entry = evidenceRecord(entries[index], `entries[${index}]`);
      const identity = evidenceRecord(entry.identity, `entries[${index}].identity`);
      const manifestEntry = evidenceRecord(entry.manifestEntry, `entries[${index}].manifestEntry`);
      const eventLedger = evidenceRecord(
        entry.captureEventLedger,
        `entries[${index}].captureEventLedger`,
      );
      const expectation = input.expectedEntries[index];
      const expectedIdentity = expectedResumeIdentity(expectation, sequenceIndex);
      assertEvidenceMatch(`entries[${index}].identity`, identity, expectedIdentity);
      const expectedManifestAuthority = {
        filename: expectation.canonicalFilename,
        caseId: expectation.identity.caseId,
        surface: expectation.identity.surfacePageType,
        route: expectation.identity.expectedRoute,
        viewport: expectation.identity.viewport.width,
        locale: expectation.identity.locale,
        renderer: expectation.identity.renderer,
        snapshotFingerprint: expectation.identity.selectedSnapshotFingerprint,
        consumedAuthorityFingerprint: expectation.consumedAuthorityFingerprint,
        normalizedTopologyFingerprint: expectation.identity.normalizedTopologyFingerprint,
      };
      for (const [field, expected] of Object.entries(expectedManifestAuthority)) {
        assertEvidenceMatch(
          `entries[${index}].manifestEntry.${field}`,
          manifestEntry[field],
          expected,
        );
      }
      for (const field of [
        "blockingRuntimeFailures",
        "nonDeferredBlockingRuntimeFailures",
        "pageErrors",
        "consoleErrors",
        "failedResponseStatuses",
      ] as const) {
        assertEvidenceMatch(
          `entries[${index}].captureEventLedger.${field}`,
          eventLedger[field],
          [],
        );
      }
      if (entry.lifecycle !== undefined) {
        const lifecycle = evidenceRecord(entry.lifecycle, `entries[${index}].lifecycle`);
        assertEvidenceMatch(
          `entries[${index}].lifecycle.currentStage`,
          lifecycle.currentStage,
          "capture-complete",
        );
      }
      const filename = evidenceString(
        manifestEntry.filename,
        `entries[${index}].manifestEntry.filename`,
      );
      const screenshotSha256 = evidenceString(
        manifestEntry.screenshotSha256,
        `entries[${index}].manifestEntry.screenshotSha256`,
      );
      const screenshot = await readFile(resolve(this.#directory, filename));
      const actualSha256 = createHash("sha256").update(screenshot).digest("hex");
      assertEvidenceMatch(
        `entries[${index}].manifestEntry.screenshotSha256`,
        actualSha256,
        screenshotSha256,
      );
      auditedEntries.push({
        sequenceIndex,
        identityFingerprint: expectedIdentity.identityFingerprint,
        screenshotSha256,
        lifecycleProof:
          entry.lifecycle === undefined
            ? DURABLE_PROGRESS_COMPLETION_CONTRACT
            : "persisted-capture-complete-lifecycle",
        currentAuthorityMatched: true,
        blockingRuntimeFailureCount: 0,
      });
      manifestEntries.push(entry.manifestEntry);
    }

    const activePayload = await readJson(this.activeCapturePath());
    const active = activeRecord(activePayload);
    if (!active) throw new Error("P10B-18C resume integrity requires the failed next capture.");
    const expectedNextIdentity = expectedResumeIdentity(
      input.expectedNextEntry,
      input.expectedCompletedCaptureCount + 1,
    );
    assertEvidenceMatch("active-capture.identity", active.identity, expectedNextIdentity);
    assertEvidenceMatch(
      "active-capture.lifecycle.currentStage",
      active.lifecycle.currentStage,
      "capture-started",
    );
    assertEvidenceMatch(
      "active-capture.persistence.manifestPersistedAt",
      active.persistence.manifestPersistedAt,
      null,
    );
    if (active.persistence.screenshotWrittenAt === null) {
      throw new Error("P10B-18C resume integrity requires the failed screenshot-write evidence.");
    }
    const failureEvidence = evidenceRecord(
      await readJson(this.failurePath(active.identity)),
      "failed-capture.evidence",
    );
    assertEvidenceMatch(
      "failed-capture.activeCaptureIdentity.identityFingerprint",
      evidenceRecord(failureEvidence.activeCaptureIdentity, "failed-capture.activeCaptureIdentity")
        .identityFingerprint,
      active.identity.identityFingerprint,
    );
    const failureScreenshotPath = evidenceString(
      failureEvidence.screenshotPath,
      "failed-capture.screenshotPath",
    );
    await stat(resolve(this.#directory, failureScreenshotPath));

    const deterministicAudit = {
      contractVersion: "p10b-18c-capture-resume-integrity-v1",
      verdict: "pass",
      completedCaptureCount: input.expectedCompletedCaptureCount,
      nextCaptureSequenceIndex: input.expectedCompletedCaptureCount + 1,
      nextCaptureIdentityFingerprint: expectedNextIdentity.identityFingerprint,
      currentPlanFingerprint: canonicalValueFingerprint(input.expectedEntries),
      currentNextCaptureFingerprint: canonicalValueFingerprint(input.expectedNextEntry),
      durableCompletionContract: DURABLE_PROGRESS_COMPLETION_CONTRACT,
      auditedEntries,
      preservedFailureEvidence: {
        identityFingerprint: active.identity.identityFingerprint,
        failureEvidencePath: this.failurePath(active.identity),
        failureScreenshotPath,
      },
    };
    const evidenceFingerprint = `p10b18c-resume-${canonicalValueFingerprint(deterministicAudit)}`;
    await atomicJson(this.resumeIntegrityAuditPath(), {
      ...deterministicAudit,
      evidenceFingerprint,
      auditedAt: new Date().toISOString(),
    });
    await atomicJson(this.activeCapturePath(), {
      activeCapture: null,
      lastCompletedCapture: null,
      resume: {
        completedCaptureCount: input.expectedCompletedCaptureCount,
        nextCaptureSequenceIndex: input.expectedCompletedCaptureCount + 1,
        preservedFailedCaptureIdentityFingerprint: active.identity.identityFingerprint,
        evidenceFingerprint,
      },
    });
    this.#nextSequenceIndex = input.expectedCompletedCaptureCount + 1;
    return {
      completedCaptureCount: input.expectedCompletedCaptureCount,
      manifestEntries,
      auditPath: this.resumeIntegrityAuditPath(),
      evidenceFingerprint,
    };
  }

  failurePath(identity: P10B18CCaptureIdentity): string {
    return resolve(
      this.#directory,
      `p10b-18c-runtime-failure-${String(identity.sequenceIndex).padStart(3, "0")}-${identity.identityFingerprint}.json`,
    );
  }

  async planCapture(input: P10B18CCaptureIdentityInput): Promise<P10B18CCaptureIdentity> {
    const existing = activeRecord(await readJson(this.activeCapturePath()));
    if (existing) {
      throw new Error(
        `P10B-18C capture ${existing.identity.sequenceIndex} is still active; the next capture cannot begin.`,
      );
    }
    const sequenceIndex = this.#nextSequenceIndex;
    this.#nextSequenceIndex += 1;
    const logicalFilename = sanitizeP10B18CDiagnosticText(input.logicalFilename);
    const canonicalFilename = canonicalP10BEvidenceFilename(logicalFilename);
    const safeInput = {
      ...input,
      logicalFilename,
      expectedUrl: sanitizeP10B18CDiagnosticUrl(input.expectedUrl),
    };
    const identity: P10B18CCaptureIdentity = {
      ...safeInput,
      canonicalFilename,
      expectedPath: canonicalFilename,
      sequenceIndex,
      identityFingerprint: `p10b18c-active-${canonicalValueFingerprint({
        sequenceIndex,
        ...safeInput,
        canonicalFilename,
        expectedPath: canonicalFilename,
      })}`,
    };
    const timestamp = new Date().toISOString();
    await atomicJson(this.activeCapturePath(), {
      activeCapture: {
        identity,
        lifecycle: {
          currentStage: "planned",
          reachedStages: [{ state: "planned", timestamp }],
        },
        expectedUrl: identity.expectedUrl,
        actualUrl: null,
        httpStatus: null,
        eventLedgerBoundarySequence: null,
        persistence: {
          actualPath: null,
          screenshotWrittenAt: null,
          manifestPersistedAt: null,
        },
      },
      lastCompletedCapture: null,
    });
    return identity;
  }

  async transitionCapture(
    identity: P10B18CCaptureIdentity,
    transition: P10B18CPersistedCaptureLifecycleTransition,
    eventLedgerBoundarySequence?: number,
  ): Promise<void> {
    const current = activeRecord(await readJson(this.activeCapturePath()));
    if (!current || current.identity.identityFingerprint !== identity.identityFingerprint) {
      throw new Error("P10B-18C capture lifecycle identity does not match the active capture.");
    }
    if (lifecycleIndex(transition.state) !== lifecycleIndex(current.lifecycle.currentStage) + 1) {
      throw new Error(
        `P10B-18C capture lifecycle cannot advance from ${current.lifecycle.currentStage} to ${transition.state}.`,
      );
    }
    const timestamp = new Date().toISOString();
    await atomicJson(this.activeCapturePath(), {
      activeCapture: {
        ...current,
        lifecycle: {
          currentStage: transition.state,
          reachedStages: [
            ...current.lifecycle.reachedStages,
            { state: transition.state, timestamp },
          ],
        },
        expectedUrl: sanitizeP10B18CDiagnosticUrl(transition.expectedUrl),
        actualUrl: sanitizeP10B18CDiagnosticUrl(transition.actualUrl),
        httpStatus: transition.httpStatus ?? current.httpStatus,
        eventLedgerBoundarySequence:
          transition.state === "navigation-started"
            ? (eventLedgerBoundarySequence ?? 0)
            : current.eventLedgerBoundarySequence,
      },
      lastCompletedCapture: null,
    });
  }

  async #recordScreenshotWritten(
    identity: P10B18CCaptureIdentity,
    actualPath: string,
  ): Promise<void> {
    const current = activeRecord(await readJson(this.activeCapturePath()));
    if (
      !current ||
      current.identity.identityFingerprint !== identity.identityFingerprint ||
      !p10b18cHasReachedLifecycleStage(current.lifecycle.currentStage, "capture-started")
    ) {
      throw new Error("P10B-18C screenshot evidence does not match an active capture.");
    }
    await atomicJson(this.activeCapturePath(), {
      activeCapture: {
        ...current,
        persistence: {
          ...current.persistence,
          actualPath,
          screenshotWrittenAt: current.persistence.screenshotWrittenAt ?? new Date().toISOString(),
        },
      },
      lastCompletedCapture: null,
    });
  }

  async completeCapture(
    identity: P10B18CCaptureIdentity,
    manifestEntry: Readonly<{ filename: string; [key: string]: unknown }>,
    eventLedger?: unknown,
  ): Promise<void> {
    await this.#prepareCaptureCompletion(identity, manifestEntry, eventLedger);
    await this.#finalizeCaptureCompletion(identity, manifestEntry, eventLedger);
  }

  async #prepareCaptureCompletion(
    identity: P10B18CCaptureIdentity,
    manifestEntry: Readonly<{ filename: string; [key: string]: unknown }>,
    eventLedger?: unknown,
  ): Promise<ActiveCaptureRecord> {
    const current = activeRecord(await readJson(this.activeCapturePath()));
    if (
      !current ||
      current.identity.identityFingerprint !== identity.identityFingerprint ||
      current.lifecycle.currentStage !== "capture-started"
    ) {
      throw new Error("P10B-18C capture cannot complete outside its active capture-started state.");
    }
    if (manifestEntry.filename !== identity.canonicalFilename) {
      throw new Error("P10B-18C capture filename does not match the active capture identity.");
    }
    await stat(resolve(this.#directory, identity.expectedPath));
    await this.#recordScreenshotWritten(identity, manifestEntry.filename);
    const currentProgress = await readJson(this.captureProgressPath());
    const entries: unknown[] =
      currentProgress !== null &&
      typeof currentProgress === "object" &&
      "entries" in currentProgress &&
      Array.isArray(currentProgress.entries)
        ? currentProgress.entries
        : [];
    await atomicJson(this.captureProgressPath(), {
      entries,
      completedCaptureCount: entries.length,
      pendingEntry: { identity, manifestEntry, captureEventLedger: eventLedger ?? null },
    });
    const screenshotRecord = activeRecord(await readJson(this.activeCapturePath()));
    if (!screenshotRecord)
      throw new Error("P10B-18C active capture disappeared before completion.");
    await atomicJson(this.activeCapturePath(), {
      activeCapture: {
        ...screenshotRecord,
        persistence: {
          ...screenshotRecord.persistence,
          manifestPersistedAt: new Date().toISOString(),
        },
      },
      lastCompletedCapture: null,
    });
    await this.transitionCapture(identity, {
      state: "capture-complete",
      expectedUrl: current.expectedUrl,
      actualUrl: current.actualUrl ?? current.expectedUrl,
      httpStatus: current.httpStatus,
    });
    const complete = activeRecord(await readJson(this.activeCapturePath()));
    if (!complete) throw new Error("P10B-18C completed capture evidence disappeared.");
    return complete;
  }

  async #finalizeCaptureCompletion(
    identity: P10B18CCaptureIdentity,
    manifestEntry: Readonly<{ filename: string; [key: string]: unknown }>,
    eventLedger?: unknown,
  ): Promise<void> {
    const currentProgress = await readJson(this.captureProgressPath());
    const entries: unknown[] =
      currentProgress !== null &&
      typeof currentProgress === "object" &&
      "entries" in currentProgress &&
      Array.isArray(currentProgress.entries)
        ? currentProgress.entries
        : [];
    const complete = activeRecord(await readJson(this.activeCapturePath()));
    if (!complete || complete.lifecycle.currentStage !== "capture-complete") {
      throw new Error("P10B-18C capture completion disappeared before final manifest durability.");
    }
    await atomicJson(this.captureProgressPath(), {
      entries: [
        ...entries,
        {
          identity,
          manifestEntry,
          captureEventLedger: eventLedger ?? null,
          lifecycle: complete.lifecycle,
          persistence: complete.persistence,
          completionContract: DURABLE_PROGRESS_COMPLETION_CONTRACT,
        },
      ],
      completedCaptureCount: entries.length + 1,
      pendingEntry: null,
    });
    await atomicJson(this.activeCapturePath(), {
      activeCapture: null,
      lastCompletedCapture: {
        identity,
        lifecycle: complete.lifecycle,
        persistence: complete.persistence,
        eventLedgerBoundarySequence: complete.eventLedgerBoundarySequence,
      },
    });
  }

  async persistSetupEventLedger(
    identity: P10B18CCaptureIdentity,
    events: RuntimeEvents,
    eventLedgerBoundarySequence: number | null,
  ): Promise<void> {
    const current = await readJson(this.setupEventLedgerPath());
    const entries: unknown[] =
      current !== null &&
      typeof current === "object" &&
      "entries" in current &&
      Array.isArray(current.entries)
        ? current.entries
        : [];
    await atomicJson(this.setupEventLedgerPath(), {
      entries: [
        ...entries,
        {
          captureAttemptFingerprint: identity.identityFingerprint,
          captureSequenceIndex: identity.sequenceIndex,
          eventLedgerBoundarySequence,
          classification: "harness/setup events outside the active capture interval",
          events: sanitizedRuntimeEvents(events),
        },
      ],
    });
  }

  async persistFailureEvidence(input: {
    identity: P10B18CCaptureIdentity;
    expectedUrl: string;
    actualUrl: string;
    actualCapturePath: string | null;
    httpStatus: number | null;
    documentTitle: string;
    errorBoundaryHeading: string | null;
    errorBoundaryBody: string | null;
    captureEvents: RuntimeEvents;
    setupEvents: RuntimeEvents;
    screenshotPath: string | null;
    error: string;
    presentationImageEvidence?: readonly P10B18CPresentationImageEvidence[];
  }): Promise<void> {
    const current = activeRecord(await readJson(this.activeCapturePath()));
    if (!current || current.identity.identityFingerprint !== input.identity.identityFingerprint) {
      throw new Error("P10B-18C runtime failure does not match the active capture identity.");
    }
    const intendedOrigin = new URL(input.expectedUrl).origin;
    const scopedCaptureLedger = captureEventLedger(
      input.captureEvents,
      current,
      intendedOrigin,
      input.presentationImageEvidence,
      input.errorBoundaryHeading !== null,
    );
    const rscNavigationAbortCandidates = input.captureEvents.requestFailures
      .filter((request) => {
        const url = new URL(request.url);
        return (
          request.duringExpectedNavigation &&
          request.method === "GET" &&
          url.origin === intendedOrigin &&
          url.searchParams.has("_rsc") &&
          request.failure === "net::ERR_ABORTED"
        );
      })
      .map(sanitizedRequest);
    const deterministicEvidence = {
      activeCaptureIdentity: input.identity,
      expectedUrl: sanitizeP10B18CDiagnosticUrl(input.expectedUrl),
      actualUrl: sanitizeP10B18CDiagnosticUrl(input.actualUrl),
      actualCapturePath: input.actualCapturePath
        ? sanitizeP10B18CDiagnosticText(input.actualCapturePath)
        : null,
      httpStatus: input.httpStatus,
      documentTitle: sanitizeP10B18CDiagnosticText(input.documentTitle),
      errorBoundaryHeading: input.errorBoundaryHeading
        ? sanitizeP10B18CDiagnosticText(input.errorBoundaryHeading)
        : null,
      errorBoundaryBody: input.errorBoundaryBody
        ? sanitizeP10B18CDiagnosticText(input.errorBoundaryBody)
        : null,
      lifecycle: lifecycleFacts(current),
      captureEventLedger: scopedCaptureLedger,
      setupEventLedger: sanitizedRuntimeEvents(input.setupEvents),
      expectedRscNavigationAborts: scopedCaptureLedger.expectedRscNavigationAborts,
      expectedRscNavigationAbortCount: scopedCaptureLedger.expectedRscNavigationAbortCount,
      expectedNextAppRouterPrefetchAborts: scopedCaptureLedger.expectedNextAppRouterPrefetchAborts,
      expectedNextAppRouterPrefetchAbortCount:
        scopedCaptureLedger.expectedNextAppRouterPrefetchAbortCount,
      rscNavigationAbortCandidates,
      blockingRuntimeFailures: scopedCaptureLedger.blockingRuntimeFailures,
      presentationImageCancellationClassification:
        scopedCaptureLedger.presentationImageEvidence === null
          ? null
          : scopedCaptureLedger.expectedSupersededPresentationImageAbortCount > 0
            ? "expected superseded presentation-image request cancellation"
            : "unresolved same-origin presentation-image request cancellation",
      presentationImageEvidence: scopedCaptureLedger.presentationImageEvidence,
      serverRuntimeDiagnostics: [] as readonly string[],
      screenshotPath: input.screenshotPath,
      error: sanitizeP10B18CDiagnosticText(input.error),
    };
    await atomicJson(this.failurePath(input.identity), {
      ...deterministicEvidence,
      failureTimestamp: new Date().toISOString(),
      evidenceFingerprint: `p10b18c-runtime-${canonicalValueFingerprint(deterministicEvidence)}`,
    });
  }

  async runCapture<T extends Readonly<{ filename: string }>>(input: {
    page: Page;
    identity: P10B18CCaptureIdentityInput;
    execute: (
      transition: (value: P10B18CCaptureLifecycleTransition) => Promise<void>,
      identity: P10B18CCaptureIdentity,
    ) => Promise<T>;
    presentationImageAuthorities?: readonly P10B18CPresentationImageAuthority[];
    retainPresentationImageEvidence?: boolean;
  }): Promise<T> {
    const identity = await this.planCapture(input.identity);
    const captureEvents = emptyRuntimeEvents();
    const setupEvents = emptyRuntimeEvents();
    const attribution = new P10B18CCaptureEventAttribution();
    let expectedNavigationActive = false;
    let eventLedgerBoundarySequence: number | null = null;
    let httpStatus: number | null = null;
    let result: T | null = null;
    let setupLedgerPersisted = false;
    let currentLifecycleStage: P10B18CCaptureLifecycleState = "planned";
    const requestStarts = new WeakMap<Request, RequestStartMetadata>();
    const pendingRequestFailures = new Set<Promise<void>>();
    const presentationImageProbes = (input.presentationImageAuthorities ?? []).map(
      (authority) =>
        new P10B18CPresentationImageProbe({
          authority,
          baseUrl: identity.expectedUrl,
          activeCaptureIdentityFingerprint: identity.identityFingerprint,
          retainForDiagnosis: input.retainPresentationImageEvidence,
        }),
    );
    let presentationImageEvidence: readonly P10B18CPresentationImageEvidence[] | undefined;

    const eventsFor = (scope: "capture" | "setup") =>
      scope === "capture" ? captureEvents : setupEvents;
    const onRequest = (request: Request) => {
      const eventSequence = attribution.requestStarted(request);
      requestStarts.set(request, {
        eventSequence,
        timestamp: new Date().toISOString(),
        lifecycleStage: currentLifecycleStage,
        duringExpectedNavigation: expectedNavigationActive,
      });
      presentationImageProbes.forEach((probe) =>
        probe.recordRequestStarted(
          request,
          eventSequence,
          currentLifecycleStage,
          currentLifecycleStage === "planned" ? "setup" : "capture",
        ),
      );
    };
    const onPageError = (error: Error) => {
      const attributed = attribution.eventScope();
      eventsFor(attributed.scope).pageErrors.push({
        eventSequence: attributed.eventSequence,
        message: error.message,
      });
    };
    const onConsole = (message: { type(): string; text(): string }) => {
      if (message.type() !== "error") return;
      const attributed = attribution.eventScope();
      eventsFor(attributed.scope).consoleErrors.push({
        eventSequence: attributed.eventSequence,
        message: message.text(),
      });
    };
    const onRequestFailed = (request: Request) => {
      presentationImageProbes.forEach((probe) => probe.recordRequestFailed(request));
      const attributed = attribution.eventScope(request);
      const started = requestStarts.get(request);
      const task = (async () => {
        const url = new URL(request.url());
        const expectedOrigin = new URL(identity.expectedUrl).origin;
        const headers: Record<string, string> = await request
          .allHeaders()
          .catch((): Record<string, string> => ({}));
        let frameOrigin: string | null = null;
        let framePathname: string | null = null;
        try {
          const frameUrl = new URL(request.frame().url());
          frameOrigin = frameUrl.origin;
          framePathname = frameUrl.pathname;
        } catch {
          frameOrigin = null;
          framePathname = null;
        }
        const lifecycleStage = started?.lifecycleStage ?? currentLifecycleStage;
        const metadata: P10B18CFailedRequestMetadata = {
          timestamp: started?.timestamp ?? new Date().toISOString(),
          activeCaptureIdentity: {
            sequenceIndex: identity.sequenceIndex,
            caseId: identity.caseId,
            surfacePageType: identity.surfacePageType,
            expectedRoute: identity.expectedRoute,
            viewport: identity.viewport,
            locale: identity.locale,
            identityFingerprint: identity.identityFingerprint,
          },
          activeCaptureLifecycleStage: lifecycleStage,
          sameOrigin: url.origin === expectedOrigin,
          queryKeyNames: [...new Set(url.searchParams.keys())].sort(),
          resourceType: request.resourceType(),
          isNavigationRequest: request.isNavigationRequest(),
          frameOrigin,
          framePathname,
          redirectChainCount: redirectChainCount(request),
          startedAfterStorefrontReady: p10b18cHasReachedLifecycleStage(
            lifecycleStage,
            "storefront-ready",
          ),
          startedAfterCaptureStarted: p10b18cHasReachedLifecycleStage(
            lifecycleStage,
            "capture-started",
          ),
          destinationMatchesRenderedLink: await destinationMatchesRenderedLink(
            input.page,
            request.url(),
          ),
          requestHeaders: {
            rsc: headerEvidence(headers.rsc),
            nextRouterPrefetch: headerEvidence(headers["next-router-prefetch"]),
            nextRouterStateTree: headerEvidence(headers["next-router-state-tree"], true),
            purpose: headerEvidence(headers.purpose),
            secPurpose: headerEvidence(headers["sec-purpose"]),
            nextUrl: nextUrlEvidence(headers["next-url"], identity.expectedUrl),
          },
        };
        eventsFor(attributed.scope).requestFailures.push({
          eventSequence: started?.eventSequence ?? attributed.eventSequence,
          method: request.method(),
          url: request.url(),
          failure: request.failure()?.errorText ?? "unknown-request-failure",
          duringExpectedNavigation:
            attributed.scope === "capture" &&
            (started?.duringExpectedNavigation ?? expectedNavigationActive),
          metadata,
        });
      })();
      pendingRequestFailures.add(task);
      void task.finally(() => pendingRequestFailures.delete(task));
    };
    const onResponse = (response: Response) => {
      presentationImageProbes.forEach((probe) => probe.recordResponse(response));
      const attributed = attribution.eventScope(response.request());
      if (attributed.scope === "capture" && response.request().resourceType() === "document") {
        httpStatus = response.status();
      }
      if (response.status() >= 400) {
        const url = new URL(response.url());
        eventsFor(attributed.scope).failedResponseStatuses.push({
          eventSequence: attributed.eventSequence,
          status: response.status(),
          origin: url.origin,
          pathname: url.pathname,
        });
      }
    };
    const onRequestFinished = (request: Request) => {
      presentationImageProbes.forEach((probe) => probe.recordRequestFinished(request));
    };
    input.page.on("request", onRequest);
    input.page.on("pageerror", onPageError);
    input.page.on("console", onConsole);
    input.page.on("requestfailed", onRequestFailed);
    input.page.on("response", onResponse);
    input.page.on("requestfinished", onRequestFinished);

    const transition = async (value: P10B18CCaptureLifecycleTransition) => {
      if (value.state === "navigation-started") {
        eventLedgerBoundarySequence = attribution.beginCapture();
        expectedNavigationActive = true;
      }
      if (value.state === "storefront-ready") expectedNavigationActive = false;
      currentLifecycleStage = value.state;
      if (value.httpStatus !== null) httpStatus = value.httpStatus;
      await this.transitionCapture(identity, value, eventLedgerBoundarySequence ?? undefined);
    };

    const persistSetup = async () => {
      if (setupLedgerPersisted) return;
      await this.persistSetupEventLedger(identity, setupEvents, eventLedgerBoundarySequence);
      setupLedgerPersisted = true;
    };

    const settleRequestFailures = async () => {
      await input.page.waitForTimeout(0);
      await Promise.all([...pendingRequestFailures]);
    };

    const runtimePostcondition = async () => ({
      activeExpectedUrlUnchanged: input.page.url() === identity.expectedUrl,
      storefrontRootReady:
        input.identity.renderer === "saved-draft-preview" &&
        (await input.page
          .locator(".project-preview__storefront")
          .isVisible()
          .catch(() => false)),
    });

    try {
      await Promise.all(presentationImageProbes.map((probe) => probe.attach(input.page)));
      await input.page.waitForLoadState("networkidle", { timeout: 30_000 }).catch((error) => {
        const attributed = attribution.eventScope();
        setupEvents.consoleErrors.push({
          eventSequence: attributed.eventSequence,
          message: `setup-network-idle:${error instanceof Error ? error.message : String(error)}`,
        });
      });
      result = await input.execute(transition, identity);
      await settleRequestFailures();
      presentationImageEvidence = await Promise.all(
        presentationImageProbes.map((probe) => probe.collect(input.page)),
      );
      await persistSetup();
      const current = activeRecord(await readJson(this.activeCapturePath()));
      if (!current) throw new Error("P10B-18C active capture disappeared before validation.");
      const errorBoundary = await visibleErrorBoundary(input.page);
      const scopedCaptureLedger = captureEventLedger(
        captureEvents,
        current,
        new URL(identity.expectedUrl).origin,
        presentationImageEvidence,
        errorBoundary.heading !== null,
        await runtimePostcondition(),
      );
      if (scopedCaptureLedger.nonDeferredBlockingRuntimeFailures.length > 0) {
        throw new Error(
          `P10B-18C active capture has blocking runtime evidence: ${scopedCaptureLedger.blockingRuntimeFailures.join(
            ", ",
          )}`,
        );
      }
      if (
        scopedCaptureLedger.pendingPresentationImageAbortCount > 0 ||
        scopedCaptureLedger.pendingNextAppRouterPrefetchAbortCount > 0
      ) {
        const completeRecord = await this.#prepareCaptureCompletion(
          identity,
          result,
          scopedCaptureLedger,
        );
        const completedErrorBoundary = await visibleErrorBoundary(input.page);
        const completedLedger = captureEventLedger(
          captureEvents,
          completeRecord,
          new URL(identity.expectedUrl).origin,
          presentationImageEvidence,
          completedErrorBoundary.heading !== null,
          await runtimePostcondition(),
        );
        if (completedLedger.blockingRuntimeFailures.length > 0) {
          throw new Error(
            `P10B-18C active capture has blocking runtime evidence after durable completion: ${completedLedger.blockingRuntimeFailures.join(
              ", ",
            )}`,
          );
        }
        await this.#finalizeCaptureCompletion(identity, result, completedLedger);
      } else {
        if (scopedCaptureLedger.blockingRuntimeFailures.length > 0) {
          throw new Error(
            `P10B-18C active capture has blocking runtime evidence: ${scopedCaptureLedger.blockingRuntimeFailures.join(
              ", ",
            )}`,
          );
        }
        await this.completeCapture(identity, result, scopedCaptureLedger);
      }
      return result;
    } catch (error) {
      await settleRequestFailures();
      await persistSetup();
      const activeBeforeFailure = activeRecord(await readJson(this.activeCapturePath()));
      let actualCapturePath = result?.filename ?? null;
      if (
        activeBeforeFailure &&
        p10b18cHasReachedLifecycleStage(
          activeBeforeFailure.lifecycle.currentStage,
          "capture-started",
        ) &&
        (actualCapturePath === null || actualCapturePath === identity.canonicalFilename)
      ) {
        const expectedScreenshotExists = await stat(resolve(this.#directory, identity.expectedPath))
          .then(() => true)
          .catch(() => false);
        if (expectedScreenshotExists) {
          actualCapturePath = identity.expectedPath;
          await this.#recordScreenshotWritten(identity, actualCapturePath);
        }
      }
      const errorBoundary = await visibleErrorBoundary(input.page);
      presentationImageEvidence ??= await Promise.all(
        presentationImageProbes.map((probe) => probe.collect(input.page)),
      );
      const screenshotRelativePath = `p10b-18c-runtime-failure-${String(
        identity.sequenceIndex,
      ).padStart(3, "0")}-${identity.identityFingerprint}.png`;
      const screenshotAbsolutePath = resolve(this.#directory, screenshotRelativePath);
      const screenshotPath = await input.page
        .screenshot({ path: screenshotAbsolutePath, fullPage: true })
        .then(() => screenshotRelativePath)
        .catch(() => null);
      await this.persistFailureEvidence({
        identity,
        expectedUrl: identity.expectedUrl,
        actualUrl: input.page.url(),
        actualCapturePath,
        httpStatus,
        documentTitle: await input.page.title().catch(() => ""),
        errorBoundaryHeading: errorBoundary.heading,
        errorBoundaryBody: errorBoundary.body,
        captureEvents,
        setupEvents,
        screenshotPath,
        error: error instanceof Error ? `${error.name}:${error.message}` : String(error),
        presentationImageEvidence,
      });
      throw error;
    } finally {
      attribution.finishCapture();
      input.page.off("request", onRequest);
      input.page.off("pageerror", onPageError);
      input.page.off("console", onConsole);
      input.page.off("requestfailed", onRequestFailed);
      input.page.off("response", onResponse);
      input.page.off("requestfinished", onRequestFinished);
      await Promise.all(presentationImageProbes.map((probe) => probe.detach(input.page)));
    }
  }
}
