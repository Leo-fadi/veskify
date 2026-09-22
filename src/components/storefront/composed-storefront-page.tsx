import { type ReactNode } from "react";
import {
  validateComposedStorefrontSnapshot,
  type StorefrontCompositionAuthorityResolver,
} from "@/application/storefront-templates/bind-storefront-composition";
import {
  createStorefrontRenderContext,
  renderRegisteredSection,
  storefrontMainContentId,
  withCurrentStorefrontPage,
} from "@/components/registry";
import { veskifyComponentDefinitionsV2 } from "@/components/registry/v2-registry";
import {
  composedPageRealizationSupport,
  deriveComposedPageLayout,
} from "@/components/storefront/composed-page-realization";
import styles from "@/components/storefront/composed-storefront-page.module.css";
import type { CatalogueDisplayModel } from "@/domain/catalogue";
import type { Locale } from "@/domain/shared";
import type { StorefrontSnapshot } from "@/domain/storefront";
import type { PageFactEvidenceReference } from "@/domain/storefront/page-fact-evidence";
import type { ContentSupportFactDocument } from "@/domain/storefront/content-support-facts";
import type { CompiledPageBlueprintCompositionV1 } from "@/domain/storefront/compiled-page-blueprint-composition";
import { parseStorefrontSnapshotVersion } from "@/domain/storefront/storefront-composition-version";
import { validateRegisteredSnapshot } from "@/components/registry/registry";
import { brandSystemToCssVariables } from "@/domain/design-system";

type Input = Readonly<{
  snapshot: unknown;
  pageId: string;
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
  return snapshot as StorefrontSnapshot;
}

function sectionMap(page: { sections: readonly { id: string; visible: boolean }[] }) {
  const mapped = new Map(page.sections.map((section) => [section.id, section]));
  if (mapped.size !== page.sections.length) reject("duplicate section IDs");
  return mapped;
}

function pageComposition(page: unknown): CompiledPageBlueprintCompositionV1 {
  if (!page || typeof page !== "object" || !("composition" in page))
    return reject("requested page has no composition");
  return (page as { composition: CompiledPageBlueprintCompositionV1 }).composition;
}

export function renderComposedStorefrontPage(input: Input): ReactNode {
  const resolver = trustedResolver(input.resolveAuthority);
  const parsed = parseStorefrontSnapshotVersion(input.snapshot);
  if (parsed.dynamicCommercePresentation?.contractVersion === "2.0.0")
    reject("composed dynamic commerce is unsupported");
  const accepted = validateComposedStorefrontSnapshot(parsed, resolver);
  if (!accepted.sharedFrame) reject("canonical shared frame is required");
  const composedPage = accepted.pages.find((page) => page.id === input.pageId);
  if (!composedPage) reject("requested page is absent");
  const composition = pageComposition(composedPage);
  if (composition.owner.kind !== "static-page" || composition.owner.id !== composedPage.id)
    reject("requested owner is not a static page");

  const authority = resolver({ owner: composition.owner, composition });
  const layout = deriveComposedPageLayout({ composition, candidate: authority.candidate });
  const projected = validateRegisteredSnapshot(
    legacyProjection(accepted),
    input.catalogue,
    input.activeLocale,
    input.primaryLocale,
    input.enabledLocales,
    input.evidenceReferences,
    input.contentSupportFactDocuments,
  );
  const page = projected.pages.find((entry) => entry.id === input.pageId);
  if (!page || !projected.sharedFrame) reject("legacy projection lost requested frame or page");
  const context = withCurrentStorefrontPage(
    createStorefrontRenderContext({
      activeLocale: input.activeLocale,
      primaryLocale: input.primaryLocale,
      enabledLocales: input.enabledLocales,
      catalogue: input.catalogue,
      snapshot: projected,
      evidenceReferences: input.evidenceReferences,
      contentSupportFactDocuments: input.contentSupportFactDocuments,
    }),
    page,
  );
  const sections = sectionMap(page);
  const bodySections = new Set<string>();
  const regions = layout.regions.map((region) => {
    const entries = region.sectionIds.map((id) => {
      const section = sections.get(id);
      if (!section?.visible || bodySections.has(id)) reject("invalid body section realization");
      bodySections.add(id);
      return section;
    });
    return { region, entries };
  });
  const visibleBody = page.sections.filter((section) => section.visible);
  if (bodySections.size !== visibleBody.length)
    reject("composition does not cover every visible section");

  const pairBySource = new Map(layout.pairs.map((pair) => [pair.sourceRegionId, pair]));
  const pairedTargets = new Set(layout.pairs.map((pair) => pair.targetRegionId));
  const groups = regions.flatMap((value, index) => {
    if (pairedTargets.has(value.region.id)) return [];
    const pair = pairBySource.get(value.region.id);
    const next = pair ? regions[index + 1] : undefined;
    if (pair && (!next || next.region.id !== pair.targetRegionId)) reject("invalid pair grouping");
    return [{ value, next, pair }];
  });
  const sharedFrame = context.sharedFrame;
  if (!sharedFrame) reject("render context lost canonical shared frame");
  return (
    <div
      className={styles.root}
      lang={input.activeLocale}
      style={brandSystemToCssVariables(projected.brandSystem)}
    >
      {sharedFrame.announcement ? renderRegisteredSection(sharedFrame.announcement, context) : null}
      {renderRegisteredSection(sharedFrame.header, context)}
      <main id={storefrontMainContentId} tabIndex={-1} className={styles.main}>
        {groups.map(({ value, next, pair }) => {
          const renderRegion = (value: (typeof regions)[number], offset = false) => (
            <section
              key={value.region.id}
              className={`${styles.region}${offset ? ` ${styles.offset}` : ""}`}
              data-composed-region={value.region.id}
            >
              {value.entries.map((section) => (
                <div key={section.id} data-composed-section={section.id}>
                  {renderRegisteredSection(section, context, page.type)}
                </div>
              ))}
            </section>
          );
          if (pair && next) {
            return (
              <div
                className={styles.pair}
                data-composed-pair={`${value.region.id}:${next.region.id}`}
                key={value.region.id}
              >
                {renderRegion(value)}
                {renderRegion(next, pair.offset)}
              </div>
            );
          }
          return renderRegion(value);
        })}
      </main>
      {renderRegisteredSection(sharedFrame.footer, context)}
    </div>
  );
}
