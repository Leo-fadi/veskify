import { z } from "zod";
import { validateRegisteredPage } from "@/components/registry";
import { localizedTextSchema } from "@/domain/shared";
import { pageModelSchema, type PageModel } from "@/domain/storefront";
import {
  applyDesignOperations,
  designOperationSchema,
  generateHomepageRedesign,
  type DesignOperation,
  type DesignOperationContext,
} from "./operations";

export const proposalValidationResultSchema = z
  .object({ valid: z.boolean(), errors: z.array(z.string()) })
  .strict();
export const designProposalSchema = z
  .object({
    id: z.string().regex(/^proposal_[a-f0-9]{8}$/),
    originalPage: pageModelSchema,
    proposedPage: pageModelSchema,
    operations: z.array(designOperationSchema),
    summary: localizedTextSchema,
    validation: proposalValidationResultSchema,
    status: z.enum(["pending", "accepted", "rejected"]),
  })
  .strict();

export type ProposalValidationResult = z.infer<typeof proposalValidationResultSchema>;
export type DesignProposal = z.infer<typeof designProposalSchema>;

function stableHash(value: string) {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

function proposalId(page: PageModel, operations: readonly DesignOperation[], identity?: string) {
  return `proposal_${stableHash(JSON.stringify({ page, operations, identity }))}`;
}

function defaultSummary(operationCount: number) {
  return {
    en: `Proposed ${operationCount} deterministic design changes.`,
    fi: `Ehdotus sisältää ${operationCount} determinististä designmuutosta.`,
  };
}

type StoredProposal = { proposal: DesignProposal; context: DesignOperationContext };

export class InMemoryDesignProposalStore {
  readonly #proposals = new Map<string, StoredProposal>();

  create({
    originalPage,
    operations: operationInputs,
    context,
    summary,
    identity,
  }: {
    originalPage: PageModel;
    operations: readonly unknown[];
    context: DesignOperationContext;
    summary?: z.input<typeof localizedTextSchema>;
    identity?: string;
  }): DesignProposal {
    const original = pageModelSchema.parse(structuredClone(originalPage));
    validateRegisteredPage(original, context);
    const operations = operationInputs.map((operation) => designOperationSchema.parse(operation));
    const proposed = applyDesignOperations(original, operations, context);
    validateRegisteredPage(proposed, context);
    const proposal = designProposalSchema.parse({
      id: proposalId(original, operations, identity),
      originalPage: original,
      proposedPage: proposed,
      operations,
      summary: localizedTextSchema.parse(summary ?? defaultSummary(operations.length)),
      validation: { valid: true, errors: [] },
      status: "pending",
    });
    if (this.#proposals.has(proposal.id)) {
      throw new Error(`Duplicate design proposal ID: ${proposal.id}.`);
    }
    this.#proposals.set(proposal.id, { proposal: structuredClone(proposal), context });
    return structuredClone(proposal);
  }

  inspect(id: string): DesignProposal {
    const stored = this.#proposals.get(id);
    if (!stored) throw new Error(`Unknown design proposal: ${id}.`);
    return structuredClone(stored.proposal);
  }

  accept(id: string): PageModel {
    const stored = this.#proposals.get(id);
    if (!stored) throw new Error(`Unknown design proposal: ${id}.`);
    if (stored.proposal.status !== "pending") {
      throw new Error(`Proposal ${id} is already ${stored.proposal.status}.`);
    }
    validateRegisteredPage(stored.proposal.proposedPage, stored.context);
    stored.proposal.status = "accepted";
    return pageModelSchema.parse(structuredClone(stored.proposal.proposedPage));
  }

  reject(id: string): PageModel {
    const stored = this.#proposals.get(id);
    if (!stored) throw new Error(`Unknown design proposal: ${id}.`);
    if (stored.proposal.status !== "pending") {
      throw new Error(`Proposal ${id} is already ${stored.proposal.status}.`);
    }
    stored.proposal.status = "rejected";
    return pageModelSchema.parse(structuredClone(stored.proposal.originalPage));
  }
}

function availableCampaignId(page: PageModel) {
  const base = "section_home_campaign_luxury_proposal";
  if (!page.sections.some((section) => section.id === base)) return base;
  let suffix = 2;
  while (page.sections.some((section) => section.id === `${base}_${suffix}`)) suffix += 1;
  return `${base}_${suffix}`;
}

export function createLuxuryCampaignHomepageProposal(
  originalPage: PageModel,
  context: DesignOperationContext,
  store = new InMemoryDesignProposalStore(),
): DesignProposal {
  const redesign = generateHomepageRedesign(
    originalPage,
    { direction: "luxury", includeCampaign: false },
    context,
  );
  const sectionId = availableCampaignId(originalPage);
  const operations: DesignOperation[] = [
    ...redesign.operations,
    {
      type: "ADD_APPROVED_SECTION",
      sectionId,
      component: "campaignBanner",
      variant: "imageOverlay",
    },
    { type: "CHANGE_BACKGROUND", sectionId, background: "secondary" },
    { type: "CHANGE_TYPOGRAPHY", sectionId, typography: "serif" },
    { type: "CHANGE_DENSITY", sectionId, density: "spacious" },
    { type: "CHANGE_SHAPE", sectionId, shape: "soft" },
    { type: "CHANGE_ALIGNMENT", sectionId, alignment: "center" },
    { type: "CHANGE_CTA_STYLE", sectionId, ctaPresentation: "secondary" },
  ];
  return store.create({
    originalPage,
    operations,
    context,
    summary: {
      en: "Make the homepage feel more luxurious and add a campaign section.",
      fi: "Tee etusivusta ylellisempi ja lisää kampanjaosio.",
    },
  });
}
