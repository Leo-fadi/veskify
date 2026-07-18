import type { Locale } from "@/domain/shared";
import type { OnboardingStepId } from "./session";

export type OnboardingStepDefinition = Readonly<{
  id: OnboardingStepId;
  title: Readonly<Record<Locale, string>>;
  description: Readonly<Record<Locale, string>>;
  placeholder: Readonly<Record<Locale, string>>;
  position: number;
  optional: boolean;
  completableNow: boolean;
  previousStepId: OnboardingStepId | null;
  nextStepId: OnboardingStepId | null;
}>;

const definitions = [
  {
    id: "creation-path",
    title: { en: "How would you like to begin?", fi: "Miten haluat aloittaa?" },
    description: {
      en: "Choose the starting point that best matches your store.",
      fi: "Valitse kaupallesi parhaiten sopiva lähtökohta.",
    },
    placeholder: {
      en: "Choose a starting path below.",
      fi: "Valitse alta tapa aloittaa.",
    },
    optional: false,
    completableNow: true,
  },
  {
    id: "business-basics",
    title: { en: "Business basics", fi: "Yrityksen perustiedot" },
    description: {
      en: "Tell us what your business offers and who it serves.",
      fi: "Kerro, mitä yrityksesi tarjoaa ja keitä se palvelee.",
    },
    placeholder: {
      en: "A later step will collect your business name, description, industry, audience and main market. Nothing is saved for this step yet.",
      fi: "Myöhempi vaihe kerää yrityksen nimen, kuvauksen, toimialan, kohderyhmän ja päämarkkinan. Tästä vaiheesta ei vielä tallenneta tietoja.",
    },
    optional: false,
    completableNow: false,
  },
  {
    id: "existing-sources",
    title: { en: "Existing sources", fi: "Nykyiset lähteet" },
    description: {
      en: "Choose useful website, social or file sources to bring forward.",
      fi: "Valitse hyödynnettävät verkkosivu-, some- tai tiedostolähteet.",
    },
    placeholder: {
      en: "A later step will collect optional website, social and uploaded source material. No source is imported yet.",
      fi: "Myöhempi vaihe kerää valinnaiset verkkosivu-, some- ja tiedostolähteet. Mitään ei vielä tuoda palveluun.",
    },
    optional: true,
    completableNow: false,
  },
  {
    id: "brand-assets",
    title: { en: "Brand assets", fi: "Brändiaineistot" },
    description: {
      en: "Add the brand material you already have.",
      fi: "Lisää jo olemassa olevat brändiaineistot.",
    },
    placeholder: {
      en: "A later step will collect your logo, brand guide, colours, fonts and images. No files are uploaded yet.",
      fi: "Myöhempi vaihe kerää logon, brändiohjeen, värit, fontit ja kuvat. Tiedostoja ei vielä ladata.",
    },
    optional: true,
    completableNow: false,
  },
  {
    id: "visual-direction",
    title: { en: "Visual direction", fi: "Visuaalinen suunta" },
    description: {
      en: "Choose the feeling, imagery and layout style for your store.",
      fi: "Valitse kaupallesi tunnelma, kuvatyyli ja asettelun suunta.",
    },
    placeholder: {
      en: "A later step will offer guided style examples and sensible defaults. No design choices are saved yet.",
      fi: "Myöhempi vaihe tarjoaa ohjattuja tyyliesimerkkejä ja suositeltuja oletuksia. Valintoja ei vielä tallenneta.",
    },
    optional: true,
    completableNow: false,
  },
  {
    id: "catalogue",
    title: { en: "Catalogue", fi: "Tuoteluettelo" },
    description: {
      en: "Choose how product information will be provided.",
      fi: "Valitse, miten tuotetiedot tuodaan mukaan.",
    },
    placeholder: {
      en: "A later step will support a file or an industry sample catalogue. No product data is read or changed yet.",
      fi: "Myöhempi vaihe tukee tiedostoa tai toimialan esimerkkituoteluetteloa. Tuotetietoja ei vielä lueta tai muuteta.",
    },
    optional: true,
    completableNow: false,
  },
  {
    id: "pages",
    title: { en: "Store pages", fi: "Kaupan sivut" },
    description: {
      en: "Confirm the pages your storefront needs.",
      fi: "Vahvista verkkokauppasi tarvitsemat sivut.",
    },
    placeholder: {
      en: "A later step will confirm required and optional pages. No page is created in this foundation.",
      fi: "Myöhempi vaihe vahvistaa pakolliset ja valinnaiset sivut. Tässä perustassa ei vielä luoda sivuja.",
    },
    optional: false,
    completableNow: false,
  },
  {
    id: "languages",
    title: { en: "Storefront languages", fi: "Kaupan kielet" },
    description: {
      en: "Choose English, Finnish or both and set the primary language.",
      fi: "Valitse englanti, suomi tai molemmat sekä kaupan ensisijainen kieli.",
    },
    placeholder: {
      en: "A later step will save storefront language choices. The language buttons above change this onboarding interface only.",
      fi: "Myöhempi vaihe tallentaa kaupan kielivalinnat. Yllä olevat kielipainikkeet vaihtavat vain tämän ohjauksen kieltä.",
    },
    optional: false,
    completableNow: false,
  },
  {
    id: "review-plan",
    title: { en: "Review the plan", fi: "Tarkista suunnitelma" },
    description: {
      en: "Review the information, assumptions and planned storefront before generation.",
      fi: "Tarkista tiedot, oletukset ja suunniteltu kauppa ennen luontia.",
    },
    placeholder: {
      en: "A later step will show a plain-language build plan for confirmation. This foundation does not generate a store or create a project.",
      fi: "Myöhempi vaihe näyttää selkokielisen toteutussuunnitelman vahvistettavaksi. Tämä perusta ei luo kauppaa tai projektia.",
    },
    optional: false,
    completableNow: false,
  },
] as const;

export const onboardingStepRegistry: readonly OnboardingStepDefinition[] = Object.freeze(
  definitions.map((definition, index) =>
    Object.freeze({
      ...definition,
      title: Object.freeze({ ...definition.title }),
      description: Object.freeze({ ...definition.description }),
      placeholder: Object.freeze({ ...definition.placeholder }),
      position: index + 1,
      previousStepId: definitions[index - 1]?.id ?? null,
      nextStepId: definitions[index + 1]?.id ?? null,
    }),
  ),
);

const stepById = new Map(onboardingStepRegistry.map((step) => [step.id, step]));

export function getOnboardingStep(stepId: OnboardingStepId): OnboardingStepDefinition {
  const step = stepById.get(stepId);
  if (!step) throw new Error(`Unknown onboarding step: ${stepId}.`);
  return step;
}
