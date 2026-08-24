import { resolve } from "node:path";
import { defineConfig } from "@playwright/test";
import p10b16p04Config from "./playwright.p10b-16p-04.config";
import { installP10B18DPlaywrightSessionToken } from "./tests/helpers/p10b-18d-playwright-token-composition";

const evidenceRoot = process.env.P10B18D_EVIDENCE_ROOT?.trim();
if (!evidenceRoot) {
  throw new Error("P10B18D_EVIDENCE_ROOT is required for the P10B-18D acceptance runner.");
}

const inheritedWebServer = p10b16p04Config.webServer;
if (!inheritedWebServer || Array.isArray(inheritedWebServer) || !inheritedWebServer.env) {
  throw new Error("P10B-18D requires one inherited P04 Playwright server environment.");
}
installP10B18DPlaywrightSessionToken({
  serverEnvironment: inheritedWebServer.env,
  workerEnvironment: process.env,
  expectedTransport: "mock",
});

export default defineConfig(p10b16p04Config, {
  testMatch: [
    process.env.P10B18D_ZERO_CALL_CANDIDATE_FINGERPRINT
      ? "p10b-18d-zero-call-concept-4-preview.spec.ts"
      : "p10b-18d-live-commercial-baseline.spec.ts",
  ],
  timeout: 1_800_000,
  outputDir: resolve(evidenceRoot, "playwright-output"),
});
