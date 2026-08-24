import { P10B18D_ACCEPTANCE_TOKEN_ENVIRONMENT_KEY } from "./p10b-18d-live-commercial-acceptance";

export const P10B18D_PLAYWRIGHT_ACCEPTANCE_TOKEN_ENVIRONMENT_KEY =
  "P10B16P04_PLAYWRIGHT_ACCEPTANCE_TOKEN" as const;
export const P10B18D_MOCK_TRANSPORT_ENVIRONMENT_KEY = "VESKIFY_P10B_16P_04_MOCK_TRANSPORT" as const;
export const P10B18D_ACCEPTANCE_TOKEN_MINIMUM_BYTES = 32 as const;

export type P10B18DPlaywrightTransport = "live" | "mock";

type Environment = Readonly<Record<string, string | undefined>>;
type MutableEnvironment = Record<string, string | undefined>;

function normalizedEnvironmentValue(environment: Environment, key: string): string | undefined {
  const value = environment[key]?.trim();
  return value && value.length > 0 ? value : undefined;
}

/**
 * Installs the single P04-configured acceptance token into the Playwright
 * worker environment before either the server or worker starts. Token values
 * never enter return values, diagnostics, metadata, or evidence.
 */
export function installP10B18DPlaywrightSessionToken(input: {
  serverEnvironment: Environment;
  workerEnvironment: MutableEnvironment;
  expectedTransport: P10B18DPlaywrightTransport;
}): void {
  const sourceToken = normalizedEnvironmentValue(
    input.workerEnvironment,
    P10B18D_PLAYWRIGHT_ACCEPTANCE_TOKEN_ENVIRONMENT_KEY,
  );
  const serverToken = normalizedEnvironmentValue(
    input.serverEnvironment,
    P10B18D_ACCEPTANCE_TOKEN_ENVIRONMENT_KEY,
  );
  const existingWorkerToken = normalizedEnvironmentValue(
    input.workerEnvironment,
    P10B18D_ACCEPTANCE_TOKEN_ENVIRONMENT_KEY,
  );

  if (!sourceToken || !serverToken) {
    throw new Error("P10B-18D requires one configured Playwright acceptance token authority.");
  }
  if (
    Buffer.byteLength(sourceToken, "utf8") < P10B18D_ACCEPTANCE_TOKEN_MINIMUM_BYTES ||
    Buffer.byteLength(serverToken, "utf8") < P10B18D_ACCEPTANCE_TOKEN_MINIMUM_BYTES
  ) {
    throw new Error("The P10B-18D Playwright acceptance token does not satisfy its contract.");
  }
  if (sourceToken !== serverToken) {
    throw new Error("The P10B-18D Playwright server and session token authorities do not match.");
  }
  if (existingWorkerToken && existingWorkerToken !== sourceToken) {
    throw new Error("The P10B-18D Playwright worker has an independent acceptance token.");
  }

  const expectedMockFlag = input.expectedTransport === "mock" ? "1" : "0";
  if (
    normalizedEnvironmentValue(input.serverEnvironment, P10B18D_MOCK_TRANSPORT_ENVIRONMENT_KEY) !==
    expectedMockFlag
  ) {
    throw new Error("The P10B-18D Playwright transport authority does not match its config.");
  }

  input.workerEnvironment[P10B18D_ACCEPTANCE_TOKEN_ENVIRONMENT_KEY] = sourceToken;
}
