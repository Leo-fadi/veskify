import { describe, expect, it } from "vitest";
import {
  P10B18A_P04_ACCEPTANCE_HEADER,
  composeP10B18AP04RequestHeaders,
  requireP10B18AP04AcceptanceToken,
} from "../acceptance/p10b-18a-browser-evidence";
import {
  composeP10B18CProductionServerEnvironment,
  P10B18C_P04_LOCAL_ACCEPTANCE_TOKEN_ENV,
} from "../helpers/p10b-18c-production-server-composition";

const processToken = "p10b18c-page-request-process-token-000000000001";
const inheritedToken = "p10b18a-independently-generated-token-0000000001";
const p04Origin = "http://localhost:3142";

describe("P10B-18C P04 page-request token authority", () => {
  it("uses the exact process/server token for same-origin P04 page requests", () => {
    const serverEnvironment = composeP10B18CProductionServerEnvironment({
      inheritedEnvironment: {
        VESKIFY_RUNTIME_MODE: "integrated",
        VESKIFY_P10B_16P_04_MOCK_TRANSPORT: "1",
        VESKIFY_P10B_16P_04_LOCAL_ACCEPTANCE_TOKEN: inheritedToken,
      },
      playwrightAcceptanceToken: processToken,
    });
    const headers = composeP10B18AP04RequestHeaders({
      requestHeaders: { accept: "text/html" },
      requestUrl: `${p04Origin}/projects/project_p10b16p04_aurum_commercial_acceptance`,
      p04Origin,
      acceptanceToken: processToken,
    });

    expect(inheritedToken).not.toBe(processToken);
    expect(headers[P10B18A_P04_ACCEPTANCE_HEADER]).toBe(
      serverEnvironment[P10B18C_P04_LOCAL_ACCEPTANCE_TOKEN_ENV],
    );
    expect(headers.accept).toBe("text/html");
  });

  it("strips the acceptance token from standalone and off-origin requests", () => {
    const existingHeaders = {
      accept: "text/html",
      [P10B18A_P04_ACCEPTANCE_HEADER]: inheritedToken,
    };
    for (const requestUrl of [
      "http://localhost:3141/projects/project_aurum_nordic",
      "https://example.com/projects/project_aurum_nordic",
    ]) {
      const headers = composeP10B18AP04RequestHeaders({
        requestHeaders: existingHeaders,
        requestUrl,
        p04Origin,
        acceptanceToken: processToken,
      });
      expect(headers[P10B18A_P04_ACCEPTANCE_HEADER]).toBeUndefined();
      expect(headers.accept).toBe("text/html");
    }
    expect(existingHeaders[P10B18A_P04_ACCEPTANCE_HEADER]).toBe(inheritedToken);
  });

  it("fails closed for missing or invalid explicit page-request tokens", () => {
    expect(() => requireP10B18AP04AcceptanceToken("")).toThrow(
      "P10B-18A requires a P04 acceptance token of at least 32 bytes.",
    );
    expect(() => requireP10B18AP04AcceptanceToken("short")).toThrow(
      "P10B-18A requires a P04 acceptance token of at least 32 bytes.",
    );
  });
});
