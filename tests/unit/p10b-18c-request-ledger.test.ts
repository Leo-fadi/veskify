import { describe, expect, it } from "vitest";
import {
  classifyP10B18CRequestLedger,
  type P10B18CFailedRequest,
  type P10B18CNavigationPostcondition,
} from "../helpers/p10b-18c-request-ledger";

const origin = "http://localhost:3141";
const expectedAbort: P10B18CFailedRequest = {
  method: "GET",
  url: `${origin}/projects/example/editor?_rsc=sensitive-runtime-key&token=not-retained`,
  failure: "net::ERR_ABORTED",
  duringExpectedNavigation: true,
};
const ready: P10B18CNavigationPostcondition = {
  intendedOrigin: origin,
  readyStateReached: true,
  renderingReady: true,
  httpStatus: 200,
  pageErrors: [],
  consoleErrors: [],
};
const finalizedReady: P10B18CNavigationPostcondition = {
  ...ready,
  activeExpectedUrlUnchanged: true,
  storefrontRootReady: true,
  errorBoundaryVisible: false,
  failedResponseCount: 0,
  screenshotWritten: true,
};

const capture108PrefetchAbort: P10B18CFailedRequest = {
  eventSequence: 52,
  method: "GET",
  url: `${origin}/projects/project_p10b16l_karvonen_raw/products/lumoava-hali?_rsc=private-runtime-key`,
  failure: "net::ERR_ABORTED",
  duringExpectedNavigation: false,
  metadata: {
    timestamp: "2026-08-21T20:07:58.300Z",
    activeCaptureIdentity: {
      sequenceIndex: 108,
      caseId: "simple-product-heavy-small--minimal-story-airy",
      surfacePageType: "collection",
      expectedRoute: "/collections/yolento",
      viewport: { width: 375, height: 900 },
      locale: "fi",
      identityFingerprint: "p10b18c-active-capture-108",
    },
    activeCaptureLifecycleStage: "storefront-ready",
    sameOrigin: true,
    queryKeyNames: ["_rsc"],
    resourceType: "fetch",
    isNavigationRequest: false,
    frameOrigin: origin,
    framePathname: "/projects/project_p10b16l_karvonen_raw/collections/yolento",
    redirectChainCount: 0,
    startedAfterStorefrontReady: true,
    startedAfterCaptureStarted: false,
    destinationMatchesRenderedLink: true,
    requestHeaders: {
      rsc: { present: true, value: "1" },
      nextRouterPrefetch: { present: true, value: "1" },
      nextRouterStateTree: { present: true, fingerprint: "framework-state-tree" },
      purpose: { present: false },
      secPurpose: { present: false },
      nextUrl: { present: true, value: "/collections/yolento?query-keys=locale" },
    },
  },
};

function classify(
  request: P10B18CFailedRequest,
  postcondition: P10B18CNavigationPostcondition = ready,
) {
  return classifyP10B18CRequestLedger({ requests: [request], postcondition });
}

describe("P10B-18C request-ledger classification", () => {
  it("retains only an expected same-origin navigation RSC abort as sanitized evidence", () => {
    const ledger = classify(expectedAbort);
    expect(ledger.blockingRuntimeFailures).toEqual([]);
    expect(ledger.expectedRscNavigationAbortCount).toBe(1);
    expect(ledger.expectedRscNavigationAborts).toEqual([
      {
        method: "GET",
        origin,
        pathname: "/projects/example/editor",
        failure: "net::ERR_ABORTED",
      },
    ]);
    expect(JSON.stringify(ledger)).not.toContain("sensitive-runtime-key");
    expect(JSON.stringify(ledger)).not.toContain("token=");
  });

  it("blocks requests outside every exact RSC cancellation boundary", () => {
    const invalidRequests: P10B18CFailedRequest[] = [
      { ...expectedAbort, url: `${origin}/projects/example/editor` },
      { ...expectedAbort, url: "https://external.example/editor?_rsc=value" },
      { ...expectedAbort, method: "POST" },
      { ...expectedAbort, failure: "net::ERR_CONNECTION_RESET" },
      { ...expectedAbort, duringExpectedNavigation: false },
      { ...expectedAbort, failure: "net::ERR_CONNECTION_REFUSED" },
    ];
    for (const request of invalidRequests) {
      const ledger = classify(request);
      expect(ledger.expectedRscNavigationAbortCount).toBe(0);
      expect(ledger.blockingRuntimeFailures.length).toBeGreaterThan(0);
    }
  });

  it("blocks expected-looking aborts when navigation postconditions are not clean", () => {
    const invalidPostconditions: P10B18CNavigationPostcondition[] = [
      { ...ready, readyStateReached: false },
      { ...ready, renderingReady: false },
      { ...ready, httpStatus: 404 },
      { ...ready, httpStatus: 500 },
      { ...ready, pageErrors: ["page failed"] },
      { ...ready, consoleErrors: ["console failed"] },
    ];
    for (const postcondition of invalidPostconditions) {
      const ledger = classify(expectedAbort, postcondition);
      expect(ledger.expectedRscNavigationAbortCount).toBe(0);
      expect(ledger.blockingRuntimeFailures.length).toBeGreaterThan(0);
    }
  });

  it("classifies the exact two capture-108 post-ready prefetch aborts separately", () => {
    const ledger = classifyP10B18CRequestLedger({
      requests: [
        capture108PrefetchAbort,
        {
          ...capture108PrefetchAbort,
          eventSequence: 53,
          url: `${origin}/projects/project_p10b16l_karvonen_raw/products/kohinoor-duetto?_rsc=second-private-key&locale=fi`,
        },
      ],
      postcondition: finalizedReady,
    });
    expect(ledger.blockingRuntimeFailures).toEqual([]);
    expect(ledger.expectedRscNavigationAbortCount).toBe(0);
    expect(ledger.expectedNextAppRouterPrefetchAbortCount).toBe(2);
    expect(
      ledger.expectedNextAppRouterPrefetchAborts.map(({ eventSequence }) => eventSequence),
    ).toEqual([52, 53]);
  });

  it("keeps an RSC abort without the prefetch header blocking outside deliberate navigation", () => {
    const withoutPrefetch = {
      ...capture108PrefetchAbort,
      metadata: {
        ...capture108PrefetchAbort.metadata!,
        requestHeaders: {
          ...capture108PrefetchAbort.metadata!.requestHeaders,
          nextRouterPrefetch: { present: false },
        },
      },
    };
    expect(classify(withoutPrefetch, finalizedReady).blockingRuntimeFailures).not.toEqual([]);
    expect(
      classify({ ...withoutPrefetch, duringExpectedNavigation: true }, ready)
        .expectedRscNavigationAbortCount,
    ).toBe(1);
  });

  it("keeps a non-RSC prefetch abort blocking", () => {
    const ledger = classify(
      { ...capture108PrefetchAbort, url: `${origin}/products/lumoava-hali` },
      finalizedReady,
    );
    expect(ledger.expectedNextAppRouterPrefetchAbortCount).toBe(0);
    expect(ledger.blockingRuntimeFailures).not.toEqual([]);
  });

  it("keeps a top-level navigation abort blocking", () => {
    const ledger = classify(
      {
        ...capture108PrefetchAbort,
        metadata: {
          ...capture108PrefetchAbort.metadata!,
          resourceType: "document",
          isNavigationRequest: true,
        },
      },
      finalizedReady,
    );
    expect(ledger.expectedNextAppRouterPrefetchAbortCount).toBe(0);
    expect(ledger.blockingRuntimeFailures).not.toEqual([]);
  });

  it("keeps a pre-ready prefetch abort blocking", () => {
    const ledger = classify(
      {
        ...capture108PrefetchAbort,
        metadata: {
          ...capture108PrefetchAbort.metadata!,
          activeCaptureLifecycleStage: "response-received",
          startedAfterStorefrontReady: false,
        },
      },
      finalizedReady,
    );
    expect(ledger.expectedNextAppRouterPrefetchAbortCount).toBe(0);
    expect(ledger.blockingRuntimeFailures).not.toEqual([]);
  });

  it("keeps prefetch aborts blocking when page, console, HTTP, boundary, or URL health fails", () => {
    const invalidPostconditions: P10B18CNavigationPostcondition[] = [
      { ...finalizedReady, pageErrors: ["page failed"] },
      { ...finalizedReady, consoleErrors: ["console failed"] },
      { ...finalizedReady, failedResponseCount: 1 },
      { ...finalizedReady, errorBoundaryVisible: true },
      { ...finalizedReady, activeExpectedUrlUnchanged: false },
      { ...finalizedReady, storefrontRootReady: false },
    ];
    for (const postcondition of invalidPostconditions) {
      const ledger = classify(capture108PrefetchAbort, postcondition);
      expect(ledger.expectedNextAppRouterPrefetchAbortCount).toBe(0);
      expect(ledger.nonDeferredBlockingRuntimeFailures).not.toEqual([]);
    }
  });

  it("retains expected prefetch evidence without retaining sensitive query values", () => {
    const ledger = classify(capture108PrefetchAbort, finalizedReady);
    expect(ledger.expectedNextAppRouterPrefetchAborts).toEqual([
      expect.objectContaining({
        eventSequence: 52,
        method: "GET",
        origin,
        pathname: "/projects/project_p10b16l_karvonen_raw/products/lumoava-hali",
        failure: "net::ERR_ABORTED",
      }),
    ]);
    expect(JSON.stringify(ledger)).not.toContain("private-runtime-key");
  });

  it("defers an exact prefetch candidate until screenshot completion", () => {
    const pending = classify(capture108PrefetchAbort, {
      ...finalizedReady,
      screenshotWritten: false,
    });
    expect(pending.pendingNextAppRouterPrefetchAbortCount).toBe(1);
    expect(pending.expectedNextAppRouterPrefetchAbortCount).toBe(0);
    expect(pending.nonDeferredBlockingRuntimeFailures).toEqual([]);
    expect(
      classify(capture108PrefetchAbort, finalizedReady).expectedNextAppRouterPrefetchAbortCount,
    ).toBe(1);
  });
});
