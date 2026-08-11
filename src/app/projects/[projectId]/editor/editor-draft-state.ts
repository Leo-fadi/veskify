import type { AiStorefrontProjection, AiStorefrontProposal } from "@/application/ai-storefront";
import {
  applyDynamicCommerceArchetypePage,
  projectDynamicCommerceArchetypePages,
} from "@/application/dynamic-commerce-routes";
import type { CatalogueDisplayModel } from "@/domain/catalogue";
import type { BrandSystem } from "@/domain/design-system";
import {
  canonicalValueFingerprint,
  type PageModel,
  type PageType,
  type StorefrontSnapshot,
} from "@/domain/storefront";

const legacyEditorPageTypes = new Set<PageType>(["home", "collection", "product"]);

export type AcceptedAiReceiptClientAuthority = Readonly<{
  receiptId: string;
  acceptedSnapshotFingerprint: string;
}>;

export function establishAcceptedAiReceiptClientAuthority(
  receiptId: string,
  acceptedSnapshot: StorefrontSnapshot,
): AcceptedAiReceiptClientAuthority {
  return {
    receiptId,
    acceptedSnapshotFingerprint: canonicalValueFingerprint(acceptedSnapshot),
  };
}

export function reconcileAcceptedAiReceiptClientAuthority(
  authority: AcceptedAiReceiptClientAuthority | undefined,
  activeSnapshot: StorefrontSnapshot | undefined,
): AcceptedAiReceiptClientAuthority | undefined {
  if (!authority || !activeSnapshot) return undefined;
  return authority.acceptedSnapshotFingerprint === canonicalValueFingerprint(activeSnapshot)
    ? authority
    : undefined;
}

export const canonicalPagesEqual = (left: PageModel, right: PageModel) =>
  JSON.stringify(left) === JSON.stringify(right);

export function composeActiveEditorDraft({
  draft,
  sessionPages,
  brandSystem,
}: {
  draft: StorefrontSnapshot;
  sessionPages: Readonly<Record<string, PageModel>>;
  brandSystem?: BrandSystem;
}): StorefrontSnapshot {
  let active = {
    ...structuredClone(draft),
    pages: draft.pages.map((page) => structuredClone(sessionPages[page.id] ?? page)),
    brandSystem: structuredClone(brandSystem ?? draft.brandSystem),
  };
  if (active.dynamicCommercePresentation) {
    for (const sessionPage of Object.values(sessionPages)) {
      if (!active.pages.some(({ id }) => id === sessionPage.id)) {
        active = applyDynamicCommerceArchetypePage(active, sessionPage);
      }
    }
  }
  return active;
}

export function projectCanonicalEditorPages({
  draft,
  catalogue,
  includeAllLegacyPages = false,
  representativeRouteIds = {},
}: {
  draft: StorefrontSnapshot;
  catalogue: CatalogueDisplayModel;
  includeAllLegacyPages?: boolean;
  representativeRouteIds?: Readonly<Record<string, string>>;
}): PageModel[] {
  if (!draft.dynamicCommercePresentation) {
    return draft.pages
      .filter((page) => includeAllLegacyPages || legacyEditorPageTypes.has(page.type))
      .map((page) => structuredClone(page));
  }
  return [
    ...draft.pages.map((page) => structuredClone(page)),
    ...projectDynamicCommerceArchetypePages(draft, catalogue, representativeRouteIds).map(
      ({ page }) => page,
    ),
  ];
}

export function changedPagesForActiveDraft({
  baseDraft,
  activeDraft,
}: {
  baseDraft: StorefrontSnapshot;
  activeDraft: StorefrontSnapshot;
}): PageModel[] {
  const activeById = new Map(activeDraft.pages.map((page) => [page.id, page]));
  return baseDraft.pages.flatMap((basePage) => {
    const activePage = activeById.get(basePage.id);
    return activePage && !canonicalPagesEqual(activePage, basePage)
      ? [structuredClone(activePage)]
      : [];
  });
}

export function proposalStorefrontPreview({
  proposal,
  previewActive,
  visibleState,
}: {
  proposal: { status: string; proposedStorefront: AiStorefrontProjection } | null;
  previewActive: boolean;
  visibleState: string;
}): AiStorefrontProjection | undefined {
  if (!previewActive || proposal?.status !== "pending") return undefined;
  if (visibleState !== "proposalReady" && visibleState !== "accepting") return undefined;
  return proposal.proposedStorefront;
}

/**
 * Projects a migration proposal into the canonical snapshot shape used only by the read-only
 * review canvas. The accepted draft remains the untouched baseline passed to proposal execution.
 */
export function proposalCanonicalReviewSnapshot({
  proposal,
  previewActive,
  visibleState,
  acceptanceBaseline,
}: {
  proposal: Pick<
    AiStorefrontProposal,
    "status" | "proposedStorefront" | "dynamicCommerceMigration"
  > | null;
  previewActive: boolean;
  visibleState: string;
  acceptanceBaseline: StorefrontSnapshot;
}): StorefrontSnapshot | undefined {
  const projection = proposalStorefrontPreview({ proposal, previewActive, visibleState });
  if (
    !projection ||
    !proposal?.dynamicCommerceMigration ||
    !projection.dynamicCommercePresentation
  ) {
    return undefined;
  }
  return {
    ...structuredClone(acceptanceBaseline),
    brandSystem: structuredClone(projection.brandSystem),
    navigation: structuredClone(projection.navigation),
    pages: structuredClone(projection.pages),
    dynamicCommercePresentation: structuredClone(projection.dynamicCommercePresentation),
  };
}
