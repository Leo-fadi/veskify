import type { ApprovedGenerationAsset } from "./approved-asset-context";
import type {
  ApprovedAssetAffinity,
  ApprovedAssetPlacementPurpose,
  ApprovedAssetReusePolicy,
} from "@/domain/storefront";

export type ApprovedAssetPlacementRequest = Readonly<{
  purpose: ApprovedAssetPlacementPurpose;
  acceptedRoles: readonly ApprovedGenerationAsset["role"][];
  compatibleRoles?: readonly ApprovedGenerationAsset["role"][];
  collectionId?: string;
  viewport?: "mobile" | "tablet" | "desktop" | "wide";
}>;

export type ApprovedAssetReuseLedger = Map<string, number>;

export type ResolvedApprovedAssetPlacement = Readonly<{
  asset: ApprovedGenerationAsset;
  affinity: ApprovedAssetAffinity;
  reusePolicy: ApprovedAssetReusePolicy;
  reuseCount: number;
  responsivePair?: ApprovedGenerationAsset;
}>;

const defaultPurposeByRole: Readonly<
  Record<ApprovedGenerationAsset["role"], ApprovedAssetPlacementPurpose>
> = {
  logo: "brand-identity",
  heroDesktop: "hero-primary",
  heroMobile: "hero-primary",
  collectionImage: "collection-card",
  productMainImage: "collection-card",
  productAlternativeImage: "collection-card",
  editorialImage: "editorial-story",
  supportingContentImage: "content-support",
  iconDecorative: "decorative",
};

const defaultReuseByRole: Readonly<
  Record<ApprovedGenerationAsset["role"], ApprovedAssetReusePolicy>
> = {
  logo: "identity-reusable",
  heroDesktop: "unique-high-salience",
  heroMobile: "unique-high-salience",
  collectionImage: "unique-high-salience",
  productMainImage: "unique-high-salience",
  productAlternativeImage: "unique-high-salience",
  editorialImage: "bounded-editorial",
  supportingContentImage: "bounded-editorial",
  iconDecorative: "decorative-reusable",
};

const reuseLimit: Readonly<Record<ApprovedAssetReusePolicy, number>> = {
  "unique-high-salience": 1,
  "bounded-editorial": 2,
  "identity-reusable": 2,
  "decorative-reusable": 8,
};

export function approvedAssetReuseLimit(policy: ApprovedAssetReusePolicy): number {
  return reuseLimit[policy];
}

const compatiblePurposes: Readonly<
  Record<ApprovedAssetPlacementPurpose, readonly ApprovedAssetPlacementPurpose[]>
> = {
  "brand-identity": ["brand-identity"],
  "hero-primary": ["hero-primary"],
  "campaign-primary": ["campaign-primary", "collection-campaign"],
  "editorial-story": ["editorial-story", "content-support"],
  "collection-card": ["collection-card"],
  "collection-campaign": ["collection-campaign", "campaign-primary"],
  "content-support": ["content-support", "editorial-story"],
  decorative: ["decorative"],
};

export function approvedAssetPlacementPurposeForTarget(
  input: Readonly<{
    component: string;
    assetSlotId: string;
  }>,
): ApprovedAssetPlacementPurpose {
  if (input.component === "header" && input.assetSlotId === "brandLogo") {
    return "brand-identity";
  }
  if (input.component === "homepageHero") return "hero-primary";
  if (input.component === "homepagePromotion") return "campaign-primary";
  if (
    input.component === "homepageCampaign" ||
    input.component === "homepageFeaturedCollections" ||
    input.component === "homepageCollectionNavigation"
  ) {
    return "collection-campaign";
  }
  if (input.component === "contentSupport") return "content-support";
  if (input.component === "dynamicCollectionCommerce") return "collection-card";
  if (input.component === "homepageEditorial" || input.component === "brandStory") {
    return "editorial-story";
  }
  return "decorative";
}

export function approvedAssetPlacementAuthority(asset: ApprovedGenerationAsset) {
  return (
    asset.presentation.placementAuthority ?? {
      purposes: [defaultPurposeByRole[asset.role]],
      reusePolicy: defaultReuseByRole[asset.role],
      responsiveSourceGroupId: null,
      viewportApplicability: ["mobile", "tablet", "desktop", "wide"] as const,
      collectionIds: [] as const,
      priority: 0,
    }
  );
}

function affinityFor(
  asset: ApprovedGenerationAsset,
  request: ApprovedAssetPlacementRequest,
): ApprovedAssetAffinity | null {
  const authority = approvedAssetPlacementAuthority(asset);
  const exactRole = request.acceptedRoles.includes(asset.role);
  const compatibleRole = request.compatibleRoles?.includes(asset.role) ?? false;
  if (!exactRole && !compatibleRole) return null;
  if (
    request.collectionId &&
    authority.collectionIds.length > 0 &&
    !authority.collectionIds.includes(request.collectionId)
  ) {
    return null;
  }
  if (request.viewport && !authority.viewportApplicability.includes(request.viewport)) return null;
  const exactPurpose = authority.purposes.includes(request.purpose);
  const compatiblePurpose = authority.purposes.some((purpose) =>
    compatiblePurposes[request.purpose].includes(purpose),
  );
  if (exactRole && exactPurpose) return "exact-role-exact-purpose";
  if (exactRole && compatiblePurpose) return "exact-role-compatible-purpose";
  if (compatibleRole && exactPurpose) return "compatible-role-exact-purpose";
  if (compatibleRole && compatiblePurpose) return "compatible-fallback";
  return null;
}

const affinityOrder: readonly ApprovedAssetAffinity[] = [
  "exact-role-exact-purpose",
  "exact-role-compatible-purpose",
  "compatible-role-exact-purpose",
  "compatible-fallback",
];

export function resolveApprovedAssetPlacement(
  input: Readonly<{
    assets: readonly ApprovedGenerationAsset[];
    request: ApprovedAssetPlacementRequest;
    reuseLedger: ApprovedAssetReuseLedger;
  }>,
): ResolvedApprovedAssetPlacement | null {
  const candidates = input.assets
    .flatMap((asset) => {
      const affinity = affinityFor(asset, input.request);
      if (!affinity) return [];
      const authority = approvedAssetPlacementAuthority(asset);
      const reuseCount = input.reuseLedger.get(asset.assetId) ?? 0;
      if (reuseCount >= reuseLimit[authority.reusePolicy]) return [];
      return [{ asset, affinity, authority, reuseCount }];
    })
    .sort(
      (left, right) =>
        affinityOrder.indexOf(left.affinity) - affinityOrder.indexOf(right.affinity) ||
        left.reuseCount - right.reuseCount ||
        right.authority.priority - left.authority.priority ||
        left.asset.assetId.localeCompare(right.asset.assetId),
    );
  const selected = candidates[0];
  if (!selected) return null;
  input.reuseLedger.set(selected.asset.assetId, selected.reuseCount + 1);
  const groupId = selected.authority.responsiveSourceGroupId;
  const responsivePair =
    selected.asset.role === "heroDesktop" && groupId
      ? input.assets
          .filter((asset) => {
            const authority = approvedAssetPlacementAuthority(asset);
            return (
              asset.role === "heroMobile" &&
              authority.responsiveSourceGroupId === groupId &&
              authority.viewportApplicability.includes("mobile")
            );
          })
          .sort(
            (left, right) =>
              approvedAssetPlacementAuthority(right).priority -
                approvedAssetPlacementAuthority(left).priority ||
              left.assetId.localeCompare(right.assetId),
          )[0]
      : undefined;
  if (responsivePair) {
    input.reuseLedger.set(
      responsivePair.assetId,
      (input.reuseLedger.get(responsivePair.assetId) ?? 0) + 1,
    );
  }
  return {
    asset: selected.asset,
    affinity: selected.affinity,
    reusePolicy: selected.authority.reusePolicy,
    reuseCount: selected.reuseCount,
    ...(responsivePair ? { responsivePair } : {}),
  };
}
