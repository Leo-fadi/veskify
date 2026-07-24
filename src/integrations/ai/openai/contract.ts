import { z } from "zod";
import {
  addApprovedSectionOperationSchema,
  applyApprovedBrandColoursOperationSchema,
  changeAlignmentOperationSchema,
  changeBackgroundOperationSchema,
  changeCtaStyleOperationSchema,
  changeDensityOperationSchema,
  changeLocalizedSectionTextOperationSchema,
  changeSectionVariantOperationSchema,
  changeShapeOperationSchema,
  changeTypographyOperationSchema,
  removeOptionalSectionOperationSchema,
  reorderSectionsOperationSchema,
} from "@/application/design-operations";
import { aiProviderDiagnosticSchema } from "@/application/ai-provider/contract";

const modelAddApprovedSectionOperationSchema = addApprovedSectionOperationSchema
  .omit({ variant: true, index: true })
  .extend({
    variant: z.string().min(1).max(80).nullable(),
    index: z.number().int().nonnegative().nullable(),
  })
  .strict();

export const openAiModelOperationSchema = z.discriminatedUnion("type", [
  changeLocalizedSectionTextOperationSchema,
  changeSectionVariantOperationSchema,
  changeBackgroundOperationSchema,
  changeTypographyOperationSchema,
  changeDensityOperationSchema,
  changeShapeOperationSchema,
  changeAlignmentOperationSchema,
  changeCtaStyleOperationSchema,
  applyApprovedBrandColoursOperationSchema,
  modelAddApprovedSectionOperationSchema,
  removeOptionalSectionOperationSchema,
  reorderSectionsOperationSchema,
]);

const modelExplanationSchema = z
  .object({ en: z.string().trim().min(1).nullable(), fi: z.string().trim().min(1).nullable() })
  .strict()
  .refine((value) => value.en !== null || value.fi !== null);

export const openAiModelOutputSchema = z
  .object({
    operations: z.array(openAiModelOperationSchema).min(1),
    diagnostics: z.array(aiProviderDiagnosticSchema),
    explanation: modelExplanationSchema.nullable(),
  })
  .strict();

export const openAiUnsupportedStrictSchemaKeywords = [
  "$schema",
  "allOf",
  "contains",
  "const",
  "contentEncoding",
  "contentMediaType",
  "default",
  "dependencies",
  "dependentRequired",
  "dependentSchemas",
  "else",
  "examples",
  "exclusiveMaximum",
  "exclusiveMinimum",
  "format",
  "if",
  "maxContains",
  "maxItems",
  "maxLength",
  "maxProperties",
  "maximum",
  "minContains",
  "minItems",
  "minLength",
  "minProperties",
  "minimum",
  "multipleOf",
  "not",
  "oneOf",
  "pattern",
  "patternProperties",
  "propertyNames",
  "then",
  "unevaluatedItems",
  "unevaluatedProperties",
  "uniqueItems",
] as const;

const unsupportedStrictSchemaKeywords = new Set<string>(openAiUnsupportedStrictSchemaKeywords);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function sanitizeOpenAiStrictSchemaValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sanitizeOpenAiStrictSchemaValue);
  if (!isRecord(value)) return value;

  const sanitized: Record<string, unknown> = {};
  for (const [key, child] of Object.entries(value)) {
    if (unsupportedStrictSchemaKeywords.has(key)) continue;
    sanitized[key] = sanitizeOpenAiStrictSchemaValue(child);
  }
  if (Object.hasOwn(value, "const") && sanitized.enum === undefined) {
    sanitized.enum = [sanitizeOpenAiStrictSchemaValue(value.const)];
  }

  if (sanitized.type === "object" && isRecord(sanitized.properties)) {
    sanitized.required = Object.keys(sanitized.properties);
    sanitized.additionalProperties = false;
  }
  return sanitized;
}

export function createOpenAiStrictJsonSchema(schema: unknown): Record<string, unknown> {
  const sanitized = sanitizeOpenAiStrictSchemaValue(schema);
  if (!isRecord(sanitized)) throw new Error("OpenAI structured output requires an object schema.");
  return sanitized;
}

export function assertOpenAiStrictSchemaIsClosed(schema: unknown): void {
  const visit = (value: unknown) => {
    if (Array.isArray(value)) {
      value.forEach(visit);
      return;
    }
    if (!isRecord(value)) return;
    if (value.type === "object" && value.additionalProperties !== false) {
      throw new Error(
        "OpenAI structured output object schemas must set additionalProperties to false.",
      );
    }
    Object.values(value).forEach(visit);
  };
  visit(schema);
}

export const openAiStructuredOutputJsonSchema = createOpenAiStrictJsonSchema(
  z.toJSONSchema(openAiModelOutputSchema, {
    target: "draft-7",
    unrepresentable: "throw",
  }),
);

export type OpenAiModelOutput = z.infer<typeof openAiModelOutputSchema>;

export type OpenAiResponsesRequest = Readonly<{
  model: string;
  instructions: string;
  input: string;
  store: false;
  max_output_tokens: number;
  text: Readonly<{
    verbosity: "low";
    format: Readonly<{
      type: "json_schema";
      name: string;
      description: string;
      strict: true;
      schema: Record<string, unknown>;
    }>;
  }>;
}>;

export type OpenAiResponseRequestOptions = Readonly<{
  maxRetries: 0;
  timeout: number;
  signal?: AbortSignal;
}>;

export interface OpenAiResponsesTransport {
  create(request: OpenAiResponsesRequest, options: OpenAiResponseRequestOptions): Promise<unknown>;
}

export type OpenAiProviderTelemetryEvent = Readonly<{
  providerId: "openai";
  modelId: string;
  operation: "proposal" | "wholeStorefrontPlanning";
  durationMs: number;
  outcome:
    | "success"
    | "missingApiKey"
    | "authenticationFailed"
    | "rateLimited"
    | "timeout"
    | "cancelled"
    | "networkFailure"
    | "malformedResponse"
    | "validationRejected"
    | "providerRefusal"
    | "unavailableModel"
    | "unexpectedProviderFailure";
  providerRequestId?: string;
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
}>;

export interface OpenAiProviderTelemetry {
  record(event: OpenAiProviderTelemetryEvent): void;
}
