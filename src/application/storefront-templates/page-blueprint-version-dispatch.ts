import { z } from "zod";
import { executablePageBlueprintProfileSchema } from "./contract";
import {
  PAGE_BLUEPRINT_V2_CONTRACT_SCHEMA_VERSION,
  pageBlueprintV2StructuralContractSchema,
} from "./page-blueprint-v2-contract";

export const PAGE_BLUEPRINT_V1_COMPATIBILITY_CONTRACT_SCHEMA_VERSION = "1.0.0" as const;

const pageBlueprintV1ContractEnvelopeSchema = z
  .object({
    contractSchemaVersion: z.literal(PAGE_BLUEPRINT_V1_COMPATIBILITY_CONTRACT_SCHEMA_VERSION),
    blueprint: executablePageBlueprintProfileSchema,
  })
  .strict();

const pageBlueprintV2ContractEnvelopeSchema = z
  .object({
    contractSchemaVersion: z.literal(PAGE_BLUEPRINT_V2_CONTRACT_SCHEMA_VERSION),
    blueprint: pageBlueprintV2StructuralContractSchema,
  })
  .strict();

export const pageBlueprintContractEnvelopeSchema = z
  .discriminatedUnion("contractSchemaVersion", [
    pageBlueprintV1ContractEnvelopeSchema,
    pageBlueprintV2ContractEnvelopeSchema,
  ])
  .readonly();

export type PageBlueprintContractEnvelope = z.infer<typeof pageBlueprintContractEnvelopeSchema>;
