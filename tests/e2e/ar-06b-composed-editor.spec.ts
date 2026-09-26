import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test, type Page, type FullConfig } from "@playwright/test";
import { inspectAr06aVisibility } from "../helpers/ar-06a-composition-observation";
import {
  ar06bDragSteps,
  ar06bDropOffset,
  ar06bUpwardDrop,
  observeAr06bFrameBox,
  inspectAr06bCacheControl,
  inspectAr06bImage,
  observeAr06bDocument,
  observeAr06bVisibility,
} from "../helpers/ar-06b-edit-observation";

const locales = ["en", "fi"] as const,
  widths = [375, 768, 1024, 1440] as const;
const sourcePaths = [
  "src/app/acceptance/ar-06b/page.tsx",
  "src/integrations/puck/ar-06b-composed-editor-proof.tsx",
  "src/integrations/puck/composed-page-adapter.ts",
  "src/integrations/puck/composed-page-config.tsx",
  "src/integrations/puck/composed-puck-editor.tsx",
  "src/components/storefront/composed-storefront-page.tsx",
  "src/components/storefront/composed-storefront-page.module.css",
  "src/data/demo/ar-06a-composed-template.ts",
  "src/components/storefront/canonical-product-card.module.css",
  "src/app/globals.css",
];
const sourceHashes = Object.fromEntries(
  sourcePaths.map((path) => [path, createHash("sha256").update(readFileSync(path)).digest("hex")]),
);
const originalOrder = [
  "section_home_hero",
  "section_home_categories",
  "section_home_products",
  "section_home_campaign",
  "section_home_story",
  "section_home_benefits",
  "section_home_newsletter",
];
const reorderedOrder = [
  originalOrder[0],
  originalOrder[2],
  originalOrder[1],
  ...originalOrder.slice(3),
];
const near = (a: number, b: number) => expect(Math.abs(a - b)).toBeLessThanOrEqual(2);
// Section movement changes document order; retain order within each exact canonical owner.
const bySection = <T extends { sectionId: string }>(entries: readonly T[]) =>
  [...entries].sort((a, b) => a.sectionId.localeCompare(b.sectionId));
const frame = (page: Page) => page.frameLocator("#preview-frame");
const sections = (page: Page) => frame(page).locator("[data-composed-section]");
const ids = (page: Page) =>
  sections(page).evaluateAll((nodes) =>
    nodes.map((node) => node.getAttribute("data-composed-section")),
  );

type FrameBox = { x: number; y: number; width: number; height: number };
type PointerHit = {
  point: { x: number; y: number };
  framePoint: { x: number; y: number };
  section: string | null;
  puckComponent: string | null;
};
type GestureObservation = {
  source: PointerHit & { box: FrameBox };
  target: PointerHit & { box: FrameBox };
  insertionPreview: readonly string[];
};
const dragEvidence = new WeakMap<Page, Record<string, unknown>[]>();
function record(page: Page, phase: string, value: Record<string, unknown> = {}) {
  const entries = dragEvidence.get(page) ?? [];
  entries.push({ phase, time: performance.now(), ...value });
  dragEvidence.set(page, entries);
}
type PointerDocument = Window & { __ar06bPointerKinds?: () => string[] };
async function pointerObservation(page: Page, start: boolean) {
  return frame(page)
    .locator("html")
    .evaluate((_node, start) => {
      const owner = window as PointerDocument;
      if (!start) {
        const result = owner.__ar06bPointerKinds?.() ?? [];
        delete owner.__ar06bPointerKinds;
        return result;
      }
      const kinds = new Set<string>(),
        types = ["pointerdown", "pointermove", "pointerup"];
      const receive = (event: Event) => kinds.add(event.type);
      for (const type of types) document.addEventListener(type, receive, true);
      owner.__ar06bPointerKinds = () => {
        for (const type of types) document.removeEventListener(type, receive, true);
        return [...kinds];
      };
      return [];
    }, start);
}
async function geometry(
  page: Page,
  sourceId: string,
  targetId: string,
  phase: string,
  values: Record<string, unknown>,
) {
  const dom = await page.evaluate(
    ({ sourceId, targetId }) => {
      const iframe = document.querySelector<HTMLIFrameElement>("#preview-frame")!;
      const inside = iframe.contentWindow!,
        doc = iframe.contentDocument!;
      const box = (node: Element) => {
        const b = node.getBoundingClientRect();
        return { x: b.x, y: b.y, width: b.width, height: b.height };
      };
      const scroll = (node: Element) => ({
        tag: node.tagName,
        id: node.id,
        top: node.scrollTop,
        left: node.scrollLeft,
        height: node.clientHeight,
        extent: node.scrollHeight,
        overflowY: node.ownerDocument.defaultView!.getComputedStyle(node).overflowY,
      });
      const section = (id: string) => {
        const node = doc.querySelector<HTMLElement>(`[data-composed-puck-section="${id}"]`)!;
        const ancestors = [];
        for (let p: Element | null = node; p; p = p.parentElement) ancestors.push(scroll(p));
        const style = inside.getComputedStyle(node);
        return {
          id,
          box: box(node),
          ancestors,
          transform: style.transform,
          position: style.position,
          slot: node.closest("[data-puck-dropzone]")?.getAttribute("data-puck-dropzone"),
        };
      };
      return {
        outer: {
          width: innerWidth,
          height: innerHeight,
          x: scrollX,
          y: scrollY,
          root: scroll(document.documentElement),
          body: scroll(document.body),
        },
        iframe: {
          box: box(iframe),
          transform: getComputedStyle(iframe).transform,
          clientWidth: iframe.clientWidth,
          clientHeight: iframe.clientHeight,
        },
        inner: {
          width: inside.innerWidth,
          height: inside.innerHeight,
          x: inside.scrollX,
          y: inside.scrollY,
        },
        source: section(sourceId),
        target: section(targetId),
      };
    },
    { sourceId, targetId },
  );
  record(page, phase, { sourceId, targetId, ...values, dom });
}
test.afterEach(async ({ page }, info) => {
  await info.attach("drag-state-and-geometry", {
    body: Buffer.from(
      JSON.stringify(
        {
          browser: page.context().browser()?.version(),
          viewport: page.viewportSize(),
          records: dragEvidence.get(page) ?? [],
        },
        null,
        2,
      ),
    ),
    contentType: "application/json",
  });
});
async function state(page: Page) {
  return page
    .locator("[data-ar06b-ready]")
    .evaluate((node) =>
      Object.fromEntries(
        [...node.attributes]
          .filter((a) => a.name.startsWith("data-ar06b-"))
          .map((a) => [a.name, a.value]),
      ),
    );
}
const journeys = new WeakMap<
  Page,
  {
    initial: Record<string, string>;
    edited?: Record<string, string>;
    material: ReturnType<typeof protectedMaterial>;
  }
>();
async function confirmJourney(page: Page, expected: readonly string[], reverse: boolean) {
  await expect.poll(() => ids(page)).toEqual(expected);
  await expect
    .poll(() =>
      page
        .locator("[data-ar06b-preview] [data-composed-section]")
        .evaluateAll((nodes) => nodes.map((node) => node.getAttribute("data-composed-section"))),
    )
    .toEqual(expected);
  await expect
    .poll(() => page.locator("[data-ar06b-ready]").getAttribute("data-ar06b-canonical-order"))
    .toBe(expected.join(","));
  const actual = await state(page),
    journey = journeys.get(page)!;
  record(page, reverse ? "reverse-committed" : "forward-committed", { actual });
  for (const key of ["data-ar06b-puck-session", "data-ar06b-puck-recovery-epoch"]) {
    expect(journey.initial[key]).toBeTruthy();
    expect(actual[key]).toBe(journey.initial[key]);
  }
  expect(actual["data-ar06b-puck-dragging"]).toBe("false");
  const events = JSON.parse(actual["data-ar06b-puck-events"] ?? "[]") as Record<string, string>[];
  expect(events.some((event) => event["data-ar06b-puck-action"] === "move")).toBe(true);
  expect(events.some((event) => event["data-ar06b-puck-outcome"] === "rejected")).toBe(false);
  for (const root of [frame(page).locator("html"), page.locator("[data-ar06b-preview]")])
    expect(protectedMaterial(await observeAr06bDocument(root))).toEqual(journey.material);
  if (reverse)
    for (const key of ["data-ar06b-content-fingerprint", "data-ar06b-composition-fingerprint"])
      expect(actual[key]).toBe(journey.edited![key]);
  else
    expect(actual["data-ar06b-composition-fingerprint"]).not.toBe(
      journey.edited!["data-ar06b-composition-fingerprint"],
    );
}

function protectedMaterial(observed: Awaited<ReturnType<typeof observeAr06bDocument>>) {
  return {
    cards: bySection(observed.cards),
    controls: bySection(observed.controls),
    images: bySection(observed.images),
  };
}

const imageRequests = new WeakMap<Page, Record<string, unknown>[]>();
async function isolation(page: Page, baseURL: string) {
  const requests: Record<string, unknown>[] = [];
  imageRequests.set(page, requests);
  page.on("requestfailed", (request) => {
    if (request.resourceType() === "image")
      requests.push({ url: request.url(), failure: request.failure()?.errorText });
  });
  page.on("response", (response) => {
    if (response.request().resourceType() === "image")
      requests.push({ url: response.url(), status: response.status() });
  });
  const errors: string[] = [],
    forbidden: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  await page.route("**/*", async (route) => {
    const request = route.request(),
      url = new URL(request.url());
    if (
      url.origin !== new URL(baseURL).origin ||
      url.pathname.startsWith("/api/") ||
      !["GET", "HEAD"].includes(request.method())
    ) {
      forbidden.push(request.method() + " " + url.pathname);
      await route.abort();
    } else await route.continue();
  });
  return { errors, forbidden };
}
async function settle(page: Page) {
  await page.locator("[data-ar06b-ready=true]").waitFor();
  await expect(frame(page).locator("main")).toHaveCount(1);
  const observations: Record<string, unknown>[] = [];
  const ready = (s: ReturnType<typeof inspectAr06bImage>) =>
    s.connected && s.complete && s.currentSrc !== "" && s.naturalWidth > 0 && s.naturalHeight > 0;
  const key = (s: ReturnType<typeof inspectAr06bImage>) =>
    JSON.stringify([s.owner, s.alt, s.src, s.srcset]);
  try {
    for (const [document, root] of [
      page.locator("[data-ar06b-preview]"),
      frame(page).locator("html"),
    ].entries()) {
      await root.evaluate((node) => node.ownerDocument.fonts.ready.then(() => undefined));
      const images = root.locator("img");
      const handles = await images.elementHandles();
      const initial = await Promise.all(
        handles.map((handle) => handle.evaluate(inspectAr06bImage)),
      );
      const decodedImages = [];
      for (const [index, original] of handles.entries()) {
        let handle = original,
          state = initial[index];
        const expected = key(state),
          record = { document, initial: state, states: [state], decode: {} };
        observations.push(record);
        if (state.connected && !ready(state)) await handle.scrollIntoViewIfNeeded();
        await expect
          .poll(async () => {
            const next = await handle.evaluate(inspectAr06bImage);
            if (!next.connected) {
              record.states.push(next);
              const candidates = [];
              for (const replacement of await images.elementHandles())
                if (key(await replacement.evaluate(inspectAr06bImage)) === expected)
                  candidates.push(replacement);
              expect(candidates).toHaveLength(1);
              handle = candidates[0];
              await handle.scrollIntoViewIfNeeded();
            }
            state = await handle.evaluate(inspectAr06bImage);
            if (JSON.stringify(state) !== JSON.stringify(record.states.at(-1)))
              record.states.push(state);
            expect(key(state)).toBe(expected);
            return ready(state);
          })
          .toBe(true);
        const decoded = await handle.evaluate(async (image) => {
          if (!(image instanceof HTMLImageElement)) throw new Error("Expected image element");
          return image.decode().then(
            () => ({ result: "fulfilled" }),
            (error: Error) => ({ result: "rejected", name: error.name, message: error.message }),
          );
        });
        const after = await handle.evaluate(inspectAr06bImage);
        record.decode = { ...decoded, before: state, after };
        expect(decoded.result, JSON.stringify(record)).toBe("fulfilled");
        expect(key(after)).toBe(expected);
        expect(after.currentSrc).toBe(state.currentSrc);
        expect(ready(after)).toBe(true);
        decodedImages.push({ handle, expected, currentSrc: after.currentSrc });
      }
      expect(
        await root.evaluate((node, decoded) => {
          const current = [...node.querySelectorAll("img")];
          return (
            current.length === decoded.length &&
            new Set(decoded.map(({ handle }) => handle)).size === current.length &&
            decoded.every(
              ({ handle, currentSrc, expected }) =>
                handle instanceof HTMLImageElement &&
                current.includes(handle) &&
                JSON.stringify([
                  handle
                    .closest("[data-composed-section]")
                    ?.getAttribute("data-composed-section") ??
                    handle.closest("header,footer")?.tagName ??
                    "frame",
                  handle.alt,
                  handle.getAttribute("src"),
                  handle.getAttribute("srcset"),
                ]) === expected &&
                handle.currentSrc === currentSrc &&
                handle.complete &&
                handle.naturalWidth > 0 &&
                handle.naturalHeight > 0,
            )
          );
        }, decodedImages),
      ).toBe(true);
      await root.evaluate((node) => node.ownerDocument.defaultView!.scrollTo(0, 0));
    }
    await page.evaluate(() => window.scrollTo(0, 0));
  } finally {
    await test.info().attach("image-readiness", {
      body: Buffer.from(
        JSON.stringify({ observations, requests: imageRequests.get(page) }, null, 2),
      ),
      contentType: "application/json",
    });
  }
}
async function open(page: Page, layout: string, locale: string, config: FullConfig) {
  const response = await page.goto(`/acceptance/ar-06b?case=${layout}&locale=${locale}`);
  expect(response?.status()).toBe(200);
  const server = config.webServer;
  expect(server?.command).toMatch(/^pnpm dev --port \d+$/u);
  const header = inspectAr06bCacheControl(response?.headers()["cache-control"], {
    pathname: new URL(page.url()).pathname,
    nodeEnvironment: server?.env?.NODE_ENV || "development",
    runtimeMode: server?.env?.VESKIFY_RUNTIME_MODE ?? "",
    flag: server?.env?.VESKIFY_AR06B_ACCEPTANCE ?? "",
  });
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
    "content",
    /noindex.*nofollow/u,
  );
  await settle(page);
  const initial = await state(page),
    material = protectedMaterial(await observeAr06bDocument(page.locator("[data-ar06b-preview]")));
  await expect.poll(() => ids(page)).toEqual(originalOrder);
  expect(initial["data-ar06b-canonical-order"]).toBe(originalOrder.join(","));
  expect(
    (await observeAr06bDocument(page.locator("[data-ar06b-preview]"))).regions.flatMap((r) =>
      r.sections.map((s) => s.id),
    ),
  ).toEqual(originalOrder);
  expect(protectedMaterial(await observeAr06bDocument(frame(page).locator("html")))).toEqual(
    material,
  );
  expect(
    await frame(page)
      .locator("html")
      .evaluate(() => innerWidth),
  ).toBe(page.viewportSize()!.width);
  journeys.set(page, { initial, material });
  record(page, "ready", { initial });
  return header;
}
async function changeHeading(page: Page, locale: string) {
  await frame(page).locator('[data-composed-puck-section="section_home_hero"]').click();
  const heading = page.getByLabel("Main heading", { exact: true });
  await expect(heading).toBeVisible();
  const initial = await heading.inputValue(),
    suffix = ` ${locale}`;
  await heading.press("ControlOrMeta+a");
  await heading.press("ArrowRight");
  await expect
    .poll(() =>
      heading.evaluate((node: HTMLInputElement) => [node.selectionStart, node.selectionEnd]),
    )
    .toEqual([initial.length, initial.length]);
  for (const char of suffix) {
    await heading.pressSequentially(char);
    await expect(heading).toBeFocused();
  }
  const value = initial + suffix;
  await expect(heading).toHaveValue(value);
  await expect(page.locator("[data-ar06b-preview]")).toContainText(value);
  await expect(frame(page).locator('[data-composed-section="section_home_hero"]')).toContainText(
    value,
  );
  return { initial, value };
}
async function reorder(page: Page) {
  journeys.get(page)!.edited = await state(page);
  record(page, "forward-start", { edited: journeys.get(page)!.edited });
  await reorderSections(page, "section_home_categories", "section_home_products");
  await confirmJourney(page, reorderedOrder, false);
}
async function reverseReorder(page: Page) {
  record(page, "reverse-start");
  await reorderSections(page, "section_home_products", "section_home_categories");
  await confirmJourney(page, originalOrder, true);
}

function visiblePoint(box: FrameBox, iframe: FrameBox, viewport: FrameBox, activation = 0) {
  const left = Math.max(box.x, iframe.x, viewport.x),
    top = Math.max(box.y, iframe.y, viewport.y),
    right = Math.min(box.x + box.width, iframe.x + iframe.width, viewport.x + viewport.width),
    bottom = Math.min(box.y + box.height, iframe.y + iframe.height, viewport.y + viewport.height);
  if (right <= left || bottom - top <= activation)
    throw new Error("Puck drag point is outside the visible iframe viewport");
  return { x: (left + right) / 2, y: top + (bottom - top - activation) / 2 };
}

async function pointerHit(page: Page, iframe: FrameBox, point: { x: number; y: number }) {
  return frame(page)
    .locator("html")
    .evaluate(
      (_element, { iframe, point }) => {
        const framePoint = {
          x: (point.x - iframe.x) * (innerWidth / iframe.width),
          y: (point.y - iframe.y) * (innerHeight / iframe.height),
        };
        const hit = document.elementFromPoint(framePoint.x, framePoint.y);
        return {
          point,
          framePoint,
          section:
            hit
              ?.closest("[data-composed-puck-section]")
              ?.getAttribute("data-composed-puck-section") ?? null,
          puckComponent:
            hit?.closest("[data-puck-component]")?.getAttribute("data-puck-component") ?? null,
        };
      },
      { iframe, point },
    );
}

async function reorderSections(
  page: Page,
  requestedSourceId: string,
  requestedTargetId: string,
): Promise<GestureObservation> {
  let sourceId = requestedSourceId,
    targetId = requestedTargetId,
    direction = 1;
  const item = (id: string) => frame(page).locator(`[data-composed-puck-section="${id}"]`);
  let source = item(sourceId),
    target = item(targetId);
  const entry = frame(page).locator("[data-puck-entry]");
  const viewportSize = page.viewportSize();
  if (!viewportSize) throw new Error("Puck drag requires an explicit browser viewport");
  const viewport = { x: 0, y: 0, ...viewportSize };
  const measuredSource = await observeAr06bFrameBox(source),
    measuredTarget = await observeAr06bFrameBox(target);
  const gap = await source.evaluate((node, targetId) => {
    const target = node.ownerDocument.querySelector(`[data-composed-puck-section="${targetId}"]`)!;
    return target.getBoundingClientRect().top - node.getBoundingClientRect().bottom;
  }, targetId);
  try {
    ar06bDropOffset(
      measuredSource.height,
      measuredTarget.height,
      Math.min(60, measuredSource.height / 2),
      gap,
      viewport.height * 0.9 - gap,
    );
  } catch (error) {
    if (!(error instanceof Error) || error.message !== "No interior drag destination") throw error;
    record(page, "planned-equivalent-upward-permutation", {
      sourceId,
      targetId,
      measuredSource,
      measuredTarget,
      gap,
      reason: error.message,
    });
    [sourceId, targetId] = [targetId, sourceId];
    source = item(sourceId);
    target = item(targetId);
    direction = -1;
  }
  await source.scrollIntoViewIfNeeded();
  // ResizeObserver and font/layout completion can shift the iframe after an edit.
  // Observe actual rendered geometry before computing a single wheel delta.
  await expect
    .poll(() =>
      source.evaluate(async (node) => {
        const doc = node.ownerDocument,
          win = doc.defaultView!,
          iframe = win.frameElement!;
        await doc.fonts.ready;
        const sample = () => {
          const local = node.getBoundingClientRect(),
            outer = iframe.getBoundingClientRect();
          return [
            local.x,
            local.y,
            local.width,
            local.height,
            outer.x,
            outer.y,
            outer.width,
            outer.height,
          ];
        };
        const samples = [sample()];
        for (let i = 0; i < 2; i++) {
          await new Promise<void>((resolve) => win.requestAnimationFrame(() => resolve()));
          samples.push(sample());
        }
        return samples.every((row) => row.every((value, index) => value === samples[0][index]));
      }),
    )
    .toBe(true);
  const initialSourceBox = await observeAr06bFrameBox(source);
  // Stage a feasible adjacent boundary before pointerdown, preserving the actual viewport.
  const boundary =
    direction === 1
      ? viewport.height * 0.1
      : Math.min(viewport.height * 0.9, initialSourceBox.y + (await page.evaluate(() => scrollY)));
  const edge = (box: FrameBox) => box.y + (direction === 1 ? box.height : 0);
  const wheelPoint = visiblePoint(
    initialSourceBox,
    (await page.locator("#preview-frame").boundingBox())!,
    viewport,
  );
  await geometry(page, sourceId, targetId, "before-wheel", {
    initialSourceBox,
    wheelPoint,
    boundary,
    direction,
  });
  await page.mouse.move(wheelPoint.x, wheelPoint.y);
  await page.mouse.wheel(0, edge(initialSourceBox) - boundary);
  await expect
    .poll(async () => {
      const box = await observeAr06bFrameBox(source);
      await geometry(page, sourceId, targetId, "source-boundary-poll", {
        box,
        boundary,
        direction,
      });
      return Math.abs(edge(box) - boundary);
    })
    .toBeLessThanOrEqual(2);
  const sourceBox = await observeAr06bFrameBox(source);
  const sourceFrame = await page.locator("#preview-frame").boundingBox();
  if (!sourceFrame) throw new Error("Puck drag source frame is unavailable");
  const plannedUp =
    direction === -1
      ? ar06bUpwardDrop(
          sourceBox,
          await observeAr06bFrameBox(target),
          Math.max(0, sourceFrame.y),
          Math.min(viewport.height, sourceFrame.y + sourceFrame.height),
        )
      : null;
  const sourcePoint = plannedUp?.start ?? {
    x: sourceBox.x + sourceBox.width / 2,
    y: sourceBox.y + sourceBox.height - Math.min(60, sourceBox.height / 2),
  };
  if (plannedUp) record(page, "validated-upward-plan", { sourceId, targetId, ...plannedUp });
  const sourceHit = await pointerHit(page, sourceFrame, sourcePoint);
  if (sourceHit.section !== sourceId || sourceHit.puckComponent !== sourceId)
    throw new Error("Puck drag source pointer does not hit its registered wrapper");
  const expectedSlot = await source.evaluate(
    (node, { targetId, direction }) => {
      const zone = node.closest("[data-puck-dropzone]");
      const items = [...(zone?.querySelectorAll("[data-composed-puck-section]") ?? [])].map(
        (item) => item.getAttribute("data-composed-puck-section")!,
      );
      const sourceId = node.getAttribute("data-composed-puck-section");
      if (
        !sourceId ||
        !items.includes(targetId) ||
        new Set(items).size !== items.length ||
        items.indexOf(targetId) - items.indexOf(sourceId) !== direction
      )
        throw new Error("Puck reorder requires adjacent unique items in the same owned slot");
      const next = items.filter((id) => id !== sourceId);
      next.splice(next.indexOf(targetId) + (direction === 1 ? 1 : 0), 0, sourceId);
      return next;
    },
    { targetId, direction },
  );
  await page.mouse.move(sourcePoint.x, sourcePoint.y);
  let pointerDown = false;
  await pointerObservation(page, true);
  try {
    await page.mouse.down();
    pointerDown = true;
    await page.mouse.move(sourcePoint.x, sourcePoint.y + direction * 12, { steps: 2 });
    await expect.poll(() => entry.getAttribute("data-puck-dragging")).toBe("true");
    const targetBox = await observeAr06bFrameBox(target);
    const targetFrame = await page.locator("#preview-frame").boundingBox();
    if (!targetBox || !targetFrame) throw new Error("Puck drag target frame is unavailable");
    near(targetFrame.y, sourceFrame.y);
    near(targetBox.width, sourceBox.width);
    const operands = [
      sourceBox.height,
      targetBox.height,
      sourceBox.y + sourceBox.height - sourcePoint.y,
      targetBox.y - sourceBox.y - sourceBox.height,
      Math.min(viewport.height, targetFrame.y + targetFrame.height) - targetBox.y,
      Math.max(0, targetFrame.y) - targetBox.y,
    ] as const;
    await geometry(page, sourceId, targetId, "drop-interval", {
      sourceBox,
      targetBox,
      sourceFrame,
      targetFrame,
      sourcePoint,
      operands,
    });
    const up =
      direction === -1
        ? ar06bUpwardDrop(
            sourceBox,
            targetBox,
            Math.max(0, targetFrame.y),
            Math.min(viewport.height, targetFrame.y + targetFrame.height),
          )
        : null;
    if (up && plannedUp) {
      near(up.end.x, plannedUp.end.x);
      near(up.end.y, plannedUp.end.y);
    }
    const targetPoint = up?.end ?? {
      x: targetBox.x + targetBox.width / 2,
      y: targetBox.y + ar06bDropOffset(...operands),
    };
    if (targetPoint.y <= 0 || targetPoint.y >= viewport.height)
      throw new Error("Puck collision midpoint is outside the unchanged browser viewport");
    const targetHit = await pointerHit(page, targetFrame, targetPoint);
    if (targetHit.section !== targetId || targetHit.puckComponent !== targetId)
      throw new Error("Puck drag target pointer does not hit its registered wrapper");
    const frameScale =
      targetFrame.width /
      (await frame(page)
        .locator("html")
        .evaluate(() => innerWidth));
    await page.mouse.move(targetPoint.x, targetPoint.y, {
      steps: ar06bDragSteps(
        Math.hypot(targetPoint.x - sourcePoint.x, targetPoint.y - sourcePoint.y - direction * 12),
        frameScale,
      ),
    });
    // Puck's iframe collision pipeline is asynchronous. A pointer hit is not an
    // accepted insertion. Keep the real keyed source; omit its DnD placeholder copy.
    let insertionPreview: string[] = [];
    await expect
      .poll(async () => {
        insertionPreview = await target.evaluate((node) => {
          const zone = node.closest("[data-puck-dropzone]");
          if (!zone) throw new Error("Puck target has no owning slot");
          return [...zone.querySelectorAll("[data-composed-puck-section]")]
            .filter((item) => !item.closest("[data-dnd-placeholder], [data-puck-overlay]"))
            .map((item) => item.getAttribute("data-composed-puck-section")!);
        });
        return insertionPreview;
      })
      .toEqual(expectedSlot);
    record(page, "insertion-preview", { sourceId, targetId, insertionPreview });
    return {
      source: { ...sourceHit, box: sourceBox },
      target: { ...targetHit, box: targetBox },
      insertionPreview,
    };
  } finally {
    if (pointerDown) {
      await page.mouse.up();
      const pointerKinds = await pointerObservation(page, false);
      record(page, "pointer-up", { sourceId, targetId, pointerKinds });
      expect(pointerKinds).toEqual(
        expect.arrayContaining(["pointerdown", "pointermove", "pointerup"]),
      );
      await expect(entry).not.toHaveAttribute("data-puck-dragging");
      await expect(page.locator("[data-ar06b-ready]")).toHaveAttribute(
        "data-ar06b-puck-dragging",
        "false",
      );
    }
  }
}
async function focusProof(page: Page) {
  const root = frame(page).locator("html");
  const expected = await root.evaluate(() => {
    const controls = [
      ...document.querySelectorAll<HTMLElement>("a[href],button,input,select,textarea,[tabindex]"),
    ].filter(
      (n) =>
        n.tabIndex >= 0 &&
        !n.matches(":disabled") &&
        n.getClientRects().length > 0 &&
        getComputedStyle(n).visibility !== "hidden",
    );
    const body = document.body,
      previous = body.getAttribute("tabindex");
    body.setAttribute("tabindex", "-1");
    body.focus();
    if (previous === null) body.removeAttribute("tabindex");
    else body.setAttribute("tabindex", previous);
    return controls.map((n) => ({
      tag: n.tagName,
      text: n.getAttribute("aria-label") ?? n.textContent?.trim() ?? "",
      href: n.getAttribute("href"),
    }));
  });
  expect(expected.length).toBeGreaterThan(0);
  const actual = [];
  for (let i = 0; i < expected.length; i++) {
    await page.keyboard.press("Tab");
    actual.push(
      await root.evaluate(() => {
        const n = document.activeElement as HTMLElement;
        const s = getComputedStyle(n);
        return {
          tag: n.tagName,
          text: n.getAttribute("aria-label") ?? n.textContent?.trim() ?? "",
          href: n.getAttribute("href"),
          focusVisible: n.matches(":focus-visible"),
          indication:
            (s.outlineStyle !== "none" && parseFloat(s.outlineWidth) > 0) || s.boxShadow !== "none",
        };
      }),
    );
  }
  expect(actual.map(({ tag, text, href }) => ({ tag, text, href }))).toEqual(expected);
  expect(actual.every((n) => n.focusVisible && n.indication)).toBe(true);
  return actual;
}
function parity(
  editor: Awaited<ReturnType<typeof observeAr06bDocument>>,
  preview: typeof editor,
  width: number,
) {
  for (const observed of [editor, preview]) {
    expect(observed.viewportWidth).toBe(width);
    expect(observed.mainCount).toBe(1);
    expect(observed.overflow).toBeLessThanOrEqual(2);
    expect(observed.images.length).toBeGreaterThan(0);
    expect(
      observed.images.every((i) => i.complete && i.naturalWidth > 0 && i.naturalHeight > 0),
    ).toBe(true);
  }
  expect(editor.language).toBe(preview.language);
  expect(editor.frame).toEqual(preview.frame);
  expect(editor.cards).toEqual(preview.cards);
  expect(editor.controls).toEqual(preview.controls);
  expect(editor.images).toEqual(preview.images);
  expect(editor.regions.map((r) => r.id)).toEqual(preview.regions.map((r) => r.id));
  for (const [index, region] of editor.regions.entries()) {
    const other = preview.regions[index];
    near(region.padding, other.padding);
    for (const key of ["x", "y", "width", "height"] as const) near(region.box[key], other.box[key]);
    expect(region.sections.map(({ id, text }) => ({ id, text }))).toEqual(
      other.sections.map(({ id, text }) => ({ id, text })),
    );
    for (const [j, section] of region.sections.entries())
      for (const key of ["x", "y", "width", "height"] as const)
        near(section.box[key], other.sections[j].box[key]);
  }
}

test("early integration smoke selects a real composed section through a root slot", async ({
  page,
  baseURL,
}, info) => {
  const events = await isolation(page, baseURL!);
  await open(page, "offset", "en", info.config);
  await frame(page).locator('[data-composed-puck-section="section_home_categories"]').click();
  await expect(page.locator("[data-ar06b-selected-section]")).toHaveAttribute(
    "data-ar06b-selected-section",
    "section_home_categories",
  );
  await expect(page.getByLabel("Heading", { exact: true })).toBeVisible();
  expect(events).toEqual({ errors: [], forbidden: [] });
});
for (const locale of locales)
  for (const width of widths)
    test(`offset ${locale} ${width} edits, reorders, and captures editor plus preview`, async ({
      page,
      baseURL,
    }, info) => {
      const events = await isolation(page, baseURL!);
      await page.setViewportSize({ width, height: 1200 });
      const header = await open(page, "offset", locale, info.config);
      await expect
        .poll(() =>
          frame(page)
            .locator("html")
            .evaluate(() => innerWidth),
        )
        .toBe(width);
      const initial = await observeAr06bDocument(page.locator("[data-ar06b-preview]"));
      const initialIdentity = await page
        .locator("[data-ar06b-ready]")
        .getAttribute("data-ar06b-content-fingerprint");
      const heading = await changeHeading(page, locale);
      await settle(page);
      await reorder(page);
      await settle(page);
      const editor = await observeAr06bDocument(frame(page).locator("html")),
        preview = await observeAr06bDocument(page.locator("[data-ar06b-preview]"));
      parity(editor, preview, width);
      expect(preview.language).toBe(locale);
      expect(preview.regions.flatMap((r) => r.sections.map((s) => s.id))).toEqual(reorderedOrder);
      expect(bySection(preview.cards)).toEqual(bySection(initial.cards));
      expect(bySection(preview.images)).toEqual(bySection(initial.images));
      expect(bySection(preview.controls)).toEqual(bySection(initial.controls));
      const oldSections = initial.regions.flatMap((r) => r.sections),
        newSections = preview.regions.flatMap((r) => r.sections);
      for (const section of oldSections) {
        const after = newSections.find((s) => s.id === section.id)!;
        expect(after.text).toBe(
          section.id === originalOrder[0]
            ? section.text.replace(heading.initial, heading.value)
            : section.text,
        );
      }
      const [orientation, discovery] = preview.regions;
      expect(preview.pair).toBe(true);
      if (width >= 1024) {
        expect(discovery.box.x).toBeGreaterThan(orientation.box.x + orientation.box.width);
        expect(discovery.sections[0].box.y - orientation.sections[0].box.y).toBeGreaterThan(16);
        expect(discovery.padding).toBeGreaterThan(16);
      } else {
        near(discovery.box.x, orientation.box.x);
        expect(discovery.padding).toBeLessThanOrEqual(2);
      }
      const visibility = {
        editor: await observeAr06bVisibility(frame(page).locator("html")),
        preview: await observeAr06bVisibility(page.locator("[data-ar06b-preview]")),
      };
      expect(inspectAr06aVisibility(visibility.editor)).toEqual([]);
      expect(inspectAr06aVisibility(visibility.preview)).toEqual([]);
      const focus = await focusProof(page);
      await settle(page);
      const finalIdentity = await page
        .locator("[data-ar06b-ready]")
        .getAttribute("data-ar06b-content-fingerprint");
      expect(finalIdentity).not.toBe(initialIdentity);
      const iframeWidth = await page.locator("#preview-frame").evaluate((n) => n.clientWidth);
      expect(iframeWidth).toBe(width);
      const target = process.env.AR06B_CAPTURE_DIR ?? info.outputPath("captures");
      mkdirSync(target, { recursive: true });
      for (const kind of ["editor", "preview"] as const) {
        await page.locator(`[data-ar06b-${kind}]`).screenshot({
          path: join(target, `${kind}-${locale}-${width}.png`),
          animations: "disabled",
        });
        writeFileSync(
          join(target, `${kind}-${locale}-${width}.json`),
          JSON.stringify(
            {
              kind,
              layout: "offset",
              locale,
              width,
              actualViewport: editor.viewportWidth,
              iframeWidth,
              heading,
              initialIdentity,
              finalIdentity,
              editor,
              preview,
              visibility,
              focus,
              header,
              sourceHashes,
              ...events,
            },
            null,
            2,
          ) + "\n",
          { flag: "wx" },
        );
      }
      await reverseReorder(page);
      await expect
        .poll(() => page.locator("[data-ar06b-ready]").getAttribute("data-ar06b-canonical-order"))
        .toBe(originalOrder.join(","));
      expect(events).toEqual({ errors: [], forbidden: [] });
    });
for (const locale of locales)
  test(`stack ${locale} interaction smoke`, async ({ page, baseURL }, info) => {
    const events = await isolation(page, baseURL!);
    await page.setViewportSize({ width: 768, height: 1200 });
    await open(page, "stack", locale, info.config);
    await changeHeading(page, locale);
    await settle(page);
    await reorder(page);
    await settle(page);
    const editor = await observeAr06bDocument(frame(page).locator("html")),
      preview = await observeAr06bDocument(page.locator("[data-ar06b-preview]"));
    parity(editor, preview, 768);
    expect(preview.pair).toBe(false);
    await reverseReorder(page);
    expect(events).toEqual({ errors: [], forbidden: [] });
  });
