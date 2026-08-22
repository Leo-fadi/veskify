// @vitest-environment node

import { describe, expect, it } from "vitest";
import { P10B18C_STAGE_B_BROWSER_TIMEOUT_MS } from "../helpers/p10b-18c-commercial-quality";

describe("P10B-18C Stage B bounded browser timeout", () => {
  it("retains a five-hour budget for measured matrix setup plus complete capture", () => {
    expect(P10B18C_STAGE_B_BROWSER_TIMEOUT_MS).toBe(18_000_000);
    expect(P10B18C_STAGE_B_BROWSER_TIMEOUT_MS).toBeGreaterThan(3.2 * 60 * 60 * 1_000);
  });
});
