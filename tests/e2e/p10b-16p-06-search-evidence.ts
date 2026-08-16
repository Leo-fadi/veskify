import { mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { expect, type Page, type TestInfo } from "@playwright/test";
import { expectNoStorefrontHorizontalClipping } from "./storefront-geometry";

export const p10b16p06EvidenceDirectory = process.env.P10B16P06_SEARCH_EVIDENCE_DIR
  ? resolve(process.env.P10B16P06_SEARCH_EVIDENCE_DIR)
  : resolve(tmpdir(), "veskify-p10b-16p-06-search-evidence");

export type P10B16P06SearchEvidenceEntry = Readonly<{
  filename: string;
  renderer: "draft" | "proposal" | "saved-preview" | "published";
  scenario:
    | "shared-frame-multiple-results"
    | "exact-title"
    | "exact-sku"
    | "no-results"
    | "empty-query"
    | "finnish-results"
    | "result-to-pdp"
    | "proposal-results"
    | "saved-preview-results";
  surface: "search-results" | "product-detail";
  width: 375 | 768 | 1024 | 1440;
  viewportHeight: number;
  documentHeight: number;
  locale: "en" | "fi";
  query: string;
  resultCount: number | null;
  route: string;
  searchArchetype: string | null;
}>;

function safeFilenamePart(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[^a-zA-Z0-9]+/gu, "-")
    .replace(/^-+|-+$/gu, "")
    .toLowerCase()
    .slice(0, 48);
}

export async function captureP10B16P06SearchEvidence({
  page,
  renderer,
  scenario,
  surface = "search-results",
  width,
  locale,
  query,
}: {
  page: Page;
  renderer: P10B16P06SearchEvidenceEntry["renderer"];
  scenario: P10B16P06SearchEvidenceEntry["scenario"];
  surface?: P10B16P06SearchEvidenceEntry["surface"];
  width: P10B16P06SearchEvidenceEntry["width"];
  locale: P10B16P06SearchEvidenceEntry["locale"];
  query: string;
}): Promise<P10B16P06SearchEvidenceEntry> {
  await mkdir(p10b16p06EvidenceDirectory, { recursive: true });
  const viewportHeight = width === 375 ? 900 : 1000;
  await page.setViewportSize({ width, height: viewportHeight });
  await page.evaluate(async () => {
    await Promise.all(
      [...document.images].map((image) =>
        image.complete ? image.decode().catch(() => undefined) : Promise.resolve(),
      ),
    );
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
    document.querySelectorAll("nextjs-portal").forEach((portal) => portal.remove());
  });
  await expectNoStorefrontHorizontalClipping(page);
  const storefront = page.locator(".project-preview__storefront");
  await expect(storefront).not.toContainText(
    /Draft placeholder|review before publishing|Luonnospaikkamerkki|tarkista ennen julkaisua/iu,
  );
  const demoCart = storefront.getByRole("button", {
    name: locale === "fi" ? "Ostoskori (demo)" : "Cart (demo)",
  });
  if ((await demoCart.count()) === 1) {
    await expect(demoCart).toHaveText(locale === "fi" ? "Ostoskori 0" : "Bag 0");
  }
  const state = page.locator('[data-search-context="transient-canonical-results"]');
  const hasSearchState = (await state.count()) === 1;
  const resultCountNode = state.locator("[data-search-result-count]");
  const hasResultCount = hasSearchState && (await resultCountNode.count()) === 1;
  const resultCount = hasResultCount
    ? Number((await resultCountNode.getAttribute("data-search-result-count")) ?? "0")
    : hasSearchState
      ? 0
      : null;
  const searchArchetype = hasSearchState ? await state.getAttribute("data-variant") : null;
  const documentHeight = await page.evaluate(() => document.documentElement.scrollHeight);
  const filename =
    [
      "p10b16p06",
      renderer,
      scenario,
      locale,
      `${width}px`,
      safeFilenamePart(query || "empty-query"),
    ].join("-") + ".png";
  await page.screenshot({
    animations: "disabled",
    caret: "hide",
    fullPage: true,
    path: resolve(p10b16p06EvidenceDirectory, filename),
  });
  return {
    filename,
    renderer,
    scenario,
    surface,
    width,
    viewportHeight,
    documentHeight,
    locale,
    query,
    resultCount,
    route: new URL(page.url()).pathname,
    searchArchetype,
  };
}

export async function writeP10B16P06SearchEvidenceManifest(
  entries: readonly P10B16P06SearchEvidenceEntry[],
  testInfo: TestInfo,
): Promise<string> {
  await mkdir(p10b16p06EvidenceDirectory, { recursive: true });
  const path = resolve(p10b16p06EvidenceDirectory, "manifest.json");
  const manifest = {
    contractVersion: "p10b-16p-06-search-browser-evidence-v1",
    providerCalls: 0,
    VeskoCalls: 0,
    generationRequests: 1,
    publicationRequests: 0,
    entries,
  } as const;
  await writeFile(path, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  await testInfo.attach("p10b-16p-06-search-evidence-manifest", {
    contentType: "application/json",
    path,
  });
  return path;
}
