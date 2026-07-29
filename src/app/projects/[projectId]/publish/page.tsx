import { PublishClient } from "./publish-client";
import { loadP905bLocalDemoEditorSession } from "@/integrations/ai/p9-05b-local-demo-authority.server";

export default async function PublishPage({
  params,
  searchParams,
}: {
  params: Promise<{ projectId: string }>;
  searchParams: Promise<{ "p9-05b-session"?: string }>;
}) {
  const { projectId } = await params;
  const sessionId = (await searchParams)["p9-05b-session"];
  const localDemoBridge =
    projectId === "project_lumo_fresh" && sessionId
      ? await loadP905bLocalDemoEditorSession({ projectId, sessionId }).catch(() => null)
      : null;
  return (
    <PublishClient
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
