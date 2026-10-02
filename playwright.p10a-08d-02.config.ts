import { defineConfig, devices } from "@playwright/test";

const port = process.env.PLAYWRIGHT_PORT ?? "3132";
const group02Diagnostics = process.env.VESKIFY_AR00B_GROUP02_DIAGNOSTICS === "1";

export default defineConfig({
  testDir: "./tests/e2e",
  testMatch: "p10a-08d-02-complete-publication-evidence.spec.ts",
  workers: 1,
  fullyParallel: false,
  webServer: {
    command: `pnpm dev --port ${port}`,
    env: {
      ...process.env,
      VESKIFY_AI_PROVIDER: "deterministic",
      VESKIFY_P9_05B_LOCAL_DEMO: "1",
      VESKIFY_P9_05B_LOCAL_DEMO_TOKEN: "p10a-08d-02-publication-evidence-token",
      VESKIFY_RUNTIME_MODE: "integrated",
    },
    reuseExistingServer: false,
    timeout: 120_000,
    url: `http://localhost:${port}`,
    ...(group02Diagnostics ? { stdout: "pipe" as const, stderr: "pipe" as const } : {}),
  },
  use: {
    baseURL: `http://localhost:${port}`,
    trace: group02Diagnostics ? { mode: "retain-on-failure", sources: false } : "on-first-retry",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
