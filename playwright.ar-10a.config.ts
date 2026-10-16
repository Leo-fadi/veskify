import { defineConfig } from "@playwright/test";
if (!process.env.AR10A_OUTPUT_DIR || !process.env.AR10A_ORIGIN || !process.env.AR10A_CDP_URL)
  throw new Error("Use the assigned AR-10A offline runner");
export default defineConfig({
  testDir: "./tests/acceptance",
  testMatch: "ar-10a-visual-realization.spec.ts",
  outputDir: `${process.env.AR10A_OUTPUT_DIR}/playwright`,
  reporter: [["line"]],
  workers: 1,
  fullyParallel: false,
  retries: 0,
  timeout: 900_000,
  expect: { timeout: 30_000 },
  use: {
    baseURL: process.env.AR10A_ORIGIN,
    trace: "off",
    video: "off",
    screenshot: "off",
    actionTimeout: 30_000,
    navigationTimeout: 60_000,
  },
  projects: [{ name: "chromium" }],
});
