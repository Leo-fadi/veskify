import type { ComponentInstanceV2 } from "@/domain/component-platform";
import { assetRefSchema } from "@/domain/shared";
import type { ApprovedAssetPresentation as StorefrontApprovedAssetPresentation } from "@/domain/storefront";
import type { ApprovedGenerationAssetContext } from "@/application/ai-storefront-generation";

export type ApprovedAssetPresentation = StorefrontApprovedAssetPresentation;

export class ApprovedBrandStoryMediaError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ApprovedBrandStoryMediaError";
  }
}

/**
 * Materializes the URL-bearing presentation reference only after the approved
 * whole-storefront plan has been authorized. Provider-facing asset contexts
 * intentionally remain URL-free; React receives an already validated AssetRef.
 */
export function resolveApprovedBrandStoryMedia(
  componentInput: ComponentInstanceV2,
  approvedAssetContext: ApprovedGenerationAssetContext | null,
  presentations: readonly ApprovedAssetPresentation[],
): ComponentInstanceV2 {
  const component = structuredClone(componentInput);
  if (component.component !== "brandStory") return component;

  const approvedAssetId = component.content.approvedAssetId;
  if (typeof approvedAssetId !== "string") return component;

  const approvedAsset = approvedAssetContext?.assets.find(
    (asset) => asset.assetId === approvedAssetId,
  );
  const assignment = component.assetAssignments.find(
    (candidate) => candidate.slotId === "brandStoryMedia",
  );
  if (
    !approvedAsset ||
    !assignment ||
    assignment.assetId !== approvedAssetId ||
    assignment.role !== approvedAsset.role ||
    approvedAsset.role !== "editorialImage"
  ) {
    throw new ApprovedBrandStoryMediaError(
      "Brand-story media must reference one approved editorial asset assignment.",
    );
  }

  const presentation = presentations.find((candidate) => candidate.assetId === approvedAssetId);
  if (
    !presentation ||
    presentation.role !== approvedAsset.role ||
    presentation.revision !== approvedAsset.revision ||
    presentation.materialFingerprint !== approvedAsset.materialFingerprint ||
    presentation.asset.id !== approvedAssetId ||
    presentation.asset.decorative !== approvedAsset.presentation.decorative
  ) {
    throw new ApprovedBrandStoryMediaError(
      "Brand-story media is unavailable from the approved asset authority.",
    );
  }

  component.content = {
    ...component.content,
    media: assetRefSchema.parse({
      ...presentation.asset,
    }),
  };
  return component;
}
