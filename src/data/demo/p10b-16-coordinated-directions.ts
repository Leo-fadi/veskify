import {
  executeCoordinatedDirection,
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

let cachedAuthority: Readonly<{
  source: ReturnType<typeof createP10B14PremiumEditorialFixture>;
  siteMapDecision: ReturnType<typeof createP10B14PremiumEditorialFixture>["siteMapDecision"];
}> | null = null;
const outcomeCache = new Map<CoordinatedStorefrontDirectionId, CoordinatedDirectionResult[]>();

export function createP10B16RepresentativeAuthority() {
  if (cachedAuthority) return cachedAuthority;
  const source = createP10B14PremiumEditorialFixture();
  const siteMapDecision = structuredClone(source.siteMapDecision);
  siteMapDecision.pages = siteMapDecision.pages.map((page) => ({
    ...page,
    required: requiredFamilies.has(page.familyId),
  }));
  cachedAuthority = Object.freeze({ source, siteMapDecision });
  return cachedAuthority;
}

export function createP10B16RepresentativeOutcome(
  directionId: CoordinatedStorefrontDirectionId,
  alternative: number,
): CoordinatedDirectionResult {
  if (!Number.isInteger(alternative) || alternative < 0 || alternative > 2) {
    throw new RangeError("A P10B-16 representative alternative must be 0, 1 or 2.");
  }
  const { source, siteMapDecision } = createP10B16RepresentativeAuthority();
  const cached = outcomeCache.get(directionId) ?? [];
  while (cached.length <= alternative) {
    const outcome = executeCoordinatedDirection({
      planningInput: source.fixture.planningInput,
      siteMapDecision,
      approvedEvidenceReferences: source.approvedEvidenceReferences,
      pageEvidenceAuthority: source.pageEvidenceAuthority,
      contentFactAuthority: source.contentFactAuthority,
      approvedAssetPresentations: source.fixture.assetPresentations,
      directionRequest: { directionId, deterministicSeed: "p10b16-representative-v1" },
      usedDiversityFingerprints: cached.map(({ diversity }) => diversity),
    });
    cached.push(outcome);
    outcomeCache.set(directionId, cached);
  }
  return cached[alternative];
}

export function createP10B16RepresentativeBatch() {
  const { source, siteMapDecision } = createP10B16RepresentativeAuthority();
  const outcomes = Object.fromEntries(
    P10B16_REPRESENTATIVE_DIRECTION_IDS.map((directionId) => [
      directionId,
      Object.freeze(
        [0, 1, 2].map((alternative) => createP10B16RepresentativeOutcome(directionId, alternative)),
      ),
    ]),
  ) as Record<CoordinatedStorefrontDirectionId, readonly CoordinatedDirectionResult[]>;
  return Object.freeze({ source, siteMapDecision: structuredClone(siteMapDecision), outcomes });
}
