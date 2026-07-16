import { ProjectPreviewClient } from "./project-preview-client";

export default async function ProjectPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  return <ProjectPreviewClient projectId={projectId} />;
}
