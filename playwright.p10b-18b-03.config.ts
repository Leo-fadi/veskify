import { defineConfig } from "@playwright/test";
import p10b18aConfig from "./playwright.p10b-18a.config";

export default defineConfig(p10b18aConfig, {
  testMatch: "p10b-18b-03-collection-search-product-card-quality.spec.ts",
  timeout: 1_800_000,
});
