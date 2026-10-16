import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { expect, type BrowserContext, type Page } from "@playwright/test";
import { inspectAr06bImage } from "./ar-06b-edit-observation";
import {
  p10b18dSafePreviewRouteIdentity,
  type P10B18DCaptureSurface,
} from "./p10b-18d-preview-evidence";
import { contrastRatio, standardTextContrastMinimum } from "@/domain/design-system/color-contrast";
import {
  expectStorefrontSemanticIntegrity,
  expectStorefrontTouchGeometry,
  expectBoundedStorefrontKeyboardTraversal,
} from "../e2e/storefront-accessibility";
import { expectNoStorefrontHorizontalClipping } from "../e2e/storefront-geometry";

export const ar06dHeader = "x-veskify-p10b-16p-04-acceptance-token";
export const ar06dProject = "project_p10b16p04_aurum_commercial_acceptance";
export const ar06dGenerationPath = "/api/ai/whole-storefront-proposals";
export const ar06dSha = (bytes: string | Buffer) =>
  createHash("sha256").update(bytes).digest("hex");
export async function ar06dRecord(path: string, value: unknown) {
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, { flag: "wx", mode: 0o600 });
}
export function ar06dPreviewUrl(
  origin: string,
  surface: P10B18DCaptureSurface,
  fingerprint: string,
  locale: "en" | "fi",
) {
  const url = new URL(surface.path, origin);
  for (const [key, value] of Object.entries(surface.query ?? {})) url.searchParams.set(key, value);
  url.searchParams.set("p10b-16p-04-proposal", fingerprint);
  url.searchParams.set("locale", locale);
  return url.toString();
}

export async function ar06dAuthorize(context: BrowserContext, origin: string, token: string) {
  const forbidden: string[] = [];
  await context.route("**/*", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const headers = Object.fromEntries(
      Object.entries(request.headers()).filter(([key]) => key.toLowerCase() !== ar06dHeader),
    );
    if (/(^|\.)(openai\.com|vesko\.fi)$/.test(url.hostname)) {
      forbidden.push(`external-provider:${url.hostname}`);
      await route.abort("blockedbyclient");
      return;
    }
    if (
      url.origin === origin &&
      !["GET", "HEAD", "OPTIONS"].includes(request.method()) &&
      !(request.method() === "POST" && url.pathname === "/__nextjs_disable_dev_indicator")
    ) {
      // The one generation is sent explicitly by the Node request context; browser-driven writes are never needed.
      forbidden.push(`${request.method()} ${url.pathname}`);
      await route.abort("blockedbyclient");
      return;
    }
    await route.continue({
      headers: url.origin === origin ? { ...headers, [ar06dHeader]: token } : headers,
    });
  });
  return forbidden;
}

/** Supported Next UI action; changes only this development server's in-memory indicator state. */
export async function ar06dHideDevelopmentTools(page: Page) {
  const launcher = page.getByRole("button", { name: "Open Next.js Dev Tools", exact: true });
  await launcher.click();
  await page.locator("nextjs-portal [data-preferences]").click();
  const response = page.waitForResponse(
    (value) =>
      new URL(value.url()).pathname === "/__nextjs_disable_dev_indicator" &&
      value.request().method() === "POST",
  );
  await page.locator('nextjs-portal button[name="hide-dev-tools"]').click();
  expect((await response).ok()).toBe(true);
  await expect(launcher).toBeHidden();
}

/** Executed in the page's origin; reads only, never creates or upgrades its database. */
export async function ar06dReadStoredAuthority(projectId: string) {
  const stores = [
    "projects",
    "catalogues",
    "snapshots",
    "snapshotProvenance",
    "snapshotHistoryMetadata",
    "publicationOperations",
    "compiledPublicationArtifacts",
    "publishedStorefrontVersions",
    "activePublishedStorefrontPointers",
  ];
  if (!(await indexedDB.databases()).some(({ name }) => name === "veskify"))
    return Object.fromEntries(stores.map((name) => [name, []]));
  const database = await new Promise<IDBDatabase>((accept, reject) => {
    const request = indexedDB.open("veskify");
    request.onupgradeneeded = () => {
      request.transaction?.abort();
      reject(new Error("Database changed during observation"));
    };
    request.onsuccess = () => accept(request.result);
    request.onerror = () => reject(new Error("Read-only authority inspection failed"));
  });
  try {
    if (database.version !== 5 || stores.some((name) => !database.objectStoreNames.contains(name)))
      throw new Error("Expected complete current storage schema");
    const transaction = database.transaction(stores, "readonly");
    const records = await Promise.all(
      stores.map(
        (name) =>
          new Promise<Record<string, unknown>[]>((accept, reject) => {
            const request = transaction.objectStore(name).getAll();
            request.onsuccess = () => accept(request.result as Record<string, unknown>[]);
            request.onerror = () => reject(new Error("Read-only authority inspection failed"));
          }),
      ),
    );
    const snapshots = records[2].filter((entry) => entry.projectId === projectId);
    const catalogueIds = new Set(snapshots.map((entry) => entry.catalogueRef));
    return Object.fromEntries(
      stores.map((name, index) => [
        name,
        records[index].filter((entry) =>
          name === "projects"
            ? entry.id === projectId
            : name === "catalogues"
              ? catalogueIds.has(entry.id)
              : entry.projectId === projectId || entry.storefrontProjectId === projectId,
        ),
      ]),
    );
  } finally {
    database.close();
  }
}

export async function ar06dStoredAuthority(page: Page) {
  const data = await page.evaluate(ar06dReadStoredAuthority, ar06dProject);
  return ar06dSha(JSON.stringify(data));
}

export async function ar06dSettleMedia(page: Page) {
  await page.evaluate(() => document.fonts.ready);
  const images = page.locator(".project-preview__storefront img");
  const count = await images.count();
  const observations = [];
  for (let index = 0; index < count; index++) {
    const image = images.nth(index);
    const explicitlyHidden = await image.evaluate((node) => {
      for (let element: Element | null = node; element; element = element.parentElement) {
        const style = getComputedStyle(element);
        if (
          style.display === "none" ||
          style.visibility === "hidden" ||
          element.hasAttribute("hidden")
        )
          return true;
      }
      return false;
    });
    if (explicitlyHidden) {
      observations.push({
        intentionallyHidden: true,
        ...(await image.evaluate(inspectAr06bImage)),
      });
      continue;
    }
    // A collapsed/broken visible image is still required; do not classify it as an alternative.
    const before = await image.evaluate(inspectAr06bImage);
    await image.scrollIntoViewIfNeeded();
    await expect
      .poll(async () => {
        const state = await image.evaluate(inspectAr06bImage);
        return (
          state.connected &&
          state.complete &&
          state.naturalWidth > 0 &&
          state.naturalHeight > 0 &&
          !!state.currentSrc
        );
      })
      .toBe(true);
    const ready = await image.evaluate(inspectAr06bImage);
    expect(ready.src).toBe(before.src);
    expect(ready.srcset).toBe(before.srcset);
    await image.evaluate(async (element) => {
      if (!(element instanceof HTMLImageElement)) throw new Error("Expected image");
      await element.decode();
    });
    const after = await image.evaluate(inspectAr06bImage);
    expect(after.currentSrc).toBe(ready.currentSrc);
    expect(after.naturalWidth).toBeGreaterThan(0);
    expect(after.naturalHeight).toBeGreaterThan(0);
    observations.push(after);
  }
  await page.evaluate(() => window.scrollTo(0, 0));
  return observations;
}

export async function ar06dSurfaceChecks(
  page: Page,
  surface: P10B18DCaptureSurface,
  locale: "en" | "fi",
) {
  const root = page.locator(".project-preview__storefront");
  await expect(root).toBeVisible();
  await expect(page.locator(".project-preview")).toHaveAttribute("lang", locale);
  // The project-preview toolbar has its own project heading outside the storefront.
  await expect(root.getByRole("heading", { level: 1 })).toHaveCount(1);
  if (surface.id === "search") {
    await expect(page.locator('[data-search-context="transient-canonical-results"]')).toBeVisible();
    expect(
      await page.locator("[data-search-result-count]").getAttribute("data-search-result-count"),
    ).not.toBe("0");
  }
  if (surface.id === "simple-pdp" || surface.id === "configurable-pdp") {
    const product = page.locator('[data-component="dynamicProductDetail"]');
    await expect(product).toBeVisible();
    // Product preparation is asynchronous: a visible shared header is not PDP readiness.
    await expect(product.locator("figure img").first()).toBeVisible();
    const related = product.locator("[data-presented-related-product-count]");
    await expect(related).toBeVisible();
    const relatedCount = Number(await related.getAttribute("data-presented-related-product-count"));
    expect(relatedCount).toBeGreaterThan(0);
    await expect(related.locator("img")).toHaveCount(relatedCount);
    const groups = page.locator("[data-option-group-id]");
    if (surface.id === "simple-pdp") await expect(groups).toHaveCount(0);
    else {
      expect(
        await groups.evaluateAll((nodes) =>
          nodes.map((node) => node.getAttribute("data-option-group-id")).sort(),
        ),
      ).toEqual(["option_aurora_engraving", "option_aurora_size"]);
      const size = page.getByRole("button", { name: "17", exact: true });
      await size.scrollIntoViewIfNeeded();
      await size.focus();
      await expect(size).toBeFocused();
      await page.keyboard.press("Enter");
      await expect(size).toHaveAttribute("aria-pressed", "true");
      const engraving = page.getByRole("textbox", {
        name: locale === "fi" ? "Kaiverrus Valinnainen" : "Engraving Optional",
      });
      await engraving.fill("Aurum");
      await expect(engraving).toHaveValue("Aurum");
      await expect(
        page.getByRole("button", {
          name: locale === "fi" ? "Lisää ostoskoriin" : "Add to cart",
          exact: true,
        }),
      ).toBeEnabled();
    }
  }
  await expectStorefrontSemanticIntegrity(root);
  await expectStorefrontTouchGeometry(root);
  const colours = await root.evaluate((node) => {
    const styles = getComputedStyle(node);
    return {
      text: styles.getPropertyValue("--brand-surface-page-text").trim(),
      background: styles.getPropertyValue("--brand-surface-page").trim(),
    };
  });
  expect(contrastRatio(colours.text, colours.background)).toBeGreaterThanOrEqual(
    standardTextContrastMinimum,
  );
  if ([375, 1440].includes(page.viewportSize()!.width))
    await expectBoundedStorefrontKeyboardTraversal({ page, root });
  await expectNoStorefrontHorizontalClipping(page);
}

export async function ar06dCapture(
  page: Page,
  path: string,
  settledMedia: Awaited<ReturnType<typeof ar06dSettleMedia>>,
) {
  const images = page.locator(".project-preview__storefront img");
  await expect(images).toHaveCount(settledMedia.length);
  for (const [index, previous] of settledMedia.entries()) {
    const image = images.nth(index);
    const current = await image.evaluate(inspectAr06bImage);
    for (const key of ["owner", "alt", "src", "srcset", "currentSrc"] as const)
      expect(current[key]).toBe(previous[key]);
    if ("intentionallyHidden" in previous) await expect(image).toBeHidden();
    else {
      expect(current.connected && current.complete).toBe(true);
      expect(current.naturalWidth).toBeGreaterThan(0);
      expect(current.naturalHeight).toBeGreaterThan(0);
    }
  }
  await page.screenshot({ path, fullPage: true, animations: "disabled" });
  return {
    path,
    sha256: ar06dSha(await readFile(path)),
    viewport: page.viewportSize(),
    route: p10b18dSafePreviewRouteIdentity(page.url()),
  };
}
