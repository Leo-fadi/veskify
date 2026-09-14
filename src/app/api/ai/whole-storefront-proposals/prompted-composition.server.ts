import "server-only";

import {
  createDefaultServerPromptedStorefrontDesignIntentProviderSelector,
  createServerPromptedStorefrontStudioHandler,
  type SelectServerPromptedStorefrontDesignIntentProvider,
  type ServerPromptedStorefrontStudioGenerationLifecycle,
} from "@/integrations/ai/prompted-storefront-studio-handler.server";
import {
  unavailableServerPromptedStorefrontStudioAuthority,
  type ServerPromptedStorefrontStudioAuthority,
} from "@/integrations/ai/prompted-storefront-studio-authority-contract.server";

/** Normal prompted generation uses authenticated injected authority or fails closed. */
export function createPromptedStorefrontComposition({
  promptedAuthority,
  selectPromptedProvider,
  promptedLifecycle,
  environment = process.env,
}: {
  promptedAuthority?: ServerPromptedStorefrontStudioAuthority;
  selectPromptedProvider?: SelectServerPromptedStorefrontDesignIntentProvider;
  promptedLifecycle?: ServerPromptedStorefrontStudioGenerationLifecycle;
  environment?: Readonly<Record<string, string | undefined>>;
} = {}) {
  // The local P03 authority creates a standalone merchant identity and may never stand in for
  // integrated authentication. Integrated callers must inject an authority backed by their
  // authenticated tenant/project context; otherwise the V2 route fails closed before provider
  // selection.
  return createServerPromptedStorefrontStudioHandler({
    authority: promptedAuthority ?? unavailableServerPromptedStorefrontStudioAuthority,
    selectProvider:
      selectPromptedProvider ??
      createDefaultServerPromptedStorefrontDesignIntentProviderSelector({ environment }),
    lifecycle: promptedLifecycle,
  });
}
