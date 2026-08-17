import { defineConfig } from "@playwright/test";
import p10b18aConfig from "./playwright.p10b-18a.config";

// Reuse the frozen P10B-18A dual-origin, production-disabled server authority.
// This focused successor changes only the selected evidence test and keeps all
// screenshots/manifests in the same run-scoped system temporary directory.
export default defineConfig(p10b18aConfig, {
  testMatch: "p10b-18b-01-design-dna-shared-frames.spec.ts",
  timeout: 1_800_000,
});
