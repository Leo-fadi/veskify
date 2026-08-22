import { describe, expect, it } from "vitest";
import { requireP10B18CP04Acknowledgement } from "../helpers/p10b-18c-p04-acknowledgement";

describe("P10B-18C P04 acknowledgement contract", () => {
  it("accepts the existing positive acknowledgement", () => {
    expect(requireP10B18CP04Acknowledgement({ ok: true })).toEqual({ ok: true });
    expect(requireP10B18CP04Acknowledgement({ ok: true, acceptance: { status: "ready" } })).toEqual(
      { ok: true },
    );
  });

  it("fails closed for malformed or negative acknowledgements", () => {
    const invalid = "The P10B-16P-04 acknowledgement is invalid.";
    for (const value of [null, {}, { ok: false }, { ok: "true" }]) {
      expect(() => requireP10B18CP04Acknowledgement(value)).toThrow(invalid);
    }
  });
});
