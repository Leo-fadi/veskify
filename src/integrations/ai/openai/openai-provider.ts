import {
  AiProviderUnavailableError,
  aiProviderResponseSchema,
  type AIProvider,
  type AiOperationRequest,
  type AiProviderFailureCategory,
  type AiProviderRequestOptions,
  type AiProviderResponse,
} from "@/application/ai-provider";
import {
  openAiModelOutputSchema,
  openAiStructuredOutputJsonSchema,
  type OpenAiModelOutput,
  type OpenAiProviderTelemetry,
  type OpenAiProviderTelemetryEvent,
  type OpenAiResponsesRequest,
  type OpenAiResponsesTransport,
} from "./contract";
import { buildOpenAiProviderInput, openAiProviderInstructions } from "./prompt";
import { mapOpenAiFailure } from "./failure-classification";
import { defaultOpenAiModel, defaultOpenAiTimeoutMs } from "./provider-defaults";

export { mapOpenAiFailure } from "./failure-classification";
export { defaultOpenAiModel, defaultOpenAiTimeoutMs } from "./provider-defaults";
const providerId = "openai" as const;

const rawOpenAiResponseSchema = {
  parse(input: unknown) {
    if (typeof input !== "object" || input === null) throw new Error("invalid response");
    const value = input as Record<string, unknown>;
    if (typeof value.id !== "string" || value.id.length === 0 || value.id.length > 200) {
      throw new Error("invalid response id");
    }
    if (typeof value.status !== "string" || !Array.isArray(value.output)) {
      throw new Error("invalid response shape");
    }
    return value;
  },
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function responseContainsRefusal(output: unknown[]): boolean {
  return output.some(
    (item) =>
      isRecord(item) &&
      Array.isArray(item.content) &&
      item.content.some((content) => isRecord(content) && content.type === "refusal"),
  );
}

function numberOrUndefined(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : undefined;
}

function safeUsage(response: Record<string, unknown>) {
  const usage = isRecord(response.usage) ? response.usage : {};
  return {
    inputTokens: numberOrUndefined(usage.input_tokens),
    outputTokens: numberOrUndefined(usage.output_tokens),
    totalTokens: numberOrUndefined(usage.total_tokens),
  };
}

function safeProviderError(category: AiProviderFailureCategory) {
  return new AiProviderUnavailableError(
    "The design assistant is temporarily unavailable. Please try again or continue editing manually.",
    category,
  );
}

function normalizedModelOutput(output: OpenAiModelOutput) {
  return {
    operations: output.operations.map((operation) => {
      if (operation.type !== "ADD_APPROVED_SECTION") return operation;
      return {
        type: operation.type,
        sectionId: operation.sectionId,
        component: operation.component,
        ...(operation.variant === null ? {} : { variant: operation.variant }),
        ...(operation.index === null ? {} : { index: operation.index }),
      };
    }),
    diagnostics: output.diagnostics,
    ...(output.explanation === null
      ? {}
      : {
          explanation: {
            ...(output.explanation.en === null ? {} : { en: output.explanation.en }),
            ...(output.explanation.fi === null ? {} : { fi: output.explanation.fi }),
          },
        }),
  };
}

export function buildOpenAiResponsesRequest(
  request: AiOperationRequest,
  model: string,
): OpenAiResponsesRequest {
  return {
    model,
    instructions: openAiProviderInstructions,
    input: buildOpenAiProviderInput(request),
    store: false,
    max_output_tokens: 4_000,
    text: {
      verbosity: "low",
      format: {
        type: "json_schema",
        name: "veskify_storefront_operations",
        description: "A bounded Veskify storefront design-operation proposal.",
        strict: true,
        schema: openAiStructuredOutputJsonSchema,
      },
    },
  };
}

export class OpenAiProvider implements AIProvider {
  readonly #responses: OpenAiResponsesTransport;
  readonly #model: string;
  readonly #timeoutMs: number;
  readonly #telemetry?: OpenAiProviderTelemetry;

  constructor({
    responses,
    model = defaultOpenAiModel,
    timeoutMs = defaultOpenAiTimeoutMs,
    telemetry,
  }: {
    responses: OpenAiResponsesTransport;
    model?: string;
    timeoutMs?: number;
    telemetry?: OpenAiProviderTelemetry;
  }) {
    this.#responses = responses;
    this.#model = model;
    this.#timeoutMs = timeoutMs;
    this.#telemetry = telemetry;
  }

  async proposeChange(
    request: AiOperationRequest,
    options: AiProviderRequestOptions = {},
  ): Promise<AiProviderResponse> {
    const started = Date.now();
    let providerRequestId: string | undefined;
    try {
      const raw = rawOpenAiResponseSchema.parse(
        await this.#responses.create(buildOpenAiResponsesRequest(request, this.#model), {
          maxRetries: 0,
          timeout: this.#timeoutMs,
          ...(options.signal ? { signal: options.signal } : {}),
        }),
      );
      providerRequestId = raw.id as string;
      if (raw.status === "cancelled") throw safeProviderError("cancelled");
      if (responseContainsRefusal(raw.output as unknown[])) {
        throw safeProviderError("providerRefusal");
      }
      if (raw.status !== "completed" || typeof raw.output_text !== "string") {
        throw safeProviderError("malformedResponse");
      }

      let decoded: unknown;
      try {
        decoded = JSON.parse(raw.output_text);
      } catch {
        throw safeProviderError("malformedResponse");
      }
      const parsed = openAiModelOutputSchema.safeParse(decoded);
      if (!parsed.success) throw safeProviderError("malformedResponse");
      const response = aiProviderResponseSchema.parse({
        providerRequestId,
        providerId,
        ...normalizedModelOutput(parsed.data),
        metadata: {
          operationCount: parsed.data.operations.length,
          durationMs: Date.now() - started,
          validation: "valid",
        },
      });
      this.#record({
        providerId,
        modelId: this.#model,
        operation: "proposal",
        providerRequestId,
        durationMs: Date.now() - started,
        outcome: "success",
        ...safeUsage(raw),
      });
      return response;
    } catch (error) {
      const category =
        error instanceof AiProviderUnavailableError
          ? error.category
          : mapOpenAiFailure(error, options.signal);
      this.#record({
        providerId,
        modelId: this.#model,
        operation: "proposal",
        ...(providerRequestId ? { providerRequestId } : {}),
        durationMs: Date.now() - started,
        outcome: category,
      });
      throw safeProviderError(category);
    }
  }

  #record(event: OpenAiProviderTelemetryEvent) {
    try {
      this.#telemetry?.record(event);
    } catch {
      // Provider telemetry is best-effort and never controls proposal generation.
    }
  }
}
