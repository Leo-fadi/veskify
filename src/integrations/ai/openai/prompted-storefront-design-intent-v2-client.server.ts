import "server-only";

import OpenAI from "openai";
import {
  PromptedStorefrontDesignIntentError,
  type PromptedStorefrontDesignIntentProvider,
} from "@/application/prompted-storefront-design-intent/contract";
import { providerModelIdentifierSchema } from "@/application/ai-provider/model-identity";
import type {
  OpenAiResponseRequestOptions,
  OpenAiResponsesRequest,
} from "./strict-output-contract";
import { defaultOpenAiModel, defaultOpenAiTimeoutMs } from "./provider-defaults";
import {
  OpenAiPromptedStorefrontDesignIntentV2Provider,
  type PromptedStorefrontDesignIntentProviderTelemetry,
} from "./prompted-storefront-design-intent-v2-provider.server";

type Environment = Readonly<
  Record<string, string | undefined> & {
    OPENAI_API_KEY?: string;
    VESKIFY_AI_PROVIDER?: string;
    VESKIFY_OPENAI_MODEL?: string;
    VESKIFY_OPENAI_TIMEOUT_MS?: string;
  }
>;

class UnavailablePromptedStorefrontDesignIntentProvider implements PromptedStorefrontDesignIntentProvider {
  readonly id = "openai-prompted-storefront-design-intent-v2";
  readonly modelId = null;

  createDesignIntent(): Promise<never> {
    return Promise.reject(new PromptedStorefrontDesignIntentError("credentials-unavailable"));
  }
}

export type ServerPromptedStorefrontDesignIntentProviderConfiguration = Readonly<{
  provider: PromptedStorefrontDesignIntentProvider;
  modelId: string | null;
  category:
    | "eligible"
    | "provider-not-openai"
    | "credentials-unavailable"
    | "model-identity-unavailable"
    | "invalid-timeout";
}>;

function unavailable(
  category: Exclude<
    ServerPromptedStorefrontDesignIntentProviderConfiguration["category"],
    "eligible"
  >,
): ServerPromptedStorefrontDesignIntentProviderConfiguration {
  return {
    provider: new UnavailablePromptedStorefrontDesignIntentProvider(),
    modelId: null,
    category,
  };
}

function timeoutFrom(value: string | undefined): number | null {
  if (value === undefined || value.trim() === "") return defaultOpenAiTimeoutMs;
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 1_000 && parsed <= 120_000 ? parsed : null;
}

export function selectServerPromptedStorefrontDesignIntentProviderConfiguration({
  environment = process.env,
  telemetry,
}: {
  environment?: Environment;
  telemetry?: PromptedStorefrontDesignIntentProviderTelemetry;
} = {}): ServerPromptedStorefrontDesignIntentProviderConfiguration {
  if (environment.VESKIFY_AI_PROVIDER?.trim() !== "openai") {
    return unavailable("provider-not-openai");
  }
  const apiKey = environment.OPENAI_API_KEY?.trim();
  if (!apiKey) return unavailable("credentials-unavailable");
  const model = providerModelIdentifierSchema.safeParse(
    environment.VESKIFY_OPENAI_MODEL?.trim() || defaultOpenAiModel,
  );
  if (!model.success) return unavailable("model-identity-unavailable");
  const timeout = timeoutFrom(environment.VESKIFY_OPENAI_TIMEOUT_MS);
  if (timeout === null) return unavailable("invalid-timeout");
  const client = new OpenAI({ apiKey, maxRetries: 0, timeout, logLevel: "off" });
  return {
    provider: new OpenAiPromptedStorefrontDesignIntentV2Provider({
      model: model.data,
      timeoutMs: timeout,
      telemetry,
      responses: {
        create: (request: OpenAiResponsesRequest, options: OpenAiResponseRequestOptions) =>
          client.responses.create(request, options),
      },
    }),
    modelId: model.data,
    category: "eligible",
  };
}
