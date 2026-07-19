import { InMemoryDesignProposalStore } from "@/application/design-operations";
import { createProposalFromDesignPlan, executeDesignPlan } from "./executor";
import { classifyDesignRequest, createDesignPlan, type DesignPlannerInput } from "./planner";
import type { DesignSkillExecutionResult } from "./contract";

export class DeterministicDesignProvider {
  readonly #store: InMemoryDesignProposalStore;

  constructor(store = new InMemoryDesignProposalStore()) {
    this.#store = store;
  }

  readonly classifyDesignRequest = classifyDesignRequest;
  readonly createDesignPlan = createDesignPlan;
  readonly executeDesignPlan = executeDesignPlan;
  createProposalFromDesignPlan(
    execution: DesignSkillExecutionResult,
    context: DesignPlannerInput["displayContext"],
    store: InMemoryDesignProposalStore = this.#store,
    identity?: string,
  ) {
    return createProposalFromDesignPlan(execution, context, store, identity);
  }

  propose(
    input: DesignPlannerInput,
    store: InMemoryDesignProposalStore = this.#store,
    identity?: string,
  ) {
    const classification = classifyDesignRequest(input.merchantRequest, input.activeLocale);
    const plan = createDesignPlan(input);
    const execution = executeDesignPlan(plan, input);
    const proposal = execution.validation.valid
      ? createProposalFromDesignPlan(execution, input.displayContext, store, identity)
      : null;
    return { classification, plan, execution, proposal };
  }

  inspect(id: string, store: InMemoryDesignProposalStore = this.#store) {
    return store.inspect(id);
  }

  prepareAcceptance(id: string, store: InMemoryDesignProposalStore = this.#store) {
    return store.prepareAcceptance(id);
  }

  accept(id: string, store: InMemoryDesignProposalStore = this.#store) {
    return store.accept(id);
  }

  reject(id: string, store: InMemoryDesignProposalStore = this.#store) {
    return store.reject(id);
  }
}

export function createDeterministicDesignProvider(store?: InMemoryDesignProposalStore) {
  return new DeterministicDesignProvider(store);
}

export const deterministicDesignProvider = createDeterministicDesignProvider();
