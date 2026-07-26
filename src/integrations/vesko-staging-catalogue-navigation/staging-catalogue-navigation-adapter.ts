import { z } from "zod";

import {
  createMerchantProjectAuthorization,
  requireMerchantProjectAction,
  type MerchantProjectContextPort,
} from "@/application/merchant-project-context";
import {
  catalogueProjectionSchema,
  projectStorefrontCatalogueToCanonicalProjection,
  VeskoIntegrationError,
  type CatalogueProjectionPort,
  type IntegrationFailureCode,
  type MerchantProjectContext,
} from "@/application/vesko-integration";
import { canonicalLocaleOrder, type Locale, type LocalizedText } from "@/domain/shared";
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

export interface StagingCatalogueNavigationTransport {
  load(context: Readonly<StagingCatalogueNavigationLoadContext>): Promise<unknown>;
}

export type StagingCatalogueNavigationAdapterInput = Readonly<{
  contextPort: MerchantProjectContextPort;
  transport: StagingCatalogueNavigationTransport;
}>;

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
  const projectionLocales = new Set(projection.supportedLocales);
  const projectLocales = new Set<string>(enabledLocales);
  if (
    projectionLocales.size !== projectLocales.size ||
    [...projectionLocales].some((locale) => !projectLocales.has(locale))
  ) {
    throw new VeskoIntegrationError("unsupportedLocale");
  }

  const assertLocalizedText = (value: LocalizedText | undefined): void => {
    if (value !== undefined && Object.keys(value).some((locale) => !projectLocales.has(locale))) {
      throw new VeskoIntegrationError("unsupportedLocale");
    }
  };

  assertLocalizedText(projection.catalogueSafeTitle);
  projection.products.forEach((product) => {
    assertLocalizedText(product.title);
    assertLocalizedText(product.description);
    assertLocalizedText(product.priceUnavailableReason);
    assertLocalizedText(product.availabilityLabel);
    product.images.forEach((image) => assertLocalizedText(image.alt));
    product.variants.forEach((variant) => assertLocalizedText(variant.label));
    product.orderOptions?.forEach((option) => {
      assertLocalizedText(option.label);
      option.values?.forEach(assertLocalizedText);
    });
    assertLocalizedText(product.seo?.title);
    assertLocalizedText(product.seo?.metaDescription);
  });
  projection.collections.forEach((collection) => {
    assertLocalizedText(collection.title);
    assertLocalizedText(collection.description);
  });
  projection.categories.forEach((category) => assertLocalizedText(category.title));
  projection.navigation.forEach((item) => assertLocalizedText(item.label));
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
    if (current.tenantId !== context.tenantId) throw new VeskoIntegrationError("tenantMismatch");
    if (current.storeId !== context.storeId) throw new VeskoIntegrationError("merchantNotFound");
    if (current.storefrontProjectId !== context.storefrontProjectId) {
      throw new VeskoIntegrationError("projectMismatch");
    }
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
 * Validates a scoped staging fixture/response and returns the canonical P9-01 catalogue
 * projection. This adapter intentionally owns no HTTP, credential or cache implementation.
 */
export function createStagingCatalogueNavigationProjectionAdapter(
  input: StagingCatalogueNavigationAdapterInput,
): CatalogueProjectionPort {
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
        return deepFreeze(
          projectStorefrontCatalogueToCanonicalProjection(
            projection,
            {
              tenantId: authenticated.tenantId,
              storeId: authenticated.storeId,
              storefrontProjectId: authenticated.storefrontProjectId,
            },
            projection.id,
            envelope.catalogueRevision,
          ),
        );
      } catch (error) {
        if (error instanceof VeskoIntegrationError) throw error;
        throw new VeskoIntegrationError("malformedIntegrationResponse");
      }
    },
  };
}
