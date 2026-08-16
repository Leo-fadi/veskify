import { SearchPreviewClient } from "../../../search/search-preview-client";
import type { StorefrontSearchRouteParameters } from "../../../search/search-route-parameters";

export default async function HistoricalSearchPage({
  params,
  searchParams,
}: {
  params: Promise<{ projectId: string; snapshotId: string }>;
  searchParams: Promise<StorefrontSearchRouteParameters>;
}) {
  const { projectId, snapshotId } = await params;
  return (
    <SearchPreviewClient
      historicalSnapshotId={snapshotId}
      projectId={projectId}
      searchParameters={await searchParams}
      snapshotKind="history"
    />
  );
}
