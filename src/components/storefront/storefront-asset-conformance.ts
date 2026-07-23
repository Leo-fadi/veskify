import type {
  ComponentInstanceV2,
  ComponentProjectionContext,
  StorefrontAssetMetadata,
} from "@/domain/component-platform";

export type RouteUsedAssetRole = StorefrontAssetMetadata["role"];

export function validateRouteUsedAssetConformance({
  instance,
  projection,
  requiredAssets,
  boundary,
}: {
  instance: ComponentInstanceV2;
  projection: ComponentProjectionContext;
  requiredAssets: ReadonlyMap<string, RouteUsedAssetRole>;
  boundary: string;
}): ReadonlyMap<string, StorefrontAssetMetadata> {
  const assignedAssets = new Map(
    instance.assetAssignments.map((assignment) => [assignment.assetId, assignment.role]),
  );
  const assetMetadata = new Map(projection.assets.map((asset) => [asset.assetId, asset]));

  for (const [assetId, expectedRole] of requiredAssets) {
    const metadata = assetMetadata.get(assetId);
    if (!metadata) throw new Error(`${boundary} media is missing from inventory: ${assetId}.`);
    if (metadata.approvalStatus !== "approved") {
      throw new Error(`${boundary} media is not approved: ${assetId}.`);
    }
    if (metadata.role !== expectedRole) {
      throw new Error(`${boundary} media role does not match metadata: ${assetId}.`);
    }
    if (assignedAssets.size > 0 && assignedAssets.get(assetId) !== expectedRole) {
      throw new Error(`Missing canonical ${boundary} asset assignment: ${assetId}.`);
    }
  }

  if (assignedAssets.size > 0) {
    for (const assetId of assignedAssets.keys()) {
      if (!requiredAssets.has(assetId)) {
        throw new Error(`Unused ${boundary} asset assignment is not permitted: ${assetId}.`);
      }
    }
  }

  return assetMetadata;
}
