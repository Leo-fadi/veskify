import { randomBytes } from "node:crypto";
import { mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { isAbsolute, relative, resolve, sep } from "node:path";
import { defineConfig, devices } from "@playwright/test";

const port = process.env.P10B18B05_PLAYWRIGHT_PORT ?? "3155";
const baseURL = `http://localhost:${port}`;
const runId = `run-${Date.now().toString(36)}-${randomBytes(8).toString("hex")}`;
const repositoryRoot = resolve(".");
const systemTempRoot = resolve(tmpdir());

function isWithinDirectory(parent: string, candidate: string): boolean {
  const relativePath = relative(parent, candidate);
  return (
    relativePath === "" ||
    (relativePath !== ".." && !relativePath.startsWith(`..${sep}`) && !isAbsolute(relativePath))
  );
}

const evidenceRoot = process.env.P10B18B05_EVIDENCE_ROOT
  ? resolve(process.env.P10B18B05_EVIDENCE_ROOT)
  : resolve(systemTempRoot, "veskify-p10b-18b-05-content-support-utilities");
if (
  !isWithinDirectory(systemTempRoot, evidenceRoot) ||
  isWithinDirectory(repositoryRoot, evidenceRoot)
) {
  throw new Error("P10B-18B-05 retained evidence must remain in the system temporary directory.");
}
const evidenceDirectory = resolve(evidenceRoot, runId);
mkdirSync(evidenceDirectory, { recursive: true });
process.env.P10B18B05_EVIDENCE_DIR = evidenceDirectory;
process.env.P10B18B05_EVIDENCE_RUN_ID = runId;

export default defineConfig({
  testDir: "./tests/acceptance",
  testMatch: "p10b-18b-05-content-support-utilities-quality.spec.ts",
  outputDir: resolve(evidenceDirectory, "playwright"),
  reporter: [["line"]],
  workers: 1,
  fullyParallel: false,
  retries: 0,
  timeout: 900_000,
  webServer: {
    command: `pnpm dev --webpack --port ${port}`,
    env: {
      ...process.env,
      OPENAI_API_KEY: "",
      VESKIFY_AI_PROVIDER: "deterministic",
      VESKIFY_RUNTIME_MODE: "standalone",
    },
    reuseExistingServer: false,
    timeout: 120_000,
    url: baseURL,
  },
  use: {
    baseURL,
    actionTimeout: 30_000,
    navigationTimeout: 120_000,
    trace: "off",
    video: "off",
    screenshot: "only-on-failure",
  },
  expect: { timeout: 30_000 },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
