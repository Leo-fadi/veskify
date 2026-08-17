import { randomBytes } from "node:crypto";
import { copyFileSync, cpSync, mkdirSync, symlinkSync } from "node:fs";
import { registerHooks } from "node:module";
import { tmpdir } from "node:os";
import { isAbsolute, relative, resolve, sep } from "node:path";
import { defineConfig, devices } from "@playwright/test";

// The audit executor consumes registry validation in Playwright's Node process. Next's package
// exposes its image shim as `next/image.js`, while application bundling normally resolves the
// extensionless client import. Keep that resolution accommodation local to this test process.
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier.endsWith(".module.css")) {
      return {
        shortCircuit: true,
        url: "data:text/javascript,export default new Proxy(%7B%7D,%7Bget:(_,key)=%3EString(key)%7D)",
      };
    }
    return nextResolve(specifier === "next/image" ? "next/image.js" : specifier, context);
  },
});

const standalonePort = process.env.PLAYWRIGHT_PORT ?? "3141";
const p04Port = process.env.P10B18A_P04_PLAYWRIGHT_PORT ?? "3142";
if (standalonePort === p04Port) {
  throw new Error("P10B-18A requires distinct standalone and P04 preview ports.");
}
const baseURL = `http://localhost:${standalonePort}`;
const p04BaseURL = `http://localhost:${p04Port}`;
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

function assertTemporaryDirectory(candidate: string, purpose: string): void {
  if (
    !isWithinDirectory(systemTempRoot, candidate) ||
    isWithinDirectory(repositoryRoot, candidate)
  ) {
    throw new Error(
      `P10B-18A ${purpose} must remain outside the repository within the system temporary directory.`,
    );
  }
}

const evidenceRoot = process.env.P10B18A_EVIDENCE_DIR
  ? resolve(process.env.P10B18A_EVIDENCE_DIR)
  : resolve(systemTempRoot, "veskify-p10b-18a-commercial-authority-audit");
assertTemporaryDirectory(evidenceRoot, "browser evidence");
const evidenceDirectory = resolve(evidenceRoot, runId);
const inheritedAcceptanceToken = process.env.P10B18A_P04_ACCEPTANCE_TOKEN;
const acceptanceToken =
  inheritedAcceptanceToken && Buffer.byteLength(inheritedAcceptanceToken) >= 32
    ? inheritedAcceptanceToken
    : randomBytes(32).toString("hex");

// Next owns a development lock inside its application dist directory. Give the second local
// server an isolated application root while retaining the exact repository source, packages and
// configuration. The deliberately enumerated inputs exclude every `.env*` file and all repository
// state; copied configuration files also prevent Next from rewriting the originals.
const p04ServerRoot = resolve(
  systemTempRoot,
  "veskify-p10b-18a-commercial-authority-server-roots",
  runId,
);
assertTemporaryDirectory(p04ServerRoot, "isolated server root");
mkdirSync(p04ServerRoot, { recursive: true });
symlinkSync(resolve(repositoryRoot, "node_modules"), resolve(p04ServerRoot, "node_modules"), "dir");
for (const entry of ["public", "src"] as const) {
  cpSync(resolve(repositoryRoot, entry), resolve(p04ServerRoot, entry), { recursive: true });
}
for (const entry of [
  "next.config.ts",
  "package.json",
  "pnpm-lock.yaml",
  "postcss.config.mjs",
  "tsconfig.json",
] as const) {
  copyFileSync(resolve(repositoryRoot, entry), resolve(p04ServerRoot, entry));
}

process.env.P10B18A_PLAYWRIGHT_ORIGIN = baseURL;
process.env.P10B18A_P04_PLAYWRIGHT_ORIGIN = p04BaseURL;
process.env.P10B18A_P04_ACCEPTANCE_TOKEN = acceptanceToken;
process.env.P10B18A_EVIDENCE_DIR = evidenceDirectory;
process.env.P10B18A_EVIDENCE_RUN_ID = runId;

export default defineConfig({
  testDir: "./tests/acceptance",
  testMatch: "p10b-18a-commercial-authority-audit.spec.ts",
  outputDir: resolve(evidenceDirectory, "playwright"),
  reporter: [["line"]],
  workers: 1,
  fullyParallel: false,
  retries: 0,
  timeout: 3_600_000,
  webServer: [
    {
      command: `pnpm dev --webpack --port ${standalonePort}`,
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
    {
      command: `pnpm dev --webpack --port ${p04Port}`,
      cwd: p04ServerRoot,
      env: {
        ...process.env,
        OPENAI_API_KEY: "",
        VESKIFY_AI_PROVIDER: "openai",
        VESKIFY_RUNTIME_MODE: "integrated",
        VESKIFY_P10B_16P_04_LOCAL_ACCEPTANCE: "1",
        VESKIFY_P10B_16P_04_LOCAL_ACCEPTANCE_TOKEN: acceptanceToken,
        VESKIFY_P10B_16P_04_MOCK_TRANSPORT: "1",
      },
      reuseExistingServer: false,
      timeout: 120_000,
      url: p04BaseURL,
    },
  ],
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
