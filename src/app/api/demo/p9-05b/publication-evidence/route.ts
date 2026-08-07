import "server-only";

import {
  inspectP905bLocalDemoPublicationEvidence,
  isP905bLocalDemoConfigured,
} from "@/integrations/ai/p9-05b-local-demo-authority.server";

function unavailable() {
  return Response.json({ ok: false, failure: "publicationEvidenceUnavailable" }, { status: 404 });
}

export async function GET(request: Request) {
  const projectId = new URL(request.url).searchParams.get("projectId");
  const sessionId = request.headers.get("x-veskify-p9-05b-session");
  if (!isP905bLocalDemoConfigured() || !projectId || !sessionId) return unavailable();

  const evidence = await inspectP905bLocalDemoPublicationEvidence({ projectId, sessionId }).catch(
    () => null,
  );
  return evidence ? Response.json({ ok: true, evidence }) : unavailable();
}
