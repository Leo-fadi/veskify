import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test, type Page, type FullConfig } from "@playwright/test";
import { inspectAr06aVisibility } from "../helpers/ar-06a-composition-observation";
import {
  editComposedHeading,
  createComposedDraftJourney,
  focusComposedProof as focusProof,
  assertComposedParity as parity,
} from "../helpers/ar-06c-composed-draft-journey";
import {
  inspectAr06bCacheControl,
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

const dragEvidence = new WeakMap<Page, Record<string, unknown>[]>();
function record(page: Page, phase: string, value: Record<string, unknown> = {}) {
  const entries = dragEvidence.get(page) ?? [];
  entries.push({ phase, time: performance.now(), ...value });
  dragEvidence.set(page, entries);
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
const { settle, reorderSections } = createComposedDraftJourney({
  readySelector: "[data-ar06b-ready=true]",
  previewSelector: "[data-ar06b-preview]",
  draggingAttribute: "data-ar06b-puck-dragging",
  record,
  geometry,
  imageRequests: (page) => imageRequests.get(page),
});
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
  return editComposedHeading({
    page,
    frameSelector: "#preview-frame",
    sectionId: "section_home_hero",
    suffix: ` ${locale}`,
    previewSelector: "[data-ar06b-preview]",
  });
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
