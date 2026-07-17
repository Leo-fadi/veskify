import {
  generateHomepageRedesign,
  type DesignOperation,
  type DesignOperationContext,
  type DesignProposal,
  type InMemoryDesignProposalStore,
} from "@/application/design-operations";
import type { Locale } from "@/domain/shared";
import type { PageModel } from "@/domain/storefront";

export const deterministicProposalPrompts = [
  "Make the homepage feel more luxurious.",
  "Add a campaign section.",
  "Make the layout more minimal.",
] as const;

export type DeterministicRequestKind = "luxury" | "campaign" | "minimal";
export type ProposalRequestResult =
  | { status: "ready"; kind: DeterministicRequestKind; proposal: DesignProposal }
  | { status: "unsupported"; message: string }
  | { status: "invalid"; message: string };

const normalizedRequests = new Map<string, DeterministicRequestKind>([
  ["make the homepage feel more luxurious", "luxury"],
  ["add a campaign section", "campaign"],
  ["make the layout more minimal", "minimal"],
]);

function normalizeRequest(value: string) {
  return value
    .trim()
    .toLocaleLowerCase()
    .replace(/[.!?]+$/, "")
    .replace(/\s+/g, " ");
}

function availableSectionId(page: PageModel, base: string) {
  if (!page.sections.some((section) => section.id === base)) return base;
  let suffix = 2;
  while (page.sections.some((section) => section.id === `${base}_${suffix}`)) suffix += 1;
  return `${base}_${suffix}`;
}

function campaignOperations(page: PageModel): DesignOperation[] {
  const sectionId = availableSectionId(page, "section_home_campaign_proposal");
  return [
    {
      type: "ADD_APPROVED_SECTION",
      sectionId,
      component: "campaignBanner",
      variant: "split",
    },
    { type: "CHANGE_BACKGROUND", sectionId, background: "surface" },
    { type: "CHANGE_DENSITY", sectionId, density: "standard" },
    { type: "CHANGE_SHAPE", sectionId, shape: "soft" },
  ];
}

const summaries = {
  luxury: {
    en: "A more luxurious homepage using refined layouts, serif typography and spacious pacing.",
    fi: "Ylellisempi etusivu viimeistellyillä asetteluilla, serif-typografialla ja ilmavalla rytmillä.",
  },
  campaign: {
    en: "A new campaign section added before the footer using the existing storefront style.",
    fi: "Uusi kampanjaosio lisätään ennen alatunnistetta nykyisen verkkokaupan tyylillä.",
  },
  minimal: {
    en: "A more minimal homepage with simpler surfaces, clean typography and compact spacing.",
    fi: "Minimalistisempi etusivu selkeillä pinnoilla, pelkistetyllä typografialla ja tiiviimmällä rytmillä.",
  },
} as const;

export function requestDeterministicHomepageProposal({
  request,
  page,
  context,
  store,
}: {
  request: string;
  page: PageModel;
  context: DesignOperationContext;
  store: InMemoryDesignProposalStore;
}): ProposalRequestResult {
  const kind = normalizedRequests.get(normalizeRequest(request));
  if (!kind) {
    return {
      status: "unsupported",
      message:
        "That request is not available in this demo yet. Try one of the example requests below.",
    };
  }
  if (page.type !== "home") {
    return {
      status: "invalid",
      message:
        "This example can only be previewed on the homepage. Open the homepage and try again.",
    };
  }

  try {
    const operations =
      kind === "campaign"
        ? campaignOperations(page)
        : generateHomepageRedesign(
            page,
            { direction: kind === "luxury" ? "luxury" : "minimal", includeCampaign: false },
            context,
          ).operations;
    const proposal = store.create({
      originalPage: page,
      operations,
      context,
      summary: summaries[kind],
    });
    return { status: "ready", kind, proposal };
  } catch {
    return {
      status: "invalid",
      message:
        "This proposal could not be validated safely. Your current page has not been changed.",
    };
  }
}

const operationLabels: Record<DesignOperation["type"], Record<Locale, string>> = {
  CHANGE_LOCALIZED_SECTION_TEXT: { en: "Update section wording", fi: "Päivitä osion teksti" },
  CHANGE_SECTION_VARIANT: { en: "Refine a section layout", fi: "Viimeistele osion asettelu" },
  CHANGE_BACKGROUND: { en: "Adjust a section background", fi: "Muuta osion taustaa" },
  CHANGE_TYPOGRAPHY: { en: "Adjust section typography", fi: "Muuta osion typografiaa" },
  CHANGE_DENSITY: { en: "Adjust section spacing", fi: "Muuta osion väljyyttä" },
  CHANGE_SHAPE: { en: "Adjust section shapes", fi: "Muuta osion muotoja" },
  CHANGE_ALIGNMENT: { en: "Adjust content alignment", fi: "Muuta sisällön tasausta" },
  CHANGE_CTA_STYLE: { en: "Refine button presentation", fi: "Viimeistele painikkeiden tyyli" },
  APPLY_APPROVED_BRAND_COLOURS: {
    en: "Apply approved brand colours",
    fi: "Käytä hyväksyttyjä brändivärejä",
  },
  ADD_APPROVED_SECTION: { en: "Add a campaign section", fi: "Lisää kampanjaosio" },
  REMOVE_OPTIONAL_SECTION: { en: "Remove an optional section", fi: "Poista valinnainen osio" },
  REORDER_SECTIONS: { en: "Reorder page sections", fi: "Järjestä sivun osiot" },
};

export function proposalChangeLabels(proposal: DesignProposal, locale: Locale) {
  return proposal.operations.map((operation) => operationLabels[operation.type][locale]);
}
