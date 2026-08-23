import type { Page, Request, Response } from "@playwright/test";
import {
  canonicalValueFingerprint,
  type ApprovedAssetPlacementOperation,
  type ApprovedAssetPlacementPurpose,
  type ApprovedAssetPresentation,
  type PageType,
  type SectionInstance,
  type StorefrontSnapshot,
} from "@/domain/storefront";

export type P10B18CResponsiveBreakpoint = "mobile" | "tablet" | "desktop" | "wide";

export type P10B18CPresentationImageSourceAuthority = Readonly<{
  assetId: string;
  role: string;
  revision: string;
  materialFingerprint: string;
  approvedUrl: string;
  authorityKind: "approved-presentation" | "canonical-product-media";
  breakpoints: readonly P10B18CResponsiveBreakpoint[];
}>;

export type P10B18CPresentationImageAuthority = Readonly<{
  pageId: string;
  componentId: string;
  assetId: string;
  role: string;
  revision: string;
  materialFingerprint: string;
  placementIdentity: string;
  placementContext: "page" | "sharedFrame";
  placementPurpose: ApprovedAssetPlacementPurpose | null;
  componentType: string;
  assetSlotId: string;
  expectedVisible: boolean;
  artDirectionFingerprint: string | null;
  sources: readonly P10B18CPresentationImageSourceAuthority[];
}>;

export type P10B18CPresentationImageRequestRecord = Readonly<{
  eventSequence: number;
  captureIdentityFingerprint: string;
  captureScope: "capture" | "setup";
  requestStartedAt: string;
  requestSettledAt: string | null;
  activeCaptureLifecycleStage: string;
  method: string;
  requestOrigin: string;
  requestPathname: string;
  logicalAssetPathname: string;
  requestUrlFingerprint: string;
  resourceType: string;
  isNavigationRequest: boolean;
  initiatorType: string | null;
  frameOrigin: string | null;
  framePathname: string | null;
  responseStatus: number | null;
  responseCompleted: boolean;
  servedFromMemoryCache: boolean | null;
  servedFromDiskCache: boolean | null;
  servedFromServiceWorker: boolean | null;
  failureText: string | null;
  redirectCount: number;
  approvedAssetId: string | null;
  approvedMaterialFingerprint: string | null;
  approvedSourceAuthorityKind: "approved-presentation" | "canonical-product-media" | null;
}>;

export type P10B18CPresentationImageElementRecord = Readonly<{
  elementIndex: number;
  frameOrigin: string | null;
  framePathname: string | null;
  src: string;
  currentSrc: string;
  srcset: string;
  sizes: string;
  complete: boolean;
  naturalWidth: number;
  naturalHeight: number;
  boundingBox: Readonly<{ x: number; y: number; width: number; height: number }>;
  visible: boolean;
  decodedSuccessfully: boolean;
  brokenImageState: boolean;
  approvedAssetId: string | null;
  approvedMaterialFingerprint: string | null;
  selectedSourceAuthorityKind: "approved-presentation" | "canonical-product-media" | null;
  selectedSourceUrlFingerprint: string | null;
  sourceValidForViewport: boolean;
  placementIdentity: string | null;
  placementContext: "page" | "sharedFrame" | null;
  placementPurpose: ApprovedAssetPlacementPurpose | null;
  sharedFramePlacementIdentity: string | null;
  insideSharedFrameHeader: boolean;
  responsiveSourceSelectionChanged: boolean;
  renderedArtDirectionFingerprint: string | null;
}>;

export type P10B18CPresentationImageEvidence = Readonly<{
  activeCaptureIdentityFingerprint: string;
  intendedOrigin: string;
  viewportWidth: number;
  retainForDiagnosis: boolean;
  probeLifecycleSettled: boolean;
  activeViewportBreakpoint: P10B18CResponsiveBreakpoint;
  activeSourceAssetIds: readonly string[];
  inactiveSourceAssetIds: readonly string[];
  authority: Readonly<{
    pageId: string;
    componentId: string;
    assetId: string;
    role: string;
    revision: string;
    materialFingerprint: string;
    placementIdentity: string;
    placementContext: "page" | "sharedFrame";
    placementPurpose: ApprovedAssetPlacementPurpose | null;
    componentType: string;
    assetSlotId: string;
    expectedVisible: boolean;
    artDirectionFingerprint: string | null;
    sources: readonly Readonly<{
      assetId: string;
      role: string;
      revision: string;
      materialFingerprint: string;
      authorityKind: "approved-presentation" | "canonical-product-media";
      approvedOrigin: string;
      approvedPathname: string;
      approvedUrlFingerprint: string;
      breakpoints: readonly P10B18CResponsiveBreakpoint[];
    }>[];
  }>;
  requests: readonly P10B18CPresentationImageRequestRecord[];
  requestSummary: Readonly<{
    startedCount: number;
    completedCount: number;
    failedCount: number;
    duplicateExactUrlCount: number;
    logicalAssetRequestCount: number;
  }>;
  elements: readonly P10B18CPresentationImageElementRecord[];
  elementCount: number;
  elementReplacementObserved: boolean | null;
  responsiveSourceMutationObserved: boolean | null;
}>;

export type P10B18CPresentationImageCompletion = Readonly<{
  lifecycleStage: string;
  screenshotWritten: boolean;
  manifestPersisted: boolean;
  storefrontReady: boolean;
  httpStatus: number | null;
  pageErrorCount: number;
  consoleErrorCount: number;
  failedResponseCount: number;
  errorBoundaryVisible: boolean;
}>;

export type P10B18CPresentationImageRootClass = "A" | "B" | "C" | "D" | "E";

export type P10B18CPresentationImageAbortClassification = Readonly<{
  eventSequence: number;
  placementIdentity: string;
  rootClass: P10B18CPresentationImageRootClass;
  disposition:
    | "expected-superseded-presentation-image-abort"
    | "pending-capture-completion"
    | "outside-active-capture"
    | "blocking";
  reason: string;
  approvedAssetId: string | null;
  approvedMaterialFingerprint: string | null;
  replacementEventSequence: number | null;
  replacementAssetId: string | null;
  replacementRelation: "same-exact-url" | "responsive-source" | null;
}>;

export type P10B18CPresentationImageClassification = Readonly<{
  classifications: readonly P10B18CPresentationImageAbortClassification[];
  expectedSupersededPresentationImageAborts: readonly P10B18CPresentationImageAbortClassification[];
  expectedSupersededPresentationImageAbortCount: number;
  pendingPresentationImageAborts: readonly P10B18CPresentationImageAbortClassification[];
  pendingPresentationImageAbortCount: number;
  presentationImageAttributionLeaks: readonly P10B18CPresentationImageAbortClassification[];
  presentationImageAttributionLeakCount: number;
}>;

const breakpoints = ["mobile", "tablet", "desktop", "wide"] as const;

type ResolvedUrl = Readonly<{
  origin: string;
  pathname: string;
  exactComparison: string;
  safeFingerprint: string;
}>;

function resolveUrl(value: string, baseUrl: string): ResolvedUrl {
  const outer = new URL(value, baseUrl);
  const nested = outer.pathname === "/_next/image" ? outer.searchParams.get("url") : null;
  const logical = nested ? new URL(nested, outer.origin) : outer;
  const queryKeys = [...new Set(logical.searchParams.keys())].sort();
  return {
    origin: logical.origin,
    pathname: logical.pathname,
    exactComparison: logical.href,
    safeFingerprint: `p10b18c-presentation-url-${canonicalValueFingerprint({
      origin: logical.origin,
      pathname: logical.pathname,
      queryKeys,
    })}`,
  };
}

function redirectCount(request: Request): number {
  let count = 0;
  let previous = request.redirectedFrom();
  while (previous) {
    count += 1;
    previous = previous.redirectedFrom();
  }
  return count;
}

function frameLocation(request: Request): Readonly<{
  origin: string | null;
  pathname: string | null;
}> {
  try {
    const url = new URL(request.frame().url());
    return { origin: url.origin, pathname: url.pathname };
  } catch {
    return { origin: null, pathname: null };
  }
}

function exactPresentation(
  placement: ApprovedAssetPlacementOperation,
  presentations: readonly ApprovedAssetPresentation[],
): ApprovedAssetPresentation {
  const presentation = presentations.find(
    (candidate) =>
      candidate.assetId === placement.assetId &&
      candidate.role === placement.role &&
      candidate.revision === placement.assetRevision &&
      candidate.materialFingerprint === placement.materialFingerprint &&
      candidate.asset.id === placement.assetId,
  );
  if (!presentation) {
    throw new Error(
      `P10B-18C ${placement.componentType}.${placement.assetSlotId} placement lacks its exact approved presentation authority.`,
    );
  }
  return presentation;
}

function presentationImageAuthority(input: {
  placement: ApprovedAssetPlacementOperation;
  presentations: readonly ApprovedAssetPresentation[];
  expectedContext: "page" | "sharedFrame";
  expectedVisible: boolean;
}): P10B18CPresentationImageAuthority {
  const { placement, presentations, expectedContext, expectedVisible } = input;
  const placementContext = placement.placementContext ?? expectedContext;
  if (placementContext !== expectedContext) {
    throw new Error(
      `P10B-18C ${placement.componentType}.${placement.assetSlotId} placement context is inconsistent.`,
    );
  }
  const presentation = exactPresentation(placement, presentations);
  const responsiveIds = placement.responsiveSourceAssetIds ?? [];
  const responsivePresentations = responsiveIds.map((assetId) => {
    const source = presentation.responsiveSources?.find(
      (candidate) => candidate.assetId === assetId,
    );
    if (!source) {
      throw new Error(
        `P10B-18C ${placement.componentType}.${placement.assetSlotId} responsive source ${assetId} lacks exact presentation authority.`,
      );
    }
    return source;
  });
  const claimedBreakpoints = new Set(
    responsivePresentations.flatMap(({ breakpoints: sourceBreakpoints }) => sourceBreakpoints),
  );
  const sources: P10B18CPresentationImageSourceAuthority[] = [
    {
      assetId: presentation.assetId,
      role: presentation.role,
      revision: presentation.revision,
      materialFingerprint: presentation.materialFingerprint,
      approvedUrl: presentation.asset.url,
      authorityKind: "approved-presentation",
      breakpoints: breakpoints.filter((breakpoint) => !claimedBreakpoints.has(breakpoint)),
    },
    ...responsivePresentations.map((source) => ({
      assetId: source.assetId,
      role: source.role,
      revision: source.revision,
      materialFingerprint: source.materialFingerprint,
      approvedUrl: source.asset.url,
      authorityKind: "approved-presentation" as const,
      breakpoints: source.breakpoints,
    })),
  ];
  const placementIdentity = `p10b18c-presentation-placement-${canonicalValueFingerprint({
    pageId: placement.pageId,
    componentId: placement.componentId,
    componentType: placement.componentType,
    assetSlotId: placement.assetSlotId,
    assetId: placement.assetId,
    role: placement.role,
    revision: placement.assetRevision,
    materialFingerprint: placement.materialFingerprint,
    placementContext,
    placementPurpose: placement.placementPurpose ?? null,
  })}`;
  return {
    pageId: placement.pageId,
    componentId: placement.componentId,
    assetId: presentation.assetId,
    role: presentation.role,
    revision: presentation.revision,
    materialFingerprint: presentation.materialFingerprint,
    placementIdentity,
    placementContext,
    placementPurpose: placement.placementPurpose ?? null,
    componentType: placement.componentType,
    assetSlotId: placement.assetSlotId,
    expectedVisible,
    artDirectionFingerprint: presentation.artDirection?.fingerprint ?? null,
    sources,
  };
}

function sectionPresentationImageAuthorities(
  section: SectionInstance,
  expectedContext: "page" | "sharedFrame",
): P10B18CPresentationImageAuthority[] {
  if (!section.visible) return [];
  return (section.approvedAssetPlacements ?? []).map((placement) =>
    presentationImageAuthority({
      placement,
      presentations: section.approvedAssetPresentations ?? [],
      expectedContext,
      expectedVisible: true,
    }),
  );
}

export function p10b18cSharedFrameLogoAuthority(
  snapshot: StorefrontSnapshot,
): P10B18CPresentationImageAuthority | null {
  const header = snapshot.sharedFrame?.header;
  if (!header) return null;
  const authorities = sectionPresentationImageAuthorities(header, "sharedFrame").filter(
    (authority) =>
      authority.placementPurpose === "brand-identity" &&
      authority.componentType === "header" &&
      authority.assetSlotId === "brandLogo" &&
      authority.role === "logo",
  );
  if (authorities.length === 0) return null;
  if (authorities.length !== 1) {
    throw new Error("P10B-18C requires one exact shared-frame logo placement authority.");
  }
  return authorities[0];
}

export function p10b18cPresentationImageAuthorities(
  snapshot: StorefrontSnapshot,
  surfacePageType: string,
): readonly P10B18CPresentationImageAuthority[] {
  const sharedFrameSections = snapshot.sharedFrame
    ? [
        snapshot.sharedFrame.header,
        snapshot.sharedFrame.footer,
        snapshot.sharedFrame.announcement,
      ].filter((section): section is SectionInstance => section !== undefined)
    : [];
  const pageTypeBySurface: Readonly<Record<string, PageType | undefined>> = {
    home: "home",
    collection: "collection",
    "product-detail": "product",
    search: undefined,
  };
  const pageType = pageTypeBySurface[surfacePageType];
  const pageSections =
    pageType === undefined
      ? []
      : snapshot.pages.filter((page) => page.type === pageType).flatMap((page) => page.sections);
  return [
    ...sharedFrameSections.flatMap((section) =>
      sectionPresentationImageAuthorities(section, "sharedFrame"),
    ),
    ...pageSections.flatMap((section) => sectionPresentationImageAuthorities(section, "page")),
  ].sort((left, right) => left.placementIdentity.localeCompare(right.placementIdentity));
}

type MutableRequestRecord = {
  eventSequence: number;
  captureIdentityFingerprint: string;
  captureScope: "capture" | "setup";
  requestStartedAt: string;
  requestSettledAt: string | null;
  activeCaptureLifecycleStage: string;
  method: string;
  requestOrigin: string;
  requestPathname: string;
  logicalAssetPathname: string;
  requestUrlFingerprint: string;
  resourceType: string;
  isNavigationRequest: boolean;
  initiatorType: string | null;
  frameOrigin: string | null;
  framePathname: string | null;
  responseStatus: number | null;
  responseCompleted: boolean;
  servedFromMemoryCache: boolean | null;
  servedFromDiskCache: boolean | null;
  servedFromServiceWorker: boolean | null;
  failureText: string | null;
  redirectCount: number;
  approvedAssetId: string | null;
  approvedMaterialFingerprint: string | null;
  approvedSourceAuthorityKind: "approved-presentation" | "canonical-product-media" | null;
};

type ObserverState = Readonly<{
  initialElementCount: number;
  addedMatchingElementCount: number;
  removedMatchingElementCount: number;
  responsiveSourceMutationCount: number;
}>;

export class P10B18CPresentationImageProbe {
  readonly #authority: P10B18CPresentationImageAuthority;
  readonly #baseUrl: string;
  readonly #activeCaptureIdentityFingerprint: string;
  readonly #retainForDiagnosis: boolean;
  readonly #observerKey: string;
  readonly #requestRecords: MutableRequestRecord[] = [];
  readonly #requestRecordByRequest = new WeakMap<Request, MutableRequestRecord>();
  readonly #pendingTasks = new Set<Promise<void>>();
  readonly #observerTasks = new Set<Promise<void>>();
  #page: Page | null = null;
  readonly #onDomContentLoaded = () => {
    if (!this.#page) return;
    const task = this.#installDomObserver(this.#page).catch(() => undefined);
    this.#observerTasks.add(task);
    void task.finally(() => this.#observerTasks.delete(task));
  };

  constructor(input: {
    authority: P10B18CPresentationImageAuthority;
    baseUrl: string;
    activeCaptureIdentityFingerprint: string;
    retainForDiagnosis?: boolean;
  }) {
    this.#authority = input.authority;
    this.#baseUrl = input.baseUrl;
    this.#activeCaptureIdentityFingerprint = input.activeCaptureIdentityFingerprint;
    this.#retainForDiagnosis = input.retainForDiagnosis ?? false;
    this.#observerKey = input.authority.placementIdentity;
  }

  async attach(page: Page): Promise<void> {
    this.#page = page;
    page.on("domcontentloaded", this.#onDomContentLoaded);
    await this.#installDomObserver(page).catch(() => undefined);
  }

  async detach(page: Page): Promise<void> {
    page.off("domcontentloaded", this.#onDomContentLoaded);
    await Promise.all([...this.#observerTasks]);
    await page
      .evaluate((observerKey) => {
        const state = globalThis as typeof globalThis & {
          __p10b18cPresentationImageObservers?: Record<string, MutationObserver>;
        };
        state.__p10b18cPresentationImageObservers?.[observerKey]?.disconnect();
        if (state.__p10b18cPresentationImageObservers) {
          delete state.__p10b18cPresentationImageObservers[observerKey];
        }
      }, this.#observerKey)
      .catch(() => undefined);
    this.#page = null;
  }

  #sourceFor(rawUrl: string): P10B18CPresentationImageSourceAuthority | null {
    const request = resolveUrl(rawUrl, this.#baseUrl);
    return (
      this.#authority.sources.find((source) => {
        const approved = resolveUrl(source.approvedUrl, this.#baseUrl);
        return approved.exactComparison === request.exactComparison;
      }) ?? null
    );
  }

  recordRequestStarted(
    request: Request,
    eventSequence: number,
    lifecycleStage: string,
    captureScope: "capture" | "setup",
  ): void {
    const source = this.#sourceFor(request.url());
    if (!source) return;
    const requestUrl = new URL(request.url());
    const logicalUrl = resolveUrl(request.url(), this.#baseUrl);
    const frame = frameLocation(request);
    const record: MutableRequestRecord = {
      eventSequence,
      captureIdentityFingerprint: this.#activeCaptureIdentityFingerprint,
      captureScope,
      requestStartedAt: new Date().toISOString(),
      requestSettledAt: null,
      activeCaptureLifecycleStage: lifecycleStage,
      method: request.method(),
      requestOrigin: requestUrl.origin,
      requestPathname: requestUrl.pathname,
      logicalAssetPathname: logicalUrl.pathname,
      requestUrlFingerprint: logicalUrl.safeFingerprint,
      resourceType: request.resourceType(),
      isNavigationRequest: request.isNavigationRequest(),
      initiatorType: null,
      frameOrigin: frame.origin,
      framePathname: frame.pathname,
      responseStatus: null,
      responseCompleted: false,
      servedFromMemoryCache: null,
      servedFromDiskCache: null,
      servedFromServiceWorker: null,
      failureText: null,
      redirectCount: redirectCount(request),
      approvedAssetId: source.assetId,
      approvedMaterialFingerprint: source.materialFingerprint,
      approvedSourceAuthorityKind: source.authorityKind,
    };
    this.#requestRecords.push(record);
    this.#requestRecordByRequest.set(request, record);
  }

  recordResponse(response: Response): void {
    const record = this.#requestRecordByRequest.get(response.request());
    if (!record) return;
    record.responseStatus = response.status();
    record.servedFromServiceWorker = response.fromServiceWorker();
  }

  recordRequestFinished(request: Request): void {
    const record = this.#requestRecordByRequest.get(request);
    if (!record) return;
    record.requestSettledAt = new Date().toISOString();
    record.responseCompleted = true;
    const task = request
      .response()
      .then((response) => {
        if (!response) return;
        record.responseStatus = response.status();
        record.servedFromServiceWorker = response.fromServiceWorker();
      })
      .catch(() => undefined);
    this.#pendingTasks.add(task);
    void task.finally(() => this.#pendingTasks.delete(task));
  }

  recordRequestFailed(request: Request): void {
    const record = this.#requestRecordByRequest.get(request);
    if (!record) return;
    record.requestSettledAt = new Date().toISOString();
    record.failureText = request.failure()?.errorText ?? "unknown-request-failure";
  }

  async #installDomObserver(page: Page): Promise<void> {
    const approvedPathnames = this.#authority.sources.map(
      (source) => resolveUrl(source.approvedUrl, this.#baseUrl).pathname,
    );
    await page.evaluate(
      ({ observerKey, pathnames }) => {
        const host = globalThis as typeof globalThis & {
          __p10b18cPresentationImageObservers?: Record<string, MutationObserver>;
          __p10b18cPresentationImageObserverStates?: Record<
            string,
            {
              initialElementCount: number;
              addedMatchingElementCount: number;
              removedMatchingElementCount: number;
              responsiveSourceMutationCount: number;
            }
          >;
        };
        host.__p10b18cPresentationImageObservers ??= {};
        host.__p10b18cPresentationImageObserverStates ??= {};
        host.__p10b18cPresentationImageObservers[observerKey]?.disconnect();
        const logicalPathname = (value: string | null) => {
          if (!value) return null;
          try {
            const outer = new URL(value, document.baseURI);
            const nested = outer.pathname === "/_next/image" ? outer.searchParams.get("url") : null;
            return nested ? new URL(nested, outer.origin).pathname : outer.pathname;
          } catch {
            return null;
          }
        };
        const matches = (element: Element) => {
          if (!(element instanceof HTMLImageElement)) return false;
          return [element.getAttribute("src"), element.currentSrc]
            .map(logicalPathname)
            .some((pathname) => pathname !== null && pathnames.includes(pathname));
        };
        const matchingCount = () => Array.from(document.images).filter(matches).length;
        const state = {
          initialElementCount: matchingCount(),
          addedMatchingElementCount: 0,
          removedMatchingElementCount: 0,
          responsiveSourceMutationCount: 0,
        };
        host.__p10b18cPresentationImageObserverStates[observerKey] = state;
        const observer = new MutationObserver((records) => {
          for (const record of records) {
            if (record.type === "attributes") {
              if (matches(record.target as Element)) state.responsiveSourceMutationCount += 1;
              continue;
            }
            for (const node of Array.from(record.addedNodes)) {
              if (!(node instanceof Element)) continue;
              state.addedMatchingElementCount +=
                (matches(node) ? 1 : 0) +
                Array.from(node.querySelectorAll("img")).filter(matches).length;
            }
            for (const node of Array.from(record.removedNodes)) {
              if (!(node instanceof Element)) continue;
              state.removedMatchingElementCount +=
                (matches(node) ? 1 : 0) +
                Array.from(node.querySelectorAll("img")).filter(matches).length;
            }
          }
        });
        observer.observe(document.documentElement, {
          subtree: true,
          childList: true,
          attributes: true,
          attributeFilter: ["src", "srcset", "sizes"],
        });
        host.__p10b18cPresentationImageObservers[observerKey] = observer;
      },
      { observerKey: this.#observerKey, pathnames: approvedPathnames },
    );
  }

  async collect(page: Page): Promise<P10B18CPresentationImageEvidence> {
    const probeLifecycleSettled = await Promise.race([
      Promise.all([...this.#pendingTasks, ...this.#observerTasks]).then(() => true),
      new Promise<boolean>((resolveValue) => setTimeout(() => resolveValue(false), 5_000)),
    ]);
    const approvedPathnames = this.#authority.sources.map(
      (source) => resolveUrl(source.approvedUrl, this.#baseUrl).pathname,
    );
    const rawElements = (
      await Promise.all(
        page.frames().map(async (frame, frameIndex) => {
          let frameOrigin: string | null = null;
          let framePathname: string | null = null;
          try {
            const frameUrl = new URL(frame.url());
            frameOrigin = frameUrl.origin;
            framePathname = frameUrl.pathname;
          } catch {
            frameOrigin = null;
            framePathname = null;
          }
          const frameElements = await frame
            .locator("img")
            .evaluateAll(async (images, pathnames) => {
              const logicalPathname = (value: string | null) => {
                if (!value) return null;
                try {
                  const outer = new URL(value, document.baseURI);
                  const nested =
                    outer.pathname === "/_next/image" ? outer.searchParams.get("url") : null;
                  return nested ? new URL(nested, outer.origin).pathname : outer.pathname;
                } catch {
                  return null;
                }
              };
              const matching = images.filter(
                (image): image is HTMLImageElement =>
                  image instanceof HTMLImageElement &&
                  [image.getAttribute("src"), image.currentSrc]
                    .map(logicalPathname)
                    .some((pathname) => pathname !== null && pathnames.includes(pathname)),
              );
              return Promise.all(
                matching.map(async (image, elementIndex) => {
                  const rect = image.getBoundingClientRect();
                  const style = getComputedStyle(image);
                  const decodedSuccessfully = await Promise.race([
                    image
                      .decode()
                      .then(() => true)
                      .catch(() => false),
                    new Promise<boolean>((resolveValue) =>
                      setTimeout(() => resolveValue(false), 5_000),
                    ),
                  ]);
                  const artDirection = image.closest<HTMLElement>(
                    "[data-art-direction-fingerprint]",
                  );
                  const header = image.closest<HTMLElement>("[data-frame-region='header']");
                  return {
                    elementIndex,
                    rawSrc: image.getAttribute("src") ?? "",
                    rawCurrentSrc: image.currentSrc,
                    rawSrcset: image.getAttribute("srcset") ?? "",
                    sizes: image.getAttribute("sizes") ?? "",
                    complete: image.complete,
                    naturalWidth: image.naturalWidth,
                    naturalHeight: image.naturalHeight,
                    boundingBox: {
                      x: Math.round(rect.x * 100) / 100,
                      y: Math.round(rect.y * 100) / 100,
                      width: Math.round(rect.width * 100) / 100,
                      height: Math.round(rect.height * 100) / 100,
                    },
                    visible:
                      rect.width > 0 &&
                      rect.height > 0 &&
                      image.getClientRects().length > 0 &&
                      style.display !== "none" &&
                      style.visibility !== "hidden" &&
                      Number(style.opacity) > 0,
                    decodedSuccessfully,
                    insideSharedFrameHeader: header !== null,
                    renderedArtDirectionFingerprint:
                      artDirection?.dataset.artDirectionFingerprint ?? null,
                  };
                }),
              );
            }, approvedPathnames)
            .catch(() => []);
          return frameElements.map((element) => ({
            ...element,
            frameIndex,
            frameOrigin,
            framePathname,
          }));
        }),
      )
    ).flat();
    const observerState = await page
      .evaluate((observerKey) => {
        const host = globalThis as typeof globalThis & {
          __p10b18cPresentationImageObserverStates?: Record<string, ObserverState>;
        };
        return host.__p10b18cPresentationImageObserverStates?.[observerKey] ?? null;
      }, this.#observerKey)
      .catch(() => null);
    const safePath = (value: string) => {
      if (!value) return "";
      try {
        return resolveUrl(value, this.#baseUrl).pathname;
      } catch {
        return "invalid-url";
      }
    };
    const elements: P10B18CPresentationImageElementRecord[] = rawElements.map((element) => {
      const selectedSource = this.#sourceFor(element.rawCurrentSrc || element.rawSrc);
      const fallbackSource = this.#sourceFor(element.rawSrc);
      const boundingBox = element.boundingBox;
      const validDimensions = element.naturalWidth > 0 && element.naturalHeight > 0;
      const activeBreakpoint = viewportBreakpoint(page.viewportSize()?.width ?? 0);
      const matchesArtDirection =
        this.#authority.artDirectionFingerprint === null ||
        element.renderedArtDirectionFingerprint === this.#authority.artDirectionFingerprint;
      const matchesPlacement =
        selectedSource !== null &&
        matchesArtDirection &&
        (this.#authority.placementContext !== "sharedFrame" ||
          this.#authority.componentType !== "header" ||
          element.insideSharedFrameHeader);
      return {
        elementIndex: element.elementIndex,
        frameOrigin: element.frameOrigin,
        framePathname: element.framePathname,
        src: safePath(element.rawSrc),
        currentSrc: safePath(element.rawCurrentSrc),
        srcset: element.rawSrcset
          .split(",")
          .map((candidate) => safePath(candidate.trim().split(/\s+/u)[0] ?? ""))
          .filter(Boolean)
          .join(", "),
        sizes: element.sizes.replace(/\s+/gu, " ").trim().slice(0, 240),
        complete: element.complete,
        naturalWidth: element.naturalWidth,
        naturalHeight: element.naturalHeight,
        boundingBox,
        visible: element.visible,
        decodedSuccessfully: element.decodedSuccessfully,
        brokenImageState:
          element.visible &&
          (!element.complete ||
            !validDimensions ||
            !element.decodedSuccessfully ||
            boundingBox.width <= 0 ||
            boundingBox.height <= 0),
        approvedAssetId: selectedSource?.assetId ?? null,
        approvedMaterialFingerprint: selectedSource?.materialFingerprint ?? null,
        selectedSourceAuthorityKind: selectedSource?.authorityKind ?? null,
        selectedSourceUrlFingerprint:
          selectedSource === null
            ? null
            : resolveUrl(selectedSource.approvedUrl, this.#baseUrl).safeFingerprint,
        sourceValidForViewport: selectedSource?.breakpoints.includes(activeBreakpoint) ?? false,
        placementIdentity: matchesPlacement ? this.#authority.placementIdentity : null,
        placementContext: matchesPlacement ? this.#authority.placementContext : null,
        placementPurpose: matchesPlacement ? this.#authority.placementPurpose : null,
        sharedFramePlacementIdentity: element.insideSharedFrameHeader
          ? this.#authority.placementIdentity
          : null,
        insideSharedFrameHeader: element.insideSharedFrameHeader,
        responsiveSourceSelectionChanged:
          selectedSource !== null &&
          fallbackSource !== null &&
          selectedSource.assetId !== fallbackSource.assetId,
        renderedArtDirectionFingerprint: element.renderedArtDirectionFingerprint,
      };
    });
    const requests = this.#requestRecords
      .map((record): P10B18CPresentationImageRequestRecord => ({ ...record }))
      .sort((left, right) => left.eventSequence - right.eventSequence);
    const urlCounts = new Map<string, number>();
    requests.forEach((request) =>
      urlCounts.set(
        request.requestUrlFingerprint,
        (urlCounts.get(request.requestUrlFingerprint) ?? 0) + 1,
      ),
    );
    const intendedOrigin = new URL(this.#baseUrl).origin;
    const activeViewportBreakpoint = viewportBreakpoint(page.viewportSize()?.width ?? 0);
    return {
      activeCaptureIdentityFingerprint: this.#activeCaptureIdentityFingerprint,
      intendedOrigin,
      viewportWidth: page.viewportSize()?.width ?? 0,
      retainForDiagnosis: this.#retainForDiagnosis,
      probeLifecycleSettled,
      activeViewportBreakpoint,
      activeSourceAssetIds: this.#authority.sources
        .filter(({ breakpoints: sourceBreakpoints }) =>
          sourceBreakpoints.includes(activeViewportBreakpoint),
        )
        .map(({ assetId }) => assetId),
      inactiveSourceAssetIds: this.#authority.sources
        .filter(
          ({ breakpoints: sourceBreakpoints }) =>
            !sourceBreakpoints.includes(activeViewportBreakpoint),
        )
        .map(({ assetId }) => assetId),
      authority: {
        pageId: this.#authority.pageId,
        componentId: this.#authority.componentId,
        assetId: this.#authority.assetId,
        role: this.#authority.role,
        revision: this.#authority.revision,
        materialFingerprint: this.#authority.materialFingerprint,
        placementIdentity: this.#authority.placementIdentity,
        placementContext: this.#authority.placementContext,
        placementPurpose: this.#authority.placementPurpose,
        componentType: this.#authority.componentType,
        assetSlotId: this.#authority.assetSlotId,
        expectedVisible: this.#authority.expectedVisible,
        artDirectionFingerprint: this.#authority.artDirectionFingerprint,
        sources: this.#authority.sources.map((source) => {
          const approved = resolveUrl(source.approvedUrl, this.#baseUrl);
          return {
            assetId: source.assetId,
            role: source.role,
            revision: source.revision,
            materialFingerprint: source.materialFingerprint,
            authorityKind: source.authorityKind,
            approvedOrigin: approved.origin,
            approvedPathname: approved.pathname,
            approvedUrlFingerprint: approved.safeFingerprint,
            breakpoints: source.breakpoints,
          };
        }),
      },
      requests,
      requestSummary: {
        startedCount: requests.length,
        completedCount: requests.filter(({ responseCompleted }) => responseCompleted).length,
        failedCount: requests.filter(({ failureText }) => failureText !== null).length,
        duplicateExactUrlCount: [...urlCounts.values()].filter((count) => count > 1).length,
        logicalAssetRequestCount: requests.length,
      },
      elements,
      elementCount: elements.length,
      elementReplacementObserved:
        observerState === null
          ? null
          : observerState.addedMatchingElementCount > 0 &&
            observerState.removedMatchingElementCount > 0,
      responsiveSourceMutationObserved:
        observerState === null ? null : observerState.responsiveSourceMutationCount > 0,
    };
  }
}

function viewportBreakpoint(width: number): P10B18CResponsiveBreakpoint {
  if (width <= 767) return "mobile";
  if (width <= 1023) return "tablet";
  if (width <= 1439) return "desktop";
  return "wide";
}

function cleanRuntime(completion: P10B18CPresentationImageCompletion): boolean {
  return (
    completion.storefrontReady &&
    completion.httpStatus !== null &&
    completion.httpStatus >= 200 &&
    completion.httpStatus < 400 &&
    completion.pageErrorCount === 0 &&
    completion.consoleErrorCount === 0 &&
    completion.failedResponseCount === 0 &&
    !completion.errorBoundaryVisible
  );
}

function durableCompletion(completion: P10B18CPresentationImageCompletion): boolean {
  return (
    completion.lifecycleStage === "capture-complete" &&
    completion.screenshotWritten &&
    completion.manifestPersisted
  );
}

function validFinalElement(
  evidence: P10B18CPresentationImageEvidence,
): P10B18CPresentationImageElementRecord | null {
  const placementElements = evidence.elements.filter(
    (element) => element.placementIdentity === evidence.authority.placementIdentity,
  );
  if (placementElements.some((element) => element.visible && element.brokenImageState)) {
    return null;
  }
  return (
    placementElements.find(
      (element) =>
        element.complete &&
        element.naturalWidth > 0 &&
        element.naturalHeight > 0 &&
        element.decodedSuccessfully &&
        element.visible &&
        element.boundingBox.width > 0 &&
        element.boundingBox.height > 0 &&
        !element.brokenImageState &&
        element.sourceValidForViewport &&
        element.selectedSourceAuthorityKind === "approved-presentation",
    ) ?? null
  );
}

function completedRequest(request: P10B18CPresentationImageRequestRecord): boolean {
  return (
    request.responseCompleted &&
    request.failureText === null &&
    request.responseStatus !== null &&
    request.responseStatus >= 200 &&
    request.responseStatus < 400 &&
    request.approvedSourceAuthorityKind === "approved-presentation"
  );
}

export function classifyP10B18CPresentationImageEvidence(input: {
  evidence: P10B18CPresentationImageEvidence;
  completion: P10B18CPresentationImageCompletion;
}): P10B18CPresentationImageClassification {
  const { evidence, completion } = input;
  const classifications = evidence.requests
    .filter(({ failureText }) => failureText !== null)
    .map((failed): P10B18CPresentationImageAbortClassification => {
      if (
        failed.captureScope !== "capture" ||
        failed.captureIdentityFingerprint !== evidence.activeCaptureIdentityFingerprint
      ) {
        return {
          eventSequence: failed.eventSequence,
          placementIdentity: evidence.authority.placementIdentity,
          rootClass: "C",
          disposition: "outside-active-capture",
          reason: "presentation-image request belongs outside the active capture identity",
          approvedAssetId: failed.approvedAssetId,
          approvedMaterialFingerprint: failed.approvedMaterialFingerprint,
          replacementEventSequence: null,
          replacementAssetId: null,
          replacementRelation: null,
        };
      }
      const source = evidence.authority.sources.find(
        (candidate) =>
          candidate.assetId === failed.approvedAssetId &&
          candidate.materialFingerprint === failed.approvedMaterialFingerprint,
      );
      const boundedRequest =
        evidence.probeLifecycleSettled &&
        failed.method === "GET" &&
        failed.requestOrigin === evidence.intendedOrigin &&
        failed.failureText === "net::ERR_ABORTED" &&
        failed.resourceType === "image" &&
        !failed.isNavigationRequest &&
        source?.authorityKind === "approved-presentation";
      if (!boundedRequest) {
        return {
          eventSequence: failed.eventSequence,
          placementIdentity: evidence.authority.placementIdentity,
          rootClass: "E",
          disposition: "blocking",
          reason: "presentation-image abort is outside the exact expected cancellation boundary",
          approvedAssetId: failed.approvedAssetId,
          approvedMaterialFingerprint: failed.approvedMaterialFingerprint,
          replacementEventSequence: null,
          replacementAssetId: null,
          replacementRelation: null,
        };
      }
      const finalElement = validFinalElement(evidence);
      const successfulRequests = evidence.requests.filter(
        (candidate) =>
          candidate.eventSequence !== failed.eventSequence && completedRequest(candidate),
      );
      const finalSource = finalElement
        ? (evidence.authority.sources.find(
            (candidate) =>
              candidate.assetId === finalElement.approvedAssetId &&
              candidate.materialFingerprint === finalElement.approvedMaterialFingerprint &&
              candidate.authorityKind === "approved-presentation",
          ) ?? null)
        : null;
      const exactReplacement =
        finalElement !== null &&
        finalSource !== null &&
        finalElement.selectedSourceUrlFingerprint === failed.requestUrlFingerprint &&
        finalSource.assetId === failed.approvedAssetId &&
        finalSource.materialFingerprint === failed.approvedMaterialFingerprint;
      const responsiveReplacement =
        finalElement !== null &&
        finalSource !== null &&
        !exactReplacement &&
        evidence.authority.artDirectionFingerprint !== null &&
        finalSource.breakpoints.includes(evidence.activeViewportBreakpoint) &&
        finalElement.renderedArtDirectionFingerprint === evidence.authority.artDirectionFingerprint;
      const relation = exactReplacement
        ? "same-exact-url"
        : responsiveReplacement
          ? "responsive-source"
          : null;
      const rootClass: P10B18CPresentationImageRootClass = exactReplacement
        ? "A"
        : responsiveReplacement
          ? "B"
          : !finalElement
            ? "D"
            : "E";
      const replacementRequest = finalElement
        ? (successfulRequests.find(
            (candidate) =>
              candidate.requestUrlFingerprint === finalElement.selectedSourceUrlFingerprint &&
              candidate.approvedAssetId === finalElement.approvedAssetId &&
              candidate.approvedMaterialFingerprint === finalElement.approvedMaterialFingerprint,
          ) ?? null)
        : null;
      if (relation === null || !finalElement || !finalSource) {
        return {
          eventSequence: failed.eventSequence,
          placementIdentity: evidence.authority.placementIdentity,
          rootClass,
          disposition: "blocking",
          reason:
            rootClass === "D"
              ? "no healthy decoded active element proves the final approved placement"
              : "presentation-image evidence does not prove one authorized supersession relation",
          approvedAssetId: failed.approvedAssetId,
          approvedMaterialFingerprint: failed.approvedMaterialFingerprint,
          replacementEventSequence: replacementRequest?.eventSequence ?? null,
          replacementAssetId: finalElement?.approvedAssetId ?? null,
          replacementRelation: relation,
        };
      }
      if (!cleanRuntime(completion)) {
        return {
          eventSequence: failed.eventSequence,
          placementIdentity: evidence.authority.placementIdentity,
          rootClass,
          disposition: "blocking",
          reason: "capture runtime postconditions are not clean",
          approvedAssetId: failed.approvedAssetId,
          approvedMaterialFingerprint: failed.approvedMaterialFingerprint,
          replacementEventSequence: replacementRequest?.eventSequence ?? null,
          replacementAssetId: finalSource.assetId,
          replacementRelation: relation,
        };
      }
      if (!durableCompletion(completion)) {
        return {
          eventSequence: failed.eventSequence,
          placementIdentity: evidence.authority.placementIdentity,
          rootClass,
          disposition: "pending-capture-completion",
          reason: "authorized replacement is proven but capture persistence is not complete",
          approvedAssetId: failed.approvedAssetId,
          approvedMaterialFingerprint: failed.approvedMaterialFingerprint,
          replacementEventSequence: replacementRequest?.eventSequence ?? null,
          replacementAssetId: finalSource.assetId,
          replacementRelation: relation,
        };
      }
      return {
        eventSequence: failed.eventSequence,
        placementIdentity: evidence.authority.placementIdentity,
        rootClass,
        disposition: "expected-superseded-presentation-image-abort",
        reason:
          rootClass === "A"
            ? "the final visible placement decoded the same approved source through a completed or cached consumer"
            : "the final visible placement decoded the viewport-valid approved responsive source",
        approvedAssetId: failed.approvedAssetId,
        approvedMaterialFingerprint: failed.approvedMaterialFingerprint,
        replacementEventSequence: replacementRequest?.eventSequence ?? null,
        replacementAssetId: finalSource.assetId,
        replacementRelation: relation,
      };
    });
  const expected = classifications.filter(
    ({ disposition }) => disposition === "expected-superseded-presentation-image-abort",
  );
  const pending = classifications.filter(
    ({ disposition }) => disposition === "pending-capture-completion",
  );
  const attributionLeaks = classifications.filter(
    ({ disposition }) => disposition === "outside-active-capture",
  );
  return {
    classifications,
    expectedSupersededPresentationImageAborts: expected,
    expectedSupersededPresentationImageAbortCount: expected.length,
    pendingPresentationImageAborts: pending,
    pendingPresentationImageAbortCount: pending.length,
    presentationImageAttributionLeaks: attributionLeaks,
    presentationImageAttributionLeakCount: attributionLeaks.length,
  };
}
