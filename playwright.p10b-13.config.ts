import { defineConfig } from "@playwright/test";
import base from "./playwright.config";

export default defineConfig({
  ...base,
  testMatch: "p10b-13-commerce-utility-presentation.spec.ts",
  testIgnore: [],
});
