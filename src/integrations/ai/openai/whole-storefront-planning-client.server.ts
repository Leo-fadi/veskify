import "server-only";

import OpenAI from "openai";
import {
  createDeterministicWholeStorefrontPlanningProvider,
  type WholeStorefrontPlanningProvider,
  WholeStorefrontPlanningProviderError,
} from "@/application/whole-storefront-generation-plan";
import { defaultOpenAiModel, defaultOpenAiTimeoutMs } from "./openai-provider";
import type {
  OpenAiProviderTelemetry,
  OpenAiResponseRequestOptions,
  OpenAiResponsesRequest,
} from "./contract";
import { OpenAiWholeStorefrontPlanningProvider } from "./whole-storefront-planning-provider";

export type ServerWholeStorefrontPlanningProviderSelection = "mock" | "openai";

/**
 * Safe trusted configuration required by controlled acceptance. It intentionally
 * exposes neither credentials nor provider options.
 */
export type ServerWholeStorefrontPlanningProviderConfiguration = Readonly<{
  provider: WholeStorefrontPlanningProvider;
  modelId: string | null;
}>;

type OpenAiServerEnvironment = Readonly<
  Record<string, string | undefined> & {
    OPENAI_API_KEY?: string;
    VESKIFY_AI_PROVIDER?: string;
    VESKIFY_OPENAI_MODEL?: string;
    VESKIFY_OPENAI_TIMEOUT_MS?: string;
  }
>;

class MissingCredentialsWholeStorefrontPlanningProvider implements WholeStorefrontPlanningProvider {
  readonly id = "openai-whole-storefront-planning";
  readonly capabilities = {
    wholeStorefrontPlanning: true,
    structuredPlanOutput: true,
    approvedAssetReferences: true,
  } as const;

  createPlan(): Promise<never> {
    return Promise.reject(
      new WholeStorefrontPlanningProviderError(
        "credentials-unavailable",
        "The storefront planning assistant is temporarily unavailable.",
      ),
    );
  }
}

function providerSelection(
  value: string | undefined,
): ServerWholeStorefrontPlanningProviderSelection {
  const selection = value?.trim() || "mock";
  if (selection === "mock" || selection === "openai") return selection;
  throw new WholeStorefrontPlanningProviderError(
    "provider-unavailable",
    "The storefront planning assistant is temporarily unavailable.",
  );
}

function timeoutFrom(value: string | undefined): number {
  if (value === undefined || value.trim() === "") return defaultOpenAiTimeoutMs;
  const timeout = Number(value);
  if (!Number.isInteger(timeout) || timeout < 1_000 || timeout > 120_000) {
    throw new WholeStorefrontPlanningProviderError(
      "provider-unavailable",
      "The storefront planning assistant is temporarily unavailable.",
    );
  }
  return timeout;
}

export function selectServerWholeStorefrontPlanningProviderConfiguration({
  environment = process.env,
  telemetry,
}: {
  environment?: OpenAiServerEnvironment;
  telemetry?: OpenAiProviderTelemetry;
} = {}): ServerWholeStorefrontPlanningProviderConfiguration {
  if (providerSelection(environment.VESKIFY_AI_PROVIDER) === "mock") {
    return { provider: createDeterministicWholeStorefrontPlanningProvider(), modelId: null };
  }
  const apiKey = environment.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    return { provider: new MissingCredentialsWholeStorefrontPlanningProvider(), modelId: null };
  }

  const timeout = timeoutFrom(environment.VESKIFY_OPENAI_TIMEOUT_MS);
  const modelId = environment.VESKIFY_OPENAI_MODEL?.trim() || defaultOpenAiModel;
  const client = new OpenAI({ apiKey, maxRetries: 0, timeout, logLevel: "off" });
  return {
    provider: new OpenAiWholeStorefrontPlanningProvider({
      model: modelId,
      timeoutMs: timeout,
      telemetry,
      responses: {
        create: (request: OpenAiResponsesRequest, options: OpenAiResponseRequestOptions) =>
          client.responses.create(request, options),
      },
    }),
    modelId,
  };
}

export function selectServerWholeStorefrontPlanningProvider(
  options: {
    environment?: OpenAiServerEnvironment;
    telemetry?: OpenAiProviderTelemetry;
  } = {},
): WholeStorefrontPlanningProvider {
  return selectServerWholeStorefrontPlanningProviderConfiguration(options).provider;
}
