import { CollectionPreviewClient } from "../../../collections/[collectionSlug]/collection-preview-client";

export default async function PublishedCollectionPage({
  params,
  searchParams,
}: {
  params: Promise<{ projectId: string; collectionSlug: string }>;
  searchParams?: Promise<{ "p9-05b-session"?: string }>;
}) {
  const { projectId, collectionSlug } = await params;
  const sessionId = (await searchParams)?.["p9-05b-session"];
  return (
    <CollectionPreviewClient
      collectionSlug={collectionSlug}
      projectId={projectId}
      publishedSessionId={projectId === "project_lumo_fresh" ? sessionId : undefined}
      renderTarget="published"
      snapshotKind="published"
    />
  );
}
