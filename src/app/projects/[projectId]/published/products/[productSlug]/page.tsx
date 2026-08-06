import { ProductPreviewClient } from "../../../products/[productSlug]/product-preview-client";

export default async function PublishedProductPage({
  params,
}: {
  params: Promise<{ projectId: string; productSlug: string }>;
}) {
  const { projectId, productSlug } = await params;
  return (
    <ProductPreviewClient
      productId={projectId}
      productSlug={productSlug}
      renderTarget="published"
      snapshotKind="published"
    />
  );
}
