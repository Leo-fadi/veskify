import { HistoryClient } from "./history-client";

export default async function HistoryPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  return <HistoryClient projectId={projectId} />;
}
