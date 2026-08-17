import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import type { Page } from "@playwright/test";
import { resolveLocalizedText } from "@/domain/shared";
import { canonicalValueFingerprint, type StorefrontSnapshot } from "@/domain/storefront";
import {
  captureP10B18AEvidence,
  p10b18aEvidenceDirectory,
  p10b18aEvidenceRunId,
  type P10B18AEvidenceEntry,
  type P10B18ALocale,
  type P10B18ARequestLedger,
  type P10B18ARuntimeAuthority,
  type P10B18AStoreManifestEntry,
  type P10B18ASurface,
  type P10B18AWidth,
} from "./p10b-18a-browser-evidence";

export type P10B18B01CaptureRole =
  | "required-direction-surface-width"
  | "within-direction-alternate-dna"
  | "editorial-long-navigation";

export type P10B18B01FrameAuthority = Readonly<{
  profileId: string;
  version: string;
  authorityFingerprint: string;
  headerVariant: string;
  mobileNavigationMode: string;
  footerVariant: string;
  footerComposition: string;
  responsiveTransformationIds: readonly string[];
}>;

export type P10B18B01StoreBinding = Readonly<{
  key: string;
  role: "primary" | "alternate-dna" | "long-navigation";
  legacyManifest: P10B18AStoreManifestEntry;
  fixtureAuthority: string;
  shapeId: string;
  directionId: string;
  designSystemSpacingDensity: "compact" | "standard" | "spacious";
  semanticVariationId: string;
  semanticIntentFingerprint: string;
  semanticDrivers: Readonly<Record<string, string>>;
  compiledDecisionFingerprint: string;
  compilerStructuralFingerprint: string;
  exactCompiledDesignDnaFingerprint: string;
  compiledDesignDnaAuthorityFingerprint: string;
  materializedDesignDnaFingerprint: string;
  consumedAuthorityFingerprint: string;
  normalizedAuthorityTopologyFingerprint: string;
  candidateSnapshotFingerprint: string;
  commerceFingerprint: string;
  mediaFingerprint: string;
  frameAuthority: P10B18B01FrameAuthority;
  profiles: Readonly<Record<string, string>>;
  runtimeAuthority: P10B18ARuntimeAuthority;
  projectId: string;
  locale: P10B18ALocale;
}>;

export type P10B18B01CaptureEvidence = P10B18AEvidenceEntry &
  Readonly<{
    captureRole: P10B18B01CaptureRole;
    storeKey: string;
    exactCompiledDesignDnaFingerprint: string;
    materializedDesignDnaFingerprint: string;
    renderedCssDesignDnaFingerprint: string;
    renderedCssProjectionFingerprint: string;
    renderedGeometry: Readonly<{
      sectionRhythm: string;
      pageGutter: string;
      gridGap: string;
      cardInset: string;
      controlHeight: string;
      globalDensity: string;
      navigationDensity: string;
      contentDensity: string;
      commerceDensity: string;
    }>;
    navigationFingerprint: string;
    footerContentFingerprint: string;
    headerVariant: string;
    mobileNavigationMode: string;
    footerComposition: string;
    footerHeight: number;
    footerStorePageItemCount: number;
    footerInformationItemCount: number;
    primaryNavigationMaxLineCount: number;
    destructiveLinkLabelCount: number;
    destructiveLinkLabels: readonly string[];
    footerWordmarkLineCount: number;
    footerWordmarkOverflows: boolean;
    contentTransitionWidth: number;
  }>;

export type P10B18B01StorageEvidence = Readonly<{
  storeKey: string;
  persistedSnapshotFingerprint: string;
  persistedDesignDnaFingerprint: string;
  reloadedSnapshotFingerprint: string;
  reloadedDesignDnaFingerprint: string;
  commerceFingerprint: string;
  mediaFingerprint: string;
}>;

type NavigationEntry = Readonly<{ label: string; href: string }>;

function expectedNavigation(
  snapshot: StorefrontSnapshot,
  projectId: string,
  locale: P10B18ALocale,
  location: "primary" | "footer",
): readonly NavigationEntry[] {
  const suffix = `?locale=${locale}`;
  const prefix = `/projects/${projectId}`;
  return snapshot.navigation[location].map((item) => {
    let href: string;
    if (item.target.type === "external") {
      href = item.target.url;
    } else {
      const identity = item.target.type === "page" ? item.target.pageId : item.target.routeId;
      const route =
        item.target.type === "page"
          ? snapshot.pages.find(({ id }) => id === identity)?.slug
          : snapshot.dynamicCommercePresentation?.routeInventory.find(({ id }) => id === identity)
              ?.route;
      if (!route) throw new Error(`P10B-18B-01 navigation ${item.id} has no canonical route.`);
      href = `${prefix}${route === "/" ? "" : route}${suffix}`;
    }
    return {
      label: resolveLocalizedText(item.label, locale, locale),
      href,
    };
  });
}

function sameEntries(left: readonly NavigationEntry[], right: readonly NavigationEntry[]): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

async function inspectRenderedFrame(page: Page) {
  const root = page.locator(".project-preview__storefront");
  return root.evaluate((candidate) => {
    const normalizedText = (node: Element) => node.textContent?.replace(/\s+/gu, " ").trim() ?? "";
    const entries = (selector: string) =>
      [...candidate.querySelectorAll<HTMLAnchorElement>(selector)].map((anchor) => ({
        label: normalizedText(anchor),
        href: anchor.getAttribute("href") ?? "",
      }));
    const lineCount = (node: Element | null) => {
      if (!node) return 0;
      const range = node.ownerDocument.createRange();
      range.selectNodeContents(node);
      return new Set(
        [...range.getClientRects()]
          .filter(({ width, height }) => width > 0 && height > 0)
          .map(({ top }) => Math.round(top * 10) / 10),
      ).size;
    };
    const rootBounds = candidate.getBoundingClientRect();
    const inspectedLinks = [
      ...candidate.querySelectorAll<HTMLAnchorElement>(
        '[data-frame-region="primary-navigation"] a, [data-frame-region="footer-store-pages"] a, [data-frame-region="footer-information"] a',
      ),
    ].flatMap((anchor) => {
      const bounds = anchor.getBoundingClientRect();
      if (bounds.width === 0 || bounds.height === 0) return [];
      const lines = lineCount(anchor);
      const overflows =
        anchor.scrollWidth > anchor.clientWidth + 1 ||
        bounds.left < rootBounds.left - 1 ||
        bounds.right > rootBounds.right + 1;
      return [
        {
          label: normalizedText(anchor),
          lines,
          overflows,
          destructive: overflows || lines > 2,
        },
      ];
    });
    const header = candidate.querySelector<HTMLElement>('[data-frame-region="header"]');
    const footer = candidate.querySelector<HTMLElement>('[data-frame-region="footer"]');
    const main = candidate.querySelector<HTMLElement>("main");
    const wordmark = footer?.querySelector<HTMLElement>(
      '[data-frame-region="footer-brand"] .store-brand',
    );
    if (!header || !footer || !main || !wordmark) {
      throw new Error("P10B-18B-01 rendered frame regions are incomplete.");
    }
    const wordmarkBounds = wordmark.getBoundingClientRect();
    const footerBounds = footer.getBoundingClientRect();
    const computed = getComputedStyle(candidate);
    const cssVariableNames = [
      "--brand-design-dna-version",
      "--brand-design-dna-fingerprint",
      "--brand-font-display",
      "--brand-font-heading",
      "--brand-font-body",
      "--brand-type-scale-ratio",
      "--brand-section-rhythm",
      "--brand-page-gutter",
      "--brand-grid-gap",
      "--brand-card-inset",
      "--brand-surface-page",
      "--brand-surface-default",
      "--brand-surface-muted",
      "--brand-border-width",
      "--brand-radius",
      "--brand-elevation-shadow",
      "--brand-control-height",
      "--brand-control-radius",
      "--brand-density-global",
      "--brand-density-navigation",
      "--brand-density-content",
      "--brand-density-commerce",
      "--brand-media-ratio",
      "--brand-media-crop",
      "--brand-media-prominence",
    ];
    const cssVariables = Object.fromEntries(
      cssVariableNames.map((name) => [name, computed.getPropertyValue(name).trim()]),
    );
    const primaryNavigation = entries(
      '[data-frame-region="header"] [data-frame-region="primary-navigation"] a',
    );
    const footerStorePages = entries('[data-frame-region="footer-store-pages"] a');
    const footerInformation = entries('[data-frame-region="footer-information"] a');
    const visiblePrimaryLines = [
      ...candidate.querySelectorAll<HTMLAnchorElement>(
        '[data-frame-region="header"] [data-frame-region="primary-navigation"] a',
      ),
    ].flatMap((anchor) => {
      const bounds = anchor.getBoundingClientRect();
      return bounds.width > 0 && bounds.height > 0 ? [lineCount(anchor)] : [];
    });
    return {
      cssVariables,
      renderedGeometry: {
        sectionRhythm: cssVariables["--brand-section-rhythm"] ?? "",
        pageGutter: cssVariables["--brand-page-gutter"] ?? "",
        gridGap: cssVariables["--brand-grid-gap"] ?? "",
        cardInset: cssVariables["--brand-card-inset"] ?? "",
        controlHeight: cssVariables["--brand-control-height"] ?? "",
        globalDensity: cssVariables["--brand-density-global"] ?? "",
        navigationDensity: cssVariables["--brand-density-navigation"] ?? "",
        contentDensity: cssVariables["--brand-density-content"] ?? "",
        commerceDensity: cssVariables["--brand-density-commerce"] ?? "",
      },
      primaryNavigation,
      footerStorePages,
      footerInformation,
      headerVariant: header.dataset.headerVariant ?? "",
      mobileNavigationMode: header.dataset.mobileNavigationMode ?? "",
      headerTransformations:
        header.dataset.responsiveTransformations?.split(/\s+/gu).filter(Boolean) ?? [],
      footerComposition: footer.dataset.footerComposition ?? "",
      footerTransformations:
        footer.dataset.responsiveTransformations?.split(/\s+/gu).filter(Boolean) ?? [],
      footerHeight: Math.ceil(footerBounds.height),
      primaryNavigationMaxLineCount: Math.max(0, ...visiblePrimaryLines),
      destructiveLinkLabelCount: inspectedLinks.filter(({ destructive }) => destructive).length,
      destructiveLinkLabels: inspectedLinks
        .filter(({ destructive }) => destructive)
        .map(({ label }) => label),
      footerWordmarkLineCount: lineCount(wordmark),
      footerWordmarkOverflows:
        wordmark.scrollWidth > wordmark.clientWidth + 1 ||
        wordmarkBounds.left < footerBounds.left - 1 ||
        wordmarkBounds.right > footerBounds.right + 1,
      contentTransitionWidth: Number.parseFloat(getComputedStyle(main).borderBlockStartWidth) || 0,
    };
  });
}

export async function captureP10B18B01Evidence({
  page,
  store,
  snapshot,
  captureRole,
  surface,
  route,
  width,
  profileOrArchetype,
}: {
  page: Page;
  store: P10B18B01StoreBinding;
  snapshot: StorefrontSnapshot;
  captureRole: P10B18B01CaptureRole;
  surface: P10B18ASurface;
  route: string;
  width: P10B18AWidth;
  profileOrArchetype: string;
}): Promise<P10B18B01CaptureEvidence> {
  const base = await captureP10B18AEvidence({
    page,
    store: store.legacyManifest,
    surface,
    route,
    width,
    profileOrArchetype,
  });
  const rendered = await inspectRenderedFrame(page);
  const expectedPrimary = expectedNavigation(snapshot, store.projectId, store.locale, "primary");
  const expectedFooter = expectedNavigation(snapshot, store.projectId, store.locale, "footer");
  if (!sameEntries(rendered.primaryNavigation, expectedPrimary)) {
    throw new Error(`${store.key}:${surface}:${width} changed canonical primary navigation.`);
  }
  if (!sameEntries(rendered.footerInformation, expectedFooter)) {
    throw new Error(`${store.key}:${surface}:${width} changed canonical footer navigation.`);
  }
  const expectsStorePages = store.frameAuthority.footerComposition !== "compact-commerce-legal";
  if (
    (expectsStorePages && !sameEntries(rendered.footerStorePages, expectedPrimary)) ||
    (!expectsStorePages && rendered.footerStorePages.length !== 0)
  ) {
    throw new Error(`${store.key}:${surface}:${width} changed the registered footer content.`);
  }
  const renderedCssDesignDnaFingerprint =
    rendered.cssVariables["--brand-design-dna-fingerprint"] ?? "";
  if (renderedCssDesignDnaFingerprint !== store.materializedDesignDnaFingerprint) {
    throw new Error(`${store.key}:${surface}:${width} rendered stale Design DNA.`);
  }
  if (
    rendered.headerVariant !== store.frameAuthority.headerVariant ||
    rendered.mobileNavigationMode !== store.frameAuthority.mobileNavigationMode ||
    rendered.footerComposition !== store.frameAuthority.footerComposition ||
    JSON.stringify(rendered.headerTransformations) !==
      JSON.stringify(store.frameAuthority.responsiveTransformationIds) ||
    JSON.stringify(rendered.footerTransformations) !==
      JSON.stringify(store.frameAuthority.responsiveTransformationIds)
  ) {
    throw new Error(`${store.key}:${surface}:${width} rendered stale frame authority.`);
  }
  return {
    ...base,
    captureRole,
    storeKey: store.key,
    exactCompiledDesignDnaFingerprint: store.exactCompiledDesignDnaFingerprint,
    materializedDesignDnaFingerprint: store.materializedDesignDnaFingerprint,
    renderedCssDesignDnaFingerprint,
    renderedCssProjectionFingerprint: `p10b18b01-rendered-css-${canonicalValueFingerprint(
      rendered.cssVariables,
    )}`,
    renderedGeometry: rendered.renderedGeometry,
    navigationFingerprint: `p10b18b01-navigation-${canonicalValueFingerprint({
      primary: rendered.primaryNavigation,
      footer: rendered.footerInformation,
    })}`,
    footerContentFingerprint: `p10b18b01-footer-${canonicalValueFingerprint({
      storePages: rendered.footerStorePages,
      information: rendered.footerInformation,
    })}`,
    headerVariant: rendered.headerVariant,
    mobileNavigationMode: rendered.mobileNavigationMode,
    footerComposition: rendered.footerComposition,
    footerHeight: rendered.footerHeight,
    footerStorePageItemCount: rendered.footerStorePages.length,
    footerInformationItemCount: rendered.footerInformation.length,
    primaryNavigationMaxLineCount: rendered.primaryNavigationMaxLineCount,
    destructiveLinkLabelCount: rendered.destructiveLinkLabelCount,
    destructiveLinkLabels: rendered.destructiveLinkLabels,
    footerWordmarkLineCount: rendered.footerWordmarkLineCount,
    footerWordmarkOverflows: rendered.footerWordmarkOverflows,
    contentTransitionWidth: rendered.contentTransitionWidth,
  };
}

export async function writeP10B18B01EvidenceManifest({
  stores,
  captures,
  ledger,
  capturePlan,
  storage,
}: {
  stores: readonly P10B18B01StoreBinding[];
  captures: readonly P10B18B01CaptureEvidence[];
  ledger: P10B18ARequestLedger;
  storage: readonly P10B18B01StorageEvidence[];
  capturePlan: readonly Readonly<{
    storeKey: string;
    role: P10B18B01CaptureRole;
    surface: P10B18ASurface;
    width: P10B18AWidth;
  }>[];
}): Promise<string> {
  const directory = p10b18aEvidenceDirectory();
  await mkdir(directory, { recursive: true });
  const path = resolve(directory, "p10b-18b-01-design-dna-shared-frames-manifest.json");
  const orderedStores = [...stores].sort((left, right) => left.key.localeCompare(right.key));
  const orderedCaptures = [...captures].sort((left, right) =>
    `${left.storeKey}:${left.surface}:${left.viewport}`.localeCompare(
      `${right.storeKey}:${right.surface}:${right.viewport}`,
    ),
  );
  const material = {
    contractVersion: "p10b-18b-01-design-dna-shared-frame-browser-evidence-v1",
    runId: p10b18aEvidenceRunId(),
    fixtureClassification:
      "production-disabled deterministic Aurum, Karvonen and neutral P10B-18A authorities",
    renderer: "current normal saved-draft preview routes",
    captureRoot: ".project-preview__storefront",
    captureCount: orderedCaptures.length,
    capturePlan,
    stores: orderedStores.map(({ legacyManifest, ...store }) => ({
      ...store,
      legacyCaptureCaseId: legacyManifest.caseId,
    })),
    storage: [...storage].sort((left, right) => left.storeKey.localeCompare(right.storeKey)),
    captures: orderedCaptures,
    requestLedger: ledger,
  };
  await writeFile(path, `${JSON.stringify(material, null, 2)}\n`, "utf8");
  return path;
}
