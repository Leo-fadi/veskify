import "server-only";

import { createP10B16P04AcceptanceInspectionHandler } from "@/integrations/ai/p10b-16p-04-real-studio-acceptance-authority.server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = createP10B16P04AcceptanceInspectionHandler();
