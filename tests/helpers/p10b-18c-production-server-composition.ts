export const P10B18C_PLAYWRIGHT_ACCEPTANCE_TOKEN_ENV =
  "P10B16P04_PLAYWRIGHT_ACCEPTANCE_TOKEN" as const;
export const P10B18C_P04_LOCAL_ACCEPTANCE_TOKEN_ENV =
  "VESKIFY_P10B_16P_04_LOCAL_ACCEPTANCE_TOKEN" as const;

export function requireP10B18CPlaywrightAcceptanceToken(token: string | undefined): string {
  if (!token || Buffer.byteLength(token) < 32) {
    throw new Error("The P10B-18C Playwright acceptance token is unavailable.");
  }
  return token;
}

export function composeP10B18CProductionServerEnvironment(input: {
  inheritedEnvironment: Readonly<Record<string, string>>;
  playwrightAcceptanceToken: string | undefined;
}): Record<string, string> {
  const environment: Record<string, string> = {
    ...input.inheritedEnvironment,
    P10B18C_CLEAN_CAPTURE: "1",
  };
  const isIntegratedP04 =
    environment.VESKIFY_RUNTIME_MODE === "integrated" &&
    environment.VESKIFY_P10B_16P_04_MOCK_TRANSPORT === "1";
  if (!isIntegratedP04) return environment;

  return {
    ...environment,
    P10B18C_PRODUCTION_CAPTURE: "1",
    [P10B18C_P04_LOCAL_ACCEPTANCE_TOKEN_ENV]: requireP10B18CPlaywrightAcceptanceToken(
      input.playwrightAcceptanceToken,
    ),
  };
}
