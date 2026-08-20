"use client";

import { createStorefrontRenderContext } from "@/components/registry";
import { renderStorefrontPage } from "@/components/storefront/storefront-page";
import { aurumNordicSeed } from "@/data/seed";
import { brandSystemToCssVariables } from "@/domain/design-system";
import type { P10B12ContentSupportProof } from "@/data/demo/p10b-12-content-support-proof";

export function P10B12ContentSupportProofClient({
  activeLocale,
  catalogueId,
  proof,
}: {
  activeLocale: "en" | "fi";
  catalogueId: "aurum";
  proof: P10B12ContentSupportProof;
}) {
  const page = proof.snapshot.pages.find((candidate) => candidate.id === proof.pageId)!;
  const context = createStorefrontRenderContext({
    activeLocale,
    primaryLocale: "en",
    enabledLocales: ["en", "fi"],
    catalogue: aurumNordicSeed.catalogue,
    snapshot: proof.snapshot,
    renderTarget: "preview",
    evidenceReferences: [proof.document.evidence],
  });
  return (
    <main
      data-p10b-12-content-support-profile={proof.profileId}
      data-structural-fingerprint={proof.structuralFingerprint}
      data-fact-document-fingerprint={proof.document.fingerprint}
      data-page-family={page.pageFamily!.familyId}
      data-active-locale={activeLocale}
      data-approved-media={String(proof.approvedMedia)}
      data-campaign-action-authority={proof.campaignActionAuthority}
      data-shared-frame-profile={proof.snapshot.sharedFrame!.profileId}
      data-catalogue={catalogueId}
      style={brandSystemToCssVariables(proof.snapshot.brandSystem)}
    >
      {renderStorefrontPage(page, context)}
    </main>
  );
}
