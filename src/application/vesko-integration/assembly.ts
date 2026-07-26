import { createHash } from "node:crypto";

import {
  createStandaloneMerchantProjectContextPort,
  createMerchantProjectAuthorization,
  requireMerchantProjectAction,
  type MerchantProjectContextPort,
  type MerchantProjectPermission,
  type MerchantProjectRole,
} from "@/application/merchant-project-context";
import {
  createStorefrontDraftPersistenceAdapter,
  type DraftSaveProvenanceSource,
} from "@/application/storefront-draft-persistence";
import { catalogueDisplayModelSchema, type CatalogueDisplayModel } from "@/domain/catalogue";
import { canonicalLocaleOrder, idSchema, type Locale } from "@/domain/shared";
import { canonicalValueString } from "@/domain/storefront";
import {
  createStandaloneAvailabilityOptionMediaProjectionAdapter,
  standaloneAvailabilityOptionMediaCatalogueRevision,
  type StandaloneAvailabilityOptionMediaIdentity,
} from "@/integrations/vesko-availability-options-media/availability-option-media-projection-adapter";
import {
  createStandaloneCatalogueProjectionAdapter,
  type StorefrontCatalogueProjection,
} from "@/integrations/vesko-catalogue/catalogue-projection-adapter";
import {
  createStandaloneAuthoritativePublishingAdapter,
  type AuthoritativePublishPreparationReader,
} from "@/integrations/vesko-publishing";
import {
  ProjectNotFoundError,
  type AuthoritativePublishingProjectRepository,
  type ProjectRepository,
} from "@/services/storage";
import {
  catalogueProjectionSchema,
  veskoIntegrationCapabilitiesSchema,
  VeskoIntegrationError,
  type CatalogueProjection,
  type CatalogueProjectionPort,
  type MerchantProjectContext,
  type VeskoIntegrationPorts,
} from "./contract";

export type VeskoIntegrationAssemblyInput = Readonly<{
  context: VeskoIntegrationPorts["context"];
  catalogue: VeskoIntegrationPorts["catalogue"];
  availability: VeskoIntegrationPorts["availability"];
  drafts: VeskoIntegrationPorts["drafts"];
  publishing: VeskoIntegrationPorts["publishing"];
  capabilities: VeskoIntegrationPorts["capabilities"];
}>;

/**
 * Composes already-constructed provider-neutral P9 ports. Integrated
 * environments supply their own opaque revision authority through those
 * adapters; this composition does not reinterpret revisions.
 */
export function createVeskoIntegrationPorts(
  input: VeskoIntegrationAssemblyInput,
): VeskoIntegrationPorts {
  const projections = authorizeProjectionPorts(input.context, input.catalogue, input.availability);
  const ports: VeskoIntegrationPorts = {
    context: input.context,
    catalogue: projections.catalogue,
    availability: projections.availability,
    drafts: input.drafts,
    publishing: input.publishing,
    capabilities: veskoIntegrationCapabilitiesSchema.parse(input.capabilities),
  };
  return Object.freeze(ports);
}

export type StandaloneVeskoIntegrationIdentity = Readonly<{
  tenantId: string;
  userId: string;
  merchantId: string;
  organizationId: string;
  storeId: string;
  storefrontProjectId: string;
}>;

export type StandaloneVeskoIntegrationAssemblyInput = Readonly<{
  projectRepository: ProjectRepository & AuthoritativePublishingProjectRepository;
  catalogue: CatalogueDisplayModel;
  identity: StandaloneVeskoIntegrationIdentity;
  saveProvenanceSource: DraftSaveProvenanceSource;
  publishPreparations: AuthoritativePublishPreparationReader;
  roles?: readonly MerchantProjectRole[];
  permissions?: readonly MerchantProjectPermission[];
}>;

export type VeskoIntegrationReadiness = Readonly<{
  completeCanonicalPorts: boolean;
  standaloneCredentialFree: boolean;
  realStagingTransports: "notImplemented";
  phase10StagingAdapters: "readyForEnvironmentSpecificAdapters";
}>;

const standaloneCapabilities = {
  merchantContext: "available",
  catalogueProjection: "available",
  availabilityProjection: "available",
  optionResolution: "available",
  canonicalMedia: "available",
  draftPersistence: "available",
  publishing: "available",
  historyRestoration: "available",
} as const;

function assertScopedLookup(
  input: { tenantId: string; storefrontProjectId: string },
  identity: StandaloneVeskoIntegrationIdentity,
): void {
  if (input.tenantId !== identity.tenantId) throw new VeskoIntegrationError("tenantMismatch");
  if (input.storefrontProjectId !== identity.storefrontProjectId) {
    throw new VeskoIntegrationError("projectMismatch");
  }
}

function assertScopedContext(
  context: MerchantProjectContext,
  identity: StandaloneVeskoIntegrationIdentity,
): void {
  if (context.tenantId !== identity.tenantId) throw new VeskoIntegrationError("tenantMismatch");
  if (context.storefrontProjectId !== identity.storefrontProjectId) {
    throw new VeskoIntegrationError("projectMismatch");
  }
  if (
    context.merchantId !== identity.merchantId ||
    context.organizationId !== identity.organizationId ||
    context.storeId !== identity.storeId
  ) {
    throw new VeskoIntegrationError("merchantNotFound");
  }
  if (context.userId !== identity.userId) throw new VeskoIntegrationError("permissionDenied");
}

function createProjectScopedContextPort(
  source: MerchantProjectContextPort,
  identity: StandaloneVeskoIntegrationIdentity,
): MerchantProjectContextPort {
  return {
    async load(input) {
      assertScopedLookup(input, identity);
      const context = await source.load(input);
      assertScopedContext(context, identity);
      return context;
    },
  };
}

function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    Object.values(value as Record<string, unknown>).forEach((item) => deepFreeze(item));
  }
  return value;
}

function canonicalProductTypeId(productType: string, productTypeId?: string): string {
  if (productTypeId !== undefined) return idSchema.parse(productTypeId);

  const sourceIdentity = productType.normalize("NFC").trim();
  const readableSlug = sourceIdentity
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  const readable = readableSlug.length > 0 ? readableSlug : "type";
  const prefix = "product_type_";
  const directCandidate = `${prefix}${readable}`;
  if (sourceIdentity === readable && directCandidate.length <= 80) {
    return idSchema.parse(directCandidate);
  }

  const hash = createHash("sha256").update(sourceIdentity).digest("hex").slice(0, 16);
  const readableLimit = 80 - prefix.length - hash.length - 1;
  const shortenedReadable = readable.slice(0, readableLimit).replace(/-+$/g, "") || "type";
  return idSchema.parse(`${prefix}${shortenedReadable}_${hash}`);
}

function navigationTarget(
  target: StorefrontCatalogueProjection["routeReferences"][number]["target"],
) {
  switch (target.kind) {
    case "home":
      return { kind: "storefront" as const, destination: "home" as const };
    case "product":
      return { kind: "product" as const, productId: target.productId };
    case "collection":
      return { kind: "collection" as const, collectionId: target.collectionId };
    case "category":
      return { kind: "category" as const, categoryId: target.categoryId };
  }
}

export type CatalogueProjectionScope = Readonly<
  Pick<StandaloneVeskoIntegrationIdentity, "tenantId" | "storeId" | "storefrontProjectId">
>;

/**
 * Projects a validated P9-03 catalogue/navigation projection into the canonical P9-01
 * catalogue port. Both standalone and environment-specific adapters use this single mapping.
 */
export function projectStorefrontCatalogueToCanonicalProjection(
  source: StorefrontCatalogueProjection,
  identity: CatalogueProjectionScope,
  catalogueId: string,
  catalogueRevision: string,
): CatalogueProjection {
  const routes = new Map(source.routeReferences.map((route) => [route.id, route]));
  const productTypeIdentityById = new Map<string, string>();
  const products = source.products.map((product) => {
    const sourceIdentity = product.productType.normalize("NFC").trim();
    const productTypeId = canonicalProductTypeId(product.productType, product.productTypeId);
    const existingSourceIdentity = productTypeIdentityById.get(productTypeId);
    if (existingSourceIdentity !== undefined && existingSourceIdentity !== sourceIdentity) {
      throw new VeskoIntegrationError("duplicateCanonicalIdentity");
    }
    productTypeIdentityById.set(productTypeId, sourceIdentity);
    return {
      productId: product.id,
      slug: product.slug,
      title: product.title,
      description: product.description,
      productTypeId,
      sku: product.sku,
      price: product.price,
      compareAtPrice: product.compareAtPrice,
      priceUnavailableReason: product.priceUnavailableReason,
      availabilityLabel: product.availabilityLabel,
    };
  });
  return catalogueProjectionSchema.parse({
    tenantId: identity.tenantId,
    storeId: identity.storeId,
    storefrontProjectId: identity.storefrontProjectId,
    catalogueId,
    revision: catalogueRevision,
    products,
    collections: source.collections.map((collection) => ({
      collectionId: collection.id,
      slug: collection.slug,
      title: collection.title,
      description: collection.description,
      productIds: collection.productIds,
    })),
    categories: source.categories.map((category) => ({
      categoryId: category.id,
      parentCategoryId: category.parentCategoryId ?? null,
      slug: category.slug,
      title: category.title,
    })),
    navigation: source.navigation.map((item) => {
      const route = routes.get(item.routeReferenceId);
      if (route === undefined) throw new VeskoIntegrationError("brokenCatalogueReference");
      return { navigationId: item.id, target: navigationTarget(route.target) };
    }),
  });
}

function sameLocales(left: readonly Locale[], right: readonly Locale[]): boolean {
  const canonicalLeft = canonicalLocaleOrder([...left]);
  const canonicalRight = canonicalLocaleOrder([...right]);
  return (
    canonicalLeft.length === canonicalRight.length &&
    canonicalLeft.every((locale, index) => locale === canonicalRight[index])
  );
}

function createStandaloneCataloguePort({
  projectRepository,
  catalogue,
  identity,
  catalogueRevision,
}: Pick<StandaloneVeskoIntegrationAssemblyInput, "projectRepository" | "catalogue" | "identity"> & {
  catalogueRevision: string;
}): CatalogueProjectionPort {
  const provider = createStandaloneCatalogueProjectionAdapter(catalogue);

  return {
    async load(input) {
      assertScopedLookup(input, identity);
      if (input.storeId !== identity.storeId) throw new VeskoIntegrationError("merchantNotFound");
      if (input.expectedRevision !== undefined && input.expectedRevision !== catalogueRevision) {
        throw new VeskoIntegrationError("staleCatalogueProjection");
      }
      try {
        const aggregate = await projectRepository.get(identity.storefrontProjectId);
        if (canonicalValueString(aggregate.catalogue) !== canonicalValueString(catalogue)) {
          throw new VeskoIntegrationError("brokenCatalogueReference");
        }
        if (
          !sameLocales(aggregate.project.enabledLocales, (await provider.load()).supportedLocales)
        ) {
          throw new VeskoIntegrationError("brokenCatalogueReference");
        }
        return projectStorefrontCatalogueToCanonicalProjection(
          await provider.load(),
          identity,
          catalogue.id,
          catalogueRevision,
        );
      } catch (error) {
        if (error instanceof VeskoIntegrationError) throw error;
        if (error instanceof ProjectNotFoundError)
          throw new VeskoIntegrationError("projectNotFound");
        throw new VeskoIntegrationError("catalogueUnavailable");
      }
    },
  };
}

function authorizeProjectionRead(
  contextPort: MerchantProjectContextPort,
  input: { tenantId: string; storefrontProjectId: string; storeId: string },
): Promise<MerchantProjectContext> {
  return contextPort
    .load({
      tenantId: input.tenantId,
      storefrontProjectId: input.storefrontProjectId,
    })
    .then((context) => {
      if (context.storeId !== input.storeId) throw new VeskoIntegrationError("merchantNotFound");
      return requireMerchantProjectAction(
        createMerchantProjectAuthorization(context),
        "view-storefront",
      );
    });
}

function authorizeProjectionPorts(
  context: MerchantProjectContextPort,
  catalogue: CatalogueProjectionPort,
  availability: VeskoIntegrationPorts["availability"],
): Pick<VeskoIntegrationPorts, "catalogue" | "availability"> {
  return {
    catalogue: {
      async load(input) {
        await authorizeProjectionRead(context, input);
        return catalogue.load(input);
      },
    },
    availability: {
      async load(input) {
        await authorizeProjectionRead(context, input);
        return availability.load(input);
      },
    },
  };
}

/**
 * Composes the existing credential-free repository and fixture adapters into
 * one complete project-scoped P9 port set. This is intentionally separate
 * from integrated composition: its named revision strategy is standalone-only.
 */
export function createStandaloneVeskoIntegrationAssembly(
  input: StandaloneVeskoIntegrationAssemblyInput,
): VeskoIntegrationPorts {
  const catalogue = deepFreeze(structuredClone(catalogueDisplayModelSchema.parse(input.catalogue)));
  const baseContext = createStandaloneMerchantProjectContextPort({
    projectRepository: input.projectRepository,
    tenantId: input.identity.tenantId,
    userId: input.identity.userId,
    merchantId: input.identity.merchantId,
    organizationId: input.identity.organizationId,
    storeId: input.identity.storeId,
    roles: input.roles,
    permissions: input.permissions,
  });
  const context = createProjectScopedContextPort(baseContext, input.identity);
  const catalogueRevision = standaloneAvailabilityOptionMediaCatalogueRevision(catalogue);
  const availabilityIdentity: StandaloneAvailabilityOptionMediaIdentity = {
    tenantId: input.identity.tenantId,
    storeId: input.identity.storeId,
    storefrontProjectId: input.identity.storefrontProjectId,
  };

  return createVeskoIntegrationPorts({
    context,
    catalogue: createStandaloneCataloguePort({
      projectRepository: input.projectRepository,
      catalogue,
      identity: input.identity,
      catalogueRevision,
    }),
    availability: createStandaloneAvailabilityOptionMediaProjectionAdapter(catalogue, {
      identity: availabilityIdentity,
      catalogueId: catalogue.id,
      catalogueRevision,
    }),
    drafts: createStorefrontDraftPersistenceAdapter({
      projectRepository: input.projectRepository,
      contextPort: context,
      saveProvenanceSource: input.saveProvenanceSource,
    }),
    publishing: createStandaloneAuthoritativePublishingAdapter({
      projectRepository: input.projectRepository,
      contextPort: context,
      publishPreparations: input.publishPreparations,
    }),
    capabilities: standaloneCapabilities,
  });
}

export function integrationReadiness(ports: VeskoIntegrationPorts): VeskoIntegrationReadiness {
  const capabilities = veskoIntegrationCapabilitiesSchema.parse(ports.capabilities);
  const completeCanonicalPorts =
    typeof ports.context.load === "function" &&
    typeof ports.catalogue.load === "function" &&
    typeof ports.availability.load === "function" &&
    typeof ports.drafts.load === "function" &&
    typeof ports.drafts.save === "function" &&
    typeof ports.drafts.restore === "function" &&
    typeof ports.publishing.publish === "function" &&
    Object.values(capabilities).every((capability) => capability === "available");
  return {
    completeCanonicalPorts,
    standaloneCredentialFree: true,
    realStagingTransports: "notImplemented",
    phase10StagingAdapters: "readyForEnvironmentSpecificAdapters",
  };
}
