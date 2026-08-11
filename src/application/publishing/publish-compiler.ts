import { z } from "zod";
import {
  listExecutablePageBlueprintProfiles,
  materializeExecutablePageBlueprint,
  runtimeComponentForPageBlueprintComponent,
  sharedStorefrontFrameProfile,
} from "@/application/storefront-templates";
import {
  createStorefrontPagePaths,
  resolveHomepageProofContent,
  validateRegisteredSnapshot,
  veskifyComponentCapabilityManifest,
  veskifyComponentDefinitionsV2,
  veskifyComponentRegistryV2,
} from "@/components/registry";
import { catalogueDisplayModelSchema, type CatalogueDisplayModel } from "@/domain/catalogue";
import {
  componentVersionSchema,
  validateComponentAssetAssignments,
} from "@/domain/component-platform";
import { brandSystemSchema, resolveBrandSystemDesignDna } from "@/domain/design-system";
import { validateResponsiveImageAuthority } from "@/application/responsive-image-authority";
import {
  DynamicCommerceRouteAuthorityError,
  migrateLegacyDynamicCommerceRoutes,
  validateCurrentDynamicCommercePresentationAuthority,
} from "@/application/dynamic-commerce-routes";
import type { Project } from "@/domain/project";
import { canonicalLocaleOrder, idSchema, localeSchema } from "@/domain/shared";
import {
  canonicalStorefrontContentFingerprint,
  canonicalValueFingerprint,
  canonicalValueString,
  contentSupportFactDocumentSchema,
  dynamicCommercePresentationAuthoritySchema,
  navigationModelSchema,
  pageModelSchema,
  pageFactEvidenceReferenceSchema,
  sharedFrameModelSchema,
  storefrontSnapshotSchema,
  type StorefrontSnapshot,
} from "@/domain/storefront";
import type { ProjectAggregate } from "@/services/storage";
import {
  canonicalProductCardAuthority,
  requireCanonicalProductCardAnatomy,
} from "@/domain/product-card";

export const publishCompilerContractVersion = "1.0.0" as const;
export const publishCompilerVersion = "1.0.0" as const;
export const storefrontSnapshotContractVersion = "1.0.0" as const;

const fingerprintSchema = z.string().trim().min(1).max(300);
const profileAuthoritySchema = z
  .object({
    profileId: z.string().trim().min(1).max(160),
    profileVersion: z.string().trim().min(1).max(120),
    fingerprint: fingerprintSchema,
  })
  .strict();

const componentAuthoritySchema = z
  .object({
    componentType: z.string().trim().min(1).max(80),
    version: componentVersionSchema,
    capabilityFingerprint: fingerprintSchema,
    renderer: z
      .object({
        adapterId: z.string().trim().min(1).max(120),
        exportName: z.string().trim().min(1).max(240),
      })
      .strict(),
  })
  .strict();

const sourceAuthoritySchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("manual") }).strict(),
  z
    .object({
      kind: z.literal("accepted-ai"),
      acceptedReceiptId: idSchema,
      acceptedReceiptFingerprint: fingerprintSchema,
    })
    .strict(),
]);

const localeAuthoritySchema = z
  .object({
    activeLocale: localeSchema,
    primaryLocale: localeSchema,
    supportedLocales: z.array(localeSchema).min(1),
    fingerprint: fingerprintSchema,
  })
  .strict();

const projectLocaleConfigurationSchema = z
  .object({
    activeLocale: localeSchema,
    primaryLocale: localeSchema,
    enabledLocales: z.array(localeSchema).min(1),
  })
  .strict();

const compilerAuthoritySchema = z
  .object({
    snapshotContractVersion: z.string().trim().min(1).max(120),
    manifestVersion: z.string().trim().min(1).max(120),
    manifestFingerprint: fingerprintSchema,
    registryFingerprint: fingerprintSchema,
    componentAuthorities: z.array(componentAuthoritySchema),
    rendererAuthorityFingerprint: fingerprintSchema,
    profileAuthorities: z.array(profileAuthoritySchema),
    sharedFrameFingerprint: fingerprintSchema,
    commerceFingerprint: fingerprintSchema,
    navigationRoutesFingerprint: fingerprintSchema,
    productMediaFingerprint: fingerprintSchema,
    productCardAuthorityFingerprint: fingerprintSchema,
    approvedAssetFingerprint: fingerprintSchema,
    dynamicCommercePresentationFingerprint: fingerprintSchema.optional(),
    migrationStatus: z.enum(["current", "unresolved"]),
    migrationFingerprint: fingerprintSchema,
  })
  .strict();

export const publishCompilerInputSchema = z
  .object({
    contractVersion: z.string().trim().min(1).max(120),
    projectId: idSchema,
    projectRevision: z.number().int().nonnegative(),
    draftId: idSchema,
    draftRevision: z.number().int().nonnegative(),
    sourceSnapshotId: idSchema,
    sourceSnapshotRevision: z.number().int().nonnegative(),
    sourceSnapshotFingerprint: fingerprintSchema,
    sourceAuthority: sourceAuthoritySchema,
    projectLocales: projectLocaleConfigurationSchema,
    snapshot: z.unknown(),
    catalogue: z.unknown(),
    currentEvidenceReferences: z.array(pageFactEvidenceReferenceSchema).default([]),
    authority: compilerAuthoritySchema,
  })
  .strict();

const componentExecutionSchema = z
  .object({
    sectionId: idSchema,
    componentType: z.string().trim().min(1).max(80),
    componentVersion: componentVersionSchema,
    variant: z.string().trim().min(1).max(80),
    rendererTarget: z.literal("published"),
    rendererAdapterId: z.string().trim().min(1).max(120),
    rendererExportName: z.string().trim().min(1).max(240),
    capabilityFingerprint: fingerprintSchema,
  })
  .strict();

export const compiledPublicationResultSchema = z
  .object({
    contractVersion: z.literal(publishCompilerContractVersion),
    compilerVersion: z.literal(publishCompilerVersion),
    projectId: idSchema,
    sourceSnapshot: z
      .object({
        id: idSchema,
        revision: z.number().int().nonnegative(),
        fingerprint: fingerprintSchema,
      })
      .strict(),
    brandSystem: brandSystemSchema,
    sharedFrame: z
      .object({
        navigation: navigationModelSchema,
        frame: sharedFrameModelSchema.optional(),
        componentExecutions: z.array(componentExecutionSchema).default([]),
      })
      .strict(),
    pages: z.array(
      z
        .object({
          page: pageModelSchema,
          componentExecutions: z.array(componentExecutionSchema),
        })
        .strict(),
    ),
    // Optional only for artifacts compiled from pre-P10B-16P-01 snapshots.
    // When present, the exact canonical authority is included in the runtime fingerprint.
    dynamicCommercePresentation: dynamicCommercePresentationAuthoritySchema.optional(),
    contentSupportFactDocuments: z.array(contentSupportFactDocumentSchema).default([]),
    rendererTarget: z.literal("published"),
    localeAuthority: localeAuthoritySchema,
    validationReportFingerprint: fingerprintSchema,
    runtimeFingerprint: fingerprintSchema,
  })
  .strict();

export const publishCompileReceiptSchema = z
  .object({
    id: idSchema,
    version: z.literal(publishCompilerContractVersion),
    compilerVersion: z.literal(publishCompilerVersion),
    sourceAuthorityKind: z.enum(["manual", "accepted-ai"]),
    projectId: idSchema,
    projectRevision: z.number().int().nonnegative(),
    draftId: idSchema,
    draftRevision: z.number().int().nonnegative(),
    sourceSnapshotId: idSchema,
    sourceSnapshotRevision: z.number().int().nonnegative(),
    acceptedReceiptId: idSchema.nullable(),
    acceptedReceiptFingerprint: fingerprintSchema.nullable(),
    sourceSnapshotFingerprint: fingerprintSchema,
    compiledResultFingerprint: fingerprintSchema,
    manifestVersion: z.string().trim().min(1).max(120),
    manifestFingerprint: fingerprintSchema,
    registryFingerprint: fingerprintSchema,
    profileAuthorities: z.array(profileAuthoritySchema),
    commerceFingerprint: fingerprintSchema,
    navigationRoutesFingerprint: fingerprintSchema,
    productMediaFingerprint: fingerprintSchema,
    productCardAuthorityFingerprint: fingerprintSchema,
    approvedAssetFingerprint: fingerprintSchema,
    dynamicCommercePresentationFingerprint: fingerprintSchema.optional(),
    localeAuthority: localeAuthoritySchema,
    migrationStatus: z.literal("current"),
    migrationFingerprint: fingerprintSchema,
    validationReportFingerprint: fingerprintSchema,
    fingerprint: fingerprintSchema,
  })
  .strict();

export const trustedPublishCompilationSchema = z
  .object({
    result: compiledPublicationResultSchema,
    receipt: publishCompileReceiptSchema,
  })
  .strict();

export const preparedPublishCompilationSchema = z
  .object({
    resultIdentity: z
      .object({
        runtimeFingerprint: fingerprintSchema,
        validationReportFingerprint: fingerprintSchema,
        sourceSnapshotId: idSchema,
        sourceSnapshotRevision: z.number().int().nonnegative(),
        sourceSnapshotFingerprint: fingerprintSchema,
      })
      .strict(),
    receipt: publishCompileReceiptSchema,
  })
  .strict();

export type PublishCompilerInput = z.infer<typeof publishCompilerInputSchema>;
export type CompiledPublicationResult = z.infer<typeof compiledPublicationResultSchema>;
export type PublishCompileReceipt = z.infer<typeof publishCompileReceiptSchema>;
export type TrustedPublishCompilation = z.infer<typeof trustedPublishCompilationSchema>;
export type PreparedPublishCompilation = z.infer<typeof preparedPublishCompilationSchema>;

export type PublishCompilerErrorCode =
  | "malformed-compiler-input"
  | "unsupported-compiler-contract-version"
  | "unsupported-snapshot-version"
  | "stale-source-snapshot"
  | "stale-accepted-receipt"
  | "stale-manifest"
  | "stale-registry-authority"
  | "stale-profile-authority"
  | "unknown-component"
  | "unknown-component-version"
  | "unknown-renderer"
  | "incompatible-component-variant-profile"
  | "invalid-ordering-or-omission"
  | "invalid-binding"
  | "protected-commerce-violation"
  | "navigation-route-violation"
  | "product-media-violation"
  | "stale-product-card-authority"
  | "stale-dynamic-commerce-authority"
  | "invalid-approved-asset"
  | "invalid-locale-authority"
  | "duplicate-published-route"
  | "critical-accessibility-failure"
  | "unresolved-migration"
  | "nondeterministic-compiler-result"
  | "prepare-confirmation-compile-mismatch";

export class PublishCompilerError extends Error {
  constructor(
    readonly code: PublishCompilerErrorCode,
    options?: ErrorOptions,
  ) {
    super("The storefront could not be compiled for publication.", options);
    this.name = "PublishCompilerError";
  }
}

function compare(left: string, right: string): number {
  return left === right ? 0 : left < right ? -1 : 1;
}

function deepFreeze<T>(value: T): T {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    Object.values(value as Record<string, unknown>).forEach(deepFreeze);
  }
  return value;
}

function cloneUnknown(input: unknown): unknown {
  try {
    return structuredClone(input);
  } catch (cause) {
    throw new PublishCompilerError("malformed-compiler-input", { cause });
  }
}

function runtimeRegistryFingerprint(): string {
  return `publish-registry-${canonicalValueFingerprint(
    veskifyComponentCapabilityManifest.manifest.entries.map((entry) => ({
      componentType: entry.componentType,
      version: entry.componentDefinitionVersion,
      fingerprint: entry.fingerprint,
    })),
  )}`;
}

function rendererAuthorityFingerprint(): string {
  return `publish-renderers-${canonicalValueFingerprint(
    veskifyComponentCapabilityManifest.manifest.entries.map((entry) => ({
      componentType: entry.componentType,
      variants: entry.variants.map(({ id }) => id),
      renderer: entry.renderer,
    })),
  )}`;
}

function publishedRouteAuthority(snapshot: StorefrontSnapshot) {
  const pagePaths = createStorefrontPagePaths({ snapshot });
  const staticRoutes = snapshot.pages
    .map((page) => ({
      pageId: page.id,
      pageType: page.type,
      path: pagePaths[page.id],
    }))
    .sort(
      (left, right) =>
        compare(left.path, right.path) ||
        compare(left.pageType, right.pageType) ||
        compare(left.pageId, right.pageId),
    );
  const dynamicPresentation = snapshot.dynamicCommercePresentation;
  const routes = dynamicPresentation
    ? [
        ...staticRoutes,
        ...dynamicPresentation.routeInventory.map((route) => ({
          routeId: route.id,
          routeKind: route.kind,
          path: route.route,
          ...(route.kind === "collection" ? { collectionId: route.collectionId } : {}),
          ...(route.kind === "product" ? { productId: route.productId } : {}),
        })),
      ].sort(
        (left, right) =>
          compare(left.path, right.path) ||
          canonicalValueString(left).localeCompare(canonicalValueString(right)),
      )
    : staticRoutes;
  const seenPaths = new Set<string>();
  for (const route of routes) {
    if (seenPaths.has(route.path)) {
      throw new PublishCompilerError("duplicate-published-route");
    }
    seenPaths.add(route.path);
  }
  const homeRoutes = staticRoutes.filter(({ pageType }) => pageType === "home");
  if (homeRoutes.length > 1) {
    throw new PublishCompilerError("duplicate-published-route");
  }
  if (homeRoutes.some(({ path }) => path !== "/")) {
    throw new PublishCompilerError("navigation-route-violation");
  }
  return routes;
}

function navigationRoutesFingerprint(snapshot: StorefrontSnapshot): string {
  return `publish-navigation-${canonicalValueFingerprint({
    navigation: snapshot.navigation,
    routes: publishedRouteAuthority(snapshot),
  })}`;
}

function productMediaFingerprint(catalogue: CatalogueDisplayModel): string {
  return `publish-product-media-${canonicalValueFingerprint(
    catalogue.products.map(({ id, images }) => ({ id, images })),
  )}`;
}

function approvedAssetFingerprint(snapshot: StorefrontSnapshot): string {
  const sharedFrameSections = snapshot.sharedFrame
    ? [
        snapshot.sharedFrame.header,
        snapshot.sharedFrame.footer,
        snapshot.sharedFrame.announcement,
      ].filter((section): section is NonNullable<typeof section> => section !== undefined)
    : [];
  return `publish-approved-assets-${canonicalValueFingerprint(
    [
      ...sharedFrameSections.map((section) => ({
        pageId: snapshot.sharedFrame!.id,
        sectionId: section.id,
        placements: [...(section.approvedAssetPlacements ?? [])].sort(
          (left, right) =>
            compare(left.assetSlotId, right.assetSlotId) || compare(left.assetId, right.assetId),
        ),
        presentations: [...(section.approvedAssetPresentations ?? [])].sort((left, right) =>
          compare(left.assetId, right.assetId),
        ),
      })),
      ...snapshot.pages.flatMap((page) =>
        page.sections.map((section) => ({
          pageId: page.id,
          sectionId: section.id,
          placements: [...(section.approvedAssetPlacements ?? [])].sort(
            (left, right) =>
              compare(left.assetSlotId, right.assetSlotId) || compare(left.assetId, right.assetId),
          ),
          presentations: [...(section.approvedAssetPresentations ?? [])].sort((left, right) =>
            compare(left.assetId, right.assetId),
          ),
        })),
      ),
    ].sort(
      (left, right) =>
        compare(left.pageId, right.pageId) || compare(left.sectionId, right.sectionId),
    ),
  )}`;
}

function projectLocaleAuthority(
  configuration: Pick<Project, "primaryLocale" | "enabledLocales"> & {
    activeLocale: Project["primaryLocale"];
  },
) {
  const supportedLocales = canonicalLocaleOrder(configuration.enabledLocales);
  if (
    configuration.enabledLocales.length === 0 ||
    new Set(configuration.enabledLocales).size !== configuration.enabledLocales.length ||
    supportedLocales.length !== configuration.enabledLocales.length ||
    !supportedLocales.includes(configuration.primaryLocale) ||
    !supportedLocales.includes(configuration.activeLocale) ||
    configuration.activeLocale !== configuration.primaryLocale
  ) {
    throw new PublishCompilerError("invalid-locale-authority");
  }
  const content = {
    activeLocale: configuration.activeLocale,
    primaryLocale: configuration.primaryLocale,
    supportedLocales,
  };
  return {
    ...content,
    fingerprint: `publish-locales-${canonicalValueFingerprint(content)}`,
  };
}

function componentMigrationAuthority() {
  return veskifyComponentCapabilityManifest.manifest.entries.map((entry) => ({
    componentType: entry.componentType,
    version: entry.componentDefinitionVersion,
    migration: entry.migration,
  }));
}

function hasGovernedLegacyDynamicCommerceRoutes(snapshot: StorefrontSnapshot): boolean {
  return snapshot.pages.some((page) =>
    ["collection", "search-results", "product-detail"].includes(page.pageFamily?.familyId ?? ""),
  );
}

function migrationAuthority(
  snapshot: StorefrontSnapshot,
  catalogue: CatalogueDisplayModel,
): Readonly<{
  status: "current" | "unresolved";
  fingerprint: string;
}> {
  const componentMigrations = componentMigrationAuthority();
  if (snapshot.dynamicCommercePresentation) {
    return {
      status: "current",
      fingerprint: `publish-migrations-${canonicalValueFingerprint({
        componentMigrations,
        dynamicCommercePresentationContractVersion:
          snapshot.dynamicCommercePresentation.contractVersion,
      })}`,
    };
  }

  // Pre-page-family snapshots remain a retained compatibility input. A
  // governed per-route collection/search/PDP snapshot, however, is an
  // explicitly migratable predecessor of the compact authority and must not
  // be stamped as current by the publication compiler.
  if (!hasGovernedLegacyDynamicCommerceRoutes(snapshot)) {
    return {
      status: "current",
      fingerprint: `publish-migrations-${canonicalValueFingerprint(componentMigrations)}`,
    };
  }

  const migration = migrateLegacyDynamicCommerceRoutes(snapshot, catalogue);
  const migrationDecision =
    migration.status === "migrated"
      ? {
          status: migration.status,
          authorityFingerprint: migration.authority.authorityFingerprint,
          migratedRouteCount: migration.migratedRouteCount,
        }
      : migration.status === "requires-decision"
        ? { status: migration.status, decisions: migration.decisions }
        : {
            status: migration.status,
            authorityFingerprint: migration.authority.authorityFingerprint,
          };
  return {
    status: "unresolved",
    fingerprint: `publish-migrations-${canonicalValueFingerprint({
      componentMigrations,
      dynamicCommerceMigration: migrationDecision,
    })}`,
  };
}

function componentAuthorities() {
  return veskifyComponentCapabilityManifest.manifest.entries.map((entry) => ({
    componentType: entry.componentType,
    version: entry.componentDefinitionVersion,
    capabilityFingerprint: entry.fingerprint,
    renderer: {
      adapterId: entry.renderer.adapterId,
      exportName: entry.renderer.exportName,
    },
  }));
}

export function createCurrentPublishCompilerInput(
  input: Readonly<{
    aggregate: ProjectAggregate;
    snapshot: StorefrontSnapshot;
    sourceAuthority:
      | Readonly<{ kind: "manual" }>
      | Readonly<{
          kind: "accepted-ai";
          acceptedReceiptId: string;
          acceptedReceiptFingerprint: string;
          profileAuthorities: readonly Readonly<{ profileId: string; fingerprint: string }>[];
        }>;
    currentEvidenceReferences?: readonly z.infer<typeof pageFactEvidenceReferenceSchema>[];
  }>,
): PublishCompilerInput {
  const profileReferences =
    input.sourceAuthority.kind === "accepted-ai" ? input.sourceAuthority.profileAuthorities : [];
  const profiles = profileReferences
    .map((reference) => {
      const current = veskifyComponentCapabilityManifest.getByProfileId(reference.profileId);
      return {
        profileId: reference.profileId,
        profileVersion: current?.profileVersion ?? "unknown",
        fingerprint: reference.fingerprint,
      };
    })
    .sort((left, right) => compare(left.profileId, right.profileId));
  const sourceAuthority =
    input.sourceAuthority.kind === "manual"
      ? input.sourceAuthority
      : {
          kind: "accepted-ai" as const,
          acceptedReceiptId: input.sourceAuthority.acceptedReceiptId,
          acceptedReceiptFingerprint: input.sourceAuthority.acceptedReceiptFingerprint,
        };
  const locales = projectLocaleAuthority({
    activeLocale: input.aggregate.project.primaryLocale,
    primaryLocale: input.aggregate.project.primaryLocale,
    enabledLocales: input.aggregate.project.enabledLocales,
  });
  const migration = migrationAuthority(input.snapshot, input.aggregate.catalogue);
  return publishCompilerInputSchema.parse({
    contractVersion: publishCompilerContractVersion,
    projectId: input.aggregate.project.id,
    projectRevision: input.aggregate.project.revision,
    draftId: input.aggregate.project.draftSnapshotId,
    draftRevision: input.snapshot.revision,
    sourceSnapshotId: input.snapshot.id,
    sourceSnapshotRevision: input.snapshot.revision,
    sourceSnapshotFingerprint: canonicalStorefrontContentFingerprint(input.snapshot),
    sourceAuthority,
    projectLocales: {
      activeLocale: locales.activeLocale,
      primaryLocale: locales.primaryLocale,
      enabledLocales: locales.supportedLocales,
    },
    snapshot: input.snapshot,
    catalogue: input.aggregate.catalogue,
    currentEvidenceReferences: [...(input.currentEvidenceReferences ?? [])],
    authority: {
      snapshotContractVersion: storefrontSnapshotContractVersion,
      manifestVersion: veskifyComponentCapabilityManifest.manifest.version,
      manifestFingerprint: veskifyComponentCapabilityManifest.manifest.fingerprint,
      registryFingerprint: runtimeRegistryFingerprint(),
      componentAuthorities: componentAuthorities(),
      rendererAuthorityFingerprint: rendererAuthorityFingerprint(),
      profileAuthorities: profiles,
      sharedFrameFingerprint: `publish-shared-frame-${canonicalValueFingerprint(sharedStorefrontFrameProfile)}`,
      commerceFingerprint: `publish-commerce-${canonicalValueFingerprint(input.aggregate.catalogue)}`,
      navigationRoutesFingerprint: navigationRoutesFingerprint(input.snapshot),
      productMediaFingerprint: productMediaFingerprint(input.aggregate.catalogue),
      productCardAuthorityFingerprint: canonicalProductCardAuthority.fingerprint,
      approvedAssetFingerprint: approvedAssetFingerprint(input.snapshot),
      ...(input.snapshot.dynamicCommercePresentation
        ? {
            dynamicCommercePresentationFingerprint:
              input.snapshot.dynamicCommercePresentation.authorityFingerprint,
          }
        : {}),
      migrationStatus: migration.status,
      migrationFingerprint: migration.fingerprint,
    },
  });
}

function assertExactAuthority(
  input: PublishCompilerInput,
  snapshot: StorefrontSnapshot,
  catalogue: CatalogueDisplayModel,
): void {
  const authority = input.authority;
  const manifest = veskifyComponentCapabilityManifest.manifest;
  if (authority.snapshotContractVersion !== storefrontSnapshotContractVersion) {
    throw new PublishCompilerError("unsupported-snapshot-version");
  }
  if (
    authority.manifestVersion !== manifest.version ||
    authority.manifestFingerprint !== manifest.fingerprint
  ) {
    throw new PublishCompilerError("stale-manifest");
  }
  if (authority.registryFingerprint !== runtimeRegistryFingerprint()) {
    throw new PublishCompilerError("stale-registry-authority");
  }
  const migration = migrationAuthority(snapshot, catalogue);
  if (
    migration.status !== "current" ||
    authority.migrationStatus !== migration.status ||
    authority.migrationFingerprint !== migration.fingerprint
  ) {
    throw new PublishCompilerError("unresolved-migration");
  }
  if (authority.rendererAuthorityFingerprint !== rendererAuthorityFingerprint()) {
    throw new PublishCompilerError("unknown-renderer", {
      cause: new Error("The registered published-renderer authority changed during compilation."),
    });
  }
  if (authority.productCardAuthorityFingerprint !== canonicalProductCardAuthority.fingerprint) {
    throw new PublishCompilerError("stale-product-card-authority");
  }
  if (
    authority.dynamicCommercePresentationFingerprint !==
    snapshot.dynamicCommercePresentation?.authorityFingerprint
  ) {
    throw new PublishCompilerError("stale-dynamic-commerce-authority");
  }
  if (
    authority.sharedFrameFingerprint !==
    `publish-shared-frame-${canonicalValueFingerprint(sharedStorefrontFrameProfile)}`
  ) {
    throw new PublishCompilerError("stale-profile-authority");
  }
}

function assertComponentAndRendererAuthority(
  input: PublishCompilerInput,
  snapshot: StorefrontSnapshot,
): void {
  const expectedAuthorities = componentAuthorities();
  if (
    input.authority.componentAuthorities.length !== expectedAuthorities.length ||
    input.authority.componentAuthorities.some(
      (authority, index) => authority.componentType !== expectedAuthorities[index]?.componentType,
    )
  ) {
    throw new PublishCompilerError("stale-registry-authority");
  }
  input.authority.componentAuthorities.forEach((authority, index) => {
    const expected = expectedAuthorities[index];
    if (canonicalValueString(authority.version) !== canonicalValueString(expected.version)) {
      throw new PublishCompilerError("unknown-component-version");
    }
    if (authority.capabilityFingerprint !== expected.capabilityFingerprint) {
      throw new PublishCompilerError("stale-registry-authority");
    }
    if (canonicalValueString(authority.renderer) !== canonicalValueString(expected.renderer)) {
      throw new PublishCompilerError("unknown-renderer", {
        cause: new Error(`Component ${authority.componentType} has stale renderer authority.`),
      });
    }
  });
  const supplied = new Map(
    input.authority.componentAuthorities.map((authority) => [authority.componentType, authority]),
  );
  const assertComponentSelection = (
    section: Pick<StorefrontSnapshot["pages"][number]["sections"][number], "component" | "variant">,
    pageType: StorefrontSnapshot["pages"][number]["type"],
  ) => {
    const entry = veskifyComponentCapabilityManifest.getByComponentType(section.component);
    if (!entry) throw new PublishCompilerError("unknown-component");
    if (!entry.allowedPageTypes.includes(pageType)) {
      throw new PublishCompilerError("incompatible-component-variant-profile");
    }
    if (!entry.variants.some(({ id }) => id === section.variant)) {
      throw new PublishCompilerError("incompatible-component-variant-profile");
    }
    const authority = supplied.get(section.component);
    if (!authority) throw new PublishCompilerError("stale-registry-authority");
    if (
      canonicalValueString(authority.version) !==
      canonicalValueString(entry.componentDefinitionVersion)
    ) {
      throw new PublishCompilerError("unknown-component-version");
    }
    if (authority.capabilityFingerprint !== entry.fingerprint) {
      throw new PublishCompilerError("stale-registry-authority");
    }
    if (
      authority.renderer.adapterId !== entry.renderer.adapterId ||
      authority.renderer.exportName !== entry.renderer.exportName
    ) {
      throw new PublishCompilerError("unknown-renderer", {
        cause: new Error(`Component ${section.component} has incompatible renderer authority.`),
      });
    }
    if (!entry.renderer.supportedTargets.includes("published")) {
      throw new PublishCompilerError("unknown-renderer", {
        cause: new Error(
          `Component ${section.component}/${section.variant} has no registered published-renderer target.`,
        ),
      });
    }
  };
  if (snapshot.sharedFrame) {
    for (const section of [
      snapshot.sharedFrame.header,
      snapshot.sharedFrame.footer,
      snapshot.sharedFrame.announcement,
    ]) {
      if (section) assertComponentSelection(section, "home");
    }
  }
  for (const page of snapshot.pages) {
    for (const section of page.sections) {
      assertComponentSelection(section, page.type);
    }
  }
  for (const archetype of snapshot.dynamicCommercePresentation?.collectionSearchArchetypes ?? []) {
    for (const presentation of archetype.componentPresentations) {
      assertComponentSelection(presentation, "collection");
    }
  }
  for (const archetype of snapshot.dynamicCommercePresentation?.productDetailArchetypes ?? []) {
    for (const presentation of archetype.componentPresentations) {
      assertComponentSelection(presentation, "product");
    }
  }
}

function assertProfiles(input: PublishCompilerInput, snapshot: StorefrontSnapshot): void {
  const effectivePageSections = (page: StorefrontSnapshot["pages"][number]) =>
    snapshot.sharedFrame
      ? [
          ...(page.type === "home" && snapshot.sharedFrame.announcement
            ? [snapshot.sharedFrame.announcement]
            : []),
          snapshot.sharedFrame.header,
          ...page.sections,
          snapshot.sharedFrame.footer,
        ]
      : page.sections;
  const dynamicArchetypes = [
    ...(snapshot.dynamicCommercePresentation?.collectionSearchArchetypes ?? []),
    ...(snapshot.dynamicCommercePresentation?.productDetailArchetypes ?? []),
  ];
  const dynamicProfiles = dynamicArchetypes.map(({ profile }) => profile);
  for (const archetype of dynamicArchetypes) {
    const current = veskifyComponentCapabilityManifest.getByProfileId(archetype.profile.profileId);
    const pagePlan = listExecutablePageBlueprintProfiles().find(
      (candidate) => candidate.profile?.id === archetype.profile.profileId,
    );
    if (
      !current ||
      !pagePlan?.profile ||
      current.profileVersion !== archetype.profile.profileVersion
    ) {
      throw new PublishCompilerError("stale-profile-authority");
    }
    const materialization = materializeExecutablePageBlueprint({
      pagePlan,
      componentDefinitions: veskifyComponentDefinitionsV2,
      availableBindingCategories: pagePlan.profile.requiredBindingCategories,
    });
    if (archetype.profile.fingerprint !== materialization.fingerprint) {
      throw new PublishCompilerError("stale-profile-authority");
    }
    if (
      archetype.componentPresentations.length !== materialization.slots.length ||
      archetype.componentPresentations.some((presentation, index) => {
        const selection = pagePlan.profile!.componentSelections[index];
        const slot = materialization.slots[index];
        return (
          slot?.slotId !== presentation.slotId ||
          slot.component !== presentation.component ||
          selection?.slotId !== presentation.slotId ||
          !selection.variants.includes(presentation.variant)
        );
      })
    ) {
      throw new PublishCompilerError("invalid-ordering-or-omission");
    }
  }
  const canonicalProfileIds = [...input.authority.profileAuthorities]
    .map(({ profileId }) => profileId)
    .sort(compare);
  if (
    new Set(canonicalProfileIds).size !== canonicalProfileIds.length ||
    input.authority.profileAuthorities.some(
      ({ profileId }, index) => profileId !== canonicalProfileIds[index],
    )
  ) {
    throw new PublishCompilerError("stale-profile-authority");
  }
  for (const supplied of input.authority.profileAuthorities) {
    const current = veskifyComponentCapabilityManifest.getByProfileId(supplied.profileId);
    if (!current || current.profileVersion !== supplied.profileVersion) {
      throw new PublishCompilerError("stale-profile-authority");
    }
    const pagePlan = listExecutablePageBlueprintProfiles().find(
      (candidate) => candidate.profile?.id === supplied.profileId,
    );
    if (!pagePlan?.profile) throw new PublishCompilerError("stale-profile-authority");
    const materialization = materializeExecutablePageBlueprint({
      pagePlan,
      componentDefinitions: veskifyComponentDefinitionsV2,
      availableBindingCategories: pagePlan.profile.requiredBindingCategories,
    });
    const registeredProfileAuthority = current.fingerprint === supplied.fingerprint;
    const materializedProfileAuthority = materialization.fingerprint === supplied.fingerprint;
    if (!registeredProfileAuthority && !materializedProfileAuthority) {
      throw new PublishCompilerError("stale-profile-authority");
    }
    if (
      dynamicProfiles.some(
        (profile) =>
          profile.profileId === supplied.profileId &&
          profile.profileVersion === supplied.profileVersion &&
          profile.fingerprint === supplied.fingerprint,
      )
    ) {
      continue;
    }
    if (registeredProfileAuthority) {
      const exactRegisteredPage = snapshot.pages.find(
        (page) =>
          page.type === pagePlan.pageType &&
          effectivePageSections(page).length === pagePlan.profile!.componentSelections.length &&
          effectivePageSections(page).every((section, index) => {
            const selection = pagePlan.profile!.componentSelections[index];
            return (
              selection?.component === section.component &&
              selection.variants.includes(section.variant)
            );
          }),
      );
      if (!exactRegisteredPage) {
        throw new PublishCompilerError("invalid-ordering-or-omission");
      }
      continue;
    }
    const projected = materialization.slots.reduce<
      Array<Readonly<{ component: string; variants: readonly string[]; required: boolean }>>
    >((entries, slot, index) => {
      const component = runtimeComponentForPageBlueprintComponent(
        slot.component,
        materialization.pageType,
      );
      const composite = component !== slot.component;
      const required = pagePlan.slots[index]?.required ?? false;
      const prior = entries.at(-1);
      if (prior?.component === component) {
        entries[entries.length - 1] = {
          component,
          variants: composite ? [] : [...new Set([...prior.variants, slot.variant])],
          required: prior.required || required,
        };
        return entries;
      }
      entries.push({ component, variants: composite ? [] : [slot.variant], required });
      return entries;
    }, []);
    const exactPage = snapshot.pages.find((page) => {
      if (page.type !== pagePlan.pageType) return false;
      let projectedIndex = 0;
      for (const section of effectivePageSections(page)) {
        while (
          projectedIndex < projected.length &&
          (projected[projectedIndex]?.component !== section.component ||
            ((projected[projectedIndex]?.variants.length ?? 0) > 0 &&
              !projected[projectedIndex]?.variants.includes(section.variant)))
        ) {
          if (projected[projectedIndex]?.required) return false;
          projectedIndex += 1;
        }
        if (projectedIndex >= projected.length) return false;
        projectedIndex += 1;
      }
      return projected.slice(projectedIndex).every((entry) => !entry.required);
    });
    if (!exactPage) throw new PublishCompilerError("invalid-ordering-or-omission");
  }
}

function assertDynamicCommercePresentationAuthority(snapshot: StorefrontSnapshot): void {
  try {
    validateCurrentDynamicCommercePresentationAuthority(snapshot);
  } catch (cause) {
    if (cause instanceof DynamicCommerceRouteAuthorityError && cause.code === "stale-profile") {
      throw new PublishCompilerError("stale-profile-authority", { cause });
    }
    throw new PublishCompilerError("invalid-binding", { cause });
  }
}

const protectedCommerceKeys = new Set([
  "price",
  "compareAtPrice",
  "sku",
  "stock",
  "stockStatus",
  "availability",
  "optionGroups",
  "optionValues",
]);

function containsProtectedCommerceTruth(value: unknown): boolean {
  if (Array.isArray(value)) return value.some(containsProtectedCommerceTruth);
  if (!value || typeof value !== "object") return false;
  return Object.entries(value).some(
    ([key, nested]) => protectedCommerceKeys.has(key) || containsProtectedCommerceTruth(nested),
  );
}

function assertAssets(snapshot: StorefrontSnapshot): void {
  const dna = resolveBrandSystemDesignDna(snapshot.brandSystem);
  const sections = [
    ...(snapshot.sharedFrame
      ? [
          snapshot.sharedFrame.announcement,
          snapshot.sharedFrame.header,
          snapshot.sharedFrame.footer,
        ].filter((section): section is NonNullable<typeof section> => section !== undefined)
      : []),
    ...snapshot.pages.flatMap((page) => page.sections),
  ];
  for (const section of sections) {
    const placements = section.approvedAssetPlacements ?? [];
    if (placements.some(({ assetSlotId }) => assetSlotId === "productMedia")) {
      throw new PublishCompilerError("product-media-violation");
    }
    try {
      validateComponentAssetAssignments(
        placements.map((placement) => ({
          slotId: placement.assetSlotId,
          assetId: placement.assetId,
          role: placement.role,
        })),
        veskifyComponentRegistryV2.get(section.component),
      );
    } catch (cause) {
      throw new PublishCompilerError("invalid-approved-asset", { cause });
    }
    const presentationList = section.approvedAssetPresentations ?? [];
    const presentations = new Map(
      presentationList.map((presentation) => [presentation.assetId, presentation]),
    );
    if (presentations.size !== presentationList.length) {
      throw new PublishCompilerError("invalid-approved-asset");
    }
    for (const placement of placements) {
      const presentation = presentations.get(placement.assetId);
      if (
        !presentation ||
        presentation.role !== placement.role ||
        presentation.revision !== placement.assetRevision ||
        presentation.materialFingerprint !== placement.materialFingerprint ||
        presentation.asset.id !== placement.assetId
      ) {
        throw new PublishCompilerError("invalid-approved-asset");
      }
      if (presentation.artDirection) {
        try {
          if (
            presentation.artDirection.placement.variant !== section.variant ||
            presentation.artDirection.placement.assetSlotId !== placement.assetSlotId ||
            presentation.artDirection.placement.required !== placement.required ||
            presentation.artDirection.source.sourceOwnerId !== placement.sourceReferenceId ||
            placement.sourceProvenanceKind === undefined ||
            presentation.artDirection.source.provenanceKind !== placement.sourceProvenanceKind
          ) {
            throw new Error("Responsive image placement authority does not match the section.");
          }
          validateResponsiveImageAuthority({
            authority: presentation.artDirection,
            component: veskifyComponentRegistryV2.get(section.component),
            dna,
          });
        } catch (cause) {
          throw new PublishCompilerError("invalid-approved-asset", { cause });
        }
      }
    }
    if (
      presentationList.some(
        (presentation) =>
          !placements.some((placement) => placement.assetId === presentation.assetId),
      )
    ) {
      throw new PublishCompilerError("invalid-approved-asset");
    }
  }
}

function assertSnapshotAuthority(
  input: PublishCompilerInput,
  snapshot: StorefrontSnapshot,
  catalogue: CatalogueDisplayModel,
): void {
  if (
    input.projectId !== snapshot.projectId ||
    input.draftId !== snapshot.id ||
    input.draftRevision !== snapshot.revision ||
    input.sourceSnapshotId !== snapshot.id ||
    input.sourceSnapshotRevision !== snapshot.revision ||
    input.sourceSnapshotFingerprint !== canonicalStorefrontContentFingerprint(snapshot)
  ) {
    throw new PublishCompilerError("stale-source-snapshot");
  }
  if (snapshot.catalogueRef !== catalogue.id) {
    throw new PublishCompilerError("protected-commerce-violation");
  }
  if (
    input.sourceAuthority.kind === "accepted-ai" &&
    !input.sourceAuthority.acceptedReceiptFingerprint
  ) {
    throw new PublishCompilerError("stale-accepted-receipt");
  }
  const authority = input.authority;
  if (
    authority.commerceFingerprint !== `publish-commerce-${canonicalValueFingerprint(catalogue)}`
  ) {
    throw new PublishCompilerError("protected-commerce-violation");
  }
  if (authority.navigationRoutesFingerprint !== navigationRoutesFingerprint(snapshot)) {
    throw new PublishCompilerError("navigation-route-violation");
  }
  if (authority.productMediaFingerprint !== productMediaFingerprint(catalogue)) {
    throw new PublishCompilerError("product-media-violation");
  }
  if (authority.approvedAssetFingerprint !== approvedAssetFingerprint(snapshot)) {
    throw new PublishCompilerError("invalid-approved-asset");
  }
  const dynamicComponentPresentations = [
    ...(snapshot.dynamicCommercePresentation?.collectionSearchArchetypes ?? []),
    ...(snapshot.dynamicCommercePresentation?.productDetailArchetypes ?? []),
  ].flatMap(({ componentPresentations }) => componentPresentations);
  if (
    [
      ...(snapshot.sharedFrame
        ? [
            snapshot.sharedFrame.header,
            snapshot.sharedFrame.footer,
            snapshot.sharedFrame.announcement,
          ].filter((section): section is NonNullable<typeof section> => section !== undefined)
        : []),
      ...snapshot.pages.flatMap((page) => page.sections),
      ...dynamicComponentPresentations,
    ].some(
      (section) =>
        containsProtectedCommerceTruth(section.content) ||
        containsProtectedCommerceTruth(section.props) ||
        containsProtectedCommerceTruth("styleOverrides" in section ? section.styleOverrides : {}) ||
        containsProtectedCommerceTruth(
          "boundedParameters" in section ? section.boundedParameters : {},
        ),
    )
  ) {
    throw new PublishCompilerError("protected-commerce-violation");
  }
}

function assertCurrentProofEvidence(
  snapshot: StorefrontSnapshot,
  currentEvidenceReferences: PublishCompilerInput["currentEvidenceReferences"],
): void {
  try {
    for (const section of snapshot.pages.flatMap((page) => page.sections)) {
      if (section.component !== "homepageProof") continue;
      resolveHomepageProofContent(section.content, {
        required: true,
        currentEvidenceReferences,
      });
    }
  } catch (cause) {
    throw new PublishCompilerError("invalid-binding", { cause });
  }
}

function assertCurrentContentSupportFacts(
  snapshot: StorefrontSnapshot,
  currentEvidenceReferences: PublishCompilerInput["currentEvidenceReferences"],
): void {
  const documents = new Map(
    snapshot.contentSupportFactDocuments.map((document) => [document.id, document]),
  );
  try {
    for (const page of snapshot.pages) {
      for (const section of page.sections) {
        if (section.component !== "contentSupport") continue;
        const documentId = z
          .object({ factDocumentId: idSchema })
          .strict()
          .parse(section.content).factDocumentId;
        const document = documents.get(documentId);
        if (!document)
          throw new Error("Content/support publication requires the current fact document.");
        if (
          !currentEvidenceReferences.some(
            (reference) =>
              canonicalValueString(reference) === canonicalValueString(document.evidence),
          )
        ) {
          throw new Error("Content/support publication facts must have current approved evidence.");
        }
        if (
          !page.pageFamily ||
          document.payload.familyId !== page.pageFamily.familyId ||
          !page.pageFamily.evidenceReferences.some(
            (reference) =>
              canonicalValueString(reference) === canonicalValueString(document.evidence),
          )
        ) {
          throw new Error(
            "Content/support publication facts must retain exact page-family authority.",
          );
        }
      }
    }
    for (const archetype of snapshot.dynamicCommercePresentation?.collectionSearchArchetypes ??
      []) {
      for (const presentation of archetype.componentPresentations) {
        requireCanonicalProductCardAnatomy(
          z.object({ cardVariant: z.string() }).passthrough().parse(presentation.props).cardVariant,
          "collectionResults",
        );
      }
    }
    for (const archetype of snapshot.dynamicCommercePresentation?.productDetailArchetypes ?? []) {
      for (const presentation of archetype.componentPresentations) {
        requireCanonicalProductCardAnatomy(
          z
            .object({ relatedCardVariant: z.string().default("standard") })
            .passthrough()
            .parse(presentation.props).relatedCardVariant,
          "relatedProducts",
        );
      }
    }
  } catch (cause) {
    throw new PublishCompilerError("invalid-binding", { cause });
  }
}

function assertProductCardAuthority(snapshot: StorefrontSnapshot): void {
  try {
    for (const page of snapshot.pages) {
      for (const section of page.sections) {
        if (section.component === "dynamicCollectionCommerce") {
          requireCanonicalProductCardAnatomy(
            z.object({ cardVariant: z.string() }).passthrough().parse(section.props).cardVariant,
            "collectionResults",
          );
        } else if (section.component === "homepageFeaturedProducts") {
          requireCanonicalProductCardAnatomy(
            z.object({ cardVariant: z.string() }).passthrough().parse(section.props).cardVariant,
            "homepageMerchandising",
          );
        } else if (section.component === "dynamicProductDetail") {
          requireCanonicalProductCardAnatomy(
            z
              .object({ relatedCardVariant: z.string().default("standard") })
              .passthrough()
              .parse(section.props).relatedCardVariant,
            "relatedProducts",
          );
        }
      }
    }
  } catch (cause) {
    throw new PublishCompilerError("stale-product-card-authority", { cause });
  }
}

function compileResult(
  input: PublishCompilerInput,
  snapshot: StorefrontSnapshot,
  localeAuthority: z.infer<typeof localeAuthoritySchema>,
): CompiledPublicationResult {
  const validationReport = {
    manifestFingerprint: input.authority.manifestFingerprint,
    registryFingerprint: input.authority.registryFingerprint,
    rendererAuthorityFingerprint: input.authority.rendererAuthorityFingerprint,
    profileAuthorities: input.authority.profileAuthorities,
    commerceFingerprint: input.authority.commerceFingerprint,
    navigationRoutesFingerprint: input.authority.navigationRoutesFingerprint,
    productMediaFingerprint: input.authority.productMediaFingerprint,
    productCardAuthorityFingerprint: input.authority.productCardAuthorityFingerprint,
    approvedAssetFingerprint: input.authority.approvedAssetFingerprint,
    ...(input.authority.dynamicCommercePresentationFingerprint
      ? {
          dynamicCommercePresentationFingerprint:
            input.authority.dynamicCommercePresentationFingerprint,
        }
      : {}),
    localeAuthority,
    migrationFingerprint: input.authority.migrationFingerprint,
  };
  const validationReportFingerprint = `publish-validation-${canonicalValueFingerprint(validationReport)}`;
  const componentExecution = (section: StorefrontSnapshot["pages"][number]["sections"][number]) => {
    const entry = veskifyComponentCapabilityManifest.getByComponentType(section.component)!;
    return {
      sectionId: section.id,
      componentType: section.component,
      componentVersion: entry.componentDefinitionVersion,
      variant: section.variant,
      rendererTarget: "published" as const,
      rendererAdapterId: entry.renderer.adapterId,
      rendererExportName: entry.renderer.exportName,
      capabilityFingerprint: entry.fingerprint,
    };
  };
  const sharedFrameSections = snapshot.sharedFrame
    ? [
        snapshot.sharedFrame.announcement,
        snapshot.sharedFrame.header,
        snapshot.sharedFrame.footer,
      ].filter((section): section is NonNullable<typeof section> => section !== undefined)
    : [];
  const resultWithoutFingerprint = {
    contractVersion: publishCompilerContractVersion,
    compilerVersion: publishCompilerVersion,
    projectId: input.projectId,
    sourceSnapshot: {
      id: snapshot.id,
      revision: snapshot.revision,
      fingerprint: input.sourceSnapshotFingerprint,
    },
    brandSystem: snapshot.brandSystem,
    sharedFrame: {
      navigation: snapshot.navigation,
      ...(snapshot.sharedFrame ? { frame: snapshot.sharedFrame } : {}),
      componentExecutions: sharedFrameSections.map(componentExecution),
    },
    pages: snapshot.pages.map((page) => ({
      page,
      componentExecutions: page.sections.map(componentExecution),
    })),
    ...(snapshot.dynamicCommercePresentation
      ? { dynamicCommercePresentation: snapshot.dynamicCommercePresentation }
      : {}),
    contentSupportFactDocuments: snapshot.contentSupportFactDocuments,
    rendererTarget: "published" as const,
    localeAuthority,
    validationReportFingerprint,
  };
  const runtimeFingerprint = `compiled-publication-${canonicalValueFingerprint(resultWithoutFingerprint)}`;
  return compiledPublicationResultSchema.parse({ ...resultWithoutFingerprint, runtimeFingerprint });
}

function compileReceipt(
  input: PublishCompilerInput,
  result: CompiledPublicationResult,
): PublishCompileReceipt {
  const accepted = input.sourceAuthority.kind === "accepted-ai" ? input.sourceAuthority : null;
  const unsignedWithoutId = {
    version: publishCompilerContractVersion,
    compilerVersion: publishCompilerVersion,
    sourceAuthorityKind: input.sourceAuthority.kind,
    projectId: input.projectId,
    projectRevision: input.projectRevision,
    draftId: input.draftId,
    draftRevision: input.draftRevision,
    sourceSnapshotId: input.sourceSnapshotId,
    sourceSnapshotRevision: input.sourceSnapshotRevision,
    acceptedReceiptId: accepted?.acceptedReceiptId ?? null,
    acceptedReceiptFingerprint: accepted?.acceptedReceiptFingerprint ?? null,
    sourceSnapshotFingerprint: input.sourceSnapshotFingerprint,
    compiledResultFingerprint: result.runtimeFingerprint,
    manifestVersion: input.authority.manifestVersion,
    manifestFingerprint: input.authority.manifestFingerprint,
    registryFingerprint: input.authority.registryFingerprint,
    profileAuthorities: input.authority.profileAuthorities,
    commerceFingerprint: input.authority.commerceFingerprint,
    navigationRoutesFingerprint: input.authority.navigationRoutesFingerprint,
    productMediaFingerprint: input.authority.productMediaFingerprint,
    productCardAuthorityFingerprint: input.authority.productCardAuthorityFingerprint,
    approvedAssetFingerprint: input.authority.approvedAssetFingerprint,
    ...(input.authority.dynamicCommercePresentationFingerprint
      ? {
          dynamicCommercePresentationFingerprint:
            input.authority.dynamicCommercePresentationFingerprint,
        }
      : {}),
    localeAuthority: result.localeAuthority,
    migrationStatus: "current" as const,
    migrationFingerprint: input.authority.migrationFingerprint,
    validationReportFingerprint: result.validationReportFingerprint,
  };
  const id = `publish_compile_${canonicalValueFingerprint(unsignedWithoutId).slice(-24)}`;
  const fingerprint = `publish-compile-receipt-${canonicalValueFingerprint({ id, ...unsignedWithoutId })}`;
  return publishCompileReceiptSchema.parse({ id, ...unsignedWithoutId, fingerprint });
}

/** Pure, write-free deterministic compiler over canonical trusted publication input. */
export function compileStorefrontPublication(inputValue: unknown): TrustedPublishCompilation {
  const cloned = cloneUnknown(inputValue);
  if (
    cloned &&
    typeof cloned === "object" &&
    "contractVersion" in cloned &&
    cloned.contractVersion !== publishCompilerContractVersion
  ) {
    throw new PublishCompilerError("unsupported-compiler-contract-version");
  }
  const parsed = publishCompilerInputSchema.safeParse(cloned);
  if (!parsed.success) {
    if (
      cloned &&
      typeof cloned === "object" &&
      "projectLocales" in cloned &&
      parsed.error.issues.some((issue) => issue.path[0] === "projectLocales")
    ) {
      throw new PublishCompilerError("invalid-locale-authority", { cause: parsed.error });
    }
    throw new PublishCompilerError("malformed-compiler-input", { cause: parsed.error });
  }
  const input = parsed.data;
  const snapshot = storefrontSnapshotSchema.safeParse(input.snapshot);
  const catalogue = catalogueDisplayModelSchema.safeParse(input.catalogue);
  if (!snapshot.success || !catalogue.success) {
    const accessibilityIssues = snapshot.success ? [] : snapshot.error.issues;
    const catalogueAccessibilityIssues = catalogue.success ? [] : catalogue.error.issues;
    if (
      [...accessibilityIssues, ...catalogueAccessibilityIssues].some(
        (issue) =>
          issue.path.includes("alt") ||
          issue.message.toLowerCase().includes("accessible") ||
          issue.message.toLowerCase().includes("alternative"),
      )
    ) {
      throw new PublishCompilerError("critical-accessibility-failure", {
        cause: snapshot.success ? catalogue.error : snapshot.error,
      });
    }
    throw new PublishCompilerError("malformed-compiler-input", {
      cause: snapshot.success ? catalogue.error : snapshot.error,
    });
  }
  const localeAuthority = projectLocaleAuthority(input.projectLocales);
  publishedRouteAuthority(snapshot.data);
  assertExactAuthority(input, snapshot.data, catalogue.data);
  assertDynamicCommercePresentationAuthority(snapshot.data);
  assertSnapshotAuthority(input, snapshot.data, catalogue.data);
  assertCurrentProofEvidence(snapshot.data, input.currentEvidenceReferences);
  assertCurrentContentSupportFacts(snapshot.data, input.currentEvidenceReferences);
  assertComponentAndRendererAuthority(input, snapshot.data);
  assertProfiles(input, snapshot.data);
  assertProductCardAuthority(snapshot.data);
  assertAssets(snapshot.data);
  try {
    validateRegisteredSnapshot(
      snapshot.data,
      catalogue.data,
      localeAuthority.activeLocale,
      localeAuthority.primaryLocale,
      localeAuthority.supportedLocales,
      input.currentEvidenceReferences,
    );
  } catch (cause) {
    throw new PublishCompilerError("invalid-binding", { cause });
  }
  const result = compileResult(input, snapshot.data, localeAuthority);
  const receipt = compileReceipt(input, result);
  const compilation = trustedPublishCompilationSchema.parse({ result, receipt });
  const { runtimeFingerprint, ...resultPayload } = result;
  void runtimeFingerprint;
  if (
    result.runtimeFingerprint !== `compiled-publication-${canonicalValueFingerprint(resultPayload)}`
  ) {
    throw new PublishCompilerError("nondeterministic-compiler-result");
  }
  return deepFreeze(compilation);
}

export function preparedPublishCompilation(
  compilation: TrustedPublishCompilation,
): PreparedPublishCompilation {
  return deepFreeze(
    preparedPublishCompilationSchema.parse({
      resultIdentity: {
        runtimeFingerprint: compilation.result.runtimeFingerprint,
        validationReportFingerprint: compilation.result.validationReportFingerprint,
        sourceSnapshotId: compilation.result.sourceSnapshot.id,
        sourceSnapshotRevision: compilation.result.sourceSnapshot.revision,
        sourceSnapshotFingerprint: compilation.result.sourceSnapshot.fingerprint,
      },
      receipt: compilation.receipt,
    }),
  );
}

export function assertMatchingPublishCompilation(
  prepared: PreparedPublishCompilation,
  current: TrustedPublishCompilation,
): void {
  if (
    canonicalValueString(prepared) !== canonicalValueString(preparedPublishCompilation(current))
  ) {
    throw new PublishCompilerError("prepare-confirmation-compile-mismatch");
  }
}
