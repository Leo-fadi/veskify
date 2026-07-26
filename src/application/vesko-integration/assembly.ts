import { createHash } from "node:crypto";

import {
  createStandaloneMerchantProjectContextPort,
  type MerchantProjectContextPort,
  type MerchantProjectPermission,
  type MerchantProjectRole,
} from "@/application/merchant-project-context";
import {
  createStorefrontDraftPersistenceAdapter,
  type DraftSaveProvenanceSource,
} from "@/application/storefront-draft-persistence";
import type { CatalogueDisplayModel } from "@/domain/catalogue";
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
  const ports: VeskoIntegrationPorts = {
    context: input.context,
    catalogue: input.catalogue,
    availability: input.availability,
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

function canonicalProductTypeId(productType: string): string {
  const normalized = productType
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-");
  if (idSchema.safeParse(normalized).success) return normalized;
  return `product_type_${createHash("sha256").update(productType).digest("hex").slice(0, 24)}`;
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

function projectCatalogueToP9Port(
  source: StorefrontCatalogueProjection,
  identity: StandaloneVeskoIntegrationIdentity,
  catalogueId: string,
  catalogueRevision: string,
) {
  const routes = new Map(source.routeReferences.map((route) => [route.id, route]));
  return catalogueProjectionSchema.parse({
    tenantId: identity.tenantId,
    storeId: identity.storeId,
    storefrontProjectId: identity.storefrontProjectId,
    catalogueId,
    revision: catalogueRevision,
    products: source.products.map((product) => ({
      productId: product.id,
      slug: product.slug,
      title: product.title,
      description: product.description,
      productTypeId: canonicalProductTypeId(product.productType),
      sku: product.sku,
      price: product.price,
      compareAtPrice: product.compareAtPrice,
      priceUnavailableReason: product.priceUnavailableReason,
      availabilityLabel: product.availabilityLabel,
    })),
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
        return projectCatalogueToP9Port(
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

/**
 * Composes the existing credential-free repository and fixture adapters into
 * one complete project-scoped P9 port set. This is intentionally separate
 * from integrated composition: its named revision strategy is standalone-only.
 */
export function createStandaloneVeskoIntegrationAssembly(
  input: StandaloneVeskoIntegrationAssemblyInput,
): VeskoIntegrationPorts {
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
  const catalogueRevision = standaloneAvailabilityOptionMediaCatalogueRevision(input.catalogue);
  const availabilityIdentity: StandaloneAvailabilityOptionMediaIdentity = {
    tenantId: input.identity.tenantId,
    storeId: input.identity.storeId,
    storefrontProjectId: input.identity.storefrontProjectId,
  };

  return createVeskoIntegrationPorts({
    context,
    catalogue: createStandaloneCataloguePort({
      projectRepository: input.projectRepository,
      catalogue: input.catalogue,
      identity: input.identity,
      catalogueRevision,
    }),
    availability: createStandaloneAvailabilityOptionMediaProjectionAdapter(input.catalogue, {
      identity: availabilityIdentity,
      catalogueId: input.catalogue.id,
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
