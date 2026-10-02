import { defineConfig } from "@playwright/test";
import base from "./playwright.config";

const inheritedServer = Array.isArray(base.webServer) ? base.webServer[0] : base.webServer;
if (!inheritedServer)
  throw new Error("P10B-11 requires the inherited Playwright web-server configuration");
const configuredRuntimeMode = inheritedServer.env?.VESKIFY_RUNTIME_MODE ?? "unknown";

export default defineConfig({
  ...base,
  testMatch: "p10b-11-commercial-pdp-profile-library.spec.ts",
  testIgnore: [],
  outputDir: ".ci-pdp-diagnostics",
  webServer: {
    ...inheritedServer,
    stdout: "pipe",
    stderr: "pipe",
  },
  use: {
    ...base.use,
    trace: { mode: "retain-on-failure", sources: false },
  },
  projects: (base.projects ?? []).map((project) => ({
    ...project,
    metadata: { ...project.metadata, ar00bPdpRuntimeMode: `CONFIGURED:${configuredRuntimeMode}` },
  })),
});
