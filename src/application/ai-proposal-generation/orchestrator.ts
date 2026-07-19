import {
  AiProviderUnavailableError,
  AiProviderValidationError,
  requestAiProposal,
} from "@/application/ai-provider";
import { InMemoryDesignProposalStore } from "@/application/design-operations";
import { canonicalValueString } from "@/domain/storefront";
import {
  aiProposalGenerationFailureSchema,
  generatedAiProposalSchema,
  type AiProposalEditorIdentity,
  type AiProposalGenerationAnalytics,
  type AiProposalGenerationCommand,
  type AiProposalGenerationFailure,
  type AiProposalGenerationResult,
  type GeneratedAiProposal,
} from "./contract";
import {
  AiProposalRequestBuildError,
  buildAiOperationRequest,
  parseAiProposalGenerationCommand,
} from "./request-builder";

const messages = {
  invalidCommand: {
    en: "The proposal request is incomplete. Check the selected page and try again.",
    fi: "Ehdotuspyyntö on puutteellinen. Tarkista valittu sivu ja yritä uudelleen.",
  },
  unsupportedRequest: {
    en: "That design change is not supported yet. Try a more specific request.",
    fi: "Tätä designmuutosta ei vielä tueta. Kokeile tarkempaa pyyntöä.",
  },
  providerUnavailable: {
    en: "The design assistant is temporarily unavailable. Try again or continue editing manually.",
    fi: "Designavustaja ei ole juuri nyt käytettävissä. Yritä uudelleen tai jatka muokkaamista käsin.",
  },
  validationFailed: {
    en: "The proposed changes could not be safely validated. Try again or edit manually.",
    fi: "Ehdotettuja muutoksia ei voitu validoida turvallisesti. Yritä uudelleen tai muokkaa käsin.",
  },
  staleDraft: {
    en: "The draft changed while the proposal was being prepared. Create a new proposal.",
    fi: "Luonnos muuttui ehdotuksen valmistelun aikana. Luo uusi ehdotus.",
  },
  staleTarget: {
    en: "The editor selection changed while the proposal was being prepared. Create a new proposal.",
    fi: "Editorin valinta muuttui ehdotuksen valmistelun aikana. Luo uusi ehdotus.",
  },
  superseded: {
    en: "A newer proposal request replaced this one.",
    fi: "Uudempi ehdotuspyyntö korvasi tämän pyynnön.",
  },
} as const;

function failure(
  code: AiProposalGenerationFailure["code"],
  retryable = true,
): AiProposalGenerationFailure {
  return aiProposalGenerationFailureSchema.parse({ code, message: messages[code], retryable });
}

function identityFrom(command: AiProposalGenerationCommand): AiProposalEditorIdentity {
  return {
    projectId: command.projectId,
    draftSnapshotId: command.draftSnapshotId,
    draftRevision: command.draftRevision,
    target: command.target,
  };
}

function sameTarget(
  left: AiProposalEditorIdentity["target"],
  right: AiProposalEditorIdentity["target"],
) {
  return canonicalValueString(left) === canonicalValueString(right);
}

type ActiveGeneration = {
  key: string;
  sequence: number;
  promise: Promise<AiProposalGenerationResult>;
};

export class AiProposalGenerationOrchestrator {
  readonly #currentIdentity: () => AiProposalEditorIdentity;
  readonly #analytics?: AiProposalGenerationAnalytics;
  readonly #proposalStore: InMemoryDesignProposalStore;
  #sequence = 0;
  #active: ActiveGeneration | null = null;
  #state: "idle" | "generating" | "proposalReady" | "failed" | "stale" | "superseded" = "idle";
  #proposal: GeneratedAiProposal | null = null;
  #lastFailure: AiProposalGenerationFailure | null = null;

  constructor({
    currentIdentity,
    analytics,
    proposalStore = new InMemoryDesignProposalStore(),
  }: {
    currentIdentity: () => AiProposalEditorIdentity;
    analytics?: AiProposalGenerationAnalytics;
    proposalStore?: InMemoryDesignProposalStore;
  }) {
    this.#currentIdentity = currentIdentity;
    this.#analytics = analytics;
    this.#proposalStore = proposalStore;
  }

  inspect() {
    return structuredClone({
      state: this.#state,
      proposal: this.#proposal,
      failure: this.#lastFailure,
    });
  }

  generate(commandInput: unknown): Promise<AiProposalGenerationResult> {
    let command: AiProposalGenerationCommand;
    try {
      command = parseAiProposalGenerationCommand(commandInput);
    } catch {
      return Promise.resolve(this.#fail(null, "invalidCommand"));
    }
    const key = canonicalValueString({
      ...identityFrom(command),
      instruction: command.merchantInstruction.normalize("NFC").trim().replace(/\s+/g, " "),
    });
    if (this.#active?.key === key) return this.#active.promise;

    this.#sequence += 1;
    const sequence = this.#sequence;
    const promise = this.#run(command, sequence).finally(() => {
      if (this.#active?.sequence === sequence) this.#active = null;
    });
    this.#active = { key, sequence, promise };
    return promise;
  }

  async #run(
    command: AiProposalGenerationCommand,
    sequence: number,
  ): Promise<AiProposalGenerationResult> {
    let request;
    try {
      request = buildAiOperationRequest(command);
    } catch (error) {
      const code =
        error instanceof AiProposalRequestBuildError && error.code === "unsupported-request"
          ? "unsupportedRequest"
          : "invalidCommand";
      return this.#fail(command, code);
    }

    this.#state = "generating";
    this.#proposal = null;
    this.#lastFailure = null;
    this.#analytics?.record({
      name: "ai_prompt_submitted",
      projectId: command.projectId,
      pageId: command.target.pageId,
      ...(command.target.type === "section" ? { sectionId: command.target.sectionId } : {}),
    });

    try {
      const result = await requestAiProposal(command.provider, request);
      if (sequence !== this.#sequence) {
        return this.#resultWithoutReplacingCurrent("superseded");
      }
      const current = this.#currentIdentity();
      const base = identityFrom(command);
      if (
        current.projectId !== base.projectId ||
        current.draftSnapshotId !== base.draftSnapshotId ||
        current.draftRevision !== base.draftRevision
      ) {
        return this.#fail(
          command,
          "staleDraft",
          result.proposal.providerId,
          result.proposal.providerRequestId,
        );
      }
      if (!sameTarget(current.target, base.target)) {
        return this.#fail(
          command,
          "staleTarget",
          result.proposal.providerId,
          result.proposal.providerRequestId,
        );
      }

      const proposal = this.#proposalStore.create({
        originalPage: command.page,
        operations: result.proposal.operations,
        context: command.displayContext,
        summary: result.proposal.explanation,
        identity: `${result.proposal.providerRequestId}|${sequence}`,
      });
      const generated = generatedAiProposalSchema.parse({
        projectId: command.projectId,
        pageId: command.target.pageId,
        sectionId: command.target.type === "section" ? command.target.sectionId : null,
        draftSnapshotId: command.draftSnapshotId,
        draftRevision: command.draftRevision,
        providerRequestId: result.proposal.providerRequestId,
        providerId: result.proposal.providerId,
        proposal,
        observability: result.proposal.metadata,
      });
      this.#state = "proposalReady";
      this.#proposal = structuredClone(generated);
      this.#analytics?.record({
        name: "ai_proposal_generated",
        projectId: command.projectId,
        pageId: command.target.pageId,
        ...(command.target.type === "section" ? { sectionId: command.target.sectionId } : {}),
        providerId: generated.providerId,
        providerRequestId: generated.providerRequestId,
        operationCount: generated.observability.operationCount,
        durationMs: generated.observability.durationMs,
        validation: "valid",
      });
      return { state: "proposalReady", proposal: structuredClone(generated), failure: null };
    } catch (error) {
      if (sequence !== this.#sequence) return this.#resultWithoutReplacingCurrent("superseded");
      return this.#fail(
        command,
        error instanceof AiProviderUnavailableError
          ? "providerUnavailable"
          : error instanceof AiProviderValidationError
            ? "validationFailed"
            : "validationFailed",
      );
    }
  }

  #resultWithoutReplacingCurrent(state: "superseded"): AiProposalGenerationResult {
    return { state, proposal: null, failure: failure(state) };
  }

  #fail(
    command: AiProposalGenerationCommand | null,
    code: AiProposalGenerationFailure["code"],
    providerId?: string,
    providerRequestId?: string,
  ): AiProposalGenerationResult {
    const state = code === "staleDraft" || code === "staleTarget" ? "stale" : "failed";
    const failed = failure(code);
    this.#state = state;
    this.#proposal = null;
    this.#lastFailure = failed;
    if (command) {
      this.#analytics?.record({
        name: "generation_failed",
        projectId: command.projectId,
        pageId: command.target.pageId,
        ...(command.target.type === "section" ? { sectionId: command.target.sectionId } : {}),
        ...(providerId ? { providerId } : {}),
        ...(providerRequestId ? { providerRequestId } : {}),
        validation: "invalid",
        failureCode: code,
      });
    }
    return { state, proposal: null, failure: structuredClone(failed) };
  }
}
