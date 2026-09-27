import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test, type Page, type FullConfig, type BrowserContext } from "@playwright/test";
import {
  createComposedDraftJourney,
  editComposedHeading,
  focusComposedProof,
  assertComposedParity,
} from "../helpers/ar-06c-composed-draft-journey";
import { observeAr06bDocument, observeAr06bVisibility } from "../helpers/ar-06b-edit-observation";
import { inspectAr06aVisibility } from "../helpers/ar-06a-composition-observation";
const frame = (page: Page) => page.frameLocator("#preview-frame");
const preview = (page: Page) => page.locator("[data-ar06c-preview]");
const root = (page: Page) => page.locator("[data-ar06c-ready=true]");
const saveStatus = (page: Page) => root(page).locator(':scope > [role="status"]');
const original = [
  "section_home_hero",
  "section_home_categories",
  "section_home_products",
  "section_home_campaign",
  "section_home_story",
  "section_home_benefits",
  "section_home_newsletter",
];
const reordered = [original[0], original[2], original[1], ...original.slice(3)];
const observations = new WeakMap<Page, unknown[]>();
const requests = new WeakMap<Page, Record<string, unknown>[]>();
const contextEvents = new WeakMap<
  BrowserContext,
  Array<{ errors: string[]; forbidden: string[] }>
>();
const sourcePaths = [
  "src/app/acceptance/ar-06c/page.tsx",
  "src/integrations/puck/ar-06c-composed-draft-proof.tsx",
  "src/services/storage/indexed-db-project-repository.ts",
  "src/services/storage/project-repository.ts",
  "src/services/storage/repository-validation.ts",
  "src/application/draft-save/save-composed-editor-draft.ts",
  "src/application/draft-save/composed-draft-validation.ts",
  "src/components/storefront/composed-storefront-validation.ts",
  "src/components/storefront/composed-storefront-page.tsx",
  "src/integrations/puck/composed-page-adapter.ts",
  "src/integrations/puck/composed-puck-editor.tsx",
  "src/data/demo/ar-06a-composed-template.ts",
  "tests/helpers/ar-06c-composed-draft-journey.ts",
];
const sourceHashes = Object.fromEntries(
  sourcePaths.map((path) => [path, createHash("sha256").update(readFileSync(path)).digest("hex")]),
);
function record(page: Page, phase: string, values: Record<string, unknown> = {}) {
  const entries = observations.get(page) ?? [];
  entries.push({ phase, ...values });
  observations.set(page, entries);
}
const journey = createComposedDraftJourney({
  readySelector: "[data-ar06c-ready=true]",
  previewSelector: "[data-ar06c-preview]",
  draggingAttribute: "data-ar06c-puck-dragging",
  record,
  geometry: (page, sourceId, targetId, phase, values) =>
    Promise.resolve(record(page, phase, { sourceId, targetId, ...values })),
  imageRequests: (page) => requests.get(page),
});
async function isolate(page: Page, baseURL: string) {
  const errors: string[] = [],
    forbidden: string[] = [],
    images: Record<string, unknown>[] = [];
  requests.set(page, images);
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("requestfailed", (request) => {
    if (request.resourceType() === "image")
      images.push({ url: request.url(), failure: request.failure() });
  });
  await page.route("**/*", (route) => {
    const url = new URL(route.request().url());
    if (url.origin !== new URL(baseURL).origin || /\/api\//u.test(url.pathname)) {
      forbidden.push(url.origin + url.pathname);
      return route.abort();
    }
    return route.continue();
  });
  const events = { errors, forbidden };
  const group = contextEvents.get(page.context()) ?? [];
  group.push(events);
  contextEvents.set(page.context(), group);
  return events;
}
function header(raw: string | undefined, config: FullConfig, url: string) {
  expect(new URL(url).pathname).toBe("/acceptance/ar-06c");
  expect(config.webServer?.env?.VESKIFY_RUNTIME_MODE).toBe("standalone");
  expect(config.webServer?.env?.VESKIFY_AR06C_ACCEPTANCE).toBe("1");
  expect(config.webServer?.command).toMatch(/^pnpm dev --port \d+$/u);
  expect(raw).toBeTruthy();
  const directives = raw!.split(",").map((value) => value.trim().toLowerCase());
  expect(new Set(directives).size).toBe(directives.length);
  expect(
    directives.every((value) =>
      /^(private|no-store|no-cache|must-revalidate|max-age\s*=\s*"?0"?)$/u.test(value),
    ),
  ).toBe(true);
  const strict = directives.includes("private") || directives.includes("no-store");
  if (!strict) expect([...directives].sort()).toEqual(["must-revalidate", "no-cache"]);
  return {
    directives,
    limitation:
      "Development revalidation does not establish non-storage or shared-cache exclusion.",
  };
}
async function open(
  page: Page,
  layout: string,
  locale: string,
  config: FullConfig,
  initialize: boolean,
) {
  const response = await page.goto(`/acceptance/ar-06c?case=${layout}&locale=${locale}`);
  expect(response?.status()).toBe(200);
  const headers = header(response?.headers()["cache-control"], config, page.url());
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
    "content",
    /noindex.*nofollow/u,
  );
  if (initialize)
    await page.getByRole("button", { name: "Initialize local example", exact: true }).click();
  else
    await expect(
      page.getByRole("button", { name: "Initialize local example", exact: true }),
    ).toHaveCount(0);
  await journey.settle(page);
  return headers;
}
async function fingerprint(page: Page) {
  return root(page).getAttribute("data-ar06c-snapshot-fingerprint");
}
async function order(page: Page, expected: readonly string[]) {
  await expect(root(page)).toHaveAttribute("data-ar06c-canonical-order", expected.join(","));
  await expect
    .poll(() =>
      frame(page)
        .locator("[data-composed-section]")
        .evaluateAll((nodes) => nodes.map((node) => node.getAttribute("data-composed-section"))),
    )
    .toEqual(expected);
  expect(
    (await observeAr06bDocument(preview(page))).regions.flatMap((region) =>
      region.sections.map((section) => section.id),
    ),
  ).toEqual(expected);
}
const material = (value: Awaited<ReturnType<typeof observeAr06bDocument>>) => ({
  frame: value.frame,
  cards: [...value.cards].sort((a, b) => a.sectionId.localeCompare(b.sectionId)),
  controls: [...value.controls].sort((a, b) => a.sectionId.localeCompare(b.sectionId)),
  images: [...value.images].sort((a, b) => a.sectionId.localeCompare(b.sectionId)),
});
async function save(page: Page) {
  await expect(page.getByRole("button", { name: "Save draft", exact: true })).toBeEnabled();
  await page.getByRole("button", { name: "Save draft", exact: true }).click();
  await expect(saveStatus(page)).toHaveCount(1);
  await expect(saveStatus(page)).toHaveText("Draft saved on this device. Reopen to verify it.");
  await expect(root(page)).toHaveAttribute("data-ar06c-unsaved", "false");
  await expect(page.getByRole("button", { name: "Save draft", exact: true })).toBeDisabled();
  return {
    fingerprint: await fingerprint(page),
    id: await root(page).getAttribute("data-ar06c-loaded-id"),
  };
}
for (const locale of ["en", "fi"] as const)
  for (const width of [375, 768, 1024, 1440]) {
    test(`offset ${locale} ${width} saves and reopens actual composed draft`, async ({
      page,
      context,
      baseURL,
    }, info) => {
      const events = await isolate(page, baseURL!);
      await page.setViewportSize({ width, height: 1200 });
      const headers = await open(page, "offset", locale, info.config, true);
      const initial = await observeAr06bDocument(preview(page));
      const heading = await editComposedHeading({
        page,
        frameSelector: "#preview-frame",
        sectionId: "section_home_hero",
        suffix: ` saved ${locale}`,
        previewSelector: "[data-ar06c-preview]",
      });
      await journey.settle(page);
      await journey.reorderSections(page, original[1], original[2]);
      await order(page, reordered);
      const saved = await save(page);
      await page.close();
      const reopened = await context.newPage();
      const reopenedEvents = await isolate(reopened, baseURL!);
      await reopened.setViewportSize({ width, height: 1200 });
      await open(reopened, "offset", locale, info.config, false);
      expect(await fingerprint(reopened)).toBe(saved.fingerprint);
      await expect(root(reopened)).toHaveAttribute("data-ar06c-loaded-id", saved.id!);
      await expect(preview(reopened)).toContainText(heading.value);
      await order(reopened, reordered);
      const editor = await observeAr06bDocument(frame(reopened).locator("html")),
        result = await observeAr06bDocument(preview(reopened));
      assertComposedParity(editor, result, width);
      expect(result.language).toBe(locale);
      expect(material(result)).toEqual(material(initial));
      const visibility = {
        editor: await observeAr06bVisibility(frame(reopened).locator("html")),
        preview: await observeAr06bVisibility(preview(reopened)),
      };
      expect(inspectAr06aVisibility(visibility.editor)).toEqual([]);
      expect(inspectAr06aVisibility(visibility.preview)).toEqual([]);
      const focus = await focusComposedProof(reopened);
      // open() already prepared and decoded every lazy image. Focus changes scroll,
      // so validate the same current images without repeating that entire walk.
      const captureImages = [];
      for (const container of [preview(reopened), frame(reopened).locator("html")]) {
        captureImages.push(
          await container.evaluate(async (node) => {
            const images = [...node.querySelectorAll("img")];
            if (images.length === 0) throw new Error("Missing capture images");
            const decoded = await Promise.all(
              images.map(async (image) => {
                const currentSrc = image.currentSrc;
                await image.decode();
                if (
                  !image.isConnected ||
                  !image.complete ||
                  currentSrc === "" ||
                  image.currentSrc !== currentSrc ||
                  image.naturalWidth <= 0 ||
                  image.naturalHeight <= 0
                )
                  throw new Error("Capture image changed or is not ready");
                return { currentSrc, width: image.naturalWidth, height: image.naturalHeight };
              }),
            );
            const current = [...node.querySelectorAll("img")];
            if (
              current.length !== images.length ||
              current.some(
                (image, i) =>
                  image !== images[i] ||
                  !image.complete ||
                  image.currentSrc !== decoded[i].currentSrc ||
                  image.naturalWidth !== decoded[i].width ||
                  image.naturalHeight !== decoded[i].height,
              )
            )
              throw new Error("Capture image elements changed");
            node.ownerDocument.defaultView!.scrollTo(0, 0);
            return decoded;
          }),
        );
      }
      await reopened.evaluate(() => window.scrollTo(0, 0));
      const target = process.env.AR06C_CAPTURE_DIR ?? info.outputPath("captures");
      mkdirSync(target, { recursive: true });
      const name = `reloaded-${locale}-${width}`;
      await preview(reopened).screenshot({
        path: join(target, name + ".png"),
        animations: "disabled",
      });
      writeFileSync(
        join(target, name + ".json"),
        JSON.stringify(
          {
            reloaded: true,
            layout: "offset",
            locale,
            width,
            saved,
            heading,
            editor,
            preview: result,
            visibility,
            focus,
            captureImages,
            headers,
            sourceHashes,
            events,
            reopenedEvents,
          },
          null,
          2,
        ) + "\n",
        { flag: "wx" },
      );
      expect(events).toEqual({ errors: [], forbidden: [] });
      expect(reopenedEvents).toEqual({ errors: [], forbidden: [] });
      await reopened.close();
    });
  }
for (const locale of ["en", "fi"] as const)
  test(`stack ${locale} saves and reopens compact draft`, async ({
    page,
    context,
    baseURL,
  }, info) => {
    await isolate(page, baseURL!);
    await page.setViewportSize({ width: 768, height: 1200 });
    await open(page, "stack", locale, info.config, true);
    await editComposedHeading({
      page,
      frameSelector: "#preview-frame",
      sectionId: "section_home_hero",
      suffix: ` saved ${locale}`,
      previewSelector: "[data-ar06c-preview]",
    });
    await journey.settle(page);
    await journey.reorderSections(page, original[1], original[2]);
    await order(page, reordered);
    const saved = await save(page);
    await page.close();
    const reopened = await context.newPage();
    await isolate(reopened, baseURL!);
    await reopened.setViewportSize({ width: 768, height: 1200 });
    await open(reopened, "stack", locale, info.config, false);
    expect(await fingerprint(reopened)).toBe(saved.fingerprint);
    await order(reopened, reordered);
    const result = await observeAr06bDocument(preview(reopened));
    expect(result.pair).toBe(false);
    assertComposedParity(await observeAr06bDocument(frame(reopened).locator("html")), result, 768);
    await reopened.close();
  });
test("unsaved edits are absent from a fresh page", async ({ page, context, baseURL }, info) => {
  await isolate(page, baseURL!);
  await open(page, "offset", "en", info.config, true);
  const saved = await fingerprint(page);
  const heading = await editComposedHeading({
    page,
    frameSelector: "#preview-frame",
    sectionId: "section_home_hero",
    suffix: " unsaved",
    previewSelector: "[data-ar06c-preview]",
  });
  await expect(root(page)).toHaveAttribute("data-ar06c-unsaved", "true");
  await page.close();
  const reopened = await context.newPage();
  await isolate(reopened, baseURL!);
  await open(reopened, "offset", "en", info.config, false);
  expect(await fingerprint(reopened)).toBe(saved);
  await expect(preview(reopened)).not.toContainText(heading.value);
  await reopened.close();
});
test("stale second page cannot overwrite the saved draft", async ({
  page,
  context,
  baseURL,
}, info) => {
  await isolate(page, baseURL!);
  await open(page, "offset", "en", info.config, true);
  const stale = await context.newPage();
  await isolate(stale, baseURL!);
  await open(stale, "offset", "en", info.config, false);
  for (const [target, suffix] of [
    [page, " first"],
    [stale, " stale"],
  ] as const)
    await editComposedHeading({
      page: target,
      frameSelector: "#preview-frame",
      sectionId: "section_home_hero",
      suffix,
      previewSelector: "[data-ar06c-preview]",
    });
  const saved = await save(page);
  await stale.getByRole("button", { name: "Save draft", exact: true }).click();
  await expect(saveStatus(stale)).toHaveCount(1);
  await expect(saveStatus(stale)).toContainText("stored draft changed");
  await expect(root(stale)).toHaveAttribute("data-ar06c-unsaved", "true");
  await stale.close();
  await page.close();
  const reopened = await context.newPage();
  await isolate(reopened, baseURL!);
  await open(reopened, "offset", "en", info.config, false);
  expect(await fingerprint(reopened)).toBe(saved.fingerprint);
  await reopened.close();
});
test.afterEach(async ({ page, context }, info) => {
  await info.attach("composed-draft-transport", {
    body: Buffer.from(JSON.stringify(observations.get(page) ?? [], null, 2)),
    contentType: "application/json",
  });
  for (const events of contextEvents.get(context) ?? [])
    expect(events).toEqual({ errors: [], forbidden: [] });
});
