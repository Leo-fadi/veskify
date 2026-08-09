"use client";

import { createStorefrontRenderContext } from "@/components/registry";
import { StorefrontCollectionCommerceRoute } from "@/components/storefront/storefront-commerce-route";
import type { CatalogueDisplayModel } from "@/domain/catalogue";
import { brandSystemToCssVariables } from "@/domain/design-system";
import type { PageFactEvidenceReference, StorefrontSnapshot } from "@/domain/storefront";
import type { ProjectAggregate } from "@/services/storage";
import { createCatalogueStorefrontCommerceRouteAdapter } from "@/integrations/storefront-commerce-routes";

export function P10B10CollectionSearchProofClient({
  aggregate,
  catalogue,
  componentAnatomyFingerprint,
  designDnaFingerprint,
  evidenceReferences,
  materializationFingerprint,
  profileId,
  profileVersion,
  snapshot,
  snapshotFingerprint,
  structuralFingerprint,
}: {
  aggregate: ProjectAggregate;
  catalogue: CatalogueDisplayModel;
  componentAnatomyFingerprint: string;
  designDnaFingerprint: string;
  evidenceReferences: readonly PageFactEvidenceReference[];
  materializationFingerprint: string;
  profileId: string;
  profileVersion: string;
  snapshot: StorefrontSnapshot;
  snapshotFingerprint: string;
  structuralFingerprint: string;
}) {
  const page = snapshot.pages.find((candidate) => candidate.type === "collection");
  const collection = catalogue.collections[0];
  if (!page || !collection) return null;
  const presentation = createCatalogueStorefrontCommerceRouteAdapter().collection({
    aggregate,
    snapshot,
    page,
    collection,
  });
  if (!presentation) return null;
  const context = createStorefrontRenderContext({
    activeLocale: "en",
    primaryLocale: "en",
    enabledLocales: ["en", "fi"],
    catalogue,
    snapshot,
    renderTarget: "preview",
    evidenceReferences,
  });
  return (
    <main
      data-component-anatomy-fingerprint={componentAnatomyFingerprint}
      data-design-dna-fingerprint={designDnaFingerprint}
      data-materialization-fingerprint={materializationFingerprint}
      data-p10b-10-collection-profile={profileId}
      data-profile-version={profileVersion}
      data-shared-frame-profile={snapshot.sharedFrame!.profileId}
      data-snapshot-fingerprint={snapshotFingerprint}
      data-structural-fingerprint={structuralFingerprint}
      style={brandSystemToCssVariables(snapshot.brandSystem)}
    >
      <StorefrontCollectionCommerceRoute
        activeLocale="en"
        context={context}
        onFilterIntent={() => undefined}
        onNavigateCollection={() => undefined}
        onNavigateProduct={() => undefined}
        onSortIntent={() => undefined}
        page={page}
        presentation={presentation}
        primaryLocale="en"
        target="preview"
      />
    </main>
  );
}
