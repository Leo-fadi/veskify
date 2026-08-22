import { resolve } from "node:path";
import { tmpdir } from "node:os";
import { defineConfig } from "@playwright/test";
import p10b18cConfig from "./playwright.p10b-18c.config";

export default defineConfig({
  ...p10b18cConfig,
  testMatch: "p10b-18c-production-server-preflight.spec.ts",
  outputDir: resolve(tmpdir(), "veskify-p10b-18c-production-server-preflight"),
  reporter: [["line"]],
  workers: 1,
  fullyParallel: false,
});
