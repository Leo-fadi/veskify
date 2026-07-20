import "server-only";

import { selectServerAiProvider } from "@/integrations/ai/openai/openai-client.server";
import {
  createServerAiProposalHandler,
  unavailableServerAiAuthority,
} from "@/integrations/ai/server-authority";

export const runtime = "nodejs";

export const POST = createServerAiProposalHandler({
  authority: unavailableServerAiAuthority,
  selectProvider: selectServerAiProvider,
});
