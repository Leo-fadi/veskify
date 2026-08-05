import { CollectionPreviewClient } from "../../../collections/[collectionSlug]/collection-preview-client";

export default async function PublishedCollectionPage({
  params,
}: {
  params: Promise<{ projectId: string; collectionSlug: string }>;
}) {
  const { projectId, collectionSlug } = await params;
  return (
    <CollectionPreviewClient
      collectionSlug={collectionSlug}
      projectId={projectId}
      renderTarget="published"
      snapshotKind="published"
    />
  );
}
