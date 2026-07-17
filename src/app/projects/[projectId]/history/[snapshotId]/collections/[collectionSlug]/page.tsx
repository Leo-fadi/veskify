import { CollectionPreviewClient } from "../../../../collections/[collectionSlug]/collection-preview-client";

export default async function HistoricalCollectionPage({
  params,
}: {
  params: Promise<{ projectId: string; snapshotId: string; collectionSlug: string }>;
}) {
  const { projectId, snapshotId, collectionSlug } = await params;
  return (
    <CollectionPreviewClient
      collectionSlug={collectionSlug}
      historicalSnapshotId={snapshotId}
      projectId={projectId}
      snapshotKind="history"
    />
  );
}
