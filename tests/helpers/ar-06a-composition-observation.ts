import type { Page } from "@playwright/test";

type VisibilityBox = { left: number; right: number; top: number; bottom: number };
export type Ar06aVisibilitySample = {
  label: string;
  content: VisibilityBox;
  boundaries: VisibilityBox[];
  unobscured: boolean;
};

/** Range/element rectangles must fit their real clipping ancestors, not just the viewport. */
export function inspectAr06aVisibility(samples: Ar06aVisibilitySample[]) {
  if (!samples.length) throw new Error("Missing text/control/media visibility evidence");
  return samples
    .filter(
      ({ content: r, boundaries, unobscured }) =>
        !unobscured ||
        !boundaries.length ||
        !Object.values(r).every(Number.isFinite) ||
        r.right <= r.left ||
        r.bottom <= r.top ||
        boundaries.some(
          (b) =>
            !Object.values(b).every(Number.isFinite) ||
            r.left < b.left - 2 ||
            r.right > b.right + 2 ||
            r.top < b.top - 2 ||
            r.bottom > b.bottom + 2,
        ),
    )
    .map(({ label }) => label);
}

type Ar06aHeaderScope = Readonly<{
  pathname: string;
  nodeEnvironment: string;
  runtimeMode: string;
  acceptanceFlag: string;
  approvedFixtureOnly: boolean;
}>;

/** Task-local rule; the development exception proves neither non-storage nor cache privacy. */
export function inspectAr06aCacheControl(raw: string | undefined, scope: Ar06aHeaderScope) {
  if (!raw?.trim()) throw new Error("Missing Cache-Control");
  const directives = new Map<string, string | null>();
  const bare = new Set(["private", "no-store", "no-cache", "must-revalidate"]);
  for (const part of raw.split(",")) {
    const match = /^\s*([a-z][a-z-]*)(?:\s*=\s*(0|"0"))?\s*$/iu.exec(part);
    if (!match) throw new Error("Malformed or freshness-bearing Cache-Control");
    const name = match[1].toLowerCase();
    const value = match[2] === undefined ? null : "0";
    if (directives.has(name)) throw new Error("Repeated Cache-Control directive");
    if (bare.has(name) ? value !== null : name !== "max-age" || value !== "0")
      throw new Error("Unsupported Cache-Control directive");
    directives.set(name, value);
  }
  const strict = directives.has("private") || directives.has("no-store");
  const development =
    directives.size === 2 &&
    directives.has("no-cache") &&
    directives.has("must-revalidate") &&
    scope.pathname === "/acceptance/ar-06a" &&
    scope.nodeEnvironment === "development" &&
    scope.runtimeMode === "standalone" &&
    scope.acceptanceFlag === "1" &&
    scope.approvedFixtureOnly;
  if (!strict && !development) throw new Error("Cache-Control outside AR-06A exception");
  return {
    mode: strict ? "original-private-or-no-store" : "development-revalidation-exception",
    directives: Object.fromEntries([...directives].sort(([a], [b]) => a.localeCompare(b))),
  };
}

export async function settleComposedPage(page: Page) {
  await page.locator("[data-ar06a-ready=true]").waitFor();
  for (const image of await page.locator("img:visible").all()) {
    await image.scrollIntoViewIfNeeded();
    await image.evaluate(async (element) => {
      await (element as HTMLImageElement).decode();
      if (!(element as HTMLImageElement).naturalWidth) throw new Error("Unsettled image");
    });
  }
  await page.evaluate(async () => {
    await document.fonts.ready;
    window.scrollTo(0, 0);
  });
}

/** Executed in the actual browser, without layout overrides. */
export function observeComposedPage() {
  const root = document.querySelector<HTMLElement>("[data-ar06a-ready=true]")!;
  const box = (element: Element) => {
    const rect = element.getBoundingClientRect();
    return {
      x: rect.x,
      y: rect.y,
      width: rect.width,
      height: rect.height,
      right: rect.right,
      bottom: rect.bottom,
    };
  };
  const shown = (element: HTMLElement) => {
    const style = getComputedStyle(element);
    return (
      element.getClientRects().length > 0 &&
      style.visibility !== "hidden" &&
      style.display !== "none"
    );
  };
  const controls = [
    ...document.querySelectorAll<HTMLElement>("a[href],button,input,select,textarea,[tabindex]"),
  ];
  const focusable = controls.flatMap((element, domIndex) =>
    shown(element) &&
    element.tabIndex >= 0 &&
    !element.matches(":disabled") &&
    !element.closest("[inert]")
      ? [
          {
            domIndex,
            tag: element.tagName,
            text: element.getAttribute("aria-label") ?? element.textContent?.trim() ?? "",
            href: element.getAttribute("href"),
            box: box(element),
          },
        ]
      : [],
  );
  const regions = [...root.querySelectorAll<HTMLElement>("[data-composed-region]")].map(
    (element) => ({
      id: element.dataset.composedRegion!,
      box: box(element),
      contentBox: box(element.querySelector("[data-composed-section]")!),
      paddingBlockStart: parseFloat(getComputedStyle(element).paddingBlockStart),
      sectionIds: [...element.querySelectorAll<HTMLElement>("[data-composed-section]")].map(
        (section) => section.dataset.composedSection!,
      ),
    }),
  );
  const pair = root.querySelector<HTMLElement>("[data-composed-pair]");
  if (!root.firstElementChild) throw new Error("Missing composed root");
  const style = getComputedStyle(root.firstElementChild);
  const spacingScale = style.getPropertyValue("--brand-spacing-scale");
  const rootFontSize = getComputedStyle(document.documentElement).fontSize;
  if (!(parseFloat(spacingScale) > 0)) throw new Error("Missing brand spacing token");
  const images = [...root.querySelectorAll<HTMLImageElement>("img")]
    .filter(shown)
    .map((element) => ({
      src: element.currentSrc,
      alt: element.alt,
      complete: element.complete,
      naturalWidth: element.naturalWidth,
      naturalHeight: element.naturalHeight,
      box: box(element),
    }));
  const overflowing = [...root.querySelectorAll<HTMLElement>("main *")]
    .filter((element) => {
      if (!shown(element) || element.getAttribute("aria-hidden") === "true") return false;
      const rect = element.getBoundingClientRect();
      // Tiny off-screen focus/assistive labels are not visual content.
      return rect.width > 2 && rect.height > 2 && (rect.left < -2 || rect.right > innerWidth + 2);
    })
    .map((element) => ({
      tag: element.tagName,
      section: element.closest<HTMLElement>("[data-composed-section]")?.dataset.composedSection,
      box: box(element),
    }));
  return {
    locale: root.dataset.activeLocale,
    identities: Object.fromEntries(
      [...root.attributes]
        .filter((attribute) => attribute.name.startsWith("data-identity-"))
        .map((attribute) => [attribute.name.slice(14), attribute.value]),
    ),
    regions,
    focusable,
    images,
    overflowing,
    mainCount: document.querySelectorAll("main").length,
    frame: {
      headers: document.querySelectorAll("header").length,
      footers: document.querySelectorAll("footer").length,
    },
    pair: pair ? { box: box(pair), gap: parseFloat(getComputedStyle(pair).columnGap) } : null,
    tokens: { spacingScale, rootFontSize, offsetRem: 3 },
    expectedOffset: 3 * parseFloat(rootFontSize) * parseFloat(spacingScale),
    overflow: document.documentElement.scrollWidth - innerWidth,
    readingOrder: regions.flatMap((region) => region.sectionIds),
  };
}

export async function traverseComposedControls(page: Page, count: number) {
  await page.evaluate(() => {
    const previous = document.body.getAttribute("tabindex");
    document.body.setAttribute("tabindex", "-1");
    document.body.focus();
    if (previous === null) document.body.removeAttribute("tabindex");
    else document.body.setAttribute("tabindex", previous);
  });
  const sequence: number[] = [];
  for (let index = 0; index < count; index++) {
    await page.keyboard.press("Tab");
    sequence.push(
      await page.evaluate(() =>
        [...document.querySelectorAll("a[href],button,input,select,textarea,[tabindex]")].indexOf(
          document.activeElement!,
        ),
      ),
    );
  }
  if (sequence.includes(-1)) throw new Error("Tab escaped observed controls");
  await page.evaluate(() => window.scrollTo(0, 0));
  return sequence;
}
