import "server-only";

import {
  configuredP905bLocalDemoToken,
  inspectP905bLocalDemo,
  isP905bLocalDemoConfigured,
  p905bLocalDemoSession,
  resetP905bLocalDemo,
  sameP905bLocalDemoSecret,
} from "@/integrations/ai/p9-05b-local-demo-authority.server";

function failure() {
  return Response.json({ ok: false, failure: "demoUnavailable" }, { status: 404 });
}

export async function GET() {
  try {
    return Response.json({ ok: true, demo: await inspectP905bLocalDemo() });
  } catch {
    return failure();
  }
}

export async function POST(request: Request) {
  try {
    const configuredToken = configuredP905bLocalDemoToken();
    const sameOrigin = request.headers.get("origin") === new URL(request.url).origin;
    const suppliedToken = request.headers.get("x-veskify-p9-05b-demo-token");
    if (
      !isP905bLocalDemoConfigured() ||
      !sameOrigin ||
      !configuredToken ||
      !suppliedToken ||
      !sameP905bLocalDemoSecret(suppliedToken, configuredToken)
    ) {
      return failure();
    }
    const demo = await resetP905bLocalDemo();
    return Response.json({ ok: true, demo, session: p905bLocalDemoSession() });
  } catch {
    return failure();
  }
}
