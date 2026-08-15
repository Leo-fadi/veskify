import "server-only";

import {
  createP10B16P04PromptedStorefrontProviderSelector,
  createP10B16P04ServerPromptedStorefrontStudioAuthority,
  recordP10B16P04CompilationFailure,
  recordP10B16P04CompilationSuccess,
} from "@/integrations/ai/p10b-16p-04-real-studio-acceptance-authority.server";
import { createServerPromptedStorefrontStudioHandler } from "@/integrations/ai/prompted-storefront-studio-handler.server";

type Environment = Readonly<Record<string, string | undefined>>;

/**
 * Production-disabled P04 composition. It injects acceptance authority into the
 * canonical prompted handler; it does not replace the route or compiler.
 */
export function createP10B16P04WholeStorefrontProposalRouteHandler({
  environment = process.env,
}: {
  environment?: Environment;
} = {}) {
  return createServerPromptedStorefrontStudioHandler({
    authority: createP10B16P04ServerPromptedStorefrontStudioAuthority({ environment }),
    selectProvider: createP10B16P04PromptedStorefrontProviderSelector({ environment }),
    lifecycle: {
      success: recordP10B16P04CompilationSuccess,
      failure: recordP10B16P04CompilationFailure,
    },
  });
}
