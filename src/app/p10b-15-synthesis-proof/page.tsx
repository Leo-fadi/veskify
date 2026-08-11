import { resolveDynamicCommerceRoutePage } from "@/application/dynamic-commerce-routes";
import { P10B15_REPRESENTATIVE_INTENTS } from "@/data/demo/p10b-15-bounded-synthesis";
import { createP10B15BoundedSynthesisFixture } from "@/data/demo/p10b-15-bounded-synthesis";
import { P10B15SynthesisProofClient } from "./proof-client";

export default async function P10B15SynthesisProofPage({
  searchParams,
}: {
  searchParams: Promise<{ intent?: string; locale?: string; route?: string; target?: string }>;
}) {
  const query = await searchParams;
  const intent = P10B15_REPRESENTATIVE_INTENTS.includes(
    query.intent as (typeof P10B15_REPRESENTATIVE_INTENTS)[number],
  )
    ? (query.intent as (typeof P10B15_REPRESENTATIVE_INTENTS)[number])
    : "editorial-led";
  const route = query.route ?? "/";
  const locale = query.locale === "fi" ? "fi" : "en";
  const target = ["proposal", "editor", "preview", "published"].includes(query.target ?? "")
    ? (query.target as "proposal" | "editor" | "preview" | "published")
    : "preview";
  const proof = createP10B15BoundedSynthesisFixture();
  const outcome = proof.outcomes[intent];
  const dynamicRoute =
    outcome.materialization.snapshot.dynamicCommercePresentation?.routeInventory.find(
      (candidate) => candidate.route === route,
    );
  const isDynamicCommercePath =
    route === "/search" || route.startsWith("/collections/") || route.startsWith("/products/");
  const page = dynamicRoute
    ? resolveDynamicCommerceRoutePage({
        snapshot: outcome.materialization.snapshot,
        catalogue: proof.source.fixture.aggregate.catalogue,
        routeId: dynamicRoute.id,
      }).page
    : outcome.materialization.snapshot.dynamicCommercePresentation && isDynamicCommercePath
      ? undefined
      : outcome.materialization.snapshot.pages.find((candidate) => candidate.slug === route);
  if (!page) throw new Error(`Unknown P10B-15 proof route: ${route}`);
  return (
    <P10B15SynthesisProofClient
      aggregate={proof.source.fixture.aggregate}
      evidenceReferences={proof.source.approvedEvidenceReferences}
      intent={intent}
      locale={locale}
      page={page}
      snapshot={outcome.materialization.snapshot}
      snapshotFingerprint={outcome.materialization.snapshotFingerprint}
      synthesisFingerprint={outcome.decision.synthesisFingerprint}
      target={target}
    />
  );
}
