import "server-only";

import OpenAI from "openai";
import { PromptedStorefrontDesignIntentError } from "@/application/prompted-storefront-design-intent/contract";
import type { SemanticStorefrontDesignIntentProvider } from "@/application/prompted-storefront-design-intent/semantic-contract";
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
    OPENAI_BASE_URL?: string;
    OPENAI_CUSTOM_HEADERS?: string;
    OPENAI_ORG_ID?: string;
    OPENAI_PROJECT_ID?: string;
    VESKIFY_AI_PROVIDER?: string;
    VESKIFY_OPENAI_MODEL?: string;
    VESKIFY_OPENAI_TIMEOUT_MS?: string;
  }
>;

export const OPENAI_PROMPTED_DESIGN_CANONICAL_BASE_URL = "https://api.openai.com/v1" as const;

export type TrustedOpenAiTransportConfiguration = Readonly<{
  endpoint: "official-openai-responses-v1";
  canonicalBaseUrl: boolean;
  organizationConfigured: boolean;
  projectConfigured: boolean;
  customHeadersConfigured: boolean;
  proxyConfigured: boolean;
}>;

type ResolvedTransportAuthority = Readonly<{
  safe: TrustedOpenAiTransportConfiguration;
  organization: string | null;
  project: string | null;
  eligible: boolean;
}>;

const proxyEnvironmentKeys = [
  "HTTP_PROXY",
  "HTTPS_PROXY",
  "ALL_PROXY",
  "GLOBAL_AGENT_HTTP_PROXY",
  "GLOBAL_AGENT_HTTPS_PROXY",
  "http_proxy",
  "https_proxy",
  "all_proxy",
] as const;

class UnavailablePromptedStorefrontDesignIntentProvider implements SemanticStorefrontDesignIntentProvider {
  readonly id = "openai-prompted-storefront-design-intent-v2";
  readonly modelId = null;

  createDesignIntent(): Promise<never> {
    return Promise.reject(new PromptedStorefrontDesignIntentError("credentials-unavailable"));
  }
}

export type ServerPromptedStorefrontDesignIntentProviderConfiguration = Readonly<{
  provider: SemanticStorefrontDesignIntentProvider;
  modelId: string | null;
  timeoutMs: number | null;
  retryCount: 0;
  transport: TrustedOpenAiTransportConfiguration;
  category:
    | "eligible"
    | "provider-not-openai"
    | "credentials-unavailable"
    | "model-identity-unavailable"
    | "invalid-timeout"
    | "transport-configuration-unavailable";
}>;

function unavailable(
  category: Exclude<
    ServerPromptedStorefrontDesignIntentProviderConfiguration["category"],
    "eligible"
  >,
  transport: TrustedOpenAiTransportConfiguration,
): ServerPromptedStorefrontDesignIntentProviderConfiguration {
  return {
    provider: new UnavailablePromptedStorefrontDesignIntentProvider(),
    modelId: null,
    timeoutMs: null,
    retryCount: 0,
    transport,
    category,
  };
}

function timeoutFrom(value: string | undefined): number | null {
  if (value === undefined || value.trim() === "") return defaultOpenAiTimeoutMs;
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 1_000 && parsed <= 120_000 ? parsed : null;
}

function nonBlank(value: string | undefined): boolean {
  return value !== undefined && value.trim() !== "";
}

function optionalAccountScope(value: string | undefined): string | null | undefined {
  const normalized = value?.trim();
  if (!normalized) return null;
  return /^[A-Za-z0-9][A-Za-z0-9._:-]{0,199}$/.test(normalized) ? normalized : undefined;
}

function isCanonicalOpenAiBaseUrl(value: string | undefined): boolean {
  const normalized = value?.trim();
  if (!normalized) return true;
  try {
    const parsed = new URL(normalized);
    return (
      parsed.protocol === "https:" &&
      parsed.hostname === "api.openai.com" &&
      parsed.port === "" &&
      parsed.username === "" &&
      parsed.password === "" &&
      (parsed.pathname === "/v1" || parsed.pathname === "/v1/") &&
      parsed.search === "" &&
      parsed.hash === ""
    );
  } catch {
    return false;
  }
}

function proxyConfigured(environment: Environment): boolean {
  if (proxyEnvironmentKeys.some((key) => nonBlank(environment[key]))) return true;
  const nodeUseEnvironmentProxy = environment.NODE_USE_ENV_PROXY?.trim().toLowerCase();
  if (
    nodeUseEnvironmentProxy !== undefined &&
    nodeUseEnvironmentProxy !== "" &&
    nodeUseEnvironmentProxy !== "0" &&
    nodeUseEnvironmentProxy !== "false"
  ) {
    return true;
  }
  return /(?:^|\s)--use-env-proxy(?:\s|$)/.test(environment.NODE_OPTIONS ?? "");
}

function resolveTrustedTransportAuthority(
  environment: Environment,
  sdkEnvironment: Environment,
): ResolvedTransportAuthority {
  const organization = optionalAccountScope(environment.OPENAI_ORG_ID);
  const project = optionalAccountScope(environment.OPENAI_PROJECT_ID);
  const canonicalBaseUrl =
    isCanonicalOpenAiBaseUrl(environment.OPENAI_BASE_URL) &&
    isCanonicalOpenAiBaseUrl(sdkEnvironment.OPENAI_BASE_URL);
  // OpenAI SDK 6.x merges OPENAI_CUSTOM_HEADERS after constructor defaults, so an
  // allowlisted empty defaultHeaders object cannot neutralize it. Fail closed instead.
  const customHeadersConfigured =
    nonBlank(environment.OPENAI_CUSTOM_HEADERS) || nonBlank(sdkEnvironment.OPENAI_CUSTOM_HEADERS);
  const hasProxy = proxyConfigured(environment) || proxyConfigured(sdkEnvironment);
  const safe = Object.freeze({
    endpoint: "official-openai-responses-v1" as const,
    canonicalBaseUrl,
    organizationConfigured: organization !== null && organization !== undefined,
    projectConfigured: project !== null && project !== undefined,
    customHeadersConfigured,
    proxyConfigured: hasProxy,
  });
  return {
    safe,
    organization: organization ?? null,
    project: project ?? null,
    eligible:
      canonicalBaseUrl &&
      organization !== undefined &&
      project !== undefined &&
      !customHeadersConfigured &&
      !hasProxy,
  };
}

export function selectServerPromptedStorefrontDesignIntentProviderConfiguration({
  environment = process.env,
  sdkEnvironment = environment,
  telemetry,
}: {
  environment?: Environment;
  /** Mirrors the environment that the SDK itself can read; injectable only for zero-network tests. */
  sdkEnvironment?: Environment;
  telemetry?: PromptedStorefrontDesignIntentProviderTelemetry;
} = {}): ServerPromptedStorefrontDesignIntentProviderConfiguration {
  const transport = resolveTrustedTransportAuthority(environment, sdkEnvironment);
  if (environment.VESKIFY_AI_PROVIDER?.trim() !== "openai") {
    return unavailable("provider-not-openai", transport.safe);
  }
  const apiKey = environment.OPENAI_API_KEY?.trim();
  if (!apiKey) return unavailable("credentials-unavailable", transport.safe);
  const model = providerModelIdentifierSchema.safeParse(
    environment.VESKIFY_OPENAI_MODEL?.trim() || defaultOpenAiModel,
  );
  if (!model.success) return unavailable("model-identity-unavailable", transport.safe);
  const timeout = timeoutFrom(environment.VESKIFY_OPENAI_TIMEOUT_MS);
  if (timeout === null) return unavailable("invalid-timeout", transport.safe);
  if (!transport.eligible) {
    return unavailable("transport-configuration-unavailable", transport.safe);
  }
  const client = new OpenAI({
    apiKey,
    adminAPIKey: null,
    webhookSecret: null,
    baseURL: OPENAI_PROMPTED_DESIGN_CANONICAL_BASE_URL,
    organization: transport.organization,
    project: transport.project,
    defaultHeaders: {},
    maxRetries: 0,
    timeout,
    logLevel: "off",
  });
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
    timeoutMs: timeout,
    retryCount: 0,
    transport: transport.safe,
    category: "eligible",
  };
}
