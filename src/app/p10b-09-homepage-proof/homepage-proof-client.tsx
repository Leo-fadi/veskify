"use client";

import { createStorefrontRenderContext } from "@/components/registry";
import { renderStorefrontPage } from "@/components/storefront/storefront-page";
import type { CatalogueDisplayModel } from "@/domain/catalogue";
import { brandSystemToCssVariables } from "@/domain/design-system";
import type { PageFactEvidenceReference, StorefrontSnapshot } from "@/domain/storefront";

export function P10B09HomepageProofClient({
  catalogue,
  componentAnatomyFingerprint,
  designDnaFingerprint,
  evidenceReferences,
  profileId,
  profileVersion,
  productCardAnatomyId,
  materializationFingerprint,
  snapshot,
  snapshotFingerprint,
  structuralFingerprint,
}: {
  catalogue: CatalogueDisplayModel;
  componentAnatomyFingerprint: string;
  designDnaFingerprint: string;
  evidenceReferences: readonly PageFactEvidenceReference[];
  profileId: string;
  profileVersion: string;
  productCardAnatomyId: string;
  materializationFingerprint: string;
  snapshot: StorefrontSnapshot;
  snapshotFingerprint: string;
  structuralFingerprint: string;
}) {
  const homepage = snapshot.pages.find((page) => page.type === "home")!;
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
      data-p10b-09-homepage-profile={profileId}
      data-profile-version={profileVersion}
      data-structural-fingerprint={structuralFingerprint}
      data-materialization-fingerprint={materializationFingerprint}
      data-component-anatomy-fingerprint={componentAnatomyFingerprint}
      data-product-card-anatomy={productCardAnatomyId}
      data-design-dna-fingerprint={designDnaFingerprint}
      data-shared-frame-profile={snapshot.sharedFrame!.profileId}
      data-snapshot-fingerprint={snapshotFingerprint}
      style={brandSystemToCssVariables(snapshot.brandSystem)}
    >
      {renderStorefrontPage(homepage, context)}
    </main>
  );
}
