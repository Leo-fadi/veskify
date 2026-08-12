import { notFound } from "next/navigation";
import { ProductPreviewClient } from "./product-preview-client";
import { ProjectPreviewClient } from "../../project-preview-client";
import { loadP10bLiveSynthesisPreviewSession } from "@/integrations/ai/p10b-live-synthesis-acceptance-authority.server";
import { loadP10B16P03CurrentEvidenceReferences } from "@/integrations/ai/prompted-storefront-studio-authority.server";

export default async function ProductPage({
  params,
  searchParams,
}: {
  params: Promise<{ projectId: string; productSlug: string }>;
  searchParams: Promise<{ "p10b-16l-session"?: string }>;
}) {
  const { projectId, productSlug } = await params;
  const sessionId = (await searchParams)["p10b-16l-session"];
  const bridge = sessionId
    ? await loadP10bLiveSynthesisPreviewSession({ projectId, sessionId }).catch(() => null)
    : null;
  if (sessionId && !bridge) notFound();
  if (bridge) {
    return (
      <ProjectPreviewClient
        projectId={projectId}
        pageSlug={`/products/${productSlug}`}
        draftSessionId={bridge.sessionId}
        initialAggregate={bridge.aggregate}
        initialEvidenceReferences={bridge.evidenceReferences}
      />
    );
  }
  const initialEvidenceReferences = await loadP10B16P03CurrentEvidenceReferences({ projectId });
  return (
    <ProductPreviewClient
      productId={projectId}
      productSlug={productSlug}
      initialEvidenceReferences={initialEvidenceReferences}
    />
  );
}
