import type { AiStorefrontProposal } from "@/application/ai-storefront";
import type { DesignOperation } from "@/application/design-operations";
import type { Locale } from "@/domain/shared";
import type { PageModel } from "@/domain/storefront";
import {
  localizedMerchantValue,
  merchantOperationChangePart,
  merchantSectionName,
} from "./proposal-change-details";

export type StorefrontProposalReviewItem = {
  title: string;
  summary: string;
  operationIndexes: number[];
};

export type StorefrontProposalPageReview = {
  pageId: string;
  title: string;
  operationCount: number;
  items: StorefrontProposalReviewItem[];
};

export type StorefrontProposalReview = {
  affectedPageCount: number;
  operationCount: number;
  globalChanges: StorefrontProposalReviewItem[];
  pages: StorefrontProposalPageReview[];
  warnings: string[];
  blockers: string[];
  representedOperationIndexes: number[];
  complete: boolean;
};

function pageTitle(page: PageModel | undefined, locale: Locale, primaryLocale: Locale) {
  if (!page) return locale === "fi" ? "Kaupan sivu" : "Storefront page";
  if (page.type === "home") return locale === "fi" ? "Etusivu" : "Homepage";
  return (
    localizedMerchantValue(page.title, locale, primaryLocale) ??
    (locale === "fi" ? "Kaupan sivu" : "Storefront page")
  );
}

function sentence(parts: string[], locale: Locale) {
  const unique = [...new Set(parts.filter(Boolean))];
  const last = unique.pop();
  if (!last) return "";
  const value =
    unique.length === 0 ? last : `${unique.join(", ")} ${locale === "fi" ? "ja" : "and"} ${last}`;
  return `${value.charAt(0).toLocaleUpperCase(locale)}${value.slice(1)}.`;
}

function operationSectionId(operation: DesignOperation) {
  return "sectionId" in operation ? operation.sectionId : null;
}

export function createStorefrontProposalReview(
  proposal: AiStorefrontProposal,
  locale: Locale,
  primaryLocale: Locale,
): StorefrontProposalReview {
  const originalById = new Map(proposal.originalStorefront.pages.map((page) => [page.id, page]));
  const proposedById = new Map(proposal.proposedStorefront.pages.map((page) => [page.id, page]));
  const represented = new Set<number>();
  const blockers: string[] = [];
  const globalChanges: StorefrontProposalReviewItem[] = [];

  proposal.operations.forEach((envelope, operationIndex) => {
    if (envelope.target.kind !== "storefrontDesignSystem") return;
    const part = merchantOperationChangePart(envelope.operation, null, locale);
    if (!part) return;
    represented.add(operationIndex);
    globalChanges.push({
      title: locale === "fi" ? "Kaupan yhteinen ilme" : "Storefront design",
      summary: sentence([part], locale),
      operationIndexes: [operationIndex],
    });
  });

  const affectedPageIds = new Set(proposal.target.affectedPageIds);
  const pageIdsInCanonicalOrder = [
    ...proposal.originalStorefront.pageOrder.filter((pageId) => affectedPageIds.has(pageId)),
    ...proposal.target.affectedPageIds.filter(
      (pageId) => !proposal.originalStorefront.pageOrder.includes(pageId),
    ),
  ];
  const pages = pageIdsInCanonicalOrder.map((pageId) => {
    const original = originalById.get(pageId);
    const proposed = proposedById.get(pageId);
    if (!original || !proposed) {
      blockers.push(
        locale === "fi"
          ? "Yhtä kohdesivua ei voida näyttää turvallisesti."
          : "One affected page cannot be represented safely.",
      );
    }
    const groups = new Map<
      string,
      { sectionId: string | null; parts: string[]; operationIndexes: number[] }
    >();
    proposal.operations.forEach((envelope, operationIndex) => {
      if (envelope.target.kind === "storefrontDesignSystem") return;
      if (envelope.target.pageId !== pageId) return;
      const sectionId = operationSectionId(envelope.operation);
      const part = merchantOperationChangePart(envelope.operation, sectionId, locale, proposed);
      if (!part) return;
      represented.add(operationIndex);
      const key = sectionId ?? `page:${pageId}`;
      const group = groups.get(key) ?? { sectionId, parts: [], operationIndexes: [] };
      group.parts.push(part);
      group.operationIndexes.push(operationIndex);
      groups.set(key, group);
    });
    const items = [...groups.values()].map((group) => ({
      title:
        group.sectionId === null
          ? pageTitle(proposed ?? original, locale, primaryLocale)
          : merchantSectionName(
              proposed?.sections.find((section) => section.id === group.sectionId) ??
                original?.sections.find((section) => section.id === group.sectionId),
              locale,
              primaryLocale,
            ),
      summary: sentence(group.parts, locale),
      operationIndexes: [...new Set(group.operationIndexes)],
    }));
    return {
      pageId,
      title: pageTitle(proposed ?? original, locale, primaryLocale),
      operationCount: new Set(items.flatMap((item) => item.operationIndexes)).size,
      items,
    };
  });

  const representedOperationIndexes = [...represented].sort((left, right) => left - right);
  if (representedOperationIndexes.length !== proposal.operations.length) {
    blockers.push(
      locale === "fi"
        ? "Kaikkia suunniteltuja muutoksia ei voida näyttää tarkistuksessa."
        : "Not every planned change can be represented in this review.",
    );
  }
  const globalKeys = new Set(
    globalChanges.flatMap((item) =>
      item.operationIndexes.map((index) => proposal.operations[index]?.operation.type),
    ),
  );
  if (
    globalKeys.has("APPLY_REGISTERED_BRAND_SYSTEM")
      ? proposal.affectedDesignState === null
      : (proposal.affectedDesignState?.colors && !globalKeys.has("APPLY_APPROVED_BRAND_COLOURS")) ||
        (proposal.affectedDesignState?.typography &&
          !globalKeys.has("APPLY_APPROVED_BRAND_TYPOGRAPHY"))
  ) {
    blockers.push(
      locale === "fi"
        ? "Kaupan yhteistä ilmettä ei voida näyttää kokonaan."
        : "The global storefront design changes are not fully represented.",
    );
  }

  return {
    affectedPageCount: proposal.target.affectedPageIds.length,
    operationCount: proposal.operations.length,
    globalChanges,
    pages,
    warnings: [],
    blockers,
    representedOperationIndexes,
    complete:
      blockers.length === 0 &&
      pages.length === proposal.target.affectedPageIds.length &&
      representedOperationIndexes.every((operationIndex, index) => operationIndex === index),
  };
}
