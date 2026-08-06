import { ProjectPreviewClient } from "../project-preview-client";

export default async function PublishedProjectPage({
  params,
  searchParams,
}: {
  params: Promise<{ projectId: string }>;
  searchParams: Promise<{ "p9-05b-session"?: string }>;
}) {
  const { projectId } = await params;
  const sessionId = (await searchParams)["p9-05b-session"];
  return (
    <ProjectPreviewClient
      projectId={projectId}
      publishedSessionId={projectId === "project_lumo_fresh" ? sessionId : undefined}
      snapshotKind="published"
    />
  );
}
