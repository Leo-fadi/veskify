import { defineConfig, devices } from "@playwright/test";

const port = process.env.PLAYWRIGHT_PORT ?? "3100";

export default defineConfig({
  testDir: "./tests/e2e",
  testIgnore: ["p9r-04-generation-acceptance.spec.ts", "p10a-04c-homepage-commerce-bridge.spec.ts"],
  // Project state and browser evidence are intentionally isolated per run.
  workers: 1,
  fullyParallel: false,
  webServer: {
    command: `pnpm dev --port ${port}`,
    env: {
      ...process.env,
      VESKIFY_AI_PROVIDER: "deterministic",
      VESKIFY_P9_05B_LOCAL_DEMO: "1",
      VESKIFY_P9_05B_LOCAL_DEMO_TOKEN: "publish-confirmation-deterministic-browser-token",
      VESKIFY_RUNTIME_MODE: "integrated",
    },
    url: `http://localhost:${port}`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
  use: {
    baseURL: `http://localhost:${port}`,
    trace: "on-first-retry",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
