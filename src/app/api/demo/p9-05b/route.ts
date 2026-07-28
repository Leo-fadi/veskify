import "server-only";

import {
  inspectP905bLocalDemo,
  resetP905bLocalDemo,
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

export async function POST() {
  try {
    return Response.json({ ok: true, demo: await resetP905bLocalDemo() });
  } catch {
    return failure();
  }
}
