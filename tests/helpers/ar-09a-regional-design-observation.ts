import { canonicalValueFingerprint } from "@/domain/storefront";
import {
  P10B15_REPRESENTATIVE_INTENTS,
  createP10B15BoundedSynthesisFixture,
} from "@/data/demo/p10b-15-bounded-synthesis";

/**
 * Captures the three retained base executions without deriving expectations
 * from a future regional-preference candidate.
 */
export function observeAr09ALegacyBehavior() {
  const fixture = createP10B15BoundedSynthesisFixture();
  return Object.fromEntries(
    P10B15_REPRESENTATIVE_INTENTS.map((intent) => {
      const outcome = fixture.outcomes[intent];
      return [
        intent,
        {
          decisionFingerprint: outcome.decision.synthesisFingerprint,
          planFingerprint: outcome.materialization.plan.fingerprint,
          proposalFingerprint: canonicalValueFingerprint(outcome.materialization.proposal),
          snapshotFingerprint: outcome.materialization.snapshotFingerprint,
          protectedCommerceFingerprint: canonicalValueFingerprint(
            outcome.materialization.planningInput.catalogue,
          ),
          inputFingerprint: canonicalValueFingerprint({
            planningInput: fixture.source.fixture.planningInput,
            siteMapDecision: fixture.source.siteMapDecision,
          }),
        },
      ];
    }),
  );
}
