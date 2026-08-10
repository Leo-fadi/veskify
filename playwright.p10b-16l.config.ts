import { defineConfig, devices } from "@playwright/test";

const port = process.env.PLAYWRIGHT_PORT ?? "3136";

export default defineConfig({
  testDir: "./tests/e2e",
  testMatch: "p10b-16l-live-synthesis-acceptance.spec.ts",
  workers: 1,
  fullyParallel: false,
  webServer: {
    command: `pnpm dev --webpack --port ${port}`,
    cwd: process.env.P10B16L_PLAYWRIGHT_SERVER_CWD,
    env: {
      ...process.env,
      OPENAI_API_KEY: "",
      VESKIFY_AI_PROVIDER: "deterministic",
      VESKIFY_RUNTIME_MODE: "integrated",
      VESKIFY_P10B_16L_LOCAL_ACCEPTANCE: "1",
      VESKIFY_P10B_16L_LOCAL_ACCEPTANCE_TOKEN: "p10b-16l-mocked-browser-acceptance-token",
      VESKIFY_P10B_16L_MOCK_TRANSPORT: "1",
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
