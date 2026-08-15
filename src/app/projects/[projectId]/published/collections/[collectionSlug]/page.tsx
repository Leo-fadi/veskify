import { CollectionPreviewClient } from "../../../collections/[collectionSlug]/collection-preview-client";
import { notFound } from "next/navigation";
import { parsePreviewLocaleParameter, type PreviewRouteParameter } from "../../../preview-mode";

export default async function PublishedCollectionPage({
  params,
  searchParams,
}: {
  params: Promise<{ projectId: string; collectionSlug: string }>;
  searchParams?: Promise<{ "p9-05b-session"?: string; locale?: PreviewRouteParameter }>;
}) {
  const { projectId, collectionSlug } = await params;
  const query = await searchParams;
  const sessionId = query?.["p9-05b-session"];
  const locale = parsePreviewLocaleParameter(query?.locale);
  if (!locale.valid) notFound();
  return (
    <CollectionPreviewClient
      collectionSlug={collectionSlug}
      projectId={projectId}
      publishedSessionId={projectId === "project_lumo_fresh" ? sessionId : undefined}
      renderTarget="published"
      snapshotKind="published"
      {...(locale.value ? { initialLocale: locale.value } : {})}
    />
  );
}
