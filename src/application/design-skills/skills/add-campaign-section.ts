import { resolveLocalizedText } from "@/domain/shared";
import type { DesignOperation } from "@/application/design-operations";
import type { DesignSkillDefinition } from "../contract";
import {
  nextSectionId,
  operationArraySchema,
  protectedDesignPaths,
  requiredValidationRules,
} from "./shared";

function campaignCopy({
  activeLocale,
  displayContext,
  campaign,
}: Parameters<DesignSkillDefinition["execute"]>[0]) {
  const collection = displayContext.catalogue.collections[0];
  if (!collection && !campaign) {
    throw new Error("Campaign direction or a usable collection is required.");
  }
  const collectionTitle = collection
    ? resolveLocalizedText(collection.title, activeLocale, displayContext.primaryLocale)
    : null;
  const objective = campaign?.objective
    ? resolveLocalizedText(campaign.objective, activeLocale, displayContext.primaryLocale)
    : null;
  const campaignHeading = campaign?.heading
    ? resolveLocalizedText(campaign.heading, activeLocale, displayContext.primaryLocale)
    : null;
  const campaignBody = campaign?.body
    ? resolveLocalizedText(campaign.body, activeLocale, displayContext.primaryLocale)
    : null;
  return {
    heading:
      campaignHeading ??
      objective ??
      (collectionTitle
        ? activeLocale === "fi"
          ? `Tutustu: ${collectionTitle}`
          : `Discover ${collectionTitle}`
        : activeLocale === "fi"
          ? "Kampanja"
          : "Campaign"),
    body:
      campaignBody ??
      (collectionTitle
        ? activeLocale === "fi"
          ? "Tutustu nykyisestä valikoimasta koottuun kokonaisuuteen."
          : "Explore a curated presentation from the current collection."
        : activeLocale === "fi"
          ? "Tutustu kampanjaan tarkemmin."
          : "Learn more about this campaign."),
  };
}

export const addCampaignSectionSkill: DesignSkillDefinition = {
  id: "addCampaignSection",
  version: "1.0.0",
  title: { en: "Add a campaign section", fi: "Lisää kampanjaosio" },
  description: {
    en: "Adds one registered campaign banner using supplied or safely derived catalogue context.",
    fi: "Lisää yhden rekisteröidyn kampanjanoston annetun tai turvallisesti johdetun tuotetiedon pohjalta.",
  },
  supportedIntents: ["campaignSection"],
  scope: "page",
  supportedPageTypes: ["home", "landing"],
  requiredContext: ["activeLocale", "page", "catalogue"],
  optionalContext: ["campaign", "brandSystem", "selectedSection"],
  allowedComponentTypes: ["campaignBanner"],
  allowedOperationTypes: ["ADD_APPROVED_SECTION", "CHANGE_LOCALIZED_SECTION_TEXT"],
  protectedPaths: [...protectedDesignPaths],
  preconditions: [{ type: "pageTypeSupported" }, { type: "campaignContextAvailableOrDerivable" }],
  outputSchema: operationArraySchema,
  validationRules: requiredValidationRules,
  execute: (context) => {
    const sectionId = nextSectionId(context.page, "section_campaign_generated");
    const copy = campaignCopy(context);
    const operations: DesignOperation[] = [
      {
        type: "ADD_APPROVED_SECTION",
        sectionId,
        component: "campaignBanner",
        variant: "minimal",
      },
      {
        type: "CHANGE_LOCALIZED_SECTION_TEXT",
        sectionId,
        field: "heading",
        locale: context.activeLocale,
        value: copy.heading,
      },
      {
        type: "CHANGE_LOCALIZED_SECTION_TEXT",
        sectionId,
        field: "body",
        locale: context.activeLocale,
        value: copy.body,
      },
    ];
    return operations;
  },
  summarize: ({ operationCount }) => ({
    en: `Add one campaign section with ${operationCount} validated changes, without inventing an offer or commercial terms.`,
    fi: `Lisää yksi kampanjaosio ${operationCount} validoidulla muutoksella ilman keksittyä tarjousta tai kaupallisia ehtoja.`,
  }),
};
