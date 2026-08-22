import { describe, expect, it } from "vitest";
import {
  classifyP10B18CPresentationImageEvidence,
  type P10B18CPresentationImageCompletion,
  type P10B18CPresentationImageElementRecord,
  type P10B18CPresentationImageEvidence,
  type P10B18CPresentationImageRequestRecord,
} from "../helpers/p10b-18c-presentation-image-evidence";

const origin = "http://localhost:3142";
const activeIdentity = "p10b18c-active-capture-122";
const placementIdentity = "p10b18c-shared-frame-logo-placement";
const logoAssetId = "asset-approved-logo";
const logoFingerprint = "approved-logo-fingerprint";
const logoUrlFingerprint = "approved-logo-url-fingerprint";

function request(
  overrides: Partial<P10B18CPresentationImageRequestRecord> = {},
): P10B18CPresentationImageRequestRecord {
  return {
    eventSequence: 1,
    captureIdentityFingerprint: activeIdentity,
    captureScope: "capture",
    requestStartedAt: "2026-08-21T08:38:59.827Z",
    requestSettledAt: "2026-08-21T08:38:59.900Z",
    activeCaptureLifecycleStage: "navigation-started",
    method: "GET",
    requestOrigin: origin,
    requestPathname: "/seed-assets/logo.svg",
    logicalAssetPathname: "/seed-assets/logo.svg",
    requestUrlFingerprint: logoUrlFingerprint,
    resourceType: "image",
    isNavigationRequest: false,
    initiatorType: null,
    frameOrigin: origin,
    framePathname: "/projects/example/search",
    responseStatus: null,
    responseCompleted: false,
    servedFromMemoryCache: null,
    servedFromDiskCache: null,
    servedFromServiceWorker: false,
    failureText: "net::ERR_ABORTED",
    redirectCount: 0,
    approvedAssetId: logoAssetId,
    approvedMaterialFingerprint: logoFingerprint,
    approvedSourceAuthorityKind: "approved-presentation",
    ...overrides,
  };
}

function successfulRequest(
  overrides: Partial<P10B18CPresentationImageRequestRecord> = {},
): P10B18CPresentationImageRequestRecord {
  return request({
    eventSequence: 2,
    responseStatus: 200,
    responseCompleted: true,
    failureText: null,
    ...overrides,
  });
}

function element(
  overrides: Partial<P10B18CPresentationImageElementRecord> = {},
): P10B18CPresentationImageElementRecord {
  return {
    elementIndex: 0,
    frameOrigin: origin,
    framePathname: "/projects/example/search",
    src: "/seed-assets/logo.svg",
    currentSrc: "/seed-assets/logo.svg",
    srcset: "",
    sizes: "64rem",
    complete: true,
    naturalWidth: 320,
    naturalHeight: 96,
    boundingBox: { x: 40, y: 20, width: 160, height: 48 },
    visible: true,
    decodedSuccessfully: true,
    brokenImageState: false,
    approvedAssetId: logoAssetId,
    approvedMaterialFingerprint: logoFingerprint,
    selectedSourceAuthorityKind: "approved-presentation",
    selectedSourceUrlFingerprint: logoUrlFingerprint,
    sourceValidForViewport: true,
    placementIdentity,
    placementContext: "sharedFrame",
    placementPurpose: "brand-identity",
    sharedFramePlacementIdentity: placementIdentity,
    insideSharedFrameHeader: true,
    responsiveSourceSelectionChanged: false,
    renderedArtDirectionFingerprint: null,
    ...overrides,
  };
}

function evidence(
  overrides: Partial<P10B18CPresentationImageEvidence> = {},
): P10B18CPresentationImageEvidence {
  const requests = overrides.requests ?? [request(), successfulRequest()];
  const elements = overrides.elements ?? [element()];
  return {
    activeCaptureIdentityFingerprint: activeIdentity,
    intendedOrigin: origin,
    viewportWidth: 1440,
    retainForDiagnosis: true,
    probeLifecycleSettled: true,
    activeViewportBreakpoint: "wide",
    activeSourceAssetIds: [logoAssetId],
    inactiveSourceAssetIds: [],
    authority: {
      pageId: "shared-frame",
      componentId: "header",
      assetId: logoAssetId,
      role: "logo",
      revision: "1",
      materialFingerprint: logoFingerprint,
      placementIdentity,
      placementContext: "sharedFrame",
      placementPurpose: "brand-identity",
      componentType: "header",
      assetSlotId: "brandLogo",
      expectedVisible: true,
      artDirectionFingerprint: null,
      sources: [
        {
          assetId: logoAssetId,
          role: "logo",
          revision: "1",
          materialFingerprint: logoFingerprint,
          authorityKind: "approved-presentation",
          approvedOrigin: origin,
          approvedPathname: "/seed-assets/logo.svg",
          approvedUrlFingerprint: logoUrlFingerprint,
          breakpoints: ["mobile", "tablet", "desktop", "wide"],
        },
      ],
    },
    requests,
    requestSummary: {
      startedCount: requests.length,
      completedCount: requests.filter(({ responseCompleted }) => responseCompleted).length,
      failedCount: requests.filter(({ failureText }) => failureText !== null).length,
      duplicateExactUrlCount: 1,
      logicalAssetRequestCount: requests.length,
    },
    elements,
    elementCount: elements.length,
    elementReplacementObserved: false,
    responsiveSourceMutationObserved: false,
    ...overrides,
  };
}

function completion(
  overrides: Partial<P10B18CPresentationImageCompletion> = {},
): P10B18CPresentationImageCompletion {
  return {
    lifecycleStage: "capture-complete",
    screenshotWritten: true,
    manifestPersisted: true,
    storefrontReady: true,
    httpStatus: 200,
    pageErrorCount: 0,
    consoleErrorCount: 0,
    failedResponseCount: 0,
    errorBoundaryVisible: false,
    ...overrides,
  };
}

function classify(evidenceValue = evidence(), completionValue = completion()) {
  return classifyP10B18CPresentationImageEvidence({
    evidence: evidenceValue,
    completion: completionValue,
  });
}

describe("P10B-18C presentation-image request classification", () => {
  it("accepts a duplicate exact-URL cancellation only after durable capture completion", () => {
    const pending = classify(
      evidence(),
      completion({
        lifecycleStage: "capture-started",
        screenshotWritten: true,
        manifestPersisted: false,
      }),
    );
    expect(pending.expectedSupersededPresentationImageAbortCount).toBe(0);
    expect(pending.pendingPresentationImageAbortCount).toBe(1);
    expect(classify().expectedSupersededPresentationImageAborts).toEqual([
      expect.objectContaining({ rootClass: "A", replacementRelation: "same-exact-url" }),
    ]);
  });

  it("accepts responsive supersession only within one approved placement and viewport", () => {
    const responsiveAssetId = "asset-approved-logo-wide";
    const responsiveFingerprint = "approved-logo-wide-fingerprint";
    const responsiveUrlFingerprint = "approved-logo-wide-url-fingerprint";
    const base = evidence();
    const value = evidence({
      authority: {
        ...base.authority,
        artDirectionFingerprint: "approved-art-direction",
        sources: [
          { ...base.authority.sources[0], breakpoints: ["mobile", "tablet", "desktop"] },
          {
            assetId: responsiveAssetId,
            role: "logo",
            revision: "1",
            materialFingerprint: responsiveFingerprint,
            authorityKind: "approved-presentation",
            approvedOrigin: origin,
            approvedPathname: "/seed-assets/logo-wide.svg",
            approvedUrlFingerprint: responsiveUrlFingerprint,
            breakpoints: ["wide"],
          },
        ],
      },
      requests: [
        request(),
        successfulRequest({
          approvedAssetId: responsiveAssetId,
          approvedMaterialFingerprint: responsiveFingerprint,
          requestPathname: "/seed-assets/logo-wide.svg",
          logicalAssetPathname: "/seed-assets/logo-wide.svg",
          requestUrlFingerprint: responsiveUrlFingerprint,
        }),
      ],
      elements: [
        element({
          currentSrc: "/seed-assets/logo-wide.svg",
          approvedAssetId: responsiveAssetId,
          approvedMaterialFingerprint: responsiveFingerprint,
          selectedSourceUrlFingerprint: responsiveUrlFingerprint,
          responsiveSourceSelectionChanged: true,
          renderedArtDirectionFingerprint: "approved-art-direction",
        }),
      ],
    });
    expect(classify(value).expectedSupersededPresentationImageAborts).toEqual([
      expect.objectContaining({ rootClass: "B", replacementRelation: "responsive-source" }),
    ]);
  });

  it("accepts a mobile source abort at 1024 when the approved desktop source is decoded", () => {
    const mobileAssetId = "asset-approved-hero-mobile";
    const mobileFingerprint = "approved-hero-mobile-fingerprint";
    const base = evidence();
    const value = evidence({
      viewportWidth: 1024,
      activeViewportBreakpoint: "desktop",
      activeSourceAssetIds: [logoAssetId],
      inactiveSourceAssetIds: [mobileAssetId],
      authority: {
        ...base.authority,
        placementContext: "page",
        placementPurpose: "hero-primary",
        componentType: "homepageHero",
        assetSlotId: "heroMedia",
        artDirectionFingerprint: "hero-art-direction",
        sources: [
          { ...base.authority.sources[0], breakpoints: ["desktop", "wide"] },
          {
            assetId: mobileAssetId,
            role: "heroMobile",
            revision: "1",
            materialFingerprint: mobileFingerprint,
            authorityKind: "approved-presentation",
            approvedOrigin: origin,
            approvedPathname: "/seed-assets/hero-mobile.svg",
            approvedUrlFingerprint: "hero-mobile-url",
            breakpoints: ["mobile", "tablet"],
          },
        ],
      },
      requests: [
        request({
          approvedAssetId: mobileAssetId,
          approvedMaterialFingerprint: mobileFingerprint,
          requestUrlFingerprint: "hero-mobile-url",
        }),
      ],
      elements: [
        element({
          placementContext: "page",
          placementPurpose: "hero-primary",
          insideSharedFrameHeader: false,
          sharedFramePlacementIdentity: null,
          renderedArtDirectionFingerprint: "hero-art-direction",
        }),
      ],
    });
    expect(classify(value).expectedSupersededPresentationImageAborts).toEqual([
      expect.objectContaining({ rootClass: "B", replacementRelation: "responsive-source" }),
    ]);
  });

  it("accepts a desktop source abort at 375 when the approved mobile source is decoded", () => {
    const mobileAssetId = "asset-approved-hero-mobile";
    const mobileFingerprint = "approved-hero-mobile-fingerprint";
    const base = evidence();
    const value = evidence({
      viewportWidth: 375,
      activeViewportBreakpoint: "mobile",
      activeSourceAssetIds: [mobileAssetId],
      inactiveSourceAssetIds: [logoAssetId],
      authority: {
        ...base.authority,
        placementContext: "page",
        placementPurpose: "hero-primary",
        componentType: "homepageHero",
        assetSlotId: "heroMedia",
        artDirectionFingerprint: "hero-art-direction",
        sources: [
          { ...base.authority.sources[0], breakpoints: ["desktop", "wide"] },
          {
            assetId: mobileAssetId,
            role: "heroMobile",
            revision: "1",
            materialFingerprint: mobileFingerprint,
            authorityKind: "approved-presentation",
            approvedOrigin: origin,
            approvedPathname: "/seed-assets/hero-mobile.svg",
            approvedUrlFingerprint: "hero-mobile-url",
            breakpoints: ["mobile", "tablet"],
          },
        ],
      },
      requests: [request()],
      elements: [
        element({
          approvedAssetId: mobileAssetId,
          approvedMaterialFingerprint: mobileFingerprint,
          selectedSourceUrlFingerprint: "hero-mobile-url",
          placementContext: "page",
          placementPurpose: "hero-primary",
          insideSharedFrameHeader: false,
          sharedFramePlacementIdentity: null,
          responsiveSourceSelectionChanged: true,
          renderedArtDirectionFingerprint: "hero-art-direction",
        }),
      ],
    });
    expect(classify(value).expectedSupersededPresentationImageAbortCount).toBe(1);
  });

  it("accepts an incomplete hidden duplicate logo when the visible approved logo decoded", () => {
    const value = evidence({
      requests: [request()],
      elements: [
        element(),
        element({
          elementIndex: 1,
          complete: false,
          naturalWidth: 0,
          naturalHeight: 0,
          boundingBox: { x: 0, y: 0, width: 0, height: 0 },
          visible: false,
          decodedSuccessfully: false,
          brokenImageState: false,
        }),
      ],
    });
    expect(classify(value).expectedSupersededPresentationImageAbortCount).toBe(1);
  });

  it("accepts a same-URL duplicate abort through one healthy decoded consumer", () => {
    expect(
      classify(evidence({ requests: [request()], elements: [element()] }))
        .expectedSupersededPresentationImageAborts,
    ).toEqual([expect.objectContaining({ rootClass: "A", replacementEventSequence: null })]);
  });

  it("keeps an aborted image without a successful replacement blocking", () => {
    expect(classify(evidence({ requests: [request()], elements: [] })).classifications).toEqual([
      expect.objectContaining({ rootClass: "D", disposition: "blocking" }),
    ]);
  });

  it("keeps an incomplete final image blocking", () => {
    expect(
      classify(evidence({ elements: [element({ complete: false, brokenImageState: true })] }))
        .expectedSupersededPresentationImageAbortCount,
    ).toBe(0);
  });

  it("keeps zero natural dimensions blocking", () => {
    expect(
      classify(
        evidence({
          elements: [element({ naturalWidth: 0, naturalHeight: 0, brokenImageState: true })],
        }),
      ).expectedSupersededPresentationImageAbortCount,
    ).toBe(0);
  });

  it("keeps a decode failure blocking", () => {
    expect(
      classify(
        evidence({ elements: [element({ decodedSuccessfully: false, brokenImageState: true })] }),
      ).expectedSupersededPresentationImageAbortCount,
    ).toBe(0);
  });

  it("keeps invisible or zero-size final geometry blocking", () => {
    for (const invalid of [
      element({ visible: false, brokenImageState: true }),
      element({ boundingBox: { x: 0, y: 0, width: 0, height: 0 }, brokenImageState: true }),
    ]) {
      expect(
        classify(evidence({ elements: [invalid] })).expectedSupersededPresentationImageAbortCount,
      ).toBe(0);
    }
  });

  it("keeps a different unapproved replacement asset blocking", () => {
    expect(
      classify(
        evidence({
          requests: [
            request(),
            successfulRequest({
              approvedAssetId: "asset-unapproved",
              approvedMaterialFingerprint: "unapproved",
              requestUrlFingerprint: "unapproved-url",
            }),
          ],
          elements: [
            element({
              approvedAssetId: "asset-unapproved",
              approvedMaterialFingerprint: "unapproved",
              selectedSourceUrlFingerprint: "unapproved-url",
              placementIdentity: null,
            }),
          ],
        }),
      ).expectedSupersededPresentationImageAbortCount,
    ).toBe(0);
  });

  it("never accepts canonical product media as replacement logo authority", () => {
    const productAssetId = "canonical-product-media";
    const productFingerprint = "canonical-product-fingerprint";
    const base = evidence();
    const value = evidence({
      authority: {
        ...base.authority,
        artDirectionFingerprint: "approved-art-direction",
        sources: [
          ...base.authority.sources,
          {
            assetId: productAssetId,
            role: "product",
            revision: "1",
            materialFingerprint: productFingerprint,
            authorityKind: "canonical-product-media",
            approvedOrigin: origin,
            approvedPathname: "/product-media/ring.svg",
            approvedUrlFingerprint: "product-url",
            breakpoints: ["wide"],
          },
        ],
      },
      requests: [
        request(),
        successfulRequest({
          approvedAssetId: productAssetId,
          approvedMaterialFingerprint: productFingerprint,
          approvedSourceAuthorityKind: "canonical-product-media",
          requestUrlFingerprint: "product-url",
        }),
      ],
      elements: [
        element({
          approvedAssetId: productAssetId,
          approvedMaterialFingerprint: productFingerprint,
          selectedSourceAuthorityKind: "canonical-product-media",
          selectedSourceUrlFingerprint: "product-url",
          responsiveSourceSelectionChanged: true,
          renderedArtDirectionFingerprint: "approved-art-direction",
        }),
      ],
    });
    expect(classify(value).expectedSupersededPresentationImageAbortCount).toBe(0);
  });

  it("keeps a cross-origin image abort blocking", () => {
    expect(
      classify(evidence({ requests: [request({ requestOrigin: "https://outside.example" })] }))
        .expectedSupersededPresentationImageAbortCount,
    ).toBe(0);
  });

  it("keeps a non-image abort blocking", () => {
    expect(
      classify(evidence({ requests: [request({ resourceType: "fetch" })] }))
        .expectedSupersededPresentationImageAbortCount,
    ).toBe(0);
  });

  it("keeps non-GET and navigation image aborts blocking", () => {
    for (const invalid of [request({ method: "POST" }), request({ isNavigationRequest: true })]) {
      expect(
        classify(evidence({ requests: [invalid] })).expectedSupersededPresentationImageAbortCount,
      ).toBe(0);
    }
  });

  it("keeps every failure other than exact net::ERR_ABORTED blocking", () => {
    expect(
      classify(evidence({ requests: [request({ failureText: "net::ERR_FAILED" })] }))
        .expectedSupersededPresentationImageAbortCount,
    ).toBe(0);
  });

  it("keeps page, console, HTTP and visible error-boundary failures blocking", () => {
    const dirty = [
      completion({ pageErrorCount: 1 }),
      completion({ consoleErrorCount: 1 }),
      completion({ httpStatus: 500, failedResponseCount: 1 }),
      completion({ errorBoundaryVisible: true }),
    ];
    dirty.forEach((postcondition) => {
      expect(
        classify(evidence(), postcondition).expectedSupersededPresentationImageAbortCount,
      ).toBe(0);
    });
  });

  it("separates setup, previous and next-capture requests from the active capture", () => {
    for (const escaped of [
      request({ captureScope: "setup" }),
      request({ captureIdentityFingerprint: "previous-capture" }),
      request({ captureIdentityFingerprint: "next-capture" }),
    ]) {
      const result = classify(evidence({ requests: [escaped] }));
      expect(result.presentationImageAttributionLeaks).toEqual([
        expect.objectContaining({ rootClass: "C", disposition: "outside-active-capture" }),
      ]);
      expect(result.expectedSupersededPresentationImageAbortCount).toBe(0);
    }
  });

  it("retains expected cancellations without exposing token or environment material", () => {
    const result = classify();
    expect(result.expectedSupersededPresentationImageAbortCount).toBe(1);
    const serialized = JSON.stringify(result);
    expect(serialized).not.toMatch(/token|secret|authorization|process\.env/iu);
  });
});
