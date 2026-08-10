import {
  createBoundedStorefrontSynthesisDecision,
  executeBoundedStorefrontSynthesis,
  type BoundedStorefrontSynthesisIntent,
  type BoundedStorefrontSynthesisResult,
} from "@/application/bounded-storefront-synthesis";
import { createP10B14PremiumEditorialFixture } from "./p10b-14-premium-editorial";

export const P10B15_REPRESENTATIVE_INTENTS = [
  "editorial-led",
  "commerce-led",
  "restrained-minimal",
] as const satisfies readonly BoundedStorefrontSynthesisIntent[];

export type P10B15RepresentativeIntent = (typeof P10B15_REPRESENTATIVE_INTENTS)[number];

export function createP10B15BoundedSynthesisFixture() {
  const source = createP10B14PremiumEditorialFixture();
  const inputs = {
    planningInput: source.fixture.planningInput,
    siteMapDecision: source.siteMapDecision,
    approvedEvidenceReferences: source.approvedEvidenceReferences,
  };
  const outcomes = Object.fromEntries(
    P10B15_REPRESENTATIVE_INTENTS.map((intent) => {
      const request = { intent, deterministicSeed: "p10b15-representative-v1" } as const;
      const decision = createBoundedStorefrontSynthesisDecision({ ...inputs, request });
      const outcome = executeBoundedStorefrontSynthesis({
        ...inputs,
        request,
        decision,
        pageEvidenceAuthority: source.pageEvidenceAuthority,
        contentFactAuthority: source.contentFactAuthority,
        approvedAssetPresentations: source.fixture.assetPresentations,
      });
      return [intent, outcome];
    }),
  ) as Record<P10B15RepresentativeIntent, BoundedStorefrontSynthesisResult>;

  return Object.freeze({ source, outcomes });
}
