import {
  executeCoordinatedDirectionAlternatives,
  type CoordinatedDirectionResult,
  type CoordinatedStorefrontDirectionId,
} from "@/application/bounded-storefront-synthesis";
import { createP10B14PremiumEditorialFixture } from "./p10b-14-premium-editorial";

export const P10B16_REPRESENTATIVE_DIRECTION_IDS = [
  "premium-editorial",
  "modern-technical",
  "minimal-commerce",
] as const satisfies readonly CoordinatedStorefrontDirectionId[];

const requiredFamilies = new Set([
  "home",
  "collection",
  "search-results",
  "product-detail",
  "cart",
  "checkout",
  "no-results",
  "empty-state",
  "error-state",
  "not-found",
]);

export function createP10B16RepresentativeBatch() {
  const source = createP10B14PremiumEditorialFixture();
  const siteMapDecision = structuredClone(source.siteMapDecision);
  siteMapDecision.pages = siteMapDecision.pages.map((page) => ({
    ...page,
    required: requiredFamilies.has(page.familyId),
  }));
  const outcomes = Object.fromEntries(
    P10B16_REPRESENTATIVE_DIRECTION_IDS.map((directionId) => [
      directionId,
      executeCoordinatedDirectionAlternatives({
        planningInput: source.fixture.planningInput,
        siteMapDecision,
        approvedEvidenceReferences: source.approvedEvidenceReferences,
        pageEvidenceAuthority: source.pageEvidenceAuthority,
        contentFactAuthority: source.contentFactAuthority,
        approvedAssetPresentations: source.fixture.assetPresentations,
        directionRequest: { directionId, deterministicSeed: "p10b16-representative-v1" },
        count: 3,
      }),
    ]),
  ) as Record<CoordinatedStorefrontDirectionId, readonly CoordinatedDirectionResult[]>;
  return Object.freeze({ source, siteMapDecision: structuredClone(siteMapDecision), outcomes });
}
