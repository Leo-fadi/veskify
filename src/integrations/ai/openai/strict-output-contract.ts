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
