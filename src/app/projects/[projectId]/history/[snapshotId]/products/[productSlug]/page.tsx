import { ProductPreviewClient } from "../../../../products/[productSlug]/product-preview-client";

export default async function HistoricalProductPage({
  params,
}: {
  params: Promise<{ projectId: string; snapshotId: string; productSlug: string }>;
}) {
  const { projectId, snapshotId, productSlug } = await params;
  return (
    <ProductPreviewClient
      historicalSnapshotId={snapshotId}
      productId={projectId}
      productSlug={productSlug}
      snapshotKind="history"
    />
  );
}
