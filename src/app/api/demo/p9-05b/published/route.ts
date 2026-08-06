import "server-only";

import {
  loadP905bLocalDemoPublishedProjection,
  isP905bLocalDemoConfigured,
} from "@/integrations/ai/p9-05b-local-demo-authority.server";

function unavailable() {
  return Response.json({ ok: false, failure: "publishedPreviewUnavailable" }, { status: 404 });
}

export async function GET(request: Request) {
  const projectId = new URL(request.url).searchParams.get("projectId");
  const sessionId = request.headers.get("x-veskify-p9-05b-session");
  if (!isP905bLocalDemoConfigured() || !projectId || !sessionId) return unavailable();

  const projection = await loadP905bLocalDemoPublishedProjection({ projectId, sessionId }).catch(
    () => null,
  );
  return projection ? Response.json({ ok: true, projection }) : unavailable();
}
