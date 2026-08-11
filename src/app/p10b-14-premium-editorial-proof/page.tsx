import { resolveDynamicCommerceRoutePage } from "@/application/dynamic-commerce-routes";
import { createP10B14PremiumEditorialFixture } from "@/data/demo/p10b-14-premium-editorial";
import { P10B14PremiumEditorialProofClient } from "./proof-client";

export default async function P10B14PremiumEditorialProofPage({
  searchParams,
}: {
  searchParams: Promise<{ locale?: string; route?: string; target?: string }>;
}) {
  const query = await searchParams;
  const route = query.route ?? "/";
  const locale = query.locale === "fi" ? "fi" : "en";
  const target = ["proposal", "editor", "preview", "published"].includes(query.target ?? "")
    ? (query.target as "proposal" | "editor" | "preview" | "published")
    : "preview";
  const proof = createP10B14PremiumEditorialFixture();
  const dynamicRoute = proof.slice.snapshot.dynamicCommercePresentation?.routeInventory.find(
    (candidate) => candidate.route === route,
  );
  const isDynamicCommercePath =
    route === "/search" || route.startsWith("/collections/") || route.startsWith("/products/");
  const page = dynamicRoute
    ? resolveDynamicCommerceRoutePage({
        snapshot: proof.slice.snapshot,
        catalogue: proof.fixture.aggregate.catalogue,
        routeId: dynamicRoute.id,
      }).page
    : proof.slice.snapshot.dynamicCommercePresentation && isDynamicCommercePath
      ? undefined
      : proof.slice.snapshot.pages.find((candidate) => candidate.slug === route);
  if (!page) throw new Error(`Unknown P10B-14 proof route: ${route}`);
  return (
    <P10B14PremiumEditorialProofClient
      aggregate={proof.fixture.aggregate}
      evidenceReferences={proof.approvedEvidenceReferences}
      locale={locale}
      page={page}
      snapshot={proof.slice.snapshot}
      snapshotFingerprint={proof.slice.snapshotFingerprint}
      target={target}
    />
  );
}
