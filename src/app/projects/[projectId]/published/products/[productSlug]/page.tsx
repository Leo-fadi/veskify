import { ProductPreviewClient } from "../../../products/[productSlug]/product-preview-client";

export default async function PublishedProductPage({
  params,
  searchParams,
}: {
  params: Promise<{ projectId: string; productSlug: string }>;
  searchParams?: Promise<{ "p9-05b-session"?: string }>;
}) {
  const { projectId, productSlug } = await params;
  const sessionId = (await searchParams)?.["p9-05b-session"];
  return (
    <ProductPreviewClient
      productId={projectId}
      productSlug={productSlug}
      publishedSessionId={projectId === "project_lumo_fresh" ? sessionId : undefined}
      renderTarget="published"
      snapshotKind="published"
    />
  );
}
