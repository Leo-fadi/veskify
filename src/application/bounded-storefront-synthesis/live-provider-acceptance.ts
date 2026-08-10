import { z } from "zod";
import { canonicalValueFingerprint } from "@/domain/storefront";
import {
  coordinatedDirectionRequestSchema,
  coordinatedStorefrontDirectionIdSchema,
  type CoordinatedDirectionRequest,
  type CoordinatedStorefrontDirectionId,
} from "./direction-contract";
import { listCoordinatedStorefrontDirections } from "./direction-registry";

export const P10B_LIVE_SYNTHESIS_INTENT_CONTRACT_VERSION = "1.0.0" as const;

const boundedNarrativePostureSchema = z.enum([
  "story-led",
  "discovery-led",
  "restrained",
  "catalogue-dense",
  "considered-purchase",
  "campaign-led",
]);
const boundedMerchandisingPostureSchema = z.enum([
  "curated",
  "discovery",
  "restrained",
  "dense",
  "considered",
  "campaign",
]);
const boundedInformationDensitySchema = z.enum(["compact", "balanced", "airy"]);
const boundedArtDirectionSchema = z.enum(["contained", "editorial", "immersive"]);
const boundedResponsiveModeSchema = z.enum(["content-first", "commerce-first", "balanced"]);

const safeMerchantContextSchema = z
  .object({
    businessName: z.string().trim().min(1).max(160),
    shortDescription: z.string().trim().min(1).max(500),
    industry: z.string().trim().min(1).max(120).nullable(),
    targetCustomer: z.string().trim().min(1).max(300),
    primaryMarket: z.string().trim().min(1).max(120),
    enabledLocales: z
      .array(z.enum(["en", "fi"]))
      .min(1)
      .max(2),
  })
  .strict();

const catalogueCharacteristicsSchema = z
  .object({
    productCount: z.number().int().nonnegative(),
    collectionCount: z.number().int().nonnegative(),
    configurableProductCount: z.number().int().nonnegative(),
    optionGroupCount: z.number().int().nonnegative(),
    productsWithMultipleMedia: z.number().int().nonnegative(),
    productsWithoutPrice: z.number().int().nonnegative(),
    canonicalCommerceFingerprint: z.string().trim().min(1).max(240),
  })
  .strict();

const evidenceRichnessSchema = z
  .object({
    approvedBriefRevision: z.number().int().positive(),
    approvedFactFamilies: z.array(z.string().trim().min(1).max(80)).max(24),
    approvedFactCount: z.number().int().nonnegative(),
  })
  .strict();

const approvedAssetPostureSchema = z
  .object({
    approvedAssetCount: z.number().int().nonnegative(),
    approvedRoles: z.array(z.string().trim().min(1).max(80)).max(24),
    editorialMediaAvailable: z.boolean(),
  })
  .strict();

const safeDirectionOptionSchema = z
  .object({
    id: coordinatedStorefrontDirectionIdSchema,
    label: z.string().trim().min(1).max(80),
    version: z.string().regex(/^\d+\.\d+\.\d+$/),
    authorityFingerprint: z.string().trim().min(1).max(240),
    synthesisIntent: z.enum(["editorial-led", "commerce-led", "restrained-minimal"]),
    plannerDescription: z.string().trim().min(1).max(400),
    narrativePostures: z.array(boundedNarrativePostureSchema).min(1),
    merchandisingPostures: z.array(boundedMerchandisingPostureSchema).min(1),
    informationDensityPostures: z.array(boundedInformationDensitySchema).min(1),
    artDirectionPostures: z.array(boundedArtDirectionSchema).min(1),
    responsiveModes: z.array(boundedResponsiveModeSchema).min(1),
  })
  .strict();

const liveSynthesisRequestMaterialSchema = z
  .object({
    contractVersion: z.literal(P10B_LIVE_SYNTHESIS_INTENT_CONTRACT_VERSION),
    merchantInstruction: z.string().trim().min(1).max(2_000),
    requestedDirectionId: coordinatedStorefrontDirectionIdSchema.nullable(),
    merchantContext: safeMerchantContextSchema,
    catalogueCharacteristics: catalogueCharacteristicsSchema,
    evidenceRichness: evidenceRichnessSchema,
    approvedAssetPosture: approvedAssetPostureSchema,
    directionOptions: z.array(safeDirectionOptionSchema).min(1).max(3),
    currentAuthorityFingerprint: z.string().trim().min(1).max(240),
  })
  .strict();

export const p10bLiveSynthesisIntentProviderRequestSchema = liveSynthesisRequestMaterialSchema
  .extend({ requestFingerprint: z.string().trim().min(1).max(240) })
  .strict()
  .superRefine((request, context) => {
    const { requestFingerprint, ...material } = request;
    const expected = `p10b-live-synthesis-intent-${canonicalValueFingerprint(material)}`;
    if (requestFingerprint !== expected) {
      context.addIssue({
        code: "custom",
        path: ["requestFingerprint"],
        message: "The live synthesis intent request fingerprint is stale.",
      });
    }
    const directionIds = request.directionOptions.map(({ id }) => id);
    if (new Set(directionIds).size !== directionIds.length) {
      context.addIssue({
        code: "custom",
        path: ["directionOptions"],
        message: "Live synthesis direction options must be unique.",
      });
    }
    if (
      request.requestedDirectionId !== null &&
      (directionIds.length !== 1 || directionIds[0] !== request.requestedDirectionId)
    ) {
      context.addIssue({
        code: "custom",
        path: ["requestedDirectionId"],
        message: "A named live acceptance run must expose only its exact requested direction.",
      });
    }
  });

export const p10bLiveSynthesisIntentProviderResultSchema = z
  .object({
    requestFingerprint: z.string().trim().min(1).max(240),
    directionId: coordinatedStorefrontDirectionIdSchema,
    narrativePosture: boundedNarrativePostureSchema.nullable(),
    merchandisingPosture: boundedMerchandisingPostureSchema.nullable(),
    informationDensityPosture: boundedInformationDensitySchema.nullable(),
    artDirectionPosture: boundedArtDirectionSchema.nullable(),
    responsiveMode: boundedResponsiveModeSchema.nullable(),
  })
  .strict();

export type P10bLiveSynthesisIntentProviderRequest = z.infer<
  typeof p10bLiveSynthesisIntentProviderRequestSchema
>;
export type P10bLiveSynthesisIntentProviderResult = z.infer<
  typeof p10bLiveSynthesisIntentProviderResultSchema
>;

export interface P10bLiveSynthesisIntentProvider {
  readonly id: string;
  readonly modelId: string | null;
  selectIntent(request: P10bLiveSynthesisIntentProviderRequest): Promise<unknown>;
}

export type P10bLiveSynthesisIntentFailureCode =
  | "invalid-request"
  | "credentials-unavailable"
  | "provider-unavailable"
  | "provider-refusal"
  | "malformed-response"
  | "unsupported-selection"
  | "stale-authority";

export class P10bLiveSynthesisIntentError extends Error {
  constructor(readonly code: P10bLiveSynthesisIntentFailureCode) {
    super(
      code === "stale-authority"
        ? "The storefront authority changed while the design was being prepared. Reset and try again."
        : "The storefront design assistant could not prepare this acceptance storefront.",
    );
    this.name = "P10bLiveSynthesisIntentError";
  }
}

export type CreateP10bLiveSynthesisIntentRequestInput = Readonly<{
  merchantInstruction: string;
  requestedDirectionId: CoordinatedStorefrontDirectionId | null;
  merchantContext: z.input<typeof safeMerchantContextSchema>;
  catalogueCharacteristics: z.input<typeof catalogueCharacteristicsSchema>;
  evidenceRichness: z.input<typeof evidenceRichnessSchema>;
  approvedAssetPosture: z.input<typeof approvedAssetPostureSchema>;
  currentAuthorityFingerprint: string;
}>;

function normalizedInstruction(value: string): string {
  const normalized = value.trim();
  if (
    normalized.length === 0 ||
    normalized.length > 2_000 ||
    [...normalized].some((character) => {
      const point = character.codePointAt(0) ?? 0;
      return (point < 32 && ![9, 10, 13].includes(point)) || point === 127;
    })
  ) {
    throw new P10bLiveSynthesisIntentError("invalid-request");
  }
  return normalized;
}

export function createP10bLiveSynthesisIntentProviderRequest(
  input: CreateP10bLiveSynthesisIntentRequestInput,
): P10bLiveSynthesisIntentProviderRequest {
  const requestedDirectionId =
    input.requestedDirectionId === null
      ? null
      : coordinatedStorefrontDirectionIdSchema.parse(input.requestedDirectionId);
  const registeredDirections = listCoordinatedStorefrontDirections().filter(
    ({ id }) => requestedDirectionId === null || id === requestedDirectionId,
  );
  const material = liveSynthesisRequestMaterialSchema.parse({
    contractVersion: P10B_LIVE_SYNTHESIS_INTENT_CONTRACT_VERSION,
    merchantInstruction: normalizedInstruction(input.merchantInstruction),
    requestedDirectionId,
    merchantContext: input.merchantContext,
    catalogueCharacteristics: input.catalogueCharacteristics,
    evidenceRichness: input.evidenceRichness,
    approvedAssetPosture: input.approvedAssetPosture,
    directionOptions: registeredDirections.map((direction) => ({
      id: direction.id,
      label: direction.label,
      version: direction.version,
      authorityFingerprint: direction.authorityFingerprint,
      synthesisIntent: direction.intent,
      plannerDescription: direction.plannerDescription,
      narrativePostures: direction.constraints.narrativePostures,
      merchandisingPostures: direction.constraints.merchandisingPostures,
      informationDensityPostures: direction.constraints.informationDensityPostures,
      artDirectionPostures: direction.constraints.artDirectionPostures,
      responsiveModes: direction.constraints.responsiveModes,
    })),
    currentAuthorityFingerprint: input.currentAuthorityFingerprint,
  });
  return p10bLiveSynthesisIntentProviderRequestSchema.parse({
    ...material,
    requestFingerprint: `p10b-live-synthesis-intent-${canonicalValueFingerprint(material)}`,
  });
}

function assertAllowedValue(value: string | null, allowed: readonly string[]): string | undefined {
  if (value === null) return undefined;
  if (!allowed.includes(value)) throw new P10bLiveSynthesisIntentError("unsupported-selection");
  return value;
}

export function validateP10bLiveSynthesisIntentProviderResult(
  requestInput: unknown,
  resultInput: unknown,
): CoordinatedDirectionRequest {
  const request = p10bLiveSynthesisIntentProviderRequestSchema.safeParse(requestInput);
  if (!request.success) throw new P10bLiveSynthesisIntentError("invalid-request");
  const result = p10bLiveSynthesisIntentProviderResultSchema.safeParse(resultInput);
  if (!result.success) throw new P10bLiveSynthesisIntentError("malformed-response");
  if (result.data.requestFingerprint !== request.data.requestFingerprint) {
    throw new P10bLiveSynthesisIntentError("stale-authority");
  }
  const option = request.data.directionOptions.find(({ id }) => id === result.data.directionId);
  if (!option) throw new P10bLiveSynthesisIntentError("unsupported-selection");
  const boundedSelections = [
    result.data.narrativePosture,
    result.data.merchandisingPosture,
    result.data.informationDensityPosture,
    result.data.artDirectionPosture,
    result.data.responsiveMode,
  ];
  if (
    request.data.requestedDirectionId !== null &&
    boundedSelections.every((selection) => selection === null)
  ) {
    throw new P10bLiveSynthesisIntentError("unsupported-selection");
  }
  const characteristics = {
    narrativePosture: assertAllowedValue(result.data.narrativePosture, option.narrativePostures),
    merchandisingPosture: assertAllowedValue(
      result.data.merchandisingPosture,
      option.merchandisingPostures,
    ),
    informationDensityPosture: assertAllowedValue(
      result.data.informationDensityPosture,
      option.informationDensityPostures,
    ),
    artDirectionPosture: assertAllowedValue(
      result.data.artDirectionPosture,
      option.artDirectionPostures,
    ),
    responsiveMode: assertAllowedValue(result.data.responsiveMode, option.responsiveModes),
  };
  return coordinatedDirectionRequestSchema.parse({
    directionId: result.data.directionId,
    deterministicSeed: `p10b-live-${canonicalValueFingerprint(result.data)}`,
    characteristics: Object.fromEntries(
      Object.entries(characteristics).filter(
        (entry): entry is [string, string] => entry[1] !== undefined,
      ),
    ),
  });
}
