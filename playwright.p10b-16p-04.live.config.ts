import { randomBytes } from "node:crypto";
import { resolve } from "node:path";
import { defineConfig, devices } from "@playwright/test";

if (process.env.VESKIFY_P10B_16P_04_LIVE_ACCEPTANCE !== "1") {
  throw new Error(
    "P10B-16P-04 live acceptance requires explicit VESKIFY_P10B_16P_04_LIVE_ACCEPTANCE=1 authorization.",
  );
}

const port = process.env.PLAYWRIGHT_PORT ?? "3139";
const inheritedAcceptanceToken = process.env.P10B16P04_PLAYWRIGHT_ACCEPTANCE_TOKEN;
const acceptanceToken =
  inheritedAcceptanceToken && Buffer.byteLength(inheritedAcceptanceToken) >= 32
    ? inheritedAcceptanceToken
    : randomBytes(32).toString("hex");
const baseURL = `http://localhost:${port}`;
const inheritedEnvironment = { ...process.env };

process.env.P10B16P04_PLAYWRIGHT_ACCEPTANCE_TOKEN = acceptanceToken;
process.env.P10B16P04_PLAYWRIGHT_ORIGIN = baseURL;

export default defineConfig({
  testDir: "./tests/acceptance",
  testMatch: "p10b-16p-04-commercial-fidelity.spec.ts",
  outputDir: resolve("test-results/p10b-16p-04-live"),
  reporter: [["line"]],
  workers: 1,
  fullyParallel: false,
  retries: 0,
  repeatEach: 1,
  forbidOnly: true,
  webServer: {
    command: `pnpm dev --webpack --port ${port}`,
    env: {
      ...inheritedEnvironment,
      VESKIFY_AI_PROVIDER: "openai",
      VESKIFY_RUNTIME_MODE: "integrated",
      VESKIFY_P10B_16P_04_LOCAL_ACCEPTANCE: "1",
      VESKIFY_P10B_16P_04_LOCAL_ACCEPTANCE_TOKEN: acceptanceToken,
      VESKIFY_P10B_16P_04_MOCK_TRANSPORT: "0",
      VESKIFY_OPENAI_MODEL: "gpt-5.6-sol",
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
