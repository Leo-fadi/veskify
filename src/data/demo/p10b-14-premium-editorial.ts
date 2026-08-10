import type { ContentSupportFactAuthority } from "@/application/content-support-pages";
import {
  type PageFactEvidenceAuthority,
  PageFactEvidenceAuthorityError,
  type StorefrontSiteMapDecision,
} from "@/application/storefront-site-map";
import {
  materializeP10B14PremiumEditorialStorefront,
  P10B14_PREMIUM_EDITORIAL_SELECTION,
} from "@/application/premium-editorial-vertical-slice";
import {
  P9_05A_COLLECTION_ID,
  P9_05A_COMPLEX_PRODUCT_ID,
  P9_05A_SIMPLE_PRODUCT_ID,
  createP905aFreshMerchantFixture,
} from "@/data/demo/p9-05a-fresh-store-generation";
import {
  PAGE_FAMILY_AUTHORITY_VERSION,
  SITE_MAP_SHARED_FRAME,
  applyCommercialSharedFrame,
  createContentSupportFactDocument,
  pageFactEvidenceRequestSchema,
  type ContentSupportFactDocument,
  type ContentSupportFactPayload,
  type ContentSupportPageFamilyId,
  type PageFactEvidenceReference,
  type PageFactEvidenceRequest,
  type PageFamilyId,
} from "@/domain/storefront";

export const P10B14_FIXTURE_ID = "p10b14-lumo-premium-editorial-complete-storefront";
const approvalFingerprint = "p10b14-approved-merchant-evidence-v1";
const localized = (en: string, fi: string) => ({ en, fi });

const contentProfiles: Readonly<Record<ContentSupportPageFamilyId, string>> = {
  about: "content-about-story",
  contact: "content-contact-channels",
  "store-locations": "content-location-directory",
  faq: "content-faq-disclosure",
  "shipping-information": "content-service-details",
  "returns-information": "content-service-details",
  "policy-legal": "content-policy-reading",
  "campaign-editorial": "landing-campaign-editorial",
  "generic-content": "content-generic-reading",
};

const supportedContentFamilies = [
  "about",
  "contact",
  "faq",
  "shipping-information",
  "returns-information",
  "policy-legal",
] as const satisfies readonly ContentSupportPageFamilyId[];

function payload(familyId: (typeof supportedContentFamilies)[number]): ContentSupportFactPayload {
  const base = {
    familyId,
    title: localized(
      familyId === "about" ? "Our atelier" : familyId.replaceAll("-", " "),
      familyId === "about" ? "Ateljeemme" : familyId.replaceAll("-", " "),
    ),
    introduction: localized(
      "Information approved in the Lumo Atelier design brief.",
      "Lumo Atelierin suunnittelukuvauksessa hyväksyttyä tietoa.",
    ),
  };
  if (familyId === "about") {
    return {
      ...base,
      blocks: [
        {
          kind: "paragraph",
          id: "atelier-origin",
          body: localized(
            "Lumo Atelier creates small-batch jewellery with a patient, material-led process.",
            "Lumo Atelier valmistaa pieneräkoruja kärsivällisellä, materiaalilähtöisellä tavalla.",
          ),
        },
      ],
      story: {
        eyebrow: localized("Lumo Atelier", "Lumo Atelier"),
        heading: localized("Made with patient hands", "Valmistettu kärsivällisin käsin"),
        body: localized(
          "The approved brand story centres careful craft and guided ring discovery.",
          "Hyväksytty bränditarina keskittyy huolelliseen käsityöhön ja opastettuun sormuksen valintaan.",
        ),
        steps: [],
      },
    };
  }
  if (familyId === "contact") {
    return {
      ...base,
      blocks: [
        {
          kind: "contact-channel",
          id: "approved-email",
          channel: "email",
          label: localized("Email", "Sähköposti"),
          value: "studio@lumo.example",
        },
      ],
    };
  }
  if (familyId === "faq") {
    return {
      ...base,
      blocks: [
        {
          kind: "faq",
          id: "ring-guidance",
          question: localized("Can I configure a ring?", "Voinko muokata sormuksen vaihtoehtoja?"),
          answer: localized(
            "The configurable ring page shows the options and availability supplied by the catalogue.",
            "Muokattavan sormuksen sivu näyttää luettelon toimittamat vaihtoehdot ja saatavuuden.",
          ),
        },
      ],
    };
  }
  const copy = {
    "shipping-information": localized(
      "Shipping terms are shown exactly as approved for this evidence fixture.",
      "Toimitusehdot näytetään täsmälleen tämän evidenssifixturen hyväksymässä muodossa.",
    ),
    "returns-information": localized(
      "Return terms are shown exactly as approved for this evidence fixture.",
      "Palautusehdot näytetään täsmälleen tämän evidenssifixturen hyväksymässä muodossa.",
    ),
    "policy-legal": localized(
      "Policy text is limited to the approved fixture statement.",
      "Käytäntöteksti rajoittuu hyväksyttyyn fixture-lausumaan.",
    ),
  }[familyId];
  return {
    ...base,
    blocks: [
      {
        kind: "policy-section",
        id: "approved-terms",
        heading: localized("Approved information", "Hyväksytyt tiedot"),
        body: copy,
      },
    ],
  };
}

function approvedContentAuthority() {
  const documents = new Map<ContentSupportPageFamilyId, ContentSupportFactDocument>();
  const references = new Map<ContentSupportPageFamilyId, PageFactEvidenceReference>();
  for (const familyId of supportedContentFamilies) {
    const reference: PageFactEvidenceReference = {
      source: "approved-source-evidence",
      authorityId: `evidence_p10b14_${familyId.replaceAll("-", "_")}`,
      revision: "1",
      status: "approved",
      approvalAuthorityId: "brief_lumo_p10b14",
      approvalFingerprint,
    };
    references.set(familyId, reference);
    documents.set(
      familyId,
      createContentSupportFactDocument({ evidence: reference, payload: payload(familyId) }),
    );
  }
  const pageEvidenceAuthority: PageFactEvidenceAuthority = Object.freeze({
    resolve({
      reference,
      familyId,
    }: Readonly<{ reference: PageFactEvidenceRequest; familyId: PageFamilyId }>) {
      const request = pageFactEvidenceRequestSchema.parse(reference);
      const current = references.get(familyId as ContentSupportPageFamilyId);
      if (!current || request.authorityId !== current.authorityId) {
        throw new PageFactEvidenceAuthorityError(
          "unknown-evidence-authority",
          `No approved P10B-14 evidence exists for ${familyId}.`,
        );
      }
      if (request.revision !== current.revision) {
        throw new PageFactEvidenceAuthorityError(
          "stale-evidence-revision",
          `The approved P10B-14 evidence for ${familyId} is stale.`,
        );
      }
      return structuredClone(current);
    },
  });
  const contentFactAuthority: ContentSupportFactAuthority = Object.freeze({
    resolve({
      familyId,
      reference,
    }: Readonly<{
      familyId: ContentSupportPageFamilyId;
      reference: PageFactEvidenceRequest;
    }>) {
      const request = pageFactEvidenceRequestSchema.parse(reference);
      const current = documents.get(familyId);
      if (
        !current ||
        current.id !== request.authorityId ||
        current.evidence.revision !== request.revision
      ) {
        throw new Error(`The current approved P10B-14 fact for ${familyId} is unavailable.`);
      }
      return structuredClone(current);
    },
  });
  return { documents, references, pageEvidenceAuthority, contentFactAuthority };
}

function page(input: StorefrontSiteMapDecision["pages"][number]) {
  return input;
}

function createDecision(
  fixture: ReturnType<typeof createP905aFreshMerchantFixture>,
  references: ReadonlyMap<ContentSupportPageFamilyId, PageFactEvidenceReference>,
): StorefrontSiteMapDecision {
  const common = {
    familyVersion: PAGE_FAMILY_AUTHORITY_VERSION,
    profileVersion: "1.0.0" as const,
    localeCoverage: ["en", "fi"] as const,
  };
  const title = (en: string, fi: string) => ({
    title: localized(en, fi),
    seo: {
      title: localized(`${en} | Lumo Atelier`, `${fi} | Lumo Atelier`),
      metaDescription: localized(`${en} for Lumo Atelier.`, `${fi} Lumo Atelierille.`),
    },
  });
  const factualPage = (
    familyId: (typeof supportedContentFamilies)[number],
    route: string,
    en: string,
    fi: string,
    footerOrder: number,
  ) =>
    page({
      key: `p10b14-${familyId}`,
      familyId,
      familyVersion: common.familyVersion,
      route,
      required: true,
      profile: { id: contentProfiles[familyId], version: common.profileVersion },
      localeCoverage: [...common.localeCoverage],
      ...title(en, fi),
      commerceContext: { kind: "none" },
      navigation: [{ area: "footer", order: footerOrder, label: localized(en, fi) }],
      evidenceReferences: [
        {
          source: "approved-source-evidence",
          authorityId: references.get(familyId)!.authorityId,
          revision: "1",
        },
      ],
    });
  return {
    schemaVersion: 1,
    projectId: fixture.aggregate.project.id,
    localeCoverage: [...common.localeCoverage],
    sharedFrame: SITE_MAP_SHARED_FRAME,
    pages: [
      page({
        key: "p10b14-home",
        familyId: "home",
        familyVersion: common.familyVersion,
        route: "/",
        required: true,
        profile: {
          id: P10B14_PREMIUM_EDITORIAL_SELECTION.homepageProfileId,
          version: common.profileVersion,
        },
        localeCoverage: [...common.localeCoverage],
        ...title("Home", "Etusivu"),
        commerceContext: { kind: "none" },
        navigation: [{ area: "primary", order: 0, label: localized("Home", "Etusivu") }],
        evidenceReferences: [],
      }),
      page({
        key: "p10b14-collection",
        familyId: "collection",
        familyVersion: common.familyVersion,
        route: "/collections/jewellery",
        required: true,
        profile: {
          id: P10B14_PREMIUM_EDITORIAL_SELECTION.collectionProfileId,
          version: common.profileVersion,
        },
        localeCoverage: [...common.localeCoverage],
        ...title("Jewellery", "Korut"),
        commerceContext: { kind: "collection", collectionId: P9_05A_COLLECTION_ID },
        navigation: [{ area: "primary", order: 1, label: localized("Jewellery", "Korut") }],
        evidenceReferences: [],
      }),
      page({
        key: "p10b14-search",
        familyId: "search-results",
        familyVersion: common.familyVersion,
        route: "/search",
        required: true,
        profile: {
          id: P10B14_PREMIUM_EDITORIAL_SELECTION.searchProfileId,
          version: common.profileVersion,
        },
        localeCoverage: [...common.localeCoverage],
        ...title("Search", "Haku"),
        commerceContext: { kind: "search" },
        navigation: [{ area: "primary", order: 2, label: localized("Search", "Haku") }],
        evidenceReferences: [],
      }),
      page({
        key: "p10b14-simple-product",
        familyId: "product-detail",
        familyVersion: common.familyVersion,
        route: "/products/arc-studs",
        required: true,
        profile: {
          id: P10B14_PREMIUM_EDITORIAL_SELECTION.pdpProfileId,
          version: common.profileVersion,
        },
        localeCoverage: [...common.localeCoverage],
        ...title("Arc Studs", "Arc-nappikorvakorut"),
        commerceContext: { kind: "product", productId: P9_05A_SIMPLE_PRODUCT_ID },
        navigation: [],
        parentKey: "p10b14-collection",
        evidenceReferences: [],
      }),
      page({
        key: "p10b14-configurable-product",
        familyId: "product-detail",
        familyVersion: common.familyVersion,
        route: "/products/custom-halo-ring",
        required: true,
        profile: {
          id: P10B14_PREMIUM_EDITORIAL_SELECTION.pdpProfileId,
          version: common.profileVersion,
        },
        localeCoverage: [...common.localeCoverage],
        ...title("Custom Halo Ring", "Muokattava Halo-sormus"),
        commerceContext: { kind: "product", productId: P9_05A_COMPLEX_PRODUCT_ID },
        navigation: [],
        parentKey: "p10b14-collection",
        evidenceReferences: [],
      }),
      factualPage("about", "/pages/about", "About", "Meistä", 0),
      factualPage("contact", "/pages/contact", "Contact", "Yhteystiedot", 1),
      factualPage("faq", "/pages/faq", "FAQ", "Usein kysytyt", 2),
      factualPage("shipping-information", "/pages/shipping", "Shipping", "Toimitus", 3),
      factualPage("returns-information", "/pages/returns", "Returns", "Palautukset", 4),
      factualPage("policy-legal", "/pages/policy", "Policies", "Käytännöt", 5),
      ...(
        [
          ["cart", "/cart", "commerce-utility-cart", "Cart", "Ostoskori"],
          ["checkout", "/checkout", "commerce-utility-checkout", "Checkout", "Kassa"],
          [
            "no-results",
            "/states/no-results",
            "commerce-utility-no-results",
            "No results",
            "Ei tuloksia",
          ],
          ["empty-state", "/states/empty", "commerce-utility-empty", "Empty", "Tyhjä"],
          ["error-state", "/states/error", "commerce-utility-error", "Error", "Virhe"],
          ["not-found", "/404", "commerce-utility-not-found", "Not found", "Ei löytynyt"],
        ] as const
      ).map(([familyId, route, profileId, en, fi]) =>
        page({
          key: `p10b14-${familyId}`,
          familyId,
          familyVersion: common.familyVersion,
          route,
          required: true,
          profile: { id: profileId, version: common.profileVersion },
          localeCoverage: [...common.localeCoverage],
          ...title(en, fi),
          commerceContext: { kind: "none" },
          navigation: [],
          evidenceReferences: [],
        }),
      ),
    ],
  };
}

export function createP10B14PremiumEditorialFixture() {
  const fixture = createP905aFreshMerchantFixture("premiumEditorial");
  const authority = approvedContentAuthority();
  const baseSnapshot = applyCommercialSharedFrame(
    fixture.planningInput.draft,
    P10B14_PREMIUM_EDITORIAL_SELECTION.sharedFrameProfileId,
  );
  const planningInput = { ...fixture.planningInput, draft: baseSnapshot };
  const siteMapDecision = createDecision(fixture, authority.references);
  const slice = materializeP10B14PremiumEditorialStorefront({
    planningInput,
    siteMapDecision,
    pageEvidenceAuthority: authority.pageEvidenceAuthority,
    contentFactAuthority: authority.contentFactAuthority,
    approvedAssetPresentations: fixture.assetPresentations,
  });
  const approvedBriefReference: PageFactEvidenceReference = {
    source: "merchant-approved",
    authorityId: fixture.brief.id,
    revision: String(fixture.brief.revision),
    status: "approved",
    approvalAuthorityId: fixture.brief.approval.actorId!,
    approvalFingerprint: fixture.brief.approvedEvidenceFingerprint!,
  };
  return Object.freeze({
    fixture,
    siteMapDecision: structuredClone(siteMapDecision),
    pageEvidenceAuthority: authority.pageEvidenceAuthority,
    contentFactAuthority: authority.contentFactAuthority,
    approvedEvidenceReferences: [
      approvedBriefReference,
      ...[...authority.references.values()].map((entry) => structuredClone(entry)),
    ],
    slice,
  });
}
