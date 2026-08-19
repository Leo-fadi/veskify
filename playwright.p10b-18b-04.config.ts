import { defineConfig } from "@playwright/test";
import base from "./playwright.config";

export default defineConfig(base, {
  testDir: "./tests/acceptance",
  testMatch: "p10b-18b-04-pdp-quality.spec.ts",
  timeout: 1_800_000,
});
