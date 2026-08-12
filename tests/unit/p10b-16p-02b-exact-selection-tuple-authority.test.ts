import { describe, expect, it } from "vitest";
import {
  boundedStorefrontSynthesisExactSelectionSchema,
  createBoundedStorefrontSynthesisDecision,
  listCompatibleCoordinatedDirectionSelectionNarrowings,
  type BoundedStorefrontSynthesisError,
  type BoundedStorefrontSynthesisExactSelection,
  type BoundedStorefrontSynthesisSelectionNarrowing,
} from "@/application/bounded-storefront-synthesis";
import { createP10B14PremiumEditorialFixture } from "@/data/demo/p10b-14-premium-editorial";
import { canonicalValueString } from "@/domain/storefront";

function currentAuthority() {
  const source = createP10B14PremiumEditorialFixture();
  return {
    source,
    input: {
      planningInput: source.fixture.planningInput,
      siteMapDecision: source.siteMapDecision,
      approvedEvidenceReferences: source.approvedEvidenceReferences,
    },
  };
}

function exactSelection(
  narrowing: BoundedStorefrontSynthesisSelectionNarrowing,
): BoundedStorefrontSynthesisExactSelection {
  const {
    authorityId: _authorityId,
    authorityVersion: _authorityVersion,
    authorityFingerprint: _authorityFingerprint,
    selectionId: _selectionId,
    ...exact
  } = narrowing;
  void _authorityId;
  void _authorityVersion;
  void _authorityFingerprint;
  void _selectionId;
  return boundedStorefrontSynthesisExactSelectionSchema.parse(exact);
}

const mixableFields = [
  "sharedFrameProfileId",
  "homepageProfileId",
  "collectionProfileId",
  "searchProfileId",
  "pdpProfileId",
  "includedOptionalPageFamilyIds",
  "narrativePosture",
  "merchandisingPosture",
  "informationDensityPosture",
  "artDirectionPosture",
  "responsiveMode",
] as const satisfies readonly (keyof BoundedStorefrontSynthesisExactSelection)[];

function unauthorizedCrossFieldMix(
  narrowings: readonly BoundedStorefrontSynthesisSelectionNarrowing[],
): BoundedStorefrontSynthesisExactSelection {
  const exact = narrowings.map(exactSelection);
  const exactTuples = new Set(exact.map(canonicalValueString));
  for (const base of exact) {
    for (const alternative of exact.filter(({ directionId }) => directionId === base.directionId)) {
      for (const field of mixableFields) {
        if (canonicalValueString(base[field]) === canonicalValueString(alternative[field]))
          continue;
        const mixed = boundedStorefrontSynthesisExactSelectionSchema.parse({
          ...base,
          [field]: alternative[field],
        });
        if (!exactTuples.has(canonicalValueString(mixed))) return mixed;
      }
    }
  }
  throw new Error("The current authority fixture did not expose a cross-field tuple regression.");
}

describe("P10B-16P-02B exact selection tuple authority", () => {
  it("accepts one execution-only current tuple and rejects cross-field authority mixing", () => {
    const { input } = currentAuthority();
    const narrowings = listCompatibleCoordinatedDirectionSelectionNarrowings(input);
    const first = narrowings[0];
    if (!first) throw new Error("Missing current compatible selection authority.");
    const exact = exactSelection(first);

    expect(exact).not.toHaveProperty("selectionId");
    expect(exact).not.toHaveProperty("authorityId");
    expect(
      createBoundedStorefrontSynthesisDecision({
        ...input,
        request: { intent: "prompted-design-v2", deterministicSeed: "exact-current-tuple" },
        exactSelection: exact,
      }).decisions,
    ).toContainEqual(expect.objectContaining({ code: "prompted-v2-exact-selection" }));

    const mixed = unauthorizedCrossFieldMix(narrowings);
    const sameDirectionTuples = narrowings
      .map(exactSelection)
      .filter(({ directionId }) => directionId === mixed.directionId);
    for (const field of mixableFields) {
      expect(
        sameDirectionTuples.some(
          (candidate) =>
            canonicalValueString(candidate[field]) === canonicalValueString(mixed[field]),
        ),
      ).toBe(true);
    }
    expect(sameDirectionTuples.map(canonicalValueString)).not.toContain(
      canonicalValueString(mixed),
    );

    expect(() =>
      createBoundedStorefrontSynthesisDecision({
        ...input,
        request: { intent: "prompted-design-v2", deterministicSeed: "mixed-current-tuples" },
        exactSelection: mixed,
      }),
    ).toThrow(
      expect.objectContaining<Partial<BoundedStorefrontSynthesisError>>({
        code: "unsupported-constraint",
      }),
    );
  });
});
