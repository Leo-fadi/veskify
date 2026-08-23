import { describe, expect, it } from "vitest";
import {
  P10B18C_P04_ACCEPTANCE_TOKEN_HEADER,
  p10b18cP04AcceptanceHeaders,
} from "../helpers/p10b-18c-production-preflight-token";

const token = "p10b18c-production-preflight-token-0001";

describe("P10B-18C production preflight token authority", () => {
  it("returns only the existing acceptance header for matching bounded tokens", () => {
    expect(p10b18cP04AcceptanceHeaders({ processToken: token, serverToken: token })).toEqual({
      [P10B18C_P04_ACCEPTANCE_TOKEN_HEADER]: token,
    });
    expect(P10B18C_P04_ACCEPTANCE_TOKEN_HEADER).toBe("x-veskify-p10b-16p-04-acceptance-token");
  });

  it("fails closed for missing, short, or mismatched token authority", () => {
    const unavailable = "The mocked P10B-16P-04 production preflight authority is unavailable.";
    expect(() =>
      p10b18cP04AcceptanceHeaders({ processToken: undefined, serverToken: token }),
    ).toThrow(unavailable);
    expect(() =>
      p10b18cP04AcceptanceHeaders({ processToken: token, serverToken: undefined }),
    ).toThrow(unavailable);
    expect(() =>
      p10b18cP04AcceptanceHeaders({ processToken: "short", serverToken: "short" }),
    ).toThrow(unavailable);
    expect(() =>
      p10b18cP04AcceptanceHeaders({ processToken: token, serverToken: `${token}-mismatch` }),
    ).toThrow(unavailable);
  });
});
