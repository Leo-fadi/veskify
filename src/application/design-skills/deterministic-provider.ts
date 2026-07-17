import type { InMemoryDesignProposalStore } from "@/application/design-operations";
import { createProposalFromDesignPlan, executeDesignPlan } from "./executor";
import { classifyDesignRequest, createDesignPlan, type DesignPlannerInput } from "./planner";

export const deterministicDesignProvider = {
  classifyDesignRequest,
  createDesignPlan,
  executeDesignPlan,
  createProposalFromDesignPlan,
  propose(input: DesignPlannerInput, store?: InMemoryDesignProposalStore) {
    const classification = classifyDesignRequest(input.merchantRequest, input.activeLocale);
    const plan = createDesignPlan(input);
    const execution = executeDesignPlan(plan, input);
    const proposal = execution.validation.valid
      ? createProposalFromDesignPlan(execution, input.displayContext, store)
      : null;
    return { classification, plan, execution, proposal };
  },
} as const;
