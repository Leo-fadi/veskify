import { CollectionPreviewClient } from "./collection-preview-client";

export default async function CollectionPage({
  params,
}: {
  params: Promise<{ projectId: string; collectionSlug: string }>;
}) {
  const { projectId, collectionSlug } = await params;
  return <CollectionPreviewClient projectId={projectId} collectionSlug={collectionSlug} />;
}
