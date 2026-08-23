import { describe, expect, it } from "vitest";
import {
  composeP10B18CProductionServerEnvironment,
  P10B18C_P04_LOCAL_ACCEPTANCE_TOKEN_ENV,
} from "../helpers/p10b-18c-production-server-composition";

const processToken = "p10b18c-process-token-for-p04-composition-0001";

describe("P10B-18C process-to-P04 token composition", () => {
  it("overrides only the integrated inherited token", () => {
    const inheritedIntegrated = {
      VESKIFY_RUNTIME_MODE: "integrated",
      VESKIFY_P10B_16P_04_MOCK_TRANSPORT: "1",
      VESKIFY_P10B_16P_04_LOCAL_ACCEPTANCE_TOKEN: "independently-generated-token-0001",
      EXISTING_INTEGRATED_AUTHORITY: "retained",
    };
    const composed = composeP10B18CProductionServerEnvironment({
      inheritedEnvironment: inheritedIntegrated,
      playwrightAcceptanceToken: processToken,
    });

    expect(composed[P10B18C_P04_LOCAL_ACCEPTANCE_TOKEN_ENV]).toBe(processToken);
    expect(composed.EXISTING_INTEGRATED_AUTHORITY).toBe("retained");
    expect(composed.P10B18C_CLEAN_CAPTURE).toBe("1");
    expect(composed.P10B18C_PRODUCTION_CAPTURE).toBe("1");
    expect(inheritedIntegrated.VESKIFY_P10B_16P_04_LOCAL_ACCEPTANCE_TOKEN).toBe(
      "independently-generated-token-0001",
    );
  });

  it("leaves standalone token authority unchanged", () => {
    const inheritedStandalone = {
      VESKIFY_RUNTIME_MODE: "standalone",
      VESKIFY_P10B_16P_04_LOCAL_ACCEPTANCE_TOKEN: "standalone-retained-token",
      EXISTING_STANDALONE_AUTHORITY: "retained",
    };
    const composed = composeP10B18CProductionServerEnvironment({
      inheritedEnvironment: inheritedStandalone,
      playwrightAcceptanceToken: processToken,
    });

    expect(composed.VESKIFY_P10B_16P_04_LOCAL_ACCEPTANCE_TOKEN).toBe("standalone-retained-token");
    expect(composed.EXISTING_STANDALONE_AUTHORITY).toBe("retained");
    expect(composed.P10B18C_PRODUCTION_CAPTURE).toBeUndefined();
  });

  it("fails closed for missing or invalid integrated process tokens", () => {
    const inheritedEnvironment = {
      VESKIFY_RUNTIME_MODE: "integrated",
      VESKIFY_P10B_16P_04_MOCK_TRANSPORT: "1",
    };
    expect(() =>
      composeP10B18CProductionServerEnvironment({
        inheritedEnvironment,
        playwrightAcceptanceToken: undefined,
      }),
    ).toThrow("The P10B-18C Playwright acceptance token is unavailable.");
    expect(() =>
      composeP10B18CProductionServerEnvironment({
        inheritedEnvironment,
        playwrightAcceptanceToken: "short",
      }),
    ).toThrow("The P10B-18C Playwright acceptance token is unavailable.");
  });
});
