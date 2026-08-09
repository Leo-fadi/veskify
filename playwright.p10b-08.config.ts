import { defineConfig, devices } from "@playwright/test";

const port = process.env.PLAYWRIGHT_PORT ?? "3128";

export default defineConfig({
  testDir: "./tests/e2e",
  testMatch: "p10b-08-canonical-product-card-family.spec.ts",
  workers: 1,
  fullyParallel: false,
  webServer: {
    command: `pnpm dev --port ${port}`,
    env: {
      ...process.env,
      VESKIFY_AI_PROVIDER: "deterministic",
      VESKIFY_P10A_04C_LOCAL_DEMO: "1",
      VESKIFY_P9_05B_LOCAL_DEMO: "1",
      VESKIFY_P9_05B_LOCAL_DEMO_TOKEN: "p10a-04c-deterministic-browser-token",
      VESKIFY_RUNTIME_MODE: "integrated",
    },
    reuseExistingServer: false,
    timeout: 120_000,
    url: `http://localhost:${port}`,
  },
  use: {
    baseURL: `http://localhost:${port}`,
    trace: "on-first-retry",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
