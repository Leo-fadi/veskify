import type { AiStorefrontProjection } from "@/application/ai-storefront";
import type { BrandSystem } from "@/domain/design-system";
import type { PageModel, StorefrontSnapshot } from "@/domain/storefront";

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
  return {
    ...structuredClone(draft),
    pages: draft.pages.map((page) => structuredClone(sessionPages[page.id] ?? page)),
    brandSystem: structuredClone(brandSystem ?? draft.brandSystem),
  };
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
