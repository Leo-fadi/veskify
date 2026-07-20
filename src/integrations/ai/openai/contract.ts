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
    operations: z.array(openAiModelOperationSchema),
    diagnostics: z.array(aiProviderDiagnosticSchema),
    explanation: modelExplanationSchema.nullable(),
  })
  .strict();

export const openAiStructuredOutputJsonSchema = z.toJSONSchema(openAiModelOutputSchema, {
  target: "draft-7",
  unrepresentable: "throw",
});

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
      name: "veskify_storefront_operations";
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
