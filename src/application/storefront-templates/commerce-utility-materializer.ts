import {
  canonicalValueFingerprint,
  type PageModel,
  type SectionInstance,
} from "@/domain/storefront";
import {
  getCommercialUtilityProfile,
  type CommercialUtilityProfileId,
} from "./commercial-utility-profiles";

const copyByState = {
  cart: {
    heading: { en: "Cart", fi: "Ostoskori" },
    body: {
      en: "Review items and continue through the available checkout authority.",
      fi: "Tarkista tuotteet ja jatka käytettävissä olevan kassavaltuuden kautta.",
    },
  },
  checkout: {
    heading: { en: "Checkout", fi: "Kassa" },
    body: {
      en: "Continue securely through the merchant's checkout authority.",
      fi: "Jatka turvallisesti kauppiaan kassavaltuuden kautta.",
    },
  },
  "no-results": {
    heading: { en: "No results", fi: "Ei tuloksia" },
    body: { en: "No canonical products matched", fi: "Yhtään kanonista tuotetta ei vastannut" },
  },
  empty: {
    heading: { en: "Nothing here yet", fi: "Täällä ei ole vielä mitään" },
    body: {
      en: "This storefront area is currently empty.",
      fi: "Tämä kaupan alue on tällä hetkellä tyhjä.",
    },
  },
  error: {
    heading: { en: "Something needs attention", fi: "Jokin tarvitsee huomiota" },
    body: {
      en: "The storefront could not complete that request.",
      fi: "Kauppa ei voinut suorittaa pyyntöä.",
    },
  },
  "not-found": {
    heading: { en: "Page not found", fi: "Sivua ei löytynyt" },
    body: {
      en: "The requested storefront page is not available.",
      fi: "Pyydettyä kaupan sivua ei ole saatavilla.",
    },
  },
  loading: {
    heading: { en: "Loading", fi: "Ladataan" },
    body: {
      en: "The storefront is retrieving current information.",
      fi: "Kauppa hakee ajantasaista tietoa.",
    },
  },
} as const;

/** Builds only persistent presentation configuration; runtime commerce state stays external. */
export function materializeCommerceUtilityPage(
  page: PageModel,
  profileId: CommercialUtilityProfileId,
): PageModel {
  const profile = getCommercialUtilityProfile(profileId);
  const authority = profile?.profile?.commercialUtility;
  const slot = profile?.slots[0];
  if (!profile || !authority || !slot || page.pageFamily?.profileId !== profileId) {
    throw new Error(`Commerce utility profile ${profileId} is unavailable for this page.`);
  }
  const expectedFamily =
    authority.state === "cart"
      ? "cart"
      : authority.state === "checkout"
        ? "checkout"
        : authority.state === "no-results"
          ? "no-results"
          : authority.state === "empty"
            ? "empty-state"
            : authority.state === "error"
              ? "error-state"
              : authority.state === "not-found" || authority.state === "loading"
                ? "not-found"
                : undefined;
  if (page.pageFamily?.familyId !== expectedFamily || page.type !== profile.pageType) {
    throw new Error(
      `Commerce utility profile ${profileId} is incompatible with the canonical page family.`,
    );
  }
  const section: SectionInstance = {
    id: `section_${canonicalValueFingerprint({ pageId: page.id, profileId, slotId: slot.id }).slice(-24)}`,
    component: "commerceUtility",
    variant: slot.defaultVariant,
    visible: true,
    content: structuredClone(copyByState[authority.state]),
    props: { summaryPlacement: authority.state === "cart" ? "aside" : "inline" },
    approvedAssetPlacements: [],
    approvedAssetPresentations: [],
  };
  return { ...structuredClone(page), sections: [section] };
}
