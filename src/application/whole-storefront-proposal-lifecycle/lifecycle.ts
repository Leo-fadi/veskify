import { canonicalValueFingerprint, canonicalValueString } from "@/domain/storefront";
import {
  wholeStorefrontProposalSchema,
  type WholeStorefrontProposal,
  type WholeStorefrontProposalCompilationInput,
  type WholeStorefrontProposalLifecycleState,
  type WholeStorefrontRuntimeState,
  WholeStorefrontProposalError,
} from "./contract";
import {
  replayWholeStorefrontProposalOperations,
  validateWholeStorefrontProposal,
} from "./compiler";

export type WholeStorefrontHistoryTransaction = Readonly<{
  transactionId: string;
  proposalId: string;
  original: WholeStorefrontRuntimeState;
  resulting: WholeStorefrontRuntimeState;
}>;

export type WholeStorefrontProposalLifecycleSnapshot = Readonly<{
  state: WholeStorefrontProposalLifecycleState;
  proposal: WholeStorefrontProposal;
  activeStorefront: WholeStorefrontRuntimeState;
  storedStorefront: WholeStorefrontRuntimeState;
  publishedStorefront: WholeStorefrontRuntimeState;
  transaction: WholeStorefrontHistoryTransaction | null;
  failure: { code: string; message: string } | null;
}>;

function clone<T>(value: T): T {
  return structuredClone(value);
}

function transactionId(proposal: WholeStorefrontProposal) {
  return `whole_storefront_transaction_${canonicalValueFingerprint({
    proposalId: proposal.id,
    original: proposal.originalStorefront,
    proposed: proposal.proposedStorefront,
  }).slice(-12)}`;
}

export class WholeStorefrontProposalAcceptanceCoordinator {
  readonly #currentInput: () => WholeStorefrontProposalCompilationInput;
  readonly #storedStorefront: WholeStorefrontRuntimeState;
  readonly #publishedStorefront: WholeStorefrontRuntimeState;
  #proposal: WholeStorefrontProposal;
  #activeStorefront: WholeStorefrontRuntimeState;
  #state: WholeStorefrontProposalLifecycleState;
  #transaction: WholeStorefrontHistoryTransaction | null = null;
  #past: WholeStorefrontHistoryTransaction[] = [];
  #future: WholeStorefrontHistoryTransaction[] = [];
  #failure: { code: string; message: string } | null = null;

  constructor({
    proposal,
    currentInput,
    storedStorefront,
    publishedStorefront,
  }: {
    proposal: unknown;
    currentInput: () => WholeStorefrontProposalCompilationInput;
    storedStorefront?: WholeStorefrontRuntimeState;
    publishedStorefront?: WholeStorefrontRuntimeState;
  }) {
    this.#proposal = wholeStorefrontProposalSchema.parse(clone(proposal));
    this.#currentInput = currentInput;
    const validated = validateWholeStorefrontProposal(this.#proposal, currentInput());
    this.#activeStorefront = clone(validated.originalStorefront);
    this.#storedStorefront = clone(storedStorefront ?? validated.originalStorefront);
    this.#publishedStorefront = clone(publishedStorefront ?? validated.originalStorefront);
    this.#state = validated.status === "pending" ? "ready" : validated.status;
  }

  inspect(): WholeStorefrontProposalLifecycleSnapshot {
    return clone({
      state: this.#state,
      proposal: this.#proposal,
      activeStorefront: this.#activeStorefront,
      storedStorefront: this.#storedStorefront,
      publishedStorefront: this.#publishedStorefront,
      transaction: this.#transaction,
      failure: this.#failure,
    });
  }

  accept(): WholeStorefrontProposalLifecycleSnapshot {
    if (this.#state === "accepted" || this.#past.some((item) => item.proposalId === this.#proposal.id)) {
      this.#failure = { code: "duplicate-acceptance", message: "This whole-storefront proposal was already accepted." };
      return this.inspect();
    }
    if (["rejected", "closed", "stale"].includes(this.#state)) {
      this.#failure = { code: "terminal-proposal", message: "This whole-storefront proposal is closed." };
      return this.inspect();
    }
    const before = clone(this.#activeStorefront);
    try {
      const validated = validateWholeStorefrontProposal(this.#proposal, this.#currentInput());
      if (canonicalValueString(before) !== canonicalValueString(validated.originalStorefront)) {
        throw new WholeStorefrontProposalError(
          "stale-draft",
          "The active whole-storefront state changed after the proposal was prepared.",
        );
      }
      const resulting = replayWholeStorefrontProposalOperations(before, validated.operations);
      if (canonicalValueString(resulting) !== canonicalValueString(validated.proposedStorefront)) {
        throw new WholeStorefrontProposalError(
          "acceptance-transaction-failed",
          "Whole-storefront operations did not reproduce the reviewed proposal.",
        );
      }
      const transaction: WholeStorefrontHistoryTransaction = {
        transactionId: transactionId(validated),
        proposalId: validated.id,
        original: before,
        resulting: clone(resulting),
      };
      this.#activeStorefront = clone(resulting);
      this.#past.push(clone(transaction));
      this.#future = [];
      this.#transaction = clone(transaction);
      this.#proposal = wholeStorefrontProposalSchema.parse({ ...this.#proposal, status: "accepted" });
      this.#state = "accepted";
      this.#failure = null;
    } catch (error) {
      this.#activeStorefront = before;
      if (error instanceof WholeStorefrontProposalError && error.code.startsWith("stale-")) {
        this.#proposal = wholeStorefrontProposalSchema.parse({ ...this.#proposal, status: "rejected" });
        this.#state = "stale";
        this.#failure = { code: error.code, message: error.message };
      } else {
        this.#state = "failed";
        this.#failure = {
          code: error instanceof WholeStorefrontProposalError ? error.code : "acceptance-transaction-failed",
          message: "The whole-storefront proposal could not be applied safely.",
        };
      }
    }
    return this.inspect();
  }

  reject(): WholeStorefrontProposalLifecycleSnapshot {
    if (this.#state === "ready" || this.#state === "failed") {
      this.#proposal = wholeStorefrontProposalSchema.parse({ ...this.#proposal, status: "rejected" });
      this.#state = "rejected";
      this.#failure = null;
    }
    return this.inspect();
  }

  close(): WholeStorefrontProposalLifecycleSnapshot {
    if (this.#state === "ready" || this.#state === "failed") {
      this.#proposal = wholeStorefrontProposalSchema.parse({ ...this.#proposal, status: "rejected" });
      this.#state = "closed";
      this.#failure = null;
    }
    return this.inspect();
  }

  undo(): WholeStorefrontRuntimeState | undefined {
    const transaction = this.#past.at(-1);
    if (!transaction || canonicalValueString(this.#activeStorefront) !== canonicalValueString(transaction.resulting)) {
      return undefined;
    }
    this.#past.pop();
    this.#future.unshift(clone(transaction));
    this.#activeStorefront = clone(transaction.original);
    return clone(this.#activeStorefront);
  }

  redo(): WholeStorefrontRuntimeState | undefined {
    const transaction = this.#future[0];
    if (!transaction || canonicalValueString(this.#activeStorefront) !== canonicalValueString(transaction.original)) {
      return undefined;
    }
    this.#future.shift();
    this.#past.push(clone(transaction));
    this.#activeStorefront = clone(transaction.resulting);
    return clone(this.#activeStorefront);
  }
}
