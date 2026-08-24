import { mkdir, rename, writeFile } from "node:fs/promises";
import { isAbsolute, join, resolve } from "node:path";
import { expect, test, type BrowserContext } from "@playwright/test";
import {
  P10B18D_ACCEPTANCE_TOKEN_ENVIRONMENT_KEY,
  P10B18D_ACCEPTANCE_TOKEN_HEADER,
} from "../helpers/p10b-18d-live-commercial-acceptance";
import { parseP10B18DAcceptanceInspectionResponse } from "../helpers/p10b-18d-live-safe-evidence";
import {
  buildP10B18DPreviewUrl,
  p10b18dCaptureSurfaces,
  p10b18dSafePreviewRouteIdentity,
} from "../helpers/p10b-18d-preview-evidence";

const candidateFingerprint = process.env.P10B18D_ZERO_CALL_CANDIDATE_FINGERPRINT?.trim();
if (!candidateFingerprint) {
  throw new Error("The zero-call Concept 4 smoke requires its retained candidate fingerprint.");
}
const evidenceRootValue = process.env.P10B18D_EVIDENCE_ROOT?.trim();
if (!evidenceRootValue || !isAbsolute(evidenceRootValue)) {
  throw new Error("The zero-call Concept 4 smoke requires an external evidence root.");
}
const evidenceDirectory = join(resolve(evidenceRootValue), "zero-call-concept-4");

function requiredToken(): string {
  const token = process.env[P10B18D_ACCEPTANCE_TOKEN_ENVIRONMENT_KEY]?.trim();
  if (!token || Buffer.byteLength(token, "utf8") < 32) {
    throw new Error("The zero-call Concept 4 smoke requires its configured acceptance token.");
  }
  return token;
}

async function installSameOriginToken(
  context: BrowserContext,
  baseUrl: string,
  token: string,
): Promise<void> {
  const origin = new URL(baseUrl).origin;
  await context.route("**/*", async (route) => {
    const request = route.request();
    if (new URL(request.url()).origin !== origin) {
      await route.continue();
      return;
    }
    await route.continue({
      headers: { ...request.headers(), [P10B18D_ACCEPTANCE_TOKEN_HEADER]: token },
    });
  });
}

async function writeJson(path: string, value: unknown): Promise<void> {
  const temporary = `${path}.tmp`;
  await writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  await rename(temporary, path);
}

test("reopens the exact retained Concept 4 candidate with zero provider calls", async ({
  context,
  page,
}, testInfo) => {
  const baseUrl = testInfo.project.use.baseURL;
  if (typeof baseUrl !== "string") throw new Error("The zero-call base URL is unavailable.");
  const token = requiredToken();
  await mkdir(evidenceDirectory, { recursive: true });
  await installSameOriginToken(context, baseUrl, token);
  const inspect = async () => {
    const response = await page.request.get(`${baseUrl}/api/demo/p10b-16p-04`, {
      headers: { [P10B18D_ACCEPTANCE_TOKEN_HEADER]: token },
    });
    expect(response.status()).toBe(200);
    return parseP10B18DAcceptanceInspectionResponse(await response.json());
  };
  expect(await inspect()).toMatchObject({ providerCallCount: 0, cases: [] });

  const home = p10b18dCaptureSurfaces.find(({ id }) => id === "home");
  const cart = p10b18dCaptureSurfaces.find(({ id }) => id === "cart");
  if (!home || !cart) throw new Error("The zero-call candidate surfaces are unavailable.");
  const witnesses = [
    { id: "candidate-home-1440", surface: home, width: 1440 },
    { id: "candidate-cart-375", surface: cart, width: 375 },
    { id: "candidate-cart-1440", surface: cart, width: 1440 },
  ] as const;
  const retained: Array<{ id: string; route: string; screenshotPath: string }> = [];

  for (const witness of witnesses) {
    await page.setViewportSize({
      width: witness.width,
      height: witness.width < 768 ? 1_200 : 1_000,
    });
    const route = buildP10B18DPreviewUrl({
      baseUrl,
      surface: witness.surface,
      kind: "candidate",
      candidateFingerprint,
    });
    const screenshotPath = join(evidenceDirectory, `${witness.id}.png`);
    const response = await page.goto(route, { waitUntil: "domcontentloaded", timeout: 60_000 });
    if (!response || response.status() !== 200) {
      await page.screenshot({ path: `${screenshotPath}.failure.png`, fullPage: true });
      await writeJson(join(evidenceDirectory, "failure.json"), {
        version: "p10b18d-zero-call-concept-4-failure-v1",
        witnessId: witness.id,
        route: p10b18dSafePreviewRouteIdentity(route),
        httpStatus: response?.status() ?? null,
        providerCallCount: (await inspect()).providerCallCount,
        failure: "retained-candidate-authority-unavailable",
      });
      throw new Error(
        `The exact retained Concept 4 candidate returned HTTP ${response?.status() ?? "unavailable"}.`,
      );
    }
    await expect(page.locator(".project-preview__storefront")).toBeVisible({ timeout: 30_000 });
    await page.locator(".project-preview__storefront").screenshot({
      path: screenshotPath,
      animations: "disabled",
    });
    retained.push({
      id: witness.id,
      route: p10b18dSafePreviewRouteIdentity(route),
      screenshotPath,
    });
  }

  const rawRoute = buildP10B18DPreviewUrl({ baseUrl, surface: home, kind: "raw-draft" });
  expect(new URL(rawRoute).searchParams.has("p10b-16p-04-proposal")).toBe(false);
  const rawResponse = await page.goto(rawRoute, { waitUntil: "domcontentloaded", timeout: 60_000 });
  expect(rawResponse?.status()).toBe(200);
  await expect(page.locator(".project-preview__storefront")).toBeVisible({ timeout: 30_000 });
  expect(await inspect()).toMatchObject({ providerCallCount: 0, cases: [] });
  await writeJson(join(evidenceDirectory, "manifest.json"), {
    version: "p10b18d-zero-call-concept-4-manifest-v1",
    candidateFingerprint,
    providerCallCount: 0,
    witnesses: retained,
    rawDraftRoute: p10b18dSafePreviewRouteIdentity(rawRoute),
  });
});
