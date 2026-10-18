import { describe, expect, it } from "vitest";
import { observeAr09ALegacyBehavior } from "../helpers/ar-09a-regional-design-observation";
import baseline from "../fixtures/ar-09a/legacy-behavior.json";

describe("AR-09A legacy regional-intent baseline", () => {
  it("retains the exact base observations while no preference overlay is supplied", () => {
    expect(observeAr09ALegacyBehavior()).toEqual(baseline);
  });
});
