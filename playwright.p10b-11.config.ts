import { defineConfig } from "@playwright/test";
import base from "./playwright.config";

export default defineConfig({
  ...base,
  testMatch: "p10b-11-commercial-pdp-profile-library.spec.ts",
  testIgnore: [],
});
