import {
  validateComposedStorefrontSnapshot,
  type StorefrontCompositionAuthorityResolver,
} from "@/application/storefront-templates/bind-storefront-composition";
import { veskifyComponentDefinitionsV2 } from "@/components/registry/v2-registry";
import { validateRegisteredSnapshot } from "@/components/registry/registry";
import {
  composedPageRealizationSupport,
  deriveComposedPageLayout,
} from "./composed-page-realization";
import type { CatalogueDisplayModel } from "@/domain/catalogue";
import type { Locale } from "@/domain/shared";
import { storefrontSnapshotSchema, type StorefrontSnapshot } from "@/domain/storefront";
import type { ContentSupportFactDocument } from "@/domain/storefront/content-support-facts";
import type { PageFactEvidenceReference } from "@/domain/storefront/page-fact-evidence";
import { parseStorefrontSnapshotVersion } from "@/domain/storefront/storefront-composition-version";

export type ComposedStorefrontValidationInput = Readonly<{
  snapshot: unknown;
  catalogue: CatalogueDisplayModel;
  activeLocale: Locale;
  primaryLocale: Locale;
  enabledLocales: readonly Locale[];
  resolveAuthority: StorefrontCompositionAuthorityResolver;
  evidenceReferences?: readonly PageFactEvidenceReference[];
  contentSupportFactDocuments?: readonly ContentSupportFactDocument[];
}>;

function reject(reason: string): never {
  throw new Error(`Composed storefront renderer rejected: ${reason}.`);
}

function recursiveFreeze<T>(value: T, seen = new WeakSet<object>()): T {
  if (!value || typeof value !== "object" || seen.has(value)) return value;
  seen.add(value);
  Object.values(value as Record<string, unknown>).forEach((entry) => recursiveFreeze(entry, seen));
  return Object.freeze(value);
}

function privateFrozenCopy<T>(value: T): T {
  return recursiveFreeze(structuredClone(value));
}

function trustedResolver(
  input: StorefrontCompositionAuthorityResolver,
): StorefrontCompositionAuthorityResolver {
  type CachedAuthority = Readonly<{
    compositionFingerprint: string;
    authority: ReturnType<StorefrontCompositionAuthorityResolver>;
  }>;
  const authorities = new Map<string, Map<string, CachedAuthority>>();
  return (request) => {
    const composition = request.composition;
    if (
      !("compositionFingerprint" in composition) ||
      request.owner.kind !== composition.owner.kind ||
      request.owner.id !== composition.owner.id
    )
      reject("authority request does not match the compiled owner");
    const byOwner = authorities.get(request.owner.kind) ?? new Map<string, CachedAuthority>();
    const cached = byOwner.get(request.owner.id);
    if (cached) {
      if (cached.compositionFingerprint !== composition.compositionFingerprint)
        reject("authority request changed for an already validated owner");
      return cached.authority;
    }
    const authority = input(request);
    const { support, componentDefinitions, candidate, requiredAssetRoleCapacityEvidence } =
      authority;
    if (
      support !== composedPageRealizationSupport ||
      componentDefinitions !== veskifyComponentDefinitionsV2
    )
      reject("untrusted realization support or component definitions");
    const retained = Object.freeze({
      candidate: privateFrozenCopy(candidate),
      componentDefinitions,
      support,
      requiredAssetRoleCapacityEvidence: privateFrozenCopy(requiredAssetRoleCapacityEvidence),
    });
    byOwner.set(request.owner.id, {
      compositionFingerprint: composition.compositionFingerprint,
      authority: retained,
    });
    authorities.set(request.owner.kind, byOwner);
    return retained;
  };
}

function legacyProjection(input: unknown): StorefrontSnapshot {
  const snapshot = structuredClone(input) as Record<string, unknown>;
  delete snapshot.compositionExtensionVersion;
  if (!Array.isArray(snapshot.pages)) reject("invalid page collection");
  snapshot.pages = snapshot.pages.map((page) => {
    if (!page || typeof page !== "object") reject("invalid page projection");
    const { composition: _composition, ...legacyPage } = page as Record<string, unknown>;
    void _composition;
    return legacyPage;
  });
  return storefrontSnapshotSchema.parse(snapshot);
}

/** Validate every composed owner once; rendering and persistence share this exact authority. */
export function validateComposedStorefrontContent(input: ComposedStorefrontValidationInput) {
  const catalogue = privateFrozenCopy(input.catalogue);
  const enabledLocales = privateFrozenCopy([...input.enabledLocales]);
  const evidenceReferences = input.evidenceReferences
    ? privateFrozenCopy([...input.evidenceReferences])
    : undefined;
  const contentSupportFactDocuments = input.contentSupportFactDocuments
    ? privateFrozenCopy([...input.contentSupportFactDocuments])
    : undefined;
  const resolver = trustedResolver(input.resolveAuthority);
  const parsed = parseStorefrontSnapshotVersion(privateFrozenCopy(input.snapshot));
  if (parsed.dynamicCommercePresentation?.contractVersion === "2.0.0")
    reject("composed dynamic commerce is unsupported");
  const accepted = validateComposedStorefrontSnapshot(parsed, resolver);
  const dynamicCommercePresentation = accepted.dynamicCommercePresentation;
  if (dynamicCommercePresentation?.contractVersion === "2.0.0")
    reject("composed dynamic commerce is unsupported");
  // Explicitly narrow only the unsupported dynamic variant; preserve the composition extension.
  const { dynamicCommercePresentation: _dynamic, ...staticSnapshot } = accepted;
  void _dynamic;
  const snapshot = privateFrozenCopy(
    dynamicCommercePresentation
      ? { ...staticSnapshot, dynamicCommercePresentation }
      : staticSnapshot,
  );
  if (!snapshot.sharedFrame) reject("canonical shared frame is required");
  const projected = validateRegisteredSnapshot(
    legacyProjection(snapshot),
    catalogue,
    input.activeLocale,
    input.primaryLocale,
    enabledLocales,
    evidenceReferences,
    contentSupportFactDocuments,
  );
  const layouts = new Map<string, ReturnType<typeof deriveComposedPageLayout>>();
  for (const page of snapshot.pages) {
    if (!("composition" in page)) continue;
    const composition = page.composition;
    if (composition.owner.kind !== "static-page" || composition.owner.id !== page.id)
      reject("requested owner is not a static page");
    const authority = resolver({ owner: composition.owner, composition });
    const layout = deriveComposedPageLayout({ composition, candidate: authority.candidate });
    const body = page.sections.filter((section) => section.visible);
    const ids = layout.regions.flatMap((region) => region.sectionIds);
    if (
      new Set(ids).size !== ids.length ||
      ids.length !== body.length ||
      ids.some((id) => !body.some((section) => section.id === id))
    )
      reject("composition does not cover every visible section");
    layouts.set(page.id, layout);
  }
  return {
    snapshot,
    projected,
    layouts,
    catalogue,
    enabledLocales,
    evidenceReferences,
    contentSupportFactDocuments,
  };
}
