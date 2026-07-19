import { aiProviderTargetSchema, type AiOperationRequest } from "@/application/ai-provider";
import { canonicalValueFingerprint, pageModelSchema } from "@/domain/storefront";

export function createAiProposalTargetFingerprint(
  pageInput: unknown,
  targetInput: AiOperationRequest["target"],
): string {
  const page = pageModelSchema.parse(pageInput);
  const target = aiProviderTargetSchema.parse(targetInput);
  if (page.id !== target.pageId) {
    throw new Error("The fingerprint target must match the canonical page.");
  }
  const projection = target.sectionId
    ? {
        pageId: page.id,
        pageType: page.type,
        sectionOrder: page.sections.map(({ id }) => id),
        targetSection: page.sections.find(({ id }) => id === target.sectionId) ?? {
          id: target.sectionId,
          missing: true,
        },
      }
    : page;
  return `proposal-page-${canonicalValueFingerprint(projection)}`;
}
