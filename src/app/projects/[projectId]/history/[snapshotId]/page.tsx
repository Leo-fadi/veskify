import { ProjectPreviewClient } from "../../project-preview-client";

export default async function HistoricalPreviewPage({
  params,
}: {
  params: Promise<{ projectId: string; snapshotId: string }>;
}) {
  const { projectId, snapshotId } = await params;
  return (
    <ProjectPreviewClient
      historicalSnapshotId={snapshotId}
      projectId={projectId}
      snapshotKind="history"
    />
  );
}
