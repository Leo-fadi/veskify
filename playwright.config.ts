import { defineConfig, devices } from "@playwright/test";

const port = process.env.PLAYWRIGHT_PORT ?? "3100";

export default defineConfig({
  testDir: "./tests/e2e",
  testIgnore: [
    "p9r-04-generation-acceptance.spec.ts",
    "p10a-04c-homepage-commerce-bridge.spec.ts",
    "publish-confirmation.spec.ts",
    "p10a-08d-02-complete-publication-evidence.spec.ts",
    "p10b-04-responsive-image-art-direction.spec.ts",
    "p10b-07-commercial-storytelling.spec.ts",
    "p10b-08-canonical-product-card-family.spec.ts",
    "p10b-09-commercial-homepage-profile-library.spec.ts",
    "p10b-11-commercial-pdp-profile-library.spec.ts",
    "p10b-16p-03-studio-prompt-generation.spec.ts",
    "p10b-16p-06-canonical-search-query-results.spec.ts",
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
