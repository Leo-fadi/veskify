import { expect, test, type Page } from "@playwright/test";

/** Shared real Puck iframe text transport for AR-06B and the guarded AR-06C proof. */
export async function editComposedHeading({
  page,
  frameSelector,
  sectionId,
  label = "Main heading",
  suffix,
  previewSelector,
}: Readonly<{
  page: Page;
  frameSelector: string;
  sectionId: string;
  label?: string;
  suffix: string;
  previewSelector: string;
}>): Promise<{ initial: string; value: string }> {
  const frame = page.frameLocator(frameSelector);
  await frame.locator(`[data-composed-puck-section="${sectionId}"]`).click();
  const heading = page.getByLabel(label, { exact: true });
  await expect(heading).toBeVisible();
  const initial = await heading.inputValue();
  await heading.press("ControlOrMeta+a");
  await heading.press("ArrowRight");
  await expect
    .poll(() =>
      heading.evaluate((node: HTMLInputElement) => [node.selectionStart, node.selectionEnd]),
    )
    .toEqual([initial.length, initial.length]);
  for (const character of suffix) {
    await heading.pressSequentially(character);
    await expect(heading).toBeFocused();
  }
  const value = initial + suffix;
  await expect(heading).toHaveValue(value);
  await expect(page.locator(previewSelector)).toContainText(value);
  await expect(frame.locator(`[data-composed-section="${sectionId}"]`)).toContainText(value);
  return { initial, value };
}

import {
  ar06bDragSteps,
  ar06bDropOffset,
  ar06bUpwardDrop,
  observeAr06bFrameBox,
  inspectAr06bImage,
  type observeAr06bDocument,
} from "./ar-06b-edit-observation";
const frame = (page: Page) => page.frameLocator("#preview-frame");
const near = (a: number, b: number) => expect(Math.abs(a - b)).toBeLessThanOrEqual(2);
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
type PointerDocument = Window & { __ar06bPointerKinds?: () => string[] };
export async function observeComposedPointer(page: Page, start: boolean) {
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

/** Same accepted transport; only proof observation routing varies between guarded surfaces. */
export function createComposedDraftJourney(options: {
  readySelector: string;
  previewSelector: string;
  draggingAttribute: string;
  record: (page: Page, phase: string, values?: Record<string, unknown>) => void;
  geometry: (
    page: Page,
    sourceId: string,
    targetId: string,
    phase: string,
    values: Record<string, unknown>,
  ) => Promise<void>;
  imageRequests?: (page: Page) => Record<string, unknown>[] | undefined;
}) {
  const { record, geometry } = options;
  async function settle(page: Page) {
    await page.locator(options.readySelector).waitFor();
    await expect(frame(page).locator("main")).toHaveCount(1);
    const observations: Record<string, unknown>[] = [];
    const ready = (s: ReturnType<typeof inspectAr06bImage>) =>
      s.connected && s.complete && s.currentSrc !== "" && s.naturalWidth > 0 && s.naturalHeight > 0;
    const key = (s: ReturnType<typeof inspectAr06bImage>) =>
      JSON.stringify([s.owner, s.alt, s.src, s.srcset]);
    try {
      for (const [document, root] of [
        page.locator(options.previewSelector),
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
          JSON.stringify({ observations, requests: options.imageRequests?.(page) }, null, 2),
        ),
        contentType: "application/json",
      });
    }
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
      const target = node.ownerDocument.querySelector(
        `[data-composed-puck-section="${targetId}"]`,
      )!;
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
      if (!(error instanceof Error) || error.message !== "No interior drag destination")
        throw error;
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
        : Math.min(
            viewport.height * 0.9,
            initialSourceBox.y + (await page.evaluate(() => scrollY)),
          );
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
    await observeComposedPointer(page, true);
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
        const pointerKinds = await observeComposedPointer(page, false);
        record(page, "pointer-up", { sourceId, targetId, pointerKinds });
        expect(pointerKinds).toEqual(
          expect.arrayContaining(["pointerdown", "pointermove", "pointerup"]),
        );
        await expect(entry).not.toHaveAttribute("data-puck-dragging");
        await expect(page.locator(options.readySelector)).toHaveAttribute(
          options.draggingAttribute,
          "false",
        );
      }
    }
  }
  return { settle, reorderSections };
}

export async function focusComposedProof(page: Page) {
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
export function assertComposedParity(
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
