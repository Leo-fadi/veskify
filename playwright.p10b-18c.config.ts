import { randomBytes } from "node:crypto";
import { mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { defineConfig } from "@playwright/test";
import p10b18aConfig from "./playwright.p10b-18a.config";
import {
  composeP10B18CProductionServerEnvironment,
  P10B18C_PLAYWRIGHT_ACCEPTANCE_TOKEN_ENV,
} from "./tests/helpers/p10b-18c-production-server-composition";
import {
  classifyP10B18CStageBStorageMode,
  P10B18C_INTEGRATED_P04_BUILD_ROOT_ENV,
  P10B18C_STANDALONE_BUILD_ROOT_ENV,
  runP10B18CStageBAfterFreeSpacePreflight,
} from "./tests/helpers/p10b-18c-free-space-preflight";

const runId =
  process.env.P10B18C_EVIDENCE_RUN_ID ??
  `run-${Date.now().toString(36)}-${randomBytes(8).toString("hex")}`;
const evidenceDirectory = resolve(
  process.env.P10B18C_EVIDENCE_DIR ??
    resolve(tmpdir(), `veskify-p10b-18c-commercial-quality-${runId}`),
);
const inheritedWebServers = Array.isArray(p10b18aConfig.webServer)
  ? p10b18aConfig.webServer
  : p10b18aConfig.webServer
    ? [p10b18aConfig.webServer]
    : [];

if (inheritedWebServers.length !== 2) {
  throw new Error(
    `P10B-18C Stage B requires exactly two production server roots; received ${inheritedWebServers.length}`,
  );
}

const storageRoots = [
  { identity: "evidence-root" as const, path: evidenceDirectory },
  {
    identity: "standalone-build-root" as const,
    path: inheritedWebServers[0].cwd ?? process.cwd(),
  },
  {
    identity: "integrated-p04-build-root" as const,
    path: inheritedWebServers[1].cwd ?? process.cwd(),
  },
];
const storageMode = classifyP10B18CStageBStorageMode({
  baselineManifestPath: process.env.P10B18C_DELTA_BASELINE_MANIFEST,
  baselineHumanReviewPath: process.env.P10B18C_DELTA_BASELINE_HUMAN_REVIEW,
});
const initializeEvidenceEnvironment = () => {
  mkdirSync(evidenceDirectory, { recursive: true });
  process.env.P10B18C_EVIDENCE_DIR = evidenceDirectory;
  process.env.P10B18C_EVIDENCE_RUN_ID = runId;
  process.env.P10B18A_EVIDENCE_DIR = evidenceDirectory;
  process.env.P10B18A_EVIDENCE_RUN_ID = runId;
  process.env[P10B18C_STANDALONE_BUILD_ROOT_ENV] = storageRoots[1].path;
  process.env[P10B18C_INTEGRATED_P04_BUILD_ROOT_ENV] = storageRoots[2].path;
};

if (storageMode === "full") {
  runP10B18CStageBAfterFreeSpacePreflight({ roots: storageRoots }, initializeEvidenceEnvironment);
} else {
  initializeEvidenceEnvironment();
}

const cleanCaptureWebServers = inheritedWebServers.map((server) => ({
  ...server,
  command: `pnpm build:webpack && pnpm start --port ${new URL(server.url!).port}`,
  env: composeP10B18CProductionServerEnvironment({
    inheritedEnvironment: server.env ?? {},
    playwrightAcceptanceToken: process.env[P10B18C_PLAYWRIGHT_ACCEPTANCE_TOKEN_ENV],
  }),
  reuseExistingServer: false,
  timeout: 600_000,
}));

export default defineConfig({
  ...p10b18aConfig,
  testDir: "./tests/acceptance",
  testMatch: "p10b-18c-100-plus-commercial-quality-diversity-gate.spec.ts",
  outputDir: resolve(evidenceDirectory, "playwright-output"),
  reporter: [["line"]],
  workers: 1,
  fullyParallel: false,
  webServer: cleanCaptureWebServers,
});
