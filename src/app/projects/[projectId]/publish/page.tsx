import { PublishClient } from "./publish-client";
import { loadP905bLocalDemoEditorSession } from "@/integrations/ai/p9-05b-local-demo-authority.server";

export default async function PublishPage({
  params,
  searchParams,
}: {
  params: Promise<{ projectId: string }>;
  searchParams: Promise<{ "p9-05b-session"?: string; "accepted-receipt"?: string }>;
}) {
  const { projectId } = await params;
  const query = await searchParams;
  const sessionId = query["p9-05b-session"];
  const localDemoBridge =
    projectId === "project_lumo_fresh" && sessionId
      ? await loadP905bLocalDemoEditorSession({ projectId, sessionId }).catch(() => null)
      : null;
  return (
    <PublishClient
      acceptedReceiptId={query["accepted-receipt"]}
      initialAggregate={localDemoBridge?.aggregate}
      projectId={projectId}
      localDemoSession={
        localDemoBridge
          ? {
              sessionId: localDemoBridge.sessionId,
              authoritativeRevision: localDemoBridge.authoritativeRevision,
            }
          : undefined
      }
    />
  );
}
