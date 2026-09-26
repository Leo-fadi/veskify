import type { Locator } from "@playwright/test";
import type { Ar06aVisibilitySample } from "./ar-06a-composition-observation";

/** Scalar identity/readiness evidence; this never changes loading or application state. */
export function inspectAr06bImage(image: Element) {
  if (!(image instanceof HTMLImageElement)) throw new Error("Expected image element");
  return {
    owner:
      image.closest("[data-composed-section]")?.getAttribute("data-composed-section") ??
      image.closest("header,footer")?.tagName ??
      "frame",
    alt: image.alt,
    src: image.getAttribute("src"),
    srcset: image.getAttribute("srcset"),
    currentSrc: image.currentSrc,
    connected: image.isConnected,
    complete: image.complete,
    naturalWidth: image.naturalWidth,
    naturalHeight: image.naturalHeight,
    loading: image.loading,
  };
}

/** Keep real pointer samples below installed Puck's 10px direction interval. */
export function ar06bDragSteps(distance: number, frameScale = 1) {
  if (!Number.isFinite(distance) || distance < 0 || !Number.isFinite(frameScale) || frameScale <= 0)
    throw new Error("Invalid drag geometry");
  return Math.max(1, Math.ceil(distance / (8 * frameScale)));
}

/** Pointer offset into the next adjacent, equal-width section. */
export function ar06bDropOffset(
  sourceHeight: number,
  targetHeight: number,
  grabInset: number,
  gap = 0,
  visibleEnd = Infinity,
  visibleStart = 0,
) {
  if (![sourceHeight, targetHeight, grabInset].every((n) => Number.isFinite(n) && n > 0))
    throw new Error("Invalid drag geometry");
  if (!Number.isFinite(gap)) throw new Error("Invalid drag geometry");
  // Equal-priority Puck candidates rank by intersection / target area, including self.
  const tie = (sourceHeight * (targetHeight + gap)) / (sourceHeight + targetHeight);
  const lower = Math.max(0, targetHeight * 0.55 - grabInset, tie - gap - grabInset, visibleStart);
  const upper = Math.min(targetHeight, visibleEnd);
  if (!(lower < upper)) throw new Error("No interior drag destination");
  const preferred = Math.max(targetHeight * 0.56, (tie + gap + targetHeight) / 2 - grabInset - gap);
  return preferred > lower && preferred < upper ? preferred : (lower + upper) / 2;
}

type Box = { x: number; y: number; width: number; height: number };

/** Project one atomic local/frame observation, rather than combine independently timed boxes. */
export function ar06bFrameBox(local: Box, frame: Box, size: { width: number; height: number }) {
  if (
    ![...Object.values(local), ...Object.values(frame), ...Object.values(size)].every(
      Number.isFinite,
    ) ||
    [local.width, local.height, frame.width, frame.height, size.width, size.height].some(
      (n) => n <= 0,
    )
  )
    throw new Error("Invalid frame geometry");
  const x = frame.width / size.width,
    y = frame.height / size.height;
  return {
    x: frame.x + local.x * x,
    y: frame.y + local.y * y,
    width: local.width * x,
    height: local.height * y,
  };
}

export async function observeAr06bFrameBox(locator: Locator) {
  const sample = await locator.evaluate((node) => {
    const win = node.ownerDocument.defaultView!,
      frame = win.frameElement as HTMLIFrameElement | null;
    if (!frame || frame.tagName !== "IFRAME") throw new Error("Expected composed iframe");
    const rect = node.getBoundingClientRect(),
      outer = frame.getBoundingClientRect();
    return {
      local: {
        x: rect.x + frame.clientLeft,
        y: rect.y + frame.clientTop,
        width: rect.width,
        height: rect.height,
      },
      frame: { x: outer.x, y: outer.y, width: outer.width, height: outer.height },
      size: { width: frame.offsetWidth, height: frame.offsetHeight },
    };
  });
  return ar06bFrameBox(sample.local, sample.frame, sample.size);
}

/** Same adjacent permutation from the opposite side when the downward midpoint is offscreen. */
export function ar06bUpwardDrop(source: Box, target: Box, top: number, bottom: number) {
  if (
    ![...Object.values(source), ...Object.values(target), top, bottom].every(Number.isFinite) ||
    source.height <= 0 ||
    target.height <= 0 ||
    source.width <= 0 ||
    target.width <= 0 ||
    Math.abs(target.y + target.height - source.y) > 2 ||
    Math.abs(source.x - target.x) > 2 ||
    Math.abs(source.width - target.width) > 2
  )
    throw new Error("Invalid adjacent upward geometry");
  const grab = Math.min(60, source.height / 2, target.height / 2);
  const start = { x: source.x + source.width / 2, y: source.y + grab };
  const end = { x: target.x + target.width / 2, y: target.y + grab };
  const delta = end.y - start.y,
    movedTop = source.y + delta,
    movedBottom = movedTop + source.height;
  const overlap = (box: Box) =>
    Math.max(0, Math.min(movedBottom, box.y + box.height) - Math.max(movedTop, box.y)) / box.height;
  const targetScore = overlap(target),
    selfScore = overlap(source),
    center = source.y + source.height / 2;
  if (
    start.y <= top ||
    start.y >= bottom ||
    end.y <= top ||
    end.y >= bottom ||
    delta >= -10 ||
    movedTop >= target.y + target.height * 0.45 ||
    targetScore <= selfScore ||
    Math.abs(end.y - center) <= Math.abs(start.y - center)
  )
    throw new Error("No valid visible upward collision");
  return { start, end, targetScore, selfScore, movedTop, delta };
}

/** One observation routine for the real iframe and the separate canonical preview. */
export async function observeAr06bDocument(container: Locator) {
  return container.evaluate((element) => {
    const doc = element.ownerDocument;
    const win = doc.defaultView!;
    const main = element.querySelector<HTMLElement>("main")!;
    const root = main.parentElement!;
    const origin = root.getBoundingClientRect();
    const box = (node: Element) => {
      const r = node.getBoundingClientRect();
      return { x: r.x - origin.x, y: r.y - origin.y, width: r.width, height: r.height };
    };
    const text = (node: Element | null) => node?.textContent?.replace(/\s+/gu, " ").trim() ?? "";
    const sectionId = (node: Element) =>
      node.closest<HTMLElement>("[data-composed-section]")?.dataset.composedSection ??
      "shared-frame";
    const attributes = (node: Element) =>
      Object.fromEntries(
        [...node.attributes]
          .filter(
            (a) =>
              a.name.startsWith("data-") ||
              ["href", "alt", "src", "type", "aria-label"].includes(a.name),
          )
          .map((a) => [a.name, a.value]),
      );
    const controls = [
      ...root.querySelectorAll<HTMLElement>("a[href],button,input,select,textarea"),
    ];
    const images = [...root.querySelectorAll<HTMLImageElement>("img")];
    return {
      viewportWidth: win.innerWidth,
      viewportHeight: win.innerHeight,
      mainCount: element.querySelectorAll("main").length,
      frame: {
        headers: root.querySelectorAll("header").length,
        footers: root.querySelectorAll("footer").length,
      },
      language: root.lang,
      overflow: doc.documentElement.scrollWidth - win.innerWidth,
      regions: [...root.querySelectorAll<HTMLElement>("[data-composed-region]")].map((region) => ({
        id: region.dataset.composedRegion!,
        box: box(region),
        padding: parseFloat(win.getComputedStyle(region).paddingBlockStart),
        sections: [...region.querySelectorAll<HTMLElement>("[data-composed-section]")].map(
          (section) => ({
            id: section.dataset.composedSection!,
            box: box(section),
            text: text(section),
          }),
        ),
      })),
      pair: root.querySelector("[data-composed-pair]") !== null,
      cards: [...root.querySelectorAll<HTMLElement>("[data-card-anatomy]")].map((card) => ({
        sectionId: sectionId(card),
        attributes: attributes(card),
        text: text(card),
        products: [...card.querySelectorAll("[data-product-id]")].map(attributes),
        media: [...card.querySelectorAll("img,[data-asset-id]")].map(attributes),
      })),
      controls: controls.map((control) => ({
        sectionId: sectionId(control),
        tag: control.tagName,
        attributes: attributes(control),
        text: text(control),
      })),
      images: images.map((image) => ({
        sectionId: sectionId(image),
        attributes: attributes(image),
        complete: image.complete,
        naturalWidth: image.naturalWidth,
        naturalHeight: image.naturalHeight,
      })),
    };
  });
}

/** Text ranges and actual controls must fit real clipping ancestors in either document. */
export async function observeAr06bVisibility(container: Locator): Promise<Ar06aVisibilitySample[]> {
  return container.evaluate(observeAr06bVisibilityInDocument);
}

/** Same browser observation is exercised with focused selection-wrapper controls. */
export function observeAr06bVisibilityInDocument(element: Element): Ar06aVisibilitySample[] {
  const doc = element.ownerDocument,
    win = doc.defaultView!;
  const root = element.querySelector("main")!.parentElement!;
  const samples: Ar06aVisibilitySample[] = [];
  const box = (r: DOMRect) => ({ left: r.left, right: r.right, top: r.top, bottom: r.bottom });
  const record = (node: HTMLElement, r: DOMRect, label: string) => {
    const owner =
      node.closest(".store-hero__copy,[data-card-anatomy]") ?? root.querySelector("main")!;
    const boundaries = [
      box(owner.getBoundingClientRect()),
      { left: 0, right: win.innerWidth, top: 0, bottom: win.innerHeight },
    ];
    for (
      let ancestor = node.parentElement;
      ancestor && root.contains(ancestor);
      ancestor = ancestor.parentElement
    ) {
      const style = win.getComputedStyle(ancestor);
      if (
        [style.overflowX, style.overflowY].some((v) =>
          ["hidden", "clip", "auto", "scroll"].includes(v),
        )
      )
        boundaries.push(box(ancestor.getBoundingClientRect()));
    }
    const component = node.closest<HTMLElement>("[data-puck-component]");
    let painted = true;
    for (let ancestor: HTMLElement | null = node; ancestor; ancestor = ancestor.parentElement) {
      const style = win.getComputedStyle(ancestor);
      if (
        style.display === "none" ||
        style.visibility === "hidden" ||
        parseFloat(style.opacity) === 0
      )
        painted = false;
    }
    const unobscured =
      painted &&
      [0.1, 0.5, 0.9].every((f) => {
        const hit = doc.elementFromPoint(r.left + r.width * f, r.top + r.height / 2);
        return (
          hit !== null &&
          (hit === node ||
            node.contains(hit) ||
            (component !== null &&
              hit === component &&
              win.getComputedStyle(node).pointerEvents === "none"))
        );
      });
    samples.push({ label, content: box(r), boundaries, unobscured });
  };
  for (const owner of root.querySelectorAll(".store-hero__copy,[data-card-anatomy]")) {
    const walker = doc.createTreeWalker(owner, NodeFilter.SHOW_TEXT);
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      if (!node.textContent?.trim()) continue;
      const parent = node.parentElement!;
      parent.scrollIntoView({ block: "center", behavior: "instant" });
      const range = doc.createRange();
      range.selectNodeContents(node);
      const rectangles = [...range.getClientRects()];
      if (!rectangles.length) throw new Error("Required text has no rectangles");
      for (const rect of rectangles) record(parent, rect, "text: " + node.textContent.trim());
    }
  }
  for (const node of root.querySelectorAll<HTMLElement>(
    "main a[href],main button,main input,main select,[data-card-region=media] img",
  )) {
    node.scrollIntoView({ block: "center", behavior: "instant" });
    record(
      node,
      node.getBoundingClientRect(),
      node.tagName +
        ": " +
        (node.textContent?.trim() || node.getAttribute("alt") || node.getAttribute("aria-label")),
    );
  }
  win.scrollTo(0, 0);
  return samples;
}

export function inspectAr06bCacheControl(
  raw: string | undefined,
  scope: { nodeEnvironment: string; runtimeMode: string; flag: string; pathname: string },
) {
  if (!raw?.trim()) throw new Error("Missing Cache-Control");
  const directives = new Map<string, string | null>();
  for (const part of raw.split(",")) {
    const m = /^\s*([a-z][a-z-]*)(?:\s*=\s*(0|"0"))?\s*$/iu.exec(part);
    if (!m) throw new Error("Malformed/freshness Cache-Control");
    const name = m[1].toLowerCase(),
      value = m[2] === undefined ? null : "0";
    if (
      directives.has(name) ||
      (["private", "no-store", "no-cache", "must-revalidate"].includes(name)
        ? value !== null
        : name !== "max-age" || value !== "0")
    )
      throw new Error("Unsupported Cache-Control");
    directives.set(name, value);
  }
  const strict = directives.has("private") || directives.has("no-store");
  const development =
    directives.size === 2 &&
    directives.has("no-cache") &&
    directives.has("must-revalidate") &&
    scope.pathname === "/acceptance/ar-06b" &&
    scope.nodeEnvironment === "development" &&
    scope.runtimeMode === "standalone" &&
    scope.flag === "1";
  if (!strict && !development) throw new Error("Cache-Control outside bounded exception");
  return {
    mode: strict ? "private-or-no-store" : "development-revalidation-only",
    directives: Object.fromEntries(directives),
  };
}
