import {
  createAiProposalTargetFingerprint,
  generatedAiProposalSchema,
  type AiProposalEditorIdentity,
  type GeneratedAiProposal,
} from "@/application/ai-proposal-generation";
import type { InMemoryDesignProposalStore } from "@/application/design-operations";
import {
  canonicalValueFingerprint,
  canonicalValueString,
  type PageModel,
} from "@/domain/storefront";
import {
  aiProposalConfirmationSnapshotSchema,
  type AiProposalConfirmationFailure,
  type AiProposalConfirmationResult,
} from "./contract";

const messages = {
  applicationFailed: {
    en: "The proposal could not be applied safely. Your current draft is unchanged. Try again or reject this proposal.",
    fi: "Ehdotusta ei voitu soveltaa turvallisesti. Nykyinen luonnos säilyi ennallaan. Yritä uudelleen tai hylkää ehdotus.",
  },
  stale: {
    en: "The page changed after this request started. Start a new request from the current page.",
    fi: "Sivu muuttui pyynnön aloittamisen jälkeen. Aloita uusi pyyntö nykyiseltä sivulta.",
  },
  invalidProposal: {
    en: "The proposal is no longer available for safe review. Create a new proposal.",
    fi: "Ehdotusta ei voi enää tarkistaa turvallisesti. Luo uusi ehdotus.",
  },
} as const;

class StaleProposalError extends Error {}

function failure(code: AiProposalConfirmationFailure["code"]): AiProposalConfirmationFailure {
  return { code, message: messages[code], retryable: code === "applicationFailed" };
}

function sameValue(left: unknown, right: unknown) {
  return canonicalValueString(left) === canonicalValueString(right);
}

export class AiProposalConfirmationOrchestrator {
  readonly #proposalStore: InMemoryDesignProposalStore;
  readonly #currentIdentity: () => AiProposalEditorIdentity;
  #snapshot = aiProposalConfirmationSnapshotSchema.parse({
    state: "idle",
    generatedProposal: null,
    failure: null,
  });

  constructor({
    proposalStore,
    currentIdentity,
  }: {
    proposalStore: InMemoryDesignProposalStore;
    currentIdentity: () => AiProposalEditorIdentity;
  }) {
    this.#proposalStore = proposalStore;
    this.#currentIdentity = currentIdentity;
  }

  inspect() {
    return structuredClone(this.#snapshot);
  }

  open(input: GeneratedAiProposal): AiProposalConfirmationResult {
    const generated = generatedAiProposalSchema.parse(structuredClone(input));
    const stored = this.#proposalStore.inspect(generated.proposal.id);
    if (!sameValue(stored, generated.proposal) || stored.status !== "pending") {
      return this.#invalidate(generated.proposal.id);
    }
    const expectedFingerprint = createAiProposalTargetFingerprint(generated.proposal.originalPage, {
      pageId: generated.pageId,
      ...(generated.sectionId ? { sectionId: generated.sectionId } : {}),
    });
    if (expectedFingerprint !== generated.targetFingerprint) {
      return this.#invalidate(generated.proposal.id);
    }
    const permissionFingerprint = `proposal-permissions-${canonicalValueFingerprint(
      generated.permissionGrants,
    )}`;
    if (permissionFingerprint !== generated.permissionFingerprint) {
      return this.#invalidate(generated.proposal.id);
    }
    this.#snapshot = aiProposalConfirmationSnapshotSchema.parse({
      state: "ready",
      generatedProposal: generated,
      failure: null,
    });
    return this.inspect();
  }

  beginAcceptance(): AiProposalConfirmationResult {
    if (
      this.#snapshot.state !== "ready" &&
      !(this.#snapshot.state === "failed" && this.#snapshot.generatedProposal)
    ) {
      throw new Error("Only a ready or retryable failed proposal can be accepted.");
    }
    try {
      this.#assertCurrentIdentity();
      const generated = this.#requiredProposal();
      const page = this.#proposalStore.prepareAcceptance(generated.proposal.id);
      this.#snapshot = aiProposalConfirmationSnapshotSchema.parse({
        state: "accepting",
        generatedProposal: generated,
        failure: null,
      });
      return { ...this.inspect(), page };
    } catch (error) {
      return error instanceof StaleProposalError
        ? this.#closeAsStale()
        : this.#fail("applicationFailed", this.#snapshot.generatedProposal);
    }
  }

  completeAcceptance(applyToDraft: (page: PageModel) => void): AiProposalConfirmationResult {
    if (this.#snapshot.state !== "accepting") {
      throw new Error("Only an accepting proposal can complete application.");
    }
    try {
      this.#assertCurrentIdentity();
      const generated = this.#requiredProposal();
      const preparedPage = this.#proposalStore.prepareAcceptance(generated.proposal.id);
      applyToDraft(structuredClone(preparedPage));
      const page = this.#proposalStore.accept(generated.proposal.id);
      const accepted = generatedAiProposalSchema.parse({
        ...generated,
        proposal: this.#proposalStore.inspect(generated.proposal.id),
      });
      this.#snapshot = aiProposalConfirmationSnapshotSchema.parse({
        state: "accepted",
        generatedProposal: accepted,
        failure: null,
      });
      return { ...this.inspect(), page };
    } catch (error) {
      return error instanceof StaleProposalError
        ? this.#closeAsStale()
        : this.#fail("applicationFailed", this.#snapshot.generatedProposal);
    }
  }

  reject(): AiProposalConfirmationResult {
    if (
      this.#snapshot.state !== "ready" &&
      !(this.#snapshot.state === "failed" && this.#snapshot.generatedProposal)
    ) {
      throw new Error("Only a ready or retryable failed proposal can be rejected.");
    }
    const generated = this.#requiredProposal();
    const page = this.#proposalStore.reject(generated.proposal.id);
    const rejected = generatedAiProposalSchema.parse({
      ...generated,
      proposal: this.#proposalStore.inspect(generated.proposal.id),
    });
    this.#snapshot = aiProposalConfirmationSnapshotSchema.parse({
      state: "rejected",
      generatedProposal: rejected,
      failure: null,
    });
    return { ...this.inspect(), page };
  }

  close(): AiProposalConfirmationResult {
    const generated = this.#snapshot.generatedProposal;
    if (generated && this.#proposalStore.inspect(generated.proposal.id).status === "pending") {
      this.#proposalStore.reject(generated.proposal.id);
    }
    this.#snapshot = aiProposalConfirmationSnapshotSchema.parse({
      state: "closed",
      generatedProposal: generated
        ? {
            ...generated,
            proposal: this.#proposalStore.inspect(generated.proposal.id),
          }
        : null,
      failure: null,
    });
    return this.inspect();
  }

  markStale(): AiProposalConfirmationResult {
    return this.#closeAsStale();
  }

  reset(): AiProposalConfirmationResult {
    if (["ready", "accepting", "failed"].includes(this.#snapshot.state)) this.close();
    this.#snapshot = aiProposalConfirmationSnapshotSchema.parse({
      state: "idle",
      generatedProposal: null,
      failure: null,
    });
    return this.inspect();
  }

  #requiredProposal() {
    const generated = this.#snapshot.generatedProposal;
    if (!generated) throw new Error("The confirmation lifecycle has no generated proposal.");
    return generated;
  }

  #assertCurrentIdentity() {
    const generated = this.#requiredProposal();
    const current = this.#currentIdentity();
    if (
      current.projectId !== generated.projectId ||
      current.draftSnapshotId !== generated.draftSnapshotId ||
      current.draftRevision !== generated.draftRevision ||
      !sameValue(current.target, generated.editorTarget)
    ) {
      throw new StaleProposalError();
    }
    let currentFingerprint: string;
    try {
      currentFingerprint = createAiProposalTargetFingerprint(current.page, {
        pageId: generated.pageId,
        ...(generated.sectionId ? { sectionId: generated.sectionId } : {}),
      });
    } catch {
      throw new StaleProposalError();
    }
    if (currentFingerprint !== generated.targetFingerprint) throw new StaleProposalError();
  }

  #closeAsStale(): AiProposalConfirmationResult {
    const generated = this.#snapshot.generatedProposal;
    if (generated && this.#proposalStore.inspect(generated.proposal.id).status === "pending") {
      this.#proposalStore.reject(generated.proposal.id);
    }
    return this.#fail(
      "stale",
      generated
        ? generatedAiProposalSchema.parse({
            ...generated,
            proposal: this.#proposalStore.inspect(generated.proposal.id),
          })
        : null,
    );
  }

  #invalidate(proposalId: string): AiProposalConfirmationResult {
    if (this.#proposalStore.inspect(proposalId).status === "pending") {
      this.#proposalStore.reject(proposalId);
    }
    return this.#fail("invalidProposal", null);
  }

  #fail(
    code: AiProposalConfirmationFailure["code"],
    generatedProposal: GeneratedAiProposal | null,
  ): AiProposalConfirmationResult {
    this.#snapshot = aiProposalConfirmationSnapshotSchema.parse({
      state: code === "stale" ? "stale" : "failed",
      generatedProposal,
      failure: failure(code),
    });
    return this.inspect();
  }
}
