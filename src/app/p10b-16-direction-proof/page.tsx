import { resolveDynamicCommerceRoutePage } from "@/application/dynamic-commerce-routes";
import {
  P10B16_REPRESENTATIVE_DIRECTION_IDS,
  createP10B16RepresentativeAuthority,
  createP10B16RepresentativeOutcome,
} from "@/data/demo/p10b-16-coordinated-directions";
import { P10B15SynthesisProofClient } from "../p10b-15-synthesis-proof/proof-client";

export default async function P10B16DirectionProofPage({
  searchParams,
}: {
  searchParams: Promise<{
    direction?: string;
    alternative?: string;
    locale?: string;
    route?: string;
  }>;
}) {
  const query = await searchParams;
  const directionId = P10B16_REPRESENTATIVE_DIRECTION_IDS.includes(
    query.direction as (typeof P10B16_REPRESENTATIVE_DIRECTION_IDS)[number],
  )
    ? (query.direction as (typeof P10B16_REPRESENTATIVE_DIRECTION_IDS)[number])
    : "premium-editorial";
  const alternative = Math.min(2, Math.max(0, Number.parseInt(query.alternative ?? "0", 10) || 0));
  const route = query.route ?? "/";
  const locale = query.locale === "fi" ? "fi" : "en";
  const proof = createP10B16RepresentativeAuthority();
  const outcome = createP10B16RepresentativeOutcome(directionId, alternative);
  const snapshot = outcome.synthesis.materialization.snapshot;
  const dynamicRoute = snapshot.dynamicCommercePresentation?.routeInventory.find(
    (candidate) => candidate.route === route,
  );
  const isDynamicCommercePath =
    route === "/search" || route.startsWith("/collections/") || route.startsWith("/products/");
  const page = dynamicRoute
    ? resolveDynamicCommerceRoutePage({
        snapshot,
        catalogue: proof.source.fixture.aggregate.catalogue,
        routeId: dynamicRoute.id,
      }).page
    : snapshot.dynamicCommercePresentation && isDynamicCommercePath
      ? undefined
      : snapshot.pages.find((candidate) => candidate.slug === route);
  if (!page) throw new Error(`Unknown P10B-16 proof route: ${route}`);
  return (
    <P10B15SynthesisProofClient
      aggregate={proof.source.fixture.aggregate}
      evidenceReferences={proof.source.approvedEvidenceReferences}
      intent={directionId}
      locale={locale}
      page={page}
      p10b16={{
        directionId,
        alternative,
        directionFingerprint: outcome.directionFingerprint,
        diversityFingerprint: outcome.diversity.structuralFingerprint,
      }}
      snapshot={snapshot}
      snapshotFingerprint={outcome.synthesis.materialization.snapshotFingerprint}
      synthesisFingerprint={outcome.decision.synthesisFingerprint}
      target="preview"
    />
  );
}
