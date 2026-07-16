import { ProductPreviewClient } from "./product-preview-client";

export default async function ProductPage({
  params,
}: {
  params: Promise<{ projectId: string; productSlug: string }>;
}) {
  const { projectId, productSlug } = await params;
  return <ProductPreviewClient productId={projectId} productSlug={productSlug} />;
}
