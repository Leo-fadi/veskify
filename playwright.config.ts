import { defineConfig, devices } from "@playwright/test";

const port = process.env.PLAYWRIGHT_PORT ?? "3100";

export default defineConfig({
  testDir: "./tests/e2e",
  testIgnore: [
    "p9r-04-generation-acceptance.spec.ts",
    "p10a-04c-homepage-commerce-bridge.spec.ts",
    "publish-confirmation.spec.ts",
    "p10a-08d-02-complete-publication-evidence.spec.ts",
  ],
  // Project state and browser evidence are intentionally isolated per run.
  workers: 1,
  fullyParallel: false,
  webServer: {
    command: `pnpm dev --port ${port}`,
    env: {
      ...process.env,
      VESKIFY_RUNTIME_MODE: "standalone",
    },
    url: `http://127.0.0.1:${port}`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
  use: {
    baseURL: `http://127.0.0.1:${port}`,
    trace: "on-first-retry",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
