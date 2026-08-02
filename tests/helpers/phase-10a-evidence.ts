import type { ApprovedGenerationAsset } from "@/application/ai-storefront-generation";
import type { AiStorefrontProjection } from "@/application/ai-storefront";
import type { CatalogueDisplayModel } from "@/domain/catalogue";
import type { Locale } from "@/domain/shared";
import {
  canonicalStorefrontContentFingerprint,
  canonicalValueFingerprint,
  canonicalValueString,
  type PageType,
  type StorefrontSnapshot,
} from "@/domain/storefront";

/** The fixed P10A browser matrix. It is intentionally independent of any recipe or narrative role. */
export const PHASE_10A_VIEWPORTS = [375, 768, 1024, 1440] as const;
export const PHASE_10A_LOCALES = ["en", "fi"] as const satisfies readonly Locale[];
export const PHASE_10A_PAGE_FAMILIES = ["home", "collection", "product"] as const;
export const PHASE_10A_RENDER_TARGETS = ["editor", "preview", "published"] as const;

export type Phase10aViewport = (typeof PHASE_10A_VIEWPORTS)[number];
export type Phase10aLocale = (typeof PHASE_10A_LOCALES)[number];
export type Phase10aPageFamily = (typeof PHASE_10A_PAGE_FAMILIES)[number];
export type Phase10aRenderTarget = (typeof PHASE_10A_RENDER_TARGETS)[number];

type ComponentSelection = Readonly<{
  pageFamily: PageType;
  componentFamily: string;
  variant: string;
  boundedParameters: Readonly<Record<string, unknown>>;
}>;

export type GenerationAuthorityEvidence = Readonly<{
  plannerId: string;
  providerId: string;
  registeredRecipeIds: Readonly<Record<string, string | null>>;
  pageBlueprintProfileIds: Readonly<Record<string, string | null>>;
  componentSelections: readonly ComponentSelection[];
  componentProjectionFingerprint: string;
}>;

export type ProposalSnapshotIntegrityEvidence = Readonly<{
  proposalFingerprint: string;
  operationFingerprint: string;
  proposedProjectionFingerprint: string;
  acceptedSnapshotFingerprint: string;
  exactProjectionParity: boolean;
}>;

export type ProtectedCommerceProjection = Readonly<{
  catalogueId: string;
  products: readonly Readonly<{
    id: string;
    sku: string | null;
    price: unknown | null;
    compareAtPrice: unknown | null;
    stockStatus: string | null;
    variants: readonly Readonly<{ id: string; price: unknown | null }>[];
    options: readonly Readonly<{ id: string; values: unknown | null }>[];
    mediaBindings: readonly string[];
  }>[];
  collections: readonly Readonly<{ id: string; productIds: readonly string[] }>[];
  routes: readonly Readonly<{ pageId: string; pageFamily: PageType; route: string }>[];
  fingerprint: string;
}>;

export type ApprovedAssetProjection = Readonly<{
  assets: readonly Readonly<{
    assetId: string;
    role: string;
    sourceReferenceId: string;
    revision: string;
    materialFingerprint: string;
    provenance: Readonly<{ location: string; observedAt: string }>;
  }>[];
  fingerprint: string;
}>;

export type StorefrontRendererProjection = Readonly<{
  snapshotFingerprint: string;
  pages: readonly Readonly<{
    pageId: string;
    pageFamily: PageType;
    route: string;
    componentSequence: readonly Readonly<{
      sectionId: string;
      componentFamily: string;
      variant: string;
      visible: boolean;
      boundedParameters: Readonly<Record<string, unknown>>;
    }>[];
  }>[];
}>;

export type RendererParityEvidence = Readonly<{
  editor: StorefrontRendererProjection;
  preview: StorefrontRendererProjection;
  published: StorefrontRendererProjection;
  exactParity: boolean;
}>;

export type BaselineStructuralDelta = Readonly<{
  baselineFingerprint: string;
  candidateFingerprint: string;
  pages: readonly Readonly<{
    pageId: string;
    pageFamily: PageType;
    baselineSequence: readonly string[];
    candidateSequence: readonly string[];
    changed: boolean;
  }>[];
  changedPageIds: readonly string[];
}>;

export type ViewportPageFamilyEvidence = Readonly<{
  pageFamily: Phase10aPageFamily;
  viewport: Phase10aViewport;
  locale: Phase10aLocale;
  renderTarget: Phase10aRenderTarget;
  horizontalOverflow: boolean;
  basicAccessibilityPassed: boolean;
  screenshotReference: string | null;
}>;

export type CommercialReviewCriterion = "not-reviewed" | "passed" | "failed";

/**
 * This is a retained review record, not an automated visual-quality score. Narrative
 * fields stay optional until Task 6 supplies an approved contract.
 */
export type CommercialQualityEvidence = Readonly<{
  pageFamily: Phase10aPageFamily;
  viewport: Phase10aViewport;
  recipeId: string | null;
  pageBlueprintProfileId: string | null;
  narrativeSequence?: readonly string[];
  componentFamilySequence: readonly string[];
  variantSequence: readonly string[];
  repeatedFamilyCount: number;
  visualWeightSequence?: readonly string[];
  transitionSequence?: readonly string[];
  productDiscoveryVisible: boolean | null;
  purchaseActionVisible: boolean | null;
  mediaCoverage: "none" | "partial" | "complete";
  responsiveOverflow: boolean;
  accessibilityResult: CommercialReviewCriterion;
  screenshotReference: string | null;
  evaluation: Readonly<{
    hierarchy: CommercialReviewCriterion;
    coherence: CommercialReviewCriterion;
    repetition: CommercialReviewCriterion;
    spacingRhythm: CommercialReviewCriterion;
    surfaceTransitions: CommercialReviewCriterion;
    mediaUsage: CommercialReviewCriterion;
    mobileQuality: CommercialReviewCriterion;
    notes: readonly string[];
  }>;
}>;

export type PublishWithoutProviderEvidence = Readonly<{
  providerCallsBeforePublish: number;
  providerCallsAfterPublish: number;
  publishedSnapshotFingerprint: string;
  providerCalledDuringPublish: boolean;
}>;

function projectionFingerprint(
  projection: Omit<StorefrontRendererProjection, "snapshotFingerprint">,
) {
  return canonicalValueFingerprint(projection);
}

function sectionSequence(snapshot: StorefrontSnapshot, pageId: string) {
  const page = snapshot.pages.find((candidate) => candidate.id === pageId);
  return page ? page.sections.map((section) => `${section.component}:${section.variant}`) : [];
}

/** Captures selections without implying that recipes or profiles are a second state model. */
export function createGenerationAuthorityEvidence(input: {
  plannerId: string;
  providerId: string;
  registeredRecipeIds: Readonly<Record<string, string | null>>;
  pageBlueprintProfileIds: Readonly<Record<string, string | null>>;
  snapshot: StorefrontSnapshot;
}): GenerationAuthorityEvidence {
  const componentSelections = input.snapshot.pages.flatMap((page) =>
    page.sections.map((section) => ({
      pageFamily: page.type,
      componentFamily: section.component,
      variant: section.variant,
      boundedParameters: structuredClone(section.props),
    })),
  );
  return {
    plannerId: input.plannerId,
    providerId: input.providerId,
    registeredRecipeIds: structuredClone(input.registeredRecipeIds),
    pageBlueprintProfileIds: structuredClone(input.pageBlueprintProfileIds),
    componentSelections,
    componentProjectionFingerprint: canonicalValueFingerprint(componentSelections),
  };
}

export function createProposalSnapshotIntegrityEvidence(input: {
  proposal: Readonly<{
    id: string;
    operations: readonly unknown[];
    proposedStorefront: AiStorefrontProjection;
  }>;
  acceptedSnapshot: StorefrontSnapshot;
}): ProposalSnapshotIntegrityEvidence {
  const proposedFingerprint = canonicalValueFingerprint(input.proposal.proposedStorefront);
  const acceptedProjection = {
    pageOrder: input.acceptedSnapshot.pages.map((page) => page.id),
    pages: input.acceptedSnapshot.pages,
    navigation: input.acceptedSnapshot.navigation,
    brandSystem: input.acceptedSnapshot.brandSystem,
  } satisfies AiStorefrontProjection;
  return {
    proposalFingerprint: canonicalValueFingerprint({
      id: input.proposal.id,
      operations: input.proposal.operations,
      proposedStorefront: input.proposal.proposedStorefront,
    }),
    operationFingerprint: canonicalValueFingerprint(input.proposal.operations),
    proposedProjectionFingerprint: proposedFingerprint,
    acceptedSnapshotFingerprint: canonicalStorefrontContentFingerprint(input.acceptedSnapshot),
    exactProjectionParity:
      canonicalValueString(input.proposal.proposedStorefront) ===
      canonicalValueString(acceptedProjection),
  };
}

export function assertProposalSnapshotParity(
  evidence: ProposalSnapshotIntegrityEvidence,
): ProposalSnapshotIntegrityEvidence {
  if (!evidence.exactProjectionParity) {
    throw new Error(
      "The accepted StorefrontSnapshot does not match the reviewed proposal projection.",
    );
  }
  return evidence;
}

export function captureProtectedCommerceProjection(
  catalogue: CatalogueDisplayModel,
  snapshot: StorefrontSnapshot,
): ProtectedCommerceProjection {
  const projection = {
    catalogueId: catalogue.id,
    products: catalogue.products
      .map((product) => ({
        id: product.id,
        sku: product.sku ?? null,
        price: product.price ?? null,
        compareAtPrice: product.compareAtPrice ?? null,
        stockStatus: product.stockStatus ?? null,
        variants: product.variants.map((variant) => ({
          id: variant.id,
          price: variant.price ?? null,
        })),
        options: (product.orderOptions ?? []).map((option) => ({
          id: option.id,
          values: option.values ?? null,
        })),
        mediaBindings: product.images.map((image) => image.id),
      }))
      .sort((left, right) => left.id.localeCompare(right.id)),
    collections: catalogue.collections
      .map((collection) => ({ id: collection.id, productIds: [...collection.productIds] }))
      .sort((left, right) => left.id.localeCompare(right.id)),
    routes: snapshot.pages
      .map((page) => ({ pageId: page.id, pageFamily: page.type, route: page.slug }))
      .sort((left, right) => left.pageId.localeCompare(right.pageId)),
  };
  return { ...projection, fingerprint: canonicalValueFingerprint(projection) };
}

export function assertProtectedCommerceParity(
  baseline: ProtectedCommerceProjection,
  candidate: ProtectedCommerceProjection,
): ProtectedCommerceProjection {
  if (baseline.fingerprint !== candidate.fingerprint) {
    throw new Error("Protected commerce or route evidence changed.");
  }
  return candidate;
}

export function captureApprovedAssetProjection(
  assets: readonly ApprovedGenerationAsset[],
): ApprovedAssetProjection {
  const projection = {
    assets: assets
      .map((asset) => ({
        assetId: asset.assetId,
        role: asset.role,
        sourceReferenceId: asset.sourceReferenceId,
        revision: asset.revision,
        materialFingerprint: asset.materialFingerprint,
        provenance: {
          location: asset.provenance.location,
          observedAt: asset.provenance.observedAt,
        },
      }))
      .sort((left, right) => left.assetId.localeCompare(right.assetId)),
  };
  return { ...projection, fingerprint: canonicalValueFingerprint(projection) };
}

export function assertApprovedAssetParity(
  baseline: ApprovedAssetProjection,
  candidate: ApprovedAssetProjection,
): ApprovedAssetProjection {
  if (baseline.fingerprint !== candidate.fingerprint) {
    throw new Error("Approved asset or provenance evidence changed.");
  }
  return candidate;
}

export function projectStorefrontRenderer(
  snapshot: StorefrontSnapshot,
): StorefrontRendererProjection {
  const projection = {
    pages: snapshot.pages.map((page) => ({
      pageId: page.id,
      pageFamily: page.type,
      route: page.slug,
      componentSequence: page.sections.map((section) => ({
        sectionId: section.id,
        componentFamily: section.component,
        variant: section.variant,
        visible: section.visible,
        boundedParameters: structuredClone(section.props),
      })),
    })),
  };
  return {
    snapshotFingerprint: projectionFingerprint(projection),
    ...projection,
  };
}

export function createRendererParityEvidence(input: {
  editor: StorefrontSnapshot;
  preview: StorefrontSnapshot;
  published: StorefrontSnapshot;
}): RendererParityEvidence {
  const editor = projectStorefrontRenderer(input.editor);
  const preview = projectStorefrontRenderer(input.preview);
  const published = projectStorefrontRenderer(input.published);
  return {
    editor,
    preview,
    published,
    exactParity:
      editor.snapshotFingerprint === preview.snapshotFingerprint &&
      editor.snapshotFingerprint === published.snapshotFingerprint,
  };
}

export function assertRendererProjectionParity(
  evidence: RendererParityEvidence,
): RendererParityEvidence {
  if (!evidence.exactParity) {
    throw new Error("Editor, preview, and published renderer projections diverged.");
  }
  return evidence;
}

export function createBaselineStructuralDelta(
  baseline: StorefrontSnapshot,
  candidate: StorefrontSnapshot,
): BaselineStructuralDelta {
  const pages = baseline.pages.map((page) => {
    const baselineSequence = sectionSequence(baseline, page.id);
    const candidateSequence = sectionSequence(candidate, page.id);
    return {
      pageId: page.id,
      pageFamily: page.type,
      baselineSequence,
      candidateSequence,
      changed: canonicalValueString(baselineSequence) !== canonicalValueString(candidateSequence),
    };
  });
  return {
    baselineFingerprint: canonicalStorefrontContentFingerprint(baseline),
    candidateFingerprint: canonicalStorefrontContentFingerprint(candidate),
    pages,
    changedPageIds: pages.filter((page) => page.changed).map((page) => page.pageId),
  };
}

export function assertCompleteViewportPageFamilyEvidence(
  records: readonly ViewportPageFamilyEvidence[],
  renderTargets: readonly Phase10aRenderTarget[] = PHASE_10A_RENDER_TARGETS,
): readonly ViewportPageFamilyEvidence[] {
  const expected = PHASE_10A_PAGE_FAMILIES.flatMap((pageFamily) =>
    PHASE_10A_VIEWPORTS.flatMap((viewport) =>
      PHASE_10A_LOCALES.flatMap((locale) =>
        renderTargets.map((renderTarget) => `${pageFamily}:${viewport}:${locale}:${renderTarget}`),
      ),
    ),
  );
  const actual = new Set(
    records.map(
      (record) => `${record.pageFamily}:${record.viewport}:${record.locale}:${record.renderTarget}`,
    ),
  );
  const missing = expected.filter((key) => !actual.has(key));
  if (missing.length > 0) {
    throw new Error(`Viewport/page-family evidence is incomplete: ${missing.join(", ")}`);
  }
  return records;
}

export function createPublishWithoutProviderEvidence(input: {
  providerCallsBeforePublish: number;
  providerCallsAfterPublish: number;
  publishedSnapshot: StorefrontSnapshot;
}): PublishWithoutProviderEvidence {
  return {
    providerCallsBeforePublish: input.providerCallsBeforePublish,
    providerCallsAfterPublish: input.providerCallsAfterPublish,
    publishedSnapshotFingerprint: canonicalStorefrontContentFingerprint(input.publishedSnapshot),
    providerCalledDuringPublish:
      input.providerCallsBeforePublish !== input.providerCallsAfterPublish,
  };
}
