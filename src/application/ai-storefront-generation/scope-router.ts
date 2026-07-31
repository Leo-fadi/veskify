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
