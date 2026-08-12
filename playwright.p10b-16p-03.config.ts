import { defineConfig, devices } from "@playwright/test";

const port = process.env.PLAYWRIGHT_PORT ?? "3137";

export default defineConfig({
  testDir: "./tests/e2e",
  testMatch: "p10b-16p-03-studio-prompt-generation.spec.ts",
  workers: 1,
  fullyParallel: false,
  webServer: {
    command: `pnpm dev --webpack --port ${port}`,
    env: {
      ...process.env,
      OPENAI_API_KEY: "",
      VESKIFY_AI_PROVIDER: "deterministic",
      VESKIFY_RUNTIME_MODE: "standalone",
      VESKIFY_P10B_16P_03_MOCK_PROVIDER: "1",
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
