import { notFound } from "next/navigation";
import { SearchPreviewClient } from "../../search/search-preview-client";
import {
  parseStorefrontSearchContextParameter,
  type StorefrontSearchRouteParameters,
} from "../../search/search-route-parameters";

export default async function PublishedSearchPage({
  params,
  searchParams,
}: {
  params: Promise<{ projectId: string }>;
  searchParams: Promise<StorefrontSearchRouteParameters>;
}) {
  const { projectId } = await params;
  const query = await searchParams;
  const session = parseStorefrontSearchContextParameter(query, "p9-05b-session");
  if (!session.valid) notFound();
  const sessionId = session.value;
  return (
    <SearchPreviewClient
      projectId={projectId}
      publishedSessionId={projectId === "project_lumo_fresh" ? sessionId : undefined}
      renderTarget="published"
      searchParameters={query}
      snapshotKind="published"
    />
  );
}
