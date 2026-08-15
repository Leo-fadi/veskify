import { randomBytes } from "node:crypto";
import { resolve } from "node:path";
import { defineConfig, devices } from "@playwright/test";

if (process.env.VESKIFY_P10B_16P_04_LIVE_ACCEPTANCE !== "1") {
  throw new Error(
    "P10B-16P-04 live acceptance requires explicit VESKIFY_P10B_16P_04_LIVE_ACCEPTANCE=1 authorization.",
  );
}

const promptAOnly = process.env.P10B16P04_PROMPT_A_ONLY === "1";
const promptBOnly = process.env.P10B16P04_PROMPT_B_ONLY === "1";
const promptCOnly = process.env.P10B16P04_PROMPT_C_ONLY === "1";
if ([promptAOnly, promptBOnly, promptCOnly].filter(Boolean).length !== 1) {
  throw new Error(
    "P10B-16P-04 live acceptance requires exactly one Prompt-A-only, Prompt-B-only or Prompt-C-only authority.",
  );
}
const priorRejectedFingerprint =
  process.env.VESKIFY_P10B_16P_04_PRIOR_REJECTED_STRUCTURAL_FINGERPRINT ?? "";
const secondPriorRejectedFingerprint =
  process.env.VESKIFY_P10B_16P_04_PRIOR_REJECTED_STRUCTURAL_FINGERPRINT_2 ?? "";
if (promptAOnly && (priorRejectedFingerprint !== "" || secondPriorRejectedFingerprint !== "")) {
  throw new Error("P10B-16P-04 Prompt A must not inherit prior rejected structures.");
}
if (
  (promptBOnly || promptCOnly) &&
  !/^semantic-structure-v1_[1-9]\d*_[0-9a-f]{64}$/u.test(priorRejectedFingerprint)
) {
  throw new Error(
    "P10B-16P-04 Prompt B/C requires the retained rejected Prompt A structural fingerprint.",
  );
}
if (promptBOnly && secondPriorRejectedFingerprint !== "") {
  throw new Error("P10B-16P-04 Prompt B accepts only the retained Prompt A structure.");
}
if (
  promptCOnly &&
  (!/^semantic-structure-v1_[1-9]\d*_[0-9a-f]{64}$/u.test(secondPriorRejectedFingerprint) ||
    secondPriorRejectedFingerprint === priorRejectedFingerprint)
) {
  throw new Error(
    "P10B-16P-04 Prompt C requires a distinct retained rejected Prompt B structural fingerprint.",
  );
}

const port = process.env.PLAYWRIGHT_PORT ?? "3139";
// Playwright can evaluate the config more than once while starting its runner and workers.
// Reuse the first process-scoped token so the browser worker and isolated server cannot receive
// different acceptance authority.
const inheritedAcceptanceToken = process.env.P10B16P04_PLAYWRIGHT_ACCEPTANCE_TOKEN;
const acceptanceToken =
  inheritedAcceptanceToken && Buffer.byteLength(inheritedAcceptanceToken) >= 32
    ? inheritedAcceptanceToken
    : randomBytes(32).toString("hex");
const evidenceDirectory = resolve(
  process.env.P10B16P04_ACCEPTANCE_EVIDENCE_DIR ??
    "/private/tmp/veskify-p10b-16p-04-live-acceptance",
);
// Next's local request authority is canonicalized to localhost; use that same origin so the
// server's strict Origin check remains exact for Studio POSTs.
const baseURL = `http://localhost:${port}`;
const inheritedEnvironment = { ...process.env };
// These values are inherited by the isolated Playwright worker only. The test applies the token
// to exact same-origin requests and never logs or retains it.
process.env.P10B16P04_PLAYWRIGHT_ACCEPTANCE_TOKEN = acceptanceToken;
process.env.P10B16P04_PLAYWRIGHT_ORIGIN = baseURL;

export default defineConfig({
  // This separately authorized suite is intentionally outside normal E2E discovery.
  testDir: "./tests/acceptance",
  testMatch: "p10b-16p-04-commercial-fidelity.spec.ts",
  outputDir: resolve(evidenceDirectory, "playwright"),
  reporter: [["line"]],
  workers: 1,
  fullyParallel: false,
  retries: 0,
  repeatEach: 1,
  forbidOnly: true,
  webServer: {
    command: `pnpm dev --webpack --port ${port}`,
    env: {
      ...inheritedEnvironment,
      VESKIFY_AI_PROVIDER: "openai",
      VESKIFY_RUNTIME_MODE: "integrated",
      VESKIFY_P10B_16P_04_LOCAL_ACCEPTANCE: "1",
      VESKIFY_P10B_16P_04_LOCAL_ACCEPTANCE_TOKEN: acceptanceToken,
      // An inherited mock flag must never redirect the separately authorized live run.
      VESKIFY_P10B_16P_04_MOCK_TRANSPORT: "0",
      // The first safe attempt proved that the shared 30-second default terminated this strict
      // V2 response. This non-production acceptance remains bounded at the supported maximum.
      VESKIFY_OPENAI_TIMEOUT_MS: "120000",
    },
    reuseExistingServer: false,
    timeout: 120_000,
    url: baseURL,
  },
  use: {
    baseURL,
    trace: "off",
    video: "off",
    screenshot: "off",
  },
  expect: { timeout: 30_000 },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
