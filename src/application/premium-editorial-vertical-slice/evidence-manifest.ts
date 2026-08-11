import { canonicalValueFingerprint, canonicalValueString } from "@/domain/storefront";
import { canonicalProductTypePresentationId } from "@/domain/product-card";
import type { P10B14PremiumEditorialSlice } from "./vertical-slice";

export type P10B14BrowserEvidence = Readonly<{
  route: string;
  viewport: 375 | 768 | 1024 | 1440;
  reference: string;
  fingerprint: string;
}>;

export type P10B14CompleteStorefrontEvidenceManifest = Readonly<{
  version: "1.0.0";
  fixtureId: string;
  merchantProjectId: string;
  snapshotFingerprint: string;
  siteMapFingerprint: string;
  designDnaFingerprint: string;
  frame: Readonly<{ profileId: string; authorityFingerprint: string }>;
  pageProfiles: readonly Readonly<{ route: string; familyId: string; profileId: string }>[];
  componentSelections: readonly string[];
  approvedEvidenceRefs: readonly string[];
  approvedAssetRefs: readonly string[];
  commerceRefs: readonly string[];
  publication: Readonly<{ versionId: string; artifactId: string }>;
  browserEvidence: readonly P10B14BrowserEvidence[];
  humanReview: Readonly<{ reviewId: string; fingerprint: string; outcome: "passed" }>;
  fingerprint: string;
}>;

export function createP10B14CompleteStorefrontEvidenceManifest(
  input: Readonly<{
    fixtureId: string;
    slice: P10B14PremiumEditorialSlice;
    publication: { versionId: string; artifactId: string };
    browserEvidence: readonly P10B14BrowserEvidence[];
    humanReview: { reviewId: string; fingerprint: string; outcome: "passed" };
  }>,
): P10B14CompleteStorefrontEvidenceManifest {
  const { snapshot, planningInput } = input.slice;
  const frame = snapshot.sharedFrame;
  const designDna = snapshot.brandSystem.designDna;
  if (!frame || !designDna) {
    throw new Error("P10B-14 evidence requires canonical frame and Design DNA authority.");
  }
  const designDnaFingerprint = `design-dna-${canonicalValueFingerprint(designDna)}`;
  const dynamicAuthority = snapshot.dynamicCommercePresentation;
  const dynamicRouteProfiles = (dynamicAuthority?.routeInventory ?? []).map((route) => {
    const archetype =
      route.kind === "collection"
        ? dynamicAuthority!.collectionSearchArchetypes.find(
            ({ id }) =>
              id ===
              dynamicAuthority!.collectionRouteMappings.find(({ routeId }) => routeId === route.id)
                ?.archetypeId,
          )
        : route.kind === "search"
          ? dynamicAuthority!.collectionSearchArchetypes.find(
              ({ id }) => id === dynamicAuthority!.searchArchetypeId,
            )
          : (() => {
              const product = planningInput.catalogue.products.find(
                ({ id }) => id === route.productId,
              );
              const archetypeId = product
                ? dynamicAuthority!.productTypeMappings.find(
                    ({ productTypeId }) =>
                      productTypeId === canonicalProductTypePresentationId(product.productType),
                  )?.archetypeId
                : undefined;
              return dynamicAuthority!.productDetailArchetypes.find(
                ({ id }) =>
                  id === (archetypeId ?? dynamicAuthority!.fallbacks.productDetailArchetypeId),
              );
            })();
    if (!archetype) {
      throw new Error(`P10B-14 evidence cannot resolve dynamic route ${route.id}.`);
    }
    return {
      route: route.route,
      familyId:
        route.kind === "product"
          ? "product-detail"
          : route.kind === "search"
            ? "search-results"
            : "collection",
      profileId: archetype.profile.profileId,
    };
  });
  const material = {
    version: "1.0.0" as const,
    fixtureId: input.fixtureId,
    merchantProjectId: snapshot.projectId,
    snapshotFingerprint: input.slice.snapshotFingerprint,
    siteMapFingerprint: input.slice.siteMapFingerprint,
    designDnaFingerprint,
    frame: { profileId: frame.profileId, authorityFingerprint: frame.authorityFingerprint },
    pageProfiles: [
      ...snapshot.pages.map((page) => ({
        route: page.slug,
        familyId: page.pageFamily!.familyId,
        profileId: page.pageFamily!.profileId,
      })),
      ...dynamicRouteProfiles,
    ].sort((left, right) => left.route.localeCompare(right.route)),
    componentSelections: [
      ...new Set([
        ...snapshot.pages.flatMap((page) =>
          page.sections.map((section) => {
            const cardVariant = section.props.cardVariant;
            return `${page.slug}:${section.component}:${section.variant}:${typeof cardVariant === "string" ? cardVariant : ""}`;
          }),
        ),
        ...(dynamicAuthority
          ? [
              ...dynamicAuthority.collectionSearchArchetypes,
              ...dynamicAuthority.productDetailArchetypes,
            ].flatMap((archetype) =>
              archetype.componentPresentations.map((presentation) => {
                const cardVariant = presentation.props.cardVariant;
                return `archetype:${archetype.id}:${presentation.component}:${presentation.variant}:${typeof cardVariant === "string" ? cardVariant : ""}`;
              }),
            )
          : []),
      ]),
    ].sort(),
    approvedEvidenceRefs: [
      ...new Set([
        `${planningInput.brief.id}:${planningInput.brief.revision}:${planningInput.brief.approvedEvidenceFingerprint}`,
        ...snapshot.pages.flatMap((page) =>
          (page.pageFamily?.evidenceReferences ?? []).map(
            (reference) =>
              `${reference.authorityId}:${reference.revision}:${reference.approvalFingerprint}`,
          ),
        ),
      ]),
    ].sort(),
    approvedAssetRefs: [
      ...new Set(
        snapshot.pages.flatMap((page) =>
          page.sections.flatMap((section) =>
            (section.approvedAssetPlacements ?? []).map(
              (placement) =>
                `${placement.assetId}:${placement.assetRevision}:${placement.materialFingerprint}`,
            ),
          ),
        ),
      ),
    ].sort(),
    commerceRefs: [
      planningInput.catalogue.id,
      ...planningInput.catalogue.collections.map(({ id }) => id),
      ...planningInput.catalogue.products.map(({ id }) => id),
    ].sort(),
    publication: structuredClone(input.publication),
    browserEvidence: [...input.browserEvidence]
      .map((entry) => structuredClone(entry))
      .sort(
        (left, right) => left.route.localeCompare(right.route) || left.viewport - right.viewport,
      ),
    humanReview: structuredClone(input.humanReview),
  };
  return Object.freeze({
    ...material,
    fingerprint: `p10b14-manifest-${canonicalValueFingerprint(
      JSON.parse(canonicalValueString(material)),
    )}`,
  });
}
