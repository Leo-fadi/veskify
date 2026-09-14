import "server-only";

import type { MerchantProjectAuthorization } from "@/application/merchant-project-context/contract";
import type { PromptedStorefrontDesignCompilationAuthority } from "@/application/prompted-storefront-design-compiler";
import type { PromptedStorefrontStudioGenerationRequest } from "@/application/prompted-storefront-studio";
import { ServerWholeStorefrontAuthorityError } from "./whole-storefront-failures";

export type ServerPromptedStorefrontStudioContext = Readonly<{
  authorization: MerchantProjectAuthorization;
  loadCurrentAuthority: () =>
    | PromptedStorefrontDesignCompilationAuthority
    | Promise<PromptedStorefrontDesignCompilationAuthority>;
}>;

export interface ServerPromptedStorefrontStudioAuthority {
  resolve(
    request: PromptedStorefrontStudioGenerationRequest,
    httpRequest: Request,
  ): Promise<ServerPromptedStorefrontStudioContext>;
}

export const unavailableServerPromptedStorefrontStudioAuthority: ServerPromptedStorefrontStudioAuthority =
  Object.freeze({
    resolve: () =>
      Promise.reject(new ServerWholeStorefrontAuthorityError("authentication-unavailable")),
  });
