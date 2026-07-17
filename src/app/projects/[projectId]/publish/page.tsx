import { PublishClient } from "./publish-client";

export default async function PublishPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  return <PublishClient projectId={projectId} />;
}
