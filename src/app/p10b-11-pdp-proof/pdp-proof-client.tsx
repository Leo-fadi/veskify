"use client";

import { createStorefrontRenderContext } from "@/components/registry";
import { StorefrontProductCommerceRoute } from "@/components/storefront/storefront-commerce-route";
import { getCommercialPdpProfile } from "@/application/storefront-templates";
import { brandSystemToCssVariables } from "@/domain/design-system";
import type { PageModel, StorefrontSnapshot } from "@/domain/storefront";
import { createCatalogueStorefrontCommerceRouteAdapter } from "@/integrations/storefront-commerce-routes";
import type { ProjectAggregate } from "@/services/storage";

export function P10B11PdpProofClient({
  aggregate,
  materializationFingerprint,
  productId,
  productPage,
  profileId,
  profileVersion,
  responsiveArchitecture,
  snapshot,
  snapshotFingerprint,
  structuralFingerprint,
}: {
  aggregate: ProjectAggregate;
  materializationFingerprint: string;
  productId: string;
  productPage: PageModel;
  profileId: string;
  profileVersion: string;
  responsiveArchitecture: readonly Readonly<{
    viewport: number;
    transformationIds: readonly string[];
  }>[];
  snapshot: StorefrontSnapshot;
  snapshotFingerprint: string;
  structuralFingerprint: string;
}) {
  const currentAuthority = getCommercialPdpProfile(profileId)?.profile?.commercialProductDetail;
  if (!currentAuthority || currentAuthority.structuralFingerprint !== structuralFingerprint) {
    throw new Error("The PDP proof metadata is not current with the registered profile authority.");
  }
  const product = aggregate.catalogue.products.find((entry) => entry.id === productId);
  if (!product) throw new Error("The commercial PDP proof requires its canonical product.");
  const context = createStorefrontRenderContext({
    activeLocale: "en",
    primaryLocale: "en",
    enabledLocales: ["en", "fi"],
    catalogue: aggregate.catalogue,
    snapshot,
    renderTarget: "preview",
  });
  const presentation = createCatalogueStorefrontCommerceRouteAdapter().product({
    aggregate,
    evidenceReferences: context.evidenceReferences,
    snapshot,
    page: productPage,
    product,
  });
  if (!presentation) throw new Error("The commercial PDP proof could not resolve the PDP route.");
  return (
    <main
      data-materialization-fingerprint={materializationFingerprint}
      data-p10b-11-pdp-profile={profileId}
      data-profile-version={profileVersion}
      data-responsive-viewports={responsiveArchitecture.map((entry) => entry.viewport).join(",")}
      data-snapshot-fingerprint={snapshotFingerprint}
      data-structural-fingerprint={currentAuthority.structuralFingerprint}
      style={brandSystemToCssVariables(snapshot.brandSystem)}
    >
      <StorefrontProductCommerceRoute
        activeLocale="en"
        context={context}
        onPrimaryAction={() => undefined}
        page={productPage}
        presentation={presentation}
        primaryLocale="en"
        target="preview"
      />
    </main>
  );
}
