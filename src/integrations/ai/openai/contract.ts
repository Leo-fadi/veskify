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
import { createOpenAiStrictJsonSchema } from "./strict-output-contract";

export {
  assertOpenAiStrictSchemaIsClosed,
  createOpenAiStrictJsonSchema,
  openAiUnsupportedStrictSchemaKeywords,
} from "./strict-output-contract";
export type {
  OpenAiResponseRequestOptions,
  OpenAiResponsesRequest,
  OpenAiResponsesTransport,
} from "./strict-output-contract";

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

export const openAiStructuredOutputJsonSchema = createOpenAiStrictJsonSchema(
  z.toJSONSchema(openAiModelOutputSchema, {
    target: "draft-7",
    unrepresentable: "throw",
  }),
);

export type OpenAiModelOutput = z.infer<typeof openAiModelOutputSchema>;

export type OpenAiProviderTelemetryEvent = Readonly<{
  providerId: "openai";
  modelId: string;
  operation: "proposal" | "wholeStorefrontPlanning" | "completeStorefrontSynthesisIntent";
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
