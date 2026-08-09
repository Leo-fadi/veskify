import base from "./playwright.config";
import { defineConfig } from "@playwright/test";

export default defineConfig({
  ...base,
  testMatch: "p10b-09-commercial-homepage-profile-library.spec.ts",
  testIgnore: [],
});
