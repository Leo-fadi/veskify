"use client";

import {
  compileCommercialSharedFrameSelection,
  currentCommercialSharedFrameSelection,
} from "@/application/commercial-shared-frame";
import { createStorefrontRenderContext } from "@/components/registry";
import { renderStorefrontPage } from "@/components/storefront/storefront-page";
import { aurumNordicSeed, karvonenSeed } from "@/data/seed";
import { brandSystemToCssVariables } from "@/domain/design-system";
import type { Locale } from "@/domain/shared";
import type { CommercialSharedFrameProfileId } from "@/domain/storefront";

export function P10B06FrameProofClient({
  profileId,
  dna,
  locale,
}: {
  profileId: CommercialSharedFrameProfileId;
  dna?: string;
  locale: Locale;
}) {
  const source = structuredClone(aurumNordicSeed.draftSnapshot);
  if (dna === "technical") {
    source.brandSystem = structuredClone(karvonenSeed.draftSnapshot.brandSystem);
  }
  const compiled = compileCommercialSharedFrameSelection({
    snapshot: source,
    catalogue: aurumNordicSeed.catalogue,
    selection: currentCommercialSharedFrameSelection(profileId),
  });
  const homepage = compiled.snapshot.pages.find(({ type }) => type === "home")!;
  const context = createStorefrontRenderContext({
    activeLocale: locale,
    primaryLocale: "en",
    catalogue: aurumNordicSeed.catalogue,
    snapshot: compiled.snapshot,
    renderTarget: "preview",
  });
  return (
    <div
      data-p10b-06-frame-proof={profileId}
      lang={locale}
      style={brandSystemToCssVariables(compiled.snapshot.brandSystem)}
    >
      {renderStorefrontPage(homepage, context)}
    </div>
  );
}
