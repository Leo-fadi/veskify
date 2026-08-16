import { randomBytes } from "node:crypto";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { defineConfig, devices } from "@playwright/test";

const port = process.env.PLAYWRIGHT_PORT ?? "3139";
const inheritedAcceptanceToken = process.env.P10B16P06_PLAYWRIGHT_ACCEPTANCE_TOKEN;
const acceptanceToken =
  inheritedAcceptanceToken && Buffer.byteLength(inheritedAcceptanceToken) >= 32
    ? inheritedAcceptanceToken
    : randomBytes(32).toString("hex");
const baseURL = `http://localhost:${port}`;
const evidenceDirectory = process.env.P10B16P06_SEARCH_EVIDENCE_DIR
  ? resolve(process.env.P10B16P06_SEARCH_EVIDENCE_DIR)
  : resolve(tmpdir(), "veskify-p10b-16p-06-search-evidence");
process.env.P10B16P06_PLAYWRIGHT_ACCEPTANCE_TOKEN = acceptanceToken;

export default defineConfig({
  testDir: "./tests/e2e",
  testMatch: "p10b-16p-06-canonical-search-query-results.spec.ts",
  outputDir: resolve(evidenceDirectory, "playwright"),
  reporter: [["line"]],
  workers: 1,
  fullyParallel: false,
  retries: 0,
  webServer: {
    command: `pnpm dev --webpack --port ${port}`,
    env: {
      ...process.env,
      OPENAI_API_KEY: "",
      VESKIFY_AI_PROVIDER: "openai",
      VESKIFY_RUNTIME_MODE: "integrated",
      VESKIFY_P10B_16P_04_LOCAL_ACCEPTANCE: "1",
      VESKIFY_P10B_16P_04_LOCAL_ACCEPTANCE_TOKEN: acceptanceToken,
      VESKIFY_P10B_16P_04_MOCK_TRANSPORT: "1",
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
