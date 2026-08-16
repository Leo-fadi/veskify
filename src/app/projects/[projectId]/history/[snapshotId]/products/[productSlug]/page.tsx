import { ProductPreviewClient } from "../../../../products/[productSlug]/product-preview-client";
import { notFound } from "next/navigation";
import { parsePreviewLocaleParameter, type PreviewRouteParameter } from "../../../../preview-mode";

export default async function HistoricalProductPage({
  params,
  searchParams,
}: {
  params: Promise<{ projectId: string; snapshotId: string; productSlug: string }>;
  searchParams?: Promise<{ locale?: PreviewRouteParameter }>;
}) {
  const { projectId, snapshotId, productSlug } = await params;
  const locale = parsePreviewLocaleParameter((await searchParams)?.locale);
  if (!locale.valid) notFound();
  return (
    <ProductPreviewClient
      historicalSnapshotId={snapshotId}
      productId={projectId}
      productSlug={productSlug}
      snapshotKind="history"
      {...(locale.value ? { initialLocale: locale.value } : {})}
    />
  );
}
