import { randomBytes } from "node:crypto";
import { resolve } from "node:path";
import { defineConfig, devices } from "@playwright/test";

const port = process.env.PLAYWRIGHT_PORT ?? "3138";
const inheritedAcceptanceToken = process.env.P10B16P04_PLAYWRIGHT_ACCEPTANCE_TOKEN;
const acceptanceToken =
  inheritedAcceptanceToken && Buffer.byteLength(inheritedAcceptanceToken) >= 32
    ? inheritedAcceptanceToken
    : randomBytes(32).toString("hex");
const baseURL = `http://localhost:${port}`;
const evidenceDirectory = resolve(
  process.env.P10B16P04_ACCEPTANCE_EVIDENCE_DIR ??
    "/private/tmp/veskify-p10b-16p-04-mocked-commercial",
);
process.env.P10B16P04_PLAYWRIGHT_ACCEPTANCE_TOKEN = acceptanceToken;
process.env.P10B16P04_PLAYWRIGHT_ORIGIN = baseURL;

export default defineConfig({
  // Keep this separately authorized acceptance preflight outside the normal E2E testDir.
  testDir: "./tests/acceptance",
  testMatch: "p10b-16p-04-commercial-fidelity.spec.ts",
  outputDir: resolve(evidenceDirectory, "playwright"),
  reporter: [["line"]],
  workers: 1,
  fullyParallel: false,
  retries: 0,
  webServer: {
    command: `pnpm dev --webpack --port ${port}`,
    cwd: process.env.P10B16P04_PLAYWRIGHT_SERVER_CWD,
    env: {
      ...process.env,
      VESKIFY_AI_PROVIDER: "openai",
      VESKIFY_RUNTIME_MODE: "integrated",
      VESKIFY_P10B_16P_04_LOCAL_ACCEPTANCE: "1",
      VESKIFY_P10B_16P_04_LOCAL_ACCEPTANCE_TOKEN: acceptanceToken,
      VESKIFY_P10B_16P_04_MOCK_TRANSPORT: "1",
      // Real strict V2 output exceeded the shared 30-second default during the acceptance gate.
      // Keep this isolated acceptance composition bounded at the supported maximum.
      VESKIFY_OPENAI_TIMEOUT_MS: "120000",
    },
    reuseExistingServer: false,
    timeout: 120_000,
    url: baseURL,
  },
  use: {
    baseURL,
    actionTimeout: 30_000,
    navigationTimeout: 60_000,
    trace: "off",
    video: "off",
    screenshot: "off",
  },
  expect: { timeout: 30_000 },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
