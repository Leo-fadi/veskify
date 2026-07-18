import type { BusinessIdentity, StorefrontDesignBrief } from "@/domain/design-brief";

export const businessBasicsFieldIds = [
  "businessName",
  "shortDescription",
  "industry",
  "targetCustomer",
  "primaryMarket",
] as const;

export type BusinessBasicsField = (typeof businessBasicsFieldIds)[number];

export type BusinessBasicsEvaluation = Readonly<{
  complete: boolean;
  missingFields: readonly BusinessBasicsField[];
}>;

export function evaluateBusinessBasics(
  brief: Pick<StorefrontDesignBrief, "businessIdentity">,
): BusinessBasicsEvaluation {
  const identity: BusinessIdentity = brief.businessIdentity;
  const missingFields = businessBasicsFieldIds.filter((field) => {
    if (field === "industry") return identity.industry === null;
    return identity[field].length === 0;
  });

  return Object.freeze({
    complete: missingFields.length === 0,
    missingFields: Object.freeze(missingFields),
  });
}
