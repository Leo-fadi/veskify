import { ProductPreviewClient } from "../../../products/[productSlug]/product-preview-client";
import { notFound } from "next/navigation";
import { parsePreviewLocaleParameter, type PreviewRouteParameter } from "../../../preview-mode";

export default async function PublishedProductPage({
  params,
  searchParams,
}: {
  params: Promise<{ projectId: string; productSlug: string }>;
  searchParams?: Promise<{ "p9-05b-session"?: string; locale?: PreviewRouteParameter }>;
}) {
  const { projectId, productSlug } = await params;
  const query = await searchParams;
  const sessionId = query?.["p9-05b-session"];
  const locale = parsePreviewLocaleParameter(query?.locale);
  if (!locale.valid) notFound();
  return (
    <ProductPreviewClient
      productId={projectId}
      productSlug={productSlug}
      publishedSessionId={projectId === "project_lumo_fresh" ? sessionId : undefined}
      renderTarget="published"
      snapshotKind="published"
      {...(locale.value ? { initialLocale: locale.value } : {})}
    />
  );
}
