import "server-only";

import OpenAI from "openai";
import {
  AiProviderUnavailableError,
  createDeterministicMockAIProvider,
  type AIProvider,
} from "@/application/ai-provider";
import { providerModelIdentifierSchema } from "@/application/whole-storefront-generation-plan";
import { defaultOpenAiModel, defaultOpenAiTimeoutMs, OpenAiProvider } from "./openai-provider";
import type {
  OpenAiProviderTelemetry,
  OpenAiResponsesRequest,
  OpenAiResponseRequestOptions,
} from "./contract";

export type ServerAiProviderSelection = "mock" | "openai";

type OpenAiServerEnvironment = Readonly<
  Record<string, string | undefined> & {
    OPENAI_API_KEY?: string;
    VESKIFY_AI_PROVIDER?: string;
    VESKIFY_OPENAI_MODEL?: string;
    VESKIFY_OPENAI_TIMEOUT_MS?: string;
  }
>;

class MissingApiKeyProvider implements AIProvider {
  proposeChange(): Promise<never> {
    return Promise.reject(
      new AiProviderUnavailableError(
        "The design assistant is temporarily unavailable. Please try again or continue editing manually.",
        "missingApiKey",
      ),
    );
  }
}

function providerSelection(value: string | undefined): ServerAiProviderSelection {
  const selection = value?.trim() || "mock";
  if (selection === "mock" || selection === "openai") return selection;
  throw new AiProviderUnavailableError(
    "The design assistant is temporarily unavailable. Please try again or continue editing manually.",
    "unexpectedProviderFailure",
  );
}

function timeoutFrom(value: string | undefined): number {
  if (value === undefined || value.trim() === "") return defaultOpenAiTimeoutMs;
  const timeout = Number(value);
  if (!Number.isInteger(timeout) || timeout < 1_000 || timeout > 120_000) {
    throw new AiProviderUnavailableError(
      "The design assistant is temporarily unavailable. Please try again or continue editing manually.",
      "unexpectedProviderFailure",
    );
  }
  return timeout;
}

export function selectServerAiProvider({
  environment = process.env,
  telemetry,
}: {
  environment?: OpenAiServerEnvironment;
  telemetry?: OpenAiProviderTelemetry;
} = {}): AIProvider {
  if (providerSelection(environment.VESKIFY_AI_PROVIDER) === "mock") {
    return createDeterministicMockAIProvider();
  }

  const apiKey = environment.OPENAI_API_KEY?.trim();
  if (!apiKey) return new MissingApiKeyProvider();

  const timeout = timeoutFrom(environment.VESKIFY_OPENAI_TIMEOUT_MS);
  const parsedModel = providerModelIdentifierSchema.safeParse(
    environment.VESKIFY_OPENAI_MODEL?.trim() || defaultOpenAiModel,
  );
  if (!parsedModel.success) return new MissingApiKeyProvider();
  const client = new OpenAI({
    apiKey,
    maxRetries: 0,
    timeout,
    logLevel: "off",
  });
  return new OpenAiProvider({
    model: parsedModel.data,
    timeoutMs: timeout,
    telemetry,
    responses: {
      create: (request: OpenAiResponsesRequest, options: OpenAiResponseRequestOptions) =>
        client.responses.create(request, options),
    },
  });
}
