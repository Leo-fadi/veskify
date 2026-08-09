import { defineConfig, devices } from "@playwright/test";

const port = process.env.PLAYWRIGHT_PORT ?? "3126";

export default defineConfig({
  testDir: "./tests/e2e",
  testMatch: "p10b-06-commercial-shared-frame-families.spec.ts",
  workers: 1,
  fullyParallel: false,
  webServer: {
    command: `pnpm dev --port ${port}`,
    env: {
      ...process.env,
      VESKIFY_AI_PROVIDER: "deterministic",
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
