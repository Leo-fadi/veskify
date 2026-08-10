import base from "./playwright.config";
import { defineConfig } from "@playwright/test";

export default defineConfig({
  ...base,
  testMatch: "p10b-12-content-support-page-families.spec.ts",
  testIgnore: [],
});
