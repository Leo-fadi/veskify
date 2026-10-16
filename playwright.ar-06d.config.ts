import { defineConfig } from "@playwright/test";

if (!process.env.AR06D_OUTPUT_DIR || !process.env.AR06D_ORIGIN || !process.env.AR06D_CDP_URL) {
  throw new Error(
    "Use the task runner; AR-06D requires an assigned persistent output and owned browser/server.",
  );
}
export default defineConfig({
  testDir: "./tests/acceptance",
  testMatch: "ar-06d-generated-storefront-review.spec.ts",
  outputDir: `${process.env.AR06D_OUTPUT_DIR}/playwright`,
  reporter: [["line"]],
  workers: 1,
  fullyParallel: false,
  retries: 0,
  timeout: 900_000,
  expect: { timeout: 30_000 },
  use: {
    baseURL: process.env.AR06D_ORIGIN,
    trace: "off",
    video: "off",
    screenshot: "off",
    actionTimeout: 30_000,
    navigationTimeout: 60_000,
  },
  projects: [{ name: "chromium" }],
});
