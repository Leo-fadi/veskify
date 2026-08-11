import { z } from "zod";
import { canonicalValueFingerprint } from "@/domain/storefront";
import {
  coordinatedDirectionRequestSchema,
  coordinatedStorefrontDirectionIdSchema,
  type CoordinatedDirectionRequest,
  type CoordinatedStorefrontDirectionId,
} from "./direction-contract";
import {
  executableCoordinatedDirectionDeterministicSeed,
  listExecutableCoordinatedDirectionIntents,
  MAX_EXECUTABLE_COORDINATED_DIRECTION_INTENTS,
  type CoordinatedDirectionExecutionInput,
  type CoordinatedDirectionResult,
} from "./coordinated-directions";
import { listCoordinatedStorefrontDirections } from "./direction-registry";

export const P10B_LIVE_SYNTHESIS_INTENT_CONTRACT_VERSION = "2.0.0" as const;

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

const executableCharacteristicsSchema = z
  .object({
    narrativePosture: boundedNarrativePostureSchema,
    merchandisingPosture: boundedMerchandisingPostureSchema,
    informationDensityPosture: boundedInformationDensitySchema,
    artDirectionPosture: boundedArtDirectionSchema,
    responsiveMode: boundedResponsiveModeSchema,
  })
  .strict();

const safeExecutableIntentOptionSchema = z
  .object({
    intentId: z.string().trim().min(1).max(240),
    directionId: coordinatedStorefrontDirectionIdSchema,
    directionLabel: z.string().trim().min(1).max(80),
    directionVersion: z.string().regex(/^\d+\.\d+\.\d+$/),
    directionAuthorityFingerprint: z.string().trim().min(1).max(240),
    description: z.string().trim().min(1).max(400),
    characteristics: executableCharacteristicsSchema,
    expectedExecutionFingerprint: z.string().trim().min(1).max(240),
    executableIntentFingerprint: z.string().trim().min(1).max(240),
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
    executableIntents: z.array(safeExecutableIntentOptionSchema).min(1).max(48),
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
    const intentIds = request.executableIntents.map(({ intentId }) => intentId);
    if (new Set(intentIds).size !== intentIds.length) {
      context.addIssue({
        code: "custom",
        path: ["executableIntents"],
        message: "Live synthesis executable intent IDs must be unique.",
      });
    }
    const intentFingerprints = request.executableIntents.map(
      ({ executableIntentFingerprint }) => executableIntentFingerprint,
    );
    if (new Set(intentFingerprints).size !== intentFingerprints.length) {
      context.addIssue({
        code: "custom",
        path: ["executableIntents"],
        message: "Live synthesis executable intent fingerprints must be unique.",
      });
    }
    request.executableIntents.forEach((option, index) => {
      const { executableIntentFingerprint, ...optionMaterial } = option;
      const expectedIntentFingerprint = `p10b-live-executable-intent-${canonicalValueFingerprint({
        contractVersion: request.contractVersion,
        currentAuthorityFingerprint: request.currentAuthorityFingerprint,
        ...optionMaterial,
      })}`;
      if (executableIntentFingerprint !== expectedIntentFingerprint) {
        context.addIssue({
          code: "custom",
          path: ["executableIntents", index, "executableIntentFingerprint"],
          message: "The executable intent fingerprint is stale.",
        });
      }
    });
    const directionIds = new Set(request.executableIntents.map(({ directionId }) => directionId));
    if (
      request.requestedDirectionId !== null &&
      (directionIds.size !== 1 || !directionIds.has(request.requestedDirectionId))
    ) {
      context.addIssue({
        code: "custom",
        path: ["requestedDirectionId"],
        message:
          "A named live acceptance run must expose only executable intents for its requested direction.",
      });
    }
  });

export const p10bLiveSynthesisIntentProviderResultSchema = z
  .object({
    requestFingerprint: z.string().trim().min(1).max(240),
    executableIntentId: z.string().trim().min(1).max(240),
    executableIntentFingerprint: z.string().trim().min(1).max(240),
  })
  .strict();

export type P10bLiveSynthesisIntentProviderRequest = z.infer<
  typeof p10bLiveSynthesisIntentProviderRequestSchema
>;
export type P10bLiveSynthesisIntentProviderResult = z.infer<
  typeof p10bLiveSynthesisIntentProviderResultSchema
>;

export function p10bLiveSynthesisExecutableResultFingerprint(
  result: CoordinatedDirectionResult,
): string {
  return `p10b-live-executable-result-${canonicalValueFingerprint({
    directionAuthorityFingerprint: result.direction.authorityFingerprint,
    directionFingerprint: result.directionFingerprint,
    selectionFingerprint: canonicalValueFingerprint(result.narrowing),
    synthesisFingerprint: result.decision.synthesisFingerprint,
    structuralDiversityFingerprint: result.diversity.structuralFingerprint,
    snapshotFingerprint: result.synthesis.materialization.snapshotFingerprint,
  })}`;
}

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
  | "no-executable-compatible-intent"
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
  executionAuthority: Omit<
    CoordinatedDirectionExecutionInput,
    "directionRequest" | "usedDiversityFingerprints"
  >;
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

function freezeAuthorityValue<T>(value: T): T {
  if (typeof value === "object" && value !== null && !Object.isFrozen(value)) {
    Object.values(value as Record<string, unknown>).forEach(freezeAuthorityValue);
    Object.freeze(value);
  }
  return value;
}

function executableIntentDescription(
  directionLabel: string,
  characteristics: z.infer<typeof executableCharacteristicsSchema>,
): string {
  return `${directionLabel}: ${characteristics.narrativePosture} narrative, ${characteristics.merchandisingPosture} merchandising, ${characteristics.informationDensityPosture} density, ${characteristics.artDirectionPosture} art direction and ${characteristics.responsiveMode} responsive posture.`;
}

function executableIntentFingerprint(
  currentAuthorityFingerprint: string,
  optionMaterial: Omit<
    z.infer<typeof safeExecutableIntentOptionSchema>,
    "executableIntentFingerprint"
  >,
): string {
  return `p10b-live-executable-intent-${canonicalValueFingerprint({
    contractVersion: P10B_LIVE_SYNTHESIS_INTENT_CONTRACT_VERSION,
    currentAuthorityFingerprint,
    ...optionMaterial,
  })}`;
}

export type P10bLiveSynthesisIntentPreflightAuthority = Readonly<{
  request: P10bLiveSynthesisIntentProviderRequest;
  resolveExecutableResult: (
    executableIntentFingerprint: string,
  ) => CoordinatedDirectionResult | null;
}>;

export function createP10bLiveSynthesisIntentPreflightAuthority(
  input: CreateP10bLiveSynthesisIntentRequestInput,
): P10bLiveSynthesisIntentPreflightAuthority {
  const requestedDirectionId =
    input.requestedDirectionId === null
      ? null
      : coordinatedStorefrontDirectionIdSchema.parse(input.requestedDirectionId);
  const registeredDirections = listCoordinatedStorefrontDirections().filter(
    ({ id }) => requestedDirectionId === null || id === requestedDirectionId,
  );
  const executableResults = new Map<string, CoordinatedDirectionResult>();
  const executableIntents = registeredDirections.flatMap((direction) =>
    listExecutableCoordinatedDirectionIntents(
      {
        ...input.executionAuthority,
        directionId: direction.id,
        currentAuthorityFingerprint: input.currentAuthorityFingerprint,
      },
      { maximumIntents: MAX_EXECUTABLE_COORDINATED_DIRECTION_INTENTS },
    ).map((intent) => {
      const optionMaterial = {
        intentId: intent.intentId,
        directionId: direction.id,
        directionLabel: direction.label,
        directionVersion: direction.version,
        directionAuthorityFingerprint: direction.authorityFingerprint,
        description: executableIntentDescription(direction.label, intent.characteristics),
        characteristics: intent.characteristics,
        expectedExecutionFingerprint: p10bLiveSynthesisExecutableResultFingerprint(intent.result),
      } satisfies Omit<
        z.infer<typeof safeExecutableIntentOptionSchema>,
        "executableIntentFingerprint"
      >;
      const option = {
        ...optionMaterial,
        executableIntentFingerprint: executableIntentFingerprint(
          input.currentAuthorityFingerprint,
          optionMaterial,
        ),
      };
      executableResults.set(option.executableIntentFingerprint, intent.result);
      return option;
    }),
  );
  if (executableIntents.length === 0) {
    throw new P10bLiveSynthesisIntentError("no-executable-compatible-intent");
  }
  const material = liveSynthesisRequestMaterialSchema.parse({
    contractVersion: P10B_LIVE_SYNTHESIS_INTENT_CONTRACT_VERSION,
    merchantInstruction: normalizedInstruction(input.merchantInstruction),
    requestedDirectionId,
    merchantContext: input.merchantContext,
    catalogueCharacteristics: input.catalogueCharacteristics,
    evidenceRichness: input.evidenceRichness,
    approvedAssetPosture: input.approvedAssetPosture,
    executableIntents,
    currentAuthorityFingerprint: input.currentAuthorityFingerprint,
  });
  const request = freezeAuthorityValue(
    p10bLiveSynthesisIntentProviderRequestSchema.parse({
      ...material,
      requestFingerprint: `p10b-live-synthesis-intent-${canonicalValueFingerprint(material)}`,
    }),
  );
  return Object.freeze({
    request,
    resolveExecutableResult(executableIntentFingerprint: string) {
      return executableResults.get(executableIntentFingerprint) ?? null;
    },
  });
}

export function createP10bLiveSynthesisIntentProviderRequest(
  input: CreateP10bLiveSynthesisIntentRequestInput,
): P10bLiveSynthesisIntentProviderRequest {
  return createP10bLiveSynthesisIntentPreflightAuthority(input).request;
}

export type ValidatedP10bLiveSynthesisIntent = Readonly<{
  directionRequest: CoordinatedDirectionRequest;
  executableIntentId: string;
  executableIntentFingerprint: string;
  expectedExecutionFingerprint: string;
}>;

export function validateP10bLiveSynthesisIntentProviderResult(
  requestInput: unknown,
  resultInput: unknown,
): ValidatedP10bLiveSynthesisIntent {
  const request = p10bLiveSynthesisIntentProviderRequestSchema.safeParse(requestInput);
  if (!request.success) throw new P10bLiveSynthesisIntentError("invalid-request");
  const result = p10bLiveSynthesisIntentProviderResultSchema.safeParse(resultInput);
  if (!result.success) throw new P10bLiveSynthesisIntentError("malformed-response");
  if (result.data.requestFingerprint !== request.data.requestFingerprint) {
    throw new P10bLiveSynthesisIntentError("stale-authority");
  }
  const option = request.data.executableIntents.find(
    ({ intentId }) => intentId === result.data.executableIntentId,
  );
  if (!option) throw new P10bLiveSynthesisIntentError("unsupported-selection");
  if (result.data.executableIntentFingerprint !== option.executableIntentFingerprint) {
    throw new P10bLiveSynthesisIntentError("stale-authority");
  }
  const directionRequest = coordinatedDirectionRequestSchema.parse({
    directionId: option.directionId,
    deterministicSeed: executableCoordinatedDirectionDeterministicSeed({
      currentAuthorityFingerprint: request.data.currentAuthorityFingerprint,
      directionAuthorityFingerprint: option.directionAuthorityFingerprint,
      intentId: option.intentId,
    }),
    characteristics: option.characteristics,
  });
  return Object.freeze({
    directionRequest,
    executableIntentId: option.intentId,
    executableIntentFingerprint: option.executableIntentFingerprint,
    expectedExecutionFingerprint: option.expectedExecutionFingerprint,
  });
}
