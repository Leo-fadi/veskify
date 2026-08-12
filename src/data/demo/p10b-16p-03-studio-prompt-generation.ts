import { executeCoordinatedDirection } from "@/application/bounded-storefront-synthesis";
import { validateCurrentDynamicCommercePresentationAuthority } from "@/application/dynamic-commerce-routes";
import { wholeStorefrontPlanningInputSchema } from "@/application/whole-storefront-generation-plan";
import { validateRegisteredSnapshot } from "@/components/registry";
import { createP10B16LRawKarvonenAcceptanceFixture } from "@/data/demo/p10b-16l-live-provider-acceptance";
import { storefrontSnapshotSchema, type StorefrontSnapshot } from "@/domain/storefront";
import type { ProjectAggregate } from "@/services/storage/project-repository";
import { validateProjectAggregate } from "@/services/storage/repository-validation";

export {
  P10B16P03_CATALOGUE_ID,
  P10B16P03_DRAFT_ID,
  P10B16P03_PROJECT_ID,
  P10B16P03_PUBLISHED_ID,
} from "@/data/demo/p10b-16p-03-studio-identity";

function rawSnapshotWithCurrentDynamicCommerceAuthority(
  snapshot: StorefrontSnapshot,
  dynamicCommercePresentation: NonNullable<StorefrontSnapshot["dynamicCommercePresentation"]>,
): StorefrontSnapshot {
  const raw = storefrontSnapshotSchema.parse({
    ...structuredClone(snapshot),
    dynamicCommercePresentation: structuredClone(dynamicCommercePresentation),
  });
  validateCurrentDynamicCommercePresentationAuthority(raw);
  return raw;
}

/**
 * Normal Storefront Studio input for P10B-16P-03.
 *
 * Merchant, catalogue, evidence and page-set authority come directly from the retained P10B-16L
 * Karvonen fixture. A deterministic synthesis is used only to obtain the current compact
 * dynamic-commerce authority required by Prompted Storefront Design Request V2. Every generated
 * page, selected frame, navigation item and Design DNA choice is discarded: the browser/server
 * aggregate remains one home page with only the two neutral header/footer source sections required
 * by the canonical shared-frame promoter, the neutral legacy BrandSystem and no proposal state.
 */
function buildP10B16P03RawKarvonenStudioFixture() {
  const source = createP10B16LRawKarvonenAcceptanceFixture();
  const authoritySource = executeCoordinatedDirection({
    planningInput: source.executionPlanningInput,
    siteMapDecision: source.siteMapDecision,
    approvedEvidenceReferences: source.approvedEvidenceReferences,
    pageEvidenceAuthority: source.pageEvidenceAuthority,
    contentFactAuthority: source.contentFactAuthority,
    approvedAssetPresentations: source.approvedAssetPresentations,
    directionRequest: {
      directionId: "minimal-commerce",
      deterministicSeed: "p10b-16p-03-raw-dynamic-commerce-authority-v1",
    },
  });
  const dynamicCommercePresentation =
    authoritySource.synthesis.materialization.snapshot.dynamicCommercePresentation;
  if (!dynamicCommercePresentation) {
    throw new Error("P10B-16P-03 requires current dynamic-commerce authority.");
  }

  const draft = rawSnapshotWithCurrentDynamicCommerceAuthority(
    source.executionPlanningInput.draft,
    dynamicCommercePresentation,
  );
  const publishedSource = source.aggregate.snapshots.find(
    ({ id }) => id === source.aggregate.project.publishedSnapshotId,
  );
  if (!publishedSource) throw new Error("P10B-16P-03 requires the raw published baseline.");
  const published = rawSnapshotWithCurrentDynamicCommerceAuthority(
    publishedSource,
    dynamicCommercePresentation,
  );
  validateRegisteredSnapshot(
    draft,
    source.planningInput.catalogue,
    source.aggregate.project.primaryLocale,
    source.aggregate.project.primaryLocale,
    source.aggregate.project.enabledLocales,
  );
  validateRegisteredSnapshot(
    published,
    source.planningInput.catalogue,
    source.aggregate.project.primaryLocale,
    source.aggregate.project.primaryLocale,
    source.aggregate.project.enabledLocales,
  );

  const aggregate: ProjectAggregate = validateProjectAggregate({
    project: structuredClone(source.aggregate.project),
    catalogue: structuredClone(source.aggregate.catalogue),
    // Match the repository's canonical createdAt/id ordering so server and browser consumers
    // observe the same aggregate bytes after IndexedDB reload.
    snapshots: [draft, published],
  });
  const planningInput = wholeStorefrontPlanningInputSchema.parse({
    ...structuredClone(source.executionPlanningInput),
    draft: structuredClone(draft),
  });
  // P10B-16P-02B binds compatibility and request authority to one exact current draft. Do not
  // prepare this input again: a second preparation would create a different trusted projection.
  const executionPlanningInput = wholeStorefrontPlanningInputSchema.parse(
    structuredClone(planningInput),
  );

  return Object.freeze({
    aggregate,
    rawDraft: structuredClone(draft),
    brief: structuredClone(source.brief),
    planningInput,
    executionPlanningInput,
    siteMapDecision: structuredClone(source.siteMapDecision),
    approvedEvidenceReferences: structuredClone(source.approvedEvidenceReferences),
    pageEvidenceAuthority: source.pageEvidenceAuthority,
    contentFactAuthority: source.contentFactAuthority,
    approvedAssetPresentations: structuredClone(source.approvedAssetPresentations),
  });
}

export type P10B16P03RawKarvonenStudioFixture = ReturnType<
  typeof buildP10B16P03RawKarvonenStudioFixture
>;

let cachedFixture: P10B16P03RawKarvonenStudioFixture | undefined;

export function createP10B16P03RawKarvonenStudioFixture(): P10B16P03RawKarvonenStudioFixture {
  cachedFixture ??= buildP10B16P03RawKarvonenStudioFixture();
  return Object.freeze({
    aggregate: structuredClone(cachedFixture.aggregate),
    rawDraft: structuredClone(cachedFixture.rawDraft),
    brief: structuredClone(cachedFixture.brief),
    planningInput: structuredClone(cachedFixture.planningInput),
    executionPlanningInput: structuredClone(cachedFixture.executionPlanningInput),
    siteMapDecision: structuredClone(cachedFixture.siteMapDecision),
    approvedEvidenceReferences: structuredClone(cachedFixture.approvedEvidenceReferences),
    pageEvidenceAuthority: cachedFixture.pageEvidenceAuthority,
    contentFactAuthority: cachedFixture.contentFactAuthority,
    approvedAssetPresentations: structuredClone(cachedFixture.approvedAssetPresentations),
  });
}
