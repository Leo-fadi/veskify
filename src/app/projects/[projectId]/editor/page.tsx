import { ProjectEditorClient } from "./project-editor-client";

export default async function ProjectEditorPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  return <ProjectEditorClient projectId={projectId} />;
}
