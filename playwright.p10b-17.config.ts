import { randomBytes } from "node:crypto";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { defineConfig, devices } from "@playwright/test";

const port = process.env.PLAYWRIGHT_PORT ?? "3140";
const inheritedAcceptanceToken = process.env.P10B17_PLAYWRIGHT_ACCEPTANCE_TOKEN;
const acceptanceToken =
  inheritedAcceptanceToken && Buffer.byteLength(inheritedAcceptanceToken) >= 32
    ? inheritedAcceptanceToken
    : randomBytes(32).toString("hex");
const baseURL = `http://localhost:${port}`;
const evidenceRunId = `run-${Date.now().toString(36)}-${randomBytes(8).toString("hex")}`;
const evidenceRoot = process.env.P10B17_EVIDENCE_DIR
  ? resolve(process.env.P10B17_EVIDENCE_DIR)
  : resolve(tmpdir(), "veskify-p10b-17-responsive-evidence");
const evidenceDirectory = resolve(evidenceRoot, evidenceRunId);

process.env.P10B17_PLAYWRIGHT_ACCEPTANCE_TOKEN = acceptanceToken;
process.env.P10B16P04_PLAYWRIGHT_ACCEPTANCE_TOKEN = acceptanceToken;
process.env.P10B16P04_PLAYWRIGHT_ORIGIN = baseURL;
process.env.P10B17_EVIDENCE_DIR = evidenceDirectory;
process.env.P10B17_EVIDENCE_RUN_ID = evidenceRunId;

export default defineConfig({
  testDir: "./tests/acceptance",
  testMatch: "p10b-17-responsive-accessibility-performance.spec.ts",
  outputDir: resolve(evidenceDirectory, "playwright"),
  reporter: [["line"]],
  workers: 1,
  fullyParallel: false,
  retries: 0,
  timeout: 1_800_000,
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
      VESKIFY_OPENAI_TIMEOUT_MS: "120000",
    },
    reuseExistingServer: false,
    timeout: 120_000,
    url: baseURL,
  },
  use: {
    baseURL,
    actionTimeout: 30_000,
    navigationTimeout: 120_000,
    trace: "retain-on-failure",
    video: "off",
    screenshot: "only-on-failure",
  },
  expect: { timeout: 30_000 },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
