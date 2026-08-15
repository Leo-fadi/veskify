import "server-only";

import { createP10B16P03ServerPromptedStorefrontStudioAuthority } from "@/integrations/ai/prompted-storefront-studio-authority.server";
import { createServerPromptedStorefrontStudioHandler } from "@/integrations/ai/prompted-storefront-studio-handler.server";
import {
  createP10B16P03MockPromptedStorefrontDesignIntentProvider,
  selectP10B16P03MockPromptScenario,
  type P10B16P03MockPromptFailure,
} from "@/integrations/ai/mock-prompted-storefront-design-intent-v2-provider.server";

type Environment = Readonly<Record<string, string | undefined>>;

const P10B16P03_MOCK_FAILURE_HEADER = "x-veskify-p10b-16p-03-mock-failure" as const;
const mockFailures: readonly P10B16P03MockPromptFailure[] = [
  "provider-refusal",
  "provider-timeout",
  "provider-transport",
  "malformed-output",
  "strict-schema-invalid",
  "unknown-capability",
  "insufficient-material-intent",
  "unsupported-hard-constraint",
];

function mockFailure(httpRequest: Request): P10B16P03MockPromptFailure | undefined {
  const requested = httpRequest.headers.get(P10B16P03_MOCK_FAILURE_HEADER);
  return mockFailures.find((failure) => failure === requested);
}

/** Production-disabled standalone composition for deterministic Studio acceptance. */
export function createP10B16P03WholeStorefrontProposalRouteHandler({
  environment = process.env,
}: {
  environment?: Environment;
} = {}) {
  return createServerPromptedStorefrontStudioHandler({
    authority: createP10B16P03ServerPromptedStorefrontStudioAuthority(),
    selectProvider: ({ request, httpRequest }) => {
      if (environment.VESKIFY_RUNTIME_MODE !== "standalone") {
        throw new Error("The production-disabled P03 composition requires standalone mode.");
      }
      const failure = mockFailure(httpRequest);
      return createP10B16P03MockPromptedStorefrontDesignIntentProvider({
        scenario: selectP10B16P03MockPromptScenario(request.merchantPrompt),
        ...(failure === undefined ? {} : { failure }),
      });
    },
  });
}
