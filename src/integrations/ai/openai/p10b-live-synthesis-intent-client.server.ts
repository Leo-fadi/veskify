import "server-only";

import OpenAI from "openai";
import {
  P10bLiveSynthesisIntentError,
  type P10bLiveSynthesisIntentProvider,
} from "@/application/bounded-storefront-synthesis";
import { providerModelIdentifierSchema } from "@/application/whole-storefront-generation-plan";
import { defaultOpenAiModel, defaultOpenAiTimeoutMs } from "./openai-provider";
import type {
  OpenAiProviderTelemetry,
  OpenAiResponseRequestOptions,
  OpenAiResponsesRequest,
} from "./contract";
import { OpenAiP10bLiveSynthesisIntentProvider } from "./p10b-live-synthesis-intent-provider";

type Environment = Readonly<
  Record<string, string | undefined> & {
    OPENAI_API_KEY?: string;
    VESKIFY_AI_PROVIDER?: string;
    VESKIFY_OPENAI_MODEL?: string;
    VESKIFY_OPENAI_TIMEOUT_MS?: string;
  }
>;

class UnavailableP10bLiveSynthesisIntentProvider implements P10bLiveSynthesisIntentProvider {
  readonly id = "openai-p10b-complete-storefront-synthesis-intent";
  readonly modelId = null;

  selectIntent(): Promise<never> {
    return Promise.reject(new P10bLiveSynthesisIntentError("credentials-unavailable"));
  }
}

export type ServerP10bLiveSynthesisIntentProviderConfiguration = Readonly<{
  provider: P10bLiveSynthesisIntentProvider;
  modelId: string | null;
  category:
    | "eligible"
    | "provider-not-openai"
    | "credentials-unavailable"
    | "model-identity-unavailable"
    | "invalid-timeout";
}>;

function unavailable(
  category: Exclude<ServerP10bLiveSynthesisIntentProviderConfiguration["category"], "eligible">,
): ServerP10bLiveSynthesisIntentProviderConfiguration {
  return { provider: new UnavailableP10bLiveSynthesisIntentProvider(), modelId: null, category };
}

function timeoutFrom(value: string | undefined): number | null {
  if (value === undefined || value.trim() === "") return defaultOpenAiTimeoutMs;
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 1_000 && parsed <= 120_000 ? parsed : null;
}

export function selectServerP10bLiveSynthesisIntentProviderConfiguration({
  environment = process.env,
  telemetry,
}: {
  environment?: Environment;
  telemetry?: OpenAiProviderTelemetry;
} = {}): ServerP10bLiveSynthesisIntentProviderConfiguration {
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
  const provider = new OpenAiP10bLiveSynthesisIntentProvider({
    model: model.data,
    timeoutMs: timeout,
    telemetry,
    responses: {
      create: (request: OpenAiResponsesRequest, options: OpenAiResponseRequestOptions) =>
        client.responses.create(request, options),
    },
  });
  return { provider, modelId: model.data, category: "eligible" };
}
