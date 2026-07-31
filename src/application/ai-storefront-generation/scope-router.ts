import type { PageModel } from "@/domain/storefront";

export type StorefrontGenerationScope =
  | Readonly<{ kind: "storefront"; affectedPageIds: readonly string[]; includesSharedFrame: true }>
  | Readonly<{ kind: "homepage"; affectedPageIds: readonly [string]; includesSharedFrame: false }>;

const homepageOnlyRequest =
  /\b(?:only|just)\s+(?:the\s+)?(?:home\s?page|homepage)\b|\b(?:home\s?page|homepage)\s+only\b/iu;

/**
 * Routes the one explicit page-scoped generation request currently promised by
 * Phase 9. All other instructions remain on the coordinated storefront path.
 */
export function resolveStorefrontGenerationScope(
  instruction: string,
  pages: readonly Pick<PageModel, "id" | "type">[],
): StorefrontGenerationScope {
  const homepage = pages.find((page) => page.type === "home");
  if (homepage && homepageOnlyRequest.test(instruction.normalize("NFC").trim())) {
    return { kind: "homepage", affectedPageIds: [homepage.id], includesSharedFrame: false };
  }
  return {
    kind: "storefront",
    affectedPageIds: pages.map((page) => page.id),
    includesSharedFrame: true,
  };
}
