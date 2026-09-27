import { type ReactNode } from "react";
import type { StorefrontCompositionAuthorityResolver } from "@/application/storefront-templates/bind-storefront-composition";
import { validateComposedStorefrontContent } from "./composed-storefront-validation";
import {
  createStorefrontRenderContext,
  renderRegisteredSection,
  storefrontMainContentId,
  withCurrentStorefrontPage,
} from "@/components/registry";
import styles from "@/components/storefront/composed-storefront-page.module.css";
import type { CatalogueDisplayModel } from "@/domain/catalogue";
import { brandSystemToCssVariables } from "@/domain/design-system";
import type { Locale } from "@/domain/shared";
import type { ContentSupportFactDocument } from "@/domain/storefront/content-support-facts";
import type { PageFactEvidenceReference } from "@/domain/storefront/page-fact-evidence";

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

type RenderedSection = Readonly<{
  id: string;
  component: string;
  section: Parameters<typeof renderRegisteredSection>[0];
}>;
type RenderedRegion = Readonly<{
  id: string;
  sections: readonly RenderedSection[];
}>;
type RenderedGroup = Readonly<{
  region: RenderedRegion;
  pairedRegion?: RenderedRegion;
  offsetPairedRegion: boolean;
}>;

export type ComposedStorefrontPageRenderer = Readonly<{
  regions: readonly Readonly<{
    id: string;
    sections: readonly Readonly<{ id: string; component: string }>[];
  }>[];
  renderSection: (sectionId: string) => ReactNode;
  render: () => ReactNode;
  renderWithRegions: (
    renderRegion: (
      region: Readonly<{
        id: string;
        sections: readonly Readonly<{ id: string; component: string }>[];
      }>,
    ) => ReactNode,
  ) => ReactNode;
}>;

function reject(reason: string): never {
  throw new Error(`Composed storefront renderer rejected: ${reason}.`);
}

function sectionMap(page: {
  sections: readonly { id: string; visible: boolean; component: string }[];
}) {
  const mapped = new Map(page.sections.map((section) => [section.id, section]));
  if (mapped.size !== page.sections.length) reject("duplicate section IDs");
  return mapped;
}

/**
 * Establishes one private, fully validated composed-rendering authority. The returned
 * bound callbacks are for trusted integration decorations only; no unchecked layout
 * or resolver material is exposed as a second renderer authority.
 */
export function createComposedStorefrontPageRenderer(input: Input): ComposedStorefrontPageRenderer {
  const activeLocale = input.activeLocale;
  const primaryLocale = input.primaryLocale;
  const {
    snapshot,
    projected,
    layouts,
    catalogue,
    enabledLocales,
    evidenceReferences,
    contentSupportFactDocuments,
  } = validateComposedStorefrontContent(input);
  if (!snapshot.pages.some((page) => page.id === input.pageId)) reject("requested page is absent");
  const layout = layouts.get(input.pageId);
  if (!layout) reject("requested page has no composition");
  const page = projected.pages.find((entry) => entry.id === input.pageId);
  if (!page || !projected.sharedFrame) reject("legacy projection lost requested frame or page");
  const context = withCurrentStorefrontPage(
    createStorefrontRenderContext({
      activeLocale,
      primaryLocale,
      enabledLocales,
      catalogue,
      snapshot: projected,
      evidenceReferences,
      contentSupportFactDocuments,
    }),
    page,
  );
  const sections = sectionMap(page);
  const bodySections = new Set<string>();
  const regions = layout.regions.map((region): RenderedRegion => {
    const entries = region.sectionIds.map((id): RenderedSection => {
      const section = sections.get(id);
      if (!section?.visible || bodySections.has(id)) reject("invalid body section realization");
      bodySections.add(id);
      return Object.freeze({ id, component: section.component, section });
    });
    return Object.freeze({ id: region.id, sections: Object.freeze(entries) });
  });
  const visibleBody = page.sections.filter((section) => section.visible);
  if (bodySections.size !== visibleBody.length)
    reject("composition does not cover every visible section");

  const pairBySource = new Map(layout.pairs.map((pair) => [pair.sourceRegionId, pair]));
  const pairedTargets = new Set(layout.pairs.map((pair) => pair.targetRegionId));
  const groups = regions.flatMap((region, index): RenderedGroup[] => {
    if (pairedTargets.has(region.id)) return [];
    const pair = pairBySource.get(region.id);
    const pairedRegion = pair ? regions[index + 1] : undefined;
    if (pair && (!pairedRegion || pairedRegion.id !== pair.targetRegionId))
      reject("invalid pair grouping");
    return [
      Object.freeze({
        region,
        pairedRegion,
        offsetPairedRegion: pair?.offset === true,
      }),
    ];
  });
  const sharedFrame = context.sharedFrame;
  if (!sharedFrame) reject("render context lost canonical shared frame");
  const publicRegions = Object.freeze(
    regions.map((region) =>
      Object.freeze({
        id: region.id,
        sections: Object.freeze(
          region.sections.map((section) =>
            Object.freeze({ id: section.id, component: section.component }),
          ),
        ),
      }),
    ),
  );

  const renderWithRegions: ComposedStorefrontPageRenderer["renderWithRegions"] = (renderRegion) => {
    const renderBoundRegion = (region: RenderedRegion, offset = false) => (
      <section
        key={region.id}
        className={`${styles.region}${offset ? ` ${styles.offset}` : ""}`}
        data-composed-region={region.id}
      >
        {renderRegion(
          publicRegions.find((entry) => entry.id === region.id) ?? reject("missing public region"),
        )}
      </section>
    );
    return (
      <div
        className={styles.root}
        lang={activeLocale}
        style={brandSystemToCssVariables(projected.brandSystem)}
      >
        {sharedFrame.announcement
          ? renderRegisteredSection(sharedFrame.announcement, context)
          : null}
        {renderRegisteredSection(sharedFrame.header, context)}
        <main id={storefrontMainContentId} tabIndex={-1} className={styles.main}>
          {groups.map(({ region, pairedRegion, offsetPairedRegion }) => {
            if (pairedRegion) {
              return (
                <div
                  className={styles.pair}
                  data-composed-pair={`${region.id}:${pairedRegion.id}`}
                  key={region.id}
                >
                  {renderBoundRegion(region)}
                  {renderBoundRegion(pairedRegion, offsetPairedRegion)}
                </div>
              );
            }
            return renderBoundRegion(region);
          })}
        </main>
        {renderRegisteredSection(sharedFrame.footer, context)}
      </div>
    );
  };
  const renderSection: ComposedStorefrontPageRenderer["renderSection"] = (sectionId) => {
    const bound = regions
      .flatMap((region) => region.sections)
      .find((section) => section.id === sectionId);
    if (!bound) return reject("missing bound section");
    return renderRegisteredSection(bound.section, context, page.type);
  };

  return Object.freeze({
    regions: publicRegions,
    renderSection,
    render: () =>
      renderWithRegions((region) =>
        region.sections.map((section) => {
          return (
            <div key={section.id} data-composed-section={section.id}>
              {renderSection(section.id)}
            </div>
          );
        }),
      ),
    renderWithRegions,
  });
}

export function renderComposedStorefrontPage(input: Input): ReactNode {
  return createComposedStorefrontPageRenderer(input).render();
}
