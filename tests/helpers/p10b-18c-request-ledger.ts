import {
  classifyP10B18CPresentationImageEvidence,
  type P10B18CPresentationImageCompletion,
  type P10B18CPresentationImageEvidence,
} from "./p10b-18c-presentation-image-evidence";

export type P10B18CFailedRequest = Readonly<{
  eventSequence?: number;
  method: string;
  url: string;
  failure: string;
  duringExpectedNavigation: boolean;
  metadata?: P10B18CFailedRequestMetadata;
}>;

export type P10B18CFrameworkHeaderEvidence = Readonly<{
  present: boolean;
  value?: string;
  fingerprint?: string;
}>;

export type P10B18CFailedRequestMetadata = Readonly<{
  timestamp: string;
  activeCaptureIdentity: Readonly<{
    sequenceIndex: number;
    caseId: string;
    surfacePageType: string;
    expectedRoute: string;
    viewport: Readonly<{ width: number; height: number }>;
    locale: "en" | "fi";
    identityFingerprint: string;
  }>;
  activeCaptureLifecycleStage: string;
  sameOrigin: boolean;
  queryKeyNames: readonly string[];
  resourceType: string;
  isNavigationRequest: boolean;
  frameOrigin: string | null;
  framePathname: string | null;
  redirectChainCount: number;
  startedAfterStorefrontReady: boolean;
  startedAfterCaptureStarted: boolean;
  destinationMatchesRenderedLink: boolean;
  requestHeaders: Readonly<{
    rsc: P10B18CFrameworkHeaderEvidence;
    nextRouterPrefetch: P10B18CFrameworkHeaderEvidence;
    nextRouterStateTree: P10B18CFrameworkHeaderEvidence;
    purpose: P10B18CFrameworkHeaderEvidence;
    secPurpose: P10B18CFrameworkHeaderEvidence;
    nextUrl: P10B18CFrameworkHeaderEvidence;
  }>;
}>;

export type P10B18CNavigationPostcondition = Readonly<{
  intendedOrigin: string;
  readyStateReached: boolean;
  renderingReady: boolean;
  httpStatus: number | null;
  pageErrors: readonly string[];
  consoleErrors: readonly string[];
  activeExpectedUrlUnchanged?: boolean;
  storefrontRootReady?: boolean;
  errorBoundaryVisible?: boolean;
  failedResponseCount?: number;
  screenshotWritten?: boolean;
  presentationImageCompletion?: P10B18CPresentationImageCompletion;
}>;

export type P10B18CSanitizedRequestFailure = Readonly<{
  eventSequence?: number;
  method: string;
  origin: string;
  pathname: string;
  failure: string;
  metadata?: P10B18CFailedRequestMetadata;
}>;

export type P10B18CRequestLedger = Readonly<{
  expectedRscNavigationAborts: readonly P10B18CSanitizedRequestFailure[];
  expectedRscNavigationAbortCount: number;
  expectedNextAppRouterPrefetchAborts: readonly P10B18CSanitizedRequestFailure[];
  expectedNextAppRouterPrefetchAbortCount: number;
  pendingNextAppRouterPrefetchAborts: readonly P10B18CSanitizedRequestFailure[];
  pendingNextAppRouterPrefetchAbortCount: number;
  expectedSupersededPresentationImageAborts: ReturnType<
    typeof classifyP10B18CPresentationImageEvidence
  >["expectedSupersededPresentationImageAborts"];
  expectedSupersededPresentationImageAbortCount: number;
  pendingPresentationImageAborts: ReturnType<
    typeof classifyP10B18CPresentationImageEvidence
  >["pendingPresentationImageAborts"];
  pendingPresentationImageAbortCount: number;
  presentationImageAttributionLeaks: ReturnType<
    typeof classifyP10B18CPresentationImageEvidence
  >["presentationImageAttributionLeaks"];
  presentationImageAttributionLeakCount: number;
  blockingRuntimeFailures: readonly string[];
  nonDeferredBlockingRuntimeFailures: readonly string[];
}>;

function safeText(value: string, maximum = 160): string {
  return value
    .replace(/\b(token|secret|authorization|api[-_]?key)\s*[:=]\s*[^\s,;]+/giu, "$1=<redacted>")
    .replace(/\s+/gu, " ")
    .trim()
    .slice(0, maximum);
}

function safeHeaderEvidence(
  evidence: P10B18CFrameworkHeaderEvidence,
): P10B18CFrameworkHeaderEvidence {
  return {
    present: evidence.present,
    ...(evidence.value === undefined ? {} : { value: safeText(evidence.value, 120) }),
    ...(evidence.fingerprint === undefined
      ? {}
      : { fingerprint: safeText(evidence.fingerprint, 160) }),
  };
}

function safeMetadata(metadata: P10B18CFailedRequestMetadata): P10B18CFailedRequestMetadata {
  return {
    timestamp: safeText(metadata.timestamp, 40),
    activeCaptureIdentity: {
      ...metadata.activeCaptureIdentity,
      caseId: safeText(metadata.activeCaptureIdentity.caseId),
      surfacePageType: safeText(metadata.activeCaptureIdentity.surfacePageType),
      expectedRoute: safeText(metadata.activeCaptureIdentity.expectedRoute),
      identityFingerprint: safeText(metadata.activeCaptureIdentity.identityFingerprint),
    },
    activeCaptureLifecycleStage: safeText(metadata.activeCaptureLifecycleStage, 40),
    sameOrigin: metadata.sameOrigin,
    queryKeyNames: [...new Set(metadata.queryKeyNames.map((key) => safeText(key, 80)))].sort(),
    resourceType: safeText(metadata.resourceType, 40),
    isNavigationRequest: metadata.isNavigationRequest,
    frameOrigin: metadata.frameOrigin === null ? null : safeText(metadata.frameOrigin, 160),
    framePathname: metadata.framePathname === null ? null : safeText(metadata.framePathname, 240),
    redirectChainCount: metadata.redirectChainCount,
    startedAfterStorefrontReady: metadata.startedAfterStorefrontReady,
    startedAfterCaptureStarted: metadata.startedAfterCaptureStarted,
    destinationMatchesRenderedLink: metadata.destinationMatchesRenderedLink,
    requestHeaders: {
      rsc: safeHeaderEvidence(metadata.requestHeaders.rsc),
      nextRouterPrefetch: safeHeaderEvidence(metadata.requestHeaders.nextRouterPrefetch),
      nextRouterStateTree: safeHeaderEvidence(metadata.requestHeaders.nextRouterStateTree),
      purpose: safeHeaderEvidence(metadata.requestHeaders.purpose),
      secPurpose: safeHeaderEvidence(metadata.requestHeaders.secPurpose),
      nextUrl: safeHeaderEvidence(metadata.requestHeaders.nextUrl),
    },
  };
}

export function sanitizeP10B18CRequestFailure(
  request: P10B18CFailedRequest,
): P10B18CSanitizedRequestFailure {
  const url = new URL(request.url);
  return {
    ...(request.eventSequence === undefined ? {} : { eventSequence: request.eventSequence }),
    method: request.method,
    origin: url.origin,
    pathname: url.pathname,
    failure: safeText(request.failure),
    ...(request.metadata === undefined ? {} : { metadata: safeMetadata(request.metadata) }),
  };
}

export function classifyP10B18CRequestLedger(input: {
  requests: readonly P10B18CFailedRequest[];
  postcondition: P10B18CNavigationPostcondition;
  presentationImageEvidence?: readonly P10B18CPresentationImageEvidence[];
}): P10B18CRequestLedger {
  const blockingRuntimeFailures: string[] = [];
  const nonDeferredBlockingRuntimeFailures: string[] = [];
  const placementClassifications =
    input.presentationImageEvidence && input.postcondition.presentationImageCompletion
      ? input.presentationImageEvidence.map((evidence) =>
          classifyP10B18CPresentationImageEvidence({
            evidence,
            completion: input.postcondition.presentationImageCompletion!,
          }),
        )
      : [];
  const allClassifications = placementClassifications.flatMap(
    ({ classifications }) => classifications,
  );
  const blockingPresentationSequences = new Set(
    allClassifications
      .filter(({ disposition }) => disposition === "blocking")
      .map(({ eventSequence }) => eventSequence),
  );
  const uniqueBySequence = <T extends Readonly<{ eventSequence: number }>>(
    values: readonly T[],
  ): T[] => [...new Map(values.map((value) => [value.eventSequence, value] as const)).values()];
  const expectedPresentationAborts = uniqueBySequence(
    placementClassifications
      .flatMap(
        ({ expectedSupersededPresentationImageAborts }) =>
          expectedSupersededPresentationImageAborts,
      )
      .filter(({ eventSequence }) => !blockingPresentationSequences.has(eventSequence)),
  );
  const pendingPresentationAborts = uniqueBySequence(
    placementClassifications
      .flatMap(({ pendingPresentationImageAborts }) => pendingPresentationImageAborts)
      .filter(({ eventSequence }) => !blockingPresentationSequences.has(eventSequence)),
  );
  const presentationImageAttributionLeaks = uniqueBySequence(
    placementClassifications.flatMap(
      ({ presentationImageAttributionLeaks }) => presentationImageAttributionLeaks,
    ),
  );
  const expectedPresentationSequences = new Set(
    expectedPresentationAborts.map(({ eventSequence }) => eventSequence),
  );
  const pendingPresentationSequences = new Set(
    pendingPresentationAborts.map(({ eventSequence }) => eventSequence),
  );
  const attributionLeakSequences = new Set(
    presentationImageAttributionLeaks.map(({ eventSequence }) => eventSequence),
  );
  const block = (message: string, deferred = false) => {
    blockingRuntimeFailures.push(message);
    if (!deferred) nonDeferredBlockingRuntimeFailures.push(message);
  };
  const postconditionReady =
    input.postcondition.readyStateReached &&
    input.postcondition.renderingReady &&
    input.postcondition.httpStatus !== null &&
    input.postcondition.httpStatus >= 200 &&
    input.postcondition.httpStatus < 400 &&
    input.postcondition.pageErrors.length === 0 &&
    input.postcondition.consoleErrors.length === 0;

  if (!input.postcondition.readyStateReached) block("navigation-not-ready");
  if (!input.postcondition.renderingReady) block("rendering-not-ready");
  if (
    input.postcondition.httpStatus === null ||
    input.postcondition.httpStatus < 200 ||
    input.postcondition.httpStatus >= 400
  ) {
    block(`http-status:${input.postcondition.httpStatus ?? "missing"}`);
  }
  input.postcondition.pageErrors.forEach((error) => block(`page-error:${error}`));
  input.postcondition.consoleErrors.forEach((error) => block(`console-error:${error}`));

  const expectedRscNavigationAborts: P10B18CSanitizedRequestFailure[] = [];
  const expectedNextAppRouterPrefetchAborts: P10B18CSanitizedRequestFailure[] = [];
  const pendingNextAppRouterPrefetchAborts: P10B18CSanitizedRequestFailure[] = [];
  for (const request of input.requests) {
    const url = new URL(request.url);
    const expectedNavigationAbort =
      postconditionReady &&
      request.duringExpectedNavigation &&
      request.method === "GET" &&
      url.origin === input.postcondition.intendedOrigin &&
      url.searchParams.has("_rsc") &&
      request.failure === "net::ERR_ABORTED";
    const metadata = request.metadata;
    const exactNextAppRouterPrefetchShape =
      !request.duringExpectedNavigation &&
      request.method === "GET" &&
      url.origin === input.postcondition.intendedOrigin &&
      url.searchParams.has("_rsc") &&
      request.failure === "net::ERR_ABORTED" &&
      metadata !== undefined &&
      metadata.sameOrigin &&
      metadata.resourceType === "fetch" &&
      !metadata.isNavigationRequest &&
      metadata.startedAfterStorefrontReady &&
      metadata.requestHeaders.rsc.present &&
      metadata.requestHeaders.rsc.value === "1" &&
      metadata.requestHeaders.nextRouterPrefetch.present &&
      metadata.requestHeaders.nextRouterPrefetch.value === "1";
    const cleanNextAppRouterPrefetchPostcondition =
      postconditionReady &&
      input.postcondition.activeExpectedUrlUnchanged === true &&
      input.postcondition.storefrontRootReady === true &&
      input.postcondition.errorBoundaryVisible === false &&
      input.postcondition.failedResponseCount === 0;
    const expectedNextAppRouterPrefetchAbort =
      exactNextAppRouterPrefetchShape &&
      cleanNextAppRouterPrefetchPostcondition &&
      input.postcondition.screenshotWritten === true;
    const pendingNextAppRouterPrefetchAbort =
      exactNextAppRouterPrefetchShape &&
      cleanNextAppRouterPrefetchPostcondition &&
      input.postcondition.screenshotWritten !== true;
    const sanitized = sanitizeP10B18CRequestFailure(request);
    if (expectedNavigationAbort) expectedRscNavigationAborts.push(sanitized);
    else if (expectedNextAppRouterPrefetchAbort) {
      expectedNextAppRouterPrefetchAborts.push(sanitized);
    } else if (pendingNextAppRouterPrefetchAbort) {
      pendingNextAppRouterPrefetchAborts.push(sanitized);
      block(
        `request-failure:${sanitized.method}:${sanitized.origin}${sanitized.pathname}:${sanitized.failure}`,
        true,
      );
    } else if (
      request.eventSequence !== undefined &&
      (expectedPresentationSequences.has(request.eventSequence) ||
        attributionLeakSequences.has(request.eventSequence))
    ) {
      continue;
    } else {
      block(
        `request-failure:${sanitized.method}:${sanitized.origin}${sanitized.pathname}:${sanitized.failure}`,
        request.eventSequence !== undefined &&
          pendingPresentationSequences.has(request.eventSequence),
      );
    }
  }

  return {
    expectedRscNavigationAborts,
    expectedRscNavigationAbortCount: expectedRscNavigationAborts.length,
    expectedNextAppRouterPrefetchAborts,
    expectedNextAppRouterPrefetchAbortCount: expectedNextAppRouterPrefetchAborts.length,
    pendingNextAppRouterPrefetchAborts,
    pendingNextAppRouterPrefetchAbortCount: pendingNextAppRouterPrefetchAborts.length,
    expectedSupersededPresentationImageAborts: expectedPresentationAborts,
    expectedSupersededPresentationImageAbortCount: expectedPresentationAborts.length,
    pendingPresentationImageAborts: pendingPresentationAborts,
    pendingPresentationImageAbortCount: pendingPresentationAborts.length,
    presentationImageAttributionLeaks,
    presentationImageAttributionLeakCount: presentationImageAttributionLeaks.length,
    blockingRuntimeFailures,
    nonDeferredBlockingRuntimeFailures,
  };
}
