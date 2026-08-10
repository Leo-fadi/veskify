import "server-only";

import {
  configuredP10bLiveSynthesisAcceptanceToken,
  inspectP10bLiveSynthesisAcceptance,
  isP10bLiveSynthesisAcceptanceConfigured,
  p10bLiveSynthesisAcceptanceSession,
  resetP10bLiveSynthesisAcceptance,
  sameP10bLiveSynthesisAcceptanceSecret,
} from "@/integrations/ai/p10b-live-synthesis-acceptance-authority.server";

function unavailable() {
  return Response.json({ ok: false, failure: "acceptanceUnavailable" }, { status: 404 });
}

export async function GET() {
  try {
    return Response.json({ ok: true, acceptance: await inspectP10bLiveSynthesisAcceptance() });
  } catch {
    return unavailable();
  }
}

export async function POST(request: Request) {
  try {
    const token = configuredP10bLiveSynthesisAcceptanceToken();
    const supplied = request.headers.get("x-veskify-p10b-16l-acceptance-token");
    if (
      !isP10bLiveSynthesisAcceptanceConfigured() ||
      request.headers.get("origin") !== new URL(request.url).origin ||
      !token ||
      !supplied ||
      !sameP10bLiveSynthesisAcceptanceSecret(token, supplied)
    ) {
      return unavailable();
    }
    const acceptance = await resetP10bLiveSynthesisAcceptance();
    return Response.json({
      ok: true,
      acceptance,
      session: p10bLiveSynthesisAcceptanceSession(),
    });
  } catch {
    return unavailable();
  }
}
