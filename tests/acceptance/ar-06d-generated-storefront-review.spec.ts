import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { chromium, expect, test } from "@playwright/test";
import { ar06dApprovedMerchantPrompt } from "../helpers/ar-06d-review-input";
import { p10b18dCaptureSurfaces } from "../helpers/p10b-18d-preview-evidence";
import {
  parseP10B18DAcceptanceInspectionResponse,
  parseP10B18DConsumedGenerationResponse,
} from "../helpers/p10b-18d-live-safe-evidence";
import {
  ar06dAuthorize,
  ar06dCapture,
  ar06dGenerationPath,
  ar06dHeader,
  ar06dHideDevelopmentTools,
  ar06dPreviewUrl,
  ar06dProject,
  ar06dRecord,
  ar06dSettleMedia,
  ar06dStoredAuthority,
  ar06dSurfaceChecks,
} from "../helpers/ar-06d-review-browser";

const mode = process.env.AR06D_MODE;
const output = process.env.AR06D_OUTPUT_DIR!;
const origin = process.env.AR06D_ORIGIN!;
const token = process.env.AR06D_ACCEPTANCE_TOKEN!;
if (!["mock", "live", "inspect"].includes(mode ?? "") || !token || Buffer.byteLength(token) < 32)
  throw new Error("Missing task-owned browser assignment");
const body = {
  operation: "promptedStorefrontDesignV2",
  contractVersion: "2.0.0",
  requestId: "ar06d-aurum-review-01",
  projectId: ar06dProject,
  draftSnapshotId: "snapshot_p10b16p04_aurum_commercial_draft",
  draftRevision: 0,
  activeLocale: "en",
  targetScope: "storefront",
  merchantPrompt: ar06dApprovedMerchantPrompt,
};

test("reviews one isolated canonical candidate across seven surfaces, two locales and four widths", async () => {
  const browser = await chromium.connectOverCDP(process.env.AR06D_CDP_URL!);
  const context = browser.contexts()[0];
  const page = await context.newPage();
  const forbidden = await ar06dAuthorize(context, origin, token);
  const inspection = async () => {
    const response = await context.request.get(`${origin}/api/demo/p10b-16p-04`, {
      headers: { [ar06dHeader]: token },
    });
    expect(response.status()).toBe(200);
    return parseP10B18DAcceptanceInspectionResponse(await response.json());
  };
  const initial = await inspection();
  const isMock = mode === "mock";
  expect(initial.selectedTransport.kind).toBe(isMock ? "mock" : "openai");
  await page.goto(origin, { waitUntil: "domcontentloaded" });
  if (mode !== "inspect") {
    await ar06dHideDevelopmentTools(page);
    await ar06dRecord(join(output, "development-chrome.json"), {
      action: "Native Next Dev Tools > Preferences > Hide, through user-level clicks",
      nextVersion: "16.2.10",
      scope:
        "Only the owned development server's in-memory indicator state; no product state, CSS injection or masking",
    });
  }
  const storedBefore = await ar06dStoredAuthority(page);
  if (mode !== "inspect") {
    expect(initial).toMatchObject({
      providerCallCount: 0,
      status: "ready",
      cases: [],
      retryCount: 0,
    });
    for (const value of [undefined, "wrong"]) {
      const response = await context.request.post(`${origin}${ar06dGenerationPath}`, {
        data: body,
        headers: { origin, ...(value ? { [ar06dHeader]: value } : {}) },
      });
      expect(response.status()).not.toBe(200);
    }
    expect((await inspection()).providerCallCount).toBe(0);
    await ar06dRecord(join(output, "generation-dispatch.json"), {
      kind: isMock ? "mock-not-live" : "live-attempt",
      requestedAt: new Date().toISOString(),
      requestId: body.requestId,
      prompt: ar06dApprovedMerchantPrompt,
      sourceFingerprint: process.env.AR06D_SOURCE_FINGERPRINT,
    });
    const response = await context.request.post(`${origin}${ar06dGenerationPath}`, {
      data: body,
      headers: { origin, [ar06dHeader]: token },
      timeout: 120000,
    });
    const safe = parseP10B18DConsumedGenerationResponse(await response.json());
    await ar06dRecord(join(output, "generation-response.json"), {
      httpStatus: response.status(),
      ...safe,
    });
    expect(response.status()).toBe(200);
    expect(safe.ok).toBe(true);
    if (!safe.ok)
      throw new Error(`Generation failed: ${safe.failure.category}; no retry authorized`);
  }
  const generated = await inspection();
  expect(generated.providerCallCount).toBe(1);
  expect(generated.cases).toHaveLength(1);
  const candidate = generated.cases[0];
  expect(candidate.modelId).toBe(isMock ? "mocked-p10b-16p-04-design-intent-v2" : "gpt-5.6-sol");
  expect(candidate.protectedCommerceAfterFingerprint).toBe(
    candidate.protectedCommerceBeforeFingerprint,
  );
  expect(candidate.protectedMediaAfterFingerprint).toBe(candidate.protectedMediaBeforeFingerprint);
  await ar06dRecord(join(output, "candidate-lineage.json"), {
    kind: isMock ? "mock-not-live" : "live",
    candidate,
    sourceFingerprint: process.env.AR06D_SOURCE_FINGERPRINT,
  });
  const fingerprint = candidate.candidateSnapshotFingerprint;
  const unknown = ar06dPreviewUrl(origin, p10b18dCaptureSurfaces[0], "unknown-candidate", "en");
  expect((await context.request.get(unknown, { headers: { [ar06dHeader]: token } })).status()).toBe(
    404,
  );
  const protectedUrl = ar06dPreviewUrl(origin, p10b18dCaptureSurfaces[0], fingerprint, "en");
  expect((await context.request.get(protectedUrl)).status()).toBe(404);
  expect(
    (await context.request.get(protectedUrl, { headers: { [ar06dHeader]: "wrong" } })).status(),
  ).toBe(404);
  await mkdir(join(output, "screenshots"));
  const captures = [];
  const cases = [];
  for (const locale of ["en", "fi"] as const)
    for (const width of [375, 768, 1024, 1440])
      for (const surface of p10b18dCaptureSurfaces) {
        await page.setViewportSize({ width, height: 1000 });
        const response = await page.goto(ar06dPreviewUrl(origin, surface, fingerprint, locale), {
          waitUntil: "domcontentloaded",
        });
        expect(response?.status()).toBe(200);
        await expect(page.locator(".project-preview__storefront")).toBeVisible();
        await ar06dSurfaceChecks(page, surface, locale);
        const media = await ar06dSettleMedia(page);
        await page.evaluate(() => window.scrollTo(0, 0));
        cases.push({
          surface: surface.id,
          locale,
          width,
          media,
          candidateFingerprint: fingerprint,
        });
        const requiredCapture =
          width === 375 ||
          width === 1440 ||
          surface.id === "home" ||
          surface.id === "configurable-pdp";
        if (
          (mode === "live" && requiredCapture) ||
          (isMock && surface.id === "home" && width === 375)
        ) {
          captures.push({
            ...(await ar06dCapture(
              page,
              join(output, "screenshots", `${locale}-${width}-${surface.id}.png`),
              media,
            )),
            surface: surface.id,
            locale,
            candidateFingerprint: fingerprint,
          });
          await ar06dRecord(
            join(output, `capture-${String(captures.length).padStart(2, "0")}.json`),
            captures.at(-1),
          );
        }
      }
  expect(cases).toHaveLength(56);
  if (mode === "live") expect(captures).toHaveLength(36);
  await ar06dRecord(join(output, "surface-matrix.json"), { cases, captures });
  // Real same-candidate search/navigation controls, including Finnish; no route reconstruction after interaction.
  for (const locale of ["en", "fi"] as const) {
    const surface = p10b18dCaptureSurfaces.find(({ id }) => id === "search")!;
    await page.goto(ar06dPreviewUrl(origin, surface, fingerprint, locale));
    const form = page.locator('form[role="search"]:visible').first();
    const input = form.getByRole("searchbox");
    await input.fill("Sisu Automatic Watch");
    await input.press("Enter");
    await expect(page.locator("[data-search-result-count]")).toHaveAttribute(
      "data-search-result-count",
      "1",
    );
    expect(new URL(page.url()).searchParams.get("locale")).toBe(locale);
    expect(new URL(page.url()).searchParams.get("p10b-16p-04-proposal")).toBe(fingerprint);
    await page
      .locator(".project-preview__storefront")
      .getByRole("button", {
        name: locale === "fi" ? "Näytä tuote" : "View product",
        exact: true,
      })
      .click();
    await expect(page).toHaveURL(new RegExp(`/products/sisu-automatic-watch\\?`));
    await expect(page.locator('[data-component="dynamicProductDetail"]')).toBeVisible();
    expect(new URL(page.url()).searchParams.get("p10b-16p-04-proposal")).toBe(fingerprint);
    expect(new URL(page.url()).searchParams.get("locale")).toBe(locale);
    const noResults = new URL(ar06dPreviewUrl(origin, surface, fingerprint, locale));
    noResults.searchParams.set("q", "ar06d-no-such-approved-product");
    await page.goto(noResults.toString());
    await expect(page.locator("[data-search-result-count]")).toHaveAttribute(
      "data-search-result-count",
      "0",
    );
  }
  await page.goto(
    ar06dPreviewUrl(
      origin,
      { id: "about", path: `/projects/${ar06dProject}/pages/ar06d-missing` },
      fingerprint,
      "en",
    ),
  );
  await expect(page.getByRole("heading", { name: "Page unavailable", exact: true })).toBeVisible();
  const storedAfter = await ar06dStoredAuthority(page);
  expect(storedAfter).toBe(storedBefore);
  expect(forbidden).toEqual([]);
  expect((await inspection()).providerCallCount).toBe(1);
  await ar06dRecord(join(output, "browser-proof.json"), {
    kind: isMock ? "mock-not-live" : "live-candidate",
    candidateFingerprint: fingerprint,
    sourceFingerprint: process.env.AR06D_SOURCE_FINGERPRINT,
    cases,
    captures,
    storedBefore,
    storedAfter,
    forbiddenRequests: forbidden,
    unknownRoute: "Existing Page unavailable panel; not commercial not-found design proof",
    assertions: "PASS",
  });
  await page.goto(protectedUrl);
  await page.bringToFront();
  // Disconnect only; the task runner retains the original live browser and server for owner review.
  await browser.close();
});
