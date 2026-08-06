import "server-only";

import {
  isP905bLocalDemoConfigured,
  loadP905bLocalDemoSavedAggregate,
} from "@/integrations/ai/p9-05b-local-demo-authority.server";

function unavailable() {
  return Response.json({ ok: false, failure: "sessionUnavailable" }, { status: 404 });
}

export async function GET(request: Request) {
  const projectId = new URL(request.url).searchParams.get("projectId");
  const sessionId = request.headers.get("x-veskify-p9-05b-session");
  if (!isP905bLocalDemoConfigured() || !projectId || !sessionId) return unavailable();

  const session = await loadP905bLocalDemoSavedAggregate({ projectId, sessionId }).catch(
    () => null,
  );
  return session ? Response.json({ ok: true, session }) : unavailable();
}
