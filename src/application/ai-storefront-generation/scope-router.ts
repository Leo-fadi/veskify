import type { PageModel } from "@/domain/storefront";

export type StorefrontGenerationScope =
  | Readonly<{ kind: "storefront"; affectedPageIds: readonly string[]; includesSharedFrame: true }>
  | Readonly<{ kind: "homepage"; affectedPageIds: readonly [string]; includesSharedFrame: false }>;

const homepageOnlyRequest =
  /\b(?:only|just)\s+(?:the\s+)?(?:home\s?page|homepage)\b|\b(?:home\s?page|homepage)\s+only\b|\b(?:vain|ainoastaan)\s+etusivu(?:a|n)?\b|\betusivu(?:a|n)?\s+(?:vain|ainoastaan)\b/iu;
const explicitLimitedScope =
  /\b(?:only|just|vain|ainoastaan)\b[^.!?]{0,80}\b(?:home\s?page|homepage|collection\s?page|product\s?page|etusivu(?:a|n)?|kokoelmasivu(?:a|n)?|tuotesivu(?:a|n)?)\b|\b(?:home\s?page|homepage|collection\s?page|product\s?page|etusivu(?:a|n)?|kokoelmasivu(?:a|n)?|tuotesivu(?:a|n)?)\b[^.!?]{0,40}\b(?:only|just|vain|ainoastaan)\b/iu;
const broadenedHomepageScope =
  /\b(?:home\s?page|homepage|etusivu(?:a|n)?)\b[^.!?]{0,40}\b(?:and|sekä|ja)\s+(?:the\s+)?(?:collection\s?page|product\s?page|kokoelmasivu(?:a|n)?|tuotesivu(?:a|n)?)\b/iu;
const wholeHomepageCompositionIntent =
  /\b(?:landing\s+page|replace\s+the\s+current\s+composition|materially\s+different\s+layout|section\s+order|page\s+composition|whole\s+homepage|entire\s+homepage|koko\s+etusivu)\b/iu;
const sectionReferencePatterns = [
  /\b(?:announcement(?:\s+bar)?|ilmoituspalkki)\b/iu,
  /\b(?:header|site\s+header|store\s+header|ylätunniste)\b/iu,
  /\bhero(?:[-\s]?osio(?:sta|ta|n)?)?\b/iu,
  /\b(?:featured\s+products?|product\s+grid|tuoteruudukko|tuotenosto(?:t|ja)?)\b/iu,
  /\b(?:collection\s+discovery|featured\s+collections?|collection\s+grid|kokoelma(?:haku|nostot?|ruudukko))\b/iu,
  /\b(?:brand\s+story|story\s+section|bränditarina)\b/iu,
  /\b(?:trust\s+section|trust\s+signals?|benefits?\s+section|luottamusosio|hyötyosio)\b/iu,
  /\b(?:campaign\s+(?:banner|section)|kampanjabanneri|kampanjaosio)\b/iu,
  /\b(?:newsletter(?:\s+section)?|uutiskirjeosio)\b/iu,
  /\b(?:footer|site\s+footer|store\s+footer|alatunniste)\b/iu,
] as const;

function hasNarrowingTerm(value: string) {
  return [...value.matchAll(/\b(?:only|just|vain|ainoastaan)\b/giu)].some((match) => {
    const prefix = value.slice(0, match.index).trimEnd();
    return !/(?:\bnot|\bei)\s*$/iu.test(prefix);
  });
}

/**
 * Detects a merchant-authored section boundary before page-wide homepage
 * authority is considered. This stays conservative: one identified section is
 * narrow unless the instruction also describes a whole-page composition.
 */
export function hasExplicitStorefrontSectionIntent(instruction: string) {
  const normalized = instruction.normalize("NFC").trim();
  const references = sectionReferencePatterns.flatMap((pattern) => {
    const match = pattern.exec(normalized);
    return match?.index === undefined ? [] : [{ index: match.index, length: match[0].length }];
  });
  if (references.length === 0 && /\b(?:section|osio(?:sta|ta|n)?)\b/iu.test(normalized)) {
    const match = /\b(?:section|osio(?:sta|ta|n)?)\b/iu.exec(normalized)!;
    references.push({ index: match.index, length: match[0].length });
  }
  if (references.length === 0) return false;
  if (
    references.some(({ index, length }) =>
      hasNarrowingTerm(
        normalized.slice(Math.max(0, index - 48), Math.min(normalized.length, index + length + 48)),
      ),
    )
  ) {
    return true;
  }
  return references.length === 1 && !wholeHomepageCompositionIntent.test(normalized);
}

export class StorefrontGenerationScopeError extends Error {
  constructor() {
    super("The requested page scope is unsupported or ambiguous.");
    this.name = "StorefrontGenerationScopeError";
  }
}

/**
 * Routes the one explicit page-scoped generation request currently promised by
 * Phase 9. All other instructions remain on the coordinated storefront path.
 */
export function resolveStorefrontGenerationScope(
  instruction: string,
  pages: readonly Pick<PageModel, "id" | "type">[],
): StorefrontGenerationScope {
  const homepage = pages.find((page) => page.type === "home");
  const normalized = instruction.normalize("NFC").trim();
  if (homepageOnlyRequest.test(normalized) && broadenedHomepageScope.test(normalized)) {
    throw new StorefrontGenerationScopeError();
  }
  if (homepageOnlyRequest.test(normalized) && hasExplicitStorefrontSectionIntent(normalized)) {
    throw new StorefrontGenerationScopeError();
  }
  if (homepage && homepageOnlyRequest.test(normalized)) {
    return { kind: "homepage", affectedPageIds: [homepage.id], includesSharedFrame: false };
  }
  if (explicitLimitedScope.test(normalized)) throw new StorefrontGenerationScopeError();
  return {
    kind: "storefront",
    affectedPageIds: pages.map((page) => page.id),
    includesSharedFrame: true,
  };
}
