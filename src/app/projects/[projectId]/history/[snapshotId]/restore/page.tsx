import { RestoreClient } from "./restore-client";

export default async function RestorePage({
  params,
}: {
  params: Promise<{ projectId: string; snapshotId: string }>;
}) {
  const { projectId, snapshotId } = await params;
  return <RestoreClient projectId={projectId} snapshotId={snapshotId} />;
}
