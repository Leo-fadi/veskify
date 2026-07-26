import { z } from "zod";

import {
  createMerchantProjectAuthorization,
  requireMerchantProjectAction,
  type MerchantProjectContextPort,
} from "@/application/merchant-project-context";
import {
  catalogueProjectionSchema,
  VeskoIntegrationError,
  type CatalogueProjectionPort,
  type IntegrationFailureCode,
  type MerchantProjectContext,
} from "@/application/vesko-integration";
import { canonicalLocaleOrder, type Locale } from "@/domain/shared";
import {
  createCatalogueProjectionProvider,
  storefrontCatalogueProjectionSchema,
  type StorefrontCatalogueProjection,
} from "@/integrations/vesko-catalogue/catalogue-projection-adapter";

export type StagingCatalogueNavigationLoadContext = Parameters<CatalogueProjectionPort["load"]>[0];

const stagingCatalogueNavigationLoadContextSchema = z
  .object({
    tenantId: catalogueProjectionSchema.shape.tenantId,
    storeId: catalogueProjectionSchema.shape.storeId,
    storefrontProjectId: catalogueProjectionSchema.shape.storefrontProjectId,
    expectedRevision: catalogueProjectionSchema.shape.revision.optional(),
  })
  .strict();

/**
 * This is a Studio-owned staging fixture boundary, not a claim about a Vesko HTTP endpoint.
 * P10-01 can bind its shared authenticated transport to this request shape when the real
 * staging API contract is supplied.
 */
export const stagingCatalogueNavigationEnvelopeSchema = z
  .object({
    tenantId: catalogueProjectionSchema.shape.tenantId,
    storeId: catalogueProjectionSchema.shape.storeId,
    storefrontProjectId: catalogueProjectionSchema.shape.storefrontProjectId,
    catalogueRevision: catalogueProjectionSchema.shape.revision,
    projection: z.unknown(),
  })
  .strict();

export type StagingCatalogueNavigationEnvelope = z.infer<
  typeof stagingCatalogueNavigationEnvelopeSchema
>;

export type StagingCatalogueNavigationProjection = Readonly<{
  catalogueRevision: string;
  projection: StorefrontCatalogueProjection;
}>;

export interface StagingCatalogueNavigationTransport {
  load(context: Readonly<StagingCatalogueNavigationLoadContext>): Promise<unknown>;
}

export type StagingCatalogueNavigationAdapterInput = Readonly<{
  contextPort: MerchantProjectContextPort;
  transport: StagingCatalogueNavigationTransport;
}>;

export interface StagingCatalogueNavigationProjectionPort {
  load(
    context: Readonly<StagingCatalogueNavigationLoadContext>,
  ): Promise<StagingCatalogueNavigationProjection>;
}

function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    Object.values(value as Record<string, unknown>).forEach((item) => deepFreeze(item));
  }
  return value;
}

function validationFailure(error: z.ZodError): IntegrationFailureCode {
  if (
    error.issues.some(
      (issue) =>
        issue.path.includes("supportedLocales") ||
        (issue.code === "unrecognized_keys" &&
          issue.keys.some((key) => key === "en" || key === "fi" || key.length === 2)),
    )
  ) {
    return "unsupportedLocale";
  }
  const message = error.issues.map((issue) => issue.message).join(" ");
  if (/unique|duplicate|path and locale ownership/i.test(message)) {
    return "duplicateCanonicalIdentity";
  }
  if (/reference|known|owning|hierarchy|route|cycle/i.test(message)) {
    return "brokenCatalogueReference";
  }
  return "malformedIntegrationResponse";
}

function assertProjectionLocales(
  projection: StorefrontCatalogueProjection,
  enabledLocales: readonly Locale[],
): void {
  if (!projection.supportedLocales.every((locale) => enabledLocales.includes(locale))) {
    throw new VeskoIntegrationError("unsupportedLocale");
  }

  const supported = new Set(projection.supportedLocales);
  const visit = (value: unknown): void => {
    if (Array.isArray(value)) {
      value.forEach(visit);
      return;
    }
    if (value === null || typeof value !== "object") return;

    const entries = Object.entries(value as Record<string, unknown>);
    const localized =
      entries.length > 0 &&
      entries.every(([key, item]) => (key === "en" || key === "fi") && typeof item === "string");
    if (localized && entries.some(([locale]) => !supported.has(locale as Locale))) {
      throw new VeskoIntegrationError("unsupportedLocale");
    }
    entries.forEach(([, item]) => visit(item));
  };

  visit(projection);
}

async function authorizeRead(
  contextPort: MerchantProjectContextPort,
  context: StagingCatalogueNavigationLoadContext,
): Promise<MerchantProjectContext> {
  try {
    const current = await contextPort.load({
      tenantId: context.tenantId,
      storefrontProjectId: context.storefrontProjectId,
    });
    if (current.storeId !== context.storeId) throw new VeskoIntegrationError("merchantNotFound");
    return requireMerchantProjectAction(
      createMerchantProjectAuthorization(current),
      "view-storefront",
    );
  } catch (error) {
    if (error instanceof VeskoIntegrationError) throw error;
    throw new VeskoIntegrationError("authenticationUnavailable");
  }
}

function assertEnvelopeScope(
  envelope: StagingCatalogueNavigationEnvelope & { projection: StorefrontCatalogueProjection },
  context: StagingCatalogueNavigationLoadContext,
  authenticated: MerchantProjectContext,
): void {
  if (envelope.tenantId !== context.tenantId) throw new VeskoIntegrationError("tenantMismatch");
  if (envelope.storeId !== context.storeId) throw new VeskoIntegrationError("merchantNotFound");
  if (envelope.storefrontProjectId !== context.storefrontProjectId) {
    throw new VeskoIntegrationError("projectMismatch");
  }
  if (
    context.expectedRevision !== undefined &&
    envelope.catalogueRevision !== context.expectedRevision
  ) {
    throw new VeskoIntegrationError("staleCatalogueProjection");
  }
  if (
    envelope.projection.project.id !== authenticated.storefrontProjectId ||
    envelope.projection.merchant.id !== authenticated.merchantId ||
    envelope.projection.project.merchantId !== authenticated.merchantId
  ) {
    throw new VeskoIntegrationError("brokenCatalogueReference");
  }
}

/**
 * Validates a scoped staging fixture/response and returns the normalized P9-03 projection with
 * its opaque Vesko catalogue revision. This adapter intentionally owns no HTTP, credential or
 * cache implementation.
 */
export function createStagingCatalogueNavigationProjectionAdapter(
  input: StagingCatalogueNavigationAdapterInput,
): StagingCatalogueNavigationProjectionPort {
  return {
    async load(contextInput) {
      const contextResult = stagingCatalogueNavigationLoadContextSchema.safeParse(contextInput);
      if (!contextResult.success) throw new VeskoIntegrationError("malformedIntegrationResponse");
      const context = contextResult.data;
      const authenticated = await authorizeRead(input.contextPort, context);

      let raw: unknown;
      try {
        raw = await input.transport.load(deepFreeze(structuredClone(context)));
      } catch (error) {
        if (error instanceof VeskoIntegrationError) throw error;
        throw new VeskoIntegrationError("catalogueUnavailable");
      }

      const envelopeResult = stagingCatalogueNavigationEnvelopeSchema.safeParse(raw);
      if (!envelopeResult.success) {
        throw new VeskoIntegrationError(validationFailure(envelopeResult.error));
      }
      const projectionResult = storefrontCatalogueProjectionSchema.safeParse(
        envelopeResult.data.projection,
      );
      if (!projectionResult.success) {
        throw new VeskoIntegrationError(validationFailure(projectionResult.error));
      }
      const envelope: StagingCatalogueNavigationEnvelope & {
        projection: StorefrontCatalogueProjection;
      } = { ...envelopeResult.data, projection: projectionResult.data };
      assertEnvelopeScope(envelope, context, authenticated);
      assertProjectionLocales(
        projectionResult.data,
        canonicalLocaleOrder(authenticated.enabledLocales),
      );

      try {
        const projection = await createCatalogueProjectionProvider({
          transport: { load: () => projectionResult.data },
        }).load();
        return deepFreeze({ catalogueRevision: envelope.catalogueRevision, projection });
      } catch (error) {
        if (error instanceof VeskoIntegrationError) throw error;
        throw new VeskoIntegrationError("malformedIntegrationResponse");
      }
    },
  };
}
