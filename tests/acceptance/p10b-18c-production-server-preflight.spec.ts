import { expect, test, type Page } from "@playwright/test";
import p10b18cConfig from "../../playwright.p10b-18c.config";
import { requireP10B18CP04Acknowledgement } from "../helpers/p10b-18c-p04-acknowledgement";
import { p10b18cP04AcceptanceHeaders } from "../helpers/p10b-18c-production-preflight-token";
import {
  classifyP10B18CRequestLedger,
  type P10B18CFailedRequest,
  type P10B18CSanitizedRequestFailure,
} from "../helpers/p10b-18c-request-ledger";

type ServerEntry = {
  env?: Record<string, string | undefined>;
  url?: string;
};

function serverEntries(): ServerEntry[] {
  const configured = p10b18cConfig.webServer;
  if (!configured) return [];
  return Array.isArray(configured) ? configured : [configured];
}

async function assertCleanProductionSurface(
  page: Page,
  url: string,
): Promise<readonly P10B18CSanitizedRequestFailure[]> {
  const pageErrors: string[] = [];
  const consoleErrors: string[] = [];
  const failedRequests: P10B18CFailedRequest[] = [];
  let expectedNavigationActive = false;
  page.on("pageerror", (error) => pageErrors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  page.on("requestfailed", (request) => {
    failedRequests.push({
      method: request.method(),
      url: request.url(),
      failure: request.failure()?.errorText ?? "unknown-request-failure",
      duringExpectedNavigation: expectedNavigationActive,
    });
  });

  expectedNavigationActive = true;
  const response = await page.goto(url, { waitUntil: "networkidle" });
  expectedNavigationActive = false;
  expect(response?.status()).toBe(200);
  await expect(page.locator("body")).toBeVisible();
  await expect(page.locator("nextjs-portal, #devtools-indicator")).toHaveCount(0);
  await expect(
    page.getByText(/next\.js|development mode|dev tools/i, { exact: false }),
  ).toHaveCount(0);
  const readyStateReached = await page.evaluate(() => document.readyState === "complete");
  const ledger = classifyP10B18CRequestLedger({
    requests: failedRequests,
    postcondition: {
      intendedOrigin: new URL(url).origin,
      readyStateReached,
      renderingReady: true,
      httpStatus: response?.status() ?? null,
      pageErrors,
      consoleErrors,
    },
  });
  expect(ledger.blockingRuntimeFailures).toEqual([]);
  return ledger.expectedRscNavigationAborts;
}

test("starts isolated production servers with clean standalone and P04 authority", async ({
  browser,
  request,
}, testInfo) => {
  const servers = serverEntries();
  expect(servers).toHaveLength(2);
  const standalone = servers.find(({ env }) => env?.VESKIFY_RUNTIME_MODE === "standalone");
  const integrated = servers.find(({ env }) => env?.VESKIFY_RUNTIME_MODE === "integrated");
  expect(standalone?.url).toBeTruthy();
  expect(integrated?.url).toBeTruthy();
  expect(standalone?.env?.P10B18C_PRODUCTION_CAPTURE).toBeUndefined();
  expect(integrated?.env?.P10B18C_PRODUCTION_CAPTURE).toBe("1");
  expect(integrated?.env?.VESKIFY_P10B_16P_04_MOCK_TRANSPORT).toBe("1");

  const acceptanceHeaders = p10b18cP04AcceptanceHeaders({
    processToken: process.env.P10B16P04_PLAYWRIGHT_ACCEPTANCE_TOKEN,
    serverToken: integrated?.env?.VESKIFY_P10B_16P_04_LOCAL_ACCEPTANCE_TOKEN,
  });
  const inspection = await request.get(`${integrated!.url}/api/demo/p10b-16p-04`, {
    headers: acceptanceHeaders,
  });
  expect(inspection.status(), await inspection.text()).toBe(200);
  expect(requireP10B18CP04Acknowledgement(await inspection.json())).toEqual({ ok: true });

  const standaloneContext = await browser.newContext();
  const integratedContext = await browser.newContext();
  try {
    const expectedRscNavigationAborts = [
      ...(await assertCleanProductionSurface(
        standaloneContext.pages()[0] ?? (await standaloneContext.newPage()),
        standalone!.url!,
      )),
      ...(await assertCleanProductionSurface(
        integratedContext.pages()[0] ?? (await integratedContext.newPage()),
        integrated!.url!,
      )),
    ];
    await testInfo.attach("expected-rsc-navigation-aborts", {
      body: Buffer.from(
        JSON.stringify({
          expectedRscNavigationAbortCount: expectedRscNavigationAborts.length,
          expectedRscNavigationAborts,
        }),
      ),
      contentType: "application/json",
    });
  } finally {
    await Promise.all([standaloneContext.close(), integratedContext.close()]);
  }
});
